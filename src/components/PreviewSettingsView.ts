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
    const [stats, storedSettings] = await Promise.all([
      this.previewDb.getStorageStats(),
      this.storageService.loadSettings(),
    ]);
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
              <p>Preview images are generated automatically when a bookmark is added or opened.</p>
            </div>
            <label class="settings-switch">
              <input type="checkbox" data-setting="enabled" ${this.settings.enabled ? 'checked' : ''} />
              <span>Enable previews</span>
            </label>
          </div>

          <fieldset class="preview-size">
            <legend>Preview size</legend>
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
    this.root.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', this.onClose);
    this.root.querySelector<HTMLButtonElement>('[data-action="import"]')?.addEventListener('click', this.onImport);
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function backIcon(): string {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
}
