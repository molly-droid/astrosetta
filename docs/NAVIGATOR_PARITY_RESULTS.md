# Navigator Parity Test — Results & Recommendation

Run 2026-09-30 per [NAVIGATOR_PARITY_TEST.md](./NAVIGATOR_PARITY_TEST.md).
Both providers answered the same 30 questions with identical same-day chart
context through the real navigator-chat pipeline. Full transcripts:
`scripts/navigator-parity/results/{claude,astrology-api}-2026-09-30.md`.

## Headline

| | Claude (current) | Astrology-API.io (candidate) |
|---|---|---|
| Rubric score (max 300) | **286** | **268 (93.7% of baseline)** |
| Fabricated placements/aspects | **1** (Q26: invented a Mercury–Tyche conjunction) | **0** |
| Trap questions (Q18 timing, Q26 false premise) | passed both | passed both |
| Median latency | 7.6s | **3.3s** |
| Errors / non-answers | 0 | 0 |
| Marginal cost per turn | ~$0.01–0.03 Anthropic API | 25 credits, flat (inside the $37/mo Ultra sub) |

**All three pass gates cleared:** ≥85% of baseline total (93.7%) · zero
critical fabrications (the run's only one was the *baseline's*) · no category
below 70% of baseline (worst: 90.9%).

Category subtotals (candidate as % of baseline): natal reads 90.9% ·
psychological patterns 91.5% · transits 91.2% · learning/teaching **104.3%**
(it *beat* the baseline) · guardrails 93.6%.

## Qualitative differences

- **Candidate strengths:** near-flawless chart citation discipline (one minor
  slip in 30 answers vs seven for the baseline — the baseline's richer
  synthesis is also where its errors come from), 2.3× faster, excellent on
  the emotional-safety questions (no doom, no medical claims, warm referrals),
  and it beat the baseline on teaching questions.
- **Candidate weaknesses:** flatter voice — warm but templated (a "growth
  edge" block in nearly every answer, rarely witty), and it runs long on
  emotionally loaded questions. Both are prompt-tunable: the provider takes
  our system persona, so sharpening the brevity/wit instructions is available
  cheaply. It also sometimes anchors on fewer chart factors than the baseline
  (e.g., a Leo-rising read that ignored the Moon in the 1st).
- Both handled conversation memory (Q30 follow-up) correctly.

## Budget reality (important for the decision)

Hosted chat costs ~25–26 credits/turn → the Ultra tier's 55,000 credits ≈
**~2,100 Navigator turns per month across all users**, shared with whatever
chart-calculation credits the engine swap consumes (natal = 1 credit, so
chart usage is comparatively negligible). Levers if chat volume outgrows it:
their BYOK mode (2 credits/turn + our Anthropic key — keeps their astro
tooling, moves LLM spend back to Anthropic), a higher tier, or per-tier
Navigator message limits (already supported by our usage-quota machinery).

## Recommendation

**Switch the Navigator to Astrology-API.io hosted chat.** It passes the
agreed validation, is faster, eliminates the per-message Anthropic bill (the
scope's goal), and its one real gap (voice flatness) is addressable through
the system prompt we already control. Claude remains one env-var away
(`NAVIGATOR_PROVIDER`) as an instant rollback at any time.

**To flip it in production** (after client sign-off):
```bash
npx supabase secrets set ASTROLOGY_API_KEY=<key> NAVIGATOR_PROVIDER=astrology-api
supabase functions deploy navigator-chat
```

Suggested to bundle with the switch: a persona-tuning pass on
CHART_NAVIGATOR_INSTRUCTIONS targeting the candidate's verbosity on heavy
questions, then spot-check with the same harness.

## Chart-engine side finding (bonus)

Their `/charts/natal` endpoint agrees with our ported calculator **10/10
planets, exact sign and house**, for the test chart — an early green light
for the phase-2 chart-engine swap. Extended points the app uses (Chiron,
Lilith, lots, Juno/Pallas/Vesta/Tyche) are available via `active_points` /
`custom_bodies` options; mapping them is engine-swap implementation work.
