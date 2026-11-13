import { useEffect, useState } from 'react';
import { supabase } from '@/api/shim/supabase';
import { isNativePlatform } from '@/lib/platform';

export default function useBetaTrial(user) {
  const [offer, setOffer] = useState({ eligible: false, loading: true, endsAt: null });
  useEffect(() => {
    let alive = true;
    if (!user?.id || isNativePlatform()) {
      setOffer({ eligible: false, loading: false, endsAt: null });
      return () => { alive = false; };
    }
    setOffer({ eligible: false, loading: true, endsAt: null });
    supabase.from('beta_trial_members').select('trial_ends_at,redeemed_at').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        const active = ['interpret', 'calendar'].includes(user.subscription_tier)
          && (!user.subscription_expires || Date.parse(user.subscription_expires) > Date.now());
        setOffer({ loading: false, endsAt: data?.trial_ends_at || null,
          eligible: Boolean(!error && data && !data.redeemed_at && !active
            && user.is_founding_member && !user.founding_rate_forfeited_at
            && Date.parse(data.trial_ends_at) - Date.now() > 49 * 60 * 60 * 1000) });
      }).catch(() => { if (alive) setOffer({ eligible: false, loading: false, endsAt: null }); });
    return () => { alive = false; };
  }, [user?.id, user?.subscription_tier, user?.subscription_expires, user?.is_founding_member, user?.founding_rate_forfeited_at]);
  return offer;
}
