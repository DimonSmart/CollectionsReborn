import type { BookmarkEntryViewModel, FolderChoice, MoveToResult } from '../types.js';
import { createModalShell } from './ModalShell.js';

export function showMoveToDialog(
  item: BookmarkEntryViewModel,
  allFolders: FolderChoice[],
  fullTree: chrome.bookmarks.BookmarkTreeNode[],
): Promise<MoveToResult | null> {
  const disabledIds = buildDisabledSet(item, fullTree);
  const choices = allFolders.map((f) => ({
    ...f,
    disabled: disabledIds.has(f.id) || !f.canCreateChildren,
    isCurrent: f.id === item.parentId,
  }));

  return new Promise((resolve) => {
    let pathTooltip: HTMLDivElement | null = null;
    let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

    const hidePathTooltip = () => {
      if (tooltipTimer !== null) {
        clearTimeout(tooltipTimer);
        tooltipTimer = null;
      }
      if (pathTooltip) pathTooltip.hidden = true;
    };

    const close = (result: MoveToResult | null) => {
      hidePathTooltip();
      pathTooltip?.remove();
      shell.close();
      resolve(result);
    };

    const shell = createModalShell({
      dialogClass: 'modal-dialog--move',
      ariaLabel: 'Move to folder',
      onClose: () => close(null),
    });

    const heading = document.createElement('div');
    heading.className = 'modal-heading';
    heading.textContent = `Move "${truncate(item.title, 32)}" to…`;

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'modal-input move-dialog-search';
    searchInput.placeholder = 'Search folders…';
    searchInput.setAttribute('aria-label', 'Search folders');

    const folderList = document.createElement('ul');
    folderList.className = 'move-folder-list';
    folderList.setAttribute('role', 'listbox');
    folderList.setAttribute('aria-label', 'Select destination folder');

    pathTooltip = document.createElement('div');
    pathTooltip.className = 'move-folder-tooltip';
    pathTooltip.setAttribute('role', 'tooltip');
    pathTooltip.hidden = true;
    document.body.appendChild(pathTooltip);

    const showPathTooltip = (row: HTMLElement, path: string) => {
      hidePathTooltip();
      tooltipTimer = setTimeout(() => {
        if (!pathTooltip || !row.isConnected) return;

        pathTooltip.textContent = path;
        pathTooltip.hidden = false;

        const rowRect = row.getBoundingClientRect();
        const tooltipRect = pathTooltip.getBoundingClientRect();
        const viewportPadding = 8;
        const left = Math.min(
          Math.max(rowRect.left, viewportPadding),
          window.innerWidth - tooltipRect.width - viewportPadding,
        );
        const belowTop = rowRect.bottom + 6;
        const top = belowTop + tooltipRect.height <= window.innerHeight - viewportPadding
          ? belowTop
          : rowRect.top - tooltipRect.height - 6;

        pathTooltip.style.left = `${left}px`;
        pathTooltip.style.top = `${Math.max(viewportPadding, top)}px`;
        tooltipTimer = null;
      }, 350);
    };

    folderList.addEventListener('scroll', hidePathTooltip);

    let selectedId: string | null = null;

    const renderList = (filter: string) => {
      hidePathTooltip();
      folderList.innerHTML = '';
      const q = filter.trim().toLowerCase();
      const visible = q
        ? choices.filter((c) => c.title.toLowerCase().includes(q) || c.path.toLowerCase().includes(q))
        : choices;

      for (const choice of visible) {
        const row = document.createElement('li');
        row.className = 'move-folder-row';
        row.setAttribute('role', 'option');
        row.dataset.id = choice.id;
        row.setAttribute('aria-label', choice.path);
        row.addEventListener('mouseenter', () => showPathTooltip(row, choice.path));
        row.addEventListener('mouseleave', hidePathTooltip);

        if (choice.disabled) {
          row.classList.add('move-folder-row--disabled');
          row.setAttribute('aria-disabled', 'true');
          row.setAttribute('aria-label', `${choice.path}. This folder cannot accept items`);
        }
        if (choice.isCurrent) row.classList.add('move-folder-row--current');
        if (choice.id === selectedId) row.classList.add('move-folder-row--selected');

        row.style.paddingLeft = `${12 + choice.depth * 14}px`;

        const iconEl = document.createElement('span');
        iconEl.className = 'move-folder-icon';
        iconEl.setAttribute('aria-hidden', 'true');
        iconEl.innerHTML = svgFolder();

        const labelEl = document.createElement('span');
        labelEl.className = 'move-folder-label';
        labelEl.textContent = q ? choice.path : choice.title;

        if (choice.isCurrent) {
          const badge = document.createElement('span');
          badge.className = 'move-folder-badge';
          badge.textContent = 'current';
          row.append(iconEl, labelEl, badge);
        } else {
          row.append(iconEl, labelEl);
        }

        if (!choice.disabled) {
          row.addEventListener('click', () => {
            selectedId = choice.id;
            moveBtn.disabled = false;
            folderList.querySelectorAll('.move-folder-row--selected').forEach((r) =>
              r.classList.remove('move-folder-row--selected'),
            );
            row.classList.add('move-folder-row--selected');
          });
        }

        folderList.appendChild(row);
      }

      if (visible.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'move-folder-empty';
        empty.textContent = 'No folders found.';
        folderList.appendChild(empty);
      }
    };

    searchInput.addEventListener('input', () => renderList(searchInput.value));

    // Placement selector
    const placementRow = document.createElement('div');
    placementRow.className = 'move-placement';

    const placementLabel = document.createElement('label');
    placementLabel.className = 'modal-label';
    placementLabel.htmlFor = 'move-placement-select';
    placementLabel.textContent = 'Position';

    const placementSelect = document.createElement('select');
    placementSelect.className = 'modal-select';
    placementSelect.id = 'move-placement-select';

    const optEnd = document.createElement('option');
    optEnd.value = 'end';
    optEnd.textContent = 'At the end';
    optEnd.selected = true;

    const optBeginning = document.createElement('option');
    optBeginning.value = 'beginning';
    optBeginning.textContent = 'At the beginning';

    placementSelect.append(optEnd, optBeginning);
    placementRow.append(placementLabel, placementSelect);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--secondary btn--sm';
    cancelBtn.textContent = 'Cancel';

    const moveBtn = document.createElement('button');
    moveBtn.className = 'btn btn--primary btn--sm';
    moveBtn.textContent = 'Move';
    moveBtn.disabled = true;

    actions.append(cancelBtn, moveBtn);

    shell.dialog.append(heading, searchInput, folderList, placementRow, actions);

    renderList('');
    shell.open(searchInput);

    cancelBtn.addEventListener('click', () => close(null));
    moveBtn.addEventListener('click', () => {
      if (selectedId) {
        close({ folderId: selectedId, placement: placementSelect.value as 'beginning' | 'end' });
      }
    });

    shell.dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !moveBtn.disabled && selectedId) {
        close({ folderId: selectedId, placement: placementSelect.value as 'beginning' | 'end' });
      }
    });
  });
}

function buildDisabledSet(
  item: BookmarkEntryViewModel,
  fullTree: chrome.bookmarks.BookmarkTreeNode[],
): Set<string> {
  const disabled = new Set<string>();

  disabled.add(item.parentId);

  if (item.type === 'folder') {
    const collectSubtree = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      for (const n of nodes) {
        if (!n.url) {
          disabled.add(n.id);
          collectSubtree(n.children ?? []);
        }
      }
    };

    const findAndCollect = (nodes: chrome.bookmarks.BookmarkTreeNode[]): boolean => {
      for (const n of nodes) {
        if (n.id === item.id) {
          disabled.add(n.id);
          collectSubtree(n.children ?? []);
          return true;
        }
        if (findAndCollect(n.children ?? [])) return true;
      }
      return false;
    };

    findAndCollect(fullTree);
  }

  return disabled;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function svgFolder(): string {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
}
