import React, { useState, useEffect } from 'react';
import { getRecentFeatures } from '@/lib/featureAnnouncements';
import { fetchActiveHighlight } from '@/lib/featureSchedule';

// "New in Beta" — showcases the currently-scheduled feature highlight (admin
// controlled via the Feature Highlights tab), falling back to the 2 most
// recent static feature additions when nothing is scheduled live.
export default function InteractiveFeatures() {
  const [featured, setFeatured] = useState(null); // scheduled live highlight or null
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let done = false;
    (async () => {
      const live = await fetchActiveHighlight('homepage');
      if (!done) { setFeatured(live); setChecked(true); }
    })().catch(() => { if (!done) setChecked(true); });
    return () => { done = true; };
  }, []);

  const cards = featured
    ? [{
        spotlight_key: featured.spotlight_key,
        title: featured.title,
        subtitle: featured.subtitle,
        description: featured.description,
        icon: featured.icon || 'Sparkles',
        deep_link: featured.deep_link,
        unlock: featured.unlock,
        date: featured.go_live_date,
      }]
    : getRecentFeatures(2);

  const isFeaturedSingle = !!featured;

  return (
    <section className="px-6 py-16 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <p className="font-body text-xs uppercase tracking-widest mb-2" style={{ color: '#C9A961' }}>{isFeaturedSingle ? 'Featured now' : "What's new"}</p>
        <h2 className="font-display text-3xl font-bold text-white">Tools that grow with you</h2>
        <p className="font-body text-sm mt-3 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
          The latest additions to your astrology toolkit.
        </p>
      </div>

      <div className={`grid gap-5 ${isFeaturedSingle ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
        {cards.map((f) => {
          return (
            <div
              key={f.spotlight_key}
              className="rounded-2xl p-6 flex flex-row items-start gap-4"
              style={{ background: 'rgba(201,169,97,0.06)', border: '1px solid rgba(201,169,97,0.2)', backdropFilter: 'blur(8px)' }}
            >
              <div className="text-left flex-1">
                <h3 className="font-display text-lg font-bold text-white mb-1.5">{f.title}</h3>
                {f.subtitle && <p className="font-body text-[11px] text-gold-accent mb-1">{f.subtitle}</p>}
                <p className="font-body text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{f.description}</p>
                {f.unlock && (
                  <p className="font-body text-[10px] mt-2 inline-block px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,169,97,0.12)', border: '1px solid rgba(201,169,97,0.25)', color: '#C9A961' }}>
                    {f.unlock}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}