/**
 * base44Compat — server-side stand-in for the Base44 SDK client, so ported
 * function bodies (and the base44/shared modules that take a `base44`
 * parameter) run unchanged against Supabase.
 *
 * Surface implemented (exactly what the exported functions use):
 *   base44.auth.me() / auth.updateMe(data)
 *   base44.entities.<Name>.list/filter/get/create/update/delete   (caller's RLS)
 *   base44.asServiceRole.entities.<Name>.… (+ updateMany)          (service role)
 *   base44.asServiceRole.integrations.Core.InvokeLLM / SendEmail
 *   base44.functions.invoke(name, payload)            (forwards caller's JWT)
 *   base44.asServiceRole.functions.invoke(name, payload)
 *
 * Usage in a ported function:
 *   import { compatClient } from '../_shared/base44Compat.ts';
 *   const base44 = compatClient(req);   // instead of createClientFromRequest(req)
 */
import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { userClient, serviceClient } from './edge.ts';
import { ENTITY_TABLES } from './tables.ts';
import { invokeLLM } from './llm.ts';
import { sendDigestEmail } from './resendEmail.ts';

const DEFAULT_SORT = '-created_date';
const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function applySort(builder: any, sort?: string | null) {
  const s = sort || DEFAULT_SORT;
  const desc = s.startsWith('-');
  return builder.order(desc ? s.slice(1) : s, { ascending: !desc });
}

function applyFilter(builder: any, query: Record<string, unknown>) {
  for (const [field, value] of Object.entries(query || {})) {
    if (value === null) builder = builder.is(field, null);
    else if (Array.isArray(value)) builder = builder.in(field, value);
    else builder = builder.eq(field, value);
  }
  return builder;
}

function throwOn(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function makeEntity(client: SupabaseClient, table: string) {
  return {
    async list(sort?: string | null, limit?: number) {
      let q = applySort(client.from(table).select('*'), sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      throwOn(error);
      return data;
    },
    async filter(query: Record<string, unknown>, sort?: string | null, limit?: number) {
      let q = applySort(applyFilter(client.from(table).select('*'), query), sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      throwOn(error);
      return data;
    },
    async get(id: string) {
      const { data, error } = await client.from(table).select('*').eq('id', id).single();
      throwOn(error);
      return data;
    },
    async create(record: Record<string, unknown>) {
      const { data, error } = await client.from(table).insert(record).select().single();
      throwOn(error);
      return data;
    },
    async update(id: string, record: Record<string, unknown>) {
      const { data, error } = await client.from(table).update(record).eq('id', id).select().single();
      throwOn(error);
      return data;
    },
    // Base44 updateMany semantics: query supports equality and {$gt: n};
    // update supports plain fields, {$set: {...}}, and atomic {$inc: {...}}.
    // Returns { updated: n } (accountDeletion/eventOrders check .updated).
    async updateMany(query: Record<string, unknown>, update: Record<string, unknown>) {
      const setFields = { ...(update.$set as Record<string, unknown> ?? {}) };
      const incFields = (update.$inc as Record<string, unknown>) ?? {};
      for (const [k, v] of Object.entries(update)) {
        if (k !== '$set' && k !== '$inc') setFields[k] = v;
      }
      const { data, error } = await client.rpc('compat_update_many', {
        p_table: table,
        p_query: query ?? {},
        p_set: setFields,
        p_inc: incFields,
      });
      throwOn(error);
      return { updated: data ?? 0 };
    },
    async delete(id: string) {
      const { error } = await client.from(table).delete().eq('id', id);
      throwOn(error);
      return { id };
    },
    async deleteMany(query: Record<string, unknown>) {
      const { error } = await applyFilter(client.from(table).delete(), query);
      throwOn(error);
      return true;
    },
  };
}

function makeEntities(client: SupabaseClient) {
  return Object.fromEntries(
    Object.entries(ENTITY_TABLES).map(([name, table]) => [name, makeEntity(client, table)])
  );
}

const Core = {
  InvokeLLM: invokeLLM,
  SendEmail: ({ to, subject, body, from_name }: { to: string; subject: string; body?: string; from_name?: string }) =>
    sendDigestEmail({ to, subject, html: body ?? '', fromName: from_name }),
};

function makeFunctions(authHeader: string) {
  return {
    async invoke(name: string, payload?: unknown) {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${kebab(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify(payload ?? {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err: Error & { status?: number; data?: unknown } =
          new Error(data?.error || `Function ${name} failed (${res.status})`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return { data, status: res.status };
    },
  };
}

export function compatClient(req?: Request) {
  const service = serviceClient();
  const user = req ? userClient(req) : service;
  const callerAuth = req?.headers.get('Authorization') ?? '';
  const serviceAuth = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;

  return {
    auth: {
      async me() {
        if (!req) return null;
        const { data } = await user.auth.getUser();
        const authUser = data?.user;
        if (!authUser) return null;
        const { data: row, error } = await service
          .from('users').select('*').eq('id', authUser.id).maybeSingle();
        throwOn(error);
        if (!row) return null;
        return { ...row, email: row.email || authUser.email };
      },
      async updateMe(updates: Record<string, unknown>) {
        if (!req) throw new Error('updateMe requires a request context');
        const { data } = await user.auth.getUser();
        const authUser = data?.user;
        if (!authUser) throw new Error('Not authenticated');
        const { data: row, error } = await service
          .from('users').update(updates).eq('id', authUser.id).select().single();
        throwOn(error);
        return row;
      },
    },
    entities: makeEntities(user),
    functions: makeFunctions(callerAuth || serviceAuth),
    asServiceRole: {
      entities: makeEntities(service),
      integrations: { Core },
      functions: makeFunctions(serviceAuth),
    },
    integrations: { Core },
  };
}
