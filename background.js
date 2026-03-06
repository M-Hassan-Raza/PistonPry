// ── PistonPry service worker ──

importScripts('utils.js');

// ── Context Menu (Feature 2) ──
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'extract-section',
    title: 'Extract links from this section',
    contexts: ['all'],
  });
});

// ── Context menu click handler ──
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'extract-section') return;
  if (!tab?.id || !tab.url?.startsWith('http')) return;

  try {
    // Set the context position, then inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (x, y) => {
        window.__pistonpryMode = 'contextMenu';
        window.__pistonpryContextX = x;
        window.__pistonpryContextY = y;
        window.__pistonpryExtractTypes = ['links', 'images', 'emails'];
      },
      args: [info.x || 0, info.y || 0],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch (err) {
    console.error('Context menu extraction failed:', err);
  }
});

// ── Inject content script on action click (draw mode) ──
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    try {
      // Clear any previous mode flags
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          window.__pistonpryMode = 'draw';
          window.__pistonpryExtractTypes = ['links', 'images', 'emails'];
        },
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
    } catch (err) {
      console.error('Failed to inject content script:', err);
    }
  } else {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showPageNotification,
        args: ['PistonPry cannot run on this page. Try a regular website.'],
      });
    } catch (err) {
      console.error('Cannot notify on this page:', err);
    }
  }
});

// ── Keyboard command: full-page extract (Feature 1) ──
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'extract_all') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('http')) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.__pistonpryMode = 'fullpage';
        window.__pistonpryExtractTypes = ['links', 'images', 'emails'];
      },
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch (err) {
    console.error('Full-page extraction failed:', err);
  }
});

// ── Process extracted links ──
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractedLinks') {
    handleExtractedLinks(request, sender, sendResponse);
    return true;
  }

  if (request.action === 'checkLinks') {
    handleCheckLinks(request, sender, sendResponse);
    return true;
  }
});

async function handleExtractedLinks(request, sender, sendResponse) {
  const items = request.items || [];

  if (items.length === 0 && (!request.links || request.links.length === 0)) {
    if (sender.tab?.id) {
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        func: showPageNotification,
        args: ['No items found in the selected region'],
      }).catch(() => {});
    }
    sendResponse({ status: 'No links' });
    return;
  }

  const tabHostname = sender.tab?.url ? (() => {
    try { return new URL(sender.tab.url).hostname; } catch { return ''; }
  })() : '';

  let processedLinks;

  if (items.length > 0) {
    // New format with items (text, itemType)
    processedLinks = items.map(item => {
      if (item.itemType === 'image') {
        return classifyImage(item.url, tabHostname, item.text);
      }
      return classifyLink(item.url, tabHostname, item.text);
    });
  } else {
    // Legacy format: just URLs
    processedLinks = request.links.map(url => classifyLink(url, tabHostname, ''));
  }

  const sourceUrl = sender.tab?.url || '';
  const sourceTitle = sender.tab?.title || '';

  await chrome.storage.session.set({
    currentExtraction: {
      links: processedLinks,
      sourceUrl,
      sourceTitle,
    },
  });

  chrome.tabs.create({ url: chrome.runtime.getURL('results.html') });

  // Save to extraction history (with richer data)
  saveExtractionHistory(processedLinks, sourceUrl, sourceTitle);

  sendResponse({ status: 'Links processed' });
}

// ── Link Health Checker (Feature 9) ──
async function handleCheckLinks(request, sender, sendResponse) {
  const urls = request.urls || [];
  const results = {};
  const concurrency = 5;
  let idx = 0;

  async function checkOne(url) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      const status = response.status;
      let health = 'unknown';
      if (status >= 200 && status < 300) health = 'alive';
      else if (status >= 300 && status < 400) health = 'redirect';
      else if (status >= 400) health = 'broken';
      results[url] = { status, health };
    } catch (err) {
      // Try GET as fallback (some servers don't support HEAD)
      try {
        const response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });
        const status = response.status;
        let health = 'unknown';
        if (status >= 200 && status < 300) health = 'alive';
        else if (status >= 300 && status < 400) health = 'redirect';
        else if (status >= 400) health = 'broken';
        results[url] = { status, health };
      } catch {
        results[url] = { status: 0, health: 'error' };
      }
    }
  }

  async function worker() {
    while (idx < urls.length) {
      const currentIdx = idx++;
      await checkOne(urls[currentIdx]);
    }
  }

  // Run with concurrency limit
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, urls.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  sendResponse({ results });
}

// ── Extraction history ──
async function saveExtractionHistory(processedLinks, sourceUrl, sourceTitle) {
  const result = await chrome.storage.local.get('extractionHistory');
  const history = result.extractionHistory || [];

  let hostname = '';
  try { hostname = new URL(sourceUrl).hostname; } catch { /* ignore */ }

  history.unshift({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    sourceUrl,
    sourceTitle: sourceTitle || hostname,
    count: processedLinks.length,
    links: processedLinks.slice(0, 5),
    allLinks: processedLinks,
  });

  if (history.length > 20) history.length = 20;
  await chrome.storage.local.set({ extractionHistory: history });
}

// ── Injected notification (runs in page context) ──
function showPageNotification(message) {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const div = document.createElement('div');
  div.textContent = message;
  Object.assign(div.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 20px',
    borderRadius: '100px',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    zIndex: '2147483647',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.25s',
    background: isDark ? '#f0ece6' : '#1a1a1a',
    color: isDark ? '#1a1a1a' : '#f0ece6',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
  });
  document.body.appendChild(div);
  requestAnimationFrame(() => { div.style.opacity = '1'; });
  setTimeout(() => {
    div.style.opacity = '0';
    div.addEventListener('transitionend', () => div.remove(), { once: true });
  }, 2500);
}
