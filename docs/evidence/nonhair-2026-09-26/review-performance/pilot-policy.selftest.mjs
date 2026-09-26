import assert from 'node:assert/strict';
import {PILOT,warmupStability,summarizeSamples,passSignature,assertSampleCensus} from './pilot-policy.mjs';
const make=(end=180)=>Array.from({length:end-8},(_,i)=>({step:i+9,snapshot:{memory:{programs:74,total:635740358},pipelines:{cache:93,vertex:15,fragment:20,compute:3},resources:217,passes:{counts:{render:12,compute:2},targets:[{type:'render',width:476,height:459,textures:['beauty']}],groups:[{type:'compute',groupKind:'array'}]}}}));
assert.deepEqual(PILOT,{traceSteps:8,minWarmup:180,maxWarmup:600,window:60,samples:240,dt:1/60});
const rows=make(),original=JSON.stringify(rows);assert.equal(warmupStability(rows).stable,true);assert.equal(JSON.stringify(rows),original);
for(const at of [60,61,120,121,180]){const x=structuredClone(rows);x.find(r=>r.step===at).snapshot.pipelines.cache++;assert.equal(warmupStability(x).stable,false);}
const passChanged=make();passChanged.at(-1).snapshot.passes.targets[0].width++;assert.equal(warmupStability(passChanged).stable,false);
const groupChanged=make();groupChanged.at(-1).snapshot.passes.groups[0].groupKind='node';assert.equal(warmupStability(groupChanged).stable,false);
const nativeRow={accounting:{passes:{render:1,compute:1}},passes:{render:1,compute:1},targets:[{type:'render',width:476,height:459,textures:['beauty']},{type:'compute',name:'solver',id:1}],queries:[{type:'compute',groupKind:'array',uid:'first'}]};
const mutated=structuredClone(nativeRow);mutated.targets[1].id=300;mutated.queries[0].uid='different';assert.deepEqual(passSignature(nativeRow),passSignature(mutated));
assert.throws(()=>passSignature({...nativeRow,accounting:null}),/Completed/);
const early=make();early.find(r=>r.step===59).snapshot.memory.total++;assert.equal(warmupStability(early).stable,true);
const extend=make(240);extend.find(r=>r.step===60).snapshot.pipelines.cache++;assert.equal(warmupStability(extend).stable,true);
assert.equal(warmupStability(make(600)).stable,true);
assert.throws(()=>warmupStability(make(601)),/boundary/);assert.throws(()=>warmupStability(rows.slice(1).filter(r=>r.step!==100)),/complete/);
const missing=structuredClone(rows);missing.at(-1).snapshot.pipelines=null;assert.throws(()=>warmupStability(missing),/Missing/);
const nan=structuredClone(rows);nan.at(-1).snapshot.memory.total=NaN;assert.throws(()=>warmupStability(nan),/Invalid/);
assert.equal(assertSampleCensus(rows.at(-1).snapshot,structuredClone(rows.at(-1).snapshot)),true);
for(const field of ['memory','pipelines','passes','resources']){const x=structuredClone(rows.at(-1).snapshot);x[field]=null;assert.throws(()=>assertSampleCensus(x,rows.at(-1).snapshot),/diverged/);}
assert.throws(()=>assertSampleCensus(null,rows.at(-1).snapshot),/diverged/);
const samples=Array.from({length:240},(_,i)=>({phase:'sample',cpuMs:i,stepWallMs:i+1,queueWaitMs:0,accounting:{durationMs:{render:i,compute:2,passSum:i+2}}}));
const stats=summarizeSamples(samples);assert.equal(stats.cpuMs.median,119.5);assert.equal(stats.cpuMs.p95,227);assert.equal(stats.passSumMs.max,241);
assert.throws(()=>summarizeSamples(samples.slice(1)),/240/);const wrong=structuredClone(samples);wrong[0].phase='warmup';assert.throws(()=>summarizeSamples(wrong),/240/);
const invalid=structuredClone(samples);invalid[0].accounting.durationMs.render=Infinity;assert.throws(()=>summarizeSamples(invalid),/Invalid/);
console.log(JSON.stringify({groups:5,windowTransitions:120,sampleCount:240,scope:'CPU stability/summary policy; no native resource or performance result.'}));
