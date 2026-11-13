// Offline preview with synthetic chart data. No credentials, LLM calls or email delivery.
const fs=require('node:fs');
const path=require('node:path');
const {loadEdge}=require('../tests/load-edge.cjs');
const modulePreview=loadEdge('supabase/functions/send-chart-recap-email/index.ts',{
  mocks:{'../_shared/base44Compat.ts':{compatClient:()=>{throw Error('Preview cannot call services');}},
    '../_shared/edge.ts':{handleOptions:()=>null,json:()=>{},isServiceRole:()=>false}},
  globals:{Deno:{serve(){}}},
});
const raw={unknown_time:true,planets:[
  {name:'Sun',sign:'Capricorn',element:'Earth',modality:'Cardinal'},
  {name:'Moon',sign:'Taurus',element:'Earth',modality:'Fixed'},
]};
const chart={raw_data:raw,sun_sign:'Capricorn',moon_sign:'Taurus'};
const ref=modulePreview.buildStructuredReference(raw,chart);
const html=modulePreview.renderRecapHtml({user:{full_name:'Alex'},chart,ref,appUrl:'https://astrosetta.com',narrative:{
  greeting:'Welcome, Alex. Your natal chart gives you a starting point for learning the language of astrology.',
  big_three:'This is a preview using a sample Capricorn Sun and Taurus Moon. The real email uses the recipient’s own chart.',
  opportunities:'Start with one placement and explore its meaning in the Learn section.',
  closing:'Keep learning at your own pace. Your chart is ready when you are.',
}});
const output=path.resolve(__dirname,'../../docs/email-previews/onboarding.html');
fs.writeFileSync(output,html);console.log(`Saved offline preview: ${output}`);
