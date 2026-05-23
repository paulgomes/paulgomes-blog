type ConfirmOpts = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

declare global {
  interface Window {
    confirmAction?: (opts: ConfirmOpts) => Promise<boolean>;
  }
}

function confirmAction(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'painel-confirm-overlay';

    const card = document.createElement('div');
    card.className = 'painel-confirm-card';

    const h = document.createElement('h3');
    h.textContent = opts.title;

    const p = document.createElement('p');
    p.textContent = opts.message;

    const actions = document.createElement('div');
    actions.className = 'painel-confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'painel-button secondary';
    cancelBtn.textContent = opts.cancelLabel || 'Cancelar';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = opts.danger ? 'painel-button danger' : 'painel-button primary';
    confirmBtn.textContent = opts.confirmLabel || 'Confirmar';

    actions.append(cancelBtn, confirmBtn);
    card.append(h, p, actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('show'));

    const cleanup = (result: boolean) => {
      overlay.classList.remove('show');
      document.removeEventListener('keydown', escHandler);
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cleanup(false);
    };
    document.addEventListener('keydown', escHandler);

    cancelBtn.focus();
  });
}

window.confirmAction = confirmAction;

export {};
