// Detached native replay. Never changes the live controls/camera or calls an extra live update.
import {PerspectiveCamera} from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export const ORBIT_SOURCE_PIN=Object.freeze({path:'node_modules/three/examples/jsm/controls/OrbitControls.js',sha256:'faabb4e8dfd9235ee4a9fd7c9a3d75f90f1689dbd4944bd6fd32117dacec5f93'});
const nativeUpdate=OrbitControls.prototype.update;
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const encode=n=>{requireThat(typeof n==='number' && !Number.isNaN(n),'Invalid numeric state.');return Object.is(n,-0)?'-0':n===Infinity?'Infinity':n===-Infinity?'-Infinity':n;};
const decode=n=>n==='-0'?-0:n==='Infinity'?Infinity:n==='-Infinity'?-Infinity:n;
const numbers=a=>a.map(encode);
const CONFIG=['enabled','state','autoRotate','autoRotateSpeed','enableDamping','dampingFactor','enablePan','enableZoom',
    'minAzimuthAngle','maxAzimuthAngle','minPolarAngle','maxPolarAngle','minDistance','maxDistance','minTargetRadius','maxTargetRadius',
    'zoomToCursor','screenSpacePanning','minZoom','maxZoom','_scale','_performCursorZoom','_controlActive'];
const VECTORS=['target','cursor','_quat','_quatInverse','_panOffset','_lastPosition','_lastQuaternion','_lastTargetPosition','_dollyDirection','_mouse'];
const SPHERICAL=['_spherical','_sphericalDelta'];
const CAMERA=['fov','aspect','near','far','zoom','focus','filmGauge','filmOffset'];

export function captureOrbitState(controls) {
    const camera=controls.object;
    requireThat(controls instanceof OrbitControls && controls.update===nativeUpdate,'Require unchanged native OrbitControls.update.');
    requireThat(camera.isPerspectiveCamera===true && camera.parent===null && camera.matrixAutoUpdate===true && camera.matrixWorldAutoUpdate===true,'Unsupported camera ownership.');
    requireThat(controls.enabled===true && controls.state===-1 && controls.autoRotate===false && controls.zoomToCursor===false &&
        controls._controlActive===false && controls._performCursorZoom===false && controls._scale===1 &&
        controls._pointers.length===0 && Object.keys(controls._pointerPositions).length===0 &&
        controls._sphericalDelta.theta===0 && controls._sphericalDelta.phi===0 && controls._panOffset.toArray().every(n=>n===0),'Replay requires idle controls without input, inertia, auto-rotation or cursor zoom.');
    return {camera:{position:numbers(camera.position.toArray()),quaternion:numbers(camera.quaternion.toArray()),up:numbers(camera.up.toArray()),scale:numbers(camera.scale.toArray()),
        rotationOrder:camera.rotation.order,projection:Object.fromEntries(CAMERA.map(k=>[k,encode(camera[k])]))},
        config:Object.fromEntries(CONFIG.map(k=>[k,typeof controls[k]==='number'?encode(controls[k]):controls[k]])),
        vectors:Object.fromEntries(VECTORS.map(k=>[k,numbers(controls[k].toArray())])),
        spherical:Object.fromEntries(SPHERICAL.map(k=>[k,numbers([controls[k].radius,controls[k].phi,controls[k].theta])]))};
}

export function assertOrbitEqual(actual,expected,label='orbit') {
    requireThat(JSON.stringify(actual)===JSON.stringify(expected),'Exact native replay mismatch: '+label);
}

export function createOrbitReplay(initial,{sourceHashes}) {
    requireThat(sourceHashes?.[ORBIT_SOURCE_PIN.path]===ORBIT_SOURCE_PIN.sha256,'Unbound native OrbitControls source.');
    const camera=new PerspectiveCamera(),controls=new OrbitControls(camera,null);
    // Constructor performs one detached update. Restore all captured initial state after it;
    // no constructor update or copy is applied to the real camera.
    for(const key of CAMERA)camera[key]=decode(initial.camera.projection[key]);
    camera.rotation.order=initial.camera.rotationOrder;
    for(const key of ['position','quaternion','up','scale'])camera[key].fromArray(initial.camera[key].map(decode));
    for(const key of CONFIG)controls[key]=typeof initial.config[key]==='string'?decode(initial.config[key]):initial.config[key];
    for(const key of VECTORS)controls[key].fromArray(initial.vectors[key].map(decode));
    for(const key of SPHERICAL)controls[key].set(...initial.spherical[key].map(decode));
    camera.updateProjectionMatrix();
    assertOrbitEqual(captureOrbitState(controls),initial,'constructor restoration');
    let steps=0;
    return {step(){
        // Native showcase.step invokes controls.update() with NO delta argument.
        // Keep the same persistent detached state; never reseed from observed results.
        controls.update();steps++;return {step:steps,state:captureOrbitState(controls)};
    },report(){return {steps,source:ORBIT_SOURCE_PIN,scope:'Exact detached native no-input replay; projection jitter matrices and rendering are outside this control-only model.'};}};
}
