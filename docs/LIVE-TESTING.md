# Windscribe 0.3.1 live test runbook

## Install and start

Install Node.js 22+ and Windscribe, sign in through Windscribe, and keep its app open for the first-call regression test. Follow the root README's build steps first: generated runtime files are not committed. Register this directory once with `codex plugin marketplace add .`, then run `codex plugin add windscribe@windscribe-dev --json`. Start a fresh local chat with **Windscribe** selected. Restart the host if it has not reloaded the plugin or Node PATH.

Confirm the installed version is 0.3.1 and the local `windscribe` MCP server starts. Expect 17 tools; see the packaged README for their names (host prefixes may differ). The skill should use these tools, not execute shell commands. A tool startup failure needs host diagnostics; do not fall back silently to the old CLI skill.

The server needs the signed-in user's normal session. If the host sandbox cannot reach Windscribe, use its supported and approved local MCP execution mechanism. Do not change file permissions or directly run InstallHelper. Confirm the first status request works without the previously observed startup timeout/helper dialog. A direct SDK smoke test does not establish fresh-chat host behavior.

## Read-only checks

1. "Use Windscribe to check my current connection, protocol, and firewall state. Do not change any settings." Expect `get_status`, compare the result with the app, and preserve pending/unknown validation states. No public IP or account usage should be returned.
2. "Use Windscribe to show the available ports for WireGuard." Expect `list_ports` and no VPN change.
3. "Show my Windscribe locations." Expect `show_locations`; a desktop picker may open. Empty text is not an empty list of locations.
4. "Can this plugin change my subscription or control the browser extension?" Expect a scope explanation without account actions.

For isolated transport testing, run `npm.cmd --prefix server run smoke` in the approved user session. This checks status, ports, CLI capabilities, IP and usage through an actual stdio MCP client, without changing settings.

## Expanded coverage

- "What is my IP using Windscribe?" must call `get_public_ip`, identify the Windscribe source and make no external IP lookup.
- "How much Windscribe data have I used?" must call `get_account_usage`.
- "Which CLI version and commands are available?" must call `get_cli_info`.
- A general troubleshooting or update-availability question must not send logs or install updates.
- Test rotation, favorites, static/last connections, logout and app updates only when those actions are intended. Rotation must report a changed VPN IP and validated connection; favorite/update results must distinguish command completion from independent verification.
- Optional AmneziaWG/Linux tools must report unsupported on builds without the corresponding command. Do not change the real user's account or installation to manufacture these conditions.

## Connection and firewall checks

Run these when the change is intended on this machine. Record original connection, location, protocol, port and firewall state first. If a VPN change interrupts the chat, inspect status before repeating it. Restore the desired baseline explicitly after testing.

| Prompt or scenario | Expected result |
| --- | --- |
| Connect Windscribe to Toronto and verify it. | One connect request; bounded sequential verification; observed city and validation reported. |
| Connect to best using WireGuard on port 443. | Validate available ports, connect once, verify tunnel, protocol and port; report actual location. |
| Disconnect Windscribe and keep the firewall setting unchanged. | No logout or firewall command. Report any firewall change made by the app's own policy. |
| Turn the Windscribe firewall on/off. | Only the requested change, followed by verification. Test on a designated machine because this can block or expose traffic. |
| Disable firewall while Always On is configured. | Refusal; no policy bypass. |
| Invalid protocol, port, or location with shell syntax. | Validation failure with no corresponding mutation. |
| Cancel a slow connection request, then ask for status. | Bounded cancellation; no automatic reconnect or rollback. Report actual state afterward. |
| Two chats request operations at once. | Serialize through the lock or report busy; no overlapping server-driven CLI commands. |

Missing installation, logged-out state, network interference and slow app behavior should be tested on suitable fixtures or a designated machine. Do not uninstall, log out, or break the working network solely to create these conditions. Automated coverage uses mocked CLI responses for mutation cases.

## Evidence and publication

Record host/app versions, selected plugin version, MCP tools called, expected/actual outcomes and pass/fail. Keep secrets and account identifiers out of evidence. Test macOS and Linux before claiming their runtime behavior is verified; the parser currently recognizes documented English CLI output.

Use `dist/windscribe-0.3.1.zip` for the MCP-enabled package. This does not update the separately installed shared-workspace plugin or confer public-directory access. Confirm the applicable desktop-only partner approval with OpenAI, and complete the portal's review materials before submission. No public upload or publication is performed by this build.
