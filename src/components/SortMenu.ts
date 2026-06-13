import type { SortAction } from '../types.js';
import { closeActionsMenu } from './ActionsMenu.js';

const SORT_ITEMS: { label: string; action: SortAction }[] = [
  { label: 'Folders first', action: 'folders-first' },
  { label: 'Links first', action: 'links-first' },
  { label: 'Sort by title A–Z', action: 'title-asc' },
  { label: 'Sort by title Z–A', action: 'title-desc' },
  { label: 'Sort links by domain', action: 'domain-asc' },
];

let currentMenu: HTMLElement | null = null;
let outsideHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

export function showSortMenu(
  anchor: HTMLElement,
  onSort: (action: SortAction) => void,
): void {
  closeSortMenu();
  closeActionsMenu();

  const menu = document.createElement('div');
  menu.className = 'actions-menu';

  for (const item of SORT_ITEMS) {
    const btn = document.createElement('button');
    btn.className = 'actions-menu__item';
    btn.textContent = item.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSortMenu();
      onSort(item.action);
    });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  currentMenu = menu;
  positionMenu(menu, anchor);

  outsideHandler = (e: MouseEvent) => {
    if (currentMenu && !currentMenu.contains(e.target as Node)) {
      closeSortMenu();
    }
  };
  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeSortMenu();
  };

  setTimeout(() => {
    document.addEventListener('click', outsideHandler!, true);
    document.addEventListener('keydown', escHandler!, true);
  }, 0);
}

export function closeSortMenu(): void {
  if (currentMenu) {
    currentMenu.remove();
    currentMenu = null;
  }
  if (outsideHandler) {
    document.removeEventListener('click', outsideHandler, true);
    outsideHandler = null;
  }
  if (escHandler) {
    document.removeEventListener('keydown', escHandler, true);
    escHandler = null;
  }
}

function positionMenu(menu: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const menuWidth = 185;

  let left = rect.right - menuWidth;
  let top = rect.bottom + 2;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (left < 4) left = 4;
  if (left + menuWidth > vw - 4) left = vw - menuWidth - 4;

  menu.style.position = 'fixed';
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.zIndex = '9999';
  menu.style.minWidth = `${menuWidth}px`;

  requestAnimationFrame(() => {
    const mh = menu.offsetHeight;
    if (top + mh > vh - 4) {
      menu.style.top = `${rect.top - mh - 2}px`;
    }
  });
}
