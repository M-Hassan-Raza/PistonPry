import { $, $$ } from './state.js';
import { loadCollections } from './collections.js';
import { loadHistory } from './history.js';

export function switchTab(tabEl) {
  $$('.pp-tab').forEach(t => {
    t.setAttribute('aria-selected', 'false');
    t.setAttribute('tabindex', '-1');
  });
  tabEl.setAttribute('aria-selected', 'true');
  tabEl.setAttribute('tabindex', '0');
  tabEl.focus();

  $$('.pp-panel').forEach(p => p.hidden = true);
  const panelId = tabEl.getAttribute('aria-controls');
  $('#' + panelId).hidden = false;

  if (panelId === 'panel-saved') loadCollections();
  if (panelId === 'panel-history') loadHistory();
}
