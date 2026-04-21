import { THEME } from './theme.js';
import { applyImportantStyles } from './ui.js';
import { sendExtractedItems } from './messaging.js';

export function enterPickMode(state) {
  state.isPickMode = true;
  document.body.style.cursor = 'pointer';
  if (state.drawHint && state.drawHint.parentNode) state.drawHint.remove();

  showPickHint(state);
  document.removeEventListener('mousedown', state.onMouseDown, { capture: true });
  document.addEventListener('click', state.onPickClick, true);
}

function showPickHint(state) {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  state.pickCountPill = document.createElement('div');
  applyImportantStyles(state.pickCountPill, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 18px',
    'border-radius': '100px',
    'font-size': '13px',
    'font-weight': '600',
    'font-family': 'system-ui, -apple-system, sans-serif',
    'z-index': '2147483647',
    'pointer-events': 'none',
    background: isDark ? 'rgba(240, 236, 230, 0.95)' : 'rgba(26, 26, 26, 0.9)',
    color: isDark ? '#1a1a1a' : '#f0ece6',
    'box-shadow': '0 4px 16px rgba(0,0,0,0.18)',
    transition: 'opacity 0.15s',
  });
  state.pickCountPill.textContent = 'Click links to pick them. Press Enter to finish, Esc to cancel.';
  document.body.appendChild(state.pickCountPill);
}

function updatePickCount(state) {
  if (state.pickCountPill) {
    state.pickCountPill.textContent = state.pickedLinks.size + ' link(s) picked. Enter to finish, Esc to cancel.';
  }
}

export function onPickClick(state, e) {
  if (!state.isPickMode) return;
  e.preventDefault();
  e.stopPropagation();

  const link = e.target.closest('a[href]');
  if (!link || !link.href) return;

  if (state.pickedLinks.has(link.href)) {
    state.pickedLinks.delete(link.href);
    if (state.pickedElements.has(link)) {
      link.style.removeProperty('background-color');
      link.style.removeProperty('outline');
      link.style.removeProperty('border-radius');
      state.pickedElements.delete(link);
    }
  } else {
    state.pickedLinks.add(link.href);
    link.style.setProperty('background-color', THEME.pickHighlight, 'important');
    link.style.setProperty('outline', THEME.pickOutline, 'important');
    link.style.setProperty('border-radius', '3px', 'important');
    state.pickedElements.set(link, true);
  }
  updatePickCount(state);
}

export function finalizePickMode(state) {
  const items = { links: [], images: [], contacts: [] };
  const allLinks = document.querySelectorAll('a[href]');
  const pickedSet = new Set(state.pickedLinks);
  const seenUrls = new Set();
  allLinks.forEach(link => {
    if (pickedSet.has(link.href) && !seenUrls.has(link.href)) {
      seenUrls.add(link.href);
      if (link.href.startsWith('mailto:')) {
        items.contacts.push({ url: link.href, text: link.textContent.trim() });
      } else if (link.href.startsWith('tel:')) {
        items.contacts.push({ url: link.href, text: link.textContent.trim() });
      } else {
        items.links.push({ url: link.href, text: link.textContent.trim().substring(0, 500) });
      }
    }
  });
  sendExtractedItems(items, state.extractTypes);
  state.cleanup();
}
