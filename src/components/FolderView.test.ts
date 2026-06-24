import { describe, expect, it } from 'vitest';
import { getFolderDragIntent, isInsideFolderDropZone } from './FolderView.js';
import { PREVIEW_SIZE_OPTIONS } from '../services/previewSettingsService.js';

describe('getFolderDragIntent', () => {
  it('uses the center of a folder row for moving into the folder', () => {
    expect(getFolderDragIntent(125, 100, 100)).toBe('move-into-folder');
    expect(getFolderDragIntent(150, 100, 100)).toBe('move-into-folder');
    expect(getFolderDragIntent(175, 100, 100)).toBe('move-into-folder');
  });

  it('uses the top and bottom edge zones for explicit reordering', () => {
    expect(getFolderDragIntent(117.9, 100, 100)).toBe('reorder-before');
    expect(getFolderDragIntent(182.1, 100, 100)).toBe('reorder-after');
  });

  it('blocks buffer zones between reorder edges and the folder center', () => {
    expect(getFolderDragIntent(118, 100, 100)).toBe('block');
    expect(getFolderDragIntent(124.9, 100, 100)).toBe('block');
    expect(getFolderDragIntent(175.1, 100, 100)).toBe('block');
    expect(getFolderDragIntent(182, 100, 100)).toBe('block');
  });

  it('rejects an invalid row rectangle', () => {
    expect(getFolderDragIntent(100, 100, 0)).toBe('block');
    expect(getFolderDragIntent(100, 100, -1)).toBe('block');
    expect(getFolderDragIntent(Number.NaN, 100, 100)).toBe('block');
    expect(getFolderDragIntent(100, Number.NaN, 100)).toBe('block');
    expect(getFolderDragIntent(100, 100, Number.NaN)).toBe('block');
  });

  it('uses the same relative intent zones for every preview size', () => {
    for (const option of Object.values(PREVIEW_SIZE_OPTIONS)) {
      expect(getFolderDragIntent(option.rowHeight * 0.17, 0, option.rowHeight)).toBe('reorder-before');
      expect(getFolderDragIntent(option.rowHeight * 0.2, 0, option.rowHeight)).toBe('block');
      expect(getFolderDragIntent(option.rowHeight * 0.5, 0, option.rowHeight)).toBe('move-into-folder');
      expect(getFolderDragIntent(option.rowHeight * 0.8, 0, option.rowHeight)).toBe('block');
      expect(getFolderDragIntent(option.rowHeight * 0.83, 0, option.rowHeight)).toBe('reorder-after');
    }
  });
});

describe('isInsideFolderDropZone', () => {
  it('only treats the center zone as a folder drop target', () => {
    expect(isInsideFolderDropZone(124.9, 100, 100)).toBe(false);
    expect(isInsideFolderDropZone(125, 100, 100)).toBe(true);
    expect(isInsideFolderDropZone(175, 100, 100)).toBe(true);
    expect(isInsideFolderDropZone(175.1, 100, 100)).toBe(false);
  });
});
