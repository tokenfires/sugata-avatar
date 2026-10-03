import { Color, ColorManagement } from 'three/webgpu';
import { Avatar } from '../../../../packages/core/src/Avatar.js';
import { configurationFromReport } from '../../../../packages/testbed/src/showcase-presets.mjs';
import { EyeMaterial as PreviewEyes } from './PreviewEyeMaterial.mjs';

const read = async url => { const r = await fetch(url); if (!r.ok) throw Error('Input unavailable: ' + url); return r.json(); };
const recipe = await read(new URL('../../../../looks/sage-lavender-chin.json', import.meta.url));
const candidate = await read(new URL('./candidate.json', import.meta.url));
if (candidate.blue !== '#527b97' || JSON.stringify(candidate.lumaWeights) !== '[0.2126,0.7152,0.0722]' || !ColorManagement.enabled) throw Error('Fixed colour contract unavailable');
const linear = new Color(candidate.blue).toArray();
const luma = linear.reduce((sum, c, i) => sum + c * candidate.lumaWeights[i], 0);
const chromaticity = linear.map(c => c / luma);
if (!(luma > 0) || !chromaticity.every(Number.isFinite)) throw Error('Invalid fixed chromaticity');
const uniformNames = ['pupilScaleUniform', 'scleraBrightnessUniform', 'scleraChromaUniform', 'limbalRingUniform', 'catchlightIntensityUniform', 'causticScaleUniform'];
const optics = e => Object.fromEntries(['corneaIor', 'corneaRoughness', 'corneaSceneSpecular', 'refractionEnabled'].map(k => [k, e[k]]));
const value = v => v?.toArray ? v.toArray() : v?.elements ? Array.from(v.elements) : v;
const frames = e => Object.fromEntries(['left', 'right'].map(side => [side, {
    basis: value(e.frames[side].basis),
    ...Object.fromEntries(['bindBasis', 'worldToEye', 'eyeToWorld', 'centre', 'corneaCentreZ', 'corneaRadius', 'irisRadius', 'irisPlaneZ', 'scleraRadius', 'uvCentre', 'uvJacobian'].map(k => [k, value(e.frames[side][k].value)])),
    gazeRotationVectors: e.frames[side].gazeRotationVectors
}]));
const uniforms = e => ({ ...Object.fromEntries(uniformNames.map(k => [k, e[k].value])), key: e.keyLightDirectionUniform.value.toArray() });

let avatar, original, donor, frame, disposed = false, retirement;
const donorDisposals = [], retirementErrors = [];
let borrowedMapDisposed = 0, borrowedMap;
try {
    avatar = await Avatar.create({ canvas: document.querySelector('#stage'), ...recipe, autoStart: false });
    await avatar.step(0);
    original = avatar.eyes;
    if (!original?.attached || original.globeMesh.material !== original.globeMaterial || original.corneaMesh.material !== original.corneaMaterial) throw Error('Actual original eye owners unavailable');
    const source = Array.isArray(original.originalGlobeMaterial) ? original.originalGlobeMaterial[0] : original.originalGlobeMaterial;
    borrowedMap = source?.map;
    if (!borrowedMap?.isTexture) throw Error('Exact original composite texture unavailable');
    donor = new PreviewEyes({ globeMesh: original.globeMesh, corneaMesh: original.corneaMesh,
        previewSourceGlobeMaterial: original.originalGlobeMaterial, previewIrisChromaticity: chromaticity });
    if (donor.attached || donor.originalGlobeMaterial !== original.originalGlobeMaterial || JSON.stringify(optics(donor)) !== JSON.stringify(optics(original))) throw Error('Donor source/optic contract unavailable');
    for (const [name, resource] of [['globe', donor.globeMaterial], ['unusedCornea', donor.corneaMaterial], ['unusedCatchlight', donor.catchlight.texture]]) {
        if (!resource) throw Error('Donor resource unavailable: ' + name);
        resource.addEventListener('dispose', () => donorDisposals.push({ name, uuid: resource.uuid }));
    }
    borrowedMap.addEventListener('dispose', () => borrowedMapDisposed++);
    const head = avatar.figure.bone('head');
    if (!head) throw Error('Head unavailable');
    let arm = 'original', view = 'front';
    const sync = () => {
        avatar.figure.root.updateMatrixWorld(true); original.update();
        for (const k of uniformNames) donor[k].value = original[k].value;
        donor.keyLightDirectionUniform.value.copy(original.keyLightDirectionUniform.value); donor.update();
    };
    const setView = id => {
        view = id; avatar.stage.camera.fov = 26;
        avatar.stage.camera.position.set(...(id === 'front' ? [0, 1.55, .88] : [.4235, 1.55, .7665]));
        avatar.stage.camera.lookAt(0, 1.55, .033); avatar.stage.camera.updateProjectionMatrix();
    };
    const setArm = id => {
        arm = id; original.globeMesh.material = id === 'original' ? original.globeMaterial : donor.globeMaterial;
        document.querySelector('#status').textContent = id === 'original' ? 'Actual original eyes' : 'Preview-only Blue iris pigment';
    };
    const bindings = () => { const rows = []; avatar.figure.root.traverse(o => { if (o.isMesh) rows.push({ mesh: o.uuid, name: o.name, materials: (Array.isArray(o.material) ? o.material : [o.material]).map(m => m?.uuid ?? null) }); }); return rows; };
    const snapshot = () => {
        sync();
        const donorSource = Array.isArray(donor.originalGlobeMaterial) ? donor.originalGlobeMaterial[0] : donor.originalGlobeMaterial;
        return { arm, view, recipe, actualConfiguration: configurationFromReport(avatar.report()),
            camera: { position: avatar.stage.camera.position.toArray(), quaternion: avatar.stage.camera.quaternion.toArray(), fov: avatar.stage.camera.fov },
            headWorld: head.matrixWorld.toArray(), bindings: bindings(),
            eyes: { originalOwnerUnchanged: avatar.eyes === original, globeMesh: original.globeMesh.uuid,
                activeGlobe: original.globeMesh.material.uuid, originalGlobe: original.globeMaterial.uuid, donorGlobe: donor.globeMaterial.uuid,
                corneaMesh: original.corneaMesh.uuid, actualCornea: original.corneaMesh.material.uuid, originalCornea: original.corneaMaterial.uuid,
                donorAttached: donor.attached, borrowedSourceSame: donor.originalGlobeMaterial === original.originalGlobeMaterial,
                borrowedMapSame: donorSource.map === borrowedMap, borrowedMap: borrowedMap.uuid,
                occlusion: avatar.eyeOcclusion.meshes.map(m => ({ mesh: m.uuid, parent: m.parent?.uuid ?? null })),
                originalGeometry: original.geometry, donorGeometry: donor.geometry, originalFrames: frames(original), donorFrames: frames(donor),
                originalUniforms: uniforms(original), donorUniforms: uniforms(donor), originalOptics: optics(original), donorOptics: optics(donor),
                chromaticity: donor.previewIrisChromaticityUniform.value.toArray(), blue: candidate.blue, linear, luma,
                donorResources: { globe: donor.globeMaterial.uuid, unusedCornea: donor.corneaMaterial.uuid, unusedCatchlight: donor.catchlight.texture.uuid },
                donorDisposals: [...donorDisposals], borrowedMapDisposed }, backend: avatar.stage.backendName, webGPU: avatar.stage.renderer.backend.isWebGPUBackend };
    };
    const dispose = () => {
        if (disposed) return retirement; disposed = true; cancelAnimationFrame(frame);
        let restored, snapshotError, disposal;
        try { setArm('original'); } catch (e) { retirementErrors.push('restore: ' + e.message); }
        try { restored = snapshot(); } catch (e) { snapshotError = e.message; }
        try { donor.dispose(); } catch (e) { retirementErrors.push('donor: ' + e.message); }
        const mapDisposedByDonor = borrowedMapDisposed;
        try { avatar.dispose(); disposal = avatar.report().disposal; } catch (e) { retirementErrors.push('Avatar: ' + e.message); }
        return retirement = { restored, snapshotError, donorDisposals: [...donorDisposals], mapDisposedByDonor, retirementErrors: [...retirementErrors], disposal };
    };
    window.irisPigment = { state: snapshot, dispose };
    for (const id of ['original', 'candidate']) document.querySelector('#' + id).onclick = () => setArm(id);
    for (const id of ['front', 'oblique']) document.querySelector('#' + id).onclick = () => setView(id);
    setView('front'); setArm('original');
    const draw = () => { if (disposed) return; sync(); avatar.stage.draw(); frame = requestAnimationFrame(draw); }; draw();
} catch (e) {
    document.querySelector('#error').textContent = e.stack ?? e.message; window.irisPigmentFailure = e.message;
    if (window.irisPigment) {
        window.irisPigmentInitializationRetirement = window.irisPigment.dispose();
    } else {
        disposed = true; cancelAnimationFrame(frame);
        let restored = false, disposal;
        try { if (original) { original.globeMesh.material = original.globeMaterial; restored = original.globeMesh.material === original.globeMaterial; } } catch (failure) { retirementErrors.push('restore: ' + failure.message); }
        try { donor?.dispose(); } catch (failure) { retirementErrors.push('donor: ' + failure.message); }
        const mapDisposedByDonor = borrowedMapDisposed;
        try { avatar?.dispose(); disposal = avatar?.report().disposal; } catch (failure) { retirementErrors.push('Avatar: ' + failure.message); }
        window.irisPigmentInitializationRetirement = retirement = { restored, construction: e.previewConstructionReceipt ?? null, donorDisposals: [...donorDisposals], mapDisposedByDonor, retirementErrors: [...retirementErrors], disposal };
    }
}
addEventListener('pagehide', () => window.irisPigment?.dispose(), { once: true });
