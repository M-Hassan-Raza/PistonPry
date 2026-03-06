import { state } from './state.js';
import { escapeHtml } from '../shared/sanitize.js';
import { showToast } from './toast.js';
import { getVisibleItems } from './selection.js';

export function exportLinks(format) {
  const items = getVisibleItems().map(li => {
    const idx = parseInt(li.dataset.index);
    return state.allLinks[idx] || { url: li.dataset.url, text: '' };
  });
  const urls = items.map(i => i.url);

  if (urls.length === 0) {
    showToast('warning', 'No links to export');
    return;
  }

  let content, filename, mimeType;
  switch (format) {
    case 'text':
      content = urls.join('\n');
      filename = 'links.txt';
      mimeType = 'text/plain';
      break;
    case 'csv':
      content = 'URL,Text,Type,Domain\n' + items.map(i =>
        '"' + (i.url || '').replace(/"/g, '""') + '","' +
        (i.text || '').replace(/"/g, '""') + '","' +
        (i.type || '') + '","' +
        (i.domain || '') + '"'
      ).join('\n');
      filename = 'links.csv';
      mimeType = 'text/csv';
      break;
    case 'json':
      content = JSON.stringify(items.map(i => ({
        url: i.url, text: i.text, type: i.type, domain: i.domain
      })), null, 2);
      filename = 'links.json';
      mimeType = 'application/json';
      break;
    case 'markdown':
      content = items.map(i => {
        const label = i.text || i.url;
        return '- [' + label + '](' + i.url + ')';
      }).join('\n');
      filename = 'links.md';
      mimeType = 'text/markdown';
      break;
    case 'html':
      content = '<ul>\n' + items.map(i => {
        const label = escapeHtml(i.text || i.url);
        return '  <li><a href="' + escapeHtml(i.url) + '">' + label + '</a></li>';
      }).join('\n') + '\n</ul>';
      filename = 'links.html';
      mimeType = 'text/html';
      break;
    default:
      return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('success', 'Exported', `${urls.length} links as ${format.toUpperCase()}`);
}
