import { Float32BufferAttribute, Color, SRGBColorSpace } from 'three/webgpu';
import { attribute, vec4 } from 'three/tsl';

// Authored card ordering from hair_cards.py, also pinned by hair_fall.mjs.
// These colours identify source groups; they are not a replacement appearance.
export const layers = [
    { name: 'cap', start: -1, end: 0, hex: '808080' },
    { name: 'root', start: 0, end: 78, hex: 'ff3030' },
    { name: 'mass', start: 78, end: 178, hex: 'f0d020' },
    { name: 'underlayer', start: 178, end: 248, hex: '30d060' },
    { name: 'body', start: 248, end: 296, hex: '20d8e8' },
    { name: 'surface', start: 296, end: 344, hex: '2858ff' },
    { name: 'flyaway', start: 344, end: 372, hex: 'ad40f0' },
    { name: 'veil', start: 372, end: 462, hex: 'ff9828' },
    { name: 'fringe', start: 462, end: 496, hex: 'f040b0' }
];

export function installLayerColours(avatar) {
    const g = avatar.hairDynamics.groom;
    if (g.chainCount !== 496 || g.pointsPerChain !== 17 || g.cardVertexBase !== 652) throw new Error('Layer identity requires the calibrated g050 bob layout.');
    let mesh; avatar.hairRoot.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
    const colours = new Float32Array(g.vertexCount * 3);
    const linear = layers.map(l => new Color().setHex(parseInt(l.hex, 16), SRGBColorSpace).toArray());
    for (let v = 0; v < g.vertexCount; v++) {
        const card = v < g.cardVertexBase ? -1 : Math.floor((v - g.cardVertexBase) / 34);
        const index = layers.findIndex(l => card >= l.start && card < l.end);
        colours.set(linear[index], v * 3);
    }
    mesh.geometry.setAttribute('diagnosticLayerColour', new Float32BufferAttribute(colours, 3));
    const material = avatar.hairMaterial, colour = attribute('diagnosticLayerColour', 'vec3');
    // Preserve the original alpha/root fade and all geometry. Lighting still uses the hair model.
    // Keep the production uniform handle intact for physical-state comparisons.
    material.hair = { ...material.hair, baseColour: colour };
    material.colorNode = vec4(colour, material.colorNode.a);
    material.needsUpdate = true;
    return { layers, limits: ['Group colours pass through production hair lighting and grade.',
        'Source-group names rely on the calibrated card order; they are not GLB semantic metadata.'] };
}

/** A protection-boundary discriminator, preserving the original alpha and geometry. */
export function installRootBoundaryColours(avatar, protectedCards) {
    const g = avatar.hairDynamics.groom;
    if (g.chainCount !== 496 || g.pointsPerChain !== 17 || g.cardVertexBase !== 652)
        throw new Error('Root boundary requires the calibrated g050 bob layout.');
    const protectedSet = new Set(protectedCards);
    if (protectedSet.size !== 338 || protectedCards.some(c => !Number.isInteger(c) || c < 0 || c >= 462))
        throw new Error('Invalid pinned side/posterior region.');
    const protectedRoots = Array.from({ length: 78 }, (_, c) => c).filter(c => protectedSet.has(c));
    const editableRoots = Array.from({ length: 78 }, (_, c) => c).filter(c => !protectedSet.has(c));
    if (protectedRoots.length !== 52 || editableRoots.length !== 26) throw new Error('Unexpected root split.');
    const legend = { cap: '808080', protectedRoots: '2858ff', editableRoots: 'ff3030', otherCards: 'b0b0b0' };
    const linear = Object.fromEntries(Object.entries(legend).map(([key, hex]) => [key, new Color().setHex(parseInt(hex, 16), SRGBColorSpace).toArray()]));
    let mesh; avatar.hairRoot.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
    const colours = new Float32Array(g.vertexCount * 3);
    for (let v = 0; v < g.vertexCount; v++) {
        const card = v < g.cardVertexBase ? -1 : Math.floor((v - g.cardVertexBase) / 34);
        const key = card < 0 ? 'cap' : card >= 78 ? 'otherCards' : protectedSet.has(card) ? 'protectedRoots' : 'editableRoots';
        colours.set(linear[key], v * 3);
    }
    mesh.geometry.setAttribute('diagnosticLayerColour', new Float32BufferAttribute(colours, 3));
    const material = avatar.hairMaterial, colour = attribute('diagnosticLayerColour', 'vec3');
    material.hair = { ...material.hair, baseColour: colour };
    material.colorNode = vec4(colour, material.colorNode.a); material.needsUpdate = true;
    return { legend, protectedRoots, editableRoots, protectedCards,
        limits: ['Group colours pass through hair lighting/grade and alpha compositing.',
            'A visible group colour is not exact card/pixel ownership or a geometry qualification.'] };
}
