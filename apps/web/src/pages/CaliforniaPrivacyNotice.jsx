import React from 'react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export default function CaliforniaPrivacyNotice() {
  return (
    <LegalPageLayout
      title="California Privacy Notice"
      subtitle="Additional privacy rights for California residents under CCPA/CPRA."
      lastUpdated="July 2, 2026"
    >
      <p>This California Privacy Notice supplements our <a href="/privacy" className="text-gold-accent underline hover:text-gold-primary">Privacy Policy</a> and applies to California residents, in accordance with the California Consumer Privacy Act as amended by the California Privacy Rights Act (CCPA/CPRA).</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">1. Categories of Personal Information We Collect</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gold-primary/20">
              <th className="text-left py-2 pr-4 text-gold-primary font-display font-semibold">Category</th>
              <th className="text-left py-2 pr-4 text-gold-primary font-display font-semibold">Examples</th>
              <th className="text-left py-2 text-gold-primary font-display font-semibold">Collected?</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            <tr className="border-b border-white/[0.06]">
              <td className="py-2 pr-4 font-semibold">Identifiers</td>
              <td className="py-2 pr-4">Name, email address</td>
              <td className="py-2">Yes</td>
            </tr>
            <tr className="border-b border-white/[0.06]">
              <td className="py-2 pr-4 font-semibold">Sensitive personal information</td>
              <td className="py-2 pr-4">Birth date, time, and location (used for chart calculation)*</td>
              <td className="py-2">Yes</td>
            </tr>
            <tr className="border-b border-white/[0.06]">
              <td className="py-2 pr-4 font-semibold">Internet/network activity</td>
              <td className="py-2 pr-4">IP address, browser type, usage logs, in-app interactions</td>
              <td className="py-2">Yes</td>
            </tr>
            <tr className="border-b border-white/[0.06]">
              <td className="py-2 pr-4 font-semibold">Commercial information</td>
              <td className="py-2 pr-4">Subscription tier, transaction history</td>
              <td className="py-2">Yes</td>
            </tr>
            <tr className="border-b border-white/[0.06]">
              <td className="py-2 pr-4 font-semibold">Geolocation data</td>
              <td className="py-2 pr-4">Approximate location (from birth location entry; not device GPS tracking)</td>
              <td className="py-2">Limited</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-semibold">Inferences</td>
              <td className="py-2 pr-4">Derived astrological profile / chart data used for personalization</td>
              <td className="py-2">Yes</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-white/60">*Birth date is treated with care as it can indicate age; we do not use it to infer or target based on protected characteristics.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">2. Purposes for Collection and Use</h2>
      <p>We collect and use the categories above to: provide and personalize the Service (chart generation, transit readings, quizzes), process payments, maintain security and prevent fraud, communicate with you, and improve the Service, as described in our Privacy Policy.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">3. Sources of Personal Information</h2>
      <p>Directly from you (account signup, birth data entry, quiz interactions); automatically through your use of the Service (device/usage data); and from service providers (e.g., Stripe transaction confirmations, Google Calendar when you connect it).</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">4. Disclosures of Personal Information</h2>
      <p>We disclose personal information to the service provider categories described in our Privacy Policy (payment processors, hosting/infrastructure providers, calendar integration providers, analytics providers) for the business purposes described there. We do not sell personal information, and we do not share personal information for cross-context behavioral advertising, as those terms are defined under the CPRA.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">5. Your California Rights</h2>
      <p>Subject to certain exceptions, California residents have the right to:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Know/Access</strong> — request the categories and specific pieces of personal information we've collected about you.</li>
        <li><strong>Delete</strong> — request deletion of personal information we've collected from you.</li>
        <li><strong>Correct</strong> — request correction of inaccurate personal information.</li>
        <li><strong>Opt-out of sale/sharing</strong> — we do not sell or share personal information as defined by the CPRA, so no opt-out mechanism is currently required; this will be revisited if that changes.</li>
        <li><strong>Limit use of sensitive personal information</strong> — request that we limit use of sensitive personal information (e.g., birth data) to what's necessary to provide the Service. We already limit our use in this way by default.</li>
        <li><strong>Non-discrimination</strong> — we will not discriminate against you for exercising any of these rights.</li>
      </ul>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">6. How to Submit a Request</h2>
      <p>Submit a verifiable consumer request through the in-app feedback feature or at <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a>. We will need to verify your identity (typically by confirming account details) before processing the request. You may designate an authorized agent to make a request on your behalf, subject to verification.</p>
      <p>We will respond within 45 days, with a possible one-time 45-day extension where reasonably necessary, as permitted by law.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">7. Shine the Light</h2>
      <p>California Civil Code Section 1798.83 permits California residents to request information about disclosures of personal information to third parties for their direct marketing purposes. We do not share personal information for third parties' direct marketing purposes.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">8. Contact</h2>
      <p>Questions about this notice can be sent through the feedback feature in the app or to <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a>.</p>
    </LegalPageLayout>
  );
}