/**
 * Gate for `render/TRAAPost.js`.
 *
 * Most of what this module does needs a GPU and is measured on `packages/testbed/src/post.html`
 * instead. What is checked here is the part that can go wrong silently on any machine:
 *
 *   CONTRACT      The mode list, and that an unknown mode throws rather than quietly rendering
 *                 without antialiasing — which is exactly the failure that shipped.
 *
 *   BUDGET        `TAAU_RESOLUTION_SCALE` and the shaded-pixel fraction it implies, checked
 *                 against the timing PROGRESS.md already measured, so the constant and the
 *                 justification cannot drift apart.
 *
 *   SHARPNESS     `DEFAULT_SHARPNESS` is inside `SharpenNode`'s own 0..2 scale, and is not 2
 *                 (which would be a sharpen pass that costs a full-screen draw and does nothing).
 *
 *   THE BLOCKER   Source-inspects the INSTALLED three.js for the morph-velocity defect: does
 *                 `Skinning.js` assign `positionPrevious`, and does `Morph.js` not? This is the
 *                 one thing standing between 3.12 and flipping the default on `alive.html`, and
 *                 it is a property of a dependency that could change under us. Reported as a
 *                 NOTE with an explicit verdict rather than as a pass/fail, because the day it
 *                 stops being true is good news, and good news must not read as a red gate.
 *
 * A measurement outside its range is a FAIL and exits non-zero. It is not grounds for widening
 * the range.
 *
 * Usage:  node "packages/core/src/render/TRAAPost.selftest.mjs"
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { createTemporalResolve, DEFAULT_SHARPNESS, TAAU_RESOLUTION_SCALE, TEMPORAL_AA_MODES } from './TRAAPost.js';

let checks = 0;
let failures = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed ? 'PASS' : 'FAIL' }  ${ name }\n      ${ detail }` );

}

console.log( '\n--- contract ---------------------------------------------------------------\n' );

report(
    'the mode list is exactly off / traa / taau',
    TEMPORAL_AA_MODES.join( ',' ) === 'off,traa,taau',
    TEMPORAL_AA_MODES.join( ', ' )
);

{
    let threw = false;

    try {

        createTemporalResolve( { mode: 'fxaa', gbuffer: null, camera: null } );

    } catch {

        threw = true;

    }

    report(
        'an unknown mode throws rather than quietly rendering with no antialiasing',
        threw,
        "createTemporalResolve({ mode: 'fxaa' }) throws — the shipped defect was a silent 'off'"
    );
}

console.log( '\n--- the resolution budget --------------------------------------------------\n' );

{
    // Quoted from docs/PROGRESS.md, measured at 1920x1080, WebGPU, 600 samples per variant:
    //   full five-attachment G-buffer  0.721 ms
    //   the same at resolutionScale 0.66  0.393 ms
    const FULL_GBUFFER_MS = 0.721;
    const SCALED_GBUFFER_MS = 0.393;

    const shadedFraction = TAAU_RESOLUTION_SCALE * TAAU_RESOLUTION_SCALE;
    const measuredFraction = SCALED_GBUFFER_MS / FULL_GBUFFER_MS;

    report(
        'the 0.66 scale is the operating point research/rendering-stack.md names',
        TAAU_RESOLUTION_SCALE === 0.66,
        `${ TAAU_RESOLUTION_SCALE } -> ${ ( shadedFraction * 100 ).toFixed( 1 ) }% of the shaded pixels`
    );

    // The two need not agree exactly — the pass has a fixed cost that does not scale — but a
    // large disagreement would mean the constant and the timing describe different things.
    report(
        'the measured G-buffer saving is consistent with the pixel count',
        Math.abs( measuredFraction - shadedFraction ) < 0.12,
        `pixels ${ shadedFraction.toFixed( 3 ) }, measured time ${ measuredFraction.toFixed( 3 ) } ` +
            `(${ SCALED_GBUFFER_MS } / ${ FULL_GBUFFER_MS } ms, PROGRESS.md)`
    );
}

console.log( '\n--- sharpen ----------------------------------------------------------------\n' );

report(
    'the default sharpness is a real setting on SharpenNode\'s 0..2 scale',
    DEFAULT_SHARPNESS > 0 && DEFAULT_SHARPNESS < 2,
    `${ DEFAULT_SHARPNESS } — 0 is maximum sharpening, 2 is a full-screen pass that does nothing`
);

console.log( '\n--- the 3.12 blocker, re-checked against the installed three ---------------\n' );

{
    const require = createRequire( import.meta.url );
    const threePath = require.resolve( 'three' );
    const accessors = threePath.replace( /build[\\/].*$/, 'src/nodes/accessors/' );

    const skinning = readFileSync( `${ accessors }Skinning.js`, 'utf8' );
    const morph = readFileSync( `${ accessors }Morph.js`, 'utf8' );
    const version = JSON.parse( readFileSync( threePath.replace( /build[\\/].*$/, 'package.json' ), 'utf8' ) ).version;

    const skinningWrites = /positionPrevious\.assign/.test( skinning );
    const morphWrites = /positionPrevious/.test( morph );

    const stillBroken = skinningWrites === true && morphWrites === false;

    console.log( `NOTE  three ${ version }: Skinning.js assigns positionPrevious = ${ skinningWrites }, ` +
        `Morph.js touches it = ${ morphWrites }` );

    if ( stillBroken ) {

        console.log( '      VERDICT: the morph-velocity defect is STILL PRESENT. A morph held at a constant' );
        console.log( '      weight reports a constant non-zero motion vector, because the previous-frame' );
        console.log( '      position is reconstructed from un-morphed geometry. Measured consequence on the' );
        console.log( '      real face (post.html, jawOpen held at 0.8, camera still, jaw box 200,600,220,120):' );
        console.log( '        MSAA  temporalRms 0.000/255      <- a still frame really is still' );
        console.log( '        TRAA  temporalRms 4.711/255      <- 18.3x the no-morph control of 0.258' );
        console.log( '        TAAU  temporalRms 4.387/255      <- 29.8x the no-morph control of 0.147' );
        console.log( '      Until this changes, temporal AA fizzes on any held facial expression.' );

    } else {

        console.log( '      VERDICT: the defect appears to be FIXED upstream. Re-measure post.html?hold=0.8' );
        console.log( '      and, if the fizz is gone, punch-list 3.12 can make temporal AA the default.' );

    }

    // What IS a gate: that this check can still see the two files. A silent path change would
    // turn the note above into a permanent, meaningless "fixed".
    report(
        'the three.js sources this verdict rests on were actually read',
        skinning.length > 1000 && morph.length > 1000,
        `Skinning.js ${ skinning.length } bytes, Morph.js ${ morph.length } bytes, three ${ version }`
    );
}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
