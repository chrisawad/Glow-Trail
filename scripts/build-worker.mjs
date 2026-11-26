import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';

const output = 'dist/client';
// Manifest IDs resolve against the origin, even when the manifest lives under a project path.
const manifestPath = join(output, 'manifest.webmanifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.id = process.env.VITE_BASE_PATH || '/';
manifest.related_applications[0].id = manifest.id;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const files = (await readdir(output, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile() && !['og.png', 'sw.js', 'version.txt'].includes(entry.name))
  .map(entry => join(entry.parentPath, entry.name).slice(output.length + 1).split(sep).join('/'))
  .sort();
const template = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
const hash = createHash('sha256').update(template);
const indexPath = join(output, 'index.html');
const marker = /(<meta name="glow-trail-build" content=")(?:__REVISION__|[a-f0-9]{16})(")/;
const html = (await readFile(indexPath, 'utf8')).replace(marker, '$1__REVISION__$2');
if (!html.includes('__REVISION__')) throw new Error('Missing build marker in index.html');
for (const file of files) hash.update(file).update(file === 'index.html' ? html : await readFile(join(output, file)));
const revision = hash.digest('hex').slice(0, 16);
await writeFile(indexPath, html.replace('__REVISION__', revision));
await writeFile(join(output, 'version.txt'), revision + '\n');
const urls = files.map(file => file === 'index.html' ? './' : './' + file);
await writeFile(join(output, 'sw.js'), template
  .replace('__REVISION__', revision)
  .replace('__FILES__', JSON.stringify(urls)));
