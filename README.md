# Windscribe plugin

Windscribe 0.3.2 updates the plugin's privacy policy URL to `https://windscribe.com/privacy/chatgpt` for OpenAI review. Its bundled local MCP server exposes 17 tools spanning connection control, public/VPN IP, usage, IP rotation/favorites, logout and app updates, plus optional Linux headless features. The plugin remains named **Windscribe** and retains its supplied logo and publisher metadata.

## Runtime

Users need Node.js 22+ on PATH, Windscribe with its modern CLI, and a local MCP-capable desktop host. All JavaScript dependencies are bundled; users do not install npm packages. Windscribe credentials remain in Windscribe. The server communicates over stdio with no listening network port or hosted backend.

The host must launch the server on the intended computer in the signed-in user's session. Windows sandbox restrictions may block communication with the running Windscribe app. The server does not elevate itself. Host tool permissions govern approval of network and firewall changes.

See [packaged runtime documentation](plugins/windscribe/README.md) for timeouts, locking, data handling, configuration, and platform limitations.

## Project layout

- `server/src/`: MCP registration, CLI execution, validation, status parsing and verification.
- `server/test/`: automated process, service and MCP protocol tests.
- `server/scripts/`: dependency bundling and read-only stdio smoke test.
- `server/package-lock.json`: pinned dependency graph.
- `plugins/windscribe/`: package source, including portable and Codex-compatible manifests/configuration, logo, and skill. Building adds the installable runtime.
- `docs/`: internal testing, submission review, demo and website disclosure documents.
- `.agents/plugins/marketplace.json`: existing `windscribe-dev` development catalog.
- `dist/windscribe-0.3.2.zip`: release ZIP, with SHA256 sidecar.

Development dependencies stay outside the installable plugin folder. The release contains 12 explicitly selected files, including the project MIT license and bundled dependency license notices. No source test fixtures, account data, npm cache, or node_modules directory is shipped.

## Build and test

From this project directory, with Node.js 22+ and Python 3.9+ installed, use PowerShell:

```powershell
npm.cmd --prefix server ci --ignore-scripts --no-fund
npm.cmd --prefix server test
python build.py
```

On macOS, Linux, or WSL:

```sh
npm --prefix server ci --ignore-scripts --no-fund
npm --prefix server test
python3 build.py
```

The build uses the locked packages, regenerates the runtime from source, checks matching manifests and MCP configuration, and creates a ZIP with stable file metadata and a SHA256 checksum. JavaScript dependencies must be installed before building. The initial `npm ci` needs registry access; build and unit tests do not.

Generated bundles (`plugins/windscribe/server/dist/`), the packaged license copy (`plugins/windscribe/LICENSE`), release archives (`dist/`), and submission drafts (`submission/`) are ignored by Git. A fresh checkout must be built before local installation or smoke testing. Commit the source, root `LICENSE`, manifests, assets, development catalog, and `server/package-lock.json`; distribute the generated ZIP separately. Text files use LF line endings through `.gitattributes`.

For a live **read-only** MCP test, run this in the normal user session where Windscribe runs:

```powershell
npm.cmd --prefix server run smoke
```

This launches the actual bundle through an MCP SDK client, initializes it, discovers 17 tools, and calls `get_status`, `list_ports`, `get_cli_info`, `get_public_ip`, and `get_account_usage`. IP and usage values are omitted from the test log. To test an extracted release, pass its absolute `server/dist/server.cjs` path to `node server/scripts/smoke.mjs`.

## Local installation

After building, from this project directory:

```powershell
codex plugin marketplace add .
codex plugin add windscribe@windscribe-dev --json
```

Register the marketplace once per machine. The install command refreshes its cached plugin. Start a fresh local chat and select Windscribe; restart the host if necessary. Editing this source directory alone does not refresh an installed copy. Verify the selected plugin is 0.3.2 and its 17 MCP tools appear, rather than the older standalone `windscribe-vpn` skill.

The separately installed shared-workspace plugin has a different release lifecycle. Updating the local development plugin does not update that shared entry. Public-directory approval is also separate from this working local package.

See [live-testing guide](docs/LIVE-TESTING.md) for prompts and expected results, and [test results](docs/TEST-RESULTS.md) for what has actually been verified. Live connection/firewall changes and macOS/Linux runtime coverage remain to be tested.

## Submission preparation

- [Submission review and remaining requirements](docs/SUBMISSION-REVIEW.md)
- [Demo walkthrough](docs/DEMO-WALKTHROUGH.md)
- [Website disclosure draft](docs/WEBSITE-COPY-DRAFT.md)
- [Initial commit audit](docs/INITIAL-COMMIT-AUDIT.md)

Commands and package paths in these documents are relative to the repository root unless stated otherwise.

## License

This project is licensed under the [MIT License](LICENSE), copyright 2026 Windscribe. The build copies this license into every release package. Bundled dependencies retain their own licenses, included in `server/dist/THIRD-PARTY-NOTICES.txt` inside the package.

## References

- [OpenAI desktop-only plugins](https://developers.openai.com/plugins/deploy/desktop-only)
- [MCP TypeScript SDK server documentation](https://ts.sdk.modelcontextprotocol.io/server)
- [Windscribe's CLI reference](https://github.com/Windscribe/Desktop-App/blob/master/skills/windscribe-cli/SKILL.md)
