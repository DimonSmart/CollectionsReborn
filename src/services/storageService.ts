import type { StoredSettings, ViewMode } from '../types.js';

const STORAGE_KEY = 'cr_settings';

const DEFAULT_SETTINGS: StoredSettings = {
  viewMode: 'normal',
  expandedFolderIds: [],
};

export class StorageService {
  async loadSettings(): Promise<StoredSettings> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY] ?? {}) };
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

  async saveExpandedFolders(expandedFolderIds: string[]): Promise<void> {
    await this.saveSettings({ expandedFolderIds });
  }
}
