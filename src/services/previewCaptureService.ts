import { getFolderPreviewKey, getLinkPreviewKey } from '../domain/previewKeys.js';
import { calculateFolderChildrenHash } from '../domain/folderPreviewComposite.js';
import { validatePreviewUrl } from '../domain/previewUrlRules.js';
import type { PreviewErrorCode, PreviewRecord } from './previewDbService.js';
import { PreviewDbService } from './previewDbService.js';
import {
  PreviewSettingsService,
  STORED_THUMBNAIL_HEIGHT,
  STORED_THUMBNAIL_WIDTH,
} from './previewSettingsService.js';
import { composePreviewCollage, dataUrlToBlob, resizePreviewImage } from './previewImageService.js';

export interface CapturePreviewInput {
  bookmarkId: string;
  title: string;
  url: string;
}

export interface CaptureWindowPreviewInput extends CapturePreviewInput {
  windowId: number;
}

export interface CreateFolderCompositeInput {
  folderId: string;
  childRecords: PreviewRecord[];
}

export interface CapturePreviewResult {
  ok: boolean;
  previewKey: string;
  byteSize?: number;
  errorCode?: PreviewErrorCode;
  errorMessage?: string;
}

export class PreviewCaptureService {
  constructor(
    private readonly previewDb: PreviewDbService,
    private readonly settingsService: PreviewSettingsService,
  ) {}

  async captureCurrentVisibleTabForBookmark(input: CapturePreviewInput): Promise<CapturePreviewResult> {
    return this.captureVisibleTab(input);
  }

  async captureVisibleTabInWindow(input: CaptureWindowPreviewInput): Promise<CapturePreviewResult> {
    return this.captureVisibleTab(input);
  }

  async createFolderComposite(input: CreateFolderCompositeInput): Promise<CapturePreviewResult> {
    const previewKey = getFolderPreviewKey(input.folderId);
    const childRecords = input.childRecords
      .filter((record) => record.status === 'ok' && !!record.blob)
      .slice(0, 4);

    if (childRecords.length === 0) {
      return { ok: false, previewKey, errorCode: 'empty-screenshot' };
    }

    try {
      const settings = await this.settingsService.load();
      const result = await composePreviewCollage({
        blobs: childRecords.map((record) => record.blob!),
        width: STORED_THUMBNAIL_WIDTH,
        height: STORED_THUMBNAIL_HEIGHT,
        preferredType: settings.imageFormat,
        quality: settings.imageQuality,
      });
      const childrenHash = calculateFolderChildrenHash(input.folderId, childRecords.map((record) => ({
        id: record.bookmarkId,
        previewKey: record.key,
        updatedAt: record.updatedAt,
      })));
      const saved = await this.previewDb.saveOkPreview({
        key: previewKey,
        bookmarkId: input.folderId,
        kind: 'folder',
        blob: result.blob,
        mimeType: result.mimeType,
        width: STORED_THUMBNAIL_WIDTH,
        height: STORED_THUMBNAIL_HEIGHT,
        childrenHash,
        sourcePreviewKeys: childRecords.map((record) => record.key),
      });
      await this.previewDb.cleanupToLimit(settings.maxStorageMb * 1024 * 1024, previewKey);
      return { ok: true, previewKey, byteSize: saved.byteSize };
    } catch (err) {
      await this.previewDb.saveError({
        key: previewKey,
        bookmarkId: input.folderId,
        kind: 'folder',
        errorCode: 'image-processing-failed',
        errorMessage: String(err),
      });
      return { ok: false, previewKey, errorCode: 'image-processing-failed', errorMessage: String(err) };
    }
  }

  private async captureVisibleTab(input: CapturePreviewInput & { windowId?: number }): Promise<CapturePreviewResult> {
    const previewKey = getLinkPreviewKey(input.bookmarkId);
    const validation = validatePreviewUrl(input.url);
    if (!validation.ok) {
      await this.previewDb.saveError({
        key: previewKey,
        bookmarkId: input.bookmarkId,
        kind: 'link',
        errorCode: validation.errorCode ?? 'unsupported-url',
        sourceUrl: input.url,
        sourceTitle: input.title,
      });
      return { ok: false, previewKey, errorCode: validation.errorCode };
    }

    try {
      const settings = await this.settingsService.load();
      const captureOptions: chrome.tabs.CaptureVisibleTabOptions = {
        format: settings.imageFormat === 'image/jpeg' ? 'jpeg' : 'png',
        quality: Math.round(settings.imageQuality * 100),
      };
      const dataUrl = input.windowId === undefined
        ? await chrome.tabs.captureVisibleTab(captureOptions)
        : await chrome.tabs.captureVisibleTab(input.windowId, captureOptions);
      const sourceBlob = await dataUrlToBlob(dataUrl);
      const resized = await resizePreviewImage({
        blob: sourceBlob,
        width: STORED_THUMBNAIL_WIDTH,
        height: STORED_THUMBNAIL_HEIGHT,
        preferredType: settings.imageFormat,
        quality: settings.imageQuality,
      });
      if (resized.blob.size <= 1024) {
        throw new Error('Captured thumbnail is empty');
      }
      const saved = await this.previewDb.saveOkPreview({
        key: previewKey,
        bookmarkId: input.bookmarkId,
        kind: 'link',
        blob: resized.blob,
        mimeType: resized.mimeType,
        width: STORED_THUMBNAIL_WIDTH,
        height: STORED_THUMBNAIL_HEIGHT,
        sourceUrl: input.url,
        sourceTitle: input.title,
      });
      await this.previewDb.cleanupToLimit(settings.maxStorageMb * 1024 * 1024, previewKey);
      return { ok: true, previewKey, byteSize: saved.byteSize };
    } catch (err) {
      const errorCode = classifyCaptureError(err);
      await this.previewDb.saveError({
        key: previewKey,
        bookmarkId: input.bookmarkId,
        kind: 'link',
        errorCode,
        errorMessage: String(err),
        sourceUrl: input.url,
        sourceTitle: input.title,
      });
      return { ok: false, previewKey, errorCode, errorMessage: String(err) };
    }
  }
}

function classifyCaptureError(err: unknown): PreviewErrorCode {
  const message = String(err).toLowerCase();
  if (message.includes('permission')) return 'permission-denied';
  if (message.includes('empty')) return 'empty-screenshot';
  if (message.includes('quota')) return 'quota-exceeded';
  if (message.includes('tab')) return 'tab-closed';
  return 'capture-failed';
}
