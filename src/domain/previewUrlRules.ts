import type { PreviewErrorCode } from '../services/previewDbService.js';

const UNSUPPORTED_PROTOCOLS = new Set([
  'chrome:',
  'edge:',
  'about:',
  'devtools:',
  'chrome-extension:',
  'file:',
  'data:',
  'javascript:',
]);

export interface PreviewUrlValidation {
  ok: boolean;
  errorCode?: PreviewErrorCode;
}

export function validatePreviewUrl(url: string): PreviewUrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, errorCode: 'unsupported-url' };
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return { ok: true };
  }

  if (UNSUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, errorCode: 'unsupported-url' };
  }

  return { ok: false, errorCode: 'unsupported-url' };
}

export function isPrivateHost(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (hostname === 'localhost') return true;
  if (hostname === '127.0.0.1') return true;
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;

  const match172 = /^172\.(\d{1,2})\./.exec(hostname);
  if (match172) {
    const second = Number(match172[1]);
    return second >= 16 && second <= 31;
  }

  return false;
}

export function getUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
