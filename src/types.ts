export interface BaseEntryViewModel {
  id: string;
  parentId: string;
  index: number;
  title: string;
}

export interface FolderEntryViewModel extends BaseEntryViewModel {
  type: 'folder';
  childCount: number;
}

export interface LinkEntryViewModel extends BaseEntryViewModel {
  type: 'link';
  url: string;
  domain: string;
  faviconUrl: string;
}

export type BookmarkEntryViewModel = FolderEntryViewModel | LinkEntryViewModel;

export interface FolderViewCallbacks {
  onNavigateToFolder: (folderId: string) => void;
  onNavigateBack: () => void;
  onOpenLink: (url: string) => void;
  onEditLink: (item: LinkEntryViewModel) => void;
  onDeleteItem: (item: BookmarkEntryViewModel) => void;
  onRenameFolder: (item: FolderEntryViewModel) => void;
  onMoveItem: (item: BookmarkEntryViewModel) => void;
  onReorder: (itemId: string, newIndex: number) => void;
}

export interface StoredSettings {
  currentFolderId?: string;
}

export interface FolderChoice {
  id: string;
  title: string;
  path: string;
  depth: number;
}
