// CPU construction-host mechanics with native classes and exact g050 bone transforms.
// This host is not Avatar.create, native wardrobe loading, GPU rendering or candidate qualification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Bone, Object3D} from 'three';
import {RestPose} from '../../../../packages/core/src/figure/RestPose.js';
import {Skeleton} from '../../../../packages/core/src/figure/Skeleton.js';
import {Sway} from '../../../../packages/core/src/motion/Sway.js';
import {MotionStack, createMotionTarget} from '../../../../packages/core/src/motion/MotionStack.js';
import {ExpressionLayer} from '../../../../packages/core/src/affect/ExpressionLayer.js';
import {PostureLayer} from '../../../../packages/core/src/affect/PostureLayer.js';
import {GestureLayer} from '../../../../packages/core/src/motion/Gesture.js';
import {readGlb} from '../../../../tools/lut-bake/glb.mjs';
import {withAcceptedPoseControl, POSE_HASHES, REQUIRED_SOURCE_HASHES} from './AcceptedPoseControl.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
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
const results = [];
async function test(name, fn) { await fn(); restored(); results.push(name); console.log('PASS ' + name); }

await test('accepted family compiles exactly; expected consumers; native budgets unchanged; descriptors restored before guarded use', async () => {
    let f;
    const {receipt} = await withAcceptedPoseControl(options(() => (f = host()).avatar, (a, r, instrument) => {
        restored(); assert.deepEqual(r.poseCalls.map(p => p.name), ['relaxed-standing', 'weight-left', 'weight-right', 'relaxed-standing']);
        for (const p of r.poseCalls) assert.deepEqual(p.compiled, nativeCompiled[p.name]);
        assert.notEqual(a.restPose, a.layers.sway.relaxedPose);
        for (const call of r.budgetCalls) assert.deepEqual(call.effective, call.native);
        assert.deepEqual(r.budgetCalls.at(-1).native, a.posture.maxAdductionRadians);
        assert.equal(r.guard.status, 'active'); assert.equal(a.stack.frame, 1); assert.equal(a.clockSeconds, 0);
        assert.equal(Object.isFrozen(instrument), true); assert.deepEqual(Object.keys(instrument), ['report']);
        const snapshot = instrument.report(); snapshot.status = 'changed-copy'; assert.equal(instrument.report().status, 'active');
    }));
    assert.equal(receipt.completed, true); assert.equal(receipt.disposed, true); assert.deepEqual(receipt.cleanup.lost, []);
    assert.deepEqual(f.trace, {bind: 1, reset: 0, update: 1, dress: [['female_casualsuit01', 'shoes01']], foundation: [['TORSO', 'foundation_bra']], preparation: 1, disposal: 1});
    assert.equal(receipt.initialization.constructReady.stackFrame, 1); assert.equal(receipt.initialization.afterDress.stackFrame, 1); assert.equal(receipt.initialization.afterChannelPreparation.stackFrame, 1);
});
await test('missing/wrong family bytes, source pins and candidate cap rejected before construction', async () => {
    let calls = 0; const never = () => { calls++; };
    await assert.rejects(withAcceptedPoseControl(options(never, undefined, {poseFiles: {'relaxed-standing': poseFiles['relaxed-standing']}})), /three-pose/);
    await assert.rejects(withAcceptedPoseControl(options(never, undefined, {poseFiles: {...poseFiles, 'weight-left': poseFiles['weight-left'] + ' '}})), /UTF-8/);
    await assert.rejects(withAcceptedPoseControl(options(never, undefined, {sourceHashes: {...sourceHashes, 'packages/core/src/Avatar.js': 'wrong'}})), /pin mismatch/);
    await assert.rejects(withAcceptedPoseControl(options(never, undefined, {budget: {left: .1, right: .1}})), /passthrough/);
    await assert.rejects(withAcceptedPoseControl({...options(never), cap: .1}), /Unexpected/); assert.equal(calls, 0);
});
await test('unknown/missing pose consumers and wrong posture owner reject and retire returned hosts', async () => {
    await assert.rejects(withAcceptedPoseControl(options(() => RestPose.load('not-a-pose'))), /Unexpected pose/);
    let f;
    await assert.rejects(withAcceptedPoseControl(options(() => { f = host(); f.avatar.restPose = new RestPose(JSON.parse(poseFiles['relaxed-standing'])); return f.avatar; })), /pose consumer/);
    assert.equal(f.trace.disposal, 1);
    await assert.rejects(withAcceptedPoseControl(options(() => { f = host(); f.avatar.posture = new ExpressionLayer().postureLayer(); return f.avatar; })), /posture owner/);
    assert.equal(f.trace.disposal, 1);
});
await test('partial construction and run failures restore descriptors; native factory owns unreturned partial disposal', async () => {
    let f;
    const sentinel = Error('simulated native construction failure');
    await assert.rejects(withAcceptedPoseControl(options(() => { f = host(); try { throw sentinel; } finally { f.avatar.dispose(); } })), error => error === sentinel && error.controlReceipt.cleanup.lost.length === 0);
    assert.equal(f.trace.disposal, 1);
    await assert.rejects(withAcceptedPoseControl(options(() => (f = host()).avatar, () => { throw Error('capture callback failure'); })), /capture callback/);
    assert.equal(f.trace.disposal, 1);
});
await test('preexisting/foreign descriptor ownership is refused or retained, never silently overwritten', async () => {
    const foreign = function foreignLoad() {};
    Object.defineProperty(RestPose, 'load', {...originalLoad, value: foreign});
    try { await assert.rejects(withAcceptedPoseControl(options(() => host().avatar)), /descriptors changed/); assert.equal(RestPose.load, foreign); }
    finally { Object.defineProperty(RestPose, 'load', originalLoad); }
    let f;
    try {
        await assert.rejects(withAcceptedPoseControl(options(() => { f = host(); Object.defineProperty(RestPose, 'load', {...originalLoad, value: foreign}); return f.avatar; })), /restoration failed/);
        assert.equal(RestPose.load, foreign); assert.equal(f.trace.disposal, 1);
    } finally { Object.defineProperty(RestPose, 'load', originalLoad); }
});
await test('native construction bind count is observed; wrong initial-zero sequences and changed budgets fail closed', async () => {
    let f;
    const {receipt} = await withAcceptedPoseControl(options(() => (f = host({secondBind: true})).avatar));
    assert.equal(f.trace.bind, 2); assert.equal(receipt.budgetCalls.length, 2); assert.equal(f.trace.reset, 0); assert.equal(f.trace.update, 1);
    for (const initialSteps of [0, 2]) {
        await assert.rejects(withAcceptedPoseControl(options(() => (f = host({initialSteps})).avatar)), /initial-zero sequence/); assert.equal(f.trace.disposal, 1);
    }
    for (const [mutate, pattern] of [[a => a.clockSeconds = .01, /Fresh manually/], [a => a.posture.maxAdductionRadians.leftUpperArm += .01, /budget was subsequently/]]) {
        await assert.rejects(withAcceptedPoseControl(options(() => { f = host(); mutate(f.avatar); return f.avatar; })), pattern); assert.equal(f.trace.disposal, 1);
    }
});
await test('A guard prohibits capture-time rebind and disposes the accepted host', async () => {
    let f;
    await assert.rejects(withAcceptedPoseControl(options(() => (f = host()).avatar, a => a.stack.bind(a.target))), /Forbidden/);
    assert.equal(f.trace.bind, 1); assert.equal(f.trace.disposal, 1);
});
await test('post-dress preparation cannot add steps, omit proof, or leave dirty channels; caller teardown is not repeated', async () => {
    let f;
    for (const prepare of [() => undefined, () => ({preservedState: true, preservedExistingIdentities: true}), a => { const r = prepareChannels(a); a.stack.update(0); return r; }]) {
        await assert.rejects(withAcceptedPoseControl(options(() => (f = host()).avatar, undefined, {prepareChannels: prepare})), /Channel preparation/); assert.equal(f.trace.disposal, 1);
    }
    const {receipt} = await withAcceptedPoseControl(options(() => (f = host()).avatar, (a, r, instrument) => { a.dispose(); assert.equal(instrument.report().status, 'disposed'); }));
    assert.equal(receipt.disposed, true); assert.equal(f.trace.disposal, 1);
});
console.log(JSON.stringify({groups: results.length, scope: 'CPU host mechanics only; no native Avatar/wardrobe/GPU or changed candidate executed'}));
