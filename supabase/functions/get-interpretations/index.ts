import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { key } = payload;

    if (!key) {
      return json({ error: 'Missing placement key' }, { status: 400 });
    }

    // Cutover imports the second Base44 app's content into this table.
    // Never depend on the retired app being reachable, even as a first attempt.
    const local = await base44.asServiceRole.entities.Interpretation.filter({
      placement_key: key, status: 'active',
    });
    const sorted = local.sort((a, b) => (b.rating_score || 0) - (a.rating_score || 0)).slice(0, 3);
    return json({ interpretations: sorted, source: 'local' });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});
