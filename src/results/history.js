import { dom } from './state.js';
import { formatDateRelative } from '../shared/format.js';
import { showToast } from './toast.js';

export async function loadHistory() {
  const result = await chrome.storage.local.get('extractionHistory');
  const history = result.extractionHistory || [];
  renderHistory(history);
}

function renderHistory(history) {
  dom.historyContainer.innerHTML = '';

  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pp-collections-empty';
    const text = document.createElement('div');
    text.className = 'pp-collections-empty-text';
    text.textContent = 'No extraction history yet';
    empty.appendChild(text);
    dom.historyContainer.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  history.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'pp-collection-card';

    const top = document.createElement('div');
    top.className = 'pp-collection-top';

    const name = document.createElement('div');
    name.className = 'pp-collection-name';
    let hostname = '';
    try { hostname = new URL(entry.sourceUrl).hostname; } catch { /* skip */ }
    name.textContent = entry.sourceTitle || hostname || 'Unknown source';

    const count = document.createElement('span');
    count.className = 'pp-collection-count';
    count.textContent = entry.count + ' links';

    const time = document.createElement('span');
    time.className = 'pp-collection-count';
    time.textContent = formatDateRelative(entry.timestamp);

    const actions = document.createElement('div');
    actions.className = 'pp-collection-actions';

    const reopenBtn = document.createElement('button');
    reopenBtn.className = 'pp-btn pp-btn--secondary pp-btn--sm';
    reopenBtn.textContent = 'Re-open';
    reopenBtn.addEventListener('click', async () => {
      if (entry.allLinks && entry.allLinks.length > 0) {
        await chrome.storage.session.set({
          currentExtraction: {
            links: entry.allLinks,
            sourceUrl: entry.sourceUrl,
            sourceTitle: entry.sourceTitle,
          },
        });
        window.location.href = chrome.runtime.getURL('results.html');
      } else {
        showToast('warning', 'Full link data not available for older entries');
      }
    });

    actions.appendChild(reopenBtn);
    top.appendChild(name);
    top.appendChild(count);
    top.appendChild(time);
    top.appendChild(actions);
    card.appendChild(top);

    if (entry.links && entry.links.length > 0) {
      const preview = document.createElement('div');
      preview.className = 'pp-history-preview';
      entry.links.slice(0, 3).forEach(link => {
        const p = document.createElement('div');
        p.className = 'pp-history-preview-url';
        p.textContent = typeof link === 'string' ? link : (link.url || '');
        preview.appendChild(p);
      });
      if (entry.count > 3) {
        const more = document.createElement('div');
        more.className = 'pp-history-preview-more';
        more.textContent = `+${entry.count - 3} more`;
        preview.appendChild(more);
      }
      card.appendChild(preview);
    }

    frag.appendChild(card);
  });
  dom.historyContainer.appendChild(frag);
}
