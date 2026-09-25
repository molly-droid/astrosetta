import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getEventTag, setEventTag } from '@/lib/eventTag';
import { Gift } from 'lucide-react';

/**
 * Landing-page banner shown to event-sourced visitors. The QR signage links
 * carry ?src=<event_id> — the tag is stored automatically so it survives the
 * signup redirect, and the banner confirms the founding gift is waiting.
 */
export default function EventBanner() {
  const [hasTag, setHasTag] = useState(false);
  const [event, setEvent] = useState(null);

  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get('src');
    if (src) setEventTag({ event_id: src, channel: 'qr_link' });
    const tag = getEventTag();
    setHasTag(!!tag?.event_id);
    if (tag?.event_id) {
      base44.entities.PopupEvent.filter({ event_id: tag.event_id })
        .then((events) => setEvent(events?.[0] || null))
        .catch(() => setEvent(null));
    }
  }, []);

  if (!hasTag) return null;

  return (
    <div
      className="rounded-2xl p-4 mb-5"
      style={{ background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.35)' }}
    >
      <div className="flex items-center gap-2.5">
        <Gift size={15} style={{ color: '#C9A961' }} className="shrink-0" />
        <p className="font-body text-sm text-white">
          {event ? (
            <>
              ✦ You came from the <span style={{ color: '#C9A961' }}>{event.event_name}</span>
            </>
          ) : (
            '✦ You came from one of our events'
          )}
        </p>
      </div>
      <p className="font-body text-xs mt-1.5 pl-[27px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
        Your founding gift is waiting — create your chart to claim it.
      </p>
    </div>
  );
}