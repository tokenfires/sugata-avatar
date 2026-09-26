// Accepted-byte construction replay only. The channel preparation below is copied exactly
// from the sealed attribution runtime86f9c9c7; it performs no added simulation frame.
import { withAcceptedPoseControl } from './AcceptedPoseControl.mjs';
import { MotionStack } from '../../../../packages/core/src/motion/MotionStack.js';
import * as helper from '../../../../tools/figure-pipeline/collar_capture_browser.mjs';
import * as native from '../hand-clearance/hand-attribution-runtime.mjs';
export { native };
const exact = (a, b, label) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(label); };
const rig = a => Object.fromEntries(a.figure.body.skeleton.bones.map(b => [b.name, b.matrixWorld.toArray()]));
const randomState = r => ({ seed: r.seed, state: r.state, spareGaussian: r.spareGaussian });
const localAndWorld = b => b === null ? null : ({ position: b.position.toArray(), quaternion: b.quaternion.toArray(), scale: b.scale.toArray(), matrix: b.matrix.toArray(), matrixWorld: b.matrixWorld.toArray() });
const contributionState = c => ({ ownerName: c.ownerName, morphs: [...c.morphs],
    rotations: [...c.boneRotations].map(([name, q]) => [name, q.toArray()]), offsets: [...c.boneOffsets].map(([name, v]) => [name, v.toArray()]) });
/** Finish native channel bookkeeping before installing the disposable observer. No frame/bind/reset. */
export function prepareChannels(a) {
    const s = a.stack, nativeRebuild = MotionStack.prototype.rebuildChannels;
    if (!(s instanceof MotionStack) || s.rebuildChannels !== nativeRebuild || s.evaluatingLayer !== null || typeof s.channelsDirty !== 'boolean') throw Error('Channel preparation requires the idle native rebuild method');
    const identities = { stack: s, target: s.target, avatarTarget: a.target, layers: s.layers, context: s.context, shared: s.context.shared,
        random: s.random, morphs: s.morphChannels, bones: s.boneChannels, skeletonBones: a.figure.body.skeleton.bones };
    const owners = s.layers.map(layer => ({ layer, stack: layer.stack, random: layer.random, contribution: layer.contribution,
        morphChannels: layer.morphChannels, boneChannels: layer.boneChannels, update: layer.update }));
    const existingMorphs = [...s.morphChannels], existingBones = [...s.boneChannels].map(([name, channel]) => ({ name, channel, bone: channel.bone, targetBone: s.target.getBone(name) ?? null }));
    const skeleton = a.figure.body.skeleton.bones.slice();
    const meshes = [['body', a.figure.body], ...a.wardrobe.wornMeshes];
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
    return { method: 'Native MotionStack.rebuildChannels exactly once iff dirty, before observer install; metadata is allowed to change.', calls, before, after,
        preservedExistingIdentities: true, preservedState: true,
        addedMorphChannels: [...s.morphChannels.keys()].filter(name => !existingMorphs.some(([old]) => old === name)),
        addedBoneChannels: [...s.boneChannels.keys()].filter(name => !existingBones.some(old => old.name === name)) };
}

export function begin({poseFiles, sourceHashes, manifest}) {
    if (window.acceptedControlPromise) throw Error('One accepted construction per disposable page');
    window.acceptedControlPromise = withAcceptedPoseControl({
        poseFiles, sourceHashes, budget: 'passthrough', prepareChannels,
        retire: async () => { window.controlDisposal = await native.teardown(); return window.controlDisposal; },
        construct: async () => {
            // Original top-level await includes framing, attention attachment and its step(0).
            await import('/src/showcase.js');
            if (!window.showcase || window.showcase.avatar.disposed) throw Error('Original showcase initialization failed: ' + document.querySelector('#error').textContent);
            window.controlRenderer = showcase.avatar.stage.renderer;
            return showcase.avatar;
        },
        run: async (a, receipt, observer) => {
            window.avatar = a; window.handStudy = observer;
    showcase.controls.target.copy(a.focus); showcase.controls.target.y += .045;
    // Same initial zero-delta update,128 convergence draws, camera setup,128 draws as old capture.
    window.handProbe = await helper.setup(a, { arm: 'owned', motion: 'natural', yaw: manifest.camera.initialYawDegrees });
    const c = a.stage.camera, target = a.focus.clone(); target.y += manifest.camera.focusYOffsetMetres;
    const radius = Math.hypot(c.position.x - target.x, c.position.z - target.z) * manifest.camera.horizontalRadiusScale, angle = manifest.camera.yawDegrees * Math.PI / 180;
    c.position.set(target.x + Math.sin(angle) * radius, target.y + manifest.camera.cameraHeightAboveTargetMetres, target.z + Math.cos(angle) * radius); c.lookAt(target);
    showcase.controls.target.copy(target); showcase.controls.minDistance = radius * .7; showcase.controls.maxDistance = radius * 1.5;
    showcase.controls.update(); showcase.controls.saveState();
    for (let i = 0; i < 128; i++) await helper.draw(a);
    if (a.stage.renderer._nodes.nodeFrame.frameId !== 1000257) throw Error('Historical primary draw count drift');

            const gpu = await navigator.gpu.requestAdapter();
            window.acceptedControlReady = {
                configuration: showcase.configuration(), construction: structuredClone(receipt),
                rendererFrame: a.stage.renderer._nodes.nodeFrame.frameId,
                gpu: {vendor: gpu.info.vendor, architecture: gpu.info.architecture, device: gpu.info.device, description: gpu.info.description}
            };
            await new Promise(resolve => { window.finishAcceptedControl = resolve; });
            return {requestedRetirement: true};
        }
    }).catch(error => {
        window.acceptedControlError = {message: error.message, stack: error.stack, receipt: error.controlReceipt ?? null};
        // The wrapper owns Avatar teardown; these viewer handles retire after it on failure.
        try { window.showcase?.controls?.dispose(); window.showcase?.attention?.dispose(); } catch(cleanup) { window.acceptedControlError.viewerCleanup = String(cleanup); }
        return null;
    });
    return {started: true};
}
export async function finish() {
    window.finishAcceptedControl?.();
    const result = await window.acceptedControlPromise;
    return {result, disposal: window.controlDisposal ?? null, error: window.acceptedControlError ?? null,
        memory: window.controlRenderer ? structuredClone(controlRenderer.info.memory) : null};
}
