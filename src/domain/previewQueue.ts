import type { PreviewRecord, PreviewQueueItem } from '../services/previewDbService.js';
import type { PreviewSettings } from '../services/previewSettingsService.js';
import { getLinkPreviewKey } from './previewKeys.js';
import { getUrlDomain, isPrivateHost, validatePreviewUrl } from './previewUrlRules.js';

const FRESH_ERROR_MS = 24 * 60 * 60 * 1000;

export function collectLinkBookmarks(
  tree: chrome.bookmarks.BookmarkTreeNode[],
): chrome.bookmarks.BookmarkTreeNode[] {
  const links: chrome.bookmarks.BookmarkTreeNode[] = [];
  const visit = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
    for (const node of nodes) {
      if (node.url) {
        links.push(node);
      } else {
        visit(node.children ?? []);
      }
    }
  };
  visit(tree);
  return links;
}

export function buildMissingPreviewQueue(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  existingRecords: PreviewRecord[],
  settings: PreviewSettings,
  now = Date.now(),
): PreviewQueueItem[] {
  const recordsByKey = new Map(existingRecords.map((record) => [record.key, record]));
  const excluded = new Set(settings.excludedDomains.map((domain) => domain.toLowerCase()));

  return collectLinkBookmarks(tree)
    .filter((node) => !!node.url)
    .filter((node) => {
      const url = node.url!;
      if (!validatePreviewUrl(url).ok) return false;
      if (settings.skipPrivateHosts && isPrivateHost(url)) return false;
      if (excluded.has(getUrlDomain(url).toLowerCase())) return false;

      const existing = recordsByKey.get(getLinkPreviewKey(node.id));
      if (!existing) return true;
      if (existing.status === 'ok' && existing.blob) return false;
      if (existing.status === 'skipped') return false;
      if (existing.status === 'error' && existing.failedAt && now - existing.failedAt < FRESH_ERROR_MS) {
        return false;
      }
      return true;
    })
    .map((node) => ({
      bookmarkId: node.id,
      title: node.title,
      url: node.url!,
      status: 'pending' as const,
    }));
}
