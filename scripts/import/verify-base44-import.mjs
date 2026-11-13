#!/usr/bin/env node
// Read-back validation plus an isolated, disposable recovery fixture. No emails.
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {client,readAll,authUsers,save,sql,tables,idToUuid} from './reconcile-base44.mjs';
import assert from 'node:assert/strict';
const root=process.argv[2];
if(!root)throw new Error('Usage: verify-base44-import.mjs PRIVATE_EXPORT_DIR');
const get=(dir,name)=>JSON.parse(fs.readFileSync(`${root}/${dir}/${name}.json`));
const db=client(), plan=get('','applied-plan'),map=get('','live-user-id-map');
const source=Object.fromEntries(['User',...Object.keys(tables)].map(e=>[e,get('converted',e)]));
const before=get('supabase-before','database-state');
const stamp=v=>Date.parse(v.includes('T')&&!/(Z|[+-]\d\d:\d\d)$/.test(v)?v+'Z':v);
const canon=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const after={}; let fieldsChecked=0, sourceRecordsChecked=0;
for(const table of ['users',...Object.values(tables)]) {
  after[table]=await readAll(db,table);
  const byId=new Map(after[table].map(r=>[r.id,r]));
  const timeColumns=new Set(before.columns.filter(c=>c.table===table&&c.type.startsWith('timestamp')).map(c=>c.name));
  for(const row of plan.byTable[table]) {
    const actual=byId.get(row.id); assert.ok(actual,`Missing applied row in ${table}`);
    for(const [k,v] of Object.entries(row)) {
      assert.equal(timeColumns.has(k)&&v?stamp(actual[k]):canon(actual[k]),timeColumns.has(k)&&v?stamp(v):canon(v),`Read-back mismatch ${table}.${k}`);fieldsChecked++;
    }
  }
  if(table!=='users') {
    const entity=Object.keys(tables).find(e=>tables[e]===table);
    for(const row of source[entity]) {
      const id=plan.aliases[row.id]||idToUuid(row.id);
      assert.ok(byId.has(id),`Source record missing from ${table}`);sourceRecordsChecked++;
    }
  }
}
const auth=await authUsers(db);assert.equal(auth.length,get('supabase-at-import','auth-users').length+get('','new-auth-user-ids').length);
for(const u of source.User) {
  const a=auth.find(a=>a.id===map[u.id]);assert.equal(a?.email?.toLowerCase(),u.email.toLowerCase());
  assert.ok(after.users.some(p=>p.id===a.id));
}
const billing=await readAll(db,'billing_snapshots','user_id');
assert.equal(canon(billing),canon(get('supabase-before','billing_snapshots')),'Billing snapshots changed');
for(const old of get('supabase-at-import','users')) {
  const actual=after.users.find(u=>u.id===old.id);assert.ok(actual,'Existing profile missing');
  for(const k of Object.keys(old).filter(k=>/^(subscription_|stripe_|iap_|founding_rate_)/.test(k)))assert.equal(canon(actual[k]),canon(old[k]),`Existing billing field changed: ${k}`);
}
const memberIds=source.User.map(u=>map[u.id]);
const fingerprintRows=sql(`select id,md5(encrypted_password) as password_hash_md5 from auth.users where id in (${before.auth_fingerprints.map(u=>`'${u.id}'`).join(',')})`);
for(const old of before.auth_fingerprints)assert.equal(fingerprintRows.find(u=>u.id===old.id)?.password_hash_md5,old.password_hash_md5,'Existing password changed');
const rls=sql(`begin;
set local role authenticated;
do $test$ declare uid uuid; begin
  foreach uid in array array[${memberIds.map(id=>`'${id}'`).join(',')}]::uuid[] loop
    perform set_config('request.jwt.claim.sub',uid::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    if not exists(select 1 from public.users where id=uid) then raise exception 'Own profile hidden'; end if;
    if public.is_admin() then continue; end if;
    if exists(select 1 from public.users where id<>uid) then raise exception 'Another profile visible'; end if;
    if exists(select 1 from public.chart where user_id<>uid::text) then raise exception 'Another chart visible'; end if;
    if exists(select 1 from public.user_module_progress where user_id<>uid::text) then raise exception 'Another lesson visible'; end if;
    if exists(select 1 from public.planner_journal_entry where user_id<>uid::text) then raise exception 'Another journal visible'; end if;
    if exists(select 1 from public.calendar_synthesis where user_id<>uid::text) then raise exception 'Another calendar visible'; end if;
  end loop;
end $test$;
rollback;
select ${memberIds.length} as member_policies_checked;`);
assert.equal(rls[0]?.member_policies_checked,memberIds.length);
// Explicitly verify private imports have usable RLS ownership, including XP
// written by Base44 service accounts (the old importer left those hidden).
for(const entity of ['Chart','DailyQuiz','PlannerJournalEntry','SynthesisRating','UserModuleProgress','UserProgress','XPEvent']) {
  const table=tables[entity];const byId=new Map(after[table].map(r=>[r.id,r]));
  for(const row of source[entity]) {
    const actual=byId.get(plan.aliases[row.id]||idToUuid(row.id));
    assert.equal(actual.user_id,map[row.user_id]);assert.equal(actual.created_by_id,map[row.user_id]);
    if(entity==='UserModuleProgress') {
      if(row.status==='completed')assert.equal(actual.status,'completed','Lesson completion lost');
      assert.ok((actual.xp_earned||0)>=(row.xp_earned||0),'Lesson XP regressed');
      if(row.mastery_completed_at)assert.ok(actual.mastery_completed_at,'Lesson mastery lost');
    }
  }
}
let fixtureId;
try {
  const email=`migration-qa-${Date.now()}@example.invalid`;
  const {data:created,error:createError}=await db.auth.admin.createUser({email,email_confirm:true,user_metadata:{full_name:'Disposable migration verification'}});
  assert.ifError(createError);fixtureId=created.user.id;
  const {error:chartError}=await db.from('chart').insert({user_id:fixtureId,created_by_id:fixtureId,raw_data:{migration_test:true},description:'Disposable migration verification'});
  assert.ifError(chartError);
  const {data:link,error:linkError}=await db.auth.admin.generateLink({type:'recovery',email,options:{redirectTo:'https://astrosetta.vercel.app/login'}});
  assert.ifError(linkError);
  const {data:recovered,error:recoveryError}=await db.auth.verifyOtp({type:'recovery',token_hash:link.properties.hashed_token});
  assert.ifError(recoveryError);assert.equal(recovered.user.id,fixtureId);
  const password=randomBytes(30).toString('base64url')+'aA1!';
  const {error:updateError}=await db.auth.updateUser({password});assert.ifError(updateError);
  await db.auth.signOut();
  const {data:signed,error:signError}=await db.auth.signInWithPassword({email,password});assert.ifError(signError);assert.equal(signed.user.id,fixtureId);
  const {data:profile,error:profileError}=await db.from('users').select('id,full_name');assert.ifError(profileError);assert.equal(profile.length,1);assert.equal(profile[0].id,fixtureId);
  const {data:charts,error:chartsError}=await db.from('chart').select('id,user_id,raw_data');assert.ifError(chartsError);assert.equal(charts.length,1);assert.equal(charts[0].raw_data.migration_test,true);
  await db.auth.signOut();
} finally {
  if(fixtureId) {
    // Reset service session before removing only our own synthetic test data.
    const cleanup=client();
    const {error:chartError}=await cleanup.from('chart').delete().eq('user_id',fixtureId);assert.ifError(chartError);
    const {error:deleteError}=await cleanup.auth.admin.deleteUser(fixtureId);assert.ifError(deleteError);
  }
}
const holds=sql(`select jsonb_build_object('welcome_held',(select tgenabled='D' from pg_trigger where tgrelid='public.chart'::regclass and tgname='chart_welcome_email'),'email_jobs',(select jsonb_agg(jsonb_build_object('name',jobname,'active',active)) from cron.job where jobname like '%email%'),'pending_email_requests',(select count(*) from net.http_request_queue where url ~ '/(send-|notify-admin)')) as state`)[0].state;
assert.equal(holds.welcome_held,true);assert.ok(holds.email_jobs.every(j=>!j.active));assert.equal(holds.pending_email_requests,0);
assert.equal((await authUsers(client())).length,auth.length,'Disposable auth account not removed');
const report={at:new Date().toISOString(),accountsMapped:memberIds.length,authUsers:auth.length,
  sourceRecordsChecked,fieldsChecked,memberPolicyChecks:memberIds.length,
  existingPasswordsPreserved:fingerprintRows.length,billingSnapshotsPreserved:billing.length,
  recoveryAndPasswordSignIn:'passed with disposable account; no email sent',fixtureCleanedUp:true,
  counts:Object.fromEntries(Object.entries(after).map(([t,r])=>[t,r.length])),emailHold:holds};
save(`${root}/verification-report.json`,report);console.log(JSON.stringify(report));
