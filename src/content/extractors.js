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

export function extractItemsInRegion(selectionRect, extractTypes, cachedLinks) {
  const items = { links: [], images: [], emails: [] };
  const seenUrls = new Set();

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

  if (extractTypes.includes('emails')) {
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

export function extractFullPage(extractTypes) {
  const items = { links: [], images: [], emails: [] };
  const seenUrls = new Set();

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

  return items;
}

export function extractFromElement(element, extractTypes) {
  const containers = ['article', 'section', 'nav', 'main', 'aside', 'header', 'footer'];
  let container = element;
  let maxWalk = 10;
  while (container && maxWalk > 0) {
    if (containers.includes(container.tagName.toLowerCase())) break;
    if (container.tagName === 'DIV' && container.querySelectorAll('a[href]').length >= 2) break;
    container = container.parentElement;
    maxWalk--;
  }
  if (!container) container = element;

  const rect = container.getBoundingClientRect();
  return extractItemsInRegion({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  }, extractTypes, null);
}
