import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Stage} from '../../../../packages/core/src/render/Stage.js';
// Execute the exact finish body with caller globals, avoiding page/bootstrap/GPU construction.
// Native Stage.dispose is real; renderer and pagehide/Avatar host are explicitly modeled.
function finishFrom(file,host){
    const source=fs.readFileSync(new URL(file,import.meta.url),'utf8'),at=source.indexOf('export async function finish(){');
    assert.ok(at>=0);const body=source.slice(at).replace('export async function finish(){','return async function finish(){');
    return new Function('stage','avatar','observer','Node','dispatchEvent','PageTransitionEvent',body)(
        host.stage,host.avatar,host.observer,{captureStackTrace:false},host.dispatch, class{constructor(type,init){this.type=type;Object.assign(this,init);}});
}
function host({residual=0,throwAfterDispose=false,absent=false}={}){
    const stage=absent?null:new Stage();let disposals=0;
    const renderer={info:{memory:{textures:3,total:100}},dispose(){disposals++;this.info.memory={textures:residual,total:residual};if(throwAfterDispose)throw Error('native modeled renderer disposal failed');}};
    if(stage)stage.renderer=renderer;
    const avatar={stage,disposed:false,leakedHandles:()=>[]},observer={report:()=>({restored:true})};
    const dispatch=event=>{assert.equal(event.type,'pagehide');assert.equal(event.persisted,false);avatar.disposed=true;try{stage?.dispose();}finally{avatar.stage=null;}};
    return {stage,avatar,observer,dispatch,renderer,get disposals(){return disposals;}};
}
const red=host();await assert.rejects(finishFrom('./rejected-warmup-v1/warmup-runtime.mjs',red)(),/Cannot read properties of null/);
assert.equal(red.stage.renderer,null);assert.equal(red.avatar.stage,null);assert.equal(red.avatar.disposed,true);assert.equal(red.disposals,1);assert.equal(red.renderer.info.memory.total,0);
const green=host(),receipt=await finishFrom('./warmup-runtime.mjs',green)();assert.equal(receipt.completed,true);
assert.equal(green.stage.renderer,null);assert.equal(green.avatar.stage,null);assert.equal(green.disposals,1);assert.deepEqual(receipt.memory,{textures:0,total:0});
assert.equal(receipt.stageRendererCleared,true);assert.equal(receipt.avatarStageCleared,true);assert.equal(receipt.stageBackend,'disposed');
const residual=host({residual:1});assert.equal((await finishFrom('./warmup-runtime.mjs',residual)()).completed,false);assert.equal(residual.disposals,1);
const failure=host({throwAfterDispose:true}),failed=await finishFrom('./warmup-runtime.mjs',failure)();
assert.equal(failed.completed,false);assert.equal(failed.cleanupErrors.length,1);assert.match(failed.cleanupErrors[0],/Stage disposal failed/);assert.equal(failure.disposals,1);
assert.equal(failure.stage.renderer,null);assert.deepEqual(failed.memory,{textures:0,total:0});
const absent=host({absent:true}),missing=await finishFrom('./warmup-runtime.mjs',absent)();assert.equal(missing.completed,false);assert.equal(missing.memory,null);
const uncleared=host();uncleared.dispatch=()=>{uncleared.avatar.disposed=true;uncleared.renderer.info.memory={textures:0,total:0};};
assert.equal((await finishFrom('./warmup-runtime.mjs',uncleared)()).completed,false);
console.log(JSON.stringify({groups:6,rejectedExactBodyReproduced:true,nativeStageDisposeClearsOwner:true,retainedRendererAfterDispose:true,
    residualMemoryAndCleanupErrorAndMissingOwnerRejected:true,scope:'CPU exact finish-body test with real native Stage disposal and modeled renderer/pagehide Avatar host; no GPU or native cleanup verdict.'}));
