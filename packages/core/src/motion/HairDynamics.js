/**
 * HairDynamics — the groom moves with the head. Punch-list 6.6, the runtime half.
 *
 * `docs/research/hair-motion.md` is the spec and it was written from the primary papers: Müller,
 * Kim & Chentanez's *Fast Simulation of Inextensible Hair and Fur* (VRIPHYS 2012) for DFTL, AMD's
 * `TressFXSimulation.hlsl` for the global shape constraint, and three r185's own compute path. That
 * document's §8.1 recommendation is what this file is: **DFTL on the card centrelines, one WebGPU
 * compute pass, with a TressFX global shape constraint.** Read it before changing anything here;
 * every constant below either carries its source or says out loud that it was chosen.
 *
 * ## The five things this file has to get right, and where each one lives
 *
 *   1. **Inextensibility.** FTL projects particle `i` onto the sphere of radius `l₀` about `i−1`
 *      and does not move `i−1`. One pass, exact, no iteration count — `solveKernel`, and the
 *      research doc's §3.4 measures it as worth twenty-five PBD iterations of visual behaviour.
 *   2. **Head coupling.** The root of every chain is kinematic and sits wherever the head bone put
 *      the authored rest position this frame. That is the ENTIRE input to the simulation, and it is
 *      why `setHeadMatrix` is the only thing the page has to call.
 *   3. **A fixed timestep.** `update()` accumulates real time and runs whole `SUBSTEP_SECONDS`
 *      steps. LEARNINGS §1.13: a layer advanced once per FRAME has a trajectory that depends on
 *      frame rate, and no rate or amplitude gate can see it. `?hairstep=perframe` on the testbed
 *      page is that defect, kept reachable so the gate has something to go red on.
 *   4. **Collision that does not fight the length constraint.** See `slideOntoCollider` — this is
 *      the one place the implementation departs from both TressFX and the spike, deliberately, and
 *      the reason is measured rather than argued.
 *   5. **Determinism.** No random number is drawn here and no wall clock is read. The state after
 *      N calls to `update()` is a pure function of the deltas and head matrices it was given, so a
 *      `?capture` driver that supplies a fixed step reproduces frame for frame — provided it calls
 *      `reset()` when it takes the loop over, because rAF frames during an async boot are state
 *      like any other. `alive-capture-determinism.selftest.mjs` is the gate that cares.
 *
 * ## 🚩 What this file measured that the research doc got wrong, off the shipped GLB
 *
 * **The guide curves are NOT uniformly resampled, so one rest length per chain is wrong.**
 * `hair-motion.md` §9.1 states *"`hair_cards.resample` now spaces a guide's rings uniformly along
 * its own arc, so the rest segment length really is constant along a chain — which is the
 * assumption `hair-dftl.js` stores one float per chain on."* Measured 2026-08-13 off
 * `assets/hair/bob01/g050.glb` (the 21:12 bake, 10,648 vertices), ring midpoints per card:
 *
 *   | within-card segment spread (max−min)/max | median **38.91%** | p90 **72.49%** | max **100.00%** |
 *
 * with individual segments from **0.000 mm to 95.375 mm** inside a single card. `grow_to_cut` does
 * return a uniform curve — and then `draw_into_lock` blends it toward its lock and runs
 * `CLUMP_CLEARANCE_PASSES` push-outs over the result, and `clamp_cards_off_the_body` moves ribbon
 * corners after that. Uniformity does not survive either. So the rest length is stored **per
 * segment**, one float per particle, which costs 20 kB and is the difference between a solver that
 * holds the authored shape and one that pulls every card straight.
 *
 * ## 🎯 And what that buys: the generator does not have to change at all
 *
 * `hair-motion.md` §8.3 asks `hair_cards.py` to export the centreline, the per-ring half-width, the
 * per-card twist and a ring index. None of that is needed. A card is 17 rings of two edge vertices
 * and the ribbon is symmetric about its guide, so
 *
 *     centre[k] = ½( v[2k] + v[2k+1] )          offset[k] = ½( v[2k+1] − v[2k] )
 *
 * recovers the guide and the half-width vector — twist included, because the twist is already in
 * the direction of `offset` — from the shipped positions. `deriveCardGroom` does that at load time
 * and asserts the layout it depends on rather than trusting this paragraph (§"the layout assertion"
 * below). The card frame is then transported by the minimal rotation from the rest tangent to the
 * current one, so the rebuild is **exactly the identity while the groom is at rest** — which is a
 * gate rather than a hope, and it is the check that would catch the frame flip §5.2 of the research
 * doc warns about.
 *
 * ## Submission shape, which is 93% of the cost
 *
 * Research doc §0.3, measured: `renderer.compute()` opens one WebGPU compute pass per call at
 * **30.8–54.1 µs**, and an extra dispatch INSIDE a pass costs **≈2.3–5.1 µs**. Writing one
 * `compute()` per kernel per substep therefore costs about ten times the simulation. This module
 * owns its own submission for exactly that reason — `update()` takes the renderer and issues **one
 * array-shaped `renderer.compute()` per frame**, whatever the substep count. A caller who wants the
 * kernels for its own pass can have `computeNodesFor( substeps )`, and the header comment there
 * says what it must not do with them.
 *
 * ## What is NOT here, named so its absence is not read as a claim
 *
 * Local shape (bend) constraints, hair–hair repulsion, wind, SDF collision, and per-card twist
 * dynamics. The collider is one sphere and one capsule. `hair-motion.md` §5.3 and §9.3 carry the
 * consequences; the loudest is that two cards whose centrelines are 3 mm apart and whose half
 * widths are 16 mm overlap completely and the solver is content, which is why the global shape
 * constraint is not allowed to go soft.
 */

import { Matrix3, Matrix4, Quaternion, Vector3, Vector4 } from 'three';
import {
    Fn, If, Loop, instancedArray, instanceIndex, uniform, positionLocal, vertexIndex,
    vec3, vec4, float, uint, cross, normalize, length, min, max, clamp, select, sqrt
} from 'three/tsl';

/**
 * The simulation step, in seconds, and the number of them a frame may run.
 *
 * 1/120 with a cap of 4 is punch-list 6.6's 60 Hz taken at the research doc's **two substeps**
 * (§8.1), which is where the spike measured: 0.01361 ms median for the pair against 0.00842 ms for
 * one, i.e. 1.6× the cost for meaningfully better shock response. The cap is what stops a frame
 * that arrived late — a tab restored, a shader compile — from spiralling: at 4 the solver gives up
 * on catching up rather than running a hundred steps and stalling the frame that was already late.
 */
const SUBSTEP_SECONDS = 1 / 120;
const MAX_SUBSTEPS_PER_FRAME = 4;

/**
 * The starting parameters, each with its provenance. Two of the five are sourced and three are not,
 * and the three are marked, because a tuned number presented as a citation is how a groom ends up
 * with an authority nobody can find.
 */
export const HAIR_DYNAMICS_DEFAULTS = {
    /** FTL paper §3.3, Figure 4's own worked value. 1.0 fully compensates the uneven masses "but
     *  with the introduction of numerical damping"; the caption recommends "smaller but close". */
    dampingScale: 0.9,

    /** TressFX's `g_Shape.z`, at the ROOT end. ⚠️ CHOSEN, NOT SOURCED — no default ships in
     *  `TressFXSimulation.hlsl` (research doc §4.3). */
    globalStiffness: 0.30,

    /** 🎯 The same constraint at the TIP, and this pair replaces TressFX's stiffness-plus-range.
     *
     *  `globalShapeMatchingEffectiveRange` switches the constraint off at a ring boundary, which on
     *  a 17-ring card is a kink at the ring where the hair stops being held — and taking the hold
     *  to zero at all is what a bob cannot survive. Measured on this groom, `?head=impulse`, root
     *  0.30 with the hold ramped to zero over the whole chain: the tips carry 86 mm of permanent
     *  sag and the settled plate is a head with the bob hanging off the back of it. DFTL has no
     *  bending stiffness (research doc §4.4 — local shape constraints are "the piece DFTL does not
     *  have"), so the global constraint is the ONLY thing holding a style, and it may soften toward
     *  the tip but it may not stop.
     *
     *  ⚠️ CHOSEN, and swept rather than reasoned. Measured on this groom at
     *  `hair.html?motion=1&head=impulse&capture`, 2 s of ±0.85 rad shake and then 4 s held, root
     *  fixed at 0.30, gravity applied as a difference (see `setHeadMatrix`):
     *
     *    | tip  | peak worst-tip lag | peak mean-tip lag | settled mean | 0.25 s quiescence |
     *    |------|-------------------:|------------------:|-------------:|------------------:|
     *    | 0.10 |            15.8 mm |            3.8 mm |      1.05 mm |         0.0011 mm |
     *    | 0.05 |            26.7 mm |           11.5 mm |      2.06 mm |         0.0023 mm |
     *    | 0.03 |        **56.6 mm** |       **20.1 mm** |  **3.38 mm** |     **0.0283 mm** |
     *    | 0.02 |            69.1 mm |           24.7 mm |      4.97 mm |         0.0856 mm |
     *    | 0.01 |            97.4 mm |           32.0 mm |      9.15 mm |         0.9636 mm |
     *
     *  0.03 is where the mean tip swings two centimetres on a violent shake — visible at portrait
     *  framing by an order of magnitude — and still returns to within 3.4 mm of the authored
     *  silhouette and stops moving. At 0.01 it is still drifting a millimetre a quarter second
     *  after the head stopped, which reads as a wig settling rather than as hair.
     *
     *  ⚠️ The table was taken with ONE tip stiffness for the whole groom, before
     *  `chainComplianceBuffer` scaled it per card. The shipped figures are whatever
     *  `HairDynamics.selftest.mjs` prints; on the run that wrote this line they were 20.6 mm of
     *  peak mean tip lag and 0.0328 mm of quiescence six seconds after the head stopped. */
    globalTipStiffness: 0.03,

    /** m/s², and it is applied as a DIFFERENCE from the pose the groom was authored in — see
     *  `setHeadMatrix`. Full gravity on top of a rest pose that already carries it is a double
     *  count, and this groom's does: `hair_cards.py:1123` bends every guide by
     *  `GRAVITY_PER_SEGMENT · layer.gravity · s^GRAVITY_POWER` (0.41 and 1.60 at :398–399). */
    gravity: - 9.81,

    /** Per-second exponential velocity decay, applied as `exp( −drag·h )` so it is framerate
     *  independent the way TressFX's `Integrate` is (research doc §4.1). ⚠️ CHOSEN. */
    drag: 1.2
};

/**
 * Reads a card groom out of a `BufferGeometry` and returns everything the solver needs.
 *
 * ## The layout this depends on, and the assertion that holds it
 *
 * A card is a quad strip of `rings × 2` vertices in ring-major order with the two edge vertices of
 * a ring ADJACENT — `v[2k]` and `v[2k+1]` are the two sides of ring `k`. Measured off
 * `assets/hair/bob01/g050.glb`: 296 connected components, 294 of exactly 34 vertices and 2 of 326
 * (the scalp cap shells), every one of the 294 a CONTIGUOUS run of vertex indices, and the cards
 * occupy 652…10,647 with the caps first. Ring-major was discriminated against the strip-major
 * alternative by the ring widths: card 0 reads 35.4 → 25.9 mm monotonically under ring-major, which
 * is `ribbon_of`'s `TIP_WIDTH_FRACTION` taper, and a noisy 46–57 mm under strip-major.
 *
 * 🚩 But a measurement of today's bake is not a property of the loader, and the groom has already
 * changed under one round (research doc §0.1). So the layout is ASSERTED from the index buffer
 * rather than assumed: `{2k, 2k+1}` must be a triangle edge for every ring of every card. A bake
 * that reorders its vertices fails here, by name, on the first frame — instead of producing a groom
 * that simulates something other than its own guides and looks merely wrong.
 *
 * @param {BufferGeometry} geometry - the groom's geometry, indexed.
 * @returns {Object} the groom description `createHairDynamics` consumes.
 */
export function deriveCardGroom( geometry ) {

    const position = geometry.getAttribute( 'position' );
    const index = geometry.getIndex();

    if ( index === null ) throw new Error( 'HairDynamics: the groom geometry is not indexed, so its cards cannot be found.' );

    const vertexCount = position.count;
    const components = connectedComponents( index.array, vertexCount );

    // The cards are the components that are not the caps. Rather than hard-code 34, take the most
    // common component size that is even and at least three rings: the caps are two components and
    // the cards are hundreds, so the mode is the card.
    const sizeCounts = new Map();
    for ( const component of components ) sizeCounts.set( component.length, ( sizeCounts.get( component.length ) ?? 0 ) + 1 );

    let cardSize = 0;
    let cardCount = 0;
    for ( const [ size, count ] of sizeCounts ) {

        if ( size % 2 !== 0 || size < 6 ) continue;
        if ( count > cardCount ) { cardSize = size; cardCount = count; }

    }

    if ( cardCount === 0 ) throw new Error( 'HairDynamics: no card-shaped component in the groom.' );

    const pointsPerChain = cardSize / 2;
    const cards = components.filter( ( component ) => component.length === cardSize );

    // Contiguity, and where the cards start. Everything before `cardVertexBase` keeps its skinning
    // — the scalp caps are part of the head, not of the hair that swings.
    let cardVertexBase = Infinity;
    for ( const card of cards ) {

        card.sort( ( a, b ) => a - b );
        if ( card[ card.length - 1 ] - card[ 0 ] !== cardSize - 1 ) {

            throw new Error( `HairDynamics: card at vertex ${ card[ 0 ] } is not a contiguous run of ` +
                `${ cardSize } vertices. The bake reordered its vertices and this loader reads them by index.` );

        }
        cardVertexBase = Math.min( cardVertexBase, card[ 0 ] );

    }

    for ( let card = 0; card < cards.length; card ++ ) {

        const expected = cardVertexBase + card * cardSize;
        if ( cards[ card ][ 0 ] !== expected ) {

            throw new Error( `HairDynamics: card ${ card } starts at vertex ${ cards[ card ][ 0 ] }, not ` +
                `${ expected }. The cards are not one unbroken block and this loader indexes them as if they were.` );

        }

    }

    assertRingMajor( index.array, cardVertexBase, cards.length, pointsPerChain );

    // --- the rest state, all in the mesh's own local (bind) space ---------------------------------

    const particleCount = cards.length * pointsPerChain;
    const restCentres = new Float32Array( particleCount * 3 );
    const restOffsets = new Float32Array( particleCount * 3 );
    const restLengths = new Float32Array( particleCount );

    for ( let card = 0; card < cards.length; card ++ ) {

        const vertexBase = cardVertexBase + card * cardSize;

        for ( let ring = 0; ring < pointsPerChain; ring ++ ) {

            const particle = card * pointsPerChain + ring;
            const left = vertexBase + ring * 2;
            const right = left + 1;

            for ( let axis = 0; axis < 3; axis ++ ) {

                const a = position.array[ left * position.itemSize + axis ];
                const b = position.array[ right * position.itemSize + axis ];
                restCentres[ particle * 3 + axis ] = ( a + b ) / 2;
                restOffsets[ particle * 3 + axis ] = ( b - a ) / 2;

            }

            // Per SEGMENT, not per chain. See the file header: the shipped groom's rings are not
            // uniformly spaced along their own arc and one float per chain straightens every card.
            if ( ring > 0 ) {

                const previous = ( particle - 1 ) * 3;
                const current = particle * 3;
                restLengths[ particle ] = Math.hypot(
                    restCentres[ current ] - restCentres[ previous ],
                    restCentres[ current + 1 ] - restCentres[ previous + 1 ],
                    restCentres[ current + 2 ] - restCentres[ previous + 2 ]
                );

            }

        }

    }

    // The arc a card covers, which is the only per-card property the solver varies anything by.
    // See `chainComplianceBuffer`.
    const arcLengths = new Float32Array( cards.length );
    for ( let card = 0; card < cards.length; card ++ ) {

        let arc = 0;
        for ( let ring = 1; ring < pointsPerChain; ring ++ ) arc += restLengths[ card * pointsPerChain + ring ];
        arcLengths[ card ] = arc;

    }

    return {
        chainCount: cards.length,
        pointsPerChain,
        particleCount,
        cardVertexBase,
        cardVertexCount: cards.length * cardSize,
        vertexCount,
        restCentres,
        restOffsets,
        restLengths,
        arcLengths
    };

}

/** Union-find over the index buffer. One component per card, plus one per cap shell. */
function connectedComponents( indices, vertexCount ) {

    const parent = new Int32Array( vertexCount );
    for ( let vertex = 0; vertex < vertexCount; vertex ++ ) parent[ vertex ] = vertex;

    const find = ( vertex ) => {

        while ( parent[ vertex ] !== vertex ) {

            parent[ vertex ] = parent[ parent[ vertex ] ];
            vertex = parent[ vertex ];

        }

        return vertex;

    };

    for ( let triangle = 0; triangle < indices.length; triangle += 3 ) {

        const a = find( indices[ triangle ] );
        const b = find( indices[ triangle + 1 ] );
        const c = find( indices[ triangle + 2 ] );
        if ( a !== b ) parent[ a ] = b;
        if ( find( b ) !== c ) parent[ find( b ) ] = c;

    }

    const groups = new Map();
    for ( let vertex = 0; vertex < vertexCount; vertex ++ ) {

        const root = find( vertex );
        const group = groups.get( root );
        if ( group === undefined ) groups.set( root, [ vertex ] ); else group.push( vertex );

    }

    return [ ...groups.values() ];

}

/**
 * The least-squares sphere through a point cloud, by the standard linearisation.
 *
 * `|p − c|² = r²` expands to `2c·p + (r² − |c|²) = |p|²`, which is linear in the four unknowns
 * `(c, r² − |c|²)`. Four normal equations, one Gaussian elimination, no iteration — and no
 * dependency, which is the point: this is thirty lines against a library.
 */
function sphereThrough( points ) {

    const normal = [ [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ];
    const rightHand = [ 0, 0, 0, 0 ];

    for ( const point of points ) {

        const row = [ 2 * point.x, 2 * point.y, 2 * point.z, 1 ];
        const squared = point.x * point.x + point.y * point.y + point.z * point.z;

        for ( let i = 0; i < 4; i ++ ) {

            for ( let j = 0; j < 4; j ++ ) normal[ i ][ j ] += row[ i ] * row[ j ];
            rightHand[ i ] += row[ i ] * squared;

        }

    }

    for ( let column = 0; column < 4; column ++ ) {

        let pivot = column;
        for ( let row = column + 1; row < 4; row ++ ) {

            if ( Math.abs( normal[ row ][ column ] ) > Math.abs( normal[ pivot ][ column ] ) ) pivot = row;

        }

        [ normal[ column ], normal[ pivot ] ] = [ normal[ pivot ], normal[ column ] ];
        [ rightHand[ column ], rightHand[ pivot ] ] = [ rightHand[ pivot ], rightHand[ column ] ];

        for ( let row = column + 1; row < 4; row ++ ) {

            const factor = normal[ row ][ column ] / normal[ column ][ column ];
            for ( let j = column; j < 4; j ++ ) normal[ row ][ j ] -= factor * normal[ column ][ j ];
            rightHand[ row ] -= factor * rightHand[ column ];

        }

    }

    const solution = [ 0, 0, 0, 0 ];
    for ( let row = 3; row >= 0; row -- ) {

        let value = rightHand[ row ];
        for ( let column = row + 1; column < 4; column ++ ) value -= normal[ row ][ column ] * solution[ column ];
        solution[ row ] = value / normal[ row ][ row ];

    }

    const centre = new Vector3( solution[ 0 ], solution[ 1 ], solution[ 2 ] );

    return { centre, radius: Math.sqrt( Math.max( solution[ 3 ] + centre.lengthSq(), 0 ) ) };

}

/**
 * Every ring's two edge vertices must be joined by a triangle edge. See `deriveCardGroom`'s header
 * for why this is asserted rather than measured once and written into a comment.
 */
function assertRingMajor( indices, cardVertexBase, cardCount, pointsPerChain ) {

    const edges = new Set();
    for ( let triangle = 0; triangle < indices.length; triangle += 3 ) {

        const a = indices[ triangle ];
        const b = indices[ triangle + 1 ];
        const c = indices[ triangle + 2 ];
        edges.add( a < b ? `${ a }:${ b }` : `${ b }:${ a }` );
        edges.add( b < c ? `${ b }:${ c }` : `${ c }:${ b }` );
        edges.add( a < c ? `${ a }:${ c }` : `${ c }:${ a }` );

    }

    const cardSize = pointsPerChain * 2;

    for ( let card = 0; card < cardCount; card ++ ) {

        for ( let ring = 0; ring < pointsPerChain; ring ++ ) {

            const left = cardVertexBase + card * cardSize + ring * 2;
            if ( edges.has( `${ left }:${ left + 1 }` ) === false ) {

                throw new Error( `HairDynamics: card ${ card } ring ${ ring } — vertices ${ left } and ` +
                    `${ left + 1 } are not joined by a triangle, so this groom is not ring-major with ` +
                    'adjacent edge pairs. The centreline recovered from it would not be a centreline.' );

            }

        }

    }

}

/**
 * Builds the solver for one groom.
 *
 * @param {Object} options
 * @param {Object} options.renderer - a WebGPURenderer. Owned here so the submission stays ONE pass.
 * @param {Object} options.geometry - the groom's `BufferGeometry`.
 * @param {Object} [options.settings] - overrides for `HAIR_DYNAMICS_DEFAULTS`.
 * @param {number} [options.colliderMargin=0.0] - metres subtracted from the fitted skull radius.
 * @returns {Object} the running solver.
 */
export function createHairDynamics( { renderer, geometry, settings = {}, colliderMargin = 0,
    submit = 'onepass' } ) {

    const groom = deriveCardGroom( geometry );
    const { chainCount, pointsPerChain, particleCount, cardVertexBase } = groom;
    const tuning = { ...HAIR_DYNAMICS_DEFAULTS, ...settings };

    // --- state ------------------------------------------------------------------------------
    //
    // Positions and velocities are WORLD space; the rest buffers are the mesh's own local space and
    // are moved into world by `headMatrix` every time they are read. That split is what makes the
    // head the only input: nothing on the CPU ever rewrites a rest position.

    const positionBuffer = instancedArray( new Float32Array( particleCount * 3 ), 'vec3' );
    const velocityBuffer = instancedArray( particleCount, 'vec3' );
    const restCentreBuffer = instancedArray( new Float32Array( groom.restCentres ), 'vec3' );
    const restOffsetBuffer = instancedArray( new Float32Array( groom.restOffsets ), 'vec3' );
    const restLengthBuffer = instancedArray( new Float32Array( groom.restLengths ), 'float' );

    // FTL's correction vector `d_i`, kept because DFTL eq 9 needs `d_{i+1}` when it reaches `i`.
    // One invocation owns a whole chain, so nothing here crosses a thread boundary.
    const correctionBuffer = instancedArray( particleCount, 'vec3' );

    /**
     * 🎯 A PER-CARD SOFTNESS, SCALED BY THE CARD'S OWN LENGTH — and it is here because of something
     * that was seen rather than measured.
     *
     * With one stiffness for the whole groom, a head turn moves every card by very nearly the same
     * amount, because every card is held to its own rest by the same spring against the same
     * rotation. The mass slides as ONE PIECE: the plate at `?head=impulse` t = 2.117 s is a cap of
     * hair displaced backwards off a bald crown, which is the same defect the blind critic reported
     * of the static groom — *"no clumping into locks anywhere; nothing separates into a strand
     * group"* — with motion making it louder rather than quieter.
     *
     * A longer card is a heavier one and it should lag further. This groom's arcs run **76.8 mm to
     * 491.8 mm with a median of 187.1 mm** (measured off `g050.glb`), which is a 6.4x spread already
     * in the asset and free to read. So the tip stiffness is divided by the card's length relative
     * to the median and clamped, and the differential that produces is what separates the layers.
     *
     * ⚠️ NOT a random jitter, deliberately. A per-card random number is state a capture has to
     * reproduce and a seed somebody has to own; a ratio read off the geometry is neither, and it is
     * the physically right variable besides.
     */
    const arcs = [ ...groom.arcLengths ].sort( ( a, b ) => a - b );
    const medianArc = Math.max( arcs[ Math.floor( arcs.length / 2 ) ], 1e-6 );
    const chainCompliance = new Float32Array( chainCount );

    for ( let chain = 0; chain < chainCount; chain ++ ) {

        chainCompliance[ chain ] = Math.min( Math.max(
            medianArc / Math.max( groom.arcLengths[ chain ], 1e-6 ), 0.3 ), 3 );

    }

    const chainComplianceBuffer = instancedArray( chainCompliance, 'float' );

    // The two ribbon vertices per ring, in the MESH's local space, which is what `positionNode`
    // hands three. Converting in the rebuild rather than in the vertex stage is not a micro
    // optimisation: the vertex stage runs once per vertex per PASS — depth, shadow, beauty — and
    // the rebuild runs once per vertex per frame.
    const cardVertexBuffer = instancedArray( groom.cardVertexCount, 'vec3' );

    // --- uniforms ---------------------------------------------------------------------------

    /**
     * 🎯 ONE HEAD MATRIX PER SUBSTEP, and this is what makes the solver frame-rate invariant rather
     * than merely fixed-step.
     *
     * The root of every chain is kinematic, so the head's path IS the simulation's input. A page
     * calls `setHeadMatrix` once a frame, so at 60 fps both substeps would see the same pose and at
     * 120 fps each frame would see its own — and the two rates would trace different root paths
     * through the same motion. Measured before this was added, `?head=shake` to t = 2.0 s: 60 Hz
     * against 120 Hz differed by **4.20 mm mean / 31.10 mm worst** over the 294 tips, on a mean tip
     * displacement of 18.5 mm. That is 23% of the signal, and LEARNINGS §1.13 is about exactly this
     * class of thing being invisible to an amplitude gate.
     *
     * ⚠️ It has to be one uniform PER SUBSTEP NODE rather than one uniform rewritten between
     * dispatches: every substep goes into a single `renderer.compute( array )` (research doc §0.3),
     * and a uniform is uploaded once for that submission. So the substeps are distinct compute
     * nodes with distinct head uniforms, and `update()` fills the first `n` of them with the
     * interpolated poses.
     */
    const substepHeadMatrices = [];
    for ( let substep = 0; substep < MAX_SUBSTEPS_PER_FRAME; substep ++ ) {

        substepHeadMatrices.push( uniform( new Matrix4() ) );

    }

    const uniforms = {
        /** mesh.matrixWorld · headBone.matrixWorld · boneInverse[head], at the END of the frame.
         *  The substeps use `substepHeadMatrices`; this is what the rebuild and the CPU read. */
        headMatrix: uniform( new Matrix4() ),
        /** Its rotation part, for carrying the rest ribbon offset — a direction, not a point. */
        headRotation: uniform( new Matrix3() ),
        /** The inverse of mesh.matrixWorld, so the rebuild can emit `positionLocal` directly. */
        worldToObject: uniform( new Matrix4() ),

        deltaTime: uniform( SUBSTEP_SECONDS ),
        gravity: uniform( new Vector3( 0, tuning.gravity, 0 ) ),
        dampingScale: uniform( tuning.dampingScale ),
        velocityDecay: uniform( Math.exp( - tuning.drag * SUBSTEP_SECONDS ) ),
        globalStiffness: uniform( tuning.globalStiffness ),
        globalTipStiffness: uniform( tuning.globalTipStiffness ),

        /** Skull sphere, world space, xyz = centre, w = radius. Fitted in `fitColliders`. */
        skull: uniform( new Vector4( 0, 0, 0, 0 ) ),
        capsuleA: uniform( new Vector3() ),
        capsuleB: uniform( new Vector3() ),
        capsuleRadius: uniform( 0 ),

        // --- the switches a gate needs, every one of them a defect except the first two --------
        collideEnabled: uniform( 1 ),
        resetPositions: uniform( 1 ),
        /** 🚩 The red proof for inextensibility: keeps prediction, gravity, the shape constraint
         *  and the colliders and removes ONLY the FTL projection. */
        ftlEnabled: uniform( 1 ),
        /** 🚩 The red proof for "the hair moves": pins every particle to the rigid pose. If a
         *  movement check stays green under this, it is measuring the head transform. */
        kinematic: uniform( 0 ),
        /** 🚩 The red proof for settling: PBD's velocity update (eq 13) is skipped, which is the
         *  classic omission — the solver keeps correcting positions and never spends the energy. */
        velocityUpdateEnabled: uniform( 1 ),

        /** 🚩 The red proof for "the authored pose is the equilibrium": read on the CPU by
         *  `setHeadMatrix`, and at 0 the full 9.81 m/s² is applied instead of the change in it, so
         *  the groom sags away from the silhouette it was authored with and never comes back. */
        restGravityEnabled: uniform( 1 )
    };

    const POINTS = uint( pointsPerChain );

    /** Rest centre `index`, moved into world space by a given head transform. */
    const restWorldAt = ( headUniform, index ) =>
        headUniform.mul( vec4( restCentreBuffer.element( index ), 1 ) ).xyz;

    /**
     * The minimal rotation taking unit `from` to unit `to`, applied to `vector`.
     *
     * Two Householder reflections rather than an axis-angle: `g(v) = 2(a·v)a − v` is a half turn
     * about `a`, `f(w) = 2(ĥ·w)ĥ − w` a half turn about `ĥ = normalize(a+b)`, and the composition
     * is the rotation about `a × b` that takes `a` to `b`. No trigonometry, no matrix, and — the
     * property this file needs — **exactly the identity when `from === to`**, which is what makes
     * the rebuilt groom bit-identical to the authored one at rest.
     *
     * Degenerate at `to ≈ −from`, where `a+b` vanishes; the caller guards it.
     */
    // ⚠️ `from` and `to` are RESERVED WORDS in WGSL and `setLayout` passes a parameter name straight
    // through to the generated function signature. Naming them that way compiles to
    // `'from' is a reserved keyword`, which arrives as a pipeline validation error a hundred frames
    // deep in the console rather than as anything pointing at this file.
    const rotateBetween = Fn( ( [ restDirection, liveDirection, vector ] ) => {

        const halfTurn = restDirection.mul( restDirection.dot( vector ).mul( 2 ) ).sub( vector ).toVar();
        const bisector = normalize( restDirection.add( liveDirection ) ).toVar();

        return bisector.mul( bisector.dot( halfTurn ).mul( 2 ) ).sub( halfTurn );

    } ).setLayout( {
        name: 'rotateBetween',
        type: 'vec3',
        inputs: [
            { name: 'restDirection', type: 'vec3' },
            { name: 'liveDirection', type: 'vec3' },
            { name: 'vector', type: 'vec3' }
        ]
    } );

    /**
     * 🎯 Slides `point` out of a sphere collider ALONG the sphere of radius `restLength` about
     * `anchor`, so both constraints hold exactly.
     *
     * ## Why this is not what TressFX or the spike does, and why the change is the honest one
     *
     * Both of those resolve the collider BEFORE the length projection (research doc §8.1 step 4,
     * then step 5), which means FTL is free to push the particle straight back inside. The spike's
     * own correctness table reports **0.000 mm of skull penetration in BOTH the green run and the
     * `?breakFtl=1` red run**, which is the shape LEARNINGS §1.14/standing-rule-4 is about: a
     * statistic over a mask that never contained an event. Reversing the order fixes penetration
     * and breaks length instead — that is the trade every real-time solver takes, and this one does
     * not have to.
     *
     * Two spheres that overlap meet in a circle, and every point of that circle satisfies BOTH
     * constraints exactly. With `D = |C − A|`, `a = (D² + l₀² − R²) / 2D` and `r = √(l₀² − a²)`,
     * the circle is centred at `A + â·a` with radius `r`; projecting the offending point onto it
     * costs one normalize. `|q − A| = l₀` and `|q − C| = R` fall straight out of the algebra.
     *
     * The anchor is always outside the collider — it is the previous particle, which was resolved
     * first, and the root sits on the scalp — so the two spheres always intersect when the point is
     * inside, and `r²` is only clamped against floating point.
     */
    const slideOntoCollider = Fn( ( [ point, anchor, restLength, centre, radius ] ) => {

        const result = vec3( point ).toVar();

        const toCentre = centre.sub( anchor ).toVar();
        const distance = length( toCentre ).max( 1e-6 ).toVar();
        const axis = toCentre.div( distance ).toVar();

        // Where the circle of intersection sits along the anchor→centre axis, and how wide it is.
        const along = clamp(
            distance.mul( distance ).add( restLength.mul( restLength ) ).sub( radius.mul( radius ) )
                .div( distance.mul( 2 ) ),
            restLength.negate(), restLength ).toVar();
        const circleRadius = sqrt( max( restLength.mul( restLength ).sub( along.mul( along ) ), 0 ) ).toVar();
        const circleCentre = anchor.add( axis.mul( along ) ).toVar();

        // The offending point, taken to the nearest point of that circle.
        const spoke = result.sub( circleCentre ).toVar();
        const planar = spoke.sub( axis.mul( spoke.dot( axis ) ) ).toVar();
        const planarLength = length( planar ).toVar();

        // A point exactly on the axis has no nearest circle point; any spoke will do and the
        // ribbon's own rest offset is a stable one to fall back on.
        const direction = select( planarLength.greaterThan( 1e-7 ),
            planar.div( planarLength.max( 1e-7 ) ),
            normalize( cross( axis, vec3( 0, 0, 1 ) ).add( vec3( 1e-6, 0, 0 ) ) ) ).toVar();

        result.assign( circleCentre.add( direction.mul( circleRadius ) ) );

        return result;

    } ).setLayout( {
        name: 'slideOntoCollider',
        type: 'vec3',
        inputs: [
            { name: 'point', type: 'vec3' },
            { name: 'anchor', type: 'vec3' },
            { name: 'restLength', type: 'float' },
            { name: 'centre', type: 'vec3' },
            { name: 'radius', type: 'float' }
        ]
    } );

    // --- kernel 1: the DFTL step ---------------------------------------------------------------
    //
    // One invocation per chain. Research doc §6.2: FTL is sequential along a chain and 17 is short,
    // so giving one invocation the whole chain removes the `groupshared` memory, the red/black
    // ordering and both `GroupMemoryBarrierWithGroupSync()` calls TressFX needs. The low occupancy
    // that implies — 294 threads is about five workgroups of 64 — is real and it is already inside
    // the measured 0.01361 ms.

    const makeSolveKernel = ( headUniform ) => Fn( () => {

        const base = instanceIndex.mul( POINTS );
        const dt = uniforms.deltaTime.toVar();

        // A long card is a heavy one and lags further; see `chainComplianceBuffer`.
        const chainStiffnessScale = chainComplianceBuffer.element( instanceIndex ).toVar();

        // The root is kinematic: wherever the head bone put the authored rest position. This is the
        // whole input to the simulation — everything below follows from the root having moved.
        const root = restWorldAt( headUniform, base ).toVar();
        positionBuffer.element( base ).assign( root );
        velocityBuffer.element( base ).assign( vec3( 0 ) );
        correctionBuffer.element( base ).assign( vec3( 0 ) );

        const previous = vec3( root ).toVar();

        Loop( { start: uint( 1 ), end: POINTS, type: 'uint', condition: '<' }, ( { i } ) => {

            const index = base.add( i );
            const restLength = restLengthBuffer.element( index ).toVar();
            const x = positionBuffer.element( index ).toVar();
            const v = velocityBuffer.element( index ).toVar();

            If( uniforms.resetPositions.greaterThan( 0 ), () => {

                x.assign( restWorldAt( headUniform, index ) );
                v.assign( vec3( 0 ) );

            } );

            // PBD eq 1: unconstrained prediction under gravity, with TressFX's framerate-independent
            // exponential velocity decay folded in before it (research doc §4.1).
            v.mulAssign( uniforms.velocityDecay );
            const p = x.add( v.mul( dt ) ).add( uniforms.gravity.mul( dt ).mul( dt ) ).toVar();

            // TressFX's global shape constraint — the thing that keeps a bob a bob — ramped from
            // the root value to the tip value instead of switched off at a ring boundary. See
            // `globalTipStiffness` for the measurement that says why it must not reach zero.
            const alongStrand = float( i ).div( float( POINTS.sub( uint( 1 ) ) ) );
            const tipStiffness = uniforms.globalTipStiffness.mul( chainStiffnessScale );
            const hold = uniforms.globalStiffness.add(
                tipStiffness.sub( uniforms.globalStiffness ).mul( alongStrand ) );
            p.addAssign( restWorldAt( headUniform, index ).sub( p ).mul( hold ) );

            // 🚩 The movement check's red proof, and it is deliberately the LAST word on position:
            // a defect that leaves the solver running and pins the answer to the rigid pose.
            If( uniforms.kinematic.greaterThan( 0 ), () => p.assign( restWorldAt( headUniform, index ) ) );

            // FTL: onto the sphere of radius l₀ about the predecessor, which does not move. That
            // is what makes one pass exact rather than one iteration of something convergent.
            const toPrevious = p.sub( previous ).toVar();
            const separation = length( toPrevious ).max( 1e-6 ).toVar();
            const projected = previous.add( toPrevious.div( separation ).mul( restLength ) ).toVar();

            If( uniforms.ftlEnabled.lessThan( 1 ), () => projected.assign( p ) );

            // Colliders LAST, and along the length sphere rather than across it — see
            // `slideOntoCollider` for why that ordering is the whole point.
            // 🚩 ONE COLLIDER PER SUBSTEP, THE DEEPEST — never both in sequence. Resolving the
            // skull and then the capsule lets the second push the particle back inside the first,
            // and the two then trade the particle back and forth for as long as the page runs.
            // That is measured, not anticipated: see `fitColliders`.
            If( uniforms.collideEnabled.greaterThan( 0 ), () => {

                const skullDepth = uniforms.skull.w.sub( length( projected.sub( uniforms.skull.xyz ) ) ).toVar();

                const capsuleAxis = uniforms.capsuleB.sub( uniforms.capsuleA ).toVar();
                const alongCapsule = clamp(
                    projected.sub( uniforms.capsuleA ).dot( capsuleAxis )
                        .div( capsuleAxis.dot( capsuleAxis ).max( 1e-9 ) ), 0, 1 );
                const onAxis = uniforms.capsuleA.add( capsuleAxis.mul( alongCapsule ) ).toVar();
                const capsuleDepth = uniforms.capsuleRadius.sub( length( projected.sub( onAxis ) ) ).toVar();

                const useSkull = skullDepth.greaterThanEqual( capsuleDepth );
                const centre = select( useSkull, uniforms.skull.xyz, onAxis ).toVar();
                const radius = select( useSkull, uniforms.skull.w, uniforms.capsuleRadius ).toVar();

                If( max( skullDepth, capsuleDepth ).greaterThan( 0 ), () => {

                    projected.assign( slideOntoCollider( projected, previous, restLength, centre, radius ) );

                } );

            } );

            positionBuffer.element( index ).assign( projected );
            correctionBuffer.element( index ).assign( projected.sub( p ) );

            If( uniforms.velocityUpdateEnabled.greaterThan( 0 ), () => {

                velocityBuffer.element( index ).assign( projected.sub( x ).div( dt ) );

            } ).Else( () => {

                velocityBuffer.element( index ).assign( v );

            } );

            previous.assign( projected );

        } );

        // DFTL eq 9's second term: `v_i += s_damping · (−d_{i+1}/Δt)`. The paper's whole
        // contribution, and the reason the tail carries momentum instead of trailing dead. The last
        // particle has no successor and keeps the plain velocity.
        Loop( { start: uint( 1 ), end: POINTS.sub( uint( 1 ) ), type: 'uint', condition: '<' }, ( { i } ) => {

            const index = base.add( i );
            velocityBuffer.element( index ).addAssign(
                correctionBuffer.element( index.add( uint( 1 ) ) )
                    .mul( uniforms.dampingScale.negate() ).div( uniforms.deltaTime ) );

        } );

    } );

    // --- kernel 2: rebuild the ribbon ----------------------------------------------------------
    //
    // One invocation per ring. `ribbon_of` builds a card's across-vector from "outward from the
    // head centre" and the research doc §5.2 warns that any other reference direction rotates every
    // card the moment the solver runs. This does not re-derive the frame at all: it TRANSPORTS the
    // authored offset from the rest tangent to the current one, so the authored twist, the taper
    // and the roll come through untouched and the rebuild is the identity at rest.

    const skinKernel = Fn( () => {

        const ring = instanceIndex.mod( POINTS );

        // Central difference, one-sided at the ends, on both the current and the rest centreline —
        // the same rule for both, or the transport would rotate a groom that had not moved.
        const beforeIndex = instanceIndex.sub( min( ring, uint( 1 ) ) );
        const afterIndex = instanceIndex.add( min( POINTS.sub( ring ).sub( uint( 1 ) ), uint( 1 ) ) );

        const nudge = vec3( 0, 1e-9, 0 );
        const tangent = normalize(
            positionBuffer.element( afterIndex ).sub( positionBuffer.element( beforeIndex ) ).add( nudge ) ).toVar();
        const restTangent = normalize(
            uniforms.headRotation.mul(
                restCentreBuffer.element( afterIndex ).sub( restCentreBuffer.element( beforeIndex ) ) ).add( nudge ) ).toVar();

        const restOffset = uniforms.headRotation.mul( restOffsetBuffer.element( instanceIndex ) ).toVar();

        // A tangent that has flipped end for end has no minimal rotation — `a + b` vanishes and the
        // bisector is undefined. A chain held by the global shape constraint does not do this, but
        // a solver blow-up would, and a NaN in a vertex buffer takes the whole groom off screen
        // rather than one card.
        const flipped = restTangent.dot( tangent ).lessThan( - 0.9999 );
        const offset = select( flipped, restOffset, rotateBetween( restTangent, tangent, restOffset ) ).toVar();

        const centre = positionBuffer.element( instanceIndex ).toVar();
        const left = uniforms.worldToObject.mul( vec4( centre.sub( offset ), 1 ) ).xyz;
        const right = uniforms.worldToObject.mul( vec4( centre.add( offset ), 1 ) ).xyz;

        cardVertexBuffer.element( instanceIndex.mul( uint( 2 ) ) ).assign( left );
        cardVertexBuffer.element( instanceIndex.mul( uint( 2 ) ).add( uint( 1 ) ) ).assign( right );

    } );

    // Distinct ComputeNodes per substep, built once. Handing three the SAME node twice inside one
    // array is not something r185 documents, and the failure mode — a second dispatch that silently
    // does not run — would look exactly like a solver that is half as stiff as it was tuned to be.
    // Four identical pipelines is the price of not having to wonder.
    const solveNodes = [];
    for ( let substep = 0; substep < MAX_SUBSTEPS_PER_FRAME; substep ++ ) {

        solveNodes.push( makeSolveKernel( substepHeadMatrices[ substep ] )()
            .compute( chainCount ).setName( `hair DFTL step ${ substep }` ) );

    }

    const rebuildNode = skinKernel().compute( particleCount ).setName( 'hair card rebuild' );

    // --- what the material reads ---------------------------------------------------------------
    //
    // `NodeMaterial.setupPosition` runs skinning FIRST and then overwrites `positionLocal` with
    // `positionNode` (r185, `NodeMaterial.js:774-776` and `:802-804`). So a groom vertex takes the solver's
    // answer and a scalp-cap vertex keeps its skinning, chosen here rather than with a third
    // dispatch that would have to duplicate the skinning it is replacing.
    const simulatedIndex = max( vertexIndex, uint( cardVertexBase ) ).sub( uint( cardVertexBase ) );
    const positionNode = select(
        vertexIndex.greaterThanEqual( uint( cardVertexBase ) ),
        cardVertexBuffer.element( simulatedIndex ),
        positionLocal );

    // --- the frame loop ------------------------------------------------------------------------

    const headMatrix = new Matrix4();
    const headRotation = new Matrix3();
    const worldToObject = new Matrix4();

    // The head's orientation at the pose the groom was AUTHORED in, captured on the first
    // `setHeadMatrix`, and gravity resolved into it. See `setHeadMatrix` for what they are for.
    const restHeadRotationInverse = new Matrix3();
    const gravityInRestFrame = new Vector3();
    const effectiveGravity = new Vector3();
    const carriedGravity = new Vector3();

    // The head pose at the END of the previous frame, and scratch for interpolating between it and
    // this frame's. See `substepHeadMatrices` for why the substeps must not all share one pose.
    // The skull collider's centre in the mesh's own local space, so it can be carried by the head
    // every frame. 🚩 A collider left at a fixed WORLD point is a sphere the groom sweeps THROUGH
    // the moment the head turns: measured before this was carried, `?head=impulse` reported a
    // constant 9.709 mm of skull penetration in every variant including `?hairdefect=kinematic`,
    // which is the rigid pose colliding with a stationary marble.
    const skullCentreLocal = new Vector3();
    const skullCentreWorld = new Vector3();
    const invertedHead = new Matrix4();
    let skullFitted = false;

    const previousHeadMatrix = new Matrix4();
    const fromPosition = new Vector3();
    const toPosition = new Vector3();
    const stepPosition = new Vector3();
    const fromRotation = new Quaternion();
    const toRotation = new Quaternion();
    const stepRotation = new Quaternion();
    const fromScale = new Vector3();
    const toScale = new Vector3();
    const stepScale = new Vector3();
    let previousHeadValid = false;
    let restFrameCaptured = false;

    let accumulatorSeconds = 0;
    let stepsTaken = 0;
    let resetPending = true;

    // How many `renderer.compute()` CALLS the last frame made — 1 when the submission is the shape
    // research doc §0.3 requires, and counted here rather than read off `renderer.info` because
    // `info.compute.frameCalls` is only reset by the rAF animation loop, which a `?capture` page
    // does not run. Measured: it read 3 and 33 for the two arms on a page where the truth is 1 and
    // 3, which is a counter accumulating across an unknown window.
    let computeCallsLastFrame = 0;

    /**
     * Tells the solver where the head is, in the one form it needs.
     *
     * The groom is skinned 1.000 to `head` and nothing else, so its skinned position is
     * `mesh.matrixWorld · head.matrixWorld · boneInverse[head] · restLocal` — one rigid transform,
     * which is why the whole coupling is a matrix rather than a skinning pass. `alive.js` rebinds
     * the groom to the figure's live skeleton with an identity bind matrix, so the bind matrix does
     * not appear; a caller who binds differently has to fold it in here.
     */
    function setHeadMatrix( meshMatrixWorld, headBoneMatrixWorld, headBoneInverse ) {

        headMatrix.copy( meshMatrixWorld ).multiply( headBoneMatrixWorld ).multiply( headBoneInverse );
        uniforms.headMatrix.value.copy( headMatrix );

        headRotation.setFromMatrix4( headMatrix );
        uniforms.headRotation.value.copy( headRotation );

        worldToObject.copy( meshMatrixWorld ).invert();
        uniforms.worldToObject.value.copy( worldToObject );

        if ( restFrameCaptured === false ) {

            restHeadRotationInverse.copy( headRotation ).invert();
            gravityInRestFrame.set( 0, tuning.gravity, 0 ).applyMatrix3( restHeadRotationInverse );
            restFrameCaptured = true;

        }

        // 🎯 GRAVITY IS APPLIED AS A DIFFERENCE, and this is the change that made the groom sit
        // still when the head does.
        //
        // The authored rest pose is already the hair hanging under gravity — `hair_cards.py:1123`
        // bends every guide by `GRAVITY_PER_SEGMENT · layer.gravity · s^GRAVITY_POWER`. Add the
        // full 9.81 m/s² on top of it and the only thing that can balance it is the global shape
        // constraint, so the groom settles at a PERMANENT offset of about `g·h²/k`: measured on
        // this groom at `?head=impulse`, 10.5 mm of tip sag at a tip stiffness of 0.30 and 68 mm
        // at 0.01, with no way to have both a soft tip and an authored silhouette.
        //
        // What the simulation should carry is the CHANGE in the load, so gravity is resolved into
        // the head's rest frame once and subtracted back out through the head's current
        // orientation. Head upright: exactly zero, and the authored pose is the equilibrium. Head
        // tilted 30°: the difference between two 9.81 m/s² vectors 30° apart, which is the force
        // that actually makes hair fall sideways when you tip your head.
        carriedGravity.copy( gravityInRestFrame ).applyMatrix3( headRotation );
        effectiveGravity.set( 0, tuning.gravity, 0 );
        if ( uniforms.restGravityEnabled.value > 0 ) effectiveGravity.sub( carriedGravity );
        uniforms.gravity.value.copy( effectiveGravity );

        // The skull rides the head. See `skullCentreLocal`.
        if ( skullFitted === true ) {

            skullCentreWorld.copy( skullCentreLocal ).applyMatrix4( headMatrix );
            uniforms.skull.value.set(
                skullCentreWorld.x, skullCentreWorld.y, skullCentreWorld.z, uniforms.skull.value.w );

        }

    }

    /**
     * Moves the shoulder capsule, for a rig whose chest is not still.
     *
     * Separate from `setHeadMatrix` because it is a different bone: the skull follows the head and
     * the capsule follows the clavicles, and a page with a swaying body has to say so every frame.
     */
    function setShoulders( shoulderLeft, shoulderRight ) {

        uniforms.capsuleA.value.copy( shoulderLeft );
        uniforms.capsuleB.value.copy( shoulderRight );

    }

    /**
     * Fits the skull collider to the groom's own roots, and sizes it so that NOTHING is inside it
     * at rest.
     *
     * ## Where the centre comes from, and why not the head bone
     *
     * Every card root sits on the scalp, so 294 of them are 294 samples of a cranium and a
     * least-squares sphere through them is a skull proxy that costs nothing to obtain. Measured on
     * this groom: centre (0.0044, 1.5761, 0.0382), **radius 97.3 mm**. The head BONE's origin is at
     * (0, 1.5146, 0.0440) — 61 mm lower, at the base of the skull where a bone belongs — and a
     * sphere centred there that clears the rest pose comes out at **49.7 mm**, which is a marble
     * inside the head that the hair can never reach. The fit is the difference between a collider
     * and a decoration.
     *
     * ## And the radius is the largest one the rest pose does not already violate
     *
     * **76.1 mm** here, against the 97.3 mm scalp fit: the gap is the bob's own tips, which hang
     * beside the cheek and are nearer the cranium's centre than the scalp is. A collider the rest
     * pose violates would push the groom outward on frame one, and the A/B toggle would stop being
     * a control — the still plate with the solver on has to be the still plate with it off.
     *
     * ⚠️ **So one sphere cannot be a skull for this style, and the measurement says so out loud.**
     * The FTL paper's own scenes use eight ellipsoids (research doc §3.3). What this collider
     * catches is hair swinging INTO the cranium; what it cannot catch is a fringe crossing a nose.
     */
    function fitColliders( { centre = null, shoulderLeft = null, shoulderRight = null,
        shoulderRadius = 0.06 } = {} ) {

        const world = new Vector3();
        const restWorldOf = ( particle ) => world.set(
            groom.restCentres[ particle * 3 ],
            groom.restCentres[ particle * 3 + 1 ],
            groom.restCentres[ particle * 3 + 2 ] ).applyMatrix4( headMatrix );

        const roots = [];
        for ( let chain = 0; chain < chainCount; chain ++ ) {

            roots.push( restWorldOf( chain * pointsPerChain ).clone() );

        }

        const fitted = centre === null ? sphereThrough( roots ) : { centre: centre.clone(), radius: 0 };

        let nearest = Infinity;
        for ( let particle = 0; particle < particleCount; particle ++ ) {

            nearest = Math.min( nearest, restWorldOf( particle ).distanceTo( fitted.centre ) );

        }

        const radius = Math.max( nearest - colliderMargin, 0 );
        uniforms.skull.value.set( fitted.centre.x, fitted.centre.y, fitted.centre.z, radius );

        skullCentreLocal.copy( fitted.centre ).applyMatrix4( invertedHead.copy( headMatrix ).invert() );
        skullFitted = true;

        // 🚩 THE CAPSULE IS SIZED BY THE SAME RULE, AND SKIPPING THAT STEP COST AN AFTERNOON.
        //
        // A shoulder capsule taken from `clavicle_l`/`clavicle_r` at a hand-typed 60 mm radius
        // measured 9.7 mm INSIDE the rest groom — the two clavicle heads sit 45.6 mm apart at the
        // sternum, not out at the acromion, and the nearest rest particle to that axis is 50.3 mm.
        // A collider the rest pose violates does not merely look wrong: those particles were pushed
        // out of the capsule and straight INTO the skull, and the run reported a constant
        // **9.709 mm of skull penetration in every variant including `?hairdefect=kinematic`** —
        // a penetration statistic that was reading the collider fighting itself.
        let nearestToAxis = Infinity;

        if ( shoulderLeft !== null && shoulderRight !== null ) {

            uniforms.capsuleA.value.copy( shoulderLeft );
            uniforms.capsuleB.value.copy( shoulderRight );

            const axis = shoulderRight.clone().sub( shoulderLeft );
            const axisLengthSquared = Math.max( axis.lengthSq(), 1e-9 );
            const onAxis = new Vector3();

            for ( let particle = 0; particle < particleCount; particle ++ ) {

                const point = restWorldOf( particle );
                const along = Math.min( Math.max(
                    point.clone().sub( shoulderLeft ).dot( axis ) / axisLengthSquared, 0 ), 1 );
                onAxis.copy( shoulderLeft ).addScaledVector( axis, along );
                nearestToAxis = Math.min( nearestToAxis, point.distanceTo( onAxis ) );

            }

            uniforms.capsuleRadius.value = Math.max(
                Math.min( shoulderRadius, nearestToAxis - colliderMargin ), 0 );

        }

        return {
            skullCentre: fitted.centre.clone(),
            skullRadius: radius,
            scalpRadius: fitted.radius,
            nearestRestParticle: nearest,
            capsuleRadius: uniforms.capsuleRadius.value,
            nearestRestParticleToAxis: nearestToAxis
        };

    }

    /**
     * Walks the head from where it was at the end of the last frame to where it is now, one
     * substep at a time, and writes each pose into that substep's own uniform.
     *
     * Decompose–slerp–recompose rather than a component-wise matrix lerp: the head is a rigid
     * transform and a lerp of two rotation matrices is not one. The cost is at most four
     * decompositions of one matrix per frame.
     *
     * The FIRST frame after a reset has no previous pose, so every substep gets the current one —
     * which is right, because at that instant the groom is being placed rather than moved.
     */
    function fillSubstepHeadMatrices( substeps ) {

        if ( previousHeadValid === false ) {

            for ( let substep = 0; substep < substeps; substep ++ ) {

                substepHeadMatrices[ substep ].value.copy( headMatrix );

            }

            return;

        }

        previousHeadMatrix.decompose( fromPosition, fromRotation, fromScale );
        headMatrix.decompose( toPosition, toRotation, toScale );

        for ( let substep = 0; substep < substeps; substep ++ ) {

            const along = ( substep + 1 ) / substeps;

            stepPosition.lerpVectors( fromPosition, toPosition, along );
            stepRotation.copy( fromRotation ).slerp( toRotation, along );
            stepScale.lerpVectors( fromScale, toScale, along );

            substepHeadMatrices[ substep ].value.compose( stepPosition, stepRotation, stepScale );

        }

    }

    /**
     * Advances the simulation by whole fixed steps and submits them as ONE compute pass.
     *
     * 🚩 The accumulator is the whole of LEARNINGS §1.13's lesson in four lines. `deltaSeconds` is
     * whatever the frame took; the solver only ever sees `SUBSTEP_SECONDS`. At 60 fps that is
     * exactly two steps a frame — `1/60 − 1/120 − 1/120` is exactly zero in binary floating point,
     * because halving is exact — and at 120 fps exactly one, so the same wall-clock second is the
     * same 120 steps either way.
     *
     * @param {number} deltaSeconds - the frame's real time.
     * @returns {number} how many fixed steps ran, so a caller can report the workload it paid for.
     */
    function update( deltaSeconds ) {

        accumulatorSeconds += Math.max( deltaSeconds, 0 );

        let substeps = 0;
        while ( accumulatorSeconds >= SUBSTEP_SECONDS && substeps < MAX_SUBSTEPS_PER_FRAME ) {

            accumulatorSeconds -= SUBSTEP_SECONDS;
            substeps ++;

        }

        // A frame that arrived very late does not get to run a hundred steps. Dropping the surplus
        // is a stall, and a stall is what a viewer forgives; a spiral is what they do not.
        if ( substeps === MAX_SUBSTEPS_PER_FRAME ) accumulatorSeconds = 0;

        // The reset owes one step even on a frame too short to earn one, or a page that stepped the
        // clock by zero would render the previous groom's pose from an uninitialised buffer.
        if ( resetPending === true && substeps === 0 ) substeps = 1;

        if ( substeps === 0 ) return 0;

        fillSubstepHeadMatrices( substeps );

        const nodes = [ ...solveNodes.slice( 0, substeps ), rebuildNode ];

        if ( submit === 'perkernel' ) {

            // 🚩 THE DEFECT, and it is one line. Research doc §0.3 measures a `renderer.compute()`
            // call at 30.8–54.1 µs of pass overhead against 2.3–5.1 µs for an extra dispatch inside
            // one, so this is the same arithmetic at roughly ten times the price — and the picture
            // is identical, which is why it needs a gate rather than an eye.
            for ( const node of nodes ) renderer.compute( node );
            computeCallsLastFrame = nodes.length;

        } else {

            renderer.compute( nodes );
            computeCallsLastFrame = 1;

        }

        previousHeadMatrix.copy( headMatrix );
        previousHeadValid = true;

        if ( resetPending === true ) {

            uniforms.resetPositions.value = 0;
            resetPending = false;

        }

        stepsTaken += substeps;

        return substeps;

    }

    /**
     * Puts the groom back on its rest pose with zero velocity, on the next `update()`.
     *
     * ⚠️ **A capture driver must call this when it takes the frame loop over.** The state here is
     * ordinary state and rAF frames run during an async boot, so without it the first captured
     * frame carries a count of how many frames the machine fitted into loading a GLB — which is
     * exactly the class `alive-capture-determinism.selftest.mjs` exists to close, in a subsystem
     * that gate cannot see because it reads renderer counters.
     */
    function reset() {

        uniforms.resetPositions.value = 1;
        accumulatorSeconds = 0;
        stepsTaken = 0;
        resetPending = true;
        previousHeadValid = false;

    }

    /**
     * The simulated centreline and velocities, read back off the GPU.
     *
     * ⚠️ `instancedArray(n,'vec3')` is padded to vec4 IN PLACE by
     * `WebGPUAttributeUtils.js:112-114`, which rewrites the attribute's own `itemSize`. Reading at the
     * 3 it was constructed with produces a nearly-correct first chain and a slow drift after it —
     * research doc §6.3b measured that mistake reporting a 379.12 mm length error and 88.0 mm of
     * skull penetration that were entirely the reader's. So the stride is read off the attribute as
     * it is NOW, every time.
     */
    async function readCentrelines() {

        const unpack = async ( buffer ) => {

            const attribute = buffer.value;
            const raw = new Float32Array( await renderer.getArrayBufferAsync( attribute ) );
            const stride = attribute.itemSize;
            const packed = new Float32Array( particleCount * 3 );

            for ( let particle = 0; particle < particleCount; particle ++ ) {

                packed[ particle * 3 ] = raw[ particle * stride ];
                packed[ particle * 3 + 1 ] = raw[ particle * stride + 1 ];
                packed[ particle * 3 + 2 ] = raw[ particle * stride + 2 ];

            }

            return { packed, stride };

        };

        const positions = await unpack( positionBuffer );
        const velocities = await unpack( velocityBuffer );

        return {
            positions: positions.packed,
            velocities: velocities.packed,
            stride: positions.stride,
            headMatrix: headMatrix.elements.slice(),
            skull: uniforms.skull.value.toArray(),
            steps: stepsTaken
        };

    }

    return {
        groom,
        uniforms,
        positionNode,
        substepSeconds: SUBSTEP_SECONDS,
        maxSubstepsPerFrame: MAX_SUBSTEPS_PER_FRAME,

        /** The kernels, for a caller that owns a bigger compute pass. 🚩 They must go into ONE
         *  `renderer.compute( array )` — research doc §0.3 measures the alternative at ten times
         *  the cost of the simulation — and the solve nodes must precede the rebuild. */
        computeNodesFor: ( substeps ) => [ ...solveNodes.slice( 0, substeps ), rebuildNode ],

        setHeadMatrix,
        setShoulders,
        fitColliders,
        update,
        reset,
        readCentrelines,
        get stepsTaken() { return stepsTaken; },
        get computeCallsLastFrame() { return computeCallsLastFrame; }
    };

}
