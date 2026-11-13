const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadEdge}=require('./load-edge.cjs');
const mobile=loadEdge('supabase/functions/_shared/mobileAppEmail.ts');
const mocks={
  '../_shared/base44Compat.ts':{compatClient:()=>{throw Error('Preview must not invoke services');}},
  '../_shared/edge.ts':{json:(body,init)=>Response.json(body,init),handleOptions:()=>null,isServiceRole:()=>false},
};
test('onboarding renderer includes Google Play, home-screen steps and canonical HTTPS links without beta promises',()=>{
  const section=mobile.mobileAppEmailSection();
  assert.match(section,/https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.astrosetta\.app/);
  assert.match(section,/https:\/\/astrosetta\.com\/brand\/google-play-badge-en\.png/);
  assert.match(section,/Add to Home Screen/);assert.match(section,/Safari/);assert.match(section,/Open as Web App/);
  assert.match(section,/page menu/);assert.match(section,/Reader icon/);assert.match(section,/View More/);
  assert.doesNotMatch(section,/Premium trial|December 31|\[First Name\]/);
  const module=loadEdge('supabase/functions/send-chart-recap-email/index.ts',{mocks,globals:{Deno:{serve(){}}}});
  const raw={unknown_time:true,planets:[{name:'Sun',sign:'Capricorn',element:'Earth',modality:'Cardinal'},{name:'Moon',sign:'Taurus',element:'Earth',modality:'Fixed'}]};
  const chart={raw_data:raw,sun_sign:'Capricorn',moon_sign:'Taurus'};
  const ref=module.buildStructuredReference(raw,chart);
  const html=module.renderRecapHtml({user:{full_name:'Alex'},chart,ref,narrative:{greeting:'Welcome, Alex.',big_three:'A sample chart summary.',closing:'Keep learning at your own pace.'},appUrl:'https://astrosetta.com'});
  assert.match(html,/Keep Astrosetta close/);assert.match(html,/Welcome, Alex/);
});
test('unauthenticated recap requests cannot select someone else or send an email',async()=>{
  let handler,lookups=0;
  loadEdge('supabase/functions/send-chart-recap-email/index.ts',{mocks:{...mocks,
    '../_shared/base44Compat.ts':{compatClient:()=>({auth:{me:async()=>null},asServiceRole:{entities:{User:{get:()=>{lookups++;throw Error('not allowed');}}}}})},
  },globals:{Deno:{serve:fn=>{handler=fn;}}}});
  const response=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({user_id:'someone-else'})}));
  assert.equal(response.status,401);assert.equal(lookups,0);
});
