// Requires local PostgreSQL binaries. Creates/stops a disposable TCP-only
// cluster, never connects to Supabase or any pre-existing database.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = process.env.ASTROSETTA_TEST_TMP;
if (!directory || !path.isAbsolute(directory)) throw new Error('Set ASTROSETTA_TEST_TMP to a disposable absolute directory');
const dataDir = path.join(directory, `postgres-${Date.now()}`);
mkdirSync(dataDir, { recursive: false });
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { encoding: 'utf8', cwd: root });
  if (result.status !== 0) throw new Error(`${cmd} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
};
const server = net.createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
run('initdb', ['-D', dataDir, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8']);
const pg = spawn('postgres', ['-D', dataDir, '-h', '127.0.0.1', '-p', String(port), '-k', ''], { stdio: ['ignore', 'ignore', 'pipe'] });
let pgOutput = '';
pg.stderr.on('data', chunk => { pgOutput += chunk; });
const args = ['-X', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (spawnSync('pg_isready', ['-h', '127.0.0.1', '-p', String(port)]).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`Local PostgreSQL did not start: ${pgOutput}`);
  for (const file of [
    'scripts/tests/database-bootstrap.sql',
    'supabase/migrations/20260914000001_base44_replica_schema.sql',
    'supabase/migrations/20260921000001_llm_usage_rpc.sql',
    'supabase/migrations/20261008000001_protect_accounts_and_usage.sql',
    'supabase/migrations/20261008000002_billing_snapshots.sql',
    'supabase/migrations/20261008000003_launch_configuration.sql',
    'supabase/migrations/20261008000004_calendar_connections.sql',
    'supabase/migrations/20261008000005_ai_request_metrics.sql',
    'scripts/tests/database-regressions.sql',
    'scripts/tests/migration-completion.sql',
  ]) {
    run('psql', [...args, '-f', file]);
    console.log(`PASS ${file}`);
  }
  const sql = "select public.increment_llm_usage('00000000-0000-4000-8000-000000000001','concurrent-first-call',3)->>'allowed';";
  const answers = await Promise.all(Array.from({ length: 16 }, () => new Promise((resolve, reject) => {
    const child = spawn('psql', [...args, '-At', '-c', sql]);
    let stdout = '', stderr = '';
    child.stdout.on('data', x => { stdout += x; });
    child.stderr.on('data', x => { stderr += x; });
    child.on('exit', code => code === 0 ? resolve(stdout.trim()) : reject(Error(stderr)));
  })));
  assert.equal(answers.filter(x => x === 'true').length, 3);
  console.log('PASS atomic quota: exactly 3 of 16 simultaneous first calls admitted');
} finally {
  pg.kill('SIGTERM');
  await new Promise(resolve => pg.once('exit', resolve));
  console.log('Disposable PostgreSQL stopped; no existing databases accessed.');
}
