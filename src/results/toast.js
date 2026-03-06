import { dom } from './state.js';

const MAX_TOASTS = 3;

export function showToast(type, title, message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'pp-toast';
  toast.setAttribute('data-type', type);

  const titleEl = document.createElement('div');
  titleEl.className = 'pp-toast-title';
  titleEl.textContent = title;
  toast.appendChild(titleEl);

  if (message) {
    const msgEl = document.createElement('div');
    msgEl.className = 'pp-toast-message';
    msgEl.textContent = message;
    toast.appendChild(msgEl);
  }

  const progress = document.createElement('div');
  progress.className = 'pp-toast-progress';
  progress.style.width = '100%';
  toast.appendChild(progress);

  dom.toastContainer.appendChild(toast);

  const toasts = dom.toastContainer.querySelectorAll('.pp-toast:not(.pp-toast-out)');
  if (toasts.length > MAX_TOASTS) {
    dismissToast(toasts[0]);
  }

  let remaining = duration;
  let start = null;
  let rafId = null;
  let paused = false;

  function tick(timestamp) {
    if (!start) start = timestamp;
    if (!paused) {
      const elapsed = timestamp - start;
      remaining = duration - elapsed;
      if (remaining <= 0) {
        dismissToast(toast);
        return;
      }
      progress.style.width = ((remaining / duration) * 100) + '%';
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  toast.addEventListener('mouseenter', () => { paused = true; });
  toast.addEventListener('mouseleave', () => {
    paused = false;
    duration = remaining;
    start = null;
  });

  return toast;
}

function dismissToast(toast) {
  toast.classList.add('pp-toast-out');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}
