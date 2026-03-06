export function sendExtractedItems(items, extractTypes) {
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
      extractTypes,
    });
  }
}
