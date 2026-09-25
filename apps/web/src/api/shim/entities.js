// Base44 entity CRUD -> Supabase tables.
//
// Mirrors the @base44/sdk entity surface actually used by the app:
//   list(sort?, limit?)          filter(query, sort?, limit?)
//   create(data)                 update(id, data)
//   delete(id)                   deleteMany(query)
//   subscribe(callback) -> unsubscribe
//
// Sort strings follow Base44 convention: 'field' asc, '-field' desc.
// Filter queries are plain equality maps ({ user_id: x }) — the only form
// the app uses; array values map to IN, null to IS NULL.
import { supabase } from './supabase.js';
import { ENTITY_TABLES } from './tables.js';

const DEFAULT_SORT = '-created_date';

function applySort(builder, sort) {
  const s = sort || DEFAULT_SORT;
  const desc = s.startsWith('-');
  return builder.order(desc ? s.slice(1) : s, { ascending: !desc });
}

function applyFilter(builder, query) {
  for (const [field, value] of Object.entries(query || {})) {
    if (value === null) builder = builder.is(field, null);
    else if (Array.isArray(value)) builder = builder.in(field, value);
    else builder = builder.eq(field, value);
  }
  return builder;
}

function throwOn(error) {
  if (error) {
    const err = new Error(error.message);
    err.status = Number(error.code) || 500;
    err.data = error;
    throw err;
  }
}

function makeEntity(table) {
  return {
    async list(sort, limit) {
      let q = applySort(supabase.from(table).select('*'), sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      throwOn(error);
      return data;
    },

    async filter(query, sort, limit) {
      let q = applySort(applyFilter(supabase.from(table).select('*'), query), sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      throwOn(error);
      return data;
    },

    async create(record) {
      const { data, error } = await supabase.from(table).insert(record).select().single();
      throwOn(error);
      return data;
    },

    async update(id, record) {
      const { data, error } = await supabase
        .from(table)
        .update(record)
        .eq('id', id)
        .select()
        .single();
      throwOn(error);
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      throwOn(error);
      return { id };
    },

    async deleteMany(query) {
      const { error } = await applyFilter(supabase.from(table).delete(), query);
      throwOn(error);
      return true;
    },

    subscribe(callback) {
      const channel = supabase
        .channel(`entity:${table}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) =>
          callback(payload)
        )
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

export const entities = Object.fromEntries(
  Object.entries(ENTITY_TABLES).map(([name, table]) => [name, makeEntity(table)])
);
