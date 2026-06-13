import Sortable from 'sortablejs';
import type { BookmarkEntryViewModel, FolderViewCallbacks } from '../types.js';
import { createBookmarkRow } from './BookmarkRow.js';

export interface FolderInfo {
  id: string;
  title: string;
}

let activeSortable: Sortable | null = null;

export function destroyActiveSortable(): void {
  if (activeSortable) {
    activeSortable.destroy();
    activeSortable = null;
  }
}

export function createFolderView(
  folder: FolderInfo,
  entries: BookmarkEntryViewModel[],
  canGoBack: boolean,
  isSearching: boolean,
  callbacks: FolderViewCallbacks,
): HTMLElement {
  destroyActiveSortable();

  const el = document.createElement('div');
  el.className = 'folder-view';

  el.appendChild(buildNavHeader(folder, canGoBack, callbacks));

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = isSearching
      ? `<p class="empty-state__title">No matches</p><p class="empty-state__hint">Try a different search term.</p>`
      : `<p class="empty-state__title">This folder is empty</p><p class="empty-state__hint">Add the current page with the + button above.</p>`;
    el.appendChild(empty);
    return el;
  }

  const list = document.createElement('ul');
  list.className = 'bookmark-list';
  list.setAttribute('role', 'list');

  for (const entry of entries) {
    list.appendChild(createBookmarkRow(entry, callbacks));
  }

  el.appendChild(list);

  if (!isSearching) {
    activeSortable = Sortable.create(list, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'bookmark-row--ghost',
      dragClass: 'bookmark-row--dragging',
      onEnd(evt) {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        const rows = [...list.querySelectorAll<HTMLElement>('[data-id]')];
        const movedId = rows[newIndex]?.dataset.id;
        if (movedId) callbacks.onReorder(movedId, newIndex);
      },
    });
  }

  return el;
}

function buildNavHeader(
  folder: FolderInfo,
  canGoBack: boolean,
  callbacks: FolderViewCallbacks,
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'nav-header';

  if (canGoBack) {
    const backBtn = document.createElement('button');
    backBtn.className = 'nav-back-btn';
    backBtn.setAttribute('aria-label', 'Go back');
    backBtn.title = 'Go back';
    backBtn.innerHTML = svgArrowLeft();
    backBtn.addEventListener('click', callbacks.onNavigateBack);
    header.appendChild(backBtn);
  }

  const titleEl = document.createElement('span');
  titleEl.className = 'nav-folder-title';
  titleEl.textContent = folder.title || 'Bookmarks';
  titleEl.title = folder.title;
  header.appendChild(titleEl);

  return header;
}

function svgArrowLeft(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
}
