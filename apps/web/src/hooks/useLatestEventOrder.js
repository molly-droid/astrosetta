import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Loads the current user's latest event order (and its event config) for the
 * "My Astrosetta Moment" confirmation card and profile section.
 */
export function useLatestEventOrder(userId) {
  const [order, setOrder] = useState(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const orders = await base44.entities.EventOrder.filter({ user_id: userId }, '-created_date', 10);
      const latest = orders?.[0];
      setOrder(latest || null);
      if (latest?.event_id) {
        const events = await base44.entities.PopupEvent.filter({ event_id: latest.event_id });
        setEvent(events?.[0] || null);
      }
    } catch {
      /* order lookup failure leaves the empty state */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { order, event, loading, refresh: load };
}