import Sortable from 'sortablejs';
import type { BookmarkEntryViewModel, FolderViewCallbacks } from '../types.js';
import { DEFAULT_PREVIEW_SIZE, PREVIEW_SIZE_OPTIONS, type PreviewSize } from '../services/previewSettingsService.js';
import { createBookmarkRow } from './BookmarkRow.js';

export interface FolderInfo {
  id: string;
  title: string;
}

let activeSortable: Sortable | null = null;

const FOLDER_DROP_ZONE_START = 0.25;
const FOLDER_DROP_ZONE_END = 0.75;

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
  showFaviconOverlay: boolean,
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
    list.appendChild(createBookmarkRow(entry, callbacks, { showFaviconOverlay }));
  }

  el.appendChild(list);

  if (canReorder) {
    let folderDropTarget: HTMLElement | null = null;

    const setFolderDropTarget = (target: HTMLElement | null): void => {
      if (folderDropTarget === target) return;
      folderDropTarget?.classList.remove('bookmark-row--folder-drop-target');
      folderDropTarget = target;
      folderDropTarget?.classList.add('bookmark-row--folder-drop-target');
    };

    activeSortable = Sortable.create(list, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'bookmark-row--ghost',
      dragClass: 'bookmark-row--dragging',
      onMove(evt, originalEvent) {
        const related = evt.related as HTMLElement;
        const dragged = evt.dragged as HTMLElement;
        const pointerY = getPointerClientY(originalEvent);
        const isFolderTarget = related.classList.contains('bookmark-row--folder')
          && related !== dragged
          && pointerY !== null
          && isInsideFolderDropZone(pointerY, evt.relatedRect.top, evt.relatedRect.height);

        setFolderDropTarget(isFolderTarget ? related : null);
        return isFolderTarget ? false : undefined;
      },
      onEnd(evt) {
        const destinationFolderId = folderDropTarget?.dataset.id;
        setFolderDropTarget(null);
        const movedId = (evt.item as HTMLElement).dataset.id;
        if (movedId && destinationFolderId) {
          callbacks.onMoveIntoFolder(movedId, destinationFolderId);
          return;
        }

        const { oldIndex, newIndex } = evt;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        const rows = [...list.querySelectorAll<HTMLElement>('[data-id]')];
        const reorderedId = rows[newIndex]?.dataset.id;
        if (reorderedId) callbacks.onReorder(reorderedId, newIndex);
      },
    });
  }

  return el;
}

export function isInsideFolderDropZone(pointerY: number, top: number, height: number): boolean {
  if (height <= 0) return false;
  const position = (pointerY - top) / height;
  return position >= FOLDER_DROP_ZONE_START && position <= FOLDER_DROP_ZONE_END;
}

function getPointerClientY(event: Event): number | null {
  if ('clientY' in event && typeof event.clientY === 'number') return event.clientY;
  if ('touches' in event) {
    const touches = event.touches as TouchList;
    if (touches.length > 0) return touches[0].clientY;
  }
  return null;
}
