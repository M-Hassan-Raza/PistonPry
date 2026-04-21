import { classifyLink, classifyImage } from '../shared/classify.js';
import { createCurrentExtractionRecord } from '../shared/extractedItems.js';
import { showPageNotification } from './notification.js';
import { saveExtractionHistory } from './history.js';

export async function handleExtractedLinks(request, sender, sendResponse) {
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
    processedLinks = items.map(item => {
      if (item.itemType === 'image') {
        return classifyImage(item.url, tabHostname, item.text);
      }
      return classifyLink(item.url, tabHostname, item.text);
    });
  } else {
    processedLinks = request.links.map(url => classifyLink(url, tabHostname, ''));
  }

  const sourceUrl = sender.tab?.url || '';
  const sourceTitle = sender.tab?.title || '';

  await chrome.storage.session.set({
    currentExtraction: createCurrentExtractionRecord({
      items: processedLinks,
      sourceUrl,
      sourceTitle,
    }),
  });

  chrome.tabs.create({ url: chrome.runtime.getURL('results.html') });

  saveExtractionHistory(processedLinks, sourceUrl, sourceTitle);

  sendResponse({ status: 'Links processed' });
}
