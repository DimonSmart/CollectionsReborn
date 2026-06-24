import { describe, expect, it } from 'vitest';
import { isInsideFolderDropZone } from './FolderView.js';
import { PREVIEW_SIZE_OPTIONS } from '../services/previewSettingsService.js';

describe('isInsideFolderDropZone', () => {
  it('uses the center of a folder row for moving into the folder', () => {
    expect(isInsideFolderDropZone(110, 100, 100)).toBe(true);
    expect(isInsideFolderDropZone(150, 100, 100)).toBe(true);
    expect(isInsideFolderDropZone(190, 100, 100)).toBe(true);
  });

  it('leaves the row edges available for sorting before and after the folder', () => {
    expect(isInsideFolderDropZone(109, 100, 100)).toBe(false);
    expect(isInsideFolderDropZone(191, 100, 100)).toBe(false);
  });

  it('rejects an invalid row rectangle', () => {
    expect(isInsideFolderDropZone(100, 100, 0)).toBe(false);
  });

  it('uses the same relative folder drop zone for every preview size', () => {
    for (const option of Object.values(PREVIEW_SIZE_OPTIONS)) {
      expect(isInsideFolderDropZone(option.rowHeight * 0.1, 0, option.rowHeight)).toBe(true);
      expect(isInsideFolderDropZone(option.rowHeight * 0.5, 0, option.rowHeight)).toBe(true);
      expect(isInsideFolderDropZone(option.rowHeight * 0.9, 0, option.rowHeight)).toBe(true);
      expect(isInsideFolderDropZone((option.rowHeight * 0.1) - 0.1, 0, option.rowHeight)).toBe(false);
      expect(isInsideFolderDropZone((option.rowHeight * 0.9) + 0.1, 0, option.rowHeight)).toBe(false);
    }
  });
});
