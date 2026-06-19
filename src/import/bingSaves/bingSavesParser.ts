export type BingImportItemType = 'web' | 'image' | 'video' | 'product' | 'unknown';

export interface BingImportItem {
  sourceId: string;
  title: string;
  url: string;
  note?: string;
  type: BingImportItemType;
}

export interface BingImportCollection {
  sourceId: string;
  title: string;
  items: BingImportItem[];
}

export interface BingImportPreview {
  collections: BingImportCollection[];
  sourceItemCount: number;
  importableItemCount: number;
  skippedItemCount: number;
}

type UnknownRecord = Record<string, unknown>;

export function parseBingSavesResponse(value: unknown): BingImportPreview {
  const root = requireRecord(value, 'Bing Saves returned an invalid response.');
  const collectionsValue = root.collections;
  if (!Array.isArray(collectionsValue)) {
    throw new Error('Bing Saves response does not contain a collection list.');
  }
  if (root.hasAllCollectionsFetched !== true) {
    throw new Error('Bing Saves returned a partial collection list. Import was stopped to avoid losing data.');
  }

  const collections: BingImportCollection[] = [];
  let sourceItemCount = 0;
  let skippedItemCount = 0;

  for (const rawCollection of collectionsValue) {
    const collection = requireRecord(rawCollection, 'Bing Saves returned an invalid collection.');
    const sourceId = requireNonEmptyString(collection.Id, 'A Bing collection has no ID.');
    const title = decodeBingText(requireNonEmptyString(collection.Title, 'A Bing collection has no title.'));
    if (collection.HasAllItemsFetched !== true) {
      throw new Error(`Bing Saves returned only part of the items in “${title}”. Import was stopped.`);
    }
    if (!Array.isArray(collection.Cards)) {
      throw new Error(`Bing Saves returned an invalid item list for “${title}”.`);
    }

    const items: BingImportItem[] = [];
    sourceItemCount += collection.Cards.length;
    for (const rawCard of collection.Cards) {
      const item = parseCard(rawCard);
      if (item) items.push(item);
      else skippedItemCount += 1;
    }
    collections.push({ sourceId, title, items });
  }

  return {
    collections,
    sourceItemCount,
    importableItemCount: sourceItemCount - skippedItemCount,
    skippedItemCount,
  };
}

function parseCard(value: unknown): BingImportItem | null {
  if (!isRecord(value)) return null;
  const metadata = parseJsonRecord(value.MetaData);
  const customData = parseJsonRecord(metadata?.customdata);
  const url = firstWebUrl(
    nestedString(value.ClickthroughLink, 'Url'),
    nestedString(value.SimplifiedClickthroughLink, 'Url'),
    stringValue(metadata?.url),
    stringValue(customData?.PageUrl),
  );
  if (!url) return null;

  const sourceId = stringValue(value.Id) ?? stringValue(value.ContentId);
  if (!sourceId) return null;
  const title = decodeBingText(firstNonEmptyString(
    stringValue(value.MainTitle),
    stringValue(metadata?.title),
    stringValue(customData?.ToolTip),
    safeHostname(url),
    url,
  ));
  const note = decodeBingText(firstNonEmptyString(stringValue(value.Note), stringValue(metadata?.note)));
  const label = stringValue(value.Label) ?? stringValue(metadata?.itemtype);

  return {
    sourceId,
    title,
    url,
    note: note || undefined,
    type: isKnownType(label) ? label : 'unknown',
  };
}

function firstWebUrl(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch {
      // Try the next documented fallback.
    }
  }
  return undefined;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function parseJsonRecord(value: unknown): UnknownRecord | undefined {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function nestedString(value: unknown, key: string): string | undefined {
  return isRecord(value) ? stringValue(value[key]) : undefined;
}

function firstNonEmptyString(...values: Array<string | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? '';
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function requireNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(message);
  return value.trim();
}

function requireRecord(value: unknown, message: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(message);
  return value;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnownType(value: string | undefined): value is Exclude<BingImportItemType, 'unknown'> {
  return value === 'web' || value === 'image' || value === 'video' || value === 'product';
}

function decodeBingText(value: string): string {
  if (!/%[0-9a-f]{2}/i.test(value)) return value;
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}
