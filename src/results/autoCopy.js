import { state, dom } from './state.js';
import { showToast } from './toast.js';

export async function initAutoCopy() {
  const result = await chrome.storage.local.get('autoCopyEnabled');
  const enabled = result.autoCopyEnabled || false;
  updateAutoCopyUI(enabled);

  if (enabled && state.allLinks.length > 0 && !state.isCollectionView) {
    const urls = state.allLinks.map(l => l.url);
    try {
      await navigator.clipboard.writeText(urls.join('\n'));
      showToast('info', 'Auto-copied', `${urls.length} link(s) copied to clipboard`);
    } catch { /* clipboard might not be available */ }
  }
}

function updateAutoCopyUI(enabled) {
  dom.autoCopyToggle.textContent = 'Auto-copy: ' + (enabled ? 'On' : 'Off');
  dom.autoCopyToggle.classList.toggle('active', enabled);
}

export async function toggleAutoCopy() {
  const result = await chrome.storage.local.get('autoCopyEnabled');
  const newState = !(result.autoCopyEnabled || false);
  await chrome.storage.local.set({ autoCopyEnabled: newState });
  updateAutoCopyUI(newState);
  showToast('info', 'Auto-copy ' + (newState ? 'enabled' : 'disabled'));
}
