import type { CollectionViewState, ViewMode } from './types.js';
import { PREVIEW_LIMIT } from './types.js';

type Listener = (state: CollectionViewState) => void;

const DEFAULT_STATE: CollectionViewState = {
  folderExpansionOverrides: {},
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
    this.state = { ...this.state, viewMode, folderExpansionOverrides: {} };
    this.notify();
  }

  setSearchText(searchText: string): void {
    if (this.state.searchText === searchText) return;
    this.state = { ...this.state, searchText };
    this.notify();
  }

  toggleFolder(folderId: string, itemCount: number): void {
    const mode = this.state.viewMode;
    const override = this.state.folderExpansionOverrides[folderId];
    const current = computeEffectiveState(mode, itemCount, override);
    const next = computeNextState(mode, itemCount, current);
    const def = computeDefaultState(mode, itemCount);

    const overrides = { ...this.state.folderExpansionOverrides };
    if (next === def || next === 'preview') {
      delete overrides[folderId];
    } else {
      overrides[folderId] = next;
    }
    this.state = { ...this.state, folderExpansionOverrides: overrides };
    this.notify();
  }

  setExpansionOverrides(overrides: Record<string, 'collapsed' | 'expanded'>): void {
    this.state = { ...this.state, folderExpansionOverrides: overrides };
    this.notify();
  }

  setSelectedFolder(folderId: string | undefined): void {
    this.state = { ...this.state, selectedFolderId: folderId };
    this.notify();
  }

  getFolderExpansionState(folderId: string, itemCount: number): 'collapsed' | 'preview' | 'expanded' {
    const override = this.state.folderExpansionOverrides[folderId];
    return computeEffectiveState(this.state.viewMode, itemCount, override);
  }
}

function computeDefaultState(mode: ViewMode, itemCount: number): 'collapsed' | 'preview' | 'expanded' {
  if (mode === 'compact') return 'collapsed';
  if (mode === 'full') return 'expanded';
  return itemCount > PREVIEW_LIMIT ? 'preview' : 'expanded';
}

function computeEffectiveState(
  mode: ViewMode,
  itemCount: number,
  override: 'collapsed' | 'expanded' | undefined,
): 'collapsed' | 'preview' | 'expanded' {
  if (override !== undefined) return override;
  return computeDefaultState(mode, itemCount);
}

function computeNextState(
  mode: ViewMode,
  itemCount: number,
  current: 'collapsed' | 'preview' | 'expanded',
): 'collapsed' | 'preview' | 'expanded' {
  if (current === 'expanded') return 'collapsed';
  if (current === 'preview') return 'expanded';
  // collapsed → preview (normal mode with >N items) or expanded otherwise
  if (mode === 'normal' && itemCount > PREVIEW_LIMIT) return 'preview';
  return 'expanded';
}
