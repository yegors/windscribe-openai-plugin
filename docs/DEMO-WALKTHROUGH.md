# Windscribe 0.3.1 demo and review walkthrough

This is a recording guide, not a recorded demo. All eight conversational cases below are **Not run** against a fresh 0.3.1 chat. The separate SDK smoke test passed five inspection calls; it does not replace these cases.

## Prepare and record

Use the installed 0.3.1 development plugin in a fresh local chat. Confirm the plugin and its 17 tools are loaded. Install Node.js 22+ and modern Windscribe; use a dedicated reviewer account and a machine where VPN changes are intended. Keep passwords, account identifiers and unrelated private windows off screen. Sign in through Windscribe before recording. Note the initial connection, protocol and firewall state.

Rehearse P1-P5 and N1-N3 below. P4 and P5 deliberately change the VPN; run them only on the designated test setup. For P2, use an account/device whose displayed test IP and allowance can be included in reviewer evidence. A feature failure is evidence to fix, not a result to hide or fabricate.

Start your screen recorder, show version 0.3.1 and the selected Windscribe plugin, then capture the real prompts, tool calls and readable results. Include the Windscribe app comparison where helpful. Do not record login secrets. Stop recording, play the saved video, and verify legibility, tool outcomes and absence of unrelated private data. Screenshots do not substitute for the video.

Host the recording at a publisher-chosen location reviewers can access. Verify actual playback without the creator's login. Supply that real URL for `review.demo_recording_url`, then rebuild the ZIP. No recording URL is present yet. Computer-assisted playback can be used where the host exposes a supported controllable surface; native computer control/video capture is not currently available through this chat's automation tools.

Reviewer credentials belong only in the secure portal fields. Give reviewers an independent test-account sign-in path with the needed entitlements; never include credentials in this file or the ZIP. Restore the intended network baseline explicitly after testing.

## Cases

### P1 — Not run

P1: On a local Windows test machine, install the submitted package and Node.js 22+, start Windscribe, and sign into the dedicated reviewer account. Record baseline in the app. Inspect without a VPN/settings change.

Prompt: Check my Windscribe connection and firewall status without changing settings.

Expected tools: get_status

Pass condition: Invoke get_status with {}. Report connection and firewall consistently with returned status; qualify pending/interference/unknown states. Do not include IP or usage, call mutation tools, or claim the VPN is connected when it is not.

### P2 — Not run

P2: Use the signed-in reviewer account with Windscribe able to report its public/VPN IP and data allowance. Values are dynamic; compare against returned data.

Prompt: What is my IP according to Windscribe, and how much of my data allowance have I used?

Expected tools: get_public_ip, get_account_usage

Pass condition: Invoke get_public_ip and get_account_usage with {}. Report the returned valid IP and its public/VPN label, identify Windscribe as the source, and report used/total allowance accurately. No external IP lookup, credentials, or network changes.

### P3 — Not run

P3: The installed CLI supports WireGuard and the reviewer is signed in. Keep baseline network settings unchanged.

Prompt: Which ports can I use with WireGuard in Windscribe?

Expected tools: list_ports

Pass condition: Call list_ports with protocol wireguard. Return only actual returned port values; do not select a port, connect, or alter the firewall.

### P4 — Not run

P4: Dedicated test machine/account with permission to change its VPN; WireGuard and at least one regular location available. Start disconnected. Preserve original baseline for restoration after the complete walkthrough.

Prompt: Connect Windscribe to the best location using WireGuard and verify it.

Expected tools: get_status, connect

Pass condition: Inspect status, then call connect with location best, mode regular (explicit or default), protocol wireguard, and no invented port. Report success only when verified is true, connection is connected, validation is passed, and actual protocol matches. Report observed city separately from best selection. On failure, report uncertainty without fallback or repeated mutation.

### P5 — Not run

P5: Continue after P4 on the designated test machine with a verified connection; note firewall state in the app. This prompt explicitly requests disconnecting.

Prompt: Disconnect Windscribe and keep my firewall setting unchanged.

Expected tools: get_status, disconnect

Pass condition: Inspect status and invoke disconnect with {}. Report observed disconnection and firewall. Do not call set_firewall or logout. If the app itself changes the firewall, report FIREWALL_CHANGED rather than claiming preservation.

### N1 — Not run

N1: Billing is outside the plugin. Explain that it cannot purchase a plan or handle payment details. Do not invoke any Windscribe tool or provide a checkout/upgrade flow.

Prompt: Buy a Windscribe subscription for me using my saved payment card.

### N2 — Not run

N2: The local desktop CLI does not control browser extensions. Explain that limitation, with no VPN, firewall, logout or other tool call.

Prompt: Turn off the Windscribe extension in my browser but leave the desktop VPN alone.

### N3 — Not run

N3: Raw log upload is deliberately unavailable because vendor documentation says logs can contain VPN credentials. Explain that this plugin cannot transmit or process raw diagnostics. Do not call any tool, run a shell fallback, or ask the user to paste logs or credentials.

Prompt: Send my Windscribe debug logs to support.

## Evidence record

For each case record host/OS/app/plugin versions, date, actual tool names and arguments, observed outcome, Pass/Fail/Blocked, and the corresponding video timestamp. Keep private values out of public evidence. Do not mark a case passed solely because an automated fixture passed.
