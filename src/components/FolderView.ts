import Sortable from 'sortablejs';
import type { BookmarkEntryViewModel, FolderViewCallbacks } from '../types.js';
import { DEFAULT_PREVIEW_SIZE, PREVIEW_SIZE_OPTIONS, type PreviewSize } from '../services/previewSettingsService.js';
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
  _folder: FolderInfo,
  entries: BookmarkEntryViewModel[],
  isSearching: boolean,
  canReorder: boolean,
  previewSize: PreviewSize,
  callbacks: FolderViewCallbacks,
): HTMLElement {
  destroyActiveSortable();

  const el = document.createElement('div');
  el.className = 'folder-view';

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
  const previewSizeOption = PREVIEW_SIZE_OPTIONS[previewSize] ?? PREVIEW_SIZE_OPTIONS[DEFAULT_PREVIEW_SIZE];
  list.dataset.previewSize = previewSize;
  list.style.setProperty('--row-preview-width', `${previewSizeOption.width}px`);
  list.style.setProperty('--row-preview-height', `${previewSizeOption.height}px`);
  list.style.setProperty('--bookmark-row-min-height', `${previewSizeOption.rowHeight}px`);

  for (const entry of entries) {
    list.appendChild(createBookmarkRow(entry, callbacks));
  }

  el.appendChild(list);

  if (canReorder) {
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
