import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, ChevronDown, Shield, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getEffectiveTier } from '@/lib/permissions';

const TIER_LABELS = {
  free: 'Free',
  interpret: '$9 · Interpret',
  calendar: '$14 · Calendar',
};

export default function ImpersonationBanner() {
  const { impersonatedUser, stopImpersonating, realUser, impersonate } = useAuth();
  const navigate = useNavigate();
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const pickerRef = useRef(null);

  const isAdmin = realUser?.role === 'admin';

  const handleOpenPicker = async () => {
    if (!userPickerOpen) {
      setLoadingUsers(true);
      const users = await base44.entities.User.list(null, 200);
      setAllUsers(users.filter(u => u.id !== realUser?.id));
      setLoadingUsers(false);
    }
    setUserPickerOpen(o => !o);
  };

  const handleSwitchUser = (u) => {
    impersonate(u);
    setUserPickerOpen(false);
    navigate('/');
  };

  const handleExitPreview = () => {
    stopImpersonating();
    setUserPickerOpen(false);
    navigate('/tier-testing');
  };

  useEffect(() => {
    if (!userPickerOpen) return;
    const close = (e) => {
      if (!pickerRef.current?.contains(e.target)) setUserPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [userPickerOpen]);

  const effectiveTier = impersonatedUser ? getEffectiveTier(impersonatedUser) : null;

  if (!isAdmin) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#FFF8E7] border-b border-amber-200 flex items-center justify-between px-4 h-10 shadow-sm">
      {/* Left: Preview mode label */}
      <div className="flex items-center gap-2">
        <FlaskConical size={15} className="text-amber-600" />
        <span className="font-body text-xs font-semibold text-amber-700 uppercase tracking-wider">Preview Mode</span>
        {impersonatedUser ? (
          <span className="font-body text-xs text-amber-600/80">
            — viewing as <strong className="text-amber-800">{impersonatedUser.display_name || impersonatedUser.full_name || impersonatedUser.email}</strong>
            {effectiveTier && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[9px] font-semibold text-amber-700">
                {TIER_LABELS[effectiveTier] || effectiveTier}
              </span>
            )}
          </span>
        ) : (
          <span className="font-body text-xs text-amber-600/60">— select a user below to preview their experience</span>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 relative" ref={pickerRef}>
        {/* My View button */}
        {impersonatedUser && (
          <button
            onClick={handleExitPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deep-blue text-cream font-body text-xs font-semibold hover:bg-deep-blue/90 transition-colors shadow-sm"
          >
            <Shield size={12} />
            My View
          </button>
        )}

        {/* User picker button */}
        <button
          onClick={handleOpenPicker}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white font-body text-xs text-amber-800 font-semibold hover:bg-amber-50 transition-colors shadow-sm"
        >
          <User size={12} className="text-amber-600" />
          {impersonatedUser
            ? ((impersonatedUser.display_name || impersonatedUser.full_name)?.split(' ')[0] || impersonatedUser.email)
            : 'Select User'}
          <ChevronDown size={11} className="text-amber-500" />
        </button>

        {/* User picker dropdown */}
        {userPickerOpen && (
          <div className="absolute top-full right-0 mt-1.5 w-64 bg-white border border-amber-200 rounded-xl shadow-xl z-[10000] overflow-hidden">
            <p className="font-body text-[9px] uppercase tracking-widest text-brass/40 px-3 pt-2.5 pb-1">View app as...</p>
            {loadingUsers ? (
              <p className="font-body text-xs text-brass/50 px-3 py-3 italic">Loading users...</p>
            ) : allUsers.length === 0 ? (
              <p className="font-body text-xs text-brass/50 px-3 py-3 italic">No other users found.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {allUsers.map(u => {
                  const tier = getEffectiveTier(u);
                  const isActive = impersonatedUser?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleSwitchUser(u)}
                      className={`w-full text-left px-3 py-2.5 font-body text-xs transition-colors hover:bg-amber-50 flex items-center justify-between gap-2 ${isActive ? 'bg-amber-50 font-semibold' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="text-deep-blue truncate">{u.display_name || u.full_name || u.email}</p>
                        <p className="text-[10px] text-brass/50 truncate">{u.email}</p>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted border border-brass/20 text-brass shrink-0">
                        {tier}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="border-t border-amber-100 px-3 py-2">
              <p className="font-body text-[9px] text-brass/30">Admins only · not visible to users</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}