export async function showFolderEditor(currentName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = buildOverlay();
    const dialog = buildDialog();

    const heading = el('div', 'modal-heading', 'Edit folder name');
    const label = labelEl('editor-folder-name', 'Folder name');
    const input = inputEl('editor-folder-name', currentName);
    const errorEl = buildError();
    const actions = buildActions(
      () => {
        const val = input.value.trim();
        if (!val) {
          showError(errorEl, 'Name cannot be empty.');
          input.focus();
          return;
        }
        close(val);
      },
      () => close(null),
    );

    dialog.append(heading, label, input, errorEl, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (actions.querySelector('.btn--primary') as HTMLButtonElement)?.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close(null);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    function close(result: string | null): void {
      overlay.classList.remove('modal-overlay--visible');
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    }
  });
}

export async function showLinkEditor(
  currentTitle: string,
  currentUrl: string,
): Promise<{ title: string; url: string } | null> {
  return new Promise((resolve) => {
    const overlay = buildOverlay();
    const dialog = buildDialog();

    const heading = el('div', 'modal-heading', 'Edit link');

    const titleLabel = labelEl('editor-link-title', 'Title');
    const titleInput = inputEl('editor-link-title', currentTitle);
    const titleError = buildError();

    const urlLabel = labelEl('editor-link-url', 'Address');
    const urlInput = inputEl('editor-link-url', currentUrl);
    urlInput.type = 'url';
    urlInput.placeholder = 'https://example.com';
    const urlError = buildError();

    const actions = buildActions(
      () => {
        const title = titleInput.value.trim();
        const rawUrl = urlInput.value.trim();

        let hasError = false;
        if (!title) {
          showError(titleError, 'Title cannot be empty.');
          titleInput.focus();
          hasError = true;
        }
        if (!rawUrl) {
          showError(urlError, 'Address cannot be empty.');
          if (!hasError) urlInput.focus();
          hasError = true;
        }
        if (hasError) return;

        const url = normalizeUrl(rawUrl);
        if (!url) {
          showError(urlError, 'Enter a valid URL.');
          urlInput.focus();
          return;
        }
        close({ title, url });
      },
      () => close(null),
    );

    dialog.append(heading, titleLabel, titleInput, titleError, urlLabel, urlInput, urlError, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));
    setTimeout(() => {
      titleInput.focus();
      titleInput.select();
    }, 50);

    [titleInput, urlInput].forEach((inp) => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (actions.querySelector('.btn--primary') as HTMLButtonElement)?.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          close(null);
        }
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    function close(result: { title: string; url: string } | null): void {
      overlay.classList.remove('modal-overlay--visible');
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    }
  });
}

function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return 'https://' + s;
}

function buildOverlay(): HTMLElement {
  const o = document.createElement('div');
  o.className = 'modal-overlay';
  return o;
}

function buildDialog(): HTMLElement {
  const d = document.createElement('div');
  d.className = 'modal-dialog';
  return d;
}

function el(tag: string, className: string, text: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = text;
  return e;
}

function labelEl(forId: string, text: string): HTMLElement {
  const l = document.createElement('label');
  l.className = 'modal-label';
  l.htmlFor = forId;
  l.textContent = text;
  return l;
}

function inputEl(id: string, value: string): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'text';
  i.id = id;
  i.className = 'modal-input';
  i.value = value;
  return i;
}

function buildError(): HTMLElement {
  const e = document.createElement('div');
  e.className = 'editor-error';
  e.style.display = 'none';
  return e;
}

function showError(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.style.display = 'block';
}

function buildActions(onSave: () => void, onCancel: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn--secondary btn--sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', onCancel);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn--primary btn--sm';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', onSave);

  wrap.append(cancelBtn, saveBtn);
  return wrap;
}
