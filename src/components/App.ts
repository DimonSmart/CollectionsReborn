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
import { showConfirm, showInfo } from './ConfirmModal.js';
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

    // Top bar: search + mode select + add button in one row
    const topBar = document.createElement('div');
    topBar.className = 'top-bar';

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

    const modeSelect = document.createElement('select');
    modeSelect.className = 'mode-select';
    modeSelect.id = 'mode-select';
    modeSelect.setAttribute('aria-label', 'View mode');
    const modes: { value: ViewMode; label: string }[] = [
      { value: 'compact', label: 'Compact' },
      { value: 'normal', label: 'Normal' },
      { value: 'full', label: 'Full' },
    ];
    for (const m of modes) {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      modeSelect.appendChild(opt);
    }
    modeSelect.value = this.state.getState().viewMode;
    modeSelect.addEventListener('change', () => this.setMode(modeSelect.value as ViewMode));

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-icon btn-icon--primary';
    addBtn.setAttribute('aria-label', 'Add current page to favorites');
    addBtn.title = 'Add current page to favorites';
    addBtn.innerHTML = svgPlus();
    addBtn.addEventListener('click', () => this.handleAddFavorite());

    topBar.append(searchInput, modeSelect, addBtn);
    this.root.appendChild(topBar);

    // Collections list
    const list = document.createElement('main');
    list.id = 'collections-list';
    list.className = 'collections-list';
    list.setAttribute('aria-label', 'Collections');
    this.root.appendChild(list);
  }

  private render(state: CollectionViewState): void {
    this.updateModeSelect(state.viewMode);
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
        onEdit: (item, newTitle, newUrl) => this.editItem(item, newTitle, newUrl),
        onDelete: (item) => this.deleteItem(item),
        onRenameFolder: (f, newTitle) => this.renameFolder(f, newTitle),
        onDeleteFolder: (f) => this.deleteFolder(f),
        onAddToFolder: (folderId) => this.addCurrentTabToFolder(folderId),
      }, state.searchText);
      list.appendChild(section);
    }
  }

  private updateModeSelect(mode: ViewMode): void {
    const select = this.root.querySelector('#mode-select') as HTMLSelectElement | null;
    if (select && select.value !== mode) select.value = mode;
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
          return {
            ...folder,
            allItems: matchedItems,
            itemCount: matchedItems.length,
            expansionState: 'expanded' as const,
          };
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

  private async editItem(
    item: FavoriteItemViewModel,
    newTitle: string,
    newUrl: string,
  ): Promise<void> {
    await this.bookmarksService.updateBookmark(item.id, { title: newTitle, url: newUrl });
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

  private async deleteFolder(folder: FolderViewModel): Promise<void> {
    const msg =
      folder.itemCount > 0
        ? `Delete folder "${folder.title}" and all ${folder.itemCount} items inside?`
        : `Delete folder "${folder.title}"?`;
    const confirmed = await showConfirm(msg);
    if (!confirmed) return;
    await this.bookmarksService.removeFolder(folder.id);
    await this.reloadTree();
  }

  private async addCurrentTabToFolder(folderId: string): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab?.title) return;
    const folder = this.buildFolderViewModels().find((f) => f.id === folderId);
    if (folder?.allItems.some((item) => item.url === tab.url)) {
      await showInfo('This page is already in this collection.');
      return;
    }
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

function svgPlus(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}
