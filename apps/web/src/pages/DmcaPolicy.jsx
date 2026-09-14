import React from 'react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export default function DmcaPolicy() {
  return (
    <LegalPageLayout
      title="DMCA / Copyright Policy"
      subtitle="How to report and respond to copyright infringement claims."
      lastUpdated="July 2, 2026"
    >
      <p>Astrosetta respects the intellectual property rights of others and expects users of the Service to do the same. This policy explains how to report claimed copyright infringement and how we respond, in accordance with the Digital Millennium Copyright Act (DMCA).</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">1. Filing a Takedown Notice</h2>
      <p>If you believe content on the Service infringes your copyright, send a written notice to our designated agent (contact details below) that includes:</p>
      <ol className="list-decimal pl-5 space-y-1">
        <li>A physical or electronic signature of the copyright owner or a person authorized to act on their behalf.</li>
        <li>Identification of the copyrighted work claimed to have been infringed.</li>
        <li>Identification of the material claimed to be infringing, with enough detail for us to locate it on the Service (e.g., a URL or in-app location).</li>
        <li>Your contact information (name, address, phone number, and email).</li>
        <li>A statement that you have a good-faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</li>
        <li>A statement, made under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorized to act on their behalf.</li>
      </ol>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">2. Designated Agent</h2>
      <p>Sharp Energetics LLC<br />Designated DMCA Agent<br />Email: <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a><br />State of jurisdiction: Nebraska, USA</p>
      <p className="text-sm text-white/50 italic">Note: This agent must also be registered with the U.S. Copyright Office's DMCA Designated Agent Directory (including a physical address) for the safe-harbor protections in this policy to apply. A physical mailing address will be added here once the agent registration is finalized.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">3. Our Response</h2>
      <p>Upon receiving a valid notice, we will:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Remove or disable access to the allegedly infringing material.</li>
        <li>Notify the user who posted the material, where applicable.</li>
        <li>Document the notice and our response for our records.</li>
      </ul>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">4. Counter-Notification</h2>
      <p>If you believe material you posted was removed in error or misidentification, you may submit a counter-notice to our designated agent including:</p>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Your physical or electronic signature.</li>
        <li>Identification of the material removed and its location before removal.</li>
        <li>A statement, under penalty of perjury, that you have a good-faith belief the material was removed as a result of mistake or misidentification.</li>
        <li>Your name, address, phone number, and a statement consenting to the jurisdiction of the federal court in your district (or, if outside the U.S., an appropriate judicial district), and that you will accept service of process from the person who filed the original notice.</li>
      </ol>
      <p>Upon receiving a valid counter-notice, we may reinstate the material within 10–14 business days, unless the original complainant files a court action seeking a restraining order.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">5. Repeat Infringers</h2>
      <p>We reserve the right to terminate the accounts of users who are found to be repeat infringers, in accordance with our Terms of Service.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">6. Third-Party and Crowdsourced Content</h2>
      <p>Where the Service incorporates content derived from third-party public sources (e.g., community-sourced interpretation content), we take reasonable steps to respect the terms of use of the originating platforms and to avoid reproducing substantial or protected portions of any individual work. If you believe such derived content improperly incorporates your original work, please follow the notice procedure above.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">7. Contact</h2>
      <p>General questions about this policy (not takedown notices, which must go to the designated agent above) can be sent through the in-app feedback feature or to <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a>.</p>
    </LegalPageLayout>
  );
}