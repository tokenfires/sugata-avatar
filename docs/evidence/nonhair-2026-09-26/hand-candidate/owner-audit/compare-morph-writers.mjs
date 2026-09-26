// Independent retained-data oracle. No native mutation, capture or numerical tolerance.
import assert from 'node:assert/strict';
export const DEPENDENT_OWNER_CHANNELS=Object.freeze({
 gaze:Object.freeze(['eyeLookInLeft','eyeLookOutLeft','eyeLookUpLeft','eyeLookDownLeft','eyeLookInRight','eyeLookOutRight','eyeLookUpRight','eyeLookDownRight']),
 facialIdle:Object.freeze(['eyeBlinkLeft','eyeBlinkRight','eyeSquintLeft','eyeSquintRight','eyeWideLeft','eyeWideRight','browInnerUp','browOuterUpLeft','browOuterUpRight'])
});
export function foldNativeMorphs(owners,names){
 const sums=new Map();
 for(const o of owners){if(o.status!=='returned-output'){assert.equal(o.raw,null,'Nonreturned owner cannot supply a stale morph');continue;}assert.ok(o.enabled);assert.ok(Number.isFinite(o.weight));for(const[n,v]of o.raw.morphs){assert.ok(Number.isFinite(v));if(Math.abs(v)<1e-6)continue;sums.set(n,(sums.get(n)??0)+v*o.weight);}}
 return names.map(n=>Math.min(Math.max(sums.get(n)??0,0),1));
}
export function compareMorphWriters(reference,candidate,names){
 assert.equal(new Set(names).size,names.length);assert.equal(candidate.morphs.length,names.length);assert.equal(reference.morphs.length,names.length);
 assert.deepEqual(candidate.instrument.owners.map(o=>o.name),reference.instrument.owners.map(o=>o.name));
 const changes=[];
 for(let i=0;i<candidate.instrument.owners.length;i++){
  const b=reference.instrument.owners[i],c=candidate.instrument.owners[i],before=b.raw?.morphs??[],after=c.raw?.morphs??[],allowed=DEPENDENT_OWNER_CHANNELS[c.name]??[];
  assert.deepEqual(after.map(([n])=>n),before.map(([n])=>n),`${c.name} ordered morph declarations`);
  if(DEPENDENT_OWNER_CHANNELS[c.name])for(const key of['rotations','offsets'])assert.deepEqual(c.raw?.[key],b.raw?.[key],`${c.name} exact non-morph ${key}`);
  for(let j=0;j<after.length;j++){const[name,value]=after[j],prior=before[j][1];assert.ok(Number.isFinite(value)&&Number.isFinite(prior));if(!allowed.includes(name))assert.equal(value,prior,`${c.name}.${name} protected owner morph`);if(value!==prior)changes.push({owner:c.name,name,reference:prior,candidate:value,delta:value-prior});}
 }
 assert.deepEqual(foldNativeMorphs(reference.instrument.owners,names),reference.morphs,'Reference native morph fold matches actual body');
 assert.deepEqual(foldNativeMorphs(candidate.instrument.owners,names),candidate.morphs,'Candidate native morph fold matches actual body');
 const union=new Set(Object.values(DEPENDENT_OWNER_CHANNELS).flat()),final=[];
 for(let i=0;i<names.length;i++){const name=names[i],before=reference.morphs[i],after=candidate.morphs[i];if(!union.has(name))assert.equal(after,before,`Protected final body morph ${name}`);if(after!==before)final.push({name,index:i,reference:before,candidate:after,delta:after-before});}
 return{owners:changes,final};
}
