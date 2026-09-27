// Capture-only completion of native channel bookkeeping; no frame, draw, reset, bind or owner update.
// Adapted from the previously qualified hand-attribution-runtime.prepareChannels; its source stays unchanged.
import {MotionStack} from '../../../../packages/core/src/motion/MotionStack.js';
import {exactValues as exact} from './FreshTipWidthFigure.mjs';
export function observerPrerequisites(a){const s=a?.stack;return {nativeClass:s instanceof MotionStack,targetPresent:!!s?.target,targetIdentity:!!s&&a.target===s.target,nativeUpdate:s?.update===MotionStack.prototype.update,nativeAccumulate:s?.accumulate===MotionStack.prototype.accumulate,channelsClean:s?.channelsDirty===false,notEvaluating:s?.evaluatingLayer===null};}
const randomState = r => ({ seed: r.seed, state: r.state, spareGaussian: r.spareGaussian });
const localAndWorld = b => b === null ? null : ({ position: b.position.toArray(), quaternion: b.quaternion.toArray(), scale: b.scale.toArray(), matrix: b.matrix.toArray(), matrixWorld: b.matrixWorld.toArray() });
const contributionState = c => ({ ownerName: c.ownerName, morphs: [...c.morphs],
    rotations: [...c.boneRotations].map(([name, q]) => [name, q.toArray()]), offsets: [...c.boneOffsets].map(([name, v]) => [name, v.toArray()]) });
/** Finish native channel bookkeeping before installing the disposable observer. No frame/bind/reset. */
export function prepareNativeChannels(a) {
    const guardBefore = observerPrerequisites(a);
    if (Object.entries(guardBefore).some(([key,ok]) => key !== 'channelsClean' && !ok)) throw Error('Unexpected observer precondition: '+JSON.stringify(guardBefore));
    if (a.clockSeconds !== 0 || a.stack.frame !== 1 || a.stack.time !== 0 || !a.layers.idle.armOwnershipResolved || a.layers.idle.armsEnabled !== false) throw Error('Expected native Showcase first zero frame before channel preparation');
    const s = a.stack, nativeRebuild = MotionStack.prototype.rebuildChannels;
    if (!(s instanceof MotionStack) || s.rebuildChannels !== nativeRebuild || s.evaluatingLayer !== null || typeof s.channelsDirty !== 'boolean') throw Error('Channel preparation requires the idle native rebuild method');
    const identities = { stack: s, target: s.target, avatarTarget: a.target, layers: s.layers, context: s.context, shared: s.context.shared,
        random: s.random, morphs: s.morphChannels, bones: s.boneChannels, skeletonBones: a.figure.body.skeleton.bones };
    const owners = s.layers.map(layer => ({ layer, stack: layer.stack, random: layer.random, contribution: layer.contribution,
        morphChannels: layer.morphChannels, boneChannels: layer.boneChannels, update: layer.update }));
    const existingMorphs = [...s.morphChannels], existingBones = [...s.boneChannels].map(([name, channel]) => ({ name, channel, bone: channel.bone, targetBone: s.target.getBone(name) ?? null }));
    const skeleton = a.figure.body.skeleton.bones.slice();
    const meshes = [...a.figure.meshes.map(m => [m.name,m]), ...a.wardrobe.wornMeshes];
    const state = () => {
        const frame = a.stage.renderer._nodes.nodeFrame;
        return { clocks: { avatar: a.clockSeconds, stackTime: s.time, stackFrame: s.frame,
            context: { time: s.context.time, frame: s.context.frame, dt: s.context.dt },
            renderer: { time: frame.time, deltaTime: frame.deltaTime, frameId: frame.frameId, renderId: frame.renderId, lastTime: frame.lastTime }, temporal: a.stage.temporal.frameEpoch() },
            random: randomState(s.random), skeleton: skeleton.map(b => ({ name: b.name, ...localAndWorld(b) })),
            boneMatrices: Array.from(a.figure.body.skeleton.boneMatrices),
            morphs: meshes.map(([name, mesh]) => [name, mesh.morphTargetInfluences ? Array.from(mesh.morphTargetInfluences) : null]),
            existingBoneRestAndLive: existingBones.map(({ name, channel, bone }) => ({ name, restQuaternion: channel.restQuaternion.toArray(), restPosition: channel.restPosition.toArray(), live: localAndWorld(bone) })),
            owners: owners.map(({ layer }) => ({ name: layer.name, order: layer.order, weight: layer.weight, enabled: layer.enabled,
                morphChannels: [...layer.morphChannels], boneChannels: [...layer.boneChannels], contribution: contributionState(layer.contribution), random: randomState(layer.random) })),
            affect: a.report().affect, gesture: a.gesture.report() };
    };
    const metadata = () => ({ dirty: s.channelsDirty, missingChannels: structuredClone(s.missingChannels),
        morphs: [...s.morphChannels].map(([name, c]) => ({ name, present: c.present, retiring: c.retiring })),
        bones: [...s.boneChannels].map(([name, c]) => ({ name, present: c.bone !== null, retiring: c.retiring })) });
    const before = { state: state(), metadata: metadata() }, calls = s.channelsDirty ? 1 : 0;
    if (calls) s.rebuildChannels();
    const after = { state: state(), metadata: metadata() };
    if (a.stack !== identities.stack || a.target !== identities.avatarTarget || s.target !== identities.target || s.layers !== identities.layers ||
        s.context !== identities.context || s.context.shared !== identities.shared || s.random !== identities.random || s.morphChannels !== identities.morphs || s.boneChannels !== identities.bones ||
        a.figure.body.skeleton.bones !== identities.skeletonBones || s.rebuildChannels !== nativeRebuild || s.channelsDirty || s.evaluatingLayer !== null) throw Error('Native channel preparation changed stack identity or did not become clean');
    if (s.layers.length !== owners.length || owners.some((r, i) => s.layers[i] !== r.layer || r.layer.stack !== r.stack || r.layer.random !== r.random ||
        r.layer.contribution !== r.contribution || r.layer.morphChannels !== r.morphChannels || r.layer.boneChannels !== r.boneChannels || r.layer.update !== r.update)) throw Error('Native channel preparation changed an owner identity');
    if (skeleton.length !== a.figure.body.skeleton.bones.length || skeleton.some((b, i) => a.figure.body.skeleton.bones[i] !== b) ||
        existingMorphs.some(([name, c]) => s.morphChannels.get(name) !== c) || existingBones.some(({ name, channel, bone, targetBone }) =>
            s.boneChannels.get(name) !== channel || channel.bone !== bone || (s.target.getBone(name) ?? null) !== targetBone)) throw Error('Native channel preparation replaced an existing channel or bone');
    exact(after.state, before.state, 'Native channel preparation changed existing pose, rest, owners, PRNG or clocks');
    return { method: 'Native MotionStack.rebuildChannels exactly once iff dirty after the original Showcase zero frame, before observer install; channel metadata alone may change.', guardBefore, guardAfter: observerPrerequisites(a), calls, before, after,
        preservedExistingIdentities: true, preservedState: true,
        addedMorphChannels: [...s.morphChannels.keys()].filter(name => !existingMorphs.some(([old]) => old === name)),
        addedBoneChannels: [...s.boneChannels.keys()].filter(name => !existingBones.some(old => old.name === name)) };
}
