import { serviceClient } from './edge.ts';
import { sendDigestEmail } from './resendEmail.ts';
import { digestSlot } from './digestSchedule.ts';

// A claimed delivery is never retried automatically, even after a timeout:
// the provider might already have accepted it. Failures require review.
export async function sendDigestOnce(kind: string, target: {email: string}, build: () => Promise<{subject: string, html: string} | null>, db = serviceClient(), send = sendDigestEmail) {
  const { period } = digestSlot(kind);
  const key = { kind, period_key: period, recipient: target.email.trim().toLowerCase() };
  const { error } = await db.from('email_digest_delivery').insert({ ...key, status: 'processing' });
  if (error?.code === '23505') return 'duplicate';
  if (error) throw new Error(`Digest claim failed: ${error.message}`);
  const finish = async (status: string, extra: Record<string, unknown> = {}) => {
    const { error } = await db.from('email_digest_delivery').update({ status, ...extra }).match(key);
    if (error) throw new Error(`Digest status update failed: ${error.message}`);
  };
  try {
    const built = await build();
    if (!built) { await finish('skipped'); return 'skipped'; }
    const result = await send({ to: target.email, subject: built.subject, html: built.html });
    await finish('sent', { provider_id: result?.id || null });
    return 'sent';
  } catch (error) {
    await finish('failed');
    throw error;
  }
}

// One recipient per invocation keeps LLM work within the Edge runtime limit.
// Cron polls during the morning window; claimed recipients are skipped.
export async function runScheduledDigest({ kind, base44, body, build, now = new Date(), db = serviceClient(), deliver = sendDigestOnce }: { kind: string, base44: any, body: any, build: (target: any) => Promise<any>, now?: Date, db?: ReturnType<typeof serviceClient>, deliver?: typeof sendDigestOnce }) {
  const slot = digestSlot(kind, now);
  if (!slot.due && body.dry_run !== true) return { success: true, skipped: true, reason: 'Outside scheduled window' };
  const charts = await base44.asServiceRole.entities.Chart.list('-created_date', 500);
  const ids = [...new Set(charts.map((c: any) => c.user_id).filter(Boolean))];
  const wanted = Array.isArray(body.user_ids) ? new Set(body.user_ids) : null;
  const { data: claimed, error } = await db.from('email_digest_delivery').select('recipient')
    .eq('kind', kind).eq('period_key', slot.period);
  if (error) throw new Error(`Digest delivery lookup failed: ${error.message}`);
  const seen = new Set(claimed.map(r => r.recipient));
  const candidates = [];
  let optedOut = 0, duplicates = 0;
  for (const id of ids) {
    if (wanted && !wanted.has(id)) continue;
    const target = await base44.asServiceRole.entities.User.filter({ id }).then((r: any[]) => r[0]);
    if (!target?.email) continue;
    // Explicit opt-in only. An incomplete/missing preference cannot add someone.
    if (target[`${kind}_email_opt_in`] !== true) { optedOut++; continue; }
    // Weekly/monthly synthesis is Core/Premium access; a current Stripe trial
    // qualifies, but the former beta-wide override must not grant it to Free.
    const paid = ['interpret','calendar'].includes(target.subscription_tier)
      && (!target.subscription_expires || Date.parse(target.subscription_expires) > now.getTime());
    if (kind !== 'daily' && !paid) { optedOut++; continue; }
    const recipient = target.email.trim().toLowerCase();
    if (seen.has(recipient)) { duplicates++; continue; }
    seen.add(recipient);
    candidates.push(target);
  }
  if (body.dry_run === true) return {
    success: true, dry_run: true, due: slot.due, period: slot.period,
    eligible: candidates.length, optedOut, duplicates, batch_size: 1,
  };
  const target = candidates[0];
  if (!target) return { success: true, sent: 0, optedOut, duplicates, remaining: 0 };
  const status = await deliver(kind, target, () => build(target), db);
  return { success: true, sent: status === 'sent' ? 1 : 0, status, remaining: candidates.length - 1 };
}
