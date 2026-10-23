"""Validate and package Windscribe. Requires Python 3.9+; no VPN commands run."""
import json
import re
import struct
import subprocess
import zipfile
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlsplit


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    root = Path(__file__).resolve().parent
    plugin = root / 'plugins' / 'windscribe'
    portable = json.loads((plugin / 'plugin.json').read_text(encoding='utf-8'))
    compat = json.loads((plugin / '.codex-plugin/plugin.json').read_text(encoding='utf-8'))
    extension = portable['extensions']['com.openai']
    interface = extension['interface']
    require(not (plugin / '.app.json').exists(), 'Public upload cannot contain .app.json')
    for manifest in (portable, compat):
        require(manifest.get('apps') is None and manifest.get('extensions', {}).get('com.openai', {}).get('apps') is None,
                'Public upload cannot contain app bindings')
        require(manifest.get('hooks') is None, 'Public upload cannot contain lifecycle hooks')
    require(not (plugin / 'hooks').exists(), 'Public upload cannot contain lifecycle hooks')
    for key in ('name', 'version', 'license', 'description', 'author', 'homepage'):
        require(portable[key] == compat[key], f'Manifests differ: {key}')
    require(portable['name'] == 'windscribe', 'Unexpected plugin identity')
    require(re.fullmatch(r'\d+\.\d+\.\d+', portable['version']), 'Invalid version')
    require(extension['requires_local_executor'] is True, 'Portable desktop flag missing')
    require(compat['requires_local_executor'] is True, 'Compatibility desktop flag missing')
    require(interface == compat['interface'], 'Presentation metadata differs')
    for key, maximum in [('displayName', 30), ('shortDescription', 30),
                         ('longDescription', 4000), ('developerName', 80)]:
        require(0 < len(interface[key]) <= maximum, f'Invalid {key}')
    require(interface['developerName'] == 'Windscribe', 'Publisher mismatch')
    for key in ('websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL'):
        value = interface.get(key, '')
        url = urlsplit(value)
        require(isinstance(value, str) and len(value) <= 1024 and url.scheme == 'https'
                and bool(url.hostname) and not url.username and not url.password,
                f'Missing HTTPS listing URL: {key}')
    require(interface['category'] == 'Security', 'Unexpected listing category')
    require(len(interface['defaultPrompt']) <= 3, 'Too many starter prompts')
    prompts = interface['defaultPrompt']
    require(all(0 < len(p.strip()) <= 128 and '\n' not in p and '\r' not in p and '@' not in p for p in prompts), 'Invalid prompt')
    require(len(set(' '.join(p.split()) for p in prompts)) == len(prompts), 'Duplicate prompts')
    for key in ('review', 'publication'):
        require(extension[key] == compat['extensions']['com.openai'][key], f'Metadata differs: {key}')
    review = extension['review']
    require(type(review['commerce']) is bool and bool(review['commerce_description'].strip()), 'Commerce declaration missing')
    require(len(review['prompts']) <= 20 and all(isinstance(p, str) and 0 < len(p.strip()) <= 4000 for p in review['prompts']), 'Invalid review prompts')
    for kind, minimum in [('positive', 5), ('negative', 3)]:
        cases = review['test_cases'][kind]
        require(len(cases) >= minimum, f'Insufficient {kind} cases')
        fields = ('description', 'prompt', 'tools_triggered', 'expected_behavior') if kind == 'positive' else ('description', 'prompt')
        for case in cases:
            require(all(isinstance(case.get(k), str) and case[k].strip() for k in fields), f'Invalid {kind} case')
    for key in ('logo', 'composerIcon'):
        relative = interface[key]
        require(relative.startswith('./'), f'{key} needs a relative path')
        asset = (plugin / relative).resolve()
        require(asset.is_relative_to(plugin.resolve()), 'Asset escapes package')
        image = asset.read_bytes()
        require(image[:8] == b'\x89PNG\r\n\x1a\n', 'Expected PNG logo')
        width, height = struct.unpack('>II', image[16:24])
        require((256 if key == 'logo' else 48) <= width == height <= 4096, 'Invalid icon dimensions')
        require(len(image) <= 5 * 1024 * 1024, 'Icon exceeds 5 MiB')
    skill = plugin / 'skills/windscribe/SKILL.md'
    require(skill.is_file(), 'Missing skill')
    mcp = json.loads((plugin / 'mcp.json').read_text(encoding='utf-8'))
    legacy_mcp = json.loads((plugin / '.mcp.json').read_text(encoding='utf-8'))
    require(mcp['$schema'] == 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', 'MCP schema missing')
    require(set(mcp['mcpServers']) == {'windscribe'}, 'Unexpected MCP server')
    launch = mcp['mcpServers']['windscribe']
    require(launch == {'type': 'stdio', 'command': 'node',
                      'args': ['${PLUGIN_ROOT}/server/dist/server.cjs'], 'cwd': '${PLUGIN_ROOT}'},
            'Unexpected MCP launch configuration')
    require(legacy_mcp == {'mcpServers': {'windscribe': {k: v for k, v in launch.items() if k != 'type'}}},
            'MCP compatibility configuration differs')
    require(compat['mcpServers'] == './.mcp.json', 'Compatibility MCP reference missing')
    package = json.loads((root / 'server/package.json').read_text(encoding='utf-8'))
    require(package['version'] == portable['version'], 'Server version differs')
    require(package['license'] == portable['license'] == 'MIT', 'Project license differs')
    # The root license is authoritative; distribute the same text with the plugin.
    license_text = (root / 'LICENSE').read_bytes()
    require(license_text.startswith(b'MIT License\n'), 'Missing MIT license text')
    (plugin / 'LICENSE').write_bytes(license_text)
    # Build from current source so a release never silently packages a stale bundle.
    subprocess.run(['node', 'scripts/build.mjs'], cwd=root / 'server', check=True)
    dependencies = json.loads((plugin / 'server/dist/dependencies.json').read_text(encoding='utf-8'))
    require(any(p.startswith('@modelcontextprotocol/sdk@') for p in dependencies), 'MCP SDK not bundled')
    catalog = json.loads((root / '.agents/plugins/marketplace.json').read_text())
    entry = catalog['plugins'][0]
    require(entry['name'] == portable['name'], 'Catalog identity mismatch')
    require((root / entry['source']['path']).resolve() == plugin.resolve(), 'Catalog path mismatch')
    # Explicit release inventory prevents accidental bundling of scratch files or credentials.
    inventory = ['plugin.json', '.codex-plugin/plugin.json', 'mcp.json', '.mcp.json',
                 'README.md', 'LICENSE', 'assets/logo.png', 'skills/windscribe/SKILL.md',
                 'skills/windscribe/agents/openai.yaml', 'server/dist/server.cjs',
                 'server/dist/THIRD-PARTY-NOTICES.txt', 'server/dist/dependencies.json']
    destination = root / 'dist'
    destination.mkdir(exist_ok=True)
    archive = destination / f"windscribe-{portable['version']}.zip"
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for name in inventory:
            # Stable metadata makes identical inputs produce identical ZIP bytes.
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3  # Stable Unix metadata, including builds on Windows.
            info.external_attr = 0o100644 << 16
            bundle.writestr(info, (plugin / name).read_bytes())
    with zipfile.ZipFile(archive) as bundle:
        require(bundle.testzip() is None, 'ZIP integrity failure')
        require(set(bundle.namelist()) == set(inventory), 'ZIP contents differ')
        for name in inventory:
            require(bundle.read(name) == (plugin / name).read_bytes(), f'ZIP mismatch: {name}')
    digest = sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n', encoding='ascii')
    # Separate public review artifact; missing demo/policy evidence keeps it a draft.
    submission = root / 'submission'
    submission.mkdir(exist_ok=True)
    draft = submission / f"windscribe-{portable['version']}-review-draft.zip"
    draft.write_bytes(archive.read_bytes())
    draft.with_suffix('.zip.sha256').write_text(f'{digest}  {draft.name}\n', encoding='ascii')
    print(f'PASS: metadata, desktop flags, MCP launch, bundle, image, paths, and ZIP integrity\n{archive}\nSHA256 {digest}')


if __name__ == '__main__':
    main()
