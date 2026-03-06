import {
  createOverlay, createSelectionDiv, createCountIndicator,
  highlightLink, unhighlightLink, clearAllHighlights,
  updateCountIndicator, positionCountIndicator, showMultiRegionHint,
} from './ui.js';
import { isLinkVisible } from './extractors.js';
import { extractItemsInRegion } from './extractors.js';
import { sendExtractedItems } from './messaging.js';
import { enterPickMode } from './pick.js';

function updateLinkHighlights(state, selectionRect) {
  const links = state.cachedLinks || document.querySelectorAll('a[href]');
  const currentlySelected = new Set();

  links.forEach(link => {
    if (!isLinkVisible(link)) return;

    const linkRect = link.getBoundingClientRect();
    const overlaps = !(
      selectionRect.right < linkRect.left ||
      selectionRect.left > linkRect.right ||
      selectionRect.bottom < linkRect.top ||
      selectionRect.top > linkRect.bottom
    );

    if (overlaps) {
      currentlySelected.add(link);
      highlightLink(link, state.highlightedLinks);
    } else if (state.highlightedLinks.has(link)) {
      unhighlightLink(link, state.highlightedLinks);
    }
  });

  state.highlightedLinks.forEach(link => {
    if (!currentlySelected.has(link)) {
      unhighlightLink(link, state.highlightedLinks);
    }
  });

  const totalCount = state.accumulatedUrlSet.size + currentlySelected.size;
  updateCountIndicator(state.countIndicator, totalCount);
}

export function onMouseDown(state, e) {
  if (e.button !== 0) return;

  if (e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    enterPickMode(state);
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  state.isDrawing = true;
  state.startX = e.clientX;
  state.startY = e.clientY;

  state.cachedLinks = document.querySelectorAll('a[href]');

  state.overlayDiv = createOverlay();

  if (state.selectionDiv) state.selectionDiv.remove();
  state.selectionDiv = createSelectionDiv();
  state.selectionDiv.style.setProperty('left', `${state.startX}px`, 'important');
  state.selectionDiv.style.setProperty('top', `${state.startY}px`, 'important');
  state.selectionDiv.style.setProperty('width', '0px', 'important');
  state.selectionDiv.style.setProperty('height', '0px', 'important');

  if (state.countIndicator) state.countIndicator.remove();
  state.countIndicator = createCountIndicator();
  positionCountIndicator(state.countIndicator, state.startX, state.startY);

  document.addEventListener('mousemove', state.onMouseMove, true);
  document.addEventListener('mouseup', state.onMouseUp, true);
}

export function onMouseMove(state, e) {
  if (!state.isDrawing) return;
  e.preventDefault();
  e.stopPropagation();

  const currentX = e.clientX;
  const currentY = e.clientY;

  const newLeft = Math.min(currentX, state.startX);
  const newTop = Math.min(currentY, state.startY);
  const width = Math.abs(currentX - state.startX);
  const height = Math.abs(currentY - state.startY);

  state.lastSelectionRect = { left: newLeft, top: newTop, right: newLeft + width, bottom: newTop + height };

  state.selectionDiv.style.setProperty('left', `${newLeft}px`, 'important');
  state.selectionDiv.style.setProperty('top', `${newTop}px`, 'important');
  state.selectionDiv.style.setProperty('width', `${width}px`, 'important');
  state.selectionDiv.style.setProperty('height', `${height}px`, 'important');

  positionCountIndicator(state.countIndicator, currentX, currentY);

  if (!state.rafPending) {
    state.rafPending = true;
    requestAnimationFrame(() => {
      state.rafPending = false;
      updateLinkHighlights(state, state.lastSelectionRect);
    });
  }
}

export function onMouseUp(state, e) {
  if (!state.isDrawing) return;
  if (e.button !== 0) return;

  state.isDrawing = false;
  e.preventDefault();
  e.stopPropagation();

  clearAllHighlights(state.highlightedLinks);

  if (state.overlayDiv) { state.overlayDiv.remove(); state.overlayDiv = null; }
  if (state.countIndicator) { state.countIndicator.remove(); state.countIndicator = null; }
  if (state.selectionDiv) { state.selectionDiv.remove(); state.selectionDiv = null; }

  const rect = state.lastSelectionRect;
  state.lastSelectionRect = null;

  if (rect && (rect.right - rect.left) > 5 && (rect.bottom - rect.top) > 5) {
    const items = extractItemsInRegion(rect, state.extractTypes, state.cachedLinks);
    state.regionCount++;

    [...items.links, ...items.images, ...items.emails].forEach(item => {
      if (!state.accumulatedUrlSet.has(item.url)) {
        state.accumulatedUrlSet.add(item.url);
        state.accumulatedItems.push(item);
      }
    });

    if (e.shiftKey) {
      state.isMultiRegionMode = true;
      showMultiRegionHint(state);
      document.removeEventListener('mousemove', state.onMouseMove, true);
      document.removeEventListener('mouseup', state.onMouseUp, true);
      document.addEventListener('mousedown', state.onMouseDown, { capture: true, once: true });
      return;
    }

    if (state.isMultiRegionMode || state.regionCount === 1) {
      const finalItems = { links: [], images: [], emails: [] };
      state.accumulatedItems.forEach(item => {
        if (item.itemType === 'image') finalItems.images.push(item);
        else if (item.itemType === 'email') finalItems.emails.push(item);
        else finalItems.links.push(item);
      });

      if (state.regionCount === 1 && !state.isMultiRegionMode) {
        sendExtractedItems(items, state.extractTypes);
      } else {
        sendExtractedItems(finalItems, state.extractTypes);
      }
    }
  } else {
    if (state.accumulatedItems.length > 0) {
      const finalItems = { links: [], images: [], emails: [] };
      state.accumulatedItems.forEach(item => {
        if (item.itemType === 'image') finalItems.images.push(item);
        else if (item.itemType === 'email') finalItems.emails.push(item);
        else finalItems.links.push(item);
      });
      sendExtractedItems(finalItems, state.extractTypes);
    } else {
      if (chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'extractedLinks', links: [], items: [] });
      }
    }
  }

  // Full cleanup
  document.removeEventListener('mousemove', state.onMouseMove, true);
  document.removeEventListener('mouseup', state.onMouseUp, true);
  document.removeEventListener('mousedown', state.onMouseDown, true);
  document.removeEventListener('keydown', state.onKeyDown, true);
  document.body.style.cursor = state.originalCursor;
  state.cachedLinks = null;
  if (state.multiRegionHint && state.multiRegionHint.parentNode) state.multiRegionHint.remove();
  state.accumulatedItems = [];
  state.accumulatedUrlSet.clear();
  state.regionCount = 0;
  state.isMultiRegionMode = false;
  state.sentinel.remove();
}
