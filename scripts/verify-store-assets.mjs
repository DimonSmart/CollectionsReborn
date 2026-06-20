import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const assets = [
  ['screenshot', 'docs/store/assets/screenshots/01-main-side-panel.png', 1280, 800, false],
  ['screenshot', 'docs/store/assets/screenshots/02-folder-navigation.png', 1280, 800, false],
  ['screenshot', 'docs/store/assets/screenshots/03-drag-and-drop-reorder.png', 1280, 800, false],
  ['screenshot', 'docs/store/assets/screenshots/04-move-to-folder-dialog.png', 1280, 800, false],
  ['screenshot', 'docs/store/assets/screenshots/05-add-current-page.png', 1280, 800, false],
  ['promo image', 'docs/store/assets/promo/small-promo-440x280.png', 440, 280, true],
  ['promo image', 'docs/store/assets/promo/marquee-1400x560.png', 1400, 560, true],
  ['logo image', 'docs/store/assets/logo/logo-128.png', 128, 128, false],
  ['logo image', 'docs/store/assets/logo/logo-300.png', 300, 300, false],
];

for (const [kind, path, expectedWidth, expectedHeight, requireTruecolor] of assets) {
  await verifyPngAsset(kind, path, expectedWidth, expectedHeight, requireTruecolor);
}

console.log('Store assets are valid PNG files with expected dimensions.');

async function verifyPngAsset(kind, assetPath, expectedWidth, expectedHeight, requireTruecolor) {
  const fullPath = join(root, assetPath);
  let buffer;
  try {
    buffer = await readFile(fullPath);
  } catch {
    throw new Error(`Missing ${kind}: ${toDisplayPath(fullPath)}`);
  }

  const actualFormat = detectImageFormat(buffer);
  if (actualFormat !== 'PNG') {
    throw new Error(
      `Invalid ${kind} format: ${assetPath}\nExpected PNG, got ${actualFormat}.`,
    );
  }

  const { width, height } = readPngDimensions(buffer);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(
      `Invalid ${kind} size: ${assetPath}\nExpected ${expectedWidth}x${expectedHeight}, got ${width}x${height}.`,
    );
  }

  if (requireTruecolor) {
    const colorType = buffer[25];
    if (colorType !== 2) {
      throw new Error(
        `Invalid ${kind} color type: ${assetPath}\nExpected 24-bit RGB PNG without alpha, got PNG color type ${colorType}.`,
      );
    }
  }
}

function detectImageFormat(buffer) {
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return 'PNG';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'JPEG';
  }
  return 'unknown format';
}

function readPngDimensions(buffer) {
  if (buffer.length < 24) {
    throw new Error('Invalid PNG: file is too small to contain an IHDR chunk.');
  }

  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType !== 'IHDR') {
    throw new Error(`Invalid PNG: expected IHDR chunk, got ${chunkType}.`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function toDisplayPath(path) {
  return relative(root, path).replaceAll('\\', '/');
}
