import type { FolderViewModel, FavoriteItemViewModel, ViewMode } from '../types.js';
import { createFavoriteItem, type FavoriteItemCallbacks } from './FavoriteItem.js';

const COLLAPSED_ITEM_LIMIT = 4;

export interface CollectionSectionCallbacks extends FavoriteItemCallbacks {
  onToggle: (folderId: string) => void;
  onRenameFolder: (folder: FolderViewModel, newTitle: string) => Promise<void>;
}

export function createCollectionSection(
  folder: FolderViewModel,
  mode: ViewMode,
  callbacks: CollectionSectionCallbacks,
  searchText: string,
): HTMLElement {
  const section = document.createElement('div');
  section.className = `collection-section${folder.isExpanded ? ' collection-section--expanded' : ''}`;
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
  header.setAttribute('aria-expanded', String(folder.isExpanded));
  header.setAttribute('aria-label', `${folder.title}, ${folder.itemCount} items`);
  header.tabIndex = 0;

  const chevron = document.createElement('span');
  chevron.className = `collection-chevron${folder.isExpanded ? ' collection-chevron--open' : ''}`;
  chevron.innerHTML = svgChevron();
  chevron.setAttribute('aria-hidden', 'true');

  const folderIcon = document.createElement('span');
  folderIcon.className = 'collection-folder-icon';
  folderIcon.setAttribute('aria-hidden', 'true');
  folderIcon.innerHTML = folder.isExpanded ? svgFolderOpen() : svgFolder();

  const titleEl = document.createElement('span');
  titleEl.className = 'collection-title';
  titleEl.textContent = folder.title;

  const count = document.createElement('span');
  count.className = 'collection-count';
  count.textContent = String(folder.itemCount);

  const spacer = document.createElement('span');
  spacer.className = 'collection-spacer';

  const renameBtn = document.createElement('button');
  renameBtn.className = 'action-btn collection-action-btn';
  renameBtn.setAttribute('aria-label', `Rename ${folder.title}`);
  renameBtn.innerHTML = svgPencil();
  renameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startFolderRename(folder, titleEl, callbacks);
  });

  header.append(chevron, folderIcon, titleEl, count, spacer, renameBtn);

  const toggle = () => callbacks.onToggle(folder.id);

  header.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.action-btn')) return;
    if ((e.target as HTMLElement).closest('.collection-title[contenteditable="true"]')) return;
    toggle();
  });

  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });

  header.addEventListener('dblclick', (e) => {
    if ((e.target as HTMLElement).closest('.action-btn')) return;
    startFolderRename(folder, titleEl, callbacks);
  });

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

  if (folder.allItems.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'collection-empty';
    empty.textContent = 'This collection is empty.';
    body.appendChild(empty);
    return body;
  }

  const isSearching = searchText.trim().length > 0;
  let visibleItems: FavoriteItemViewModel[];
  let showMoreCount = 0;

  if (isSearching) {
    visibleItems = folder.allItems;
  } else if (folder.isExpanded) {
    visibleItems = folder.allItems;
  } else {
    visibleItems = folder.allItems.slice(0, COLLAPSED_ITEM_LIMIT);
    showMoreCount = folder.allItems.length - COLLAPSED_ITEM_LIMIT;
  }

  for (const item of visibleItems) {
    const itemEl = createFavoriteItem(item, mode, callbacks);
    body.appendChild(itemEl);
  }

  if (!isSearching && !folder.isExpanded && showMoreCount > 0) {
    const more = document.createElement('button');
    more.className = 'collection-show-more';
    more.setAttribute('aria-label', `Show all ${folder.itemCount} items in ${folder.title}`);
    more.textContent = `Show all ${folder.itemCount} items`;
    more.addEventListener('click', () => callbacks.onToggle(folder.id));
    body.appendChild(more);
  }

  if (!isSearching && folder.isExpanded && folder.allItems.length > COLLAPSED_ITEM_LIMIT) {
    const less = document.createElement('button');
    less.className = 'collection-show-more';
    less.setAttribute('aria-label', `Collapse ${folder.title}`);
    less.textContent = 'Show less';
    less.addEventListener('click', () => callbacks.onToggle(folder.id));
    body.appendChild(less);
  }

  return body;
}

function startFolderRename(
  folder: FolderViewModel,
  titleEl: HTMLElement,
  callbacks: CollectionSectionCallbacks,
): void {
  if (titleEl.contentEditable === 'true') return;

  titleEl.contentEditable = 'true';
  titleEl.classList.add('collection-title--editing');
  titleEl.focus();
  selectAll(titleEl);

  const original = titleEl.textContent ?? '';

  const commit = async () => {
    const newTitle = (titleEl.textContent ?? '').trim();
    titleEl.contentEditable = 'false';
    titleEl.classList.remove('collection-title--editing');

    if (!newTitle) {
      titleEl.textContent = original;
      return;
    }
    if (newTitle === original) return;

    try {
      await callbacks.onRenameFolder(folder, newTitle);
    } catch {
      titleEl.textContent = original;
    }
  };

  const cancel = () => {
    titleEl.contentEditable = 'false';
    titleEl.classList.remove('collection-title--editing');
    titleEl.textContent = original;
  };

  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      cancel();
    }
  });

  titleEl.addEventListener('blur', commit, { once: true });
}

function selectAll(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
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

function svgPencil(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}
