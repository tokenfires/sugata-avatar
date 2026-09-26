// Pure comparison of already decoded retained JSON. No native implementation or GPU imports.
import assert from 'node:assert/strict';
import { isDeepStrictEqual as equal } from 'node:util';
import { createHash } from 'node:crypto';
export const sha = x => createHash('sha256').update(x).digest('hex');
export function compactSteps(values) {
 const ranges=[];for(const n of values){const last=ranges.at(-1);if(last&&last[1]===n-1)last[1]=n;else ranges.push([n,n]);}
 return{count:values.length,first:values[0]??null,last:values.at(-1)??null,ranges};
}
const mapCompact=map=>Object.fromEntries(Object.entries(map).map(([key,steps])=>[key,compactSteps(steps)]));
const put=(map,key,step)=>{const list=map[key]??=[];if(list.at(-1)!==step)list.push(step);};
// Arrays remain atomic here. Ordered channel maps are separately compared by name below.
function changedPaths(a,b,prefix='') {
 if(equal(a,b))return[];
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)||Array.isArray(b))return[prefix];
 return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(key=>changedPaths(a[key],b[key],prefix?prefix+'.'+key:key));
}
function largestDelta(a,b) {
 if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b);
 if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length)return Math.max(0,...a.map((v,i)=>largestDelta(v,b[i])));
 return 0;
}
export function compareOwnerStates(reference,candidate,boneNames,{expectedFrames=721}={}) {
 assert.equal(reference.length,expectedFrames);assert.equal(candidate.length,expectedFrames);assert.equal(new Set(boneNames).size,boneNames.length);
 const ownerNames=reference[0].instrument.owners.map(o=>o.name),topFields={},topPaths={},instrumentFields={},owners={},bones={},ownerStatusCounts={reference:{},candidate:{}},checks={ownerFrames:0,rawEffective:0,activeYield:0,nativeCapTelemetry:0};
 const invariants=['step','clock','stackTime','stackFrame','schedule','morphs','attention'];
 const invariantHashes={};
 for(const key of invariants){const hashes=[reference,candidate].map(states=>sha(states.map(s=>JSON.stringify(s[key])+'\n').join('')));assert.equal(hashes[0],hashes[1],key+' trajectory');invariantHashes[key]={reference:hashes[0],candidate:hashes[1]};}
 const trajectory=(states,fn)=>sha(states.map(s=>JSON.stringify(fn(s))+'\n').join(''));
 for(const[key,fn]of[['ownerPRNG',s=>s.instrument.owners.map(o=>[o.name,o.randomAfterFrame])],['ownerMetadata',s=>s.instrument.owners.map(o=>[o.name,o.order,o.weight,o.enabled,o.status])]]){const a=trajectory(reference,fn),b=trajectory(candidate,fn);assert.equal(a,b,key+' trajectory');invariantHashes[key]={reference:a,candidate:b};}
 const postureStates=[],gestureStates=[];
 for(let i=0;i<expectedFrames;i++){
  const a=reference[i],s=candidate[i];assert.equal(a.step,i);assert.equal(s.step,i);assert.equal(s.stackFrame,i+2);assert.equal(s.instrument.frame,i+2);assert.equal(s.instrument.completedFrames,i+1);assert.equal(s.instrument.arm,'A');assert.equal(s.instrument.status,'active');assert.equal(s.instrument.failure,null);assert.equal(s.instrument.cleanup,null);
  assert.deepEqual(s.instrument.owners.map(o=>o.name),ownerNames);assert.equal(s.bones.length,boneNames.length*16);assert.equal(a.bones.length,s.bones.length);assert.ok(s.bones.every(Number.isFinite));
  for(const k of new Set([...Object.keys(a),...Object.keys(s)]))if(k!=='instrument'&&!equal(a[k],s[k])){put(topFields,k,i);if(k!=='bones'&&k!=='morphs')for(const p of changedPaths(a[k],s[k],k))put(topPaths,p,i);}
  for(const k of new Set([...Object.keys(a.instrument),...Object.keys(s.instrument)]))if(!equal(a.instrument[k],s.instrument[k]))put(instrumentFields,k,i);
  for(let j=0;j<ownerNames.length;j++){
   const ao=a.instrument.owners[j],o=s.instrument.owners[j];assert.equal(o.name,ownerNames[j]);
   for(const k of['name','order','weight','enabled','status','randomAfterFrame'])assert.deepEqual(o[k],ao[k],`${i} ${o.name}.${k}`);
   assert.deepEqual(o.raw,o.effective,`${i} ${o.name} raw/effective`);assert.deepEqual(ao.raw,ao.effective,`${i} reference ${o.name} raw/effective`);checks.ownerFrames++;checks.rawEffective+=2;
   for(const[name,record]of[['reference',ao],['candidate',o]]){const count=ownerStatusCounts[name][o.name]??={};count[record.status]=(count[record.status]??0)+1;}
   if(o.status==='returned-output'){assert.ok(o.raw!==null);assert.equal(o.raw.ownerName,o.name);}else{assert.equal(o.raw,null);assert.equal(o.effective,null);}
   if(equal(ao,o))continue;const entry=owners[o.name]??={steps:[],fields:{},channelOrders:{},channels:{}};entry.steps.push(i);
   for(const k of new Set([...Object.keys(ao),...Object.keys(o)]))if(!equal(ao[k],o[k]))put(entry.fields,k,i);
   for(const kind of['raw','effective'])for(const type of['morphs','rotations','offsets']){
    const before=ao[kind]?.[type]??[],after=o[kind]?.[type]??[];if(!equal(before.map(x=>x[0]),after.map(x=>x[0])))put(entry.channelOrders,kind+'.'+type,i);
    const am=new Map(before),sm=new Map(after);assert.equal(am.size,before.length);assert.equal(sm.size,after.length);
    for(const key of new Set([...am.keys(),...sm.keys()]))if(!equal(am.get(key),sm.get(key))){const name=kind+'.'+type+'.'+key,record=entry.channels[name]??={steps:[],firstWitness:{step:i,reference:am.get(key),candidate:sm.get(key)},maxAbsoluteComponentDelta:0};record.steps.push(i);record.maxAbsoluteComponentDelta=Math.max(record.maxAbsoluteComponentDelta,largestDelta(am.get(key),sm.get(key)));}
   }
  }
  for(const key of['posture','gesture']){const sample=s.instrument.samples[key],owner=s.instrument.owners.find(o=>o.name===(key==='posture'?'affectPosture':'gesture'));assert.equal(sample.status,owner.status);assert.deepEqual(sample.suppressed,[]);if(owner.raw){assert.deepEqual(sample.raw,owner.raw);assert.deepEqual(sample.effective,owner.effective);}}
  const pd=s.sharedPosture.appliedDegrees,rad=s.sharedPosture.appliedArmRadians;assert.equal(pd.armSpreadLeft,Math.max(0,pd.armSpread));assert.equal(pd.armSpreadRight,pd.armSpreadLeft);assert.equal(rad.leftUpperArm,rad.rightUpperArm);assert.ok(rad.leftUpperArm>=0);if(pd.armSpread<0)assert.equal(rad.leftUpperArm,0);assert.deepEqual(s.affect.postureDegrees,pd);checks.nativeCapTelemetry++;
  for(const key of['pad','moodOctant','activations','clockOwner'])assert.deepEqual(s.affect[key],a.affect[key],`Affect input ${key} ${i}`);
  assert.equal(pd.armSpread,a.sharedPosture.appliedDegrees.armSpread,`raw prescribed spread ${i}`);
  const g=s.gesture,ag=a.gesture;for(const k of['speaking','utteranceTime','spatialExtent','dominanceDrivesAmplitude','appliedSpatialExtent','temporalExtent','strokeSeconds','yieldToPosture','sagittalShare','armSidesMeasured','armSides','schedule'])assert.deepEqual(g[k],ag[k],`gesture ${k} ${i}`);
  for(const k of['activation','phase','hand','spatialExtent'])assert.deepEqual(g.applied[k],ag.applied[k],`gesture.applied.${k} ${i}`);
  if(g.applied.activation>0){assert.equal(g.applied.yield,1,`current active native yield ${i}`);checks.activeYield++;}
  postureStates.push([i,pd.armSpread,pd.armSpreadLeft,pd.armSpreadRight]);gestureStates.push([i,g.applied.activation,g.applied.yield,g.applied.shoulderDegrees,g.applied.elbowDegrees]);
  for(let j=0;j<boneNames.length;j++)if(!equal(a.bones.slice(j*16,j*16+16),s.bones.slice(j*16,j*16+16))){const name=boneNames[j],entry=bones[name]??={steps:[],maxAbsoluteComponentDelta:0,firstWitness:{step:i,reference:a.bones.slice(j*16,j*16+16),candidate:s.bones.slice(j*16,j*16+16)}};entry.steps.push(i);entry.maxAbsoluteComponentDelta=Math.max(entry.maxAbsoluteComponentDelta,largestDelta(a.bones.slice(j*16,j*16+16),s.bones.slice(j*16,j*16+16)));}
 }
 return{comparison:'Exact decoded retained JSON/ordered channel arrays; no epsilon. JSON has already collapsed signed zero.',frames:expectedFrames,ownerNames,boneNames,checks,invariantHashes,ownerStatusCounts,topFields:mapCompact(topFields),topPaths:mapCompact(topPaths),instrumentFields:mapCompact(instrumentFields),owners:Object.fromEntries(Object.entries(owners).map(([name,e])=>[name,{...compactSteps(e.steps),fields:mapCompact(e.fields),channelOrders:mapCompact(e.channelOrders),channels:Object.fromEntries(Object.entries(e.channels).map(([k,v])=>[k,{...compactSteps(v.steps),firstWitness:v.firstWitness,maxAbsoluteComponentDelta:v.maxAbsoluteComponentDelta}]))}])),changedPalette:Object.fromEntries(Object.entries(bones).map(([name,e])=>[name,{...compactSteps(e.steps),firstWitness:e.firstWitness,maxAbsoluteComponentDelta:e.maxAbsoluteComponentDelta}])),changedOwnersOutsidePostureGesture:Object.keys(owners).filter(n=>!['affectPosture','gesture'].includes(n)),nativeCapTelemetrySHA256:sha(JSON.stringify(postureStates)),gestureAppliedTrajectorySHA256:sha(JSON.stringify(gestureStates)),selectedStates:[0,98,270,455,637,720].filter(i=>i<expectedFrames).map(i=>({step:i,reference:{sharedPosture:reference[i].sharedPosture,gesture:reference[i].gesture},candidate:{sharedPosture:candidate[i].sharedPosture,gesture:candidate[i].gesture}}))};
}
