import { describe, expect, it } from 'vitest';

import { classifyImage, classifyLink } from '../../src/shared/classify.js';

describe('classifyLink', () => {
  it('maps mailto and tel URLs into the contact bucket', () => {
    expect(classifyLink('mailto:test@example.com', 'example.com', 'Email us')).toMatchObject({
      itemType: 'contact',
      type: 'email',
      text: 'Email us',
    });

    expect(classifyLink('tel:+15551212', 'example.com', 'Call us')).toMatchObject({
      itemType: 'contact',
      type: 'phone',
      text: 'Call us',
    });
  });

  it('classifies file-like URLs and external hosts', () => {
    expect(classifyLink('https://cdn.example.org/report.pdf', 'app.example.com', 'Quarterly report')).toMatchObject({
      domain: 'cdn.example.org',
      isExternal: true,
      itemType: 'link',
      type: 'pdf',
      text: 'Quarterly report',
    });
  });
});

describe('classifyImage', () => {
  it('preserves image items as images', () => {
    expect(classifyImage('https://images.example.com/hero.png', 'app.example.com', 'Hero image')).toMatchObject({
      domain: 'images.example.com',
      isExternal: true,
      itemType: 'image',
      type: 'image',
      text: 'Hero image',
    });
  });
});
