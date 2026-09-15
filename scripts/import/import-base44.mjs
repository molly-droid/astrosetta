#!/usr/bin/env node
/**
 * import-base44 — production data import: Base44 entity exports -> Supabase.
 *
 * Input: a directory of <EntityName>.json files (arrays of records), the
 * shape Base44 data exports use. Run rehost-media.mjs first if media URLs
 * should be rewritten (pass its map via --url-map).
 *
 * What it does:
 *   1. User.json -> creates confirmed auth users (no password: users set one
 *      via the reset flow on first login, per the cutover plan) and upserts
 *      the public.users row with every profile field. Existing auth users
 *      (matched by email) are reused, so re-runs are safe.
 *   2. Every other entity -> upserts into its table. Row ids are UUIDv5
 *      hashes of the Base44 id (deterministic -> idempotent re-runs);
 *      user references (user_id, created_by_id, contributor_id) map through
 *      the auth-created uid map; row references (chart_id, target_chart_id,
 *      interpretation_id, module_id) map through the same UUIDv5 hash.
 *   3. created_date / updated_date / created_by are preserved from the
 *      export when present.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     node import-base44.mjs --data ./export-dir [--url-map ./media-map.json] [--dry-run]
 *
 * Prints a per-table report and writes user-id-map.json next to the data
 * (needed by support tooling and for debugging cross-references).
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// CLI / env
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const DATA_DIR = opt('--data');
const URL_MAP_FILE = opt('--url-map');
const DRY_RUN = args.includes('--dry-run');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!DATA_DIR || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node import-base44.mjs --data <dir> [--url-map <file>] [--dry-run]');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Keep in sync with supabase/functions/_shared/tables.ts
const ENTITY_TABLES = {
  AccountDeletionRequest: 'account_deletion_request',
  CalendarSynthesis: 'calendar_synthesis',
  Chart: 'chart',
  DailyQuiz: 'daily_quiz',
  ErrorLog: 'error_log',
  EventOrder: 'event_order',
  Feedback: 'feedback',
  FeatureHighlight: 'feature_highlight',
  FoundingPatron: 'founding_patron',
  GlossaryItem: 'glossary_item',
  IncentiveSKU: 'incentive_sku',
  Interpretation: 'interpretation',
  LLMUsageLog: 'llm_usage_log',
  LearningModule: 'learning_module',
  Placement: 'placement',
  PlanetCorrection: 'planet_correction',
  PlannerJournalEntry: 'planner_journal_entry',
  PopupEvent: 'popup_event',
  RoadmapItem: 'roadmap_item',
  SavedChart: 'saved_chart',
  StreakBonusContent: 'streak_bonus_content',
  SynthesisRating: 'synthesis_rating',
  UserInterpretationRating: 'user_interpretation_rating',
  UserModuleProgress: 'user_module_progress',
  UserPlacementProgress: 'user_placement_progress',
  UserProgress: 'user_progress',
  WaitlistEmail: 'waitlist_email',
  XPEvent: 'xp_event',
};

// Fields holding Base44 USER ids (mapped via the auth uid map).
const USER_REF_FIELDS = new Set(['user_id', 'created_by_id', 'contributor_id']);
// Fields holding Base44 ROW ids of other entities (mapped via UUIDv5).
const ROW_REF_FIELDS = new Set(['chart_id', 'target_chart_id', 'interpretation_id', 'module_id']);
// Base44 export metadata that has no column.
const DROP_FIELDS = new Set(['_id', 'created_by_user', 'is_sample', 'app_id', 'updated_by']);

// ---------------------------------------------------------------------------
// Deterministic UUIDv5 from a Base44 id (idempotent re-imports).
// ---------------------------------------------------------------------------
const NAMESPACE = 'astrosetta-base44-import-v1';
function idToUuid(base44Id) {
  const h = createHash('sha1').update(NAMESPACE).update(String(base44Id)).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC variant
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const urlMap = URL_MAP_FILE ? JSON.parse(fs.readFileSync(URL_MAP_FILE, 'utf8')) : {};
function rewriteUrls(value) {
  if (typeof value === 'string') {
    let out = value;
    for (const [from, to] of Object.entries(urlMap)) out = out.split(from).join(to);
    return out;
  }
  if (Array.isArray(value)) return value.map(rewriteUrls);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewriteUrls(v)]));
  }
  return value;
}

function loadEntity(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`${file} is not an array`);
  return data;
}

const report = [];
const unmapped = [];

// ---------------------------------------------------------------------------
// 1. Users -> auth.users + public.users
// ---------------------------------------------------------------------------
const userIdMap = {}; // base44 user id -> supabase auth uid

async function findAuthUserByEmail(email) {
  // paginate; fine for beta-scale user counts
  for (let pageN = 1; pageN <= 50; pageN++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pageN, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function importUsers() {
  const users = loadEntity('User');
  if (!users) {
    console.log('! No User.json found — other entities will import with unmapped user references.');
    return;
  }
  let created = 0, reused = 0, skipped = 0;
  for (const rec of users) {
    const email = rec.email?.trim();
    const b44Id = rec.id || rec._id;
    if (!email || !b44Id) { skipped++; continue; }

    if (DRY_RUN) { userIdMap[b44Id] = idToUuid(b44Id); created++; continue; }

    let authUser = await findAuthUserByEmail(email);
    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: rec.full_name || rec.display_name || null },
      });
      if (error) { unmapped.push(`User ${email}: ${error.message}`); skipped++; continue; }
      authUser = data.user;
      created++;
    } else {
      reused++;
    }
    userIdMap[b44Id] = authUser.id;

    // Upsert the profile row with every exported field (overrides the
    // signup-trigger defaults).
    const row = { id: authUser.id, email };
    for (const [k, v] of Object.entries(rec)) {
      if (['id', '_id', 'email', ...DROP_FIELDS].includes(k)) continue;
      if (k === 'created_date' || k === 'updated_date' || USERS_COLUMNS.has(k)) row[k] = rewriteUrls(v);
    }
    const { error: upErr } = await supabase.from('users').upsert(row);
    if (upErr) unmapped.push(`users row ${email}: ${upErr.message}`);
  }
  report.push({ table: 'users (auth + profile)', total: users.length, created, reused, skipped });
}

// Columns that exist on public.users (guard against unexpected export fields).
const USERS_COLUMNS = new Set([
  'full_name', 'role', 'display_name', 'birth_date', 'birth_time', 'birth_location',
  'current_timezone', 'time_format', 'xp_total', 'level', 'streak_days', 'last_active',
  'subscription_tier', 'subscription_expires', 'subscription_source', 'stripe_customer_id',
  'stripe_subscription_id', 'iap_transaction_id', 'is_founding_member',
  'founding_tier_preference', 'seen_spotlights', 'daily_email_opt_in', 'weekly_email_opt_in',
  'monthly_email_opt_in', 'show_asteroids', 'show_angles', 'show_lots', 'show_nodes',
  'show_lilith', 'font_scale', 'created_date', 'updated_date',
]);

// ---------------------------------------------------------------------------
// 2. Entities
// ---------------------------------------------------------------------------
function transformRecord(entityName, rec) {
  const b44Id = rec.id || rec._id;
  const row = {};
  if (b44Id) row.id = idToUuid(b44Id);
  for (const [k, vRaw] of Object.entries(rec)) {
    if (k === 'id' || DROP_FIELDS.has(k)) continue;
    let v = rewriteUrls(vRaw);
    if (USER_REF_FIELDS.has(k) && typeof v === 'string' && v) {
      if (userIdMap[v]) v = userIdMap[v];
      else unmapped.push(`${entityName}.${k}=${v} (no matching user — kept as-is)`);
    } else if (ROW_REF_FIELDS.has(k) && typeof v === 'string' && v) {
      v = idToUuid(v);
    }
    row[k] = v;
  }
  return row;
}

async function importEntity(entityName, table) {
  const records = loadEntity(entityName);
  if (!records) return;
  const rows = records.map((r) => transformRecord(entityName, r));
  let inserted = 0, failed = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    if (DRY_RUN) { inserted += batch.length; continue; }
    const { error } = await supabase.from(table).upsert(batch);
    if (error) {
      // fall back to per-row so one bad record doesn't sink the batch
      for (const row of batch) {
        const { error: e2 } = await supabase.from(table).upsert(row);
        if (e2) { failed++; unmapped.push(`${table} id=${row.id}: ${e2.message}`); }
        else inserted++;
      }
    } else {
      inserted += batch.length;
    }
  }
  report.push({ table, total: records.length, inserted, failed });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
console.log(`Import from ${DATA_DIR} -> ${SUPABASE_URL}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);
await importUsers();
for (const [entityName, table] of Object.entries(ENTITY_TABLES)) {
  await importEntity(entityName, table);
}

fs.writeFileSync(path.join(DATA_DIR, 'user-id-map.json'), JSON.stringify(userIdMap, null, 2));
console.log('\n=== Report ===');
for (const r of report) console.log(' ', JSON.stringify(r));
if (unmapped.length) {
  console.log(`\n=== Issues (${unmapped.length}) ===`);
  for (const u of [...new Set(unmapped)].slice(0, 40)) console.log('  •', u);
}
console.log(`\nUser id map written to ${path.join(DATA_DIR, 'user-id-map.json')}`);
