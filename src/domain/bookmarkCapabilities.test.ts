import { describe, expect, it } from 'vitest';
import { getBookmarkCapabilities } from './bookmarkCapabilities.js';

type Node = chrome.bookmarks.BookmarkTreeNode & {
  folderType?: string;
  unmodifiable?: string;
};

function folder(id: string, parentId: string | undefined, title: string, children: Node[] = []): Node {
  return { id, parentId, title, index: 0, children } as Node;
}

function link(id: string, parentId: string, title: string, url = 'https://example.test'): Node {
  return { id, parentId, title, index: 0, url } as Node;
}

function makeTree(): { tree: Node[]; root: Node; top: Node; userFolder: Node; userLink: Node } {
  const userLink = link('link', 'user', 'Variable link');
  const userFolder = folder('user', 'top', 'Personal container', [userLink]);
  const top = folder('top', 'root', 'Localized browser container', [userFolder]);
  const root = folder('root', undefined, '', [top]);
  return { tree: [root], root, top, userFolder, userLink };
}

describe('getBookmarkCapabilities', () => {
  it('disables every capability for the root node', () => {
    const { tree, root } = makeTree();
    expect(Object.values(getBookmarkCapabilities(tree, root))).toEqual(Array(8).fill(false));
  });

  it('protects a top-level browser folder without folderType', () => {
    const { tree, top } = makeTree();
    const capabilities = getBookmarkCapabilities(tree, top);
    expect(capabilities).toMatchObject({
      canRename: false,
      canMove: false,
      canDelete: false,
      canCreateFolderBefore: false,
      canCreateFolderAfter: false,
      canCreateChildren: true,
    });
  });

  it('protects a top-level browser folder with folderType', () => {
    const { tree, top } = makeTree();
    top.folderType = 'browser-defined-kind';
    expect(getBookmarkCapabilities(tree, top).canDelete).toBe(false);
    expect(getBookmarkCapabilities(tree, top).canCreateChildren).toBe(true);
  });

  it('allows editing a user folder inside a top-level browser folder', () => {
    const { tree, userFolder } = makeTree();
    expect(getBookmarkCapabilities(tree, userFolder)).toMatchObject({
      canRename: true,
      canMove: true,
      canDelete: true,
      canCreateFolderBefore: true,
      canCreateFolderAfter: true,
      canCreateChildren: true,
    });
  });

  it('allows editing a normal link inside a user folder', () => {
    const { tree, userLink } = makeTree();
    expect(getBookmarkCapabilities(tree, userLink)).toMatchObject({
      canRename: true,
      canEditUrl: true,
      canMove: true,
      canDelete: true,
      canCreateChildren: false,
      canSortChildren: false,
    });
  });

  it('disables a managed folder', () => {
    const { tree, userFolder } = makeTree();
    userFolder.unmodifiable = 'managed';
    expect(Object.values(getBookmarkCapabilities(tree, userFolder))).toEqual(Array(8).fill(false));
  });

  it('disables a child inside a managed folder', () => {
    const { tree, userFolder, userLink } = makeTree();
    userFolder.unmodifiable = 'managed';
    expect(Object.values(getBookmarkCapabilities(tree, userLink))).toEqual(Array(8).fill(false));
  });

  it('allows sibling folder creation when the parent accepts children', () => {
    const { tree, userFolder } = makeTree();
    const capabilities = getBookmarkCapabilities(tree, userFolder);
    expect(capabilities.canCreateFolderBefore).toBe(true);
    expect(capabilities.canCreateFolderAfter).toBe(true);
  });

  it('disables a user folder whose parent is read-only', () => {
    const { tree, top, userFolder } = makeTree();
    top.unmodifiable = 'managed';
    expect(Object.values(getBookmarkCapabilities(tree, userFolder))).toEqual(Array(8).fill(false));
  });

  it('protects an Edge-like direct child of root without checking its title', () => {
    const { tree, root } = makeTree();
    const edgeLike = folder('edge-like', root.id, 'Arbitrary translated workspace');
    root.children!.push(edgeLike);
    expect(getBookmarkCapabilities(tree, edgeLike)).toMatchObject({
      canRename: false,
      canMove: false,
      canDelete: false,
      canCreateChildren: true,
    });
  });

  it('allows sorting only when a writable folder has more than one child', () => {
    const { tree, userFolder } = makeTree();
    expect(getBookmarkCapabilities(tree, userFolder).canSortChildren).toBe(false);
    userFolder.children!.push(link('second', userFolder.id, 'Second'));
    expect(getBookmarkCapabilities(tree, userFolder).canSortChildren).toBe(true);
  });
});
