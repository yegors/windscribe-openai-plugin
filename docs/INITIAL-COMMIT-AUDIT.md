# Initial commit audit

Date: October 23, 2026. Environment: Linux/WSL, Node.js 22.18.0, npm 10.9.3, Python 3.12.3. Source version: 0.3.1.

The repository is ready for an initial source commit within the checks below. No commit, installation, publication, or real Windscribe command was performed during this audit. Public submission readiness is tracked separately in [SUBMISSION-REVIEW.md](SUBMISSION-REVIEW.md).

## Findings fixed

- **Generated files exposed to Git.** Expanded `.gitignore` to exclude installed dependencies, runtime bundles, release ZIPs/checksums, submission drafts, caches, local environment files, logs, and editor/OS files. The dependency lockfile, development catalog, manifests, skill, and logo remain commit candidates. Sanitized `.env.example`, `.env.sample`, and `.env.template` files are allowed.
- **Clean Linux build failed.** The `retry` dependency names its license file `License`. The builder's fixed filename list worked on the case-insensitive Windows filesystem but failed on a clean case-sensitive filesystem. It now discovers license filenames case-insensitively and reads their actual names.
- **Firewall control failed while signed out.** Windscribe omits connection state in signed-out status. Firewall changes now require a recognized firewall state without requiring a connection field. Connection attempts still require login, and Always On remains enforced. Added a regression test covering all three cases. The behavior is consistent with [Windscribe's CLI implementation](https://github.com/Windscribe/Desktop-App/blob/master/src/windscribe-cli/backendcommander.cpp).
- **Smoke test lost custom CLI configuration.** The MCP SDK inherits a restricted environment by default. The smoke client now forwards `WINDSCRIBE_CLI` explicitly, allowing custom installations and isolated executable fixtures.
- **Build metadata varied by platform.** Added `.gitattributes`, normalized source text to LF, and pinned ZIP creator metadata to Unix. Actual native Windows/macOS rebuild comparisons remain untested.
- **Machine-specific setup and account metadata.** Removed an organization ID from the submission notes, replaced the already-registered-marketplace assumption, and documented build prerequisites for fresh checkouts and Unix shells.

## Checks completed

| Check | Result |
| --- | --- |
| Locked installation | `npm --prefix server ci --ignore-scripts --no-fund` succeeds in the workspace and an isolated source checkout. |
| Dependency audit | npm reports zero known vulnerabilities, including development dependencies. Locked tarballs use the npm registry and include integrity hashes. |
| Automated tests | All 36 tests pass, including the new signed-out firewall regression; also passed in the isolated checkout. |
| Portable manifests | `plugin.json` and `mcp.json` validate against their declared Agent Plugins 1.0.0 schemas. The build separately validates listing URL formats and portable/compatibility metadata consistency. |
| Packaging | `python3 build.py` passes metadata, image, path, launch configuration, dependency notice, inventory, and ZIP integrity checks. Both generated archives contain the same 11 files; 12 bundled dependencies have license notices. |
| Clean build | Exported only commit-eligible files through a temporary Git index to a case-sensitive filesystem, installed from the lockfile, tested, and built successfully. No pre-existing bundle or node_modules directory was copied. |
| Repeatability | Workspace build, isolated source build, and repeated isolated build produce byte-identical ZIPs with the same toolchain. |
| Extracted runtime | An SDK client launched the extracted bundle outside the repository, without adjacent node_modules, discovered 17 tools, and completed status, ports, capabilities, IP, and usage calls against a synthetic CLI. A missing configured executable produces the expected safe error. |
| Repository hygiene | Credential-pattern scan, JSON parsing, local Markdown links, conflict markers, line endings, file sizes, Git whitespace checks, and prospective file modes checked. No suspected credentials found; the scan is not a guarantee against all secret formats. |
| Commit inventory | Generated output and local dependencies are excluded; source, assets, manifests, docs, and the lockfile are included. The actual Git index remains empty. |

Initial-audit release and review-draft SHA256: `54fded5a630b634380ab1a0bc4692ce223770c3fc7d8963d60118774fe58aa70`. Subsequent metadata changes and their rebuilt archive checksums are recorded in [TEST-RESULTS.md](TEST-RESULTS.md).

## Remaining limits

- This audit used synthetic CLI responses. Live VPN/firewall/account/update changes, fresh desktop-chat behavior, and native Windows/macOS/Linux Windscribe integration still need the designated-machine checks in [LIVE-TESTING.md](LIVE-TESTING.md). Earlier Windows smoke results in [TEST-RESULTS.md](TEST-RESULTS.md) describe an earlier artifact.
- **Resolved before the initial commit:** the owner selected MIT. The root `LICENSE`, both plugin manifests, server package, and lockfile declare it; the build copies the license into every release alongside the existing third-party notices. Current packages contain 12 files. See [TEST-RESULTS.md](TEST-RESULTS.md) for the final licensed build checks.
- Demo/reviewer access, publisher-page coverage, and local-MCP submission eligibility remain open in the submission review. Package structure was checked against [OpenAI's packaging documentation](https://developers.openai.com/plugins/build/plugins); a valid package does not establish [desktop-only submission eligibility](https://developers.openai.com/plugins/deploy/desktop-only).

To repeat the normal source checks, run the README's install, test, and build commands. Run the live smoke command only in the intended Windscribe user session; it can start the app and reads operational data.
