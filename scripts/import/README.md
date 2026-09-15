# Production data import (Base44 -> Supabase)

Run order at cutover, against the production project:

1. `rehost-media.mjs --data <export-dir> --extra ../../apps/web/index.html`
   Downloads every media.base44.com file referenced in the data export,
   uploads to Storage (public/base44-media/), writes `media-map.json`.
   Also rewrite the code references (index.html, src/lib/moduleImages.js,
   src/lib/curriculumEnrichment.js) using the map.
2. `import-base44.mjs --data <export-dir> --url-map <export-dir>/media-map.json`
   - Creates confirmed auth users without passwords (users set one via the
     reset flow on first login — the agreed cutover plan) and full profile rows
   - Imports all 28 other entities; Base44 Mongo-style ids become
     deterministic UUIDv5 (idempotent re-runs); user refs map to auth uids,
     row refs (chart_id, module_id, interpretation_id, target_chart_id)
     map through the same hash
   - `--dry-run` first; check the Issues list in the report

Env: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. Input: a directory of
`<EntityName>.json` array files (Base44 data-export shape).

Tested against the local stack with synthetic fixtures: profile fields and
created_date preserved, references mapped, re-runs idempotent
(created 0 / reused N), password-reset flow works for imported accounts.
