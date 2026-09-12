// Isolated local-chain integration test. Never reads .env or connects to Sepolia.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const { JsonRpcProvider, ContractFactory, Wallet } = createRequire(path.join(root, 'frontend-web/package.json'))('ethers');
const port = 18545;
const rpcUrl = `http://127.0.0.1:${port}`;
const anvilPath = path.join(process.env.USERPROFILE, '.foundry/bin/anvil.exe');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let anvil;
let rpc;
async function main() {
  // Refuse to use an existing chain at this port.
  try { await fetch(rpcUrl, { method: 'POST', body: '{}', signal: AbortSignal.timeout(500) });
    throw new Error('Port already occupied; refusing to modify an existing chain');
  } catch (error) { if (error.message.startsWith('Port already')) throw error; }
  anvil = spawn(anvilPath, ['--host', '127.0.0.1', '--port', String(port), '--silent'], { windowsHide: true, stdio: 'ignore' });
  anvil.on('error', error => { console.error(error.message); });
  await sleep(1500);
  rpc = new JsonRpcProvider(rpcUrl, 31337, { staticNetwork: true });
  if (Number((await rpc.getNetwork()).chainId) !== 31337) throw new Error('Not an isolated Anvil chain');
  const operator = await rpc.getSigner(0);
  const student = await rpc.getSigner(1);
  const artifact = name => JSON.parse(fs.readFileSync(path.join(root, 'blockchain/out', `${name}.sol`, `${name}.json`), 'utf8'));
  const tokenArtifact = artifact('EduTestUSDC');
  const escrowArtifact = artifact('EduConnectEscrow');
  const token = await new ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode.object, operator).deploy();
  await token.waitForDeployment();
  const escrow = await new ContractFactory(escrowArtifact.abi, escrowArtifact.bytecode.object, operator)
    .deploy(await token.getAddress(), await operator.getAddress(), await operator.getAddress());
  await escrow.waitForDeployment();
  await (await token.mint(await student.getAddress(), 10000000000n)).wait();
  console.log('Testing current escrow bytecode on isolated Anvil, port ' + port);
  const env = { ...process.env,
    RUN_ANVIL_SETTLEMENT_IT: 'true', RUN_ANVIL_DISPUTE_IT: 'true',
    LEARNING_SERVICE_URL: 'http://127.0.0.1:1', NOTIFICATION_SERVICE_URL: 'http://127.0.0.1:1',
    ANVIL_RPC_URL: rpcUrl, ANVIL_ESCROW_ADDRESS: await escrow.getAddress(), ANVIL_USDC_ADDRESS: await token.getAddress(),
    BLOCKCHAIN_OPERATOR_ADDRESS: await operator.getAddress(),
    BLOCKCHAIN_OPERATOR_PRIVATE_KEY: Wallet.fromPhrase('test test test test test test test test test test test junk').privateKey,
  };
  const args = ['-q', '-Dtest=AnvilSessionSettlementIntegrationTest,AnvilDisputeIntegrationTest',
    '-Dblockchain.enabled=true', '-Dblockchain.operator.enabled=true', '-Dblockchain.chain-id=31337',
    `-Dblockchain.rpc-url=${rpcUrl}`, `-Dblockchain.escrow-address=${await escrow.getAddress()}`,
    `-Dblockchain.usdc-address=${await token.getAddress()}`, '-Dblockchain.confirmations=1', '-Dblockchain.start-block=0',
    '-Dblockchain.dispatcher-initial-delay-ms=3600000', '-Dblockchain.receipt-watch-initial-delay-ms=3600000',
    '-Dblockchain.event-poll-initial-delay-ms=3600000', '-Dlogging.level.root=WARN',
    '-Dlogging.level.org.hibernate.SQL=WARN', '-Dlogging.level.org.springframework=WARN', 'test'];
  // All shell arguments are fixed or addresses produced by this local deployment.
  const mvn = spawn('cmd.exe', ['/d', '/s', '/c', `mvnw.cmd ${args.join(' ')}`],
    { cwd: path.join(root, 'backend/contract-service'), env, windowsHide: true, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { mvn.on('error', reject); mvn.on('exit', resolve); });
  if (code !== 0) throw new Error('Local blockchain integration tests failed');
  for (const test of ['AnvilSessionSettlementIntegrationTest', 'AnvilDisputeIntegrationTest']) {
    const report = fs.readFileSync(path.join(root, 'backend/contract-service/target/surefire-reports',
      `iuh.fit.contract_service.blockchain.${test}.txt`), 'utf8');
    if (!/Tests run: 1, Failures: 0, Errors: 0, Skipped: 0/.test(report)) throw new Error(`${test} did not actually pass`);
  }
  console.log('Local settlement and dispute integration tests passed. No Sepolia transaction sent.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => { rpc?.destroy(); anvil?.kill(); });
