import { describe, it, expect } from 'vitest';
import { calculateSortedOrder } from './bookmarkSort.js';
import type { BookmarkEntryViewModel } from '../types.js';

const capabilities = {
  canRename: true,
  canEditUrl: true,
  canMove: true,
  canDelete: true,
  canCreateFolderBefore: true,
  canCreateFolderAfter: true,
  canCreateChildren: true,
  canSortChildren: true,
};

function folder(id: string, title: string): BookmarkEntryViewModel {
  return { type: 'folder', id, parentId: '1', index: 0, title, childCount: 0, capabilities };
}

function link(id: string, title: string, domain: string): BookmarkEntryViewModel {
  return {
    type: 'link',
    id,
    parentId: '1',
    index: 0,
    title,
    url: `https://${domain}/`,
    domain,
    faviconUrl: '',
    capabilities,
  };
}

const MIXED = [
  link('l1', 'Zebra', 'zebra.com'),
  folder('f1', 'Apple'),
  link('l2', 'Mango', 'mango.com'),
  folder('f2', 'Banana'),
  link('l3', 'Apple Link', 'apple.com'),
];

describe('calculateSortedOrder - folders-first', () => {
  it('puts all folders before all links', () => {
    const result = calculateSortedOrder(MIXED, 'folders-first');
    const firstLink = result.findIndex((e) => e.type === 'link');
    const lastFolder = result.map((e) => e.type).lastIndexOf('folder');
    expect(lastFolder).toBeLessThan(firstLink);
  });

  it('preserves relative order within folders', () => {
    const result = calculateSortedOrder(MIXED, 'folders-first');
    const folderIds = result.filter((e) => e.type === 'folder').map((e) => e.id);
    expect(folderIds).toEqual(['f1', 'f2']);
  });

  it('preserves relative order within links', () => {
    const result = calculateSortedOrder(MIXED, 'folders-first');
    const linkIds = result.filter((e) => e.type === 'link').map((e) => e.id);
    expect(linkIds).toEqual(['l1', 'l2', 'l3']);
  });
});

describe('calculateSortedOrder - links-first', () => {
  it('puts all links before all folders', () => {
    const result = calculateSortedOrder(MIXED, 'links-first');
    const firstFolder = result.findIndex((e) => e.type === 'folder');
    const lastLink = result.map((e) => e.type).lastIndexOf('link');
    expect(lastLink).toBeLessThan(firstFolder);
  });

  it('preserves relative order within links', () => {
    const result = calculateSortedOrder(MIXED, 'links-first');
    const linkIds = result.filter((e) => e.type === 'link').map((e) => e.id);
    expect(linkIds).toEqual(['l1', 'l2', 'l3']);
  });

  it('preserves relative order within folders', () => {
    const result = calculateSortedOrder(MIXED, 'links-first');
    const folderIds = result.filter((e) => e.type === 'folder').map((e) => e.id);
    expect(folderIds).toEqual(['f1', 'f2']);
  });
});

describe('calculateSortedOrder - title-asc', () => {
  it('sorts all items alphabetically ascending', () => {
    const result = calculateSortedOrder(MIXED, 'title-asc');
    const titles = result.map((e) => e.title);
    expect(titles).toEqual(['Apple', 'Apple Link', 'Banana', 'Mango', 'Zebra']);
  });

  it('is case-insensitive', () => {
    const items = [link('a', 'zebra', 'z.com'), link('b', 'Apple', 'a.com')];
    const result = calculateSortedOrder(items, 'title-asc');
    expect(result[0].title).toBe('Apple');
  });
});

describe('calculateSortedOrder - title-desc', () => {
  it('sorts all items alphabetically descending', () => {
    const result = calculateSortedOrder(MIXED, 'title-desc');
    const titles = result.map((e) => e.title);
    expect(titles).toEqual(['Zebra', 'Mango', 'Banana', 'Apple Link', 'Apple']);
  });
});

describe('calculateSortedOrder - domain-asc', () => {
  it('places folders before links', () => {
    const result = calculateSortedOrder(MIXED, 'domain-asc');
    const firstLink = result.findIndex((e) => e.type === 'link');
    const lastFolder = result.map((e) => e.type).lastIndexOf('folder');
    expect(lastFolder).toBeLessThan(firstLink);
  });

  it('sorts links by domain alphabetically', () => {
    const result = calculateSortedOrder(MIXED, 'domain-asc');
    const linkDomains = result.filter((e) => e.type === 'link').map((e) =>
      e.type === 'link' ? e.domain : '',
    );
    expect(linkDomains).toEqual(['apple.com', 'mango.com', 'zebra.com']);
  });
});

describe('calculateSortedOrder - stable sort', () => {
  it('maintains original order for equal keys (title-asc)', () => {
    const items: BookmarkEntryViewModel[] = [
      link('a', 'Same', 'a.com'),
      link('b', 'Same', 'b.com'),
      link('c', 'Same', 'c.com'),
    ];
    const result = calculateSortedOrder(items, 'title-asc');
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('maintains original order for equal keys (folders-first)', () => {
    const items: BookmarkEntryViewModel[] = [
      folder('f1', 'F'),
      folder('f2', 'F'),
      link('l1', 'L', 'l.com'),
      link('l2', 'L', 'l.com'),
    ];
    const result = calculateSortedOrder(items, 'folders-first');
    expect(result.map((e) => e.id)).toEqual(['f1', 'f2', 'l1', 'l2']);
  });
});

describe('calculateSortedOrder - edge cases', () => {
  it('returns empty array for empty input', () => {
    expect(calculateSortedOrder([], 'title-asc')).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    const single = [link('x', 'Only', 'only.com')];
    expect(calculateSortedOrder(single, 'title-desc')).toEqual(single);
  });

  it('does not mutate the original array', () => {
    const original = [...MIXED];
    calculateSortedOrder(MIXED, 'title-asc');
    expect(MIXED).toEqual(original);
  });
});
