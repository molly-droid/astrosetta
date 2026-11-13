#!/usr/bin/env node
// Manual batches only. send-approved-remainder requires explicit campaign approval.
// Usage: node scripts/email-previews/launch-batch.mjs prepare|send-pilot|send-approved-remainder PRIVATE_DIR
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { sql } from '../import/reconcile-base44.mjs';

const [action, dir] = process.argv.slice(2);
assert(['prepare', 'send-pilot', 'send-approved-remainder'].includes(action) && path.isAbsolute(dir || ''), 'Specify a manual campaign action and an absolute private directory');
const stateFile = path.join(dir, 'campaign.json');
const digest = value => createHash('sha256').update(value).digest('hex');
const save = state => {
  fs.writeFileSync(stateFile + '.tmp', JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(stateFile + '.tmp', stateFile);
};
const members = () => sql(`select u.id,u.email,u.full_name,u.display_name,u.role,
  u.subscription_tier,u.is_founding_member,u.founding_rate_forfeited_at,b.redeemed_at
  from public.beta_trial_members b join public.users u on u.id=b.user_id order by u.created_date,u.id`);
const eligible = user => user.subscription_tier === 'free' && user.is_founding_member
  && !user.founding_rate_forfeited_at && !user.redeemed_at;
// Recipient choices stay in the private campaign directory, outside Git.
const { pilotEmails, alreadyDelivered = [] } = JSON.parse(fs.readFileSync(path.join(dir, 'pilot-recipients.json'), 'utf8'));
assert(Array.isArray(pilotEmails) && pilotEmails.length === 2);
const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

if (action === 'prepare') {
  assert(!fs.existsSync(stateFile), 'Campaign already prepared. Preserve the existing delivery ledger.');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const template = fs.readFileSync(new URL('../../docs/email-previews/launch.html', import.meta.url), 'utf8')
    .replace(/  <div class="preview-bar"[\s\S]*?<\/div>\s*<\/div>\s*/, '')
    .replace(/<title>.*?<\/title>/, '<title>Astrosetta is officially live</title>')
    .replace('aria-label="Launch email draft"', 'aria-label="Astrosetta launch email"');
  assert(template.includes('[First Name]') && !template.includes('class="preview-bar"'));
  const cohort = members();
  const seen = new Set();
  const recipients = cohort.map(user => {
    const email = user.email.trim().toLowerCase();
    assert(!seen.has(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Duplicate or invalid cohort email');
    seen.add(email);
    const firstName = (user.display_name || user.full_name || '').trim().split(/\s+/)[0] || 'there';
    const html = template.replace('[First Name]', escape(firstName));
    const htmlFile = path.join(dir, `${user.id}.html`);
    fs.writeFileSync(htmlFile, html, { mode: 0o600 });
    return { userId: user.id, email, firstName, htmlFile, htmlHash: digest(html),
      status: alreadyDelivered.includes(email) ? 'already_delivered_to_molly'
        : !eligible(user) ? 'held_for_billing_review'
          : pilotEmails.includes(email) ? 'pilot_ready' : 'held_for_jacob_review' };
  });
  assert.equal(recipients.filter(r => r.status === 'pilot_ready').length, 2, 'Both approved pilot recipients must be eligible');
  const state = { campaign: 'astrosetta-beta-launch-2026-11-13', subject: 'Astrosetta is officially live ✨ (and you helped build it)',
    preparedAt: new Date().toISOString(), remainderReleased: false, recipients };
  save(state);
  console.log(JSON.stringify({ prepared: recipients.length, statuses: recipients.reduce((counts, r) => ({ ...counts, [r.status]: (counts[r.status] || 0) + 1 }), {}) }));
} else {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  assert.equal(state.remainderReleased, false);
  const remainder = action === 'send-approved-remainder';
  const selected = state.recipients.filter(r => remainder ? r.status === 'held_for_jacob_review' : pilotEmails.includes(r.email));
  if (!remainder) assert.equal(selected.length, 2);
  assert(selected.length > 0 && selected.length <= (remainder ? 45 : 2));
  assert(selected.every(r => r.status === (remainder ? 'held_for_jacob_review' : 'pilot_ready')), 'Submitted, uncertain or delivered emails must never be retried automatically');
  if (remainder) {
    assert(state.recipients.filter(r => pilotEmails.includes(r.email)).every(r => ['accepted_by_provider', 'delivered'].includes(r.status)), 'Finish and review the pilot first');
  }
  const live = members();
  for (const recipient of selected) {
    const user = live.find(u => u.id === recipient.userId && u.email.toLowerCase() === recipient.email);
    assert(user && eligible(user), 'Recipient no longer eligible; review before sending');
    assert.equal(digest(fs.readFileSync(recipient.htmlFile, 'utf8')), recipient.htmlHash, 'Prepared message changed');
  }
  if (remainder) {
    state.remainderReleased = true;
    state.remainderApprovedAt = new Date().toISOString();
    state.remainderApproval = 'Jacob explicitly requested sending the rest after reviewing the pilot on November 13, 2026.';
    save(state);
  }
  const key = sql("select decrypted_secret key from vault.decrypted_secrets where name='edge_service_key'")[0].key;
  for (const recipient of selected) {
    recipient.status = 'submitting_do_not_retry';
    recipient.submittedAt = new Date().toISOString();
    save(state);
    const response = await fetch('https://sqdpawyqvgqadflezxxk.supabase.co/functions/v1/send-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ to: recipient.email, subject: state.subject,
        body: fs.readFileSync(recipient.htmlFile, 'utf8'), from_name: 'Astrosetta' }),
    });
    const result = await response.json();
    recipient.response = { status: response.status, ...result };
    recipient.status = response.ok && result.ok && result.id ? 'accepted_by_provider' : 'review_required_do_not_retry';
    save(state);
    assert.equal(recipient.status, 'accepted_by_provider', 'Stop and inspect Resend before any further send');
    console.log(JSON.stringify({ to: recipient.email, firstName: recipient.firstName, status: recipient.status, providerId: result.id }));
    await new Promise(resolve => setTimeout(resolve, 700));
  }
}
