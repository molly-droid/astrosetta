import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Star, CalendarDays, ArrowRight, Moon, TrendingUp, Check, Lock, MousePointer, Users, MessageCircle, Gauge, Scroll, Sparkles } from 'lucide-react';
import ChartWheel from '@/components/chart/ChartWheel';
import { getTodayChartData, getTodayIngresses } from '@/lib/clientAstro';
import IngressBanner from '@/components/planner/IngressBanner';
import { ReadingDemo, QuizDemo, ProgressDemo } from '@/components/landing/InteractiveDemos';
import TestimonialCarousel from '@/components/landing/TestimonialCarousel';
import InteractiveFeatures from '@/components/landing/InteractiveFeatures';
import FeatureExampleModal, { FEATURE_EXAMPLES } from '@/components/landing/FeatureExampleModal';
import LandingSidebar from '@/components/landing/LandingSidebar';
import EventBanner from '@/components/landing/EventBanner';
import ComparisonStrip from '@/components/landing/ComparisonStrip';
import { track, EVENTS } from '@/lib/analytics';

// ── Starfield canvas ──────────────────────────────────────────────────────────
function Starfield() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 120 }, () => {
      const depth = Math.random();
      return {
        xFrac: Math.random(), yFrac: Math.random(),
        radius: 0.3 + depth * 1.4,
        baseOpacity: 0.1 + depth * 0.5,
        depth,
        twinkleSpeed: 0.004 + depth * 0.018,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleAmp: 0.08 + depth * 0.28,
      };
    });

    const onMouse = (e) => {
      targetRef.current = { x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 };
    };
    window.addEventListener('mousemove', onMouse, { passive: true });

    let frameId;
    const draw = () => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      mouseRef.current = {
        x: mouseRef.current.x + (targetRef.current.x - mouseRef.current.x) * 0.03,
        y: mouseRef.current.y + (targetRef.current.y - mouseRef.current.y) * 0.03,
      };
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      stars.forEach(s => {
        const px = s.xFrac * w + mx * s.depth * 30;
        const py = s.yFrac * h + my * s.depth * 30;
        s.twinklePhase += s.twinkleSpeed;
        const op = Math.max(0, Math.min(1, s.baseOpacity + Math.sin(s.twinklePhase) * s.twinkleAmp));
        if (s.radius > 1 && op > s.baseOpacity + 0.1) {
          ctx.beginPath(); ctx.arc(px, py, s.radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212,175,133,${op * 0.1})`; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(px, py, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212,175,133,${op})`; ctx.fill();
      });
      frameId = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(frameId); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMouse); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />;
}

// ── Reusable components ───────────────────────────────────────────────────────
function CtaButton({ onClick, disabled, children, secondary = false }) {
  if (secondary) {
    return (
      <button onClick={onClick} className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-body font-semibold text-sm transition-all hover:bg-white/10" style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}>
        {children}
      </button>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-body font-semibold text-sm transition-all hover:scale-105 active:scale-95" style={{ background: 'linear-gradient(135deg, #C9A961, #D4AF85)', color: '#0f1a2e' }}>
      {children}
    </button>
  );
}

function SectionLabel({ children }) {
  return <p className="font-body text-xs uppercase tracking-widest mb-2" style={{ color: '#C9A961' }}>{children}</p>;
}

function useTodayChart() {
  const [chartData, setChartData] = useState(null);
  const [ingresses, setIngresses] = useState([]);
  useEffect(() => {
    try {
      setChartData(getTodayChartData());
      setIngresses(getTodayIngresses());
    } catch (e) {}
  }, []);
  return { chartData, ingresses };
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Landing() {
  const [loading, setLoading] = useState(false);
  const { chartData, ingresses } = useTodayChart();
  const [emailCapture, setEmailCapture] = useState('');
  const [emailStatus, setEmailStatus] = useState(null);
  const [example, setExample] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('astrosetta_landing_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('astrosetta_landing_sidebar_collapsed', String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    track(EVENTS.LANDING_PAGE_VIEWED, { ref: new URLSearchParams(window.location.search).get('ref') || 'direct' });
  }, []);

  const handleEmailCapture = async (e) => {
    e.preventDefault();
    if (!emailCapture.trim()) return;
    setEmailStatus('submitting');
    try {
      await base44.entities.WaitlistEmail.create({ email: emailCapture.trim(), source: 'landing_page' });
      track(EVENTS.EMAIL_CAPTURED, { source: 'landing_page' });
      setEmailStatus('done');
    } catch {
      setEmailStatus('error');
    }
  };

  const handleSignIn = (tierPreference = null) => {
    if (tierPreference) localStorage.setItem('founding_tier_preference', tierPreference);
    setLoading(true);
    base44.auth.redirectToLogin(window.location.origin + '/home');
  };

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`relative min-h-screen overflow-x-hidden ${sidebarCollapsed ? 'md:pl-16' : 'md:pl-56'}`} style={{ background: '#07101e' }}>
      <Starfield />

      <div className="relative" style={{ zIndex: 1 }}>

        {/* ── Nav ── */}
        <LandingSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} onSignIn={handleSignIn} loading={loading} />

        <FeatureExampleModal example={example} onClose={() => setExample(null)} chartData={chartData} />

        {/* ── Hero ── */}
        <section className="px-6 pt-28 pb-10 md:pt-14 max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left: Copy */}
            <div>
              <div className="inline-block mb-[34px] px-4 py-1.5 rounded-full font-body text-xs tracking-widest uppercase" style={{ background: 'rgba(201,169,97,0.1)', border: '1px solid rgba(201,169,97,0.25)', color: '#C9A961' }}>
                ✦ Start free
              </div>
              <EventBanner />
              <h1 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
                Learn to read<br />
                <span style={{ color: '#C9A961' }}>your own chart.</span>
              </h1>
              <p className="font-body text-base leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '42ch' }}>
                Astrosetta turns your natal chart and daily transits into personalized lessons, so you can stop relying on someone else's interpretation and start building your own.
              </p>
              {/* Mobile-only Sign in link — above the primary CTA, outside the top gesture zone */}
              <button onClick={handleSignIn} disabled={loading} className="md:hidden flex items-center gap-1 font-body text-sm py-3 px-3 -ml-3 min-h-[44px] self-start -mt-4 mb-3 active:opacity-70 disabled:opacity-70" style={{ color: '#C9A961' }}>
                {loading ? 'Redirecting…' : <>Already have an account? <span className="underline underline-offset-4">Sign in</span></>}
              </button>
              <div className="flex flex-wrap gap-3">
                <CtaButton onClick={handleSignIn} disabled={loading}>
                  {loading ? 'Redirecting…' : 'Create Your Chart'}
                  {!loading && <ArrowRight size={15} />}
                </CtaButton>
                <CtaButton onClick={scrollToHowItWorks} secondary>
                  See How It Works
                </CtaButton>
              </div>
              <p className="mt-3 font-body text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>No credit card required · Start free</p>
            </div>

            {/* Right: Live chart wheel */}
            <div>
              <div className="text-center mb-3">
                <p className="font-body text-xs uppercase tracking-widest" style={{ color: '#C9A961' }}>Today's Sky, Live</p>
                <p className="font-body text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className="overflow-hidden">
                {chartData && <ChartWheel chartData={chartData} skyMode className="p-2" />}
              </div>
              {ingresses?.length > 0 && (
                <div className="mt-2">
                  <IngressBanner ingresses={ingresses} compact />
                </div>
              )}
              <p className="font-body text-xs text-center mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Actual planetary positions right now. Sign in to overlay your natal chart.</p>
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <TestimonialCarousel />

        {/* ── Interactive Features Showcase ── */}
        <InteractiveFeatures />

        {/* ── How It Works ── */}
        <section id="how-it-works" className="px-6 py-16 max-w-5xl mx-auto scroll-mt-20">
          <div className="text-center mb-12">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="font-display text-3xl font-bold text-white">From birth chart to fluent reader</h2>
          </div>

          <div className="space-y-12">
            {/* Step 1 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-display text-sm font-bold" style={{ background: 'rgba(201,169,97,0.15)', border: '1px solid rgba(201,169,97,0.3)', color: '#C9A961' }}>1</div>
                  <h3 className="font-display text-xl font-bold text-white">Create your chart</h3>
                </div>
                <p className="font-body text-sm leading-relaxed ml-11" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Enter your birth date, time, and location. We calculate your full natal chart: planets, houses, and aspects, all in seconds.
                </p>
              </div>
              <div className="overflow-hidden">
                {chartData && <ChartWheel chartData={chartData} className="p-2" />}
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="md:order-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-display text-sm font-bold" style={{ background: 'rgba(201,169,97,0.15)', border: '1px solid rgba(201,169,97,0.3)', color: '#C9A961' }}>2</div>
                  <h3 className="font-display text-xl font-bold text-white">Get daily readings that make sense</h3>
                </div>
                <p className="font-body text-sm leading-relaxed ml-11" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Every day, see what's actually happening in the sky and what it means for your chart specifically, written in plain language with the glyphs and symbols explained as you go.
                </p>
                <p className="font-body text-xs ml-11 mt-2" style={{ color: 'rgba(201,169,97,0.5)' }}>↑ Try it: tap the card to expand the reading</p>
              </div>
              <div className="md:order-1">
                <ReadingDemo />
              </div>
            </div>

            {/* Step 3 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-display text-sm font-bold" style={{ background: 'rgba(201,169,97,0.15)', border: '1px solid rgba(201,169,97,0.3)', color: '#C9A961' }}>3</div>
                  <h3 className="font-display text-xl font-bold text-white">Learn as you go</h3>
                </div>
                <p className="font-body text-sm leading-relaxed ml-11" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Quizzes and progressive lessons build your fluency over time. Move from Apprentice to Adept to Maestro as you learn to spot your own patterns like stelliums, T-squares, and retrogrades, all grounded in what's happening in the sky today.
                </p>
                <p className="font-body text-xs ml-11 mt-2" style={{ color: 'rgba(201,169,97,0.5)' }}>↑ Try it: tap an answer to see how it works</p>
              </div>
              <QuizDemo />
            </div>

            {/* Step 4 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="md:order-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-display text-sm font-bold" style={{ background: 'rgba(201,169,97,0.15)', border: '1px solid rgba(201,169,97,0.3)', color: '#C9A961' }}>4</div>
                  <h3 className="font-display text-xl font-bold text-white">Track your progress</h3>
                </div>
                <p className="font-body text-sm leading-relaxed ml-11" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Watch your fluency grow tier by tier. Sync upcoming transits to your calendar so you always know what's coming and why it matters.
                </p>
                <p className="font-body text-xs ml-11 mt-2" style={{ color: 'rgba(201,169,97,0.5)' }}>↑ Watch the tiers light up</p>
              </div>
              <div className="md:order-1">
                <ProgressDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Why Astrosetta ── */}
        <ComparisonStrip />

        {/* ── Go Deeper ── */}
        <section className="px-6 py-16 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel>Go deeper</SectionLabel>
            <h2 className="font-display text-3xl font-bold text-white">Two ways to explore your chart</h2>
            <p className="font-body text-sm mt-3 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Once you know the basics, these are the tools you'll keep coming back to.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl p-6 flex flex-col" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,169,97,0.15)' }}>
              <p className="font-body text-xs uppercase tracking-widest mb-2" style={{ color: '#C9A961' }}>Interactive Chart Wheel</p>
              <h3 className="font-display text-xl font-bold text-white mb-3">Click anything. Understand everything.</h3>
              <div className="overflow-hidden flex-1 flex items-center justify-center">
                {chartData && <ChartWheel chartData={chartData} skyMode className="p-2" />}
              </div>
              <p className="font-body text-xs mt-3 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>Tap any planet or aspect line for its meaning.</p>
              <button onClick={() => setExample(FEATURE_EXAMPLES.goWheel)} className="mt-3 mx-auto flex items-center gap-1 font-body text-[11px]" style={{ color: '#C9A961' }}>See an example <ArrowRight size={11} /></button>
            </div>
            <div className="rounded-2xl p-6 flex flex-col" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,169,97,0.15)' }}>
              <p className="font-body text-xs uppercase tracking-widest mb-2" style={{ color: '#C9A961' }}>Chart Navigator</p>
              <h3 className="font-display text-xl font-bold text-white mb-3">For the times you just need to ask.</h3>
              <div className="flex-1 flex flex-col justify-center gap-2.5">
                <div className="rounded-xl px-3.5 py-2.5 self-start max-w-[85%]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,169,97,0.12)' }}>
                  <p className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>"What does my Saturn return mean for me?"</p>
                </div>
                <div className="rounded-xl px-3.5 py-2.5 self-end max-w-[85%]" style={{ background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.25)' }}>
                  <p className="font-body text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>Saturn returns to its natal position around age 28–30 — a structural reset. Here's how yours is shaping up, and what to lean into…</p>
                </div>
              </div>
              <p className="font-body text-xs mt-3 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>Your own astrologer on call — minus the wait.</p>
              <button onClick={() => setExample(FEATURE_EXAMPLES.goNavigator)} className="mt-3 mx-auto flex items-center gap-1 font-body text-[11px]" style={{ color: '#C9A961' }}>See an example <ArrowRight size={11} /></button>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="px-6 py-16 max-w-5xl mx-auto scroll-mt-20">
          <div className="text-center mb-10">
            <SectionLabel>Features</SectionLabel>
            <h2 className="font-display text-3xl font-bold text-white">Everything you need to learn the sky</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: 'daily', icon: Moon, color: '#9DB4C8', title: 'Personalized Daily Readings', desc: 'Real transits calculated for your exact chart, with the planets overhead right now.' },
              { id: 'learning', icon: TrendingUp, color: '#C9A961', title: 'Progressive Learning System', desc: 'A clear path from beginner to confident chart-reader, one lesson at a time.' },
              { id: 'synthesis', icon: Star, color: '#B8A5C8', title: 'Chart Synthesis', desc: 'See your major patterns like stelliums, T-squares, and your chart ruler chain, all surfaced and explained in plain language.' },
              { id: 'wheel', icon: MousePointer, color: '#C9A961', title: 'Interactive Chart Wheel', desc: 'Click any planet, sign, house, or aspect for instant interpretation. Your chart becomes a living tool you can explore.' },
              { id: 'calendar', icon: CalendarDays, color: '#A8C8A8', title: 'Calendar Sync', desc: 'Sync upcoming transits straight to your calendar so you always know what\'s coming.' },
              { id: 'synastry', icon: Users, color: '#B8A5C8', title: 'Synastry & Events', desc: 'Compare charts with partners, family, and friends. Or chart an event to understand a pivotal moment.' },
              { id: 'navigator', icon: MessageCircle, color: '#C9A961', title: 'Chart Navigator', desc: 'Ask a specific question and get a direct answer drawn from your chart, today\'s transits, and the curriculum — your own astrologer on call, minus the wait.' },
              { id: 'density', icon: Gauge, color: '#9DB4C8', title: 'Knowledge Density', desc: 'Scale every interpretation and lesson from plain-language Essential to full Technical. Learn at your own depth, anytime.' },
              { id: 'traditions', icon: Scroll, color: '#B8A5C8', title: 'Three Traditions', desc: 'Read your chart through Modern, Hellenistic, or Vedic lenses — zodiac, house system, and rulerships all recalibrate to match.' },
              { id: 'lots', icon: Sparkles, color: '#C9A961', title: 'Arabic Lots & Asteroid Packs', desc: 'Go beyond the planets with the Lots of Spirit, Eros & Necessity, plus Black Moon Lilith and the asteroid pack.' },
              ].map(({ id, title, desc }) => (
              <button key={id} onClick={() => setExample(FEATURE_EXAMPLES[id])} className="text-left rounded-2xl p-5 flex flex-row items-start gap-3.5 transition-all hover:-translate-y-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,97,0.15)', backdropFilter: 'blur(8px)' }}>
                <div className="text-left flex-1">
                  <p className="font-display font-bold text-white text-sm">{title}</p>
                  <p className="font-body text-xs leading-relaxed mt-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{desc}</p>
                  <p className="font-body text-[11px] mt-2.5 inline-flex items-center gap-1" style={{ color: '#C9A961' }}>See an example <ArrowRight size={11} /></p>
                </div>
              </button>
              ))}
          </div>
        </section>

        {/* ── The North Star ── */}
        <section className="px-6 py-20 max-w-3xl mx-auto text-center">
          <SectionLabel>The north star</SectionLabel>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight mb-6">
            We're not here to be your astrologer.
          </h2>
          <p className="font-body text-base leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Astrosetta is built to help you think critically about your own astrology. The aim is to hand you the tools <span className="font-semibold" style={{ color: '#C9A961' }}>so you can discern for yourself</span>.
          </p>
          <p className="font-body text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.55)' }}>
            If the provided interpretations resonate, great. We also invite you to explore the deeper reasoning behind them. Over time you build the fluency to form your own view, drawing on the same information we use.
          </p>

          <ul className="max-w-2xl mx-auto space-y-3 text-left">
            {[
              { title: 'Clickable glossary', desc: 'Every term defined the moment you meet it — essential meaning and technical depth, one tap away.' },
              { title: 'Full curriculum', desc: 'Foundations through classical techniques. A structured path, one step at a time.' },
              { title: 'Language that invites', desc: 'Interpretations framed as possibility. Meaning stays yours to make.' },
            ].map(({ title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-2 shrink-0 text-lg leading-none" style={{ color: '#C9A961' }}>•</span>
                <p className="font-body text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <span className="font-semibold text-white">{title}.</span> {desc}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="px-6 py-16 max-w-5xl mx-auto scroll-mt-20">
          <div className="text-center mb-12">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="font-display text-3xl font-bold text-white mb-3">Start free. Founding members lock in their rate forever.</h2>
            <p className="font-body text-sm max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Create your chart free. Founding members lock in $5.55 / $7.77 forever when they subscribe.
            </p>
          </div>

          <div className="flex items-center justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(201,169,97,0.12)', border: '1px solid rgba(201,169,97,0.3)' }}>
              <Lock size={12} style={{ color: '#C9A961' }} />
              <span className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <span className="font-semibold" style={{ color: '#C9A961' }}>Founding members</span> — lock in your rate forever when you subscribe.
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {/* Free */}
            <div className="rounded-2xl p-6 flex flex-col" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="font-body text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Free</p>
              <div className="mb-5">
                <span className="font-display text-4xl font-bold text-white">$0</span>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {['Natal chart placements', 'Big Three interpretations (Sun, Moon, Rising)', 'Arabic Lots (Fortune, Spirit, Eros & Necessity) & lunar nodes', 'Knowledge Density slider (Essential → Technical)', 'Daily horoscope', 'Transit list (no interpretations)', 'Full learning curriculum', 'Daily quiz', 'Journal'].map(f => (
                  <li key={f} className="flex items-start gap-2 font-body text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <Check size={13} className="mt-0.5 shrink-0" style={{ color: '#A8C8A8' }} />{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => handleSignIn('free')} disabled={loading} className="w-full py-2.5 rounded-xl font-body text-sm font-semibold transition-all hover:opacity-90" style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}>
                {loading ? 'Redirecting…' : 'Create Free Chart'}
              </button>
            </div>

            {/* Seeker */}
            <div className="rounded-2xl p-6 flex flex-col relative" style={{ background: 'rgba(201,169,97,0.08)', border: '2px solid rgba(201,169,97,0.4)' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full font-body text-[10px] font-semibold tracking-wide" style={{ background: '#C9A961', color: '#0f1a2e' }}>
                MOST POPULAR
              </div>
              <p className="font-body text-xs uppercase tracking-widest mb-1" style={{ color: '#C9A961' }}>Core</p>
              <div className="mb-1">
                <span className="font-display text-4xl font-bold" style={{ color: '#C9A961' }}>$5.55</span>
                <span className="font-body text-sm ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>/mo</span>
              </div>
              <div className="flex items-center gap-1.5 mb-5">
                <Lock size={10} style={{ color: '#C9A961' }} />
                <p className="font-body text-[10px]" style={{ color: 'rgba(201,169,97,0.7)' }}>Founding rate · locked in forever · or $55/yr — 2 months free</p>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {['Everything in Free', 'Interactive chart wheel', 'Full natal chart interpretations (all planets)', 'Transit interpretations on demand', 'Personalized daily quiz', 'Synastry & event charts', 'House system choice (Placidus + more)', 'Switch your chart\'s tradition — Modern, Hellenistic, or Vedic', 'Planner (month, week, day views)', 'Calendar sync (ICS + Google Calendar)', 'Chart Navigator chatbot', 'Streak bonus content (7-day streak)'].map(f => (
                  <li key={f} className="flex items-start gap-2 font-body text-xs text-white">
                    <Check size={13} className="mt-0.5 shrink-0" style={{ color: '#C9A961' }} />{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => handleSignIn('core')} disabled={loading} className="w-full py-2.5 rounded-xl font-body text-sm font-semibold transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #C9A961, #D4AF85)', color: '#0f1a2e' }}>
                {loading ? 'Redirecting…' : 'Lock In This Price'}
              </button>
            </div>

            {/* Navigator */}
            <div className="rounded-2xl p-6 flex flex-col" style={{ background: 'rgba(184,165,200,0.07)', border: '1px solid rgba(184,165,200,0.2)' }}>
              <p className="font-body text-xs uppercase tracking-widest mb-1" style={{ color: '#B8A5C8' }}>Premium</p>
              <div className="mb-1">
                <span className="font-display text-4xl font-bold" style={{ color: '#B8A5C8' }}>$7.77</span>
                <span className="font-body text-sm ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>/mo</span>
              </div>
              <div className="flex items-center gap-1.5 mb-5">
                <Lock size={10} style={{ color: '#B8A5C8' }} />
                <p className="font-body text-[10px]" style={{ color: 'rgba(184,165,200,0.6)' }}>Founding rate · locked in forever · or $77/yr — 2 months free</p>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {['Everything in Core', 'Black Moon Lilith (placements, transits & interpretations)', 'Asteroid pack — Juno, Pallas, Vesta & Tyche (placements, transits & interpretations)', 'Early access to new features', 'Private community (Discord/Subreddit) — coming soon', 'Founding patron recognition in-app'].map(f => (
                  <li key={f} className="flex items-start gap-2 font-body text-xs text-white">
                    <Check size={13} className="mt-0.5 shrink-0" style={{ color: '#B8A5C8' }} />{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => handleSignIn('pro')} disabled={loading} className="w-full py-2.5 rounded-xl font-body text-sm font-semibold transition-all hover:opacity-90" style={{ background: 'rgba(184,165,200,0.15)', color: '#B8A5C8', border: '1px solid rgba(184,165,200,0.25)' }}>
                {loading ? 'Redirecting…' : 'Lock In This Price'}
              </button>
            </div>
          </div>

          <p className="text-center font-body text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No card required to start. Founding members lock in their rate when they subscribe.
          </p>
        </section>

        {/* ── Final CTA ── */}
        <section className="px-6 pb-24 text-center max-w-xl mx-auto">
          <div className="rounded-3xl p-10" style={{ background: 'linear-gradient(135deg, rgba(201,169,97,0.12), rgba(157,180,200,0.06))', border: '1px solid rgba(201,169,97,0.2)' }}>
            <div className="text-3xl mb-4" style={{ color: '#C9A961' }}>✦</div>
            <h2 className="font-display text-2xl font-bold text-white mb-3">Your chart is already written.<br />Let's learn to read it.</h2>
            <p className="font-body text-sm leading-relaxed mb-7" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Create your natal chart, take your first quiz, and start building a vocabulary for the sky, one transit at a time.
            </p>
            <CtaButton onClick={handleSignIn} disabled={loading}>
              {loading ? 'Redirecting…' : 'Create Your Chart Free'}
              {!loading && <ArrowRight size={15} />}
            </CtaButton>
            <p className="mt-3 font-body text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>No credit card required · Start free</p>
          </div>

          {/* Email capture — optional, non-forced */}
          {emailStatus !== 'done' ? (
            <div className="mt-6">
              <p className="font-body text-xs mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Not ready yet? Get launch updates →</p>
              <form onSubmit={handleEmailCapture} className="flex items-center gap-2 max-w-sm mx-auto">
                <input
                  type="email"
                  required
                  value={emailCapture}
                  onChange={(e) => setEmailCapture(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-4 py-2.5 rounded-full font-body text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-accent/50"
                  style={{ minWidth: 0 }}
                />
                <button
                  type="submit"
                  disabled={emailStatus === 'submitting'}
                  className="px-5 py-2.5 rounded-full font-body text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'rgba(201,169,97,0.15)', color: '#C9A961', border: '1px solid rgba(201,169,97,0.3)', whiteSpace: 'nowrap' }}
                >
                  {emailStatus === 'submitting' ? '…' : 'Notify me'}
                </button>
              </form>
              {emailStatus === 'error' && (
                <p className="mt-2 font-body text-xs" style={{ color: 'rgba(216,180,194,0.6)' }}>Something went wrong. Please try again.</p>
              )}
            </div>
          ) : (
            <p className="mt-6 font-body text-sm" style={{ color: '#C9A961' }}>✦ You're on the list — we'll be in touch at launch.</p>
          )}
        </section>

        {/* ── Footer ── */}
        <footer className="text-center pb-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2rem' }}>
          <div className="flex items-center justify-center mb-3">
            <img
              src="https://media.base44.com/images/public/69fcbc50df58f65eac4fd0a6/8a82dfec1_Asset24x.png"
              alt="Astrosetta"
              className="h-12 w-auto"
            />
          </div>
          <div className="flex items-center justify-center gap-4 mb-3">
            <Link to="/legal" className="font-body text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.3)' }}>Legal</Link>
          </div>
          <p className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Operated by Sharp Energetics LLC · © 2026</p>
        </footer>

      </div>
    </div>
  );
}