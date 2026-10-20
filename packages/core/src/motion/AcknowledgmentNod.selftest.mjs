import assert from 'node:assert/strict';
import { Bone, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { MotionStack } from './MotionStack.js';
import { Layer } from './Layer.js';
import { IdleMotion } from './IdleMotion.js';
import { Gaze } from './Gaze.js';
import { AttentionAction } from './AttentionAction.js';
import { AcknowledgmentNod, nodPitch } from './AcknowledgmentNod.js';
const started = performance.now(); let passed = 0;
function test(name, fn) { fn(); console.log(JSON.stringify({case: ++passed, name, passed: true})); }
function fixture({turned = false} = {}) {
    const world = new Object3D(), rig = new Object3D(), spine = new Bone(), neck = new Bone(), head = new Bone();
    spine.name = 'spine_01'; neck.name = 'neck_01'; head.name = 'head';
    world.add(rig); rig.add(spine); spine.add(neck); neck.add(head);
    neck.position.y = 1.4; head.position.y = .2;
    if (turned) { rig.rotation.y = .8; spine.rotation.z = .12; head.rotation.set(1.1, -.18, .24); }
    const idle = new IdleMotion({armsEnabled:true});
    for (const name of Object.values(idle.bones)) if (!rig.getObjectByName(name)) {
        const b = new Bone(); b.name = name; rig.add(b);
    }
    const gaze = new Gaze({policy:true, blinkCoupling:false, rigRoot:rig});
    const stack = new MotionStack({seed:1});
    stack.add(new Layer({name:'base',boneChannels:['spine_01']})); stack.add(idle); stack.add(gaze.head); stack.add(gaze);
    const target = {hasMorph:()=>true,setMorph(){},getBone:n=>rig.getObjectByName(n)??null};
    world.updateMatrixWorld(true); stack.bind(target);
    const camera = new PerspectiveCamera(); camera.position.set(.1,1.6,2); world.add(camera);
    const avatar = {stack,layers:{gaze,idle}};
    return {world,rig,spine,head,idle,gaze,stack,target,camera,avatar};
}
function tick(f, n, dt = .01) { for (let i=0;i<n;i++) { f.stack.update(dt); f.world.updateMatrixWorld(true); } }
function close(f) { f.stack.dispose(); }
test('authored temporal landmarks, return and finite inputs',()=>{
    assert.equal(nodPitch(0),0); assert.equal(nodPitch(.32),12); assert.equal(nodPitch(.78),-1.5);
    assert.equal(nodPitch(1.15),0); assert.equal(nodPitch(10),0);
    for (const x of [NaN,Infinity,-.1]) assert.throws(()=>nodPitch(x));
});
test('normal complete action releases after a full trajectory',()=>{
    const f=fixture(), n=new AcknowledgmentNod(f.avatar); assert.equal(n.nod(),true);
    tick(f,32); assert.ok(Math.abs(n.pitchDegrees-12)<1e-9); assert.equal(n.phase,'nodding');
    tick(f,46); assert.ok(Math.abs(n.pitchDegrees+1.5)<1e-9);
    tick(f,38); assert.equal(n.phase,'idle'); assert.equal(n.pitchDegrees,0); assert.equal(n.lastStop,'finished');
    assert.equal(f.gaze.policyEnabled,true); assert.equal(f.idle.headScales.size,0); close(f);
});
test('sagittal sign and rest-frame conjugation on a turned nonidentity head',()=>{
    const f=fixture({turned:true}), n=new AcknowledgmentNod(f.avatar), rest=f.gaze.head.boneAxes.get('head').rest.clone();
    n.nod(); tick(f,32);
    const rigDelta=rest.clone().multiply(n.contribution.boneRotations.get('head')).multiply(rest.clone().invert());
    const forward=new Vector3(0,0,1).applyQuaternion(rigDelta);
    assert.ok(forward.y<-.20 && Math.abs(forward.x)<1e-9,JSON.stringify(forward));
    assert.ok(rigDelta.angleTo(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/15))<1e-7); close(f);
});
test('head contribution composes after real gaze; limbs and idle streams stay unchanged',()=>{
    const a=fixture(),b=fixture(),n=new AcknowledgmentNod(b.avatar);n.nod();
    for(let i=0;i<140;i++) {
        tick(a,1);tick(b,1);
        const expected=a.head.quaternion.clone().multiply(n.contribution.boneRotations.get('head'));
        assert.ok(expected.angleTo(b.head.quaternion)<1e-7);
        for(const name of Object.values(a.idle.bones)) if(name!=='head')
            assert.deepEqual(a.target.getBone(name).quaternion.toArray(),b.target.getBone(name).quaternion.toArray());
    }
    assert.equal(b.stack.posePredictionSupport(b.head,b.gaze),null);close(a);close(b);
});
test('busy repeat preserves current state rather than starting another stroke',()=>{
    const f=fixture(),n=new AcknowledgmentNod(f.avatar);n.nod();tick(f,20);const before=n.report();
    assert.equal(n.nod(),false);assert.deepEqual(n.report(),before);close(f);
});
test('cancellation fades the current pitch and permits a later fresh invocation',()=>{
    const f=fixture(),n=new AcknowledgmentNod(f.avatar);n.nod();tick(f,32);n.cancel();
    tick(f,9);assert.ok(n.pitchDegrees>0&&n.pitchDegrees<12);assert.equal(n.nod(),false);
    tick(f,10);assert.equal(n.phase,'idle');assert.equal(n.pitchDegrees,0);assert.equal(n.nod(),true);close(f);
});
test('immediate cancel removes only its delta on the next real stack commit',()=>{
    const a=fixture(),b=fixture(),n=new AcknowledgmentNod(b.avatar);n.nod();tick(a,25);tick(b,25);
    n.cancel({immediate:true});tick(a,1);tick(b,1);assert.ok(a.head.quaternion.angleTo(b.head.quaternion)<1e-7);close(a);close(b);
});
test('existing attention hold and independent idle multiplier survive nod and cancel',()=>{
    const f=fixture(),attention=new AttentionAction(f.avatar),n=new AcknowledgmentNod(f.avatar);
    attention.lookAtCamera(f.camera);const hold=attention.gazeHold,scale=f.idle.acquireHeadScale();scale.set(.7);
    n.nod();tick(f,35);n.cancel();tick(f,20);
    assert.equal(attention.gazeHold,hold);assert.equal(hold.active,true);assert.equal(scale.active,true);
    assert.equal(f.gaze.policyEnabled,false);attention.dispose();scale.release();close(f);
});
test('a newer host gaze command retains its ownership through nod completion',()=>{
    const f=fixture(),n=new AcknowledgmentNod(f.avatar);n.nod();tick(f,20);
    f.gaze.setPartnerDirection({yawDegrees:-8,pitchDegrees:1});f.gaze.setPolicyEnabled(false);
    tick(f,100);assert.equal(f.gaze.policyEnabled,false);assert.equal(n.phase,'idle');close(f);
});
test('disable retires its state; reenabling cannot resume a hidden old stroke',()=>{
    const f=fixture(),n=new AcknowledgmentNod(f.avatar);n.nod();tick(f,20);n.enabled=false;tick(f,1);
    assert.equal(n.phase,'idle');assert.equal(n.lastStop,'disabled');n.enabled=true;tick(f,1);assert.equal(n.pitchDegrees,0);close(f);
});
test('dispose/remove while active preserves the other owners and leaves no nod layer',()=>{
    const a=fixture(),b=fixture(),n=new AcknowledgmentNod(b.avatar);n.nod();tick(a,25);tick(b,25);n.dispose();n.dispose();
    assert.equal(b.stack.findLayer('acknowledgmentNod'),null);tick(a,1);tick(b,1);
    assert.ok(a.head.quaternion.angleTo(b.head.quaternion)<1e-7);assert.equal(b.stack.layers.length,a.stack.layers.length);close(a);close(b);
});
test('reset and target rebind invalidate the active action',()=>{
    for(const op of ['reset','bind']) {
        const f=fixture(),n=new AcknowledgmentNod(f.avatar);n.nod();tick(f,20);
        if(op==='reset')f.stack.reset();else f.stack.bind(f.target);
        assert.equal(n.phase,'idle');assert.equal(n.boundHead,null);tick(f,1);assert.equal(n.pitchDegrees,0);close(f);
    }
});
test('loss of gaze owner retires without acquiring or restoring a policy lease',()=>{
    const f=fixture(),n=new AcknowledgmentNod(f.avatar);n.nod();tick(f,20);f.gaze.enabled=false;tick(f,1);
    assert.equal(n.phase,'idle');assert.equal(n.lastStop,'owner-unavailable');assert.equal(f.gaze.enabled,false);close(f);
});
test('invalid frame data refuses start, duplicate installation preserves original owner',()=>{
    const f=fixture(),n=new AcknowledgmentNod(f.avatar);assert.throws(()=>new AcknowledgmentNod(f.avatar));
    assert.equal(f.stack.findLayer('acknowledgmentNod'),n);const rest=f.gaze.head.boneAxes.get('head').rest;rest.x=NaN;
    assert.throws(()=>n.nod());assert.equal(n.phase,'idle');close(f);
});
const elapsedMs=performance.now()-started;assert.ok(elapsedMs<10000);assert.equal(passed,14);
console.log(JSON.stringify({passed,elapsedMs,scope:'real MotionStack/Gaze/Idle/Attention owners on synthetic Object3D rigs; no native appearance or physical rig claim'}));
