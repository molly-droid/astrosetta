// recomputeXpTotals — admin-only maintenance: removes duplicate XP awards caused
// by re-completing curriculum modules, then recomputes every user's xp_total and
// level from the deduplicated XPEvent ledger so every XP meter agrees.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Must match the XP level thresholds used by submitQuizAnswer and xpUtils.LEVELS
const XP_THRESHOLDS = [0, 200, 500, 1500];
const XP_LEVELS = ['apprentice', 'adept', 'practitioner', 'sage'];

function levelFromTotal(total) {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (total >= XP_THRESHOLDS[i]) return XP_LEVELS[i];
  }
  return 'apprentice';
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Curriculum module ids — only card_completed/mastery_completed events that
    // reference a real module are deduped (placement cards and bonus quizzes
    // legitimately award repeatedly and are left untouched).
    const modules = await base44.asServiceRole.entities.LearningModule.list(null, 1000);
    const moduleIds = new Set(modules.map(m => m.id));

    const users = await base44.asServiceRole.entities.User.list(null, 1000);
    let duplicatesRemoved = 0;
    let usersUpdated = 0;
    const details = [];

    for (const u of users) {
      const events = await base44.asServiceRole.entities.XPEvent.filter({ user_id: u.id });

      // Keep only the earliest award per (module event type, module id)
      const kept = new Map();
      const toDelete = [];
      for (const e of events) {
        const isModuleEvent = (e.event_type === 'card_completed' || e.event_type === 'mastery_completed')
          && e.reference_id && moduleIds.has(e.reference_id);
        if (!isModuleEvent) continue;
        const key = `${e.event_type}:${e.reference_id}`;
        const existing = kept.get(key);
        if (!existing) {
          kept.set(key, e);
        } else if (new Date(e.created_date) < new Date(existing.created_date)) {
          toDelete.push(existing.id);
          kept.set(key, e);
        } else {
          toDelete.push(e.id);
        }
      }

      for (const id of toDelete) {
        await base44.asServiceRole.entities.XPEvent.delete(id);
      }
      duplicatesRemoved += toDelete.length;

      const remaining = toDelete.length ? events.filter(e => !toDelete.includes(e.id)) : events;
      const total = remaining.reduce((sum, e) => sum + (e.xp_amount || 0), 0);
      const level = levelFromTotal(total);

      if ((u.xp_total || 0) !== total || (u.level || '') !== level) {
        await base44.asServiceRole.entities.User.update(u.id, { xp_total: total, level });
        usersUpdated++;
        details.push({ user: u.email, was: u.xp_total || 0, now: total, level });
      }
    }

    return Response.json({ ok: true, usersChecked: users.length, duplicatesRemoved, usersUpdated, details });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}