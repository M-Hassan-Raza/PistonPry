export function setupContextMenu() {
  chrome.contextMenus.create({
    id: 'extract-section',
    title: 'Extract links from this section',
    contexts: ['all'],
  });
}

export async function handleContextMenuClick(info, tab) {
  if (info.menuItemId !== 'extract-section') return;
  if (!tab?.id || !tab.url?.startsWith('http')) return;

  try {
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
}
