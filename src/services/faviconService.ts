export class FaviconService {
  getFaviconUrl(pageUrl: string, size = 32): string {
    try {
      const url = new URL(chrome.runtime.getURL('/_favicon/'));
      url.searchParams.set('pageUrl', pageUrl);
      url.searchParams.set('size', String(size));
      return url.toString();
    } catch {
      return '';
    }
  }

  getFallbackContent(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, '').charAt(0).toUpperCase();
    } catch {
      return '?';
    }
  }

  getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
