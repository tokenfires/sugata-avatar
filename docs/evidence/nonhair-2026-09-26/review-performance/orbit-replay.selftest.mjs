import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PerspectiveCamera,Object3D} from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ORBIT_SOURCE_PIN,captureOrbitState,createOrbitReplay,assertOrbitEqual} from './orbit-replay.mjs';
const sha=createHash('sha256').update(fs.readFileSync(ORBIT_SOURCE_PIN.path)).digest('hex');assert.equal(sha,ORBIT_SOURCE_PIN.sha256);
const sourceHashes={[ORBIT_SOURCE_PIN.path]:sha};
function host(){
    const camera=new PerspectiveCamera(26,1.0375545851528385,.01,100),controls=new OrbitControls(camera,null);
    camera.position.set(.8367855943739249,.8415295548972083,3.936766702469393);
    camera.quaternion.set(-2.743401009116785e-17,.10452846326765344,2.883430650903047e-18,.9945218953682733);
    controls.target.set(0,.841529554897208,0);controls.enableDamping=true;controls.dampingFactor=.1;
    controls.enablePan=false;controls.minPolarAngle=Math.PI*.26;controls.maxPolarAngle=Math.PI*.70;
    controls.minDistance=2;controls.maxDistance=6;return controls;
}
const actual=host(),initial=captureOrbitState(actual),replay=createOrbitReplay(initial,{sourceHashes});
assert.equal(initial.config.maxAzimuthAngle,'Infinity');assert.equal(initial.config.minAzimuthAngle,'-Infinity');
const rows=[];for(let i=1;i<=20;i++){actual.update();const predicted=replay.step(),state=captureOrbitState(actual);assert.equal(predicted.step,i);assertOrbitEqual(state,predicted.state,'step'+i);rows.push(state);}
assert.notDeepEqual(rows.at(-1).camera.position,initial.camera.position,'Actual native idle update exhibits roundtrip drift in this explicit modeled case.');
assert.equal(replay.report().steps,20);
// One representable-bit scale mutation must not become an epsilon allowance.
const mutated=structuredClone(rows.at(-1));mutated.camera.position[0]+=Number.EPSILON;
assert.throws(()=>assertOrbitEqual(mutated,rows.at(-1)),/Exact native replay mismatch/);
const cache=structuredClone(rows.at(-1));cache.vectors._lastPosition[0]+=1e-6;
assert.throws(()=>assertOrbitEqual(cache,rows.at(-1)),/mismatch/);
assert.throws(()=>createOrbitReplay(initial,{sourceHashes:{}}),/Unbound/);
for(const [key,value] of [['autoRotate',true],['state',0],['_scale',.9],['zoomToCursor',true],['_performCursorZoom',true],['_controlActive',true]]){
    const c=host();c[key]=value;assert.throws(()=>captureOrbitState(c),/idle controls/);
}
for(const key of ['_sphericalDelta','_panOffset']){const c=host();if(key==='_sphericalDelta')c[key].theta=1e-9;else c[key].x=1e-9;assert.throws(()=>captureOrbitState(c),/idle controls/);}
const tinyPan=host();tinyPan._panOffset.x=Number.MIN_VALUE;assert.throws(()=>captureOrbitState(tinyPan),/idle controls/);
const parented=host();new Object3D().add(parented.object);assert.throws(()=>captureOrbitState(parented),/camera ownership/);
const wrapped=host();wrapped.update=(...args)=>OrbitControls.prototype.update.apply(wrapped,args);assert.throws(()=>captureOrbitState(wrapped),/unchanged native/);
const signed=host();signed.object.position.x=-0;const signedState=captureOrbitState(signed);assert.equal(signedState.camera.position[0],'-0');
assert.doesNotThrow(()=>createOrbitReplay(signedState,{sourceHashes}));
const stable=host(),seed=captureOrbitState(stable),guard=createOrbitReplay(seed,{sourceHashes});
stable.update();const expected=guard.step();stable.target.x=Number.EPSILON;
assert.throws(()=>assertOrbitEqual(captureOrbitState(stable),expected.state),/mismatch/);
console.log(JSON.stringify({groups:6,nativeSourceSHA256:sha,steps:20,persistentExactReplay:true,modeledNativeDrift:true,
    exactMutationAndCacheRejection:true,constructorRestoration:true,signedZeroAndInfinityPreserved:true,
    scope:'CPU native-class replay on explicit modeled target/control state. Retained smoke-v3 target was not recorded; no retrospective native causal proof or GPU run.'}));
