#!/usr/bin/env node
// Production migration tools. All private artifacts belong outside the checkout.
// No Base44 requests and no email-sending methods are used here.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
export const project = 'sqdpawyqvgqadflezxxk';
export const tables = {
  AccountDeletionRequest:'account_deletion_request', CalendarSynthesis:'calendar_synthesis',
  Chart:'chart', DailyQuiz:'daily_quiz', ErrorLog:'error_log', EventOrder:'event_order',
  FeatureHighlight:'feature_highlight', Feedback:'feedback', FoundingPatron:'founding_patron',
  GlossaryItem:'glossary_item', IncentiveSKU:'incentive_sku', Interpretation:'interpretation',
  LLMUsageLog:'llm_usage_log', LearningModule:'learning_module', Placement:'placement',
  PlanetCorrection:'planet_correction', PlannerJournalEntry:'planner_journal_entry',
  PopupEvent:'popup_event', RoadmapItem:'roadmap_item', SavedChart:'saved_chart',
  StreakBonusContent:'streak_bonus_content', SynthesisRating:'synthesis_rating',
  UserInterpretationRating:'user_interpretation_rating', UserModuleProgress:'user_module_progress',
  UserPlacementProgress:'user_placement_progress', UserProgress:'user_progress',
  WaitlistEmail:'waitlist_email', XPEvent:'xp_event',
};
export function idToUuid(id) {
  const b=Buffer.from(createHash('sha1').update('astrosetta-base44-import-v1').update(String(id)).digest().subarray(0,16));
  b[6]=(b[6]&15)|80; b[8]=(b[8]&63)|128;
  const h=b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export function client() {
  const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref',project,'--reveal','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000}));
  const key=keys.find(k=>k.name==='service_role')?.api_key;
  if(!key) throw new Error('Missing service key');
  return createClient(`https://${project}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function save(file,data) { fs.writeFileSync(file,JSON.stringify(data,null,2),{mode:0o600}); }
export async function readAll(db,table,order='id') {
  const out=[];
  for(let start=0;;start+=500) {
    const {data,error}=await db.from(table).select('*').order(order).range(start,start+499);
    if(error) throw new Error(`${table}: ${error.message}`);
    out.push(...data); if(data.length<500) return out;
  }
}
export async function authUsers(db) {
  const out=[];
  for(let page=1;;page++) {
    const {data,error}=await db.auth.admin.listUsers({page,perPage:200});
    if(error) throw error; out.push(...data.users); if(data.users.length<200) return out;
  }
}
export function sql(query) {
  const output=execFileSync('supabase',['db','query','--linked','--project-ref',project,query],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:90000,maxBuffer:32*1024*1024});
  const result=JSON.parse(output);
  if(result.error || !Array.isArray(result.rows)) throw new Error(`SQL failed: ${JSON.stringify(result)}`);
  return result.rows;
}
const stamp=r=>{
  let s=r.updated_date||r.created_date||'1970-01-01T00:00:00Z';
  if(s.includes('T')&&!/(Z|[+-]\d\d:\d\d)$/.test(s))s+='Z';
  return Date.parse(s)||0;
};
const tierRank={apprentice:1,adept:2,maestro:3};
export function mergeProgress(old,row,table) {
  const newer=stamp(row)>stamp(old)?row:old;
  const merged={...old,...row,...newer,id:old.id};
  for(const key of ['xp_earned','mastery_xp_earned','modules_completed','total_answered','streak_best',
    'apprentice_quiz_days_count','adept_quiz_days_count','apprentice_correct_total',
    'apprentice_questions_total','adept_correct_total','adept_questions_total']) {
    if(old[key]!=null||row[key]!=null) merged[key]=Math.max(old[key]||0,row[key]||0);
  }
  if(table==='user_module_progress') {
    if(old.status==='completed'||row.status==='completed') {
      merged.status='completed'; merged.completed_at=old.completed_at||row.completed_at;
    }
    merged.mastery_completed_at=old.mastery_completed_at||row.mastery_completed_at||null;
    merged.current_block_index=Math.max(old.current_block_index||0,row.current_block_index||0);
  } else if(table==='user_progress') {
    merged.current_tier=(tierRank[old.current_tier]||0)>(tierRank[row.current_tier]||0)?old.current_tier:row.current_tier;
  }
  return merged;
}
export function mergeProfile(old,row) {
  if(!old) return {...row,role:row.role==='admin'?'admin':'learner',subscription_tier:'free',
    subscription_expires:null,subscription_source:null,stripe_customer_id:null,
    stripe_subscription_id:null,iap_transaction_id:null};
  const merged={...old,...row,...(stamp(old)>=stamp(row)?old:{})};
  // Live billing, password/provider identities and forfeiture are never imported over.
  for(const key of Object.keys(old).filter(k=>/^(subscription_|stripe_|iap_|founding_rate_)/.test(k))) merged[key]=old[key];
  merged.role=old.role==='admin'||row.role==='admin'?'admin':'learner';
  merged.created_date=stamp({created_date:old.created_date})<stamp({created_date:row.created_date})?old.created_date:row.created_date;
  merged.is_founding_member=!!(old.is_founding_member||row.is_founding_member);
  merged.xp_total=Math.max(old.xp_total||0,row.xp_total||0);
  // Respect either system's opt-out while merging member preferences.
  for(const key of ['daily_email_opt_in','weekly_email_opt_in','monthly_email_opt_in']) {
    if(old[key]===false||row[key]===false) merged[key]=false;
  }
  return merged;
}
const personal=new Set(['chart','daily_quiz','planner_journal_entry','synthesis_rating',
  'user_interpretation_rating','user_module_progress','user_placement_progress','user_progress','xp_event']);
function naturalKey(table,r) {
  const fields={user_progress:['user_id'],user_module_progress:['user_id','module_id'],
    user_placement_progress:['user_id','placement_key'],daily_quiz:['user_id','date_key'],
    calendar_synthesis:['user_id','period_type','period_key','target_chart_id','topic_key'],
    streak_bonus_content:['date_key']}[table];
  return fields?JSON.stringify(fields.map(k=>r[k]??null)):null;
}
export function buildPlan(source,target,userMap,columns,newUsers=new Set()) {
  const byTable=Object.fromEntries(['users',...Object.values(tables)].map(t=>[t,[]]));
  const expected={}; const aliases={}; const allSourceIds=new Set(Object.values(source).flatMap(a=>a.map(r=>r.id)));
  const allowed=new Map(); for(const c of columns){if(!allowed.has(c.table))allowed.set(c.table,new Set());allowed.get(c.table).add(c.name);}
  const timeColumns=new Set(columns.filter(c=>c.type.startsWith('timestamp')).map(c=>`${c.table}.${c.name}`));
  const canon=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
  const put=(table,row,old)=>{
    if(old&&Object.entries(row).every(([k,v])=>timeColumns.has(`${table}.${k}`)&&v&&old[k]
      ?stamp({created_date:old[k]})===stamp({created_date:v}):canon(old[k])===canon(v)))return;
    byTable[table].push(row); expected[table]??={}; expected[table][row.id]=old?.updated_date??null;
  };
  for(const u of source.User) {
    const row=Object.fromEntries(Object.entries({...u,id:userMap[u.id],email:u.email.trim().toLowerCase()}).filter(([k])=>allowed.get('users').has(k)));
    const old=target.users.find(t=>t.id===row.id); put('users',mergeProfile(newUsers.has(row.id)?null:old,row),old);
  }
  // Alias legacy email ownership only when the record itself explicitly stores the email.
  const emailMap=new Map(source.User.map(u=>[u.email.trim().toLowerCase(),userMap[u.id]]));
  const repairs={};
  for(const table of Object.values(tables)) {
    repairs[table]=[];
    for(const old of target[table]) {
      const row={...old};
      if(emailMap.has(String(row.user_id).trim().toLowerCase())) row.user_id=emailMap.get(row.user_id.trim().toLowerCase());
      if(!row.created_by_id&&emailMap.has(String(row.created_by).trim().toLowerCase())&&(!row.user_id||row.user_id===emailMap.get(row.created_by.trim().toLowerCase()))) row.created_by_id=emailMap.get(row.created_by.trim().toLowerCase());
      if(canon(row)!==canon(old))repairs[table].push(row);
    }
  }
  for(const [entity,table] of Object.entries(tables)) {
    const working=new Map(target[table].map(r=>[r.id,r]));
    for(const r of repairs[table])working.set(r.id,r);
    for(const rec of source[entity]) {
      const row={};
      for(const [key,value]of Object.entries(rec)) {
        if(!allowed.get(table).has(key))continue;
        let v=value;
        if(key==='id')v=idToUuid(v);
        else if(['user_id','created_by_id','contributor_id'].includes(key)&&v) {
          v=userMap[v]||emailMap.get(String(v).trim().toLowerCase())||null;
          if(key==='user_id'&&!v&&table!=='error_log')throw new Error(`Unresolved member owner: ${entity}`);
        } else if(['chart_id','target_chart_id','interpretation_id','module_id'].includes(key)&&v)v=aliases[v]||idToUuid(v);
        else if(key==='reference_id'&&allSourceIds.has(v))v=idToUuid(v);
        row[key]=v;
      }
      if(personal.has(table)&&row.user_id)row.created_by_id=row.user_id;
      const key=naturalKey(table,row);
      let old=working.get(row.id);
      if(!old&&key)old=[...working.values()].filter(r=>naturalKey(table,r)===key).sort((a,b)=>stamp(b)-stamp(a))[0];
      if(old) {
        aliases[rec.id]=old.id;
        let merged;
        if(table==='user_module_progress'||table==='user_progress') merged=mergeProgress(old,row,table);
        else merged=stamp(row)>stamp(old)?{...old,...row,id:old.id}:{...row,...old};
        if(personal.has(table)&&row.user_id)merged.created_by_id=row.user_id;
        working.set(old.id,merged);
      } else working.set(row.id,row);
    }
    const original=new Map(target[table].map(r=>[r.id,r]));
    for(const row of working.values())put(table,row,original.get(row.id));
  }
  return {byTable,expected,aliases,summary:Object.entries(byTable).map(([table,rows])=>({table,
    inserts:rows.filter(r=>expected[table][r.id]===null).length,
    updates:rows.filter(r=>expected[table][r.id]!==null).length}))};
}
async function snapshot(dir) {
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  if(fs.existsSync(path.join(dir,'auth-users.json'))) throw new Error('Refusing to overwrite backup');
  const db=client();
  const users=await authUsers(db); save(path.join(dir,'auth-users.json'),users);
  const counts={auth_users:users.length};
  for(const table of ['users',...Object.values(tables),'billing_snapshots','launch_configuration']) {
    const data=await readAll(db,table,table==='billing_snapshots'?'user_id':'id'); save(path.join(dir,`${table}.json`),data); counts[table]=data.length;
  }
  save(path.join(dir,'manifest.json'),{project,at:new Date().toISOString(),counts});
  console.log(JSON.stringify(counts));
}
async function apply(root) {
  if(root.startsWith(process.cwd()+path.sep))throw new Error('Private migration data must be outside checkout');
  const read=(dir,name)=>JSON.parse(fs.readFileSync(path.join(root,dir,`${name}.json`)));
  const before=read('supabase-before','database-state');
  const db=client();
  const source=Object.fromEntries(['User',...Object.keys(tables)].map(e=>[e,read('converted',e)]));
  const fresh=path.join(root,'supabase-at-import');
  await snapshotWithClient(db,fresh);
  const target=Object.fromEntries(['users',...Object.values(tables)].map(t=>[t,JSON.parse(fs.readFileSync(path.join(fresh,`${t}.json`)))]));
  const auth=await authUsers(db), userMap={},createdIds=new Set();
  const audit={at:new Date().toISOString(),created:0,reused:0,tables:[]};
  for(const u of source.User) {
    const email=u.email.trim().toLowerCase();
    let existing=auth.find(a=>a.email?.toLowerCase()===email);
    if(!existing) {
      const {data,error}=await db.auth.admin.createUser({email,email_confirm:true,
        user_metadata:{full_name:u.full_name||u.display_name||null}});
      if(error)throw new Error(`Auth creation failed; details withheld: ${error.code||error.status}`);
      existing=data.user;auth.push(existing);createdIds.add(existing.id);audit.created++;
      const {data:profile,error:profileError}=await db.from('users').select('*').eq('id',existing.id).single();
      if(profileError)throw new Error('New auth profile not provisioned');target.users.push(profile);
    } else audit.reused++;
    userMap[u.id]=existing.id;
    save(path.join(root,'live-user-id-map.json'),userMap);
    save(path.join(root,'new-auth-user-ids.json'),[...createdIds]);
  }
  const plan=buildPlan(source,target,userMap,before.columns,createdIds);
  save(path.join(root,'applied-plan.json'),plan);
  save(path.join(root,'converted','user-id-map.json'),userMap);
  console.log(JSON.stringify({authCreated:audit.created,authReused:audit.reused,plan:plan.summary}));
  for(const [table,rows]of Object.entries(plan.byTable)) {
    let applied=0;
    for(let start=0;start<rows.length;start+=100) {
      const batch=rows.slice(start,start+100);
      const expected=Object.fromEntries(batch.map(r=>[r.id,plan.expected[table][r.id]]));
      const {data,error}=await db.rpc('apply_base44_import_batch',{p_table:table,p_rows:batch,p_expected:expected});
      if(error){save(path.join(root,'import-error.json'),{table,start,error});throw new Error(`Import stopped at ${table}, batch ${start}; private error report saved`);}
      if(data!==batch.length)throw new Error('Unexpected import batch count');
      applied+=data;
    }
    audit.tables.push({table,applied});save(path.join(root,'import-report.json'),audit);
    console.log(`${table}: ${applied} reconciled rows`);
  }
}
async function snapshotWithClient(db,dir) {
  if(fs.existsSync(dir))throw new Error('Refusing to overwrite pre-apply backup');
  fs.mkdirSync(dir,{mode:0o700});
  save(path.join(dir,'auth-users.json'),await authUsers(db));
  for(const table of ['users',...Object.values(tables)])save(path.join(dir,`${table}.json`),await readAll(db,table));
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  const [mode,dir]=process.argv.slice(2);
  if(!['snapshot','apply'].includes(mode)||!dir)throw new Error('Usage: reconcile-base44.mjs snapshot|apply PRIVATE_DIR');
  if(mode==='snapshot')await snapshot(path.resolve(dir));else await apply(path.resolve(dir));
}
