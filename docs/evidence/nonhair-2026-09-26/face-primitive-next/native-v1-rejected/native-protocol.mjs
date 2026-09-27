import {envelopeKeys} from '../../../../packages/core/src/voice/Coarticulation.js';
import {DEFAULT_LEAD_SECONDS} from '../../../../packages/core/src/voice/VisemeSchedule.js';
export const PROTOCOL=Object.freeze({steps:480,dt:1/60,baseFrame:1000000,settleDraws:64,viewport:{width:1100,height:1000},seed:20260807,
 arms:['pristine','zero','decrease','increase'],events:{blink:0,joy:60,sneer:180,speech:300},expressionPlates:{joy:175,sneer:295},neutralViews:[0,45,90],peakView:0});
export const TIMELINE=Object.freeze([{viseme:'aa',startTime:.55,duration:.18},{viseme:'PP',startTime:1.15,duration:.18},{viseme:'FF',startTime:1.75,duration:.18},{viseme:'U',startTime:2.35,duration:.18}].map(Object.freeze));
export const SPEECH_PLAN=Object.freeze({synthetic:true,durationSeconds:2.8,words:[{text:'A',startTime:.55,endTime:.73,stressed:false},{text:'prepared',startTime:1.15,endTime:1.33,stressed:true},{text:'focused',startTime:1.75,endTime:1.93,stressed:false},{text:'view',startTime:2.35,endTime:2.53,stressed:false}]});
// Avatar samples VisemeSchedule before incrementing its clock. This +1 is essential.
export const SPEECH_PEAK_STEPS=Object.freeze(TIMELINE.map(e=>({viseme:e.viseme,step:PROTOCOL.events.speech+Math.ceil((envelopeKeys(e).peak-DEFAULT_LEAD_SECONDS)*60)+1})));
export const FIXED_GEOMETRY_STEPS=Object.freeze([...new Set([0,1,30,60,61,90,120,175,179,180,181,210,240,270,295,299,300,301,480,
 ...SPEECH_PEAK_STEPS.flatMap(({step})=>[step-1,step,step+1])])].sort((a,b)=>a-b));
export function afterSampleEvent(a,step){
 if(step===0){if(a.layers.blink.blinkNow({unilateral:false,closureAmplitude:1})!==true)throw Error('Initial scripted full blink did not start');return {event:'blink',closingDuration:a.layers.blink.closingDuration,closedHold:a.layers.blink.closedHold,openingDuration:a.layers.blink.openingDuration};}
 if(step===60){a.feel('joy');return {event:'joy'};}
 if(step===180){a.expression.map.clearTriggers();a.feel('disliking');return {event:'disliking',priorTriggersCleared:true};}
 if(step===300){return {event:'speech',promise:a.say('A prepared focused view.',{timeline:TIMELINE,speechPlan:SPEECH_PLAN})};}
 return null;
}
