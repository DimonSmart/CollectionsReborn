import type { StoredSettings } from '../types.js';

const STORAGE_KEY = 'cr_settings_v2';

export class StorageService {
  async loadSettings(): Promise<StoredSettings> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      const saved = result[STORAGE_KEY] ?? {};
      return {
        currentFolderId: typeof saved.currentFolderId === 'string' ? saved.currentFolderId : undefined,
        edgeCollectionsImportPromptShown: saved.edgeCollectionsImportPromptShown === true,
        lastEdgeCollectionsImportAt: typeof saved.lastEdgeCollectionsImportAt === 'string'
          ? saved.lastEdgeCollectionsImportAt
          : undefined,
        lastEdgeCollectionsImportResult: saved.lastEdgeCollectionsImportResult === 'success'
          || saved.lastEdgeCollectionsImportResult === 'failed'
          ? saved.lastEdgeCollectionsImportResult
          : undefined,
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

  async setEdgeCollectionsImportPromptShown(shown: boolean): Promise<void> {
    await this.patchSettings({ edgeCollectionsImportPromptShown: shown });
  }

  async saveEdgeCollectionsImportResult(result: 'success' | 'failed'): Promise<void> {
    await this.patchSettings({
      lastEdgeCollectionsImportAt: new Date().toISOString(),
      lastEdgeCollectionsImportResult: result,
    });
  }

  private async patchSettings(patch: Partial<StoredSettings>): Promise<void> {
    try {
      const current = await this.loadSettings();
      await chrome.storage.sync.set({ [STORAGE_KEY]: { ...current, ...patch } });
    } catch {
      // Settings failures do not block bookmark operations.
    }
  }
}
