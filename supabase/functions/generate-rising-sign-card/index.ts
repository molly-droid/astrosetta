import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';
import { TONE_DIRECTIVE } from '../_shared/toneDirective.ts';

/**
 * Generates (and caches) a generic "What today means for {Sign} Rising" horoscope
 * listicle, shared across ALL users with that Ascendant sign. Cached in
 * CalendarSynthesis (period_type='topic', period_key='rising-share-{sign}-{YYYY-MM-DD}')
 * so the LLM is called at most once per sign per day.
 *
 * Payload: { sign, dateKey, dateStr, collectiveContext }
 * Returns:  { headline, bullets[], sign, dateStr }
 */
/** Trim to a maximum length at a sentence end, else a word boundary. */
function trimToLength(text: string, max: number): string {
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd > max * 0.5) return cut.slice(0, sentenceEnd + 1).trim();
  const wordEnd = cut.lastIndexOf(' ');
  return (wordEnd > 0 ? cut.slice(0, wordEnd) : cut).trim().replace(/[,;:]$/, '') + '.';
}

async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sign: string = body.sign;
    const dateKey: string = body.dateKey;
    const dateStr: string = body.dateStr || new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const collectiveContext: string = body.collectiveContext || '';

    if (!sign || !dateKey) {
      return json({ error: 'Missing sign or dateKey' }, { status: 400 });
    }

    const periodKey = `rising-share-${sign}-${dateKey}`;

    // Check shared cache (service role bypasses RLS so all users share one record)
    const cached = await base44.asServiceRole.entities.CalendarSynthesis.filter({
      period_type: 'topic',
      period_key: periodKey,
    });
    // Rows cached before AI-01 have no `summary`; regenerate those so the
    // share image gets its short standalone line.
    if (cached.length > 0 && cached[0].data?.bullets?.length && cached[0].data?.summary) {
      return json(cached[0].data);
    }

    const prompt = `You are a skilled astrologer writing a daily horoscope column for an app called Astrosetta. Today is ${dateStr}.

${TONE_DIRECTIVE}

Today's top collective transits:
${collectiveContext || 'No major transits today — a quiet sky.'}

Write a short "What today means for ${sign} Rising" horoscope column. ${sign} is on the Ascendant, so the 1st house is ${sign}, the 2nd house is the next sign, and so on around the zodiac. Frame every transit through the house it activates for ${sign} Rising. This is read by EVERYONE with ${sign} Rising — no personalisation, no names, no natal charts. Pure horoscope column voice: warm, specific, archetypal.

Rules:
- 3-5 bullets, each ONE concise sentence.
- Each bullet names the transit AND the house/life area it activates for ${sign} Rising.
- No filler, no platitudes, no "the universe wants you to..." — concrete astrological mechanics.
- Do not mention the app or marketing language.

Also write a "summary": ONE sentence, at most 200 characters, that captures today for ${sign} Rising on its own. It is printed on a square share image where the bullets do not fit, so it has to stand alone. No hashtags, no ellipsis, no trailing fragment.

Return JSON:
{
  "headline": "What today means for ${sign} Rising",
  "summary": "one sentence, max 200 characters",
  "bullets": ["...", "...", "..."]
}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          summary: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
        },
        required: ['headline', 'summary', 'bullets'],
      },
    });

    const data = {
      headline: result.headline || `What today means for ${sign} Rising`,
      // AI-01: a standalone ~200-char line for the share image, which has no
      // room for the bullet list. Hard-trimmed at a sentence or word break so
      // a long model answer can never overflow the card.
      summary: trimToLength(result.summary || '', 200),
      bullets: Array.isArray(result.bullets) ? result.bullets.slice(0, 5) : [],
      sign,
      dateStr,
    };

    // Persist to shared cache
    try {
      await base44.asServiceRole.entities.CalendarSynthesis.create({
        user_id: user.id,
        period_type: 'topic',
        period_key: periodKey,
        topic_key: 'rising-share',
        date_start: dateKey,
        date_end: dateKey,
        summary: `Rising Sign Share · ${sign} · ${dateStr}`,
        description: `Shareable horoscope card for ${sign} Rising`,
        data,
        generated_at: new Date().toISOString(),
      });
    } catch {
      // Cache write is non-critical — another concurrent request may have written first
    }

    return json(data);
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

Deno.serve(handler);
