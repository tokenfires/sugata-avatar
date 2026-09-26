import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {GestureLayer,BEAT_EXCURSION,SHOULDER_RAISE_FULL_DEGREES,amplitudeFor} from '../../../../packages/core/src/motion/Gesture.js';
import {compareCandidateOwnerStatus,GESTURE_STATUS_SOURCE_HASHES,NATIVE_GESTURE_NEGLIGIBLE_RADIANS} from './candidate-gesture-status.mjs';
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const read=f=>fs.readFileSync(path.join(ROOT,f)),json=f=>JSON.parse(read(f));
const C='captures/hand-candidate-2026-09-26/candidate-primary-v2/',A='captures/hand-attribution-2026-09-26/primary-v4/';
const report=json(C+'report.json');assert.equal(hash(read(C+'report.json')),'72533663f9f19b15a79114391f6559010fb4d35afdf1b71b603fc657a23bf02b');
assert.equal(hash(read(C+'manifest.json')),report.manifestSHA256);assert.equal(report.manifestSHA256,'fb4cbbb7ede347671b838287d2876ad41ec425fd1ffa209409d8e068135f3a8d');
const reference=json(A+'report.json');assert.equal(hash(read(A+'report.json')),'bb12301ca0fd0db5097ad8fe6221498228612c2fcd314dac4377ca686d22a74e');
assert.equal(json(A+'seal.json').reportSHA256,hash(read(A+'report.json')));
const decode=(dir,entry)=>{const b=read(dir+entry.file);assert.equal(hash(b),entry.sha256);const raw=gunzipSync(b);assert.equal(hash(raw),entry.decodedSHA256);return JSON.parse(raw);};
const actual=decode(C,report.failureState),prior=decode(A,reference.runs.find(r=>r.arm==='A').states),expected=prior[492],partial=decode(C,report.states);
assert.equal(actual.step,492);assert.equal(report.failureState.step,492);assert.equal(partial.length,493);assert.deepEqual(actual,partial[492]);
const sourceHashes=report.sourceHashes;
for(const [file,sha]of Object.entries(GESTURE_STATUS_SOURCE_HASHES)){assert.equal(sourceHashes[file],sha);assert.equal(hash(read(file)),sha);assert.equal(hash(read(C+'source/'+file)),sha);}
const run=(a=actual,b=expected,step=492)=>compareCandidateOwnerStatus(a,b,{step,sourceHashes});
const copy=x=>structuredClone(x),tests=[],details={};
const test=(name,fn)=>{fn();tests.push(name);console.log('PASS '+name);};
const gesture=s=>s.instrument.owners.find(o=>o.name==='gesture');
function setStatus(s,status,raw=null){const o=gesture(s);o.status=status;o.raw=copy(raw);o.effective=copy(raw);s.instrument.samples.gesture=status==='returned-output'?{status,suppressed:[],raw:copy(raw),effective:copy(raw)}:{status,suppressed:[]};}

test('exact stopped native492 inputs explain both return decisions without mutating raw/null evidence',()=>{
    const before=hash(JSON.stringify([actual,expected]));const r=run();assert.equal(r.changed,true);
    assert.equal(r.actual.observedStatus,'returned-output');assert.equal(r.expected.observedStatus,'no-returned-output');
    assert.equal(r.actual.observedShoulderDegrees,.06884209321837896);assert.equal(r.expected.observedShoulderDegrees,.02409473262643264);
    assert.ok(r.actual.shoulderRadians>=NATIVE_GESTURE_NEGLIGIBLE_RADIANS);assert.ok(r.expected.shoulderRadians<NATIVE_GESTURE_NEGLIGIBLE_RADIANS);
    assert.equal(gesture(expected).raw,null);assert.equal(gesture(expected).effective,null);assert.equal(before,hash(JSON.stringify([actual,expected])));details.actualFailure=r;
});
test('all493 retained states keep every other owner status exact and admit only the proved492 difference',()=>{
    const changes=[];for(const state of partial){const r=run(state,prior[state.step],state.step);if(r.changed)changes.push(state.step);}
    assert.deepEqual(changes,[492]);details.retainedStates={compared:partial.length,changedSteps:changes};
});
test('forged non-gesture owner status, metadata, disabled/errors and PRNG changes are denied',()=>{
    for(const mutate of [
        s=>{const o=s.instrument.owners.find(o=>o.name==='bodyIdle');o.status='no-returned-output';o.raw=o.effective=null;},
        s=>{s.instrument.owners[0].weight=.5;},s=>{s.instrument.failure='frame error';},s=>{s.instrument.status='disposed';},
        s=>{const o=gesture(s);o.enabled=false;setStatus(s,'disabled');},s=>{gesture(s).status='error';},s=>{gesture(s).randomAfterFrame.state++;}
    ]){const s=copy(actual);mutate(s);assert.throws(()=>run(s));}
});
test('wrong yield, posture consistency, envelope, amplitude telemetry and next-double angles are denied',()=>{
    const next=x=>{const b=new ArrayBuffer(8),v=new DataView(b);v.setFloat64(0,x);v.setBigUint64(0,v.getBigUint64(0)+1n);return v.getFloat64(0);};
    for(const mutate of [s=>s.gesture.applied.yield=.35,s=>s.gesture.applied.activation+=.001,s=>s.gesture.applied.phase='stroke',s=>s.gesture.applied.hand='left',
        s=>s.gesture.applied.spatialExtent=0,s=>s.gesture.appliedSpatialExtent=0,s=>s.gesture.applied.elbowDegrees+=.001,
        s=>s.gesture.applied.shoulderDegrees=next(s.gesture.applied.shoulderDegrees),s=>s.sharedPosture.appliedArmRadians.leftUpperArm=.001,
        s=>s.gesture.yieldToPosture=false,s=>s.gesture.dominanceDrivesAmplitude=false,s=>s.affect.pad.dominance=.9]){const s=copy(actual);mutate(s);assert.throws(()=>run(s));}
});
test('false Gesture return/no-return records are denied on both sides, never filled from the other trace',()=>{
    const a=copy(actual),b=copy(actual);setStatus(b,'no-returned-output');assert.throws(()=>run(a,b),/false native/);
    const c0=copy(expected);setStatus(c0,'returned-output',gesture(actual).raw);assert.throws(()=>run(c0,expected),/false native/);
    const c=copy(expected);gesture(c).raw=gesture(actual).raw;assert.throws(()=>run(actual,c),/fabricated/);
});
test('source drift, missing pins, schedule/clock drift and malformed native intervals are denied',()=>{
    assert.throws(()=>compareCandidateOwnerStatus(actual,expected,{step:492,sourceHashes:{}}),/Source binding/);
    assert.throws(()=>compareCandidateOwnerStatus(actual,expected,{step:492,sourceHashes:{...sourceHashes,'packages/core/src/motion/Gesture.js':'wrong'}}),/Source binding/);
    for(const mutate of [s=>s.schedule.gestures[0].strokeStart+=.001,s=>s.gesture.utteranceTime+=.001,s=>s.clock+=.001,s=>s.instrument.samples.gesture.status='no-returned-output']){const s=copy(actual);mutate(s);assert.throws(()=>run(s));}
    const a=copy(actual),b=copy(expected);a.schedule.gestures[0].endTime=NaN;b.schedule.gestures[0].endTime=NaN;assert.throws(()=>run(a,b),/finite/);
});
// Independently ask the actual native update for its return value on adjacent double timestamps
// surrounding its threshold. This fixture tests the return predicate, not skinned rotations.
const serial=c=>({ownerName:c.ownerName,morphs:[...c.morphs],rotations:[...c.boneRotations].map(([n,q])=>[n,q.toArray()]),offsets:[...c.boneOffsets].map(([n,v])=>[n,v.toArray()])});
function nativeAt(time,closed=false){const s=copy(actual),g=new GestureLayer();if(closed){s.sharedPosture=copy(expected.sharedPosture);s.affect.postureDegrees=copy(expected.affect.postureDegrees);}g.armSidesMeasured=true;g.schedule=copy(actual.schedule);g.speaking=true;g.utteranceTime=time;
    const contribution=g.update(0,{shared:{posture:{appliedDegrees:s.sharedPosture.appliedDegrees},affect:{pad:s.affect.pad}}});
    s.gesture=g.report();setStatus(s,contribution?'returned-output':'no-returned-output',contribution?serial(contribution):null);return s;}
test('actual native update and policy agree on adjacent representable times straddling the unchanged strict radian threshold',()=>{
    const q=actual.schedule.gestures[0];let lo=q.preparationStart,hi=q.strokeStart;
    for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;if(gesture(nativeAt(mid)).status==='returned-output')hi=mid;else lo=mid;}
    const b=new ArrayBuffer(8),v=new DataView(b);v.setFloat64(0,lo);v.setBigUint64(0,v.getBigUint64(0)+1n);assert.equal(v.getFloat64(0),hi);
    const below=nativeAt(lo),above=nativeAt(hi);assert.equal(gesture(below).status,'no-returned-output');assert.equal(gesture(above).status,'returned-output');
    const rb=run(below,nativeAt(lo,true)),ra=run(above,nativeAt(hi,true));assert.equal(rb.changed,false);assert.equal(ra.changed,true);assert.ok(ra.actual.shoulderRadians>=NATIVE_GESTURE_NEGLIGIBLE_RADIANS);
    const forged=copy(below);setStatus(forged,'returned-output',gesture(above).raw);assert.throws(()=>run(forged,nativeAt(lo,true)),/false native/);
    const scale=below.gesture.applied.activation*below.gesture.applied.yield*1*amplitudeFor(below.gesture.applied.spatialExtent);
    const belowRadians=scale*BEAT_EXCURSION*SHOULDER_RAISE_FULL_DEGREES*(Math.PI/180);assert.ok(belowRadians<NATIVE_GESTURE_NEGLIGIBLE_RADIANS);
    details.adjacentBoundary={belowTime:lo,aboveTime:hi,belowRadians,aboveRadians:ra.actual.shoulderRadians,threshold:NATIVE_GESTURE_NEGLIGIBLE_RADIANS};
});
console.log(JSON.stringify({groups:tests.length,scope:'CPU native return-decision evidence only; no pose/cap/GPU changes',details}));
