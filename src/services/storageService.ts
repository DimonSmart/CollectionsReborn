import type { StoredSettings } from '../types.js';

const STORAGE_KEY = 'cr_settings_v2';

export class StorageService {
  async loadSettings(): Promise<StoredSettings> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      const saved = result[STORAGE_KEY] ?? {};
      return {
        currentFolderId: typeof saved.currentFolderId === 'string' ? saved.currentFolderId : undefined,
      };
    } catch {
      return {};
    }
  }

  async saveCurrentFolder(folderId: string): Promise<void> {
    try {
      const current = await this.loadSettings();
      await chrome.storage.sync.set({ [STORAGE_KEY]: { ...current, currentFolderId: folderId } });
    } catch {
      // non-fatal
    }
  }
}
