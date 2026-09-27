import assert from 'node:assert/strict';
import {fixture,fixturePins} from './native-stack-fixture.mjs';
import {HandAttributionArm} from '../hand-clearance/HandAttributionArm.mjs';
import {prepareNativeChannels,observerPrerequisites} from './native-channel-preparation.mjs';
const rows=c=>({ownerName:c.ownerName,morphs:[...c.morphs],rotations:[...c.boneRotations].map(([n,q])=>[n,q.toArray()]),offsets:[...c.boneOffsets].map(([n,v])=>[n,v.toArray()])});
const state=f=>({frame:f.stack.frame,time:f.stack.time,morphs:f.a.figure.body.morphTargetInfluences.slice(),bones:f.a.figure.body.skeleton.bones.map(b=>[b.name,b.position.toArray(),b.quaternion.toArray(),b.matrixWorld.toArray()]),
 owners:f.stack.layers.map(l=>[l.name,l.enabled,l.weight,l.random.state,l.random.spareGaussian,rows(l.contribution)]),pad:{...f.a.affectState.pad},gesture:structuredClone(f.a.gesture.report())});
let groups=0;
const a=fixture();a.firstFrame();assert.deepEqual(Object.entries(observerPrerequisites(a.a)).filter(([,v])=>!v).map(([k])=>k),['channelsClean']);
assert.throws(()=>new HandAttributionArm(a.a,{arm:'A',sourceHashes:fixturePins}),/idle native stack/);groups++;
const before=state(a),receipt=prepareNativeChannels(a.a);assert.equal(receipt.calls,1);assert.deepEqual(state(a),before);assert.ok(Object.values(receipt.guardAfter).every(Boolean));assert.deepEqual(receipt.addedMorphChannels,[]);assert.deepEqual(receipt.addedBoneChannels,[]);groups++;
assert.equal(prepareNativeChannels(a.a).calls,0);assert.deepEqual(state(a),before);groups++;
// Preparation merely brings forward the next native update's existing channel rebuild.
const control=fixture();control.firstFrame();const observed=new HandAttributionArm(a.a,{arm:'A',sourceHashes:fixturePins});
control.stack.update(1/60);control.root.updateMatrixWorld(true);a.stack.update(1/60);a.root.updateMatrixWorld(true);
assert.deepEqual(state(a),state(control));for(const o of observed.report().owners)assert.deepEqual(o.raw,o.effective);groups++;
observed.dispose();a.attention.dispose();control.attention.dispose();control.a.dispose();assert.equal(a.a.teardownCalls,1);assert.equal(a.attention.disposed,true);groups++;
for(const mutate of [f=>f.stack.update=()=>{},f=>f.stack.accumulate=()=>{},f=>f.stack.evaluatingLayer=f.a.layers.idle,f=>f.a.target={},f=>f.stack.rebuildChannels=()=>{}]){
 const f=fixture();f.firstFrame();mutate(f);const b=state(f);assert.throws(()=>prepareNativeChannels(f.a));assert.deepEqual(state(f),b);assert.equal(f.stack.channelsDirty,true);f.attention.dispose();f.a.dispose();
}groups++;
const wrong=fixture();assert.throws(()=>prepareNativeChannels(wrong.a),/first zero frame/);wrong.attention.dispose();wrong.a.dispose();groups++;
// Deliberately wrong shutdown order reproduces the native pagehide/observer conflict.
const bad=fixture();bad.firstFrame();prepareNativeChannels(bad.a);const owner=new HandAttributionArm(bad.a,{arm:'A',sourceHashes:fixturePins});
assert.throws(()=>bad.attention.dispose(),/stack.remove/);assert.equal(bad.a.disposed,false);owner.dispose();assert.equal(bad.a.teardownCalls,1);groups++;
console.log(JSON.stringify({passed:true,groups,scope:'Actual native motion owners/source bones with synthetic target/renderer shells; metadata-only rebuild preserves current state and next native frame; foreign mutation and wrong teardown order rejected. No GPU or complete Avatar factory run.'}));
