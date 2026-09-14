import React from 'react';

export default function AboutAppTab() {
  return (
    <div className="space-y-5">
      <div className="celestial-card p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gold-accent font-display text-xl">✦</span>
          <p className="font-display text-base font-bold text-white">Astrosetta</p>
        </div>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          Astrosetta started because astrology is one of the richest symbolic languages we have, and most apps either boil it down to a daily blurb or assume you already know how to read a chart.
        </p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          This began as a personal project to actually learn what all these symbols mean, and to see them moving against the real sky instead of on a static page. The goal was always to teach you how to read the stars yourself, rather than handing you someone else's interpretation. Today Astrosetta covers natal charts, daily and monthly transits, synastry and event charts, three astrological traditions (Modern, Hellenistic, and Vedic), a full learning curriculum spanning foundations through classical techniques (essential dignities, the Part of Fortune, and the goddess asteroids), a planner with journaling and calendar sync, adjustable knowledge density, and a chart navigator — all rooted in real planetary positions.
        </p>
      </div>

      <div className="celestial-card p-4 space-y-2">
        <p className="font-display text-sm font-bold text-white">How we use AI</p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          Astrosetta uses large language models in a specific way. AI doesn't make up your horoscope from nothing. It takes real astrological data (actual planetary positions, real aspects, your actual natal chart) and turns that into readable language.
        </p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          The quiz system goes a step further: AI generates questions based on what's actually happening in the sky today. So you're always learning in context, encountering the symbols as they move, rather than memorizing definitions from a textbook.
        </p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          The aim is not to be your astrologer. It's to hand you the tools — a clickable glossary that defines every term the moment you meet it, a full curriculum from foundations to classical techniques, and language that invites rather than declares — so you can discern for yourself. If you use the interpretations, wonderful. But the north star is that you develop the fluency to form your own view, not adopt ours. We try to offer all the information available and let you make up your own mind, rather than handing you a single defined perspective.
        </p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          Beyond generated content, the long-term vision includes spotlighting real people. A featured astrologer section will highlight practitioners whose interpretations and insights shape the community, giving credit where it's due and letting you follow voices that resonate with you. The same goes for designers and visual artists who contribute the imagery and aesthetic that makes the learning modules feel like something worth returning to.
        </p>
      </div>

      <div className="celestial-card p-4 space-y-2">
        <p className="font-display text-sm font-bold text-white">The intention</p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          The north star is democratized knowledge. Astrology has historically lived behind gatekeepers — practitioners, paid courses, someone else's verdict on your chart. Astrosetta is built to put the full toolkit in your hands instead: the symbols, the structures, the interpretations, and the living sky, all in one place, so the only authority you need to consult is your own discernment.
        </p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          That means we deliberately try not to have a defined perspective. Wherever we can, we offer all the information available — traditional and modern, essential dignity and psychological archetype, the classical technique and the lived question — and let you make up your own mind. The language invites rather than states outright, because meaning in astrology is co-created between the chart and the person reading it. The goal is for you to become your own astrologer, not to stay ours.
        </p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          The long-term vision is a community of practitioners who can genuinely read a chart — people who develop the fluency to interpret for themselves and eventually for others. Community contribution tools are the next step toward that: a space where experienced practitioners will be able to submit, rate, and refine interpretations that benefit the whole community.
        </p>
      </div>

      <div className="celestial-card p-4 space-y-1">
        <p className="font-display text-sm font-bold text-white">Creator</p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          Astrosetta is designed and built by Molly Sharp, an astrology enthusiast who wanted a better way to learn the craft by watching the sky move in real time.
        </p>
      </div>

      <p className="font-body text-[11px] text-white/30 text-center pt-2">
        Astrosetta · Built with care
      </p>
    </div>
  );
}