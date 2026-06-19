import { describe, expect, it, vi } from 'vitest';
import type { BookmarksService } from '../../services/bookmarksService.js';
import { importBingSavesPreview } from './bingSavesImporter.js';

describe('importBingSavesPreview', () => {
  it('creates one folder per collection and places its links inside', async () => {
    const createFolder = vi.fn()
      .mockResolvedValueOnce({ id: 'created-folder-1' })
      .mockResolvedValueOnce({ id: 'created-folder-2' });
    const createBookmark = vi.fn().mockResolvedValue({ id: 'created-bookmark' });
    const bookmarks = { createFolder, createBookmark } as unknown as BookmarksService;

    const result = await importBingSavesPreview({
      collections: [
        {
          sourceId: 'source-1',
          title: 'First',
          items: [{ sourceId: 'item-1', title: 'One', url: 'https://one.example/', type: 'web' }],
        },
        {
          sourceId: 'source-2',
          title: 'Second',
          items: [{ sourceId: 'item-2', title: 'Two', url: 'https://two.example/', type: 'web' }],
        },
      ],
      sourceItemCount: 2,
      importableItemCount: 2,
      skippedItemCount: 0,
    }, 'destination', bookmarks);

    expect(createFolder).toHaveBeenNthCalledWith(1, 'destination', 'First');
    expect(createFolder).toHaveBeenNthCalledWith(2, 'destination', 'Second');
    expect(createBookmark).toHaveBeenNthCalledWith(1, 'created-folder-1', 'One', 'https://one.example/');
    expect(createBookmark).toHaveBeenNthCalledWith(2, 'created-folder-2', 'Two', 'https://two.example/');
    expect(result).toEqual({ createdCollections: 2, createdItems: 2 });
  });
});
