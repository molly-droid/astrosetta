/**
 * Smoke test for the llm-task Edge Function against the LOCAL Supabase stack.
 *
 * Prereqs (from repo root):
 *   1. supabase start
 *   2. supabase db reset          # applies migrations incl. increment_llm_usage
 *   3. cp supabase/functions/.env.example supabase/functions/.env  # add your key
 *   4. supabase functions serve --env-file supabase/functions/.env
 *   5. node scripts/llm-task-smoke.mjs
 *
 * No dependencies — plain fetch against GoTrue/PostgREST/Functions.
 * SUPABASE_URL / SUPABASE_ANON_KEY env vars override autodetection
 * (autodetect shells out to `supabase status -o env`).
 */
import { execSync } from 'node:child_process';

function detectStack() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY };
  }
  // No global supabase binary on this machine — fall back to npx.
  const cwd = new URL('..', import.meta.url).pathname;
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
console.log('▸ local stack:', url);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
};

// 1. Fresh signup — the handle_new_user trigger creates the public.users row.
const email = `llm-smoke-${Date.now()}@test.com`;
const signupRes = await fetch(`${url}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'smoke-password-123' }),
});
const signup = await signupRes.json();
const token = signup.access_token;
ok('signup + session', !!token, JSON.stringify(signup).slice(0, 200));
if (!token) process.exit(1);

const invoke = async (body, useToken = token) =>
  fetch(`${url}/functions/v1/llm-task`, {
    method: 'POST',
    headers: {
      apikey: anon,
      'Content-Type': 'application/json',
      ...(useToken ? { Authorization: `Bearer ${useToken}` } : {}),
    },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

// 2. No session → 401
{
  const r = await invoke({ task: 'explain-simply', params: { context: 'x' } }, null);
  ok('unauthenticated → 401', r.status === 401, `got ${r.status}`);
}

// 3. Unknown task → 400
{
  const r = await invoke({ task: 'not-a-task', params: {} });
  ok('unknown task → 400', r.status === 400, `got ${r.status}`);
}

// 4. Free-gated text task
{
  const r = await invoke({
    task: 'explain-simply',
    params: { context: 'Transiting Saturn squares your natal Venus in Leo in the 5th house.', knowledgeDepth: 'insightful' },
  });
  ok('explain-simply returns text', r.status === 200 && typeof r.data === 'string' && r.data.length > 20,
    `status ${r.status}: ${JSON.stringify(r.data)?.slice(0, 200)}`);
}

// 5. Core-gated text task (soft-launch GATING_ADMIN_ONLY lets non-admins through)
{
  const r = await invoke({
    task: 'transit-aspect-interpretation',
    params: {
      label: 'Transiting Mars in Capricorn square natal Sun in Aries, 1st house (orb 1.2°)',
      natalPlanet: 'Sun',
      natalDetail: 'Aries, 1st house (identity, appearance)',
    },
  });
  ok('transit-aspect-interpretation returns text', r.status === 200 && typeof r.data === 'string' && r.data.length > 20,
    `status ${r.status}: ${JSON.stringify(r.data)?.slice(0, 200)}`);
}

// 6. Structured-output task
{
  const r = await invoke({
    task: 'navigator-suggestions',
    params: { conversation: 'User: What does my Moon in Pisces mean?\nNavigator: Your Moon in Pisces suggests deep emotional sensitivity and intuition...' },
  });
  ok('navigator-suggestions returns {questions: []}', r.status === 200 && Array.isArray(r.data?.questions) && r.data.questions.length > 0,
    `status ${r.status}: ${JSON.stringify(r.data)?.slice(0, 200)}`);
}

// 7. Usage logging — 3 successful calls should have logged call_count = 3 today.
{
  const dateKey = new Date().toISOString().slice(0, 10);
  const rows = await fetch(
    `${url}/rest/v1/llm_usage_log?user_id=eq.${signup.user.id}&date_key=eq.${dateKey}&select=call_count`,
    { headers: { apikey: anon, Authorization: `Bearer ${token}` } }
  ).then((r) => r.json());
  const total = (rows || []).reduce((s, r) => s + (r.call_count || 0), 0);
  ok('usage logged (call_count = 3)', total === 3, `got ${JSON.stringify(rows)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
