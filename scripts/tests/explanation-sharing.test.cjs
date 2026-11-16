const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadEdge } = require('./load-edge.cjs');
const { buildSynthesisExplanation: explain } = loadEdge('apps/web/src/lib/explanationContext.js');
const { buildReadingSharePages: pages, plainShareText } = loadEdge('apps/web/src/lib/readingShare.js');

test('daily and monthly collective explanations cannot include personal or hidden guidance', () => {
  const reading = { overview: 'PERSONAL overview', personal_focus: 'PERSONAL focus', personal_reading: ['PERSONAL transit'],
    collective_reading: ['HIDDEN collective bullet'], collective_highlight: 'VISIBLE daily collective',
    collective_theme: 'VISIBLE monthly collective', collective_tags: ['collective tag'], dynamics_insight: 'PAID dynamics', maximize: ['PAID maximize'], focus: 'PAID focus', watch: ['PAID watch'] };
  assert.equal(explain(reading, { tab: 'collective' }), 'VISIBLE daily collective');
  assert.equal(explain(reading, { tab: 'collective', period: 'month' }), 'collective tag\nVISIBLE monthly collective');
  assert.equal(explain(reading, { isPaid: false }), 'PERSONAL overview');
  assert.doesNotMatch(explain(reading, {}), /collective/);
  assert.equal(explain({ overview: 'personal only' }, { tab: 'collective' }), '');
});

test('reading cards preserve every word of long content with independent page labels and full copy text', () => {
  const text = Array.from({ length: 230 }, (_, i) => `placement-${i}`).join(' ');
  const cards = pages({ title: 'My Saturn', text, audienceLabel: 'MY CHART' });
  assert.ok(cards.length > 1);
  assert.equal(cards.map(card => card.body).join(' '), text);
  for (const [i, card] of cards.entries()) {
    assert.equal(card.format, 'story');
    assert.ok(card.body.length <= 600);
    assert.equal(card.audienceLabel, 'MY CHART');
    assert.equal(card.dateStr, `Card ${i + 1} of ${cards.length}`);
    assert.ok(card.textFallback.includes(text));
  }
  assert.equal(pages({ title: 'No reading', text: '' }).length, 0);
});

test('share text keeps lesson and interpretation copy readable without Markdown or image URLs', () => {
  assert.equal(plainShareText('## **Saturn**\n[Structure](https://example.com) ![photo](https://private.example/image.png)'), 'Saturn\nStructure');
  assert.equal(pages({ title: 'Lesson', text: '**Learning** is practice.' })[0].body, 'Learning is practice.');
});
