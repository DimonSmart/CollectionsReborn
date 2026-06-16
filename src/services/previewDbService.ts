import type { PreviewKey } from '../domain/previewKeys.js';

export type PreviewStatus = 'none' | 'pending' | 'ok' | 'error' | 'skipped';

export type PreviewErrorCode =
  | 'unsupported-url'
  | 'permission-denied'
  | 'navigation-timeout'
  | 'capture-failed'
  | 'empty-screenshot'
  | 'quota-exceeded'
  | 'tab-closed'
  | 'image-processing-failed'
  | 'unknown';

export interface PreviewRecord {
  key: string;
  bookmarkId: string;
  kind: 'link' | 'folder';
  status: PreviewStatus;
  blob?: Blob;
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
  width?: number;
  height?: number;
  byteSize?: number;
  sourceUrl?: string;
  sourceTitle?: string;
  createdAt?: number;
  updatedAt?: number;
  lastAccessedAt?: number;
  failedAt?: number;
  errorCode?: PreviewErrorCode;
  errorMessage?: string;
  attemptCount: number;
  childrenHash?: string;
  sourcePreviewKeys?: string[];
}

export interface PreviewQueueItem {
  bookmarkId: string;
  title: string;
  url: string;
  status: 'pending' | 'running' | 'generated' | 'failed' | 'skipped';
  errorCode?: PreviewErrorCode;
}

export interface RecentPreviewInfo {
  bookmarkId: string;
  title: string;
  url: string;
  previewKey: string;
  generatedAt: number;
  byteSize: number;
}

export interface PreviewGenerationJob {
  id: string;
  status: 'idle' | 'running' | 'stopping' | 'stopped' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  total: number;
  processed: number;
  generated: number;
  failed: number;
  skipped: number;
  pending: number;
  currentBookmarkId?: string;
  currentUrl?: string;
  currentTitle?: string;
  queue: PreviewQueueItem[];
  recentGenerated: RecentPreviewInfo[];
  errorMessage?: string;
}

export interface PreviewStorageStats {
  totalBytes: number;
  totalCount: number;
  okCount: number;
  errorCount: number;
  averageBytes: number;
}

const DB_NAME = 'collections_reborn_previews';
const DB_VERSION = 1;
const PREVIEWS_STORE = 'previews';
const JOBS_STORE = 'preview_generation_jobs';

export class PreviewDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async get(key: PreviewKey | string): Promise<PreviewRecord | undefined> {
    const record = await this.request<PreviewRecord | undefined>(
      PREVIEWS_STORE,
      'readonly',
      (store) => store.get(key),
    );
    if (record?.blob) {
      record.lastAccessedAt = Date.now();
      await this.put(record);
    }
    return record;
  }

  async getMany(keys: string[]): Promise<PreviewRecord[]> {
    const records = await Promise.all(keys.map((key) => this.get(key)));
    return records.filter((record): record is PreviewRecord => !!record);
  }

  async getAllPreviews(): Promise<PreviewRecord[]> {
    return this.request<PreviewRecord[]>(PREVIEWS_STORE, 'readonly', (store) => store.getAll());
  }

  async put(record: PreviewRecord): Promise<void> {
    await this.request(PREVIEWS_STORE, 'readwrite', (store) => store.put(record));
  }

  async saveOkPreview(input: {
    key: PreviewKey;
    bookmarkId: string;
    kind: 'link' | 'folder';
    blob: Blob;
    mimeType: 'image/webp' | 'image/jpeg' | 'image/png';
    width: number;
    height: number;
    sourceUrl?: string;
    sourceTitle?: string;
    childrenHash?: string;
    sourcePreviewKeys?: string[];
  }): Promise<PreviewRecord> {
    const now = Date.now();
    const existing = await this.get(input.key);
    const record: PreviewRecord = {
      key: input.key,
      bookmarkId: input.bookmarkId,
      kind: input.kind,
      status: 'ok',
      blob: input.blob,
      mimeType: input.mimeType,
      width: input.width,
      height: input.height,
      byteSize: input.blob.size,
      sourceUrl: input.sourceUrl,
      sourceTitle: input.sourceTitle,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastAccessedAt: now,
      attemptCount: (existing?.attemptCount ?? 0) + 1,
      childrenHash: input.childrenHash,
      sourcePreviewKeys: input.sourcePreviewKeys,
    };
    await this.put(record);
    return record;
  }

  async saveError(input: {
    key: PreviewKey;
    bookmarkId: string;
    kind: 'link' | 'folder';
    errorCode: PreviewErrorCode;
    errorMessage?: string;
    sourceUrl?: string;
    sourceTitle?: string;
  }): Promise<PreviewRecord> {
    const now = Date.now();
    const existing = await this.get(input.key);
    const record: PreviewRecord = {
      key: input.key,
      bookmarkId: input.bookmarkId,
      kind: input.kind,
      status: 'error',
      sourceUrl: input.sourceUrl,
      sourceTitle: input.sourceTitle,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      failedAt: now,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      attemptCount: (existing?.attemptCount ?? 0) + 1,
    };
    await this.put(record);
    return record;
  }

  async delete(key: PreviewKey | string): Promise<void> {
    await this.request(PREVIEWS_STORE, 'readwrite', (store) => store.delete(key));
  }

  async deleteForBookmark(id: string): Promise<void> {
    await Promise.all([this.delete(`link:${id}`), this.delete(`folder:${id}`)]);
  }

  async removeAllPreviews(): Promise<void> {
    await this.request(PREVIEWS_STORE, 'readwrite', (store) => store.clear());
  }

  async clearFailedStatuses(): Promise<void> {
    const records = await this.getAllPreviews();
    await Promise.all(records.filter((record) => record.status === 'error').map((record) => this.delete(record.key)));
  }

  async getStorageStats(): Promise<PreviewStorageStats> {
    const records = await this.getAllPreviews();
    const ok = records.filter((record) => record.status === 'ok');
    const totalBytes = ok.reduce((sum, record) => sum + (record.byteSize ?? record.blob?.size ?? 0), 0);
    return {
      totalBytes,
      totalCount: records.length,
      okCount: ok.length,
      errorCount: records.filter((record) => record.status === 'error').length,
      averageBytes: ok.length > 0 ? Math.round(totalBytes / ok.length) : 0,
    };
  }

  async cleanupToLimit(maxBytes: number, keepKey?: string): Promise<void> {
    const records = await this.getAllPreviews();
    let total = records.reduce((sum, record) => sum + (record.byteSize ?? record.blob?.size ?? 0), 0);
    const candidates = records
      .filter((record) => record.status === 'ok' && record.key !== keepKey)
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
        return (a.lastAccessedAt ?? a.updatedAt ?? 0) - (b.lastAccessedAt ?? b.updatedAt ?? 0);
      });

    for (const record of candidates) {
      if (total <= maxBytes) break;
      total -= record.byteSize ?? record.blob?.size ?? 0;
      await this.delete(record.key);
    }
  }

  async saveJob(job: PreviewGenerationJob): Promise<void> {
    await this.request(JOBS_STORE, 'readwrite', (store) => store.put(job));
  }

  async getJob(id: string): Promise<PreviewGenerationJob | undefined> {
    return this.request<PreviewGenerationJob | undefined>(JOBS_STORE, 'readonly', (store) => store.get(id));
  }

  async getLatestJob(): Promise<PreviewGenerationJob | undefined> {
    const jobs = await this.request<PreviewGenerationJob[]>(JOBS_STORE, 'readonly', (store) => store.getAll());
    return jobs.sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  private async request<T = unknown>(
    storeName: string,
    mode: IDBTransactionMode,
    build: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = build(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  private async open(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PREVIEWS_STORE)) {
          const previews = db.createObjectStore(PREVIEWS_STORE, { keyPath: 'key' });
          previews.createIndex('status', 'status');
          previews.createIndex('kind', 'kind');
          previews.createIndex('updatedAt', 'updatedAt');
          previews.createIndex('lastAccessedAt', 'lastAccessedAt');
          previews.createIndex('failedAt', 'failedAt');
        }
        if (!db.objectStoreNames.contains(JOBS_STORE)) {
          db.createObjectStore(JOBS_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }
}
