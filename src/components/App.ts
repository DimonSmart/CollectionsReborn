import type {
  FolderViewModel,
  FavoriteItemViewModel,
  CollectionViewState,
  ViewMode,
} from '../types.js';
import type { AppState } from '../state.js';
import type { BookmarksService } from '../services/bookmarksService.js';
import type { FaviconService } from '../services/faviconService.js';
import type { StorageService } from '../services/storageService.js';
import { createCollectionSection } from './CollectionSection.js';
import { showConfirm } from './ConfirmModal.js';
import { showAddFavoriteModal } from './AddFavoriteModal.js';

export class App {
  private root: HTMLElement;
  private bookmarkTree: chrome.bookmarks.BookmarkTreeNode[] = [];
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly state: AppState,
    private readonly bookmarksService: BookmarksService,
    private readonly faviconService: FaviconService,
    private readonly storageService: StorageService,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'panel';
  }

  async init(): Promise<void> {
    this.container.appendChild(this.root);
    this.root.innerHTML = buildSkeletonHTML();

    const [settings, tree] = await Promise.all([
      this.storageService.loadSettings(),
      this.bookmarksService.getTree(),
    ]);

    this.bookmarkTree = tree;

    // Apply viewMode first (it clears overrides on the empty default state),
    // then apply loaded overrides so they are not lost.
    if (settings.viewMode !== this.state.getState().viewMode) {
      this.state.setViewMode(settings.viewMode);
    }
    this.state.setExpansionOverrides(settings.folderExpansionOverrides);

    this.buildLayout();
    this.render(this.state.getState());

    this.state.subscribe((s) => this.render(s));
    this.attachBookmarkListeners();
  }

  private buildLayout(): void {
    this.root.innerHTML = '';

    // Search
    const searchBar = document.createElement('div');
    searchBar.className = 'search-bar';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'search-input';
    searchInput.placeholder = 'Search favorites…';
    searchInput.setAttribute('aria-label', 'Search favorites');
    searchInput.addEventListener('input', () => {
      if (this.searchDebounce) clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        this.state.setSearchText(searchInput.value);
      }, 150);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        this.state.setSearchText('');
      }
    });
    searchBar.appendChild(searchInput);
    this.root.appendChild(searchBar);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    const modeToggle = document.createElement('div');
    modeToggle.className = 'view-mode-toggle';
    modeToggle.setAttribute('role', 'group');
    modeToggle.setAttribute('aria-label', 'View mode');

    const compactBtn = document.createElement('button');
    compactBtn.className = 'mode-btn';
    compactBtn.id = 'btn-compact';
    compactBtn.textContent = 'Compact';
    compactBtn.setAttribute('aria-pressed', String(this.state.getState().viewMode === 'compact'));
    compactBtn.addEventListener('click', () => this.setMode('compact'));

    const normalBtn = document.createElement('button');
    normalBtn.className = 'mode-btn';
    normalBtn.id = 'btn-normal';
    normalBtn.textContent = 'Normal';
    normalBtn.setAttribute('aria-pressed', String(this.state.getState().viewMode === 'normal'));
    normalBtn.addEventListener('click', () => this.setMode('normal'));

    const fullBtn = document.createElement('button');
    fullBtn.className = 'mode-btn';
    fullBtn.id = 'btn-full';
    fullBtn.textContent = 'Full';
    fullBtn.setAttribute('aria-pressed', String(this.state.getState().viewMode === 'full'));
    fullBtn.addEventListener('click', () => this.setMode('full'));

    modeToggle.append(compactBtn, normalBtn, fullBtn);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn--primary btn--sm';
    addBtn.setAttribute('aria-label', 'Add current page to favorites');
    addBtn.innerHTML = `${svgPlus()} Add`;
    addBtn.addEventListener('click', () => this.handleAddFavorite());

    toolbar.append(modeToggle, addBtn);
    this.root.appendChild(toolbar);

    // Collections list
    const list = document.createElement('main');
    list.id = 'collections-list';
    list.className = 'collections-list';
    list.setAttribute('aria-label', 'Collections');
    this.root.appendChild(list);
  }

  private render(state: CollectionViewState): void {
    this.updateModeButtons(state.viewMode);
    this.root.dataset.mode = state.viewMode;

    const list = this.root.querySelector('#collections-list') as HTMLElement;
    if (!list) return;

    const folders = this.buildFolderViewModels();
    const filtered = this.filterFolders(folders, state.searchText);

    list.innerHTML = '';

    if (filtered.length === 0) {
      list.appendChild(buildEmptyState(state.searchText));
      return;
    }

    for (const folder of filtered) {
      const section = createCollectionSection(folder, state.viewMode, {
        onToggle: (id, itemCount) => {
          this.state.toggleFolder(id, itemCount);
          this.storageService.saveExpansionOverrides(this.state.getState().folderExpansionOverrides);
        },
        onOpen: (item) => this.openLink(item),
        onRename: (item, newTitle) => this.renameItem(item, newTitle),
        onDelete: (item) => this.deleteItem(item),
        onRenameFolder: (f, newTitle) => this.renameFolder(f, newTitle),
        onAddToFolder: (folderId) => this.addCurrentTabToFolder(folderId),
      }, state.searchText);
      list.appendChild(section);
    }
  }

  private updateModeButtons(mode: ViewMode): void {
    const compactBtn = this.root.querySelector('#btn-compact');
    const normalBtn = this.root.querySelector('#btn-normal');
    const fullBtn = this.root.querySelector('#btn-full');
    if (compactBtn && normalBtn && fullBtn) {
      compactBtn.classList.toggle('mode-btn--active', mode === 'compact');
      compactBtn.setAttribute('aria-pressed', String(mode === 'compact'));
      normalBtn.classList.toggle('mode-btn--active', mode === 'normal');
      normalBtn.setAttribute('aria-pressed', String(mode === 'normal'));
      fullBtn.classList.toggle('mode-btn--active', mode === 'full');
      fullBtn.setAttribute('aria-pressed', String(mode === 'full'));
    }
  }

  private buildFolderViewModels(): FolderViewModel[] {
    const root = this.bookmarkTree[0];
    if (!root?.children) return [];

    const folders: FolderViewModel[] = [];

    for (const container of root.children) {
      for (const node of container.children ?? []) {
        if (!node.url) {
          folders.push(this.nodeToFolderViewModel(node));
        }
      }
    }

    return folders;
  }

  private nodeToFolderViewModel(node: chrome.bookmarks.BookmarkTreeNode): FolderViewModel {
    const allItems = (node.children ?? [])
      .filter((c) => !!c.url)
      .map((c) => this.nodeToItemViewModel(c));

    const expansionState = this.state.getFolderExpansionState(node.id, allItems.length);

    return {
      id: node.id,
      title: node.title,
      itemCount: allItems.length,
      expansionState,
      allItems,
    };
  }

  private nodeToItemViewModel(node: chrome.bookmarks.BookmarkTreeNode): FavoriteItemViewModel {
    const url = node.url ?? '';
    const domain = this.faviconService.getDomain(url);
    return {
      id: node.id,
      title: node.title || domain || url,
      url,
      domain,
      faviconUrl: this.faviconService.getFaviconUrl(url, 32),
      parentId: node.parentId ?? '',
    };
  }

  private filterFolders(folders: FolderViewModel[], searchText: string): FolderViewModel[] {
    const q = searchText.trim().toLowerCase();
    if (!q) return folders;

    return folders
      .map((folder) => {
        const folderMatch = folder.title.toLowerCase().includes(q);
        const matchedItems = folder.allItems.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.url.toLowerCase().includes(q) ||
            item.domain.toLowerCase().includes(q),
        );

        if (folderMatch) {
          return { ...folder, expansionState: 'expanded' as const };
        }
        if (matchedItems.length > 0) {
          return { ...folder, allItems: matchedItems, itemCount: matchedItems.length, expansionState: 'expanded' as const };
        }
        return null;
      })
      .filter((f): f is FolderViewModel => f !== null);
  }

  private setMode(mode: ViewMode): void {
    this.state.setViewMode(mode);
    this.storageService.saveViewMode(mode);
    this.storageService.saveExpansionOverrides({});
  }

  private openLink(item: FavoriteItemViewModel): void {
    chrome.tabs.create({ url: item.url });
  }

  private async renameItem(item: FavoriteItemViewModel, newTitle: string): Promise<void> {
    await this.bookmarksService.updateTitle(item.id, newTitle);
    await this.reloadTree();
  }

  private async renameFolder(folder: FolderViewModel, newTitle: string): Promise<void> {
    await this.bookmarksService.updateTitle(folder.id, newTitle);
    await this.reloadTree();
  }

  private async deleteItem(item: FavoriteItemViewModel): Promise<void> {
    const confirmed = await showConfirm(`Delete "${item.title}"?`);
    if (!confirmed) return;
    await this.bookmarksService.remove(item.id);
    await this.reloadTree();
  }

  private async addCurrentTabToFolder(folderId: string): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab?.title) return;
    await this.bookmarksService.createBookmark(folderId, tab.title, tab.url);
    await this.reloadTree();
  }

  private async handleAddFavorite(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab?.title) return;

    const folders = this.buildFolderViewModels();

    const result = await showAddFavoriteModal(tab.url, tab.title, folders);
    if (!result) return;

    await this.bookmarksService.createBookmark(result.folderId, result.title, result.url);
    await this.reloadTree();
  }

  private async reloadTree(): Promise<void> {
    this.bookmarkTree = await this.bookmarksService.getTree();
    this.render(this.state.getState());
  }

  private attachBookmarkListeners(): void {
    const reload = () => this.reloadTree();
    this.bookmarksService.onCreated(reload);
    this.bookmarksService.onRemoved(reload);
    this.bookmarksService.onChanged(reload);
    this.bookmarksService.onMoved(reload);
    this.bookmarksService.onImportEnded(reload);
  }
}

function buildSkeletonHTML(): string {
  return `
    <div class="skeleton-panel">
      <div class="skeleton-search"></div>
      <div class="skeleton-sections">
        ${Array.from({ length: 4 }).map(() => `
          <div class="skeleton-section">
            <div class="skeleton-row skeleton-row--header"></div>
            <div class="skeleton-row"></div>
            <div class="skeleton-row skeleton-row--short"></div>
            <div class="skeleton-row"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function buildEmptyState(searchText: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'empty-state';
  if (searchText.trim()) {
    el.innerHTML = `
      <p class="empty-state__title">No results for &ldquo;${escapeHtml(searchText)}&rdquo;</p>
      <p class="empty-state__hint">Try a different search term.</p>
    `;
  } else {
    el.innerHTML = `
      <p class="empty-state__title">No favorites yet</p>
      <p class="empty-state__hint">Add the current page to start building your collections.</p>
    `;
  }
  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function svgCollections(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
}

function svgPlus(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}
