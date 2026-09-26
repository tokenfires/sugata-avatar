import assert from 'node:assert/strict';
import { Bone, BoxGeometry, Float32BufferAttribute, Group, Mesh, PerspectiveCamera, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ViewerFraming, flushOrbitDamping } from './viewer-framing.mjs';

let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log('PASS ' + name); };
function viewer() {
    const root = new Group(), head = new Bone(), geometry = new BoxGeometry(.22, .25, .16);
    const indices = new Uint16Array(geometry.attributes.position.count * 4), weights = new Float32Array(indices.length);
    for (let i = 0; i < weights.length; i += 4) weights[i] = 1;
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    const body = new SkinnedMesh(geometry); body.add(head); root.add(body); body.bind(new Skeleton([head]));
    const hairRoot = new Group(), envelope = new Mesh(new BoxGeometry(.28, .3, .22)); hairRoot.add(envelope); root.add(hairRoot);
    const camera = new PerspectiveCamera(26, 1.1, .01, 100); camera.position.set(.19, 0, .89); camera.lookAt(0, 0, 0);
    const controls = new OrbitControls(camera); controls.enableDamping = true; controls.dampingFactor = .1;
    controls.minDistance = .65; controls.maxDistance = 1.4; controls.update();
    const canvas = { clientWidth: 900, clientHeight: 820 };
    const avatar = { stage: { camera }, figure: { root, body, humanoidBones: { head } }, hairRoot };
    const framing = new ViewerFraming(avatar, controls, canvas); framing.setFraming('portrait'); controls.saveState();
    return { camera, controls, canvas, framing };
}
const pose = ({ camera, controls }) => ({ position: camera.position.toArray(), target: controls.target.toArray(), quaternion: camera.quaternion.toArray(), min: controls.minDistance, max: controls.maxDistance });
function resize(subject, width, height) {
    subject.canvas.clientWidth = width; subject.canvas.clientHeight = height;
    subject.camera.aspect = width / height; subject.camera.updateProjectionMatrix(); subject.framing.update();
}
check('measured head and head-region cards fit inside mobile gutters while desktop composition stays exact', () => {
    const subject = viewer(), before = pose(subject); assert.equal(subject.camera.zoom, 1);
    resize(subject, 343, 625); assert.ok(subject.camera.zoom < 1); assert.deepEqual(pose(subject), before);
    for (const point of subject.framing.points) {
        const projected = point.clone().project(subject.camera);
        assert.ok(Math.abs(projected.x) <= 1 - 32 / 343 + 1e-12);
        assert.ok(Math.abs(projected.y) <= 1 - 32 / 625 + 1e-12);
    }
    assert.ok(subject.framing.report().includedCardVertices > 0); assert.ok(subject.framing.report().skinCount > 0);
    assert.ok(subject.framing.report().excludedLowerCardVertices > 0); assert.ok(subject.framing.report().cardEdgeIntersections > 0);
    assert.ok(subject.framing.points.every(point => point.y >= subject.framing.report().headFloorY - 1e-12));
    assert.ok(subject.camera.getEffectiveFOV() > 26);
});
check('resize roundtrips cannot ratchet projection, orbit pose or interactive dolly distance', () => {
    const subject = viewer(); subject.controls.enableDamping = false; subject.controls.rotateLeft(.3); subject.controls.dollyIn(.85);
    const before = pose(subject);
    for (let i = 0; i < 4; i++) {
        resize(subject, 343, 625); const zoom = subject.camera.zoom;
        for (let n = 0; n < 10; n++) assert.equal(subject.framing.update(), false);
        assert.equal(subject.camera.zoom, zoom); resize(subject, 900, 820); assert.equal(subject.camera.zoom, 1);
        assert.deepEqual(pose(subject), before);
    }
});
check('responsive reset clears residual OrbitControls damping and restores its current projection', () => {
    const subject = viewer(), canonical = pose(subject); resize(subject, 343, 625); const zoom = subject.camera.zoom;
    subject.controls.rotateLeft(.4); subject.controls.rotateUp(.15); assert.notDeepEqual(pose(subject).position, canonical.position);
    flushOrbitDamping(subject.controls); subject.controls.reset();
    assert.equal(subject.controls.enableDamping, true); assert.equal(subject.camera.zoom, zoom);
    assert.deepEqual(subject.controls.target.toArray(), canonical.target);
    assert.ok(subject.camera.position.distanceTo(new Vector3(...canonical.position)) < 1e-12);
    const reset = pose(subject); for (let i = 0; i < 20; i++) subject.controls.update(); assert.deepEqual(pose(subject), reset);
});
check('body framing always restores unit zoom and leaves its existing camera radius limits alone', () => {
    const subject = viewer(); resize(subject, 343, 625); const before = pose(subject);
    subject.framing.setFraming('body'); assert.equal(subject.camera.zoom, 1); assert.equal(subject.controls.zoom0, 1);
    assert.deepEqual(pose(subject), before); resize(subject, 280, 900); assert.equal(subject.camera.zoom, 1);
});
check('fractional renderer aspect is respected instead of losing the exact CSS-pixel gutter', () => {
    const subject = viewer(); resize(subject, 343, 540);
    subject.camera.aspect = .6348314606741573; subject.camera.updateProjectionMatrix(); subject.framing.update();
    for (const point of subject.framing.points) assert.ok(Math.abs(point.clone().project(subject.camera).x) <= 1 - 32 / 343 + 1e-12);
});
console.log(`PASS ${checks} viewer framing groups`);
