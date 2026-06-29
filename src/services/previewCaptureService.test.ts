import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewCaptureService } from './previewCaptureService.js';
import type { PreviewDbService } from './previewDbService.js';
import type { PreviewSettings, PreviewSettingsService } from './previewSettingsService.js';

vi.mock('./previewImageService.js', () => ({
  dataUrlToBlob: vi.fn(async () => new Blob(['source'])),
  resizePreviewImage: vi.fn(async () => ({
    blob: new Blob(['x'.repeat(2048)], { type: 'image/webp' }),
    mimeType: 'image/webp',
  })),
  composePreviewCollage: vi.fn(),
}));

describe('PreviewCaptureService tab targeting', () => {
  let previewDb: Pick<PreviewDbService, 'saveOkPreview' | 'saveError' | 'cleanupToLimit'>;
  let settingsService: Pick<PreviewSettingsService, 'load'>;
  let captureVisibleTab: ReturnType<typeof vi.fn<[], Promise<string>>>;
  let query: ReturnType<typeof vi.fn<[], Promise<Array<{ id: number; windowId: number; active: boolean }>>>>;

  beforeEach(() => {
    previewDb = {
      saveOkPreview: vi.fn(async (input) => ({
        ...input,
        status: 'ok' as const,
        byteSize: input.blob.size,
        attemptCount: 1,
      })),
      saveError: vi.fn(async (input) => ({
        ...input,
        status: 'error' as const,
        attemptCount: 1,
      })),
      cleanupToLimit: vi.fn(async () => undefined),
    };
    settingsService = {
      load: vi.fn(async (): Promise<PreviewSettings> => ({
        enabled: true,
        previewSize: 'medium',
        imageFormat: 'image/webp',
        imageQuality: 0.7,
        maxStorageMb: 120,
        excludedDomains: [],
        skipPrivateHosts: false,
      })),
    };
    captureVisibleTab = vi.fn(async () => 'data:image/png;base64,AAAA');
    query = vi.fn(async () => [{ id: 2, windowId: 10, active: true }]);

    vi.stubGlobal('chrome', {
      tabs: {
        query,
        captureVisibleTab,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not save a preview for an expected tab that is no longer active', async () => {
    const service = createService(previewDb, settingsService);

    const result = await service.captureVisibleTabInWindow({
      bookmarkId: 'a',
      title: 'A',
      url: 'https://example.com/a',
      windowId: 10,
      tabId: 1,
    });

    expect(result).toMatchObject({ ok: false, previewKey: 'link:a', errorCode: 'tab-not-active' });
    expect(query).toHaveBeenCalledWith({ active: true, windowId: 10 });
    expect(captureVisibleTab).not.toHaveBeenCalled();
    expect(previewDb.saveOkPreview).not.toHaveBeenCalled();
    expect(previewDb.saveError).not.toHaveBeenCalled();
  });

  it('saves a preview when the active tab matches the expected tab id', async () => {
    const service = createService(previewDb, settingsService);

    const result = await service.captureVisibleTabInWindow({
      bookmarkId: 'b',
      title: 'B',
      url: 'https://example.com/b',
      windowId: 10,
      tabId: 2,
    });

    expect(result).toMatchObject({ ok: true, previewKey: 'link:b', byteSize: 2048 });
    expect(captureVisibleTab).toHaveBeenCalledWith(10, { format: 'png', quality: 70 });
    expect(previewDb.saveOkPreview).toHaveBeenCalledWith(expect.objectContaining({
      key: 'link:b',
      bookmarkId: 'b',
      kind: 'link',
      sourceUrl: 'https://example.com/b',
      sourceTitle: 'B',
    }));
  });

  it('does not let parallel captures save the screenshot from the currently active different tab', async () => {
    const service = createService(previewDb, settingsService);

    const [first, second] = await Promise.all([
      service.captureVisibleTabInWindow({
        bookmarkId: 'a',
        title: 'A',
        url: 'https://example.com/a',
        windowId: 10,
        tabId: 1,
      }),
      service.captureVisibleTabInWindow({
        bookmarkId: 'b',
        title: 'B',
        url: 'https://example.com/b',
        windowId: 10,
        tabId: 2,
      }),
    ]);

    expect(first).toMatchObject({ ok: false, previewKey: 'link:a', errorCode: 'tab-not-active' });
    expect(second).toMatchObject({ ok: true, previewKey: 'link:b' });
    expect(captureVisibleTab).toHaveBeenCalledTimes(1);
    expect(previewDb.saveOkPreview).toHaveBeenCalledTimes(1);
    expect(previewDb.saveOkPreview).toHaveBeenCalledWith(expect.objectContaining({ bookmarkId: 'b' }));
  });
});

function createService(
  previewDb: Pick<PreviewDbService, 'saveOkPreview' | 'saveError' | 'cleanupToLimit'>,
  settingsService: Pick<PreviewSettingsService, 'load'>,
): PreviewCaptureService {
  return new PreviewCaptureService(
    previewDb as PreviewDbService,
    settingsService as PreviewSettingsService,
  );
}
