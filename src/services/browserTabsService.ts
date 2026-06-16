export interface CurrentTabInfo {
  title: string;
  url: string;
  id?: number;
  windowId?: number;
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
      return { title: tab.title, url: tab.url, id: tab.id, windowId: tab.windowId };
    } catch {
      return null;
    }
  }

  async openUrl(url: string): Promise<chrome.tabs.Tab> {
    return chrome.tabs.create({ url });
  }

  async waitForTabComplete(tabId: number, timeoutMs: number): Promise<boolean> {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'complete') return true;
    } catch {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(false);
      }, timeoutMs);

      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
        window.clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(true);
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  }
}
