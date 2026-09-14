import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { track, EVENTS } from '@/lib/analytics';
import { resolveDepth, DEFAULT_KNOWLEDGE_DEPTH } from '@/lib/knowledgeDensity';
import { pickBestProgress } from '@/lib/userProgress';

/**
 * UserPrefsProvider — global store for user preferences that affect content
 * delivery across the app (currently Knowledge Density).
 *
 * progressRecord is fetched ONCE in AuthProvider (in parallel with auth.me())
 * and surfaced here via context. This avoids the serial waterfall where
 * UserPrefsContext waited for user.id before firing its own UserProgress fetch.
 */
const UserPrefsContext = createContext(null);

export const UserPrefsProvider = ({ children }) => {
  const { user, progressRecord, setProgressRecord, authChecked } = useAuth();
  const [knowledgeDepth, setKnowledgeDepth] = useState(DEFAULT_KNOWLEDGE_DEPTH);
  const [loading, setLoading] = useState(true);

  // Settle knowledge depth once auth has resolved. progressRecord may be null
  // for a brand-new user — that's fine, we keep the default depth.
  useEffect(() => {
    if (authChecked) {
      setKnowledgeDepth(resolveDepth(progressRecord?.knowledge_depth));
      setLoading(false);
    }
  }, [authChecked, progressRecord]);

  const updateDepth = useCallback(async (newDepth) => {
    const resolved = resolveDepth(newDepth);
    const oldDepth = knowledgeDepth;
    if (resolved === oldDepth && progressRecord) return resolved;
    setKnowledgeDepth(resolved);
    track(EVENTS.KNOWLEDGE_DENSITY_CHANGED, { old_depth: oldDepth, new_depth: resolved });
    try {
      if (progressRecord?.id) {
        const updated = await base44.entities.UserProgress.update(progressRecord.id, { knowledge_depth: resolved });
        setProgressRecord?.(updated);
      } else if (user?.id) {
        // Avoid creating a duplicate progress record — a stale lower-tier
        // duplicate can otherwise shadow the user's real (higher) tier on next
        // login. Update an existing record if one exists; only create when the
        // user truly has none.
        const existing = await base44.entities.UserProgress.filter({ user_id: user.id }).catch(() => []);
        const best = pickBestProgress(existing);
        if (best?.id) {
          const updated = await base44.entities.UserProgress.update(best.id, { knowledge_depth: resolved });
          setProgressRecord?.(updated);
        } else {
          const created = await base44.entities.UserProgress.create({
            user_id: user.id,
            current_tier: 'apprentice',
            knowledge_depth: resolved,
          });
          setProgressRecord?.(created);
        }
      }
    } catch {
      // non-critical — UI already updated optimistically
    }
    return resolved;
  }, [knowledgeDepth, progressRecord, user?.id, setProgressRecord]);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    try {
      const records = await base44.entities.UserProgress.filter({ user_id: user.id });
      setProgressRecord?.(records[0] || null);
    } catch {
      // non-critical
    }
  }, [user?.id, setProgressRecord]);

  return (
    <UserPrefsContext.Provider value={{
      knowledgeDepth,
      updateDepth,
      loading,
      progressRecord,
      reload,
    }}>
      {children}
    </UserPrefsContext.Provider>
  );
};

export const useUserPrefs = () => {
  const ctx = useContext(UserPrefsContext);
  if (!ctx) {
    throw new Error('useUserPrefs must be used within a UserPrefsProvider');
  }
  return ctx;
};