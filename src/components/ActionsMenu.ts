export type MenuItem = MenuActionItem | MenuSeparatorItem;

export interface MenuActionItem {
  label: string;
  action: () => void;
  variant?: 'danger';
  disabled?: boolean;
  disabledReason?: string;
}

export interface MenuSeparatorItem {
  type: 'separator';
}

let currentMenu: HTMLElement | null = null;
let outsideHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

export function showActionsMenu(anchor: HTMLElement, items: MenuItem[]): void {
  closeActionsMenu();

  const menu = document.createElement('div');
  menu.className = 'actions-menu';

  for (const item of items) {
    if (isSeparatorItem(item)) {
      const separator = document.createElement('div');
      separator.className = 'actions-menu__separator';
      separator.setAttribute('role', 'separator');
      menu.appendChild(separator);
      continue;
    }

    const btn = document.createElement('button');
    btn.className =
      'actions-menu__item' + (item.variant === 'danger' ? ' actions-menu__item--danger' : '');
    btn.textContent = item.label;
    btn.disabled = item.disabled === true;
    if (item.disabledReason) btn.title = item.disabledReason;
    if (!item.disabled) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeActionsMenu();
        item.action();
      });
    }
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  currentMenu = menu;
  positionMenu(menu, anchor);

  outsideHandler = (e: MouseEvent) => {
    if (currentMenu && !currentMenu.contains(e.target as Node)) {
      closeActionsMenu();
    }
  };

  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeActionsMenu();
    }
  };

  setTimeout(() => {
    document.addEventListener('click', outsideHandler!, true);
    document.addEventListener('keydown', escHandler!, true);
  }, 0);
}

function isSeparatorItem(item: MenuItem): item is MenuSeparatorItem {
  return 'type' in item && item.type === 'separator';
}

export function closeActionsMenu(): void {
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
  const menuWidth = 170;

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
