// CPU construction-host mechanics with native classes and exact g050 bone transforms.
// This host is not Avatar.create, native wardrobe loading, GPU rendering or candidate qualification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Bone, Object3D} from 'file:///Users/robault/GitHub/sugata-avatar/node_modules/three/build/three.module.js';
import {RestPose} from 'file:///Users/robault/GitHub/sugata-avatar/packages/core/src/figure/RestPose.js';
import {Skeleton} from 'file:///Users/robault/GitHub/sugata-avatar/packages/core/src/figure/Skeleton.js';
import {Sway} from 'file:///Users/robault/GitHub/sugata-avatar/packages/core/src/motion/Sway.js';
import {MotionStack, createMotionTarget} from 'file:///Users/robault/GitHub/sugata-avatar/packages/core/src/motion/MotionStack.js';
import {ExpressionLayer} from 'file:///Users/robault/GitHub/sugata-avatar/packages/core/src/affect/ExpressionLayer.js';
import {PostureLayer} from 'file:///Users/robault/GitHub/sugata-avatar/packages/core/src/affect/PostureLayer.js';
import {GestureLayer} from 'file:///Users/robault/GitHub/sugata-avatar/packages/core/src/motion/Gesture.js';
import {readGlb} from 'file:///Users/robault/GitHub/sugata-avatar/tools/lut-bake/glb.mjs';
import {withAcceptedPoseControl, POSE_HASHES, REQUIRED_SOURCE_HASHES} from 'file:///Users/robault/GitHub/sugata-avatar/docs/evidence/nonhair-2026-09-26/hand-candidate/AcceptedPoseControl.mjs';

const ROOT = '/Users/robault/GitHub/sugata-avatar/';
const sourceHashes = Object.fromEntries(Object.keys(REQUIRED_SOURCE_HASHES).map(p => [p, createHash('sha256').update(fs.readFileSync(ROOT + p)).digest('hex')]));
assert.deepEqual(sourceHashes, REQUIRED_SOURCE_HASHES);
const poseFiles = Object.fromEntries(Object.keys(POSE_HASHES).map(name => [name, fs.readFileSync(ROOT + `packages/core/src/figure/poses/${name}.json`, 'utf8')]));
const originalLoad = Object.getOwnPropertyDescriptor(RestPose, 'load'), originalBudget = Object.getOwnPropertyDescriptor(PostureLayer.prototype, 'bindArmBudget');
const restored = () => { assert.deepEqual(Object.getOwnPropertyDescriptor(RestPose, 'load'), originalLoad); assert.deepEqual(Object.getOwnPropertyDescriptor(PostureLayer.prototype, 'bindArmBudget'), originalBudget); };
const json = readGlb(ROOT + 'assets/figures/figure_g050.glb').json;
const compiled = p => ({name: p.name, hipsOffset: p.hipsOffset.toArray(), rotations: [...p.rotations].map(([name, q]) => [name, q.toArray()])});
const nativeCompiled = Object.fromEntries(Object.keys(POSE_HASHES).map(name => [name, compiled(RestPose.load(name))]));
function host({secondBind = false, initialSteps = 1} = {}) {
    const trace = {bind: 0, reset: 0, update: 0, dress: [], foundation: [], preparation: 0, disposal: 0};
    const sway = new Sway(), restPose = RestPose.load('relaxed-standing');
    const joints = new Set(json.skins.flatMap(s => s.joints));
    const nodes = json.nodes.map((data, i) => {
        const n = joints.has(i) ? new Bone() : new Object3D(); n.name = data.name ?? '';
        if (data.matrix) { n.matrix.fromArray(data.matrix); n.matrix.decompose(n.position, n.quaternion, n.scale); }
        else { if (data.translation) n.position.fromArray(data.translation); if (data.rotation) n.quaternion.fromArray(data.rotation); if (data.scale) n.scale.fromArray(data.scale); }
        return n;
    });
    json.nodes.forEach((data, i) => (data.children ?? []).forEach(c => nodes[i].add(nodes[c])));
    const root = new Object3D(); for (const i of json.scenes[json.scene ?? 0].nodes) root.add(nodes[i]); root.updateMatrixWorld(true);
    const skeleton = new Skeleton(root); restPose.applyTo(skeleton); skeleton.update(); root.updateMatrixWorld(true);
    const target = createMotionTarget(root), stack = new MotionStack({seed: 20260807});
    for (const name of ['bind', 'reset']) { const native = stack[name]; stack[name] = function(...args) { trace[name]++; return native.apply(this, args); }; }
    stack.bind(target);
    const expression = new ExpressionLayer(), posture = expression.postureLayer(), gesture = new GestureLayer();
    for (const layer of [sway, expression, posture, gesture]) stack.add(layer);
    stack.context.shared.posture = posture; stack.context.shared.affect = expression.state;
    if (secondBind) stack.bind(target); // Deliberate factory-owned lifecycle; the interposer adds none.
    const avatar = {seed: 20260807, poseName: 'relaxed-standing', autoStart: false, clockSeconds: 0, disposed: false,
        figure: {root}, layers: {sway}, restPose, stack, target, posture, gesture,
        wardrobeAssets: {foundation: {prefer(...args) { trace.foundation.push(args); }}}, wardrobe: {wornMeshes: new Map()},
        async dress(ids) { trace.dress.push([...ids]); this.wardrobe.wornMeshes = new Map(['female_casualsuit01', 'foundation_bra', 'foundation_briefs', 'shoes01'].map(id => [id, {}])); this.stack.markChannelsDirty(); },
        update(dt) { trace.update++; stack.update(dt); },
        dispose() { trace.disposal++; this.stack.dispose(); this.disposed = true; this.figure = this.target = this.stack = this.posture = this.gesture = null; }
    };
    avatar.cpuTrace = trace;
    for (let i = 0; i < initialSteps; i++) avatar.update(0); // Models only the native motion part of Showcase.step(0), with no rendering.
    return {avatar, stack, posture, sway, root, trace};
}
const prepareChannels = a => {
    restored(); a.cpuTrace.preparation++;
    const s = a.stack, before = {clock: a.clockSeconds, frame: s.frame, time: s.time,
        bones: [...s.boneChannels].map(([name, c]) => [name, c.restQuaternion.toArray(), c.restPosition.toArray(), c.bone?.quaternion.toArray(), c.bone?.position.toArray()])};
    const identities = [...s.boneChannels]; const dirty = s.channelsDirty;
    if (dirty) s.rebuildChannels();
    assert.deepEqual({clock: a.clockSeconds, frame: s.frame, time: s.time,
        bones: [...s.boneChannels].map(([name, c]) => [name, c.restQuaternion.toArray(), c.restPosition.toArray(), c.bone?.quaternion.toArray(), c.bone?.position.toArray()])}, before);
    for (const [name, channel] of identities) assert.equal(s.boneChannels.get(name), channel);
    return {scope: 'Modeled host CPU callback; native capture uses independently source-bound full preparation proof', preservedState: true, preservedExistingIdentities: true, calls: dirty ? 1 : 0, beforeDirty: dirty, afterDirty: s.channelsDirty};
};
const options = (construct, run = () => undefined, extra = {}) => ({poseFiles, sourceHashes, budget: 'passthrough', construct, prepareChannels, run, ...extra});


let f;
const outcome = await withAcceptedPoseControl(options(() => { f=host(); const native=f.avatar.dispose; f.avatar.dispose=function(){native.call(this);throw Error('native cleanup error after retirement');};return f.avatar; }, a => { try { a.dispose(); } catch(error){console.log('caught disposal',error.message);} }));
console.log(JSON.stringify({completed:outcome.receipt.completed,disposed:outcome.receipt.disposed,retirementFailure:outcome.receipt.retirement.failure,cleanupLost:outcome.receipt.retirement.cleanup.lost,disposalCount:f.trace.disposal}));
