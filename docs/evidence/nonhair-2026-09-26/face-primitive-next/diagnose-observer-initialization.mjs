import assert from 'node:assert/strict';
import {fixture,fixturePins} from './native-stack-fixture.mjs';
import {MotionStack} from '../../../../packages/core/src/motion/MotionStack.js';
import {HandAttributionArm} from '../hand-clearance/HandAttributionArm.mjs';
const f=fixture(),s=f.stack,a=f.a;
const predicates=()=>({nativeClass:s instanceof MotionStack,targetPresent:!!s.target,targetIdentity:a.target===s.target,nativeUpdate:s.update===MotionStack.prototype.update,nativeAccumulate:s.accumulate===MotionStack.prototype.accumulate,channelsClean:!s.channelsDirty,notEvaluating:s.evaluatingLayer===null});
const before={predicates:predicates(),frame:s.frame,time:s.time,idleArmsResolved:a.layers.idle.armOwnershipResolved};
assert.ok(Object.values(before.predicates).every(Boolean));f.firstFrame();
const after={predicates:predicates(),frame:s.frame,time:s.time,idleArmsResolved:a.layers.idle.armOwnershipResolved,idleArmsEnabled:a.layers.idle.armsEnabled,idleChannels:a.layers.idle.boneChannels.slice()};
assert.deepEqual(Object.entries(after.predicates).filter(([,ok])=>!ok).map(([key])=>key),['channelsClean']);assert.equal(after.frame,1);assert.equal(after.time,0);
assert.throws(()=>new HandAttributionArm(a,{arm:'A',sourceHashes:fixturePins}),/idle native stack/);
// Changing Stage.draw cannot repair this metadata predicate.
a.stage.draw=()=>{};assert.throws(()=>new HandAttributionArm(a,{arm:'A',sourceHashes:fixturePins}),/idle native stack/);
s.rebuildChannels();assert.ok(Object.values(predicates()).every(Boolean));const owner=new HandAttributionArm(a,{arm:'A',sourceHashes:fixturePins});
owner.dispose();f.attention.dispose();assert.equal(a.teardownCalls,1);assert.equal(a.disposed,true);
console.log(JSON.stringify({passed:true,scope:'Actual native motion constructors/methods and AttentionAction over source bones; synthetic target/renderer shells. Failed browser v1 did not record its individual guard booleans.',before,after,exactFalseConjunctInCPU:'channelsClean',nativeRebuildPermitsUnchangedGuard:true,stageDrawHypothesisRefuted:true,disposed:true},null,2));
