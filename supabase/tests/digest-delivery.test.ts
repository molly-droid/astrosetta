import { strict as assert } from 'node:assert';
import { digestSlot } from '../functions/_shared/digestSchedule.ts';
import { sendDigestOnce, runScheduledDigest } from '../functions/_shared/digestDelivery.ts';

Deno.test('Chicago schedule follows DST, correct weekday/month, and current period only', () => {
  assert.deepEqual(digestSlot('daily', new Date('2026-11-13T13:00:00Z')), {period:'2026-11-13',due:true});
  assert.equal(digestSlot('daily', new Date('2026-11-13T12:00:00Z')).due, false);
  assert.equal(digestSlot('daily', new Date('2026-07-01T12:00:00Z')).due, true);
  assert.equal(digestSlot('daily', new Date('2026-11-13T15:00:00Z')).due, false);
  assert.equal(digestSlot('weekly', new Date('2026-11-13T13:00:00Z')).due, false);
  assert.deepEqual(digestSlot('weekly', new Date('2026-11-16T13:00:00Z')), {period:'2026-11-16',due:true});
  assert.deepEqual(digestSlot('weekly', new Date('2027-01-01T13:00:00Z')), {period:'2026-12-28',due:false});
  assert.deepEqual(digestSlot('monthly', new Date('2026-12-01T13:00:00Z')), {period:'2026-12',due:true});
  assert.equal(digestSlot('monthly', new Date('2026-12-02T13:00:00Z')).due, false);
  assert.equal(digestSlot('feedback', new Date('2026-11-16T14:00:00Z')).due, true);
});

function fakeDb() {
  const rows = new Map();
  return { rows, from: () => ({
    insert: async row => { const key = `${row.kind}/${row.period_key}/${row.recipient}`;
      if (rows.has(key)) return {error:{code:'23505'}};
      rows.set(key, row); return {error:null}; },
    update: patch => ({match: async key => { Object.assign(rows.get(`${key.kind}/${key.period_key}/${key.recipient}`), patch); return {error:null}; }}),
  }) };
}
Deno.test('concurrent invocations deliver once; uncertain provider failure cannot resend', async () => {
  const db = fakeDb(); let builds = 0, sends = 0;
  const build = async () => { builds++; return {subject:'subject',html:'body'}; };
  const send = async () => { sends++; return {id:'provider-id'}; };
  const target = {email:'Member@Example.COM'};
  const results = await Promise.all(Array.from({length:20}, () => sendDigestOnce('daily',target,build,db,send)));
  assert.equal(results.filter(x => x === 'sent').length,1); assert.equal(builds,1); assert.equal(sends,1);
  assert.equal([...db.rows.values()][0].recipient, 'member@example.com');
  const broken = fakeDb(); let attempts=0;
  await assert.rejects(sendDigestOnce('daily',target,build,broken,async()=>{attempts++;throw Error('timeout after acceptance');}));
  assert.equal(await sendDigestOnce('daily',target,build,broken,send),'duplicate');
  assert.equal(attempts,1); assert.equal([...broken.rows.values()][0].status,'failed');
});
Deno.test('database claim failure prevents all generation and sending', async () => {
  const db={from:()=>({insert:async()=>({error:{code:'connection_failure',message:'offline'}})})};
  await assert.rejects(sendDigestOnce('daily',{email:'x@example.com'},()=>{throw Error('must not build');},db,()=>{throw Error('must not send');}),/claim failed/);
});
Deno.test('dry run sends nothing; opt-outs, missing preferences and existing deliveries are excluded', async () => {
  const users = [
    {id:'a',email:'a@example.com',daily_email_opt_in:true},
    {id:'b',email:'b@example.com',daily_email_opt_in:false},
    {id:'c',email:'c@example.com'},
    {id:'d',email:'d@example.com',daily_email_opt_in:true},
    {id:'e',email:'e@example.com',daily_email_opt_in:true},
  ];
  const base44={asServiceRole:{entities:{Chart:{list:async()=>users.map(u=>({user_id:u.id}))},User:{filter:async({id})=>users.filter(u=>u.id===id)}}}};
  const db={from:()=>({select:()=>({eq:()=>({eq:async()=>({data:[{recipient:'a@example.com'}],error:null})})})})};
  let deliveries=0;
  const args={kind:'daily',base44,db,body:{dry_run:true},now:new Date('2026-11-13T13:00:00Z'),build:()=>{throw Error('dry run must not generate');},deliver:async()=>{deliveries++;return 'sent';}};
  assert.deepEqual(await runScheduledDigest(args),{success:true,dry_run:true,due:true,period:'2026-11-13',eligible:2,optedOut:2,duplicates:1,batch_size:1});
  assert.equal(deliveries,0);
  const actual=await runScheduledDigest({...args,body:{}});
  assert.equal(deliveries,1); assert.equal(actual.remaining,1);
  await runScheduledDigest({...args,body:{},now:new Date('2026-11-13T22:00:00Z')});
  assert.equal(deliveries,1);
});

Deno.test('weekly digests require current paid access or an active trial; Free and expired accounts are excluded', async () => {
  const users = [
    {id:'trial',email:'trial@example.com',weekly_email_opt_in:true,subscription_tier:'calendar',subscription_expires:'2027-01-01T06:00:00Z',subscription_is_trial:true},
    {id:'free',email:'free@example.com',weekly_email_opt_in:true,subscription_tier:'free'},
    {id:'expired',email:'expired@example.com',weekly_email_opt_in:true,subscription_tier:'calendar',subscription_expires:'2000-01-01'},
  ];
  const base44={asServiceRole:{entities:{Chart:{list:async()=>users.map(u=>({user_id:u.id}))},User:{filter:async({id})=>users.filter(u=>u.id===id)}}}};
  const db={from:()=>({select:()=>({eq:()=>({eq:async()=>({data:[],error:null})})})})};
  const result=await runScheduledDigest({kind:'weekly',base44,db,body:{dry_run:true},now:new Date('2026-11-16T13:00:00Z'),build:()=>{throw Error('must not generate');}});
  assert.equal(result.eligible,1);assert.equal(result.optedOut,2);
});
