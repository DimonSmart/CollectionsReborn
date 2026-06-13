import type { FolderChoice } from '../types.js';

export interface AddFavoriteResult {
  folderId: string;
  title: string;
  url: string;
}

export function showAddFavoriteModal(
  url: string,
  title: string,
  folders: FolderChoice[],
  defaultFolderId?: string,
): Promise<AddFavoriteResult | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog modal-dialog--add';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Add to favorites');

    const heading = document.createElement('h3');
    heading.className = 'modal-heading';
    heading.textContent = 'Add to favorites';

    const titleLabel = document.createElement('label');
    titleLabel.className = 'modal-label';
    titleLabel.textContent = 'Title';

    const titleInput = document.createElement('input');
    titleInput.className = 'modal-input';
    titleInput.type = 'text';
    titleInput.value = title;
    titleInput.setAttribute('aria-label', 'Bookmark title');

    const folderLabel = document.createElement('label');
    folderLabel.className = 'modal-label';
    folderLabel.textContent = 'Folder';

    const select = document.createElement('select');
    select.className = 'modal-select';
    select.setAttribute('aria-label', 'Select folder');

    for (const folder of folders) {
      const opt = document.createElement('option');
      opt.value = folder.id;
      opt.textContent = folder.path || folder.title;
      select.appendChild(opt);
    }

    if (folders.length === 0) {
      const opt = document.createElement('option');
      opt.value = '1';
      opt.textContent = 'Bookmarks Bar';
      select.appendChild(opt);
    }

    if (defaultFolderId) {
      const opt = select.querySelector<HTMLOptionElement>(`option[value="${defaultFolderId}"]`);
      if (opt) select.value = defaultFolderId;
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = 'Cancel';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn--primary';
    addBtn.textContent = 'Add';

    actions.append(cancelBtn, addBtn);
    dialog.append(heading, titleLabel, titleInput, folderLabel, select, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add('modal-overlay--visible');
      titleInput.focus();
      titleInput.select();
    });

    const close = (result: AddFavoriteResult | null) => {
      overlay.classList.remove('modal-overlay--visible');
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    };

    const tryAdd = () => {
      const t = titleInput.value.trim();
      const folderId = select.value;
      if (!t || !folderId) return;
      close({ folderId, title: t, url });
    };

    cancelBtn.addEventListener('click', () => close(null));
    addBtn.addEventListener('click', tryAdd);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && document.activeElement !== cancelBtn) tryAdd();
    });
  });
}
