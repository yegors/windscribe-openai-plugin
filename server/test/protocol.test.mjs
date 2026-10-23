import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.mjs';
import { WindscribeService } from '../src/service.mjs';
import { SerialExecutor } from '../src/cli.mjs';

test('MCP initialize/list/call yields seventeen annotated, schema-validated tools', async () => {
  const calls = [];
  const service = new WindscribeService({ executor: new SerialExecutor({ useLock: false }), cli: { async run(args) {
    calls.push(args); return 'Login state: Logged in\nFirewall state: Off\nConnect state: Disconnected';
  } } });
  const server = createServer(service);
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 17);
    assert.ok(!tools.some(t => t.name === 'send_debug_logs'));
    for (const tool of tools) {
      assert.ok(tool.outputSchema);
      for (const hint of ['readOnlyHint', 'destructiveHint', 'openWorldHint', 'idempotentHint']) assert.equal(typeof tool.annotations[hint], 'boolean');
    }
    assert.equal(tools.find(t => t.name === 'disconnect').annotations.readOnlyHint, false);
    assert.equal(tools.find(t => t.name === 'get_cli_info').annotations.readOnlyHint, true);
    for (const name of ['get_status', 'show_locations', 'get_public_ip', 'list_ports', 'get_account_usage', 'list_amneziawg_presets']) {
      const tool = tools.find(t => t.name === name);
      assert.equal(tool.annotations.readOnlyHint, false, 'May start a stateful app or open its UI');
      assert.equal(tool.annotations.destructiveHint, false);
      assert.match(tool.description, /may start the local Windscribe app/);
    }
    for (const tool of tools) assert.equal(tool.annotations.openWorldHint, false, 'Targets local app, private account or fixed Windscribe catalog');
    const result = await client.callTool({ name: 'get_status', arguments: {} });
    assert.equal(result.structuredContent.status.connection, 'disconnected');
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    const invalid = await client.callTool({ name: 'connect', arguments: { location: ';whoami' } });
    assert.equal(invalid.isError, true);
    assert.deepEqual(calls, [['status']]);
  } finally { await client.close(); await server.close(); }
});
