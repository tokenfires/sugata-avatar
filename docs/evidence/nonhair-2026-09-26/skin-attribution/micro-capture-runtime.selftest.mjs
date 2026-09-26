// CPU ownership/clock-policy controls using an observable native-shaped fixture, not GPU proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createMicroCapture,MICRO_CAPTURE,assertExposureOwners} from './micro-capture-runtime.mjs';
const uniform=value=>({isUniformNode:true,value});
function fixture(){
 const epoch={jitterIndex:6,jitterPeriod:31,historyWidth:800};
 const n={frameId:37,time:8,deltaTime:.1,update(){this.frameId++;}};
 const skin={normalNode:{},map:{},roughnessNode:{},colorNode:{},skinUniforms:{microNormalScale:uniform(.25),microNormalRepeat:uniform(48),untouched:uniform([.1,.2,.3])}};
 const renderer={_nodes:{nodeFrame:n},_animation:{stop(){this.stopped=true;},getAnimationLoop(){return null;}},info:{frame:37},toneMappingExposure:1,backend:{device:{queue:{onSubmittedWorkDone:async()=>{}}}}};
 const stage={renderer,canvas:{width:700},viewMode:'beauty',multisampled:false,grade:{exposure:uniform(1),grainFrame:uniform(37),toneCurveName:'aces',sharpness:null,rebuiltGrainDefect:null},temporal:{mode:'taau',frameEpoch:()=>({...epoch}),resetFrameEpoch(){epoch.jitterIndex=0;epoch.historyWidth=1;}},draw(){epoch.jitterIndex=(epoch.jitterIndex+1)%31;epoch.historyWidth=700;this.grade.grainFrame.value=n.frameId%4096;}};
 const avatar={disposed:false,autoStart:false,clockSeconds:0,stage,skin,lights:{exposure:2.04},figure:{body:{material:skin}}};
 const showcase={avatar,async step(dt){assert.equal(dt,0);stage.draw();}};
 return {showcase,avatar,stage,skin,n,renderer,epoch};
}
globalThis.requestAnimationFrame=fn=>queueMicrotask(()=>fn(0));
const cases=[];async function run(name,fn){await fn();cases.push({name,passed:true});}
await run('Fresh A keeps all material values and performs exactly64+1 indexed draws',async()=>{const f=fixture(),original=f.stage.draw,probe=createMicroCapture(f.showcase,{microNormalScale:.25});const result=await probe.settle();assert.equal(result.trace.length,64);assert.equal(result.clock.frameId,1000064);assert.equal(result.clock.time,0);assert.equal(result.clock.grainFrame,1000064%4096);probe.prepareExport();f.stage.draw();const done=probe.releaseForRetirement();assert.equal(done.draws,65);assert.equal(f.stage.draw,original);assert.equal(f.skin.skinUniforms.microNormalScale.value,.25);assert.throws(()=>probe.receipt());});
await run('B changes only its actual existing scale uniform and restores it for immediate retirement',async()=>{const f=fixture(),normal=f.skin.normalNode,untouched=f.skin.skinUniforms.untouched,probe=createMicroCapture(f.showcase,{microNormalScale:0});assert.equal(f.skin.skinUniforms.microNormalScale.value,0);assert.equal(f.skin.normalNode,normal);assert.equal(f.skin.skinUniforms.untouched,untouched);await probe.settle();probe.releaseForRetirement();assert.equal(f.skin.skinUniforms.microNormalScale.value,.25);});
await run('Foreign uniform, body material or clock mutations refuse further capture',async()=>{for(const mutate of [f=>f.skin.skinUniforms.untouched.value[0]=.2,f=>f.avatar.figure.body.material={},f=>f.avatar.clockSeconds=.01]){const f=fixture(),probe=createMicroCapture(f.showcase,{microNormalScale:0});mutate(f);assert.throws(()=>probe.receipt());probe.releaseForRetirement();}});
await run('Unindexed draw, external renderer tick and incomplete export refuse',async()=>{const f=fixture(),probe=createMicroCapture(f.showcase,{microNormalScale:.25});assert.throws(()=>f.stage.draw());assert.throws(()=>probe.prepareExport());f.n.frameId++;await assert.rejects(()=>probe.settle());probe.releaseForRetirement();});
await run('Foreign draw owner is never overwritten during cleanup',()=>{const f=fixture(),probe=createMicroCapture(f.showcase,{microNormalScale:.25}),foreign=()=>{};f.stage.draw=foreign;assert.throws(()=>probe.releaseForRetirement());assert.equal(f.stage.draw,foreign);});
await run('Invalid default and failed temporal reset restore the study scale without replacing draw',()=>{for(const failure of ['default','reset']){const f=fixture(),original=f.stage.draw;if(failure==='default')f.skin.skinUniforms.microNormalScale.value=.2;else f.stage.temporal.resetFrameEpoch=()=>{};assert.throws(()=>createMicroCapture(f.showcase,{microNormalScale:0}));assert.equal(f.stage.draw,original);assert.equal(f.skin.skinUniforms.microNormalScale.value,failure==='default'?.2:.25);}});
await run('Exact rejected native exposure fixture distinguishes renderer1, grade1 and reported LightingRig2.04',()=>{
 const fixture=JSON.parse(fs.readFileSync(fileURLToPath(new URL('./rejected-native-v1/exposure-owner-fixture.json',import.meta.url))));
 assert.equal(fixture.draws,64);
 const values={rendererToneMappingExposure:fixture.uniforms.exposure,gradeExposure:fixture.uniforms.grade.exposure,sceneLightingExposure:fixture.nativeScene.lighting.exposure};
 assert.deepEqual(assertExposureOwners(values),{...values,scope:'Distinct native owners: renderer tone-mapping gain, grade tone-curve uniform, and LightingRig irradiance multiplier.'});
 for(const swapped of [{...values,rendererToneMappingExposure:2.04},{...values,gradeExposure:2.04},{...values,sceneLightingExposure:1}])assert.throws(()=>assertExposureOwners(swapped));
});
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const result={scope:'CPU native-shaped ownership/clock admission controls only; actual render/reset/PNG proof remains required.',sources:{fixture:hash(fileURLToPath(new URL('./rejected-native-v1/exposure-owner-fixture.json',import.meta.url))),runtime:hash(fileURLToPath(new URL('./micro-capture-runtime.mjs',import.meta.url))),test:hash(fileURLToPath(import.meta.url))},cases};
const text=JSON.stringify(result,null,2)+'\n';if(process.argv[2])fs.writeFileSync(process.argv[2],text,{flag:'wx'});console.log(text);
