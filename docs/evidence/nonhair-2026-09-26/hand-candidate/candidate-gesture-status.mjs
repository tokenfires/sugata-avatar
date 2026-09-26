// One source-bound native status exception. It never changes an observed status or contribution.
import assert from 'node:assert/strict';
import {gestureEnvelope, amplitudeFor, postureYield, BEAT_EXCURSION, SHOULDER_RAISE_FULL_DEGREES,
    ELBOW_FOLLOW, ELBOW_RAISE_FULL_DEGREES, SAGITTAL_SHARE, strokeDurationFor} from '../../../../packages/core/src/motion/Gesture.js';

export const GESTURE_STATUS_SOURCE_HASHES=Object.freeze({
    'packages/core/src/motion/Gesture.js':'c52205441a5d963579813a68fe1642097df7ba44a1166b66d2b7c4f20e9ac1ea',
    'packages/core/src/Avatar.js':'9e44e981d48a835b57b0badf4b2e675f2b10fc64da8bbfcd316e3201e586407c',
    'docs/evidence/nonhair-2026-09-26/hand-clearance/HandAttributionArm.mjs':'614cf2db48236909337e696029cf0e4fbe743ab24c0631bb9f7998d685839f14'
});
const RAD=Math.PI/180;
// Not exported by native Gesture.js. Its exact source hash above binds both this expression and
// the strict '<' branch at native lines250/837. This is not a tolerance or a converted-degree test.
export const NATIVE_GESTURE_NEGLIGIBLE_RADIANS=0.05*RAD;
const statuses=new Set(['returned-output','no-returned-output','disabled']);
const finite=(x,label)=>{assert.ok(Number.isFinite(x),label+' must be finite');return x;};
function number(actual,expected,label,zeroSigns){
    finite(actual,label);finite(expected,label+' expected');
    // JSON-retained -0 is 0; all other finite values must be identical. No rounding/epsilon.
    assert.ok(actual===expected,label+' differs');
    if(Object.is(actual,-0)||Object.is(expected,-0))zeroSigns.push({path:label,actualNegativeZero:Object.is(actual,-0),expectedNegativeZero:Object.is(expected,-0)});
}
function ownerRecords(state,label){
    assert.equal(state.instrument?.arm,'A',label+' must be an unfiltered native arm');
    assert.equal(state.instrument.status,'active',label+' instrument not active');
    assert.equal(state.instrument.failure,null,label+' instrument failed');
    assert.ok(Array.isArray(state.instrument.owners)&&state.instrument.owners.length>0,label+' owners missing');
    const owners=state.instrument.owners;
    assert.equal(new Set(owners.map(o=>o.name)).size,owners.length,label+' duplicate owner names');
    for(const o of owners){
        assert.ok(typeof o.name==='string'&&o.name.length>0);finite(o.order,label+' order');finite(o.weight,label+' weight');assert.equal(typeof o.enabled,'boolean');
        assert.ok(statuses.has(o.status),label+' unknown/error owner status');
        assert.equal(o.status==='disabled',!o.enabled,label+' enabled/status contradiction');
        if(o.status==='returned-output'){
            assert.ok(o.raw&&o.effective,label+' returned owner lacks actual contribution');
            assert.deepEqual(o.raw,o.effective,label+' native output was filtered');
        }else{
            assert.equal(o.raw,null,label+' nonreturning owner has fabricated raw contribution');
            assert.equal(o.effective,null,label+' nonreturning owner has fabricated effective contribution');
        }
    }
    return owners;
}
function decision(state,owner,label,zeroSigns){
    assert.equal(owner.enabled,true,label+' gesture disabled');
    assert.ok(owner.status==='returned-output'||owner.status==='no-returned-output',label+' gesture status is not a native return decision');
    const g=state.gesture,p=state.sharedPosture;
    assert.ok(g&&p&&p.appliedDegrees&&p.appliedArmRadians,label+' native telemetry missing');
    assert.equal(typeof g.speaking,'boolean');finite(g.utteranceTime,label+' utterance time');assert.ok(g.utteranceTime>=0);
    assert.equal(g.yieldToPosture,true,label+' shared yield disabled');assert.equal(g.dominanceDrivesAmplitude,true,label+' live dominance disabled');
    assert.equal(g.sagittalShare,SAGITTAL_SHARE,label+' sagittal configuration changed');
    assert.equal(g.armSidesMeasured,true,label+' unmeasured arm sides');assert.deepEqual(g.armSides,{left:1,right:-1},label+' arm signs changed');
    finite(g.spatialExtent,label+' spatial extent');finite(g.temporalExtent,label+' temporal extent');
    number(g.strokeSeconds,strokeDurationFor(g.temporalExtent),label+'.strokeSeconds',zeroSigns);
    assert.deepEqual(state.affect.postureDegrees,p.appliedDegrees,label+' duplicate posture report differs');
    for(const [side,key]of [['leftUpperArm','armSpreadLeft'],['rightUpperArm','armSpreadRight']])
        number(p.appliedDegrees[key],finite(p.appliedArmRadians[side],label+'.'+side)/RAD,label+'.'+key,zeroSigns);
    assert.equal(p.centreOfPressureFrame,state.stackFrame,label+' stale native shared posture');
    const sample=state.instrument.samples?.gesture;assert.ok(sample,label+' gesture sample absent');
    assert.equal(sample.status,owner.status,label+' owner/sample status contradiction');assert.deepEqual(sample.suppressed,[],label+' gesture suppression is not native');
    if(owner.status==='returned-output'){
        assert.deepEqual(sample.raw,owner.raw,label+' gesture sample raw mismatch');assert.deepEqual(sample.effective,owner.effective,label+' gesture sample effective mismatch');
    }else{
        assert.ok(sample.raw===undefined||sample.raw===null,label+' fabricated absent raw sample');assert.ok(sample.effective===undefined||sample.effective===null,label+' fabricated absent effective sample');
    }
    let intervals=[];
    if(state.schedule!==null){
        assert.ok(state.schedule&&Array.isArray(state.schedule.gestures),label+' schedule missing');
        intervals=state.schedule.gestures;
        for(const q of intervals){
            for(const key of ['preparationStart','strokeStart','strokeEnd','endTime','strokeSeconds'])finite(q[key],label+'.schedule.'+key);
            assert.ok(q.preparationStart<q.strokeStart&&q.strokeStart<q.strokeEnd&&q.strokeEnd<q.endTime&&q.strokeSeconds>0,label+' invalid gesture interval');
            assert.ok(['left','right','both'].includes(q.hand),label+' invalid gesture hand');
        }
    }
    const active=intervals.filter(q=>g.utteranceTime>=q.preparationStart&&g.utteranceTime<q.endTime);
    assert.ok(active.length<=1,label+' overlapping active gestures');
    if(!g.speaking||state.schedule===null||active.length===0){
        assert.equal(owner.status,'no-returned-output',label+' returned without an active native interval');
        return {observedStatus:owner.status,predictedStatus:'no-returned-output',reason:!g.speaking?'not-speaking':state.schedule===null?'no-schedule':'no-active-interval',
            utteranceTime:g.utteranceTime,activeInterval:null,shoulderRadians:null,thresholdRadians:NATIVE_GESTURE_NEGLIGIBLE_RADIANS};
    }
    const q=active[0],envelope=gestureEnvelope(q,g.utteranceTime);
    const yielded=postureYield(finite(p.appliedDegrees.armSpreadLeft,label+' shared arm spread'));
    const dominance=finite(state.affect.pad.dominance,label+' live dominance'),extent=Math.min(1,Math.max(-1,dominance));
    // Fixed amplitude1 is actually admitted and pinned by the required native A guard source.
    // Native operation order is retained exactly, including this separate scale multiplication.
    const amplitude=1,scale=envelope.activation*yielded*amplitude*amplitudeFor(extent);
    const shoulderRadians=scale*BEAT_EXCURSION*SHOULDER_RAISE_FULL_DEGREES*RAD;
    const elbowRadians=scale*BEAT_EXCURSION*ELBOW_FOLLOW*ELBOW_RAISE_FULL_DEGREES*RAD;
    const predicted=Math.abs(shoulderRadians)<NATIVE_GESTURE_NEGLIGIBLE_RADIANS?'no-returned-output':'returned-output';
    for(const [key,value]of Object.entries({activation:envelope.activation,yield:yielded,spatialExtent:extent,shoulderDegrees:shoulderRadians/RAD,elbowDegrees:elbowRadians/RAD}))
        number(g.applied?.[key],value,label+'.applied.'+key,zeroSigns);
    number(g.appliedSpatialExtent,extent,label+'.appliedSpatialExtent',zeroSigns);
    assert.equal(g.applied.phase,envelope.phase,label+' envelope phase differs');assert.equal(g.applied.hand,q.hand,label+' active hand differs');
    assert.equal(owner.status,predicted,label+' false native gesture return status');
    return {observedStatus:owner.status,predictedStatus:predicted,reason:'exact-native-negligible-angle-rule',utteranceTime:g.utteranceTime,
        activeInterval:structuredClone(q),activation:envelope.activation,phase:envelope.phase,yield:yielded,extent,amplitude,scale,shoulderRadians,elbowRadians,
        observedShoulderDegrees:g.applied.shoulderDegrees,thresholdRadians:NATIVE_GESTURE_NEGLIGIBLE_RADIANS};
}

/** Read-only metadata/status admission. Raw/null contributions remain exactly as captured.
 * Source map must come from the caller's independently verified immutable capture manifest.
 */
export function compareCandidateOwnerStatus(actualState,expectedState,{step,sourceHashes}={}){
    assert.ok(Number.isInteger(step)&&step>=0,'Explicit nonnegative step required');
    for(const [file,expected]of Object.entries(GESTURE_STATUS_SOURCE_HASHES))assert.equal(sourceHashes?.[file],expected,'Source binding: '+file);
    const zeroSigns=[],a=ownerRecords(actualState,'actual'),b=ownerRecords(expectedState,'expected');
    assert.deepEqual(a.map(o=>o.name),b.map(o=>o.name),'Native owner sequence changed');
    assert.deepEqual(a.map(({name,order,weight,enabled})=>({name,order,weight,enabled})),b.map(({name,order,weight,enabled})=>({name,order,weight,enabled})),'Native owner metadata changed');
    for(const key of ['clock','stackTime','stackFrame'])number(actualState[key],expectedState[key],key,zeroSigns);
    assert.deepEqual(actualState.schedule,expectedState.schedule,'Native gesture schedule changed');
    number(actualState.gesture.utteranceTime,expectedState.gesture.utteranceTime,'gesture.utteranceTime',zeroSigns);
    for(const key of ['speaking','spatialExtent','temporalExtent','dominanceDrivesAmplitude','yieldToPosture','sagittalShare'])
        assert.equal(actualState.gesture[key],expectedState.gesture[key],'Native gesture configuration changed: '+key);
    let index=-1;
    for(let i=0;i<a.length;i++){
        assert.deepEqual(a[i].randomAfterFrame,b[i].randomAfterFrame,'Native owner PRNG changed: '+a[i].name);
        if(a[i].name==='gesture')index=i;else assert.equal(a[i].status,b[i].status,'Non-gesture owner status changed: '+a[i].name);
    }
    assert.ok(index>=0,'Native gesture owner missing');
    assert.equal(a[index].enabled,true,'Actual gesture disabled');assert.equal(b[index].enabled,true,'Expected gesture disabled');
    for(const [state,owner]of [[actualState,a[index]],[expectedState,b[index]]]) {
        assert.equal(state.instrument.samples?.gesture?.status,owner.status,'Gesture owner/sample status contradiction');
        assert.deepEqual(state.instrument.samples.gesture.suppressed,[],'Gesture suppression is not native');
    }
    assert.deepEqual(actualState.affect.pad,expectedState.affect.pad,'Live affect PAD changed');
    number(actualState.gesture.appliedSpatialExtent,expectedState.gesture.appliedSpatialExtent,'gesture.appliedSpatialExtent pair',zeroSigns);
    // Equal statuses retain the original admission rule. Post-frame affect telemetry can be newer
    // than Gesture's sampled extent, so a blanket recomputation on every frame would be invalid.
    if(a[index].status===b[index].status)return {step,changed:false,owner:'gesture',policy:'equal status retained; no exception used',
        actual:{observedStatus:a[index].status,formulaChecked:false},expected:{observedStatus:b[index].status,formulaChecked:false},
        zeroSigns,sourceHashes:{...GESTURE_STATUS_SOURCE_HASHES},observedContributionsPreserved:true};
    const actual=decision(actualState,a[index],'actual',zeroSigns),expected=decision(expectedState,b[index],'expected',zeroSigns),changed=actual.observedStatus!==expected.observedStatus;
    if(changed)assert.ok(actual.reason==='exact-native-negligible-angle-rule'&&expected.reason==='exact-native-negligible-angle-rule','Only a proved native threshold crossing permits different status');
    return {step,changed,owner:'gesture',policy:'exact-native-radian-return-rule; all other owner statuses exact',actual,expected,zeroSigns,
        sourceHashes:{...GESTURE_STATUS_SOURCE_HASHES},observedContributionsPreserved:true};
}
