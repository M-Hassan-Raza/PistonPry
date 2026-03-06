import { state, $, dom } from './state.js';
import { showToast } from './toast.js';
import { getVisibleItems, getCheckedItems, updateSelectionState } from './selection.js';
import { getSelectedUrls } from './actions.js';

export function handleKeyboardShortcuts(e, setGroupedView) {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (e.key === 'Escape') {
      e.target.blur();
      return;
    }
    return;
  }

  const mod = e.metaKey || e.ctrlKey;

  if (state.pendingChord === 'g') {
    state.pendingChord = null;
    if (e.key === 'd') {
      e.preventDefault();
      setGroupedView(true);
      return;
    }
    if (e.key === 'f') {
      e.preventDefault();
      setGroupedView(false);
      return;
    }
  }

  if (e.key === 'g' && !mod) {
    state.pendingChord = 'g';
    setTimeout(() => { state.pendingChord = null; }, 500);
    return;
  }

  if (e.key === 'j' || e.key === 'k') {
    e.preventDefault();
    const items = getVisibleItems();
    if (items.length === 0) return;

    if (e.key === 'j') state.focusedIndex = Math.min(state.focusedIndex + 1, items.length - 1);
    else state.focusedIndex = Math.max(state.focusedIndex - 1, 0);

    items.forEach((li, i) => li.classList.toggle('pp-link-focused', i === state.focusedIndex));
    items[state.focusedIndex]?.scrollIntoView({ block: 'nearest' });
    return;
  }

  if (e.key === 'x') {
    const items = getVisibleItems();
    if (state.focusedIndex >= 0 && state.focusedIndex < items.length) {
      e.preventDefault();
      const cb = items[state.focusedIndex].querySelector('.pp-checkbox');
      cb.checked = !cb.checked;
      items[state.focusedIndex].classList.toggle('selected', cb.checked);
      updateSelectionState();
    }
    return;
  }

  if (e.key === 'Enter' && !mod) {
    const items = getVisibleItems();
    if (state.focusedIndex >= 0 && state.focusedIndex < items.length) {
      e.preventDefault();
      const url = items[state.focusedIndex].querySelector('.pp-link-url')?.href;
      if (url) window.open(url, '_blank');
    }
    return;
  }

  if (e.key === 'c' && !mod) {
    const items = getVisibleItems();
    if (state.focusedIndex >= 0 && state.focusedIndex < items.length) {
      e.preventDefault();
      const url = items[state.focusedIndex].querySelector('.pp-link-url')?.href || items[state.focusedIndex].dataset.url;
      if (url) {
        navigator.clipboard.writeText(url);
        showToast('success', 'Copied', 'URL copied to clipboard');
      }
    }
    return;
  }

  if (e.key === '/') {
    e.preventDefault();
    dom.searchInput.focus();
    return;
  }

  if (e.key === 'Escape') {
    getVisibleItems().forEach(li => {
      const cb = li.querySelector('.pp-checkbox');
      cb.checked = false;
      li.classList.remove('selected');
      li.classList.remove('pp-link-focused');
    });
    state.focusedIndex = -1;
    updateSelectionState();
    return;
  }

  if (e.key === '?' && !mod) {
    e.preventDefault();
    $('#shortcutsDialog').showModal();
    return;
  }

  if (mod && e.key === 'a') {
    e.preventDefault();
    getVisibleItems().forEach(li => {
      const cb = li.querySelector('.pp-checkbox');
      cb.checked = true;
      li.classList.add('selected');
    });
    updateSelectionState();
    return;
  }

  if (mod && e.key === 'c') {
    const selected = getSelectedUrls();
    if (selected.length > 0) {
      e.preventDefault();
      navigator.clipboard.writeText(selected.join('\n'));
      showToast('success', 'Copied', selected.length + ' link(s)');
    }
  }
}
