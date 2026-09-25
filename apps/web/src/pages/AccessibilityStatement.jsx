import React from 'react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export default function AccessibilityStatement() {
  return (
    <LegalPageLayout
      title="Accessibility Statement"
      subtitle="Astrosetta's commitment to digital accessibility."
      lastUpdated="July 2, 2026"
    >
      <p>At Astrosetta, we believe astrological wisdom should be accessible to everyone. We are committed to making our website and services (the "Service") as accessible and usable as possible for all users, including those with disabilities.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">1. Our Commitment</h2>
      <p>We are actively working toward conformance with the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA, the internationally recognized standard for web accessibility. Our goal is to ensure that all users can perceive, understand, navigate, and interact with the Service.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">2. What We've Done</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Designed the Service with a high-contrast dark theme with gold accents for readability.</li>
        <li>Provided font size controls so users can adjust text to their preferred scale.</li>
        <li>Used semantic HTML and ARIA labels where appropriate to support screen readers.</li>
        <li>Ensured keyboard navigability for core features and interactive elements.</li>
      </ul>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">3. Known Limitations</h2>
      <p>While we strive for full accessibility, some areas may not yet meet WCAG 2.1 AA standards. We are continuously auditing and improving the Service, and we prioritize accessibility issues as they are identified.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">4. Feedback</h2>
      <p>If you encounter any accessibility barriers while using the Service, please let us know. Your feedback is invaluable in helping us improve. You can report accessibility issues through the in-app feedback feature or our support channels. Please include:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>A description of the issue you encountered.</li>
        <li>The page or feature where the issue occurred.</li>
        <li>The device, browser, and assistive technology you were using (if applicable).</li>
      </ul>
      <p>We aim to respond to accessibility feedback within <strong>5 business days</strong> and to address identified issues in a timely manner.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">5. Third-Party Content</h2>
      <p>The Service may include content or features from third-party providers. While we encourage our partners to prioritize accessibility, we cannot guarantee that all third-party content meets the same accessibility standards.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">6. Changes to This Statement</h2>
      <p>We may update this Accessibility Statement as we continue to improve the Service's accessibility. Material changes will be reflected by an updated "Last updated" date.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">7. Contact</h2>
      <p>Questions about this Accessibility Statement can be sent through the feedback feature in the app or to <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a>.</p>
    </LegalPageLayout>
  );
}