export interface ResizePreviewInput {
  blob: Blob;
  width: number;
  height: number;
  preferredType: 'image/webp' | 'image/jpeg';
  quality: number;
}

export interface ResizePreviewResult {
  blob: Blob;
  mimeType: 'image/webp' | 'image/jpeg';
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

export async function resizePreviewImage(input: ResizePreviewInput): Promise<ResizePreviewResult> {
  const bitmap = await createImageBitmap(input.blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = input.width;
    canvas.height = input.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    const sourceRatio = bitmap.width / bitmap.height;
    const targetRatio = input.width / input.height;
    let sx = 0;
    let sy = 0;
    let sw = bitmap.width;
    let sh = bitmap.height;

    if (sourceRatio > targetRatio) {
      sw = Math.round(bitmap.height * targetRatio);
      sx = Math.round((bitmap.width - sw) / 2);
    } else {
      sh = Math.round(bitmap.width / targetRatio);
      sy = Math.round((bitmap.height - sh) / 2);
    }

    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, input.width, input.height);
    const primary = await canvasToBlob(canvas, input.preferredType, input.quality);
    if (primary && primary.size > 1024) {
      return { blob: primary, mimeType: input.preferredType };
    }

    const fallback = await canvasToBlob(canvas, 'image/jpeg', input.quality);
    if (fallback && fallback.size > 1024) {
      return { blob: fallback, mimeType: 'image/jpeg' };
    }

    throw new Error('Empty thumbnail blob');
  } finally {
    bitmap.close();
  }
}

export async function composePreviewCollage(input: {
  blobs: Blob[];
  width: number;
  height: number;
  preferredType: 'image/webp' | 'image/jpeg';
  quality: number;
}): Promise<ResizePreviewResult> {
  const bitmaps = await Promise.all(input.blobs.slice(0, 4).map((blob) => createImageBitmap(blob)));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = input.width;
    canvas.height = input.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    const slots = getCollageSlots(bitmaps.length, input.width, input.height);
    bitmaps.forEach((bitmap, index) => drawCover(ctx, bitmap, slots[index]));

    const primary = await canvasToBlob(canvas, input.preferredType, input.quality);
    if (primary && primary.size > 1024) return { blob: primary, mimeType: input.preferredType };

    const fallback = await canvasToBlob(canvas, 'image/jpeg', input.quality);
    if (fallback && fallback.size > 1024) return { blob: fallback, mimeType: 'image/jpeg' };

    throw new Error('Empty composite blob');
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: 'image/webp' | 'image/jpeg',
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function getCollageSlots(count: number, width: number, height: number): DOMRect[] {
  if (count <= 1) return [new DOMRect(0, 0, width, height)];
  if (count === 2) {
    return [new DOMRect(0, 0, width / 2, height), new DOMRect(width / 2, 0, width / 2, height)];
  }
  if (count === 3) {
    return [
      new DOMRect(0, 0, width / 2, height),
      new DOMRect(width / 2, 0, width / 2, height / 2),
      new DOMRect(width / 2, height / 2, width / 2, height / 2),
    ];
  }
  return [
    new DOMRect(0, 0, width / 2, height / 2),
    new DOMRect(width / 2, 0, width / 2, height / 2),
    new DOMRect(0, height / 2, width / 2, height / 2),
    new DOMRect(width / 2, height / 2, width / 2, height / 2),
  ];
}

function drawCover(ctx: CanvasRenderingContext2D, bitmap: ImageBitmap, rect: DOMRect): void {
  const sourceRatio = bitmap.width / bitmap.height;
  const targetRatio = rect.width / rect.height;
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;

  if (sourceRatio > targetRatio) {
    sw = Math.round(bitmap.height * targetRatio);
    sx = Math.round((bitmap.width - sw) / 2);
  } else {
    sh = Math.round(bitmap.width / targetRatio);
    sy = Math.round((bitmap.height - sh) / 2);
  }

  ctx.drawImage(bitmap, sx, sy, sw, sh, rect.x, rect.y, rect.width, rect.height);
}
