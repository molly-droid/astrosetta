# Production domain smoke check

Verified November 12, 2026 after Molly updated Network Solutions DNS. The new
app became visible through the normal system resolver and Chrome at about
9:15 PM America/Toronto. Earlier checks correctly found the old Base44 site
through a cached system DNS answer, while authoritative DNS, Google DNS and
Cloudflare DNS already returned Vercel. No registrar changes were needed.

## Passed

- `astrosetta.com` resolves to `216.150.1.1` and serves the migrated Vercel app
  over valid HTTPS. Checked without a DNS override after propagation.
- `www.astrosetta.com` has the expected Vercel CNAME and redirects permanently
  (308) to `https://astrosetta.com/` over valid HTTPS.
- Chrome shows the migrated homepage on the real domain, including Instagram
  beside Legal and the official Google Play badge in the hero and footer.
- Google Play links to `com.astrosetta.app`; the official badge is stored locally
  and keeps its original proportions/clear space. Native app builds omit it.
- Password sign-in on the real domain worked with a confirmed disposable
  Supabase account, then loaded Home, Learn, Chart and My Info → Plan.
- The synthetic natal chart was calculated successfully using `astrology-api`
  and rendered on the real domain. The curriculum loaded from Supabase.
- The plan page showed Free as current and the founding Core/Premium upgrade
  prices of $5.55/$7.77 monthly. No purchase was started.
- The test session was signed out and its account, chart, progress, generated
  cache rows, request metrics and feed key were removed. Cleanup targeted only
  the exact disposable `cutover-qa-…@example.invalid` identity.
- A live read-only check confirmed all 48 migrated Supabase Auth accounts exist,
  have confirmed email addresses and link to their profiles. First-login
  password setup through Forgot password is still the intended migration flow.

## Deliberately held

**No email, test email, reset email or signup-confirmation email was triggered
by these checks. Jacob's explicit permission is required before sending.**

The welcome-email trigger remains disabled and all four scheduled email jobs
remain inactive. The QA account was created through the admin API with its
email already confirmed, so it did not need a verification email.

No live purchase, payment, Google OAuth consent or outgoing email-delivery test
was performed. These smoke checks are not a claim of exhaustive feature QA.
Base44 was never modified. Activity after the earlier Base44 export still needs
a read-only delta comparison before decommissioning that source.

Private HTTP results, backend calculation results, cleanup receipts and the
live footer screenshot are in
`~/Downloads/astrosetta-export-2026-11-12-IDX4aP/` under `live-domain-*` and
`cutover-*`. The test password was removed from the fixture receipt after cleanup.
