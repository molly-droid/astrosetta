import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, CheckCircle } from 'lucide-react';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import { base44 } from '@/api/base44Client';
import { extractPlacementKeys } from '@/lib/chartUtils';

export default function EditBirthDataModal({ open, onClose, user, existingChart, onChartRegenerated, isImpersonating, houseSystem = 'whole_sign', tradition = 'modern' }) {
  const existingLoc = existingChart?.raw_data?.birth_location || null;

  const [form, setForm] = useState({
    birth_date: user?.birth_date || '',
    birth_time: user?.birth_time?.slice(0, 5) || '',
    city_query: user?.birth_location || '',
    unknown_time: false,
  });
  const [geoResults, setGeoResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(existingLoc);
  const [cityChanged, setCityChanged] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  // Reset form state whenever modal opens
  useEffect(() => {
    if (open) {
      setForm({
        birth_date: user?.birth_date || '',
        birth_time: user?.birth_time?.slice(0, 5) || '',
        city_query: user?.birth_location || '',
        unknown_time: !!existingChart?.raw_data?.unknown_time,
      });
      setGeoResults([]);
      setCityChanged(false);
      setError('');

      if (existingLoc) {
        // Chart exists — use stored coords
        setSelectedLocation(existingLoc);
      } else if (user?.birth_location) {
        // User has a birth location string but no chart coords — auto-geocode it
        setSelectedLocation(null);
        setGeoLoading(true);
        fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(user.birth_location)}&count=1&language=en&format=json`)
          .then(r => r.json())
          .then(data => {
            if (data.results?.[0]) setSelectedLocation(data.results[0]);
          })
          .catch(() => {})
          .finally(() => setGeoLoading(false));
      } else {
        setSelectedLocation(null);
      }
    }
  }, [open]);

  const effectiveLocation = selectedLocation;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));

    if (name === 'city_query') {
      setCityChanged(true);
      setSelectedLocation(null);
      clearTimeout(debounceRef.current);
      if (value.length >= 3) {
        debounceRef.current = setTimeout(() => geocodeCity(value), 400);
      } else {
        setGeoResults([]);
      }
    }
  };

  const geocodeCity = async (query) => {
    setGeoLoading(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
      );
      const data = await res.json();
      setGeoResults(data.results || []);
    } catch {
      setGeoResults([]);
    } finally {
      setGeoLoading(false);
    }
  };

  const selectLocation = (loc) => {
    setSelectedLocation(loc);
    setForm(f => ({ ...f, city_query: `${loc.name}${loc.admin1 ? ', ' + loc.admin1 : ''}, ${loc.country}` }));
    setGeoResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!effectiveLocation || effectiveLocation.latitude == null) {
      setError('Please search and select a location from the dropdown.');
      return;
    }

    setLoading(true);

    const birthTime = form.unknown_time ? '12:00:00' : (form.birth_time + ':00');
    const tz = effectiveLocation.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Compute DST-aware UTC offset for the birth date/time in the location's timezone
    let utcOffset = 0;
    try {
      const [y, mo, d] = form.birth_date.split('-').map(Number);
      const [h, mi] = birthTime.split(':').map(Number);
      const testDate = new Date(Date.UTC(y, mo - 1, d, h, mi));
      const localParts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(testDate);
      const get = (type) => parseInt(localParts.find(p => p.type === type)?.value);
      const localH = get('hour') % 24;
      const localMi = get('minute');
      utcOffset = (localH - testDate.getUTCHours()) + (localMi - testDate.getUTCMinutes()) / 60;
      if (utcOffset > 14) utcOffset -= 24;
      if (utcOffset < -12) utcOffset += 24;
    } catch {
      utcOffset = 0;
    }

    const birthLocationPayload = {
      city: effectiveLocation.name || effectiveLocation.city || form.city_query,
      country: effectiveLocation.country || '',
      latitude: effectiveLocation.latitude,
      longitude: effectiveLocation.longitude,
      timezone: tz,
    };

    const payload = {
      birth_date: form.birth_date,
      birth_time: birthTime,
      unknown_time: form.unknown_time,
      utc_offset: utcOffset,
      birth_location: birthLocationPayload,
      house_system: houseSystem,
      tradition,
    };

    let chartData;
    try {
      const res = await base44.functions.invoke('chartCalculator', payload);
      chartData = res.data;
      if (chartData?.error) throw new Error(chartData.error);
    } catch (err) {
      setError('Chart calculation failed: ' + (err.message || 'Please try again.'));
      setLoading(false);
      return;
    }

    // Embed birth_location into raw_data for future re-edits
    const enrichedChartData = { ...chartData, birth_location: birthLocationPayload };

    const placementKeys = extractPlacementKeys(enrichedChartData);
    const sunPlanet = enrichedChartData.planets?.find(p => p.name === 'Sun');
    const moonPlanet = enrichedChartData.planets?.find(p => p.name === 'Moon');
    // Unknown birth time — rising cannot be determined; never store a fabricated one
    const ascSign = form.unknown_time ? '' : (enrichedChartData.angles?.ascendant?.sign || '');

    if (existingChart?.id) {
      await base44.entities.Chart.update(existingChart.id, {
        raw_data: enrichedChartData,
        placement_keys: placementKeys,
        ascendant_sign: ascSign,
        sun_sign: sunPlanet?.sign || '',
        moon_sign: moonPlanet?.sign || '',
        calculated_at: new Date().toISOString(),
      });
    } else {
      await base44.entities.Chart.create({
        user_id: user.id,
        raw_data: enrichedChartData,
        placement_keys: placementKeys,
        ascendant_sign: ascSign,
        sun_sign: sunPlanet?.sign || '',
        moon_sign: moonPlanet?.sign || '',
        calculated_at: new Date().toISOString(),
      });
    }

    if (isImpersonating) {
      await base44.entities.User.update(user.id, {
        birth_date: form.birth_date,
        birth_time: birthTime,
        birth_location: form.city_query,
      });
    } else {
      await base44.auth.updateMe({
        birth_date: form.birth_date,
        birth_time: birthTime,
        birth_location: form.city_query,
      });
    }

    setLoading(false);
    onChartRegenerated();
    onClose();
  };

  const locationConfirmed = !!effectiveLocation && effectiveLocation.latitude != null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-paper border-gold-primary/40 max-w-sm mx-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-deep-blue text-lg">Update Birth Information</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          <div className="space-y-2">
            <Label className="font-body text-deep-blue font-semibold text-sm">Birth Date</Label>
            <Input
              type="date"
              name="birth_date"
              value={form.birth_date}
              onChange={handleChange}
              required
              className="bg-cream border-gold-primary/50 focus:border-gold-accent font-body text-deep-blue"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-body text-deep-blue font-semibold text-sm">Birth Time</Label>
            <Input
              type="time"
              name="birth_time"
              value={form.birth_time}
              onChange={handleChange}
              disabled={form.unknown_time}
              className="bg-cream border-gold-primary/50 focus:border-gold-accent font-body text-deep-blue disabled:opacity-40"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="unknown_time"
                checked={form.unknown_time}
                onChange={handleChange}
                className="accent-gold-accent"
              />
              <span className="text-xs font-body text-brass italic">Unknown time (defaults to noon)</span>
            </label>
          </div>

          <div className="space-y-2">
            <Label className="font-body text-deep-blue font-semibold text-sm">Birth City</Label>
            <div className="relative">
              <Input
                type="text"
                name="city_query"
                placeholder="e.g. Austin, Texas"
                value={form.city_query}
                onChange={handleChange}
                autoComplete="off"
                required
                className="bg-cream border-gold-primary/50 focus:border-gold-accent font-body text-deep-blue pr-8"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {geoLoading ? (
                  <Loader2 size={14} className="animate-spin text-brass/50" />
                ) : locationConfirmed ? (
                  <CheckCircle size={14} className="text-green-600" />
                ) : (
                  <MapPin size={14} className="text-brass/40" />
                )}
              </div>
            </div>

            {geoResults.length > 0 && (
              <div className="border border-gold-primary/40 rounded-lg bg-paper shadow-md overflow-hidden z-10">
                {geoResults.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => selectLocation(loc)}
                    className="w-full text-left px-3 py-2 hover:bg-gold-primary/10 border-b border-gold-primary/20 last:border-0 transition-colors"
                  >
                    <p className="font-body text-sm text-deep-blue">{loc.name}{loc.admin1 ? `, ${loc.admin1}` : ''}</p>
                    <p className="font-body text-xs text-brass">{loc.country} · {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°</p>
                  </button>
                ))}
              </div>
            )}

            {effectiveLocation?.latitude != null && (
              <p className="text-[11px] font-body text-brass/70 italic">
                📍 {effectiveLocation.latitude.toFixed(4)}°, {effectiveLocation.longitude.toFixed(4)}°
                {effectiveLocation.timezone ? ` · ${effectiveLocation.timezone}` : ''}
              </p>
            )}

            {cityChanged && !locationConfirmed && (
              <p className="text-[11px] font-body text-brass/70 italic">
                Type your city to search and select from the list.
              </p>
            )}
          </div>

          <OrnamentDivider />

          {error && <p className="text-destructive text-sm font-body text-center">{error}</p>}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-gold-primary/40 font-body text-sm">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !locationConfirmed}
              className="flex-1 bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold text-sm rounded-xl disabled:opacity-50"
            >
              {loading ? <><Loader2 className="animate-spin mr-1.5" size={15} /> Recalculating…</> : 'Regenerate Chart ✦'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
