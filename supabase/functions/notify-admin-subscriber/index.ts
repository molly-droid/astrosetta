import { handleOptions, isServiceRole, json, serviceClient } from '../_shared/edge.ts';
import { deliverNextSubscriberNotice } from '../_shared/subscriberNotices.ts';
import { sendDigestEmail } from '../_shared/resendEmail.ts';

export async function handler(req: Request) {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (!isServiceRole(req)) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = serviceClient();
    const body = await req.json().catch(() => ({}));
    if (body.dry_run === true) {
      const { count, error } = await db.from('subscriber_notice_delivery').select('id', { count: 'exact', head: true }).eq('status', 'queued');
      if (error) throw error;
      return json({ dry_run: true, queued: count, sent: 0 });
    }
    return json(await deliverNextSubscriberNotice(db, sendDigestEmail));
  } catch (error) {
    console.error('Subscriber notice processing failed:', error);
    return json({ error: 'Subscriber notice needs review' }, { status: 500 });
  }
}
Deno.serve(handler);
