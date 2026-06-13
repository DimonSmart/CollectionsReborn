export class BookmarksService {
  async getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return chrome.bookmarks.getTree();
  }

  async getChildren(folderId: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return chrome.bookmarks.getChildren(folderId);
  }

  async createBookmark(
    parentId: string,
    title: string,
    url: string,
  ): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return chrome.bookmarks.create({ parentId, title, url });
  }

  async createFolder(
    parentId: string,
    title: string,
  ): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return chrome.bookmarks.create({ parentId, title });
  }

  async updateTitle(id: string, title: string): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return chrome.bookmarks.update(id, { title });
  }

  async move(
    id: string,
    parentId: string,
    index?: number,
  ): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return chrome.bookmarks.move(id, { parentId, index });
  }

  async remove(id: string): Promise<void> {
    return chrome.bookmarks.remove(id);
  }

  onCreated(callback: (id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => void): void {
    chrome.bookmarks.onCreated.addListener(callback);
  }

  onRemoved(
    callback: (id: string, removeInfo: chrome.bookmarks.BookmarkRemoveInfo) => void,
  ): void {
    chrome.bookmarks.onRemoved.addListener(callback);
  }

  onChanged(
    callback: (id: string, changeInfo: chrome.bookmarks.BookmarkChangeInfo) => void,
  ): void {
    chrome.bookmarks.onChanged.addListener(callback);
  }

  onMoved(callback: (id: string, moveInfo: chrome.bookmarks.BookmarkMoveInfo) => void): void {
    chrome.bookmarks.onMoved.addListener(callback);
  }

  onImportEnded(callback: () => void): void {
    chrome.bookmarks.onImportEnded.addListener(callback);
  }
}
