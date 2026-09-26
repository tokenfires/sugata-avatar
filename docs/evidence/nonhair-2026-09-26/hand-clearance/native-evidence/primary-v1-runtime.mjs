// Browser side: observer/filter installation is capture-local. No product exports or assets mutate.
import * as helper from '../../../../tools/figure-pipeline/collar_capture_browser.mjs';
import { HandAttributionArm } from './HandAttributionArm.mjs';
export { helper };
const exact = (a, b, label) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(label); };
const rig = a => Object.fromEntries(a.figure.body.skeleton.bones.map(b => [b.name, b.matrixWorld.toArray()]));
export async function prepare(arm, manifest) {
    const a = window.showcase.avatar;
    a.wardrobeAssets.foundation.prefer('TORSO', 'foundation_bra');
    const beforeDressClock = a.clockSeconds; await a.dress(['female_casualsuit01', 'shoes01']);
    exact([...a.wardrobe.wornMeshes.keys()].sort(), ['female_casualsuit01', 'foundation_bra', 'foundation_briefs', 'shoes01'].sort(), 'wrong native outfit');
    if (a.clockSeconds !== beforeDressClock || a.stage.backendName !== 'webgpu' || a.report().identity.bake !== manifest.body || a.report().hair.loadedStyle !== manifest.hair || a.report().motion.seed !== manifest.seed) throw Error('Native setup identity/clock/backend drift');
    if (a.wardrobe.fragments.get('female_casualsuit01').interior !== null) throw Error('Accepted outer must not have an experimental interior');
    const preFilter = { configuration: showcase.configuration(), time: a.clockSeconds, rig: rig(a), bones: Array.from(a.figure.body.skeleton.boneMatrices), morphs: Array.from(a.figure.body.morphTargetInfluences), affect: a.report().affect, gesture: a.gesture.report() };
    window.handStudy = new HandAttributionArm(a, { arm, sourceHashes: manifest.sourceHashes });
    window.avatar = a;
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
    return { preFilter, capture: handProbe.setupReport, instrument: handStudy.report(), rendererFrame: a.stage.renderer._nodes.nodeFrame.frameId,
        gpu: { vendor: gpu.info.vendor, architecture: gpu.info.architecture, device: gpu.info.device, description: gpu.info.description, isFallbackAdapter: gpu.info.isFallbackAdapter ?? gpu.isFallbackAdapter ?? null } };
}
export function semantic() {
    const a = avatar, s = handStudy.report();
    if (!Array.isArray(s.owners)) throw Error('Adapter must report all current native owner outputs');
    return { clock: a.clockSeconds, stackTime: a.stack.time, stackFrame: a.stack.frame,
        instrument: s, affect: a.report().affect, gesture: a.gesture.report(), schedule: structuredClone(a.gesture.schedule),
        attention: showcase.attention.report(), sharedPosture: { appliedArmRadians: { ...a.posture.appliedArmRadians }, appliedDegrees: { ...a.posture.appliedDegrees },
            centreOfPressureBiasMetres: a.posture.centreOfPressureBiasMetres, centreOfPressureFrame: a.posture.centreOfPressureFrame },
        bones: Array.from(a.figure.body.skeleton.boneMatrices), morphs: Array.from(a.figure.body.morphTargetInfluences) };
}
export function snapshot() { const result = helper.snapshot(avatar); result.telemetry = semantic(); return result; }
export async function command(phase, speechPlan) {
    const beforeClock = avatar.clockSeconds;
    avatar.feel(phase.label, 1); avatar.feel(phase.pad); await avatar.say('Closer, then farther.', { speechPlan }); avatar.feel(phase.label, 1); avatar.feel(phase.pad);
    if (avatar.clockSeconds !== beforeClock) throw Error('Public command advanced simulation');
    return { schedule: structuredClone(avatar.gesture.schedule), clock: avatar.clockSeconds, target: { ...avatar.affectState.target }, attention: showcase.attention.report() };
}
export async function step() { await helper.step(avatar, 1 / 60); return semantic(); }
export async function physical() { return helper.physical(avatar); }
export function renderState() { const a = avatar, c = a.stage.camera; return { rendererFrame: a.stage.renderer._nodes.nodeFrame.frameId,
    temporal: a.stage.temporal.frameEpoch(), camera: { position: c.position.toArray(), quaternion: c.quaternion.toArray(), projection: c.projectionMatrix.toArray(), zoom: c.zoom, fov: c.fov, aspect: c.aspect } }; }
export async function setVisualBase(view) {
    const before = await physical(), authored = semantic();
    const a = avatar, c = a.stage.camera, target = a.focus.clone().fromArray(view.target), distance = view.heightMetres / 2 / Math.tan(c.fov * Math.PI / 360), yaw = view.yawDegrees * Math.PI / 180;
    c.zoom = 1; c.position.set(target.x + Math.sin(yaw) * distance, target.y, target.z + Math.cos(yaw) * distance); c.lookAt(target); c.updateProjectionMatrix();
    showcase.controls.target.copy(target); showcase.controls.minDistance = distance * .7; showcase.controls.maxDistance = distance * 1.5; showcase.controls.update(); showcase.controls.saveState();
    for (let i = 0; i < 16; i++) await helper.draw(a);
    const after = await physical(); for (const key of ['hairPositions', 'hairVelocities', 'head', 'clock', 'steps']) exact(after[key], before[key], 'visual base changed ' + key);
    exact(semantic(), authored, 'visual base changed native owners'); return { before, after, rendering: renderState(), semanticUnchanged: true };
}
// Extra views run only in a separate fresh visual trace, after its native snapshot/state sample.
export async function beginView(view) {
    if (window.handViewRestore) throw Error('Nested capture view');
    const a = avatar, c = a.stage.camera, controls = showcase.controls;
    window.handViewRestore = { position: c.position.clone(), quaternion: c.quaternion.clone(), target: controls.target.clone(), minDistance: controls.minDistance, maxDistance: controls.maxDistance, zoom: c.zoom, fov: c.fov, up: c.up.clone() };
    const target = a.focus.clone().fromArray(view.target), vertical = view.heightMetres / 2, distance = vertical / Math.tan(c.fov * Math.PI / 360), yaw = view.yawDegrees * Math.PI / 180;
    c.zoom = 1; c.position.set(target.x + Math.sin(yaw) * distance, target.y, target.z + Math.cos(yaw) * distance); c.lookAt(target); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    // No OrbitControls update: a temporary close camera must not become the next native frame's base view.
    for (let i = 0; i < 16; i++) await helper.draw(a);
    return renderState();
}
export async function endView({ converge = true } = {}) {
    const r = window.handViewRestore; if (!r) throw Error('No capture view to restore');
    const c = avatar.stage.camera; c.position.copy(r.position); c.quaternion.copy(r.quaternion); c.up.copy(r.up); c.zoom = r.zoom; c.fov = r.fov;
    showcase.controls.target.copy(r.target); showcase.controls.minDistance = r.minDistance; showcase.controls.maxDistance = r.maxDistance;
    c.updateProjectionMatrix(); c.updateMatrixWorld(true); window.handViewRestore = null;
    if (converge) for (let i = 0; i < 16; i++) await helper.draw(avatar);
    return renderState();
}
export async function teardown() {
    const a = window.avatar ?? window.showcase?.avatar; if (!a) return null;
    if (window.handViewRestore) await endView({ converge: false });
    const renderer = a.stage.renderer;
    showcase.controls.dispose();
    // AttentionAction.dispose removes a stack layer: retire the instrument/native stack first.
    if (window.handProbe) helper.dispose(a, handProbe); else a.dispose();
    showcase.attention.dispose();
    return { instrument: window.handStudy?.report() ?? null, disposed: a.disposed, memory: structuredClone(renderer.info.memory), leaks: a.leakedHandles() };
}
