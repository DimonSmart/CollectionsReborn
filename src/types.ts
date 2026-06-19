import type { BookmarkCapabilities } from './domain/bookmarkCapabilities.js';

export interface BaseEntryViewModel {
  id: string;
  parentId: string;
  index: number;
  title: string;
  preview?: PreviewViewModel;
  capabilities: BookmarkCapabilities;
}

export type PreviewStatus = 'none' | 'pending' | 'ok' | 'error' | 'skipped';

export interface PreviewViewModel {
  status: PreviewStatus;
  objectUrl?: string;
  width?: number;
  height?: number;
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

export type FolderInsertPlacement = 'before' | 'after';

export type SortAction =
  | 'folders-first'
  | 'links-first'
  | 'title-asc'
  | 'title-desc'
  | 'domain-asc';

export interface FolderViewCallbacks {
  onNavigateToFolder: (folderId: string) => void;
  onNavigateBack: () => void;
  onOpenLink: (item: LinkEntryViewModel) => void;
  onEditLink: (item: LinkEntryViewModel) => void;
  onDeleteItem: (item: BookmarkEntryViewModel) => void;
  onRenameFolder: (item: FolderEntryViewModel) => void;
  onMoveItem: (item: BookmarkEntryViewModel) => void;
  onCreateFolderNearItem: (item: BookmarkEntryViewModel, placement: FolderInsertPlacement) => void;
  onGeneratePreview: (item: BookmarkEntryViewModel) => void;
  onRemovePreview: (item: BookmarkEntryViewModel) => void;
  onUpdateLinkUrlFromCurrentTab: (item: LinkEntryViewModel) => void;
  onReorder: (itemId: string, newIndex: number) => void;
  onMoveIntoFolder: (itemId: string, folderId: string) => void;
  onSortFolder: (action: SortAction) => void;
}

export interface StoredSettings {
  currentFolderId?: string;
}

export interface FolderChoice {
  id: string;
  title: string;
  path: string;
  depth: number;
  canCreateChildren: boolean;
}

export interface MoveToResult {
  folderId: string;
  placement: 'beginning' | 'end';
}
