# Publisher website material for Windscribe 0.3.1

Draft for the Windscribe website team. No website has been changed. This document supplies technical facts; it does not replace the publisher's privacy policy or terms.

## Proposed plugin landing-page copy

Windscribe is an official desktop plugin that lets you control an installed Windscribe VPN from a compatible local chat. Check connection and firewall status, request your Windscribe-reported public or VPN IP and data allowance, choose a VPN destination or protocol, connect and disconnect, and use supported IP and app-management actions.

The plugin requires Windscribe with its modern CLI, Node.js 22 or later, and a host that allows local MCP execution. Sign in using the Windscribe app. It uses existing account entitlements and does not sell subscriptions, collect payments or control the browser extension. VPN and firewall changes affect this computer's network connection. Some commands depend on the installed Windscribe version and platform.

The local MCP server is bundled with its JavaScript dependencies. It has no listening network port or separate hosted plugin backend. Selected information requested by the user is returned to the chat host and may appear in conversation history. The plugin does not read or transmit raw diagnostic logs.

Before publishing, add the actual install instructions and links to the applicable support page, privacy notice and terms. Do not advertise public-directory availability until published.

## Data flow verified from this implementation

| Category | Actual implementation |
| --- | --- |
| User inputs | VPN catalog destination or static IP, protocol/port, favorite IP, firewall state, and supported settings. No user GPS/home address is requested. |
| CLI processing | The local process invokes the installed CLI. CLI status may contain IP and allowance in temporary process memory even when the basic status tool returns only selected operational fields. |
| Returned data | Requested connection/login/firewall/protocol state, catalog locations, capability/version information, or dedicated IP/usage results. Static/favorite lists may contain IP addresses. |
| Authentication | Existing app session; no password, OTP, payment card or account-token tool arguments. |
| Local storage | No MCP server log files or automatic telemetry implemented. A per-user temporary filesystem lock coordinates requests; its name contains a truncated hash of the home directory, not command payloads. It is normally released after a call. OS/host crash records and Windscribe's own records are outside this wrapper's control. |
| Recipients | The local CLI/app receives requested commands. The chat host receives tool arguments/results. Windscribe's existing app can contact its services for VPN/account/update functions. The wrapper makes no independent public-IP web lookup. |
| Retention | Request data exists in process memory; the wrapper provides no persistent request-history store. The chat host and Windscribe app/service have their own retention rules. This code does not define or enforce those policies. |
| User controls | Users choose requested operations and host tool permissions; disabling/uninstalling the plugin prevents future calls. This does not itself delete prior chat history or Windscribe account/service records. |
| Raw diagnostics | No tool reads or uploads raw logs. The native CLI's capabilities may still list its logs command; that does not expose an executable MCP operation. |

## Publisher decisions required

Confirm the recipients and policy relationships for supported chat hosts, service retention/deletion rules, user contact and deletion process, any host-managed diagnostics, and how the existing Windscribe terms apply to this plugin. Have the responsible policy owner review and publish the resulting disclosure at a real public URL. Confirm the landing page identifies this plugin and Windscribe as publisher. Then update both manifests with verified final URLs and rebuild.

Do not claim that all data stays on-device, that chat-host retention is controlled by this wrapper, that all records are deleted on uninstall, or that the current general privacy page already covers this integration without owner confirmation.
