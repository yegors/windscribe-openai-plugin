# Windscribe 0.3.1 submission review

Reviewed October 23, 2026. Official publisher: Windscribe. Use the publisher's organization ID from the submission portal; keep account identifiers out of repository documentation. The user reports business verification is complete. Availability: all directory-supported countries (`countries: []`). The user confirmed commerce is for a future release only; this release declares `commerce: false`.

**Status: locally tested review draft, not yet ready for public submission.** No upload, submission, publication or policy attestation was performed. This audit is not an approval guarantee.

## Code and package changes

- All 17 tools declare explicit boolean effect annotations. CLI operations that can start the desktop app or open a picker are not marked read-only. State-changing commands are marked destructive because they can replace settings, routing, account state or software. Targets are the local installation, existing account and fixed Windscribe server catalog, rather than arbitrary external recipients.
- Raw diagnostic upload was removed. Windscribe documents internal VPN credentials in logs; the wrapper cannot verify redaction. The SDK tests reject the removed action without invoking the CLI. [Vendor disclosure](https://windscribe.com/knowledge-base/articles/does-the-debug-log-contain-personal-identifiable-info)
- VPN destination input is identified as server-catalog selection, not physical user location. Status omits IP/usage; separate requested tools expose these fields. No passwords, payment data or account tokens are tool inputs.
- Existing safeguards retained: fixed executable, strict schemas, separate process arguments, no shell executor, bounded output/timeouts, cancellation, per-user command serialization, verification of network changes and no blind mutation retry.
- Metadata includes five positive and three negative review cases, release notes, all-country targeting, the confirmed commerce declaration, official branding and configured listing URLs. The build validates matching manifests, listing limits, public package restrictions, review fields, PNG dimensions, runtime dependencies and exact ZIP bytes. Public URL reachability requires a separate check.
- A separate public review draft is in `submission/`; source and normal release remain in place. Its package contains 12 explicit files, including the project MIT license, and no node_modules, credentials, app bindings or lifecycle hooks.

## Evidence and limits

Earlier review evidence: 35 automated tests passed. An SDK client launched the server extracted from the ZIP, discovered 17 tools and successfully called status, WireGuard ports, CLI info, public/VPN IP and account usage against Windows Windscribe 2.25.2. IP and usage values were omitted from logs. No VPN setting, account session or app installation was changed; no diagnostics were sent. The subsequent [initial commit audit](INITIAL-COMMIT-AUDIT.md) fixes signed-out firewall handling and build/smoke portability; it records 36 passing tests and the current rebuilt archive. Its extracted-package smoke uses a synthetic CLI, so the earlier Windows result does not establish live validation of the rebuilt artifact.

Fresh-chat 0.3.1 behavior, live mutations, macOS/Linux runtime, actual video playback, reviewer login and portal scans are not verified. Automated CLI fixtures do not establish conversational tool selection or all-platform behavior. See `TEST-RESULTS.md` and `DEMO-WALKTHROUGH.md`.

## Remaining work, in order

1. **Publisher pages.** Support now points to `https://github.com/yegors/windscribe-openai-plugin`. Its public HTTP 404 during the October 23 metadata update is expected before the planned initial commit and push, not a source-readiness blocker. Verify the support page after the first public push and before submission. Earlier review inspected `https://windscribe.com`, `/help`, `/privacy` and `/terms`. The main site did not establish a plugin-specific landing page, and the privacy page did not establish coverage of local MCP outputs sent to the chat host. Publish or identify plugin-specific coverage and confirm the terms apply. `WEBSITE-COPY-DRAFT.md` provides implementation facts and owner questions; it is not a published policy or legal attestation. Retest all final URLs and the portal crawler after changes.
2. **Demo and reviewer access.** Rehearse the exact 0.3.1 cases on a dedicated test machine/account, record the real interactions, and host a reviewer-accessible video. Verify playback before setting `review.demo_recording_url` and rebuilding. Put reviewer credentials only in secure portal fields; verify the reviewer can sign in independently. The recording and secure credentials have not been supplied.
3. **Local MCP eligibility.** Obtain confirmation that this organization is allowlisted from the OpenAI representative. Business verification and a bundled MCP server do not establish this approval. [Desktop-only submission instructions](https://developers.openai.com/plugins/deploy/desktop-only)
4. **Portal review.** After the preparation and eligibility steps, use the documented local-MCP upload route, inspect imported metadata, run required scans/cases, and have the authorized publisher complete attestations. Submission and publication remain separate actions. [Submission process](https://developers.openai.com/plugins/deploy/submission)

Future subscription purchases, upgrade promotion or checkout links need a fresh policy review: current rules do not permit digital-service commerce. This release has no such flow. [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
