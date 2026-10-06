import React from 'react';
import { ChevronLeft, ChevronRight, Compass, Sparkles, Tag, LogIn } from 'lucide-react';

const NAV = [
  { id: 'how-it-works', icon: Compass, label: 'How it works' },
  { id: 'features', icon: Sparkles, label: 'Features' },
  { id: 'pricing', icon: Tag, label: 'Pricing' },
];

export default function LandingSidebar({ collapsed, setCollapsed, onSignIn, loading = false }) {
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      {/* Desktop / tablet — collapsible side rail, mirrors the in-app sidebar */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col overflow-y-auto transition-[width] duration-300 ${collapsed ? 'w-16' : 'w-56'}`}
        style={{
          background: 'rgba(7,16,30,0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Collapse / expand toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`absolute z-50 flex items-center justify-center w-7 h-7 rounded-full border border-white/[0.14] bg-[#0f1a2e] text-brass/60 hover:text-gold-accent transition-all ${collapsed ? 'top-2 left-1/2 -translate-x-1/2' : 'top-[28px] right-[7px]'}`}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Logo */}
        <div className={`flex items-center justify-center ${collapsed ? 'pt-12 px-2 pb-4' : 'pt-6 px-3 pb-4'}`}>
          <button onClick={onSignIn} className="relative inline-flex items-center justify-center shrink-0" title="Astrosetta">
            <div className={`absolute bg-gold-primary/30 rounded-full blur-xl ${collapsed ? 'w-10 h-10' : 'w-14 h-14'}`} />
            <img
              src="/media/c4d622f89_Asset74x.png"
              alt="Astrosetta"
              className={`relative object-contain ${collapsed ? 'w-9 h-9' : 'w-12 h-12'}`}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex flex-col gap-2 flex-1 ${collapsed ? 'p-2 items-center' : 'p-4'}`}>
          {NAV.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => go(id)}
              title={collapsed ? label : undefined}
              className={`flex items-center rounded-lg text-sm transition-all text-white/60 hover:text-[#C9A961] hover:bg-[rgba(212,175,133,0.1)] ${collapsed ? 'justify-center w-10 h-10' : 'gap-3 px-4 py-3'}`}
            >
              <Icon size={18} strokeWidth={1.5} />
              {!collapsed && <span className="font-body">{label}</span>}
            </button>
          ))}
        </nav>

        {/* Sign in */}
        <div className={collapsed ? 'p-2 flex flex-col items-center' : 'p-4'}>
          <button
            onClick={onSignIn}
            title={collapsed ? 'Sign in' : undefined}
            className={`flex items-center rounded-lg text-sm transition-all bg-[rgba(212,175,133,0.12)] border border-[rgba(201,169,97,0.3)] text-[#C9A961] hover:bg-[rgba(212,175,133,0.2)] ${collapsed ? 'justify-center w-10 h-10' : 'gap-3 px-4 py-3 w-full'}`}
          >
            <LogIn size={18} strokeWidth={1.5} />
            {!collapsed && <span className="font-body">Sign in</span>}
          </button>
        </div>
      </aside>

      {/* Mobile — slim top bar (side rail is hidden < md) */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 py-3"
        style={{ background: 'rgba(7,16,30,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button onClick={onSignIn} className="flex items-center">
          <img
            src="/media/8a82dfec1_Asset24x.png"
            alt="Astrosetta"
            className="h-8 w-auto"
          />
        </button>
        <button
          onClick={onSignIn}
          disabled={loading}
          className="font-body text-sm px-4 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center bg-[rgba(212,175,133,0.12)] border border-[rgba(201,169,97,0.3)] text-[#C9A961] active:bg-[rgba(212,175,133,0.25)] active:scale-95 transition-transform disabled:opacity-70"
        >
          {loading ? 'Redirecting…' : 'Sign in'}
        </button>
      </div>
    </>
  );
}