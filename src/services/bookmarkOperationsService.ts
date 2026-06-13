import type { BookmarksService } from './bookmarksService.js';
import type { BookmarkEntryViewModel, MoveToResult, SortAction } from '../types.js';
import { calculateSortedOrder } from '../domain/bookmarkSort.js';

export class BookmarkOperationsService {
  constructor(private readonly bookmarksService: BookmarksService) {}

  async renameFolder(id: string, newName: string): Promise<void> {
    await this.bookmarksService.updateTitle(id, newName);
  }

  async editLink(id: string, title: string, url: string): Promise<void> {
    await this.bookmarksService.updateBookmark(id, { title, url });
  }

  async deleteItem(item: BookmarkEntryViewModel): Promise<void> {
    if (item.type === 'folder') {
      await this.bookmarksService.removeFolder(item.id);
    } else {
      await this.bookmarksService.remove(item.id);
    }
  }

  async moveItemToFolder(itemId: string, result: MoveToResult): Promise<void> {
    const { folderId, placement } = result;
    if (placement === 'beginning') {
      await this.bookmarksService.move(itemId, folderId, 0);
    } else {
      const children = await this.bookmarksService.getChildren(folderId);
      await this.bookmarksService.move(itemId, folderId, children.length);
    }
  }

  async reorderItemInFolder(itemId: string, folderId: string, newIndex: number): Promise<void> {
    await this.bookmarksService.move(itemId, folderId, newIndex);
  }

  async sortFolder(
    folderId: string,
    entries: BookmarkEntryViewModel[],
    action: SortAction,
  ): Promise<void> {
    const sorted = calculateSortedOrder(entries, action);
    for (let i = 0; i < sorted.length; i++) {
      await this.bookmarksService.move(sorted[i].id, folderId, i);
    }
  }
}
