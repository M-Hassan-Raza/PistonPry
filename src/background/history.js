export async function saveExtractionHistory(processedLinks, sourceUrl, sourceTitle) {
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
