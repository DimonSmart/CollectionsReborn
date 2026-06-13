export interface CurrentTabInfo {
  title: string;
  url: string;
}

const BLOCKED_PREFIXES = [
  'chrome://',
  'edge://',
  'about:',
  'devtools://',
  'chrome-extension://',
];

export class BrowserTabsService {
  async getCurrentTab(): Promise<CurrentTabInfo | null> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab?.title) return null;
      if (BLOCKED_PREFIXES.some((p) => tab.url!.startsWith(p))) return null;
      return { title: tab.title, url: tab.url };
    } catch {
      return null;
    }
  }

  async openUrl(url: string): Promise<void> {
    await chrome.tabs.create({ url });
  }
}
