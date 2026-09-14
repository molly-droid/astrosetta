import React from 'react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export default function TermsOfService() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="The terms under which you may use Astrosetta."
      lastUpdated="July 2, 2026"
    >
      <p>These Terms of Service ("Terms") govern your use of the Astrosetta website and services (the "Service"), operated by Sharp Energetics LLC. By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">1. Description of Service</h2>
      <p>Astrosetta is an astrology learning platform that generates personalized natal charts, daily transit readings, educational content, and AI-powered interpretations. Features may change, be added, or removed at any time.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">2. Eligibility</h2>
      <p>You must be at least <strong>18 years old</strong> to use the Service. By using the Service, you represent that you meet this requirement and are legally able to enter into a binding agreement. The Service is not directed at, and should not be used by, anyone under 18.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">3. Your Account</h2>
      <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You agree to provide accurate information when creating your account and to keep it updated. You must notify us immediately of any unauthorized use of your account.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">4. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Use the Service for any unlawful or unauthorized purpose.</li>
        <li>Attempt to disrupt, reverse engineer, or gain unauthorized access to the Service or its systems.</li>
        <li>Use automated tools to scrape, collect, or extract data from the Service.</li>
        <li>Submit content that is harmful, offensive, defamatory, or infringes on others' rights.</li>
        <li>Share your account credentials or resell access to the Service without authorization.</li>
      </ul>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">5. User-Submitted Content</h2>
      <p>You may submit interpretations, feedback, quiz answers, and other content to the Service. You retain ownership of your content but grant Astrosetta a non-exclusive, royalty-free, worldwide license to use, reproduce, display, and process it within the Service and for improving the Service. You are responsible for ensuring your content does not violate any third-party rights. See our <a href="/dmca" className="text-gold-accent underline hover:text-gold-primary">DMCA / Copyright Policy</a> for how we handle infringement claims involving user-submitted content.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">6. AI-Generated Content and Astrological Disclaimer</h2>
      <p>The Service uses AI to generate astrological interpretations and educational content. AI-generated content may contain inaccuracies and should not be relied upon as professional, medical, financial, or legal advice. You use the Service and its content at your own discretion and risk.</p>
      <p><strong>Astrological Guidance Disclaimer:</strong> All astrological interpretations, readings, syntheses, and educational content provided by Astrosetta are offered strictly for educational and entertainment purposes. Astrology is a symbolic system and its interpretations are subjective. Nothing on the Service constitutes professional advice of any kind, including but not limited to medical, psychological, legal, financial, or relationship advice. You should always consult a qualified professional for matters requiring expert guidance. Astrosetta does not guarantee any specific outcomes based on astrological information, and you assume full responsibility for any decisions or actions you take based on! Service content.</p>
      <p><strong>No Reliance:</strong> You acknowledge that planetary positions, transit calculations, and AI-generated syntheses may contain errors or omissions. You should not make significant life decisions solely based on Service content.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">7. Subscriptions and Billing</h2>
      <p>Astrosetta offers free and paid subscription tiers. The free tier includes the natal chart, transit tracking, the learning curriculum, and the daily quiz.</p>
      <p><strong>Auto-renewal:</strong> Paid subscriptions automatically renew at the end of each billing period (monthly) unless canceled before the renewal date. You will be charged using the payment method on file at the then-current subscription price, unless you have locked-in founding member pricing (see below). A subscription only auto-renews once a valid payment method is on file and active billing has begun; no charge occurs, and no auto-renewal is triggered, before that point.</p>
      <p><strong>Founding member pricing:</strong> Founding member pricing, if applicable, is locked for the lifetime of an active, continuously-renewing subscription. If a founding member subscription lapses or is canceled, re-subscribing later may be at then-current standard pricing, at our discretion.</p>
      <p><strong>Price changes:</strong> We will provide at least 30 days' advance notice by email before any increase to your subscription price takes effect. Continued use after the effective date constitutes acceptance of the new price.</p>
      <p><strong>Cancellation and refunds:</strong> You may cancel your subscription at any time; cancellation takes effect at the end of the current billing period, and you retain access until then. See our <a href="/refund-policy" className="text-gold-accent underline hover:text-gold-primary">Refund Policy</a> for details on refund eligibility.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">8. Intellectual Property</h2>
      <p>The Service, including its design, content, software, and features, is owned by Astrosetta / Sharp Energetics LLC and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works from the Service without our written permission.</p>
      <p><strong>Your Birth Data:</strong> You retain ownership of your birth data (birth date, time, and location). By entering this data, you grant Astrosetta a limited license to process it solely for the purpose of generating your chart, readings, and related features within the Service.</p>
      <p><strong>AI-Generated Syntheses:</strong> The astrological interpretations, daily syntheses, and AI-generated content produced by the Service are the intellectual property of Astrosetta. While you may view and use these readings for personal, non-commercial purposes, you may not reproduce, redistribute, or commercially exploit them without our written permission.</p>
      <p><strong>Educational Content:</strong> Curriculum content, learning modules, and associated materials are owned by Astrosetta or its licensors and are provided for your personal learning use only.</p>
      <p><strong>Trademarks:</strong> "Astrosetta," the Astrosetta logo, and associated marks are trademarks of Sharp Energetics LLC. You may not use them without our prior written consent.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">9. Third-Party Services</h2>
      <p>The Service may integrate with third-party platforms (e.g., Google Calendar). Your use of these integrations is subject to the third party's terms and privacy policy. We are not responsible for the practices of third-party services.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">10. Copyright Infringement / DMCA</h2>
      <p>If you believe content on the Service infringes your copyright, please see our <a href="/dmca" className="text-gold-accent underline hover:text-gold-primary">DMCA / Copyright Policy</a> for how to submit a takedown notice.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">11. Termination</h2>
      <p>We may suspend or terminate your account at any time, with or without cause, and — except where notice is required by law — without notice. Upon termination, your right to use the Service ceases immediately. You may delete your account at any time through the Service or by contacting us.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">12. Disclaimer of Warranties</h2>
      <p>The Service is provided "as is" and "as available" without warranties of any kind, express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or accurate. Astrological content is for educational and entertainment purposes only.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">13. Limitation of Liability</h2>
      <p>To the maximum extent permitted by law, Astrosetta shall not be liable for any indirect, incidental, consequential, or damages arising from your use of or inability to use the Service. Our total liability shall not exceed the amount you have paid in the preceding twelve (12) months.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">14. Indemnification</h2>
      <p>You agree to indemnify and hold Astrosetta harmless from any claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your infringement of any third-party rights.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">15. Dispute Resolution</h2>
      <p>Any dispute arising from these Terms or your use of the Service shall first be attempted to be resolved through informal negotiation. If the dispute cannot be resolved informally, it shall be resolved in the courts of competent jurisdiction as specified in Section 17, unless we mutually agree to binding arbitration. We may update this section with specific arbitration and class-action waiver provisions prior to the launch of paid tiers.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">16. Changes to These Terms</h2>
      <p>We may update these Terms from time to time. We will notify you of significant changes by posting the updated terms on this page and updating the "Last updated" date. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">17. Governing Law</h2>
      <p>These Terms are governed by the laws of the United States and the State of Nebraska, without regard to conflict of law principles. Any disputes shall be resolved in the courts of competent jurisdiction located in Nebraska, unless otherwise required by Section 15.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">18. Contact</h2>
      <p>If you have questions about these Terms, please contact us through the feedback feature in the app or at <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a>.</p>
    </LegalPageLayout>
  );
}