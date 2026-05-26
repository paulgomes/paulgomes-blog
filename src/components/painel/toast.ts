type ToastType = 'success' | 'error' | 'info';

declare global {
  interface Window {
    toast?: (message: string, type?: ToastType, duration?: number) => void;
  }
}

const COLORS: Record<ToastType, string> = {
  success: '#10b981',
  error: '#ef4444',
  info: '#0103F9',
};

function ensureContainer(): HTMLElement {
  let el = document.getElementById('toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  const container = ensureContainer();
  const toast = document.createElement('div');
  toast.className = 'painel-toast';
  toast.setAttribute('role', 'status');
  toast.style.borderLeftColor = COLORS[type];
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

window.toast = showToast;

export {};
