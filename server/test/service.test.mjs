import test from 'node:test';
import assert from 'node:assert/strict';
import { WindscribeService, parseStatus, parsePorts } from '../src/service.mjs';
import { SerialExecutor, CliError } from '../src/cli.mjs';

const disconnected = 'Internet connectivity: available\nLogin state: Logged in\nFirewall state: Off\nConnect state: Disconnected\nPublic IP: 192.0.2.10\nData usage: SECRET';
const connected = 'Internet connectivity: available\nLogin state: Logged in\nFirewall state: Off\nConnect state: Connected: Toronto\nProtocol: WireGuard:443';
function fixture(replies) {
  const calls = [];
  const cli = { async run(args) {
    calls.push(args);
    assert.ok(replies.length, 'Unexpected CLI call');
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    return reply;
  } };
  return { calls, service: new WindscribeService({ cli, executor: new SerialExecutor({ useLock: false }), pollMs: 1, verifyMs: 1000 }) };
}

test('status omits IP and account usage, preserves unknowns and tunnel qualifiers', () => {
  const status = parseStatus(disconnected);
  assert.equal(status.connection, 'disconnected');
  assert.equal(status.loggedIn, true);
  assert.ok(!JSON.stringify(status).includes('192.0.2.10'));
  assert.ok(!JSON.stringify(status).includes('SECRET'));
  assert.equal(parseStatus(connected.replace('Connected:', '*Connected:')).validation, 'pending');
  assert.equal(parseStatus(connected.replace('Toronto', 'Toronto [Network interference]')).validation, 'interference');
  assert.equal(parseStatus('unknown localized text').connection, 'unknown');
  assert.equal(parseStatus('unknown localized text').loggedIn, null);
});
test('ports require an actual port list, never infer numbers from error prose', () => {
  assert.deepEqual(parsePorts('443, 80, 443\n'), [443, 80]);
  assert.throws(() => parsePorts('Error 443: access denied'), CliError);
});
test('hostile location and invalid protocol/port shapes cause no execution', async () => {
  for (const input of [{ location: '-n' }, { location: 'Toronto; whoami' }, { location: 'Toronto\nlogout' }, { protocol: 'bogus' }, { port: 443 }, { location: 'best', arbitrary: 'logout' }]) {
    const { service, calls } = fixture([]);
    assert.equal((await service.call('connect', input)).error.code, 'INVALID_ARGUMENT');
    assert.equal(calls.length, 0);
  }
});
test('unsupported explicit port is rejected before mutation', async () => {
  const { service, calls } = fixture(['443, 80']);
  const result = await service.call('connect', { protocol: 'wireguard', port: 999 });
  assert.equal(result.error.code, 'INVALID_PORT');
  assert.deepEqual(calls, [['ports', 'wireguard']]);
});
test('connect passes separate arguments and waits for tunnel validation', async () => {
  const { service, calls } = fixture(['443, 80', disconnected, '', connected.replace('Connected:', '*Connected:'), connected]);
  const result = await service.call('connect', { location: 'Toronto', protocol: 'wireguard', port: 443 });
  assert.equal(result.ok, true); assert.equal(result.verified, true);
  assert.equal(result.status.location, 'Toronto');
  assert.deepEqual(calls[2], ['connect', '-n', 'Toronto', 'wireguard:443']);
  assert.equal(calls.filter(c => c[0] === 'connect').length, 1);
});
test('connect requires verified login', async () => {
  const { service, calls } = fixture([disconnected.replace('Logged in', 'Logged out')]);
  assert.equal((await service.call('connect', {})).error.code, 'LOGIN_REQUIRED');
  assert.deepEqual(calls, [['status']]);
});
test('signed-out status permits explicit firewall control and rejects connecting', async () => {
  const signedOut = 'Login state: Logged out\nFirewall state: On';
  const a = fixture([signedOut, '', signedOut.replace('On', 'Off')]);
  const result = await a.service.call('set_firewall', { enabled: false });
  assert.equal(result.ok, true);
  assert.equal(result.verified, true);
  assert.equal(result.status.loggedIn, false);
  assert.deepEqual(a.calls, [['status'], ['firewall', 'off'], ['status']]);

  const b = fixture([signedOut]);
  assert.equal((await b.service.call('connect', {})).error.code, 'LOGIN_REQUIRED');
  assert.deepEqual(b.calls, [['status']]);

  const c = fixture([signedOut.replace('On', 'Always On')]);
  assert.equal((await c.service.call('set_firewall', { enabled: false })).error.code, 'FIREWALL_POLICY');
  assert.deepEqual(c.calls, [['status']]);
});
test('protocol mismatch and network interference cannot report success', async () => {
  const a = fixture([disconnected, '', connected.replace('WireGuard', 'TCP')]);
  assert.equal((await a.service.call('connect', { protocol: 'wireguard' })).error.code, 'PROTOCOL_MISMATCH');
  const b = fixture([disconnected, '', connected.replace('Toronto', 'Toronto [Network interference]')]);
  assert.equal((await b.service.call('connect', {})).error.code, 'NETWORK_INTERFERENCE');
});
test('disconnect neither logs out nor changes firewall; detects app-side change', async () => {
  const { service, calls } = fixture([connected, '', disconnected]);
  assert.equal((await service.call('disconnect', {})).ok, true);
  assert.deepEqual(calls, [['status'], ['disconnect', '-n'], ['status']]);
  const b = fixture([connected.replace('Firewall state: Off', 'Firewall state: On'), '', disconnected]);
  assert.equal((await b.service.call('disconnect', {})).error.code, 'FIREWALL_CHANGED');
});
test('Always On cannot be disabled; already-on is idempotent', async () => {
  const value = disconnected.replace('Firewall state: Off', 'Firewall state: Always On');
  const a = fixture([value]);
  assert.equal((await a.service.call('set_firewall', { enabled: false })).error.code, 'FIREWALL_POLICY');
  assert.deepEqual(a.calls, [['status']]);
  const b = fixture([value]);
  assert.equal((await b.service.call('set_firewall', { enabled: true })).ok, true);
  assert.deepEqual(b.calls, [['status']]);
});
test('empty locations report GUI fallback; unrecognized status is an error', async () => {
  const a = fixture(['']);
  const result = await a.service.call('show_locations', {});
  assert.equal(result.uiRequired, true); assert.deepEqual(result.locations, []);
  const b = fixture(['random text']);
  assert.equal((await b.service.call('get_status', {})).error.code, 'UNRECOGNIZED_OUTPUT');
});
test('timeout after mutation does not blindly resubmit it', async () => {
  const { service, calls } = fixture([disconnected, new CliError('CLI_TIMEOUT', 'timeout')]);
  assert.equal((await service.call('connect', {})).error.code, 'CLI_TIMEOUT');
  assert.deepEqual(calls, [['status'], ['connect', '-n', 'best']]);
});
test('per-server queue serializes concurrent calls and releases after failure', async () => {
  const queue = new SerialExecutor({ useLock: false });
  const events = [];
  const a = queue.run(async () => { events.push('a'); await new Promise(r => setTimeout(r, 20)); events.push('b'); throw Error('test'); }).catch(() => {});
  const b = queue.run(async () => { events.push('c'); });
  await Promise.all([a, b]); assert.deepEqual(events, ['a', 'b', 'c']);
});

test('uncertain preflight state blocks every mutation', async () => {
  for (const [action, input] of [['connect', {}], ['disconnect', {}], ['set_firewall', { enabled: false }]]) {
    const { service, calls } = fixture([disconnected.replace('Firewall state: Off', 'Firewall state: unknown')]);
    assert.equal((await service.call(action, input)).error.code, 'UNRECOGNIZED_OUTPUT');
    assert.deepEqual(calls, [['status']]);
  }
});
test('firewall changes are verified; unsupported actual port fails verification', async () => {
  const a = fixture([disconnected, '', disconnected.replace('Firewall state: Off', 'Firewall state: On')]);
  assert.equal((await a.service.call('set_firewall', { enabled: true })).verified, true);
  assert.deepEqual(a.calls, [['status'], ['firewall', 'on'], ['status']]);
  const b = fixture(['443, 80', disconnected, '', connected.replace(':443', ':80')]);
  assert.equal((await b.service.call('connect', { protocol: 'wireguard', port: 443 })).error.code, 'PORT_MISMATCH');
});
test('verification deadline returns last status without repeating the change', async () => {
  const { service, calls } = fixture([disconnected, '', disconnected]);
  service.verifyMs = 0;
  const result = await service.call('connect', {});
  assert.equal(result.error.code, 'VERIFICATION_TIMEOUT');
  assert.equal(result.status.connection, 'disconnected');
  assert.deepEqual(calls, [['status'], ['connect', '-n', 'best'], ['status']]);
});
test('cancellation during verification sleep is reported without retry', async () => {
  const controller = new AbortController();
  let reads = 0;
  const calls = [];
  const cli = { async run(args) {
    calls.push(args);
    if (args[0] !== 'status') return '';
    if (++reads === 2) setTimeout(() => controller.abort(), 10);
    return disconnected;
  } };
  const service = new WindscribeService({ cli, executor: new SerialExecutor({ useLock: false }), pollMs: 1000 });
  assert.equal((await service.call('connect', {}, controller.signal)).error.code, 'CANCELLED');
  assert.deepEqual(calls, [['status'], ['connect', '-n', 'best'], ['status']]);
});
