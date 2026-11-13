const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadEdge } = require('./load-edge.cjs');
const beta = loadEdge('supabase/functions/_shared/betaTrial.ts');
const billing = loadEdge('supabase/functions/_shared/billing.ts');
const NOW = Date.parse('2026-11-13T12:00:00Z');
const END = beta.BETA_TRIAL_END;
const USER = '00000000-0000-4000-8000-000000000010';
const account = { id: USER, email:'beta@example.invalid', is_founding_member:true, subscription_tier:'free' };
function dbFor(user, member) {
  return { rpc: async () => ({error:null}), from(table) {
    let filters=[];
    const query={select:()=>query,eq:(key,value)=>{filters.push([key,value]);return query;},
      single:async()=>({data:user,error:null}), maybeSingle:async()=>({data:table==='beta_trial_members'?member:user,error:null})};
    return query;
  }};
}
test('beta offer requires explicit cohort membership, remaining time and no paid plan or prior redemption', async()=>{
  const member={trial_ends_at:END,redeemed_at:null};
  assert.equal((await beta.betaTrialOffer(dbFor(account,member),account,NOW)).eligible,true);
  for(const [user,row,now] of [[account,null,NOW],[account,{...member,redeemed_at:'2026-11-13'},NOW],
    [{...account,subscription_tier:'calendar'},member,NOW],[{...account,is_founding_member:false},member,NOW],
    [{...account,founding_rate_forfeited_at:'2026-10-01'},member,NOW], [account,member,Date.parse(END)-48*3600000]]) {
    assert.equal((await beta.betaTrialOffer(dbFor(user,row),user,now)).eligible,false);
  }
});
test('card is mandatory; monthly/yearly trials end at the same fixed date and show exact renewal price',()=>{
  for(const [period,price] of [['monthly','$7.77/month'],['yearly','$77/year']]) {
    const params=beta.betaTrialCheckoutOptions(END,period,NOW);
    assert.equal(params.payment_method_collection,'always');
    assert.equal(params.adaptive_pricing.enabled,false);
    assert.deepEqual(JSON.parse(JSON.stringify(params.payment_method_types)),['card']);
    assert.equal(params.subscription_data.trial_end,Date.parse(END)/1000);
    assert.equal(params.subscription_data.trial_settings.end_behavior.missing_payment_method,'cancel');
    assert.ok(params.custom_text.submit.message.includes(price));
    assert.match(params.custom_text.submit.message,/January 1, 2027/);
    assert.ok(params.expires_at*1000-NOW>=1800000);
  }
  assert.throws(()=>beta.betaTrialCheckoutOptions(END,'monthly',Date.parse(END)),/ended/);
});
test('Stripe trial access uses trial_end, carries an unpaid-trial marker, and ends when cancelled',()=>{
  const sub={id:'sub_beta',status:'trialing',trial_end:Date.parse(END)/1000,current_period_end:NOW/1000+100,
    items:{data:[{price:{id:'premium'}}]},metadata:{tier:'calendar'}};
  const grants=billing.stripeEntitlements([sub],{premium:'calendar'},NOW);
  assert.equal(grants[0].expires_at,END); assert.equal(grants[0].is_trial,true);
  assert.equal(billing.stripeEntitlements([{...sub,status:'canceled'}],{premium:'calendar'},NOW).length,0);
  const paid=billing.stripeEntitlements([{...sub,status:'active',current_period_end:Date.parse(END)/1000+86400}],{premium:'calendar'},NOW);
  assert.equal(paid[0].is_trial,undefined);
});
function checkoutHarness({member=true,body={},active=[],auth=true,wrongPrice=false,open=[]}={}) {
  let handler, captured, customerCreates=0, subCreates=0;
  const user={...account,stripe_customer_id:'cus_beta'};
  const db=dbFor(user,member?{trial_ends_at:END,redeemed_at:null}:null);
  class Stripe {
    customers={retrieve:async()=>({id:'cus_beta'}),create:async()=>{customerCreates++;return {id:'cus_beta'};}};
    subscriptions={list:async()=>({data:active}),create:()=>{subCreates++;throw Error('Subscriptions must start only through customer checkout');}};
    prices={retrieve:async()=>({currency:'usd',unit_amount:wrongPrice?1000:body.period==='yearly'?7700:777,recurring:{interval:body.period==='yearly'?'year':'month'}})};
    checkout={sessions:{list:async()=>({data:open}),expire:async()=>({}),create:async params=>{captured=params;return {id:'cs_beta',url:'https://checkout.stripe.com/example'};}}};
  }
  loadEdge('supabase/functions/create-checkout-session/index.ts',{mocks:{
    '../_shared/base44Compat.ts':{compatClient:()=>({auth:{me:async()=>auth?user:null,updateMe:async()=>{}}})},
    '../_shared/edge.ts':{json:(data,init)=>Response.json(data,init),handleOptions:()=>null,serviceClient:()=>db},
    'npm:stripe@14':{default:Stripe},
    '../_shared/eventOrders.ts':{resolveEventSignup:()=>{throw Error('not an event checkout');},buildEventMetadata:()=>({})},
  },globals:{Deno:{serve:fn=>{handler=fn;},env:{get:key=>({STRIPE_CALENDAR_PRICE_ID:'premium',STRIPE_CALENDAR_YEARLY_PRICE_ID:'premium_year'})[key]}}}});
  return {invoke:()=>handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({tier:'calendar',betaTrial:true,...body})})),
    state:()=>({captured,customerCreates,subCreates})};
}
test('eligible checkout requires a card and creates only a checkout session, never an automatic subscription',async()=>{
  for(const period of ['monthly','yearly']) {
    const h=checkoutHarness({body:{period}}); const result=await h.invoke();
    assert.equal(result.status,200);const s=h.state();
    assert.equal(s.subCreates,0);assert.equal(s.captured.subscription_data.metadata.beta_campaign,beta.BETA_TRIAL_CAMPAIGN);
    assert.equal(s.captured.payment_method_collection,'always');assert.equal(s.captured.subscription_data.trial_end,Date.parse(END)/1000);
    assert.equal(s.captured.line_items[0].price,period==='monthly'?'premium':'premium_year');
  }
});
test('nonmembers cannot claim trial, cached pages cannot charge eligible users, existing subscriptions cannot stack',async()=>{
  for(const options of [{member:false},{body:{betaTrial:false}},{active:[{status:'trialing'}]}]) {
    const h=checkoutHarness(options);assert.equal((await h.invoke()).status,409);assert.equal(h.state().captured,undefined);
  }
  const unauth=checkoutHarness({auth:false}); assert.equal((await unauth.invoke()).status,401);
  const bad=checkoutHarness({wrongPrice:true}); assert.equal((await bad.invoke()).status,500);assert.equal(bad.state().captured,undefined);
});

test('webhook redeems once, cancels a duplicate trial without invoicing, and projects Premium',async()=>{
  let handler, snapshot, winner=null;
  const cancelled=[];
  const makeSub=id=>({id,customer:'cus_beta',created:id==='sub_first'?1:2,status:'trialing',trial_end:Date.parse(END)/1000,
    current_period_end:Date.parse(END)/1000,items:{data:[{price:{id:'premium'}}]},
    metadata:{base44_user_id:USER,tier:'calendar',beta_campaign:beta.BETA_TRIAL_CAMPAIGN}});
  const subs=[makeSub('sub_first'),makeSub('sub_duplicate')];
  const db={rpc:async(name,args)=>{
    if(name==='redeem_beta_trial'){winner ||=args.p_subscription_id;return {data:winner,error:null};}
    snapshot=args;return {error:null};},
    from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:USER,stripe_customer_id:'cus_beta'},error:null})})}),update:()=>({eq:async()=>({error:null})})})};
  class Stripe {
    webhooks={constructEventAsync:async text=>JSON.parse(text)};
    subscriptions={list:()=>({async *[Symbol.asyncIterator](){yield* subs;}}),cancel:async(id,params)=>{cancelled.push({id,params});return {};}};
    checkout={sessions:{list:async()=>({data:[]})}};
  }
  loadEdge('supabase/functions/stripe-webhook/index.ts',{mocks:{
    '../_shared/base44Compat.ts':{compatClient:()=>({})},
    '../_shared/edge.ts':{json:(data,init)=>Response.json(data,init),handleOptions:()=>null,serviceClient:()=>db},
    '../_shared/eventOrders.ts':{createEventOrder:async()=>{}},'npm:stripe@14':{default:Stripe},
  },globals:{Deno:{serve:fn=>{handler=fn;},env:{get:key=>({STRIPE_CALENDAR_PRICE_ID:'premium'})[key]}}}});
  for(let i=0;i<2;i++) {
    const res=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({type:'customer.subscription.created',data:{object:subs[0]}})}));
    assert.equal(res.status,200);assert.equal(snapshot.p_entitlements.length,1);assert.equal(snapshot.p_entitlements[0].is_trial,true);
  }
  assert.equal(cancelled.length,1);assert.equal(cancelled[0].id,'sub_duplicate');
  assert.equal(cancelled[0].params.invoice_now,false);assert.equal(cancelled[0].params.prorate,false);
});
