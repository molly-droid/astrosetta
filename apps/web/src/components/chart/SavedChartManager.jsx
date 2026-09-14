import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, Trash2, Plus, X, Pencil, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const RELATIONSHIPS = ['Partner', 'Potential Partner', 'Crush', 'Ex', 'Friend', 'Child', 'Mother', 'Father', 'Sibling', 'Colleague', 'Boss', 'Client', 'Mentor', 'Other'];
const EVENT_TYPES = ['When We Met', 'First Date', 'Wedding', 'Engagement', 'Partnership', 'Career Milestone', 'Relocation', 'Travel', 'Achievement', 'Other'];
const PRONOUN_OPTIONS = ['', 'she/her', 'he/him', 'they/them'];

const EMPTY_FORM = {
  chart_type: 'person',
  name: '',
  relationship: 'Partner',
  pronouns: '',
  deceased: false,
  date_of_death: '',
  birth_date: '',
  birth_time: '',
  city_query: '',
  unknown_time: false,
};

export default function SavedChartManager({ user, charts, onRefresh, onClose }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [geoResults, setGeoResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const isEvent = form.chart_type === 'event';

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

  const handleDelete = async (chartId) => {
    await base44.entities.SavedChart.delete(chartId);
    onRefresh();
  };

  const handleEdit = (chart) => {
    const loc = chart.birth_location || {};
    setEditingId(chart.id);
    setForm({
      chart_type: chart.chart_type || 'person',
      name: chart.name || '',
      relationship: chart.relationship || 'Other',
      pronouns: chart.pronouns || '',
      deceased: chart.deceased || false,
      date_of_death: chart.date_of_death || '',
      birth_date: chart.birth_date || '',
      birth_time: chart.birth_time ? chart.birth_time.slice(0, 5) : '',
      city_query: loc.city ? `${loc.city}${loc.country ? ', ' + loc.country : ''}` : '',
      unknown_time: !chart.birth_time || chart.birth_time === '12:00:00',
    });
    setSelectedLocation(loc.latitude != null ? loc : null);
    setGeoResults([]);
    setError('');
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedLocation(null);
    setShowForm(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Please enter a name.'); return; }
    if (!form.birth_date) { setError('Please enter a birth date.'); return; }
    if (!selectedLocation) { setError('Please select a location from the dropdown.'); return; }

    setLoading(true);
    const birthTime = form.unknown_time ? '12:00:00' : (form.birth_time ? form.birth_time + ':00' : '12:00:00');
    const tz = selectedLocation.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    let utcOffset = 0;
    try {
      const [y, mo, d] = form.birth_date.split('-').map(Number);
      const [h, mi] = birthTime.split(':').map(Number);
      const testDate = new Date(Date.UTC(y, mo - 1, d, h, mi));
      const localParts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(testDate);
      const get = (type) => parseInt(localParts.find(p => p.type === type)?.value);
      const localH = get('hour') % 24;
      const localMi = get('minute');
      const utcH = testDate.getUTCHours();
      const utcMi = testDate.getUTCMinutes();
      utcOffset = (localH - utcH) + (localMi - utcMi) / 60;
      if (utcOffset > 14) utcOffset -= 24;
      if (utcOffset < -12) utcOffset += 24;
    } catch { utcOffset = 0; }

    const birthLocation = {
      city: selectedLocation.name,
      country: selectedLocation.country,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      timezone: tz,
    };

    // Check if birth data changed — only recalculate if it did
    const existing = editingId ? charts.find(c => c.id === editingId) : null;
    const birthDataChanged = !existing ||
      existing.birth_date !== form.birth_date ||
      existing.birth_time !== birthTime ||
      existing.utc_offset !== utcOffset ||
      JSON.stringify(existing.birth_location) !== JSON.stringify(birthLocation);

    let chartData = existing?.raw_data;
    let sunSign = existing?.sun_sign;
    let moonSign = existing?.moon_sign;
    let ascSign = existing?.ascendant_sign;

    if (birthDataChanged) {
      try {
        const res = await base44.functions.invoke('chartCalculator', {
          chart_type: 'natal',
          birth_date: form.birth_date,
          birth_time: birthTime,
          utc_offset: utcOffset,
          birth_location: birthLocation,
        });
        chartData = res.data;
        const sunPlanet = chartData.planets?.find(p => p.name === 'Sun');
        const moonPlanet = chartData.planets?.find(p => p.name === 'Moon');
        sunSign = sunPlanet?.sign || '';
        moonSign = moonPlanet?.sign || '';
        ascSign = chartData.angles?.ascendant?.sign || '';
      } catch (err) {
        setError('Failed to calculate chart. Please try again.');
        setLoading(false);
        return;
      }
    }

    const recordData = {
      chart_type: form.chart_type || 'person',
      name: form.name.trim(),
      relationship: form.relationship,
      pronouns: isEvent ? '' : (form.pronouns || ''),
      deceased: isEvent ? false : (form.deceased || false),
      date_of_death: isEvent ? null : (form.deceased ? (form.date_of_death || null) : null),
      birth_date: form.birth_date,
      birth_time: birthTime,
      birth_location: birthLocation,
      utc_offset: utcOffset,
      raw_data: chartData,
      sun_sign: sunSign,
      moon_sign: moonSign,
      ascendant_sign: ascSign,
    };

    if (editingId) {
      await base44.entities.SavedChart.update(editingId, recordData);
    } else {
      await base44.entities.SavedChart.create(recordData);
    }

    setLoading(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedLocation(null);
    setShowForm(false);
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pb-[88px] md:pb-4" onClick={onClose}>
      <div className="celestial-card w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="font-display text-lg text-cream">{editingId ? 'Edit Chart' : 'Saved Charts'}</h2>
          <button onClick={onClose} className="text-brass/50 hover:text-brass transition-colors"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* Existing charts */}
          {charts.length > 0 && !showForm && (
            <div className="space-y-2">
              {charts.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.chart_type === 'event' && <Calendar size={11} className="text-celestial-purple shrink-0" />}
                      <span className="font-body text-sm text-cream font-semibold">{c.name}</span>
                      {c.relationship && <span className="font-body text-[10px] text-brass/50 italic">{c.chart_type === 'event' ? c.relationship : `Your ${c.relationship}`}</span>}
                      {c.pronouns && <span className="font-body text-[9px] text-brass/40">{c.pronouns}</span>}
                      {c.deceased && <span className="font-body text-[9px] text-purple-soft italic">✦ in memoriam</span>}
                    </div>
                    <p className="font-body text-[10px] text-brass/50 truncate">
                      {c.sun_sign ? `☉ ${c.sun_sign}` : ''} {c.moon_sign ? `· ☽ ${c.moon_sign}` : ''} {c.ascendant_sign ? `· AC ${c.ascendant_sign}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleEdit(c)} className="text-brass/30 hover:text-gold-accent transition-colors p-1" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="text-brass/30 hover:text-red-400 transition-colors p-1" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Chart type toggle */}
              <div className="flex bg-white/[0.04] rounded-full p-0.5 border border-white/[0.06]">
                <button type="button" onClick={() => setForm(f => ({ ...f, chart_type: 'person' }))}
                  className={`flex-1 py-1.5 rounded-full font-body text-[11px] tracking-wide transition-all ${form.chart_type !== 'event' ? 'bg-gold-primary/20 text-white' : 'text-white/30 hover:text-white/60'}`}>
                  Person
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, chart_type: 'event', relationship: 'When We Met' }))}
                  className={`flex-1 py-1.5 rounded-full font-body text-[11px] tracking-wide transition-all ${form.chart_type === 'event' ? 'bg-gold-primary/20 text-white' : 'text-white/30 hover:text-white/60'}`}>
                  Event
                </button>
              </div>

              <div className="space-y-1.5">
                <Label className="font-body text-white text-xs font-semibold">{isEvent ? 'Event Name' : 'Name'}</Label>
                <Input type="text" name="name" placeholder={isEvent ? 'e.g. Our First Date' : 'Their name'} value={form.name} onChange={handleChange} required
                  className="bg-white/5 border-gold-primary/50 focus:border-gold-accent font-body text-white text-sm h-9" />
              </div>

              {isEvent ? (
                <div className="space-y-1.5">
                  <Label className="font-body text-white text-xs font-semibold">Event Type</Label>
                  <select name="relationship" value={form.relationship} onChange={handleChange}
                    className="w-full bg-white/5 border border-gold-primary/50 focus:border-gold-accent font-body text-white text-sm h-9 rounded-md px-2">
                    {EVENT_TYPES.map(r => <option key={r} value={r} className="bg-paper">{r}</option>)}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-body text-white text-xs font-semibold">Relationship</Label>
                    <select name="relationship" value={form.relationship} onChange={handleChange}
                      className="w-full bg-white/5 border border-gold-primary/50 focus:border-gold-accent font-body text-white text-sm h-9 rounded-md px-2">
                      {RELATIONSHIPS.map(r => <option key={r} value={r} className="bg-paper">{r}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-white text-xs font-semibold">Pronouns</Label>
                    <select name="pronouns" value={form.pronouns} onChange={handleChange}
                      className="w-full bg-white/5 border border-gold-primary/50 focus:border-gold-accent font-body text-white text-sm h-9 rounded-md px-2">
                      {PRONOUN_OPTIONS.map(p => <option key={p} value={p} className="bg-paper">{p || '—'}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-body text-white text-xs font-semibold">{isEvent ? 'Event Date' : 'Birth Date'}</Label>
                  <Input type="date" name="birth_date" value={form.birth_date} onChange={handleChange} required
                    className="bg-white/5 border-gold-primary/50 focus:border-gold-accent font-body text-white text-sm h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-white text-xs font-semibold">{isEvent ? 'Event Time' : 'Birth Time'}</Label>
                  <Input type="time" name="birth_time" value={form.birth_time} onChange={handleChange} disabled={form.unknown_time}
                    className="bg-white/5 border-gold-primary/50 focus:border-gold-accent font-body text-white text-sm h-9 disabled:opacity-40" />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="unknown_time" checked={form.unknown_time} onChange={handleChange} className="accent-gold-primary" />
                <span className="font-body text-[11px] text-brass/70">{isEvent ? 'Unknown time' : 'Unknown birth time'}</span>
              </label>

              {!isEvent && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="deceased" checked={form.deceased} onChange={handleChange} className="accent-gold-primary" />
                <span className="font-body text-[11px] text-brass/70">In memoriam — this person has passed</span>
              </label>
              )}

              {form.deceased && !isEvent && (
                <div className="space-y-1.5">
                  <Label className="font-body text-white text-xs font-semibold">Date of Passing <span className="text-brass/40 font-normal italic">(optional)</span></Label>
                  <Input type="date" name="date_of_death" value={form.date_of_death} onChange={handleChange}
                    className="bg-white/5 border-gold-primary/50 focus:border-gold-accent font-body text-white text-sm h-9" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="font-body text-white text-xs font-semibold">{isEvent ? 'Event Location' : 'Birth Location'}</Label>
                <Input type="text" name="city_query" placeholder="Search city..." value={form.city_query} onChange={handleChange}
                  className="bg-white/5 border-gold-primary/50 focus:border-gold-accent font-body text-white text-sm h-9" />
                {geoLoading && <Loader2 size={12} className="animate-spin text-gold-primary" />}
                {geoResults.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {geoResults.map(loc => (
                      <button key={`${loc.id}-${loc.name}`} type="button" onClick={() => selectLocation(loc)}
                        className="w-full text-left rounded-md bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1.5 transition-colors">
                        <span className="font-body text-[11px] text-white/80 flex items-center gap-1.5">
                          <MapPin size={10} className="text-gold-accent shrink-0" />
                          {loc.name}{loc.admin1 ? `, ${loc.admin1}` : ''}, {loc.country}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedLocation && (
                  <p className="font-body text-[10px] text-green-400 flex items-center gap-1">
                    <MapPin size={10} /> {selectedLocation.name}, {selectedLocation.country}
                  </p>
                )}
              </div>

              {error && <p className="font-body text-[11px] text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={loading}
                  className="flex-1 bg-gold-primary hover:bg-gold-accent text-cream font-body text-sm h-9">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : (editingId ? 'Update Chart' : 'Save Chart')}
                </Button>
                <Button type="button" variant="ghost" onClick={handleCancel}
                  className="text-brass hover:text-white font-body text-sm h-9">Cancel</Button>
              </div>
            </form>
          ) : !editingId ? (
            <button onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gold-primary/30 hover:border-gold-accent hover:bg-gold-primary/5 transition-all py-2.5">
              <Plus size={14} className="text-gold-accent" />
              <span className="font-body text-xs text-gold-accent">Add a Chart</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}