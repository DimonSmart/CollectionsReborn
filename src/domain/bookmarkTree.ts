import type { BookmarkEntryViewModel, FolderChoice } from '../types.js';
import type { FaviconService } from '../services/faviconService.js';

export function findNodeById(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  id: string,
): chrome.bookmarks.BookmarkTreeNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getVirtualRootId(tree: chrome.bookmarks.BookmarkTreeNode[]): string {
  return tree[0]?.id ?? '0';
}

export function getRootFolders(
  tree: chrome.bookmarks.BookmarkTreeNode[],
): chrome.bookmarks.BookmarkTreeNode[] {
  return (tree[0]?.children ?? []).filter((n) => !n.url);
}

export function resolveStartupFolder(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  savedFolderId?: string,
): string {
  const vrId = getVirtualRootId(tree);
  if (savedFolderId && savedFolderId !== vrId && findNodeById(tree, savedFolderId)) {
    return savedFolderId;
  }
  return vrId;
}

export function canNavigateBack(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  folderId: string,
): boolean {
  const node = findNodeById(tree, folderId);
  return !!(node?.parentId);
}

export function getParentFolderId(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  folderId: string,
): string | null {
  const node = findNodeById(tree, folderId);
  return node?.parentId ?? null;
}

export function buildFolderEntries(
  folderNode: chrome.bookmarks.BookmarkTreeNode,
  faviconService: FaviconService,
): BookmarkEntryViewModel[] {
  return (folderNode.children ?? []).map((child) => {
    if (child.url) {
      const domain = faviconService.getDomain(child.url);
      return {
        type: 'link' as const,
        id: child.id,
        parentId: child.parentId ?? '',
        index: child.index ?? 0,
        title: child.title || domain || child.url,
        url: child.url,
        domain,
        faviconUrl: faviconService.getFaviconUrl(child.url, 16),
      };
    } else {
      return {
        type: 'folder' as const,
        id: child.id,
        parentId: child.parentId ?? '',
        index: child.index ?? 0,
        title: child.title,
        childCount: (child.children ?? []).length,
      };
    }
  });
}

export function filterEntries(
  entries: BookmarkEntryViewModel[],
  searchText: string,
): BookmarkEntryViewModel[] {
  const q = searchText.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => {
    if (e.title.toLowerCase().includes(q)) return true;
    if (e.type === 'link') {
      return e.url.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q);
    }
    return false;
  });
}

export function searchBookmarkTree(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  searchText: string,
  faviconService: FaviconService,
): BookmarkEntryViewModel[] {
  const q = searchText.trim().toLowerCase();
  if (!q) return [];

  const results: BookmarkEntryViewModel[] = [];

  const visit = (nodes: chrome.bookmarks.BookmarkTreeNode[]): void => {
    for (const node of nodes) {
      if (node.id !== getVirtualRootId(tree) && nodeMatchesSearch(node, q, faviconService)) {
        results.push(buildEntryFromNode(node, faviconService));
      }
      if (node.children) visit(node.children);
    }
  };

  visit(tree);
  return results;
}

function nodeMatchesSearch(
  node: chrome.bookmarks.BookmarkTreeNode,
  query: string,
  faviconService: FaviconService,
): boolean {
  if (node.title.toLowerCase().includes(query)) return true;
  if (!node.url) return false;
  return node.url.toLowerCase().includes(query)
    || faviconService.getDomain(node.url).toLowerCase().includes(query);
}

function buildEntryFromNode(
  node: chrome.bookmarks.BookmarkTreeNode,
  faviconService: FaviconService,
): BookmarkEntryViewModel {
  if (node.url) {
    const domain = faviconService.getDomain(node.url);
    return {
      type: 'link',
      id: node.id,
      parentId: node.parentId ?? '',
      index: node.index ?? 0,
      title: node.title || domain || node.url,
      url: node.url,
      domain,
      faviconUrl: faviconService.getFaviconUrl(node.url, 16),
    };
  }

  return {
    type: 'folder',
    id: node.id,
    parentId: node.parentId ?? '',
    index: node.index ?? 0,
    title: node.title,
    childCount: (node.children ?? []).length,
  };
}

export function collectAllFolders(
  tree: chrome.bookmarks.BookmarkTreeNode[],
): FolderChoice[] {
  const folders: FolderChoice[] = [];
  const root = tree[0];
  if (!root?.children) return folders;

  const traverse = (
    nodes: chrome.bookmarks.BookmarkTreeNode[],
    path: string,
    depth: number,
  ) => {
    for (const n of nodes) {
      if (!n.url) {
        const nodePath = path ? `${path} / ${n.title}` : n.title;
        folders.push({ id: n.id, title: n.title, path: nodePath, depth });
        traverse(n.children ?? [], nodePath, depth + 1);
      }
    }
  };

  traverse(root.children, '', 0);
  return folders;
}

export function isDescendantOf(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  nodeId: string,
  possibleAncestorId: string,
): boolean {
  const ancestor = findNodeById(tree, possibleAncestorId);
  if (!ancestor) return false;

  const check = (nodes: chrome.bookmarks.BookmarkTreeNode[]): boolean => {
    for (const n of nodes) {
      if (n.id === nodeId) return true;
      if (n.children && check(n.children)) return true;
    }
    return false;
  };

  return check(ancestor.children ?? []);
}

export function getFolderPath(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  folderId: string,
): string[] {
  const path: string[] = [];

  const find = (nodes: chrome.bookmarks.BookmarkTreeNode[], target: string): boolean => {
    for (const n of nodes) {
      if (n.id === target) {
        path.push(n.title);
        return true;
      }
      if (n.children && find(n.children, target)) {
        path.unshift(n.title);
        return true;
      }
    }
    return false;
  };

  find(tree, folderId);
  return path;
}
