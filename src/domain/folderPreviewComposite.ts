import type { PreviewRecord } from '../services/previewDbService.js';

export interface FolderChildPreviewInfo {
  id: string;
  previewKey: string;
  updatedAt?: number;
}

export function calculateFolderChildrenHash(
  folderId: string,
  childPreviews: FolderChildPreviewInfo[],
): string {
  const parts = childPreviews
    .map((child) => `${child.id}:${child.previewKey}:${child.updatedAt ?? 0}`)
    .join('|');
  return `${folderId}|${parts}`;
}

export function getFolderChildPreviewInfo(
  childLinks: chrome.bookmarks.BookmarkTreeNode[],
  records: PreviewRecord[],
): FolderChildPreviewInfo[] {
  const byBookmarkId = new Map(records.map((record) => [record.bookmarkId, record]));
  const result: FolderChildPreviewInfo[] = [];
  for (const child of childLinks) {
    const record = byBookmarkId.get(child.id);
    if (record?.status === 'ok') {
      result.push({
        id: child.id,
        previewKey: record.key,
        updatedAt: record.updatedAt,
      });
    }
  }
  return result;
}
