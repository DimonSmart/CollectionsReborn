import { describe, it, expect } from 'vitest';
import {
  findNodeById,
  getVirtualRootId,
  getRootFolders,
  resolveStartupFolder,
  canNavigateBack,
  buildFolderEntries,
  filterEntries,
  collectAllFolders,
  isDescendantOf,
} from './bookmarkTree.js';
import type { FaviconService } from '../services/faviconService.js';

// Minimal mock matching FaviconService shape
const mockFavicon = {
  getDomain: (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  },
  getFaviconUrl: (_url: string, _size?: number) => '',
  getFallbackContent: (_url: string) => '?',
} as unknown as FaviconService;

type Node = chrome.bookmarks.BookmarkTreeNode;

function folder(id: string, parentId: string, title: string, children: Node[] = []): Node {
  return { id, parentId, title, index: 0, dateAdded: 0, children };
}

function link(id: string, parentId: string, title: string, url: string): Node {
  return { id, parentId, title, index: 0, dateAdded: 0, url };
}

// Simulate Chrome bookmark tree: tree[0] is root (id='0')
function makeTree(): Node[] {
  const bar = folder('1', '0', 'Bookmarks Bar', [
    link('10', '1', 'Google', 'https://google.com'),
    link('11', '1', 'GitHub', 'https://github.com'),
    folder('12', '1', 'Work', [
      link('120', '12', 'Jira', 'https://jira.example.com'),
    ]),
  ]);
  const other = folder('2', '0', 'Other Bookmarks', [
    link('20', '2', 'Reddit', 'https://www.reddit.com'),
  ]);
  const root = folder('0', '', 'root', [bar, other]);
  root.parentId = undefined as unknown as string;
  return [root];
}

describe('findNodeById', () => {
  it('finds root node', () => {
    const tree = makeTree();
    expect(findNodeById(tree, '0')?.id).toBe('0');
  });

  it('finds a deeply nested link', () => {
    const tree = makeTree();
    expect(findNodeById(tree, '120')?.title).toBe('Jira');
  });

  it('returns null for unknown id', () => {
    const tree = makeTree();
    expect(findNodeById(tree, 'nonexistent')).toBeNull();
  });

  it('handles empty tree', () => {
    expect(findNodeById([], 'x')).toBeNull();
  });
});

describe('getVirtualRootId', () => {
  it('returns id of first tree node', () => {
    const tree = makeTree();
    expect(getVirtualRootId(tree)).toBe('0');
  });

  it('returns "0" fallback for empty tree', () => {
    expect(getVirtualRootId([])).toBe('0');
  });
});

describe('getRootFolders', () => {
  it('returns only folder children of the root', () => {
    const tree = makeTree();
    const roots = getRootFolders(tree);
    expect(roots.map((r) => r.id)).toEqual(['1', '2']);
  });

  it('excludes links at root level', () => {
    const tree = makeTree();
    // Add a link at root level
    tree[0].children!.push(link('99', '0', 'Root link', 'https://x.com'));
    const roots = getRootFolders(tree);
    expect(roots.every((r) => !r.url)).toBe(true);
  });
});

describe('resolveStartupFolder', () => {
  it('returns saved folder id when valid', () => {
    const tree = makeTree();
    expect(resolveStartupFolder(tree, '12')).toBe('12');
  });

  it('falls back to virtual root when saved id is missing from tree', () => {
    const tree = makeTree();
    expect(resolveStartupFolder(tree, 'deleted-id')).toBe('0');
  });

  it('falls back to virtual root when no saved id', () => {
    const tree = makeTree();
    expect(resolveStartupFolder(tree, undefined)).toBe('0');
  });

  it('falls back to virtual root when saved id IS the virtual root', () => {
    const tree = makeTree();
    expect(resolveStartupFolder(tree, '0')).toBe('0');
  });

  it('returns virtual root for empty tree', () => {
    expect(resolveStartupFolder([], undefined)).toBe('0');
  });
});

describe('canNavigateBack', () => {
  it('returns false for root node (no parentId)', () => {
    const tree = makeTree();
    expect(canNavigateBack(tree, '0')).toBe(false);
  });

  it('returns true for Bookmarks Bar (parentId = root)', () => {
    const tree = makeTree();
    expect(canNavigateBack(tree, '1')).toBe(true);
  });

  it('returns true for a nested folder', () => {
    const tree = makeTree();
    expect(canNavigateBack(tree, '12')).toBe(true);
  });

  it('returns false for unknown id', () => {
    const tree = makeTree();
    expect(canNavigateBack(tree, 'unknown')).toBe(false);
  });
});

describe('collectAllFolders', () => {
  it('collects all folders in depth-first order', () => {
    const tree = makeTree();
    const folders = collectAllFolders(tree);
    const ids = folders.map((f) => f.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids).toContain('12');
  });

  it('does not include links', () => {
    const tree = makeTree();
    const folders = collectAllFolders(tree);
    expect(folders.every((f) => !f.id.startsWith('1') || f.id === '1' || f.id === '12')).toBe(true);
    expect(folders.some((f) => f.id === '10')).toBe(false);
  });

  it('returns empty for empty tree', () => {
    expect(collectAllFolders([])).toEqual([]);
  });

  it('builds correct path strings', () => {
    const tree = makeTree();
    const folders = collectAllFolders(tree);
    const work = folders.find((f) => f.id === '12');
    expect(work?.path).toBe('Bookmarks Bar / Work');
    expect(work?.depth).toBe(1);
  });
});

describe('isDescendantOf', () => {
  it('returns true for direct child', () => {
    const tree = makeTree();
    expect(isDescendantOf(tree, '10', '1')).toBe(true);
  });

  it('returns true for nested descendant', () => {
    const tree = makeTree();
    expect(isDescendantOf(tree, '120', '1')).toBe(true);
  });

  it('returns false for ancestor', () => {
    const tree = makeTree();
    expect(isDescendantOf(tree, '1', '12')).toBe(false);
  });

  it('returns false for unrelated node', () => {
    const tree = makeTree();
    expect(isDescendantOf(tree, '20', '1')).toBe(false);
  });

  it('returns false when ancestor does not exist', () => {
    const tree = makeTree();
    expect(isDescendantOf(tree, '10', 'nonexistent')).toBe(false);
  });

  it('folder cannot be descendant of itself', () => {
    const tree = makeTree();
    expect(isDescendantOf(tree, '1', '1')).toBe(false);
  });
});

describe('buildFolderEntries', () => {
  it('maps link children correctly', () => {
    const tree = makeTree();
    const bar = findNodeById(tree, '1')!;
    const entries = buildFolderEntries(bar, mockFavicon);
    const link = entries.find((e) => e.id === '10');
    expect(link?.type).toBe('link');
    expect(link?.title).toBe('Google');
    if (link?.type === 'link') {
      expect(link.domain).toBe('google.com');
    }
  });

  it('maps folder children correctly', () => {
    const tree = makeTree();
    const bar = findNodeById(tree, '1')!;
    const entries = buildFolderEntries(bar, mockFavicon);
    const folderEntry = entries.find((e) => e.id === '12');
    expect(folderEntry?.type).toBe('folder');
    if (folderEntry?.type === 'folder') {
      expect(folderEntry.childCount).toBe(1);
    }
  });

  it('returns empty array for folder with no children', () => {
    const emptyFolder: Node = folder('99', '1', 'Empty');
    const entries = buildFolderEntries(emptyFolder, mockFavicon);
    expect(entries).toHaveLength(0);
  });
});

describe('filterEntries', () => {
  it('returns all entries when query is empty', () => {
    const tree = makeTree();
    const bar = findNodeById(tree, '1')!;
    const entries = buildFolderEntries(bar, mockFavicon);
    expect(filterEntries(entries, '')).toHaveLength(entries.length);
  });

  it('filters by title (case insensitive)', () => {
    const tree = makeTree();
    const bar = findNodeById(tree, '1')!;
    const entries = buildFolderEntries(bar, mockFavicon);
    const result = filterEntries(entries, 'git');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('GitHub');
  });

  it('filters links by url', () => {
    const tree = makeTree();
    const bar = findNodeById(tree, '1')!;
    const entries = buildFolderEntries(bar, mockFavicon);
    const result = filterEntries(entries, 'github.com');
    expect(result.some((e) => e.title === 'GitHub')).toBe(true);
  });

  it('filters links by domain', () => {
    const tree = makeTree();
    const bar = findNodeById(tree, '1')!;
    const entries = buildFolderEntries(bar, mockFavicon);
    const result = filterEntries(entries, 'google');
    expect(result.some((e) => e.title === 'Google')).toBe(true);
  });

  it('does not filter folders by url (folders have no url)', () => {
    const tree = makeTree();
    const bar = findNodeById(tree, '1')!;
    const entries = buildFolderEntries(bar, mockFavicon);
    const result = filterEntries(entries, 'work');
    expect(result.some((e) => e.type === 'folder' && e.title === 'Work')).toBe(true);
  });

  it('returns empty array when nothing matches', () => {
    const tree = makeTree();
    const bar = findNodeById(tree, '1')!;
    const entries = buildFolderEntries(bar, mockFavicon);
    expect(filterEntries(entries, 'zzznomatch')).toHaveLength(0);
  });
});
