import { describe, expect, it } from 'vitest';
import {
  getDirectionalFolderDragIntent,
  getFolderDragApproach,
  isInsideFolderDropZone,
} from './FolderView.js';
import { PREVIEW_SIZE_OPTIONS } from '../services/previewSettingsService.js';

describe('getDirectionalFolderDragIntent', () => {
  it('blocks the near edge and allows the far edge when dragging from below', () => {
    expect(getDirectionalFolderDragIntent(183, 100, 100, 'from-below')).toBe('block');
    expect(getDirectionalFolderDragIntent(150, 100, 100, 'from-below')).toBe('move-into-folder');
    expect(getDirectionalFolderDragIntent(117, 100, 100, 'from-below')).toBe('reorder-before');
  });

  it('blocks the near edge and allows the far edge when dragging from above', () => {
    expect(getDirectionalFolderDragIntent(117, 100, 100, 'from-above')).toBe('block');
    expect(getDirectionalFolderDragIntent(150, 100, 100, 'from-above')).toBe('move-into-folder');
    expect(getDirectionalFolderDragIntent(183, 100, 100, 'from-above')).toBe('reorder-after');
  });

  it('allows center recovery but blocks edge reorder for unknown approach', () => {
    expect(getDirectionalFolderDragIntent(117, 100, 100, 'unknown')).toBe('block');
    expect(getDirectionalFolderDragIntent(150, 100, 100, 'unknown')).toBe('move-into-folder');
    expect(getDirectionalFolderDragIntent(183, 100, 100, 'unknown')).toBe('block');
  });

  it('blocks buffer zones between reorder edges and the folder center', () => {
    expect(getDirectionalFolderDragIntent(118, 100, 100, 'from-below')).toBe('block');
    expect(getDirectionalFolderDragIntent(124.9, 100, 100, 'from-below')).toBe('block');
    expect(getDirectionalFolderDragIntent(175.1, 100, 100, 'from-above')).toBe('block');
    expect(getDirectionalFolderDragIntent(182, 100, 100, 'from-above')).toBe('block');
  });

  it('rejects an invalid row rectangle', () => {
    expect(getDirectionalFolderDragIntent(100, 100, 0, 'from-below')).toBe('block');
    expect(getDirectionalFolderDragIntent(100, 100, -1, 'from-below')).toBe('block');
    expect(getDirectionalFolderDragIntent(Number.NaN, 100, 100, 'from-below')).toBe('block');
    expect(getDirectionalFolderDragIntent(100, Number.NaN, 100, 'from-below')).toBe('block');
    expect(getDirectionalFolderDragIntent(100, 100, Number.NaN, 'from-below')).toBe('block');
  });

  it('uses the same relative intent zones for every preview size', () => {
    for (const option of Object.values(PREVIEW_SIZE_OPTIONS)) {
      expect(getDirectionalFolderDragIntent(option.rowHeight * 0.83, 0, option.rowHeight, 'from-below')).toBe('block');
      expect(getDirectionalFolderDragIntent(option.rowHeight * 0.5, 0, option.rowHeight, 'from-below')).toBe('move-into-folder');
      expect(getDirectionalFolderDragIntent(option.rowHeight * 0.17, 0, option.rowHeight, 'from-below')).toBe('reorder-before');

      expect(getDirectionalFolderDragIntent(option.rowHeight * 0.17, 0, option.rowHeight, 'from-above')).toBe('block');
      expect(getDirectionalFolderDragIntent(option.rowHeight * 0.5, 0, option.rowHeight, 'from-above')).toBe('move-into-folder');
      expect(getDirectionalFolderDragIntent(option.rowHeight * 0.83, 0, option.rowHeight, 'from-above')).toBe('reorder-after');
    }
  });
});

describe('getFolderDragApproach', () => {
  it('uses original indexes to detect the drag approach direction', () => {
    expect(getFolderDragApproach(5, 2)).toBe('from-below');
    expect(getFolderDragApproach(2, 5)).toBe('from-above');
    expect(getFolderDragApproach(null, 5)).toBe('unknown');
    expect(getFolderDragApproach(2, null)).toBe('unknown');
    expect(getFolderDragApproach(3, 3)).toBe('unknown');
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
