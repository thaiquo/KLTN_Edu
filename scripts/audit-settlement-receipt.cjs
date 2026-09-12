// Read-only verification against the ABI compiled from the current Solidity source.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { parseEnv } = require('node:util');
const root = path.resolve(__dirname, '..');
const { JsonRpcProvider, Contract, Interface, formatUnits } = createRequire(path.join(root, 'frontend-web/package.json'))('ethers');

(async () => {
  const hash = process.argv[2];
  if (!/^0x[0-9a-f]{64}$/i.test(hash || '')) throw new Error('Expected transaction hash');
  const env = parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  const rpcUrl = env.BLOCKCHAIN_RPC_URL_ALCHEMY || env.BLOCKCHAIN_RPC_URL;
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const network = await rpc.getNetwork();
    if (network.chainId !== BigInt(env.BLOCKCHAIN_CHAIN_ID)) throw new Error('Wrong RPC chain');
    const abi = JSON.parse(fs.readFileSync(path.join(root, 'blockchain/out/EduConnectEscrow.sol/EduConnectEscrow.json'), 'utf8')).abi;
    const escrow = new Contract(env.BLOCKCHAIN_ESCROW_ADDRESS, abi, rpc);
    const token = new Contract(env.BLOCKCHAIN_USDC_ADDRESS, [
      'function balanceOf(address) view returns(uint256)', 'function decimals() view returns(uint8)',
      'event Transfer(address indexed from,address indexed to,uint256 value)'
    ], rpc);
    const receipt = await rpc.getTransactionReceipt(hash);
    if (!receipt || receipt.status !== 1 || receipt.to.toLowerCase() !== escrow.target.toLowerCase()) {
      throw new Error('Missing successful escrow receipt');
    }
    const block = await rpc.getBlock(receipt.blockNumber);
    if (block.hash !== receipt.blockHash) throw new Error('Receipt is not canonical');
    const decimals = Number(await token.decimals());
    const decoded = receipt.logs.filter(log => log.address.toLowerCase() === escrow.target.toLowerCase())
      .map(log => escrow.interface.parseLog(log)).filter(Boolean);
    const settled = decoded.find(log => log.name === 'SessionSettled');
    if (!settled) throw new Error('No SessionSettled event');
    const args = settled.args;
    const agreement = await escrow.getAgreement(args.agreementId, { blockTag: receipt.blockNumber });
    const session = await escrow.getSessionSettlement(args.agreementId, args.sessionId, { blockTag: receipt.blockNumber });
    const transfers = receipt.logs.filter(log => log.address.toLowerCase() === token.target.toLowerCase())
      .map(log => token.interface.parseLog(log)).filter(log => log?.name === 'Transfer');
    const expected = new Map();
    const platform = await escrow.platformWallet({ blockTag: receipt.blockNumber });
    for (const [address, amount] of [[agreement.tutor, args.tutorAmount], [platform, args.platformAmount], [agreement.student, args.studentRefund]]) {
      expected.set(address.toLowerCase(), (expected.get(address.toLowerCase()) || 0n) + amount);
    }
    const actual = new Map();
    for (const log of transfers) {
      if (log.args.from.toLowerCase() !== escrow.target.toLowerCase()) continue;
      const to = log.args.to.toLowerCase();
      actual.set(to, (actual.get(to) || 0n) + log.args.value);
    }
    for (const address of new Set([...expected.keys(), ...actual.keys()])) {
      if ((expected.get(address) || 0n) !== (actual.get(address) || 0n)) throw new Error('Transfer distribution mismatch');
    }
    if (args.tutorAmount + args.platformAmount + args.studentRefund !== agreement.pricePerSession) {
      throw new Error('Session amount not conserved');
    }
    if (agreement.remainingAmount + agreement.releasedAmount + agreement.refundedAmount !== agreement.totalAmount) {
      throw new Error('Agreement accounting not conserved');
    }
    console.log(JSON.stringify({ chainId: network.chainId.toString(), transactionHash: hash,
      block: receipt.blockNumber, timestamp: new Date(block.timestamp * 1000).toISOString(),
      confirmations: await receipt.confirmations(), agreementId: args.agreementId, sessionId: args.sessionId,
      sessionStatus: Number(session.status), outcome: Number(args.outcome),
      tutorUsdc: formatUnits(args.tutorAmount, decimals), platformUsdc: formatUnits(args.platformAmount, decimals),
      studentRefundUsdc: formatUnits(args.studentRefund, decimals),
      remainingUsdc: formatUnits(agreement.remainingAmount, decimals),
      releasedUsdc: formatUnits(agreement.releasedAmount, decimals), settledSessions: Number(agreement.settledSessions),
      escrowBalanceAtSettlementUsdc: formatUnits(await token.balanceOf(escrow.target, { blockTag: receipt.blockNumber }), decimals),
      transfers: transfers.map(log => ({from: log.args.from, to: log.args.to, usdc: formatUnits(log.args.value, decimals)})),
      accountingAndTransfersVerified: true }, null, 2));
  } finally { rpc.destroy(); }
})().catch(error => { console.error('Settlement audit failed: ' + (error.stack || error.message || error)); process.exitCode = 1; });
