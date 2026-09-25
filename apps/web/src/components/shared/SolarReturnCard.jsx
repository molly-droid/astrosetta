import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getSolarReturnInfo, getProfectionInfo, getYearLordTransitInfo } from '@/lib/solarReturn';
import { ordinal } from '@/lib/houseUtils';
import { PLANET_AS_YEAR_LORD, PROFECTION_HOUSE_DETAILS, TRANSIT_HOUSE_INTERPRETATION } from '@/lib/profectionContent';
import { fireBirthdayConfetti } from '@/lib/birthdayConfetti';

export default function SolarReturnCard({ chart, date = new Date(), transits = null, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const srInfo = getSolarReturnInfo(date, chart);
  const profInfo = getProfectionInfo(chart, date);
  const isBirthday = srInfo.isBirthday;

  // Fire confetti every time the card is expanded on the user's birthday
  useEffect(() => {
    if (expanded && isBirthday) {
      return fireBirthdayConfetti();
    }
  }, [expanded, isBirthday]);

  if (!profInfo) return null;

  const { daysUntilBirthday } = srInfo;
  const nearBirthday = !isBirthday && daysUntilBirthday <= 30;
  const lordData = PLANET_AS_YEAR_LORD[profInfo.yearLord] || {};
  const houseData = PROFECTION_HOUSE_DETAILS[profInfo.profectedHouse] || {};
  const transitInfo = getYearLordTransitInfo(chart, transits);

  return (
    <div className={`celestial-card overflow-hidden ${className}`}>
      <button onClick={() => setExpanded(o => !o)} className="w-full text-left px-4 py-3 hover:bg-gold-primary/5 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="text-lg text-gold-primary shrink-0" style={{ fontVariantEmoji: 'text' }}>☉</span>
          <div className="flex-1 min-w-0">
            {isBirthday ? (
              <>
                <p className="font-display text-sm font-semibold text-white">Happy Solar Return!</p>
                <p className="font-body text-[10px] text-brass/70">The Sun returns to its natal position — your personal new year begins.</p>
              </>
            ) : (
              <>
                <p className="font-display text-sm font-semibold text-white">Profection Year</p>
                <p className="font-body text-[10px] text-brass/70">
                  {ordinal(profInfo.profectedHouse)} house · Lord{' '}
                  <span style={{ fontVariantEmoji: 'text' }}>{profInfo.yearLordGlyph}</span>{' '}
                  {profInfo.yearLord}
                  {nearBirthday && ` · ${daysUntilBirthday}d to solar return`}
                </p>
              </>
            )}
          </div>
          {expanded ? <ChevronDown size={14} className="text-brass/50 shrink-0" /> : <ChevronRight size={14} className="text-brass/50 shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gold-primary/15 space-y-5 animate-fade-up">

          {/* How Profections Work */}
          <ProfectionExplainer age={srInfo.age} profectedHouse={profInfo.profectedHouse} />

          {/* The Activated House */}
          <ActivatedHouseSection profInfo={profInfo} houseData={houseData} />

          {/* The Year Lord */}
          <YearLordSection profInfo={profInfo} lordData={lordData} />

          {/* Year Lord Current Transit */}
          {transitInfo && <YearLordTransitSection transitInfo={transitInfo} />}

          {/* Year Ahead Synthesis */}
          <YearAheadSynthesis
            srInfo={srInfo}
            profInfo={profInfo}
            lordData={lordData}
            houseData={houseData}
            transitInfo={transitInfo}
          />

        </div>
      )}
    </div>
  );
}

function ProfectionExplainer({ age, profectedHouse }) {
  return (
    <div className="pt-3 space-y-2">
      <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70">How Profections Work</p>
      <p className="font-body text-xs text-white/75 leading-relaxed">
        Annual profections are a traditional timing technique that advances one house per year, starting from your Ascendant at birth. Each year of your life is "ruled" by the house that is activated and the planet that rules the sign on its cusp.
      </p>
      <p className="font-body text-xs text-brass/70 leading-relaxed">
        At age {age}, you are in your {ordinal(profectedHouse)} house profection year. This house and its ruling planet set the theme, focus, and tone for your entire year — from one solar return to the next.
      </p>
    </div>
  );
}

function ActivatedHouseSection({ profInfo, houseData }) {
  return (
    <div className="space-y-2">
      <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70">Your Activated House</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-display text-sm font-semibold text-gold-primary">{ordinal(profInfo.profectedHouse)} House</span>
        <span className="font-body text-xs text-gold-accent">{profInfo.profectedSign}</span>
        <span className="font-body text-[11px] text-brass/60">· {houseData.title}</span>
      </div>
      <p className="font-body text-xs text-white/80 leading-relaxed">{profInfo.theme}</p>
      {houseData.whatActivates && (
        <div>
          <p className="font-body text-[10px] text-gold-accent/60 uppercase tracking-wide mt-1">What activates</p>
          <p className="font-body text-xs text-brass/75 leading-relaxed">{houseData.whatActivates}</p>
        </div>
      )}
      {houseData.whatToExpect && (
        <div>
          <p className="font-body text-[10px] text-gold-accent/60 uppercase tracking-wide mt-1">What to expect</p>
          <p className="font-body text-xs text-brass/75 leading-relaxed">{houseData.whatToExpect}</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 mt-1">
        {houseData.focusAreas && (
          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(168,200,168,0.06)', border: '1px solid rgba(168,200,168,0.15)' }}>
            <p className="font-body text-[10px] text-celestial-green/80 uppercase tracking-wide mb-0.5">✦ Focus this year</p>
            <p className="font-body text-[11px] text-white/75 leading-relaxed">{houseData.focusAreas}</p>
          </div>
        )}
        {houseData.watchOuts && (
          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(216,180,194,0.06)', border: '1px solid rgba(216,180,194,0.15)' }}>
            <p className="font-body text-[10px] text-celestial-pink/80 uppercase tracking-wide mb-0.5">⚠ Watch for</p>
            <p className="font-body text-[11px] text-white/75 leading-relaxed">{houseData.watchOuts}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function YearLordSection({ profInfo, lordData }) {
  return (
    <div className="space-y-2">
      <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70">Your Year Lord</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-gold-primary text-lg" style={{ fontVariantEmoji: 'text' }}>{profInfo.yearLordGlyph}</span>
        <span className="font-display text-sm font-semibold text-gold-accent">{profInfo.yearLord}</span>
        <span className="font-body text-[11px] text-brass/60">· {lordData.title}</span>
      </div>
      <p className="font-body text-xs text-white/80 leading-relaxed">{lordData.archetype}</p>
      <p className="font-body text-xs text-brass/75 leading-relaxed">{lordData.asLord}</p>

      {/* Natal placement */}
      {profInfo.yearLordSign && (
        <div className="rounded-lg px-3 py-2 mt-1" style={{ background: 'rgba(212,175,133,0.06)', border: '1px solid rgba(212,175,133,0.15)' }}>
          <p className="font-body text-[10px] text-gold-accent/70 uppercase tracking-wide mb-1">Natal Placement</p>
          <p className="font-body text-xs text-white/85 leading-relaxed">
            Your year lord <span className="text-gold-accent font-semibold">{profInfo.yearLord}</span> is in{' '}
            <span className="text-gold-accent">{profInfo.yearLordSign}</span>
            {profInfo.yearLordHouse ? <> in your <span className="text-gold-accent">{ordinal(profInfo.yearLordHouse)} house</span></> : null}
            {' '}in your birth chart.
          </p>
          <p className="font-body text-[11px] text-brass/65 leading-relaxed mt-1 italic">{lordData.natalPlacementMeans}</p>
        </div>
      )}
      {lordData.watchOuts && (
        <p className="font-body text-[11px] text-celestial-pink/70 leading-relaxed">
          <span className="text-celestial-pink/80">⚠ Watch out: </span>{lordData.watchOuts}
        </p>
      )}
    </div>
  );
}

function YearLordTransitSection({ transitInfo }) {
  const houseInterp = transitInfo.natalHouseTransiting
    ? TRANSIT_HOUSE_INTERPRETATION[transitInfo.natalHouseTransiting]
    : null;
  return (
    <div className="space-y-2">
      <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70">Where Your Year Lord Is Now</p>
      <p className="font-body text-xs text-white/80 leading-relaxed">
        <span className="text-gold-primary" style={{ fontVariantEmoji: 'text' }}>{transitInfo.glyph}</span>{' '}
        <span className="text-gold-accent font-semibold">{transitInfo.name}</span> is currently transiting through{' '}
        <span className="text-gold-accent">{transitInfo.sign}</span>
        {transitInfo.retrograde && <span className="text-celestial-pink/80"> (retrograde)</span>}
        {transitInfo.natalHouseTransiting ? (
          <> — moving through your <span className="text-gold-accent">{ordinal(transitInfo.natalHouseTransiting)} house</span></>
        ) : null}.
      </p>
      {houseInterp && (
        <p className="font-body text-xs text-brass/75 leading-relaxed">
          This means your year lord is currently {houseInterp}, adding an extra layer of emphasis to that area of life right now.
          {transitInfo.retrograde && ' Its retrograde motion suggests a period of review and revisitation rather than forward momentum — reflect before acting.'}
        </p>
      )}
    </div>
  );
}

function YearAheadSynthesis({ srInfo, profInfo, lordData, houseData, transitInfo }) {
  return (
    <div className="rounded-lg px-3 py-3 space-y-2" style={{ background: 'rgba(212,175,133,0.08)', border: '1px solid rgba(212,175,133,0.2)' }}>
      <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/80">Your Year Ahead</p>
      <p className="font-body text-xs text-white/85 leading-relaxed">
        Your {srInfo.age}th year activates your <span className="text-gold-accent font-semibold">{ordinal(profInfo.profectedHouse)} house</span> — {houseData.title}. This sets the overall theme: {profInfo.theme.split('.')[0].toLowerCase()}.
      </p>
      <p className="font-body text-xs text-white/85 leading-relaxed">
        <span className="text-gold-primary" style={{ fontVariantEmoji: 'text' }}>{profInfo.yearLordGlyph}</span>{' '}
        <span className="text-gold-accent font-semibold">{profInfo.yearLord}</span> ({lordData.title}) rules this year, governing how its energy unfolds.
        {profInfo.yearLordSign ? (
          <> In your birth chart, {profInfo.yearLord} sits in <span className="text-gold-accent">{profInfo.yearLordSign}</span>{profInfo.yearLordHouse ? <> in your <span className="text-gold-accent">{ordinal(profInfo.yearLordHouse)} house</span></> : null}, channeling this year's focus through that life area.</>
        ) : null}
      </p>
      {transitInfo && (
        <p className="font-body text-xs text-white/85 leading-relaxed">
          Right now, your year lord is transiting <span className="text-gold-accent">{transitInfo.sign}</span>
          {transitInfo.natalHouseTransiting ? <> through your <span className="text-gold-accent">{ordinal(transitInfo.natalHouseTransiting)} house</span></> : null}
          {transitInfo.retrograde ? ', retrograde and inviting review' : ', moving forward'} — this colors the current phase of your year.
        </p>
      )}
      {srInfo.isBirthday && (
        <p className="font-body text-xs text-gold-primary/90 leading-relaxed font-medium pt-1">
          ✦ Solar return #{srInfo.solarReturnYear} — your personal new year. Set intentions aligned with your {ordinal(profInfo.profectedHouse)} house themes, and let your year lord {profInfo.yearLord} guide the way.
        </p>
      )}
    </div>
  );
}