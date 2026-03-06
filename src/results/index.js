import '../styles/main.css';
import { state, $$, $, dom, initDom } from './state.js';
import { showToast } from './toast.js';
import { classifyLink } from '../shared/classify.js';
import { sanitizeUrl } from '../shared/sanitize.js';
import { renderLinks, renderGroupedView, renderEmptyState } from './render.js';
import { getProcessedLinks, applyFilters, resetFilters, populateTypeFilter, updateItemTypeCounts, hasActiveFilters } from './filters.js';
import { getVisibleItems, updateSelectionState } from './selection.js';
import { copyAll, getVisibleUrls } from './actions.js';
import { exportLinks } from './export.js';
import { cleanAllUrls } from './urlCleaner.js';
import { checkAllLinks } from './healthCheck.js';
import { initAutoCopy, toggleAutoCopy } from './autoCopy.js';
import { renderDomainStats } from './stats.js';
import { renderSuggestions } from './stats.js';
import { generateSharePage } from './share.js';
import { loadCollections, saveCollection, getCollectionById } from './collections.js';
import { mergeSelectedCollections, diffSelectedCollections, showImportDialog, importLinks } from './collectionOps.js';
import { loadHistory } from './history.js';
import { switchTab } from './tabs.js';
import { handleKeyboardShortcuts } from './keyboard.js';

// ── Helpers ──

function computeDuplicates() {
  state.duplicateMap = {};
  state.allLinks.forEach(l => {
    state.duplicateMap[l.url] = (state.duplicateMap[l.url] || 0) + 1;
  });
}

function getDuplicateCount() {
  return Object.values(state.duplicateMap).filter(c => c > 1).reduce((sum, c) => sum + c - 1, 0);
}

function renderCurrentView() {
  const links = getProcessedLinks();
  if (state.isGroupedView) {
    renderGroupedView(links, updateSelectionState);
  } else {
    renderLinks(links, updateSelectionState);
  }
  applyFiltersWithDeps();
  updateItemTypeCounts();
  renderDomainStats();
  renderSuggestions();
}

// applyFilters with access to renderEmptyState and updateSelectionState (avoids circular deps)
function applyFiltersWithDeps() {
  applyFilters();
  // applyFilters handles the empty state and selection internally via the patched version
}

function setGroupedView(grouped) {
  state.isGroupedView = grouped;
  dom.viewFlatBtn.classList.toggle('active', !grouped);
  dom.viewGroupedBtn.classList.toggle('active', grouped);
  renderCurrentView();
}

function showTypePopover(anchorEl) {
  const types = [...new Set(getVisibleItems().map(li => li.dataset.type))].sort();
  if (types.length === 0) {
    showToast('info', 'No link types available');
    return;
  }

  dom.typePopover.innerHTML = '';
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
      dom.typePopover.classList.remove('open');
      showToast('info', 'Selected', `All "${t}" links selected`);
    });
    dom.typePopover.appendChild(btn);
  });

  const rect = anchorEl.getBoundingClientRect();
  dom.typePopover.style.top = (rect.bottom + 4) + 'px';
  dom.typePopover.style.left = rect.left + 'px';
  dom.typePopover.classList.add('open');
}

// Listen for re-render events (from inline edit)
document.addEventListener('pistonpry:rerender', () => renderCurrentView());

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
  dom.copyAllBtn.addEventListener('click', copyAll);

  // Filters
  dom.searchInput.addEventListener('input', () => applyFilters());
  dom.typeFilter.addEventListener('change', () => applyFilters());
  dom.locationFilter.addEventListener('change', () => applyFilters());
  dom.patternInput.addEventListener('input', () => applyFilters());
  dom.resetFiltersBtn.addEventListener('click', resetFilters);

  // Regex toggle
  dom.regexToggle.addEventListener('click', () => {
    state.isRegexMode = !state.isRegexMode;
    dom.regexToggle.classList.toggle('active', state.isRegexMode);
    dom.searchInput.placeholder = state.isRegexMode ? 'Regex filter...' : 'Filter links...';
    applyFilters();
  });

  // Dedup toggle
  dom.dedupToggle.addEventListener('click', () => {
    state.isDedupActive = !state.isDedupActive;
    const dupCount = getDuplicateCount();
    dom.dedupToggle.textContent = state.isDedupActive ? `Dedup: On (${dupCount})` : 'Dedup: Off';
    dom.dedupToggle.classList.toggle('active', state.isDedupActive);
    renderCurrentView();
  });

  // Type sub-tabs
  $$('.pp-type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.pp-type-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentItemTypeFilter = tab.dataset.itemType;
      renderCurrentView();
    });
  });

  // View toggle
  dom.viewFlatBtn.addEventListener('click', () => setGroupedView(false));
  dom.viewGroupedBtn.addEventListener('click', () => setGroupedView(true));

  // Sort buttons
  $$('.pp-sort-btn').forEach(btn => {
    btn.dataset.label = btn.textContent.trim();
    btn.addEventListener('click', () => {
      const field = btn.dataset.sort;
      if (state.sortField === field && field !== 'none') {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortField = field;
        state.sortDir = 'asc';
      }
      $$('.pp-sort-btn').forEach(b => {
        b.classList.remove('active');
        b.textContent = b.dataset.label;
      });
      btn.classList.add('active');
      if (state.sortField !== 'none') {
        btn.textContent = btn.dataset.label +
          (state.sortDir === 'asc' ? ' \u25B2' : ' \u25BC');
      }
      renderCurrentView();
    });
  });

  // Select all
  dom.selectAllCb.addEventListener('change', () => {
    const checked = dom.selectAllCb.checked;
    getVisibleItems().forEach(li => {
      const cb = li.querySelector('.pp-checkbox');
      cb.checked = checked;
      li.classList.toggle('selected', checked);
    });
    updateSelectionState();
  });

  // Export dropdown
  dom.exportToggle.addEventListener('click', () => {
    const open = dom.exportMenu.classList.toggle('open');
    dom.exportToggle.setAttribute('aria-expanded', String(open));
  });
  dom.exportMenu.querySelectorAll('.pp-export-option').forEach(btn => {
    btn.addEventListener('click', () => {
      exportLinks(btn.dataset.format);
      dom.exportMenu.classList.remove('open');
      dom.exportToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // More dropdown
  dom.moreToggle.addEventListener('click', () => {
    const open = dom.moreMenu.classList.toggle('open');
    dom.moreToggle.setAttribute('aria-expanded', String(open));
  });

  // Invert selection
  $('#invertSelectionBtn').addEventListener('click', () => {
    getVisibleItems().forEach(li => {
      const cb = li.querySelector('.pp-checkbox');
      cb.checked = !cb.checked;
      li.classList.toggle('selected', cb.checked);
    });
    updateSelectionState();
    dom.moreMenu.classList.remove('open');
  });

  // Select by type
  $('#selectByTypeBtn').addEventListener('click', (e) => {
    dom.moreMenu.classList.remove('open');
    showTypePopover(e.target);
  });

  // Clean URLs
  dom.cleanUrlsBtn.addEventListener('click', () => cleanAllUrls(renderCurrentView, computeDuplicates));

  // Check links
  dom.checkLinksBtn.addEventListener('click', () => checkAllLinks(renderCurrentView));

  // Auto-copy toggle
  dom.autoCopyToggle.addEventListener('click', toggleAutoCopy);

  // Share
  dom.shareBtn.addEventListener('click', generateSharePage);

  // Import
  dom.importLinksBtn.addEventListener('click', showImportDialog);
  $('#importCancelBtn').addEventListener('click', () => $('#importDialog').close());
  $('#importConfirmBtn').addEventListener('click', importLinks);

  // Merge
  dom.mergeCollectionsBtn.addEventListener('click', mergeSelectedCollections);

  // Diff
  dom.diffCollectionsBtn.addEventListener('click', diffSelectedCollections);
  $('#diffCloseBtn').addEventListener('click', () => $('#diffDialog').close());

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => handleKeyboardShortcuts(e, setGroupedView));
  $('#shortcutsCloseBtn').addEventListener('click', () => $('#shortcutsDialog').close());

  // Save toggle
  dom.saveToggle.addEventListener('click', () => {
    dom.saveToggle.hidden = true;
    dom.saveForm.hidden = false;
    dom.collectionNameInput.focus();
  });

  dom.saveCancelBtn.addEventListener('click', () => {
    dom.saveForm.hidden = true;
    dom.saveToggle.hidden = false;
    dom.collectionNameInput.value = '';
    dom.collectionTagsInput.value = '';
  });

  // Save collection form
  dom.saveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = dom.collectionNameInput.value.trim();
    if (!name) {
      dom.collectionNameInput.focus();
      return;
    }
    const urls = getVisibleUrls();
    if (urls.length === 0) {
      showToast('warning', 'No links to save');
      return;
    }
    const tags = dom.collectionTagsInput.value.trim()
      ? dom.collectionTagsInput.value.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    try {
      await saveCollection(name, urls, tags);
      dom.collectionNameInput.value = '';
      dom.collectionTagsInput.value = '';
      dom.saveForm.hidden = true;
      dom.saveToggle.hidden = false;
      showToast('success', 'Collection saved', `"${name}" with ${urls.length} links`);
    } catch (err) {
      showToast('error', 'Save failed', err.message);
    }
  });

  // Close menus on outside click
  document.addEventListener('click', (e) => {
    if (!dom.exportToggle.contains(e.target) && !dom.exportMenu.contains(e.target)) {
      dom.exportMenu.classList.remove('open');
      dom.exportToggle.setAttribute('aria-expanded', 'false');
    }
    if (!dom.moreToggle.contains(e.target) && !dom.moreMenu.contains(e.target)) {
      dom.moreMenu.classList.remove('open');
      dom.moreToggle.setAttribute('aria-expanded', 'false');
    }
    if (!dom.typePopover.contains(e.target) && !e.target.closest('#selectByTypeBtn')) {
      dom.typePopover.classList.remove('open');
    }
  });
}

// ── Init ──
async function init() {
  initDom();
  attachEvents();

  // Check if viewing a saved collection
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'collection' && params.get('id')) {
    state.isCollectionView = true;
    const col = await getCollectionById(params.get('id'));
    if (col) {
      document.title = col.name + ' \u2014 PistonPry';
      state.sourceUrl = col.sourceUrl || '';
      state.sourceTitle = col.name;
      let tabHostname = '';
      try { tabHostname = new URL(state.sourceUrl).hostname; } catch { /* ignore */ }
      state.allLinks = col.links.map(url => {
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
      state.allLinks = data.currentExtraction.links || [];
      state.sourceUrl = data.currentExtraction.sourceUrl || '';
      state.sourceTitle = data.currentExtraction.sourceTitle || '';
    }
  }

  // Compute duplicates
  computeDuplicates();
  const dupCount = getDuplicateCount();
  if (dupCount > 0) {
    dom.dedupToggle.textContent = `Dedup: Off (${dupCount} dups)`;
  }

  // Render
  renderCurrentView();
  populateTypeFilter(state.allLinks);
  dom.countPill.textContent = state.allLinks.length;

  // Source link
  if (state.sourceUrl) {
    try {
      dom.sourceMeta.textContent = 'from ' + new URL(state.sourceUrl).hostname;
      dom.sourceMeta.href = sanitizeUrl(state.sourceUrl);
      dom.sourceMeta.title = state.sourceUrl;
      dom.sourceMeta.hidden = false;
    } catch { /* keep hidden */ }
  }

  // Hide save section in collection view mode or when no links
  if (state.isCollectionView || state.allLinks.length === 0) {
    dom.saveSection.hidden = true;
  }

  if (state.allLinks.length === 0) {
    dom.copyAllBtn.hidden = true;
    dom.cleanUrlsBtn.hidden = true;
    dom.checkLinksBtn.hidden = true;
    dom.shareBtn.hidden = true;
  }

  // Load collections for the saved tab
  loadCollections();

  // Auto-copy
  initAutoCopy();
}

document.addEventListener('DOMContentLoaded', init);
