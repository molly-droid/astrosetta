#!/usr/bin/env node
// Generate a reviewable SQL cleanup from a private, read-only audit snapshot.
// Run the resulting SQL explicitly after reviewing the printed counts.
import fs from 'node:fs';
import {mergeProgress,save} from './reconcile-base44.mjs';
const root=process.argv[2],dir=root+'/final-reference-audit';
const get=n=>JSON.parse(fs.readFileSync(`${dir}/${n}.json`));
const issues=get('reference-issues');const profiles=get('users');const liveIds=new Set(profiles.map(u=>u.id));
const oldPlan=JSON.parse(fs.readFileSync(root+'/applied-plan.json'));
const userIssues=issues.filter(i=>i.kind==='user_reference'&&i.field==='user_id'&&i.table!=='account_deletion_request');
const deadOwners=[...new Set(userIssues.map(i=>i.value))];
const allowedStaff=e=>/^tony\.tamer21(?:\+(?:tf1|sim1))?@gmail\.com$/i.test(e)||/^admin@silexdev\.com$/i.test(e);
for(const id of deadOwners){
  if(liveIds.has(id)||!/^[a-f\d-]{36}$/i.test(id))throw new Error('Unsafe orphan owner');
  const creators=[...new Set(userIssues.filter(i=>i.value===id).map(i=>i.created_by).filter(Boolean))];
  if(!creators.length||!creators.every(allowedStaff))throw new Error('Orphan account not proven to be staff QA');
}
const orphanRows=Object.fromEntries([...new Set(userIssues.map(i=>i.table))].map(t=>[t,
  get(t).filter(r=>deadOwners.includes(r.user_id))]));
const preferred=new Set(Object.values(oldPlan.aliases));
const groups=new Map();
for(const row of get('user_module_progress')){
  if(!liveIds.has(row.user_id))continue;
  const k=`${row.user_id}:${row.module_id}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);
}
const lessonUpdates=[],lessonDeletes=[],aliases={};
for(const rows of groups.values())if(rows.length>1){
  rows.sort((a,b)=>Number(preferred.has(b.id))-Number(preferred.has(a.id))||Date.parse(b.updated_date)-Date.parse(a.updated_date)||a.id.localeCompare(b.id));
  const canonical=rows[0];let merged=canonical;
  for(const r of rows.slice(1)){merged=mergeProgress(merged,r,'user_module_progress');aliases[r.id]=canonical.id;lessonDeletes.push(r);}
  lessonUpdates.push({before:canonical,after:merged});
}
const xp={duplicates:[],totals:[]};
const retainedByKey=new Map();const moduleIds=new Set(get('learning_module').map(r=>r.id));
for(const e of get('xp_event').filter(e=>liveIds.has(e.user_id)).sort((a,b)=>Date.parse(a.created_date)-Date.parse(b.created_date))){
  if(['card_completed','mastery_completed'].includes(e.event_type)&&moduleIds.has(e.reference_id)){
    const key=`${e.user_id}:${e.event_type}:${e.reference_id}`;
    if(retainedByKey.has(key)){aliases[e.id]=retainedByKey.get(key);xp.duplicates.push(e);}else retainedByKey.set(key,e.id);
  }
}
const duplicateXPIds=new Set(xp.duplicates.map(e=>e.id));
for(const user of profiles)xp.totals.push({id:user.id,stored:user.xp_total,
  total:get('xp_event').filter(e=>e.user_id===user.id&&!duplicateXPIds.has(e.id)).reduce((sum,e)=>sum+(e.xp_amount||0),0)});
const deletes={...orphanRows};
for(const [table,rows]of [['user_module_progress',lessonDeletes],['xp_event',xp.duplicates]])deletes[table]=[...(deletes[table]||[]),...rows];
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const checkedTables=[...new Set([...Object.keys(deletes),'users','user_module_progress'])];
const parts=['begin;',"set local lock_timeout='10s';",`lock table ${checkedTables.map(t=>'public.'+t).join(',')} in share row exclusive mode;`];
parts.push(`do $guard$ begin if exists(select 1 from auth.users where id in (${deadOwners.map(quote).join(',')})) then raise exception 'Orphan account now exists'; end if; end $guard$;`);
for(const table of checkedTables){
  const rows=[...(deletes[table]||[]),...(table==='user_module_progress'?lessonUpdates.map(u=>u.before):[]),...(table==='users'?profiles:[])];
  if(!rows.length)continue;
  const expected=rows.map(r=>({id:r.id,updated_date:r.updated_date}));
  const json=JSON.stringify(expected);if(json.includes('$revisions$'))throw new Error('Invalid SQL delimiter');
  parts.push(`do $guard$ begin if exists(select 1 from jsonb_to_recordset($revisions$${json}$revisions$::jsonb) as e(id uuid,updated_date timestamptz) left join public.${table} t on t.id=e.id where t.id is null or t.updated_date is distinct from e.updated_date) then raise exception 'Stale cleanup snapshot: ${table}'; end if; end $guard$;`);
}
// Only update progress fields; ownership, original creation and quiz answers from
// the latest record remain represented in the merged row.
const fields=['status','current_block_index','xp_earned','completed_at','quiz_answers','mastery_completed_at','mastery_xp_earned','description'];
if(lessonUpdates.length){const json=JSON.stringify(lessonUpdates.map(u=>u.after));if(json.includes('$lessons$'))throw new Error('Invalid SQL delimiter');
  parts.push(`update public.user_module_progress t set ${fields.map(k=>`${k}=p.${k}`).join(',')} from jsonb_populate_recordset(null::public.user_module_progress,$lessons$${json}$lessons$::jsonb) p where t.id=p.id;`);}
for(const [table,rows]of Object.entries(deletes))if(rows.length)parts.push(`delete from public.${table} where id in (${rows.map(r=>quote(r.id)).join(',')});`);
// Same deduplication and level thresholds as recompute-xp-totals. Module awards
// were deduped above; repeatable quiz/placement awards are intentionally retained.
parts.push(`with totals as(select u.id,coalesce(sum(e.xp_amount),0)::integer as xp from public.users u left join public.xp_event e on e.user_id=u.id::text group by u.id), projected as(select id,xp,case when xp>=1500 then 'sage' when xp>=500 then 'practitioner' when xp>=200 then 'adept' else 'apprentice' end as level from totals) update public.users u set xp_total=p.xp,level=p.level from projected p where u.id=p.id and (u.xp_total is distinct from p.xp or u.level is distinct from p.level);`);
parts.push('commit;',`select jsonb_build_object('accounts',(select count(*) from public.users),'remaining_orphan_charts',(select count(*) from public.chart c where not exists(select 1 from public.users u where u.id::text=c.user_id)),'duplicate_lessons',(select count(*) from(select user_id,module_id from public.user_module_progress group by user_id,module_id having count(*)>1)s)) as result;`);
const backup={at:new Date().toISOString(),deadOwners,orphanRows,lessonUpdates,lessonDeletes,xpDuplicates:xp.duplicates,profilesBefore:profiles,aliases};
save(dir+'/cleanup-backup.json',backup);
fs.writeFileSync(dir+'/cleanup.sql',parts.join('\n'),{mode:0o600});
console.log({deadStaffAccounts:deadOwners.length,orphanRows:Object.values(orphanRows).reduce((s,a)=>s+a.length,0),duplicateLessonRows:lessonDeletes.length,lessonGroups:lessonUpdates.length,duplicateXPEvents:xp.duplicates.length,xpProfilesToRecompute:xp.totals.filter(r=>r.stored!==r.total).length});
