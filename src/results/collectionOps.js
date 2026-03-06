import { state, $ } from './state.js';
import { sanitizeUrl } from '../shared/sanitize.js';
import { showToast } from './toast.js';
import { showConfirm } from './dialog.js';
import { getAllCollections, saveCollection, loadCollections } from './collections.js';

export async function mergeSelectedCollections() {
  const ids = [...state.selectedCollectionIds];
  const collections = await getAllCollections();
  const selected = collections.filter(c => ids.includes(c.id));

  const allUrls = new Set();
  const mergedLinks = [];
  selected.forEach(col => {
    (col.links || []).forEach(url => {
      const u = typeof url === 'string' ? url : url.url || url;
      if (!allUrls.has(u)) {
        allUrls.add(u);
        mergedLinks.push(u);
      }
    });
  });

  const name = selected.map(c => c.name).join(' + ');
  const ok = await showConfirm(
    'Merge collections?',
    `Create "${name}" with ${mergedLinks.length} unique links?`,
    { confirmText: 'Merge' }
  );
  if (!ok) return;

  await saveCollection(name, mergedLinks, []);
  showToast('success', 'Merged', `New collection with ${mergedLinks.length} links`);
  loadCollections();
}

export async function diffSelectedCollections() {
  const ids = [...state.selectedCollectionIds];
  const collections = await getAllCollections();
  const [colA, colB] = ids.map(id => collections.find(c => c.id === id)).filter(Boolean);
  if (!colA || !colB) return;

  const setA = new Set((colA.links || []).map(l => typeof l === 'string' ? l : l.url || l));
  const setB = new Set((colB.links || []).map(l => typeof l === 'string' ? l : l.url || l));

  const onlyA = [...setA].filter(u => !setB.has(u));
  const onlyB = [...setB].filter(u => !setA.has(u));
  const both = [...setA].filter(u => setB.has(u));

  const diffDialog = $('#diffDialog');
  const diffTitle = $('#diffTitle');
  const diffContent = $('#diffContent');

  diffTitle.textContent = `${colA.name} vs ${colB.name}`;
  diffContent.innerHTML = '';

  function addSection(label, urls, cls) {
    if (urls.length === 0) return;
    const section = document.createElement('div');
    section.className = 'pp-diff-section ' + cls;
    const header = document.createElement('div');
    header.className = 'pp-diff-section-header';
    header.textContent = `${label} (${urls.length})`;
    section.appendChild(header);
    urls.forEach(u => {
      const item = document.createElement('div');
      item.className = 'pp-diff-item';
      item.textContent = u;
      section.appendChild(item);
    });
    diffContent.appendChild(section);
  }

  addSection('Only in "' + colA.name + '"', onlyA, 'pp-diff-removed');
  addSection('Only in "' + colB.name + '"', onlyB, 'pp-diff-added');
  addSection('In both', both, 'pp-diff-shared');

  diffDialog.showModal();
}

export function showImportDialog() {
  const dialog = $('#importDialog');
  $('#importTextarea').value = '';
  $('#importNameInput').value = '';
  dialog.showModal();
}

export async function importLinks() {
  const text = $('#importTextarea').value.trim();
  const name = $('#importNameInput').value.trim() || 'Imported ' + new Date().toLocaleDateString();
  if (!text) {
    showToast('warning', 'No URLs to import');
    return;
  }

  const urls = text.split('\n')
    .map(line => line.trim())
    .filter(line => line && sanitizeUrl(line));

  if (urls.length === 0) {
    showToast('warning', 'No valid URLs found');
    return;
  }

  await saveCollection(name, urls, []);
  $('#importDialog').close();
  showToast('success', 'Imported', `${urls.length} links saved as "${name}"`);
  loadCollections();
}
