import type { FavoriteItemViewModel, ViewMode } from '../types.js';
import { showActionsMenu } from './ActionsMenu.js';
import { showLinkEditor } from './ItemEditor.js';

export interface FavoriteItemCallbacks {
  onOpen: (item: FavoriteItemViewModel) => void;
  onEdit: (item: FavoriteItemViewModel, newTitle: string, newUrl: string) => Promise<void>;
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
  const menuBtn = buildMenuBtn(item, callbacks);

  el.append(favicon, info, menuBtn);

  el.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.action-btn')) return;
    callbacks.onOpen(item);
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

function buildMenuBtn(
  item: FavoriteItemViewModel,
  callbacks: FavoriteItemCallbacks,
): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'action-btn item-menu-btn';
  btn.setAttribute('aria-label', `Actions for ${item.title}`);
  btn.innerHTML = svgEllipsis();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    showActionsMenu(btn, [
      {
        label: 'Edit…',
        action: async () => {
          const result = await showLinkEditor(item.title, item.url);
          if (result) {
            await callbacks.onEdit(item, result.title, result.url);
          }
        },
      },
      {
        label: 'Open',
        action: () => callbacks.onOpen(item),
      },
      {
        label: 'Delete',
        variant: 'danger',
        action: () => callbacks.onDelete(item),
      },
    ]);
  });

  return btn;
}

function svgEllipsis(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>`;
}
