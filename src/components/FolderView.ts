import Sortable from 'sortablejs';
import { BOOKMARK_DRAG_DATA_TYPE, type BookmarkEntryViewModel, type FolderViewCallbacks } from '../types.js';
import { DEFAULT_PREVIEW_SIZE, PREVIEW_SIZE_OPTIONS, type PreviewSize } from '../services/previewSettingsService.js';
import { createBookmarkRow } from './BookmarkRow.js';

export interface FolderInfo {
  id: string;
  title: string;
}

let activeSortable: Sortable | null = null;

const FOLDER_DROP_ZONE_START = 0.1;
const FOLDER_DROP_ZONE_END = 0.9;
const FOLDER_DROP_HOVER_DELAY_MS = 300;

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
  canDragItems: boolean,
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

  if (canDragItems && entries.some((entry) => entry.capabilities.canMove)) {
    let folderDropTarget: HTMLElement | null = null;
    let pendingFolderDropTarget: HTMLElement | null = null;
    let folderDropTargetTimer: ReturnType<typeof setTimeout> | null = null;
    let draggedElement: HTMLElement | null = null;
    let lastMoveStateKey = '';
    let lastDocumentStateKey = '';

    const setFolderDropTarget = (target: HTMLElement | null): void => {
      if (folderDropTarget === target) return;
      logDnd('active-target-change', {
        from: getElementDebugId(folderDropTarget),
        to: getElementDebugId(target),
      });
      folderDropTarget?.classList.remove('bookmark-row--folder-drop-target');
      folderDropTarget = target;
      folderDropTarget?.classList.add('bookmark-row--folder-drop-target');
    };

    const clearPendingFolderDropTarget = (): void => {
      if (folderDropTargetTimer) {
        clearTimeout(folderDropTargetTimer);
        folderDropTargetTimer = null;
        logDnd('pending-target-timer-cleared', {
          pending: getElementDebugId(pendingFolderDropTarget),
        });
      }
      pendingFolderDropTarget = null;
    };

    const clearFolderDropState = (reason: string): void => {
      if (pendingFolderDropTarget || folderDropTarget) {
        logDnd('drop-state-clear', {
          reason,
          pending: getElementDebugId(pendingFolderDropTarget),
          active: getElementDebugId(folderDropTarget),
        });
      }
      clearPendingFolderDropTarget();
      setFolderDropTarget(null);
    };

    const scheduleFolderDropTarget = (target: HTMLElement | null, reason: string): void => {
      if (!target) {
        clearFolderDropState(reason);
        return;
      }

      if (folderDropTarget === target || pendingFolderDropTarget === target) return;

      clearPendingFolderDropTarget();
      setFolderDropTarget(null);
      pendingFolderDropTarget = target;
      logDnd('pending-target-scheduled', {
        reason,
        target: getElementDebugId(target),
        delayMs: FOLDER_DROP_HOVER_DELAY_MS,
      });
      folderDropTargetTimer = setTimeout(() => {
        logDnd('pending-target-activated', {
          target: getElementDebugId(pendingFolderDropTarget),
        });
        setFolderDropTarget(pendingFolderDropTarget);
        clearPendingFolderDropTarget();
      }, FOLDER_DROP_HOVER_DELAY_MS);
    };

    const updateFolderDropTargetFromDocumentPoint = (event: Event): void => {
      const pointer = getPointerClientPosition(event);
      if (!pointer || !draggedElement) {
        clearFolderDropState('document-point-missing');
        return;
      }

      const elementAtPointer = document.elementFromPoint(pointer.x, pointer.y);
      const target = elementAtPointer instanceof HTMLElement
        ? elementAtPointer.closest<HTMLElement>('.bookmark-row--folder')
        : null;

      const isInsideTargetRow = !!target
        && list.contains(target)
        && target.dataset.acceptsChildren === 'true'
        && target !== draggedElement;
      const isFolderTarget = isInsideTargetRow
        && isInsideFolderDropZone(pointer.y, target.getBoundingClientRect().top, target.getBoundingClientRect().height);
      const isSameScheduledTarget = target === pendingFolderDropTarget || target === folderDropTarget;

      const stateKey = [
        Math.round(pointer.x),
        Math.round(pointer.y),
        getElementDebugId(target),
        String(isFolderTarget),
      ].join('|');
      if (stateKey !== lastDocumentStateKey) {
        lastDocumentStateKey = stateKey;
        logDnd('document-point', {
          pointer,
          target: getElementDebugId(target),
          isFolderTarget,
          isInsideTargetRow,
          isSameScheduledTarget,
        });
      }

      scheduleFolderDropTarget(
        isFolderTarget || (isInsideTargetRow && isSameScheduledTarget) ? target : null,
        'document-point-outside-folder',
      );
    };

    const addDocumentDragListeners = (): void => {
      document.addEventListener('dragover', updateFolderDropTargetFromDocumentPoint);
      document.addEventListener('mousemove', updateFolderDropTargetFromDocumentPoint);
      document.addEventListener('touchmove', updateFolderDropTargetFromDocumentPoint);
    };

    const removeDocumentDragListeners = (): void => {
      document.removeEventListener('dragover', updateFolderDropTargetFromDocumentPoint);
      document.removeEventListener('mousemove', updateFolderDropTargetFromDocumentPoint);
      document.removeEventListener('touchmove', updateFolderDropTargetFromDocumentPoint);
    };

    activeSortable = Sortable.create(list, {
      handle: '.drag-handle',
      filter: '.bookmark-row--not-draggable',
      preventOnFilter: true,
      animation: 150,
      ghostClass: 'bookmark-row--ghost',
      dragClass: 'bookmark-row--dragging',
      setData(dataTransfer, dragEl) {
        const itemId = dragEl.dataset.id;
        if (!itemId) return;
        dataTransfer.setData(BOOKMARK_DRAG_DATA_TYPE, itemId);
        dataTransfer.setData('text/plain', itemId);
      },
      onStart(evt) {
        draggedElement = evt.item as HTMLElement;
        lastMoveStateKey = '';
        lastDocumentStateKey = '';
        logDnd('drag-start', {
          item: getElementDebugId(draggedElement),
          previewSize,
        });
        addDocumentDragListeners();
      },
      onMove(evt, originalEvent) {
        const related = evt.related as HTMLElement;
        const dragged = evt.dragged as HTMLElement;
        const pointerY = getPointerClientY(originalEvent);
        const isInsideRelatedRow = related.classList.contains('bookmark-row--folder')
          && related.dataset.acceptsChildren === 'true'
          && related !== dragged
          && pointerY !== null;
        const isFolderTarget = isInsideRelatedRow
          && isInsideFolderDropZone(pointerY, evt.relatedRect.top, evt.relatedRect.height);
        const isSameScheduledTarget = related === pendingFolderDropTarget || related === folderDropTarget;

        const moveStateKey = [
          getElementDebugId(dragged),
          getElementDebugId(related),
          String(pointerY === null ? null : Math.round(pointerY)),
          String(isFolderTarget),
          getElementDebugId(pendingFolderDropTarget),
          getElementDebugId(folderDropTarget),
        ].join('|');
        if (moveStateKey !== lastMoveStateKey) {
          lastMoveStateKey = moveStateKey;
          logDnd('sortable-move', {
            dragged: getElementDebugId(dragged),
            related: getElementDebugId(related),
            pointerY,
            relatedRect: {
              top: evt.relatedRect.top,
              height: evt.relatedRect.height,
            },
            isFolderTarget,
            isInsideRelatedRow,
            isSameScheduledTarget,
            pending: getElementDebugId(pendingFolderDropTarget),
            active: getElementDebugId(folderDropTarget),
          });
        }

        scheduleFolderDropTarget(
          isFolderTarget || (isInsideRelatedRow && isSameScheduledTarget) ? related : null,
          'sortable-move-outside-folder',
        );
        if (isFolderTarget || (isInsideRelatedRow && isSameScheduledTarget)) return false;
        return canReorder ? undefined : false;
      },
      onEnd(evt) {
        const destinationFolderId = folderDropTarget?.dataset.id;
        removeDocumentDragListeners();
        logDnd('drag-end', {
          item: getElementDebugId(evt.item as HTMLElement),
          destinationFolderId,
          oldIndex: evt.oldIndex,
          newIndex: evt.newIndex,
          pending: getElementDebugId(pendingFolderDropTarget),
          active: getElementDebugId(folderDropTarget),
        });
        draggedElement = null;
        clearFolderDropState('drag-end');
        const movedId = (evt.item as HTMLElement).dataset.id;
        if (movedId && destinationFolderId) {
          callbacks.onMoveIntoFolder(movedId, destinationFolderId);
          return;
        }

        const { oldIndex, newIndex } = evt;
        if (!canReorder || oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        const rows = [...list.querySelectorAll<HTMLElement>('[data-id]')];
        const reorderedId = rows[newIndex]?.dataset.id;
        if (reorderedId) callbacks.onReorder(reorderedId, newIndex);
      },
    });
  }

  return el;
}

function getElementDebugId(el: HTMLElement | null): string | null {
  if (!el) return null;
  return [
    el.dataset.id ? `id:${el.dataset.id}` : '',
    el.classList.contains('bookmark-row--folder') ? 'folder' : '',
    el.classList.contains('bookmark-row--link') ? 'link' : '',
  ].filter(Boolean).join(' ') || el.tagName.toLowerCase();
}

function logDnd(event: string, details: Record<string, unknown>): void {
  const record = {
    at: Math.round(performance.now()),
    event,
    ...details,
  };
  const debugWindow = window as Window & { __collectionsRebornDndLog?: unknown[] };
  debugWindow.__collectionsRebornDndLog ??= [];
  debugWindow.__collectionsRebornDndLog.push(record);
  if (debugWindow.__collectionsRebornDndLog.length > 1000) {
    debugWindow.__collectionsRebornDndLog.splice(0, debugWindow.__collectionsRebornDndLog.length - 1000);
  }
  console.debug('[CollectionsReborn:DnD]', record);
}

export function isInsideFolderDropZone(pointerY: number, top: number, height: number): boolean {
  if (height <= 0) return false;
  const position = (pointerY - top) / height;
  return position >= FOLDER_DROP_ZONE_START && position <= FOLDER_DROP_ZONE_END;
}

function getPointerClientY(event: Event): number | null {
  return getPointerClientPosition(event)?.y ?? null;
}

function getPointerClientPosition(event: Event): { x: number; y: number } | null {
  if ('clientX' in event && typeof event.clientX === 'number'
    && 'clientY' in event && typeof event.clientY === 'number') {
    return { x: event.clientX, y: event.clientY };
  }
  if ('touches' in event) {
    const touches = event.touches as TouchList;
    if (touches.length > 0) return { x: touches[0].clientX, y: touches[0].clientY };
  }
  return null;
}
