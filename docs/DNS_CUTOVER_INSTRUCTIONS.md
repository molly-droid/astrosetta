# DNS instructions for Molly

Checked November 12, 2026. DNS is currently hosted on Network Solutions
nameservers (`ns99.worldnic.com`, `ns100.worldnic.com`). The root still points
to `216.24.57.1`, and `www` points to `base44.onrender.com`.

The Vercel project currently has only `astrosetta.vercel.app` attached. No DNS
or Vercel domain settings were changed during this investigation.

## Message to Molly

Before you switch the domain, I'll check for any new Base44 records since the
export so nobody's recent work gets missed.

1. Open the Astrosetta project's [domain settings in Vercel](https://vercel.com/molly-droids-projects/astrosetta/settings/domains).
2. Click **Add Existing**, add `astrosetta.com`, and also add
   `www.astrosetta.com`. Keep `astrosetta.com` as the main address and redirect
   `www` to it. Vercel will show the DNS values to enter.
3. Sign in to Network Solutions, select `astrosetta.com`, then open
   **Advanced Tools → Advanced DNS Records → Manage**.
4. Edit these two existing records using the exact values Vercel shows:

   | Type | Host | Current value | New value |
   | --- | --- | --- | --- |
   | A | `@` or the root domain | `216.24.57.1` | The A-record IP shown by Vercel |
   | CNAME | `www` | `base44.onrender.com` | The CNAME target shown by Vercel |

5. Leave the nameservers and email records in place, including MX, SPF, DKIM
   and DMARC. If Vercel requests an ownership-verification TXT record, add that
   specific record alongside the existing TXT records.
6. Save, then let me know so I can check that both addresses reach the new
   app and password recovery works on the main domain. The customer email
   will stay on hold until Jacob explicitly approves sending it.

Use the values from this project's Vercel settings rather than a generic
Vercel IP or the `astrosetta.vercel.app` URL. Domain records can be specific to
the project. DNS updates may take time to reach every visitor.

Sources: [Vercel custom domains](https://vercel.com/docs/domains/set-up-custom-domain),
[Network Solutions advanced DNS](https://www.networksolutions.com/help/article/manage-dns-adns-records).
