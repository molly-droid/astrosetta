# Beta launch announcement delivery

Jacob authorized a personalized updated preview to Molly, then a two-recipient
pilot using his original admin beta account and one other eligible beta member.
Resend displayed Delivered for all three of these exact messages. After reviewing
the pilot, Jacob explicitly requested sending the remaining announcements.

- Original verified beta cohort: 48 unique accounts and email addresses.
- Already covered by Molly's delivered preview: 1.
- Delivered pilot messages: 2.
- Remaining messages sent individually and accepted by Resend: 45.
- No recipients remain queued or held in this campaign.
- The 45 remainder messages have provider acceptance receipts; this record does
  not claim that all 45 have been delivered or opened.

The campaign rendered each greeting from the account's display name or full name.
It used Molly's original subject without a test label and the reviewed trial,
Google sign-in, password recovery, Google Play and Home Screen instructions.
The existing admin profile's name produced the greeting "Hi Silex".

The private campaign directory contains the cohort snapshot, exact per-recipient
HTML, hashes, submission times and provider IDs. No recipient list or credentials
are committed. `scripts/email-previews/launch-batch.mjs` supports manual batches
only, revalidates beta eligibility before sending, spaces submissions, and saves
each submission to its ledger before calling the provider. An uncertain or already
submitted message cannot be retried automatically. The completed remainder is
locked against another release.

No Base44 records were changed and no recurring launch campaign was created.
