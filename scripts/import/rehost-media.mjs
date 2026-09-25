#!/usr/bin/env node
/**
 * rehost-media — moves media off media.base44.com before decommission.
 *
 * Scans a Base44 data-export directory (and optionally extra files like
 * apps/web/index.html) for media.base44.com URLs, downloads each file,
 * uploads it to the Supabase Storage "public" bucket under base44-media/,
 * and writes media-map.json ({old url -> new url}) for import-base44.mjs
 * --url-map and for manual code rewrites.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     node rehost-media.mjs --data ./export-dir [--extra ../../apps/web/index.html ...] [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const DATA_DIR = opt('--data');
const DRY_RUN = args.includes('--dry-run');
const extraIdx = args.indexOf('--extra');
const EXTRA_FILES = extraIdx >= 0 ? args.slice(extraIdx + 1).filter((a) => !a.startsWith('--')) : [];
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!DATA_DIR || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node rehost-media.mjs --data <dir> [--extra <files...>] [--dry-run]');
  process.exit(1);
}

const URL_RE = /https:\/\/[a-z0-9.-]*base44\.com\/[A-Za-z0-9/_\-.%]+/g;

// 1. Collect URLs
const urls = new Set();
const scanText = (text) => { for (const m of text.match(URL_RE) ?? []) urls.add(m); };
for (const f of fs.readdirSync(DATA_DIR)) {
  if (f.endsWith('.json')) scanText(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
}
for (const f of EXTRA_FILES) scanText(fs.readFileSync(f, 'utf8'));
console.log(`Found ${urls.size} distinct media.base44.com URLs`);

// 2. Download + upload
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const map = {};
let ok = 0, failed = 0;
for (const url of urls) {
  const name = decodeURIComponent(url.split('/').pop());
  const dest = `base44-media/${name}`;
  if (DRY_RUN) { map[url] = `${SUPABASE_URL}/storage/v1/object/public/public/${dest}`; ok++; continue; }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const { error } = await supabase.storage.from('public').upload(dest, bytes, { contentType, upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('public').getPublicUrl(dest);
    map[url] = data.publicUrl;
    ok++;
    console.log(`  ✓ ${name} (${bytes.length} bytes)`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${url}: ${err.message}`);
  }
}

fs.writeFileSync(path.join(DATA_DIR, 'media-map.json'), JSON.stringify(map, null, 2));
console.log(`\n${ok} rehosted, ${failed} failed. Map written to ${path.join(DATA_DIR, 'media-map.json')}`);
console.log('Remember: apps/web/index.html and src/lib/{moduleImages,curriculumEnrichment}.js reference');
console.log('media.base44.com in CODE — rewrite those with this map before cutover.');
