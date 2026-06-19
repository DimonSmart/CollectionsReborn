import type { BookmarkEntryViewModel, FolderEntryViewModel, FolderViewCallbacks, LinkEntryViewModel } from '../types.js';
import { showActionsMenu } from './ActionsMenu.js';

const BROWSER_PAGE_PROTOCOLS = new Set(['chrome:', 'edge:', 'about:', 'devtools:']);

export function createBookmarkRow(
  entry: BookmarkEntryViewModel,
  callbacks: FolderViewCallbacks,
): HTMLElement {
  const li = document.createElement('li');
  li.className = `bookmark-row bookmark-row--${entry.type}`;
  li.dataset.id = entry.id;
  li.dataset.movable = String(entry.capabilities.canMove);
  if (entry.type === 'folder') {
    li.dataset.acceptsChildren = String(entry.capabilities.canCreateChildren);
    if (entry.capabilities.canCreateChildren) li.dataset.dropHint = 'Move into folder';
  }
  li.setAttribute('role', 'listitem');

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.setAttribute('aria-hidden', 'true');
  handle.title = 'Drag to reorder or move into a folder';
  if (!entry.capabilities.canMove) {
    li.classList.add('bookmark-row--not-draggable');
    handle.title = 'This item cannot be moved';
  }
  handle.innerHTML = svgDragHandle();

  const menuBtn = buildMenuBtn(entry, callbacks);

  if (entry.type === 'folder') {
    li.tabIndex = 0;
    li.setAttribute('aria-label', `Open folder ${entry.title}, ${formatBookmarkCount(entry.childCount)}`);
    li.append(handle, buildFolderIcon(), buildInfo(entry), buildFolderChevron(), menuBtn);
  } else {
    li.append(handle, buildLinkPreview(entry), buildInfo(entry), menuBtn);
  }

  li.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.drag-handle, .action-btn')) return;
    if (entry.type === 'folder') {
      callbacks.onNavigateToFolder(entry.id);
    } else {
      callbacks.onOpenLink(entry);
    }
  });

  if (entry.type === 'folder') {
    li.addEventListener('keydown', (e) => {
      if (e.target !== li || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      callbacks.onNavigateToFolder(entry.id);
    });
  }

  return li;
}

function buildLinkPreview(entry: LinkEntryViewModel): HTMLElement {
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

  const fallback = document.createElement('span');
  fallback.className = 'row-preview-fallback';
  if (isBrowserPageUrl(entry.url)) {
    fallback.appendChild(buildBrowserPageIcon());
    el.appendChild(fallback);
    return el;
  }

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

  return el;
}

function isBrowserPageUrl(url: string): boolean {
  try {
    return BROWSER_PAGE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

function buildBrowserPageIcon(): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'browser-page-icon';
  icon.innerHTML = svgGear();
  return icon;
}

function buildFolderIcon(): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'folder-icon-tile';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = svgFolder();
  return icon;
}

function buildFolderChevron(): HTMLElement {
  const chevron = document.createElement('span');
  chevron.className = 'folder-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';
  return chevron;
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
    metaEl.textContent = formatBookmarkCount(entry.childCount);
  } else {
    metaEl.className = 'row-meta row-meta--domain';
    metaEl.textContent = entry.domain;
  }

  info.append(titleEl, metaEl);
  return info;
}

function formatBookmarkCount(count: number): string {
  return `${count} ${count === 1 ? 'bookmark' : 'bookmarks'}`;
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
      { label: 'Rename…', action: () => callbacks.onRenameFolder(entry as FolderEntryViewModel), disabled: !entry.capabilities.canRename, disabledReason: 'This browser folder cannot be renamed' },
      { label: 'Move to…', action: () => callbacks.onMoveItem(entry), disabled: !entry.capabilities.canMove, disabledReason: 'This item cannot be moved' },
      { type: 'separator' as const },
      { label: 'New folder before…', action: () => callbacks.onCreateFolderNearItem(entry, 'before'), disabled: !entry.capabilities.canCreateFolderBefore, disabledReason: 'A folder cannot be created here' },
      { label: 'New folder after…', action: () => callbacks.onCreateFolderNearItem(entry, 'after'), disabled: !entry.capabilities.canCreateFolderAfter, disabledReason: 'A folder cannot be created here' },
      { type: 'separator' as const },
      { label: 'Delete', variant: 'danger' as const, action: () => callbacks.onDeleteItem(entry), disabled: !entry.capabilities.canDelete, disabledReason: 'This item cannot be deleted' },
    ];
  } else {
    return [
      { label: 'Open', action: () => callbacks.onOpenLink(entry as LinkEntryViewModel) },
      { label: 'Edit…', action: () => callbacks.onEditLink(entry as LinkEntryViewModel), disabled: !entry.capabilities.canEditUrl, disabledReason: 'This bookmark cannot be edited' },
      { label: 'Move to…', action: () => callbacks.onMoveItem(entry), disabled: !entry.capabilities.canMove, disabledReason: 'This item cannot be moved' },
      {
        label: entry.preview?.status === 'ok' ? 'Update preview' : 'Generate preview',
        action: () => callbacks.onGeneratePreview(entry),
      },
      ...(entry.preview && entry.preview.status !== 'none'
        ? [{ label: 'Remove preview', action: () => callbacks.onRemovePreview(entry) }]
        : []),
      { label: 'Update URL from current tab', action: () => callbacks.onUpdateLinkUrlFromCurrentTab(entry as LinkEntryViewModel), disabled: !entry.capabilities.canEditUrl, disabledReason: 'This bookmark URL cannot be edited' },
      { type: 'separator' as const },
      { label: 'New folder before…', action: () => callbacks.onCreateFolderNearItem(entry, 'before'), disabled: !entry.capabilities.canCreateFolderBefore, disabledReason: 'A folder cannot be created here' },
      { label: 'New folder after…', action: () => callbacks.onCreateFolderNearItem(entry, 'after'), disabled: !entry.capabilities.canCreateFolderAfter, disabledReason: 'A folder cannot be created here' },
      { type: 'separator' as const },
      { label: 'Delete', variant: 'danger' as const, action: () => callbacks.onDeleteItem(entry), disabled: !entry.capabilities.canDelete, disabledReason: 'This item cannot be deleted' },
    ];
  }
}

function svgDragHandle(): string {
  return `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="3" cy="2.5" r="1.3"/><circle cx="7" cy="2.5" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="11.5" r="1.3"/><circle cx="7" cy="11.5" r="1.3"/></svg>`;
}

function svgFolder(): string {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
}

function svgEllipsis(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>`;
}

function svgGear(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.38.35.72.6 1 .3.3.7.43 1.1.4h.09v4h-.09A1.7 1.7 0 0 0 19.4 15z"/></svg>`;
}
