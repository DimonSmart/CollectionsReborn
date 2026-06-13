import type {
  BookmarkEntryViewModel,
  FolderEntryViewModel,
  LinkEntryViewModel,
  FolderChoice,
} from '../types.js';
import type { BookmarksService } from '../services/bookmarksService.js';
import type { FaviconService } from '../services/faviconService.js';
import type { StorageService } from '../services/storageService.js';
import { createFolderView } from './FolderView.js';
import { showConfirm, showInfo } from './ConfirmModal.js';
import { showLinkEditor, showFolderEditor } from './ItemEditor.js';
import { showMoveToDialog } from './MoveToDialog.js';
import { showAddFavoriteModal } from './AddFavoriteModal.js';

export class App {
  private root: HTMLElement;
  private bookmarkTree: chrome.bookmarks.BookmarkTreeNode[] = [];
  private currentFolderId: string = '1';
  private searchText: string = '';
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly container: HTMLElement,
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
    this.currentFolderId = this.resolveStartupFolder(settings.currentFolderId);

    this.buildLayout();
    this.render();
    this.attachBookmarkListeners();
  }

  private resolveStartupFolder(savedId?: string): string {
    if (savedId && this.findNodeById(savedId)) return savedId;
    const root = this.bookmarkTree[0];
    if (root?.children?.length) return root.children[0].id;
    return '1';
  }

  private buildLayout(): void {
    this.root.innerHTML = '';

    const topBar = document.createElement('div');
    topBar.className = 'top-bar';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'search-input';
    searchInput.placeholder = 'Search in folder…';
    searchInput.setAttribute('aria-label', 'Search in current folder');
    searchInput.addEventListener('input', () => {
      if (this.searchDebounce) clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        this.searchText = searchInput.value;
        this.render();
      }, 150);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        this.searchText = '';
        this.render();
      }
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-icon btn-icon--primary';
    addBtn.setAttribute('aria-label', 'Add current page to favorites');
    addBtn.title = 'Add current page to favorites';
    addBtn.innerHTML = svgPlus();
    addBtn.addEventListener('click', () => this.handleAddFavorite());

    topBar.append(searchInput, addBtn);
    this.root.appendChild(topBar);

    const viewContainer = document.createElement('main');
    viewContainer.id = 'folder-view-container';
    viewContainer.className = 'folder-view-container';
    this.root.appendChild(viewContainer);
  }

  private render(): void {
    const container = this.root.querySelector('#folder-view-container') as HTMLElement | null;
    if (!container) return;

    const currentNode = this.findNodeById(this.currentFolderId);
    if (!currentNode) {
      // Folder was deleted externally — fall back to startup folder
      this.currentFolderId = this.resolveStartupFolder();
      const fallback = this.findNodeById(this.currentFolderId);
      if (!fallback) {
        container.innerHTML = '';
        container.appendChild(buildEmptyState(''));
        return;
      }
      this.renderFolder(container, fallback);
      return;
    }

    this.renderFolder(container, currentNode);
  }

  private renderFolder(
    container: HTMLElement,
    node: chrome.bookmarks.BookmarkTreeNode,
  ): void {
    const entries = this.buildEntries(node);
    const filtered = this.filterEntries(entries, this.searchText);
    const canGoBack = this.canGoBack();
    const isSearching = this.searchText.trim().length > 0;

    const view = createFolderView(
      { id: node.id, title: this.displayTitle(node) },
      filtered,
      canGoBack,
      isSearching,
      {
        onNavigateToFolder: (id) => this.navigateTo(id),
        onNavigateBack: () => this.navigateBack(),
        onOpenLink: (url) => chrome.tabs.create({ url }),
        onEditLink: (item) => this.editLink(item),
        onDeleteItem: (item) => this.deleteItem(item),
        onRenameFolder: (item) => this.renameFolder(item),
        onMoveItem: (item) => this.moveItem(item),
        onReorder: (itemId, newIndex) => this.reorderItem(itemId, newIndex),
      },
    );

    container.innerHTML = '';
    container.appendChild(view);
  }

  private displayTitle(node: chrome.bookmarks.BookmarkTreeNode): string {
    if (node.title) return node.title;
    // Fallback labels for known system container IDs
    if (node.id === '1') return 'Bookmarks Bar';
    if (node.id === '2') return 'Other Bookmarks';
    if (node.id === '3') return 'Mobile Bookmarks';
    return 'Bookmarks';
  }

  private buildEntries(node: chrome.bookmarks.BookmarkTreeNode): BookmarkEntryViewModel[] {
    return (node.children ?? []).map((child) => {
      if (child.url) {
        const domain = this.faviconService.getDomain(child.url);
        return {
          type: 'link' as const,
          id: child.id,
          parentId: child.parentId ?? '',
          index: child.index ?? 0,
          title: child.title || domain || child.url,
          url: child.url,
          domain,
          faviconUrl: this.faviconService.getFaviconUrl(child.url, 16),
        };
      } else {
        return {
          type: 'folder' as const,
          id: child.id,
          parentId: child.parentId ?? '',
          index: child.index ?? 0,
          title: child.title,
          childCount: (child.children ?? []).length,
        };
      }
    });
  }

  private filterEntries(entries: BookmarkEntryViewModel[], searchText: string): BookmarkEntryViewModel[] {
    const q = searchText.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      if (e.title.toLowerCase().includes(q)) return true;
      if (e.type === 'link') {
        return e.url.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q);
      }
      return false;
    });
  }

  private findNodeById(id: string): chrome.bookmarks.BookmarkTreeNode | null {
    const search = (nodes: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) {
          const found = search(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.bookmarkTree);
  }

  private getVirtualRootId(): string {
    return this.bookmarkTree[0]?.id ?? '0';
  }

  private canGoBack(): boolean {
    const node = this.findNodeById(this.currentFolderId);
    return node?.parentId !== undefined && node.parentId !== this.getVirtualRootId();
  }

  private navigateTo(folderId: string): void {
    this.currentFolderId = folderId;
    this.searchText = '';
    const searchInput = this.root.querySelector<HTMLInputElement>('.search-input');
    if (searchInput) searchInput.value = '';
    this.render();
    this.storageService.saveCurrentFolder(folderId);
  }

  private navigateBack(): void {
    const node = this.findNodeById(this.currentFolderId);
    const virtualRootId = this.getVirtualRootId();
    if (node?.parentId && node.parentId !== virtualRootId) {
      this.navigateTo(node.parentId);
    }
  }

  private async editLink(item: LinkEntryViewModel): Promise<void> {
    const result = await showLinkEditor(item.title, item.url);
    if (!result) return;
    await this.bookmarksService.updateBookmark(item.id, { title: result.title, url: result.url });
    await this.reloadTree();
  }

  private async renameFolder(item: FolderEntryViewModel): Promise<void> {
    const newName = await showFolderEditor(item.title);
    if (!newName || newName === item.title) return;
    await this.bookmarksService.updateTitle(item.id, newName);
    await this.reloadTree();
  }

  private async deleteItem(item: BookmarkEntryViewModel): Promise<void> {
    const label = item.type === 'folder' ? 'folder' : 'bookmark';
    const confirmed = await showConfirm(`Delete ${label} "${item.title}"?`);
    if (!confirmed) return;
    try {
      if (item.type === 'folder') {
        await this.bookmarksService.removeFolder(item.id);
      } else {
        await this.bookmarksService.remove(item.id);
      }
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not delete: ${String(err)}`);
    }
  }

  private async moveItem(item: BookmarkEntryViewModel): Promise<void> {
    const allFolders = this.collectAllFolders();
    const targetId = await showMoveToDialog(item, allFolders, this.bookmarkTree);
    if (!targetId) return;
    try {
      await this.bookmarksService.move(item.id, targetId);
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not move: ${String(err)}`);
    }
  }

  private async reorderItem(itemId: string, newIndex: number): Promise<void> {
    try {
      await this.bookmarksService.move(itemId, this.currentFolderId, newIndex);
      // onMoved listener will trigger reloadTree; explicit call only needed on error
    } catch (err) {
      console.error('Reorder failed:', err);
      await this.reloadTree();
    }
  }

  private collectAllFolders(): FolderChoice[] {
    const folders: FolderChoice[] = [];
    const root = this.bookmarkTree[0];
    if (!root?.children) return folders;

    const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string, depth: number) => {
      for (const n of nodes) {
        if (!n.url) {
          const nodePath = path ? `${path} / ${n.title}` : n.title;
          folders.push({ id: n.id, title: n.title, path: nodePath, depth });
          traverse(n.children ?? [], nodePath, depth + 1);
        }
      }
    };

    traverse(root.children, '', 0);
    return folders;
  }

  private async handleAddFavorite(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab?.title) return;

    const allFolders = this.collectAllFolders();
    const result = await showAddFavoriteModal(tab.url, tab.title, allFolders, this.currentFolderId);
    if (!result) return;

    await this.bookmarksService.createBookmark(result.folderId, result.title, result.url);
    await this.reloadTree();
  }

  private async reloadTree(): Promise<void> {
    this.bookmarkTree = await this.bookmarksService.getTree();
    this.render();
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
        ${Array.from({ length: 5 }).map(() => `
          <div class="skeleton-row"></div>
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
      <p class="empty-state__title">No bookmarks yet</p>
      <p class="empty-state__hint">Add the current page with the + button.</p>
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
