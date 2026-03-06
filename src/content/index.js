import { extractFullPage, extractFromElement } from './extractors.js';
import { sendExtractedItems } from './messaging.js';
import { clearAllHighlights, showDrawHint } from './ui.js';
import { onMouseDown, onMouseMove, onMouseUp } from './draw.js';
import { onPickClick, finalizePickMode } from './pick.js';

(() => {
  // Prevent multiple injections
  if (document.querySelector('[data-pistonpry-active]')) {
    return;
  }

  const pistonPryMode = window.__pistonpryMode || 'draw';
  const pistonPryExtractTypes = window.__pistonpryExtractTypes || ['links'];

  // Shared mutable state
  const state = {
    extractTypes: pistonPryExtractTypes,
    startX: 0,
    startY: 0,
    selectionDiv: null,
    overlayDiv: null,
    countIndicator: null,
    isDrawing: false,
    cachedLinks: null,
    rafPending: false,
    drawHint: null,
    lastSelectionRect: null,
    originalCursor: document.body.style.cursor,
    highlightedLinks: new Set(),

    // Multi-region state
    accumulatedItems: [],
    accumulatedUrlSet: new Set(),
    regionCount: 0,
    isMultiRegionMode: false,
    multiRegionHint: null,

    // Pick mode state
    isPickMode: false,
    pickedLinks: new Set(),
    pickedElements: new Map(),
    pickCountPill: null,

    // Sentinel
    sentinel: null,
  };

  // Sentinel element to track active state
  state.sentinel = document.createElement('div');
  state.sentinel.setAttribute('data-pistonpry-active', '');
  state.sentinel.style.display = 'none';
  document.body.appendChild(state.sentinel);

  // Bind event handlers to state
  state.onMouseDown = (e) => onMouseDown(state, e);
  state.onMouseMove = (e) => onMouseMove(state, e);
  state.onMouseUp = (e) => onMouseUp(state, e);
  state.onPickClick = (e) => onPickClick(state, e);

  state.cleanup = () => {
    state.isDrawing = false;
    clearAllHighlights(state.highlightedLinks);
    state.lastSelectionRect = null;
    if (state.selectionDiv) { state.selectionDiv.remove(); state.selectionDiv = null; }
    if (state.overlayDiv) { state.overlayDiv.remove(); state.overlayDiv = null; }
    if (state.countIndicator) { state.countIndicator.remove(); state.countIndicator = null; }
    if (state.drawHint && state.drawHint.parentNode) state.drawHint.remove();
    if (state.multiRegionHint && state.multiRegionHint.parentNode) state.multiRegionHint.remove();
    if (state.pickCountPill && state.pickCountPill.parentNode) state.pickCountPill.remove();

    state.pickedElements.forEach((styles, el) => {
      el.style.removeProperty('background-color');
      el.style.removeProperty('outline');
      el.style.removeProperty('border-radius');
    });
    state.pickedElements.clear();
    state.pickedLinks.clear();

    document.removeEventListener('mousemove', state.onMouseMove, true);
    document.removeEventListener('mouseup', state.onMouseUp, true);
    document.removeEventListener('mousedown', state.onMouseDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('click', state.onPickClick, true);
    document.body.style.cursor = state.originalCursor;
    state.cachedLinks = null;
    state.accumulatedItems = [];
    state.accumulatedUrlSet.clear();
    state.regionCount = 0;
    state.isMultiRegionMode = false;
    state.isPickMode = false;
    state.sentinel.remove();
  };

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      state.cleanup();
      return;
    }

    if (e.key === 'Enter' && state.isPickMode) {
      e.preventDefault();
      finalizePickMode(state);
      return;
    }

    if (e.key === 'Enter' && state.isMultiRegionMode && state.accumulatedItems.length > 0) {
      e.preventDefault();
      const finalItems = { links: [], images: [], emails: [] };
      state.accumulatedItems.forEach(item => {
        if (item.itemType === 'image') finalItems.images.push(item);
        else if (item.itemType === 'email') finalItems.emails.push(item);
        else finalItems.links.push(item);
      });
      sendExtractedItems(finalItems, state.extractTypes);
      state.cleanup();
    }
  }

  state.onKeyDown = onKeyDown;

  // Handle context menu extraction
  if (pistonPryMode === 'contextMenu') {
    const x = window.__pistonpryContextX;
    const y = window.__pistonpryContextY;
    const element = document.elementFromPoint(x, y);
    if (element) {
      const items = extractFromElement(element, pistonPryExtractTypes);
      sendExtractedItems(items, pistonPryExtractTypes);
    } else {
      const items = extractFullPage(pistonPryExtractTypes);
      sendExtractedItems(items, pistonPryExtractTypes);
    }
    state.sentinel.remove();
    return;
  }

  // Handle fullpage mode
  if (pistonPryMode === 'fullpage') {
    const items = extractFullPage(pistonPryExtractTypes);
    sendExtractedItems(items, pistonPryExtractTypes);
    state.sentinel.remove();
    return;
  }

  // Default: Draw mode
  document.body.style.cursor = 'crosshair';
  state.drawHint = showDrawHint();
  document.addEventListener('mousedown', state.onMouseDown, { capture: true, once: true });
  document.addEventListener('keydown', onKeyDown, { capture: true });
})();
