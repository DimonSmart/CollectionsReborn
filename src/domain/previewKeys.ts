export type PreviewKind = 'link' | 'folder';
export type PreviewKey = `link:${string}` | `folder:${string}`;

export function getPreviewKey(kind: PreviewKind, bookmarkId: string): PreviewKey {
  return `${kind}:${bookmarkId}` as PreviewKey;
}

export function getLinkPreviewKey(bookmarkId: string): PreviewKey {
  return getPreviewKey('link', bookmarkId);
}

export function getFolderPreviewKey(bookmarkId: string): PreviewKey {
  return getPreviewKey('folder', bookmarkId);
}
