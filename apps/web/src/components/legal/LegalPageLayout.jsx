import React from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';

export default function LegalPageLayout({ title, subtitle, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-cream">
      <PageHeader>
        <div className="max-w-3xl mx-auto px-6 py-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 font-body text-xs text-brass/60 hover:text-gold-primary transition-colors">
            ← Back to Astrosetta
          </Link>
          <p className="font-body text-xs uppercase tracking-widest text-gold-accent mb-2">Legal</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">{title}</h1>
          {subtitle && <p className="font-body text-sm text-brass/70 mb-3">{subtitle}</p>}
          {lastUpdated && (
            <p className="font-body text-xs text-brass/40">Last updated: {lastUpdated}</p>
          )}
        </div>
      </PageHeader>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="font-body text-sm text-white leading-relaxed space-y-4 [&_h2]:text-gold-primary">
          {children}
        </div>
      </div>

      <footer className="text-center pb-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2rem' }}>
        <div className="flex items-center justify-center mb-3">
          <img
            src="https://media.base44.com/images/public/69fcbc50df58f65eac4fd0a6/8a82dfec1_Asset24x.png"
            alt="Astrosetta"
            className="h-10 w-auto"
          />
        </div>
        <div className="flex items-center justify-center mb-3">
          <Link to="/legal" className="font-body text-xs transition-colors hover:text-white text-brass/40">Legal</Link>
        </div>
        <p className="font-body text-xs text-brass/40">© 2026 Sharp Energetics LLC</p>
      </footer>
    </div>
  );
}