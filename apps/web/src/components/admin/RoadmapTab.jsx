import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2, CheckCircle2, Circle, Clock, Trash2, EyeOff, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
  { key: 'data_accuracy',      label: '🔭 Data & Accuracy' },
  { key: 'planner_ux',         label: '🗓️ Planner UX' },
  { key: 'synthesis_quality',  label: '✦ Synthesis Quality' },
  { key: 'export_sync',        label: '📤 Export & Sync' },
  { key: 'learn_integration',  label: '🎓 Learn Integration' },
  { key: 'mobile_polish',      label: '📱 Mobile Polish' },
  { key: 'other',              label: '📝 Other' },
];

const STATUS_ICONS = {
  todo:        <Circle size={16} className="text-brass/40 flex-shrink-0" />,
  in_progress: <Clock size={16} className="text-gold-accent flex-shrink-0" />,
  done:        <CheckCircle2 size={16} className="text-green-soft flex-shrink-0" />,
};

const STATUS_CYCLE = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

export default function RoadmapTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newNotes, setNewNotes] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const [sortBy, setSortBy] = useState('category'); // 'category' | 'date' | 'status'

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await base44.entities.RoadmapItem.list('order_index', 200);
    setItems(data);
    setLoading(false);
  };

  const cycleStatus = async (item) => {
    const next = STATUS_CYCLE[item.status] || 'todo';
    try {
      await base44.entities.RoadmapItem.update(item.id, { status: next });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next } : i));
    } catch (e) {
      // Item no longer exists in DB — reload fresh data
      await load();
    }
  };

  const deleteItem = async (id) => {
    try {
      await base44.entities.RoadmapItem.delete(id);
    } catch (e) {
      // Item may already be gone — ignore
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const addItem = async () => {
    if (!newTitle.trim()) return;
    const created = await base44.entities.RoadmapItem.create({
      title: newTitle.trim(),
      category: newCategory,
      notes: newNotes.trim() || undefined,
      status: 'todo',
      order_index: items.length,
    });
    setItems(prev => [...prev, created]);
    setNewTitle('');
    setNewNotes('');
    setNewCategory('other');
    setAdding(false);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gold-primary" size={22} /></div>;

  const totalDone = items.filter(i => i.status === 'done').length;
  const total = items.length;

  // Apply hide-done filter
  const visibleItems = hideDone ? items.filter(i => i.status !== 'done') : items;

  // Sort + group
  const isCategoryFilter = sortBy !== 'category' && CATEGORIES.some(c => c.key === sortBy);

  let grouped;
  if (isCategoryFilter) {
    // Single category selected — show just that one group
    const cat = CATEGORIES.find(c => c.key === sortBy);
    grouped = [{ key: cat.key, label: cat.label, items: visibleItems.filter(i => (i.category || 'other') === cat.key) }].filter(g => g.items.length > 0);
  } else {
    // "All" — group by every category
    grouped = CATEGORIES.map(cat => ({
      ...cat,
      items: visibleItems.filter(i => (i.category || 'other') === cat.key),
    })).filter(g => g.items.length > 0);
  }

  // Push done items to bottom within each group
  grouped = grouped.map(g => ({
    ...g,
    items: [...g.items.filter(i => i.status !== 'done'), ...g.items.filter(i => i.status === 'done')],
  }));

  return (
    <div className="space-y-4 mt-4">
      {/* Progress bar */}
      {total > 0 && (
        <div className="celestial-card p-3 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="font-body text-xs text-white/70">Progress</span>
            <span className="font-body text-xs text-white/70">{totalDone}/{total} done</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-accent rounded-full transition-all"
              style={{ width: `${total > 0 ? (totalDone / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Category tab-bar + Hide done */}
      <div className="flex items-center gap-2 flex-wrap border-b border-white/[0.06] pb-3">
        <button
          onClick={() => setSortBy('category')}
          className={`font-body text-[10px] px-3 py-1 rounded-full border transition-colors ${
            sortBy === 'category'
              ? 'border-gold-accent bg-gold-primary/20 text-white'
              : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setSortBy(cat.key)}
            className={`font-body text-[10px] px-3 py-1 rounded-full border transition-colors ${
              sortBy === cat.key
                ? 'border-gold-accent bg-gold-primary/20 text-white'
                : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'
            }`}
          >
            {cat.label}
          </button>
        ))}
        <button
          onClick={() => setHideDone(h => !h)}
          className={`ml-auto flex items-center gap-1 font-body text-[10px] px-3 py-1 rounded-full border transition-colors ${
            hideDone
              ? 'border-gold-accent bg-gold-primary/20 text-white'
              : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'
          }`}
        >
          {hideDone ? <Eye size={11} /> : <EyeOff size={11} />}
          {hideDone ? 'Show done' : 'Hide done'}
        </button>
      </div>

      {/* Groups */}
      {grouped.map(group => (
          <div key={group.key} className="space-y-1.5">
            <p className="font-body text-[10px] uppercase tracking-widest text-white/50 px-1">{group.label}</p>
            {group.items.map(item => (
              <div
                key={item.id}
                className={`celestial-card p-3 flex items-start gap-3 ${item.status === 'done' ? 'opacity-50' : ''}`}
              >
                <button onClick={() => cycleStatus(item)} className="mt-0.5 hover:opacity-70 transition-opacity" title="Click to cycle status">
                  {STATUS_ICONS[item.status]}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-body text-sm text-white leading-snug ${item.status === 'done' ? 'line-through' : ''}`}>
                    {item.title}
                  </p>
                  {item.notes && (
                    <p className="font-body text-[11px] text-white/60 mt-0.5 leading-snug">{item.notes}</p>
                  )}
                  <span className={`inline-block mt-1 font-body text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${
                    item.status === 'done' ? 'border-green-soft/40 text-green-soft/60 bg-green-soft/10' :
                    item.status === 'in_progress' ? 'border-gold-accent/40 text-gold-accent bg-gold-primary/10' :
                    'border-brass/20 text-brass/50 bg-transparent'
                  }`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
                <button onClick={() => deleteItem(item.id)} className="text-brass/20 hover:text-destructive/60 transition-colors mt-0.5 flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
      ))}

      {items.length === 0 && (
        <p className="text-center font-body text-sm text-white/60 italic py-8">No items yet — add your first recommendation below.</p>
      )}

      {/* Add form */}
      {adding ? (
        <div className="celestial-card p-4 space-y-3">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Task or recommendation..."
            className="w-full font-body text-sm bg-transparent border-b border-gold-primary/30 pb-1.5 text-white placeholder:text-white/30 outline-none"
          />
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            className="w-full font-body text-xs bg-white/[0.08] border border-white/20 rounded-lg px-3 py-2 text-white outline-none"
          >
            {CATEGORIES.map(c => <option key={c.key} value={c.key} className="bg-[#0f1a2e] text-white">{c.label}</option>)}
          </select>
          <textarea
            value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            placeholder="Notes (optional)..."
            rows={2}
            className="w-full font-body text-xs bg-transparent border border-white/20 rounded-lg px-3 py-2 text-white placeholder:text-white/30 outline-none resize-none"
          />
          <div className="flex gap-2">
            <Button onClick={addItem} size="sm" className="bg-gold-primary/80 hover:bg-gold-primary text-deep-blue font-body text-xs h-8">
              Add Item
            </Button>
            <Button onClick={() => setAdding(false)} size="sm" variant="outline" className="font-body text-xs h-8">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/20 rounded-xl text-white/40 hover:text-white/70 hover:border-white/40 transition-colors font-body text-xs"
        >
          <Plus size={14} /> Add item
        </button>
      )}
    </div>
  );
}