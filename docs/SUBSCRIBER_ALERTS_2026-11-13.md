# Plan summary and subscriber alerts

Molly requested monthly/yearly membership badges, Sun/Moon/Rising on My Info's
Plan tab, and new-subscriber emails to her admin address or hello@astrosetta.com.
Jacob authorized implementation. The configured recipient is hello@astrosetta.com.

## Plan page

- The current membership summary shows Free/Core/Premium and Monthly/Yearly.
  Free and unmanaged complimentary access show No billing. Unverified paid
  periods show Billing period unavailable instead of an inferred duration.
- The current annual plan card shows its annual price. Native prices come from
  the store; web annual prices remain $55 for Core and $77 for Premium.
- The same summary shows Sun, Moon and Rising from the account's own natal chart.
  Unknown birth times suppress estimated rising signs and explain how to add one.
- Billing cadence is projected from the same winning entitlement as access.
  Stripe uses its recurring price interval; RevenueCat uses the configured product
  suffix or Google base-plan identifier. Trial duration is never treated as a
  billing interval. Browser users cannot edit their billing cadence.

## Notification behavior

- Future accounts are enrolled by an insert trigger. A completed onboarding
  record queues their signup notice. Existing accounts are not enrolled or
  replayed during installation.
- The first provider-confirmed Free-to-Core/Premium transition queues a subscription
  notice, including a card-required trial. Existing beta members upgrading qualify.
  A first provider purchase after unmanaged complimentary access also qualifies.
  Renewals, paid plan switches, profile edits and repeated webhooks do not.
- A two-minute delay coalesces signup/purchase activity. A Free signup notice is
  skipped if a paid subscription is already active. A new Free registration and
  a later first subscription can each produce one appropriate lifecycle message.
- Alerts contain name, email, plan and billing period. Free includes no chart
  signs, Core includes Sun only, and Premium includes Sun/Moon/Rising. Missing
  signs and unknown birth times are reported honestly. Trials are labelled.
- All mail goes to the fixed admin recipient. The endpoint accepts only the
  service credential, never an arbitrary browser-supplied recipient or profile.
- The private outbox has one unique row per account and notice kind. An atomic
  claim admits one worker. One message is processed per cron invocation, once a
  minute. Processing/failed rows are never retried automatically after uncertain
  provider acceptance; inspect the receipt before any manual recovery.
- The configuration starts disabled, so metadata refresh and rollout verification
  cannot produce a historical burst. Enable only after checking the empty queue.

## Rollout verification

34 offline handler/regression tests and disposable PostgreSQL tests passed,
including winning-entitlement cadence, tier-specific email fields, HTML escaping,
unknown birth times, client denial, no legacy signup backfill, duplicate events,
timeout handling and exactly one successful claim from 20 concurrent workers.
Mobile previews covered monthly/yearly, 320-pixel widths, unknown-time signs and
the new admin email. Verification did not send an admin test or another launch
announcement.

Molly's current Apple subscription was refreshed from RevenueCat as Monthly.
One older Stripe customer reference was not found under the live Stripe account;
its existing access was preserved and its cadence remains unverified. The private
refresh receipt records the affected account outside Git. Unmanaged complimentary
access was preserved. The temporary metadata refresh function was removed.

Safari instructions now cover the page menu/Reader icon, Share, View More and Add
to Home Screen, with a direct-Share alternative for other layouts. This appears
on the public site, in-app guide and future onboarding email. The reusable launch
draft also reflects it; already-sent announcements are not resent.

The earlier chart-dialog, Sun-sign sharing and blue/cream card fixes remain in
commit `3164a7e`. The web receives these UI changes via Vercel; bundled iOS/Android
apps need their next native build and release.

References: [RevenueCat customer model](https://www.revenuecat.com/docs/api-v1/customer-info-model),
[RevenueCat base-plan identifiers](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields),
[Safari page menu](https://support.apple.com/guide/iphone/browse-the-web-iph1fbef4daa/27/ios/27).
