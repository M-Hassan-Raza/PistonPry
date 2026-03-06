import { THEME } from './theme.js';

export function applyImportantStyles(el, styles) {
  for (const [prop, value] of Object.entries(styles)) {
    el.style.setProperty(prop, value, 'important');
  }
}

export function createOverlay() {
  const div = document.createElement('div');
  applyImportantStyles(div, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    'background-color': 'rgba(0, 0, 0, 0.35)',
    'z-index': '2147483646',
    'pointer-events': 'none',
  });
  document.body.appendChild(div);
  return div;
}

export function createSelectionDiv() {
  const div = document.createElement('div');
  applyImportantStyles(div, {
    position: 'fixed',
    border: `1.5px solid ${THEME.accent}`,
    'background-color': THEME.accentFill,
    'border-radius': '4px',
    'z-index': '2147483647',
    'pointer-events': 'none',
  });
  document.body.appendChild(div);
  return div;
}

export function createCountIndicator() {
  const div = document.createElement('div');
  applyImportantStyles(div, {
    position: 'fixed',
    'background-color': THEME.accentBadge,
    'backdrop-filter': 'blur(8px)',
    '-webkit-backdrop-filter': 'blur(8px)',
    color: 'white',
    padding: '3px 10px',
    'border-radius': '100px',
    'font-size': '11px',
    'font-weight': '600',
    'font-family': 'system-ui, -apple-system, sans-serif',
    'z-index': '2147483647',
    'pointer-events': 'none',
    'box-shadow': '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'transform 0.1s ease-out',
    display: 'none',
  });
  div.textContent = '0 links';
  document.body.appendChild(div);
  return div;
}

export function highlightLink(link, highlightedLinks) {
  if (!highlightedLinks.has(link)) {
    link.style.setProperty('transition', 'all 0.1s ease-in-out', 'important');
    link.style.setProperty('background-color', THEME.highlightBg, 'important');
    link.style.setProperty('border-radius', '3px', 'important');
    link.style.setProperty('outline', THEME.highlightOutline, 'important');
    highlightedLinks.add(link);
  }
}

export function unhighlightLink(link, highlightedLinks) {
  if (highlightedLinks.has(link)) {
    link.style.removeProperty('background-color');
    link.style.removeProperty('outline');
    link.style.removeProperty('border-radius');
    link.style.removeProperty('transition');
    highlightedLinks.delete(link);
  }
}

export function clearAllHighlights(highlightedLinks) {
  highlightedLinks.forEach(link => unhighlightLink(link, highlightedLinks));
  highlightedLinks.clear();
}

export function updateCountIndicator(countIndicator, count) {
  if (!countIndicator) return;
  countIndicator.style.setProperty('display', count > 0 ? 'block' : 'none', 'important');
  countIndicator.textContent = count + (count === 1 ? ' item' : ' items');
  countIndicator.style.setProperty('transform', 'scale(1.1)', 'important');
  setTimeout(() => {
    if (countIndicator) countIndicator.style.setProperty('transform', 'scale(1)', 'important');
  }, 100);
}

export function positionCountIndicator(countIndicator, x, y) {
  if (!countIndicator) return;
  countIndicator.style.setProperty('left', `${x + 10}px`, 'important');
  countIndicator.style.setProperty('top', `${y - 30}px`, 'important');
}

export function showDrawHint() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const hint = document.createElement('div');
  hint.textContent = 'Drag to select | Hold Alt to click-pick | Hold Shift after draw for multi-region';
  applyImportantStyles(hint, {
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
    opacity: '0',
    transition: 'opacity 0.25s',
    background: isDark ? 'rgba(240, 236, 230, 0.95)' : 'rgba(26, 26, 26, 0.9)',
    color: isDark ? '#1a1a1a' : '#f0ece6',
    'box-shadow': '0 4px 16px rgba(0,0,0,0.18)',
  });
  document.body.appendChild(hint);
  requestAnimationFrame(() => { hint.style.setProperty('opacity', '1', 'important'); });
  const dismiss = () => {
    hint.style.setProperty('opacity', '0', 'important');
    hint.addEventListener('transitionend', () => hint.remove(), { once: true });
  };
  setTimeout(dismiss, 3000);
  document.addEventListener('mousedown', dismiss, { capture: true, once: true });
  return hint;
}

export function showMultiRegionHint(state) {
  if (state.multiRegionHint && state.multiRegionHint.parentNode) state.multiRegionHint.remove();
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const hint = document.createElement('div');
  applyImportantStyles(hint, {
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
  });
  hint.textContent = `Region ${state.regionCount} added (${state.accumulatedUrlSet.size} items). Hold Shift+draw for more, or draw without Shift to finish.`;
  document.body.appendChild(hint);
  state.multiRegionHint = hint;
}
