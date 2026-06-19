export type PreviewSize = 'small' | 'medium' | 'large' | 'xlarge';

export const PREVIEW_SIZE_OPTIONS: Record<PreviewSize, {
  label: string;
  width: number;
  height: number;
  rowHeight: number;
}> = {
  small: {
    label: 'Small 56×32',
    width: 56,
    height: 32,
    rowHeight: 40,
  },
  medium: {
    label: 'Medium 112×63',
    width: 112,
    height: 63,
    rowHeight: 72,
  },
  large: {
    label: 'Large 160×90',
    width: 160,
    height: 90,
    rowHeight: 100,
  },
  xlarge: {
    label: 'Extra large 352×198',
    width: 352,
    height: 198,
    rowHeight: 248,
  },
};

export const DEFAULT_PREVIEW_SIZE: PreviewSize = 'medium';
export const STORED_THUMBNAIL_WIDTH = 352;
export const STORED_THUMBNAIL_HEIGHT = 198;

export interface PreviewSettings {
  enabled: boolean;
  previewSize: PreviewSize;
  imageFormat: 'image/webp' | 'image/jpeg';
  imageQuality: number;
  maxStorageMb: number;
  excludedDomains: string[];
  skipPrivateHosts: boolean;
}

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  enabled: true,
  previewSize: DEFAULT_PREVIEW_SIZE,
  imageFormat: 'image/webp',
  imageQuality: 0.7,
  maxStorageMb: 120,
  excludedDomains: [],
  skipPrivateHosts: false,
};

export const PREVIEW_SETTINGS_STORAGE_KEY = 'previewSettings';

export class PreviewSettingsService {
  async load(): Promise<PreviewSettings> {
    const result = await chrome.storage.local.get(PREVIEW_SETTINGS_STORAGE_KEY);
    const settings = { ...DEFAULT_PREVIEW_SETTINGS, ...(result[PREVIEW_SETTINGS_STORAGE_KEY] ?? {}) };
    return {
      enabled: settings.enabled === true,
      previewSize: isPreviewSize(settings.previewSize) ? settings.previewSize : DEFAULT_PREVIEW_SIZE,
      imageFormat: settings.imageFormat === 'image/jpeg' ? 'image/jpeg' : 'image/webp',
      imageQuality: typeof settings.imageQuality === 'number' ? settings.imageQuality : DEFAULT_PREVIEW_SETTINGS.imageQuality,
      maxStorageMb: typeof settings.maxStorageMb === 'number' ? settings.maxStorageMb : DEFAULT_PREVIEW_SETTINGS.maxStorageMb,
      excludedDomains: Array.isArray(settings.excludedDomains) ? settings.excludedDomains : [],
      skipPrivateHosts: settings.skipPrivateHosts === true,
    };
  }

  async save(settings: PreviewSettings): Promise<void> {
    await chrome.storage.local.set({ [PREVIEW_SETTINGS_STORAGE_KEY]: settings });
  }

  async patch(changes: Partial<PreviewSettings>): Promise<PreviewSettings> {
    const next = { ...(await this.load()), ...changes };
    await this.save(next);
    return next;
  }
}

function isPreviewSize(value: unknown): value is PreviewSize {
  return value === 'small' || value === 'medium' || value === 'large' || value === 'xlarge';
}
