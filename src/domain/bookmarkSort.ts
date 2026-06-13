import type { BookmarkEntryViewModel, SortAction } from '../types.js';

export type { SortAction };

export function calculateSortedOrder(
  entries: BookmarkEntryViewModel[],
  action: SortAction,
): BookmarkEntryViewModel[] {
  const arr = [...entries];

  switch (action) {
    case 'folders-first':
      return stableSort(arr, (a, b) => {
        const aRank = a.type === 'folder' ? 0 : 1;
        const bRank = b.type === 'folder' ? 0 : 1;
        return aRank - bRank;
      });

    case 'links-first':
      return stableSort(arr, (a, b) => {
        const aRank = a.type === 'link' ? 0 : 1;
        const bRank = b.type === 'link' ? 0 : 1;
        return aRank - bRank;
      });

    case 'title-asc':
      return stableSort(arr, (a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      );

    case 'title-desc':
      return stableSort(arr, (a, b) =>
        b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }),
      );

    case 'domain-asc':
      return stableSort(arr, (a, b) => {
        const aRank = a.type === 'folder' ? 0 : 1;
        const bRank = b.type === 'folder' ? 0 : 1;
        if (aRank !== bRank) return aRank - bRank;
        if (a.type === 'link' && b.type === 'link') {
          return a.domain.localeCompare(b.domain, undefined, { sensitivity: 'base' });
        }
        return 0;
      });
  }
}

function stableSort<T>(arr: T[], compare: (a: T, b: T) => number): T[] {
  return arr
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map(({ item }) => item);
}
