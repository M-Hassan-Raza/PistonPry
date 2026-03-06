(() => {
  // Prevent multiple injections
  if (document.querySelector('[data-pistonpry-active]')) {
    return;
  }

  // Check for fullpage mode passed via args
  const pistonPryMode = window.__pistonpryMode || 'draw';
  const pistonPryExtractTypes = window.__pistonpryExtractTypes || ['links'];

  const THEME = {
    accent: 'rgba(79, 70, 229, 0.7)',
    accentFill: 'rgba(79, 70, 229, 0.04)',
    accentBadge: 'rgba(79, 70, 229, 0.85)',
    highlightBg: 'rgba(79, 70, 229, 0.08)',
    highlightOutline: '1.5px solid rgba(79, 70, 229, 0.4)',
    pickHighlight: 'rgba(79, 70, 229, 0.15)',
    pickOutline: '2px solid rgba(79, 70, 229, 0.6)',
  };

  let startX, startY, selectionDiv, overlayDiv, countIndicator;
  let isDrawing = false;
  let cachedLinks = null;
  let rafPending = false;
  let drawHint = null;
  let lastSelectionRect = null;
  const originalCursor = document.body.style.cursor;
  const highlightedLinks = new Set();

  // Multi-region state (Feature 3)
  let accumulatedItems = [];
  let accumulatedUrlSet = new Set();
  let regionCount = 0;
  let isMultiRegionMode = false;
  let multiRegionHint = null;

  // Click-to-pick state (Feature 5)
  let isPickMode = false;
  let pickedLinks = new Set();
  let pickedElements = new Map(); // element -> original styles
  let pickCountPill = null;

  function applyImportantStyles(el, styles) {
    for (const [prop, value] of Object.entries(styles)) {
      el.style.setProperty(prop, value, 'important');
    }
  }

  // Sentinel element to track active state
  const sentinel = document.createElement('div');
  sentinel.setAttribute('data-pistonpry-active', '');
  sentinel.style.display = 'none';
  document.body.appendChild(sentinel);

  function isLinkVisible(link) {
    const rect = link.getBoundingClientRect();
    const style = window.getComputedStyle(link);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0;
  }

  function isElementVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0;
  }

  function createOverlay() {
    const div = document.createElement('div');
    applyImportantStyles(div, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      'background-color': 'rgba(0, 0, 0, 0.35)',
      'z-index': '2147483646',
      'pointer-events': 'none',
    });
    document.body.appendChild(div);
    return div;
  }

  function createSelectionDiv() {
    const div = document.createElement('div');
    applyImportantStyles(div, {
      position: 'fixed',
      border: `1.5px solid ${THEME.accent}`,
      'background-color': THEME.accentFill,
      'border-radius': '4px',
      'z-index': '2147483647',
      'pointer-events': 'none',
    });
    document.body.appendChild(div);
    return div;
  }

  function createCountIndicator() {
    const div = document.createElement('div');
    applyImportantStyles(div, {
      position: 'fixed',
      'background-color': THEME.accentBadge,
      'backdrop-filter': 'blur(8px)',
      '-webkit-backdrop-filter': 'blur(8px)',
      color: 'white',
      padding: '3px 10px',
      'border-radius': '100px',
      'font-size': '11px',
      'font-weight': '600',
      'font-family': 'system-ui, -apple-system, sans-serif',
      'z-index': '2147483647',
      'pointer-events': 'none',
      'box-shadow': '0 2px 8px rgba(0,0,0,0.15)',
      transition: 'transform 0.1s ease-out',
      display: 'none',
    });
    div.textContent = '0 links';
    document.body.appendChild(div);
    return div;
  }

  function highlightLink(link) {
    if (!highlightedLinks.has(link)) {
      link.style.setProperty('transition', 'all 0.1s ease-in-out', 'important');
      link.style.setProperty('background-color', THEME.highlightBg, 'important');
      link.style.setProperty('border-radius', '3px', 'important');
      link.style.setProperty('outline', THEME.highlightOutline, 'important');
      highlightedLinks.add(link);
    }
  }

  function unhighlightLink(link) {
    if (highlightedLinks.has(link)) {
      link.style.removeProperty('background-color');
      link.style.removeProperty('outline');
      link.style.removeProperty('border-radius');
      link.style.removeProperty('transition');
      highlightedLinks.delete(link);
    }
  }

  function getItemCount() {
    return accumulatedUrlSet.size + highlightedLinks.size;
  }

  function updateLinkHighlights(selectionRect) {
    const links = cachedLinks || document.querySelectorAll('a[href]');
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
        highlightLink(link);
      } else if (highlightedLinks.has(link)) {
        unhighlightLink(link);
      }
    });

    highlightedLinks.forEach(link => {
      if (!currentlySelected.has(link)) {
        unhighlightLink(link);
      }
    });

    const totalCount = accumulatedUrlSet.size + currentlySelected.size;
    updateCountIndicator(totalCount);
  }

  function updateCountIndicator(count) {
    if (!countIndicator) return;
    countIndicator.style.setProperty('display', count > 0 ? 'block' : 'none', 'important');
    countIndicator.textContent = count + (count === 1 ? ' item' : ' items');
    countIndicator.style.setProperty('transform', 'scale(1.1)', 'important');
    setTimeout(() => {
      if (countIndicator) countIndicator.style.setProperty('transform', 'scale(1)', 'important');
    }, 100);
  }

  function positionCountIndicator(x, y) {
    if (!countIndicator) return;
    countIndicator.style.setProperty('left', `${x + 10}px`, 'important');
    countIndicator.style.setProperty('top', `${y - 30}px`, 'important');
  }

  function clearAllHighlights() {
    highlightedLinks.forEach(link => unhighlightLink(link));
    highlightedLinks.clear();
  }

  // ── Extract items in a region (Feature 4 + 20) ──
  function extractItemsInRegion(selectionRect) {
    const extractTypes = pistonPryExtractTypes;
    const items = { links: [], images: [], emails: [] };
    const seenUrls = new Set();

    // Extract links
    if (extractTypes.includes('links')) {
      const links = cachedLinks || document.querySelectorAll('a[href]');
      links.forEach(link => {
        if (!isLinkVisible(link)) return;
        const linkRect = link.getBoundingClientRect();
        const overlaps = !(
          selectionRect.right < linkRect.left ||
          selectionRect.left > linkRect.right ||
          selectionRect.bottom < linkRect.top ||
          selectionRect.top > linkRect.bottom
        );
        if (overlaps && link.href) {
          if (!seenUrls.has(link.href)) {
            seenUrls.add(link.href);
            items.links.push({
              url: link.href,
              text: link.textContent.trim().substring(0, 500),
            });
          }
        }
      });
    }

    // Extract images (Feature 4)
    if (extractTypes.includes('images')) {
      const images = document.querySelectorAll('img[src]');
      images.forEach(img => {
        if (!isElementVisible(img)) return;
        const imgRect = img.getBoundingClientRect();
        const overlaps = !(
          selectionRect.right < imgRect.left ||
          selectionRect.left > imgRect.right ||
          selectionRect.bottom < imgRect.top ||
          selectionRect.top > imgRect.bottom
        );
        if (overlaps && img.src) {
          const fullUrl = new URL(img.src, window.location.href).href;
          if (!seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            items.images.push({
              url: fullUrl,
              text: img.alt || img.title || '',
            });
          }
        }
      });
    }

    // Extract emails (Feature 4)
    if (extractTypes.includes('emails')) {
      // From mailto: links
      const mailLinks = document.querySelectorAll('a[href^="mailto:"]');
      mailLinks.forEach(link => {
        if (!isLinkVisible(link)) return;
        const linkRect = link.getBoundingClientRect();
        const overlaps = !(
          selectionRect.right < linkRect.left ||
          selectionRect.left > linkRect.right ||
          selectionRect.bottom < linkRect.top ||
          selectionRect.top > linkRect.bottom
        );
        if (overlaps) {
          const email = link.href;
          if (!seenUrls.has(email)) {
            seenUrls.add(email);
            items.emails.push({
              url: email,
              text: link.textContent.trim().substring(0, 200),
            });
          }
        }
      });

      // Scan text nodes for email patterns within region
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const range = document.createRange();
        range.selectNodeContents(node);
        const nodeRect = range.getBoundingClientRect();
        if (nodeRect.width === 0 || nodeRect.height === 0) continue;
        const overlaps = !(
          selectionRect.right < nodeRect.left ||
          selectionRect.left > nodeRect.right ||
          selectionRect.bottom < nodeRect.top ||
          selectionRect.top > nodeRect.bottom
        );
        if (overlaps) {
          const matches = node.textContent.match(emailRe);
          if (matches) {
            matches.forEach(email => {
              const mailto = 'mailto:' + email;
              if (!seenUrls.has(mailto)) {
                seenUrls.add(mailto);
                items.emails.push({ url: mailto, text: email });
              }
            });
          }
        }
      }

      // Also extract tel: links
      const telLinks = document.querySelectorAll('a[href^="tel:"]');
      telLinks.forEach(link => {
        if (!isLinkVisible(link)) return;
        const linkRect = link.getBoundingClientRect();
        const overlaps = !(
          selectionRect.right < linkRect.left ||
          selectionRect.left > linkRect.right ||
          selectionRect.bottom < linkRect.top ||
          selectionRect.top > linkRect.bottom
        );
        if (overlaps) {
          const tel = link.href;
          if (!seenUrls.has(tel)) {
            seenUrls.add(tel);
            items.emails.push({
              url: tel,
              text: link.textContent.trim().substring(0, 200),
            });
          }
        }
      });
    }

    return items;
  }

  // ── Full-page extraction (Feature 1) ──
  function extractFullPage() {
    const rect = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: document.documentElement.scrollHeight,
    };

    // For full-page, we use the entire document
    const items = { links: [], images: [], emails: [] };
    const seenUrls = new Set();
    const extractTypes = pistonPryExtractTypes;

    if (extractTypes.includes('links')) {
      document.querySelectorAll('a[href]').forEach(link => {
        if (link.href && !seenUrls.has(link.href)) {
          seenUrls.add(link.href);
          items.links.push({
            url: link.href,
            text: link.textContent.trim().substring(0, 500),
          });
        }
      });
    }

    if (extractTypes.includes('images')) {
      document.querySelectorAll('img[src]').forEach(img => {
        if (img.src) {
          const fullUrl = new URL(img.src, window.location.href).href;
          if (!seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            items.images.push({
              url: fullUrl,
              text: img.alt || img.title || '',
            });
          }
        }
      });
    }

    if (extractTypes.includes('emails')) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
        if (!seenUrls.has(link.href)) {
          seenUrls.add(link.href);
          items.emails.push({ url: link.href, text: link.textContent.trim() });
        }
      });
      document.querySelectorAll('a[href^="tel:"]').forEach(link => {
        if (!seenUrls.has(link.href)) {
          seenUrls.add(link.href);
          items.emails.push({ url: link.href, text: link.textContent.trim() });
        }
      });
    }

    sendExtractedItems(items);
    sentinel.remove();
  }

  // ── Context menu extraction (Feature 2) ──
  function extractFromElement(element) {
    // Walk up to find a semantic container
    const containers = ['article', 'section', 'nav', 'main', 'aside', 'header', 'footer'];
    let container = element;
    let maxWalk = 10;
    while (container && maxWalk > 0) {
      if (containers.includes(container.tagName.toLowerCase())) break;
      // Check if this div has multiple links
      if (container.tagName === 'DIV' && container.querySelectorAll('a[href]').length >= 2) break;
      container = container.parentElement;
      maxWalk--;
    }
    if (!container) container = element;

    const rect = container.getBoundingClientRect();
    const items = extractItemsInRegion({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });
    sendExtractedItems(items);
    sentinel.remove();
  }

  // ── Send extracted items to background ──
  function sendExtractedItems(items) {
    const allItems = [
      ...items.links.map(i => ({ ...i, itemType: 'link' })),
      ...items.images.map(i => ({ ...i, itemType: 'image' })),
      ...items.emails.map(i => ({ ...i, itemType: 'email' })),
    ];

    if (chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'extractedLinks',
        links: allItems.map(i => i.url),
        items: allItems,
        extractTypes: pistonPryExtractTypes,
      });
    }
  }

  function cleanup() {
    isDrawing = false;
    clearAllHighlights();
    lastSelectionRect = null;
    if (selectionDiv) { selectionDiv.remove(); selectionDiv = null; }
    if (overlayDiv) { overlayDiv.remove(); overlayDiv = null; }
    if (countIndicator) { countIndicator.remove(); countIndicator = null; }
    if (drawHint && drawHint.parentNode) drawHint.remove();
    if (multiRegionHint && multiRegionHint.parentNode) multiRegionHint.remove();
    if (pickCountPill && pickCountPill.parentNode) pickCountPill.remove();

    // Restore pick mode styles
    pickedElements.forEach((styles, el) => {
      el.style.removeProperty('background-color');
      el.style.removeProperty('outline');
      el.style.removeProperty('border-radius');
    });
    pickedElements.clear();
    pickedLinks.clear();

    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('click', onPickClick, true);
    document.body.style.cursor = originalCursor;
    cachedLinks = null;
    accumulatedItems = [];
    accumulatedUrlSet.clear();
    regionCount = 0;
    isMultiRegionMode = false;
    isPickMode = false;
    sentinel.remove();
  }

  // ── Click-to-Pick mode (Feature 5) ──
  function enterPickMode() {
    isPickMode = true;
    document.body.style.cursor = 'pointer';
    if (drawHint && drawHint.parentNode) drawHint.remove();

    showPickHint();
    document.removeEventListener('mousedown', onMouseDown, { capture: true });
    document.addEventListener('click', onPickClick, true);
  }

  function showPickHint() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    pickCountPill = document.createElement('div');
    applyImportantStyles(pickCountPill, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 18px',
      'border-radius': '100px',
      'font-size': '13px',
      'font-weight': '600',
      'font-family': 'system-ui, -apple-system, sans-serif',
      'z-index': '2147483647',
      'pointer-events': 'none',
      background: isDark ? 'rgba(240, 236, 230, 0.95)' : 'rgba(26, 26, 26, 0.9)',
      color: isDark ? '#1a1a1a' : '#f0ece6',
      'box-shadow': '0 4px 16px rgba(0,0,0,0.18)',
      transition: 'opacity 0.15s',
    });
    pickCountPill.textContent = 'Click links to pick them. Press Enter to finish, Esc to cancel.';
    document.body.appendChild(pickCountPill);
  }

  function updatePickCount() {
    if (pickCountPill) {
      pickCountPill.textContent = pickedLinks.size + ' link(s) picked. Enter to finish, Esc to cancel.';
    }
  }

  function onPickClick(e) {
    if (!isPickMode) return;
    e.preventDefault();
    e.stopPropagation();

    // Find closest <a> element
    const link = e.target.closest('a[href]');
    if (!link || !link.href) return;

    if (pickedLinks.has(link.href)) {
      // Un-pick
      pickedLinks.delete(link.href);
      if (pickedElements.has(link)) {
        link.style.removeProperty('background-color');
        link.style.removeProperty('outline');
        link.style.removeProperty('border-radius');
        pickedElements.delete(link);
      }
    } else {
      // Pick
      pickedLinks.add(link.href);
      link.style.setProperty('background-color', THEME.pickHighlight, 'important');
      link.style.setProperty('outline', THEME.pickOutline, 'important');
      link.style.setProperty('border-radius', '3px', 'important');
      pickedElements.set(link, true);
    }
    updatePickCount();
  }

  function finalizePickMode() {
    const items = { links: [], images: [], emails: [] };
    // Get text for picked links
    const allLinks = document.querySelectorAll('a[href]');
    const pickedSet = new Set(pickedLinks);
    const seenUrls = new Set();
    allLinks.forEach(link => {
      if (pickedSet.has(link.href) && !seenUrls.has(link.href)) {
        seenUrls.add(link.href);
        if (link.href.startsWith('mailto:')) {
          items.emails.push({ url: link.href, text: link.textContent.trim() });
        } else if (link.href.startsWith('tel:')) {
          items.emails.push({ url: link.href, text: link.textContent.trim() });
        } else {
          items.links.push({ url: link.href, text: link.textContent.trim().substring(0, 500) });
        }
      }
    });
    sendExtractedItems(items);
    cleanup();
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;

    // Feature 5: Alt+click enters pick mode
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      enterPickMode();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;

    cachedLinks = document.querySelectorAll('a[href]');

    overlayDiv = createOverlay();

    if (selectionDiv) selectionDiv.remove();
    selectionDiv = createSelectionDiv();
    selectionDiv.style.setProperty('left', `${startX}px`, 'important');
    selectionDiv.style.setProperty('top', `${startY}px`, 'important');
    selectionDiv.style.setProperty('width', '0px', 'important');
    selectionDiv.style.setProperty('height', '0px', 'important');

    if (countIndicator) countIndicator.remove();
    countIndicator = createCountIndicator();
    positionCountIndicator(startX, startY);

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
  }

  function onMouseMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    e.stopPropagation();

    const currentX = e.clientX;
    const currentY = e.clientY;

    const newLeft = Math.min(currentX, startX);
    const newTop = Math.min(currentY, startY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    lastSelectionRect = { left: newLeft, top: newTop, right: newLeft + width, bottom: newTop + height };

    selectionDiv.style.setProperty('left', `${newLeft}px`, 'important');
    selectionDiv.style.setProperty('top', `${newTop}px`, 'important');
    selectionDiv.style.setProperty('width', `${width}px`, 'important');
    selectionDiv.style.setProperty('height', `${height}px`, 'important');

    positionCountIndicator(currentX, currentY);

    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        updateLinkHighlights(lastSelectionRect);
      });
    }
  }

  function onMouseUp(e) {
    if (!isDrawing) return;
    if (e.button !== 0) return;

    isDrawing = false;
    e.preventDefault();
    e.stopPropagation();

    clearAllHighlights();

    if (overlayDiv) { overlayDiv.remove(); overlayDiv = null; }
    if (countIndicator) { countIndicator.remove(); countIndicator = null; }
    if (selectionDiv) { selectionDiv.remove(); selectionDiv = null; }

    const rect = lastSelectionRect;
    lastSelectionRect = null;

    if (rect && (rect.right - rect.left) > 5 && (rect.bottom - rect.top) > 5) {
      const items = extractItemsInRegion(rect);
      regionCount++;

      // Add to accumulated items
      [...items.links, ...items.images, ...items.emails].forEach(item => {
        if (!accumulatedUrlSet.has(item.url)) {
          accumulatedUrlSet.add(item.url);
          accumulatedItems.push(item);
        }
      });

      // Feature 3: Multi-region — if Shift is held, allow more regions
      if (e.shiftKey) {
        isMultiRegionMode = true;
        showMultiRegionHint();
        // Re-enter draw mode
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('mouseup', onMouseUp, true);
        document.addEventListener('mousedown', onMouseDown, { capture: true, once: true });
        return;
      }

      // If we were in multi-region mode and not holding shift, finalize
      if (isMultiRegionMode || regionCount === 1) {
        // Build final items from accumulated
        const finalItems = { links: [], images: [], emails: [] };
        accumulatedItems.forEach(item => {
          if (item.itemType === 'image') finalItems.images.push(item);
          else if (item.itemType === 'email') finalItems.emails.push(item);
          else finalItems.links.push(item);
        });

        // If single region, use items from this region directly
        if (regionCount === 1 && !isMultiRegionMode) {
          sendExtractedItems(items);
        } else {
          sendExtractedItems(finalItems);
        }
      }
    } else {
      if (accumulatedItems.length > 0) {
        // Finalize accumulated
        const finalItems = { links: [], images: [], emails: [] };
        accumulatedItems.forEach(item => {
          if (item.itemType === 'image') finalItems.images.push(item);
          else if (item.itemType === 'email') finalItems.emails.push(item);
          else finalItems.links.push(item);
        });
        sendExtractedItems(finalItems);
      } else {
        if (chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'extractedLinks', links: [], items: [] });
        }
      }
    }

    // Full cleanup
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = originalCursor;
    cachedLinks = null;
    if (multiRegionHint && multiRegionHint.parentNode) multiRegionHint.remove();
    accumulatedItems = [];
    accumulatedUrlSet.clear();
    regionCount = 0;
    isMultiRegionMode = false;
    sentinel.remove();
  }

  function showMultiRegionHint() {
    if (multiRegionHint && multiRegionHint.parentNode) multiRegionHint.remove();
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    multiRegionHint = document.createElement('div');
    applyImportantStyles(multiRegionHint, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 18px',
      'border-radius': '100px',
      'font-size': '13px',
      'font-weight': '600',
      'font-family': 'system-ui, -apple-system, sans-serif',
      'z-index': '2147483647',
      'pointer-events': 'none',
      background: isDark ? 'rgba(240, 236, 230, 0.95)' : 'rgba(26, 26, 26, 0.9)',
      color: isDark ? '#1a1a1a' : '#f0ece6',
      'box-shadow': '0 4px 16px rgba(0,0,0,0.18)',
    });
    multiRegionHint.textContent = `Region ${regionCount} added (${accumulatedUrlSet.size} items). Hold Shift+draw for more, or draw without Shift to finish.`;
    document.body.appendChild(multiRegionHint);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
      return;
    }

    // Feature 5: Enter finalizes pick mode
    if (e.key === 'Enter' && isPickMode) {
      e.preventDefault();
      finalizePickMode();
      return;
    }

    // Feature 3: Enter finalizes multi-region
    if (e.key === 'Enter' && isMultiRegionMode && accumulatedItems.length > 0) {
      e.preventDefault();
      const finalItems = { links: [], images: [], emails: [] };
      accumulatedItems.forEach(item => {
        if (item.itemType === 'image') finalItems.images.push(item);
        else if (item.itemType === 'email') finalItems.emails.push(item);
        else finalItems.links.push(item);
      });
      sendExtractedItems(finalItems);
      cleanup();
    }
  }

  // Show instruction hint
  function showDrawHint() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const hint = document.createElement('div');
    hint.textContent = 'Drag to select | Hold Alt to click-pick | Hold Shift after draw for multi-region';
    applyImportantStyles(hint, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 18px',
      'border-radius': '100px',
      'font-size': '13px',
      'font-weight': '600',
      'font-family': 'system-ui, -apple-system, sans-serif',
      'z-index': '2147483647',
      'pointer-events': 'none',
      opacity: '0',
      transition: 'opacity 0.25s',
      background: isDark ? 'rgba(240, 236, 230, 0.95)' : 'rgba(26, 26, 26, 0.9)',
      color: isDark ? '#1a1a1a' : '#f0ece6',
      'box-shadow': '0 4px 16px rgba(0,0,0,0.18)',
    });
    document.body.appendChild(hint);
    requestAnimationFrame(() => { hint.style.setProperty('opacity', '1', 'important'); });
    const dismiss = () => {
      hint.style.setProperty('opacity', '0', 'important');
      hint.addEventListener('transitionend', () => hint.remove(), { once: true });
    };
    setTimeout(dismiss, 3000);
    document.addEventListener('mousedown', dismiss, { capture: true, once: true });
    return hint;
  }

  // ── Handle context menu extraction (Feature 2) ──
  if (pistonPryMode === 'contextMenu') {
    const x = window.__pistonpryContextX;
    const y = window.__pistonpryContextY;
    const element = document.elementFromPoint(x, y);
    if (element) {
      extractFromElement(element);
    } else {
      extractFullPage();
    }
    return;
  }

  // ── Handle fullpage mode (Feature 1) ──
  if (pistonPryMode === 'fullpage') {
    extractFullPage();
    return;
  }

  // ── Default: Draw mode ──
  document.body.style.cursor = 'crosshair';
  drawHint = showDrawHint();
  document.addEventListener('mousedown', onMouseDown, { capture: true, once: true });
  document.addEventListener('keydown', onKeyDown, { capture: true });
})();
