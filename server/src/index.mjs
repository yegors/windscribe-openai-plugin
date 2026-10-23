import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.mjs';

const server = createServer();
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await server.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
// Protocol messages only on stdout. Never log CLI output or credentials.
server.connect(new StdioServerTransport()).catch(() => {
  process.stderr.write('Windscribe MCP failed to start. Check host configuration.\n');
  process.exitCode = 1;
});
