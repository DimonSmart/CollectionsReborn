import { createFolderView } from '../components/FolderView.js';
import { showMoveToDialog } from '../components/MoveToDialog.js';
import { showAddFavoriteModal } from '../components/AddFavoriteModal.js';
import { showActionsMenu } from '../components/ActionsMenu.js';
import { DEFAULT_PREVIEW_SIZE } from '../services/previewSettingsService.js';
import type { BookmarkEntryViewModel, FolderChoice, FolderViewCallbacks } from '../types.js';

const app = document.getElementById('app');
const scenario = new URLSearchParams(location.search).get('scenario') ?? 'main';

if (app) {
  renderScenario(app, scenario);
}

function renderScenario(container: HTMLElement, name: string): void {
  container.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'panel';
  container.appendChild(panel);

  panel.appendChild(buildTopBar(name));

  const viewContainer = document.createElement('main');
  viewContainer.className = 'folder-view-container';
  panel.appendChild(viewContainer);

  const callbacks: FolderViewCallbacks = {
    onNavigateToFolder: () => undefined,
    onNavigateBack: () => undefined,
    onOpenLink: () => undefined,
    onEditLink: () => undefined,
    onDeleteItem: () => undefined,
    onRenameFolder: () => undefined,
    onMoveItem: () => undefined,
    onCreateFolderNearItem: () => undefined,
    onGeneratePreview: () => undefined,
    onRemovePreview: () => undefined,
    onUpdateLinkUrlFromCurrentTab: () => undefined,
    onReorder: () => undefined,
    onMoveIntoFolder: () => undefined,
    onSortFolder: () => undefined,
  };

  if (name === 'folder') {
    viewContainer.appendChild(createFolderView(
      { id: '10', title: 'Product Research' },
      productResearchEntries(),
      false,
      true,
      true,
      DEFAULT_PREVIEW_SIZE,
      callbacks,
    ));
    return;
  }

  if (name === 'reorder') {
    const view = createFolderView(
      { id: '20', title: 'Launch Reading List' },
      launchEntries(),
      false,
      true,
      true,
      DEFAULT_PREVIEW_SIZE,
      callbacks,
    );
    viewContainer.appendChild(view);
    view.querySelector('[data-id="203"]')?.classList.add('bookmark-row--dragging');
    return;
  }

  if (name === 'move') {
    viewContainer.appendChild(createFolderView(
      { id: '10', title: 'Product Research' },
      productResearchEntries(),
      false,
      true,
      true,
      DEFAULT_PREVIEW_SIZE,
      callbacks,
    ));
    window.setTimeout(() => {
      void showMoveToDialog(productResearchEntries()[2], folderChoices(), demoTree());
    }, 50);
    return;
  }

  if (name === 'add') {
    viewContainer.appendChild(createFolderView(
      { id: '30', title: 'Design References' },
      designEntries(),
      false,
      true,
      true,
      DEFAULT_PREVIEW_SIZE,
      callbacks,
    ));
    window.setTimeout(() => {
      void showAddFavoriteModal(
        'https://developer.chrome.com/docs/extensions/',
        'Chrome Extensions documentation',
        folderChoices(),
        '30',
      );
      window.setTimeout(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }, 180);
    }, 50);
    return;
  }

  viewContainer.appendChild(createFolderView(
    { id: '1', title: 'Bookmarks Bar' },
    mainEntries(),
    false,
    true,
    true,
    DEFAULT_PREVIEW_SIZE,
    callbacks,
  ));
}

function buildTopBar(name: string): HTMLElement {
  const topBar = document.createElement('div');
  topBar.className = 'top-bar';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'search-input';
  searchInput.placeholder = 'Search bookmarks...';
  searchInput.setAttribute('aria-label', 'Search bookmarks');
  if (name === 'folder') {
    searchInput.value = 'docs';
  }

  const upBtn = document.createElement('button');
  upBtn.className = 'btn-icon top-folder-up-btn';
  upBtn.setAttribute('aria-label', 'Go to parent folder');
  upBtn.title = 'Go to parent folder';
  upBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-icon btn-icon--primary';
  addBtn.setAttribute('aria-label', 'Add current page to favorites');
  addBtn.title = 'Add current page to favorites';
  addBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

  const menuBtn = document.createElement('button');
  menuBtn.className = 'btn-icon top-menu-btn';
  menuBtn.setAttribute('aria-label', 'Folder actions');
  menuBtn.title = 'Folder actions';
  menuBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>';
  menuBtn.addEventListener('click', () => {
    showActionsMenu(menuBtn, [
      { label: 'New folder…', action: () => undefined },
      { type: 'separator' },
      { label: 'Folders first', action: () => undefined },
      { label: 'Links first', action: () => undefined },
      { label: 'Sort by title A-Z', action: () => undefined },
      { label: 'Sort by title Z-A', action: () => undefined },
      { label: 'Sort links by domain', action: () => undefined },
    ]);
  });

  topBar.append(upBtn, searchInput, addBtn, menuBtn);
  return topBar;
}

function mainEntries(): BookmarkEntryViewModel[] {
  return [
    folder('10', '1', 0, 'Product Research', 8),
    folder('20', '1', 1, 'Launch Reading List', 6),
    folder('30', '1', 2, 'Design References', 12),
    link('101', '1', 3, 'Chrome Extensions documentation', 'https://developer.chrome.com/docs/extensions/', 'developer.chrome.com'),
    link('102', '1', 4, 'Microsoft Edge extensions', 'https://learn.microsoft.com/microsoft-edge/extensions-chromium/', 'learn.microsoft.com'),
    link('103', '1', 5, 'MDN Web Docs', 'https://developer.mozilla.org/', 'developer.mozilla.org'),
    folder('40', '1', 6, 'Archive', 17),
    link('104', '1', 7, 'Accessibility patterns', 'https://www.w3.org/WAI/ARIA/apg/', 'w3.org'),
  ];
}

function productResearchEntries(): BookmarkEntryViewModel[] {
  return [
    folder('21', '10', 0, 'Chrome Developers', 4),
    folder('22', '10', 1, 'Microsoft Learn', 5),
    link('201', '10', 2, 'Chrome Extensions documentation', 'https://developer.chrome.com/docs/extensions/', 'developer.chrome.com'),
    link('202', '10', 3, 'Microsoft Edge extensions', 'https://learn.microsoft.com/microsoft-edge/extensions-chromium/', 'learn.microsoft.com'),
    link('203', '10', 4, 'MDN Web Docs', 'https://developer.mozilla.org/', 'developer.mozilla.org'),
    link('204', '10', 5, 'Manifest V3 overview', 'https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3', 'developer.chrome.com'),
  ];
}

function launchEntries(): BookmarkEntryViewModel[] {
  return [
    link('201', '20', 0, 'Microsoft Learn', 'https://learn.microsoft.com/', 'learn.microsoft.com'),
    link('202', '20', 1, 'Chrome Developers', 'https://developer.chrome.com/', 'developer.chrome.com'),
    link('203', '20', 2, 'MDN Web Docs', 'https://developer.mozilla.org/', 'developer.mozilla.org'),
    folder('204', '20', 3, 'Review queue', 3),
    link('205', '20', 4, 'Stack Overflow', 'https://stackoverflow.com/', 'stackoverflow.com'),
  ];
}

function designEntries(): BookmarkEntryViewModel[] {
  return [
    folder('31', '30', 0, 'Navigation', 3),
    link('301', '30', 1, 'Chrome Developers', 'https://developer.chrome.com/', 'developer.chrome.com'),
    link('302', '30', 2, 'MDN Web Docs', 'https://developer.mozilla.org/', 'developer.mozilla.org'),
    link('303', '30', 3, 'Microsoft Learn', 'https://learn.microsoft.com/', 'learn.microsoft.com'),
  ];
}

function folder(id: string, parentId: string, index: number, title: string, childCount: number): BookmarkEntryViewModel {
  return { type: 'folder', id, parentId, index, title, childCount, capabilities: editableCapabilities };
}

function link(
  id: string,
  parentId: string,
  index: number,
  title: string,
  url: string,
  domain: string,
): BookmarkEntryViewModel {
  return {
    type: 'link',
    id,
    parentId,
    index,
    title,
    url,
    domain,
    faviconUrl: faviconDataUrl(domain),
    capabilities: editableCapabilities,
  };
}

function faviconDataUrl(domain: string): string {
  const letter = domain.charAt(0).toUpperCase();
  const hue = Math.abs([...domain].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="4" fill="hsl(${hue} 72% 46%)"/><text x="8" y="11" text-anchor="middle" font-family="Arial" font-size="9" font-weight="700" fill="white">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function folderChoices(): FolderChoice[] {
  return [
    { id: '1', title: 'Bookmarks Bar', path: 'Bookmarks Bar', depth: 0, canCreateChildren: true },
    { id: '10', title: 'Product Research', path: 'Bookmarks Bar / Product Research', depth: 1, canCreateChildren: true },
    { id: '21', title: 'Chrome Developers', path: 'Bookmarks Bar / Product Research / Chrome Developers', depth: 2, canCreateChildren: true },
    { id: '22', title: 'Microsoft Learn', path: 'Bookmarks Bar / Product Research / Microsoft Learn', depth: 2, canCreateChildren: true },
    { id: '20', title: 'Launch Reading List', path: 'Bookmarks Bar / Launch Reading List', depth: 1, canCreateChildren: true },
    { id: '30', title: 'Design References', path: 'Bookmarks Bar / Design References', depth: 1, canCreateChildren: true },
    { id: '40', title: 'Archive', path: 'Bookmarks Bar / Archive', depth: 1, canCreateChildren: true },
  ];
}

const editableCapabilities = {
  canRename: true,
  canEditUrl: true,
  canMove: true,
  canDelete: true,
  canCreateFolderBefore: true,
  canCreateFolderAfter: true,
  canCreateChildren: true,
  canSortChildren: true,
};

function demoTree(): chrome.bookmarks.BookmarkTreeNode[] {
  return [
    {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          parentId: '0',
          title: 'Bookmarks Bar',
          children: [
            {
              id: '10',
              parentId: '1',
              title: 'Product Research',
              children: [
                { id: '21', parentId: '10', title: 'Chrome Developers', children: [] },
                { id: '22', parentId: '10', title: 'Microsoft Learn', children: [] },
                { id: '203', parentId: '10', title: 'MDN Web Docs', url: 'https://developer.mozilla.org/' },
              ],
            },
            { id: '20', parentId: '1', title: 'Launch Reading List', children: [] },
            { id: '30', parentId: '1', title: 'Design References', children: [] },
            { id: '40', parentId: '1', title: 'Archive', children: [] },
          ],
        },
      ],
    },
  ];
}
