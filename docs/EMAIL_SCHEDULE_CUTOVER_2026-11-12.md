# Email schedule cutover

Jacob approved disabling the four Base44 email schedules and setting up their
replacements in the new app. After Jacob flagged the two remaining active
workflows, Bug Report Admin Alert and Daily Ephemeris Cross-Check were also
deactivated. Base44 data and application code remain read-only. At cutover,
the launch announcement remained held while one personalized Molly preview was
separately approved and delivered. Jacob later approved the pilot and remainder
on November 13; see `LAUNCH_EMAIL_DELIVERY_2026-11-13.md`.

## Source system

Verified after reloading Base44's Workflows page:

- Daily Email Digest: inactive already after consecutive failures.
- Weekly Email Digest: deactivated and verified inactive.
- Monthly Email Digest: deactivated and verified inactive.
- Weekly Feedback Digest: deactivated and verified inactive.

Bug Report Admin Alert and Daily Ephemeris Cross-Check were initially left
unchanged, then deactivated following Jacob's follow-up. A fresh page reload
confirmed all eight listed Base44 workflows inactive. Supabase's replacement
ephemeris job is active, and its bug-report trigger is enabled and invokes
`notify-admin-bug-report`. No test bug report was inserted and no email was sent
for this check. Source charts, users, application code and other records were
not edited.

## New app

- Daily, weekly and monthly customer digests start at 7am America/Chicago.
- Weekly runs Mondays; monthly runs on the first.
- One recipient per minute during 7am through 8:59am limits each invocation's
  work. Current membership fits this 120-recipient window. Review capacity before
  exceeding that number of eligible recipients in any digest.
- UTC polling covers both daylight-saving offsets. The handler checks the local
  window and date before doing work.
- Weekly feedback goes only to hello@astrosetta.com, Mondays at 8am Central,
  and is skipped when there is no feedback.
- Customer recipients must have a chart and the relevant preference explicitly
  enabled. Imported opt-outs are preserved. Multiple charts cannot create
  multiple deliveries to the same email address.
- A database primary key permits one delivery claim per digest, normalized
  recipient and current local day/week/month. Concurrent runs and manual admin
  routine sends share these claims.
- Failed or uncertain deliveries remain claimed. They require investigation
  before a manual retry; an automatic retry could duplicate a message the
  provider already accepted. No past digest periods are replayed.
- Service-authenticated dry runs report counts without generating content,
  claiming deliveries or sending email.
- The short chart welcome trigger stays disabled. Normal onboarding sends the
  detailed birth-chart recap instead. Migration scripts do not invoke that
  client-side onboarding path. Password recovery and normal user-triggered auth
  emails remain available.

## Validation

- Four focused tests cover Chicago dates/DST, concurrent claims, uncertain send
  failures, database failure, explicit preferences, no-send dry runs and a
  single recipient per scheduled invocation.
- Disposable PostgreSQL regression suite passed, including exactly one of 20
  concurrent delivery inserts succeeding and client roles denied ledger access.
- Existing ported digest modules still have legacy strict TypeScript errors;
  these are not a clean full-project typecheck. Deployment bundles and the
  focused executable tests validate the changed delivery paths.
- Production setup and no-send dry-run results are recorded below after rollout.

## Operations

The private delivery ledger is `public.email_digest_delivery`. Investigate
`processing` rows that remain after the function lifetime, and `failed` rows.
A `sent` row means the provider accepted the email, not confirmed inbox delivery.
Use its provider ID to check Resend delivery/bounce status. Do not delete uncertain
claims and rerun without checking the provider first.

To pause all four digest schedules without affecting authentication or onboarding:

```sql
select cron.alter_job(jobid, active := false) from cron.job
where jobname in ('daily-email-digest', 'weekly-email-digest',
                 'monthly-email-digest', 'weekly-feedback-digest');
```

The migrations leave schedules paused until the matching functions are deployed
and no-send checks pass. An operator then activates those four existing job IDs.

## Production rollout results

All four functions deployed successfully. Service-authenticated no-send dry runs
returned HTTP 200. All four unauthenticated scheduled requests returned HTTP 401.

| Digest | Eligible chart owners | Excluded by preference |
| --- | ---: | ---: |
| Daily | 41 | 11 |
| Weekly | 52 | 0 |
| Monthly | 52 | 0 |

Feedback dry run confirmed one admin recipient. All dry runs reported outside
the delivery window. The delivery ledger remained empty, confirming the checks
created no claims and sent no digest email.

The four Supabase digest jobs were then activated. Daily delivery first becomes
due November 13 at 7am Central, weekly November 16, and monthly December 1.
Normal membership changes and email preferences can alter these recipient counts.
The short chart welcome trigger remains disabled. No migration announcement was
sent to the member list, and no historical digest was queued for catch-up.

Private verification artifacts, including the old schedules screenshot and exact
job/dry-run responses, are in the migration export directory outside Git.
