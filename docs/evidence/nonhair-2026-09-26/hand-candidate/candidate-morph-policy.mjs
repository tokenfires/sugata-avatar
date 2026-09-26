// Source-scoped native dependency admission, not a numerical tolerance.
import assert from 'node:assert/strict';
import {compareRetained} from '../hand-clearance/retained-json-comparison.mjs';
export const DEPENDENT_MORPHS=Object.freeze({
 gaze:Object.freeze(['eyeLookInLeft','eyeLookOutLeft','eyeLookUpLeft','eyeLookDownLeft','eyeLookInRight','eyeLookOutRight','eyeLookUpRight','eyeLookDownRight']),
 facialIdle:Object.freeze(['eyeBlinkLeft','eyeBlinkRight','eyeSquintLeft','eyeSquintRight','eyeWideLeft','eyeWideRight','browInnerUp','browOuterUpLeft','browOuterUpRight'])
});
export function compareCandidateMorphs(actual,expected,morphNames,{step,audit=[]}={}){
 assert.equal(new Set(morphNames).size,morphNames.length);assert.equal(actual.morphs.length,morphNames.length);assert.equal(expected.morphs.length,morphNames.length);
 // Return statuses are separately admitted by the source-pinned native Gesture rule.
 const a=actual.instrument.owners,b=expected.instrument.owners;assert.deepEqual(a.map(x=>x.name),b.map(x=>x.name));
 const changes={step,owners:[],final:[]},allowedFinal=new Set(Object.values(DEPENDENT_MORPHS).flat());
 for(let i=0;i<a.length;i++){
  const am=a[i].raw?.morphs??[],bm=b[i].raw?.morphs??[];assert.deepEqual(am.map(x=>x[0]),bm.map(x=>x[0]),'Native owner morph declarations');
  const allowed=DEPENDENT_MORPHS[a[i].name]??[],changed=[];
  if(Object.hasOwn(DEPENDENT_MORPHS,a[i].name)){const withoutMorphs=raw=>Object.fromEntries(Object.entries(raw??{}).filter(([key])=>key!=='morphs'));compareRetained(withoutMorphs(a[i].raw),withoutMorphs(b[i].raw),{label:'Exact non-morph output '+a[i].name+' '+step,audit});}
  if(am.length)compareRetained(am.filter(([name])=>!allowed.includes(name)),bm.filter(([name])=>!allowed.includes(name)),{label:'Exact owner morph '+a[i].name+' '+step,audit});
  for(let j=0;j<am.length;j++){
   const [name,value]=am[j],old=bm[j][1];assert.ok(Number.isFinite(value)&&Number.isFinite(old));
   if(value!==old)changed.push({name,before:old,after:value,delta:value-old});
  }
  if(changed.length)changes.owners.push({owner:a[i].name,morphs:changed});
 }
 compareRetained(actual.morphs.filter((_,i)=>!allowedFinal.has(morphNames[i])),expected.morphs.filter((_,i)=>!allowedFinal.has(morphNames[i])),{label:'Exact final morph vector outside dependent gaze/lid/up-brow channels '+step,audit});
 for(let i=0;i<morphNames.length;i++){
  const name=morphNames[i],value=actual.morphs[i],old=expected.morphs[i];assert.ok(Number.isFinite(value)&&Number.isFinite(old));
  if(value!==old)changes.final.push({name,index:i,before:old,after:value,delta:value-old});
 }
 return changes;
}
