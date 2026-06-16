import type { BookmarkEntryViewModel, FolderEntryViewModel, FolderViewCallbacks, LinkEntryViewModel } from '../types.js';
import { showActionsMenu } from './ActionsMenu.js';

export function createBookmarkRow(
  entry: BookmarkEntryViewModel,
  callbacks: FolderViewCallbacks,
): HTMLElement {
  const li = document.createElement('li');
  li.className = 'bookmark-row';
  li.dataset.id = entry.id;
  li.setAttribute('role', 'listitem');

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.setAttribute('aria-hidden', 'true');
  handle.title = 'Drag to reorder';
  handle.innerHTML = svgDragHandle();

  const icon = buildIcon(entry);
  const info = buildInfo(entry);
  const menuBtn = buildMenuBtn(entry, callbacks);

  li.append(handle, icon, info, menuBtn);

  li.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.drag-handle, .action-btn')) return;
    if (entry.type === 'folder') {
      callbacks.onNavigateToFolder(entry.id);
    } else {
      callbacks.onOpenLink(entry);
    }
  });

  return li;
}

function buildIcon(entry: BookmarkEntryViewModel): HTMLElement {
  const el = document.createElement('span');
  el.className = 'row-preview';
  el.setAttribute('aria-hidden', 'true');

  if (entry.preview?.status === 'ok' && entry.preview.objectUrl) {
    const img = document.createElement('img');
    img.src = entry.preview.objectUrl;
    img.alt = '';
    el.appendChild(img);
    return el;
  }

  if (entry.type === 'folder') {
    const fallback = document.createElement('span');
    fallback.className = 'row-preview-fallback row-preview-fallback--folder';
    fallback.innerHTML = svgFolder();
    el.appendChild(fallback);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'row-preview-fallback';
    const img = document.createElement('img');
    img.src = entry.faviconUrl;
    img.width = 16;
    img.height = 16;
    img.alt = '';
    img.className = 'favicon-img';
    img.addEventListener('error', () => {
      el.innerHTML = '';
      const fallback = document.createElement('div');
      fallback.className = 'favicon-fallback';
      fallback.style.width = '16px';
      fallback.style.height = '16px';
      fallback.style.fontSize = '9px';
      fallback.textContent = entry.domain.charAt(0).toUpperCase() || '?';
      el.appendChild(fallback);
    });
    fallback.appendChild(img);
    if (entry.preview?.status === 'pending') {
      const pending = document.createElement('span');
      pending.className = 'row-preview-pending';
      fallback.appendChild(pending);
    }
    el.appendChild(fallback);
  }

  return el;
}

function buildInfo(entry: BookmarkEntryViewModel): HTMLElement {
  const info = document.createElement('div');
  info.className = 'row-info';

  const titleEl = document.createElement('span');
  titleEl.className = 'row-title';
  titleEl.textContent = entry.title;

  const metaEl = document.createElement('span');

  if (entry.type === 'folder') {
    metaEl.className = 'row-meta row-meta--count';
    metaEl.textContent = String(entry.childCount);
  } else {
    metaEl.className = 'row-meta row-meta--domain';
    metaEl.textContent = entry.domain;
  }

  info.append(titleEl, metaEl);
  return info;
}

function buildMenuBtn(entry: BookmarkEntryViewModel, callbacks: FolderViewCallbacks): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'action-btn row-menu-btn';
  btn.setAttribute('aria-label', `Actions for ${entry.title}`);
  btn.innerHTML = svgEllipsis();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    showActionsMenu(btn, buildMenuItems(entry, callbacks));
  });

  return btn;
}

function buildMenuItems(entry: BookmarkEntryViewModel, callbacks: FolderViewCallbacks) {
  if (entry.type === 'folder') {
    return [
      { label: 'Open', action: () => callbacks.onNavigateToFolder(entry.id) },
      { label: 'Rename…', action: () => callbacks.onRenameFolder(entry as FolderEntryViewModel) },
      { label: 'Move to…', action: () => callbacks.onMoveItem(entry) },
      { label: 'Generate preview', action: () => callbacks.onGeneratePreview(entry) },
      ...(entry.preview && entry.preview.status !== 'none'
        ? [{ label: 'Remove preview', action: () => callbacks.onRemovePreview(entry) }]
        : []),
      { type: 'separator' as const },
      { label: 'New folder before…', action: () => callbacks.onCreateFolderNearItem(entry, 'before') },
      { label: 'New folder after…', action: () => callbacks.onCreateFolderNearItem(entry, 'after') },
      { type: 'separator' as const },
      { label: 'Delete', variant: 'danger' as const, action: () => callbacks.onDeleteItem(entry) },
    ];
  } else {
    return [
      { label: 'Open', action: () => callbacks.onOpenLink(entry as LinkEntryViewModel) },
      { label: 'Edit…', action: () => callbacks.onEditLink(entry as LinkEntryViewModel) },
      { label: 'Move to…', action: () => callbacks.onMoveItem(entry) },
      ...(!entry.preview || entry.preview.status !== 'ok'
        ? [{ label: 'Generate preview', action: () => callbacks.onGeneratePreview(entry) }]
        : []),
      ...(entry.preview && entry.preview.status !== 'none'
        ? [{ label: 'Remove preview', action: () => callbacks.onRemovePreview(entry) }]
        : []),
      { type: 'separator' as const },
      { label: 'New folder before…', action: () => callbacks.onCreateFolderNearItem(entry, 'before') },
      { label: 'New folder after…', action: () => callbacks.onCreateFolderNearItem(entry, 'after') },
      { type: 'separator' as const },
      { label: 'Delete', variant: 'danger' as const, action: () => callbacks.onDeleteItem(entry) },
    ];
  }
}

function svgDragHandle(): string {
  return `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="3" cy="2.5" r="1.3"/><circle cx="7" cy="2.5" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="11.5" r="1.3"/><circle cx="7" cy="11.5" r="1.3"/></svg>`;
}

function svgFolder(): string {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
}

function svgEllipsis(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>`;
}
