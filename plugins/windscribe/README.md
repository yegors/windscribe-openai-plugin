# Windscribe

Official Windscribe desktop plugin, version 0.3.1. A local stdio MCP server controls the installed Windscribe CLI. The host launches the server; no listening TCP port, hosted service, or OpenAI API key is required.

## Requirements

- Node.js 22 or later on the host's PATH. Node itself is not bundled.
- Windscribe with the modern `windscribe-cli` executable, signed in through Windscribe. The legacy Linux `windscribe` CLI is not supported.
- A desktop host that supports local MCP servers, running on the computer whose VPN should be controlled. Local execution and tool access must be allowed by host/workspace policy.

All JavaScript runtime dependencies are bundled in `server/dist/server.cjs`; users do not run npm or download packages at launch. License notices and the bundled dependency inventory are beside the server. No credentials should be added to MCP configuration. For custom installations, the operator can set `WINDSCRIBE_CLI` in the server environment to an absolute executable path. Tool arguments cannot change this path.

Windows: launch the MCP server in the signed-in user's session using the host's approved local execution mechanism. A restricted sandbox may prevent communication with the app even when it is running, and may trigger an InstallHelper access dialog. The server does not elevate privileges, change permissions, or launch InstallHelper directly. Restarting or reinstalling Windscribe is not the default response to a timeout.

## Tools

| Tool | Behavior |
| --- | --- |
| `get_status` | Read connection, login, firewall, location, protocol and reported update version. |
| `get_public_ip` | Read Windscribe's reported public/VPN IP, with no external lookup. |
| `get_account_usage` | Read used data and total allowance when requested. |
| `get_cli_info` | Read CLI version and advertised commands. |
| `list_ports` | Read supported ports for a named protocol. |
| `show_locations` | Read locations where supported; desktop CLI may open the app's picker. |
| `connect` | Connect to regular/best, static city/IP, or last location, with optional protocol/port. |
| `disconnect` | Disconnect without issuing firewall or logout commands; report unexpected app-side firewall changes. |
| `set_firewall` | Enable or disable the kill switch; respect Always On policy and verify state. |
| `rotate_ip` | Rotate the current VPN IP and verify it changed with a validated tunnel. |
| `favorite_ip` / `unfavorite_ip` | Pin the current IP or unpin a supplied IPv4/IPv6 address. |
| `logout` | Sign out; preserve observed firewall state by default or explicitly request on/off. |
| `update_app` | Request installation of an available Windscribe update. |
| `list_amneziawg_presets` | Read presets when supported by the installed CLI. |
| `set_key_limit_behavior` | Linux headless: keep keys or delete oldest at the limit. |
| `reload_preferences` | Linux headless: reload the existing configuration file. |

The CLI may start Windscribe even during a read request. VPN changes affect network routing and can interrupt the chat. Enabling the firewall while disconnected can block connectivity; disabling it can allow traffic outside the VPN. Windscribe's own automatic-firewall policy can change firewall state during connection transitions.

## Execution and data handling

Inputs use strict schemas. The server launches a fixed executable with separate arguments and `shell: false`; it exposes no arbitrary shell, credential-entry, or arbitrary file-access tool. Updates use a dedicated tool with explicit descriptions of its effects. Raw diagnostic uploads are unavailable because vendor documentation says logs can contain internal VPN credentials. Commands run sequentially, with a per-user filesystem lock coordinating separate MCP processes. Other clients that call the CLI directly do not share this lock.

Ordinary CLI processes have a 10-second timeout; rotation allows 30 seconds, updates 120 seconds. All use a 64 KiB combined output limit. Cancellation stops only the CLI child started for that request, not the VPN app or service. Changes may continue after cancellation or timeout; inspect status before retrying. Verification polls for up to 20 seconds plus the final bounded CLI call. Configure a host request timeout of at least 60 seconds for normal operations and 180 seconds for updates. A competing server waits up to five seconds for the lock; a crashed server's lock becomes stale after two minutes.

There are no server log files or automatic telemetry. This plugin does not read or transmit raw Windscribe diagnostic logs. Stdout contains MCP protocol messages only; raw CLI output is not returned in errors. Selected operational fields are returned to the host and may appear in its conversation history. Basic status omits IP and data usage; their dedicated tools return these fields when requested. Favorite/static location lists may also include IP addresses. The CLI-reported IP can be cached by Windscribe and is not an independent leak check. Windscribe retains its own app logs and follows its privacy policy. The current parser recognizes documented English CLI output; unknown fields remain unknown and uncertain preflight state blocks connection/firewall changes.

Tool annotations describe effects; they do not enforce authorization. The host must enforce its tool permissions, and the assistant should perform changes only within the user's request. Responses and location names are data, never instructions. This plugin trusts the user's installed executable and host configuration.

Successful connect verification covers tunnel validation and a requested protocol/port. The observed city is returned separately: a requested alias, country code, or `best` cannot always be matched exactly to a reported city. Pending validation, network interference, protocol mismatch, and unverifiable output are not successful verification. Failed changes are not silently retried or rolled back. Tools without a portable read-back (favorites, update completion, Linux settings) return `verified: false` with an explanation even when the CLI completes successfully.

## License

This plugin is licensed under the [MIT License](LICENSE), copyright 2026 Windscribe. Bundled dependencies retain their own licenses; see `server/dist/THIRD-PARTY-NOTICES.txt` in the built package.

## Support and publication

[Support](https://github.com/yegors/windscribe-openai-plugin) | [Privacy policy](https://windscribe.com/privacy) | [Terms](https://windscribe.com/terms)

This package supports local desktop installation. Public-directory approval is separate; adding an MCP server does not grant publication access.

## CLI coverage and boundaries

The 17 tools cover supported VPN workflows from the installed Windows 2.25.2 CLI, plus capability-gated AmneziaWG and Linux headless commands documented upstream. Raw log transmission is excluded because logs can contain internal VPN credentials. Interactive login is intentionally performed in Windscribe or the user's own terminal; credentials never become MCP arguments. Disabling TLS validation, arbitrary file edits, and GUI-only preferences are not exposed. Billing, ROBERT, port forwarding and other web-only account controls remain in Windscribe's account dashboard.

`get_status.updateAvailableVersion` is the version reported by the app, or null if none was reported. It does not trigger installation or guarantee a fresh update check. `logout` preserves on/off state by explicitly passing the appropriate CLI argument, rather than using the CLI's firewall-off default. IP rotation/favorites require an eligible plan. Optional commands return an unsupported error if their help entry is absent; Linux-only commands also require Linux.
