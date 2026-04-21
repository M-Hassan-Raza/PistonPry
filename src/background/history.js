import { createHistoryRecord } from '../shared/extractedItems.js';

export async function saveExtractionHistory(processedLinks, sourceUrl, sourceTitle) {
  const result = await chrome.storage.local.get('extractionHistory');
  const history = result.extractionHistory || [];

  history.unshift(createHistoryRecord({
    items: processedLinks,
    sourceUrl,
    sourceTitle,
  }));

  if (history.length > 20) history.length = 20;
  await chrome.storage.local.set({ extractionHistory: history });
}
