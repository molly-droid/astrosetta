# Final Supabase reference and storage audit

Completed November 12, 2026. Base44 remained strictly read-only. No email was
sent, including test emails; automatic welcome and digest sends remain held.

## References and reconciliation

- Checked 65 actual foreign-key constraints across public, auth and storage:
  zero broken references and zero unvalidated constraints.
- Separately checked text IDs that PostgreSQL does not enforce as foreign keys:
  user ownership, lesson/module IDs, chart and saved-chart IDs, interpretation
  ratings, event/SKU links and typed XP references. No active dangling
  references remain.
- All 48 imported accounts still map to their original Supabase auth IDs.
  All 5,634 eligible Base44 entity records resolve to their retained or merged
  canonical records after cleanup. Completed lessons remain completed.
- Archived and removed 718 orphan rows from eight deleted staff QA accounts.
  These were not migrated members. Staff ownership was checked against the
  exact known Tony/Silex creator addresses before the cleanup was generated.
- Merged 251 duplicate lesson-progress rows in 46 groups, preserving completion,
  mastery, highest progress and earned XP. There are now 156 unique lesson
  progress records.
- Removed six duplicate curriculum XP awards using the rules already in
  `recompute-xp-totals`: retain the earliest award for the same user, module and
  event type. Repeatable placement and bonus-quiz awards were retained.
- Recomputed XP/level counters from the resulting ledger. Five XP totals
  increased; none decreased. No counter/ledger mismatch remains.
- Retained two completed account-deletion requests as historical audit records.
  Their deleted user IDs are intentional history, not active account pointers.
- No billing fields were changed by cleanup. One normal Apple/RevenueCat expiry
  extension arrived during the audit and was checked against its provider
  snapshot rather than overwritten with an older backup.

The cleanup ran in a transaction with revision guards and post-write
assertions. It first passed a full dry run that rolled back. Private backups
contain every removed row and every canonical progress record before merging.

## Storage and images

- The existing 57 site images (36,865,402 bytes) already live in
  `apps/web/public/media`. All were fetched from the new Vercel deployment and
  compared byte-for-byte with the repository copies.
- A separate check of the live Base44 HTML/JavaScript found two more branding
  images. Both original files were downloaded with read-only GET requests and
  preserved in `apps/web/public/media`:
  - `8a54e01b9_Logo23x-1200x630.png`
  - `ce8e4cd41_logo.png`
- The repository now contains all 59 live-source image filenames, totaling
  37,916,381 bytes. No image editing or recompression was performed.
- No Base44-hosted media links were found in either the raw CSV data exports or
  the imported entity records. Remaining Base44 URLs in error logs are
  historical app URLs and stack traces.
- Supabase Storage contains one existing feedback attachment in the public
  bucket. It downloads correctly, has a valid owner, and remains referenced by
  the feedback record. Its 692,915 bytes and MD5 match Storage metadata; a
  private backup was saved.
- The first SDK download check returned "Bucket not found" because a bucket
  named `public` is ambiguous with the SDK's legacy download route. The explicit
  public-object URL works; the actual file is not missing.

No further **referenced** Base44 files need downloading based on the current
data export and live app asset inventory. This is not a listing of unused or
already-deleted files inside Base44's internal storage.

## Evidence and tools

Private reports and row/blob backups are under
`~/Downloads/astrosetta-export-2026-11-12-IDX4aP/`:

- `final-reference-audit/`: original audit, cleanup backup, guarded SQL and dry run.
- `post-cleanup-audit/`: fresh row/reference and file-readback audit.
- `post-cleanup-source-verification.json`: all source rows accounted for.
- `post-cleanup-source-map.json`: canonical record IDs after duplicate merges.
- `final-foreign-key-check.json`: 65 constraints, zero failures, email holds.
- `downloaded-branding-assets.json`: source URLs, sizes and SHA-256 hashes.

`audit-base44-references.mjs PRIVATE_EXPORT_ROOT [AUDIT_FOLDER]` is read-only
apart from writing private local backups. `plan-reference-cleanup.mjs` only
generates backed-up, reviewable SQL; applying that SQL is a separate step.

The final DNS records and Vercel configuration are recorded in
[DNS_CUTOVER_INSTRUCTIONS.md](./DNS_CUTOVER_INSTRUCTIONS.md). The local browser
email preview is [email-previews/launch.html](./email-previews/launch.html).
Neither preparing that preview nor receiving Molly's copy authorizes sending.
