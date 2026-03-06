import { dom } from './state.js';
import { showToast } from './toast.js';
import { showConfirm } from './dialog.js';
import { getVisibleItems, getCheckedItems } from './selection.js';

export function flashCopied(btn) {
  const originalText = btn.textContent;
  btn.textContent = 'Copied!';
  btn.classList.add('pp-btn--copied');
  setTimeout(() => {
    btn.textContent = originalText;
    btn.classList.remove('pp-btn--copied');
  }, 1200);
}

export function getVisibleUrls() {
  return getVisibleItems().map(li => li.querySelector('.pp-link-url')?.href || li.dataset.url);
}

export function getSelectedUrls() {
  return getCheckedItems().map(li => li.querySelector('.pp-link-url')?.href || li.dataset.url);
}

export async function copyAll() {
  const urls = getVisibleUrls();
  if (urls.length === 0) {
    showToast('warning', 'No links to copy');
    return;
  }
  try {
    await navigator.clipboard.writeText(urls.join('\n'));
    flashCopied(dom.copyAllBtn);
  } catch {
    showToast('error', 'Copy failed', 'Could not access clipboard');
  }
}

export async function copySelected() {
  const urls = getSelectedUrls();
  if (urls.length === 0) {
    showToast('warning', 'No links selected');
    return;
  }
  try {
    await navigator.clipboard.writeText(urls.join('\n'));
    showToast('success', 'Copied', urls.length + ' link(s) copied');
  } catch {
    showToast('error', 'Copy failed', 'Could not access clipboard');
  }
}

export async function openSelected() {
  const urls = getSelectedUrls();
  if (urls.length === 0) {
    showToast('warning', 'No links selected');
    return;
  }
  if (urls.length > 10) {
    const ok = await showConfirm(
      'Open many tabs?',
      `You're about to open ${urls.length} tabs. Continue?`,
      { confirmText: 'Open All' }
    );
    if (!ok) return;
  }
  urls.forEach(url => window.open(url, '_blank'));
  showToast('info', 'Opened', urls.length + ' tab(s) opened');
}

export async function downloadSelected() {
  const items = getCheckedItems().map(li => ({
    url: li.querySelector('.pp-link-url')?.href || li.dataset.url,
    type: li.dataset.type,
  }));
  if (items.length === 0) {
    showToast('warning', 'No links selected');
    return;
  }
  const downloadableTypes = ['image', 'pdf', 'document', 'video', 'audio', 'archive'];
  const downloadable = items.filter(i => downloadableTypes.includes(i.type));
  if (downloadable.length === 0) {
    showToast('warning', 'No downloadable files', 'Select links to images, documents, PDFs, etc.');
    return;
  }
  if (downloadable.length > 5) {
    const ok = await showConfirm(
      'Download many files?',
      `You're about to download ${downloadable.length} files. Continue?`,
      { confirmText: 'Download All' }
    );
    if (!ok) return;
  }
  downloadable.forEach(item => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  showToast('success', 'Downloads started', downloadable.length + ' file(s)');
}
