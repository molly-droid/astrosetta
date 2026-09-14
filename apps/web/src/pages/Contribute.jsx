import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Loader2, Lock } from 'lucide-react';
import ContributionForm from '@/components/contribution/ContributionForm';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import PageHeader from '@/components/layout/PageHeader';

export default function Contribute() {
  const { user } = useAuth();
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) checkEligibility();
  }, [user]);

  const checkEligibility = async () => {
    const progress = await base44.entities.UserPlacementProgress.filter({
      user_id: user.id,
      status: 'completed',
    });
    setCompletedCount(progress.length);
    setLoading(false);
  };

  const canContribute = user?.role === 'contributor' || user?.role === 'admin' || completedCount >= 10;
  const remaining = 10 - completedCount;

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-gold-primary" size={28} /></div>;
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="px-4 pt-12 pb-6">
          <h1 className="font-display text-2xl font-bold text-cream">Contribute</h1>
          <p className="font-body text-xs text-white/40 italic mt-1">Share your astrological wisdom with the community</p>
        </div>
      </PageHeader>

      <div className="px-4 py-5">
        {!canContribute ? (
          <div className="celestial-card p-6 text-center space-y-4">
            <Lock size={32} className="text-brass/60 mx-auto" />
            <h2 className="font-display text-xl text-cream">Keep Studying</h2>
            <p className="font-body text-sm text-brass">
              Complete <strong className="text-cream">{remaining} more placement card{remaining !== 1 ? 's' : ''}</strong> to unlock the ability to contribute interpretations.
            </p>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min((completedCount / 10) * 100, 100)}%`, background: 'linear-gradient(90deg, #C9A961, #D4AF85)' }}
              />
            </div>
            <p className="text-xs font-body text-brass/60">{completedCount} / 10 cards completed</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="celestial-card p-4 space-y-1">
              <p className="font-body text-sm text-brass italic text-center">
                Your perspective matters. Write with care — interpretations are reviewed before publication.
              </p>
            </div>
            <OrnamentDivider />
            <ContributionForm user={user} />
          </div>
        )}
      </div>
    </div>
  );
}