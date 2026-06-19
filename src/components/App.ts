import type {
  BookmarkEntryViewModel,
  FolderInsertPlacement,
  FolderEntryViewModel,
  LinkEntryViewModel,
  SortAction,
} from '../types.js';
import type { BookmarksService } from '../services/bookmarksService.js';
import type { FaviconService } from '../services/faviconService.js';
import type { StorageService } from '../services/storageService.js';
import type { BookmarkOperationsService } from '../services/bookmarkOperationsService.js';
import type { BrowserTabsService } from '../services/browserTabsService.js';
import type { PreviewDbService, PreviewRecord } from '../services/previewDbService.js';
import {
  DEFAULT_PREVIEW_SIZE,
  PREVIEW_SETTINGS_STORAGE_KEY,
  type PreviewSettingsService,
  type PreviewSize,
} from '../services/previewSettingsService.js';
import type { PreviewCaptureService } from '../services/previewCaptureService.js';
import { createFolderView } from './FolderView.js';
import { showConfirm, showInfo } from './ConfirmModal.js';
import { showLinkEditor, showFolderEditor } from './ItemEditor.js';
import { showMoveToDialog } from './MoveToDialog.js';
import { showAddFavoriteModal } from './AddFavoriteModal.js';
import { showActionsMenu, type MenuItem } from './ActionsMenu.js';
import {
  findNodeById,
  getVirtualRootId,
  getRootFolders,
  resolveStartupFolder,
  canNavigateBack,
  buildFolderEntries,
  filterEntries,
  searchBookmarkTree,
  collectAllFolders,
} from '../domain/bookmarkTree.js';
import { getFolderPreviewKey, getLinkPreviewKey } from '../domain/previewKeys.js';
import { PREVIEW_CAPTURE_PERMISSION_ORIGINS } from '../domain/previewPermissions.js';
import { validatePreviewUrl } from '../domain/previewUrlRules.js';
import { getBookmarkCapabilities, type BookmarkCapabilities } from '../domain/bookmarkCapabilities.js';
import { BingSavesImportView } from './BingSavesImportView.js';
import { PreviewSettingsView } from './PreviewSettingsView.js';

export class App {
  private root: HTMLElement;
  private bookmarkTree: chrome.bookmarks.BookmarkTreeNode[] = [];
  private currentFolderId: string = '0';
  private searchText: string = '';
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
  private previewObjectUrls: string[] = [];
  private previewSize: PreviewSize = DEFAULT_PREVIEW_SIZE;
  private renderVersion = 0;
  private viewMode: 'bookmarks' | 'settings' | 'bing-import' = 'bookmarks';

  constructor(
    private readonly container: HTMLElement,
    private readonly bookmarksService: BookmarksService,
    private readonly faviconService: FaviconService,
    private readonly storageService: StorageService,
    private readonly operationsService: BookmarkOperationsService,
    private readonly tabsService: BrowserTabsService,
    private readonly previewDb: PreviewDbService,
    private readonly previewSettings: PreviewSettingsService,
    private readonly previewCapture: PreviewCaptureService,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'panel';
  }

  async init(): Promise<void> {
    this.container.appendChild(this.root);
    this.root.innerHTML = buildSkeletonHTML();

    const [settings, tree, previewSettings] = await Promise.all([
      this.storageService.loadSettings(),
      this.bookmarksService.getTree(),
      this.previewSettings.load(),
    ]);

    this.bookmarkTree = tree;
    this.currentFolderId = resolveStartupFolder(tree, settings.currentFolderId);
    this.previewSize = previewSettings.previewSize;

    this.buildLayout();
    this.render();
    this.attachBookmarkListeners();
    this.attachPreviewSettingsListener();
    if (!settings.edgeCollectionsImportPromptShown) void this.showEdgeCollectionsImport();
  }

  private buildLayout(): void {
    this.root.innerHTML = '';

    const folderTitle = document.createElement('div');
    folderTitle.className = 'current-folder-title';
    folderTitle.setAttribute('role', 'heading');
    folderTitle.setAttribute('aria-level', '1');

    const topBar = document.createElement('div');
    topBar.className = 'top-bar';

    const upBtn = document.createElement('button');
    upBtn.className = 'btn-icon top-folder-up-btn';
    upBtn.setAttribute('aria-label', 'Go to parent folder');
    upBtn.title = 'Go to parent folder';
    upBtn.innerHTML = svgFolderUp();
    upBtn.addEventListener('click', () => this.navigateBack());

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'search-input';
    searchInput.placeholder = 'Search bookmarks…';
    searchInput.setAttribute('aria-label', 'Search bookmarks');
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

    const menuBtn = document.createElement('button');
    menuBtn.className = 'btn-icon top-menu-btn';
    menuBtn.setAttribute('aria-label', 'Folder actions');
    menuBtn.title = 'Folder actions';
    menuBtn.innerHTML = svgEllipsis();
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showTopMenu(menuBtn);
    });

    topBar.append(upBtn, searchInput, addBtn, menuBtn);
    this.root.append(folderTitle, topBar);

    const viewContainer = document.createElement('main');
    viewContainer.id = 'folder-view-container';
    viewContainer.className = 'folder-view-container';
    this.root.appendChild(viewContainer);
  }

  private render(): void {
    const container = this.root.querySelector('#folder-view-container') as HTMLElement | null;
    if (!container) return;

    let currentNode = findNodeById(this.bookmarkTree, this.currentFolderId);
    if (!currentNode) {
      this.currentFolderId = resolveStartupFolder(this.bookmarkTree);
      currentNode = findNodeById(this.bookmarkTree, this.currentFolderId);
      if (!currentNode) {
        container.innerHTML = '';
        container.appendChild(buildEmptyState(''));
        return;
      }
    }

    this.renderFolder(container, currentNode);
    this.updateTopBar();
  }

  private renderFolder(
    container: HTMLElement,
    node: chrome.bookmarks.BookmarkTreeNode,
  ): void {
    this.revokePreviewObjectUrls();
    const version = ++this.renderVersion;
    const isSearching = this.searchText.trim().length > 0;
    const entries = buildFolderEntries(this.bookmarkTree, node, this.faviconService);
    const filtered = isSearching
      ? searchBookmarkTree(this.bookmarkTree, this.searchText, this.faviconService)
      : filterEntries(entries, this.searchText);
    const folderCapabilities = getBookmarkCapabilities(this.bookmarkTree, node);
    const canDragItems = !isSearching && folderCapabilities.canCreateChildren;
    const canReorder = !isSearching && folderCapabilities.canSortChildren;

    const view = createFolderView(
      { id: node.id, title: this.displayTitle(node) },
      filtered,
      isSearching,
      canDragItems,
      canReorder,
      this.previewSize,
      {
        onNavigateToFolder: (id) => this.navigateTo(id),
        onNavigateBack: () => this.navigateBack(),
        onOpenLink: (item) => void this.openLink(item),
        onEditLink: (item) => this.editLink(item),
        onDeleteItem: (item) => this.deleteItem(item),
        onRenameFolder: (item) => this.renameFolder(item),
        onMoveItem: (item) => this.moveItem(item),
        onCreateFolderNearItem: (item, placement) => this.createFolderNearItem(item, placement),
        onGeneratePreview: (item) => void this.generatePreview(item),
        onRemovePreview: (item) => void this.removePreview(item),
        onUpdateLinkUrlFromCurrentTab: (item) => void this.updateLinkUrlFromCurrentTab(item),
        onReorder: (itemId, newIndex) => this.reorderItem(itemId, newIndex),
        onMoveIntoFolder: (itemId, folderId) => this.moveItemIntoFolder(itemId, folderId),
        onSortFolder: (action) => this.sortFolder(action),
      },
    );

    container.innerHTML = '';
    container.appendChild(view);
    void this.loadPreviewsForEntries(container, node, filtered, version);
  }

  private displayTitle(node: chrome.bookmarks.BookmarkTreeNode): string {
    if (node.id === getVirtualRootId(this.bookmarkTree)) return 'All bookmarks';
    if (node.title) return node.title;
    return 'Bookmarks';
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
    const node = findNodeById(this.bookmarkTree, this.currentFolderId);
    if (node?.parentId) {
      this.navigateTo(node.parentId);
    }
  }

  private async editLink(item: LinkEntryViewModel): Promise<void> {
    if (!(await this.requireCapability(item.id, 'canEditUrl', 'This bookmark cannot be edited.'))) return;
    const result = await showLinkEditor(item.title, item.url);
    if (!result) return;
    if (!(await this.requireCapability(item.id, 'canEditUrl', 'This bookmark cannot be edited.'))) return;
    if (result.url !== item.url) {
      await this.previewDb.delete(getLinkPreviewKey(item.id));
    }
    try {
      await this.operationsService.editLink(item.id, result.title, result.url);
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not edit bookmark: ${String(err)}`);
    }
  }

  private async updateLinkUrlFromCurrentTab(item: LinkEntryViewModel): Promise<void> {
    if (!(await this.requireCapability(item.id, 'canEditUrl', 'This bookmark URL cannot be edited.'))) return;
    const tab = await this.tabsService.getActiveTab();
    if (!tab?.url) {
      await showInfo('No active page URL is available.');
      return;
    }
    if (!validatePreviewUrl(tab.url).ok) {
      await showInfo('The active page URL cannot be saved as a bookmark.');
      return;
    }
    if (tab.url === item.url) {
      await showInfo('This bookmark already uses the active page URL.');
      return;
    }

    const confirmed = await showConfirm(`Update "${item.title}" URL to the active page?`, {
      confirmLabel: 'Update',
      confirmVariant: 'primary',
    });
    if (!confirmed) return;
    if (!(await this.requireCapability(item.id, 'canEditUrl', 'This bookmark URL cannot be edited.'))) return;

    await this.previewDb.delete(getLinkPreviewKey(item.id));
    try {
      await this.operationsService.editLink(item.id, item.title, tab.url);
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not update bookmark URL: ${String(err)}`);
    }
  }

  private async renameFolder(item: FolderEntryViewModel): Promise<void> {
    if (!(await this.requireCapability(item.id, 'canRename', 'This browser folder cannot be renamed.'))) return;
    const newName = await showFolderEditor(item.title);
    if (!newName || newName === item.title) return;
    if (!(await this.requireCapability(item.id, 'canRename', 'This browser folder cannot be renamed.'))) return;
    try {
      await this.operationsService.renameFolder(item.id, newName);
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not rename folder: ${String(err)}`);
    }
  }

  private async deleteItem(item: BookmarkEntryViewModel): Promise<void> {
    if (!(await this.requireCapability(item.id, 'canDelete', 'This item cannot be deleted.'))) return;
    const label = item.type === 'folder' ? 'folder' : 'bookmark';
    const confirmed = await showConfirm(`Delete ${label} "${item.title}"?`);
    if (!confirmed) return;
    if (!(await this.requireCapability(item.id, 'canDelete', 'This item cannot be deleted.'))) return;
    try {
      await this.operationsService.deleteItem(item);
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not delete: ${String(err)}`);
    }
  }

  private async moveItem(item: BookmarkEntryViewModel): Promise<void> {
    if (!(await this.requireCapability(item.id, 'canMove', 'This item cannot be moved.'))) return;
    const allFolders = collectAllFolders(this.bookmarkTree);
    const result = await showMoveToDialog(item, allFolders, this.bookmarkTree);
    if (!result) return;
    if (!(await this.requireCapability(item.id, 'canMove', 'This item cannot be moved.'))) return;
    if (!(await this.requireCapability(result.folderId, 'canCreateChildren', 'The selected folder is read-only.'))) return;
    try {
      await this.operationsService.moveItemToFolder(item.id, result);
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not move: ${String(err)}`);
    }
  }

  private async reorderItem(itemId: string, newIndex: number): Promise<void> {
    if (!(await this.requireCapability(itemId, 'canMove', 'This item cannot be moved.'))) return;
    if (!(await this.requireCapability(this.currentFolderId, 'canSortChildren', 'Items in this folder cannot be reordered.'))) return;
    try {
      await this.operationsService.reorderItemInFolder(itemId, this.currentFolderId, newIndex);
    } catch (err) {
      console.error('Reorder failed:', err);
      await this.reloadTree();
    }
  }

  private async moveItemIntoFolder(itemId: string, folderId: string): Promise<void> {
    if (!(await this.requireCapability(itemId, 'canMove', 'This item cannot be moved.'))) return;
    if (!(await this.requireCapability(folderId, 'canCreateChildren', 'The destination folder is read-only.'))) return;
    try {
      await this.operationsService.moveItemToFolder(itemId, { folderId, placement: 'end' });
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not move into folder: ${String(err)}`);
      await this.reloadTree();
    }
  }

  private async sortFolder(action: SortAction): Promise<void> {
    const node = findNodeById(this.bookmarkTree, this.currentFolderId);
    if (!node) return;
    if (!(await this.requireCapability(node.id, 'canSortChildren', 'This folder cannot be sorted.'))) return;
    const entries = buildFolderEntries(this.bookmarkTree, node, this.faviconService);
    try {
      await this.operationsService.sortFolder(this.currentFolderId, entries, action);
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not sort: ${String(err)}`);
      await this.reloadTree();
    }
  }

  private showTopMenu(anchor: HTMLElement): void {
    const node = findNodeById(this.bookmarkTree, this.currentFolderId);
    if (!node) return;

    const isSearching = this.searchText.trim().length > 0;
    const capabilities = getBookmarkCapabilities(this.bookmarkTree, node);
    const canSort = !isSearching && capabilities.canSortChildren;

    const items: MenuItem[] = [{
      label: 'New folder…',
      action: () => this.createFolder(),
      disabled: !capabilities.canCreateChildren,
      disabledReason: 'A folder cannot be created here',
    }];

    items.push({ type: 'separator' });
    items.push({
      label: 'Folders first',
      action: () => void this.sortFolder('folders-first'),
      disabled: !canSort,
      disabledReason: 'This folder cannot be sorted',
    });
    items.push({
      label: 'Links first',
      action: () => void this.sortFolder('links-first'),
      disabled: !canSort,
      disabledReason: 'This folder cannot be sorted',
    });
    items.push({
      label: 'Sort by title A-Z',
      action: () => void this.sortFolder('title-asc'),
      disabled: !canSort,
      disabledReason: 'This folder cannot be sorted',
    });
    items.push({
      label: 'Sort by title Z-A',
      action: () => void this.sortFolder('title-desc'),
      disabled: !canSort,
      disabledReason: 'This folder cannot be sorted',
    });
    items.push({
      label: 'Sort links by domain',
      action: () => void this.sortFolder('domain-asc'),
      disabled: !canSort,
      disabledReason: 'This folder cannot be sorted',
    });
    items.push({ type: 'separator' });
    items.push({
      label: 'Settings…',
      action: () => void this.showSettingsView(),
    });

    showActionsMenu(anchor, items);
  }

  private async showEdgeCollectionsImport(onClose = () => this.showBookmarksView()): Promise<void> {
    this.viewMode = 'bing-import';
    this.revokePreviewObjectUrls();
    const view = new BingSavesImportView(
      this.root,
      this.currentFolderId,
      this.bookmarksService,
      this.storageService,
      onClose,
    );
    try {
      await view.init();
    } catch {
      onClose();
      await showInfo('Could not open the Edge Collections importer.');
    }
  }

  private async showSettingsView(): Promise<void> {
    this.viewMode = 'settings';
    this.revokePreviewObjectUrls();
    const view = new PreviewSettingsView(
      this.root,
      this.previewDb,
      this.previewSettings,
      this.storageService,
      () => this.showBookmarksView(),
      () => void this.showEdgeCollectionsImport(() => void this.showSettingsView()),
    );
    try {
      await view.init();
    } catch {
      this.showBookmarksView();
      await showInfo('Could not open settings.');
    }
  }

  private showBookmarksView(): void {
    this.viewMode = 'bookmarks';
    this.buildLayout();
    this.render();
  }

  private async createFolder(): Promise<void> {
    if (!(await this.requireCapability(this.currentFolderId, 'canCreateChildren', 'A folder cannot be created here.'))) return;

    const title = await showFolderEditor('New folder', {
      ariaLabel: 'Create new folder',
      heading: 'New folder',
      saveLabel: 'Create',
    });
    if (!title) return;
    if (!(await this.requireCapability(this.currentFolderId, 'canCreateChildren', 'A folder cannot be created here.'))) return;

    try {
      await this.bookmarksService.createFolder(this.currentFolderId, title);
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not create folder: ${String(err)}`);
      await this.reloadTree();
    }
  }

  private async createFolderNearItem(
    item: BookmarkEntryViewModel,
    placement: FolderInsertPlacement,
  ): Promise<void> {
    const capability = placement === 'before' ? 'canCreateFolderBefore' : 'canCreateFolderAfter';
    if (!(await this.requireCapability(item.id, capability, 'A folder cannot be created here.'))) return;
    const targetIndex = placement === 'before' ? item.index : item.index + 1;
    const title = await showFolderEditor('New folder', {
      ariaLabel: 'Create new folder',
      heading: 'New folder',
      saveLabel: 'Create',
    });
    if (!title) return;
    if (!(await this.requireCapability(item.id, capability, 'A folder cannot be created here.'))) return;

    try {
      await this.bookmarksService.createFolder(item.parentId, title, targetIndex);
      await this.reloadTree();
    } catch (err) {
      await showInfo(`Could not create folder: ${String(err)}`);
      await this.reloadTree();
    }
  }

  private async handleAddFavorite(): Promise<void> {
    const tab = await this.tabsService.getCurrentTab();
    if (!tab) {
      await showInfo('This page cannot be added to bookmarks.');
      return;
    }

    const allFolders = collectAllFolders(this.bookmarkTree);
    const vrId = getVirtualRootId(this.bookmarkTree);
    let defaultFolderId: string | undefined;
    if (this.currentFolderId !== vrId) {
      defaultFolderId = this.currentFolderId;
    } else {
      const rootFolders = getRootFolders(this.bookmarkTree);
      defaultFolderId = rootFolders[0]?.id;
    }

    const previewSettings = await this.previewSettings.load();
    const shouldCapturePreview = previewSettings.enabled && validatePreviewUrl(tab.url).ok;
    let canCapturePreview = false;

    const result = await showAddFavoriteModal(tab.url, tab.title, allFolders, defaultFolderId, {
      beforeAdd: async () => {
        canCapturePreview = shouldCapturePreview
          ? await hasPreviewCapturePermission()
          : false;
        return true;
      },
    });
    if (!result) return;

    if (!(await this.requireCapability(result.folderId, 'canCreateChildren', 'A bookmark cannot be created in this folder.'))) return;

    const created = await this.bookmarksService.createBookmark(result.folderId, result.title, result.url);
    if (canCapturePreview) {
      void this.captureNewFavoritePreview(created, result.title, result.url);
    }
    await this.reloadTree();
  }

  private async openLink(item: LinkEntryViewModel): Promise<void> {
    const settings = await this.previewSettings.load();
    const existing = settings.enabled
      ? await this.previewDb.get(getLinkPreviewKey(item.id))
      : undefined;
    const shouldGenerate = settings.enabled
      && !(existing?.status === 'ok' && existing.blob);
    const hasPermission = shouldGenerate ? await hasPreviewCapturePermission() : true;

    const tab = await this.tabsService.openUrl(item.url);
    if (!shouldGenerate || !tab.id || tab.windowId === undefined) return;

    if (!hasPermission) {
      await this.previewDb.saveError({
        key: getLinkPreviewKey(item.id),
        bookmarkId: item.id,
        kind: 'link',
        errorCode: 'permission-denied',
        sourceUrl: item.url,
        sourceTitle: item.title,
      });
      return;
    }

    const loaded = await this.tabsService.waitForTabComplete(tab.id, 15_000);
    if (!loaded) {
      await this.previewDb.saveError({
        key: getLinkPreviewKey(item.id),
        bookmarkId: item.id,
        kind: 'link',
        errorCode: 'navigation-timeout',
        sourceUrl: item.url,
        sourceTitle: item.title,
      });
      return;
    }

    await this.previewCapture.captureVisibleTabInWindow({
      bookmarkId: item.id,
      title: item.title,
      url: item.url,
      windowId: tab.windowId,
    });
    await this.rebuildParentFolderComposite(item.parentId);
    await this.reloadTree();
  }

  private async captureNewFavoritePreview(
    created: chrome.bookmarks.BookmarkTreeNode,
    title: string,
    url: string,
  ): Promise<void> {
    try {
      const settings = await this.previewSettings.load();
      if (!settings.enabled) return;
      const tab = await this.tabsService.getActiveTab();
      const windowId = tab?.windowId;
      if (windowId === undefined) return;
      const result = await this.previewCapture.captureVisibleTabInWindow({
        bookmarkId: created.id,
        title,
        url,
        windowId,
      });
      if (!result.ok) console.warn('Preview capture failed:', result.errorCode, result.errorMessage);
      await this.rebuildParentFolderComposite(created.parentId ?? '');
      await this.reloadTree();
    } catch (err) {
      console.warn('Preview capture failed:', err);
    }
  }

  private async generatePreview(item: BookmarkEntryViewModel): Promise<void> {
    try {
      if (item.type === 'folder') {
        await this.rebuildFolderComposite(item.id);
        await this.reloadTree();
        return;
      }

      if (!validatePreviewUrl(item.url).ok) {
        await this.previewDb.saveError({
          key: getLinkPreviewKey(item.id),
          bookmarkId: item.id,
          kind: 'link',
          errorCode: 'unsupported-url',
          sourceUrl: item.url,
          sourceTitle: item.title,
        });
        await this.reloadTree();
        await showInfo('Preview can only be generated for http and https pages.');
        return;
      }

      const hasPermission = await hasPreviewCapturePermission();
      if (!hasPermission) {
        await this.previewDb.saveError({
          key: getLinkPreviewKey(item.id),
          bookmarkId: item.id,
          kind: 'link',
          errorCode: 'permission-denied',
          sourceUrl: item.url,
          sourceTitle: item.title,
        });
        await this.reloadTree();
        await showInfo(getMissingPreviewPermissionMessage());
        return;
      }

      let result;
      const active = await this.tabsService.getActiveTab();
      if (active?.url === item.url && active.windowId !== undefined) {
        result = await this.previewCapture.captureVisibleTabInWindow({
          bookmarkId: item.id,
          title: item.title,
          url: item.url,
          windowId: active.windowId,
        });
      } else {
        const tab = await this.tabsService.openUrl(item.url);
        if (tab.id && tab.windowId !== undefined) {
          const loaded = await this.tabsService.waitForTabComplete(tab.id, 15_000);
          if (loaded) {
            result = await this.previewCapture.captureVisibleTabInWindow({
              bookmarkId: item.id,
              title: item.title,
              url: item.url,
              windowId: tab.windowId,
            });
          } else {
            await this.previewDb.saveError({
              key: getLinkPreviewKey(item.id),
              bookmarkId: item.id,
              kind: 'link',
              errorCode: 'navigation-timeout',
              sourceUrl: item.url,
              sourceTitle: item.title,
            });
            result = { ok: false, errorCode: 'navigation-timeout' as const };
          }
        } else {
          await this.previewDb.saveError({
            key: getLinkPreviewKey(item.id),
            bookmarkId: item.id,
            kind: 'link',
            errorCode: 'tab-closed',
            sourceUrl: item.url,
            sourceTitle: item.title,
          });
          result = { ok: false, errorCode: 'tab-closed' as const };
        }
      }

      await this.rebuildParentFolderComposite(item.parentId);
      await this.reloadTree();

      if (result && !result.ok) {
        await showInfo(getPreviewErrorMessage(result.errorCode));
      }
    } catch (err) {
      if (item.type === 'link') {
        await this.previewDb.saveError({
          key: getLinkPreviewKey(item.id),
          bookmarkId: item.id,
          kind: 'link',
          errorCode: 'unknown',
          errorMessage: String(err),
          sourceUrl: item.url,
          sourceTitle: item.title,
        });
        await this.reloadTree();
      }
      await showInfo(`Could not generate preview: ${String(err)}`);
    }
  }

  private async removePreview(item: BookmarkEntryViewModel): Promise<void> {
    await this.previewDb.delete(item.type === 'folder' ? getFolderPreviewKey(item.id) : getLinkPreviewKey(item.id));
    if (item.type === 'link') await this.rebuildParentFolderComposite(item.parentId);
    await this.reloadTree();
  }

  private async reloadTree(): Promise<void> {
    this.bookmarkTree = await this.bookmarksService.getTree();
    if (this.viewMode === 'bookmarks') this.render();
  }

  private async loadPreviewsForEntries(
    container: HTMLElement,
    node: chrome.bookmarks.BookmarkTreeNode,
    entries: BookmarkEntryViewModel[],
    version: number,
  ): Promise<void> {
    const keys = entries
      .filter((entry): entry is LinkEntryViewModel => entry.type === 'link')
      .map((entry) => getLinkPreviewKey(entry.id));
    const records = await this.previewDb.getMany(keys);
    if (version !== this.renderVersion) return;

    const recordsByKey = new Map(records.map((record) => [record.key, record]));
    const entriesWithPreviews = entries.map((entry) => {
      if (entry.type === 'folder') return entry;
      const key = getLinkPreviewKey(entry.id);
      const record = recordsByKey.get(key);
      if (record?.status === 'ok' && record.blob) {
        const objectUrl = URL.createObjectURL(record.blob);
        this.previewObjectUrls.push(objectUrl);
        return {
          ...entry,
          preview: {
            status: 'ok' as const,
            objectUrl,
            width: record.width,
            height: record.height,
          },
        };
      }
      if (record) return { ...entry, preview: { status: record.status } };
      return { ...entry, preview: { status: 'none' as const } };
    });

    const isSearching = this.searchText.trim().length > 0;
    const folderCapabilities = getBookmarkCapabilities(this.bookmarkTree, node);
    const view = createFolderView(
      { id: node.id, title: this.displayTitle(node) },
      entriesWithPreviews,
      isSearching,
      !isSearching && folderCapabilities.canCreateChildren,
      !isSearching && folderCapabilities.canSortChildren,
      this.previewSize,
      {
        onNavigateToFolder: (id) => this.navigateTo(id),
        onNavigateBack: () => this.navigateBack(),
        onOpenLink: (item) => void this.openLink(item),
        onEditLink: (item) => this.editLink(item),
        onDeleteItem: (item) => this.deleteItem(item),
        onRenameFolder: (item) => this.renameFolder(item),
        onMoveItem: (item) => this.moveItem(item),
        onCreateFolderNearItem: (item, placement) => this.createFolderNearItem(item, placement),
        onGeneratePreview: (item) => void this.generatePreview(item),
        onRemovePreview: (item) => void this.removePreview(item),
        onUpdateLinkUrlFromCurrentTab: (item) => void this.updateLinkUrlFromCurrentTab(item),
        onReorder: (itemId, newIndex) => this.reorderItem(itemId, newIndex),
        onMoveIntoFolder: (itemId, folderId) => this.moveItemIntoFolder(itemId, folderId),
        onSortFolder: (action) => this.sortFolder(action),
      },
    );
    container.innerHTML = '';
    container.appendChild(view);
  }

  private async rebuildParentFolderComposite(folderId: string): Promise<void> {
    if (!folderId) return;
    await this.rebuildFolderComposite(folderId);
  }

  private async rebuildFolderComposite(folderId: string): Promise<void> {
    const folder = findNodeById(this.bookmarkTree, folderId);
    if (!folder) return;
    const childRecords = await this.previewDb.getMany(
      (folder.children ?? [])
        .filter((child) => !!child.url)
        .map((child) => getLinkPreviewKey(child.id)),
    );
    if (childRecords.some((record) => record.status === 'ok' && record.blob)) {
      await this.previewCapture.createFolderComposite({ folderId, childRecords });
    }
  }

  private revokePreviewObjectUrls(): void {
    for (const objectUrl of this.previewObjectUrls) URL.revokeObjectURL(objectUrl);
    this.previewObjectUrls = [];
  }

  private updateTopBar(): void {
    const upBtn = this.root.querySelector<HTMLButtonElement>('.top-folder-up-btn');
    const folderTitle = this.root.querySelector<HTMLElement>('.current-folder-title');
    const currentNode = findNodeById(this.bookmarkTree, this.currentFolderId);
    if (!upBtn || !folderTitle || !currentNode) return;

    const canGoUp = canNavigateBack(this.bookmarkTree, this.currentFolderId);
    upBtn.disabled = !canGoUp;
    upBtn.setAttribute('aria-disabled', String(!canGoUp));

    const title = this.displayTitle(currentNode);
    folderTitle.textContent = title;
    folderTitle.title = title;
  }

  private attachBookmarkListeners(): void {
    const reload = () => this.reloadTree();
    this.bookmarksService.onCreated(reload);
    this.bookmarksService.onRemoved((id, info) => {
      void this.previewDb.deleteForBookmark(id);
      if (info.parentId) void this.previewDb.delete(getFolderPreviewKey(info.parentId));
      reload();
    });
    this.bookmarksService.onChanged((id, changeInfo) => {
      if (changeInfo.url !== undefined) void this.previewDb.delete(getLinkPreviewKey(id));
      reload();
    });
    this.bookmarksService.onMoved((_id, moveInfo) => {
      void this.previewDb.delete(getFolderPreviewKey(moveInfo.parentId));
      void this.previewDb.delete(getFolderPreviewKey(moveInfo.oldParentId));
      reload();
    });
    this.bookmarksService.onImportEnded(reload);
  }

  private attachPreviewSettingsListener(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[PREVIEW_SETTINGS_STORAGE_KEY]) return;
      void this.refreshPreviewDisplaySettings();
    });
  }

  private async refreshPreviewDisplaySettings(): Promise<void> {
    const settings = await this.previewSettings.load();
    if (settings.previewSize === this.previewSize) return;
    this.previewSize = settings.previewSize;
    if (this.viewMode === 'bookmarks') this.render();
  }

  private async requireCapability(
    nodeId: string,
    capability: keyof BookmarkCapabilities,
    message: string,
  ): Promise<boolean> {
    const node = findNodeById(this.bookmarkTree, nodeId);
    if (node && getBookmarkCapabilities(this.bookmarkTree, node)[capability]) return true;
    await showInfo(message);
    return false;
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

async function hasPreviewCapturePermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [...PREVIEW_CAPTURE_PERMISSION_ORIGINS] });
  } catch (err) {
    console.warn('Preview permission check failed:', err);
    return false;
  }
}

function getPreviewErrorMessage(errorCode: unknown): string {
  switch (errorCode) {
    case 'permission-denied':
      return getMissingPreviewPermissionMessage();
    case 'navigation-timeout':
      return 'The page did not finish loading in time for preview generation.';
    case 'empty-screenshot':
      return 'The captured preview was empty.';
    case 'tab-closed':
      return 'The preview tab was closed before capture finished.';
    case 'unsupported-url':
      return 'Preview can only be generated for http and https pages.';
    default:
      return 'Could not generate preview.';
  }
}

function getMissingPreviewPermissionMessage(): string {
  return 'Preview generation needs all-sites access. Reload the updated extension and try again.';
}

function svgPlus(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}

function svgFolderUp(): string {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`;
}

function svgEllipsis(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>`;
}
