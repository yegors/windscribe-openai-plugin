import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, '../plugins/windscribe/server/dist');
await mkdir(dist, { recursive: true });
const result = await build({
  absWorkingDir: root, entryPoints: ['src/index.mjs'], outfile: join(dist, 'server.cjs'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  metafile: true, legalComments: 'eof'
});
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes('node_modules/')) continue;
  let folder = dirname(resolve(root, input));
  while (folder.startsWith(root)) {
    try {
      const pkg = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'));
      if (!pkg.name) { folder = dirname(folder); continue; }
      let license;
      // Package authors use mixed casing (for example retry's "License").
      // Discover the actual filename so Linux behaves like Windows/macOS.
      const licenses = (await readdir(folder)).filter(name => /^licen[cs]e(?:\.md|\.txt)?$/i.test(name)).sort();
      for (const name of licenses) {
        try { license = await readFile(join(folder, name), 'utf8'); break; } catch {}
      }
      if (!license) throw new Error(`Missing license text for ${pkg.name}`);
      packages.set(`${pkg.name}@${pkg.version}`, license);
      break;
    } catch (error) {
      if (error.message.startsWith('Missing license')) throw error;
      folder = dirname(folder);
    }
  }
}
await writeFile(join(dist, 'THIRD-PARTY-NOTICES.txt'), [...packages].sort().map(([name, license]) => `${name}\n${'='.repeat(72)}\n${license}`).join('\n\n'));
await writeFile(join(dist, 'dependencies.json'), JSON.stringify([...packages.keys()].sort(), null, 2) + '\n');
console.log(`Bundled ${packages.size} dependencies with license notices. Node.js 22+ required at runtime.`);
