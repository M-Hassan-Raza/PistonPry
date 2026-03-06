export function classifyLink(url, tabHostname, text) {
  let domain = '';
  let isExternal = false;
  let itemType = 'link';
  let subType = 'webpage';

  if (url.startsWith('mailto:')) {
    return { url, domain: '', isExternal: false, type: 'email', itemType: 'email', text: text || '' };
  }
  if (url.startsWith('tel:')) {
    return { url, domain: '', isExternal: false, type: 'phone', itemType: 'phone', text: text || '' };
  }

  try {
    const parsed = new URL(url);
    domain = parsed.hostname;
    if (tabHostname) {
      isExternal = parsed.hostname !== tabHostname;
    }
  } catch (_) { /* invalid URL */ }

  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|bmp|svg|webp|ico|avif)(\?.*)?$/.test(lower)) {
    subType = 'image';
  } else if (/\.(pdf)(\?.*)?$/.test(lower)) {
    subType = 'pdf';
  } else if (/\.(doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/.test(lower)) {
    subType = 'document';
  } else if (/\.(mp4|webm|ogg|mov|avi)(\?.*)?$/.test(lower)) {
    subType = 'video';
  } else if (/\.(mp3|wav|flac)(\?.*)?$/.test(lower)) {
    subType = 'audio';
  } else if (lower.includes('youtube.com/watch') || lower.includes('youtu.be/')) {
    subType = 'youtube';
  } else if (/\.(zip|rar|7z|tar|gz)(\?.*)?$/.test(lower)) {
    subType = 'archive';
  }

  return { url, domain, isExternal, type: subType, itemType, text: text || '' };
}

export function classifyImage(url, tabHostname, altText) {
  let domain = '';
  let isExternal = false;
  try {
    const parsed = new URL(url);
    domain = parsed.hostname;
    if (tabHostname) {
      isExternal = parsed.hostname !== tabHostname;
    }
  } catch (_) { /* invalid URL */ }

  return { url, domain, isExternal, type: 'image', itemType: 'image', text: altText || '' };
}
