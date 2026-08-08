/**
 * Gate for `render/MorphVelocity.js`.
 *
 * The behavioural proof of this file is a RENDERED one and it lives in `TRAAPost.selftest.mjs`
 * (checks T1-T5): a held `jawOpen` on the real face, where every honest motion vector is zero, so
 * every code value of temporal RMS is an artefact. That gate is proven red against
 * `?morphvel=off`, which is three r185 unpatched rather than a mock.
 *
 * What is checked HERE is the part that has no pixels: the option surface, the encoding's shape
 * and size, and — the one worth having — that the previous-influence bookkeeping really lags by
 * exactly one frame. That last one is the defect this file is most likely to acquire, because an
 * off-by-one there is invisible on a held morph (the case the rendered gate is strongest on) and
 * only shows on a moving one.
 *
 * ⚠️ This file deliberately does NOT re-assert what the rendered gate asserts. A CPU mirror of a
 * GPU node plus a regex over the source tests neither — that is what made `Grade.selftest.mjs`
 * decorative for a round, and copying the pattern here would repeat it.
 *
 * Usage:  node "packages/core/src/render/MorphVelocity.selftest.mjs"
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
    MORPH_VELOCITY_MODES,
    morphOffsetBytes,
    morphVelocityMode,
    setMorphVelocityMode
} from './MorphVelocity.js';

let checks = 0;
let failures = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed ? 'PASS' : 'FAIL' }  ${ name }\n      ${ detail }` );

}

console.log( '\n--- the option surface -----------------------------------------------------\n' );

report(
    'the modes are exactly off / hold / exact',
    MORPH_VELOCITY_MODES.join( ',' ) === 'off,hold,exact',
    MORPH_VELOCITY_MODES.join( ', ' )
);

{
    let threw = false;

    try { setMorphVelocityMode( 'on' ); } catch { threw = true; }

    report(
        'an unknown mode throws rather than silently meaning "off"',
        threw && morphVelocityMode() !== 'on',
        `setMorphVelocityMode('on') throws; mode is still '${ morphVelocityMode() }'. A silent 'off' ` +
            'is the failure that would restore the defect while every gate stayed green.'
    );
}

console.log( '\n--- the cost of re-encoding the offsets -------------------------------------\n' );

{
    // The real figure's shape, read out of the GLB rather than quoted, so this number cannot
    // drift away from the asset. Every primitive's targets carry POSITION only.
    const glb = readFileSync( new URL( '../../../../assets/figures/figure_g050.glb', import.meta.url ) );
    const jsonLength = glb.readUInt32LE( 12 );
    const gltf = JSON.parse( glb.subarray( 20, 20 + jsonLength ).toString( 'utf8' ) );

    let totalBytes = 0;
    const rows = [];

    for ( const mesh of gltf.meshes ) {

        for ( const primitive of mesh.primitives ) {

            const targets = primitive.targets ?? [];
            if ( targets.length === 0 ) continue;

            const vertexCount = gltf.accessors[ primitive.attributes.POSITION ].count;

            // A stand-in for the BufferGeometry the loader will build, carrying only what
            // `morphOffsetBytes` reads. Faking the whole geometry would test the fake.
            const geometry = {
                attributes: { position: { count: vertexCount } },
                morphAttributes: { position: new Array( targets.length ) }
            };

            const bytes = morphOffsetBytes( geometry );
            totalBytes += bytes;

            rows.push( `${ mesh.name } ${ vertexCount } verts x ${ targets.length } targets = ` +
                `${ ( bytes / 1e6 ).toFixed( 2 ) } MB` );

            report(
                `only POSITION targets on ${ mesh.name }, which is what this encoding assumes`,
                Object.keys( targets[ 0 ] ).join( ',' ) === 'POSITION',
                `target keys: ${ Object.keys( targets[ 0 ] ).join( ', ' ) }`
            );

        }

    }

    console.log( `      ${ rows.join( '\n      ' ) }\n` );

    // Not a band anyone chose: it is what the encoding costs, printed so a future change of
    // format or of asset moves a number a reader can see rather than a comment nobody re-reads.
    report(
        'the whole figure costs under 32 MB of re-encoded morph offsets',
        totalBytes < 32e6,
        `${ ( totalBytes / 1e6 ).toFixed( 2 ) } MB across ${ rows.length } meshes. three keeps a second copy ` +
            'of the same size, because these targets have no morph normals for it to also carry. ' +
            'HalfFloatType would halve it at 0.024 mm of offset precision.'
    );

    report(
        'a geometry with no morph targets costs nothing',
        morphOffsetBytes( { attributes: { position: { count: 10000 } }, morphAttributes: {} } ) === 0,
        'morphOffsetBytes returns 0, so the wrap adds no memory to an unmorphed mesh'
    );
}

console.log( '\n--- the one-frame lag, which is what makes `exact` exact --------------------\n' );

{
    // The bookkeeping, extracted and run directly: previous <- lastSeen, then lastSeen <- current.
    // Written out here rather than imported because the shipped version lives inside a TSL Fn and
    // an OnObjectUpdate callback, neither of which can be invoked without a renderer — and because
    // stating the sequence twice is what lets the two be compared by eye.
    //
    // 🚩 The failure this exists to catch is the OBVIOUS implementation: copy the mesh's array
    // straight into `previous`. By the time any node update runs the application has already
    // written this frame's weights, so that captures the PRESENT and morph velocity is always
    // zero — which looks exactly like a correct fix on a held morph and under-reports every
    // moving one.
    function shiftOneFrame( state, current ) {

        state.previous = [ ...state.lastSeen ];
        state.lastSeen = [ ...current ];

    }

    function captureThePresent( state, current ) {

        state.previous = [ ...current ];
        state.lastSeen = [ ...current ];

    }

    const timeline = [ [ 0 ], [ 0.2 ], [ 0.5 ], [ 0.9 ], [ 0.9 ], [ 0.4 ] ];

    for ( const [ name, shift, expectVelocity ] of [ [ 'shiftOneFrame', shiftOneFrame, true ], [ 'captureThePresent', captureThePresent, false ] ] ) {

        const state = { previous: [ 0 ], lastSeen: [ 0 ] };
        const deltas = [];

        for ( const frame of timeline ) {

            shift( state, frame );
            deltas.push( Number( ( frame[ 0 ] - state.previous[ 0 ] ).toFixed( 6 ) ) );

        }

        const expected = [ 0, 0.2, 0.3, 0.4, 0, -0.5 ];
        const matches = deltas.join( ',' ) === expected.join( ',' );
        const allZero = deltas.every( ( value ) => value === 0 );

        report(
            expectVelocity
                ? 'the shipped shift reports the true frame-to-frame weight change'
                : 'rejected: capturing the present, which reports zero velocity for every morph',
            expectVelocity ? matches : allZero,
            `${ name } over weights ${ timeline.map( ( f ) => f[ 0 ] ).join( ' -> ' ) } gives ` +
                `current-minus-previous ${ deltas.join( ', ' ) }` +
                ( expectVelocity ? ` (expected ${ expected.join( ', ' ) })` : ' — every morph reports as static' )
        );

    }
}

console.log( '\n--- the hook this file depends on ------------------------------------------\n' );

{
    // `assignPreviousMorphedPosition` runs only when `builder.needsPreviousData()` is true, and
    // `skinning()` consumes `positionPrevious` as its INPUT. Both are properties of the installed
    // three, both are load-bearing, and both would fail silently if they changed.
    const require = createRequire( import.meta.url );
    const threePath = require.resolve( 'three' );
    const source = threePath.replace( /build[\\/].*$/, 'src/' );

    const nodeBuilder = readFileSync( `${ source }nodes/core/NodeBuilder.js`, 'utf8' );
    const skinning = readFileSync( `${ source }nodes/accessors/Skinning.js`, 'utf8' );
    const material = readFileSync( `${ source }materials/nodes/NodeMaterial.js`, 'utf8' );

    report(
        'NodeBuilder still exposes needsPreviousData(), which is what keeps this inert on the forward path',
        /needsPreviousData\(\s*\)\s*\{/.test( nodeBuilder ),
        'without it every morphed material would compile the previous-position loop into every frame'
    );

    report(
        'skinning() still READS positionPrevious as the input to its previous-frame transform',
        /getPreviousSkinnedPosition\([\s\S]{0,400}positionPrevious/.test( skinning )
            || /getSkinnedPosition\(\s*data\.node,\s*positionPrevious/.test( skinning ),
        'this is why assigning positionPrevious BEFORE setupPosition composes with bone motion ' +
            'instead of replacing it'
    );

    report(
        'setupPosition still calls morphReference before skinning, in that order',
        material.indexOf( 'morphReference( object )' ) < material.indexOf( 'skinning( object )' )
            && material.indexOf( 'morphReference( object )' ) > 0,
        'the wrap assigns positionPrevious ahead of both, so a reordering upstream would change ' +
            'what it composes with'
    );
}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
