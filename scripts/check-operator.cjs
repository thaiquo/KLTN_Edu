// Read-only local credential validation. Never signs, broadcasts or prints secrets.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'frontend-web', 'package.json'));
const { Wallet } = req('ethers');
const { parseEnv } = require('node:util');
(async () => {
  const env = parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  const keystore = env.BLOCKCHAIN_OPERATOR_KEYSTORE_PATH || path.join(process.env.USERPROFILE || process.env.HOME, '.foundry', 'keystores', 'edu-deployer');
  const password = env.BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD || (env.BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD_FILE
    ? fs.readFileSync(env.BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD_FILE, 'utf8').replace(/\r?\n$/, '') : '');
  if (!password) throw new Error('Password is not configured');
  const wallet = await Wallet.fromEncryptedJson(fs.readFileSync(keystore, 'utf8'), password);
  if (env.BLOCKCHAIN_OPERATOR_ADDRESS && wallet.address.toLowerCase() !== env.BLOCKCHAIN_OPERATOR_ADDRESS.toLowerCase())
    throw new Error('Configured operator address does not match keystore');
  console.log('Keystore decrypts successfully. Operator address: ' + wallet.address);
  console.log('Operator enabled: ' + (env.BLOCKCHAIN_OPERATOR_ENABLED === 'true'));
})().catch(() => { console.error('Operator validation failed: check password, keystore path and configured address. No transaction was sent.'); process.exitCode = 1; });
