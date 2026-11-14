const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadEdge}=require('./load-edge.cjs');
const helper=loadEdge('apps/web/src/lib/browserShareImage.js',{globals:{File,Blob}});

test('prepares a real PNG File and blob URL before a save gesture',()=>{
  let input;
  const blob=new Blob(['png'],{type:'image/png'});
  const image=helper.prepareBrowserShareImage(blob,'astrosetta-cream',{createObjectURL:b=>{input=b;return 'blob:prepared';}});
  assert.equal(input,blob);assert.equal(image.file.type,'image/png');assert.equal(image.file.name,'astrosetta-cream.png');
  assert.equal(image.url,'blob:prepared');
  assert.throws(()=>helper.prepareBrowserShareImage(null,'broken'),/could not be prepared/);
});

test('file sharing is invoked synchronously while the click activation is still present',async()=>{
  const calls=[];const file=new File(['png'],'card.png',{type:'image/png'});
  const nav={canShare:payload=>{assert.equal(payload.files[0],file);calls.push('canShare');return true;},
    share:payload=>{assert.equal(payload.files[0],file);calls.push('share');return Promise.resolve();}};
  const pending=helper.sharePreparedImage({file},nav);
  assert.deepEqual(calls,['canShare','share']); // before awaiting anything
  await pending;
  assert.equal(helper.canShareImage({file},{canShare:()=>true}),false);
  assert.equal(helper.canShareImage({file},{share(){},canShare(){throw Error('blocked');}}),false);
});

test('blocked sharing stays distinguishable from cancellation so the UI can offer image saving',async()=>{
  const denied=Object.assign(new Error('Permission denied'),{name:'NotAllowedError'});
  const nav={canShare:()=>true,share:()=>Promise.reject(denied)};
  await assert.rejects(helper.sharePreparedImage({file:{}},nav),{name:'NotAllowedError'});
  assert.equal(helper.isShareCancelled(denied),false);
  assert.equal(helper.isShareCancelled({name:'AbortError'}),true);
  assert.equal(helper.isShareCancelled({message:'User cancelled sharing'}),true);
});

test('closing/changing a card cannot revoke a PNG while its download is starting',()=>{
  const image={url:'blob:ready'};let queued,delay;const revoked=[];
  const urls={revokeObjectURL:value=>revoked.push(value)};
  const schedule=(callback,ms)=>{queued=callback;delay=ms;};
  helper.releaseBrowserShareImage(image,urls,schedule);
  assert.equal(image.released,true);assert.deepEqual(revoked,[]);assert.equal(delay,60000);
  helper.releaseBrowserShareImage(image,urls,()=>{throw Error('duplicate cleanup');});
  queued();assert.deepEqual(revoked,['blob:ready']);
});
