#!/usr/bin/env node
// CPU regression for the teeth/tongue mask compilation failure. Uses real Three materials
// and drawGeometryMask; intercepts the final render submission instead of opening a GPU.
import assert from 'node:assert/strict';
import {BoxGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
    PerspectiveCamera, Scene, Texture} from 'three';
import {MeshBasicNodeMaterial} from 'three/webgpu';
import {float, positionLocal, vec3, vec4} from 'three/tsl';
import {drawGeometryMask} from './GeometryMask.js';

const scene = new Scene(), root = new Group(), camera = new PerspectiveCamera();
const geometry = new BoxGeometry(), map = new Texture(), alphaMap = new Texture();
const teethMaterial = new MeshStandardMaterial();
const tongueMaterial = new MeshBasicMaterial();
const nodeMaterial = new MeshBasicNodeMaterial({side: DoubleSide, alphaTest: 0.3,
    alphaToCoverage: true, alphaHash: true, transparent: true, opacity: 0.6, map, alphaMap});
nodeMaterial.colorNode = vec4(vec3(0.2, 0.4, 0.6), 0.35);
nodeMaterial.opacityNode = float(0.45);
nodeMaterial.alphaTestNode = float(0.2);
nodeMaterial.positionNode = positionLocal.add(vec3(0.001, 0, 0));
const originals = [teethMaterial, tongueMaterial, nodeMaterial];
const originalNodes = Object.fromEntries(['colorNode', 'opacityNode', 'alphaTestNode', 'positionNode']
    .map(key => [key, nodeMaterial[key]]));
const teeth = new Mesh(geometry, teethMaterial), mixed = new Mesh(geometry, [tongueMaterial, nodeMaterial]);
const backdropMaterial = new MeshBasicMaterial(), backdrop = new Mesh(geometry, backdropMaterial);
root.add(teeth, mixed); scene.add(root, backdrop);
scene.background = new Color(0xffffff);
scene.fog = {diagnostic: true}; scene.fogNode = float(0.1);

let submitted = false, groups = 0;
const calls = [], replacements = [];
const pass = name => {groups++; console.log(`PASS ${name}`);};
const renderer = {
    setRenderTarget: target => calls.push(['target', target]),
    setMRT: target => calls.push(['mrt', target]),
    setClearColor: (color, alpha) => calls.push(['clear', color, alpha]),
    async renderAsync(actualScene, actualCamera) {
        submitted = true;
        assert.equal(actualScene, scene); assert.equal(actualCamera, camera);
        assert.equal(teeth.material.isMeshBasicNodeMaterial, true);
        assert.equal(Array.isArray(mixed.material), true);
        assert.equal(mixed.material.length, 2);
        replacements.push(teeth.material, ...mixed.material);
        assert.ok(replacements.every(mask => !originals.includes(mask)));
        pass('actual mask pass replaces ordinary and mixed-array materials before submission');

        for (const mask of [teeth.material, mixed.material[0]]) {
            // Null is the installed NodeMaterial sentinel. Undefined enters the invalid
            // alpha-test and position-node shader-builder branches observed in the browser.
            assert.equal(mask.alphaTestNode, null);
            assert.equal(mask.positionNode, null);
            assert.equal(mask.opacityNode, null);
            assert.equal(mask.colorNode, null);
        }
        pass('ordinary material mask nodes keep absent optional fields null');

        const mask = mixed.material[1];
        for (const key of ['opacityNode', 'alphaTestNode', 'positionNode']) assert.equal(mask[key], originalNodes[key]);
        let usesSourceColorAlpha = false;
        mask.colorNode.traverse(node => {if (node === originalNodes.colorNode) usesSourceColorAlpha = true;});
        assert.equal(usesSourceColorAlpha, true);
        for (const key of ['side', 'alphaTest', 'alphaToCoverage', 'alphaHash', 'transparent', 'opacity', 'map', 'alphaMap']) {
            assert.equal(mask[key], nodeMaterial[key], `Lost original alpha/depth control: ${key}`);
        }
        assert.ok(replacements.every(material => material.toneMapped === false));
        pass('explicit deformation, opacity and alpha-test nodes plus alpha controls survive');

        assert.equal(backdrop.visible, false); assert.equal(teeth.visible, true); assert.equal(mixed.visible, true);
        assert.equal(backdrop.material, backdropMaterial);
        assert.equal(scene.background.getHex(), 0);
        assert.equal(scene.fog, null); assert.equal(scene.fogNode, null);
        assert.deepEqual(calls, [['target', null], ['mrt', null], ['clear', 0, 1]]);
        pass('submission isolates figure geometry and bypasses background/fog/render targets');
    }
};

try {
    await drawGeometryMask({stage: {scene, renderer, camera}, figure: {root}});
    assert.equal(submitted, true);
    for (const original of [teethMaterial, tongueMaterial]) {
        for (const key of ['opacityNode', 'alphaTestNode', 'positionNode']) assert.equal(Object.hasOwn(original, key), false);
    }
    for (const [key, value] of Object.entries(originalNodes)) assert.equal(nodeMaterial[key], value);
    pass('source materials remain unchanged');
    console.log(`GeometryMask: ${groups} groups passed (CPU only; browser rendering qualified separately).`);
} finally {
    for (const material of [...originals, backdropMaterial, ...replacements]) material.dispose();
    geometry.dispose(); map.dispose(); alphaMap.dispose();
}
