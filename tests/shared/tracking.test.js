import { describe, expect, it } from 'vitest';

import { stripTracking } from '../../src/shared/tracking.js';

describe('stripTracking', () => {
  it('removes known tracking parameters and preserves the rest', () => {
    expect(stripTracking('https://example.com/page?utm_source=newsletter&id=42&fbclid=abc123')).toEqual({
      cleaned: 'https://example.com/page?id=42',
      removedCount: 2,
    });
  });

  it('leaves invalid URLs untouched', () => {
    expect(stripTracking('not-a-url')).toEqual({
      cleaned: 'not-a-url',
      removedCount: 0,
    });
  });
});
