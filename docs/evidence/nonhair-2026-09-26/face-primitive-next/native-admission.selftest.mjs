import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stableInputProjection,admitReady,admitLoadedGLB,admitHTMLTransform,EXPECTED_CONFIGURATION,REQUIRED_GLB,createResourceCloser} from './native-admission.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./native-admission-fixture.json',import.meta.url)));
let groups=0;
const input={wardrobe:fixture.wardrobe,rows:[{body:true,hash:'source'}],value:-0,unselected:undefined},saved=structuredClone(input),other=structuredClone(input);
other.wardrobe.state.lastDressMs=7.25;other.wardrobe.state.lastRebuildMs=.5;
assert.deepEqual(stableInputProjection(input),stableInputProjection(other));assert.deepEqual(input,saved);
assert.equal(Object.hasOwn(input.wardrobe.state,'lastDressMs'),true);groups++;
other.wardrobe.state.hiddenTriangles++;assert.notDeepEqual(stableInputProjection(input),stableInputProjection(other));
for(const value of [NaN,Infinity,-1,undefined]){const bad=structuredClone(input);bad.wardrobe.state.lastDressMs=value;assert.throws(()=>stableInputProjection(bad),/timing/);}
const missing=structuredClone(input);delete missing.wardrobe.state.lastRebuildMs;assert.throws(()=>stableInputProjection(missing),/timing/);groups++;
// Native-shaped fixture for independent protocol requirements; not a captured ready result.
const ready={configuration:structuredClone(EXPECTED_CONFIGURATION),backend:'webgpu',clock:0,autoStart:false,report:{identity:{gender:.5,bake:'figure_g050'},hair:{style:'bob02',loadedStyle:'bob02',attached:true},scene:{id:'studio',lighting:{look:'studio',exposure:.85}},quality:{requested:'balanced'},wardrobe:{attached:true,pendingCandidates:0,lastError:null,appearance:{style:'ecru',attached:true},foundation:{TORSO:'foundation_bra',HIPS:'foundation_briefs'},requestedOutfit:['female_casualsuit01','shoes01'],requestedStyle:'ecru',state:{disposed:false,pendingFragments:0,worn:['foundation_bra','foundation_briefs','female_casualsuit01','shoes01']}}}};
assert.ok(admitReady(ready).nativeAttached);
for(const mutate of [r=>r.configuration.frame='body',r=>r.report.hair.loadedStyle='bob01',r=>r.report.wardrobe.state.worn.pop(),r=>r.report.wardrobe.foundation.TORSO='foundation_vest',r=>r.report.scene.lighting.exposure=1,r=>r.clock=.01]){const bad=structuredClone(ready);mutate(bad);assert.throws(()=>admitReady(bad));}groups++;
const sources=Object.fromEntries(REQUIRED_GLB.map((p,i)=>[p,'hash'+i])),responses=REQUIRED_GLB.map(asset=>({label:'pristine',asset,sha256:sources[asset],status:200}));
assert.equal(admitLoadedGLB(responses,'pristine',sources).length,6);
assert.throws(()=>admitLoadedGLB(responses.slice(1),'pristine',sources));assert.throws(()=>admitLoadedGLB([...responses,responses[0]],'pristine',sources));
assert.throws(()=>admitLoadedGLB(responses.map((r,i)=>i===0?{...r,sha256:'wrong'}:r),'pristine',sources));groups++;
const url='http://localhost:5398/src/showcase.html?preset=casual&capture=tip-width',entry={path:'/src/showcase.html',originalUrl:'/src/showcase.html?preset=casual&capture=tip-width',originalSHA256:'source'};
assert.deepEqual(admitHTMLTransform({originalSHA256:'source',requests:[entry]},0,url,'source'),entry);
assert.throws(()=>admitHTMLTransform({originalSHA256:'source',requests:[entry,entry]},0,url,'source'));
assert.throws(()=>admitHTMLTransform({originalSHA256:'source',requests:[{...entry,originalUrl:'/wrong'}]},0,url,'source'));groups++;
const receipts=[],close=createResourceCloser(receipts,{timeoutMs:10});let successCount=0;
const success={close(){successCount++;}};assert.equal((await close(success,'context')).closed,true);assert.equal((await close(success,'context again')).closed,true);assert.equal(successCount,1);assert.equal(receipts.length,1);groups++;
const originalError=new Error('Original capture failure'),failures=[];
for(const resource of [{close(){throw Error('sync close failure');}},{close:async()=>{throw Error('async close failure');}},{close:()=>new Promise(()=>{})}]){
 const row=await close(resource,'failed resource');assert.equal(row.closed,false);assert.ok(row.failure);failures.push(row.failure.message);
 assert.equal(await close(resource,'no retry'),row);
}
assert.deepEqual(failures,['sync close failure','async close failure','failed resource close timed out']);
let lastClosed=false;assert.equal((await close({close(){lastClosed=true;}},'server after failures')).closed,true);assert.equal(lastClosed,true);assert.equal(originalError.message,'Original capture failure');groups++;
console.log(JSON.stringify({passed:true,groups,actualTimingFixture:fixture.sourceSHA256,scope:'Only two source-defined elapsed fields excluded; strict startup/asset/HTML negatives; bounded exactly-once close attempts and independent cleanup after failures. No native run.'}));
