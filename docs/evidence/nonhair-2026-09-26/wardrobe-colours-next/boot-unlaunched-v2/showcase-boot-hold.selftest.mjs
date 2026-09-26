import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {installShowcaseBootHold,BOOT_FRAME} from './showcase-boot-hold.mjs';
import {injectShowcaseBootEntry} from './showcase-boot-route.mjs';
const cases=[];
async function test(name,run){await run();cases.push({name,passed:true});}
function nativeFixture({bootDraw=false,stageError=null,avatarError=null,afterStage=null}={}){
 const calls=[],canvas={},options={canvas,autoStart:false,unchanged:{id:42}};
 class Stage{
  constructor(){this.nativeDraws=0;this.renderer={_initialized:true,_nodes:{nodeFrame:{frameId:1,renderId:0,time:.003,deltaTime:.003,lastTime:1}},info:{frame:1},_animation:{callback:null,_requestId:12,getAnimationLoop(){return this.callback;},stop(){calls.push('animation.stop');this._requestId=null;}},async setAnimationLoop(callback){calls.push('setAnimationLoop');this._animation.callback=callback;}};this.temporal={frameEpoch:()=>({jitterIndex:this.nativeDraws,jitterPeriod:31,historyWidth:this.nativeDraws?600:1})};}
  async create(...args){calls.push(['Stage.create',this,args]);this.renderer._animation.callback=()=>this.draw();if(bootDraw)this.draw();if(stageError)throw stageError;return this;}
  draw(...args){calls.push(['Stage.draw',this,args]);this.nativeDraws++;this.renderer._nodes.nodeFrame.renderId++;return 'native-draw-return';}
 }
 class Avatar{
  static async create(...args){calls.push(['Avatar.create',this,args]);const a=new Avatar();a.stage=new Stage();a.clockSeconds=0;a.disposed=false;try{await a.stage.create(args[0].canvas,args[0].unchanged);if(afterStage)await afterStage(a);if(avatarError)throw avatarError;await a.stage.renderer.setAnimationLoop(null);return a;}catch(e){a.dispose();throw e;}}
  dispose(){calls.push('native.dispose');this.disposed=true;}
 }
 return {Stage,Avatar,calls,options};
}
const descriptor=(o,k)=>Object.getOwnPropertyDescriptor(o,k);
await test('Actual receivers/arguments/return and one native ready draw are preserved; descriptors restored',async()=>{
 const f=nativeFixture(),sd=descriptor(f.Stage.prototype,'create'),ad=descriptor(f.Avatar,'create'),nativeDraw=f.Stage.prototype.draw;
 const hold=installShowcaseBootHold(f),a=await f.Avatar.create(f.options);assert.equal(a.stage.nativeDraws,0);assert.equal(a.stage.renderer._nodes.nodeFrame.frameId,BOOT_FRAME);
 assert.equal(f.calls[0][1],f.Avatar);assert.equal(f.calls[0][2][0],f.options);assert.equal(f.calls[1][1],a.stage);assert.equal(f.calls[1][2][0],f.options.canvas);assert.equal(f.calls[1][2][1],f.options.unchanged);
 assert.equal(a.stage.draw('native-argument'),'native-draw-return');const receipt=hold.admitReady({avatar:a});assert.equal(receipt.avatar.draws,0);assert.equal(receipt.ready.draws,1);assert.equal(receipt.phase,'admitted');assert.equal(a.stage.draw,nativeDraw);assert.equal(Object.hasOwn(a.stage,'draw'),false);assert.deepEqual(descriptor(f.Stage.prototype,'create'),sd);assert.deepEqual(descriptor(f.Avatar,'create'),ad);
 assert.deepEqual(receipt.restorations,['owned Stage.draw','Avatar.create','Stage.create']);assert.equal(hold.restoreForRetirement().phase,'admitted');
});
await test('Async native asset window sees stopped callback and cancelled RAF before Avatar resumes',async()=>{
 let witnessed=false;const f=nativeFixture({afterStage:async a=>{assert.equal(a.stage.renderer._animation.callback,null);assert.equal(a.stage.renderer._animation._requestId,null);assert.equal(a.stage.nativeDraws,0);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(a.stage.nativeDraws,0);witnessed=true;}});const hold=installShowcaseBootHold(f),a=await f.Avatar.create(f.options);assert.equal(witnessed,true);a.stage.draw();hold.admitReady({avatar:a});
});
await test('Pre-hold native draw is retained and rejects rather than being erased',async()=>{
 const f=nativeFixture({bootDraw:true}),sd=descriptor(f.Stage.prototype,'create'),ad=descriptor(f.Avatar,'create');const hold=installShowcaseBootHold(f);await assert.rejects(f.Avatar.create(f.options),/Stage.draw occurred before the startup hold/);assert.equal(hold.receipt().draws.length,1);assert.equal(hold.receipt().phase,'failed');assert.equal(hold.receipt().ready,null);assert.ok(f.calls.includes('native.dispose'));assert.deepEqual(descriptor(f.Stage.prototype,'create'),sd);assert.deepEqual(descriptor(f.Avatar,'create'),ad);
});
await test('Native construction failures retain their original error and restore the observer',async()=>{
 for(const position of ['stage','avatar']){const failure=new Error(position+' native rejection');const f=nativeFixture(position==='stage'?{stageError:failure}:{avatarError:failure}),sd=descriptor(f.Stage.prototype,'create');const hold=installShowcaseBootHold(f);await assert.rejects(f.Avatar.create(f.options),e=>e===failure);assert.equal(hold.receipt().ready,null);assert.equal(hold.receipt().phase,'failed');assert.ok(f.calls.includes('native.dispose'));assert.deepEqual(descriptor(f.Stage.prototype,'create'),sd);}
});
await test('Zero/two ready draws cannot be labelled the native one-draw page history',async()=>{
 for(const count of [0,2]){const f=nativeFixture(),hold=installShowcaseBootHold(f),a=await f.Avatar.create(f.options);for(let i=0;i<count;i++)a.stage.draw();assert.throws(()=>hold.admitReady({avatar:a}),/exactly one original Showcase/);assert.equal(hold.receipt().draws.length,count);assert.equal(hold.receipt().ready,null);assert.equal(Object.hasOwn(a.stage,'draw'),false);a.dispose();}
});
await test('Foreign published owner and changed motion/node clocks fail ready admission',async()=>{
 for(const change of ['owner','motion','frame','time','callback']){const f=nativeFixture(),hold=installShowcaseBootHold(f),a=await f.Avatar.create(f.options);a.stage.draw();if(change==='motion')a.clockSeconds=.01;if(change==='frame')a.stage.renderer._nodes.nodeFrame.frameId++;if(change==='time')a.stage.renderer._nodes.nodeFrame.time=.01;if(change==='callback')a.stage.renderer._animation.callback=()=>{};assert.throws(()=>hold.admitReady({avatar:change==='owner'?{}:a}));assert.equal(hold.receipt().ready,null);a.dispose();}
});
await test('Descriptor drift never overwrites a foreign draw owner during cleanup',async()=>{
 const f=nativeFixture(),sd=descriptor(f.Stage.prototype,'create'),ad=descriptor(f.Avatar,'create'),hold=installShowcaseBootHold(f),a=await f.Avatar.create(f.options),foreign=()=>{};a.stage.draw=foreign;assert.throws(()=>hold.restoreForRetirement(),/restoration failed/);assert.equal(a.stage.draw,foreign);assert.deepEqual(descriptor(f.Stage.prototype,'create'),sd);assert.deepEqual(descriptor(f.Avatar,'create'),ad);a.dispose();
});
await test('Failed descriptor restoration cannot publish a ready admission',async()=>{
 const f=nativeFixture(),hold=installShowcaseBootHold(f),a=await f.Avatar.create(f.options);a.stage.draw();const foreign=()=>{};a.stage.draw=foreign;assert.throws(()=>hold.admitReady({avatar:a}),/restoration failed/);assert.equal(hold.receipt().ready,null);assert.equal(hold.receipt().phase,'failed');assert.equal(a.stage.draw,foreign);a.dispose();
});
await test('Partial installation restores Stage if installing Avatar wrapper fails',async()=>{
 const f=nativeFixture(),sd=descriptor(f.Stage.prototype,'create');const refused=new Proxy(f.Avatar,{defineProperty(){throw new Error('controlled descriptor refusal');}});assert.throws(()=>installShowcaseBootHold({Stage:f.Stage,Avatar:refused}),/controlled descriptor refusal/);assert.deepEqual(descriptor(f.Stage.prototype,'create'),sd);
});
await test('Capture requires explicit manual creation and cannot be reused after admission',async()=>{
 const f=nativeFixture(),hold=installShowcaseBootHold(f);await assert.rejects(f.Avatar.create({...f.options,autoStart:true}),/autoStart:false/);assert.equal(hold.receipt().ready,null);
 const g=nativeFixture(),h=installShowcaseBootHold(g),a=await g.Avatar.create(g.options);a.stage.draw();h.admitReady({avatar:a});assert.throws(()=>h.admitReady({avatar:a}),/must resolve before ready admission/);a.dispose();
});
await test('Bound HTML entry substitution preserves all other bytes and rejects ambiguity',async()=>{
 const html='<!doctype html><title>Wardrobe</title><script type="module" src="./showcase.js"></script><p>Unchanged</p>',options={documentURL:'http://localhost:5396/src/showcase.html?capture=test',entryURL:'/@fs/project/docs/evidence/nonhair-2026-09-26/wardrobe-colours-next/showcase-boot-entry.mjs'};
 const out=injectShowcaseBootEntry(html,options);assert.equal(out.replace('http://localhost:5396'+options.entryURL,'./showcase.js'),html);
 for(const bad of [html+html,html.replace('./showcase.js','other.js')])assert.throws(()=>injectShowcaseBootEntry(bad,options));
 assert.throws(()=>injectShowcaseBootEntry(html,{...options,entryURL:'https://example.com/wardrobe-colours-next/showcase-boot-entry.mjs'}));assert.throws(()=>injectShowcaseBootEntry(html,{...options,entryURL:options.entryURL+'?unbound=1'}));
});
const sources=Object.fromEntries(['showcase-boot-hold.mjs','showcase-boot-route.mjs','showcase-boot-entry.mjs','showcase-boot-hold.selftest.mjs'].map(name=>[name,createHash('sha256').update(fs.readFileSync(new URL(name,import.meta.url))).digest('hex')]));
const result={scope:'CPU contract/ownership controls against observable synthetic native-shaped classes; actual startup timing/PMREM/image repeatability remains unverified.',sources,cases};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
