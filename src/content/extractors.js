import { extractEmails } from '../shared/patterns.js';

function overlapsSelection(selectionRect, rect) {
  if (!selectionRect) {
    return true;
  }

  return !(
    selectionRect.right < rect.left ||
    selectionRect.left > rect.right ||
    selectionRect.bottom < rect.top ||
    selectionRect.top > rect.bottom
  );
}

function createItemBuckets() {
  return { links: [], images: [], contacts: [] };
}

function pushItem(items, seenUrls, bucket, url, text) {
  if (!url || seenUrls.has(url)) {
    return;
  }

  seenUrls.add(url);
  items[bucket].push({ url, text });
}

export function isLinkVisible(link) {
  const rect = link.getBoundingClientRect();
  const style = window.getComputedStyle(link);
  return style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0;
}

export function isElementVisible(el) {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0;
}

function extractVisibleLinks(items, seenUrls, selectionRect, cachedLinks) {
  const links = cachedLinks || document.querySelectorAll('a[href]');

  links.forEach((link) => {
    if (!isLinkVisible(link)) {
      return;
    }

    if (!overlapsSelection(selectionRect, link.getBoundingClientRect())) {
      return;
    }

    pushItem(items, seenUrls, 'links', link.href, link.textContent.trim().substring(0, 500));
  });
}

function extractVisibleImages(items, seenUrls, selectionRect) {
  document.querySelectorAll('img[src]').forEach((img) => {
    if (!isElementVisible(img)) {
      return;
    }

    if (!overlapsSelection(selectionRect, img.getBoundingClientRect())) {
      return;
    }

    pushItem(
      items,
      seenUrls,
      'images',
      new URL(img.src, window.location.href).href,
      img.alt || img.title || ''
    );
  });
}

function extractVisibleContactLinks(items, seenUrls, selectionRect) {
  document.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]').forEach((link) => {
    if (!isLinkVisible(link)) {
      return;
    }

    if (!overlapsSelection(selectionRect, link.getBoundingClientRect())) {
      return;
    }

    pushItem(items, seenUrls, 'contacts', link.href, link.textContent.trim().substring(0, 200));
  });
}

function extractTextEmailContacts(items, seenUrls, selectionRect) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const content = node.textContent?.trim();
    if (!content) {
      continue;
    }

    if (selectionRect) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || !overlapsSelection(selectionRect, rect)) {
        continue;
      }
    }

    extractEmails(content).forEach((email) => {
      pushItem(items, seenUrls, 'contacts', `mailto:${email}`, email);
    });
  }
}

function extractContacts(items, seenUrls, selectionRect) {
  extractVisibleContactLinks(items, seenUrls, selectionRect);
  extractTextEmailContacts(items, seenUrls, selectionRect);
}

export function extractItemsInRegion(selectionRect, extractTypes, cachedLinks) {
  const items = createItemBuckets();
  const seenUrls = new Set();

  if (extractTypes.includes('links')) {
    extractVisibleLinks(items, seenUrls, selectionRect, cachedLinks);
  }

  if (extractTypes.includes('images')) {
    extractVisibleImages(items, seenUrls, selectionRect);
  }

  if (extractTypes.includes('contacts')) {
    extractContacts(items, seenUrls, selectionRect);
  }

  return items;
}

export function extractFullPage(extractTypes) {
  return extractItemsInRegion(null, extractTypes, null);
}

export function extractFromElement(element, extractTypes) {
  const containers = ['article', 'section', 'nav', 'main', 'aside', 'header', 'footer'];
  let container = element;
  let maxWalk = 10;

  while (container && maxWalk > 0) {
    if (containers.includes(container.tagName.toLowerCase())) {
      break;
    }

    if (container.tagName === 'DIV' && container.querySelectorAll('a[href]').length >= 2) {
      break;
    }

    container = container.parentElement;
    maxWalk--;
  }

  if (!container) {
    container = element;
  }

  const rect = container.getBoundingClientRect();
  return extractItemsInRegion({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  }, extractTypes, null);
}
