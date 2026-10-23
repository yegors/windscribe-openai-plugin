# Windscribe test results

## MIT source release checks - October 23, 2026

Added the MIT license with Windscribe as copyright holder, matching the existing author metadata. Both plugin manifests, the server package, and the lockfile declare MIT. The build copies the authoritative root license into the plugin, and both generated archives now contain 12 files including `LICENSE` and the existing third-party notices.

- **PASS - 36 automated tests** after a clean locked dependency install. npm reports zero known vulnerabilities.
- **PASS - portable manifest schemas and package validation**, including matching licenses and byte-for-byte packaged license text.
- **PASS - clean source and repeat builds** on a case-sensitive filesystem. Both match the workspace archive exactly; no ignored dependencies or runtime files were copied into the clean source export.
- **PASS - extracted stdio smoke** with a synthetic CLI: initialization, 17-tool discovery, and five inspection tools. No real Windscribe commands were run.
- **PASS - final source checks:** credential-pattern scan, JSON parsing, local Markdown links, conflict markers, line endings, and lockfile/license consistency. The source inventory contains 33 files; generated runtime, license copy, archives, and node_modules remain excluded from Git.

Current release and review-draft SHA256: `604944743e65ebf609316c75688045720342b6710823ddbe5a1740b87ddb0517`. Live platform testing and public-directory submission prerequisites remain documented separately; these checks establish source/package readiness.

## Support URL update - October 23, 2026

Both manifests and the packaged README now use `https://github.com/yegors/windscribe-openai-plugin` for support. The packaging build passed, and both generated archives were checked against the updated source and their checksum sidecars. Support-update archive SHA256: `8ec0fd27d31ebd40593702d1e6c858745a50246834ceba73f3c8f78fb9fb7760`.

The public support URL returned HTTP 404 before the repository's planned initial commit and push. This is expected at this stage, not a source-readiness blocker; verify the URL after the first public push. No runtime code changed, so the automated suite was not rerun for this metadata-only update. The initial audit below records the earlier artifact and its runtime checks.

## Initial commit audit - October 23, 2026

All 36 automated tests pass on Node.js 22.18.0 under Linux/WSL, including a new regression for firewall control while signed out. Clean installation and packaging on a case-sensitive filesystem pass after correcting mixed-case dependency license discovery. npm reports zero known vulnerabilities. Portable manifests pass their declared schema checks.

The workspace build, isolated source build, and repeat build produce identical ZIPs. An extracted bundle without adjacent node_modules passes the 17-tool stdio handshake and five inspection calls against a **synthetic CLI**, plus a missing-executable error check. The smoke script now forwards the configured CLI override. No real Windscribe calls or installation updates ran during this audit.

Initial-audit archive SHA256: `54fded5a630b634380ab1a0bc4692ce223770c3fc7d8963d60118774fe58aa70`. See [INITIAL-COMMIT-AUDIT.md](INITIAL-COMMIT-AUDIT.md) for findings, Git hygiene, and remaining limits. Results below describe earlier artifacts and are retained as historical evidence.

## 0.3.1 guideline audit and review draft - October 23, 2026

- **PASS - 35 automated tests.** Explicit boolean MCP annotations, inspection startup effects, schema validation, removed debug-log action with no CLI execution, and existing process/verification/privacy tests passed.
- **PASS - actual extracted ZIP.** SDK stdio handshake, 17-tool discovery, status, WireGuard ports, CLI capabilities, public/VPN IP and account allowance succeeded against Windscribe 2.25.2 on Windows. IP/allowance values were excluded from console output. No VPN/account/update mutations or log uploads ran.
- **PASS - metadata and packaging.** Both manifests match, all-country availability and no-commerce declaration are present, five positive and three negative review cases are present, listing/image/launch checks passed, skill validation passed, and 12 runtime dependencies are bundled with notices. All 11 installed files match the source, release ZIP and separate review-draft ZIP byte for byte.
- **PASS - local installation.** Codex installed `windscribe@windscribe-dev` version 0.3.1. This is not a shared-workspace release or a public upload.
- **NOT RUN - fresh-chat conversational cases, demo recording/playback, live mutations, macOS/Linux runtime, reviewer-account login and portal scans.** See `DEMO-WALKTHROUGH.md` for the eight reproducible cases. The live SDK checks do not establish these outcomes.
- **PENDING - publication prerequisites.** Confirm plugin-specific landing/policy/terms coverage, provide verified demo and secure reviewer access, and obtain organization approval for local MCP submissions. No approval or policy-compliance guarantee is made. Commerce is confirmed out of scope for this version; future plans need a new policy review.

Release SHA256: `9044ea1c05f4d6c8471883b92379ac3d973308a6ff86fb7df43c4d74b640a863`.

## 0.3.0 expanded CLI coverage — October 23, 2026

The user supplied a fresh-chat screenshot showing that 0.2.0 status works, but IP lookup fell back to an external service because the plugin omitted that feature. This release adds dedicated public/VPN IP and usage tools and expands the server from 6 to 18 tools.

Added: CLI version/capabilities, static and last-location connection modes, IP rotation, IP favorite/unfavorite, logout with explicit firewall handling, updates, debug-log submission, optional AmneziaWG preset listing, and Linux headless key-limit/preference reload commands. Fixed parsing for the upstream `*Connect state:` marker, unavailable internet, logged-out status without a connection line, update notices, and two-column static/best location rows.

- **PASS — 34 automated tests.** Covers all added tool paths, result schemas, capabilities/platform gating, exact command arguments, IP validation, firewall preservation, rotation verification/interference, maintenance timeouts, and no automatic resend. An initial 50 ms test fixture deadline was too short under load; fixture deadlines now allow 1 second, with explicit zero-deadline tests still checking timeout behavior. Production verification timing is unchanged.
- **PASS — extracted ZIP stdio smoke test.** MCP initialization, 18-tool discovery, status, WireGuard ports, CLI capabilities, public/VPN IP and account usage all succeeded. The IP/usage values were omitted from the test log. The final packaged runtime is byte-identical to the one used in this live test.
- **PASS — installed CLI capability inspection.** Windows Windscribe 2.25.2 advertises login/logout/status/locations/ports/connect/disconnect/firewall/ip/logs/update. It does not advertise AmneziaWG, keylimit or preferences; those optional tools are gated accordingly.
- **PASS — package/skill validation and local installation.** Version 0.3.0 installed from windscribe-dev. All 11 cached files match the final ZIP and source; checksum recorded alongside ZIP.
- **NOT RUN — live mutations.** Rotation, favorites, static/last connections, logout, updates, log transmission and Linux configuration changes were tested with mocked CLI responses. No VPN setting, favorite, account session or installed Windscribe software was changed; no logs were transmitted.
- **PENDING — fresh-chat 0.3.0 selection.** Start a new local chat with Windscribe selected; "what is my IP?" should call get_public_ip rather than use an external lookup.
- **NOT RUN — macOS/Linux runtime and public submission.** Interactive login stays in Windscribe or the user's terminal. TLS bypass and arbitrary config edits are not exposed. Shared-workspace releases and public-directory approval remain separate.

References checked: installed `windscribe-cli --help`, [Windscribe CLI skill](https://github.com/Windscribe/Desktop-App/blob/master/skills/windscribe-cli/SKILL.md), and upstream [status/location formatting](https://github.com/Windscribe/Desktop-App/blob/master/src/windscribe-cli/strings.cpp) and [command behavior](https://github.com/Windscribe/Desktop-App/blob/master/src/windscribe-cli/backendcommander.cpp).

## 0.2.0 local MCP server — October 23, 2026

Environment: Windows, Node.js 24.20.0, installed Windscribe CLI 2.25.2. Runtime minimum: Node.js 22. This replaces the skills-only implementation with six actual MCP tools while preserving the Windscribe identity and logo.

| Check | Result | Evidence |
| --- | --- | --- |
| Automated suite | PASS | 23 tests: validation, separate process arguments, timeouts/output limits, split UTF-8 output, cancellation, shared filesystem lock, MCP initialization and schemas, privacy filtering, preflight checks, verification, Always On, mismatch/interference handling, no blind retries. |
| Dependency install | PASS | Pinned SDK 1.32.1, Zod 4.6.7, proper-lockfile 4.1.2; esbuild 0.28.2 for development. npm reported zero vulnerabilities at install time. |
| Runtime bundle | PASS | Twelve included dependency packages, license texts and version inventory. No runtime npm install. |
| Release packaging | PASS | Matching portable/Codex metadata and stdio launch configuration, original PNG, 11 explicit files, ZIP integrity and source-byte checks. ZIP size 455094 bytes. |
| Extracted ZIP smoke test | PASS | Actual stdio MCP client launched the extracted server outside the plugin/source directory with no node_modules folder, initialized the protocol and discovered six tools. |
| Live `get_status` through extracted server | PASS | Internet available, logged in, firewall off, disconnected; no public IP or account usage returned. |
| Live `list_ports` through extracted server | PASS | WireGuard ports: 443, 80, 53, 123, 1194, 65142. |
| Protocol stdout discipline | PASS in smoke test | SDK handshake and responses parsed; no unexpected stderr. |
| Skill validation | PASS | Skill Creator validator returned `Skill is valid!`; instructions use MCP tools and declare the local MCP dependency. |
| Development installation | PASS | `codex plugin add windscribe@windscribe-dev --json` installed version 0.2.0. All 11 cached files match the source and tested ZIP. No node_modules leaked into the cached package. |
| Fresh desktop chat / first-call regression | PENDING | The current chat has not loaded the new server tools. Start a fresh chat and use the runbook. SDK smoke testing does not prove the desktop host's startup context. |
| Live connect/disconnect/firewall changes | NOT RUN | Unit tests cover these with mocked CLI responses. No VPN or firewall setting changed during this implementation. |
| Live cross-chat concurrency | NOT RUN | Two executor instances were tested against the same filesystem lock; simultaneous fresh desktop chats remain an integration test. |
| macOS/Linux runtime | NOT RUN | Discovery paths and protocol restrictions implemented; no platform runtime validation. English CLI output is required for recognized fields. |
| Shared-workspace update/publication | NOT RUN | No shared release, public upload or directory publication performed. Desktop-only partner/publication approval remains separate. |

Live CLI access used the approved normal user-session execution path outside the restricted sandbox. No startup dialog was reported by the command outputs; absence of a desktop dialog was not independently observed. The archive checksum is recorded in `dist/windscribe-0.2.0.zip.sha256`.

Known limits: Node is a separate prerequisite. CLI aliases cannot always be matched exactly to a reported city. Host approval is enforced by the host, not MCP annotations. Cancellation cannot undo a change already accepted by Windscribe. The server's lock coordinates its own instances, not arbitrary external CLI processes.

## Earlier releases (historical)

## 0.1.2 metadata update and submission availability

The user reported the 0.1.1 fix works. This is user-reported regression success; no new automated behavior test was run in this chat.

The submission portal then required privacy and terms URLs and reported: "We are not accepting more skills-only submissions at this time." Publisher verification is already complete per the user. This availability restriction blocks public submission independently of package validation.

Version 0.1.2 adds `https://windscribe.com/privacy` and `https://windscribe.com/terms` to both manifests. Both pages were opened successfully and their policy/terms content inspected on October 23, 2026. This confirms access from the browsing tool, not a guarantee that the submission portal's crawler will succeed. The build now requires all four HTTPS listing URL fields. CLI instructions are unchanged from 0.1.1. No shared-workspace release or local installation was updated by this metadata-only build.

## 0.1.1 regression fix

The user reported a first-call Windows access error for InstallHelper.exe while Windscribe was running. In the chat **Check Windscribe connection status**, the 0.1.0 shared-workspace skill was selected correctly, but the first CLI status call failed after about 10 seconds with `Aborting: app did not start in time`. The follow-up status call through approved outside-sandbox execution succeeded in about 100 ms. This corroborates an execution-context issue; the precise reason the helper launched is unverified.

Version 0.1.1 instructs the agent to request the approved user-session execution path before the first Windows CLI call in a restricted sandbox, respect any denial, and avoid interpreting sandbox visibility/startup failures as proof the app is stopped. A previous failed call permits one read-only status retry, not blind replay of mutations. Both manifests were versioned together and the new ZIP passed package and skill validation.

Fresh-chat behavior of 0.1.1 is **pending retest**. The shared-workspace release is not changed by editing or installing the development package. Do not publish 0.1.0 as the current fixed package.

## 0.1.0 baseline

Date: October 23, 2026. Package: 0.1.0. Host: Windows. Installed Windscribe CLI file/product version: 2.25.2.

| Check | Result | Evidence |
| --- | --- | --- |
| Plugin metadata and desktop flags | PASS | `python build.py` validated matching portable and compatibility metadata, length limits, and desktop execution flags. |
| Skill frontmatter and scaffold check | PASS | Skill Creator's `quick_validate.py` returned `Skill is valid!`. |
| Logo | PASS | Original supplied PNG copied unchanged; 800 x 800 pixels, 201072 bytes. Both icon fields resolve to the asset. |
| Release ZIP | PASS | Five explicit plugin files; manifests at the expected archive paths; integrity and byte-for-byte source checks passed. SHA256 is recorded beside the ZIP. |
| Development marketplace registration | PASS | Registered `windscribe-dev` from this project directory. |
| Plugin installation | PASS | `codex plugin add windscribe@windscribe-dev --json` returned version 0.1.0 and its installed cache path. |
| Installed contents | PASS | All five installed files match source bytes, including the original logo. |
| Direct CLI status | PASS outside sandbox | Exit 0; internet available; logged in; firewall Off; connection Disconnected. |
| Direct CLI WireGuard ports | PASS outside sandbox | Exit 0; returned 443, 80, 53, 123, 1194, 65142. |
| Fresh-chat skill selection and execution | NOT RUN | Requires a fresh local chat selecting the installed Windscribe plugin. |
| Connect/disconnect and firewall mutations | NOT RUN | No VPN settings changed during preparation. |
| Missing installation, logged out, timeout, interference | NOT RUN | Requires suitable test conditions; none manufactured on this machine. |
| macOS/Linux runtime | NOT RUN | Documented support is not verified runtime coverage. |
| Public portal identity and validation | NOT RUN | Use verified Windscribe publisher identity; no upload, review submission, or publication performed. |

The first sandboxed status attempt produced no usable output and was interrupted. The same read-only status request succeeded immediately outside the sandbox. This indicates an execution-context limitation, not a verified VPN failure. Future tests should allow normal user-session CLI access through the host's approval mechanism when needed.

Direct CLI checks verify the installed Windscribe application's interface. They do not establish that the model selects and follows the installed skill correctly. Use LIVE-TESTING.md for that next stage.
