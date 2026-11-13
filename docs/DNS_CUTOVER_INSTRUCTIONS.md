# DNS instructions for Molly

DNS is hosted on Network Solutions nameservers (`ns99.worldnic.com`,
`ns100.worldnic.com`). Before the November 12 cutover, the root pointed to
`216.24.57.1` and `www` pointed to `base44.onrender.com`.

**Completed later November 12:** Molly applied the values below. Both domains
now reach the new app with valid HTTPS, and www redirects to the root. Earlier
old-site responses were cached DNS; the former addresses above are historical.
See [live verification](./LIVE_DOMAIN_VERIFICATION_2026-11-12.md).

Both custom domains are now attached in Vercel. `astrosetta.com` connects to
Production and `www.astrosetta.com` permanently redirects to it (308). Both
were initially awaiting the DNS changes below, which Molly has now completed.

## Message to Molly

Before you switch the domain, I'll check for any new Base44 records since the
export so nobody's recent work gets missed.

1. Sign in to Network Solutions, select `astrosetta.com`, then open
   **Advanced Tools → Advanced DNS Records → Manage**.
2. Edit these two existing records using these exact values from Vercel:

   | Type | Host | Current value | New value |
   | --- | --- | --- | --- |
   | A | `@` or the root domain | `216.24.57.1` | `216.150.1.1` |
   | CNAME | `www` | `base44.onrender.com` | `e2ee201d16cf5b41.vercel-dns-016.com.` |

3. Leave the nameservers and email records in place, including MX, SPF, DKIM
   and DMARC. If Vercel requests an ownership-verification TXT record, add that
   specific record alongside the existing TXT records.
4. Save, then let me know so I can check that both addresses reach the new
   app and password recovery works on the main domain. The customer email
   will stay on hold until Jacob explicitly approves sending it.

These values were read from this project's [Vercel domain settings](https://vercel.com/molly-droids-projects/astrosetta/settings/domains)
after adding the domains. DNS updates may take time to reach every visitor.

Sources: [Vercel custom domains](https://vercel.com/docs/domains/set-up-custom-domain),
[Network Solutions advanced DNS](https://www.networksolutions.com/help/article/manage-dns-adns-records).
