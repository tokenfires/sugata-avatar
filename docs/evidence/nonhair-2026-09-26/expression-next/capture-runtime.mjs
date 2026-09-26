// Browser-only study instrument. No production page, asset, or natural motion setting is changed.
import { ExpressionStudyArm } from './ExpressionStudyArm.mjs';
import { physical } from '../../../../tools/figure-pipeline/collar_capture_browser.mjs';
import { envelopeKeys } from '../../../../packages/core/src/voice/Coarticulation.js';
import { OVR_VISEMES } from '../../../../packages/core/src/voice/Visemes.js';

export const PAD = Object.freeze({ pleasure: 0, arousal: .4, dominance: .85 });
export const TIMELINE = Object.freeze([
    { viseme: 'aa', startTime: .55, duration: .18 },
    { viseme: 'PP', startTime: 1.15, duration: .18 },
    { viseme: 'FF', startTime: 1.75, duration: .18 },
    { viseme: 'U', startTime: 2.35, duration: .18 }
]);
export const SPEECH_PLAN = Object.freeze({ synthetic: true, durationSeconds: 2.8, words: [
    { text: 'A', startTime: .55, endTime: .73, stressed: false },
    { text: 'prepared', startTime: 1.15, endTime: 1.33, stressed: true },
    { text: 'focused', startTime: 1.75, endTime: 1.93, stressed: false },
    { text: 'view', startTime: 2.35, endTime: 2.53, stressed: false }
] });
const raf = () => new Promise(requestAnimationFrame);
let a, api, clock, owner = null, speechPromise = null, lastVisemeClock = null;
function begin(dt) {
    const node = a.stage.renderer._nodes.nodeFrame;
    node.update(); clock.frames++; clock.time += dt;
    node.time = clock.time; node.deltaTime = dt; a.stage.renderer.info.frame = node.frameId;
    if (node.frameId !== clock.base + clock.frames) throw Error('Uncontrolled native renderer frame');
}
async function barrier() { await a.stage.renderer.backend.device.queue.onSubmittedWorkDone(); await raf(); }
export async function step(count = 1, dt = 1 / 60) {
    for (let i = 0; i < count; i++) { await raf(); begin(dt); lastVisemeClock = a.clockSeconds; await api.step(dt); await barrier(); }
}
export async function setup() {
    api = window.portrait; a = api.avatar;
    if (a.stage.backendName !== 'webgpu' || a.report().identity.bake !== 'figure_g050' || a.seed !== 20260807)
        throw Error('Native fixed g050/seed required');
    if (a.clockSeconds !== 0 || document.querySelector('#pause').getAttribute('aria-pressed') === 'true')
        throw Error('Fresh captured running portrait required');
    for (let i = 0; i < 4; i++) { await raf(); await api.step(0); }
    // The public Portrait defaults to 12 degrees. This protocol fixes one frontal view,
    // preserving the existing target, eye-level elevation and distance; no camera search.
    const camera = a.stage.camera, target = api.controls.target;
    const radius = Math.hypot(camera.position.x - target.x, camera.position.z - target.z);
    camera.position.x = target.x; camera.position.z = target.z + radius;
    camera.lookAt(target); camera.updateMatrixWorld(true); api.controls.update();
    const renderer = a.stage.renderer, node = renderer._nodes.nodeFrame;
    if (renderer._animation.getAnimationLoop() !== null || node.frameId >= 1000000) throw Error('Clock takeover unavailable');
    const bootFrame = node.frameId;
    renderer._animation.stop(); node.frameId = 1000000; node.time = 0; node.deltaTime = 0; node.lastTime = undefined;
    clock = { base: 1000000, bootFrame, frames: 0, time: 0 };
    a.stage.temporal.resetFrameEpoch();
    await step(1, 0);
    const before = await physical(a);
    for (let i = 0; i < 128; i++) { await raf(); begin(0); a.stage.draw(); await barrier(); }
    if (JSON.stringify(before) !== JSON.stringify(await physical(a))) throw Error('Zero-time convergence moved native state');
    return { clock: { ...clock }, identity: a.report().identity, hair: a.report().hair.loadedStyle,
        scene: a.report().scene, layers: a.stack.layers.map(l => ({ name: l.name, order: l.order, enabled: l.enabled, weight: l.weight })),
        temporal: a.stage.temporal.mode, camera: cameraState(), initial: await snapshot() };
}
function cameraState() {
    const c = a.stage.camera;
    return { position: c.position.toArray(), quaternion: c.quaternion.toArray(), zoom: c.zoom,
        aspect: c.aspect, target: api.controls.target.toArray(), projection: c.projectionMatrix.toArray() };
}
export function start(arm, speech) {
    if (owner || speechPromise) throw Error('Fresh document required for each arm');
    if (speech) {
        speechPromise = a.say('A prepared focused view.', { timeline: TIMELINE, speechPlan: SPEECH_PLAN });
        a.feel(PAD);
    }
    if (arm !== 'A') { owner = new ExpressionStudyArm(a, { arm }); owner.start(a.stage.camera); }
    const schedule = a.viseme.schedule;
    return { arm, speechEnabled: speech, clock: a.clockSeconds, owner: owner?.report() ?? null,
        targetAfterSay: { ...a.affectState.target },
        speech: speech ? { rawTimeline: TIMELINE, speechPlan: SPEECH_PLAN, normalized: schedule.timeline,
            leadSeconds: schedule.leadSeconds, audioStartTime: schedule.audioStartTime,
            windows: schedule.windows, keys: schedule.timeline.map(e => ({ viseme: e.viseme, ...envelopeKeys(e) })) } : null };
}
export async function snapshot() {
    const channels = Object.fromEntries([...a.stack.morphChannels].map(([name, c]) => [name, {
        committed: c.committed, writers: c.writerNames.map((owner, i) => ({ owner, value: c.writerValues[i] }))
    }]));
    const g = a.layers.gaze;
    const body = a.figure.body;
    const ovr = Object.fromEntries(OVR_VISEMES.map(name => [name, a.stack.morphChannels.get(name)?.committed ?? 0]));
    const ovrMesh = Object.fromEntries(OVR_VISEMES.map(name => [name, body.morphTargetInfluences[body.morphTargetDictionary[name]]]));
    for (const name of OVR_VISEMES) if (ovr[name] !== ovrMesh[name]) throw Error('Native OVR commit/mesh mismatch: ' + name);
    return { time: a.clockSeconds, frame: a.stack.frame, renderFrame: a.stage.renderer._nodes.nodeFrame.frameId,
        pad: { ...a.affectState.pad }, target: { ...a.affectState.target },
        expression: { face: structuredClone(a.expression.faceResult), activations: structuredClone(a.expression.activations),
            posture: structuredClone(a.expression.bodyPrescription) },
        owner: owner?.report() ?? null, channels,
        ovr, ovrMesh,
        // Figure.getMorph reads the separate intended direct-write path, not the bound
        // createMotionTarget mesh writes. Keep it diagnostic; never call it speech evidence.
        ovrDirectWeights: Object.fromEntries(OVR_VISEMES.map(name => [name, a.figure.getMorph(name)])),
        speaking: a.viseme.speaking, visemeSampleClock: lastVisemeClock,
        gaze: { policyEnabled: g.policyEnabled, hasHold: !!g.targetHold, hasRelease: !!g.pointAimRelease,
            shared: structuredClone(a.stack.context.shared.gaze), point: structuredClone(g.pointAimOutput) },
        bones: Array.from(a.figure.body.skeleton.boneMatrices), physical: await physical(a), camera: cameraState(),
        meshes: (() => { const list = []; a.figure.root.traverse(o => { if (o.isMesh && o.morphTargetDictionary)
            list.push({ name: o.name, morphs: Object.fromEntries(Object.entries(o.morphTargetDictionary).map(([n, i]) => [n, o.morphTargetInfluences[i]])) }); }); return list; })()
    };
}
export async function png() {
    const blob = await new Promise(resolve => document.querySelector('#stage').toBlob(resolve, 'image/png'));
    if (!blob) throw Error('Canvas PNG unavailable');
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
}
export async function finish() {
    const outcome = speechPromise ? await speechPromise : null;
    const beforeDispose = owner?.report() ?? null;
    owner?.dispose();
    const noStudyLayers = a.stack.layers.every(l => !l.name.startsWith('expressionStudy'));
    const renderer = a.stage.renderer;
    api.attention.dispose(); api.controls.dispose(); a.dispose();
    return { outcome, beforeDispose, noStudyLayers, disposal: a.report().disposal,
        memory: structuredClone(renderer.info.memory) };
}
