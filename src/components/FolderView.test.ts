import { describe, expect, it } from 'vitest';
import { isInsideFolderDropZone } from './FolderView.js';

describe('isInsideFolderDropZone', () => {
  it('uses the middle half of a folder row for moving into the folder', () => {
    expect(isInsideFolderDropZone(125, 100, 100)).toBe(true);
    expect(isInsideFolderDropZone(150, 100, 100)).toBe(true);
    expect(isInsideFolderDropZone(175, 100, 100)).toBe(true);
  });

  it('leaves the edges available for before and after sorting', () => {
    expect(isInsideFolderDropZone(124, 100, 100)).toBe(false);
    expect(isInsideFolderDropZone(176, 100, 100)).toBe(false);
  });

  it('rejects an invalid row rectangle', () => {
    expect(isInsideFolderDropZone(100, 100, 0)).toBe(false);
  });
});
