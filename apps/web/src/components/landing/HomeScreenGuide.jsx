import React from 'react';
import { Apple, Smartphone } from 'lucide-react';
import { isNativePlatform } from '@/lib/platform';

export default function HomeScreenGuide() {
  if (isNativePlatform()) return null;

  return (
    <section id="home-screen" aria-labelledby="home-screen-heading" className="px-6 pb-16 max-w-5xl mx-auto scroll-mt-24">
      <div className="rounded-3xl border border-gold-accent/20 bg-white/[0.03] p-6 sm:p-8">
        <p className="font-body text-xs uppercase tracking-widest text-gold-accent mb-2">Take Astrosetta with you</p>
        <h2 id="home-screen-heading" className="font-display text-2xl sm:text-3xl font-bold text-white">Add Astrosetta to your Home Screen</h2>
        <p className="font-body text-sm text-white/70 leading-relaxed mt-3 max-w-2xl">
          Open your chart with a tap. Use the same email to keep your chart, progress and plan. An internet connection is required.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mt-7">
          <div className="rounded-2xl border border-white/10 p-5">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-white">
              <Apple size={20} className="text-gold-accent shrink-0" aria-hidden="true" />
              iPhone or iPad
            </h3>
            <ol className="list-decimal pl-5 mt-4 space-y-3 font-body text-sm leading-relaxed text-white/75 marker:text-gold-accent">
              <li>Visit <span className="text-white">astrosetta.com</span> in <strong className="text-white">Safari</strong>.</li>
              <li>Choose <strong className="text-white">Share</strong>, the square with an upward arrow. You may need to open the page menu or <strong className="text-white">More</strong> first.</li>
              <li>Find <strong className="text-white">Add to Home Screen</strong>. Enable <strong className="text-white">Open as Web App</strong> if shown, then select <strong className="text-white">Add</strong>.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-white/10 p-5">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-white">
              <Smartphone size={20} className="text-gold-accent shrink-0" aria-hidden="true" />
              Android
            </h3>
            <ol className="list-decimal pl-5 mt-4 space-y-3 font-body text-sm leading-relaxed text-white/75 marker:text-gold-accent">
              <li>Visit <span className="text-white">astrosetta.com</span> in <strong className="text-white">Chrome</strong>.</li>
              <li>Open the <strong className="text-white">three-dot menu</strong>. Look for <strong className="text-white">Install and create shortcut</strong>, <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home screen</strong>.</li>
              <li>Follow the prompts to install or add the shortcut.</li>
            </ol>
            <p className="font-body text-xs leading-relaxed text-white/60 mt-4">Prefer the Android app? Use the Google Play badge on this page.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
