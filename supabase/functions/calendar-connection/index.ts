import { getAuthUser, serviceClient, json, handleOptions } from '../_shared/edge.ts';
import { CALENDAR_SCOPE, calendarCallbackUrl, calendarAllowed, googleCredentials, googleToken, sha256, pkceChallenge } from '../_shared/googleCalendar.ts';

const randomToken = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');

Deno.serve(async req => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const db = serviceClient();
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const state = url.searchParams.get('state');
      if (!state || !/^[a-f0-9]{64}$/.test(state)) return json({ error: 'Invalid calendar authorization link' }, { status: 400 });
      // DELETE RETURNING consumes state atomically, before any provider request.
      const { data: pending, error } = await db.from('google_calendar_states').delete()
        .eq('state_hash', await sha256(state)).gt('expires_at', new Date().toISOString()).select('*').maybeSingle();
      if (error) throw error;
      if (!pending) return json({ error: 'Calendar authorization expired. Reconnect from your profile.' }, { status: 400 });
      let result = 'failed';
      try {
        const code = url.searchParams.get('code');
        if (code && !url.searchParams.get('error') && await calendarAllowed(db, pending.user_id)) {
          const token = await googleToken({ grant_type: 'authorization_code', code,
            redirect_uri: calendarCallbackUrl(), code_verifier: pending.code_verifier });
          if (!token.refresh_token || !String(token.scope || '').split(' ').includes(CALENDAR_SCOPE)) {
            throw new Error('Calendar permission was not granted');
          }
          const { error: saveError } = await db.from('google_calendar_connections').upsert({
            user_id: pending.user_id, access_token: token.access_token, refresh_token: token.refresh_token,
            expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(), updated_at: new Date().toISOString(),
          });
          if (saveError) throw saveError;
          result = 'connected';
        }
      } catch { /* return a generic status; never expose credentials/provider payloads */ }
      const origin = pending.native ? 'astrosetta://profile' : `${Deno.env.get('APP_URL') || 'https://astrosetta.com'}/profile`;
      return new Response(null, { status: 302, headers: { Location: `${origin}?google_calendar=${result}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
    const user = await getAuthUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    if (body.action === 'disconnect') {
      const { data, error } = await db.from('google_calendar_connections').select('refresh_token').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (data) {
        const res = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: data.refresh_token }), signal: AbortSignal.timeout(10000) });
        if (!res.ok && res.status !== 400) throw new Error('Unable to disconnect Google Calendar. Try again.');
      }
      const { error: deleteError } = await db.from('google_calendar_connections').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;
      const { error: stateError } = await db.from('google_calendar_states').delete().eq('user_id', user.id);
      if (stateError) throw stateError;
      return json({ connected: false });
    }
    if (!await calendarAllowed(db, user.id)) return json({ error: 'Calendar sync requires Core or Premium', code: 'upgrade_required' }, { status: 403 });
    if (body.action === 'feed') {
      const { error: insertError } = await db.from('calendar_feed_keys').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (insertError) throw insertError;
      const { data, error } = await db.from('calendar_feed_keys').select('token').eq('user_id', user.id).single();
      if (error) throw error;
      return json({ url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-icsfeed?token=${data.token}` }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (body.action === 'authorize') {
      const { client_id } = googleCredentials();
      const state = randomToken(), verifier = randomToken();
      const { error } = await db.from('google_calendar_states').upsert({ user_id: user.id,
        state_hash: await sha256(state), code_verifier: verifier, native: body.native === true,
        expires_at: new Date(Date.now() + 10 * 60000).toISOString() });
      if (error) throw error;
      const params = new URLSearchParams({ client_id, redirect_uri: calendarCallbackUrl(), response_type: 'code',
        scope: CALENDAR_SCOPE, state, access_type: 'offline', prompt: 'consent',
        code_challenge: await pkceChallenge(verifier), code_challenge_method: 'S256' });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }
    if (body.action === 'status') {
      const { data, error } = await db.from('google_calendar_connections').select('user_id').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      return json({ connected: !!data, configured: !!Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') && !!Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') });
    }
    return json({ error: 'Unknown calendar action' }, { status: 400 });
  } catch (error) {
    console.error('Calendar connection failed:', error instanceof Error ? error.message : 'Database request failed');
    return json({ error: 'Unable to update your calendar connection. Please try again.' }, { status: 500 });
  }
});
