export const TRACKING_PARAMS = [
  /^utm_/i, /^fbclid$/i, /^gclid$/i, /^gclsrc$/i, /^dclid$/i,
  /^mc_/i, /^_ga$/i, /^_gl$/i, /^_hsenc$/i, /^_hsmi$/i,
  /^mkt_tok$/i, /^oly_/i, /^vero_/i, /^wickedid$/i,
  /^yclid$/i, /^msclkid$/i, /^igshid$/i, /^twclid$/i,
  /^s_cid$/i, /^ef_id$/i, /^srsltid$/i,
];

export function stripTracking(url) {
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
