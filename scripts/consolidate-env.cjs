// One-time mechanical merge. Root values win; never print configuration values.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.env');
const source = path.join(root, 'frontend-web', '.env');
if (!fs.existsSync(source)) { console.log('Frontend already uses root .env.'); process.exit(0); }
const original = fs.readFileSync(target, 'utf8');
const frontend = fs.readFileSync(source, 'utf8');
const keys = new Set(original.split(/\r?\n/).map(line => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/)?.[1]).filter(Boolean));
const additions = frontend.split(/\r?\n/).filter(line => {
  const key = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/)?.[1];
  if (!key || keys.has(key)) return false;
  keys.add(key); return true;
});
const backup = path.join(root, '.local-backups', 'env-' + Date.now());
fs.mkdirSync(backup, { recursive: true });
fs.copyFileSync(target, path.join(backup, 'root.env'));
fs.copyFileSync(source, path.join(backup, 'frontend.env'));
if (additions.length) fs.writeFileSync(target, original.trimEnd() + '\n\n# Consolidated frontend configuration\n' + additions.join('\n') + '\n');
fs.renameSync(source, path.join(backup, 'frontend-original.env'));
console.log(`Consolidated ${additions.length} missing keys. Original files preserved under .local-backups. Root values retained.`);
