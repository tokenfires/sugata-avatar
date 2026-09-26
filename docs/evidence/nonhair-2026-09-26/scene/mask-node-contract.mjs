// CPU-only mechanism reproduction for the two observed GeometryMask compilation errors.
// This does not construct a renderer or claim a repaired browser mask is qualified.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {MeshBasicMaterial, MeshStandardMaterial} from 'three';
import {MeshBasicNodeMaterial} from 'three/webgpu';
import {float} from 'three/tsl';
import {subBuild} from '../../../../node_modules/three/src/nodes/core/SubBuildNode.js';

const messages = [];
const originalError = console.error;
console.error = (...args) => messages.push(args.map(value => String(value)).join(' '));
const report = {version: 1, scope: 'CPU primitive/property-contract reproduction only. Actual source-material census and browser mask checks are separate.', cases: []};
try {
    for (const Material of [MeshBasicMaterial, MeshStandardMaterial]) {
        const original = new Material();
        for (const mode of ['existing-copy', 'preserve-null']) {
            const mask = new MeshBasicNodeMaterial();
            for (const property of ['opacityNode', 'alphaTestNode', 'positionNode']) {
                mask[property] = mode === 'existing-copy' ? original[property] : original[property] ?? null;
            }
            const row = {sourceType: original.type, mode,
                sourceProperties: Object.fromEntries(['opacityNode', 'alphaTestNode', 'positionNode'].map(key => [key, {own: Object.hasOwn(original, key), type: typeof original[key]}])),
                // These predicates are from installed NodeMaterial setupDiffuseColor/setupPosition.
                entersOpacityFloatBranch: Boolean(mask.opacityNode),
                entersAlphaFloatBranch: mask.alphaTestNode !== null,
                entersPositionSubBuildBranch: mask.positionNode !== null};
            const before = messages.length;
            if (row.entersAlphaFloatBranch) float(mask.alphaTestNode);
            row.alphaFloatErrors = messages.slice(before);
            if (row.entersPositionSubBuildBranch) {
                try {
                    subBuild(mask.positionNode, 'POSITION', 'vec3').build({addSubBuild() {}, removeSubBuild() {}});
                    row.positionBuildError = null;
                } catch (error) {row.positionBuildError = error.message;}
            } else row.positionBuildError = null;
            report.cases.push(row);
            mask.dispose();
        }
        original.dispose();
    }
    const shaderNode = float(0.25), source = new MeshBasicNodeMaterial();
    source.alphaTestNode = shaderNode;
    const copied = source.alphaTestNode ?? null;
    report.explicitNodeControl = {nodeIdentityPreserved: copied === shaderNode};
    source.dispose();
} finally {console.error = originalError;}
report.finding = 'For ordinary material instances, undefined alphaTestNode triggers float(undefined), and undefined positionNode triggers SubBuildNode.build on undefined. Undefined opacityNode takes the existing safe materialOpacity fallback. Null preservation avoids both invalid branches while retaining an explicit node.';
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
report.sources = Object.fromEntries([
    '../../../../node_modules/three/src/materials/nodes/NodeMaterial.js',
    '../../../../node_modules/three/src/nodes/core/SubBuildNode.js',
    '../../../../node_modules/three/src/nodes/tsl/TSLCore.js',
    './mask-node-contract.mjs'
].map(relative => [relative, sha(fileURLToPath(new URL(relative, import.meta.url)))]));
const output = fileURLToPath(new URL('./mask-node-contract.json', import.meta.url));
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(report, null, 2));
