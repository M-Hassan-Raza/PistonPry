export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    if (['http:', 'https:', 'ftp:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch (_) { /* invalid URL */ }
  return '';
}
