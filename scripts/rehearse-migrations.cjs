// Rehearsal ONLY. Never accepts the original container or database.
// node scripts/rehearse-migrations.cjs educonnect-restorecheck-<snapshot> [kltn_restorecheck|kltn_rehearsal_fresh]
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const container = process.argv[2];
const database = process.argv[3] || 'kltn_restorecheck';
if (!/^educonnect-restorecheck-\d{8}t\d{6}z$/.test(container || '')
    || !['kltn_restorecheck', 'kltn_rehearsal_fresh'].includes(database)) {
  throw new Error('Only a snapshot verification container and rehearsal databases are permitted.');
}
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
function sql(query) {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres',
    '-d', database, '-v', 'ON_ERROR_STOP=1', '-At'], {
    cwd: root, input: query, encoding: 'utf8', windowsHide: true, timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
  return result.stdout.trim();
}
const crcTable = Array.from({length: 256}, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function checksum(content) {
  let crc = 0xffffffff;
  for (const line of content.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)) {
    for (const byte of Buffer.from(line)) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) | 0;
}
function migrations(service) {
  const folder = path.join(root, 'backend', service + '-service', 'src/main/resources/db/migration');
  return fs.readdirSync(folder).filter(name => /^V\d+__.*\.sql$/.test(name)).map(name => {
    const content = fs.readFileSync(path.join(folder, name), 'utf8');
    return { name, version: Number(name.match(/^V(\d+)/)[1]), content, checksum: checksum(content) };
  }).sort((a, b) => a.version - b.version);
}
function insertHistory(table, migration) {
  return `INSERT INTO ${table} (installed_rank,version,description,type,script,checksum,installed_by,execution_time,success)
    SELECT COALESCE(MAX(installed_rank),0)+1,${quote(migration.version)},
    ${quote(migration.name.split('__')[1].replace(/\.sql$/, '').replaceAll('_', ' '))},'SQL',
    ${quote(migration.name)},${migration.checksum},current_user,0,true FROM ${table};`;
}

const report = { container, database, startedAt: new Date().toISOString(), services: [] };
for (const service of ['account', 'learning', 'contract', 'notification']) {
  const files = migrations(service);
  if (new Set(files.map(f => f.version)).size !== files.length) throw new Error(`Duplicate ${service} migration versions`);
  const table = `flyway_${service}_schema_history`;
  const exists = sql(`SELECT to_regclass('public.${table}') IS NOT NULL;`) === 't';
  const history = exists ? JSON.parse(sql(`SELECT COALESCE(json_agg(h ORDER BY installed_rank),'[]') FROM ${table} h;`)) : [];
  let statements = [`DO $$ BEGIN IF current_database() NOT IN ('kltn_restorecheck','kltn_rehearsal_fresh') THEN RAISE EXCEPTION 'Rehearsal only'; END IF; END $$;`];
  if (!exists) statements.push(`CREATE TABLE ${table} (
    installed_rank INTEGER PRIMARY KEY, version VARCHAR(50), description VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL, script VARCHAR(1000) NOT NULL, checksum INTEGER,
    installed_by VARCHAR(100) NOT NULL, installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    execution_time INTEGER NOT NULL, success BOOLEAN NOT NULL);`);
  if (history.some(h => !h.success)) throw new Error(`${service}: unsuccessful historical migration`);
  const legacyLearning = service === 'learning' && history.some(h => h.version === '24' && h.checksum === -1273861791);
  if (legacyLearning) {
    if (!history.some(h => h.version === '15' && h.checksum === -1187981549)
        || !history.some(h => h.version === '26' && h.checksum === -1114772602)) {
      throw new Error('Unknown Learning legacy fingerprint; refusing history conversion');
    }
    statements.push('CREATE SCHEMA IF NOT EXISTS integration_archive;',
      `CREATE TABLE integration_archive.${table}_before AS TABLE public.${table};`);
    const v15 = files.find(f => f.version === 15), v24 = files.find(f => f.version === 24);
    const wallet = files.find(f => f.version === 26), sessions = files.find(f => f.version === 27);
    // Execute the new backfill and authorization DDL before recording their canonical identity.
    // Wallet and session DDL are idempotently checked again; legacy history remains archived.
    statements.push(v15.content, v24.content, wallet.content, sessions.content);
    for (const [oldVersion, migration] of [[26, sessions], [24, wallet], [15, v15]]) {
      statements.push(`UPDATE ${table} SET version=${quote(migration.version)}, script=${quote(migration.name)},
        description=${quote(migration.name.split('__')[1].replace(/\.sql$/, '').replaceAll('_',' '))},
        checksum=${migration.checksum} WHERE version=${quote(oldVersion)};`);
      const item = history.find(h => h.version === String(oldVersion));
      // Avoid reselecting an already-reassigned version in this in-memory representation.
      if (item) item._replacement = migration;
    }
    for (const item of history) if (item._replacement) {
      item.version = String(item._replacement.version); item.script = item._replacement.name;
      item.checksum = item._replacement.checksum;
    }
    statements.push(insertHistory(table, v24));
    history.push({version: '24', checksum: v24.checksum, script: v24.name, success: true});
  }
  if (service === 'notification' && history.some(h => h.version === '1' && h.checksum === -1181958534)) {
    const first = files.find(f => f.version === 1);
    statements.push('CREATE SCHEMA IF NOT EXISTS integration_archive;',
      `CREATE TABLE integration_archive.${table}_before AS TABLE public.${table};`,
      'ALTER TABLE public.notifications SET SCHEMA integration_archive;', first.content,
      `DO $$ BEGIN IF EXISTS (
        SELECT 1 FROM integration_archive.notifications n LEFT JOIN public.users u
          ON u.id=n.recipient_id AND lower(u.email)=lower(n.recipient_email)
        WHERE u.id IS NULL) THEN RAISE EXCEPTION 'Legacy notification recipient mismatch; preserve and investigate'; END IF; END $$;`,
      `INSERT INTO public.notifications(event_id,recipient_user_id,type,title,message,reference_type,reference_id,read_at,created_at)
       SELECT 'legacy:'||id::text,recipient_id,type,title,content,reference_type,reference_id,
       CASE WHEN is_read THEN COALESCE(read_at,created_at) AT TIME ZONE 'UTC' ELSE NULL END,
       created_at AT TIME ZONE 'UTC' FROM integration_archive.notifications;`,
      `UPDATE ${table} SET script=${quote(first.name)},description='create notifications',checksum=${first.checksum} WHERE version='1';`);
    const old = history.find(h => h.version === '1'); old.script = first.name; old.checksum = first.checksum;
  }
  for (const old of history.filter(h => h.type !== 'BASELINE' && h.version !== '0')) {
    const file = files.find(f => f.version === Number(old.version));
    if (!file || file.checksum !== old.checksum || file.name !== old.script) {
      throw new Error(`${service} V${old.version}: unknown mismatch; no changes applied for this service`);
    }
  }
  const pending = files.filter(file => !history.some(h => Number(h.version) === file.version));
  for (const file of pending) statements.push(file.content, insertHistory(table, file));
  const script = 'BEGIN;\n' + statements.join('\n') + '\nCOMMIT;\n';
  const output = path.join(root, '.local-backups', `rehearsal-${database}-${service}.sql`);
  fs.writeFileSync(output, script);
  sql(script);
  const after = JSON.parse(sql(`SELECT COALESCE(json_agg(h ORDER BY installed_rank),'[]') FROM ${table} h;`));
  for (const file of files) {
    if (!after.some(h => h.version === String(file.version) && h.script === file.name && h.checksum === file.checksum && h.success)) {
      throw new Error(`Postcondition failed for ${service}/${file.name}`);
    }
  }
  report.services.push({service, applied: pending.map(f => f.name), legacyLearning, historyVerified: true});
  console.log(`${service}: canonical migration history verified; ${pending.length} pending scripts applied`);
}
fs.writeFileSync(path.join(root, '.local-backups', `rehearsal-${database}-report.json`), JSON.stringify(report, null, 2));
console.log('Rehearsal finished. Original container/database were not accessed.');
