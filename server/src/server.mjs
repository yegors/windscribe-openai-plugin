import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WindscribeService, resultSchema, connectSchema, portsSchema, firewallSchema, locationsSchema, emptySchema } from './service.mjs';
import { featureTools } from './features.mjs';

export function createServer(service = new WindscribeService()) {
  const server = new McpServer({ name: 'windscribe', version: '0.3.1' });
  const tools = [
    ['get_status', 'Windscribe status', 'Read login, connection, protocol, firewall and reported update availability. For public IP use get_public_ip; for allowance use get_account_usage. May start Windscribe if not running.', emptySchema, true],
    ['list_ports', 'Windscribe protocol ports', 'Read supported ports for a VPN protocol.', portsSchema, true],
    ['show_locations', 'Windscribe locations', 'Request all, favorite, or static locations. Desktop installations may open their GUI picker instead of returning text.', locationsSchema, true],
    ['connect', 'Connect Windscribe', 'Connect to a regular location (default best), static IP/city (mode static), or last location (mode last, omit location). Changes routing and may interrupt connectivity. Verifies connection and optional protocol/port; reports observed city separately from requested alias/IP. Use only for an authorized VPN change.', connectSchema, false],
    ['disconnect', 'Disconnect Windscribe', 'Disconnect this computer from the VPN and report firewall state. Does not disable the firewall or log out. May expose traffic if the firewall is off.', emptySchema, true],
    ['set_firewall', 'Set Windscribe firewall', 'Enable or disable the VPN kill switch. Enabling can block internet access while disconnected; disabling can expose traffic. Respects Always On policy. Use only when this firewall change is requested.', firewallSchema, true],
    ...featureTools
  ];
  // CLI inspection can start the desktop app; locations can open a GUI picker.
  // Classify actual effects explicitly, independently of whether data is returned.
  const effects = {
    get_status: [false, false, false],
    list_ports: [false, false, false],
    show_locations: [false, false, false],
    get_public_ip: [false, false, false],
    get_account_usage: [false, false, false],
    get_cli_info: [true, false, false],
    list_amneziawg_presets: [false, false, false],
    connect: [false, true, false],
    disconnect: [false, true, false],
    set_firewall: [false, true, false],
    rotate_ip: [false, true, false],
    favorite_ip: [false, true, false],
    unfavorite_ip: [false, true, false],
    logout: [false, true, false],
    update_app: [false, true, false],
    set_key_limit_behavior: [false, true, false],
    reload_preferences: [false, true, false]
  };
  for (const [name, title, description, inputSchema, idempotentHint] of tools) {
    const [readOnlyHint, destructiveHint, openWorldHint] = effects[name];
    server.registerTool(name, {
      title, description: description + (name !== 'get_cli_info' ? ' Invoking the CLI may start the local Windscribe app if it is not running.' : ''), inputSchema, outputSchema: resultSchema,
      annotations: { readOnlyHint, destructiveHint, idempotentHint, openWorldHint }
    }, async (args, extra) => {
      const result = await service.call(name, args, extra.signal);
      return { isError: !result.ok, content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    });
  }
  return server;
}
