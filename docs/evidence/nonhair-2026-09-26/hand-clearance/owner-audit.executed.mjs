import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import {createHash} from 'node:crypto'; import {gunzipSync} from 'node:zlib'; import {isDeepStrictEqual as eq} from 'node:util';
const root=process.cwd(), dir='captures/hand-attribution-2026-09-26/primary-v4', out='docs/evidence/nonhair-2026-09-26/hand-clearance/owner-audit-receipt.json';
assert.ok(!fs.existsSync(out),'receipt already exists');
const hash=x=>createHash('sha256').update(x).digest('hex'), read=f=>fs.readFileSync(path.join(dir,f)), json=f=>JSON.parse(read(f));
const seal=json('seal.json'),report=json('report.json'),manifest=json('manifest.json');
assert.equal(hash(read('report.json')),seal.reportSHA256);assert.equal(hash(read('manifest.json')),seal.manifestSHA256);assert.equal(seal.manifestSHA256,'fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d');assert.equal(report.manifestSHA256,seal.manifestSHA256);assert.equal(report.completed,true);assert.equal(report.mode,'primary');assert.equal(report.failure,undefined);assert.deepEqual(report.runs.map(r=>r.arm),['A','B','C']);assert.deepEqual(report.sourceHashes,manifest.sourceHashes);
const expectedFreeze=Object.entries({...manifest.sourceHashes,...manifest.baseline.inputHashes}).map(([file,sha256])=>({file:'source/'+file,sha256}));assert.deepEqual(report.sourceFreeze,expectedFreeze);
let frozenBytes=0;for(const f of report.sourceFreeze){const b=read(f.file);assert.equal(hash(b),f.sha256,f.file);frozenBytes+=b.length;}
const states={},archives=[],geometryArchives=[],ownerMetaKeys=['name','order','weight','enabled','status','randomAfterFrame'];
for(const run of report.runs){
 assert.equal(run.completed,true);assert.deepEqual(run.errors,[]);assert.equal(run.disposal.disposed,true);assert.deepEqual(run.disposal.leaks,[]);assert.ok(Object.values(run.disposal.memory).every(v=>v===0));assert.equal(run.disposal.instrument.status,'disposed');assert.deepEqual(run.disposal.instrument.cleanup.lost,[]);assert.equal(run.disposal.instrument.completedFrames,721);
 const p=run.setup.channelPreparation;assert.equal(p.calls,1);assert.equal(p.preservedState,true);assert.equal(p.preservedExistingIdentities,true);assert.deepEqual(p.before.state,p.after.state);
 assert.deepEqual(run.commands.map(c=>c.step),[0,360]);assert.deepEqual(run.commands,report.runs[0].commands);assert.deepEqual(run.setup.preFilter,report.runs[0].setup.preFilter);
 const decode=item=>{const b=read(item.file);assert.equal(hash(b),item.sha256,item.file);const d=gunzipSync(b);assert.equal(hash(d),item.decodedSHA256,item.file+' decoded');return JSON.parse(d);};
 const trace=decode(run.states);assert.equal(trace.length,721);assert.equal(run.states.count,721);states[run.arm]=trace;archives.push({arm:run.arm,...run.states});
 for(const g of run.geometry){const snap=decode(g);assert.equal(snap.telemetry.clock,trace[g.step].clock);assert.deepEqual(snap.telemetry,((({step,...rest})=>rest)(trace[g.step])));geometryArchives.push({arm:run.arm,step:g.step,file:g.file,sha256:g.sha256,decodedSHA256:g.decodedSHA256});}
 for(const a of run.loadedAssets){assert.equal(manifest.sourceHashes[a.file],a.sha256,a.file);assert.equal(read('source/'+a.file).length,a.bytes);assert.ok(run.routeFulfillments.some(f=>f.file===a.file&&f.sha256===a.sha256));}for(const f of run.routeFulfillments)assert.equal(manifest.sourceHashes[f.file],f.sha256);
}
const baseline=states.A, ownerNames=baseline[0].instrument.owners.map(o=>o.name), ownerStatusCounts={}, invariants=['clock','stackTime','stackFrame','affect','gesture','schedule','attention','sharedPosture'];let ownerFrameChecks=0, rawEffectiveChecks=0;
for(const arm of ['A','B','C']){
 ownerStatusCounts[arm]={};
 for(let i=0;i<721;i++){
  const s=states[arm][i],a=baseline[i];assert.equal(s.step,i);assert.equal(s.stackFrame,i+2);assert.equal(s.instrument.frame,i+2);assert.equal(s.instrument.completedFrames,i+1);assert.equal(s.instrument.status,'active');assert.equal(s.instrument.failure,null);assert.equal(s.instrument.cleanup,null);assert.deepEqual(s.instrument.owners.map(o=>o.name),ownerNames);
  for(const k of invariants)assert.deepEqual(s[k],a[k],`${arm} ${i} ${k}`);
  for(const k of ['posture','gesture'])assert.deepEqual(s.instrument.samples[k].raw,a.instrument.samples[k].raw,`${arm} ${i} raw ${k}`);
  for(let j=0;j<ownerNames.length;j++){
   const o=s.instrument.owners[j],ao=a.instrument.owners[j];for(const k of ownerMetaKeys)assert.deepEqual(o[k],ao[k],`${arm} ${i} ${o.name}.${k}`);ownerFrameChecks++;
   const statuses=ownerStatusCounts[arm][o.name]??={};statuses[o.status]=(statuses[o.status]??0)+1;
   let expected=structuredClone(o.raw),suppressed=[];
   if(expected&&arm==='B'&&o.name==='affectPosture')for(const[name,key]of[['upperarm_l','leftUpperArm'],['upperarm_r','rightUpperArm']])if(s.sharedPosture.appliedArmRadians[key]<0){expected.rotations.find(x=>x[0]===name)[1]=[0,0,0,1];suppressed.push(name);}
   if(expected&&arm==='C'&&o.name==='gesture')for(const[name]of expected.rotations){assert.ok(['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r'].includes(name));expected.rotations.find(x=>x[0]===name)[1]=[0,0,0,1];suppressed.push(name);}
   assert.deepEqual(o.effective,expected,`${arm} ${i} ${o.name} effective`);rawEffectiveChecks++;
   if(['affectPosture','gesture'].includes(o.name)){const sample=s.instrument.samples[o.name==='gesture'?'gesture':'posture'];assert.equal(sample.status,o.status);assert.deepEqual(sample.suppressed,suppressed);if(expected){assert.deepEqual(sample.raw,o.raw);assert.deepEqual(sample.effective,o.effective);}}
  }
 }
}
const trajectorySelectors={schedule:s=>s.schedule,postureRaw:s=>s.instrument.samples.posture.raw??null,gestureRaw:s=>s.instrument.samples.gesture.raw??null,sharedPosture:s=>s.sharedPosture,clock:s=>[s.step,s.clock,s.stackTime,s.stackFrame],ownerPRNG:s=>s.instrument.owners.map(o=>[o.name,o.randomAfterFrame]),ownerMeta:s=>s.instrument.owners.map(o=>[o.name,o.order,o.weight,o.enabled,o.status])},trajectoryHashes={};
for(const[name,fn]of Object.entries(trajectorySelectors)){trajectoryHashes[name]={};for(const arm of ['A','B','C'])trajectoryHashes[name][arm]=hash(states[arm].map(s=>JSON.stringify(fn(s))+'\n').join(''));assert.equal(trajectoryHashes[name].A,trajectoryHashes[name].B);assert.equal(trajectoryHashes[name].A,trajectoryHashes[name].C);}
const ranges=values=>{const r=[];for(const n of values){const p=r.at(-1);if(p&&p[1]===n-1)p[1]=n;else r.push([n,n]);}return r;}, compact=v=>({count:v.length,first:v[0]??null,last:v.at(-1)??null,ranges:ranges(v)});
const comparisons={},boneNames=report.runs[0].setup.channelPreparation.before.state.skeleton.map(x=>x.name);assert.equal(baseline[0].bones.length,boneNames.length*16);
for(const arm of ['B','C']){
 const topFields={},instrumentFields={},owners={},bones={};
 for(let i=0;i<721;i++){
  const a=baseline[i],s=states[arm][i];
  for(const k of new Set([...Object.keys(a),...Object.keys(s)]))if(k!=='instrument'&&!eq(a[k],s[k]))(topFields[k]??=[]).push(i);
  for(const k of new Set([...Object.keys(a.instrument),...Object.keys(s.instrument)]))if(!eq(a.instrument[k],s.instrument[k]))(instrumentFields[k]??=[]).push(i);
  for(let j=0;j<ownerNames.length;j++){
   const ao=a.instrument.owners[j],o=s.instrument.owners[j];if(eq(ao,o))continue;const entry=owners[o.name]??={steps:[],fields:{},channels:{}};entry.steps.push(i);
   for(const key of new Set([...Object.keys(ao),...Object.keys(o)]))if(!eq(ao[key],o[key]))(entry.fields[key]??=[]).push(i);
   for(const kind of ['raw','effective'])for(const type of ['morphs','rotations','offsets']){const am=new Map(ao[kind]?.[type]??[]),sm=new Map(o[kind]?.[type]??[]);for(const key of new Set([...am.keys(),...sm.keys()]))if(!eq(am.get(key),sm.get(key)))(entry.channels[kind+'.'+type+'.'+key]??=[]).push(i);}
  }
  for(let j=0;j<boneNames.length;j++)if(!eq(a.bones.slice(j*16,j*16+16),s.bones.slice(j*16,j*16+16)))(bones[boneNames[j]]??=[]).push(i);
 }
 const mapCompact=ob=>Object.fromEntries(Object.entries(ob).map(([k,v])=>[k,compact(v)]));
 comparisons['A_vs_'+arm]={topFields:mapCompact(topFields),instrumentFields:mapCompact(instrumentFields),owners:Object.fromEntries(Object.entries(owners).map(([k,v])=>[k,{...compact(v.steps),fields:mapCompact(v.fields),channels:mapCompact(v.channels)}])),skinningPaletteBones:mapCompact(bones)};
}
const receipt={version:1,createdAt:new Date().toISOString(),inputDirectory:dir,sealSHA256:hash(read('seal.json')),reportSHA256:seal.reportSHA256,manifestSHA256:seal.manifestSHA256,comparisonSemantics:'Exact decoded JSON values and ordered map arrays; no numeric tolerance. JSON does not distinguish signed zero.',sourceBinding:{manifestSources:Object.keys(manifest.sourceHashes).length,retainedBaselineInputs:Object.keys(manifest.baseline.inputHashes).length,verifiedFrozenFiles:report.sourceFreeze.length,verifiedFrozenBytes:frozenBytes,sourceFreezeIndexSHA256:hash(JSON.stringify(report.sourceFreeze))},archives,geometryBinding:{verifiedArchives:geometryArchives.length,indexSHA256:hash(JSON.stringify(geometryArchives)),telemetryEqualsSameStepState:true},nativeSetup:{channelRebuildCallsPerArm:1,beforeAfterStateEqual:true,existingIdentityRetained:true,preFilterEqualAcrossArms:true,initialStackFrame:2,framesPerArm:721},invariants:{arms:['A','B','C'],ownerCount:ownerNames.length,ownerFrameChecks,rawEffectiveChecks,equalStateFields:invariants,equalOwnerFields:ownerMetaKeys,actualCommandSteps:[0,360],commandReceiptsEqual:true,sourcePreservingDisposalAllArms:true,zeroBrowserErrors:true,zeroFinalRendererMemory:true},trajectoryHashes,ownerStatusCounts,comparisons,limits:['All changes are compared at recorded native frame boundaries in this one happy-to-angry 12s prefix.','Authored native posture/gesture and shared yield remain intact; effective study rotations are filtered.','This receipt does not certify a product correction, all motion, hand clearance, continuous collision or perceptual quality.','Detailed geometry counts and visual evidence are separate analyses.']};
fs.writeFileSync(out,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({receiptSHA256:hash(fs.readFileSync(out)),sourceBinding:receipt.sourceBinding,invariants:receipt.invariants,comparisons:Object.fromEntries(Object.entries(comparisons).map(([k,v])=>[k,{topFields:v.topFields,instrumentFields:v.instrumentFields,owners:v.owners,changedBoneNames:Object.keys(v.skinningPaletteBones)}]))},null,2));
