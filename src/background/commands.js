import { showPageNotification } from './notification.js';

export async function handleActionClick(tab) {
  if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    try {
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
}

export async function handleExtractAllCommand() {
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
}
