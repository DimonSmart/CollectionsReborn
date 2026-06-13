export type ViewMode = 'compact' | 'normal';

export interface CollectionViewState {
  expandedFolderIds: string[];
  selectedFolderId?: string;
  searchText: string;
  viewMode: ViewMode;
}

export interface FavoriteItemViewModel {
  id: string;
  title: string;
  url: string;
  domain: string;
  faviconUrl: string;
  parentId: string;
}

export interface FolderViewModel {
  id: string;
  title: string;
  itemCount: number;
  isExpanded: boolean;
  allItems: FavoriteItemViewModel[];
}

export interface StoredSettings {
  viewMode: ViewMode;
  expandedFolderIds: string[];
}
