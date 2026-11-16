# Explain it and expanded sharing

## Behavior

- Daily and monthly explanations are built only from the selected tab. Collective never falls back to personal content. The Free daily explanation excludes hidden paid guidance. The weekly reading and interactive Explain it buttons also use the shared context-aware state handler.
- Changing tab, period, chart, knowledge depth or reading clears the previous explanation; late responses cannot overwrite a different context. Returning while an earlier request is pending can start a fresh request.
- Share added to chart-detail placements, houses and aspects, chart dynamics, ritually active formations, transit-natal formations, interactive natal/transit/collective/synastry interpretations and the current curriculum slide. Existing Cosmic Formations sharing has a direct button on each formation row.
- New cards use the visible reading or slide without generating additional AI content. They retain the existing blue/cream themes and browser/native save paths. Long content is split across numbered 1080 by 1920 cards, preserving every word; Copy Text includes the full reading. The share overlay sits above the lesson player and existing dialogs.

## Verification

- Ten focused tests cover collective/personal isolation, Free-plan visibility, full-text pagination, Markdown cleanup, browser PNG sharing and existing Sun/rising reading variants.
- In an isolated local browser harness, real DaySynthesis and MonthSynthesis components sent the expected selected-tab text to a mocked explain endpoint. Checked switching away and back while requests were delayed, with successful restart/completion.
- Real share controls opened for ritually active formations, transit-natal formations (including natal/transiting facts), Cosmic Formations, an interactive natal interpretation and a curriculum slide. The slide share sheet opened above the full-screen lesson.
- Verified a four-card lesson, page changes, cream theme, full-text copy feedback, a downloaded 1080 by 1920 PNG and 390 by 844 mobile layout. Inspected the downloaded PNG for readable text and no clipping.
- All service boundaries in that temporary harness were mocked; no real users, LLM requests, emails, purchases or database writes were involved. Harness files removed before committing.
- Production build and targeted lint passed. Existing unrelated build warnings remain for duplicate glyph keys and chunk size.

Native iOS/Android source is updated, but their bundled assets require the next store build. This change deploys the web/PWA only. Physical device and native release QA are not part of this pass.
