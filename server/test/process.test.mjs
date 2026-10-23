import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runProcess, SerialExecutor, classifyFailure, findCli } from '../src/cli.mjs';

test('process runner passes arguments literally, including shell syntax', async () => {
  const literal = 'Toronto; echo injected & $(whoami)';
  assert.equal(await runProcess(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', literal]), literal);
});
test('runner enforces timeout and output limit', async () => {
  await assert.rejects(runProcess(process.execPath, ['-e', 'setInterval(()=>{}, 1000)'], { timeoutMs: 80 }), { code: 'CLI_TIMEOUT' });
  await assert.rejects(runProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(10000))'], { maxBytes: 128 }), { code: 'OUTPUT_LIMIT' });
});
test('runner preserves split UTF-8 location characters and drains final output', async () => {
  const script = 'const b=Buffer.from("München"); process.stdout.write(b.subarray(0,2)); setTimeout(()=>process.stdout.write(b.subarray(2)),20);';
  assert.equal(await runProcess(process.execPath, ['-e', script]), 'München');
  const expected = 'x'.repeat(60000);
  assert.equal(await runProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(60000))']), expected);
});
test('runner supports cancellation before and during process execution', async () => {
  const a = AbortSignal.abort();
  await assert.rejects(runProcess(process.execPath, ['-e', ''], { signal: a }), { code: 'CANCELLED' });
  const b = new AbortController();
  const result = runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: b.signal });
  setTimeout(() => b.abort(), 80);
  await assert.rejects(result, { code: 'CANCELLED' });
});
test('errors on stdout become safe errors without dumping output', async () => {
  await assert.rejects(runProcess(process.execPath, ['-e', 'console.log("Aborting: app did not start in time SECRET");process.exitCode=1']), error => error.code === 'APP_ACCESS' && !error.message.includes('SECRET'));
  assert.equal(classifyFailure('Always On').code, 'FIREWALL_POLICY');
  await assert.rejects(findCli({ WINDSCRIBE_CLI: 'relative.exe' }), { code: 'CONFIGURATION' });
});
test('two server instances serialize via shared lock and leave it reusable', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'windscribe-test-'));
  const path = join(folder, 'lease');
  const a = new SerialExecutor({ lockPath: path }), b = new SerialExecutor({ lockPath: path });
  let active = 0, maximum = 0;
  const work = async () => { active++; maximum = Math.max(maximum, active); await new Promise(r => setTimeout(r, 30)); active--; };
  try {
    await Promise.all([a.run(work), b.run(work)]);
    assert.equal(maximum, 1);
    await a.run(work);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
