import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/permissions';
import { base44 } from '@/api/base44Client';
import PaywallModal from '@/components/paywall/PaywallModal';

/**
 * Chart Display preferences — grouped by point type.
 * Lives in Profile > Chart tab. Persists to the user entity and reloads the
 * auth context so every chart wheel (which derives the same flags from the
 * user) updates across natal and transit views.
 */
export default function ChartDisplaySettings() {
  const { user, reloadUser } = useAuth();
  const { canViewLilith, canViewAsteroids } = usePermissions(user);
  const [paywall, setPaywall] = useState(null);
  const showAngles = user?.show_angles !== false;
  const showNodes = user?.show_nodes !== false;
  const showLots = user?.show_lots === true;
  const showAsteroids = user?.show_asteroids === true;
  const showLilith = user?.show_lilith !== false;

  const save = async (key, val) => {
    await base44.auth.updateMe({ [key]: val });
    reloadUser();
  };

  const Row = ({ label, desc, checked, onChange, locked, onLockClick }) => (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="font-body text-xs text-cream flex items-center gap-1">
          {label}
          {locked && <Lock size={9} className="text-gold-accent/60" />}
        </p>
        <p className="font-body text-[0.625rem] text-brass/50 leading-snug">{desc}</p>
      </div>
      {locked ? (
        <button
          onClick={onLockClick}
          className="shrink-0 mt-0.5 text-[10px] font-body text-gold-accent border border-gold-primary/30 rounded-full px-2 py-1 hover:bg-gold-primary/10 transition-colors"
        >
          Premium
        </button>
      ) : (
        <Switch checked={checked} onCheckedChange={onChange} className="shrink-0 mt-0.5" />
      )}
    </div>
  );

  const Group = ({ label, children }) => (
    <div className="divide-y divide-white/[0.04]">
      <p className="font-body text-[0.625rem] text-gold-accent/70 uppercase tracking-widest pt-2 pb-0.5">{label}</p>
      {children}
    </div>
  );

  return (
    <div className="celestial-card p-3 divide-y divide-white/[0.04]">
      <p className="font-body text-xs text-brass/70 uppercase tracking-wide pb-1.5">Chart Display</p>

      <Group label="Angles">
        <Row
          label="Angles"
          desc="Show the ASC, MC, DSC, IC row beneath the wheel"
          checked={showAngles}
          onChange={(v) => save('show_angles', v)}
        />
      </Group>

      <Group label="Lunar Points">
        <Row
          label="Lunar Nodes"
          desc="Show the North & South Node placements"
          checked={showNodes}
          onChange={(v) => save('show_nodes', v)}
        />
        <Row
          label="Black Moon Lilith"
          desc="Show the mean lunar apogee (a calculated point)"
          checked={showLilith}
          onChange={(v) => save('show_lilith', v)}
          locked={!canViewLilith}
          onLockClick={() => setPaywall('lilith')}
        />
      </Group>

      <Group label="Lots">
        <Row
          label="Arabic Lots"
          desc="Part of Fortune, Part of Spirit, Part of Eros & Part of Necessity"
          checked={showLots}
          onChange={(v) => save('show_lots', v)}
        />
      </Group>

      <Group label="Asteroids">
        <Row
          label="Asteroids"
          desc="Show Chiron and asteroid placements on your chart"
          checked={showAsteroids}
          onChange={(v) => save('show_asteroids', v)}
          locked={!canViewAsteroids}
          onLockClick={() => setPaywall('asteroids')}
        />
      </Group>

      {paywall && (
        <PaywallModal
          variant="calendar"
          fromTier="free"
          context={paywall === 'lilith' ? 'Black Moon Lilith' : 'the asteroid pack'}
          onClose={() => setPaywall(null)}
        />
      )}
    </div>
  );
}