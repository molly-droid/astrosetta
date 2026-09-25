import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Home, GraduationCap, Star, User, Shield, CalendarDays, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import FloatingNavigator from '@/components/navigator/FloatingNavigator';
import FeatureSpotlight from '@/components/shared/FeatureSpotlight';
import ChartInteractivitySpotlight from '@/components/shared/ChartInteractivitySpotlight';
import SynastrySpotlight from '@/components/shared/SynastrySpotlight';
import KnowledgeDensitySpotlight from '@/components/shared/KnowledgeDensitySpotlight';
import TransitMovementSpotlight from '@/components/shared/TransitMovementSpotlight';
import TraditionSpotlight from '@/components/shared/TraditionSpotlight';
import ChartDisplaySpotlight from '@/components/shared/ChartDisplaySpotlight';
import RelationshipPlannerSpotlight from '@/components/shared/RelationshipPlannerSpotlight';
import AdvancedTechniquesSpotlight from '@/components/shared/AdvancedTechniquesSpotlight';
import NotificationsBell from '@/components/shared/NotificationsBell';
import FullAppTour from '@/components/shared/FullAppTour';
import QuickTipTour from '@/components/shared/QuickTipTour';
import { prefetchScheduledSpotlight } from '@/lib/spotlightCoordinator';

const NAV_ITEMS = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/learn', icon: GraduationCap, label: 'Learn' },
  { path: '/chart', icon: Star, label: 'Chart' },
  { path: '/planner', icon: CalendarDays, label: 'Planner' },
  { path: '/profile', icon: User, label: 'My Info' },
  { path: '/about', icon: Info, label: 'Guide' },
];

// Starfield background with parallax and rich twinkling
function StarfieldBg() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();

    // Stars with depth layers: 0=far background, 1=near foreground
    const STAR_COUNT = 80;
    const stars = Array.from({ length: STAR_COUNT }, () => {
      const depth = Math.random(); // 0–1
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 0.3 + depth * 1.4 + Math.random() * 0.3,
        baseOpacity: 0.15 + depth * 0.35,
        depth,
        twinkleSpeed: 0.005 + depth * 0.025, // near stars twinkle faster
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleAmp: 0.1 + depth * 0.25,
        hueShift: Math.random() * 20 - 10, // subtle gold-to-white variation
      };
    });

    // Track mouse
    const onMouseMove = (e) => {
      targetMouseRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2, // -1..1
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    let frameId;

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Smooth mouse follow (lerp)
      mouseRef.current = {
        x: mouseRef.current.x + (targetMouseRef.current.x - mouseRef.current.x) * 0.03,
        y: mouseRef.current.y + (targetMouseRef.current.y - mouseRef.current.y) * 0.03,
      };
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#0f1a2e');
      gradient.addColorStop(0.5, '#1a2847');
      gradient.addColorStop(1, '#0f1a2e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Subtle radial glow that follows mouse slightly
      const glowX = w / 2 + mx * w * 0.05;
      const glowY = h * 0.2 + my * h * 0.05;
      const radialGlow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, w * 0.8);
      radialGlow.addColorStop(0, 'rgba(212, 175, 133, 0.03)');
      radialGlow.addColorStop(1, 'rgba(212, 175, 133, 0)');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, w, h);

      // Draw stars with parallax + twinkling
      stars.forEach((star) => {
        // Parallax offset: deeper stars move less
        const parallaxFactor = star.depth * 30;
        const px = star.x + mx * parallaxFactor;
        const py = star.y + my * parallaxFactor;

        // Wrap-around for stars that drift offscreen
        const drawX = ((px % w) + w) % w;
        const drawY = ((py % h) + h) % h;

        // Twinkle
        star.twinklePhase += star.twinkleSpeed;
        const twinkle = Math.sin(star.twinklePhase) * star.twinkleAmp;
        const opacity = Math.max(0, Math.min(1, star.baseOpacity + twinkle));

        // Bright stars get a soft halo
        if (star.radius > 1.1 && opacity > star.baseOpacity + 0.15) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, star.radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212, 175, 133, ${opacity * 0.15})`;
          ctx.fill();
        }

        // Star body
        const hue = 35 + star.hueShift;
        ctx.beginPath();
        ctx.arc(drawX, drawY, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 35%, ${65 + star.depth * 20}%, ${opacity})`;
        ctx.fill();
      });

      frameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, display: 'block' }}
    />
  );
}

// Glass card component - reusable throughout app
export function GlassCard({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] shadow-lg shadow-black/20 p-6 transition-all duration-200 ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.024)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      {children}
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const { realUser } = useAuth();
  const isAdmin = realUser?.role === 'admin';

  // Collapsible desktop/tablet sidebar — persists across sessions
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('astrosetta_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('astrosetta_sidebar_collapsed', String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);

  // Prefetch the admin-scheduled spotlight so the coordinator prefers it
  // over the static newest-feature default.
  useEffect(() => { prefetchScheduledSpotlight(); }, []);
  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative bg-[#0f1a2e]"
      // safe-area-inset-top keeps content out of the notch/status bar in the
      // native apps (resolves to 0px in regular browsers).
      style={{ overscrollBehavior: 'none', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Starfield background */}
      <StarfieldBg />

      {/* Content layer */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0">

        <div className="flex flex-1 min-h-0">
          {/* Desktop/Tablet Sidebar — collapsible to an icon rail */}
          <div className="hidden md:flex relative shrink-0">
            <aside
              className={`flex flex-col h-full overflow-y-auto transition-[width] duration-300 ${sidebarCollapsed ? 'w-16' : 'w-56'}`}
              style={{
                background: 'rgba(255, 255, 255, 0.012)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
            >
              {/* Logo */}
              <div className={`flex items-center justify-center pb-4 ${sidebarCollapsed ? 'pt-11 px-2' : 'pt-6 px-3'}`}>
                <Link to="/home" className="relative inline-flex items-center justify-center shrink-0">
                  <div className={`absolute bg-gold-primary/30 rounded-full blur-xl ${sidebarCollapsed ? 'w-10 h-10' : 'w-16 h-16'}`} />
                  <img
                    src="https://media.base44.com/images/public/69fcbc50df58f65eac4fd0a6/c4d622f89_Asset74x.png"
                    alt="Astrosetta"
                    className={`relative object-contain ${sidebarCollapsed ? 'w-9 h-9' : 'w-14 h-14'}`}
                  />
                </Link>
              </div>

              {/* Navigation */}
              <nav className={`flex flex-col gap-2 flex-1 ${sidebarCollapsed ? 'p-2 items-center' : 'p-4'}`}>
                {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
                  const active = path === '/home' ? location.pathname === '/home' : location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      title={sidebarCollapsed ? label : undefined}
                      className={`flex items-center rounded-lg text-sm transition-all ${sidebarCollapsed ? 'justify-center w-10 h-10' : 'gap-3 px-4 py-3'}`}
                      style={{
                        background: active ? 'rgba(212, 175, 133, 0.15)' : 'transparent',
                        color: active ? '#d4af85' : 'rgba(255, 255, 255, 0.6)',
                        fontWeight: active ? '600' : '400',
                      }}
                    >
                      <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                      {!sidebarCollapsed && label}
                    </Link>
                  );
                })}

                {isAdmin && (
                  <Link
                    to="/admin"
                    title={sidebarCollapsed ? 'Admin' : undefined}
                    className={`flex items-center rounded-lg text-sm transition-all ${sidebarCollapsed ? 'justify-center w-10 h-10 mt-2' : 'gap-3 px-4 py-3 mt-4 border-t border-white/[0.08] pt-4'}`}
                    style={{
                      background: location.pathname.startsWith('/admin')
                        ? 'rgba(212, 175, 133, 0.15)'
                        : 'transparent',
                      color: location.pathname.startsWith('/admin')
                        ? '#d4af85'
                        : 'rgba(255, 255, 255, 0.6)',
                      fontWeight: location.pathname.startsWith('/admin') ? '600' : '400',
                    }}
                  >
                    <Shield size={18} strokeWidth={location.pathname.startsWith('/admin') ? 2 : 1.5} />
                    {!sidebarCollapsed && 'Admin'}
                  </Link>
                )}
              </nav>
            </aside>

            {/* Collapse/expand toggle — pinned at top: inside the rail when expanded, floats just to the right when collapsed */}
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              className={`absolute z-20 flex items-center justify-center w-7 h-7 rounded-full border border-white/[0.14] bg-[#0f1a2e] text-brass/60 hover:text-gold-accent transition-all ${sidebarCollapsed ? 'top-2 left-1/2 -translate-x-1/2' : 'top-[38px] right-[7px]'}`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
            <Outlet context={{ GlassCard }} />
          </main>
        </div>
      </div>

      {/* Feature Spotlight (shows once per user) */}
      <FeatureSpotlight />
      <ChartInteractivitySpotlight />
      <SynastrySpotlight />
      <KnowledgeDensitySpotlight />
      <TransitMovementSpotlight />
      <TraditionSpotlight />
      <ChartDisplaySpotlight />
      <RelationshipPlannerSpotlight />
      <AdvancedTechniquesSpotlight />

      {/* Notifications bell — feature announcements & re-trigger tours */}
      <NotificationsBell />

      {/* Floating Chart Navigator */}
      <FloatingNavigator />

      {/* Full App Tour overlay */}
      <FullAppTour />

      {/* Quick tip tutorials */}
      <QuickTipTour />

      {/* Mobile Bottom Navigation — fixed to viewport bottom */}
      <nav
        className="fixed bottom-0 left-0 w-full md:hidden z-[9999] border-t border-white/[0.12]"
        style={{
          background: 'rgba(15, 26, 46, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center px-2 py-2 gap-1 justify-around">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className="flex flex-col items-center gap-1 px-1 py-2 flex-1 min-w-0 rounded-lg transition-all"
                style={{
                  background: active ? 'rgba(212, 175, 133, 0.15)' : 'transparent',
                }}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2 : 1.5}
                  style={{
                    color: active ? '#d4af85' : 'rgba(255, 255, 255, 0.5)',
                    transition: 'color 0.2s',
                  }}
                />
                <span
                  className="text-[9px] font-semibold tracking-wide whitespace-nowrap"
                  style={{
                    color: active ? '#d4af85' : 'rgba(255, 255, 255, 0.4)',
                    transition: 'color 0.2s',
                  }}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              to="/admin"
              className="flex flex-col items-center gap-1 px-1 py-2 flex-1 min-w-0 rounded-lg transition-all"
              style={{
                background: location.pathname.startsWith('/admin')
                  ? 'rgba(212, 175, 133, 0.15)'
                  : 'transparent',
              }}
            >
              <Shield
                size={22}
                strokeWidth={location.pathname.startsWith('/admin') ? 2 : 1.5}
                style={{
                  color: location.pathname.startsWith('/admin')
                    ? '#d4af85'
                    : 'rgba(255, 255, 255, 0.5)',
                  transition: 'color 0.2s',
                }}
              />
              <span
                className="text-[9px] font-semibold tracking-wide whitespace-nowrap"
                style={{
                  color: location.pathname.startsWith('/admin')
                    ? '#d4af85'
                    : 'rgba(255, 255, 255, 0.4)',
                  transition: 'color 0.2s',
                }}
              >
                Admin
              </span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}