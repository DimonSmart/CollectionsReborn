import archiver from 'archiver';
import { createReadStream, createWriteStream, readFileSync } from 'node:fs';
import { rm, mkdir, readdir, stat, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(root, 'dist');
const releaseDir = join(root, 'release');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const zipPath = join(releaseDir, `collections-reborn-${packageJson.version}.zip`);
const allowedPermissions = new Set(['bookmarks', 'sidePanel', 'storage', 'favicon', 'tabs', 'activeTab']);
const allowedHostPermissions = new Set(['<all_urls>']);

const requiredFiles = [
  'manifest.json',
  'background.js',
  'sidepanel.html',
  'icons/icon16.png',
  'icons/icon24.png',
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
await assertZip(zipPath, requiredFiles);

console.log(`Collections Reborn package is ready for store submission:\nrelease/collections-reborn-${packageJson.version}.zip`);

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

async function assertZip(path, requiredEntries) {
  const entries = await readZipEntries(path);
  const entryNames = entries.map((entry) => entry.name);
  const entrySet = new Set(entryNames);
  for (const requiredEntry of requiredEntries) {
    if (!entrySet.has(requiredEntry)) {
      throw new Error(`Zip is missing required entry: ${requiredEntry}`);
    }
  }
  if (!entrySet.has('manifest.json')) {
    throw new Error('Zip must contain manifest.json at the root level.');
  }
  if (entryNames.some((entry) => entry.startsWith('dist/'))) {
    throw new Error('Zip must not contain an extra dist/ root folder.');
  }

  const forbiddenEntry = entryNames.find(isForbiddenZipEntry);
  if (forbiddenEntry) {
    throw new Error(`Zip contains forbidden entry: ${forbiddenEntry}`);
  }

  const manifestEntry = entries.find((entry) => entry.name === 'manifest.json');
  if (!manifestEntry) {
    throw new Error('Zip must contain manifest.json at the root level.');
  }

  const manifest = JSON.parse(extractZipEntry(await readFile(path), manifestEntry).toString('utf8'));
  assertManifest(manifest);
}

async function readZipEntries(path) {
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
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    entries.push({
      name: buffer.toString('utf8', fileNameStart, fileNameEnd),
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

function extractZipEntry(zipBuffer, entry) {
  const signature = zipBuffer.readUInt32LE(entry.localHeaderOffset);
  if (signature !== 0x04034b50) {
    throw new Error(`Invalid local header for zip entry: ${entry.name}`);
  }

  const fileNameLength = zipBuffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraLength = zipBuffer.readUInt16LE(entry.localHeaderOffset + 28);
  const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  const compressedData = zipBuffer.subarray(dataStart, dataEnd);

  if (entry.compressionMethod === 0) {
    return compressedData;
  }
  if (entry.compressionMethod === 8) {
    const data = inflateRawSync(compressedData);
    if (data.length !== entry.uncompressedSize) {
      throw new Error(`Invalid uncompressed size for zip entry: ${entry.name}`);
    }
    return data;
  }

  throw new Error(`Unsupported compression method ${entry.compressionMethod} for zip entry: ${entry.name}`);
}

function assertManifest(manifest) {
  const sourceManifest = JSON.parse(readFileSyncText(join(root, 'manifest.json')));

  if (manifest.manifest_version !== 3) {
    throw new Error('Invalid manifest_version in zip manifest. Expected 3.');
  }
  if (manifest.name !== 'Collections Reborn') {
    throw new Error('Invalid extension name in zip manifest. Expected "Collections Reborn".');
  }
  if (manifest.minimum_chrome_version !== '114') {
    throw new Error('Invalid minimum_chrome_version in zip manifest. Expected "114".');
  }
  if (manifest.version !== packageJson.version) {
    throw new Error(`Manifest version must match package.json version. manifest.json=${manifest.version}, package.json=${packageJson.version}.`);
  }
  if (sourceManifest.version !== packageJson.version) {
    throw new Error(`Source manifest version must match package.json version. manifest.json=${sourceManifest.version}, package.json=${packageJson.version}.`);
  }

  const permissions = manifest.permissions ?? [];
  if (!Array.isArray(permissions)) {
    throw new Error('Manifest permissions must be an array.');
  }

  const unexpectedPermission = permissions.find((permission) => !allowedPermissions.has(permission));
  if (unexpectedPermission) {
    throw new Error(`Manifest contains unexpected permission: ${unexpectedPermission}`);
  }

  const hostPermissions = manifest.host_permissions ?? [];
  if (!Array.isArray(hostPermissions)) {
    throw new Error('Manifest host_permissions must be an array when present.');
  }

  const unexpectedHostPermission = hostPermissions.find((permission) => !allowedHostPermissions.has(permission));
  if (unexpectedHostPermission) {
    throw new Error(`Manifest contains unexpected host permission: ${unexpectedHostPermission}`);
  }
}

function isForbiddenZipEntry(entry) {
  const normalized = entry.replaceAll('\\', '/');
  const segments = normalized.split('/');
  const fileName = segments.at(-1) ?? normalized;

  if (segments.some((segment) => [
    'src',
    'node_modules',
    'docs',
    'scripts',
    'coverage',
    '.git',
    '.github',
  ].includes(segment))) {
    return true;
  }

  return [
    /\.map$/i,
    /\.tsx?$/i,
    /\.test\./i,
    /\.spec\./i,
  ].some((pattern) => pattern.test(fileName));
}

function readFileSyncText(path) {
  return readFileSync(path, 'utf8');
}

function toZipPath(path) {
  return path.split(sep).join('/');
}
