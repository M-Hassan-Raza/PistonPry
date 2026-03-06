// ── PistonPry shared utilities ──

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    if (['http:', 'https:', 'ftp:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch (_) { /* invalid URL */ }
  return '';
}

function classifyLink(url, tabHostname, text) {
  let domain = '';
  let isExternal = false;
  let itemType = 'link';
  let subType = 'webpage';

  // Determine item type based on URL protocol
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

function classifyImage(url, tabHostname, altText) {
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

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateRelative(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return formatDate(isoString);
}

// Tracking parameter patterns to strip
const TRACKING_PARAMS = [
  /^utm_/i, /^fbclid$/i, /^gclid$/i, /^gclsrc$/i, /^dclid$/i,
  /^mc_/i, /^_ga$/i, /^_gl$/i, /^_hsenc$/i, /^_hsmi$/i,
  /^mkt_tok$/i, /^oly_/i, /^vero_/i, /^wickedid$/i,
  /^yclid$/i, /^msclkid$/i, /^igshid$/i, /^twclid$/i,
  /^s_cid$/i, /^ef_id$/i, /^srsltid$/i,
];

function stripTracking(url) {
  try {
    const parsed = new URL(url);
    const toDelete = [];
    for (const [key] of parsed.searchParams) {
      if (TRACKING_PARAMS.some(re => re.test(key))) {
        toDelete.push(key);
      }
    }
    toDelete.forEach(k => parsed.searchParams.delete(k));
    return { cleaned: parsed.href, removedCount: toDelete.length };
  } catch (_) {
    return { cleaned: url, removedCount: 0 };
  }
}

// Convert a glob pattern to a regex
function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(escaped, 'i');
}

// Extract email addresses from text
function extractEmails(text) {
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  return [...new Set(text.match(re) || [])];
}
