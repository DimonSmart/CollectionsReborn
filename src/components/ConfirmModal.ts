export function showInfo(message: string): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const msg = document.createElement('p');
    msg.className = 'modal-message';
    msg.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn--primary';
    okBtn.textContent = 'OK';

    actions.appendChild(okBtn);
    dialog.append(msg, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add('modal-overlay--visible');
      okBtn.focus();
    });

    const close = () => {
      overlay.classList.remove('modal-overlay--visible');
      setTimeout(() => overlay.remove(), 150);
      resolve();
    };

    okBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') close();
    });
  });
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const msg = document.createElement('p');
    msg.className = 'modal-message';
    msg.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = 'Cancel';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn--danger';
    confirmBtn.textContent = 'Delete';

    actions.append(cancelBtn, confirmBtn);
    dialog.append(msg, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add('modal-overlay--visible');
      confirmBtn.focus();
    });

    const close = (result: boolean) => {
      overlay.classList.remove('modal-overlay--visible');
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    };

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(false);
    });
  });
}
