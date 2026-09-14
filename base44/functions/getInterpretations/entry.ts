import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { key } = payload;

    if (!key) {
      return Response.json({ error: 'Missing placement key' }, { status: 400 });
    }

    // Call the interpretations seeding API
    const response = await fetch(`https://astrosetta-api.base44.app/api/interpretations?key=${encodeURIComponent(key)}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Fall back to local DB interpretations
      const local = await base44.asServiceRole.entities.Interpretation.filter({
        placement_key: key,
        status: 'active',
      });
      const sorted = local.sort((a, b) => (b.rating_score || 0) - (a.rating_score || 0)).slice(0, 3);
      return Response.json({ interpretations: sorted, source: 'local' });
    }

    const data = await response.json();
    const sorted = (Array.isArray(data) ? data : []).sort((a, b) => (b.rating_score || 0) - (a.rating_score || 0));
    return Response.json({ interpretations: sorted.slice(0, 3), source: 'api' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});