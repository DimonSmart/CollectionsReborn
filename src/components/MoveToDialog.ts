import type { BookmarkEntryViewModel, FolderChoice } from '../types.js';

export function showMoveToDialog(
  item: BookmarkEntryViewModel,
  allFolders: FolderChoice[],
  fullTree: chrome.bookmarks.BookmarkTreeNode[],
): Promise<string | null> {
  const disabledIds = buildDisabledSet(item, fullTree);
  const choices = allFolders.map((f) => ({
    ...f,
    disabled: disabledIds.has(f.id),
    isCurrent: f.id === item.parentId,
  }));

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog modal-dialog--move';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Move to folder');

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

    let selectedId: string | null = null;

    const renderList = (filter: string) => {
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

        if (choice.disabled) row.classList.add('move-folder-row--disabled');
        if (choice.isCurrent) row.classList.add('move-folder-row--current');
        if (choice.id === selectedId) row.classList.add('move-folder-row--selected');

        row.style.paddingLeft = `${12 + choice.depth * 14}px`;

        const iconEl = document.createElement('span');
        iconEl.className = 'move-folder-icon';
        iconEl.setAttribute('aria-hidden', 'true');
        iconEl.innerHTML = svgFolder();

        const labelEl = document.createElement('span');
        labelEl.className = 'move-folder-label';

        if (q) {
          labelEl.textContent = choice.path;
        } else {
          labelEl.textContent = choice.title;
        }

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

    searchInput.addEventListener('input', () => {
      renderList(searchInput.value);
    });

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

    dialog.append(heading, searchInput, folderList, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    renderList('');

    requestAnimationFrame(() => {
      overlay.classList.add('modal-overlay--visible');
      searchInput.focus();
    });

    const close = (result: string | null) => {
      overlay.classList.remove('modal-overlay--visible');
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    };

    cancelBtn.addEventListener('click', () => close(null));
    moveBtn.addEventListener('click', () => {
      if (selectedId) close(selectedId);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && !moveBtn.disabled) close(selectedId);
    });
  });
}

function buildDisabledSet(
  item: BookmarkEntryViewModel,
  fullTree: chrome.bookmarks.BookmarkTreeNode[],
): Set<string> {
  const disabled = new Set<string>();

  // Always disable the item's current parent (already there)
  disabled.add(item.parentId);

  if (item.type === 'folder') {
    // Disable the folder itself and all its descendants
    const collectSubtree = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      for (const n of nodes) {
        if (!n.url) {
          disabled.add(n.id);
          collectSubtree(n.children ?? []);
        }
      }
    };

    const findAndCollect = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
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
