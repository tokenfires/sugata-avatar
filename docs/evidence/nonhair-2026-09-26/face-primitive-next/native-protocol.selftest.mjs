import assert from 'node:assert/strict';
import {Avatar} from '../../../../packages/core/src/Avatar.js';
import {AffectState} from '../../../../packages/core/src/affect/AffectState.js';import {ExpressionLayer} from '../../../../packages/core/src/affect/ExpressionLayer.js';
import {VisemeSchedule} from '../../../../packages/core/src/voice/VisemeSchedule.js';import {weightAt} from '../../../../packages/core/src/voice/Coarticulation.js';
import {PROTOCOL,TIMELINE,SPEECH_PLAN,SPEECH_PEAK_STEPS,FIXED_GEOMETRY_STEPS,afterSampleEvent} from './native-protocol.mjs';
const state=new AffectState(),expression=new ExpressionLayer({state}),a={affectState:state,expression,requireLive(){},feel:Avatar.prototype.feel,layers:{blink:{blinkNow(o){assert.deepEqual(o,{unilateral:false,closureAmplitude:1});return true;},closingDuration:.075,closedHold:0,openingDuration:.25}},say(text,options){assert.equal(text,'A prepared focused view.');assert.deepEqual(options,{timeline:TIMELINE,speechPlan:SPEECH_PLAN});return Promise.resolve({outcome:'finished'});}};
const observations=[];for(let step=0;step<=PROTOCOL.steps;step++){
 if(step){expression.contribution.clear();expression.update(PROTOCOL.dt);}
 if([175,295].includes(step))observations.push({step,pad:{...state.pad},morphs:{...expression.faceResult.morphs},mouth:{...expression.faceResult.mouthCornerOffset},triggers:[...expression.map.triggers]});
 afterSampleEvent(a,step);
}
assert.ok(observations[0].mouth.smile>0);assert.ok(observations[1].morphs.noseSneerLeft>0&&observations[1].morphs.noseSneerRight>0);assert.ok(!observations[1].triggers.some(([name])=>name==='joy'));
const schedule=new VisemeSchedule();schedule.speak(TIMELINE,{at:5});
for(const {viseme,step}of SPEECH_PEAK_STEPS){const entry=schedule.timeline.find(e=>e.viseme==='viseme_'+viseme);assert.ok(entry,'Expected normalized viseme');assert.equal(weightAt(entry,(step-1-PROTOCOL.events.speech)/60+schedule.leadSeconds),entry.peak);assert.ok(FIXED_GEOMETRY_STEPS.includes(step));}
assert.equal(PROTOCOL.steps,480);assert.ok(Math.max(...SPEECH_PEAK_STEPS.map(x=>x.step))<480);assert.equal(FIXED_GEOMETRY_STEPS.length,new Set(FIXED_GEOMETRY_STEPS).size);
console.log(JSON.stringify({passed:true,scope:'Native Avatar.feel method and ExpressionLayer schedule only; no native renderer or complete Avatar instance.',observations,speechPeakSteps:SPEECH_PEAK_STEPS,geometrySteps:FIXED_GEOMETRY_STEPS},null,2));
