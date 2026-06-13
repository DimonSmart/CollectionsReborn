import type { CollectionViewState, ViewMode } from './types.js';

type Listener = (state: CollectionViewState) => void;

const DEFAULT_STATE: CollectionViewState = {
  expandedFolderIds: [],
  selectedFolderId: undefined,
  searchText: '',
  viewMode: 'normal',
};

export class AppState {
  private state: CollectionViewState = { ...DEFAULT_STATE };
  private listeners: Listener[] = [];

  getState(): Readonly<CollectionViewState> {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const snapshot = this.state;
    for (const l of this.listeners) l(snapshot);
  }

  setViewMode(viewMode: ViewMode): void {
    if (this.state.viewMode === viewMode) return;
    this.state = { ...this.state, viewMode };
    this.notify();
  }

  setSearchText(searchText: string): void {
    if (this.state.searchText === searchText) return;
    this.state = { ...this.state, searchText };
    this.notify();
  }

  toggleFolder(folderId: string): void {
    const ids = this.state.expandedFolderIds;
    const next = ids.includes(folderId) ? ids.filter((id) => id !== folderId) : [...ids, folderId];
    this.state = { ...this.state, expandedFolderIds: next };
    this.notify();
  }

  setExpandedFolders(ids: string[]): void {
    this.state = { ...this.state, expandedFolderIds: ids };
    this.notify();
  }

  setSelectedFolder(folderId: string | undefined): void {
    this.state = { ...this.state, selectedFolderId: folderId };
    this.notify();
  }

  isExpanded(folderId: string): boolean {
    return this.state.expandedFolderIds.includes(folderId);
  }
}
