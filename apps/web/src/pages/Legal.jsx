import React from 'react';
import { Link } from 'react-router-dom';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import DeleteAccountSection from '@/components/profile/DeleteAccountSection';
import { Shield, Cookie, RefreshCw, FileText, MapPin, Accessibility, ClipboardList } from 'lucide-react';

const POLICIES = [
  {
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your personal data.',
    href: '/privacy',
    icon: Shield,
  },
  {
    title: 'Privacy at a Glance',
    description: 'A plain-English summary of exactly what data Astrosetta collects and why — like the App Store privacy label.',
    href: '/privacy-label',
    icon: ClipboardList,
  },
  {
    title: 'Terms of Service',
    description: 'The terms under which you may use Astrosetta.',
    href: '/terms',
    icon: FileText,
  },
  {
    title: 'Cookie Policy',
    description: 'How we use cookies and tracking technologies.',
    href: '/cookie-policy',
    icon: Cookie,
  },
  {
    title: 'Refund Policy',
    description: 'How refunds work for Astrosetta subscriptions.',
    href: '/refund-policy',
    icon: RefreshCw,
  },
  {
    title: 'DMCA / Copyright Policy',
    description: 'How to report and respond to copyright infringement claims.',
    href: '/dmca-policy',
    icon: FileText,
  },
  {
    title: 'California Privacy Notice',
    description: 'Additional privacy rights for California residents under CCPA/CPRA.',
    href: '/california-privacy-notice',
    icon: MapPin,
  },
  {
    title: 'Accessibility Statement',
    description: 'Our commitment to digital accessibility.',
    href: '/accessibility',
    icon: Accessibility,
  },
];

export default function Legal() {
  return (
    <LegalPageLayout
      title="Legal"
      subtitle="Policies and terms governing your use of Astrosetta."
      lastUpdated="July 2, 2026"
    >
      <div className="grid gap-3">
        {POLICIES.map(({ title, description, href, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className="flex items-start gap-4 rounded-xl p-4 transition-colors hover:bg-white/[0.04] border border-white/[0.06] hover:border-gold-primary/20"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(201,169,97,0.08)' }}>
              <Icon size={18} className="text-gold-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-white text-sm mb-0.5">{title}</h3>
              <p className="font-body text-xs text-white/50 leading-relaxed">{description}</p>
            </div>
            <span className="font-body text-xs text-gold-accent/40 mt-1.5 shrink-0">→</span>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-xl p-4 border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <p className="font-body text-xs text-white/50 leading-relaxed">
          Astrosetta is operated by <strong className="text-white/70">Sharp Energetics LLC</strong>, a Nebraska limited liability company.
          For legal inquiries, contact <a href="mailto:molly@sharpenergetics.com" className="text-gold-accent underline hover:text-gold-primary">molly@sharpenergetics.com</a>.
          These documents are drafts for attorney review and are updated as the Service evolves.
        </p>
      </div>

      {/* Account deletion — kept at the very bottom of the info page */}
      <div className="mt-6">
        <DeleteAccountSection />
      </div>
    </LegalPageLayout>
  );
}