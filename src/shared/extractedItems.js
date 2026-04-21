import { classifyImage, classifyLink } from './classify.js';

const CURRENT_EXTRACTION_VERSION = 2;

function getString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function getSourceHostname(sourceUrl = '') {
  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return '';
  }
}

function getNormalizedItemKind(item) {
  if (item?.itemType === 'image') {
    return 'image';
  }
  return 'link';
}

export function normalizeExtractedItem(rawItem, sourceUrl = '') {
  if (typeof rawItem === 'string') {
    return classifyLink(rawItem, getSourceHostname(sourceUrl), '');
  }

  if (!rawItem || typeof rawItem !== 'object') {
    return null;
  }

  const url = getString(rawItem.url).trim();
  if (!url) {
    return null;
  }

  const text = getString(rawItem.text).trim();
  if (getNormalizedItemKind(rawItem) === 'image') {
    return classifyImage(url, getSourceHostname(sourceUrl), text);
  }

  return classifyLink(url, getSourceHostname(sourceUrl), text);
}

export function normalizeExtractedItems(rawItems, sourceUrl = '') {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .map((item) => normalizeExtractedItem(item, sourceUrl))
    .filter(Boolean);
}

export function normalizeCurrentExtractionRecord(record) {
  const sourceUrl = getString(record?.sourceUrl);
  const normalized = {
    version: CURRENT_EXTRACTION_VERSION,
    sourceUrl,
    sourceTitle: getString(record?.sourceTitle),
    items: normalizeExtractedItems(record?.items ?? record?.links, sourceUrl),
  };

  const changed = record?.version !== CURRENT_EXTRACTION_VERSION ||
    !Array.isArray(record?.items) ||
    Array.isArray(record?.links);

  return { record: normalized, changed };
}

export function createCurrentExtractionRecord({ items, sourceUrl = '', sourceTitle = '' }) {
  return normalizeCurrentExtractionRecord({
    version: CURRENT_EXTRACTION_VERSION,
    sourceUrl,
    sourceTitle,
    items,
  }).record;
}

export function normalizeCollectionRecord(record) {
  const sourceUrl = getString(record?.sourceUrl);
  const items = normalizeExtractedItems(record?.items ?? record?.links, sourceUrl);
  const normalized = {
    version: CURRENT_EXTRACTION_VERSION,
    id: String(record?.id ?? Date.now()),
    name: getString(record?.name, 'Untitled collection') || 'Untitled collection',
    items,
    sourceUrl,
    timestamp: getString(record?.timestamp, new Date().toISOString()),
    count: items.length,
    tags: Array.isArray(record?.tags)
      ? record.tags.map((tag) => getString(tag).trim()).filter(Boolean)
      : [],
  };

  const changed = record?.version !== CURRENT_EXTRACTION_VERSION ||
    !Array.isArray(record?.items) ||
    Array.isArray(record?.links) ||
    record?.count !== normalized.count;

  return { record: normalized, changed };
}

export function createCollectionRecord({ id, name, items, sourceUrl = '', tags = [] }) {
  return normalizeCollectionRecord({
    version: CURRENT_EXTRACTION_VERSION,
    id: id ?? Date.now().toString(),
    name,
    items,
    sourceUrl,
    timestamp: new Date().toISOString(),
    tags,
  }).record;
}

export function normalizeHistoryRecord(record) {
  const sourceUrl = getString(record?.sourceUrl);
  const items = normalizeExtractedItems(record?.items ?? record?.allLinks ?? record?.links, sourceUrl);
  const normalized = {
    version: CURRENT_EXTRACTION_VERSION,
    id: String(record?.id ?? Date.now()),
    timestamp: getString(record?.timestamp, new Date().toISOString()),
    sourceUrl,
    sourceTitle: getString(record?.sourceTitle, getSourceHostname(sourceUrl)),
    count: items.length,
    items,
  };

  const changed = record?.version !== CURRENT_EXTRACTION_VERSION ||
    !Array.isArray(record?.items) ||
    Array.isArray(record?.allLinks) ||
    Array.isArray(record?.links) ||
    record?.count !== normalized.count;

  return { record: normalized, changed };
}

export function createHistoryRecord({ id, items, sourceUrl = '', sourceTitle = '' }) {
  return normalizeHistoryRecord({
    version: CURRENT_EXTRACTION_VERSION,
    id: id ?? Date.now().toString(),
    items,
    sourceUrl,
    sourceTitle,
    timestamp: new Date().toISOString(),
  }).record;
}
