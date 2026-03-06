export function showPageNotification(message) {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const div = document.createElement('div');
  div.textContent = message;
  Object.assign(div.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 20px',
    borderRadius: '100px',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    zIndex: '2147483647',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.25s',
    background: isDark ? '#f0ece6' : '#1a1a1a',
    color: isDark ? '#1a1a1a' : '#f0ece6',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
  });
  document.body.appendChild(div);
  requestAnimationFrame(() => { div.style.opacity = '1'; });
  setTimeout(() => {
    div.style.opacity = '0';
    div.addEventListener('transitionend', () => div.remove(), { once: true });
  }, 2500);
}
