import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storageService.js';

const STORAGE_KEY = 'cr_settings_v2';

describe('StorageService', () => {
  let storedSettings: Record<string, unknown>;

  beforeEach(() => {
    storedSettings = {};
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T10:15:30.000Z'));

    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn(async () => ({ [STORAGE_KEY]: storedSettings })),
          set: vi.fn(async (value: Record<string, Record<string, unknown>>) => {
            storedSettings = value[STORAGE_KEY] ?? {};
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('marks Edge Collections import as declined and suppresses the startup prompt', async () => {
    const storage = new StorageService();

    await storage.declineEdgeCollectionsImport();

    expect(storedSettings).toMatchObject({
      edgeCollectionsImportPromptShown: true,
      edgeCollectionsImportDeclinedAt: '2026-06-25T10:15:30.000Z',
    });
    await expect(storage.loadSettings()).resolves.toMatchObject({
      edgeCollectionsImportPromptShown: true,
      edgeCollectionsImportDeclinedAt: '2026-06-25T10:15:30.000Z',
    });
  });
});
