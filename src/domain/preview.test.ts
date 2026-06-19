import { describe, expect, it } from 'vitest';
import { getFolderPreviewKey, getLinkPreviewKey } from './previewKeys.js';
import { validatePreviewUrl } from './previewUrlRules.js';
import { calculateFolderChildrenHash } from './folderPreviewComposite.js';
describe('preview URL validation', () => {
  it('allows http and https URLs', () => {
    expect(validatePreviewUrl('http://example.com').ok).toBe(true);
    expect(validatePreviewUrl('https://example.com').ok).toBe(true);
  });

  it('rejects unsupported browser and local URL schemes', () => {
    expect(validatePreviewUrl('chrome://settings').ok).toBe(false);
    expect(validatePreviewUrl('edge://settings').ok).toBe(false);
    expect(validatePreviewUrl('about:blank').ok).toBe(false);
    expect(validatePreviewUrl('file:///C:/test.html').ok).toBe(false);
  });
});

describe('preview keys', () => {
  it('creates stable link and folder keys', () => {
    expect(getLinkPreviewKey('10')).toBe('link:10');
    expect(getFolderPreviewKey('20')).toBe('folder:20');
  });
});

describe('folder children hash', () => {
  it('changes when child preview updatedAt changes', () => {
    const first = calculateFolderChildrenHash('f1', [
      { id: '1', previewKey: 'link:1', updatedAt: 1 },
    ]);
    const second = calculateFolderChildrenHash('f1', [
      { id: '1', previewKey: 'link:1', updatedAt: 2 },
    ]);
    expect(first).not.toBe(second);
  });

  it('changes when child preview list changes', () => {
    const first = calculateFolderChildrenHash('f1', [
      { id: '1', previewKey: 'link:1', updatedAt: 1 },
    ]);
    const second = calculateFolderChildrenHash('f1', [
      { id: '1', previewKey: 'link:1', updatedAt: 1 },
      { id: '2', previewKey: 'link:2', updatedAt: 1 },
    ]);
    expect(first).not.toBe(second);
  });
});
