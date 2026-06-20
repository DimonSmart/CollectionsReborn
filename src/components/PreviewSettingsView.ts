import type { PreviewDbService } from '../services/previewDbService.js';
import {
  PREVIEW_SIZE_OPTIONS,
  type PreviewSettings,
  type PreviewSettingsService,
  type PreviewSize,
} from '../services/previewSettingsService.js';
import type { StorageService } from '../services/storageService.js';

export class PreviewSettingsView {
  private settings: PreviewSettings | null = null;
  private exampleObjectUrl = '';

  constructor(
    private readonly root: HTMLElement,
    private readonly previewDb: PreviewDbService,
    private readonly settingsService: PreviewSettingsService,
    private readonly storageService: StorageService,
    private readonly onClose: () => void,
    private readonly onImport: () => void,
  ) {}

  async init(): Promise<void> {
    this.settings = await this.settingsService.load();
    await this.render();
  }

  private async render(): Promise<void> {
    if (!this.settings) return;
    this.revokeExampleObjectUrl();
    const [stats, storedSettings, records] = await Promise.all([
      this.previewDb.getStorageStats(),
      this.storageService.loadSettings(),
      this.previewDb.getAllPreviews(),
    ]);
    const exampleRecord = records.find((record) => record.kind === 'link' && record.status === 'ok' && record.blob);
    if (exampleRecord?.blob) this.exampleObjectUrl = URL.createObjectURL(exampleRecord.blob);
    const size = PREVIEW_SIZE_OPTIONS[this.settings.previewSize];
    const importStatus = formatImportStatus(
      storedSettings.lastEdgeCollectionsImportResult,
      storedSettings.lastEdgeCollectionsImportAt,
    );

    this.root.innerHTML = `
      <header class="settings-view__header">
        <button class="btn-icon settings-view__back" data-action="close" aria-label="Back to bookmarks" title="Back to bookmarks">
          ${backIcon()}
        </button>
        <div>
          <h1>Settings</h1>
          <p>Previews and data</p>
        </div>
      </header>

      <main class="settings-view">
        <section class="settings-card">
          <div class="settings-card__heading">
            <div>
              <h2>Previews</h2>
            </div>
            <label class="settings-switch">
              <input type="checkbox" data-setting="enabled" ${this.settings.enabled ? 'checked' : ''} />
              <span>Enable previews</span>
            </label>
          </div>

          <fieldset class="preview-size">
            <legend>Size</legend>
            <div class="preview-size__track">
              ${(Object.entries(PREVIEW_SIZE_OPTIONS) as Array<[PreviewSize, typeof PREVIEW_SIZE_OPTIONS[PreviewSize]]>)
                .map(([key, option]) => `
                  <label class="preview-size__option">
                    <input type="radio" name="preview-size" data-setting="previewSize" value="${key}" ${key === this.settings?.previewSize ? 'checked' : ''} />
                    <span class="preview-size__dot" aria-hidden="true"></span>
                    <span>${escapeHtml(option.label.split(' ')[0])}</span>
                  </label>
                `).join('')}
            </div>
          </fieldset>

          <div class="preview-example" aria-label="Preview size example">
            <div class="bookmark-list preview-example__list" data-preview-size="${this.settings.previewSize}" style="--row-preview-width: ${size.width}px; --row-preview-height: ${size.height}px; --bookmark-row-min-height: ${size.rowHeight}px">
              <div class="bookmark-row">
                <span class="drag-handle" aria-hidden="true">${dragHandleIcon()}</span>
                <span class="row-preview" aria-hidden="true">
                ${this.exampleObjectUrl
                  ? `<img src="${this.exampleObjectUrl}" alt="" />`
                  : `<span class="preview-example__fallback">${imagePlaceholderIcon()}</span>`}
                </span>
                <span class="row-info">
                  <span class="row-title">${escapeHtml(exampleRecord?.sourceTitle ?? 'Example bookmark')}</span>
                  <span class="row-meta row-meta--domain">${escapeHtml(formatExampleAddress(exampleRecord?.sourceUrl))}</span>
                </span>
                <button class="action-btn row-menu-btn" type="button" tabindex="-1" aria-hidden="true">${menuIcon()}</button>
              </div>
            </div>
          </div>

          <label class="settings-field">
            <span>Storage limit</span>
            <span class="settings-field__control">
              <input type="number" data-setting="maxStorageMb" value="${this.settings.maxStorageMb}" min="1" step="1" />
              <span>MB</span>
            </span>
          </label>

          <div class="preview-stats" aria-label="Preview storage statistics">
            <div><span>Saved previews</span><strong>${stats.okCount}</strong></div>
            <div><span>Failed previews</span><strong>${stats.errorCount}</strong></div>
            <div><span>Storage used</span><strong>${formatBytes(stats.totalBytes)}</strong></div>
            <div><span>Average size</span><strong>${formatBytes(stats.averageBytes)}</strong></div>
          </div>
        </section>

        <section class="settings-card settings-import">
          <div>
            <h2>Old Edge Collections</h2>
            <p>Import collections saved by the discontinued Edge Collections feature.</p>
          </div>
          <div class="settings-import__status settings-import__status--${importStatus.kind}">
            <span>${importStatus.label}</span>
            ${importStatus.detail ? `<small>${escapeHtml(importStatus.detail)}</small>` : ''}
          </div>
          <button class="btn btn--secondary" data-action="import">Import old Edge Collections…</button>
        </section>
      </main>
    `;
    this.attachEvents();
  }

  private attachEvents(): void {
    this.root.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => {
      this.revokeExampleObjectUrl();
      this.onClose();
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="import"]')?.addEventListener('click', () => {
      this.revokeExampleObjectUrl();
      this.onImport();
    });
    this.root.querySelectorAll<HTMLInputElement>('[data-setting]').forEach((input) => {
      input.addEventListener('change', () => void this.updateSetting(input));
    });
  }

  private async updateSetting(input: HTMLInputElement): Promise<void> {
    if (!this.settings) return;
    const key = input.dataset.setting as keyof PreviewSettings;
    const value = input.type === 'checkbox'
      ? input.checked
      : input.type === 'number'
        ? Number(input.value)
        : input.value;
    this.settings = await this.settingsService.patch({ [key]: value } as Partial<PreviewSettings>);
    await this.render();
  }

  private revokeExampleObjectUrl(): void {
    if (this.exampleObjectUrl) URL.revokeObjectURL(this.exampleObjectUrl);
    this.exampleObjectUrl = '';
  }
}

function formatImportStatus(
  result: 'success' | 'failed' | undefined,
  importedAt: string | undefined,
): { kind: 'none' | 'success' | 'failed'; label: string; detail?: string } {
  if (!result) return { kind: 'none', label: 'Not imported yet' };
  const date = importedAt ? new Date(importedAt) : null;
  const detail = date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : undefined;
  return result === 'success'
    ? { kind: 'success', label: 'Import completed', detail }
    : { kind: 'failed', label: 'Last import failed', detail };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatExampleAddress(url: string | undefined): string {
  if (!url) return 'example.com';
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function backIcon(): string {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
}

function dragHandleIcon(): string {
  return '<svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1.2"/><circle cx="9" cy="3" r="1.2"/><circle cx="3" cy="9" r="1.2"/><circle cx="9" cy="9" r="1.2"/><circle cx="3" cy="15" r="1.2"/><circle cx="9" cy="15" r="1.2"/></svg>';
}

function imagePlaceholderIcon(): string {
  return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 17 5-5 4 4 2-2 5 4"/></svg>';
}

function menuIcon(): string {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
}
