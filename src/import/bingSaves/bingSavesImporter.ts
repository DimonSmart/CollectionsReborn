import type { BingImportPreview } from './bingSavesParser.js';
import type { BookmarksService } from '../../services/bookmarksService.js';

export interface BingImportResult {
  createdCollections: number;
  createdItems: number;
}

export async function importBingSavesPreview(
  preview: BingImportPreview,
  destinationFolderId: string,
  bookmarks: BookmarksService,
): Promise<BingImportResult> {
  let createdCollections = 0;
  let createdItems = 0;

  for (const collection of preview.collections) {
    const folder = await bookmarks.createFolder(destinationFolderId, collection.title);
    createdCollections += 1;
    for (const item of collection.items) {
      await bookmarks.createBookmark(folder.id, item.title, item.url);
      createdItems += 1;
    }
  }

  return { createdCollections, createdItems };
}
