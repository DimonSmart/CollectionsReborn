export interface ModalShell {
  dialog: HTMLElement;
  open(focusEl?: HTMLElement): void;
  close(): void;
}

export function createModalShell(options: {
  dialogClass?: string;
  ariaLabel?: string;
  onClose: () => void;
}): ModalShell {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const dialog = document.createElement('div');
  dialog.className =
    'modal-dialog' + (options.dialogClass ? ` ${options.dialogClass}` : '');
  if (options.ariaLabel) {
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', options.ariaLabel);
  }

  overlay.appendChild(dialog);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) options.onClose();
  });

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      options.onClose();
    }
  });

  const close = () => {
    overlay.classList.remove('modal-overlay--visible');
    setTimeout(() => overlay.remove(), 150);
  };

  const open = (focusEl?: HTMLElement) => {
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('modal-overlay--visible');
      if (focusEl) {
        setTimeout(() => {
          focusEl.focus();
          (focusEl as HTMLInputElement).select?.();
        }, 50);
      }
    });
  };

  return { dialog, open, close };
}
