# Card-required Premium trial for migrated beta members

Jacob approved this flow on November 13, 2026: the existing beta users start on
Free and choose to upgrade through Stripe. Checkout requires a card. Premium
then stays free through December 31, 2026, and renews on January 1, 2027 unless
the member cancels. Monthly renewal is USD 7.77; annual renewal is USD 77.

## Cohort and access

- `public.beta_trial_members` contains the 48 canonical Supabase IDs from the
  verified Base44 import map. Names, emails and the private map are outside Git.
- New accounts do not enter this table. Founding-member pricing alone does not
  qualify an account for the trial. The client cannot insert or redeem a row.
- At setup, 47 cohort accounts were Free. One admin account already held Premium;
  its existing billing and founding-rate status were left alone.
- No membership access is granted by the cohort row, opening checkout, returning
  to a success URL, or supplying a client-side trial flag. Access follows the
  signed Stripe webhook and the normal billing snapshot projection.
- Members who do not complete checkout remain Free. The beta offer is Premium,
  including all Core features. Eligible accounts cannot accidentally buy Core
  immediately through a stale checkout page instead of taking the trial.
- Native store purchase flows remain unchanged. Members start the Stripe offer
  on the website; the resulting account tier is shared with the installed apps.

## Billing safeguards

- Exact trial end: `2027-01-01T06:00:00Z`, midnight in America/Chicago.
- `payment_method_collection=always`, card payment method, a fixed `trial_end`,
  and cancellation if a payment method is unexpectedly absent at trial end.
- USD-only trial checkout avoids automatic currency conversion conflicting with
  the advertised founding price. The live price IDs are checked against USD
  777/month or 7700/year before the trial session is created.
- Existing subscriptions are checked before checkout. Open trial sessions are
  reused; a changed billing period expires the older open session.
- Customer/session creation is idempotent. An atomic redemption RPC records one
  winning subscription per member. A duplicate completed trial is cancelled
  without invoicing or proration, and remaining open offer sessions are expired.
- Trial cancellation or expiry without conversion does not forfeit founding-price
  eligibility. A paid conversion clears the trial marker, so the existing rule
  for a later paid lapse still applies.
- Signup stops 49 hours before the deadline to meet Stripe's trial timing
  constraints and leave time for the short-lived checkout session to complete.

## Free-plan enforcement

The old server-wide beta override is disabled in the shared AI permission code.
Daily email content uses the actual plan. Weekly/monthly digests require current
Core/Premium access, including an active trial, and still respect opt-outs and
one-delivery-per-period safeguards. No historical emails are replayed.

## Email templates

- Molly's launch announcement draft now explains card-required trial signup and
  the January 1 renewal. After rollout checks, Jacob separately authorized one
  updated personalized preview to Molly on November 13. Resend confirmed delivery.
  Jacob subsequently approved the pilot and released the remainder. All 48
  original beta accounts are now covered; see `LAUNCH_EMAIL_DELIVERY_2026-11-13.md`.
- The regular onboarding chart recap and legacy welcome template include the
  Google Play badge/link, Safari Home Screen instructions and a reminder to use
  the same account. They do not advertise beta trials to new subscribers.
- The old brief welcome database trigger remains disabled; only the intended
  existing detailed onboarding path is used. No schedule or recipient list was
  triggered while updating these templates.
- The recap's unauthenticated cross-recipient invocation path now requires the
  service credential. An ordinary signed-in caller receives only their own mail.
- Offline onboarding preview: `node scripts/email-previews/onboarding.cjs`.

## Validation

- Billing/trial/checkout and related regression tests passed. Coverage includes
  forged trial requests, new-account exclusion, card collection, fixed expiry,
  exact renewal amounts, duplicate redemption and preservation of founding rates.
- Disposable PostgreSQL tests passed, including cohort RLS, protected trial
  status, read-time expiry and paid-conversion lapse handling.
- Email schedule tests cover Free/expired exclusion and active-trial inclusion.
- The web production build passed. A stale calendar test was corrected to reflect
  the existing B-16 requirement that private journal notes are not exported.
- Live Stripe account verified as Astrosetta. Both renewal prices are live USD
  prices and the webhook is enabled for checkout, invoice and subscription events.
- A disposable QA account verified the plan page and live hosted checkout. No
  card was entered and no subscription or payment was completed. QA checkout
  sessions/customers/accounts are removed after verification.

Primary provider references:

- [Stripe Checkout trial configuration](https://docs.stripe.com/payments/checkout/free-trials)
- [Stripe Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create)
- [Apple Home Screen instructions](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios)

The announcement was released with Jacob's explicit approval after pilot review
on November 13. Its delivery ledger is separate from normal scheduled email.

## Production verification completed

- Implementation commit `f8afcd3` is deployed to Vercel and the production
  Supabase project. The production website serves the updated trial interface.
- Live hosted monthly and annual trial checkout both showed $0 due today and
  required card collection. The renewal prices are $7.77/month and $77/year.
  No card was entered and no subscription or payment was completed in QA.
- Removing the disposable account from the cohort made a forged trial request
  fail with HTTP 409. Its ordinary monthly checkout showed the normal 777-cent
  amount due, with no beta trial metadata. Free Navigator access returned HTTP 403.
- The Google Play badge and Safari Home Screen instructions were checked in the
  rendered onboarding email preview. Both onboarding email functions are deployed.
- All disposable QA checkout resources, the empty Stripe customer, Supabase auth
  account and owned conversation were removed. The cohort contains the original
  48 members. The temporary service-authenticated diagnostic function was deleted.
- No announcement, preview email or digest was sent by these verification steps.
  Normal intended application email flows remain enabled.
