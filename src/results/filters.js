import { state, dom } from './state.js';
import { globToRegex } from '../shared/patterns.js';
import { renderEmptyState } from './render.js';
import { updateSelectionState } from './selection.js';

export function getProcessedLinks() {
  let links = [...state.allLinks];

  if (state.currentItemTypeFilter !== 'all') {
    links = links.filter(l => (l.itemType || 'link') === state.currentItemTypeFilter);
  }

  if (state.isDedupActive) {
    const seen = new Set();
    links = links.filter(l => {
      if (seen.has(l.url)) return false;
      seen.add(l.url);
      return true;
    });
  }

  if (state.sortField !== 'none') {
    links.sort((a, b) => {
      let va, vb;
      switch (state.sortField) {
        case 'url': va = a.url; vb = b.url; break;
        case 'domain': va = a.domain; vb = b.domain; break;
        case 'type': va = a.type; vb = b.type; break;
        case 'text': va = a.text || ''; vb = b.text || ''; break;
        case 'status':
          va = (state.healthResults[a.url]?.health) || 'z';
          vb = (state.healthResults[b.url]?.health) || 'z';
          break;
        default: return 0;
      }
      const cmp = String(va).localeCompare(String(vb));
      return state.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  return links;
}

export function hasActiveFilters() {
  return dom.searchInput.value || dom.typeFilter.value || dom.locationFilter.value || dom.patternInput.value;
}

export function applyFilters() {
  const text = dom.searchInput.value;
  const type = dom.typeFilter.value;
  const loc = dom.locationFilter.value;
  const pattern = dom.patternInput.value.trim();
  let visibleCount = 0;

  let regexFilter = null;
  if (state.isRegexMode && text) {
    try { regexFilter = new RegExp(text, 'i'); } catch { /* invalid regex, treat as literal */ }
  }

  let globFilter = null;
  if (pattern) {
    try { globFilter = globToRegex(pattern); } catch { /* ignore */ }
  }

  const existingEmpty = dom.linksList.querySelector('.pp-empty-state');
  if (existingEmpty) existingEmpty.remove();

  dom.linksList.querySelectorAll('.pp-link-item').forEach(li => {
    const url = li.dataset.url || li.querySelector('.pp-link-url')?.textContent || '';
    const urlLower = url.toLowerCase();
    const liType = li.dataset.type;
    const isExt = li.dataset.external === 'true';
    const linkText = li.querySelector('.pp-link-text')?.textContent?.toLowerCase() || '';

    let matchText;
    if (regexFilter) {
      matchText = regexFilter.test(url) || regexFilter.test(linkText);
    } else {
      const searchLower = text.toLowerCase();
      matchText = !text || urlLower.includes(searchLower) || linkText.includes(searchLower);
    }

    const matchType = !type || liType === type;
    const matchLoc = !loc || (loc === 'external' && isExt) || (loc === 'internal' && !isExt);
    const matchPattern = !globFilter || globFilter.test(url);

    const visible = matchText && matchType && matchLoc && matchPattern;
    li.hidden = !visible;
    if (visible) visibleCount++;
  });

  if (visibleCount === 0 && state.allLinks.length > 0) {
    dom.linksList.appendChild(renderEmptyState('No links match your filters'));
  }

  dom.countPill.textContent = visibleCount;
  dom.resetFiltersBtn.hidden = !hasActiveFilters();

  updateSelectionState();
}

export function resetFilters() {
  dom.searchInput.value = '';
  dom.typeFilter.value = '';
  dom.locationFilter.value = '';
  dom.patternInput.value = '';
  state.isRegexMode = false;
  dom.regexToggle.classList.remove('active');
  applyFilters();
}

export function populateTypeFilter(links) {
  const types = [...new Set(links.map(l => l.type))].sort();
  dom.typeFilter.innerHTML = '<option value="">All types</option>';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    dom.typeFilter.appendChild(opt);
  });
}

export function updateItemTypeCounts() {
  const linkCount = state.allLinks.filter(l => (l.itemType || 'link') === 'link').length;
  const imageCount = state.allLinks.filter(l => l.itemType === 'image').length;
  const emailCount = state.allLinks.filter(l => l.itemType === 'email' || l.itemType === 'phone').length;

  document.querySelector('#countAll').textContent = state.allLinks.length;
  document.querySelector('#countLinks').textContent = linkCount;
  document.querySelector('#countImages').textContent = imageCount;
  document.querySelector('#countEmails').textContent = emailCount;
}
