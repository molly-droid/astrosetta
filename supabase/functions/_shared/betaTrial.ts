export const BETA_TRIAL_CAMPAIGN = 'base44-beta-december-2026';
export const BETA_TRIAL_END = '2027-01-01T06:00:00.000Z'; // midnight America/Chicago
export const TRIAL_CHECKOUT_MINIMUM_MS = 49 * 60 * 60 * 1000;

export async function betaTrialOffer(db: any, user: any, now = Date.now()) {
  const { data, error } = await db.from('beta_trial_members')
    .select('trial_ends_at,redeemed_at,stripe_subscription_id').eq('user_id', user.id).maybeSingle();
  if (error) throw error; // billing must fail closed on lookup errors
  const activePlan = ['interpret','calendar'].includes(user.subscription_tier)
    && (!user.subscription_expires || Date.parse(user.subscription_expires) > now);
  return {
    eligible: Boolean(data && !data.redeemed_at && !activePlan
      && !user.founding_rate_forfeited_at && user.is_founding_member === true
      && Date.parse(data.trial_ends_at) - now > TRIAL_CHECKOUT_MINIMUM_MS),
    endsAt: data?.trial_ends_at ? new Date(data.trial_ends_at).toISOString() : null,
  };
}

export function betaTrialCheckoutOptions(endsAt: string, period: string, now = Date.now()) {
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end) || end - now <= TRIAL_CHECKOUT_MINIMUM_MS) throw new Error('The beta trial signup period has ended');
  if (!['monthly','yearly'].includes(period)) throw new Error('Invalid subscription period');
  const renewal = period === 'yearly' ? '$77/year' : '$7.77/month';
  return {
    adaptive_pricing: { enabled: false },
    payment_method_collection: 'always',
    payment_method_types: ['card'],
    expires_at: Math.floor(now / 1800000) * 1800 + 3600,
    allow_promotion_codes: false,
    custom_text: { submit: { message: `Premium is free through December 31, 2026. Card required. Your subscription renews at ${renewal} on January 1, 2027 unless you cancel beforehand in Manage billing.` } },
    subscription_data: {
      trial_end: Math.floor(end / 1000),
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    },
  };
}
