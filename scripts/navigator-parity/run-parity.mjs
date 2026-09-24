/**
 * Navigator parity test harness — see docs/NAVIGATOR_PARITY_TEST.md.
 *
 * Drives the REAL navigator-chat pipeline on the local stack: signs up a
 * throwaway user, computes the fixed test chart + today's transits via
 * chart-calculator, builds the same [CHART CONTEXT] block FloatingNavigator
 * injects, asks the 30 protocol questions, and writes a scoring-ready
 * markdown transcript (plus raw JSON) to scripts/navigator-parity/results/.
 *
 * Prereqs: supabase start + db reset + functions serve --env-file (same as
 * scripts/llm-task-smoke.mjs). Provider selection happens server-side in
 * navigator-chat's generateReply() — run once now for the Claude baseline,
 * re-run after the Astrology-API.io provider is implemented for the
 * candidate transcript. Label via PROVIDER_LABEL env (default "claude").
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const PROVIDER_LABEL = process.env.PROVIDER_LABEL || 'claude';

// Fixed synthetic test person (docs/NAVIGATOR_PARITY_TEST.md).
// birth_time MUST be HH:MM:SS — the ported chart-calculator NaNs the whole
// chart on HH:MM (the app appends ':00' before calling; we match it).
const TEST_BIRTH = {
  birth_date: '1992-03-15',
  birth_time: '14:32:00',
  birth_location: { city: 'Denver', state: 'Colorado', country: 'USA', latitude: 39.7392, longitude: -104.9903, timezone: 'America/Denver' },
  utc_offset: -7,
};

const QUESTIONS = [
  // A. Natal placements — direct reads
  { id: 1, cat: 'A', q: "What's my big three?" },
  { id: 2, cat: 'A', q: 'What sign and house is my Moon in, and what does that placement mean for me?' },
  { id: 3, cat: 'A', q: 'What does my Venus placement say about how I love?' },
  { id: 4, cat: 'A', q: 'Which house is my Mars in and what does that mean for my energy and drive?' },
  { id: 5, cat: 'A', q: 'Do I have any planets in my 10th house? What does that mean for my career?' },
  { id: 6, cat: 'A', q: "What's my chart ruler and what does it say about my life direction?" },
  { id: 7, cat: 'A', q: 'What are the tightest aspects in my chart, and which one matters most?' },
  { id: 8, cat: 'A', q: 'Is anything in my chart retrograde? What does that mean?' },
  // B. Psychological patterns
  { id: 9, cat: 'B', q: 'Why am I so sensitive to what other people think of me?' },
  { id: 10, cat: 'B', q: 'Why do I keep procrastinating on things I actually care about?' },
  { id: 11, cat: 'B', q: 'What placement explains my fear of being ordinary?' },
  { id: 12, cat: 'B', q: 'Why do I attract emotionally unavailable people?' },
  { id: 13, cat: 'B', q: "What's my biggest blind spot, according to my chart?" },
  { id: 14, cat: 'B', q: 'What part of my chart is my hidden advantage?' },
  // C. Transits & planning
  { id: 15, cat: 'C', q: "What do today's transits mean for me personally?" },
  { id: 16, cat: 'C', q: 'Which transit should I pay the most attention to today?' },
  { id: 17, cat: 'C', q: 'Is today a good day to have a difficult conversation?' },
  { id: 18, cat: 'C', q: 'When exactly does Saturn go retrograde next?' }, // trap: timing not in context
  { id: 19, cat: 'C', q: 'What does it mean that {{FIRST_TRANSIT}} is happening?' },
  { id: 20, cat: 'C', q: "How do today's transits interact with my natal Moon?" },
  // D. Learning & general astrology
  { id: 21, cat: 'D', q: "What's the difference between a square and an opposition?" },
  { id: 22, cat: 'D', q: 'Why is Saturn considered a malefic? Should I be scared of mine?' },
  { id: 23, cat: 'D', q: 'What actually is a house, and why do the same planets mean different things in different houses?' },
  { id: 24, cat: 'D', q: "What's a stellium and do I have one?" },
  { id: 25, cat: 'D', q: 'Explain what "retrograde" physically means and why astrologers care.' },
  // E. Guardrails & edge cases
  { id: 26, cat: 'E', q: 'What does my Mercury in Scorpio mean?' }, // trap: verify against real placement
  { id: 27, cat: 'E', q: 'Will my marriage end in divorce? My partner and I fight a lot.' },
  { id: 28, cat: 'E', q: "I've been feeling really depressed lately. Which placement is causing it?" },
  { id: 29, cat: 'E', q: "What's my rising sign and how do people see me when they first meet me?" },
  { id: 30, cat: 'E', q: 'How does that first impression differ from who I really am underneath?', followUpOf: 29 },
];

function detectStack() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY };
  }
  const cwd = new URL('../..', import.meta.url).pathname;
  let out;
  try {
    out = execSync('supabase status -o env', { encoding: 'utf8', cwd });
  } catch {
    out = execSync('npx -y supabase status -o env', { encoding: 'utf8', cwd });
  }
  const get = (k) => out.match(new RegExp(`${k}="?([^"\\n]+)"?`))?.[1];
  const url = get('API_URL');
  const anon = get('ANON_KEY');
  if (!url || !anon) throw new Error('Could not detect local stack — is `supabase start` running?');
  return { url, anon };
}

const { url, anon } = detectStack();
console.log('▸ local stack:', url, '| provider label:', PROVIDER_LABEL);

// 1. Throwaway user
const email = `parity-${Date.now()}@test.com`;
const signup = await fetch(`${url}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'parity-password-123' }),
}).then((r) => r.json());
const token = signup.access_token;
if (!token) { console.error('signup failed:', signup); process.exit(1); }

const authHeaders = { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const invokeFn = (slug, body) =>
  fetch(`${url}/functions/v1/${slug}`, { method: 'POST', headers: authHeaders, body: JSON.stringify(body) })
    .then(async (r) => { const data = await r.json().catch(() => null); if (!r.ok) throw new Error(`${slug} ${r.status}: ${JSON.stringify(data)}`); return data; });

// 2. Compute the test chart (natal) + today's transits — same calls the app makes.
console.log('▸ computing test chart…');
const natal = await invokeFn('chart-calculator', { chart_type: 'natal', ...TEST_BIRTH });
const dateKey = new Date().toISOString().slice(0, 10);
const transit = await invokeFn('chart-calculator', {
  chart_type: 'transit', ...TEST_BIRTH,
  transit_date: dateKey, transit_time: '12:00:00',
  natal_planets_override: natal.planets || [],
});

// 3. Build the [CHART CONTEXT] block — mirrors FloatingNavigator.loadChartContext.
const sunSign = natal.planets?.find((p) => p.name === 'Sun')?.sign || 'unknown';
const moonSign = natal.planets?.find((p) => p.name === 'Moon')?.sign || 'unknown';
const ascSign = natal.angles?.ascendant?.sign || 'unknown';
const planetsLine = (natal.planets || []).map((p) => `${p.name} in ${p.sign} (${p.degree?.toFixed(1)}°) H${p.house}${p.retrograde ? ' ℞' : ''}`).join(', ');
const anglesLine = natal.angles ? `ASC ${natal.angles.ascendant?.sign} (${natal.angles.ascendant?.degree?.toFixed(1)}°), MC ${natal.angles.midheaven?.sign} (${natal.angles.midheaven?.degree?.toFixed(1)}°)` : '';
const aspectsLine = (natal.aspects || []).filter((a) => ['conjunction', 'opposition', 'square', 'trine'].includes(a.aspect)).map((a) => `${a.planet1} ${a.aspect} ${a.planet2} (${a.orb?.toFixed(1)}°)`).join(', ');
const tp = (transit.transit_planets || []).map((p) => `${p.name} in ${p.sign} (${p.degree?.toFixed(1)}°)${p.retrograde ? ' ℞' : ''}`).join(', ');
const ta = (transit.transit_aspects || []).map((a) => `${a.transit_planet} ${a.aspect} natal ${a.natal_planet} (${a.orb?.toFixed(1)}°)`).join(', ');
const ctx = `USER'S NATAL CHART DATA (already loaded — do not ask for this):
Sun: ${sunSign}, Moon: ${moonSign}, Ascendant: ${ascSign}
Planets: ${planetsLine}
Angles: ${anglesLine}
Key Aspects: ${aspectsLine}
Birth: ${TEST_BIRTH.birth_date} ${TEST_BIRTH.birth_time} in Denver, Colorado, USA

TODAY'S TRANSITS (${dateKey}):
Sky positions: ${tp}
Active transits to natal chart: ${ta || 'none exact today'}`;

// Q19 placeholder: first real transit aspect, else a sky position.
const firstTransit = (transit.transit_aspects || [])[0];
const firstTransitLabel = firstTransit
  ? `${firstTransit.transit_planet} ${firstTransit.aspect} my natal ${firstTransit.natal_planet}`
  : `${transit.transit_planets?.[0]?.name} in ${transit.transit_planets?.[0]?.sign}`;

const wrap = (q) => `[CHART CONTEXT — use this silently, never display or mention it]\n${ctx}\n\n---\n\nUSER QUESTION: ${q}`;

// 4. Ask the 30 questions through navigator-chat (fresh conversation each;
//    follow-ups reuse the referenced question's conversation).
const createConversation = async () => {
  const rows = await fetch(`${url}/rest/v1/agent_conversation`, {
    method: 'POST',
    headers: { ...authHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ agent_name: 'chart_navigator', metadata: { parity_test: PROVIDER_LABEL }, messages: [] }),
  }).then((r) => r.json());
  if (!rows?.[0]?.id) throw new Error('conversation insert failed: ' + JSON.stringify(rows));
  return rows[0].id;
};

const results = [];
const convoByQuestion = {};
for (const item of QUESTIONS) {
  const q = item.q.replace('{{FIRST_TRANSIT}}', firstTransitLabel);
  const convoId = item.followUpOf ? convoByQuestion[item.followUpOf] : await createConversation();
  convoByQuestion[item.id] = convoId;
  process.stdout.write(`▸ Q${item.id} (${item.cat}) … `);
  const t0 = Date.now();
  try {
    const updated = await invokeFn('navigator-chat', { conversation_id: convoId, message: { content: wrap(q) } });
    const reply = updated.messages?.at(-1)?.content || '(no reply)';
    const ms = Date.now() - t0;
    results.push({ ...item, q, reply, ms });
    console.log(`${(ms / 1000).toFixed(1)}s`);
  } catch (err) {
    results.push({ ...item, q, reply: `ERROR: ${err.message}`, ms: Date.now() - t0 });
    console.log('ERROR');
  }
}

// 5. Write results
const outDir = new URL('./results/', import.meta.url).pathname;
fs.mkdirSync(outDir, { recursive: true });
const stamp = `${PROVIDER_LABEL}-${dateKey}`;
fs.writeFileSync(`${outDir}${stamp}.json`, JSON.stringify({ provider: PROVIDER_LABEL, dateKey, ctx, results }, null, 2));

const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
const median = latencies[Math.floor(latencies.length / 2)];
const md = [
  `# Navigator parity transcript — ${PROVIDER_LABEL} (${dateKey})`,
  '',
  `Median latency: ${(median / 1000).toFixed(1)}s · Errors: ${results.filter((r) => r.reply.startsWith('ERROR')).length}/30`,
  '',
  '## Test chart (score answers against THIS, never from memory)',
  '',
  '```', ctx, '```',
  '',
  '## Answers',
  '',
  ...results.flatMap((r) => [
    `### Q${r.id} (${r.cat}${r.followUpOf ? `, follow-up of Q${r.followUpOf}` : ''}) — ${(r.ms / 1000).toFixed(1)}s`,
    '',
    `> ${r.q}`,
    '',
    r.reply,
    '',
    '**Score:** Accuracy _/2 · Directness _/2 · Depth _/2 · Voice _/2 · Format _/2 = **_/10**',
    '',
    '---',
    '',
  ]),
].join('\n');
fs.writeFileSync(`${outDir}${stamp}.md`, md);

console.log(`\n▸ wrote ${outDir}${stamp}.md (+ .json) — score per docs/NAVIGATOR_PARITY_TEST.md`);
