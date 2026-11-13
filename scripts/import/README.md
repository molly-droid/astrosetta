# Production data import (Base44 -> Supabase)

**Production follow-up, November 12:** use the reconciliation tools for a target
that already contains member data. The original importer below overwrites
matching rows and can fire welcome emails. Read the
[completed import handoff](../../docs/BASE44_IMPORT_2026-11-12.md) and
[final reference/storage audit](../../docs/FINAL_DATA_STORAGE_AUDIT_2026-11-12.md)
before repeating any live operation. Do not send or re-enable emails without
Jacob's explicit permission.

**Step 0 — Base44's dashboard exports CSV, not JSON.** Convert first:

    python3 -I convert-csv-export.py <export-dir-of-*_export.csv> \
      <users.csv> ../../base44/entities <json-out-dir>

The table exports (`<Entity>_export.csv`) and the user list are separate
downloads, and the user list has NO `id` column. The converter types every
column from `base44/entities/*.jsonc`, recovers each user's live Base44 id
(the ObjectId in their own records whose embedded timestamp matches their
`created_date` — 43/43 exact within 1s in the 2026-11-03 rehearsal), and
drops records owned by deleted accounts (Base44 keeps them; e.g. one tester
account had 7 deleted predecessors). Records created by Base44 service
accounts (`service_*` creator ids) import with `created_by_id` nulled — the
owner `user_id` stays mapped; the importer lists these as Issues, expected.

Rehearsed end to end 2026-11-03 against a local stack on the production
schema (13/13 migrations): 47 users, every table 0 failed inserts, 0 orphaned
rows, migrated login verified (own profile/chart/progress visible, RLS
isolates other users). Note: blank Base44 `is_founding_member` becomes true
on import — parity with Base44's legacy founding repair.

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
