import type { FavoriteItemViewModel, ViewMode } from '../types.js';

export interface FavoriteItemCallbacks {
  onOpen: (item: FavoriteItemViewModel) => void;
  onRename: (item: FavoriteItemViewModel, newTitle: string) => Promise<void>;
  onDelete: (item: FavoriteItemViewModel) => Promise<void>;
}

export function createFavoriteItem(
  item: FavoriteItemViewModel,
  mode: ViewMode,
  callbacks: FavoriteItemCallbacks,
): HTMLElement {
  const el = document.createElement('div');
  el.className = `favorite-item favorite-item--${mode}`;
  el.dataset.id = item.id;
  el.setAttribute('role', 'listitem');

  const favicon = buildFavicon(item, mode);
  const info = buildInfo(item, mode);
  const actions = buildActions(item, callbacks, el, info);

  el.append(favicon, info, actions);

  el.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.item-actions')) return;
    if ((e.target as HTMLElement).closest('.item-title[contenteditable="true"]')) return;
    callbacks.onOpen(item);
  });

  el.addEventListener('dblclick', (e) => {
    if ((e.target as HTMLElement).closest('.item-actions')) return;
    startRename(item, el, info, callbacks);
  });

  el.title = `${item.title}\n${item.url}`;

  return el;
}

function buildFavicon(item: FavoriteItemViewModel, mode: ViewMode): HTMLElement {
  const size = mode === 'compact' ? 16 : 24;
  const wrapper = document.createElement('div');
  wrapper.className = 'favicon-wrapper';
  wrapper.style.width = `${size}px`;
  wrapper.style.height = `${size}px`;
  wrapper.style.flexShrink = '0';

  const img = document.createElement('img');
  img.src = item.faviconUrl;
  img.width = size;
  img.height = size;
  img.alt = '';
  img.className = 'favicon-img';
  img.addEventListener('error', () => {
    wrapper.innerHTML = '';
    wrapper.appendChild(buildFallbackIcon(item.domain, size));
  });
  wrapper.appendChild(img);
  return wrapper;
}

function buildFallbackIcon(domain: string, size: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'favicon-fallback';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.fontSize = `${Math.round(size * 0.55)}px`;
  el.textContent = domain.charAt(0).toUpperCase() || '?';
  return el;
}

function buildInfo(item: FavoriteItemViewModel, mode: ViewMode): HTMLElement {
  const info = document.createElement('div');
  info.className = 'item-info';

  const title = document.createElement('span');
  title.className = 'item-title';
  title.textContent = item.title || item.domain || item.url;

  if (mode === 'normal') {
    const domain = document.createElement('span');
    domain.className = 'item-domain';
    domain.textContent = item.domain;
    info.append(title, domain);
  } else {
    const row = document.createElement('div');
    row.className = 'item-compact-row';
    const domain = document.createElement('span');
    domain.className = 'item-domain item-domain--compact';
    domain.textContent = item.domain;
    row.append(title, domain);
    info.appendChild(row);
  }

  return info;
}

function buildActions(
  item: FavoriteItemViewModel,
  callbacks: FavoriteItemCallbacks,
  el: HTMLElement,
  info: HTMLElement,
): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const renameBtn = document.createElement('button');
  renameBtn.className = 'action-btn';
  renameBtn.setAttribute('aria-label', 'Rename');
  renameBtn.innerHTML = svgPencil();
  renameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startRename(item, el, info, callbacks);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn action-btn--danger';
  deleteBtn.setAttribute('aria-label', 'Delete');
  deleteBtn.innerHTML = svgTrash();
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await callbacks.onDelete(item);
  });

  actions.append(renameBtn, deleteBtn);
  return actions;
}

function startRename(
  item: FavoriteItemViewModel,
  el: HTMLElement,
  info: HTMLElement,
  callbacks: FavoriteItemCallbacks,
): void {
  const titleEl = info.querySelector('.item-title') as HTMLElement | null;
  if (!titleEl || titleEl.contentEditable === 'true') return;

  el.title = '';
  titleEl.contentEditable = 'true';
  titleEl.classList.add('item-title--editing');
  titleEl.focus();
  selectAll(titleEl);

  const originalText = titleEl.textContent ?? '';

  const commit = async () => {
    const newTitle = (titleEl.textContent ?? '').trim();
    titleEl.contentEditable = 'false';
    titleEl.classList.remove('item-title--editing');
    el.title = `${item.title}\n${item.url}`;

    if (!newTitle) {
      titleEl.textContent = originalText;
      return;
    }
    if (newTitle === originalText) return;

    try {
      await callbacks.onRename(item, newTitle);
      item.title = newTitle;
    } catch {
      titleEl.textContent = originalText;
      showInlineError(el, 'Could not rename item.');
    }
  };

  const cancel = () => {
    titleEl.contentEditable = 'false';
    titleEl.classList.remove('item-title--editing');
    titleEl.textContent = originalText;
    el.title = `${item.title}\n${item.url}`;
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

function showInlineError(parent: HTMLElement, message: string): void {
  const err = document.createElement('div');
  err.className = 'inline-error';
  err.textContent = message;
  parent.appendChild(err);
  setTimeout(() => err.remove(), 3000);
}

function svgPencil(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}

function svgTrash(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
}
