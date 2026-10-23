import { z } from 'zod';
import { isIP } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { CliError } from './cli.mjs';

const empty = z.object({}).strict();
export const ipSchema = z.string().max(45).refine(value => isIP(value) !== 0, 'Use an IPv4 or IPv6 address.');
export const logoutSchema = z.object({ firewall: z.enum(['preserve', 'on', 'off']).default('preserve') }).strict();
export const unfavoriteSchema = z.object({ ip: ipSchema }).strict();
export const keyLimitSchema = z.object({ behavior: z.enum(['keep', 'delete']) }).strict();

export const featureTools = [
  ['get_public_ip', 'Windscribe public IP', 'Read the public or VPN IP reported by Windscribe status. Use for "what is my IP?" without a separate web service. This is Windscribe-reported state, not an independent leak test.', empty, true],
  ['get_account_usage', 'Windscribe data usage', 'Read used data and allowance from Windscribe status when requested. Does not expose credentials or manage billing.', empty, true],
  ['get_cli_info', 'Windscribe CLI capabilities', 'Read the installed CLI version and advertised commands. Reports whether optional commands are available in this build.', empty, true],
  ['rotate_ip', 'Rotate Windscribe IP', 'Request a different VPN IP on the current server, then verify a changed IP and validated connection. Requires a connection and an eligible plan. Can interrupt network traffic. Use only for a requested IP rotation.', empty, false],
  ['favorite_ip', 'Favorite Windscribe IP', 'Pin the current VPN IP as a favorite. Requires a connection and eligible plan. Reports command acceptance; the CLI does not provide a portable read-back of favorite state.', empty, true],
  ['unfavorite_ip', 'Unfavorite Windscribe IP', 'Remove a specified IPv4 or IPv6 address from favorites. Requires login. Use only for the requested address.', unfavoriteSchema, true],
  ['logout', 'Sign out of Windscribe', 'Sign out and disconnect. Preserves the observed firewall on/off state by default; on/off explicitly requests that state. Never use as a disconnect workaround. Signing back in requires the Windscribe app or an interactive user terminal.', logoutSchema, true],
  ['update_app', 'Update Windscribe', 'Ask Windscribe to install its available update. May download software, show installer UI or restart the app. Use only when the user requests installation, not for checking update availability (use get_status). Completion is not independently verified.', empty, false],
  ['list_amneziawg_presets', 'Windscribe AmneziaWG presets', 'List AmneziaWG censorship presets if the installed CLI advertises this command. Does not change settings.', empty, true],
  ['set_key_limit_behavior', 'Windscribe WireGuard key limit', 'Linux headless only: choose keep or delete-oldest-key behavior at the WireGuard key limit. Deleting an old key can affect another device. Requires an explicit request for this setting.', keyLimitSchema, true],
  ['reload_preferences', 'Reload Windscribe preferences', 'Linux headless only: reload the existing configuration file. May change DNS, routing or firewall settings and interrupt connectivity. Does not edit the file. Use only when reload is requested.', empty, true]
];
const definitions = new Map(featureTools.map(tool => [tool[0], tool]));

export function parseIp(text) {
  const match = text.match(/^(Public IP|VPN IP):\s*(\S+)\s*$/im);
  if (!match || !isIP(match[2])) throw new CliError('IP_UNAVAILABLE', 'Windscribe did not report a valid public/VPN IP. No external lookup was made.');
  return { ip: match[2], ipKind: match[1].toLowerCase().startsWith('vpn') ? 'vpn' : 'public' };
}
export function parseUsage(text) {
  const match = text.match(/^Data usage:\s*([^\r\n/]{1,80})\s*\/\s*([^\r\n]{1,80})$/im);
  if (!match) throw new CliError('USAGE_UNAVAILABLE', 'Windscribe did not report a recognizable data allowance. Check login and app language.');
  return { used: match[1].trim(), total: match[2].trim() };
}
export function parseCliInfo(text) {
  const version = text.match(/windscribe-cli\s+v?(\d+\.\d+\.\d+(?:[\w.+-]*))/i)?.[1];
  if (!version) throw new CliError('UNRECOGNIZED_OUTPUT', 'Cannot recognize the installed CLI version/help.');
  const commands = ['login', 'logout', 'status', 'locations', 'ports', 'connect', 'disconnect', 'firewall', 'ip', 'logs', 'update', 'amneziawg', 'keylimit', 'preferences', 'ignoresslerrors']
    .filter(command => new RegExp(`^\\s*${command}(?:\\s|$)`, 'm').test(text));
  return { version, commands, platform: process.platform, interactiveLoginRequired: true };
}

async function requireCapability(service, command, signal, linuxOnly = false) {
  if (linuxOnly && service.platform !== 'linux')
    throw new CliError('UNSUPPORTED_COMMAND', 'This operation requires the Linux headless CLI.');
  const info = parseCliInfo(await service.cli.run(['--help'], signal));
  if (!info.commands.includes(command)) throw new CliError('UNSUPPORTED_COMMAND', 'This CLI build does not advertise the requested command. No setting was changed.');
  return info;
}
function requireLogin(status) {
  if (status.loggedIn !== true) throw new CliError('LOGIN_REQUIRED', 'Sign in through Windscribe before using this operation.');
}
function requireConnected(status) {
  requireLogin(status);
  if (status.connection !== 'connected' || status.validation !== 'passed')
    throw new CliError('CONNECTION_REQUIRED', 'A connected and validated VPN tunnel is required.');
}
async function verify(service, signal, observe, matches, stopOnInterference = false) {
  const deadline = Date.now() + service.verifyMs;
  let latest;
  do {
    signal.throwIfAborted();
    latest = await observe();
    if (stopOnInterference && latest.status?.validation === 'interference') return { ...latest, ok: false, verified: false,
      error: { code: 'NETWORK_INTERFERENCE', message: 'Windscribe reports tunnel interference after rotation. No further rotation was attempted.' } };
    if (matches(latest)) return { ...latest, ok: true, verified: true };
    if (Date.now() >= deadline) break;
    await delay(service.pollMs, undefined, { signal });
  } while (Date.now() <= deadline);
  return { ...latest, ok: false, verified: false, error: { code: 'VERIFICATION_TIMEOUT', message: 'The requested state was not verified. Inspect status before retrying; no change was replayed or rolled back.' } };
}

// Invoked inside the same per-user lock as the core VPN tools.
export async function handleFeature(service, action, input, signal) {
  const definition = definitions.get(action);
  if (!definition) return undefined;
  const args = definition[3].parse(input);
  const run = (argv, options) => service.cli.run(argv, signal, options);
  if (action === 'get_public_ip') return { ok: true, action, ...parseIp(await run(['status'])), message: 'IP reported by the local Windscribe app; no independent external lookup was performed.' };
  if (action === 'get_account_usage') return { ok: true, action, usage: parseUsage(await run(['status'])) };
  if (action === 'get_cli_info') return { ok: true, action, cli: parseCliInfo(await run(['--help'])) };
  if (action === 'list_amneziawg_presets') {
    await requireCapability(service, 'amneziawg', signal);
    const presets = (await run(['amneziawg'])).trim().split(/\r?\n/).filter(Boolean);
    if (!presets.length) throw new CliError('UNRECOGNIZED_OUTPUT', 'No AmneziaWG presets were returned.');
    return { ok: true, action, presets };
  }
  if (action === 'set_key_limit_behavior' || action === 'reload_preferences') {
    await requireCapability(service, action === 'reload_preferences' ? 'preferences' : 'keylimit', signal, true);
    await run(action === 'reload_preferences' ? ['preferences', 'reload'] : ['keylimit', args.behavior]);
    return { ok: true, action, verified: false, message: 'CLI command completed. This CLI provides no independent read-back for the setting; inspect the app/configuration before claiming verification.' };
  }
  if (action === 'update_app') {
    await requireCapability(service, 'update', signal);
    await run(['update'], { timeoutMs: 120000 });
    return { ok: true, action, verified: false, message: 'Windscribe update command completed; installer UI or restart may still be pending. Installed version has not been verified.' };
  }
  const before = await service.status(signal);
  if (action === 'logout') {
    if (before.loggedIn === false && args.firewall === 'preserve') return { ok: true, action, verified: true, status: before, message: 'Already signed out; no command submitted.' };
    if (before.loggedIn === false) throw new CliError('ALREADY_LOGGED_OUT', 'Already signed out. Use set_firewall for a separately requested firewall change.');
    if (before.loggedIn !== true || before.firewall === 'unknown') throw new CliError('UNRECOGNIZED_OUTPUT', 'Login and firewall state must be recognized before signing out.');
    const desired = args.firewall === 'preserve' ? (before.firewall === 'off' ? 'off' : 'on') : args.firewall;
    if (desired === 'off' && before.firewall === 'always_on') throw new CliError('FIREWALL_POLICY', 'Always On policy prevents disabling the firewall.');
    await run(['logout', desired]);
    return { action, ...await verify(service, signal, async () => ({ status: await service.status(signal) }),
      ({ status }) => status.loggedIn === false && (desired === 'on' ? ['on', 'always_on'].includes(status.firewall) : status.firewall === 'off')) };
  }
  requireLogin(before);
  if (action === 'unfavorite_ip') {
    await run(['ip', 'unfav', args.ip]);
    return { ok: true, action, ip: args.ip, verified: false, message: 'Unfavorite command completed; inspect favorites to confirm the resulting list.' };
  }
  requireConnected(before);
  if (action === 'favorite_ip') {
    await run(['ip', 'fav']);
    return { ok: true, action, verified: false, message: 'Favorite command completed; inspect favorites to confirm the pinned IP.' };
  }
  const originalText = await run(['status']);
  requireConnected(service.parseStatus(originalText));
  const original = parseIp(originalText);
  if (original.ipKind !== 'vpn') throw new CliError('IP_UNAVAILABLE', 'Windscribe has not reported a validated VPN IP to compare. No rotation was submitted.');
  await run(['ip', 'rotate'], { timeoutMs: 30000 });
  const result = await verify(service, signal, async () => {
    const text = await run(['status']);
    let ip;
    try { ip = parseIp(text); } catch (error) { if (error.code !== 'IP_UNAVAILABLE') throw error; }
    return { status: service.parseStatus(text), ...ip };
  }, ({ status, ip, ipKind }) => status.connection === 'connected' && status.validation === 'passed' && ipKind === 'vpn' && ip !== original.ip, true);
  return { action, ...result };
}
