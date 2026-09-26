// Capture-local accepted-control mechanism only. No changed pose/cap is admitted.
import { Quaternion } from 'three';
import { RestPose } from '../../../../packages/core/src/figure/RestPose.js';
import { PostureLayer } from '../../../../packages/core/src/affect/PostureLayer.js';
import { MotionStack } from '../../../../packages/core/src/motion/MotionStack.js';
import { Sway } from '../../../../packages/core/src/motion/Sway.js';
import { HandAttributionArm, REQUIRED_SOURCE_HASHES as ARM_SOURCES } from '../hand-clearance/HandAttributionArm.mjs';

export const POSE_HASHES = Object.freeze({
    'relaxed-standing': '917cead92c04fc339a0baedf07ca592293800dc670ba4f50686975a0439d345f',
    'weight-left': '79afa516a9b2048b9e315e359a0dbc47ec5413b3c9cb3dec60482dffa0e6d0b8',
    'weight-right': 'a132916357c84a24e3c7a73e967987202bd9346fc3a2ebc2f8c62990efa761f4'
});
export const REQUIRED_SOURCE_HASHES = Object.freeze({...ARM_SOURCES,
    'packages/core/src/figure/RestPose.js': 'c8e7892717d33e9f273fbb4f85d765f80b5a3efe09f09f6a4abc0ba5368bceb3',
    'packages/core/src/motion/Sway.js': '00d99fe27a749fc491e0a5eaca4dbdbb13f5331f0a5265089ba5012d47fb84a6',
    'packages/core/src/Avatar.js': '9e44e981d48a835b57b0badf4b2e675f2b10fc64da8bbfcd316e3201e586407c',
    'docs/evidence/nonhair-2026-09-26/hand-clearance/HandAttributionArm.mjs': '614cf2db48236909337e696029cf0e4fbe743ab24c0631bb9f7998d685839f14',
    ...Object.fromEntries(Object.entries(POSE_HASHES).map(([name, hash]) => [`packages/core/src/figure/poses/${name}.json`, hash]))
});
const loadDescriptor = Object.getOwnPropertyDescriptor(RestPose, 'load');
const budgetDescriptor = Object.getOwnPropertyDescriptor(PostureLayer.prototype, 'bindArmBudget');
const EXPECTED_LOADS = ['relaxed-standing', 'weight-left', 'weight-right', 'relaxed-standing'];
let lease = null;
const require = (condition, message) => { if (!condition) throw Error(message); };
const sameDescriptor = (a, b) => !!a && !!b && ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(k => a[k] === b[k]);
const exact = (a, b, label) => {
    if (Object.is(a, b)) return;
    require(a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b), label);
    const keys = Object.keys(a); require(keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k)), label);
    for (const key of keys) exact(a[key], b[key], label);
};
const compiled = pose => ({name: pose.name, hipsOffset: pose.hipsOffset.toArray(), rotations: [...pose.rotations].map(([name, q]) => [name, q.toArray()])});
const sha256 = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');

/**
 * One disposable construction + caller-owned capture interval. `construct` must use native
 * Avatar.create in an isolated page. CPU host fixtures exercise mechanics only. Both the callback
 * and its rejected partial construction retain their native cleanup obligations.
 * No live Avatar is returned: the A guard disposes the admitted host after `run`, even on error.
 */
export async function withAcceptedPoseControl(options) {
    exact(Object.keys(options).sort(), ['budget', 'construct', 'poseFiles', 'run', 'sourceHashes'], 'Unexpected control option; candidate angles/caps are not admitted');
    const {poseFiles, sourceHashes, budget, construct, run} = options;
    require(budget === 'passthrough' && typeof construct === 'function' && typeof run === 'function', 'Only a disposable accepted/passthrough control is supported');
    exact(Object.keys(poseFiles).sort(), Object.keys(POSE_HASHES).sort(), 'Exact three-pose family required');
    for (const [file, expected] of Object.entries(REQUIRED_SOURCE_HASHES)) require(sourceHashes?.[file] === expected, 'Source pin mismatch: ' + file);
    const poseTexts = Object.freeze({...poseFiles}), references = {};
    for (const name of Object.keys(POSE_HASHES)) {
        require(typeof poseTexts[name] === 'string' && await sha256(poseTexts[name]) === POSE_HASHES[name], 'Accepted UTF-8 pose bytes required: ' + name);
        require(JSON.parse(poseTexts[name]).name === name, 'Pose name mismatch');
        references[name] = compiled(loadDescriptor.value.call(RestPose, name));
        exact(compiled(new RestPose(JSON.parse(poseTexts[name]), name)), references[name], 'Accepted compiled pose differs: ' + name);
    }
    require(lease === null, 'Another accepted-control construction is active');
    require(sameDescriptor(Object.getOwnPropertyDescriptor(RestPose, 'load'), loadDescriptor) &&
        sameDescriptor(Object.getOwnPropertyDescriptor(PostureLayer.prototype, 'bindArmBudget'), budgetDescriptor), 'Native descriptors changed before installation');
    const token = {}; lease = token;
    const receipt = {kind: 'accepted-pose-passthrough-control', candidate: false, poseHashes: {...POSE_HASHES}, sourceHashes: {...REQUIRED_SOURCE_HASHES},
        poseCalls: [], budgetCalls: [], cleanup: {restored: [], lost: []}, nativeQualification: false};
    const poses = [], patches = []; let owner = null, target = null, stack = null, avatar = null, guard = null, failure = null, result;
    const wrap = (object, key, before, value) => {
        const installed = {...before, value}; Object.defineProperty(object, key, installed); patches.push({object, key, before, installed});
    };
    try {
        wrap(RestPose, 'load', loadDescriptor, function(name) {
            require(this === RestPose && name === EXPECTED_LOADS[poses.length], 'Unexpected pose consumer/order: ' + String(name));
            const pose = new RestPose(JSON.parse(poseTexts[name]), name); exact(compiled(pose), references[name], 'Injected accepted pose compilation drift');
            poses.push(pose); receipt.poseCalls.push({index: poses.length - 1, name, sha256: POSE_HASHES[name], compiled: compiled(pose)}); return pose;
        });
        wrap(PostureLayer.prototype, 'bindArmBudget', budgetDescriptor, function(actualTarget) {
            require(this instanceof PostureLayer && this.stack instanceof MotionStack && this.stack.target === actualTarget &&
                this.stack.time === 0 && this.stack.frame === 0, 'Budget hook requires a fresh native posture/stack/target');
            require(owner === null || (owner === this && target === actualTarget && stack === this.stack), 'A second/foreign posture owner attempted construction');
            owner = this; target = actualTarget; stack = this.stack;
            const before = {...this.maxAdductionRadians}, returned = budgetDescriptor.value.call(this, actualTarget), native = {...this.maxAdductionRadians};
            require(['leftUpperArm', 'rightUpperArm'].every(n => Number.isFinite(native[n]) && native[n] >= 0), 'Native arm budget is not finite/nonnegative');
            // Passthrough means no assignment, scaling, reduction or added pose operation.
            receipt.budgetCalls.push({index: receipt.budgetCalls.length, before, native, effective: {...this.maxAdductionRadians}, stackFrame: stack.frame, stackTime: stack.time});
            return returned;
        });
        avatar = await construct();
        require(avatar && avatar.disposed === false && avatar.autoStart === false && avatar.clockSeconds === 0 &&
            avatar.seed === 20260807 && avatar.poseName === 'relaxed-standing', 'Fresh manually stepped accepted Avatar required');
        require(poses.length === 4 && avatar.restPose === poses[3] && avatar.layers?.sway instanceof Sway &&
            avatar.layers.sway.relaxedPose === poses[0] && avatar.layers.sway.stancePoses.left === poses[1] && avatar.layers.sway.stancePoses.right === poses[2], 'Missing/wrong native pose consumer');
        require(owner && avatar.posture === owner && avatar.stack === stack && avatar.target === target && owner.stack === stack &&
            stack.findLayer(owner.name) === owner && avatar.layers.sway.stack === stack && stack.layers.includes(avatar.layers.sway) && stack.time === 0 && stack.frame === 0, 'Returned Avatar has a missing/wrong posture owner');
        // Preserve the exact native foundation preference + absolute dress route used by attribution.
        require(avatar.wardrobeAssets?.foundation && typeof avatar.dress === 'function', 'Native wardrobe preparation unavailable');
        avatar.wardrobeAssets.foundation.prefer('TORSO', 'foundation_bra');
        await avatar.dress(['female_casualsuit01', 'shoes01']);
        exact([...avatar.wardrobe.wornMeshes.keys()].sort(), ['female_casualsuit01', 'foundation_bra', 'foundation_briefs', 'shoes01'].sort(), 'Accepted prepared outfit missing');
        require(avatar.clockSeconds === 0 && stack.time === 0 && stack.frame === 0 && avatar.stack === stack && avatar.posture === owner && avatar.target === target && stack.target === target, 'Native preparation changed clock/owner');
        require(stack.channelsDirty === false, 'Pending native channel rebuild requires separately qualified native preparation; this CPU mechanism does not drain it');
        exact(owner.maxAdductionRadians, receipt.budgetCalls.at(-1).native, 'Passthrough native budget was subsequently changed');
        exact(owner.appliedArmRadians, {leftUpperArm: 0, rightUpperArm: 0}, 'Posture already applied an arm delta before capture');
        poses.forEach((pose, i) => exact(compiled(pose), references[EXPECTED_LOADS[i]], 'Accepted compiled pose mutated during construction'));
        const accumulated = new Map();
        receipt.swayReference = avatar.layers.sway.joints.map(joint => {
            const own = poses[0].rotationFor(joint.humanoid) ?? new Quaternion(), parent = joint.parent === null ? null : accumulated.get(joint.parent);
            const q = parent ? new Quaternion().multiplyQuaternions(parent, own) : own.clone(); accumulated.set(joint.humanoid, q);
            exact(joint.relaxedAccumulated.toArray(), q.toArray(), 'Sway accumulated reference mismatch');
            exact(joint.relaxedAccumulatedInverse.toArray(), q.clone().invert().toArray(), 'Sway inverse reference mismatch');
            return {humanoid: joint.humanoid, accumulated: q.toArray(), inverse: joint.relaxedAccumulatedInverse.toArray()};
        });
        receipt.prepared = {clock: avatar.clockSeconds, stackFrame: stack.frame, stackTime: stack.time, outfit: [...avatar.wardrobe.wornMeshes.keys()], budgetCalls: receipt.budgetCalls.length};
    } catch (error) { failure = error; }
    finally {
        for (const p of patches.reverse()) {
            if (sameDescriptor(Object.getOwnPropertyDescriptor(p.object, p.key), p.installed)) {
                Object.defineProperty(p.object, p.key, p.before); receipt.cleanup.restored.push(p.key);
                if (!sameDescriptor(Object.getOwnPropertyDescriptor(p.object, p.key), p.before)) receipt.cleanup.lost.push(p.key);
            } else receipt.cleanup.lost.push(p.key); // Never overwrite a newer descriptor owner.
        }
        if (lease === token) lease = null;
        if (receipt.cleanup.lost.length) failure = new AggregateError([...(failure ? [failure] : []), Error('Lost interposer descriptor ownership: ' + receipt.cleanup.lost.join(', '))], 'Accepted-control restoration failed');
    }
    try {
        if (failure) throw failure;
        // Native construction/onBind precedes this boundary. Capture-time rebind/reset is prohibited.
        guard = new HandAttributionArm(avatar, {arm: 'A', sourceHashes}); receipt.guard = {arm: 'A', status: guard.report().status};
        result = await run(avatar, receipt);
    } catch (error) { failure = error; }
    finally {
        try {
            if (guard) { guard.dispose(); receipt.retirement = guard.report(); }
            else if (avatar && !avatar.disposed) avatar.dispose();
            receipt.disposed = avatar?.disposed ?? null;
        } catch (cleanup) { failure = new AggregateError([...(failure ? [failure] : []), cleanup], 'Accepted-control disposal failed'); }
    }
    receipt.completed = failure === null;
    if (failure) { failure.controlReceipt = receipt; throw failure; }
    return {result, receipt};
}
