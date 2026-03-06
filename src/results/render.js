import { state, dom } from './state.js';
import { sanitizeUrl } from '../shared/sanitize.js';
import { classifyLink } from '../shared/classify.js';
import { showToast } from './toast.js';

export function renderEmptyState(message) {
  const empty = document.createElement('div');
  empty.className = 'pp-empty-state';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'pp-empty-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('d', 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71');
  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute('d', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71');
  svg.appendChild(path1);
  svg.appendChild(path2);
  const text = document.createElement('div');
  text.className = 'pp-empty-text';
  text.textContent = message;
  empty.appendChild(svg);
  empty.appendChild(text);
  return empty;
}

export function createLinkItem(linkData, index, updateSelectionState) {
  const li = document.createElement('li');
  li.className = 'pp-link-item';
  li.dataset.index = index;
  li.dataset.type = linkData.type;
  li.dataset.domain = linkData.domain;
  li.dataset.external = linkData.isExternal;
  li.dataset.itemType = linkData.itemType || 'link';
  li.dataset.url = linkData.url;

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'pp-checkbox';
  cb.setAttribute('aria-label', 'Select ' + linkData.url);
  cb.addEventListener('change', () => {
    li.classList.toggle('selected', cb.checked);
    updateSelectionState();
  });
  cb.addEventListener('click', (e) => e.stopPropagation());

  const contentWrap = document.createElement('div');
  contentWrap.className = 'pp-link-content';

  const safe = sanitizeUrl(linkData.url);
  const anchor = document.createElement('a');
  anchor.className = 'pp-link-url';
  anchor.href = safe;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.textContent = linkData.url;
  anchor.addEventListener('click', (e) => e.stopPropagation());

  anchor.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startInlineEdit(li, linkData, index);
  });

  contentWrap.appendChild(anchor);

  if (linkData.text) {
    const textSpan = document.createElement('div');
    textSpan.className = 'pp-link-text';
    textSpan.textContent = linkData.text;
    contentWrap.appendChild(textSpan);
  }

  li.addEventListener('click', () => {
    cb.checked = !cb.checked;
    li.classList.toggle('selected', cb.checked);
    updateSelectionState();
  });

  const badges = document.createElement('div');
  badges.className = 'pp-link-badges';

  const pill = document.createElement('span');
  pill.className = 'pp-type-pill';
  pill.setAttribute('data-type', linkData.type);
  pill.textContent = linkData.type;
  badges.appendChild(pill);

  if (linkData.isExternal) {
    const ext = document.createElement('span');
    ext.className = 'pp-external-badge';
    ext.textContent = 'ext';
    badges.appendChild(ext);
  }

  if (state.duplicateMap[linkData.url] > 1) {
    const dup = document.createElement('span');
    dup.className = 'pp-dup-badge';
    dup.textContent = '\u00D7' + state.duplicateMap[linkData.url];
    badges.appendChild(dup);
  }

  if (state.healthResults[linkData.url]) {
    const dot = document.createElement('span');
    dot.className = 'pp-health-dot';
    dot.setAttribute('data-health', state.healthResults[linkData.url].health);
    const statusText = state.healthResults[linkData.url].status ? ` (${state.healthResults[linkData.url].status})` : '';
    dot.title = state.healthResults[linkData.url].health + statusText;
    badges.appendChild(dot);
  }

  li.appendChild(cb);
  li.appendChild(contentWrap);
  li.appendChild(badges);

  return li;
}

function startInlineEdit(li, linkData, index) {
  const anchor = li.querySelector('.pp-link-url');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'pp-inline-edit';
  input.value = linkData.url;

  // Import renderCurrentView lazily to avoid circular dependency
  function saveEdit() {
    const newUrl = input.value.trim();
    if (newUrl && newUrl !== linkData.url) {
      const tabHostname = state.sourceUrl ? (() => { try { return new URL(state.sourceUrl).hostname; } catch { return ''; } })() : '';
      const updated = classifyLink(newUrl, tabHostname, linkData.text);
      state.allLinks[index] = updated;
      showToast('info', 'URL updated');
    }
    // Trigger re-render via event
    document.dispatchEvent(new CustomEvent('pistonpry:rerender'));
  }

  function cancelEdit() {
    document.dispatchEvent(new CustomEvent('pistonpry:rerender'));
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  });
  input.addEventListener('blur', saveEdit);
  input.addEventListener('click', (e) => e.stopPropagation());

  anchor.replaceWith(input);
  input.focus();
  input.select();
}

export function renderLinks(links, updateSelectionState) {
  dom.linksList.innerHTML = '';
  state.focusedIndex = -1;
  if (links.length === 0) {
    dom.linksList.appendChild(renderEmptyState('No links extracted'));
    return;
  }
  const frag = document.createDocumentFragment();
  links.forEach((link) => frag.appendChild(createLinkItem(link, state.allLinks.indexOf(link), updateSelectionState)));
  dom.linksList.appendChild(frag);
}

export function renderGroupedView(links, updateSelectionState) {
  dom.linksList.innerHTML = '';
  state.focusedIndex = -1;
  if (links.length === 0) {
    dom.linksList.appendChild(renderEmptyState('No links extracted'));
    return;
  }

  const groups = {};
  links.forEach((link) => {
    const domain = link.domain || 'Other';
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(link);
  });

  const sortedDomains = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  const frag = document.createDocumentFragment();

  sortedDomains.forEach(domain => {
    const group = document.createElement('li');
    group.className = 'pp-domain-group';

    const header = document.createElement('div');
    header.className = 'pp-domain-group-header';

    const chevron = document.createElement('span');
    chevron.className = 'pp-domain-chevron';
    chevron.textContent = '\u25BC';

    const domainName = document.createElement('span');
    domainName.className = 'pp-domain-name';
    domainName.textContent = domain;

    const domainCount = document.createElement('span');
    domainCount.className = 'pp-domain-count';
    domainCount.textContent = groups[domain].length;

    const selectGroupBtn = document.createElement('button');
    selectGroupBtn.className = 'pp-btn pp-btn--ghost pp-btn--sm';
    selectGroupBtn.textContent = 'Select all';
    selectGroupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const items = body.querySelectorAll('.pp-link-item');
      items.forEach(li => {
        const cb = li.querySelector('.pp-checkbox');
        cb.checked = true;
        li.classList.add('selected');
      });
      updateSelectionState();
    });

    header.appendChild(chevron);
    header.appendChild(domainName);
    header.appendChild(domainCount);
    header.appendChild(selectGroupBtn);

    const body = document.createElement('ul');
    body.className = 'pp-domain-group-body';
    groups[domain].forEach(link => {
      body.appendChild(createLinkItem(link, state.allLinks.indexOf(link), updateSelectionState));
    });

    header.addEventListener('click', () => {
      group.classList.toggle('collapsed');
      chevron.textContent = group.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
    });

    group.appendChild(header);
    group.appendChild(body);
    frag.appendChild(group);
  });

  dom.linksList.appendChild(frag);
}
