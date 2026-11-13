#!/usr/bin/env node
// Read-only reference and file inventory. Private artifacts stay outside Git.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {client,readAll,authUsers,tables,save,idToUuid} from './reconcile-base44.mjs';
const root=process.argv[2];
if(!root)throw new Error('Usage: audit-base44-references.mjs PRIVATE_EXPORT_ROOT');
const auditName=process.argv[3]||'final-reference-audit';
if(!/^[a-z0-9-]+$/.test(auditName))throw new Error('Invalid audit folder name');
const out=path.join(root,auditName);fs.mkdirSync(out,{recursive:true,mode:0o700});
const db=client(),auth=await authUsers(db),uids=new Set(auth.map(a=>a.id));
const data={};for(const table of ['users',...Object.values(tables),'agent_conversation']){
  data[table]=await readAll(db,table);save(path.join(out,table+'.json'),data[table]);
}
const issues=[];
const add=(kind,table,row,field,value)=>issues.push({kind,table,id:row.id,field,value,
  created_by:row.created_by,created_by_id:row.created_by_id,user_id:row.user_id,
  created_date:row.created_date,updated_date:row.updated_date});
const byId=Object.fromEntries(Object.entries(data).map(([t,rows])=>[t,new Map(rows.map(r=>[r.id,r]))]));
const imported=JSON.parse(fs.readFileSync(path.join(root,'live-user-id-map.json')));
const importedIds=new Set(Object.values(imported));
for(const [table,rows]of Object.entries(data))for(const row of rows){
  if(table==='users'&&!uids.has(row.id))add('profile_without_auth',table,row,'id',row.id);
  for(const field of ['created_by_id','user_id','contributor_id']){
    const value=row[field];if(value&&!uids.has(value)){
      if(table==='account_deletion_request'&&field==='user_id'&&row.status==='completed')continue;
      add('user_reference',table,row,field,value);
    }
  }
}
for(const u of auth)if(!byId.users.has(u.id))issues.push({kind:'auth_without_profile',table:'auth.users',id:u.id});
const checks=[
  ['calendar_synthesis','target_chart_id',['saved_chart','chart']],
  ['synthesis_rating','chart_id',['chart','saved_chart']],
  ['user_module_progress','module_id',['learning_module']],
  ['user_interpretation_rating','interpretation_id',['interpretation']],
];
for(const [table,field,parents]of checks)for(const row of data[table]){
  if(row[field]&&!parents.some(p=>byId[p].has(row[field])))add('row_reference',table,row,field,row[field]);
  else if(row[field]&&row.user_id){
    const parent=parents.map(p=>byId[p].get(row[field])).find(Boolean);
    const owner=parent.user_id||parent.created_by_id;
    if(table!=='user_module_progress'&&table!=='user_interpretation_rating'&&owner&&owner!==row.user_id)add('chart_owner_mismatch',table,row,field,row[field]);
  }
}
const eventIds=new Set(data.popup_event.map(r=>r.event_id));
const skuKeys=new Set(data.incentive_sku.map(r=>`${r.event_id}:${r.sku_id}`));
for(const table of ['incentive_sku','event_order'])for(const row of data[table]){
  if(row.event_id&&!eventIds.has(row.event_id))add('event_reference',table,row,'event_id',row.event_id);
  if(table==='event_order'&&row.sku_id&&!skuKeys.has(`${row.event_id}:${row.sku_id}`))add('sku_reference',table,row,'sku_id',row.sku_id);
}
for(const row of data.xp_event){
  if(row.reference_id&&/^[a-f\d-]{24,36}$/i.test(row.reference_id)){
    const refs=row.event_type==='first_chart'?['chart','saved_chart']:
      ['card_completed','mastery_completed'].includes(row.event_type)?['learning_module','placement']:
      row.event_type?.startsWith('interpretation')?['interpretation']:[];
    if(refs.length&&!refs.some(t=>byId[t].has(row.reference_id)))add('xp_reference', 'xp_event',row,'reference_id',row.reference_id);
  }
}
const URLs=new Map();
function scan(value,where){
  if(typeof value==='string'){
    const normalized=value.replaceAll('\\/','/');
    for(const m of normalized.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)){
      const url=m[0].replace(/[.,;]+$/,'');
      try{new URL(url);}catch{continue;}
      if(!URLs.has(url))URLs.set(url,[]);URLs.get(url).push(where);
    }
  }else if(Array.isArray(value))value.forEach((v,i)=>scan(v,`${where}[${i}]`));
  else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))scan(v,`${where}.${k}`);
}
for(const [table,rows]of Object.entries(data))rows.forEach(r=>scan(r,`${table}:${r.id}`));
// Scan the complete raw converted export too, so a skipped row cannot conceal media.
for(const entity of ['User',...Object.keys(tables)])scan(JSON.parse(fs.readFileSync(path.join(root,'converted',entity+'.json'))),'source:'+entity);
const links=[...URLs].map(([url,locations])=>({url,locations:[...new Set(locations)]}));
const base44Links=links.filter(l=>/base44\.(com|app)$/.test(new URL(l.url).hostname));
const mediaLinks=links.filter(l=>/media\.base44|\/storage\/|\/files\/|\.(png|jpe?g|gif|webp|svg|pdf|mp[34]|woff2?)([?#]|$)/i.test(l.url));
save(path.join(out,'url-inventory.json'),links);
save(path.join(out,'base44-links.json'),base44Links);
save(path.join(out,'media-links.json'),mediaLinks);
save(path.join(out,'reference-issues.json'),issues);
const mediaDir=path.resolve('apps/web/public/media');
const files=fs.readdirSync(mediaDir).filter(f=>fs.statSync(path.join(mediaDir,f)).isFile());
const assetResults=[];
for(let start=0;start<files.length;start+=6){
  const result=await Promise.all(files.slice(start,start+6).map(async name=>{
    const local=fs.readFileSync(path.join(mediaDir,name));
    const response=await fetch('https://astrosetta.vercel.app/media/'+encodeURIComponent(name));
    const remote=Buffer.from(await response.arrayBuffer());
    return {name,status:response.status,contentType:response.headers.get('content-type'),bytes:local.length,
      sha256:createHash('sha256').update(local).digest('hex'),identical:local.equals(remote)};
  }));assetResults.push(...result);
}
save(path.join(out,'static-assets.json'),assetResults);
const metadata=JSON.parse(fs.readFileSync(path.join(root,'reference-audit-metadata.json')))[0].inventory;
const storage=[];fs.mkdirSync(path.join(out,'storage-backup'),{mode:0o700,recursive:true});
for(const object of metadata.objects||[]){
  // A bucket literally named "public" collides with the SDK's legacy download
  // route. Read this public bucket using its explicit public-object URL.
  const {data:{publicUrl}}=db.storage.from(object.bucket).getPublicUrl(object.name);
  const response=await fetch(publicUrl);
  const result={...object,downloaded:response.ok,bytes:null,sha256:null};
  if(response.ok){const bytes=Buffer.from(await response.arrayBuffer());const hash=createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(out,'storage-backup',hash),bytes,{mode:0o600});result.bytes=bytes.length;result.sha256=hash;}
  else result.error=`HTTP ${response.status}`;
  result.referencedByRows=links.some(l=>l.url.includes('/storage/v1/object/')&&decodeURIComponent(l.url).includes('/'+object.bucket+'/'+object.name));
  storage.push(result);
}
save(path.join(out,'storage-objects.json'),storage);
const grouped={};for(const i of issues){const key=`${i.kind}:${i.table}.${i.field||''}`;grouped[key]=(grouped[key]||0)+1;}
const summary={at:new Date().toISOString(),accounts:auth.length,records:Object.values(data).reduce((s,a)=>s+a.length,0),
  counts:Object.fromEntries(Object.entries(data).map(([t,r])=>[t,r.length])),issues:grouped,
  issueRowsForImportedUsers:issues.filter(i=>importedIds.has(i.user_id)||importedIds.has(i.created_by_id)).length,
  base44URLs:base44Links.length,base44MediaURLs:base44Links.filter(l=>mediaLinks.includes(l)).length,
  mediaURLHosts:[...new Set(mediaLinks.map(l=>new URL(l.url).hostname))],
  staticAssets:{count:files.length,verified:assetResults.filter(r=>r.status===200&&r.identical).length,bytes:assetResults.reduce((s,r)=>s+r.bytes,0),failures:assetResults.filter(r=>r.status!==200||!r.identical)},
  storageObjects:storage.length,storageDownloadFailures:storage.filter(r=>!r.downloaded).length};
save(path.join(out,'summary.json'),summary);console.log(JSON.stringify(summary));
