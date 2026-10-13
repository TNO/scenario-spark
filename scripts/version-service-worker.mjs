import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../docs/', import.meta.url));
const worker = join(output, 'sw.js');
const hash = createHash('sha256');

const includeFiles = async (directory) => {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await includeFiles(path);
    } else if (entry.isFile() && entry.name !== 'sw.js' && !entry.name.endsWith('.map')) {
      hash.update(relative(output, path)).update('\0');
      hash.update(await readFile(path));
    }
  }
};

await includeFiles(output);
const source = await readFile(worker, 'utf8');
if (!source.includes('__BUILD_HASH__')) {
  throw new Error('The service worker build hash placeholder is missing');
}
await writeFile(worker, source.replace('__BUILD_HASH__', hash.digest('hex').slice(0, 16)));
