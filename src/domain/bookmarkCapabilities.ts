export interface BookmarkCapabilities {
  canRename: boolean;
  canEditUrl: boolean;
  canMove: boolean;
  canDelete: boolean;
  canCreateFolderBefore: boolean;
  canCreateFolderAfter: boolean;
  canCreateChildren: boolean;
  canSortChildren: boolean;
}

type ExtendedBookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode & {
  folderType?: string;
  unmodifiable?: string;
};

export function getBookmarkCapabilities(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  node: chrome.bookmarks.BookmarkTreeNode,
): BookmarkCapabilities {
  if (isRootNode(tree, node) || isManagedOrUnderManaged(tree, node)) {
    return noCapabilities();
  }

  const isFolder = !node.url;
  const canModify = canModifyNode(tree, node);
  const parent = node.parentId ? findNode(tree, node.parentId) : undefined;
  const canCreateSibling = !!parent && canCreateChildren(tree, parent);

  return {
    canRename: canModify,
    canEditUrl: canModify && !isFolder,
    canMove: canModify,
    canDelete: canModify,
    canCreateFolderBefore: canCreateSibling,
    canCreateFolderAfter: canCreateSibling,
    canCreateChildren: isFolder && canCreateChildren(tree, node),
    canSortChildren: isFolder && canCreateChildren(tree, node) && (node.children?.length ?? 0) > 1,
  };
}

function getRootNode(
  tree: chrome.bookmarks.BookmarkTreeNode[],
): chrome.bookmarks.BookmarkTreeNode | undefined {
  return tree[0];
}

function isRootNode(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  node: chrome.bookmarks.BookmarkTreeNode,
): boolean {
  return node.id === getRootNode(tree)?.id;
}

function isTopLevelBrowserFolder(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  node: chrome.bookmarks.BookmarkTreeNode,
): boolean {
  if (node.url) return false;
  const root = getRootNode(tree);
  if (!root) return false;

  const extendedNode = node as ExtendedBookmarkTreeNode;
  return node.parentId === root.id
    || (extendedNode.folderType !== undefined && root.children?.some((child) => child.id === node.id) === true);
}

function isManagedOrUnderManaged(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  node: chrome.bookmarks.BookmarkTreeNode,
): boolean {
  const visited = new Set<string>();
  let current: chrome.bookmarks.BookmarkTreeNode | undefined = node;

  while (current && !visited.has(current.id)) {
    if ((current as ExtendedBookmarkTreeNode).unmodifiable === 'managed') return true;
    visited.add(current.id);
    current = current.parentId ? findNode(tree, current.parentId) : undefined;
  }

  return false;
}

function canModifyNode(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  node: chrome.bookmarks.BookmarkTreeNode,
): boolean {
  return !isRootNode(tree, node)
    && !isTopLevelBrowserFolder(tree, node)
    && !isManagedOrUnderManaged(tree, node);
}

function canCreateChildren(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  folder: chrome.bookmarks.BookmarkTreeNode,
): boolean {
  return !folder.url
    && !isRootNode(tree, folder)
    && !isManagedOrUnderManaged(tree, folder);
}

function findNode(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  id: string,
): chrome.bookmarks.BookmarkTreeNode | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = node.children ? findNode(node.children, id) : undefined;
    if (found) return found;
  }
  return undefined;
}

function noCapabilities(): BookmarkCapabilities {
  return {
    canRename: false,
    canEditUrl: false,
    canMove: false,
    canDelete: false,
    canCreateFolderBefore: false,
    canCreateFolderAfter: false,
    canCreateChildren: false,
    canSortChildren: false,
  };
}
