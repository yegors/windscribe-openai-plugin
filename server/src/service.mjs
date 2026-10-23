import { z } from 'zod';
import { setTimeout as delay } from 'node:timers/promises';
import { CliError, SerialExecutor, WindscribeCli } from './cli.mjs';
import { handleFeature } from './features.mjs';

export const protocolSchema = z.enum(['wireguard', 'ikev2', 'udp', 'tcp', 'stealth', 'wstunnel']);
export const connectSchema = z.object({
  location: z.string().trim().min(1).max(120).regex(/^[\p{L}\p{N}][\p{L}\p{N} .,'():_-]*$/u, 'Use a location name, nickname, region, country code, or static IP.').default('best').describe('Requested VPN destination in the Windscribe server catalog, or an assigned static IP. Never ask for the user\'s physical location, home address, or GPS coordinates.'),
  mode: z.enum(['regular', 'static', 'last']).default('regular'),
  protocol: protocolSchema.optional(),
  port: z.number().int().min(1).max(65535).optional()
}).strict().refine(v => !v.port || v.protocol, { message: 'An explicit port requires a protocol.' })
  .refine(v => v.mode !== 'static' || v.location !== 'best', { message: 'Static mode requires a city or IP.' })
  .refine(v => v.mode !== 'last' || v.location === 'best', { message: 'Last-location mode cannot specify a location.' });
export const portsSchema = z.object({ protocol: protocolSchema }).strict();
export const firewallSchema = z.object({ enabled: z.boolean() }).strict();
export const locationsSchema = z.object({ kind: z.enum(['all', 'favorites', 'static']).default('all') }).strict();
export const emptySchema = z.object({}).strict();

export function parseStatus(text) {
  const get = key => text.split(/\r?\n/).map(l => l.replace(/^\*/, '')).find(l => l.toLowerCase().startsWith(key.toLowerCase() + ':'))?.slice(key.length + 1).trim();
  const login = get('Login state'), firewall = get('Firewall state'), connection = get('Connect state'), protocol = get('Protocol');
  const interference = /\[Network interference\]/i.test(connection || '');
  const pending = /^\*\s*Connected/i.test(connection || '') || /^\*Connect state:\s*Connected/im.test(text);
  const value = (connection || '').replace(/^\*\s*/, '');
  let state = 'unknown';
  if (/^Disconnected\b/i.test(value)) state = 'disconnected';
  else if (/^Disconnecting\b/i.test(value)) state = 'disconnecting';
  else if (/^Connecting\b/i.test(value)) state = 'connecting';
  else if (/^Connected\b/i.test(value)) state = 'connected';
  const match = protocol?.match(/^([\w -]+):(\d+)$/);
  const warnings = [];
  if (interference) warnings.push('Windscribe tunnel validation reports network interference.');
  if (pending) warnings.push('Windscribe tunnel validation is pending.');
  if (!login || !firewall || state === 'unknown' && !/^Logged out$/i.test(login || '')) warnings.push('Some status fields are unavailable or unrecognized; CLI language/version may differ.');
  return {
    internet: ['available', 'unavailable'].includes(get('Internet connectivity')?.toLowerCase()) ? get('Internet connectivity').toLowerCase() : 'unknown',
    updateAvailableVersion: get('Update available') || null,
    loggedIn: /^Logged in$/i.test(login || '') ? true : /^Logged out$|^Not logged in$/i.test(login || '') ? false : null,
    firewall: /^Always On$/i.test(firewall || '') ? 'always_on' : /^On$/i.test(firewall || '') ? 'on' : /^Off$/i.test(firewall || '') ? 'off' : 'unknown',
    connection: state,
    location: state === 'connected' ? (value.match(/^Connected\s*:\s*(.*?)(?:\s*\[Network interference\])?$/i)?.[1]?.trim() || null) : null,
    protocol: match?.[1]?.trim() || null,
    port: match ? Number(match[2]) : null,
    validation: interference ? 'interference' : pending ? 'pending' : state === 'connected' ? 'passed' : 'unknown',
    warnings
  };
}

export function parsePorts(text) {
  const cleaned = text.trim();
  if (!/^\d+(?:\s*,\s*\d+)*$/.test(cleaned)) throw new CliError('UNRECOGNIZED_OUTPUT', 'Cannot recognize the CLI port list; no port was selected.');
  const ports = [...new Set(cleaned.split(',').map(Number))];
  if (ports.some(p => p < 1 || p > 65535)) throw new CliError('UNRECOGNIZED_OUTPUT', 'CLI returned an invalid port list.');
  return ports;
}

export const statusSchema = z.object({
  internet: z.enum(['available', 'unavailable', 'unknown']), loggedIn: z.boolean().nullable(),
  updateAvailableVersion: z.string().nullable(),
  firewall: z.enum(['on', 'off', 'always_on', 'unknown']),
  connection: z.enum(['connected', 'disconnected', 'connecting', 'disconnecting', 'unknown']),
  location: z.string().nullable(), protocol: z.string().nullable(), port: z.number().int().nullable(),
  validation: z.enum(['passed', 'pending', 'interference', 'unknown']), warnings: z.array(z.string())
});
export const resultSchema = z.object({
  ok: z.boolean(), action: z.string(),
  status: statusSchema.optional(), ports: z.array(z.number().int()).optional(),
  locations: z.array(z.string()).optional(), uiRequired: z.boolean().optional(),
  verified: z.boolean().optional(), requestedLocation: z.string().optional(),
  message: z.string().optional(),
  ip: z.string().optional(), ipKind: z.enum(['public', 'vpn']).optional(),
  usage: z.object({ used: z.string(), total: z.string() }).optional(),
  cli: z.object({ version: z.string(), commands: z.array(z.string()), platform: z.string(), interactiveLoginRequired: z.boolean() }).optional(),
  presets: z.array(z.string()).optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional()
});

const normalizedProtocol = p => ({ wireguard: 'wireguard', ikev2: 'ikev2', udp: 'udp', tcp: 'tcp', stealth: 'stealth', wstunnel: 'wstunnel', openvpnudp: 'udp', openvpntcp: 'tcp' })[(p || '').toLowerCase().replace(/[^a-z0-9]/g, '')];

export class WindscribeService {
  constructor({ cli = new WindscribeCli(), executor = new SerialExecutor(), pollMs = 1000, verifyMs = 20000, platform = process.platform } = {}) {
    Object.assign(this, { cli, executor, pollMs, verifyMs, platform, parseStatus });
  }
  async status(signal) { return parseStatus(await this.cli.run(['status'], signal)); }
  async call(action, input, signal) {
    try {
      return await this.executor.run(inner => this.perform(action, input, inner), signal);
    } catch (e) {
      const error = e instanceof z.ZodError ? { code: 'INVALID_ARGUMENT', message: 'Arguments failed validation; no command was run.' }
        : e instanceof CliError ? { code: e.code, message: e.message }
          : e?.name === 'AbortError' ? { code: 'CANCELLED', message: 'Request cancelled. A submitted change may still be in progress; check status.' }
          : { code: 'INTERNAL_ERROR', message: 'The operation could not complete. Check status before retrying a change.' };
      return { ok: false, action, error };
    }
  }
  async perform(action, input, signal) {
    const featureResult = await handleFeature(this, action, input, signal);
    if (featureResult !== undefined) return featureResult;
    const run = args => this.cli.run(args, signal);
    if (action === 'get_status') {
      emptySchema.parse(input);
      const status = await this.status(signal);
      const recognized = status.connection !== 'unknown' || status.loggedIn === false;
      return { ok: recognized, action, status,
        ...(!recognized ? { error: { code: 'UNRECOGNIZED_OUTPUT', message: 'CLI status could not be interpreted; no settings changed.' } } : {}) };
    }
    if (action === 'list_ports') {
      const { protocol } = portsSchema.parse(input);
      this.checkPlatform(protocol);
      return { ok: true, action, ports: parsePorts(await run(['ports', protocol])) };
    }
    if (action === 'show_locations') {
      const { kind } = locationsSchema.parse(input);
      const args = kind === 'all' ? ['locations'] : ['locations', kind === 'favorites' ? 'fav' : 'static'];
      const output = (await run(args)).trim();
      if (!output) return { ok: true, action, locations: [], uiRequired: true, message: 'The desktop CLI may have opened the location picker. Empty output is not an empty server list; check Windscribe.' };
      // Best/static rows have two columns; regular rows have three. Keep IP suffixes.
      const locations = output.split(/\r?\n/).map(l => l.trim()).filter(l => /^[^\r\n]+ - [^\r\n]+$/.test(l) && !l.startsWith('(Device name:'));
      if (!locations.length) throw new CliError('UNRECOGNIZED_OUTPUT', 'Location output is not in the documented format; inspect the Windscribe picker.');
      return { ok: true, action, locations, uiRequired: false };
    }
    let args, desired, selection;
    if (action === 'connect') {
      selection = connectSchema.parse(input);
      this.checkPlatform(selection.protocol);
      if (selection.port) {
        const ports = parsePorts(await run(['ports', selection.protocol]));
        if (!ports.includes(selection.port)) throw new CliError('INVALID_PORT', 'Requested port is not supported for this protocol; no connection change was made.');
      }
      args = ['connect', '-n', ...(selection.mode === 'last' ? [] : selection.mode === 'static' ? ['static', selection.location] : [selection.location])];
      if (selection.protocol) args.push(selection.protocol + (selection.port ? `:${selection.port}` : ''));
      desired = 'connected';
    } else if (action === 'disconnect') {
      emptySchema.parse(input); args = ['disconnect', '-n']; desired = 'disconnected';
    } else if (action === 'set_firewall') {
      const { enabled } = firewallSchema.parse(input); desired = enabled ? 'on' : 'off'; args = ['firewall', desired];
    } else throw new CliError('UNKNOWN_TOOL', 'Unknown Windscribe operation.');

    const before = await this.status(signal);
    if (action === 'connect' && before.loggedIn !== true)
      throw new CliError('LOGIN_REQUIRED', 'A verified login is required. Sign in through the Windscribe app.');
    // Signed-out status omits the connection field, but firewall control is
    // still available. Only VPN connection changes require that field.
    if (before.firewall === 'unknown' || action !== 'set_firewall' && before.connection === 'unknown')
      throw new CliError('UNRECOGNIZED_OUTPUT', 'Required connection or firewall state is unrecognized. No change was submitted.');
    if (action === 'set_firewall' && desired === 'off' && before.firewall === 'always_on')
      throw new CliError('FIREWALL_POLICY', 'Always On policy prevents disabling the firewall.');
    if ((action === 'disconnect' && before.connection === desired) ||
        (action === 'set_firewall' && (before.firewall === desired || desired === 'on' && before.firewall === 'always_on')))
      return { ok: true, action, status: before, verified: true, message: 'Already in the requested state; no change submitted.' };
    await run(args);
    const deadline = Date.now() + this.verifyMs;
    let status;
    do {
      if (signal.aborted) throw new CliError('CANCELLED', 'Verification cancelled; the VPN change may still be in progress.');
      status = await this.status(signal);
      if (action === 'connect' && status.validation === 'interference') break;
      const matches = action === 'set_firewall' ? status.firewall === desired || desired === 'on' && status.firewall === 'always_on'
        : status.connection === desired && (action !== 'connect' || status.validation === 'passed');
      if (matches) {
        if (action === 'connect' && selection.protocol && normalizedProtocol(status.protocol) !== selection.protocol)
          return { ok: false, action, status, verified: false, error: { code: 'PROTOCOL_MISMATCH', message: 'Connected, but the requested protocol could not be verified. No alternate connection attempted.' } };
        if (action === 'connect' && selection.port && status.port !== selection.port)
          return { ok: false, action, status, verified: false, error: { code: 'PORT_MISMATCH', message: 'Connected, but the actual port differs from the requested port.' } };
        if (action === 'disconnect' && before.firewall !== 'unknown' && status.firewall !== before.firewall)
          return { ok: false, action, status, verified: false, error: { code: 'FIREWALL_CHANGED', message: 'Disconnected, but Windscribe changed the firewall state. No firewall command was issued.' } };
        return { ok: true, action, status, verified: true,
          ...(selection ? { requestedLocation: selection.mode === 'last' ? 'last' : selection.location, message: 'Connection and requested protocol/port verified. The observed location is reported separately; CLI aliases, static IPs and best/last selection prevent exact destination verification.' } : {}) };
      }
      if (Date.now() >= deadline) break;
      await delay(this.pollMs, undefined, { signal });
    } while (Date.now() <= deadline);
    return { ok: false, action, status, verified: false, error: {
      code: status?.validation === 'interference' ? 'NETWORK_INTERFERENCE' : 'VERIFICATION_TIMEOUT',
      message: 'The requested state was not verified. The change may still be in progress; check status before retrying. No rollback was attempted.'
    } };
  }
  checkPlatform(protocol) {
    if (protocol === 'ikev2' && this.platform === 'linux') throw new CliError('UNSUPPORTED_PROTOCOL', 'IKEv2 is only available on Windows and macOS.');
  }
}
