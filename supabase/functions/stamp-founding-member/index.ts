/**
 * stampFoundingMember — called by entity automation on User create.
 *
 * BEFORE LAUNCH: LAUNCH_DATE is null, so everyone is a founding member.
 * AT LAUNCH: Set LAUNCH_DATE to the actual launch date (ISO string).
 *            Anyone who signs up within 30 days of that date gets founding member pricing.
 * AFTER 30 DAYS: New users get is_founding_member = false (regular pricing).
 */
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, getAuthUser, isServiceRole } from '../_shared/edge.ts';

// Set this to your launch date when you go live, e.g. "2026-08-01"
// Leave null during beta — all signups are founding members
const LAUNCH_DATE: string | null = null;
const FOUNDING_WINDOW_DAYS = 30;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  // Base44 automation on User create — service-role only; superseded by the signup DB trigger but kept for parity/manual runs.
  if (!isServiceRole(req)) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const userId = body?.event?.entity_id;
    if (!userId) return json({ ok: false, reason: 'no entity_id' });

    let isFoundingMember = true;

    if (LAUNCH_DATE) {
      const launch = new Date(LAUNCH_DATE);
      const windowEnd = new Date(launch);
      windowEnd.setDate(windowEnd.getDate() + FOUNDING_WINDOW_DAYS);
      const now = new Date();
      isFoundingMember = now <= windowEnd;
    }

    const base44 = compatClient(req);
    await base44.asServiceRole.entities.User.update(userId, {
      is_founding_member: isFoundingMember,
    });

    return json({ ok: true, userId, isFoundingMember });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
});