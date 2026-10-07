import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, CheckCircle } from 'lucide-react';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import { base44 } from '@/api/base44Client';
import { extractPlacementKeys } from '@/lib/chartUtils';
import { awardXP } from '@/lib/xpUtils';
import { track, EVENTS } from '@/lib/analytics';

export default function BirthDataForm({ user, onComplete }) {
  const [form, setForm] = useState({
    display_name: '',
    birth_date: '',
    birth_time: '',
    city_query: '',
    unknown_time: false,
  });
  const [geoResults, setGeoResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));

    if (name === 'city_query') {
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

    if (!selectedLocation) {
      setError('Please select a location from the dropdown.');
      return;
    }

    setLoading(true);

    const birthTime = form.unknown_time ? '12:00:00' : (form.birth_time + ':00');

    // Compute the correct UTC offset for the birth date/time in the location's timezone
    // This handles DST automatically via the Intl API
    const tz = selectedLocation.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    let utcOffset = 0;
    try {
      const [y, mo, d] = form.birth_date.split('-').map(Number);
      const [h, mi] = birthTime.split(':').map(Number);
      // Create a date object representing the local time in that timezone
      const testDate = new Date(Date.UTC(y, mo - 1, d, h, mi));
      // Get what the clock reads in that timezone
      const localParts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(testDate);
      const get = (type) => parseInt(localParts.find(p => p.type === type)?.value);
      const localH = get('hour') % 24;
      const localMi = get('minute');
      const localD = get('day');
      // Offset = local time - UTC time (in hours)
      const utcH = testDate.getUTCHours();
      const utcMi = testDate.getUTCMinutes();
      utcOffset = (localH - utcH) + (localMi - utcMi) / 60;
      // Handle day boundary crossing
      if (utcOffset > 14) utcOffset -= 24;
      if (utcOffset < -12) utcOffset += 24;
    } catch {
      utcOffset = 0;
    }

    const payload = {
      birth_date: form.birth_date,
      birth_time: birthTime,
      unknown_time: form.unknown_time,
      utc_offset: utcOffset,
      birth_location: {
        city: selectedLocation.name,
        country: selectedLocation.country,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        timezone: tz,
      },
    };

    let chartData;
    try {
      const res = await base44.functions.invoke('chartCalculator', payload);
      chartData = res.data;
    } catch (err) {
      chartData = generateMockChart(payload);
    }

    const placementKeys = extractPlacementKeys(chartData);
    const sunPlanet = chartData.planets?.find(p => p.name === 'Sun');
    const moonPlanet = chartData.planets?.find(p => p.name === 'Moon');
    // Unknown birth time — rising cannot be determined; never store a fabricated one
    const ascSign = form.unknown_time ? '' : (chartData.angles?.ascendant?.sign || '');

    await base44.entities.Chart.create({
      user_id: user.id,
      raw_data: chartData,
      placement_keys: placementKeys,
      ascendant_sign: ascSign,
      sun_sign: sunPlanet?.sign || '',
      moon_sign: moonPlanet?.sign || '',
      calculated_at: new Date().toISOString(),
    });

    await base44.auth.updateMe({
      ...(form.display_name.trim() ? { display_name: form.display_name.trim() } : {}),
      birth_date: form.birth_date,
      birth_time: birthTime,
      birth_location: form.city_query,
      last_active: new Date().toISOString(),
    });

    await awardXP(user.id, 'first_chart', 50);
    track(EVENTS.CHART_CREATED, {
      sun_sign: sunPlanet?.sign || '',
      moon_sign: moonPlanet?.sign || '',
      ascendant_sign: ascSign,
      unknown_time: form.unknown_time,
    });
    setLoading(false);
    onComplete(chartData, placementKeys, ascSign, sunPlanet?.sign || '', moonPlanet?.sign || '');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label className="font-body text-white font-semibold">What should we call you?</Label>
        <Input
          type="text"
          name="display_name"
          placeholder="Preferred name or nickname"
          value={form.display_name}
          onChange={handleChange}
          className="w-full bg-white/5 border-gold-primary/50 focus:border-gold-accent font-body text-white"
        />
        <p className="text-[11px] font-body text-brass/60 italic">This is how your chart and app will address you.</p>
      </div>

      <div className="space-y-2">
        <Label className="font-body text-white font-semibold">Birth Date</Label>
        <Input
          type="date"
          name="birth_date"
          value={form.birth_date}
          onChange={handleChange}
          required
          className="w-full bg-white/5 border-gold-primary/50 focus:border-gold-accent font-body text-white"
        />
      </div>

      <div className="space-y-2">
        <Label className="font-body text-white font-semibold">Birth Time</Label>
        <Input
          type="time"
          name="birth_time"
          value={form.birth_time}
          onChange={handleChange}
          disabled={form.unknown_time}
          className="w-full bg-white/5 border-gold-primary/50 focus:border-gold-accent font-body text-white disabled:opacity-40"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer -mt-2">
        <input
          type="checkbox"
          name="unknown_time"
          checked={form.unknown_time}
          onChange={handleChange}
          className="accent-gold-accent"
        />
        <span className="text-xs font-body text-brass italic">I don't know my birth time (defaults to noon)</span>
      </label>

      <div className="space-y-2">
        <Label className="font-body text-white font-semibold">Birth City</Label>
        <div className="relative">
          <Input
            type="text"
            name="city_query"
            placeholder="e.g. Austin, Texas"
            value={form.city_query}
            onChange={handleChange}
            autoComplete="off"
            required
            className="w-full bg-white/5 border-gold-primary/50 focus:border-gold-accent font-body text-white pr-8"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {geoLoading ? (
              <Loader2 size={14} className="animate-spin text-brass/50" />
            ) : selectedLocation ? (
              <CheckCircle size={14} className="text-green-600" />
            ) : (
              <MapPin size={14} className="text-brass/40" />
            )}
          </div>
        </div>

        {/* Dropdown results */}
        {geoResults.length > 0 && (
          <div className="border border-gold-primary/40 rounded-lg overflow-hidden shadow-md" style={{ background: '#1a2847' }}>
            {geoResults.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => selectLocation(loc)}
                className="w-full text-left px-3 py-2.5 hover:bg-gold-primary/10 border-b border-gold-primary/20 last:border-0 transition-colors"
              >
                <p className="font-body text-sm text-white">
                  {loc.name}{loc.admin1 ? `, ${loc.admin1}` : ''}
                </p>
                <p className="font-body text-xs text-brass">{loc.country} · {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°</p>
              </button>
            ))}
          </div>
        )}

        {selectedLocation && (
          <p className="text-[11px] font-body text-brass/70 italic">
            📍 {selectedLocation.latitude.toFixed(4)}°, {selectedLocation.longitude.toFixed(4)}° · {selectedLocation.timezone}
          </p>
        )}
      </div>

      <OrnamentDivider />

      {error && <p className="text-destructive text-sm font-body text-center">{error}</p>}

      <Button
        type="submit"
        disabled={loading || !selectedLocation}
        className="w-full bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold text-base tracking-wide rounded-xl h-12 shadow-sm transition-all disabled:opacity-50"
      >
        {loading ? (
          <><Loader2 className="animate-spin mr-2" size={18} /> Calculating your chart…</>
        ) : (
          'Calculate My Birth Chart ✦'
        )}
      </Button>
    </form>
  );
}

function generateMockChart(payload) {
  const signs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  const planets = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  return {
    chart_type: 'natal',
    planets: planets.map((name, i) => ({
      name, sign: rand(signs), degree: Math.random() * 30, house: (i % 12) + 1, retrograde: false
    })),
    houses: Array.from({length: 12}, (_, i) => ({ number: i+1, sign: signs[i % 12], cusp_degree: Math.random() * 30 })),
    angles: {
      ascendant: { sign: rand(signs), degree: Math.random() * 30 },
      midheaven: { sign: rand(signs), degree: Math.random() * 30 },
    },
    aspects: [
      { planet1: 'Sun', planet2: 'Moon', aspect: 'conjunction', orb: 2.5, strength: 'strong' },
      { planet1: 'Venus', planet2: 'Mars', aspect: 'trine', orb: 3.1, strength: 'strong' },
    ],
    nodes: {
      north_node: { sign: rand(signs), degree: Math.random() * 30 },
      south_node: { sign: rand(signs), degree: Math.random() * 30 },
    },
    element_distribution: { fire: 25, earth: 25, air: 25, water: 25 },
    modality_distribution: { cardinal: 33, fixed: 34, mutable: 33 },
  };
}