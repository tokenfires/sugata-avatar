// One frozen rest-family / common native-budget candidate in a disposable native page.
// This instrument records a proposal; it does not qualify fit or promote assets.
import { withCandidatePoseControl, CANDIDATE_BUDGET } from './pose-proposal/CandidatePoseControl.mjs';
import { prepareChannels } from './accepted-control-runtime.mjs';
import * as helper from '../../../../tools/figure-pipeline/collar_capture_browser.mjs';
import * as native from '../hand-clearance/hand-attribution-runtime.mjs';
export { native };
export function begin({poseFiles, sourceHashes, manifest}) {
    if (window.candidateControlPromise) throw Error('One candidate construction per disposable page');
    window.candidateControlPromise = withCandidatePoseControl({
        poseFiles, sourceHashes, budget: CANDIDATE_BUDGET, prepareChannels,
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
            if (a.stage.backendName !== 'webgpu' || a.report().identity.bake !== manifest.body || a.report().hair.loadedStyle !== manifest.hair || a.report().motion.seed !== manifest.seed) throw Error('Native candidate configuration drift');
            if (a.wardrobe.fragments.get('female_casualsuit01').interior !== null) throw Error('Accepted outer must not have an experimental interior');
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
            window.candidateControlReady = {
                configuration: showcase.configuration(), construction: structuredClone(receipt),
                nativeGesture: {amplitude:a.gesture.amplitude,yieldToPosture:a.gesture.yieldToPosture,sagittalShare:a.gesture.sagittalShare,dominanceDrivesAmplitude:a.gesture.dominanceDrivesAmplitude},
                morphNames: Object.entries(a.figure.body.morphTargetDictionary).sort((a,b)=>a[1]-b[1]).map(([name])=>name),
                rendererFrame: a.stage.renderer._nodes.nodeFrame.frameId,
                gpu: {vendor: gpu.info.vendor, architecture: gpu.info.architecture, device: gpu.info.device, description: gpu.info.description}
            };
            await new Promise(resolve => { window.finishCandidateControl = resolve; });
            return {requestedRetirement: true};
        }
    }).catch(error => {
        window.candidateControlError = {message: error.message, stack: error.stack, receipt: error.controlReceipt ?? null};
        // The wrapper owns Avatar teardown; these viewer handles retire after it on failure.
        try { window.showcase?.controls?.dispose(); window.showcase?.attention?.dispose(); } catch(cleanup) { window.candidateControlError.viewerCleanup = String(cleanup); }
        return null;
    });
    return {started: true};
}
export async function finish() {
    window.finishCandidateControl?.();
    const result = await window.candidateControlPromise;
    return {result, disposal: window.controlDisposal ?? null, error: window.candidateControlError ?? null,
        memory: window.controlRenderer ? structuredClone(controlRenderer.info.memory) : null};
}
