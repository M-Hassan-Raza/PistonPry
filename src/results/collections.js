import { state, $, dom } from './state.js';
import { sanitizeUrl } from '../shared/sanitize.js';
import { formatDate } from '../shared/format.js';
import { showToast } from './toast.js';
import { showConfirm } from './dialog.js';

export async function getAllCollections() {
  const result = await chrome.storage.local.get('linkCollections');
  return result.linkCollections || [];
}

export async function saveCollection(name, links, tags) {
  const result = await chrome.storage.local.get('linkCollections');
  const collections = result.linkCollections || [];
  const newCollection = {
    id: Date.now().toString(),
    name,
    links,
    sourceUrl: state.sourceUrl,
    timestamp: new Date().toISOString(),
    count: links.length,
    tags: tags || [],
  };
  collections.push(newCollection);
  await chrome.storage.local.set({ linkCollections: collections });
  return newCollection;
}

export async function deleteCollectionById(id) {
  const result = await chrome.storage.local.get('linkCollections');
  const collections = (result.linkCollections || []).filter(c => c.id !== id);
  await chrome.storage.local.set({ linkCollections: collections });
}

export async function getCollectionById(id) {
  const collections = await getAllCollections();
  return collections.find(c => c.id === id) || null;
}

export function updateCollectionSelectionUI() {
  const count = state.selectedCollectionIds.size;
  dom.mergeCollectionsBtn.hidden = count < 2;
  dom.diffCollectionsBtn.hidden = count !== 2;
}

function renderTagFilter(collections) {
  const allTags = new Set();
  collections.forEach(c => (c.tags || []).forEach(t => allTags.add(t)));

  if (allTags.size === 0) {
    dom.tagFilterBar.hidden = true;
    return;
  }

  dom.tagFilterBar.hidden = false;
  dom.tagFilterBar.innerHTML = '<span class="pp-tag-filter-label">Filter by tag:</span>';

  const allBtn = document.createElement('button');
  allBtn.className = 'pp-tag-pill pp-tag-pill--filter';
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => loadCollections());
  dom.tagFilterBar.appendChild(allBtn);

  allTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'pp-tag-pill pp-tag-pill--filter';
    btn.textContent = tag;
    btn.addEventListener('click', () => loadCollections(tag));
    dom.tagFilterBar.appendChild(btn);
  });
}

export function renderCollections(collections, filterTag) {
  dom.collectionsContainer.innerHTML = '';
  state.selectedCollectionIds.clear();
  dom.mergeCollectionsBtn.hidden = true;
  dom.diffCollectionsBtn.hidden = true;

  let filtered = collections;
  if (filterTag) {
    filtered = collections.filter(c => (c.tags || []).includes(filterTag));
  }

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pp-collections-empty';
    const icon = document.createElement('div');
    icon.className = 'pp-collections-empty-icon';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('width', '40');
    svg.setAttribute('height', '40');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z');
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line1.setAttribute('points', '17 21 17 13 7 13 7 21');
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line2.setAttribute('points', '7 3 7 8 15 8');
    svg.appendChild(path);
    svg.appendChild(line1);
    svg.appendChild(line2);
    icon.appendChild(svg);
    const text = document.createElement('div');
    text.className = 'pp-collections-empty-text';
    text.textContent = filterTag ? 'No collections with tag "' + filterTag + '"' : 'No saved collections yet';
    empty.appendChild(icon);
    empty.appendChild(text);
    dom.collectionsContainer.appendChild(empty);
    return;
  }

  renderTagFilter(collections);

  const frag = document.createDocumentFragment();
  filtered.forEach(col => {
    const card = document.createElement('div');
    card.className = 'pp-collection-card';
    card.dataset.id = col.id;

    const top = document.createElement('div');
    top.className = 'pp-collection-top';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'pp-checkbox';
    cb.addEventListener('change', () => {
      if (cb.checked) state.selectedCollectionIds.add(col.id);
      else state.selectedCollectionIds.delete(col.id);
      card.classList.toggle('selected', cb.checked);
      updateCollectionSelectionUI();
    });
    cb.addEventListener('click', (e) => e.stopPropagation());

    const name = document.createElement('div');
    name.className = 'pp-collection-name';
    name.textContent = col.name;

    const count = document.createElement('span');
    count.className = 'pp-collection-count';
    count.textContent = col.count + ' links';

    const actions = document.createElement('div');
    actions.className = 'pp-collection-actions';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'pp-btn pp-btn--secondary pp-btn--sm';
    viewBtn.textContent = 'View';
    viewBtn.addEventListener('click', () => {
      const viewUrl = chrome.runtime.getURL('results.html') + '?view=collection&id=' + col.id;
      window.open(viewUrl, '_blank');
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'pp-btn pp-btn--danger pp-btn--sm';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      const ok = await showConfirm(
        'Delete collection?',
        `"${col.name}" will be permanently deleted.`,
        { confirmText: 'Delete', danger: true }
      );
      if (!ok) return;
      await deleteCollectionById(col.id);
      showToast('success', 'Deleted', `"${col.name}" removed`);
      loadCollections();
    });

    actions.appendChild(viewBtn);
    actions.appendChild(delBtn);
    top.appendChild(cb);
    top.appendChild(name);
    top.appendChild(count);
    top.appendChild(actions);

    card.appendChild(top);

    if (col.tags && col.tags.length > 0) {
      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'pp-collection-tags';
      col.tags.forEach(tag => {
        const pill = document.createElement('span');
        pill.className = 'pp-tag-pill';
        pill.textContent = tag;
        pill.addEventListener('click', () => loadCollections(tag));
        tagsWrap.appendChild(pill);
      });
      card.appendChild(tagsWrap);
    }

    if (col.sourceUrl) {
      const meta = document.createElement('div');
      meta.className = 'pp-collection-meta';
      meta.textContent = 'Saved ' + formatDate(col.timestamp) + ' from ';
      const link = document.createElement('a');
      link.href = sanitizeUrl(col.sourceUrl);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      try { link.textContent = new URL(col.sourceUrl).hostname; }
      catch { link.textContent = col.sourceUrl; }
      meta.appendChild(link);
      card.appendChild(meta);
    }

    frag.appendChild(card);
  });
  dom.collectionsContainer.appendChild(frag);
}

export async function loadCollections(filterTag) {
  const collections = await getAllCollections();
  renderCollections(collections, filterTag);
}
