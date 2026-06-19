import { describe, expect, it } from 'vitest';
import { parseBingSavesResponse } from './bingSavesParser.js';

function response(cards: unknown[], overrides: Record<string, unknown> = {}): unknown {
  return {
    collections: [{
      Id: 'collection-1',
      Title: 'Example Collection',
      HasAllItemsFetched: true,
      Cards: cards,
      ...overrides,
    }],
    hasAllCollectionsFetched: true,
    actualCollectionCount: 1,
  };
}

describe('parseBingSavesResponse', () => {
  it('maps a web card without retaining unrelated response fields', () => {
    const result = parseBingSavesResponse(response([{
      Id: 'item-1',
      MainTitle: 'Example Site',
      Label: 'web',
      ClickthroughLink: { Url: 'https://example.com/path' },
      Note: 'Remember this',
      PrivateField: 'must not survive',
    }]));

    expect(result).toEqual({
      collections: [{
        sourceId: 'collection-1',
        title: 'Example Collection',
        items: [{
          sourceId: 'item-1',
          title: 'Example Site',
          url: 'https://example.com/path',
          note: 'Remember this',
          type: 'web',
        }],
      }],
      sourceItemCount: 1,
      importableItemCount: 1,
      skippedItemCount: 0,
    });
  });

  it('uses nested metadata fallbacks', () => {
    const result = parseBingSavesResponse(response([{
      ContentId: 'item-2',
      Label: 'image',
      MetaData: JSON.stringify({
        title: 'Metadata title',
        note: 'Metadata note',
        customdata: JSON.stringify({ PageUrl: 'https://example.org/image' }),
      }),
    }]));

    expect(result.collections[0].items[0]).toMatchObject({
      sourceId: 'item-2',
      title: 'Metadata title',
      url: 'https://example.org/image',
      note: 'Metadata note',
      type: 'image',
    });
  });

  it('skips unsupported and malformed URLs', () => {
    const result = parseBingSavesResponse(response([
      { Id: 'edge', MainTitle: 'Internal page', ClickthroughLink: { Url: 'edge://settings' } },
      { Id: 'hash', MainTitle: 'Missing page', ClickthroughLink: { Url: '#' } },
      { Id: 'ok', MainTitle: 'Valid', ClickthroughLink: { Url: 'http://example.test' } },
    ]));

    expect(result.importableItemCount).toBe(1);
    expect(result.skippedItemCount).toBe(2);
  });

  it('refuses partial collection and item responses', () => {
    expect(() => parseBingSavesResponse({
      collections: [],
      hasAllCollectionsFetched: false,
    })).toThrow(/partial collection list/);
    expect(() => parseBingSavesResponse(response([], { HasAllItemsFetched: false })))
      .toThrow(/only part of the items/);
  });

  it('decodes URL-encoded Bing collection and item titles without changing literal plus signs', () => {
    const encoded = parseBingSavesResponse({
      collections: [{
        Id: 'encoded',
        Title: '%d0%a1%d0%b8%d0%bd%d1%85%d1%80%d0%be%d0%bd%d0%b8%d0%b7%d0%b0%d1%86%d0%b8%d1%8f%e2%80%a6',
        HasAllItemsFetched: true,
        Cards: [{
          Id: 'item',
          MainTitle: 'Parsers+%26+Compilers',
          ClickthroughLink: { Url: 'https://example.test' },
        }],
      }],
      hasAllCollectionsFetched: true,
    });
    expect(encoded.collections[0].title).toBe('Синхронизация…');
    expect(encoded.collections[0].items[0].title).toBe('Parsers & Compilers');

    const literal = parseBingSavesResponse(response([{
      Id: 'cpp',
      MainTitle: 'C++',
      ClickthroughLink: { Url: 'https://example.test' },
    }]));
    expect(literal.collections[0].items[0].title).toBe('C++');
  });
});
