import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Resolve user if authenticated (not required — errors can happen pre-login)
    let userId = null;
    try {
      const user = await base44.auth.me();
      if (user) userId = user.id;
    } catch {}

    await base44.asServiceRole.entities.ErrorLog.create({
      user_id: userId,
      error_message: (body.error_message || 'Unknown error').slice(0, 2000),
      stack_trace: (body.stack_trace || '').slice(0, 5000) || undefined,
      page_url: (body.page_url || '').slice(0, 500) || undefined,
      user_agent: (body.user_agent || '').slice(0, 500) || undefined,
      component_stack: (body.component_stack || '').slice(0, 5000) || undefined,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});