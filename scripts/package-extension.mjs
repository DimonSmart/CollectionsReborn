import archiver from 'archiver';
import { createReadStream, createWriteStream } from 'node:fs';
import { rm, mkdir, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(root, 'dist');
const releaseDir = join(root, 'release');
const packageJson = JSON.parse(
  await import('node:fs/promises').then(({ readFile }) =>
    readFile(join(root, 'package.json'), 'utf8'),
  ),
);
const zipPath = join(releaseDir, `collections-reborn-${packageJson.version}.zip`);

const requiredFiles = [
  'manifest.json',
  'sidepanel.html',
  'background.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

await assertDirectory(distDir);
await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

const distFiles = await collectFiles(distDir);
const distFileSet = new Set(distFiles.map((file) => toZipPath(relative(distDir, file))));
for (const requiredFile of requiredFiles) {
  if (!distFileSet.has(requiredFile)) {
    throw new Error(`Missing required dist file: ${requiredFile}`);
  }
}

await createZip(distFiles);
await assertZipEntries(zipPath, requiredFiles);

console.log(`Created ${zipPath}`);

async function assertDirectory(path) {
  let info;
  try {
    info = await stat(path);
  } catch {
    throw new Error(`Required directory does not exist: ${path}`);
  }
  if (!info.isDirectory()) {
    throw new Error(`Expected a directory: ${path}`);
  }
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function createZip(files) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('warning', reject);
    archive.on('error', reject);

    archive.pipe(output);
    for (const file of files) {
      archive.append(createReadStream(file), { name: toZipPath(relative(distDir, file)) });
    }
    archive.finalize();
  });
}

async function assertZipEntries(path, requiredEntries) {
  const entries = await readZipEntries(path);
  const entrySet = new Set(entries);
  for (const requiredEntry of requiredEntries) {
    if (!entrySet.has(requiredEntry)) {
      throw new Error(`Zip is missing required entry: ${requiredEntry}`);
    }
  }
  if (!entrySet.has('manifest.json')) {
    throw new Error('Zip must contain manifest.json at the root level.');
  }
  if (entries.some((entry) => entry.startsWith('dist/'))) {
    throw new Error('Zip must not contain an extra dist/ root folder.');
  }
}

async function readZipEntries(path) {
  const { readFile } = await import('node:fs/promises');
  const buffer = await readFile(path);
  const entries = [];
  let offset = 0;

  while (offset < buffer.length - 46) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x02014b50) {
      offset += 1;
      continue;
    }

    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    entries.push(buffer.toString('utf8', fileNameStart, fileNameEnd));
    offset = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

function toZipPath(path) {
  return path.split(sep).join('/');
}
