import { createModalShell } from './ModalShell.js';

export function showInfo(message: string): Promise<void> {
  return new Promise((resolve) => {
    const close = () => {
      shell.close();
      resolve();
    };

    const shell = createModalShell({ ariaLabel: 'Information', onClose: close });

    const msg = document.createElement('p');
    msg.className = 'modal-message';
    msg.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn--primary';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', close);

    shell.dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        close();
      }
    });

    actions.appendChild(okBtn);
    shell.dialog.append(msg, actions);
    shell.open(okBtn);
  });
}

type ConfirmOptions = {
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
};

export function showConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const close = (result: boolean) => {
      shell.close();
      resolve(result);
    };

    const shell = createModalShell({ ariaLabel: 'Confirm', onClose: () => close(false) });

    const msg = document.createElement('p');
    msg.className = 'modal-message';
    msg.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => close(false));

    const confirmBtn = document.createElement('button');
    confirmBtn.className = `btn btn--${options.confirmVariant ?? 'danger'}`;
    confirmBtn.textContent = options.confirmLabel ?? 'Delete';
    confirmBtn.addEventListener('click', () => close(true));

    actions.append(cancelBtn, confirmBtn);
    shell.dialog.append(msg, actions);
    shell.open(confirmBtn);
  });
}
