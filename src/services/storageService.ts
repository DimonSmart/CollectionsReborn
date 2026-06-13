import type { StoredSettings, ViewMode } from '../types.js';

const STORAGE_KEY = 'cr_settings';

const DEFAULT_SETTINGS: StoredSettings = {
  viewMode: 'normal',
  folderExpansionOverrides: {},
};

export class StorageService {
  async loadSettings(): Promise<StoredSettings> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      const saved = result[STORAGE_KEY] ?? {};

      let overrides: Record<string, 'collapsed' | 'expanded'> = {};
      if (saved.folderExpansionOverrides && typeof saved.folderExpansionOverrides === 'object') {
        overrides = saved.folderExpansionOverrides;
      } else if (Array.isArray(saved.expandedFolderIds)) {
        // migrate legacy format
        for (const id of saved.expandedFolderIds as string[]) {
          overrides[id] = 'expanded';
        }
      }

      return {
        viewMode: saved.viewMode ?? DEFAULT_SETTINGS.viewMode,
        folderExpansionOverrides: overrides,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: Partial<StoredSettings>): Promise<void> {
    try {
      const current = await this.loadSettings();
      await chrome.storage.sync.set({ [STORAGE_KEY]: { ...current, ...settings } });
    } catch {
      // storage failure is non-fatal
    }
  }

  async saveViewMode(viewMode: ViewMode): Promise<void> {
    await this.saveSettings({ viewMode });
  }

  async saveExpansionOverrides(overrides: Record<string, 'collapsed' | 'expanded'>): Promise<void> {
    await this.saveSettings({ folderExpansionOverrides: overrides });
  }
}
