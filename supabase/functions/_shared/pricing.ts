export function checkoutPrice(tier: string, period: string, founding: boolean, env: (key: string) => string | undefined) {
  if (!['interpret', 'calendar'].includes(tier) || !['monthly', 'yearly'].includes(period)) {
    throw new Error('Invalid subscription plan');
  }
  const prefix = `STRIPE_${tier.toUpperCase()}`;
  // Annual prices are $55/$77 for both cohorts. Existing monthly IDs represent
  // the beta founding prices; standard prices must be configured explicitly.
  const price = period === 'yearly' ? env(`${prefix}_YEARLY_PRICE_ID`)
    : founding ? env(`${prefix}_FOUNDING_PRICE_ID`) || env(`${prefix}_PRICE_ID`)
      : env(`${prefix}_STANDARD_PRICE_ID`);
  if (!price) throw new Error('This subscription price is not configured yet');
  return price;
}
