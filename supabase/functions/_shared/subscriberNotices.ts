export const SUBSCRIBER_NOTICE_EMAIL = 'hello@astrosetta.com';
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function subscriberNoticeMessage(user: any, chart: any, now = Date.now()) {
  const expired = user.subscription_expires && Date.parse(user.subscription_expires) <= now;
  const tier = expired ? 'free' : user.subscription_tier;
  const plan = tier === 'calendar' ? 'Premium' : tier === 'interpret' ? 'Core' : 'Free';
  const period = tier === 'free' ? 'Not applicable (Free)'
    : user.subscription_billing_period === 'monthly' ? 'Monthly'
      : user.subscription_billing_period === 'yearly' ? 'Yearly' : 'Not available';
  const raw = chart?.raw_data || {};
  const planets = Array.isArray(raw.planets) ? raw.planets : [];
  const planetSign = (name: string) => planets.find((p: any) => p.name === name || p.planet === name)?.sign;
  const sun = raw.sun_sign || chart?.sun_sign || planetSign('Sun') || 'Not available';
  const moon = raw.moon_sign || chart?.moon_sign || planetSign('Moon') || 'Not available';
  const rising = raw.unknown_time || chart?.unknown_time ? 'Not available (birth time unknown)'
    : raw.ascendant_sign || raw.angles?.ascendant?.sign || chart?.ascendant_sign || 'Not available';
  const details: [string, unknown][] = [
    ['Name', user.display_name || user.full_name || 'Not provided'],
    ['Email', user.email || 'Not provided'], ['Plan', plan], ['Billing', period],
  ];
  if (tier === 'interpret' || tier === 'calendar') details.push(['Sun', sun]);
  if (tier === 'calendar') details.push(['Moon', moon], ['Rising', rising]);
  if (tier !== 'free' && user.subscription_is_trial) details.push(['Status', 'Trial active']);
  const heading = tier === 'free' ? 'New Free signup' : `New ${plan} subscription`;
  const rows = details.map(([label, value]) => `<tr><th align="left" style="padding:10px 12px;border-bottom:1px solid #E5DDCE;font:14px Georgia,serif;color:#84632D;">${escape(label)}</th><td style="padding:10px 12px;border-bottom:1px solid #E5DDCE;font:14px/1.5 Georgia,serif;color:#2C3E50;overflow-wrap:anywhere;">${escape(value)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#EDE9E1;"><table role="presentation" width="100%" style="max-width:600px;margin:auto;background:#FDFBF7;border:1px solid #D9C9AC;border-radius:12px;"><tr><td style="padding:28px;"><p style="font:12px Georgia,serif;letter-spacing:2px;color:#84632D;">✦ ASTROSETTA ADMIN ✦</p><h1 style="font:26px Georgia,serif;color:#2C3E50;">${heading}</h1><table width="100%" style="border-collapse:collapse;background:#F5F1E8;">${rows}</table><p style="font:13px/1.6 Georgia,serif;color:#625441;margin-top:20px;">${tier === 'free' ? 'This account has completed onboarding.' : 'Subscription access is confirmed by the billing provider.'}</p><a href="https://astrosetta.com/admin" style="font:14px Georgia,serif;color:#84632D;">Open Astrosetta Admin</a></td></tr></table></body></html>`;
  return { to: SUBSCRIBER_NOTICE_EMAIL, subject: `Astrosetta: ${heading}`, html };
}

export async function deliverNextSubscriberNotice(db: any, send: (message: any) => Promise<any>) {
  const { data: configuration, error: configError } = await db.from('subscriber_notice_configuration').select('enabled').eq('id', true).single();
  if (configError) throw configError;
  if (!configuration?.enabled) return { skipped: true, reason: 'disabled' };
  const { data: notices, error: claimError } = await db.rpc('claim_subscriber_notice');
  if (claimError) throw claimError;
  const notice = notices?.[0];
  if (!notice) return { sent: 0, reason: 'no pending notices' };
  const finish = async (status: string, extra: any = {}) => {
    const { error } = await db.from('subscriber_notice_delivery').update({ status, completed_at: new Date().toISOString(), ...extra }).eq('id', notice.id);
    if (error) throw error;
  };
  try {
    const { data: user, error: userError } = await db.from('users').select('*').eq('id', notice.user_id).maybeSingle();
    if (userError) throw userError;
    const paid = user && ['interpret', 'calendar'].includes(user.subscription_tier)
      && (!user.subscription_expires || Date.parse(user.subscription_expires) > Date.now());
    if (!user || (notice.kind === 'signup' && paid) || (notice.kind === 'subscription' && !paid)) {
      await finish('skipped', { detail: !user ? 'Account removed' : 'Superseded by current membership' });
      return { sent: 0, skipped: true };
    }
    const { data: chart, error: chartError } = await db.from('chart').select('raw_data,sun_sign,moon_sign,ascendant_sign')
      .eq('user_id', user.id).order('created_date', { ascending: true }).limit(1).maybeSingle();
    if (chartError) throw chartError;
    const result = await send(subscriberNoticeMessage(user, chart));
    if (!result?.id) throw new Error('No provider receipt; review before retrying');
    await finish('sent', { provider_id: result.id });
    return { sent: 1, id: notice.id };
  } catch (error) {
    await finish('failed', { detail: 'Delivery needs manual review before any retry' });
    throw error;
  }
}
