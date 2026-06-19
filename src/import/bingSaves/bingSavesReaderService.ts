const BING_SAVES_URL = 'https://www.bing.com/saves';
const MAX_RESPONSE_CHARACTERS = 25_000_000;

export class BingSavesReaderService {
  private openedTabId: number | undefined;

  async openBingSaves(): Promise<void> {
    const existing = await this.findBingSavesTab();
    if (existing?.id !== undefined) {
      this.openedTabId = existing.id;
      await chrome.tabs.update(existing.id, { active: true });
      return;
    }
    const tab = await chrome.tabs.create({ url: BING_SAVES_URL });
    this.openedTabId = tab.id;
  }

  async read(): Promise<unknown> {
    const tab = await this.resolveTab();
    if (tab.id === undefined) throw new Error('The Bing Saves tab is not available.');
    if (tab.status !== 'complete') {
      throw new Error('Bing Saves is still loading. Wait for the page to finish, then try again.');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readBingSavesFromPage,
      args: [MAX_RESPONSE_CHARACTERS],
    });
    const first = results[0];
    if (!first) throw new Error('Bing Saves did not return a result.');
    if (isReaderFailure(first.result)) throw new Error(first.result.message);
    return first.result;
  }

  private async resolveTab(): Promise<chrome.tabs.Tab> {
    if (this.openedTabId !== undefined) {
      try {
        const tab = await chrome.tabs.get(this.openedTabId);
        if (isBingSavesTab(tab)) return tab;
      } catch {
        this.openedTabId = undefined;
      }
    }
    const tab = await this.findBingSavesTab();
    if (!tab) throw new Error('Open Bing Saves, sign in, and leave that tab open.');
    this.openedTabId = tab.id;
    return tab;
  }

  private async findBingSavesTab(): Promise<chrome.tabs.Tab | undefined> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs.find(isBingSavesTab);
  }
}

async function readBingSavesFromPage(maxCharacters: number): Promise<unknown> {
  try {
    const current = new URL(location.href);
    if (current.protocol !== 'https:' || current.hostname !== 'www.bing.com' || !current.pathname.startsWith('/saves')) {
      return { __collectionsRebornReaderError: true, message: 'The selected tab is not Bing Saves.' };
    }
    const response = await fetch('/saves/collection', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) {
      return { __collectionsRebornReaderError: true, message: `Bing Saves returned HTTP ${response.status}.` };
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return { __collectionsRebornReaderError: true, message: 'Bing Saves returned an unexpected response.' };
    }
    const text = await response.text();
    if (text.length > maxCharacters) {
      return { __collectionsRebornReaderError: true, message: 'The Bing Saves response is too large to import safely.' };
    }
    return JSON.parse(text) as unknown;
  } catch {
    return { __collectionsRebornReaderError: true, message: 'Could not read Bing Saves. Confirm that you are signed in and retry.' };
  }
}

function isBingSavesTab(tab: chrome.tabs.Tab): boolean {
  if (!tab.url) return false;
  try {
    const url = new URL(tab.url);
    return url.protocol === 'https:'
      && url.hostname === 'www.bing.com'
      && url.pathname.startsWith('/saves');
  } catch {
    return false;
  }
}

function isReaderFailure(value: unknown): value is { __collectionsRebornReaderError: true; message: string } {
  return typeof value === 'object'
    && value !== null
    && (value as Record<string, unknown>).__collectionsRebornReaderError === true
    && typeof (value as Record<string, unknown>).message === 'string';
}
