import React from 'react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How Astrosetta collects, uses, and protects your data."
      lastUpdated="July 2, 2026"
    >
      <p>This Privacy Policy explains how Astrosetta ("we," "us," or "our"), operated by Sharp Energetics LLC, collects, uses, and protects information you provide when using our website and services (the "Service"). By using the Service, you agree to the practices described in this policy.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">1. Information We Collect</h2>
      <p><strong>Account Information:</strong> When you create an account, we collect your name and email address.</p>
      <p><strong>Birth Data:</strong> To generate your natal chart, we collect your birth date, birth time, and birth location. This data is used solely for astrological calculations and personalization.</p>
      <p><strong>Usage Data:</strong> We collect information about how you interact with the Service, including quiz answers, learning progress, and feature usage, to improve your experience and the Service itself.</p>
      <p><strong>Device and Technical Data:</strong> We may automatically collect your IP address, browser type, device information, and usage logs for security and analytics purposes.</p>
      <p><strong>Payment Information:</strong> We do not collect or store your full payment card details. Payment is processed directly by our payment processor, Stripe. We receive limited transaction metadata (e.g., subscription tier, payment status, last four digits of card) from Stripe.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">2. How We Use Your Information</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>To create and personalize your natal chart and daily readings.</li>
        <li>To track your learning progress, quiz streaks, and achievements.</li>
        <li>To send you service-related communications, such as daily or weekly emails (if opted in).</li>
        <li>To improve our content, features, and AI-generated interpretations.</li>
        <li>To prevent fraud, abuse, and unauthorized access to the Service.</li>
        <li>To comply with legal obligations and enforce our Terms of Service.</li>
      </ul>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">3. AI and Data Processing</h2>
      <p>Astrosetta uses AI models to generate personalized astrological interpretations based on your birth data and chart information. We do not sell your personal data to third parties. AI-generated content is for educational and entertainment purposes and should not be considered professional advice.</p>
      <p>Where we use third-party AI infrastructure providers to process this data, those providers are contractually restricted from using your data to train their own general-purpose models and are bound by confidentiality obligations.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">4. Data Sharing and Third Parties</h2>
      <p>We do not sell or rent your personal information. We may share data with trusted third-party service providers who help us operate the Service, including:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Payment processors</strong> (e.g., Stripe) for subscription billing.</li>
        <li><strong>Cloud hosting and infrastructure providers</strong> (e.g., Base44/Deno).</li>
        <li><strong>Calendar integration providers</strong> (e.g., Google Calendar), only when you explicitly connect them, and only the calendar data necessary to create and sync your personalized transit events.</li>
        <li><strong>Analytics providers</strong> to understand usage patterns.</li>
      </ul>
      <p>These providers are bound by their own privacy policies and are only given access to data necessary for their function. We require service providers who process personal data on our behalf to enter into data processing agreements consistent with applicable law.</p>

      <h3 className="font-display text-base font-semibold text-foreground mt-4 mb-1">Google API Services Compliance</h3>
      <p>Our use and transfer of information received from Google APIs (including Google Calendar) to any other app adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-gold-accent underline hover:text-gold-primary">Google API Services User Data Policy</a>, including the Limited Use requirements. We use Google Calendar data solely to create, read, and update calendar events reflecting your personalized astrological transits, as directed by you. We do not use this data for advertising, and we do not transfer it to third parties except as necessary to provide this feature or as required by law.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">5. Data Retention</h2>
      <p>We retain your data for as long as your account is active or as needed to provide the Service. When you delete your account:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Your personal data (account information, birth data, usage data) will be deleted or anonymized within <strong>30 days</strong>, except where retention is required by law (e.g., tax/billing records) or necessary to resolve disputes or enforce our agreements.</li>
        <li>Backup copies may persist for up to <strong>90 days</strong> before being purged as part of routine backup rotation.</li>
      </ul>
      <p>You may request deletion of your account and associated data at any time by contacting us through the feedback feature or support channels listed below.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">6. Data Security</h2>
      <p>We take reasonable measures to protect your data using industry-standard security practices, including encryption in transit and access controls on our infrastructure. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>
      <p><strong>Breach notification:</strong> In the event of a data breach affecting your personal information, we will notify affected users without undue delay and in accordance with applicable law, through email and/or an in-app notice.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">7. Cookies and Tracking Technologies</h2>
      <p>We use cookies and similar technologies to operate and improve the Service. See our <a href="/cookie-policy" className="text-gold-accent underline hover:text-gold-primary">Cookie Policy</a> for full details, including categories of cookies used, retention periods, and how to manage your preferences. We do not use cookies for targeted advertising. The Service is not currently configured to respond to browser "Do Not Track" signals.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">8. Your Privacy Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Access the personal data we hold about you.</li>
        <li>Request correction or deletion of your data.</li>
        <li>Opt out of marketing communications.</li>
        <li>Withdraw consent for data processing.</li>
        <li>Request a copy of your data in a portable format.</li>
      </ul>
      <p><strong>California residents:</strong> See our <a href="/california-privacy-notice" className="text-gold-accent underline hover:text-gold-primary">California Privacy Notice</a> for rights specific to the CCPA/CPRA, including the categories of personal information we collect and disclose, and how to submit a verifiable consumer request.</p>
      <p><strong>EU/UK/EEA residents:</strong> If applicable to your usage of the Service, you may have additional rights under the GDPR/UK GDPR, including the right to lodge a complaint with your local supervisory authority. You may contact us to inquire about the lawful basis for processing your data.</p>
      <p>To exercise any of these rights, contact us at the information provided in Section 12. We will respond within the timeframe required by applicable law (generally 30–45 days).</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">9. Children's Privacy</h2>
      <p>The Service is not intended for individuals under <strong>18 years of age</strong>. We do not knowingly collect data from anyone under 18. If you believe a minor has provided us with information, please contact us for prompt removal.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">10. International Data Transfers</h2>
      <p>Your data may be processed by our hosting and AI infrastructure providers in locations outside your home country. Where this occurs, we rely on appropriate safeguards such as standard contractual clauses to ensure a level of data protection consistent with applicable law. We will update this section as our infrastructure providers and data-center locations are finalized.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">11. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the updated policy on this page, updating the "Last updated" date, and — for material changes affecting how we use your data — via email or an in-app notice. Continued use of the Service after changes constitutes acceptance of the updated policy.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">12. Contact Us</h2>
      <p>If you have questions about this Privacy Policy or your data, please contact us through the feedback feature in the app or at <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a>.</p>
    </LegalPageLayout>
  );
}