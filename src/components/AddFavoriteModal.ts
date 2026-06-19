import type { FolderChoice } from '../types.js';
import { createModalShell } from './ModalShell.js';

export interface AddFavoriteResult {
  folderId: string;
  title: string;
  url: string;
}

export interface AddFavoriteModalOptions {
  beforeAdd?: () => Promise<boolean>;
}

export function showAddFavoriteModal(
  url: string,
  title: string,
  folders: FolderChoice[],
  defaultFolderId?: string,
  options: AddFavoriteModalOptions = {},
): Promise<AddFavoriteResult | null> {
  return new Promise((resolve) => {
    const close = (result: AddFavoriteResult | null) => {
      shell.close();
      resolve(result);
    };

    const shell = createModalShell({ ariaLabel: 'Add to favorites', onClose: () => close(null) });

    const heading = document.createElement('h3');
    heading.className = 'modal-heading';
    heading.textContent = 'Add to favorites';

    const titleLabel = document.createElement('label');
    titleLabel.className = 'modal-label';
    titleLabel.htmlFor = 'add-fav-title';
    titleLabel.textContent = 'Title';

    const titleInput = document.createElement('input');
    titleInput.className = 'modal-input';
    titleInput.type = 'text';
    titleInput.id = 'add-fav-title';
    titleInput.value = title;
    titleInput.setAttribute('aria-label', 'Bookmark title');

    const folderLabel = document.createElement('label');
    folderLabel.className = 'modal-label';
    folderLabel.htmlFor = 'add-fav-folder';
    folderLabel.textContent = 'Folder';

    const select = document.createElement('select');
    select.className = 'modal-select';
    select.id = 'add-fav-folder';
    select.setAttribute('aria-label', 'Select folder');

    for (const folder of folders) {
      const opt = document.createElement('option');
      opt.value = folder.id;
      opt.textContent = folder.path || folder.title;
      opt.disabled = !folder.canCreateChildren;
      select.appendChild(opt);
    }

    if (folders.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No writable folders';
      opt.disabled = true;
      select.appendChild(opt);
    }

    if (defaultFolderId) {
      const opt = select.querySelector<HTMLOptionElement>(`option[value="${defaultFolderId}"]`);
      if (opt) select.value = defaultFolderId;
    }
    if (!select.selectedOptions[0] || select.selectedOptions[0].disabled) {
      const firstWritable = [...select.options].find((option) => !option.disabled);
      if (firstWritable) select.value = firstWritable.value;
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => close(null));

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn--primary';
    addBtn.textContent = 'Add';
    addBtn.disabled = ![...select.options].some((option) => !option.disabled);

    const tryAdd = async () => {
      const t = titleInput.value.trim();
      const folderId = select.value;
      if (!t || !folderId) return;
      if (options.beforeAdd && !(await options.beforeAdd())) return;
      close({ folderId, title: t, url });
    };

    addBtn.addEventListener('click', () => void tryAdd());

    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void tryAdd();
      }
    });

    actions.append(cancelBtn, addBtn);
    shell.dialog.append(heading, titleLabel, titleInput, folderLabel, select, actions);
    shell.open(titleInput);
  });
}
