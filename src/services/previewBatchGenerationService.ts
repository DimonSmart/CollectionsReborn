import { buildMissingPreviewQueue } from '../domain/previewQueue.js';
import type {
  PreviewGenerationJob,
  PreviewQueueItem,
  PreviewRecord,
  RecentPreviewInfo,
} from './previewDbService.js';
import { PreviewDbService } from './previewDbService.js';
import { PreviewSettingsService } from './previewSettingsService.js';
import { BookmarksService } from './bookmarksService.js';
import { PreviewCaptureService } from './previewCaptureService.js';

const NAVIGATION_TIMEOUT_MS = 15_000;
const SETTLE_DELAY_MS = 500;
const CAPTURE_INTERVAL_MS = 700;

export class PreviewBatchGenerationService {
  private activeJobId: string | null = null;
  private generationWindowId: number | null = null;
  private lastCaptureAt = 0;
  private abortController: AbortController | null = null;

  constructor(
    private readonly bookmarksService: BookmarksService,
    private readonly previewDb: PreviewDbService,
    private readonly settingsService: PreviewSettingsService,
    private readonly captureService: PreviewCaptureService,
  ) {}

  async buildQueue(): Promise<PreviewQueueItem[]> {
    const [tree, settings, records] = await Promise.all([
      this.bookmarksService.getTree(),
      this.settingsService.load(),
      this.previewDb.getAllPreviews(),
    ]);
    return buildMissingPreviewQueue(tree, records, settings);
  }

  async start(onUpdate?: (job: PreviewGenerationJob) => void): Promise<PreviewGenerationJob> {
    this.abortController = new AbortController();
    const queue = await this.buildQueue();
    const now = Date.now();
    const job: PreviewGenerationJob = {
      id: `preview-job-${now}`,
      status: 'running',
      createdAt: now,
      startedAt: now,
      total: queue.length,
      processed: 0,
      generated: 0,
      failed: 0,
      skipped: 0,
      pending: queue.length,
      queue,
      recentGenerated: [],
    };

    this.activeJobId = job.id;
    await this.previewDb.saveJob(job);
    onUpdate?.(job);

    try {
      if (queue.length > 0) {
        const win = await chrome.windows.create({
          url: 'about:blank',
          type: 'popup',
          width: 800,
          height: 600,
          focused: true,
        });
        this.generationWindowId = win.id ?? null;
      }

      await this.runQueue(job, onUpdate);
    } catch (err) {
      job.status = 'failed';
      job.finishedAt = Date.now();
      job.errorMessage = String(err);
      await this.previewDb.saveJob(job);
      onUpdate?.(job);
    } finally {
      await this.closeGenerationWindow();
      this.activeJobId = null;
      this.abortController = null;
    }

    return job;
  }

  async stop(): Promise<void> {
    this.abortController?.abort();
    if (!this.activeJobId) return;
    const job = await this.previewDb.getJob(this.activeJobId);
    if (!job) return;
    job.status = 'stopping';
    await this.previewDb.saveJob(job);
    await this.closeGenerationWindow();
  }

  private async runQueue(
    job: PreviewGenerationJob,
    onUpdate?: (job: PreviewGenerationJob) => void,
  ): Promise<void> {
    for (const item of job.queue) {
      const latest = await this.previewDb.getJob(job.id);
      if (latest?.status === 'stopping') {
        job.status = 'stopped';
        job.finishedAt = Date.now();
        await this.previewDb.saveJob(job);
        onUpdate?.(job);
        return;
      }

      item.status = 'running';
      job.currentBookmarkId = item.bookmarkId;
      job.currentTitle = item.title;
      job.currentUrl = item.url;
      await this.saveProgress(job, onUpdate);

      try {
        this.throwIfStopped();
        const tab = await this.openInGenerationWindow(item.url);
        await waitForTabComplete(tab.id!, NAVIGATION_TIMEOUT_MS, this.abortController?.signal);
        this.throwIfStopped();
        await delay(SETTLE_DELAY_MS, this.abortController?.signal);
        this.throwIfStopped();
        await this.waitForCaptureInterval();
        this.throwIfStopped();
        const result = await this.captureService.captureVisibleTabInWindow({
          bookmarkId: item.bookmarkId,
          title: item.title,
          url: item.url,
          windowId: this.generationWindowId!,
        });

        if (result.ok) {
          item.status = 'generated';
          job.generated += 1;
          job.recentGenerated.unshift({
            bookmarkId: item.bookmarkId,
            title: item.title,
            url: item.url,
            previewKey: result.previewKey,
            generatedAt: Date.now(),
            byteSize: result.byteSize ?? 0,
          });
          const settings = await this.settingsService.load();
          job.recentGenerated = job.recentGenerated.slice(0, settings.recentPreviewCount);
        } else {
          item.status = 'failed';
          item.errorCode = result.errorCode;
          job.failed += 1;
        }
      } catch (err) {
        if (isAbortError(err)) {
          item.status = 'pending';
          job.status = 'stopped';
          job.finishedAt = Date.now();
          await this.previewDb.saveJob(job);
          onUpdate?.(job);
          return;
        }
        item.status = 'failed';
        item.errorCode = String(err).includes('timeout') ? 'navigation-timeout' : 'unknown';
        job.failed += 1;
      }

      job.processed += 1;
      job.pending = Math.max(0, job.total - job.processed);
      await this.saveProgress(job, onUpdate);
    }

    await this.rebuildFolderComposites();
    job.status = 'completed';
    job.finishedAt = Date.now();
    job.currentBookmarkId = undefined;
    job.currentTitle = undefined;
    job.currentUrl = undefined;
    await this.previewDb.saveJob(job);
    onUpdate?.(job);
  }

  private async openInGenerationWindow(url: string): Promise<chrome.tabs.Tab> {
    if (!this.generationWindowId) throw new Error('Generation window was not created');
    const tabs = await chrome.tabs.query({ windowId: this.generationWindowId });
    const tabId = tabs[0]?.id;
    if (tabId) {
      return chrome.tabs.update(tabId, { url, active: true });
    }
    return chrome.tabs.create({ windowId: this.generationWindowId, url, active: true });
  }

  private async waitForCaptureInterval(): Promise<void> {
    const elapsed = Date.now() - this.lastCaptureAt;
    if (elapsed < CAPTURE_INTERVAL_MS) {
      await delay(CAPTURE_INTERVAL_MS - elapsed, this.abortController?.signal);
    }
    this.lastCaptureAt = Date.now();
  }

  private throwIfStopped(): void {
    if (this.abortController?.signal.aborted) {
      throw new DOMException('Preview generation stopped', 'AbortError');
    }
  }

  private async rebuildFolderComposites(): Promise<void> {
    const [tree, records] = await Promise.all([
      this.bookmarksService.getTree(),
      this.previewDb.getAllPreviews(),
    ]);
    const recordsByBookmark = new Map(records.map((record) => [record.bookmarkId, record]));
    const visit = async (node: chrome.bookmarks.BookmarkTreeNode): Promise<void> => {
      if (!node.url) {
        const childRecords = (node.children ?? [])
          .filter((child) => !!child.url)
          .map((child) => recordsByBookmark.get(child.id))
          .filter((record): record is PreviewRecord => !!record && record.status === 'ok' && !!record.blob)
          .slice(0, 4);
        if (childRecords.length > 0) {
          await this.captureService.createFolderComposite({ folderId: node.id, childRecords });
        }
        for (const child of node.children ?? []) await visit(child);
      }
    };
    for (const node of tree) await visit(node);
  }

  private async saveProgress(
    job: PreviewGenerationJob,
    onUpdate?: (job: PreviewGenerationJob) => void,
  ): Promise<void> {
    await this.previewDb.saveJob(job);
    onUpdate?.({ ...job, queue: [...job.queue], recentGenerated: [...job.recentGenerated] });
  }

  private async closeGenerationWindow(): Promise<void> {
    if (!this.generationWindowId) return;
    try {
      await chrome.windows.remove(this.generationWindowId);
    } catch {
      // Window may already be closed by the user.
    } finally {
      this.generationWindowId = null;
    }
  }
}

async function waitForTabComplete(
  tabId: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  const initialTab = await chrome.tabs.get(tabId);
  if (initialTab.status === 'complete') return;

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('navigation-timeout'));
    }, timeoutMs);

    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      cleanup();
      resolve();
    };

    const removedListener = (removedTabId: number) => {
      if (removedTabId !== tabId) return;
      cleanup();
      reject(new Error('tab-closed'));
    };

    const abortListener = () => {
      cleanup();
      reject(new DOMException('Preview generation stopped', 'AbortError'));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.onRemoved.removeListener(removedListener);
      signal?.removeEventListener('abort', abortListener);
    };

    if (signal?.aborted) {
      cleanup();
      reject(new DOMException('Preview generation stopped', 'AbortError'));
      return;
    }

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.onRemoved.addListener(removedListener);
    signal?.addEventListener('abort', abortListener, { once: true });
  });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener('abort', abortListener);
      resolve();
    }, ms);
    const abortListener = () => {
      window.clearTimeout(timeout);
      reject(new DOMException('Preview generation stopped', 'AbortError'));
    };
    if (signal?.aborted) {
      window.clearTimeout(timeout);
      reject(new DOMException('Preview generation stopped', 'AbortError'));
      return;
    }
    signal?.addEventListener('abort', abortListener, { once: true });
  });
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
