import React from 'react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

// Public "how to delete your account" page. Google Play's Data safety form
// requires a publicly reachable URL that names the app, lists the deletion
// steps, and says what is deleted and what is kept — this is that URL
// (/account-deletion). The actual deletion endpoint is /delete-account
// (emailed confirmation link); keep the two distinct.
export default function AccountDeletionPolicy() {
  return (
    <LegalPageLayout
      title="Account Deletion"
      subtitle="How to delete your Astrosetta account and the data that goes with it."
      lastUpdated="October 27, 2026"
    >
      <p>
        Astrosetta is operated by Sharp Energetics LLC. You can permanently delete your
        Astrosetta account and its data at any time, from inside the app or on the web —
        no email or support request required.
      </p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">How to delete your account</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Sign in to Astrosetta (in the mobile app or on the web).</li>
        <li>Open <strong>Profile</strong> and scroll to <strong>Delete Account</strong>.</li>
        <li>Tap <strong>Delete</strong> and confirm. We email you a confirmation link so nobody else can delete your account.</li>
        <li>Open the link in that email. Your account is deleted immediately once you confirm.</li>
      </ol>
      <p>
        If you can no longer sign in, email{' '}
        <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a>{' '}
        from the address on your account and we will process the deletion for you.
      </p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">What is deleted</h2>
      <p>Deletion is permanent and cannot be undone. It erases everything personal, including:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Your account, email address, and sign-in credentials</li>
        <li>Your birth date, birth time, and birth location</li>
        <li>Your natal charts, saved charts, readings, and Navigator conversations</li>
        <li>Your journal entries, planner notes, and learning progress</li>
        <li>Your preferences and settings</li>
      </ul>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">What is kept</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Anonymous, aggregate usage statistics that cannot be linked back to you.
        </li>
        <li>
          Payment and tax records that we are legally required to retain. These are held by our
          payment processors (Stripe, Apple, or Google) under their own retention policies.
        </li>
      </ul>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">Subscriptions</h2>
      <p>
        Subscriptions billed by card on the web are canceled automatically when your account is
        deleted, and your stored payment details are erased. Subscriptions billed through the App
        Store or Google Play are managed by Apple and Google — we cannot cancel those for you, so
        cancel them in your Apple or Google subscription settings to stop future charges.
      </p>

      <h2 className="font-display text-lg font-semibold text-foreground mt-6 mb-2">Questions</h2>
      <p>
        See our <a href="/privacy" className="text-gold-accent underline hover:text-gold-primary">Privacy Policy</a> for
        full details on how we handle data, or contact{' '}
        <a href="mailto:hello@astrosetta.com" className="text-gold-accent underline hover:text-gold-primary">hello@astrosetta.com</a>.
      </p>
    </LegalPageLayout>
  );
}
