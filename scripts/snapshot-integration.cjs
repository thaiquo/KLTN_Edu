// Run from any directory: node scripts/snapshot-integration.cjs [--verify-restore]
// Requires Docker and Git. No application services or migrations are started.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const destination = path.join(root, '.local-backups', `integration-${stamp}`);
const source = 'kltn-postgres';
const database = 'kltn_db';
const user = 'postgres';
let clone;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024,
    windowsHide: true, ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args[0]} failed: ${result.error?.message || result.stderr || result.status}`);
  }
  return result.stdout;
}

function sql(container, db, query) {
  return run('docker', ['exec', '-i', container, 'psql', '-X', '-U', user, '-d', db,
    '-v', 'ON_ERROR_STOP=1', '-At'], { input: query });
}

function counts(container, db) {
  const tables = sql(container, db,
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")
    .trim().split(/\r?\n/).filter(Boolean);
  if (!tables.length) throw new Error('Source/clone has no public tables; stop and inspect.');
  const query = tables.map(t => `SELECT '${t.replaceAll("'", "''")}', count(*) FROM public."${t.replaceAll('"', '""')}";`).join('\n');
  return sql(container, db, `BEGIN READ ONLY;\n${query}\nCOMMIT;`)
    .trim().split(/\r?\n/).filter(line => line.includes('|')).sort();
}

async function main() {
  fs.mkdirSync(destination, { recursive: true });
  const manifest = {
    createdAt: new Date().toISOString(), sourceContainer: source, sourceDatabase: database,
    head: run('git', ['rev-parse', 'HEAD']).trim(),
    branch: run('git', ['branch', '--show-current']).trim(),
    refs: run('git', ['show-ref']).trim().split(/\r?\n/),
    status: run('git', ['status', '--short']),
    verification: 'pending',
  };
  fs.writeFileSync(path.join(destination, 'worktree.patch'), run('git', ['diff', '--binary', 'HEAD']));
  // Preserve the existing user edit and local settings separately from commits.
  for (const file of ['scripts/start-all.ps1', '.env', 'frontend-web/.env', 'frontend-web/.env.local']) {
    if (!fs.existsSync(path.join(root, file))) continue;
    const target = path.join(destination, 'local-files', file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, file), target);
  }
  console.log('Saving and verifying all Git refs...');
  run('git', ['bundle', 'create', path.join(destination, 'repository.bundle'), '--all']);
  run('git', ['bundle', 'verify', path.join(destination, 'repository.bundle')]);
  manifest.sourceCounts = counts(source, database);
  console.log('Dumping the existing database (read only)...');
  const dump = path.join(destination, 'kltn_db.dump');
  const dumpFd = fs.openSync(dump, 'wx');
  try {
    run('docker', ['exec', source, 'pg_dump', '-U', user, '-d', database, '-Fc'],
      { stdio: ['ignore', dumpFd, 'pipe'] });
  } finally { fs.closeSync(dumpFd); }
  if (fs.statSync(dump).size === 0) throw new Error('Database dump is empty.');
  manifest.dumpBytes = fs.statSync(dump).size;
  manifest.sha256 = crypto.createHash('sha256').update(fs.readFileSync(dump)).digest('hex');
  const manifestPath = path.join(destination, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  if (process.argv.includes('--verify-restore')) {
    clone = `educonnect-restorecheck-${stamp.toLowerCase()}`;
    manifest.cloneContainer = clone;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('Restoring into a separate PostgreSQL container with no network or published ports...');
    run('docker', ['run', '-d', '--name', clone, '--network', 'none',
      '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=kltn_restorecheck', 'postgres:16']);
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try { sql(clone, 'kltn_restorecheck', 'SELECT 1;'); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
    }
    if (!ready) throw new Error('Isolated PostgreSQL did not become ready.');
    const inputFd = fs.openSync(dump, 'r');
    try {
      run('docker', ['exec', '-i', clone, 'pg_restore', '-U', user,
        '-d', 'kltn_restorecheck', '--exit-on-error', '--no-owner', '--no-privileges'],
        { stdio: [inputFd, 'pipe', 'pipe'] });
    } finally { fs.closeSync(inputFd); }
    manifest.cloneCounts = counts(clone, 'kltn_restorecheck');
    if (JSON.stringify(manifest.sourceCounts) !== JSON.stringify(manifest.cloneCounts)) {
      manifest.verification = 'count mismatch: investigate concurrent source writes or restore';
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      throw new Error(manifest.verification);
    }
    manifest.verification = 'restore succeeded; all public table row counts match';
    run('docker', ['stop', clone]);
    manifest.cloneStopped = true;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  console.log(`Snapshot: ${destination}`);
  console.log(`Database backup: ${manifest.dumpBytes} bytes; ${manifest.verification}`);
  console.log('Original database, branch tips and application services were not changed.');
}

main().catch(error => {
  console.error(error.message);
  console.error(`Inspect partial artifacts: ${destination}`);
  if (clone) console.error(`Isolated clone (never the original): ${clone}`);
  process.exitCode = 1;
});
