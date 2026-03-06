// ── PistonPry results page logic ──

(() => {
  // ── State ──
  let allLinks = [];     // { url, domain, isExternal, type, itemType, text }
  let sourceUrl = '';
  let sourceTitle = '';
  let isCollectionView = false;
  let isRegexMode = false;
  let isDedupActive = false;
  let isGroupedView = false;
  let currentItemTypeFilter = 'all';
  let sortField = 'none';
  let sortDir = 'asc';
  let healthResults = {};
  let focusedIndex = -1;
  let pendingChord = null; // for g+d, g+f shortcuts
  let selectedCollectionIds = new Set();
  let duplicateMap = {};   // url -> count

  // ── DOM refs ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const linksList = $('#linksList');
  const countPill = $('#countPill');
  const sourceMeta = $('#sourceMeta');
  const searchInput = $('#searchInput');
  const typeFilter = $('#typeFilter');
  const locationFilter = $('#locationFilter');
  const resetFiltersBtn = $('#resetFiltersBtn');
  const actionBar = $('#actionBar');
  const selectAllCb = $('#selectAll');
  const selectionCount = $('#selectionCount');
  const actionButtons = $('#actionButtons');
  const moreToggle = $('#moreToggle');
  const moreMenu = $('#moreMenu');
  const copyAllBtn = $('#copyAllBtn');
  const exportToggle = $('#exportToggle');
  const exportMenu = $('#exportMenu');
  const saveSection = $('#saveSection');
  const saveToggle = $('#saveToggle');
  const saveForm = $('#saveForm');
  const saveCancelBtn = $('#saveCancelBtn');
  const collectionNameInput = $('#collectionNameInput');
  const collectionTagsInput = $('#collectionTagsInput');
  const collectionsContainer = $('#collectionsContainer');
  const confirmDialog = $('#confirmDialog');
  const toastContainer = $('#toastContainer');
  const typePopover = $('#typePopover');
  const regexToggle = $('#regexToggle');
  const dedupToggle = $('#dedupToggle');
  const patternInput = $('#patternInput');
  const domainStatsBar = $('#domainStatsBar');
  const suggestionsBar = $('#suggestionsBar');
  const healthSummary = $('#healthSummary');
  const historyContainer = $('#historyContainer');
  const viewFlatBtn = $('#viewFlat');
  const viewGroupedBtn = $('#viewGrouped');
  const autoCopyToggle = $('#autoCopyToggle');
  const cleanUrlsBtn = $('#cleanUrlsBtn');
  const checkLinksBtn = $('#checkLinksBtn');
  const shareBtn = $('#shareBtn');
  const importLinksBtn = $('#importLinksBtn');
  const mergeCollectionsBtn = $('#mergeCollectionsBtn');
  const diffCollectionsBtn = $('#diffCollectionsBtn');
  const tagFilterBar = $('#tagFilterBar');

  // ── Toast system ──
  const MAX_TOASTS = 3;

  function showToast(type, title, message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'pp-toast';
    toast.setAttribute('data-type', type);

    const titleEl = document.createElement('div');
    titleEl.className = 'pp-toast-title';
    titleEl.textContent = title;
    toast.appendChild(titleEl);

    if (message) {
      const msgEl = document.createElement('div');
      msgEl.className = 'pp-toast-message';
      msgEl.textContent = message;
      toast.appendChild(msgEl);
    }

    const progress = document.createElement('div');
    progress.className = 'pp-toast-progress';
    progress.style.width = '100%';
    toast.appendChild(progress);

    toastContainer.appendChild(toast);

    const toasts = toastContainer.querySelectorAll('.pp-toast:not(.pp-toast-out)');
    if (toasts.length > MAX_TOASTS) {
      dismissToast(toasts[0]);
    }

    let remaining = duration;
    let start = null;
    let rafId = null;
    let paused = false;

    function tick(timestamp) {
      if (!start) start = timestamp;
      if (!paused) {
        const elapsed = timestamp - start;
        remaining = duration - elapsed;
        if (remaining <= 0) {
          dismissToast(toast);
          return;
        }
        progress.style.width = ((remaining / duration) * 100) + '%';
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    toast.addEventListener('mouseenter', () => { paused = true; });
    toast.addEventListener('mouseleave', () => {
      paused = false;
      duration = remaining;
      start = null;
    });

    return toast;
  }

  function dismissToast(toast) {
    toast.classList.add('pp-toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  // ── Confirm dialog ──
  function showConfirm(title, message, opts = {}) {
    const { confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = opts;
    $('#dialogTitle').textContent = title;
    $('#dialogMessage').textContent = message;
    const confirmBtn = $('#dialogConfirm');
    confirmBtn.textContent = confirmText;
    confirmBtn.className = danger ? 'pp-btn pp-btn--danger' : 'pp-btn pp-btn--primary';
    $('#dialogCancel').textContent = cancelText;

    return new Promise((resolve) => {
      function onConfirm() { cleanup(); confirmDialog.close(); resolve(true); }
      function onCancel() { cleanup(); confirmDialog.close(); resolve(false); }
      function cleanup() {
        confirmBtn.removeEventListener('click', onConfirm);
        $('#dialogCancel').removeEventListener('click', onCancel);
        confirmDialog.removeEventListener('cancel', onCancel);
      }
      confirmBtn.addEventListener('click', onConfirm);
      $('#dialogCancel').addEventListener('click', onCancel);
      confirmDialog.addEventListener('cancel', onCancel);
      confirmDialog.showModal();
    });
  }

  // ── Compute duplicates ──
  function computeDuplicates() {
    duplicateMap = {};
    allLinks.forEach(l => {
      duplicateMap[l.url] = (duplicateMap[l.url] || 0) + 1;
    });
  }

  function getDuplicateCount() {
    return Object.values(duplicateMap).filter(c => c > 1).reduce((sum, c) => sum + c - 1, 0);
  }

  // ── Rendering ──
  function createLinkItem(linkData, index) {
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

    // Feature 11: Double-click to edit inline
    anchor.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startInlineEdit(li, linkData, index);
    });

    contentWrap.appendChild(anchor);

    // Feature 20: Show link text if available
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

    // Feature 8: Duplicate badge
    if (duplicateMap[linkData.url] > 1) {
      const dup = document.createElement('span');
      dup.className = 'pp-dup-badge';
      dup.textContent = '\u00D7' + duplicateMap[linkData.url];
      badges.appendChild(dup);
    }

    // Feature 9: Health status dot
    if (healthResults[linkData.url]) {
      const dot = document.createElement('span');
      dot.className = 'pp-health-dot';
      dot.setAttribute('data-health', healthResults[linkData.url].health);
      const statusText = healthResults[linkData.url].status ? ` (${healthResults[linkData.url].status})` : '';
      dot.title = healthResults[linkData.url].health + statusText;
      badges.appendChild(dot);
    }

    li.appendChild(cb);
    li.appendChild(contentWrap);
    li.appendChild(badges);

    return li;
  }

  // Feature 11: Inline URL editor
  function startInlineEdit(li, linkData, index) {
    const anchor = li.querySelector('.pp-link-url');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pp-inline-edit';
    input.value = linkData.url;

    function saveEdit() {
      const newUrl = input.value.trim();
      if (newUrl && newUrl !== linkData.url) {
        const tabHostname = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname; } catch { return ''; } })() : '';
        const updated = classifyLink(newUrl, tabHostname, linkData.text);
        allLinks[index] = updated;
        showToast('info', 'URL updated');
      }
      renderCurrentView();
    }

    function cancelEdit() {
      renderCurrentView();
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

  function renderEmptyState(message) {
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

  // ── Get filtered + sorted links ──
  function getProcessedLinks() {
    let links = [...allLinks];

    // Item type filter
    if (currentItemTypeFilter !== 'all') {
      links = links.filter(l => (l.itemType || 'link') === currentItemTypeFilter);
    }

    // Dedup
    if (isDedupActive) {
      const seen = new Set();
      links = links.filter(l => {
        if (seen.has(l.url)) return false;
        seen.add(l.url);
        return true;
      });
    }

    // Sort
    if (sortField !== 'none') {
      links.sort((a, b) => {
        let va, vb;
        switch (sortField) {
          case 'url': va = a.url; vb = b.url; break;
          case 'domain': va = a.domain; vb = b.domain; break;
          case 'type': va = a.type; vb = b.type; break;
          case 'text': va = a.text || ''; vb = b.text || ''; break;
          case 'status':
            va = (healthResults[a.url]?.health) || 'z';
            vb = (healthResults[b.url]?.health) || 'z';
            break;
          default: return 0;
        }
        const cmp = String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return links;
  }

  function renderLinks(links) {
    linksList.innerHTML = '';
    focusedIndex = -1;
    if (links.length === 0) {
      linksList.appendChild(renderEmptyState('No links extracted'));
      return;
    }
    const frag = document.createDocumentFragment();
    links.forEach((link, i) => frag.appendChild(createLinkItem(link, allLinks.indexOf(link))));
    linksList.appendChild(frag);
  }

  // Feature 7: Grouped view
  function renderGroupedView(links) {
    linksList.innerHTML = '';
    focusedIndex = -1;
    if (links.length === 0) {
      linksList.appendChild(renderEmptyState('No links extracted'));
      return;
    }

    const groups = {};
    links.forEach((link, i) => {
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
        body.appendChild(createLinkItem(link, allLinks.indexOf(link)));
      });

      header.addEventListener('click', () => {
        group.classList.toggle('collapsed');
        chevron.textContent = group.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
      });

      group.appendChild(header);
      group.appendChild(body);
      frag.appendChild(group);
    });

    linksList.appendChild(frag);
  }

  function renderCurrentView() {
    const links = getProcessedLinks();
    if (isGroupedView) {
      renderGroupedView(links);
    } else {
      renderLinks(links);
    }
    applyFilters();
    updateItemTypeCounts();
    renderDomainStats();
    renderSuggestions();
  }

  function populateTypeFilter(links) {
    const types = [...new Set(links.map(l => l.type))].sort();
    typeFilter.innerHTML = '<option value="">All types</option>';
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      typeFilter.appendChild(opt);
    });
  }

  function updateItemTypeCounts() {
    const linkCount = allLinks.filter(l => (l.itemType || 'link') === 'link').length;
    const imageCount = allLinks.filter(l => l.itemType === 'image').length;
    const emailCount = allLinks.filter(l => l.itemType === 'email' || l.itemType === 'phone').length;

    $('#countAll').textContent = allLinks.length;
    $('#countLinks').textContent = linkCount;
    $('#countImages').textContent = imageCount;
    $('#countEmails').textContent = emailCount;
  }

  // ── Filtering ──
  function hasActiveFilters() {
    return searchInput.value || typeFilter.value || locationFilter.value || patternInput.value;
  }

  function applyFilters() {
    const text = searchInput.value;
    const type = typeFilter.value;
    const loc = locationFilter.value;
    const pattern = patternInput.value.trim();
    let visibleCount = 0;

    let regexFilter = null;
    if (isRegexMode && text) {
      try { regexFilter = new RegExp(text, 'i'); } catch { /* invalid regex, treat as literal */ }
    }

    let globFilter = null;
    if (pattern) {
      try { globFilter = globToRegex(pattern); } catch { /* ignore */ }
    }

    const existingEmpty = linksList.querySelector('.pp-empty-state');
    if (existingEmpty) existingEmpty.remove();

    linksList.querySelectorAll('.pp-link-item').forEach(li => {
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

    if (visibleCount === 0 && allLinks.length > 0) {
      linksList.appendChild(renderEmptyState('No links match your filters'));
    }

    countPill.textContent = visibleCount;
    resetFiltersBtn.hidden = !hasActiveFilters();
    updateSelectionState();
  }

  function resetFilters() {
    searchInput.value = '';
    typeFilter.value = '';
    locationFilter.value = '';
    patternInput.value = '';
    isRegexMode = false;
    regexToggle.classList.remove('active');
    applyFilters();
  }

  // ── Selection ──
  function getVisibleItems() {
    return [...linksList.querySelectorAll('.pp-link-item:not([hidden])')];
  }

  function getCheckedItems() {
    return getVisibleItems().filter(li => li.querySelector('.pp-checkbox').checked);
  }

  function updateSelectionState() {
    const visible = getVisibleItems();
    const checked = getCheckedItems();
    const count = checked.length;

    actionBar.hidden = count === 0;
    selectionCount.textContent = count + ' selected';

    if (count === 0) {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = false;
    } else if (count === visible.length) {
      selectAllCb.checked = true;
      selectAllCb.indeterminate = false;
    } else {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = true;
    }

    renderActionButtons(count);
  }

  function renderActionButtons(count) {
    actionButtons.innerHTML = '';
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

    actionButtons.appendChild(copyBtn);
    actionButtons.appendChild(openBtn);
    actionButtons.appendChild(dlBtn);
  }

  function flashCopied(btn) {
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('pp-btn--copied');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('pp-btn--copied');
    }, 1200);
  }

  async function copyAll() {
    const urls = getVisibleUrls();
    if (urls.length === 0) {
      showToast('warning', 'No links to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(urls.join('\n'));
      flashCopied(copyAllBtn);
    } catch {
      showToast('error', 'Copy failed', 'Could not access clipboard');
    }
  }

  function getSelectedUrls() {
    return getCheckedItems().map(li => li.querySelector('.pp-link-url')?.href || li.dataset.url);
  }

  async function copySelected() {
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

  async function openSelected() {
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

  async function downloadSelected() {
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

  // ── Export (updated for link text - Feature 20) ──
  function exportLinks(format) {
    const items = getVisibleItems().map(li => {
      const idx = parseInt(li.dataset.index);
      return allLinks[idx] || { url: li.dataset.url, text: '' };
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

  function getVisibleUrls() {
    return getVisibleItems().map(li => li.querySelector('.pp-link-url')?.href || li.dataset.url);
  }

  // ── Feature 12: Auto-Strip UTM/Tracking ──
  function cleanAllUrls() {
    let totalCleaned = 0;
    let urlsCleaned = 0;
    allLinks.forEach((link, i) => {
      const result = stripTracking(link.url);
      if (result.removedCount > 0) {
        totalCleaned += result.removedCount;
        urlsCleaned++;
        allLinks[i].url = result.cleaned;
      }
    });
    if (totalCleaned === 0) {
      showToast('info', 'URLs are clean', 'No tracking parameters found');
    } else {
      showToast('success', 'Cleaned URLs', `Stripped ${totalCleaned} tracking param(s) from ${urlsCleaned} URL(s)`);
    }
    computeDuplicates();
    renderCurrentView();
  }

  // ── Feature 9: Link Health Checker ──
  async function checkAllLinks() {
    const urls = [...new Set(allLinks.map(l => l.url).filter(u => u.startsWith('http')))];
    if (urls.length === 0) {
      showToast('warning', 'No HTTP links to check');
      return;
    }

    checkLinksBtn.disabled = true;
    checkLinksBtn.textContent = 'Checking...';
    showToast('info', 'Checking links', `Testing ${urls.length} URL(s)...`);

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'checkLinks', urls }, (res) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(res);
        });
      });

      healthResults = response.results || {};

      // Compute summary
      let alive = 0, broken = 0, redirect = 0, errors = 0;
      Object.values(healthResults).forEach(r => {
        if (r.health === 'alive') alive++;
        else if (r.health === 'broken') broken++;
        else if (r.health === 'redirect') redirect++;
        else errors++;
      });

      healthSummary.hidden = false;
      healthSummary.innerHTML = '';
      const parts = [];
      if (alive) parts.push(`<span class="pp-health-stat pp-health-alive">${alive} alive</span>`);
      if (redirect) parts.push(`<span class="pp-health-stat pp-health-redirect">${redirect} redirect</span>`);
      if (broken) parts.push(`<span class="pp-health-stat pp-health-broken">${broken} broken</span>`);
      if (errors) parts.push(`<span class="pp-health-stat pp-health-error">${errors} unknown</span>`);
      healthSummary.innerHTML = 'Link Health: ' + parts.join(' ');

      renderCurrentView();
      showToast('success', 'Health check complete', `${alive} alive, ${broken} broken, ${redirect} redirect`);
    } catch (err) {
      showToast('error', 'Health check failed', err.message || 'Unknown error');
    } finally {
      checkLinksBtn.disabled = false;
      checkLinksBtn.textContent = 'Check Links';
    }
  }

  // ── Feature 13: Auto-copy on extract ──
  async function initAutoCopy() {
    const result = await chrome.storage.local.get('autoCopyEnabled');
    const enabled = result.autoCopyEnabled || false;
    updateAutoCopyUI(enabled);

    if (enabled && allLinks.length > 0 && !isCollectionView) {
      const urls = allLinks.map(l => l.url);
      try {
        await navigator.clipboard.writeText(urls.join('\n'));
        showToast('info', 'Auto-copied', `${urls.length} link(s) copied to clipboard`);
      } catch { /* clipboard might not be available */ }
    }
  }

  function updateAutoCopyUI(enabled) {
    autoCopyToggle.textContent = 'Auto-copy: ' + (enabled ? 'On' : 'Off');
    autoCopyToggle.classList.toggle('active', enabled);
  }

  async function toggleAutoCopy() {
    const result = await chrome.storage.local.get('autoCopyEnabled');
    const newState = !(result.autoCopyEnabled || false);
    await chrome.storage.local.set({ autoCopyEnabled: newState });
    updateAutoCopyUI(newState);
    showToast('info', 'Auto-copy ' + (newState ? 'enabled' : 'disabled'));
  }

  // ── Feature 19: Domain Stats Bar ──
  function renderDomainStats() {
    const links = getProcessedLinks().filter(l => l.domain);
    if (links.length === 0) {
      domainStatsBar.hidden = true;
      return;
    }

    const freq = {};
    links.forEach(l => { freq[l.domain] = (freq[l.domain] || 0) + 1; });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5);
    const otherCount = sorted.slice(5).reduce((sum, [, c]) => sum + c, 0);

    const colors = [
      'var(--pp-accent)', 'var(--pp-success)', 'var(--pp-warning)',
      'var(--pp-error)', 'var(--pp-info)',
    ];

    domainStatsBar.hidden = false;
    domainStatsBar.innerHTML = '';

    const bar = document.createElement('div');
    bar.className = 'pp-stats-bar-inner';

    top5.forEach(([domain, count], i) => {
      const pct = (count / links.length) * 100;
      const seg = document.createElement('div');
      seg.className = 'pp-stats-segment';
      seg.style.width = pct + '%';
      seg.style.background = colors[i];
      seg.title = `${domain}: ${count} (${Math.round(pct)}%)`;
      seg.addEventListener('mouseenter', () => highlightDomain(domain));
      seg.addEventListener('mouseleave', clearDomainHighlight);
      seg.addEventListener('click', () => {
        patternInput.value = '*' + domain + '*';
        applyFilters();
      });
      bar.appendChild(seg);
    });

    if (otherCount > 0) {
      const pct = (otherCount / links.length) * 100;
      const seg = document.createElement('div');
      seg.className = 'pp-stats-segment';
      seg.style.width = pct + '%';
      seg.style.background = 'var(--pp-text-tertiary)';
      seg.title = `Other: ${otherCount} (${Math.round(pct)}%)`;
      bar.appendChild(seg);
    }

    domainStatsBar.appendChild(bar);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'pp-stats-legend';
    top5.forEach(([domain, count], i) => {
      const item = document.createElement('span');
      item.className = 'pp-stats-legend-item';
      const dot = document.createElement('span');
      dot.className = 'pp-stats-legend-dot';
      dot.style.background = colors[i];
      item.appendChild(dot);
      item.appendChild(document.createTextNode(domain + ' (' + count + ')'));
      legend.appendChild(item);
    });
    if (otherCount > 0) {
      const item = document.createElement('span');
      item.className = 'pp-stats-legend-item';
      const dot = document.createElement('span');
      dot.className = 'pp-stats-legend-dot';
      dot.style.background = 'var(--pp-text-tertiary)';
      item.appendChild(dot);
      item.appendChild(document.createTextNode('Other (' + otherCount + ')'));
      legend.appendChild(item);
    }
    domainStatsBar.appendChild(legend);
  }

  function highlightDomain(domain) {
    linksList.querySelectorAll('.pp-link-item').forEach(li => {
      if (li.dataset.domain !== domain) {
        li.style.opacity = '0.3';
      }
    });
  }

  function clearDomainHighlight() {
    linksList.querySelectorAll('.pp-link-item').forEach(li => {
      li.style.opacity = '';
    });
  }

  // ── Feature 21: Smart Grouping Suggestions ──
  function renderSuggestions() {
    const links = getProcessedLinks().filter(l => l.url.startsWith('http'));
    if (links.length < 5) {
      suggestionsBar.hidden = true;
      return;
    }

    const pathSegments = {};
    links.forEach(l => {
      try {
        const parsed = new URL(l.url);
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 1) {
          const prefix = '/' + parts[0] + '/*';
          pathSegments[prefix] = (pathSegments[prefix] || 0) + 1;
        }
        if (parts.length >= 2) {
          const prefix = '/' + parts[0] + '/' + parts[1] + '/*';
          pathSegments[prefix] = (pathSegments[prefix] || 0) + 1;
        }
      } catch { /* skip */ }
    });

    const suggestions = Object.entries(pathSegments)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (suggestions.length === 0) {
      suggestionsBar.hidden = true;
      return;
    }

    suggestionsBar.hidden = false;
    suggestionsBar.innerHTML = '<span class="pp-suggestions-label">Patterns:</span>';
    suggestions.forEach(([pattern, count]) => {
      const chip = document.createElement('button');
      chip.className = 'pp-suggestion-chip';
      chip.textContent = `${count} match ${pattern}`;
      chip.addEventListener('click', () => {
        patternInput.value = '*' + pattern;
        applyFilters();
      });
      suggestionsBar.appendChild(chip);
    });
  }

  // ── Feature 22: Shareable Link Page ──
  function generateSharePage() {
    const items = getProcessedLinks();
    if (items.length === 0) {
      showToast('warning', 'No links to share');
      return;
    }

    const title = sourceTitle || 'PistonPry Links';
    const linksJson = JSON.stringify(items.map(l => ({
      url: l.url, text: l.text || '', type: l.type, domain: l.domain
    })));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;background:#f5f3ef;color:#1a1a1a}
h1{font-size:1.4rem;margin-bottom:8px}
.meta{color:#666;font-size:.85rem;margin-bottom:16px}
input{width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:.85rem;margin-bottom:12px}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eee;font-size:.85rem}
th{font-weight:600;background:#f0ece6}
a{color:#4f46e5;text-decoration:none}
a:hover{text-decoration:underline}
.text{color:#666;font-size:.8rem}
.pill{display:inline-block;padding:1px 6px;border-radius:100px;font-size:.7rem;background:#eee;color:#666;text-transform:uppercase}
@media(prefers-color-scheme:dark){body{background:#1a1a1a;color:#f0ece6}th{background:#2e2e2e}td{border-color:#333}a{color:#a5b4fc}.meta{color:#999}.text{color:#888}.pill{background:#333;color:#999}input{background:#242424;border-color:#3a3a3a;color:#f0ece6}}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">Generated by PistonPry${sourceUrl ? ' from ' + escapeHtml(sourceUrl) : ''} on ${new Date().toLocaleDateString()}</div>
<input type="text" id="filter" placeholder="Filter links..." oninput="filterLinks()">
<table><thead><tr><th>#</th><th>URL</th><th>Text</th><th>Type</th></tr></thead><tbody id="tbody"></tbody></table>
<script>
var links=${linksJson};
function render(items){var t=document.getElementById('tbody');t.innerHTML='';items.forEach(function(l,i){var r=t.insertRow();r.insertCell().textContent=i+1;var c=r.insertCell();var a=document.createElement('a');a.href=l.url;a.target='_blank';a.textContent=l.url;c.appendChild(a);r.insertCell().innerHTML='<span class="text">'+(l.text||'')+'</span>';r.insertCell().innerHTML='<span class="pill">'+l.type+'</span>';})}
function filterLinks(){var v=document.getElementById('filter').value.toLowerCase();var f=links.filter(function(l){return l.url.toLowerCase().includes(v)||(l.text||'').toLowerCase().includes(v)});render(f)}
render(links);
<\/script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pistonpry-links.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('success', 'Shared', 'Shareable HTML page downloaded');
  }

  // ── Collections ──
  async function getAllCollections() {
    const result = await chrome.storage.local.get('linkCollections');
    return result.linkCollections || [];
  }

  async function saveCollection(name, links, tags) {
    const result = await chrome.storage.local.get('linkCollections');
    const collections = result.linkCollections || [];
    const newCollection = {
      id: Date.now().toString(),
      name,
      links,
      sourceUrl,
      timestamp: new Date().toISOString(),
      count: links.length,
      tags: tags || [],
    };
    collections.push(newCollection);
    await chrome.storage.local.set({ linkCollections: collections });
    return newCollection;
  }

  async function deleteCollectionById(id) {
    const result = await chrome.storage.local.get('linkCollections');
    const collections = (result.linkCollections || []).filter(c => c.id !== id);
    await chrome.storage.local.set({ linkCollections: collections });
  }

  async function getCollectionById(id) {
    const collections = await getAllCollections();
    return collections.find(c => c.id === id) || null;
  }

  function renderCollections(collections, filterTag) {
    collectionsContainer.innerHTML = '';
    selectedCollectionIds.clear();
    mergeCollectionsBtn.hidden = true;
    diffCollectionsBtn.hidden = true;

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
      collectionsContainer.appendChild(empty);
      return;
    }

    // Render tag filter bar (Feature 15)
    renderTagFilter(collections);

    const frag = document.createDocumentFragment();
    filtered.forEach(col => {
      const card = document.createElement('div');
      card.className = 'pp-collection-card';
      card.dataset.id = col.id;

      const top = document.createElement('div');
      top.className = 'pp-collection-top';

      // Selection checkbox (Feature 16/17)
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'pp-checkbox';
      cb.addEventListener('change', () => {
        if (cb.checked) selectedCollectionIds.add(col.id);
        else selectedCollectionIds.delete(col.id);
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

      // Tags (Feature 15)
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
    collectionsContainer.appendChild(frag);
  }

  function updateCollectionSelectionUI() {
    const count = selectedCollectionIds.size;
    mergeCollectionsBtn.hidden = count < 2;
    diffCollectionsBtn.hidden = count !== 2;
  }

  // Feature 15: Tag filter
  function renderTagFilter(collections) {
    const allTags = new Set();
    collections.forEach(c => (c.tags || []).forEach(t => allTags.add(t)));

    if (allTags.size === 0) {
      tagFilterBar.hidden = true;
      return;
    }

    tagFilterBar.hidden = false;
    tagFilterBar.innerHTML = '<span class="pp-tag-filter-label">Filter by tag:</span>';

    const allBtn = document.createElement('button');
    allBtn.className = 'pp-tag-pill pp-tag-pill--filter';
    allBtn.textContent = 'All';
    allBtn.addEventListener('click', () => loadCollections());
    tagFilterBar.appendChild(allBtn);

    allTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'pp-tag-pill pp-tag-pill--filter';
      btn.textContent = tag;
      btn.addEventListener('click', () => loadCollections(tag));
      tagFilterBar.appendChild(btn);
    });
  }

  // Feature 16: Collection Merge
  async function mergeSelectedCollections() {
    const ids = [...selectedCollectionIds];
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

  // Feature 17: Collection Diff
  async function diffSelectedCollections() {
    const ids = [...selectedCollectionIds];
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

  // Feature 23: Import Links
  function showImportDialog() {
    const dialog = $('#importDialog');
    $('#importTextarea').value = '';
    $('#importNameInput').value = '';
    dialog.showModal();
  }

  async function importLinks() {
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

  async function loadCollections(filterTag) {
    const collections = await getAllCollections();
    renderCollections(collections, filterTag);
  }

  // ── Feature 14: Extraction History Tab ──
  async function loadHistory() {
    const result = await chrome.storage.local.get('extractionHistory');
    const history = result.extractionHistory || [];
    renderHistory(history);
  }

  function renderHistory(history) {
    historyContainer.innerHTML = '';

    if (history.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pp-collections-empty';
      const text = document.createElement('div');
      text.className = 'pp-collections-empty-text';
      text.textContent = 'No extraction history yet';
      empty.appendChild(text);
      historyContainer.appendChild(empty);
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

      // Preview links
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
    historyContainer.appendChild(frag);
  }

  // ── Tab switching ──
  function switchTab(tabEl) {
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

  // ── Type selector popover ──
  function showTypePopover(anchorEl) {
    const types = [...new Set(getVisibleItems().map(li => li.dataset.type))].sort();
    if (types.length === 0) {
      showToast('info', 'No link types available');
      return;
    }

    typePopover.innerHTML = '';
    types.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'pp-type-popover-option';
      btn.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      btn.addEventListener('click', () => {
        getVisibleItems().forEach(li => {
          const cb = li.querySelector('.pp-checkbox');
          cb.checked = li.dataset.type === t;
          li.classList.toggle('selected', cb.checked);
        });
        updateSelectionState();
        typePopover.classList.remove('open');
        showToast('info', 'Selected', `All "${t}" links selected`);
      });
      typePopover.appendChild(btn);
    });

    const rect = anchorEl.getBoundingClientRect();
    typePopover.style.top = (rect.bottom + 4) + 'px';
    typePopover.style.left = rect.left + 'px';
    typePopover.classList.add('open');
  }

  // ── Close menus on outside click ──
  document.addEventListener('click', (e) => {
    if (!exportToggle.contains(e.target) && !exportMenu.contains(e.target)) {
      exportMenu.classList.remove('open');
      exportToggle.setAttribute('aria-expanded', 'false');
    }
    if (!moreToggle.contains(e.target) && !moreMenu.contains(e.target)) {
      moreMenu.classList.remove('open');
      moreToggle.setAttribute('aria-expanded', 'false');
    }
    if (!typePopover.contains(e.target) && !e.target.closest('#selectByTypeBtn')) {
      typePopover.classList.remove('open');
    }
  });

  // ── Feature 24: Keyboard Shortcuts ──
  function handleKeyboardShortcuts(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.key === 'Escape') {
        e.target.blur();
        return;
      }
      return;
    }

    const mod = e.metaKey || e.ctrlKey;

    // Chord shortcuts: g+d, g+f
    if (pendingChord === 'g') {
      pendingChord = null;
      if (e.key === 'd') {
        e.preventDefault();
        setGroupedView(true);
        return;
      }
      if (e.key === 'f') {
        e.preventDefault();
        setGroupedView(false);
        return;
      }
    }

    if (e.key === 'g' && !mod) {
      pendingChord = 'g';
      setTimeout(() => { pendingChord = null; }, 500);
      return;
    }

    // j/k navigation
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      const items = getVisibleItems();
      if (items.length === 0) return;

      if (e.key === 'j') focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
      else focusedIndex = Math.max(focusedIndex - 1, 0);

      items.forEach((li, i) => li.classList.toggle('pp-link-focused', i === focusedIndex));
      items[focusedIndex]?.scrollIntoView({ block: 'nearest' });
      return;
    }

    // x: toggle checkbox
    if (e.key === 'x') {
      const items = getVisibleItems();
      if (focusedIndex >= 0 && focusedIndex < items.length) {
        e.preventDefault();
        const cb = items[focusedIndex].querySelector('.pp-checkbox');
        cb.checked = !cb.checked;
        items[focusedIndex].classList.toggle('selected', cb.checked);
        updateSelectionState();
      }
      return;
    }

    // Enter: open focused link
    if (e.key === 'Enter' && !mod) {
      const items = getVisibleItems();
      if (focusedIndex >= 0 && focusedIndex < items.length) {
        e.preventDefault();
        const url = items[focusedIndex].querySelector('.pp-link-url')?.href;
        if (url) window.open(url, '_blank');
      }
      return;
    }

    // c: copy focused link
    if (e.key === 'c' && !mod) {
      const items = getVisibleItems();
      if (focusedIndex >= 0 && focusedIndex < items.length) {
        e.preventDefault();
        const url = items[focusedIndex].querySelector('.pp-link-url')?.href || items[focusedIndex].dataset.url;
        if (url) {
          navigator.clipboard.writeText(url);
          showToast('success', 'Copied', 'URL copied to clipboard');
        }
      }
      return;
    }

    // /: focus search
    if (e.key === '/') {
      e.preventDefault();
      searchInput.focus();
      return;
    }

    // Escape: deselect
    if (e.key === 'Escape') {
      getVisibleItems().forEach(li => {
        const cb = li.querySelector('.pp-checkbox');
        cb.checked = false;
        li.classList.remove('selected');
        li.classList.remove('pp-link-focused');
      });
      focusedIndex = -1;
      updateSelectionState();
      return;
    }

    // ?: show shortcuts help
    if (e.key === '?' && !mod) {
      e.preventDefault();
      $('#shortcutsDialog').showModal();
      return;
    }

    // Ctrl+A: select all
    if (mod && e.key === 'a') {
      e.preventDefault();
      getVisibleItems().forEach(li => {
        const cb = li.querySelector('.pp-checkbox');
        cb.checked = true;
        li.classList.add('selected');
      });
      updateSelectionState();
      return;
    }

    // Ctrl+C: copy selected
    if (mod && e.key === 'c') {
      const selected = getSelectedUrls();
      if (selected.length > 0) {
        e.preventDefault();
        navigator.clipboard.writeText(selected.join('\n'));
        showToast('success', 'Copied', selected.length + ' link(s)');
      }
    }
  }

  function setGroupedView(grouped) {
    isGroupedView = grouped;
    viewFlatBtn.classList.toggle('active', !grouped);
    viewGroupedBtn.classList.toggle('active', grouped);
    renderCurrentView();
  }

  // ── Event listeners ──
  function attachEvents() {
    // Tabs
    $$('.pp-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab));
      tab.addEventListener('keydown', (e) => {
        const tabs = [...$$('.pp-tab')];
        const idx = tabs.indexOf(tab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const next = e.key === 'ArrowRight'
            ? tabs[(idx + 1) % tabs.length]
            : tabs[(idx - 1 + tabs.length) % tabs.length];
          switchTab(next);
        }
      });
    });

    // Copy All
    copyAllBtn.addEventListener('click', copyAll);

    // Filters
    searchInput.addEventListener('input', applyFilters);
    typeFilter.addEventListener('change', applyFilters);
    locationFilter.addEventListener('change', applyFilters);
    patternInput.addEventListener('input', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);

    // Feature 6: Regex toggle
    regexToggle.addEventListener('click', () => {
      isRegexMode = !isRegexMode;
      regexToggle.classList.toggle('active', isRegexMode);
      searchInput.placeholder = isRegexMode ? 'Regex filter...' : 'Filter links...';
      applyFilters();
    });

    // Feature 8: Dedup toggle
    dedupToggle.addEventListener('click', () => {
      isDedupActive = !isDedupActive;
      const dupCount = getDuplicateCount();
      dedupToggle.textContent = isDedupActive ? `Dedup: On (${dupCount})` : 'Dedup: Off';
      dedupToggle.classList.toggle('active', isDedupActive);
      renderCurrentView();
    });

    // Feature 4: Type sub-tabs
    $$('.pp-type-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.pp-type-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentItemTypeFilter = tab.dataset.itemType;
        renderCurrentView();
      });
    });

    // Feature 7: View toggle
    viewFlatBtn.addEventListener('click', () => setGroupedView(false));
    viewGroupedBtn.addEventListener('click', () => setGroupedView(true));

    // Feature 10: Sort buttons
    $$('.pp-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.sort;
        if (sortField === field) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortField = field;
          sortDir = 'asc';
        }
        $$('.pp-sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (sortField !== 'none') {
          btn.textContent = btn.dataset.sort.charAt(0).toUpperCase() + btn.dataset.sort.slice(1) +
            (sortDir === 'asc' ? ' \u25B2' : ' \u25BC');
        }
        renderCurrentView();
      });
    });

    // Select all
    selectAllCb.addEventListener('change', () => {
      const checked = selectAllCb.checked;
      getVisibleItems().forEach(li => {
        const cb = li.querySelector('.pp-checkbox');
        cb.checked = checked;
        li.classList.toggle('selected', checked);
      });
      updateSelectionState();
    });

    // Export dropdown
    exportToggle.addEventListener('click', () => {
      const open = exportMenu.classList.toggle('open');
      exportToggle.setAttribute('aria-expanded', String(open));
    });
    exportMenu.querySelectorAll('.pp-export-option').forEach(btn => {
      btn.addEventListener('click', () => {
        exportLinks(btn.dataset.format);
        exportMenu.classList.remove('open');
        exportToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // More dropdown
    moreToggle.addEventListener('click', () => {
      const open = moreMenu.classList.toggle('open');
      moreToggle.setAttribute('aria-expanded', String(open));
    });

    // Invert selection
    $('#invertSelectionBtn').addEventListener('click', () => {
      getVisibleItems().forEach(li => {
        const cb = li.querySelector('.pp-checkbox');
        cb.checked = !cb.checked;
        li.classList.toggle('selected', cb.checked);
      });
      updateSelectionState();
      moreMenu.classList.remove('open');
    });

    // Select by type
    $('#selectByTypeBtn').addEventListener('click', (e) => {
      moreMenu.classList.remove('open');
      showTypePopover(e.target);
    });

    // Feature 12: Clean URLs
    cleanUrlsBtn.addEventListener('click', cleanAllUrls);

    // Feature 9: Check links
    checkLinksBtn.addEventListener('click', checkAllLinks);

    // Feature 13: Auto-copy toggle
    autoCopyToggle.addEventListener('click', toggleAutoCopy);

    // Feature 22: Share
    shareBtn.addEventListener('click', generateSharePage);

    // Feature 23: Import
    importLinksBtn.addEventListener('click', showImportDialog);
    $('#importCancelBtn').addEventListener('click', () => $('#importDialog').close());
    $('#importConfirmBtn').addEventListener('click', importLinks);

    // Feature 16: Merge
    mergeCollectionsBtn.addEventListener('click', mergeSelectedCollections);

    // Feature 17: Diff
    diffCollectionsBtn.addEventListener('click', diffSelectedCollections);
    $('#diffCloseBtn').addEventListener('click', () => $('#diffDialog').close());

    // Feature 24: Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    $('#shortcutsCloseBtn').addEventListener('click', () => $('#shortcutsDialog').close());

    // Save toggle
    saveToggle.addEventListener('click', () => {
      saveToggle.hidden = true;
      saveForm.hidden = false;
      collectionNameInput.focus();
    });

    saveCancelBtn.addEventListener('click', () => {
      saveForm.hidden = true;
      saveToggle.hidden = false;
      collectionNameInput.value = '';
      collectionTagsInput.value = '';
    });

    // Save collection form (with tags - Feature 15)
    saveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = collectionNameInput.value.trim();
      if (!name) {
        collectionNameInput.focus();
        return;
      }
      const urls = getVisibleUrls();
      if (urls.length === 0) {
        showToast('warning', 'No links to save');
        return;
      }
      const tags = collectionTagsInput.value.trim()
        ? collectionTagsInput.value.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      try {
        await saveCollection(name, urls, tags);
        collectionNameInput.value = '';
        collectionTagsInput.value = '';
        saveForm.hidden = true;
        saveToggle.hidden = false;
        showToast('success', 'Collection saved', `"${name}" with ${urls.length} links`);
      } catch (err) {
        showToast('error', 'Save failed', err.message);
      }
    });
  }

  // ── Init ──
  async function init() {
    attachEvents();

    // Check if viewing a saved collection
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'collection' && params.get('id')) {
      isCollectionView = true;
      const col = await getCollectionById(params.get('id'));
      if (col) {
        document.title = col.name + ' \u2014 PistonPry';
        sourceUrl = col.sourceUrl || '';
        sourceTitle = col.name;
        let tabHostname = '';
        try { tabHostname = new URL(sourceUrl).hostname; } catch { /* ignore */ }
        allLinks = col.links.map(url => {
          if (typeof url === 'string') return classifyLink(url, tabHostname, '');
          return url;
        });
      } else {
        showToast('error', 'Collection not found');
        return;
      }
    } else {
      const data = await chrome.storage.session.get('currentExtraction');
      if (data.currentExtraction) {
        allLinks = data.currentExtraction.links || [];
        sourceUrl = data.currentExtraction.sourceUrl || '';
        sourceTitle = data.currentExtraction.sourceTitle || '';
      }
    }

    // Compute duplicates
    computeDuplicates();
    const dupCount = getDuplicateCount();
    if (dupCount > 0) {
      dedupToggle.textContent = `Dedup: Off (${dupCount} dups)`;
    }

    // Render
    renderCurrentView();
    populateTypeFilter(allLinks);
    countPill.textContent = allLinks.length;

    // Source link
    if (sourceUrl) {
      try {
        sourceMeta.textContent = 'from ' + new URL(sourceUrl).hostname;
        sourceMeta.href = sanitizeUrl(sourceUrl);
        sourceMeta.title = sourceUrl;
        sourceMeta.hidden = false;
      } catch { /* keep hidden */ }
    }

    // Hide save section in collection view mode or when no links
    if (isCollectionView || allLinks.length === 0) {
      saveSection.hidden = true;
    }

    if (allLinks.length === 0) {
      copyAllBtn.hidden = true;
      cleanUrlsBtn.hidden = true;
      checkLinksBtn.hidden = true;
      shareBtn.hidden = true;
    }

    // Load collections for the saved tab
    loadCollections();

    // Feature 13: Auto-copy
    initAutoCopy();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
