import { spawn } from 'node:child_process';
import { access, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, delimiter } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { createHash } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { setTimeout as delay } from 'node:timers/promises';

export class CliError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export async function findCli(env = process.env, platform = process.platform) {
  const override = env.WINDSCRIBE_CLI;
  if (override && (!isAbsolute(override) || /[\r\n\0]/.test(override)))
    throw new CliError('CONFIGURATION', 'WINDSCRIBE_CLI must be an absolute executable path.');
  const binary = platform === 'win32' ? 'windscribe-cli.exe' : 'windscribe-cli';
  const defaults = platform === 'win32'
    ? [join(env.ProgramFiles || 'C:\\Program Files', 'Windscribe', binary)]
    : platform === 'darwin' ? ['/Applications/Windscribe.app/Contents/MacOS/windscribe-cli'] : [];
  const candidates = override ? [override] : [...defaults,
    ...(env.PATH || '').split(delimiter).filter(p => isAbsolute(p)).map(p => join(p, binary))];
  for (const candidate of candidates) {
    try {
      const resolved = await realpath(candidate);
      await access(resolved, platform === 'win32' ? constants.F_OK : constants.X_OK);
      if (platform === 'win32' && !resolved.toLowerCase().endsWith('.exe')) continue;
      return resolved;
    } catch { /* Try next known installation location. */ }
  }
  throw new CliError('CLI_NOT_FOUND', override
    ? 'Configured Windscribe CLI executable is unavailable.'
    : 'Install Windscribe or set WINDSCRIBE_CLI to its absolute executable path.');
}

// Never return arbitrary CLI output: status may contain an IP or account usage.
export function classifyFailure(output) {
  if (/app did not start in time|access is denied|permission denied|InstallHelper/i.test(output))
    return new CliError('APP_ACCESS', 'Cannot reach Windscribe. Run this MCP server in the signed-in user session through the host-approved execution path; a sandbox can prevent access even when the app is running.');
  if (/already running|another instance|another command/i.test(output))
    return new CliError('CLI_BUSY', 'Another Windscribe command is running. Check status before retrying a change.');
  if (/not logged in|please log in|please login/i.test(output))
    return new CliError('LOGIN_REQUIRED', 'Sign in through the Windscribe app, then retry.');
  if (/always on/i.test(output))
    return new CliError('FIREWALL_POLICY', 'Windscribe Always On policy prevents this firewall change.');
  if (/no update available/i.test(output)) return new CliError('NO_UPDATE', 'Windscribe reports no update available.');
  if (/not connected/i.test(output)) return new CliError('CONNECTION_REQUIRED', 'Connect Windscribe before using this IP operation.');
  if (/no locations\./i.test(output)) return new CliError('NO_LOCATIONS', 'Windscribe reported no locations for this list or account.');
  if (/pro account|premium|your plan|upgrade to pro/i.test(output)) return new CliError('PLAN_REQUIRED', 'This operation requires an eligible Windscribe plan or location.');
  return new CliError('CLI_FAILED', 'Windscribe rejected the command. Check the app for details; no alternate action was attempted.');
}

export function runProcess(executable, args, { signal, timeoutMs = 10000, maxBytes = 65536 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new CliError('CANCELLED', 'Request cancelled before execution.'));
    let child;
    try { child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { return reject(new CliError('SPAWN_FAILED', 'Unable to start the Windscribe CLI.')); }
    const stdout = [], stderr = [];
    let bytes = 0, failure, finished = false, drainTimer;
    const fail = error => {
      failure ??= error;
      // Kill only our CLI child. Never terminate Windscribe's app or service.
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    };
    const abort = () => fail(new CliError('CANCELLED', 'Request cancelled. A submitted VPN change may still be in progress; check status.'));
    const timer = setTimeout(() => fail(new CliError('CLI_TIMEOUT', 'Windscribe CLI timed out. A submitted change may still be in progress; check status before retrying.')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const collect = chunks => chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) return fail(new CliError('OUTPUT_LIMIT', 'Windscribe returned more output than expected.'));
      chunks.push(chunk);
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    const finish = (code, error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(drainTimer);
      signal?.removeEventListener('abort', abort);
      child.stdout.destroy(); child.stderr.destroy();
      const output = Buffer.concat(stdout).toString('utf8') + Buffer.concat(stderr).toString('utf8');
      if (error || failure) reject(failure || error);
      else if (code !== 0) reject(classifyFailure(output));
      else resolve(output);
    };
    child.once('error', () => finish(null, new CliError('SPAWN_FAILED', 'Unable to execute Windscribe. Check the executable path and host permissions.')));
    // Prefer close to drain output, but bound the wait: an app auto-started by
    // the CLI may inherit pipe handles and keep them open after the CLI exits.
    child.once('close', code => finish(code));
    child.once('exit', code => {
      clearTimeout(timer);
      if (!finished) drainTimer = setTimeout(() => finish(code), 100);
    });
  });
}

export class SerialExecutor {
  #tail = Promise.resolve();
  constructor({ useLock = true, lockPath } = {}) {
    this.useLock = useLock;
    this.lockPath = lockPath || join(tmpdir(), `windscribe-mcp-${createHash('sha256').update(homedir()).digest('hex').slice(0, 20)}`);
  }
  async run(fn, signal) {
    const previous = this.#tail;
    let unlockQueue;
    this.#tail = new Promise(resolve => { unlockQueue = resolve; });
    // Cancelled waiters still hold their queue slot until their predecessor finishes.
    await previous;
    let release;
    const controller = new AbortController();
    const relay = () => controller.abort();
    signal?.addEventListener('abort', relay, { once: true });
    try {
      if (signal?.aborted) throw new CliError('CANCELLED', 'Request cancelled while queued.');
      if (this.useLock) {
        const until = Date.now() + 5000;
        while (!release) {
          if (signal?.aborted) throw new CliError('CANCELLED', 'Request cancelled while waiting for another chat.');
          try {
            release = await lockfile.lock(this.lockPath, {
              realpath: false, stale: 120000, update: 5000, retries: 0,
              onCompromised: () => controller.abort()
            });
          } catch (e) {
            if (e.code !== 'ELOCKED') throw new CliError('LOCK_FAILED', 'Cannot acquire the local Windscribe command lock.');
            if (Date.now() >= until) throw new CliError('CLI_BUSY', 'Another chat is controlling Windscribe. Try again after it finishes. A crashed server lock expires after two minutes.');
            await delay(100);
          }
        }
      }
      return await fn(controller.signal);
    } finally {
      signal?.removeEventListener('abort', relay);
      try { if (release) await release(); } finally { unlockQueue(); }
    }
  }
}

export class WindscribeCli {
  constructor({ executable, runner = runProcess } = {}) { this.executable = executable; this.runner = runner; }
  async run(args, signal, options = {}) {
    this.executable ||= await findCli();
    return this.runner(this.executable, args, { ...options, signal });
  }
}
