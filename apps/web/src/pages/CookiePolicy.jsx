import React from 'react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export default function CookiePolicy() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      subtitle="How Astrosetta uses cookies and tracking technologies."
      lastUpdated="July 2, 2026"
    >
      <p>This Cookie Policy explains how Astrosetta uses cookies and similar tracking technologies when you visit or use our website and app (the "Service").</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">1. What Are Cookies</h2>
      <p>Cookies are small text files stored on your device when you visit a website or use an app. They help the site function, remember your preferences, and understand how the Service is used.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">2. Categories of Cookies We Use</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gold-primary/20">
              <th className="text-left py-2 pr-4 text-gold-primary font-display font-semibold">Category</th>
              <th className="text-left py-2 pr-4 text-gold-primary font-display font-semibold">Purpose</th>
              <th className="text-left py-2 text-gold-primary font-display font-semibold">Can you disable?</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            <tr className="border-b border-white/[0.06]">
              <td className="py-2 pr-4 font-semibold">Essential</td>
              <td className="py-2 pr-4">Required for login, session management, and core Service functionality (e.g., keeping you signed in, remembering your subscription status).</td>
              <td className="py-2 text-white/60">No — disabling prevents the Service from working.</td>
            </tr>
            <tr className="border-b border-white/[0.06]">
              <td className="py-2 pr-4 font-semibold">Preference</td>
              <td className="py-2 pr-4">Remembers settings such as display options, timezone, and other configuration choices so you don't have to reset them each visit.</td>
              <td className="py-2 text-white/60">Yes, via browser settings.</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-semibold">Analytics</td>
              <td className="py-2 pr-4">Helps us understand how users interact with the Service (e.g., which features are used, session length) so we can improve performance and content. May be set by us or by third-party analytics providers.</td>
              <td className="py-2 text-white/60">Yes, via browser settings or, where available, an in-app analytics opt-out.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3">We do <strong>not</strong> use cookies for targeted or third-party advertising, and we do not sell information collected via cookies.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">3. Third-Party Cookies</h2>
      <p>Some cookies may be set by third-party service providers we use for analytics or infrastructure (e.g., a hosting or analytics platform). These providers' use of cookies is governed by their own privacy and cookie policies.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">4. How to Manage Cookies</h2>
      <p>You can control or delete cookies through your browser settings. Most browsers let you:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>View what cookies are stored and delete them individually.</li>
        <li>Block third-party cookies.</li>
        <li>Block all cookies from specific sites, or all sites.</li>
      </ul>
      <p>Note that disabling essential cookies will prevent you from logging in or using core features of the Service. The Service is not currently configured to respond to "Do Not Track" browser signals.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">5. Changes to This Policy</h2>
      <p>We may update this Cookie Policy from time to time. Material changes will be reflected by an updated "Last updated" date and, where required by law, additional notice.</p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">6. Contact Us</h2>
      <p>Questions about this policy can be sent through the feedback feature in the app or to <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a>.</p>
    </LegalPageLayout>
  );
}