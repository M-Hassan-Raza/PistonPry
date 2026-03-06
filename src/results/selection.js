import { dom } from './state.js';
import { copySelected, openSelected, downloadSelected } from './actions.js';

export function getVisibleItems() {
  return [...dom.linksList.querySelectorAll('.pp-link-item:not([hidden])')];
}

export function getCheckedItems() {
  return getVisibleItems().filter(li => li.querySelector('.pp-checkbox').checked);
}

export function updateSelectionState() {
  const visible = getVisibleItems();
  const checked = getCheckedItems();
  const count = checked.length;

  dom.actionBar.hidden = count === 0;
  dom.selectionCount.textContent = count + ' selected';

  if (count === 0) {
    dom.selectAllCb.checked = false;
    dom.selectAllCb.indeterminate = false;
  } else if (count === visible.length) {
    dom.selectAllCb.checked = true;
    dom.selectAllCb.indeterminate = false;
  } else {
    dom.selectAllCb.checked = false;
    dom.selectAllCb.indeterminate = true;
  }

  renderActionButtons(count);
}

function renderActionButtons(count) {
  dom.actionButtons.innerHTML = '';
  if (count === 0) return;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'pp-btn pp-btn--secondary pp-btn--sm';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', (e) => { e.stopPropagation(); copySelected(); });

  const openBtn = document.createElement('button');
  openBtn.className = 'pp-btn pp-btn--secondary pp-btn--sm';
  openBtn.textContent = 'Open';
  openBtn.addEventListener('click', openSelected);

  const dlBtn = document.createElement('button');
  dlBtn.className = 'pp-btn pp-btn--secondary pp-btn--sm';
  dlBtn.textContent = 'Download';
  dlBtn.addEventListener('click', downloadSelected);

  dom.actionButtons.appendChild(copyBtn);
  dom.actionButtons.appendChild(openBtn);
  dom.actionButtons.appendChild(dlBtn);
}
