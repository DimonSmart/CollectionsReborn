export const PREVIEW_LIMIT = 4;

export type ViewMode = 'compact' | 'normal' | 'full';
export type FolderExpansionState = 'collapsed' | 'preview' | 'expanded';

export interface CollectionViewState {
  folderExpansionOverrides: Record<string, 'collapsed' | 'expanded'>;
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
  expansionState: FolderExpansionState;
  allItems: FavoriteItemViewModel[];
}

export interface StoredSettings {
  viewMode: ViewMode;
  folderExpansionOverrides: Record<string, 'collapsed' | 'expanded'>;
}
