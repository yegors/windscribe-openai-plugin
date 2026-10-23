// Actual stdio handshake and read-only calls. No connect/disconnect/firewall changes.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] ? resolve(process.argv[2]) : resolve(root, '../plugins/windscribe/server/dist/server.cjs');
const client = new Client({ name: 'windscribe-readonly-smoke', version: '0.3.1' });
// The SDK inherits only standard environment variables. Forward the supported
// operator override explicitly so custom installations and fixtures work.
const env = process.env.WINDSCRIBE_CLI ? { WINDSCRIBE_CLI: process.env.WINDSCRIBE_CLI } : {};
const transport = new StdioClientTransport({ command: process.execPath, args: [target], stderr: 'pipe', env });
let stderr = '';
transport.stderr?.on('data', data => { stderr += data.toString(); });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  if (tools.length !== 17) throw Error('Expected seventeen tools');
  console.log('PASS: stdio initialization and tool discovery');
  for (const [name, args] of [['get_status', {}], ['list_ports', { protocol: 'wireguard' }], ['get_cli_info', {}], ['get_public_ip', {}], ['get_account_usage', {}]]) {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 45000 });
    if (result.isError) throw Error(`${name}: ${JSON.stringify(result.structuredContent || result.content)}`);
    console.log(`${name}: ${['get_public_ip', 'get_account_usage'].includes(name) ? 'PASS (value omitted from test log)' : JSON.stringify(result.structuredContent)}`);
  }
  if (stderr) throw Error(`Unexpected server stderr: ${stderr.slice(0, 500)}`);
} finally { await client.close(); }
