import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';
import { TONE_DIRECTIVE } from '../_shared/toneDirective.ts';

/**
 * Generates a shared sign-based daily/weekly reading. Unknown-time charts use
 * their Sun sign, without houses. Cache keys separate Sun/rising and day/week.
 * Legacy callers default to rising/day.
 * Payload: { sign, basis?: 'rising'|'sun', period?: 'day'|'week', dateKey, dateStr, collectiveContext }
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

export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    const sign = signs.find(value => value.toLowerCase() === String(body.sign || '').trim().toLowerCase());
    const basis = body.basis ?? 'rising';
    const period = body.period ?? 'day';
    if (!sign || !['sun', 'rising'].includes(basis) || !['day', 'week'].includes(period)) {
      return json({ error: 'Invalid sign, reading basis or period' }, { status: 400 });
    }
    const dateKey: string = body.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '') || !Number.isFinite(Date.parse(`${dateKey}T12:00:00Z`))) {
      return json({ error: 'Invalid dateKey' }, { status: 400 });
    }
    const dateStr: string = body.dateStr || new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const collectiveContext: string = body.collectiveContext || '';
    const signLabel = `${sign} ${basis === 'sun' ? 'Sun' : 'Rising'}`;
    const timeLabel = period === 'week' ? 'this week' : 'today';
    const headline = `What ${timeLabel} means for ${signLabel}`;

    const periodKey = `${basis}-share-${period === 'week' ? 'week-' : ''}${sign}-${dateKey}`;

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

    const perspective = basis === 'sun'
      ? `The reader has their natal Sun in ${sign}. Their birth time and Ascendant are unknown. Connect the collective transits to ${sign}'s qualities and Sun themes such as identity, vitality and expression. Do not assign houses, infer an Ascendant or describe the reader as ${sign} Rising. Do not invent exact natal degrees or personal aspects.`
      : `${sign} is on the Ascendant, so the 1st whole-sign house is ${sign}, the 2nd is the next sign, and so on. Frame the transits through these whole-sign houses.`;
    const prompt = `You write a short astrology learning column for Astrosetta. The reading covers ${dateStr}; use only the supplied transits for this ${period === 'week' ? 'week' : 'day'}.

${TONE_DIRECTIVE}

Collective transits for this period:
${collectiveContext || 'No major transits supplied. Do not invent any.'}

Write "${headline}". ${perspective}
This is a general sign-based reading shared by everyone with ${signLabel}, not a full personal chart reading. No names or private chart details.

Rules:
- Write 3-5 bullets, each one concise sentence grounded in a supplied transit.
- ${basis === 'sun' ? 'Use Sun-sign themes. Never claim knowledge of houses, a rising sign or a precise natal aspect.' : 'Name the transit and the whole-sign house or life area it activates.'}
- Use learning and reflection language, without predictions or filler.
- Do not mention marketing or the app.
- Write a standalone summary of at most 200 characters for a square image. No hashtags, ellipsis or trailing fragment.

Return JSON:
{
  "headline": "${headline}",
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
      headline,
      basis,
      period,
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
        topic_key: `${basis}-share`,
        date_start: dateKey,
        date_end: dateKey,
        summary: `${basis === 'sun' ? 'Sun Sign' : 'Rising Sign'} Share · ${sign} · ${dateStr}`,
        description: `Shareable ${period} reading for ${signLabel}`,
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
