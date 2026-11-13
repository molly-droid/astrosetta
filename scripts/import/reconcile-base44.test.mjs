import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeProfile,mergeProgress,idToUuid,buildPlan,tables} from './reconcile-base44.mjs';
test('reuses deterministic record IDs',()=>assert.equal(idToUuid('abc'),idToUuid('abc')));
test('preserves newer native settings and all live billing authority',()=>{
  const old={id:'same',role:'learner',updated_date:'2026-11-12T01:00:00Z',created_date:'2026-10-01T00:00:00Z',subscription_tier:'calendar',subscription_source:'apple',subscription_admin_override:false,founding_rate_forfeited_at:'2026-11-01',font_scale:1.3,daily_email_opt_in:false,xp_total:100};
  const row={id:'same',role:'user',updated_date:'2026-10-01T00:00:00Z',created_date:'2026-05-01T00:00:00Z',subscription_tier:'free',font_scale:1,daily_email_opt_in:true,xp_total:200};
  const m=mergeProfile(old,row);assert.equal(m.id,'same');assert.equal(m.subscription_tier,'calendar');assert.equal(m.subscription_source,'apple');assert.equal(m.founding_rate_forfeited_at,old.founding_rate_forfeited_at);assert.equal(m.daily_email_opt_in,false);assert.equal(m.font_scale,1.3);assert.equal(m.xp_total,200);assert.equal(m.created_date,row.created_date);
});
test('new members start free without old testing billing credentials',()=>{
  const m=mergeProfile(null,{role:'user',subscription_tier:'calendar',stripe_customer_id:'test'});assert.equal(m.subscription_tier,'free');assert.equal(m.stripe_customer_id,null);assert.equal(m.role,'learner');
});
test('completion and mastery survive a newer in-progress duplicate',()=>{
  const m=mergeProgress({id:'native',updated_date:'2026-11-12T00:00:00Z',status:'in_progress',current_block_index:2,xp_earned:0},{id:'import',updated_date:'2026-10-01T00:00:00Z',status:'completed',current_block_index:5,xp_earned:100,completed_at:'2026-10-01',mastery_completed_at:'2026-10-02',mastery_xp_earned:50},'user_module_progress');
  assert.equal(m.id,'native');assert.equal(m.status,'completed');assert.equal(m.current_block_index,5);assert.equal(m.xp_earned,100);assert.equal(m.mastery_completed_at,'2026-10-02');
});
test('learner tier cannot regress on overlapping progress',()=>{
  const m=mergeProgress({id:'native',current_tier:'adept',modules_completed:3,updated_date:'2026-11-12T00:00:00Z'},{id:'import',current_tier:'apprentice',modules_completed:10,updated_date:'2026-10-01T00:00:00Z'},'user_progress');assert.equal(m.current_tier,'adept');assert.equal(m.modules_completed,10);
});
test('a newer native row retains progress and gains correct RLS ownership',()=>{
  const source=Object.fromEntries(['User',...Object.keys(tables)].map(e=>[e,[]]));
  const target=Object.fromEntries(['users',...Object.values(tables)].map(t=>[t,[]]));
  source.Chart=[{id:'source-chart',user_id:'base44-user',created_by_id:'service_abc',updated_date:'2026-10-01T00:00:00'}];
  target.chart=[{id:idToUuid('source-chart'),user_id:'native-user',created_by_id:null,updated_date:'2026-11-12T00:00:00+00:00'}];
  const cols=['id','user_id','created_by_id','updated_date'].map(name=>({table:'chart',name,type:name==='updated_date'?'timestamp with time zone':'text'}));
  const plan=buildPlan(source,target,{'base44-user':'native-user'},cols);
  assert.equal(plan.byTable.chart[0].created_by_id,'native-user');
  assert.equal(plan.byTable.chart[0].updated_date,target.chart[0].updated_date);
});
