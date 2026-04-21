import { describe, expect, it } from 'vitest';

import {
  normalizeCollectionRecord,
  normalizeCurrentExtractionRecord,
  normalizeExtractedItems,
  normalizeHistoryRecord,
} from '../../src/shared/extractedItems.js';

describe('normalizeExtractedItems', () => {
  it('upgrades stale contact records into the canonical contact bucket', () => {
    const items = normalizeExtractedItems([
      { url: 'mailto:test@example.com', itemType: 'email', type: 'email', text: 'Email' },
      { url: 'tel:+15551212', itemType: 'phone', type: 'phone', text: 'Call' },
    ], 'https://app.example.com');

    expect(items).toEqual([
      expect.objectContaining({ itemType: 'contact', type: 'email', text: 'Email' }),
      expect.objectContaining({ itemType: 'contact', type: 'phone', text: 'Call' }),
    ]);
  });
});

describe('normalizeCurrentExtractionRecord', () => {
  it('migrates legacy link arrays into canonical item records', () => {
    const { changed, record } = normalizeCurrentExtractionRecord({
      links: ['https://example.com/docs', 'mailto:test@example.com'],
      sourceUrl: 'https://app.example.com/dashboard',
      sourceTitle: 'Dashboard',
    });

    expect(changed).toBe(true);
    expect(record).toMatchObject({
      version: 2,
      sourceUrl: 'https://app.example.com/dashboard',
      sourceTitle: 'Dashboard',
    });
    expect(record.items).toEqual([
      expect.objectContaining({ url: 'https://example.com/docs', itemType: 'link' }),
      expect.objectContaining({ url: 'mailto:test@example.com', itemType: 'contact', type: 'email' }),
    ]);
  });
});

describe('normalizeCollectionRecord', () => {
  it('rebuilds canonical collections from legacy url-only entries', () => {
    const { changed, record } = normalizeCollectionRecord({
      id: 42,
      name: 'Saved picks',
      links: ['https://example.com/photo.jpg', 'tel:+15551212'],
      sourceUrl: 'https://app.example.com/results',
      count: 99,
      tags: ['alpha', ' beta '],
    });

    expect(changed).toBe(true);
    expect(record).toMatchObject({
      id: '42',
      name: 'Saved picks',
      count: 2,
      tags: ['alpha', 'beta'],
    });
    expect(record.items).toEqual([
      expect.objectContaining({ itemType: 'link', type: 'image' }),
      expect.objectContaining({ itemType: 'contact', type: 'phone' }),
    ]);
  });
});

describe('normalizeHistoryRecord', () => {
  it('collapses duplicated legacy history payloads into a single item list', () => {
    const { changed, record } = normalizeHistoryRecord({
      id: 'history-1',
      sourceUrl: 'https://app.example.com/results',
      allLinks: [
        { url: 'https://example.com/file.pdf', itemType: 'link', type: 'pdf', text: 'File' },
        { url: 'mailto:test@example.com', itemType: 'email', type: 'email', text: 'Email' },
      ],
      links: ['https://example.com/file.pdf'],
      count: 10,
    });

    expect(changed).toBe(true);
    expect(record.count).toBe(2);
    expect(record.items).toEqual([
      expect.objectContaining({ type: 'pdf', itemType: 'link' }),
      expect.objectContaining({ type: 'email', itemType: 'contact' }),
    ]);
  });
});
