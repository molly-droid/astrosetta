/**
 * getDailyStreakBonus — Returns or generates the Practitioner Lens deep-dive card.
 * Unlocked by completing today's daily quiz (no streak requirement).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    // Practitioner's Lens unlocks when today's quiz is completed.
    // Find the user's most recent completed quiz and define "today" using that quiz's OWN
    // timezone (the one it was created with), so a timezone mismatch never 403s a user
    // who already completed today's quiz.
    const quizRecords = await base44.entities.DailyQuiz.filter({ user_id: user.id });
    const completed = quizRecords
      .filter(q => q.completed_at)
      .sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || '')));
    const todayQuiz = completed[0];
    if (!todayQuiz) {
      return Response.json({ error: 'Complete today\'s quiz to unlock the Practitioner\'s Lens' }, { status: 403 });
    }
    const quizTz = todayQuiz.user_timezone || user?.current_timezone || body.timezone || 'UTC';
    const dateKey = new Date().toLocaleDateString('en-CA', { timeZone: quizTz });
    if (todayQuiz.date_key !== dateKey) {
      return Response.json({ error: 'Complete today\'s quiz to unlock the Practitioner\'s Lens' }, { status: 403 });
    }

    // Check for cached content
    const cached = await base44.asServiceRole.entities.StreakBonusContent.filter({ date_key: dateKey });
    if (cached.length > 0) {
      return Response.json({ content: cached[0] });
    }

    // Generate today's practitioner lens
    let transitContext = '';
    try {
      const transitRes = await base44.functions.invoke('astroEngine', {
        chart_type: 'transit',
        birth_date: '1990-01-01',
        birth_time: '12:00:00',
        // latitude must be non-zero — astroEngine rejects a falsy latitude,
        // which previously made this call 400 and left the LLM with no real
        // transit positions to work from (it then hallucinated stale ones).
        birth_location: { latitude: 1, longitude: 0 },
        transit_date: dateKey
      });
      const tPlanets = transitRes?.data?.transit_planets || [];
      transitContext = tPlanets
        .filter(p => ['Saturn','Jupiter','Pluto','Neptune','Uranus','Chiron'].includes(p.name))
        .map(p => `${p.name} in ${p.sign}${p.retrograde ? ' (Rx)' : ''}`)
        .join(', ');
    } catch (e) {
      transitContext = 'current celestial transits';
    }

    let result = null;
    try {
      result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a depth astrologer writing for practitioners — people who understand the basics and want nuance.

Today's major transits: ${transitContext}
Date: ${dateKey}

Write a Practitioner's Lens entry for this ONE transit (the most active or meaningful today). This is a "cheat-code" — the practical tip astrologers reach for when reading this transit, framed as a relatable scenario.

Produce:
- transit_subject: the transit, e.g. "Saturn in Pisces" (must match a position listed above)
- scenario: ONE relatable sentence framing it as a real-world question someone would ask, e.g. "A friend asks: 'Saturn's in Pisces right now — what should I watch for in my own chart?'" Use the actual transit subject from the list above.
- headline: a short cheat-code hook (5-8 words), e.g. "The Saturn-in-Pisces Cheat-Code"
- content: the cheat-code itself — 2-3 sentences of specific, actionable practitioner guidance. Use tip language like "Watch for...", "The move is...", "A tell-tale sign is...". No generic affirmations or horoscope-style reassurance.

CRITICAL: Use ONLY the transit positions listed above. Your training data on planetary positions is outdated. Every planet you mention MUST use the exact sign listed in "Today's major transits" above. Do NOT invent any planetary positions, aspects, or events not explicitly listed.

Return JSON with: transit_subject (string), scenario (string), headline (string), content (string).`,
        response_json_schema: {
          type: 'object',
          properties: {
            transit_subject: { type: 'string' },
            scenario: { type: 'string' },
            headline: { type: 'string' },
            content: { type: 'string' }
          }
        }
      });
    } catch (e) {
      result = null;
    }

    // Fallback insight if the LLM call failed or returned nothing usable
    const fallbackSubject = transitContext ? transitContext.split(',')[0] : 'the current sky';
    const headline = result?.headline || "Today's Cheat-Code";
    const transit_subject = result?.transit_subject || fallbackSubject;
    const scenario = result?.scenario || `A friend asks: "${fallbackSubject} is active right now — what should I watch for?"`;
    const content = result?.content || `Cheat-code for ${fallbackSubject}: watch where an old structure is dissolving and don't rush to rebuild the same wall. The move is to notice the pattern first, then choose deliberately. A tell-tale sign you're working it well: you feel grief and clarity at the same time.`;

    let bonusContent;
    try {
      bonusContent = await base44.asServiceRole.entities.StreakBonusContent.create({
        date_key: dateKey,
        headline,
        transit_subject,
        scenario,
        transit_context: transitContext,
        content,
        generated_at: new Date().toISOString()
      });
    } catch (e) {
      // Best-effort cache; still return content even if persisting fails
      bonusContent = { date_key: dateKey, headline, transit_subject, scenario, transit_context: transitContext, content, generated_at: new Date().toISOString() };
    }

    return Response.json({ content: bonusContent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});