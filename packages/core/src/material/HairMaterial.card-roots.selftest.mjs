/** CPU API/graph checks for the optional, verified bob root layout.
 * Run: node packages/core/src/material/HairMaterial.card-roots.selftest.mjs
 * Actual shader execution and appearance are separate browser evidence.
 */
import assert from 'node:assert/strict';
import { Texture } from 'three/webgpu';
import { texture, uniform } from 'three/tsl';
import { createHairMaterial, HairLightingModel } from './HairMaterial.js';
import { configureHairMaterial } from '../render/HairOIT.js';

const withoutSheets = { flowMapUrl: null, depthMapUrl: null };
let passed = 0;
async function check( name, run ) {
    await run();
    passed++;
    console.log( `PASS ${ name }` );
}

await check( 'Standalone callers retain the original flow-map layout by default', async () => {
    const material = await createHairMaterial( withoutSheets );
    try { assert.equal( material.describe().cardRoots, null ); }
    finally { material.dispose(); }
} );

await check( 'The profile is owned and the shadow mask uses the completed root alpha graph', async () => {
    const input = { capStripEnd: 1 / 8, fadeLength: 0.18 };
    const alphaMap = new Texture();
    const material = await createHairMaterial( { ...withoutSheets, alphaMap, cardRoots: input } );
    try {
        const profile = material.describe().cardRoots;
        assert.notEqual( profile, input );
        assert.equal( Object.isFrozen( profile ), true );
        input.fadeLength = 0.9;
        assert.equal( profile.fadeLength, 0.18 );
        const colour = material.colorNode;
        configureHairMaterial( material, 'stochastic' );
        let usesColour = false;
        material.maskShadowNode.traverse( node => { if ( node === colour ) usesColour = true; } );
        assert.ok( usesColour, 'Shadow mask must not keep a pre-feather copy of coverage.' );
    } finally { material.dispose(); alphaMap.dispose(); }
} );

await check( 'Invalid profiles fail before sidecar loading', async () => {
    const bad = [
        { capStripEnd: 0, fadeLength: 0.18 }, { capStripEnd: 1, fadeLength: 0.18 },
        { capStripEnd: Infinity, fadeLength: 0.18 }, { capStripEnd: 0.125, fadeLength: -1 },
        { capStripEnd: 0.125, fadeLength: 1.01 }, { capStripEnd: 0.125, fadeLength: NaN }, {}
    ];
    for ( const cardRoots of bad ) {
        await assert.rejects( createHairMaterial( {
            flowMapUrl: 'must-not-load.png', depthMapUrl: 'must-not-load.png', cardRoots
        } ), { name: 'TypeError', message: /cardRoots requires/ } );
    }
} );

await check( 'Zero feather remains a valid root-parameter-only profile', async () => {
    const material = await createHairMaterial( {
        ...withoutSheets, cardRoots: { capStripEnd: 0.125, fadeLength: 0 }
    } );
    try { assert.equal( material.describe().cardRoots.fadeLength, 0 ); }
    finally { material.dispose(); }
} );

await check( 'Legacy direct lighting-model nodes need no new field', () => {
    const map = new Texture();
    try {
        const model = new HairLightingModel( {
            flowMap: texture( map ), rootOcclusion: uniform( 0.135 ), rootOcclusionLength: uniform( 0.15 )
        } );
        assert.equal( model.rootOcclusion().isNode, true );
    } finally { map.dispose(); }
} );

console.log( `${ passed } card-root CPU groups passed; no GPU appearance claim.` );
