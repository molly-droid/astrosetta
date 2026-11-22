const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadEdge } = require('./load-edge.cjs');
const helpers = loadEdge('apps/web/src/lib/shareReading.js');
const cards = loadEdge('apps/web/src/lib/shareCard.js', { mocks: {
  '@/lib/shareReading': helpers, html2canvas: () => {},
  '@/lib/chartUtils': { PLANET_GLYPHS: {}, SIGN_GLYPHS: {} },
  '@/lib/eclipseUtils': { ECLIPSE_META: {} },
  '@/lib/houseUtils': { HOUSE_NAMES: { 2: '2nd house', 3: '3rd house' } },
  '@/lib/platform': { isNativePlatform: () => false },
} });
const rising = { raw_data: { ascendant_sign: 'Taurus', sun_sign: 'Leo' } };
const unknown = { raw_data: { unknown_time: true, ascendant_sign: 'Aries', sun_sign: 'Leo' } };

test('all event variants label the actual personal sign and keep collective cards intact', () => {
  const examples = [
    [cards.buildIngressCardData({planet:'Venus',to_sign:'Leo'}, 'Nov 22'), cards.buildPersonalIngressCardData({planet:'Venus',to_sign:'Leo'}, 'Nov 22', 2), 'Venus in Leo'],
    [cards.buildStationCardData({planet:'Mercury',type:'retrograde',sign:'Scorpio',degree:12}, 'Nov 22'), cards.buildPersonalStationCardData({planet:'Mercury',type:'retrograde',sign:'Scorpio',degree:12}, 'Nov 22', 2), 'Mercury retrograde in Scorpio'],
    [cards.buildLunationCardData({phase:'Full Moon',moonSign:'Taurus'}, 'Nov 22'), cards.buildPersonalLunationCardData({phase:'Full Moon',moonSign:'Taurus'}, 'Nov 22', 2), 'Full Moon in Taurus'],
    [cards.buildSkyAspectCardData({planet1:'Venus',planet2:'Jupiter',aspect:'trine'}, 'Nov 22'), cards.buildMySkyAspectCardData({planet1:'Venus',planet2:'Jupiter',aspect:'trine'}, 'Nov 22', 2, 3), 'Venus trine Jupiter'],
  ];
  for (const [everyone, mine, subject] of examples) {
    const variants = cards.shareVariants(everyone, mine, { chart: rising });
    assert.equal(variants[0].card.title, everyone.title);
    assert.equal(variants[1].card.title, `What ${subject} means for Taurus Rising`);
    assert.equal(variants[1].card.textFallback.split('\n')[0], variants[1].card.title);
    assert.equal(variants[1].card.body, mine.body);
    assert.equal(variants[1].card.personalReadingTitle, true);
  }
});

test('daily and weekly headings override cached AI wording and correctly label Sun or Rising', () => {
  const content = { headline: 'Old inaccurate Rising headline', summary: 'The reading stays the same.', bullets: ['Keep this full text.'] };
  for (const basis of ['sun', 'rising']) for (const period of ['day', 'week']) {
    const card = cards.buildRisingSignCardData('Taurus', content, 'Nov 22', {basis,period});
    const subject = period === 'week' ? "this week's sky" : "today's sky";
    assert.equal(card.title, `What ${subject} means for Taurus ${basis === 'sun' ? 'Sun' : 'Rising'}`);
    assert.equal(card.textFallback.split('\n')[0], card.title);
    assert.equal(card.body, content.summary);
  }
});

test('formations and period cards use Sun fallback without changing house availability', () => {
  const collective = cards.buildFormationCardData({type:'Grand Trine',planets:['Venus','Jupiter','Saturn']}, 'Nov 22');
  const mine = cards.buildFormationCardData({type:'Grand Trine',planets:['Venus','Jupiter','Saturn']}, 'Nov 22', 'My existing reading.');
  const variants = cards.shareVariants(collective, mine, {chart:unknown,subject:'Grand Trine'});
  assert.equal(variants[1].card.title, 'What Grand Trine means for Leo Sun');
  const period = cards.buildKeyDatesCardData({title:'My week',dates:[{date:'Nov 22',text:'A lunar event'}],audience:'mine'});
  assert.equal(helpers.personalizeShareCard(period,rising,"this week's sky").title, "What this week's sky means for Taurus Rising");
  assert.equal(cards.shareVariants(collective, null, {chart:unknown}).length, 1);
  assert.equal(helpers.personalizeShareCard(mine, {}, 'Grand Trine'), mine);
  assert.equal(helpers.formatPersonalReadingTitle('Full Moon', helpers.resolveShareSign(unknown)), 'What Full Moon means for Leo Sun');
});
