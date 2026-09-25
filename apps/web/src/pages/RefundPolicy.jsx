import React from 'react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export default function RefundPolicy() {
  return (
    <LegalPageLayout
      title="Refund Policy"
      subtitle="How refunds work for Astrosetta subscriptions."
      lastUpdated="July 2, 2026"
    >
      <p>This Refund Policy supplements our <a href="/terms" className="text-gold-accent underline hover:text-gold-primary">Terms of Service</a> and describes how refunds work for Astrosetta subscriptions.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">1. Free Tier</h2>
      <p>The free tier of the Service is offered free of charge. No payment is collected for it, and this Refund Policy applies only to paid subscriptions.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">2. Founding Member and Standard Subscriptions</h2>
      <p>Subscriptions (Core, Premium, and any Founding Member pricing tier) are billed in advance on a recurring monthly basis through Stripe.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">3. Refund Eligibility</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>New subscribers:</strong> If you are charged for a new subscription and did not intend to subscribe, you may request a full refund within <strong>7 days</strong> of the initial charge, provided you have not substantially used paid-tier features (e.g., Adept/Maestro-tier quizzes, AI rubric scoring).</li>
        <li><strong>Renewals:</strong> Recurring renewal charges are generally non-refundable. If you intended to cancel before a renewal and the cancellation did not process due to a technical error on our end, contact us within <strong>7 days</strong> of the renewal charge for a review.</li>
        <li><strong>Mid-cycle cancellations:</strong> Canceling a subscription stops future billing but does not entitle you to a prorated refund for the remainder of the current billing period; you retain access through the end of the period you already paid for.</li>
        <li><strong>Discretionary refunds:</strong> Outside the above, refunds may be issued at our sole discretion, e.g., for demonstrated billing errors, duplicate charges, or extended Service outages.</li>
      </ul>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">4. How to Request a Refund</h2>
      <p>Contact us through the in-app feedback feature or at our support channels, including your account email and the date of the charge. We aim to respond to refund requests within <strong>5 business days</strong>.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">5. Payment Processor</h2>
      <p>All payments are processed by Stripe. Refunds, once approved, are issued to the original payment method and may take <strong>5–10 business days</strong> to appear, depending on your bank or card issuer.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">6. Chargebacks</h2>
      <p>If you initiate a chargeback with your bank instead of contacting us first, we reserve the right to suspend your account pending resolution.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">7. Changes to This Policy</h2>
      <p>We may update this Refund Policy from time to time. We will provide advance notice of material changes consistent with our Terms of Service.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">8. Contact</h2>
      <p>Questions about refunds can be sent through the feedback feature in the app or to <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a>.</p>
    </LegalPageLayout>
  );
}