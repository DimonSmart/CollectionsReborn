import '../../styles/options.css';
import { BookmarksService } from '../services/bookmarksService.js';
import { PreviewBatchGenerationService } from '../services/previewBatchGenerationService.js';
import { PreviewCaptureService } from '../services/previewCaptureService.js';
import { PreviewDbService, type PreviewGenerationJob } from '../services/previewDbService.js';
import {
  PREVIEW_SIZE_OPTIONS,
  PreviewSettingsService,
  type PreviewSettings,
  type PreviewSize,
} from '../services/previewSettingsService.js';
import { getUrlDomain } from '../domain/previewUrlRules.js';
import { PREVIEW_CAPTURE_PERMISSION_ORIGINS } from '../domain/previewPermissions.js';

class PreviewSettingsPage {
  private readonly root: HTMLElement;
  private readonly previewDb = new PreviewDbService();
  private readonly settingsService = new PreviewSettingsService();
  private readonly captureService = new PreviewCaptureService(this.previewDb, this.settingsService);
  private readonly batchService = new PreviewBatchGenerationService(
    new BookmarksService(),
    this.previewDb,
    this.settingsService,
    this.captureService,
  );
  private settings: PreviewSettings | null = null;
  private job: PreviewGenerationJob | undefined;
  private message = '';
  private busy = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async init(): Promise<void> {
    const [settings, job] = await Promise.all([
      this.settingsService.load(),
      this.previewDb.getLatestJob(),
    ]);
    this.settings = settings;
    this.job = job;
    await this.render();
  }

  private async render(): Promise<void> {
    if (!this.settings) return;
    const stats = await this.previewDb.getStorageStats();
    const queue = await this.batchService.buildQueue();
    this.root.innerHTML = `
      <main class="options-shell">
        <section class="options-section">
          <header class="options-header">
            <div>
              <h1>Previews</h1>
              <p>Local thumbnails for bookmark rows and folder composites.</p>
            </div>
          </header>

          ${this.message ? `<div class="message">${escapeHtml(this.message)}</div>` : ''}

          <div class="settings-grid">
            ${checkbox('enabled', 'Enable previews', this.settings.enabled)}
            ${checkbox('autoGenerateForNewFavorites', 'Generate preview when adding current page', this.settings.autoGenerateForNewFavorites)}
            ${checkbox('autoGenerateWhenOpened', 'Generate missing preview when opening favorite', this.settings.autoGenerateWhenOpened)}
            ${checkbox('showFaviconOverlay', 'Show site icon on preview image', this.settings.showFaviconOverlay)}
          </div>

          <div class="number-grid">
            ${previewSizeField(this.settings.previewSize)}
            ${numberField('imageQuality', 'Image quality', this.settings.imageQuality, '0.1', '1', '0.05')}
            ${numberField('maxStorageMb', 'Storage limit MB', this.settings.maxStorageMb)}
          </div>

          <div class="actions-row">
            <button class="btn btn--primary" data-action="generate" ${this.busy ? 'disabled' : ''}>Generate missing previews</button>
            <button class="btn btn--secondary" data-action="stop">Stop</button>
            <button class="btn btn--danger" data-action="remove-all">Remove all previews</button>
            <button class="btn btn--secondary" data-action="clear-failed">Clear failed statuses</button>
          </div>

          <div class="stats-grid">
            <div><span>Total favorites</span><strong>${this.job?.total ?? queue.length}</strong></div>
            <div><span>Need previews</span><strong>${queue.length}</strong></div>
            <div><span>Processed</span><strong>${this.job ? `${this.job.processed} / ${this.job.total}` : '0 / 0'}</strong></div>
            <div><span>Generated</span><strong>${this.job?.generated ?? 0}</strong></div>
            <div><span>Failed</span><strong>${this.job?.failed ?? stats.errorCount}</strong></div>
            <div><span>Skipped</span><strong>${this.job?.skipped ?? 0}</strong></div>
            <div><span>Pending</span><strong>${this.job?.pending ?? queue.length}</strong></div>
            <div><span>Storage used</span><strong>${formatBytes(stats.totalBytes)}</strong></div>
            <div><span>Average preview size</span><strong>${formatBytes(stats.averageBytes)}</strong></div>
          </div>

          <section class="current-box">
            <h2>Current</h2>
            <p>${escapeHtml(this.job?.currentTitle ?? 'No item running')}</p>
            <span>${escapeHtml(this.job?.currentUrl ?? this.job?.status ?? 'idle')}</span>
          </section>

          <section>
            <h2>Last generated</h2>
            <div class="recent-list">
              ${await this.renderRecent(this.job?.recentGenerated ?? [])}
            </div>
          </section>
        </section>
      </main>
    `;
    this.attachEvents();
  }

  private attachEvents(): void {
    this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]').forEach((input) => {
      input.addEventListener('change', () => void this.updateSetting(input));
    });

    this.root.querySelector<HTMLButtonElement>('[data-action="generate"]')?.addEventListener('click', () => {
      void this.startGeneration();
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="stop"]')?.addEventListener('click', () => {
      void this.batchService.stop();
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="remove-all"]')?.addEventListener('click', async () => {
      await this.previewDb.removeAllPreviews();
      this.message = 'All previews removed.';
      await this.render();
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="clear-failed"]')?.addEventListener('click', async () => {
      await this.previewDb.clearFailedStatuses();
      this.message = 'Failed statuses cleared.';
      await this.render();
    });
  }

  private async updateSetting(input: HTMLInputElement | HTMLSelectElement): Promise<void> {
    if (!this.settings) return;
    const key = input.dataset.setting as keyof PreviewSettings;
    const value = input instanceof HTMLSelectElement
      ? input.value
      : input.type === 'checkbox'
        ? input.checked
        : Number(input.value);
    this.settings = await this.settingsService.patch({ [key]: value } as Partial<PreviewSettings>);
    await this.render();
  }

  private async startGeneration(): Promise<void> {
    const granted = await chrome.permissions.contains({
      origins: [...PREVIEW_CAPTURE_PERMISSION_ORIGINS],
    });
    if (!granted) {
      this.message = 'Preview generation needs all-sites access. Reload the updated extension and try again.';
      await this.render();
      return;
    }

    this.busy = true;
    this.message = '';
    await this.render();
    this.job = await this.batchService.start((job) => {
      this.job = job;
      void this.render();
    });
    this.busy = false;
    await this.render();
  }

  private async renderRecent(recent: PreviewGenerationJob['recentGenerated']): Promise<string> {
    if (recent.length === 0) return '<p class="empty-recent">No generated previews yet.</p>';
    const records = await this.previewDb.getMany(recent.map((item) => item.previewKey));
    const byKey = new Map(records.map((record) => [record.key, record]));
    return recent.map((item) => {
      const record = byKey.get(item.previewKey);
      const src = record?.blob ? URL.createObjectURL(record.blob) : '';
      return `
        <article class="recent-item">
          ${src ? `<img src="${src}" alt="" />` : '<div class="recent-placeholder"></div>'}
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(getUrlDomain(item.url))}</span>
            <small>${formatBytes(item.byteSize)} · ${new Date(item.generatedAt).toLocaleString()}</small>
          </div>
        </article>
      `;
    }).join('');
  }
}

function checkbox(key: keyof PreviewSettings, label: string, checked: boolean): string {
  return `
    <label class="check-row">
      <input type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''} />
      <span>${label}</span>
    </label>
  `;
}

function numberField(
  key: keyof PreviewSettings,
  label: string,
  value: number,
  min = '1',
  max = '',
  step = '1',
): string {
  return `
    <label class="field-row">
      <span>${label}</span>
      <input type="number" data-setting="${key}" value="${value}" min="${min}" ${max ? `max="${max}"` : ''} step="${step}" />
    </label>
  `;
}

function previewSizeField(value: PreviewSize): string {
  return `
    <label class="field-row">
      <span>Preview size</span>
      <select data-setting="previewSize">
        ${(Object.entries(PREVIEW_SIZE_OPTIONS) as Array<[PreviewSize, typeof PREVIEW_SIZE_OPTIONS[PreviewSize]]>)
          .map(([key, option]) => `<option value="${key}" ${key === value ? 'selected' : ''}>${option.label}</option>`)
          .join('')}
      </select>
    </label>
  `;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const root = document.getElementById('app');
if (root) {
  void new PreviewSettingsPage(root).init();
}
