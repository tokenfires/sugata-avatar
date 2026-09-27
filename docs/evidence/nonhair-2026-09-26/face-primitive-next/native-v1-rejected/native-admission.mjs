// Node-only capture admissions. No native state, timing or rendering is changed.
import assert from 'node:assert/strict';

export const EXPECTED_CONFIGURATION=Object.freeze({identity:{gender:.5,mode:'nearest'},hair:'bob02',frame:'portrait',quality:'balanced',scene:'studio',lighting:'studio',seed:20260807,pose:'relaxed-standing',
 wardrobe:{style:'ecru',outfit:['female_casualsuit01','shoes01'],foundation:{TORSO:'foundation_bra',HIPS:'foundation_briefs'}}});
export const REQUIRED_GLB=Object.freeze(['assets/wardrobe/body/g050.glb','assets/wardrobe/female_casualsuit01/g050.glb','assets/wardrobe/foundation_bra/g050.glb','assets/wardrobe/foundation_briefs/g050.glb','assets/wardrobe/shoes01/g050.glb','assets/hair/bob02/g050.glb'].sort());
export const TIMING_EXCLUSIONS=Object.freeze(['wardrobe.state.lastDressMs','wardrobe.state.lastRebuildMs']);

export function stableInputProjection(input){
 const copy=structuredClone(input),state=copy.wardrobe?.state;
 assert.ok(state&&typeof state==='object','Missing actual wardrobe state');
 // Wardrobe.js dress/#applyOutfit assign now()-startedAt; stats() exposes them.
 // Raw receipts retain both values. Only these two wall-time fields are removed.
 for(const key of ['lastDressMs','lastRebuildMs']){
  assert.ok(Object.hasOwn(state,key)&&Number.isFinite(state[key])&&state[key]>=0,'Invalid wardrobe elapsed timing '+key);
  delete state[key];
 }
 return copy;
}

export function admitReady(ready){
 assert.deepEqual(ready.configuration,EXPECTED_CONFIGURATION,'Native exported protocol configuration');
 assert.equal(ready.backend,'webgpu');assert.equal(ready.clock,0);assert.equal(ready.autoStart,false);
 const r=ready.report;
 assert.deepEqual(r.identity,{gender:.5,bake:'figure_g050'});
 assert.equal(r.hair.attached,true);assert.equal(r.hair.style,'bob02');assert.equal(r.hair.loadedStyle,'bob02');
 assert.equal(r.scene.id,'studio');assert.equal(r.scene.lighting.look,'studio');assert.equal(r.scene.lighting.exposure,.85);
 assert.equal(r.quality.requested,'balanced');
 const w=r.wardrobe;
 assert.equal(w.attached,true);assert.equal(w.pendingCandidates,0);assert.equal(w.lastError,null);
 assert.deepEqual(w.appearance,{style:'ecru',attached:true});
 assert.deepEqual(w.foundation,EXPECTED_CONFIGURATION.wardrobe.foundation);
 assert.deepEqual(w.requestedOutfit,EXPECTED_CONFIGURATION.wardrobe.outfit);
 assert.equal(w.requestedStyle,'ecru');assert.equal(w.state.disposed,false);assert.equal(w.state.pendingFragments,0);
 assert.deepEqual([...w.state.worn].sort(),['female_casualsuit01','foundation_bra','foundation_briefs','shoes01'].sort());
 return {configuration:structuredClone(ready.configuration),nativeAttached:true};
}

export function admitLoadedGLB(responses,label,sources){
 const actual=responses.filter(r=>r.label===label&&r.asset?.endsWith('.glb'));
 assert.deepEqual(actual.map(r=>r.asset).sort(),REQUIRED_GLB,'Exact six loaded GLB responses, including multiplicity');
 for(const r of actual){assert.equal(r.status,200);assert.equal(r.sha256,sources[r.asset],'Loaded GLB source hash');}
 return actual.map(({asset,sha256,status})=>({asset,sha256,status}));
}

export function admitHTMLTransform(bootstrap,before,url,sourceSHA256){
 assert.equal(bootstrap.originalSHA256,sourceSHA256);
 assert.equal(bootstrap.requests.length,before+1,'Exactly one original HTML transform per fresh page');
 const request=bootstrap.requests[before],u=new URL(url);
 assert.deepEqual(request,{path:'/src/showcase.html',originalUrl:u.pathname+u.search,originalSHA256:sourceSHA256});
 return structuredClone(request);
}

export async function bounded(p,label,ms=30000){
 let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]);}finally{clearTimeout(timer);}
}

// Each owned resource gets one close invocation, even after a failed gate.
// A timeout is a failed admission, not evidence that the resource terminated.
export function createResourceCloser(receipts,{timeoutMs=30000}={}){
 const attempts=new WeakMap();
 return async function close(resource,label){
  if(!resource)return null;
  if(attempts.has(resource))return attempts.get(resource);
  const attempt=(async()=>{
   const receipt={label,attempted:true,closed:false,timeoutMs};receipts.push(receipt);
   try{await bounded(Promise.resolve().then(()=>resource.close()),label+' close',timeoutMs);receipt.closed=true;}
   catch(e){receipt.failure={name:e.name,message:e.message,stack:e.stack};}
   return receipt;
  })();
  attempts.set(resource,attempt);return attempt;
 };
}
