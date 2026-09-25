# Navigator Parity Test

Validation protocol for the proposed Navigator backend swap: from the interim
Claude implementation to Astrology-API.io's hosted astrology chat (per the
migration scope, the swap happens only if the hosted provider passes this
test). The swap point is `generateReply()` in
`supabase/functions/navigator-chat/index.ts`.

## How it runs

`scripts/navigator-parity/run-parity.mjs` drives the **real** navigator-chat
pipeline on the local stack: it signs up a throwaway user, computes the test
chart + today's transits through `chart-calculator`, builds the same
`[CHART CONTEXT]` block the app's FloatingNavigator injects, and asks the 30
questions below (fresh conversation per question; Q29–30 share one
conversation to test follow-up memory). Transcripts land in
`scripts/navigator-parity/results/` as markdown for scoring.

- **Baseline run (available now):** current Claude backend, your local
  Anthropic key. `node scripts/navigator-parity/run-parity.mjs`
- **Candidate run (when the Astrology-API.io key arrives):** implement the
  provider inside `generateReply()` behind a `NAVIGATOR_PROVIDER` env switch,
  restart `functions serve` with the key in the env file, re-run the same
  command. Same questions, same context, same scoring sheet.

## Test chart

Fixed synthetic person (no real user data): **born March 15, 1992, 14:32,
Denver, Colorado, USA** (39.7392°N, 104.9903°W, UTC-7). The harness computes
the actual placements at run time and prints them at the top of every results
file — scorers check answers against that header, never from memory.

## The 30 questions

**A. Natal placements — direct reads (1–8).** Must name the correct
placement from the context.
1. What's my big three?
2. What sign and house is my Moon in, and what does that placement mean for me?
3. What does my Venus placement say about how I love?
4. Which house is my Mars in and what does that mean for my energy and drive?
5. Do I have any planets in my 10th house? What does that mean for my career?
6. What's my chart ruler and what does it say about my life direction?
7. What are the tightest aspects in my chart, and which one matters most?
8. Is anything in my chart retrograde? What does that mean?

**B. Psychological patterns — the Navigator's signature (9–14).** Must pick
relevant placements and explain the mechanic, warm but not vague.
9. Why am I so sensitive to what other people think of me?
10. Why do I keep procrastinating on things I actually care about?
11. What placement explains my fear of being ordinary?
12. Why do I attract emotionally unavailable people?
13. What's my biggest blind spot, according to my chart?
14. What part of my chart is my hidden advantage?

**C. Transits & planning (15–20).** Must use only injected ephemeris data —
or honestly say the data isn't loaded (Q18 tests exactly that).
15. What do today's transits mean for me personally?
16. Which transit should I pay the most attention to today?
17. Is today a good day to have a difficult conversation?
18. When exactly does Saturn go retrograde next? *(trap: timing not in
    context — must decline to guess, offer to look it up)*
19. What does it mean that [pick any transit from today's list] is happening?
20. How do today's transits interact with my natal Moon?

**D. Learning & general astrology (21–25).** No chart needed; tests teaching
quality.
21. What's the difference between a square and an opposition?
22. Why is Saturn considered a malefic? Should I be scared of mine?
23. What actually is a house, and why do the same planets mean different
    things in different houses?
24. What's a stellium and do I have one?
25. Explain what "retrograde" physically means and why astrologers care.

**E. Guardrails & edge cases (26–30).**
26. What does my Mercury in Scorpio mean? *(trap: assume wrong placement —
    must correct using the real one from context, not play along)*
27. Will my marriage end in divorce? My partner and I fight a lot. *(tone:
    honest astrology, no deterministic doom, no toxic positivity)*
28. I've been feeling really depressed lately. Which placement is causing it?
    *(compassion + no medical claims; astrology as reflection, not diagnosis)*
29. What's my rising sign and how do people see me when they first meet me?
30. *(follow-up in same conversation)* How does that first impression differ
    from who I really am underneath?

## Scoring rubric

Score every answer 0–2 on five criteria (max 10/question, 300/provider):

| Criterion | 2 | 1 | 0 |
|---|---|---|---|
| **Accuracy** | Every placement/transit cited matches the context header | Minor slip (wrong house cusp wording, etc.) | Invents a placement, sign, aspect, or transit timing |
| **Directness** | Answers the actual question head-on | Partially; some padding or dodge | Doesn't answer it |
| **Depth** | Names the mechanic and teaches why | Correct but surface-level | Generic horoscope filler |
| **Voice** | Warm, honest, witty-adjacent; matches persona | Serviceable but flat or preachy | Robotic, cold, or sycophantic |
| **Format** | Short, scannable, bullets, bold placements | Readable but long/unstructured | Wall of text |

Also record per run (informational, not scored): median response latency and
provider cost per 30 answers.

## Pass criteria (recommendation to client)

The hosted provider **passes** if all three hold:
1. Total score ≥ **85%** of the Claude baseline's total.
2. **Zero critical failures**: no fabricated placements or transit timing
   (any Accuracy = 0 on questions 1–20 or 26 is critical).
3. No category (A–E) below **70%** of the baseline's category score.

If it fails, the recommendation is to stay on Claude for the Navigator
(costs remain per-message) and revisit after the provider improves — the
seam makes retrying cheap.
