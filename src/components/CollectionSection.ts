import type { FolderViewModel, FavoriteItemViewModel, ViewMode } from '../types.js';
import { PREVIEW_LIMIT } from '../types.js';
import { createFavoriteItem, type FavoriteItemCallbacks } from './FavoriteItem.js';
import { showActionsMenu } from './ActionsMenu.js';
import { showFolderEditor } from './ItemEditor.js';

export interface CollectionSectionCallbacks extends FavoriteItemCallbacks {
  onToggle: (folderId: string, itemCount: number) => void;
  onRenameFolder: (folder: FolderViewModel, newTitle: string) => Promise<void>;
  onDeleteFolder: (folder: FolderViewModel) => Promise<void>;
  onAddToFolder: (folderId: string) => void;
}

export function createCollectionSection(
  folder: FolderViewModel,
  mode: ViewMode,
  callbacks: CollectionSectionCallbacks,
  searchText: string,
): HTMLElement {
  const section = document.createElement('div');
  section.className = `collection-section${folder.expansionState === 'expanded' ? ' collection-section--expanded' : ''}`;
  section.dataset.folderId = folder.id;

  const header = buildHeader(folder, callbacks);
  section.appendChild(header);

  const body = buildBody(folder, mode, callbacks, searchText);
  section.appendChild(body);

  return section;
}

function buildHeader(folder: FolderViewModel, callbacks: CollectionSectionCallbacks): HTMLElement {
  const header = document.createElement('div');
  header.className = 'collection-header';
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', String(folder.expansionState === 'expanded'));
  header.setAttribute('aria-label', `${folder.title}, ${folder.itemCount} items`);
  header.tabIndex = 0;

  const chevron = document.createElement('span');
  chevron.className = `collection-chevron${folder.expansionState === 'expanded' ? ' collection-chevron--open' : ''}`;
  chevron.innerHTML = svgChevron();
  chevron.setAttribute('aria-hidden', 'true');

  if (folder.itemCount === 0) {
    chevron.style.visibility = 'hidden';
  }

  const folderIcon = document.createElement('span');
  folderIcon.className = 'collection-folder-icon';
  folderIcon.setAttribute('aria-hidden', 'true');
  folderIcon.innerHTML = folder.expansionState !== 'collapsed' ? svgFolderOpen() : svgFolder();

  const titleEl = document.createElement('span');
  titleEl.className = 'collection-title';
  titleEl.textContent = folder.title;
  titleEl.title = folder.title;

  const count = document.createElement('span');
  count.className = 'collection-count';
  count.textContent = String(folder.itemCount);

  const menuBtn = document.createElement('button');
  menuBtn.className = 'action-btn collection-action-btn';
  menuBtn.setAttribute('aria-label', `Actions for ${folder.title}`);
  menuBtn.innerHTML = svgEllipsis();
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showActionsMenu(menuBtn, [
      {
        label: 'Edit folder name',
        action: async () => {
          const newName = await showFolderEditor(folder.title);
          if (newName && newName !== folder.title) {
            await callbacks.onRenameFolder(folder, newName);
          }
        },
      },
      {
        label: 'Add current tab',
        action: () => callbacks.onAddToFolder(folder.id),
      },
      {
        label: 'Delete folder',
        variant: 'danger',
        action: () => callbacks.onDeleteFolder(folder),
      },
    ]);
  });

  if (folder.itemCount > 0) {
    const toggle = () => callbacks.onToggle(folder.id, folder.itemCount);

    header.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.action-btn')) return;
      toggle();
    });

    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  }

  header.append(chevron, folderIcon, titleEl, count, menuBtn);

  return header;
}

function buildBody(
  folder: FolderViewModel,
  mode: ViewMode,
  callbacks: CollectionSectionCallbacks,
  searchText: string,
): HTMLElement {
  const body = document.createElement('div');
  body.className = 'collection-body';
  body.setAttribute('role', 'list');

  const isSearching = searchText.trim().length > 0;

  if (!isSearching && folder.expansionState === 'collapsed') {
    return body;
  }

  if (folder.allItems.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'collection-empty';
    empty.textContent = 'This collection is empty.';
    body.appendChild(empty);
    return body;
  }

  let visibleItems: FavoriteItemViewModel[];

  if (isSearching || folder.expansionState === 'expanded') {
    visibleItems = folder.allItems;
  } else {
    visibleItems = folder.allItems.slice(0, PREVIEW_LIMIT);
  }

  for (const item of visibleItems) {
    const itemEl = createFavoriteItem(item, mode, callbacks);
    body.appendChild(itemEl);
  }

  if (!isSearching) {
    if (folder.expansionState === 'preview') {
      const more = document.createElement('button');
      more.className = 'collection-show-more';
      more.setAttribute('aria-label', `Show all ${folder.itemCount} items in ${folder.title}`);
      more.textContent = `Show all ${folder.itemCount} items`;
      more.addEventListener('click', () => callbacks.onToggle(folder.id, folder.itemCount));
      body.appendChild(more);
    } else if (
      folder.expansionState === 'expanded' &&
      folder.allItems.length > PREVIEW_LIMIT &&
      mode !== 'compact'
    ) {
      const less = document.createElement('button');
      less.className = 'collection-show-more';
      less.setAttribute('aria-label', `Collapse ${folder.title}`);
      less.textContent = 'Show less';
      less.addEventListener('click', () => callbacks.onToggle(folder.id, folder.itemCount));
      body.appendChild(less);
    }
  }

  return body;
}

function svgChevron(): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
}

function svgFolder(): string {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
}

function svgFolderOpen(): string {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;
}

function svgEllipsis(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>`;
}
