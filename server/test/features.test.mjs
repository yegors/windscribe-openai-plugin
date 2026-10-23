import test from 'node:test';
import assert from 'node:assert/strict';
import { WindscribeService, parseStatus, resultSchema } from '../src/service.mjs';
import { SerialExecutor, CliError } from '../src/cli.mjs';
import { parseIp, parseCliInfo } from '../src/features.mjs';

const idle = 'Internet connectivity: available\nLogin state: Logged in\nFirewall state: On\nConnect state: Disconnected\nPublic IP: 192.0.2.10\nData usage: 1.2 GiB / Unlimited';
const connected = idle.replace('Disconnected', 'Connected: Toronto').replace('Public IP', 'VPN IP');
const signedOut = 'Internet connectivity: unavailable\nLogin state: Logged out\nFirewall state: On';
const help = 'windscribe-cli v2.25.2\n    status\n    connect [options]\n    ip rotate\n    update\n    logs send\n    amneziawg\n    preferences reload\n    keylimit keep|delete';
function fixture(replies, options = {}) {
  const calls = [];
  const cli = { async run(args, signal, opts) {
    calls.push({ args, opts });
    assert.ok(replies.length, `Unexpected call: ${args}`);
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    return reply;
  } };
  const service = new WindscribeService({ cli, executor: new SerialExecutor({ useLock: false }), pollMs: 1, verifyMs: 1000, ...options });
  return { service, calls, async call(action, input = {}) {
    const result = await service.call(action, input);
    resultSchema.parse(result);
    return result;
  } };
}

test('IP uses Windscribe public/VPN fields, validates addresses and rejects prose', async () => {
  assert.deepEqual(parseIp(idle), { ip: '192.0.2.10', ipKind: 'public' });
  assert.deepEqual(parseIp('VPN IP: 2001:db8::1'), { ip: '2001:db8::1', ipKind: 'vpn' });
  assert.throws(() => parseIp('Public IP: unknown'), { code: 'IP_UNAVAILABLE' });
  const a = fixture([idle]);
  assert.equal((await a.call('get_public_ip')).ip, '192.0.2.10');
  assert.deepEqual(a.calls.map(c => c.args), [['status']]);
  const b = fixture(['Login state: Logged out']);
  assert.equal((await b.call('get_public_ip')).error.code, 'IP_UNAVAILABLE');
});
test('usage is separately requested; basic status excludes IP and usage', async () => {
  const a = fixture([idle]);
  assert.deepEqual((await a.call('get_account_usage')).usage, { used: '1.2 GiB', total: 'Unlimited' });
  assert.ok(!JSON.stringify(parseStatus(idle)).includes('192.0.2.10'));
  assert.ok(!JSON.stringify(parseStatus(idle)).includes('GiB'));
  assert.equal((await fixture([signedOut]).call('get_account_usage')).error.code, 'USAGE_UNAVAILABLE');
});
test('status handles upstream pending prefix, unavailable internet, logged-out omission, updates', async () => {
  assert.equal(parseStatus(connected.replace('Connect state:', '*Connect state:')).validation, 'pending');
  assert.equal(parseStatus(connected.replace('Connect state:', '*Connect state:')).connection, 'connected');
  const result = await fixture([signedOut]).call('get_status');
  assert.equal(result.ok, true);
  assert.equal(result.status.internet, 'unavailable');
  assert.equal(result.status.connection, 'unknown');
  assert.equal(parseStatus(idle + '\nUpdate available: 2.26.0').updateAvailableVersion, '2.26.0');
  assert.equal(parseStatus(idle).updateAvailableVersion, null);
});
test('static and last-location connection arguments follow CLI grammar', async () => {
  const a = fixture([idle, '', connected]);
  assert.equal((await a.call('connect', { mode: 'static', location: 'Dallas' })).ok, true);
  assert.deepEqual(a.calls[1].args, ['connect', '-n', 'static', 'Dallas']);
  const b = fixture([idle, '', connected + '\nProtocol: WireGuard:443']);
  assert.equal((await b.call('connect', { mode: 'last', protocol: 'wireguard' })).ok, true);
  assert.deepEqual(b.calls[1].args, ['connect', '-n', 'wireguard']);
  for (const input of [{ mode: 'static' }, { mode: 'last', location: 'Toronto' }]) {
    const c = fixture([]); assert.equal((await c.call('connect', input)).error.code, 'INVALID_ARGUMENT');
    assert.equal(c.calls.length, 0);
  }
});
test('locations retain two-column static/best rows and pinned IPs; omit device banner', async () => {
  const a = fixture(['(Device name: PRIVATE)\n\nDallas - Ranch [192.0.2.11]\nCanada - Toronto - Comfort Zone\nBest - Best Location']);
  const result = await a.call('show_locations', { kind: 'static' });
  assert.equal(result.locations.length, 3); assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('capabilities come from installed help; optional commands are guarded', async () => {
  assert.equal(parseCliInfo(help).version, '2.25.2');
  const a = fixture([help]); assert.equal((await a.call('get_cli_info')).cli.commands.includes('amneziawg'), true);
  const b = fixture(['windscribe-cli v2.25.2\n status']);
  assert.equal((await b.call('list_amneziawg_presets')).error.code, 'UNSUPPORTED_COMMAND');
  assert.deepEqual(b.calls.map(c => c.args), [['--help']]);
  const c = fixture([help, 'preset-a\npreset-b']);
  assert.deepEqual((await c.call('list_amneziawg_presets')).presets, ['preset-a', 'preset-b']);
});
test('rotation requires validated connection and a changed VPN IP', async () => {
  const a = fixture([idle]);
  assert.equal((await a.call('rotate_ip')).error.code, 'CONNECTION_REQUIRED');
  const b = fixture([connected, connected, '', connected, connected.replace('192.0.2.10', '192.0.2.12')]);
  const result = await b.call('rotate_ip');
  assert.equal(result.verified, true); assert.equal(result.ip, '192.0.2.12');
  assert.equal(b.calls.filter(c => c.args[1] === 'rotate').length, 1);
  assert.equal(b.calls[2].opts.timeoutMs, 30000);
  const c = fixture([connected, connected, '', connected], { verifyMs: 0 });
  assert.equal((await c.call('rotate_ip')).error.code, 'VERIFICATION_TIMEOUT');
  const d = fixture([connected, connected, '', connected.replace('Toronto', 'Toronto [Network interference]')]);
  assert.equal((await d.call('rotate_ip')).error.code, 'NETWORK_INTERFERENCE');
});
test('IP favorites have exact arguments, login checks and honest acceptance-only results', async () => {
  const a = fixture([connected, '']);
  assert.equal((await a.call('favorite_ip')).verified, false);
  assert.deepEqual(a.calls[1].args, ['ip', 'fav']);
  const b = fixture([idle, '']);
  assert.equal((await b.call('unfavorite_ip', { ip: '2001:db8::1' })).ok, true);
  assert.deepEqual(b.calls[1].args, ['ip', 'unfav', '2001:db8::1']);
  const c = fixture([]);
  assert.equal((await c.call('unfavorite_ip', { ip: '192.0.2.1;logout' })).error.code, 'INVALID_ARGUMENT');
  assert.equal(c.calls.length, 0);
  assert.equal((await fixture([signedOut]).call('favorite_ip')).error.code, 'LOGIN_REQUIRED');
});
test('logout preserves firewall by default, respects Always On and verifies logged-out status', async () => {
  const a = fixture([connected, '', signedOut]);
  assert.equal((await a.call('logout')).verified, true);
  assert.deepEqual(a.calls[1].args, ['logout', 'on']);
  const b = fixture([idle.replace('Firewall state: On', 'Firewall state: Off'), '', signedOut.replace('Firewall state: On', 'Firewall state: Off')]);
  assert.equal((await b.call('logout')).verified, true); assert.deepEqual(b.calls[1].args, ['logout', 'off']);
  const c = fixture([connected.replace('Firewall state: On', 'Firewall state: Always On')]);
  assert.equal((await c.call('logout', { firewall: 'off' })).error.code, 'FIREWALL_POLICY');
  assert.equal(c.calls.length, 1);
  const d = fixture([signedOut]);
  assert.equal((await d.call('logout', { firewall: 'off' })).error.code, 'ALREADY_LOGGED_OUT');
  assert.equal(d.calls.length, 1);
});
test('maintenance has bounded execution, no false completion proof, no automatic resend', async () => {
  for (const [action, args, timeoutMs] of [['update_app', ['update'], 120000]]) {
    const a = fixture([help, '']);
    assert.equal((await a.call(action)).verified, false);
    assert.deepEqual(a.calls[1], { args, opts: { timeoutMs } });
    const b = fixture([help, new CliError('CLI_TIMEOUT', 'timeout')]);
    assert.equal((await b.call(action)).error.code, 'CLI_TIMEOUT');
    assert.equal(b.calls.length, 2);
  }
});
test('debug-log transmission is unavailable and cannot launch any CLI command', async () => {
  const a = fixture([]);
  assert.equal((await a.call('send_debug_logs')).error.code, 'UNKNOWN_TOOL');
  assert.equal(a.calls.length, 0);
});
test('Linux settings require Linux and advertised headless support, with fixed arguments', async () => {
  const a = fixture([], { platform: 'win32' });
  assert.equal((await a.call('reload_preferences')).error.code, 'UNSUPPORTED_COMMAND'); assert.equal(a.calls.length, 0);
  const b = fixture([help, ''], { platform: 'linux' });
  assert.equal((await b.call('reload_preferences')).verified, false);
  assert.deepEqual(b.calls[1].args, ['preferences', 'reload']);
  const c = fixture([help, ''], { platform: 'linux' });
  assert.equal((await c.call('set_key_limit_behavior', { behavior: 'delete' })).ok, true);
  assert.deepEqual(c.calls[1].args, ['keylimit', 'delete']);
  const d = fixture(['windscribe-cli v2.25.2\n status'], { platform: 'linux' });
  assert.equal((await d.call('reload_preferences')).error.code, 'UNSUPPORTED_COMMAND');
});
