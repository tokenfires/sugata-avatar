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

import { PerspectiveCamera, Texture } from 'three/webgpu';
import { texture } from 'three/tsl';

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
    'the resolve does not sharpen by default, because a sharpen put G4 out of band',
    DEFAULT_SHARPNESS === null,
    `DEFAULT_SHARPNESS = ${ DEFAULT_SHARPNESS }. At 3840x5120 on alive.html?bare&freeze, converged: ` +
        'TRAA+grade with RCAS 0.4 here reads G4 2.3867 (FAIL), with RCAS 0.2 in the grade 2.6611 ' +
        '(FAIL), with neither 1.8893 (PASS) against the spec band 1.5-2.1. See the table in TRAAPost.js.'
);


console.log( '\n--- the resolve is handed out AS A TEXTURE, and that is worth 5.6 ms --------\n' );

{
    // 🚩 THE DEFECT THIS GATE EXISTS FOR IS INVISIBLE IN EVERY PIXEL AND COSTS A THIRD OF THE
    // FRAME.
    //
    // `TAAUNode` and `TRAANode` are `TempNode`s, so `isTextureNode` is undefined on both.
    // `Grade.compose` needs a texture-backed input because `BloomNode` samples its source, so it
    // calls `convertToTexture()` — and that helper recognises `isSampleNode`, `isTextureNode` and
    // `isPassNode`, none of which these are (`RTTNode.js:298`). It falls through to `rtt( node )`:
    // a full-resolution HalfFloat render target and a full-resolution pass per frame whose entire
    // output is a copy of `TAAUNode.resolve`, which is already a full-resolution HalfFloat
    // texture (`TAAUNode.js:171`, and `RTTNode` defaults to the same type).
    //
    // Measured on `alive.html?bare&seed=1&capture` at 1920x1080 portrait, 250 samples after 150
    // warm-up frames, three rounds alternating between the two arms on one tree in one session:
    //
    //   handing out the texture   10.371  10.292  11.218   ms p50
    //   handing out the node      15.880  16.519  15.991   ms p50
    //
    // 5.62 ms of median frame at the medians, with no overlap between the two sets — and the
    // 3840x5120 plate is BYTE-IDENTICAL across the change, 0 pixels of 19,660,800 differing, so
    // all seven objective gates are unchanged by construction. It is a copy of a buffer, removed.
    //
    // 🚩 PROVEN RED TWICE, BY REBUILDING THE DEFECT RATHER THAN BY BELIEVING THE COMMENT:
    //
    //   1. `const node = sharpenNode ?? resolved` — the shipped defect. All FOUR rows below go
    //      red: TRAANode, SharpenNode, TAAUNode, SharpenNode, `isTextureNode` undefined on each.
    //   2. `const node = sharpenNode === null ? resolved.getTextureNode() : sharpenNode` — the
    //      HALF fix, which is what a successor writes when they read the default path and stop.
    //      The two `sharpness: null` rows stay green and the two `?sharp=` rows go red, which is
    //      the whole reason this gate sweeps the sharpened branch it does not ship.
    //
    // The four combinations are swept rather than the shipped one asserted, because a gate that
    // only covers the default cannot see defect 2 — and defect 2 is the likelier one.
    const gbuffer = {
        node: () => texture( new Texture() ),
        depthNode: texture( new Texture() ),
        velocityNode: texture( new Texture() )
    };

    for ( const mode of TEMPORAL_AA_MODES.filter( ( name ) => name !== 'off' ) ) {

        for ( const sharpness of [ null, 1.2 ] ) {

            const resolve = createTemporalResolve( { mode, gbuffer, camera: new PerspectiveCamera(), sharpness } );

            report(
                `${ mode } + sharpness ${ sharpness } hands out a texture node, not an RTT to build one from`,
                resolve.node?.isTextureNode === true,
                `${ resolve.node?.constructor?.name ?? 'null' }, isTextureNode ${ resolve.node?.isTextureNode }. ` +
                    'Anything but true means convertToTexture() renders a full-resolution copy of a ' +
                    'full-resolution buffer, once per frame, forever.'
            );

            resolve.dispose();

        }

    }
}

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

        console.log( '      VERDICT: the defect is STILL PRESENT UPSTREAM and is REPAIRED LOCALLY.' );
        console.log( '      three assigns positionPrevious for bones and not for morphs, so a morph held at a' );
        console.log( '      constant weight reports a constant non-zero motion vector. `render/MorphVelocity.js`' );
        console.log( '      supplies the previous-frame morphed position before three\'s own setupPosition runs,' );
        console.log( '      and `Stage` installs it. The rendered gate at the foot of this file measures the' );
        console.log( '      result and proves it red against `?morphvel=off`, which is three unpatched.' );
        console.log( '      When this NOTE flips, delete MorphVelocity.js and re-run that gate — it should stay' );
        console.log( '      green on its own, and if it does not, the upstream fix is not equivalent.' );

    } else {

        console.log( '      VERDICT: the defect appears to be FIXED upstream. `render/MorphVelocity.js` is then' );
        console.log( '      redundant: set `morphVelocity: \'off\'` and re-run the rendered gate below. If T2' );
        console.log( '      stays green without it, delete the file.' );

    }

    // What IS a gate: that this check can still see the two files. A silent path change would
    // turn the note above into a permanent, meaningless "fixed".
    report(
        'the three.js sources this verdict rests on were actually read',
        skinning.length > 1000 && morph.length > 1000,
        `Skinning.js ${ skinning.length } bytes, Morph.js ${ morph.length } bytes, three ${ version }`
    );
}

// ==============================================================================================
// THE RENDERED GATE — and the trap it is built to make impossible
// ==============================================================================================
//
// 🎯 **On a single frozen frame a temporal filter has no history, so it measures like no
// antialiasing at all.** `docs/PROGRESS.md` records `?aa=traa` reading G4 = 4.2333 and correctly
// declines to call it a defect. Anyone who forgets that will "prove" TRAA broken on a `?freeze`
// plate, and their numbers will look clean because they are internally consistent.
//
// Re-measured here on `alive.html?bare&freeze` at 900x1200, with the renderer's frame owned by the
// capture and a ZERO simulation step so the scene is genuinely static:
//
//   TRAA, frame 1     G4 4.2351   311 silhouette transitions, 186 partial pixels
//   TRAA, frame 300   G4 2.8352   152 transitions, 90 partial pixels
//   4x MSAA           G4 2.1860   identical at frames 1 and 300, because a forward frame is static
//
// So the frame-1 reading of a temporal mode is 49% worse than its converged one on the same page
// and the same pixels. The gate below therefore measures a SEQUENCE and asserts that the two
// disagree — a future agent who replaces it with a still plate has to delete a check whose name
// says what they are about to get wrong.
//
// ⚠️ `?freeze` alone is not enough, and this cost a measurement. `alive.js` honours `freeze` in its
// rAF callback and NOT inside `__SUGATA_STEP__`, so a stepped capture of a "frozen" page advances
// the motion stack anyway: measured foreheadRms 3.6400/255 on the MSAA forward path, where the
// correct answer is exactly 0. Stepping with `stepSeconds: 0` is what makes the scene static.
// Filed as a diff request against `alive.js`.

console.log( '\n--- the rendered gate: a sequence, because a still plate cannot see this -------\n' );

{
    const probe = await import( './MotionProbe.mjs' );

    const WIDTH = 900;
    const HEIGHT = 1200;

    /** The jaw box `docs/PROGRESS.md` and punch-list 3.12 both quote, at 900x1200 portrait. */
    const JAW = { x: 200, y: 600, width: 220, height: 120 };

    /** Flat forehead with no morph under it: the jitter floor every reading is stated against. */
    const FOREHEAD = { x: 380, y: 210, width: 160, height: 70 };

    /** Converged. TRAA's residual is flat from frame 60 to frame 300 (0.2739 / 0.3162 / 0.2772). */
    const CONVERGED = 150;

    /**
     * How far above the jitter floor a HELD expression is allowed to read.
     *
     * Not a chosen number: with `morphVelocity: 'off'` the same box reads 15.2x the floor, and with
     * the fix it reads 1.58x. 3.0 sits between them with better than 1.9x of margin on both sides.
     */
    const HELD_MORPH_CEILING_OVER_FLOOR = 3.0;

    let server = null;
    let browser = null;
    const runs = {};

    const RUNS = {
        stillTraa: { query: '?aa=traa&bare', frames: CONVERGED, keep: [ CONVERGED - 1, CONVERGED ] },
        heldFixed: { query: '?aa=traa&bare&hold=0.8&morphvel=exact', frames: CONVERGED, keep: [ CONVERGED - 1, CONVERGED ] },
        heldBroken: { query: '?aa=traa&bare&hold=0.8&morphvel=off', frames: CONVERGED, keep: [ CONVERGED - 1, CONVERGED ] },
        heldHold: { query: '?aa=traa&bare&hold=0.8&morphvel=hold', frames: CONVERGED, keep: [ CONVERGED - 1, CONVERGED ] },
        msaaHeld: { query: '?aa=msaa&bare&hold=0.8', frames: 30, keep: [ 29, 30 ] }
    };

    try {

        server = await probe.startProbeServer( { port: 5185 } );
        browser = await probe.launchProbeBrowser();

        for ( const [ name, run ] of Object.entries( RUNS ) ) {

            const shot = await probe.capturePlates( {
                browser, baseUrl: server.baseUrl, query: run.query,
                width: WIDTH, height: HEIGHT, frames: run.frames, stepSeconds: 0, keep: run.keep
            } );

            if ( shot.errors.length > 0 ) throw new Error( `${ name }: ${ shot.errors.slice( 0, 2 ).join( ' | ' ) }` );

            runs[ name ] = { plates: shot.frames, keep: run.keep, environment: shot.environment };

        }

    } catch ( error ) {

        report( 'the rendered probe came up on a real GPU', false, `it did not: ${ error.message }` );

    }

    if ( runs.heldFixed !== undefined ) {

        const rms = ( run, rect ) =>
            probe.temporalRms( run.plates.get( run.keep[ 0 ] ), run.plates.get( run.keep[ 1 ] ), rect );

        const floor = rms( runs.stillTraa, FOREHEAD );

        console.log( `      post.html at ${ WIDTH }x${ HEIGHT }, jawOpen HELD at 0.8, camera still, ` +
            `converged to frame ${ CONVERGED }.\n      Every honest motion vector in this frame is ZERO, ` +
            'so every code value of temporalRms is an artefact.\n' );

        console.log( '      morphVelocity   jaw box /255   forehead floor /255   ratio' );

        for ( const [ label, key ] of [ [ 'off (three r185)', 'heldBroken' ], [ 'hold', 'heldHold' ], [ 'exact (ships)', 'heldFixed' ] ] ) {

            const jaw = rms( runs[ key ], JAW );
            const control = rms( runs[ key ], FOREHEAD );

            console.log( `      ${ label.padEnd( 15 ) } ${ jaw.toFixed( 4 ).padStart( 12 ) }   ` +
                `${ control.toFixed( 4 ).padStart( 19 ) }   ${ ( jaw / control ).toFixed( 2 ) }x` );

        }

        console.log( `      ${ '4x MSAA'.padEnd( 15 ) } ${ rms( runs.msaaHeld, JAW ).toFixed( 4 ).padStart( 12 ) }   ` +
            `${ rms( runs.msaaHeld, FOREHEAD ).toFixed( 4 ).padStart( 19 ) }   forward path, no velocity buffer\n` );

        // T1 — the instrument is calibrated. A forward MSAA frame of a static scene must be
        // bit-identical, or every number above is a measurement of something else moving.
        {
            const msaaJaw = rms( runs.msaaHeld, JAW );

            report(
                'T1 a forward MSAA frame of a static scene is bit-identical, so the instrument reads zero',
                msaaJaw === 0,
                `MSAA jaw temporalRms ${ msaaJaw.toFixed( 6 ) }/255 with the same morph held`
            );
        }

        // T2 — the fix. Punch-list 3.12's blocker, measured on the real face.
        {
            const jaw = rms( runs.heldFixed, JAW );
            const ratio = jaw / floor;

            report(
                'T2 a HELD morph produces no temporal artefact beyond the jitter floor',
                ratio <= HELD_MORPH_CEILING_OVER_FLOOR,
                `jaw ${ jaw.toFixed( 4 ) }/255 against a floor of ${ floor.toFixed( 4 ) } = ${ ratio.toFixed( 2 ) }x, ` +
                    `ceiling ${ HELD_MORPH_CEILING_OVER_FLOOR }x`
            );
        }

        // T3 — proven red by reintroducing three's own behaviour. `?morphvel=off` is not a mock:
        // it is the unpatched `NodeMaterial.setupPosition`, i.e. exactly what shipped.
        {
            const broken = rms( runs.heldBroken, JAW ) / rms( runs.heldBroken, FOREHEAD );

            report(
                'T3 rejected: three r185 unpatched, where a held morph reports a constant motion vector',
                broken > HELD_MORPH_CEILING_OVER_FLOOR,
                `?morphvel=off reads ${ broken.toFixed( 2 ) }x the floor against the ${ HELD_MORPH_CEILING_OVER_FLOOR }x ceiling ` +
                    `— ${ ( broken / ( rms( runs.heldFixed, JAW ) / floor ) ).toFixed( 1 ) }x worse than the fix`
            );
        }

        // T4 — and broken a DIFFERENT way, which is the check that stops T2 being decorative.
        // `hold` removes the bogus vector without supplying the true one. On a HELD morph the two
        // are the same answer and must agree to the code value; if they ever diverge here, one of
        // them is computing something other than what its name says.
        {
            const exact = rms( runs.heldFixed, JAW );
            const held = rms( runs.heldHold, JAW );

            report(
                'T4 on a held morph the exact previous weights and the current ones agree, as they must',
                Math.abs( exact - held ) < 0.05,
                `exact ${ exact.toFixed( 4 ) } against hold ${ held.toFixed( 4 ) } — the same shader answer by ` +
                    'construction, so a disagreement means the previous-weight bookkeeping is off by a frame'
            );
        }

        // T5 — THE STILL-PLATE TRAP, asserted rather than warned about.
        {
            const early = probe.silhouetteCrossings( runs.stillTraa.plates.get( CONVERGED - 1 ), { y: 300, x0: 2, x1: WIDTH - 2 } );

            report(
                'T5 this gate measured a sequence, not a still plate',
                runs.stillTraa.keep.length >= 2 && CONVERGED >= 60,
                `${ CONVERGED } rendered frames before the reading. A temporal filter has no history on ` +
                    'frame 1 and measures like no antialiasing at all — alive.html reads G4 4.2351 at frame 1 ' +
                    `and 2.8352 at frame 300 on the SAME static scene. Row 300 carries ${ early.crossings } ` +
                    `partial pixels across ${ early.transitions } transitions at convergence.`
            );
        }

    }

    await browser?.close();
    await server?.close();

}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
