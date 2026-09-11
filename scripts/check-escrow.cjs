// Read-only chain reconciliation. Agreement bytes32 IDs may be supplied as arguments.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { parseEnv } = require('node:util');
const root = path.resolve(__dirname, '..');
const { JsonRpcProvider, Contract, id, formatUnits } = createRequire(path.join(root, 'frontend-web', 'package.json'))('ethers');
(async () => {
  const env = parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  const rpc = new JsonRpcProvider(env.BLOCKCHAIN_RPC_URL, Number(env.BLOCKCHAIN_CHAIN_ID), { staticNetwork: true });
  try {
    const escrow = new Contract(env.BLOCKCHAIN_ESCROW_ADDRESS, [
      'function hasRole(bytes32,address) view returns(bool)',
      'function getAgreement(bytes32) view returns(address student,address tutor,bytes32 termsHash,uint256 totalAmount,uint256 pricePerSession,uint256 remainingAmount,uint256 releasedAmount,uint256 refundedAmount,uint64 paymentDeadline,uint32 totalSessions,uint32 settledSessions,uint32 openDisputes,uint8 status)'
    ], rpc);
    const token = new Contract(env.BLOCKCHAIN_USDC_ADDRESS, ['function balanceOf(address) view returns(uint256)'], rpc);
    console.log('Escrow USDC balance: ' + formatUnits(await token.balanceOf(escrow.target), 6));
    console.log('Operator role: ' + await escrow.hasRole(id('OPERATOR_ROLE'), env.BLOCKCHAIN_OPERATOR_ADDRESS));
    for (const agreementId of process.argv.slice(2)) {
      const agreement = await escrow.getAgreement(agreementId);
      console.log(JSON.stringify({agreementId, status: Number(agreement.status), remainingUnits: agreement.remainingAmount.toString()}));
    }
  } finally { rpc.destroy(); }
})().catch(() => { console.error('Read-only escrow audit failed; verify RPC access and configuration.'); process.exitCode = 1; });
