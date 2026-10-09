/**
 * stampFoundingMember — called by entity automation on User create.
 *
 * The signup trigger and this legacy/manual repair share founding_eligible(),
 * controlled by launch_configuration.founding_ends_at. Null preserves beta.
 */
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, isServiceRole, serviceClient } from '../_shared/edge.ts';

// Set the database cutoff only after the client confirms the founding window.

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  // Base44 automation on User create — service-role only; superseded by the signup DB trigger but kept for parity/manual runs.
  if (!isServiceRole(req)) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const userId = body?.event?.entity_id;
    if (!userId) return json({ ok: false, reason: 'no entity_id' });

    const base44 = compatClient(req);
    const account = await base44.asServiceRole.entities.User.get(userId);
    // Signup trigger is authoritative; legacy automation must not rewrite an
    // established cohort when replayed after launch.
    if (account.is_founding_member !== null && account.is_founding_member !== undefined) return json({ ok: true, userId, unchanged: true });
    const { data: isFoundingMember, error } = await serviceClient().rpc('founding_eligible', { p_created_at: account.created_date });
    if (error) throw error;
    await base44.asServiceRole.entities.User.update(userId, {
      is_founding_member: isFoundingMember,
    });

    return json({ ok: true, userId, isFoundingMember });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
});
