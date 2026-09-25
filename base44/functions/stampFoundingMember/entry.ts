/**
 * stampFoundingMember — called by entity automation on User create.
 *
 * BEFORE LAUNCH: LAUNCH_DATE is null, so everyone is a founding member.
 * AT LAUNCH: Set LAUNCH_DATE to the actual launch date (ISO string).
 *            Anyone who signs up within 30 days of that date gets founding member pricing.
 * AFTER 30 DAYS: New users get is_founding_member = false (regular pricing).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Set this to your launch date when you go live, e.g. "2026-08-01"
// Leave null during beta — all signups are founding members
const LAUNCH_DATE: string | null = null;
const FOUNDING_WINDOW_DAYS = 30;

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const userId = body?.event?.entity_id;
    if (!userId) return Response.json({ ok: false, reason: 'no entity_id' });

    let isFoundingMember = true;

    if (LAUNCH_DATE) {
      const launch = new Date(LAUNCH_DATE);
      const windowEnd = new Date(launch);
      windowEnd.setDate(windowEnd.getDate() + FOUNDING_WINDOW_DAYS);
      const now = new Date();
      isFoundingMember = now <= windowEnd;
    }

    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.User.update(userId, {
      is_founding_member: isFoundingMember,
    });

    return Response.json({ ok: true, userId, isFoundingMember });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});