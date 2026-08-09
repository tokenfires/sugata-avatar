/**
 * Gate for `render/GroundContact.js`.
 *
 * The whole file rests on one closed form — Quilez's analytic sphere occlusion — and a closed form
 * that is subtly wrong is indistinguishable from a right one when the only test is "the floor got
 * darker". So the primary check does not compare the function to itself:
 *
 *   AGAINST MONTE CARLO   The analytic occlusion is compared against a cosine-weighted hemisphere
 *                         integration of the SAME configuration, by ray-sphere intersection,
 *                         200k rays per configuration, over eight geometries from touching-contact
 *                         to far field. Two independent derivations of the same number.
 *
 *   LIMITS                Far field must tend to the distant-sphere solid angle A·cosθ/(π·d²); a
 *                         sphere below the horizon must occlude nothing; a receiver swallowed by
 *                         an occluder must return full occlusion rather than NaN.
 *
 *   PROVED RED            The Monte-Carlo check is re-run against a DELIBERATELY WRONG occlusion
 *                         (the distant-sphere approximation used everywhere, which is what a
 *                         careless implementation would ship) and must fail — LEARNINGS §1.1, a
 *                         gate that has never failed is not known to work. The approximation is
 *                         right in the far field, so this also pins down where it stops being.
 *
 *   COMBINATION           Visibility over a set is monotone in the occluder count and stays inside
 *                         0..1. ORDINAL ONLY — see the next block for why that was not enough.
 *
 *   AGAINST A UNION       🚩 The block above was the whole of this gate's coverage of the
 *   INTEGRATOR            COMBINATION RULE, and it was blind. `monteCarloOcclusion` takes ONE
 *                         sphere, so no reference in this file could see how spheres compose;
 *                         swapping the product `∏ (1 − o_i)` for a clamped sum `1 − Σ o_i` — a
 *                         different physical model, wrong by 1.9x at the full occluder budget —
 *                         passed 14/14. Monotone, inside 0..1 and empty-set-is-1 are all true of
 *                         the sum too.
 *
 *                         So there is now a second integrator that traces the cosine-weighted
 *                         hemisphere against ALL the spheres at once and counts a ray once however
 *                         many spheres it hits. That is the union, which is what visibility means
 *                         for a set, and it is the only thing that can referee a combination rule.
 *                         It is itself checked against the single-sphere analytic form first, so
 *                         the new reference is tied to the one already proved above.
 *
 *                         Proved red against SEVEN rival rules, not one: clamped sum, strongest
 *                         occluder only, weakest only, mean transmittance, optical depth
 *                         `exp(−Σ o_i)`, a loop that skips the first occluder, and a loop that
 *                         runs half the list. The last two are the interesting ones — a loop that
 *                         quits early scores BETTER on RMS than the shipped rule, because dropping
 *                         occluders happens to cancel the product's own over-darkening. Fidelity
 *                         alone cannot catch it, which is why the CONTRACT block below exists.
 *
 *   CONTRACT              Every occluder in the list changes the answer, and the fold is the
 *                         documented product. Tolerance-free, and the only thing that catches an
 *                         early loop exit.
 *
 *   BUDGET                `OCCLUDER_SEGMENTS` asks for more spheres than `MAX_OCCLUDERS` allows,
 *                         and the tail it drops is asymmetric. Gated on the measured size of what
 *                         is lost rather than on the claim that it does not matter.
 *
 *   THE CONTACT PROFILE   The quantity the defect is stated in: visibility along the floor,
 *                         outward from directly under a sphere resting on it. It must RISE with
 *                         distance, and rise by more than the 0.0014 of luma the judge measured on
 *                         the shipped plate — which is what "the figure floats" means numerically.
 *
 *   RADIUS FIT            `measureBoneRadii` on a synthetic skinned cylinder of known radius
 *                         recovers that radius. A fit checked only on the real asset cannot be
 *                         wrong, because nobody knows the right answer there.
 *
 *   THE ALBEDO, AND       🚩 The albedo clause below asks whether the floor's own hex divides blue
 *   WHAT LANDS ON IT      down by enough. On its own that is half of a product and it was gated as
 *                         if it were the whole thing: a verifier turned the rig's KEY and FILL
 *                         blue and this file returned 36/36 green while the frame went 99.2%
 *                         saturated blue, because no light of any colour enters the arithmetic. A
 *                         floor's rendered hue is `albedo × the light that lands on it`, and the
 *                         second factor was assumed constant. It is now built and measured.
 *
 *   THE CASTER HALF       🚩 And the SAME SHAPE ONE LEVEL DOWN, which cost another round. The
 *                         incident light above sums the four `RectAreaLight` panels and leaves out
 *                         the key's shadow-casting `SpotLight`, excused by a comment in
 *                         `LightingRig.selftest.mjs` saying the spot half only ever LOWERS the
 *                         number. True of a rig whose casters carry their panel's colour, which
 *                         nothing asserted: a verifier built the key's caster at `#0f30ff` and
 *                         this file returned 47/47 green while body-framing saturated blue went
 *                         0.2881% -> 12.0152% of the frame. Two clauses now, and the honest one
 *                         first — the PRODUCT cannot reject a blue caster at any defensible
 *                         ceiling (0.366 against 0.71), so the load-bearing clause is an EQUALITY
 *                         between each caster's colour and its panel's, with the caster-inclusive
 *                         product measured beside it so the excuse is a number rather than prose.
 *
 *   THE CASTER'S SIZE     🚩 AND THE SAME SHAPE A THIRD TIME, because the two clauses above are an
 *                         equality on COLOUR and a test of a SIGN and the excuse they defend is a
 *                         claim about MAGNITUDE. Measured: scale every non-key caster's SOLVED
 *                         intensity by five, colours untouched, and this file returned 55/55 and
 *                         `LightingRig.selftest.mjs` 82/82. A gain on the KEY's caster was caught
 *                         here by ONE check — the cross-file constant — and cross-file agreement
 *                         answers "did anything change", not "is it right". MAGNITUDE and REACH
 *                         below are oracles against the rig's own contract instead.
 *
 *   THE FINGERPRINT       🎯 AND THE SHAPE A FOURTH TIME, WHICH IS WHY THE LAST BLOCK IS NOT A
 *                         FIFTH CHECK. Every clause above was written from a defect that had
 *                         already happened, and `shadowCaster.decay` 2 -> 1 (41.64% of a rendered
 *                         frame, worst delta 8/255) and `distance` 0 -> 1.2 (79.47%, 87/255) then
 *                         walked past all four at 65/65. The floor's colour is
 *                         `albedo x occlusion x incident`, and NOTHING in this file had ever
 *                         asserted anything about the first two factors' own objects — the mesh,
 *                         the material or the three uniforms.
 *
 *                         `GroundContact.renderState` closes them, and the material half closes
 *                         itself: it is a DELTA against a freshly constructed
 *                         `MeshStandardNodeMaterial`, so the closure comes from three's 110 fields
 *                         rather than from a list of the ones we remembered. Proved red on five
 *                         mechanisms — `receiveShadow`, `metalness`, `toneMapped`, a uniform out of
 *                         step with its own mirror, and a tilted plane — every one of which leaves
 *                         `visibilityAt()` BIT-IDENTICAL, and `visibilityAt` is what the five
 *                         occlusion blocks above all measure through. Each is also measured IN
 *                         PIXELS on `/src/lighting.html?frame=body` at 900x1200 and the numbers are
 *                         beside the clauses, because "this would have shown up in the picture" is
 *                         the claim, and it is the claim the last three rounds got wrong.
 *

 * A measurement outside its range is a FAIL and exits non-zero. It is not grounds for widening
 * the range.
 *
 * Usage:  node "packages/core/src/render/GroundContact.selftest.mjs"
 *         node "packages/core/src/render/GroundContact.selftest.mjs" --caster-colour=0x0f30ff
 *         node "packages/core/src/render/GroundContact.selftest.mjs" --caster-gain=5
 *         node "packages/core/src/render/GroundContact.selftest.mjs" --caster-cone=1.4
 *
 * The three flags are rejection proofs, each planting a different defect in the shadow-caster half.
 * Each prints how many DISTINCT lights it altered, because a reach counter that counts calls is how
 * the last round's caster-magnitude finding came to be reported against an unchanged rig.
 * Expected: 72/75, 70/75 and 69/75 respectively — re-measured this round, because the fingerprint
 * block moved every one of them and a stale expectation in a usage note is a claim with no gate on
 * it (LEARNINGS §1.25e).
 */

import { Float32BufferAttribute, Matrix4, Uint16BufferAttribute } from 'three';
import { BufferGeometry, Bone, Color, MeshStandardNodeMaterial, Scene, Skeleton, SkinnedMesh, Vector3 } from 'three/webgpu';

import {
    GroundContact,
    groundVisibility,
    measureBoneRadii,
    sphereOcclusion,
    MAX_OCCLUDERS,
    OCCLUDER_SEGMENTS
} from './GroundContact.js';

// The floor's rendered hue is a PRODUCT, and this file only ever owned one of its two factors.
// See the REFLECTED COLOUR block at the bottom.
import { LightingRig, lightRenderState, projectedSolidAngle, spotIrradianceFactor } from './LightingRig.js';

/**
 * 🚩 THE REJECTION PROOF, AS A FLAG. Mirrors `LightingRig.selftest.mjs`'s flag of the same name.
 *
 *     node "packages/core/src/render/GroundContact.selftest.mjs" --caster-colour=0x0f30ff
 *
 * builds every shadow caster at that colour rather than at its panel's — the defect a verifier
 * planted in `LightingRig.js` and watched this file score 47/47 through, because the incident
 * half of its product summed the `RectAreaLight` panels and nothing else.
 */
function numericFlag( name ) {

    const raw = process.argv.find( ( argument ) => argument.startsWith( `${ name }=` ) )?.split( '=' )[ 1 ] ?? null;

    if ( raw === null ) return null;

    const value = Number( raw );

    if ( Number.isFinite( value ) === false ) throw new Error( `${ name }: '${ raw }' is not a number` );

    return value;

}

/**
 * 🚩 EVERY INJECTOR IN THIS FILE COUNTS THE DISTINCT LIGHTS IT ALTERED, not the calls it made.
 *
 * A verifier reported this file green at 55/55 under a caster brightened fivefold, having patched
 * `buildUnit` — where the colour is decided — and counted 31 caster builds as proof of reach.
 * `LightingRig.solve()` writes `shadowCaster.intensity` on every `aimAt()`, so the patch was
 * overwritten and the rig under test was the shipped one. Measured in `LightingRig.selftest.mjs`:
 * a body caster reads 25.835991187 shipped and 25.835991187 with `buildUnit` multiplying by five.
 *
 * A counter that counts CALLS is the same trap one level down, so these count objects.
 */
const injectorReach = [];

process.on( 'exit', () => {

    for ( const line of injectorReach ) console.log( line() );

} );

const CASTER_COLOUR_DEFECT = numericFlag( '--caster-colour' );

if ( CASTER_COLOUR_DEFECT !== null ) {

    const hex = CASTER_COLOUR_DEFECT;
    const buildUnit = LightingRig.prototype.buildUnit;
    const altered = new Set();

    LightingRig.prototype.buildUnit = function ( placement ) {

        const unit = buildUnit.call( this, placement );

        if ( unit.shadowCaster !== null ) {

            unit.shadowCaster.color = new Color( hex );
            altered.add( unit.shadowCaster );

        }

        return unit;

    };

    injectorReach.push( () => `🚩 INJECTOR REACH: ${ altered.size } distinct caster(s) recoloured. Colour is set in ` +
        '`buildUnit` and never written again, so a build-time patch is the surviving one for colour.' );

    console.log( `\n🚩 DEFECT INJECTED: every shadow caster built at #${ hex.toString( 16 ).padStart( 6, '0' ) } ` +
        'rather than at its panel\'s colour. This run is a rejection proof, not a verdict on the repo.\n' );

}

/**
 * 🚩 THE MAGNITUDE REJECTION PROOFS, AND THEY PATCH `solve` BECAUSE `buildUnit` DOES NOT SURVIVE.
 *
 *     node "packages/core/src/render/GroundContact.selftest.mjs" --caster-gain=5
 *     node "packages/core/src/render/GroundContact.selftest.mjs" --caster-cone=1.4
 *
 * Neither touches a colour, so the PREMISE clause is green by construction on both. See the
 * MAGNITUDE and REACH clauses in the CASTER HALF block for what each one is for.
 */
const CASTER_GAIN_DEFECT = numericFlag( '--caster-gain' );
const CASTER_CONE_DEFECT = numericFlag( '--caster-cone' );

if ( CASTER_GAIN_DEFECT !== null || CASTER_CONE_DEFECT !== null ) {

    const solve = LightingRig.prototype.solve;
    const altered = new Set();

    LightingRig.prototype.solve = function () {

        const result = solve.call( this );

        for ( const unit of this.units ) {

            if ( unit.shadowCaster === null ) continue;

            if ( CASTER_GAIN_DEFECT !== null ) unit.shadowCaster.intensity *= CASTER_GAIN_DEFECT;
            if ( CASTER_CONE_DEFECT !== null ) unit.shadowCaster.angle *= CASTER_CONE_DEFECT;

            altered.add( unit.shadowCaster );

        }

        return result;

    };

    injectorReach.push( () => `🚩 INJECTOR REACH: ${ altered.size } distinct SOLVED caster(s) altered — patched on ` +
        '`solve`, so the change survives every re-aim rather than being overwritten by the next one.' );

    console.log( `\n🚩 DEFECT INJECTED: every shadow caster's intensity x${ CASTER_GAIN_DEFECT ?? 1 } and cone ` +
        `x${ CASTER_CONE_DEFECT ?? 1 }, colour untouched. This run is a rejection proof, not a verdict on the repo.\n` );

}

let failures = 0;
let checks = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed === true ? '  ok  ' : '  FAIL' }  ${ name }${ detail === undefined ? '' : `  —  ${ detail }` }` );

}

function within( value, low, high ) {

    return Number.isFinite( value ) && value >= low && value <= high;

}

// --- the reference integrator -------------------------------------------------------------------

/**
 * Cosine-weighted hemisphere occlusion by one sphere, by sampling.
 *
 * Deliberately written from the geometry rather than from the closed form: draw a direction from
 * the cosine-weighted hemisphere about the normal, intersect it with the sphere, count the hits.
 * The fraction of hits IS the occlusion of a Lambert receiver, by definition.
 *
 * A fixed 32-bit LCG rather than Math.random, so a failure is reproducible and a flake is not
 * mistaken for a defect.
 */
function monteCarloOcclusion( position, normal, centre, radius, rays, seed ) {

    let state = seed >>> 0;
    const random = () => {

        state = ( Math.imul( state, 1664525 ) + 1013904223 ) >>> 0;
        return state / 4294967296;

    };

    // An orthonormal basis about the normal.
    const up = Math.abs( normal[ 1 ] ) < 0.9 ? [ 0, 1, 0 ] : [ 1, 0, 0 ];
    const tangent = normalise( cross( up, normal ) );
    const bitangent = cross( normal, tangent );

    const toCentre = [ centre[ 0 ] - position[ 0 ], centre[ 1 ] - position[ 1 ], centre[ 2 ] - position[ 2 ] ];
    const centreDistanceSquared = dot( toCentre, toCentre );

    let hits = 0;

    for ( let sample = 0; sample < rays; sample += 1 ) {

        // Malley's method: a uniform disc lifted to the hemisphere is cosine-distributed.
        const r = Math.sqrt( random() );
        const phi = 2 * Math.PI * random();
        const x = r * Math.cos( phi );
        const y = r * Math.sin( phi );
        const z = Math.sqrt( Math.max( 0, 1 - x * x - y * y ) );

        const direction = [
            tangent[ 0 ] * x + bitangent[ 0 ] * y + normal[ 0 ] * z,
            tangent[ 1 ] * x + bitangent[ 1 ] * y + normal[ 1 ] * z,
            tangent[ 2 ] * x + bitangent[ 2 ] * y + normal[ 2 ] * z
        ];

        // Ray-sphere: hit if the closest approach is inside the radius AND in front.
        const projection = dot( toCentre, direction );
        if ( projection <= 0 ) continue;

        const closestSquared = centreDistanceSquared - projection * projection;
        if ( closestSquared <= radius * radius ) hits += 1;

    }

    return hits / rays;

}

const dot = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
const cross = ( a, b ) => [
    a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
    a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
    a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ]
];
const normalise = ( a ) => {

    const length = Math.hypot( a[ 0 ], a[ 1 ], a[ 2 ] );
    return [ a[ 0 ] / length, a[ 1 ] / length, a[ 2 ] / length ];

};

/**
 * Cosine-weighted hemisphere visibility against the UNION of a whole sphere set.
 *
 * The one thing `monteCarloOcclusion` above cannot do, and the reason a wrong combination rule
 * used to pass this file: a ray is counted once no matter how many spheres it pierces, so the
 * overlaps between occluders are handled by the geometry instead of by an assumption. That IS the
 * definition of visibility for a set, and everything in the COMBINATION GATE below is measured
 * against it.
 *
 * Same LCG, same Malley construction and the same early-out as the single-sphere integrator, so
 * where the two overlap (one sphere) they must agree — which is checked before anything is
 * concluded from this one.
 *
 * @returns {number} visibility in 0..1, 1 = unoccluded
 */
function unionVisibility( position, normal, occluders, rays, seed ) {

    let state = seed >>> 0;
    const random = () => {

        state = ( Math.imul( state, 1664525 ) + 1013904223 ) >>> 0;
        return state / 4294967296;

    };

    const up = Math.abs( normal[ 1 ] ) < 0.9 ? [ 0, 1, 0 ] : [ 1, 0, 0 ];
    const tangent = normalise( cross( up, normal ) );
    const bitangent = cross( normal, tangent );

    const relative = occluders.map( ( occluder ) => {

        const offset = [
            occluder.centre[ 0 ] - position[ 0 ],
            occluder.centre[ 1 ] - position[ 1 ],
            occluder.centre[ 2 ] - position[ 2 ]
        ];

        return { offset, distanceSquared: dot( offset, offset ), radiusSquared: occluder.radius ** 2 };

    } );

    let hits = 0;

    for ( let sample = 0; sample < rays; sample += 1 ) {

        const r = Math.sqrt( random() );
        const phi = 2 * Math.PI * random();
        const x = r * Math.cos( phi );
        const y = r * Math.sin( phi );
        const z = Math.sqrt( Math.max( 0, 1 - x * x - y * y ) );

        const direction = [
            tangent[ 0 ] * x + bitangent[ 0 ] * y + normal[ 0 ] * z,
            tangent[ 1 ] * x + bitangent[ 1 ] * y + normal[ 1 ] * z,
            tangent[ 2 ] * x + bitangent[ 2 ] * y + normal[ 2 ] * z
        ];

        for ( const occluder of relative ) {

            const projection = dot( occluder.offset, direction );
            if ( projection <= 0 ) continue;

            if ( occluder.distanceSquared - projection * projection <= occluder.radiusSquared ) {

                hits += 1;
                break;

            }

        }

    }

    return 1 - hits / rays;

}

/** The careless implementation: the distant-sphere solid angle, used at every distance. */
function distantSphereOcclusion( position, normal, centre, radius ) {

    const d = [ centre[ 0 ] - position[ 0 ], centre[ 1 ] - position[ 1 ], centre[ 2 ] - position[ 2 ] ];
    const distance = Math.hypot( d[ 0 ], d[ 1 ], d[ 2 ] );
    const cosine = dot( normal, d ) / distance;

    return Math.max( 0, cosine ) / ( distance / radius ) ** 2;

}

// --- AGAINST MONTE CARLO --------------------------------------------------------------------------

console.log( '\nAGAINST MONTE CARLO — the closed form against a 200k-ray integration of the same geometry\n' );

const RAYS = 200000;

// Eleven configurations spanning both REGIMES, and the split between them is not obvious enough
// to leave implicit:
//
//   k2 = 1 − h²·nl² and, for a receiver plane, h·nl reduces to (centre height ÷ radius). So a
//   sphere RESTING on the floor sits exactly at k2 = 0 — its horizon is tangent — and the exact
//   form degenerates to the distant-sphere expression. That is why the first four rows below
//   agree to the last digit and why a gate built only from them would pass on the wrong formula.
//   The exact branch is reached only when a sphere is PARTIALLY BELOW the receiver's horizon
//   plane, which on this rig is every foot (its sphere sits at the foot-to-ball midpoint, closer
//   to the floor than its own radius) and every point of a receiver that is not horizontal.
const CONFIGURATIONS = [
    { name: 'contact, directly under', position: [ 0, 0, 0 ], normal: [ 0, 1, 0 ], centre: [ 0, 0.05, 0 ], radius: 0.05 },
    { name: 'contact, 0.5 r out', position: [ 0.025, 0, 0 ], normal: [ 0, 1, 0 ], centre: [ 0, 0.05, 0 ], radius: 0.05 },
    { name: 'contact, 2 r out', position: [ 0.10, 0, 0 ], normal: [ 0, 1, 0 ], centre: [ 0, 0.05, 0 ], radius: 0.05 },
    { name: 'contact, 6 r out', position: [ 0.30, 0, 0 ], normal: [ 0, 1, 0 ], centre: [ 0, 0.05, 0 ], radius: 0.05 },
    { name: 'raised sphere, under', position: [ 0, 0, 0 ], normal: [ 0, 1, 0 ], centre: [ 0, 0.9, 0 ], radius: 0.11 },
    { name: 'raised sphere, 1 m out', position: [ 1.0, 0, 0 ], normal: [ 0, 1, 0 ], centre: [ 0, 0.9, 0 ], radius: 0.11 },
    { name: 'far field', position: [ 4.0, 0, 0 ], normal: [ 0, 1, 0 ], centre: [ 0, 0.9, 0 ], radius: 0.11 },
    // k2 > 0 from here down: the sphere straddles the receiver's horizon.
    { name: 'foot, half sunk, under', position: [ 0, 0, 0 ], normal: [ 0, 1, 0 ], centre: [ 0, 0.02, 0 ], radius: 0.06 },
    { name: 'foot, half sunk, 60 mm out', position: [ 0.06, 0, 0 ], normal: [ 0, 1, 0 ], centre: [ 0, 0.02, 0 ], radius: 0.06 },
    { name: 'foot, half sunk, 150 mm out', position: [ 0.15, 0, 0 ], normal: [ 0, 1, 0 ], centre: [ 0, 0.02, 0 ], radius: 0.06 },
    { name: 'tilted receiver', position: [ 0.2, 0, 0.1 ], normal: normalise( [ 0.3, 1, -0.2 ] ), centre: [ 0, 0.25, 0 ], radius: 0.12 }
];

// 200k cosine-weighted samples have a standard error of at most 0.5/sqrt(200000) = 0.0011, so a
// 0.004 tolerance is ~3.5 sigma. Tight enough that the wrong formula below cannot slip through.
const MONTE_CARLO_TOLERANCE = 0.004;

let worstAnalyticError = 0;
let worstApproximationError = 0;

console.log( `      ${ 'configuration'.padEnd( 26 ) }${ 'analytic'.padStart( 10 ) }${ 'monte carlo'.padStart( 13 ) }` +
    `${ 'Δ'.padStart( 10 ) }${ 'distant approx'.padStart( 16 ) }${ 'its Δ'.padStart( 10 ) }` );

for ( const configuration of CONFIGURATIONS ) {

    const { position, normal, centre, radius } = configuration;

    const analytic = sphereOcclusion( position, normal, centre, radius );
    const sampled = monteCarloOcclusion( position, normal, centre, radius, RAYS, 20260808 );
    const approximate = distantSphereOcclusion( position, normal, centre, radius );

    const analyticError = Math.abs( analytic - sampled );
    const approximationError = Math.abs( approximate - sampled );

    worstAnalyticError = Math.max( worstAnalyticError, analyticError );
    worstApproximationError = Math.max( worstApproximationError, approximationError );

    console.log( `      ${ configuration.name.padEnd( 26 ) }${ analytic.toFixed( 5 ).padStart( 10 ) }` +
        `${ sampled.toFixed( 5 ).padStart( 13 ) }${ analyticError.toFixed( 5 ).padStart( 10 ) }` +
        `${ approximate.toFixed( 5 ).padStart( 16 ) }${ approximationError.toFixed( 5 ).padStart( 10 ) }` );

}

report(
    `analytic occlusion matches the integrator to ${ MONTE_CARLO_TOLERANCE } over all ${ CONFIGURATIONS.length } configurations`,
    worstAnalyticError <= MONTE_CARLO_TOLERANCE,
    `worst Δ ${ worstAnalyticError.toFixed( 5 ) }`
);

// PROVED RED. The distant-sphere approximation is the thing a careless implementation ships, and
// it is CORRECT in the far field — so a gate that could not tell them apart would pass on it.
report(
    'PROVED RED: the distant-sphere approximation FAILS the same check',
    worstApproximationError > MONTE_CARLO_TOLERANCE,
    `worst Δ ${ worstApproximationError.toFixed( 5 ) }, i.e. ${ ( worstApproximationError / MONTE_CARLO_TOLERANCE ).toFixed( 0 ) }x the tolerance`
);

// --- LIMITS ------------------------------------------------------------------------------------

console.log( '\nLIMITS\n' );

{
    // Far field: the analytic form must tend to A·cosθ/(π·d²) — the projected solid angle of a
    // disc of the sphere's cross-section, over π.
    const radius = 0.1;
    const distance = 20;
    const analytic = sphereOcclusion( [ 0, 0, 0 ], [ 0, 1, 0 ], [ 0, distance, 0 ], radius );
    const expected = ( Math.PI * radius * radius ) / ( Math.PI * distance * distance );

    report(
        'far field tends to the projected solid angle over π',
        Math.abs( analytic - expected ) / expected < 0.01,
        `analytic ${ analytic.toExponential( 4 ) } against ${ expected.toExponential( 4 ) }`
    );
}

{
    const below = sphereOcclusion( [ 0, 0, 0 ], [ 0, 1, 0 ], [ 0, -1, 0 ], 0.2 );

    report( 'a sphere entirely below the horizon occludes nothing', below === 0, `${ below }` );
}

{
    // A receiver swallowed by an occluder. The exact form's (h²−1) goes negative there; without
    // the clamp this returns NaN, which reaches the shader as a black hole on the floor.
    const swallowed = sphereOcclusion( [ 0, 0, 0 ], [ 0, 1, 0 ], [ 0, 0.01, 0 ], 0.5 );

    report(
        'a receiver inside an occluder returns a finite, saturated occlusion',
        Number.isFinite( swallowed ) && within( swallowed, 0.9, 1 ),
        `${ swallowed.toFixed( 5 ) }`
    );
}

{
    // A sphere whose CENTRE lies in the horizon plane still has a hemisphere above it, so the
    // right answer is small but not zero — and it is small because everything above the horizon
    // there is at grazing incidence, where the cosine weight is ~0. Asserting zero here was the
    // first version of this check and it was wrong; the integrator settled it.
    const grazing = sphereOcclusion( [ 0, 0, 0 ], [ 0, 1, 0 ], [ 5, 0, 0 ], 0.2 );
    const sampled = monteCarloOcclusion( [ 0, 0, 0 ], [ 0, 1, 0 ], [ 5, 0, 0 ], 0.2, 4000000, 7 );

    report(
        'a sphere centred on the horizon occludes a little, and the integrator agrees',
        grazing > 0 && grazing < 1e-4 && Math.abs( grazing - sampled ) < 2e-5,
        `analytic ${ grazing.toExponential( 3 ) }, monte carlo ${ sampled.toExponential( 3 ) }`
    );
}

// --- COMBINATION ----------------------------------------------------------------------------------

console.log( '\nCOMBINATION — ORDINAL ONLY. Every check here is also true of a wrong rule.\n' );

{
    const one = [ { centre: [ 0, 0.05, 0 ], radius: 0.05 } ];
    const two = [ ...one, { centre: [ 0.12, 0.05, 0 ], radius: 0.05 } ];
    const twelve = Array.from( { length: MAX_OCCLUDERS }, ( _, index ) => (
        { centre: [ index * 0.12, 0.05, 0 ], radius: 0.05 }
    ) );

    const v1 = groundVisibility( [ 0.02, 0, 0 ], [ 0, 1, 0 ], one );
    const v2 = groundVisibility( [ 0.02, 0, 0 ], [ 0, 1, 0 ], two );
    const v12 = groundVisibility( [ 0.02, 0, 0 ], [ 0, 1, 0 ], twelve );

    report( 'visibility falls as occluders are added', v1 > v2 && v2 >= v12, `${ v1.toFixed( 4 ) } > ${ v2.toFixed( 4 ) } >= ${ v12.toFixed( 4 ) }` );
    report( 'visibility stays inside 0..1 at the full occluder budget', within( v12, 0, 1 ), `${ v12.toFixed( 6 ) }` );
    report( 'an empty occluder set is fully visible', groundVisibility( [ 0, 0, 0 ], [ 0, 1, 0 ], [] ) === 1 );
}

// --- THE COMBINATION GATE ---------------------------------------------------------------------

console.log( '\nTHE COMBINATION GATE — against a UNION integrator, which is the only referee for how\n' +
    'spheres compose. The ordinal checks above passed a clamped sum that is wrong by 1.9x.\n' );

/**
 * The fitted occluder set of the shipped figure, so the gate is stated on the geometry that
 * actually renders rather than on a plausible-looking invention.
 *
 * PROVENANCE: `new GroundContact().fitTo( figure_g050.glb )` then reading `ground.spheres`, world
 * space, metres. The radii it reports — 46.4 mm foot, 37.3 mm toe ball, 57.7/58.2 mm calf,
 * 91.4/92.3 mm thigh, 127.6 mm pelvis, 145.6 mm chest — are the ones `GroundContact.js`'s header
 * quotes, which is the cross-check that this list is the real fit and not a transcription.
 *
 * Sixteen entries and no `lowerarm_r`: see the BUDGET block at the end for why, and for the
 * measurement that says it is allowed to be missing.
 */
const RIG_OCCLUDERS = [
    { centre: [ 0.18233, 0.05411, 0.05166 ], radius: 0.04643 },   // foot_l, 0.25 along
    { centre: [ 0.18503, 0.02400, 0.11008 ], radius: 0.04643 },   // foot_l, 0.75 along
    { centre: [ -0.18233, 0.05411, 0.05166 ], radius: 0.04643 },  // foot_r, 0.25 along
    { centre: [ -0.18503, 0.02400, 0.11008 ], radius: 0.04643 },  // foot_r, 0.75 along
    { centre: [ 0.18639, 0.00894, 0.13929 ], radius: 0.03727 },   // ball_l
    { centre: [ -0.18639, 0.00894, 0.13929 ], radius: 0.03727 },  // ball_r
    { centre: [ 0.16181, 0.27179, 0.02988 ], radius: 0.05774 },   // calf_l
    { centre: [ -0.16181, 0.27179, 0.02988 ], radius: 0.05819 },  // calf_r
    { centre: [ 0.12206, 0.67003, 0.02116 ], radius: 0.09136 },   // thigh_l
    { centre: [ -0.12206, 0.67003, 0.02116 ], radius: 0.09227 },  // thigh_r
    { centre: [ 0.00000, 0.91360, -0.00608 ], radius: 0.12760 },  // pelvis
    { centre: [ 0.00000, 1.05721, -0.00895 ], radius: 0.14561 },  // spine_02
    { centre: [ 0.00000, 1.46410, 0.02457 ], radius: 0.06269 },   // neck_01
    { centre: [ 0.25059, 1.22983, 0.01966 ], radius: 0.05201 },   // upperarm_l
    { centre: [ -0.25059, 1.22983, 0.01966 ], radius: 0.05201 },  // upperarm_r
    { centre: [ 0.39213, 1.07755, 0.10164 ], radius: 0.03355 }    // lowerarm_l
];

const UP = [ 0, 1, 0 ];

/**
 * Where the gate is measured.
 *
 * Sixteen floor points on the real rig — the ring a judge reads, from between the feet out past
 * them — plus six synthetic sets, each chosen because it is the blind spot of one rival rule.
 * "Two spheres straddling the receiver" is the one that kills taking the strongest occluder alone;
 * "16 collinear" kills the mean and the weakest; the limb capsule is where the shipped product is
 * at its worst and is kept for exactly that reason.
 *
 * 🚩 What is NOT in here: two spheres at the SAME centre. The product is at its worst there
 * (0.1939) and it would set the tolerance, but `fitTo` cannot produce it — two bones would have to
 * share a world position and a radius. It is measured and printed below as characterisation, and
 * deliberately kept out of the gated statistic. Excluding an unreachable configuration is not the
 * same as excluding an inconvenient one, and the line between those is that this one is reported.
 */
const GATE_CONFIGURATIONS = [
    ...[
        [ 0.15, 0.15 ], [ -0.15, 0.15 ], [ 0.25, 0.15 ], [ 0.20, 0.20 ], [ 0.25, 0.05 ], [ 0.00, 0.00 ],
        [ 0.00, 0.10 ], [ 0.10, -0.05 ], [ 0.30, 0.00 ], [ -0.30, 0.10 ], [ 0.18, -0.10 ], [ 0.45, 0.30 ],
        [ 0.05, 0.25 ], [ -0.05, -0.15 ], [ 0.35, 0.20 ], [ 0.00, 0.30 ]
    ].map( ( [ x, z ] ) => ( {
        name: `rig floor (${ x.toFixed( 2 ) }, ${ z.toFixed( 2 ) })`,
        position: [ x, 0, z ], normal: UP, occluders: RIG_OCCLUDERS
    } ) ),
    {
        name: 'one sphere', position: [ 0.02, 0, 0 ], normal: UP,
        occluders: [ { centre: [ 0, 0.05, 0 ], radius: 0.05 } ]
    },
    {
        name: 'two straddling the point', position: [ 0.06, 0, 0 ], normal: UP,
        occluders: [ { centre: [ 0, 0.05, 0 ], radius: 0.05 }, { centre: [ 0.12, 0.05, 0 ], radius: 0.05 } ]
    },
    {
        name: 'limb capsule, 4 spheres', position: [ 0.10, 0, 0 ], normal: UP,
        occluders: Array.from( { length: 4 }, ( _, index ) => ( { centre: [ 0, 0.06 + index * 0.05, 0 ], radius: 0.058 } ) )
    },
    {
        name: '16 collinear', position: [ 0.02, 0, 0 ], normal: UP,
        occluders: Array.from( { length: MAX_OCCLUDERS }, ( _, index ) => ( { centre: [ index * 0.12, 0.05, 0 ], radius: 0.05 } ) )
    },
    {
        name: 'one near, fifteen far', position: [ 0.03, 0, 0 ], normal: UP,
        occluders: [
            { centre: [ 0, 0.05, 0 ], radius: 0.05 },
            ...Array.from( { length: 15 }, ( _, index ) => ( { centre: [ 2 + index * 0.3, 0.9, 0 ], radius: 0.1 } ) )
        ]
    },
    {
        name: 'tilted receiver, rig', position: [ 0.16, 0, 0.10 ], normal: normalise( [ 0.25, 1, -0.15 ] ),
        occluders: RIG_OCCLUDERS
    }
];

const UNION_RAYS = 200000;
const UNION_SEED = 987654;

/** The reference visibility for every gated configuration, computed once and shared by all rules. */
const UNION_TRUTH = GATE_CONFIGURATIONS.map(
    ( configuration ) => unionVisibility( configuration.position, configuration.normal, configuration.occluders, UNION_RAYS, UNION_SEED )
);

/** Per-sphere occlusions, the input every candidate combination rule folds differently. */
function occlusionsFor( configuration ) {

    return configuration.occluders.map(
        ( occluder ) => sphereOcclusion( configuration.position, configuration.normal, occluder.centre, occluder.radius )
    );

}

/** Worst and RMS deviation of one combination rule from the union integrator, over the gate set. */
function fidelityOf( rule ) {

    let worst = 0;
    let worstAt = '';
    let sumOfSquares = 0;

    GATE_CONFIGURATIONS.forEach( ( configuration, index ) => {

        const error = Math.abs( rule( configuration ) - UNION_TRUTH[ index ] );

        if ( error > worst ) {

            worst = error;
            worstAt = configuration.name;

        }

        sumOfSquares += error * error;

    } );

    return { worst, worstAt, rms: Math.sqrt( sumOfSquares / GATE_CONFIGURATIONS.length ) };

}

const SHIPPED_RULE = ( configuration ) => groundVisibility( configuration.position, configuration.normal, configuration.occluders );

/**
 * Seven ways to get the fold wrong, all of them things a plausible implementation does.
 *
 * The first is the defect this gate was written for. `skips the first occluder` and `runs half the
 * list` are loop bugs rather than model errors and are here because the CONTRACT block is what
 * catches them — one of them beats the shipped rule on RMS.
 */
const RIVAL_RULES = {
    'clamped sum  1 − Σo': ( c ) => Math.max( 0, 1 - occlusionsFor( c ).reduce( ( total, o ) => total + o, 0 ) ),
    'strongest occluder': ( c ) => 1 - Math.max( ...occlusionsFor( c ) ),
    'weakest occluder': ( c ) => 1 - Math.min( ...occlusionsFor( c ) ),
    'mean transmittance': ( c ) => {

        const transmittances = occlusionsFor( c ).map( ( o ) => 1 - o );
        return transmittances.reduce( ( total, t ) => total + t, 0 ) / transmittances.length;

    },
    'optical depth e^−Σo': ( c ) => Math.exp( -occlusionsFor( c ).reduce( ( total, o ) => total + o, 0 ) ),
    'skips the first': ( c ) => occlusionsFor( c ).slice( 1 ).reduce( ( v, o ) => v * ( 1 - o ), 1 ),
    'runs half the list': ( c ) => occlusionsFor( c ).slice( 0, Math.ceil( c.occluders.length / 2 ) ).reduce( ( v, o ) => v * ( 1 - o ), 1 )
};

{
    // Tie the new reference to the old one before concluding anything from it. Over one sphere the
    // union integrator IS the single-sphere integrator, and both are already pinned to the analytic
    // form at the top of this file — so if they disagree here, the union tracer is what is broken.
    let worstTie = 0;

    for ( const configuration of CONFIGURATIONS ) {

        const { position, normal, centre, radius } = configuration;
        const asUnion = 1 - unionVisibility( position, normal, [ { centre, radius } ], UNION_RAYS, UNION_SEED );
        const asSingle = monteCarloOcclusion( position, normal, centre, radius, UNION_RAYS, UNION_SEED );

        worstTie = Math.max( worstTie, Math.abs( asUnion - asSingle ) );

    }

    report(
        'the union integrator reduces to the single-sphere integrator, ray for ray',
        worstTie < 1e-12,
        `worst Δ ${ worstTie.toExponential( 2 ) } over all ${ CONFIGURATIONS.length } single-sphere configurations`
    );
}

const shipped = fidelityOf( SHIPPED_RULE );

/**
 * The shipped rule's measured accuracy, plus the headroom that makes this a gate rather than a
 * record of today's number. 0.20 sits between the shipped 0.1562 and the closest rival's 0.2622,
 * at 1.28x above one and 1.31x below the other — so the band is not tuned to either edge.
 */
const COMBINATION_TOLERANCE = 0.20;

console.log( `      ${ 'rule'.padEnd( 22 ) }${ 'worst |Δ|'.padStart( 11 ) }${ 'RMS Δ'.padStart( 10 ) }   worst at` );
console.log( `      ${ 'SHIPPED  ∏(1−o)'.padEnd( 22 ) }${ shipped.worst.toFixed( 4 ).padStart( 11 ) }` +
    `${ shipped.rms.toFixed( 4 ).padStart( 10 ) }   ${ shipped.worstAt }` );

for ( const [ name, rule ] of Object.entries( RIVAL_RULES ) ) {

    const rival = fidelityOf( rule );
    console.log( `      ${ name.padEnd( 22 ) }${ rival.worst.toFixed( 4 ).padStart( 11 ) }` +
        `${ rival.rms.toFixed( 4 ).padStart( 10 ) }   ${ rival.worstAt }` );

}

report(
    `the shipped combination tracks the union integrator to ${ COMBINATION_TOLERANCE } over ${ GATE_CONFIGURATIONS.length } configurations`,
    shipped.worst <= COMBINATION_TOLERANCE,
    `worst |Δ| ${ shipped.worst.toFixed( 4 ) } at ${ shipped.worstAt }, RMS ${ shipped.rms.toFixed( 4 ) }`
);

// PROVED RED, seven ways. One wrong rule caught is a gate that catches one wrong rule.
for ( const [ name, rule ] of Object.entries( RIVAL_RULES ) ) {

    const rival = fidelityOf( rule );

    report(
        `PROVED RED: "${ name }" fails the same check`,
        rival.worst > COMBINATION_TOLERANCE,
        `worst |Δ| ${ rival.worst.toFixed( 4 ) } at ${ rival.worstAt }, i.e. ${ ( rival.worst / COMBINATION_TOLERANCE ).toFixed( 2 ) }x the tolerance`
    );

}

{
    // The DIRECTION of the error, asserted rather than described, because the header used to
    // describe it backwards ("the product under-counts, which reads as a softer contact").
    //
    // The sign is the independence assumption's signature and it is not one-way: where occluders
    // overlap on the receiver's hemisphere the product double-counts and goes DARK, and where they
    // are disjoint it misses the cross terms and goes LIGHT. What matters is which of those the rig
    // actually produces, so the two are gated apart — on the real figure every deviation is dark,
    // and the light ones only appear in synthetic sets with a sphere on either side of the point.
    const deltas = GATE_CONFIGURATIONS.map(
        ( configuration, index ) => ( { name: configuration.name, delta: SHIPPED_RULE( configuration ) - UNION_TRUTH[ index ] } )
    );

    const onTheRig = deltas.filter( ( entry ) => entry.name.startsWith( 'rig floor' ) || entry.name.endsWith( ', rig' ) );
    const dark = onTheRig.filter( ( entry ) => entry.delta < 0 );
    const lightest = Math.max( ...deltas.map( ( entry ) => entry.delta ) );
    const darkest = Math.min( ...deltas.map( ( entry ) => entry.delta ) );

    report(
        'on the real rig the product only ever goes DARK — the header once claimed the opposite',
        onTheRig.length === 17 && dark.length === onTheRig.length,
        `${ dark.length }/${ onTheRig.length } rig configurations negative, worst ` +
            `${ Math.min( ...onTheRig.map( ( entry ) => entry.delta ) ).toFixed( 4 ) }`
    );

    report(
        'and where it goes light instead — disjoint occluders — it is a third the size',
        lightest > 0 && lightest < 0.08,
        `worst light deviation ${ lightest >= 0 ? '+' : '' }${ lightest.toFixed( 4 ) }, against ${ darkest.toFixed( 4 ) } dark`
    );

    // Characterisation, not a gate: the degenerate configuration the fit cannot reach, where the
    // independence assumption is at its very worst. Printed so the tolerance above is not mistaken
    // for the approximation's true ceiling.
    const coincident = [ { centre: [ 0, 0.05, 0 ], radius: 0.05 }, { centre: [ 0, 0.05, 0 ], radius: 0.05 } ];
    const coincidentTruth = unionVisibility( [ 0.06, 0, 0 ], UP, coincident, UNION_RAYS, UNION_SEED );
    const coincidentProduct = groundVisibility( [ 0.06, 0, 0 ], UP, coincident );

    console.log( `      (not gated) two spheres at one centre: union ${ coincidentTruth.toFixed( 4 ) }, ` +
        `product ${ coincidentProduct.toFixed( 4 ) }, Δ ${ ( coincidentProduct - coincidentTruth ).toFixed( 4 ) } — ` +
        'unreachable by fitTo, so it sets no tolerance' );
}

// --- CONTRACT -----------------------------------------------------------------------------------

console.log( '\nCONTRACT — tolerance-free, and the only thing that catches a loop that quits early\n' );

{
    // A loop bug does not have to look inaccurate. "Runs half the list" scores BETTER than the
    // shipped rule on RMS above, because throwing occluders away cancels the product's own
    // over-darkening. Fidelity can never catch that; this can.
    const configuration = { position: [ 0.40, 0, 0.10 ], normal: UP, occluders: RIG_OCCLUDERS };
    const complete = groundVisibility( configuration.position, configuration.normal, RIG_OCCLUDERS );

    let smallestGain = Infinity;
    let deafTo = null;

    for ( let index = 0; index < RIG_OCCLUDERS.length; index += 1 ) {

        const without = RIG_OCCLUDERS.filter( ( _unused, other ) => other !== index );
        const gain = groundVisibility( configuration.position, configuration.normal, without ) - complete;

        if ( gain <= 0 ) deafTo = index;
        smallestGain = Math.min( smallestGain, gain );

    }

    report(
        `every one of the ${ RIG_OCCLUDERS.length } occluders changes the answer — no element is skipped`,
        deafTo === null && smallestGain > 1e-6,
        deafTo === null ? `smallest single-occluder contribution ${ smallestGain.toExponential( 2 ) }` : `deaf to occluder ${ deafTo }`
    );

    // The documented rule IS the implemented rule. Deliberately changing the model — to the
    // inclusion-exclusion form `groundVisibility`'s docstring costs out, say — must fail here, and
    // that is the point: the header and this line move together or not at all.
    let worstIdentity = 0;

    for ( const gateConfiguration of GATE_CONFIGURATIONS ) {

        const folded = occlusionsFor( gateConfiguration ).reduce( ( v, o ) => v * ( 1 - o ), 1 );
        worstIdentity = Math.max( worstIdentity, Math.abs( SHIPPED_RULE( gateConfiguration ) - folded ) );

    }

    report(
        'the fold is exactly the documented product of per-sphere transmittances',
        worstIdentity < 1e-12,
        `worst Δ ${ worstIdentity.toExponential( 2 ) } over ${ GATE_CONFIGURATIONS.length } configurations`
    );
}

// --- BUDGET -------------------------------------------------------------------------------------

console.log( '\nBUDGET — the segment list asks for more spheres than the shader loop runs\n' );

{
    const requested = OCCLUDER_SEGMENTS.reduce( ( total, segment ) => total + segment.spheres, 0 );
    const dropped = requested - MAX_OCCLUDERS;

    report(
        `OCCLUDER_SEGMENTS asks for ${ requested } spheres and MAX_OCCLUDERS runs ${ MAX_OCCLUDERS }`,
        requested === 17 && MAX_OCCLUDERS === 16,
        `${ dropped } dropped from the tail, which is "${ OCCLUDER_SEGMENTS[ OCCLUDER_SEGMENTS.length - 1 ].bone }"`
    );

    // The truncation is asymmetric — lowerarm_l occludes and lowerarm_r does not. That is allowed
    // because of this number and not because of an argument, so the number is the gate. Restore
    // the missing forearm by mirroring the one that survived, and measure what the floor loses.
    const restored = [ ...RIG_OCCLUDERS, { centre: [ -0.39213, 1.07755, 0.10164 ], radius: 0.03355 } ];

    let worstLoss = 0;
    let worstAsymmetry = 0;

    for ( let x = -0.6; x <= 0.601; x += 0.1 ) {

        for ( let z = -0.2; z <= 0.301; z += 0.1 ) {

            worstLoss = Math.max( worstLoss, Math.abs(
                groundVisibility( [ x, 0, z ], UP, RIG_OCCLUDERS ) - groundVisibility( [ x, 0, z ], UP, restored )
            ) );

            worstAsymmetry = Math.max( worstAsymmetry, Math.abs(
                groundVisibility( [ x, 0, z ], UP, RIG_OCCLUDERS ) - groundVisibility( [ -x, 0, z ], UP, RIG_OCCLUDERS )
            ) );

        }

    }

    report(
        'what the dropped forearm costs the floor stays under 1e-3 of visibility',
        worstLoss < 1e-3,
        `worst ${ worstLoss.toExponential( 2 ) } — a 17th sphere would buy this much and two transcendentals per ground pixel`
    );

    report(
        'and the left/right asymmetry it leaves is under 1e-3 too',
        worstAsymmetry < 1e-3,
        `worst ${ worstAsymmetry.toExponential( 2 ) }, against the ~1e-2 of luma a judge's column read resolves`
    );

    // The field exists and starts clean. A fit that truncates nothing must report nothing, or the
    // check above is reading a list that is always empty for a reason unrelated to the budget.
    const ground = new GroundContact( { occlusion: false } );

    report(
        'GroundContact.truncated starts empty and stays empty when nothing is dropped',
        Array.isArray( ground.truncated ) && ground.truncated.length === 0 &&
            ground.fitTo( new Bone() ) !== undefined && ground.truncated.length === 0,
        `${ ground.truncated.length } truncated after a fit that places no spheres at all`
    );

    ground.dispose();
}

// --- THE CONTACT PROFILE ---------------------------------------------------------------------------

console.log( '\nTHE CONTACT PROFILE — the quantity "the figure floats" is stated in\n' );

{
    // A foot-sized sphere resting on the floor, sampled outward the way a judge reads a column of
    // pixels below a sole. The shipped plate moved 0.0014 of luma over 57 px; this must move far
    // more than that, and it must move MONOTONICALLY — a profile with a bright ring in it reads as
    // a rendering artefact rather than as contact.
    const foot = [ { centre: [ 0, 0.04, 0 ], radius: 0.04 } ];
    const profile = [ 0, 0.02, 0.04, 0.08, 0.12, 0.2, 0.3, 0.5, 0.8 ].map( ( x ) => ( {
        x,
        visibility: groundVisibility( [ x, 0, 0 ], [ 0, 1, 0 ], foot )
    } ) );

    console.log( `      ${ 'x (m)'.padStart( 8 ) }${ 'visibility'.padStart( 13 ) }` );
    for ( const sample of profile ) {
        console.log( `      ${ sample.x.toFixed( 2 ).padStart( 8 ) }${ sample.visibility.toFixed( 4 ).padStart( 13 ) }` );
    }

    let monotone = true;
    for ( let index = 1; index < profile.length; index += 1 ) {
        if ( profile[ index ].visibility < profile[ index - 1 ].visibility - 1e-9 ) monotone = false;
    }

    const range = profile[ profile.length - 1 ].visibility - profile[ 0 ].visibility;

    report( 'the contact profile rises monotonically outward', monotone );
    report(
        'and it rises by far more than the 0.0014 the shipped plate measured',
        range > 0.3,
        `${ range.toFixed( 4 ) } of visibility over 0.8 m, against 0.0014 of luma over 57 px on the shipped plate`
    );
    report(
        'directly under the contact point is at least half occluded',
        profile[ 0 ].visibility < 0.5,
        `visibility ${ profile[ 0 ].visibility.toFixed( 4 ) }`
    );
}

// --- RADIUS FIT ------------------------------------------------------------------------------------

console.log( '\nRADIUS FIT — on a synthetic body of KNOWN radius, because the real asset has no known answer\n' );

{
    // A two-bone cylinder: bone A from y=0 to y=1, bone B from y=1 to y=2, and a shell of vertices
    // at a known radius about each. If the fit reports anything other than those radii it is
    // measuring something else — the bone spacing, the vertex count, or its own assumptions.
    const KNOWN_RADIUS_A = 0.062;
    const KNOWN_RADIUS_B = 0.031;

    const boneA = new Bone();
    boneA.name = 'segment_a';
    const boneB = new Bone();
    boneB.name = 'segment_b';
    boneB.position.set( 0, 1, 0 );
    boneA.add( boneB );
    boneA.updateMatrixWorld( true );

    const positions = [];
    const indices = [];
    const weights = [];

    for ( let step = 0; step < 64; step += 1 ) {

        const angle = ( step / 64 ) * Math.PI * 2;

        for ( const [ boneIndex, radius, low, high ] of [ [ 0, KNOWN_RADIUS_A, 0.05, 0.95 ], [ 1, KNOWN_RADIUS_B, 1.05, 1.95 ] ] ) {

            for ( const height of [ low, ( low + high ) / 2, high ] ) {

                positions.push( Math.cos( angle ) * radius, height, Math.sin( angle ) * radius );
                indices.push( boneIndex, 0, 0, 0 );
                weights.push( 1, 0, 0, 0 );

            }

        }

    }

    const geometry = new BufferGeometry();
    geometry.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
    geometry.setAttribute( 'skinIndex', new Uint16BufferAttribute( indices, 4 ) );
    geometry.setAttribute( 'skinWeight', new Float32BufferAttribute( weights, 4 ) );

    const mesh = new SkinnedMesh( geometry, new MeshStandardNodeMaterial() );
    mesh.bind( new Skeleton( [ boneA, boneB ] ), new Matrix4() );

    const radii = measureBoneRadii( mesh );

    report(
        'the fit recovers a known 62 mm segment radius',
        within( radii.get( 'segment_a' ), KNOWN_RADIUS_A * 0.98, KNOWN_RADIUS_A * 1.02 ),
        `measured ${ ( radii.get( 'segment_a' ) * 1000 ).toFixed( 2 ) } mm against ${ ( KNOWN_RADIUS_A * 1000 ).toFixed( 2 ) } mm`
    );

    // The second bone has no child, so it has no axis of its own — it inherits its parent's
    // direction. That path exists for the ball of the foot, which is the occluder nearest the
    // floor in the whole figure and the one bone with no child, so "skip tips" would have thrown
    // away the toes' contact shadow. Checked on a DIFFERENT known radius from the first bone, so
    // a fit that quietly reported the parent's answer twice would fail.
    report(
        'a tip bone inherits its parent axis and recovers its own 31 mm radius',
        within( radii.get( 'segment_b' ), KNOWN_RADIUS_B * 0.98, KNOWN_RADIUS_B * 1.02 ),
        `measured ${ ( ( radii.get( 'segment_b' ) ?? 0 ) * 1000 ).toFixed( 2 ) } mm against ${ ( KNOWN_RADIUS_B * 1000 ).toFixed( 2 ) } mm`
    );
}

console.log( '\nTHE ALBEDO — blue lowest, and by ENOUGH. The old note asserted the clause and never\n' +
             'stated the margin, and a floor that satisfied the letter of it measured worse than\n' +
             'the floor it replaced.\n' );

{
    // The floor's DIFFUSE response to the rim is `albedo × lightColour`, both linear. That product
    // is the only part of the picture the albedo governs, and the number that decides whether a
    // saturated rim reads as a coloured pool is how far the albedo pushes the product's blue back
    // down relative to its red. Stated as a suppression factor so it is comparable across floors:
    //
    //     suppression = (albedo_R / albedo_B),  i.e. how many times the blue:red of the LIGHT is
    //                    divided down by the time it comes off this surface.
    //
    // Anchored on rendered plates, `lighting.html?frame=body&bare` at 900×1200, WebGPU, MSAA
    // default, everything but `?floor=` held, with the shipped rim standoff:
    //
    //   | floor albedo          | suppression | rendered floor HSV S | frame saturated-blue |
    //   |-----------------------|------------:|---------------------:|---------------------:|
    //   | `0x2e3036` (rejected) |        0.74 | 0.62 (on record)     | —                    |
    //   | `0x7a7570` (neutral)  |        1.20 | 0.5427               | 12.45%               |
    //   | `0x8a8378` (warm-ish) |        1.35 | 0.4888               | 3.51%                |
    //   | `0x4b3520` (previous) |        4.87 | 0.2661 today; 0.7342 at the old rim standoff    |
    //   | **`0x968c34`**        |    **8.88** | **0.2216**           | **0.03%**            |
    //
    // ⚠️ UNRESOLVED, AND FLAGGED RATHER THAN QUIETLY RECONCILED: that last cell says 0.03% and the
    // same shipped plate re-measured for this round says **0.074%** — HSV S > 0.5, hue 200–300°,
    // whole frame, `lighting.html?frame=body&bare&w=900&h=1200&webgl`. `LightingRig.selftest.mjs`
    // has long carried 0.07% for the same configuration, so the disagreement is between this cell
    // and two independent readings rather than between two readings. The likeliest cause is the
    // backend: this row was captured on WebGPU and both others on WebGL2. Both numbers are far
    // below anything the gate turns on, so nothing here depends on which is right — but it should
    // be settled by a WebGPU re-capture rather than by picking one.
    //
    // 🚩 THE SECOND AND THIRD ROWS ARE THE POINT. Both have blue as their lowest channel, so both
    // pass the clause as it used to be written, and both render a floor more saturated than the
    // skin. The floor of 4.0 sits above them and below the two that work.
    //
    // 🚩 **AND THE OTHER HALF OF THE PRODUCT IS NOT IN THIS BLOCK AT ALL.** Read the definition
    // again: `suppression = albedo_R / albedo_B`. It is a property of a hex and of nothing else.
    // "how many times the blue:red of the LIGHT is divided down" quietly assumes the light's
    // blue:red is a constant, and it is not — it is `LightingRig`'s to set, and a verifier moved
    // it by 74× by turning the key and the fill blue while every check in this file stayed green.
    // The block at the bottom of this file measures the product instead. This block stays as it
    // is, because the albedo clause is still true and still worth its own ceiling; what changed
    // is that it is no longer the last word on the floor's colour.
    //
    // ⚠️ What this cannot see, and it is most of the original defect: the floor's SPECULAR half
    // carries no albedo at all. At the OLD rim standoff a floor of albedo `0x000000` — no diffuse
    // by construction — still rendered rgb(0,23,148) at HSV S 1.00, 51% of the shipped floor's
    // luma and 76% of its blue. Re-run that plate with `?floor=0x000000`. The term that governs it
    // is the rim's standoff, gated in `LightingRig.selftest.mjs`, not anything in this file.
    const MINIMUM_BLUE_SUPPRESSION = 4.0;

    const srgbToLinear = ( encoded ) => encoded <= 0.04045 ? encoded / 12.92 : Math.pow( ( encoded + 0.055 ) / 1.055, 2.4 );

    const suppressionOf = ( albedo ) => {

        const linear = [ 16, 8, 0 ].map( ( shift ) => srgbToLinear( ( ( albedo >> shift ) & 0xff ) / 255 ) );

        return linear[ 0 ] / linear[ 2 ];

    };

    // Read off the class rather than off a copy of the constant, so a change to the shipped floor
    // is measured here instead of being duplicated here.
    const shipped = suppressionOf( new GroundContact().albedo );

    report(
        'the shipped floor divides the rim\'s blue:red by at least 4x',
        shipped >= MINIMUM_BLUE_SUPPRESSION,
        `suppression ${ shipped.toFixed( 2 ) }x against a floor of ${ MINIMUM_BLUE_SUPPRESSION.toFixed( 1 ) }x — ` +
        'rendered HSV S 0.2216 at linear luma 0.1945, 1.58 stops below a key-lit cheek'
    );

    // Three known-bads. The first is the one the old note named; the second and third are the ones
    // it could not have named, because they OBEY it — blue is their lowest channel and they still
    // render a floor above the skin's own saturation. A gate that only rejects `#2e3036` would be
    // rejecting a hex, not a property.
    const knownBad = [
        { albedo: 0x2e3036, what: 'the rejected studio floor — blue is its HIGHEST channel', rendered: 'S 0.62 on record' },
        { albedo: 0x7a7570, what: 'a NEUTRAL floor — blue lowest, by 1.20x', rendered: 'S 0.5427, 12.45% of the frame saturated blue' },
        { albedo: 0x8a8378, what: 'a warm-NEUTRAL floor — blue lowest, by 1.35x, and it still floods', rendered: 'S 0.4888, 3.51% of the frame' }
    ];

    for ( const variant of knownBad ) {

        const measured = suppressionOf( variant.albedo );

        report(
            `KNOWN-BAD: 0x${ variant.albedo.toString( 16 ).padStart( 6, '0' ) } — ${ variant.what }`,
            measured < MINIMUM_BLUE_SUPPRESSION,
            `suppression ${ measured.toFixed( 2 ) }x, rejected. Rendered: ${ variant.rendered }`
        );

    }

    // And the direction nobody guards: a floor so red it neutralises the rim by brute force would
    // pass the check above and read as vivid orange under the warm key. The clause is "blue is the
    // lowest channel", not "red is the only channel".
    const overCorrected = 0xff2010;

    report(
        'a floor red enough to neutralise the rim by brute force is NOT what this asks for',
        suppressionOf( overCorrected ) >= MINIMUM_BLUE_SUPPRESSION && suppressionOf( new GroundContact().albedo ) < suppressionOf( overCorrected ),
        `0xff2010 scores ${ suppressionOf( overCorrected ).toFixed( 0 ) }x — the check is one-sided BY DESIGN and cannot ` +
        'reject it. The level and hue that keep the floor inside the spec\'s background band are measured on the render, not here.'
    );
}

console.log( '\nTHE REFLECTED COLOUR — albedo TIMES the light that actually lands on it, which is the\n' +
             'quantity the block above assumed and never computed.\n' );

// 🎯 THE DEFECT THIS EXISTS FOR. Turning the rig's KEY and FILL to the rim's `#0f30ff` left this
// file at 36/36 green and `LightingRig.selftest.mjs` at 46/46, on a render where 99.2% of a body
// frame came back saturated blue. Neither file could see it: this one reads a hex, and that one
// partitioned lights by name. Between them they owned both factors of a product and measured
// neither product nor second factor.
//
// The floor's diffuse response is `albedo × incident irradiance`, per channel, both linear. So:
//
//     reflected blue:red  =  (albedo_B × E_B) / (albedo_R × E_R)
//
// which is the albedo clause's `blue:red of the light ÷ suppression`, with the numerator MEASURED
// from the real rig instead of assumed constant.
//
// The incident half is deliberately a second, independent copy of the arithmetic in
// `LightingRig.selftest.mjs`. Neither file may import a helper the other owns, so instead of a
// comment asking future readers to keep two copies in step, the shipped incident value is checked
// against the one that file publishes. If the copies drift, this goes red.
//
// Anchored on rendered plates, `lighting.html?frame=body&bare` at 900×1200. The albedo rows are
// the ones the block above already measured, re-expressed in the reflected quantity; the two
// LIGHT rows were measured for this round at `?frame=body&bare&w=900&h=1200&webgl`, WebGL2
// backend, MSAA OFF (`lighting.js` passes no `antialias`), predicate HSV S > 0.5 and hue 200–300°:
//
//   | what changed                         | incident B:R | reflected B:R | rendered           |
//   |--------------------------------------|-------------:|--------------:|--------------------|
//   | **shipped rig, shipped floor**       |     **2.83** |     **0.319** | S 0.2216, 0.074%   |
//   | floor `0x4b3520` (the previous one)  |         2.83 |         0.581 | S 0.2661           |
//   | floor `0x8a8378` (warm-neutral)      |         2.83 |         2.092 | S 0.4888, 3.51%    |
//   | floor `0x7a7570` (neutral)           |         2.83 |         2.357 | S 0.5427, 12.45%   |
//   | floor `0x2e3036` (rejected studio)   |         2.83 |         3.823 | S 0.62             |
//   | key+fill `#b0c0ff`, shipped floor    |         6.98 |         0.785 | 57.37% of the frame|
//   | key+fill `#0f30ff`, shipped floor    |       209.34 |        23.570 | 90.79% of the frame|
//
// THE CEILING IS 0.71, and it is pinned twice over. It is where the albedo block's own 4.0
// suppression floor lands when re-expressed here under the shipped rig — 2.8313 ÷ 4.0 = 0.708 —
// so this clause is exactly as strict as that one on the albedo axis and no stricter. And
// independently it sits between 0.581, which renders an acceptable S 0.2661, and 0.785, which
// renders 57.37% of the frame blue. Two derivations, one number.
//
// ⚠️ WHAT THIS STILL CANNOT SEE: the specular half, as above — it carries no albedo, so it is
// absent from a product of albedo and irradiance by construction. And it is one point on the
// floor, the same one `LightingRig.selftest.mjs` uses, 2 m behind the focus.
{
    const MAXIMUM_REFLECTED_BLUE_TO_RED = 0.71;

    // Published by `LightingRig.selftest.mjs`, which asserts the same figure against its own copy.
    const LIGHTING_RIG_SHIPPED_INCIDENT_BLUE_TO_RED = 2.8313;

    // 🎯 And the same figure with the SHADOW-CASTER half summed in, also published there. See the
    // CASTER HALF block below for why one number was not enough.
    const LIGHTING_RIG_SHIPPED_CASTER_INCLUSIVE_BLUE_TO_RED = 2.1973;

    const FLOOR_POINT = new Vector3( 0, 0, -2.0 );
    const FLOOR_NORMAL = new Vector3( 0, 1, 0 );

    const bodyShot = {
        focus: new Vector3( 0, 0.91, 0 ),
        cameraPosition: new Vector3( 0.39, 0.91, 1.83 ),
        subjectHeightMetres: 1.825
    };

    const srgbToLinear = ( encoded ) => encoded <= 0.04045 ? encoded / 12.92 : Math.pow( ( encoded + 0.055 ) / 1.055, 2.4 );

    const linearAlbedo = ( hex ) => [ 16, 8, 0 ].map( ( shift ) => srgbToLinear( ( ( hex >> shift ) & 0xff ) / 255 ) );

    /** A rig aimed at the body shot, kept as a function so the caster block can read its units. */
    function rigFor( overrides, options = {} ) {

        const scene = new Scene();
        const rig = new LightingRig( { preset: 'body', overrides, ...options } );

        rig.attachTo( scene, null );
        rig.aimAt( bodyShot );

        return rig;

    }

    /**
     * Per-channel irradiance at `FLOOR_POINT` from a real rig, weighted by each light's colour.
     *
     * @param {boolean} [withCasters=false] - sum the `SpotLight` halves as well as the panels. The
     *   default is false because every ceiling in this file is anchored on the panels-only reading
     *   and the caster-inclusive one is measurably LESS strict; see the CASTER HALF block.
     */
    function incidentAtFloor( overrides, withCasters = false ) {

        const rig = rigFor( overrides );
        const channels = [ 0, 0, 0 ];

        const accumulate = ( irradiance, colour ) => {

            channels[ 0 ] += irradiance * colour.r;
            channels[ 1 ] += irradiance * colour.g;
            channels[ 2 ] += irradiance * colour.b;

        };

        for ( const unit of rig.units ) {

            const panel = unit.area.position;
            const aim = bodyShot.focus.clone().sub( panel ).normalize();
            const toPoint = FLOOR_POINT.clone().sub( panel );
            const distance = toPoint.length();
            const direction = toPoint.clone().normalize();

            const cosPanel = aim.dot( direction );
            const cosReceiver = FLOOR_NORMAL.dot( direction.clone().negate() );

            // A RectAreaLight lights only its front hemisphere; a receiver behind the panel's
            // plane gets nothing from it.
            const irradiance = ( cosPanel <= 0 || cosReceiver <= 0 )
                ? 0
                : unit.area.intensity * unit.area.width * unit.area.height * cosPanel * cosReceiver / ( distance * distance );

            // `unit.area.color` is the light the renderer will use, in linear working space.
            accumulate( irradiance, unit.area.color );

            if ( withCasters === false || unit.shadowCaster === null ) continue;

            // 🚩 THIS USED TO READ `intensity x spotAttenuation / d²` UNDER A COMMENT SAYING "with
            // `distance` 0 and `decay` 2". Both halves of that premise are fields of the light, and
            // reading neither of them is how `decay` 2 -> 1 and `distance` 0 -> 1.2 moved 41.64%
            // and 79.47% of a rendered frame with this file at 65/65. `spotIrradianceFactor` is
            // three's own `getSpotAttenuation x getDistanceAttenuation` with all four of `angle`,
            // `penumbra`, `decay` and `distance` taken off the object.
            const spot = unit.shadowCaster;
            const spotDirection = FLOOR_POINT.clone().sub( spot.position ).normalize();
            const cosSpotReceiver = FLOOR_NORMAL.dot( spotDirection.clone().negate() );

            accumulate( cosSpotReceiver <= 0
                ? 0
                : spot.intensity * spotIrradianceFactor( spot, FLOOR_POINT ) * cosSpotReceiver,
            spot.color );

        }

        return channels;

    }

    const reflectedBlueToRed = ( { albedo = new GroundContact().albedo, rig = {}, casters = false } = {} ) => {

        const surface = linearAlbedo( albedo );
        const incident = incidentAtFloor( rig, casters );

        return ( surface[ 2 ] * incident[ 2 ] ) / ( surface[ 0 ] * incident[ 0 ] );

    };

    const shippedIncident = incidentAtFloor( {} );

    report(
        'this file and LightingRig.selftest.mjs agree on what lands on the floor',
        Math.abs( shippedIncident[ 2 ] / shippedIncident[ 0 ] - LIGHTING_RIG_SHIPPED_INCIDENT_BLUE_TO_RED ) <= 0.0005,
        `incident blue:red ${ ( shippedIncident[ 2 ] / shippedIncident[ 0 ] ).toFixed( 4 ) } here against ` +
        `${ LIGHTING_RIG_SHIPPED_INCIDENT_BLUE_TO_RED.toFixed( 4 ) } published there. Two copies of one calculation, ` +
        'because neither file may import the other\'s helper — so they are checked against each other instead.'
    );

    const shipped = reflectedBlueToRed();

    report(
        'the floor reflects the rig without turning blue',
        shipped < MAXIMUM_REFLECTED_BLUE_TO_RED,
        `reflected blue:red ${ shipped.toFixed( 3 ) } against a ceiling of ${ MAXIMUM_REFLECTED_BLUE_TO_RED } — ` +
        'rendered HSV S 0.2216, 0.074% of the frame in a saturated blue'
    );

    // Both factors, each broken on its own, and then the one that breaks NEITHER factor's own
    // clause. The three albedo rows must still be rejected THROUGH the product, or this block has
    // lost coverage the block above had; the light rows are what that block could never see.
    const knownBad = [
        {
            what: 'ALBEDO — 0x2e3036, the rejected studio floor',
            arguments: { albedo: 0x2e3036 },
            rendered: 'S 0.62 on record'
        },
        {
            what: 'ALBEDO — 0x7a7570, a neutral floor that obeys "blue is lowest"',
            arguments: { albedo: 0x7a7570 },
            rendered: 'S 0.5427, 12.45% of the frame'
        },
        {
            what: 'ALBEDO — 0x8a8378, a warm-neutral floor that also obeys it',
            arguments: { albedo: 0x8a8378 },
            rendered: 'S 0.4888, 3.51% of the frame'
        },
        {
            what: 'LIGHT — the shipped floor under a key and fill turned to #0f30ff',
            arguments: { rig: { key: { colour: 0x0f30ff }, fill: { colour: 0x0f30ff } } },
            rendered: '90.79% of the frame here, 99.20% on alive.html — and 36/36 green before this block existed'
        },
        {
            what: 'LIGHT, SUBTLE — the shipped floor under a key and fill at #b0c0ff, a tint that reads as white',
            arguments: { rig: { key: { colour: 0xb0c0ff }, fill: { colour: 0xb0c0ff } } },
            rendered: '57.37% of the frame'
        },
        {
            // 🚩 BREAKING IT A DIFFERENT WAY. This is the row that neither factor's own clause can
            // reject. `#403830` is a warm grey — blue is its LOWEST channel, so the light passes
            // any "cool hex" test — and the floor is the shipped one, so the albedo clause is
            // untouched at 8.88x. What moved is the LEVEL of the warm half: dimming the key and
            // the fill takes the red out of the incident light without adding any blue, and the
            // product goes with it. Only a gate that multiplies the two factors sees this.
            what: 'NEITHER FACTOR — the shipped floor, key and fill merely DIMMED to the warm grey #403830',
            arguments: { rig: { key: { colour: 0x403830 }, fill: { colour: 0x403830 } } },
            rendered: '18.19% of the frame, with the albedo clause still reading its full 8.88x'
        },
        {
            // And the geometric one, so this block is not blind to the mechanism that produced the
            // original defect either.
            what: 'GEOMETRY — the shipped floor with the rim standoff back at 1.4 heights',
            arguments: { rig: { rim: { distanceInHeights: 1.4 }, kicker: { distanceInHeights: 1.4 } } },
            rendered: '24.06% of the frame at the old floor albedo'
        }
    ];

    for ( const variant of knownBad ) {

        const measured = reflectedBlueToRed( variant.arguments );

        report(
            `KNOWN-BAD: ${ variant.what }`,
            measured >= MAXIMUM_REFLECTED_BLUE_TO_RED,
            `reflected blue:red ${ measured.toFixed( 3 ) }, rejected against ${ MAXIMUM_REFLECTED_BLUE_TO_RED }. ` +
            `Rendered: ${ variant.rendered }`
        );

    }

    // MUST STILL PASS, so the ceiling is pinned from below as well as above. `0x4b3520` is the
    // floor this project shipped before the current one and it renders at S 0.2661 — a gate that
    // rejected it would be a gate that had drifted.
    const mustPass = [
        { what: '0x4b3520, the previous floor, under the shipped rig', arguments: { albedo: 0x4b3520 }, rendered: 'S 0.2661' },
        { what: 'the shipped floor under a daylight-balanced #e8ecff key and fill', arguments: { rig: { key: { colour: 0xe8ecff }, fill: { colour: 0xe8ecff } } }, rendered: '0.058% of the frame, LESS than shipped' }
    ];

    for ( const variant of mustPass ) {

        const measured = reflectedBlueToRed( variant.arguments );

        report(
            `MUST PASS: ${ variant.what }`,
            measured < MAXIMUM_REFLECTED_BLUE_TO_RED,
            `reflected blue:red ${ measured.toFixed( 3 ) }, under ${ MAXIMUM_REFLECTED_BLUE_TO_RED }. Rendered: ${ variant.rendered }`
        );

    }

    console.log( '\nTHE CASTER HALF — the light the block above sums is the PANELS, and the rig has a\n' +
                 'shadow-casting SpotLight too. What that omission was excused with, gated.\n' );

    // 🎯 THE DEFECT THIS EXISTS FOR, and it is the third time this pair of files has been caught
    // by the same shape. The block above fixed "one factor of a product was assumed constant" by
    // measuring the incident light — and measured only the `RectAreaLight` panels, because
    // `LightingRig.selftest.mjs` said in a comment that adding the spot halves LOWERS the number
    // and is therefore the conservative reading. True of a rig whose casters carry their panel's
    // colour. Nothing asserted that. A verifier built the key's caster at `#0f30ff` and this file
    // returned **47/47 green** while body-framing saturated blue went **0.2881% → 12.0152%**.
    //
    // ⚠️ AND THE HONEST PART FIRST, BECAUSE IT DECIDES THE SHAPE OF THE FIX. Measured below: the
    // caster-inclusive reflected blue:red under a `#0f30ff` caster is **0.366**, against a ceiling
    // of 0.71. **The product clause cannot reject this defect at any ceiling this file could
    // defend** — the caster is 45% of the key alone, and at a floor point 2 m behind the subject
    // its cone is grazing, so the shipped `0.319` only moves to `0.366`. Bringing the ceiling to
    // 0.36 would reject `0x4b3520`, the floor this project shipped last, which renders a clean
    // S 0.2661. That is LEARNINGS §1.11 exactly: the right answer to "my gate cannot resolve this"
    // is a structurally different assertion, not a tightened threshold.
    //
    // So the two clauses here are not two opinions on the product:
    //
    //   PREMISE       every caster carries EXACTLY its panel's colour — an equality, so it has no
    //                 threshold to walk around and no hue it is blind to. This is the sentence the
    //                 panels-only incident quietly rests on.
    //   CONSERVATISM  the caster-inclusive reflected colour is measured every run and required to
    //                 be no worse than the panels-only one. That is the excuse itself, as a number.
    {
        const shippedPanelsOnly = incidentAtFloor( {}, false );
        const shippedWithCasters = incidentAtFloor( {}, true );

        const blueToRed = ( channels ) => channels[ 2 ] / channels[ 0 ];

        report(
            'this file and LightingRig.selftest.mjs agree on the CASTER-INCLUSIVE incident light too',
            Math.abs( blueToRed( shippedWithCasters ) - LIGHTING_RIG_SHIPPED_CASTER_INCLUSIVE_BLUE_TO_RED ) <= 0.0005,
            `incident blue:red with the spot half summed in: ${ blueToRed( shippedWithCasters ).toFixed( 4 ) } here ` +
            `against ${ LIGHTING_RIG_SHIPPED_CASTER_INCLUSIVE_BLUE_TO_RED.toFixed( 4 ) } published there. The ` +
            `panels-only pair (${ blueToRed( shippedPanelsOnly ).toFixed( 4 ) }) was already cross-checked; this is ` +
            'the half that was not, and it is where the defect lived.'
        );

        const divergences = ( rig ) => rig.units
            .filter( ( unit ) => unit.shadowCaster !== null )
            .filter( ( unit ) => unit.shadowCaster.color.getHex() !== unit.area.color.getHex() )
            .map( ( unit ) => `${ unit.placement.name }: panel #${ unit.area.color.getHexString() } ` +
                `vs caster #${ unit.shadowCaster.color.getHexString() }` );

        {
            const found = divergences( rigFor( {} ) );

            report(
                'PREMISE: every shadow caster carries exactly its panel\'s colour',
                found.length === 0,
                found.length === 0
                    ? 'the caster is the same hex as the panel it was split from, so summing the panels alone is a ' +
                        'statement about the rig\'s colour and not only about part of it'
                    : `DIVERGED: ${ found.join( '; ' ) } — the incident half of this file's product is measuring a ` +
                        'rig whose colour is not the rig\'s colour'
            );
        }

        report(
            'CONSERVATISM: the caster half LOWERS the reflected colour, which is what licensed leaving it out',
            reflectedBlueToRed( { casters: true } ) <= reflectedBlueToRed( { casters: false } ),
            `reflected blue:red ${ reflectedBlueToRed( { casters: false } ).toFixed( 4 ) } panels-only -> ` +
            `${ reflectedBlueToRed( { casters: true } ).toFixed( 4 ) } with the caster. Rendered on the shipped ` +
            'plate: HSV S 0.2216, 0.074% of the frame in a saturated blue.'
        );

        // MAGNITUDE and REACH — what the two clauses above never asked, and the third time this
        // pair of files has been caught by the same shape.
        //
        // 🎯 PREMISE is an equality on COLOUR and CONSERVATISM is a test of a SIGN. "The caster
        // half only ever lowers the number" is a claim about MAGNITUDE, and neither of them bounds
        // one. Measured: scale every NON-KEY caster's solved intensity by five with the colours
        // untouched and this file was 55/55 green; scale the key's and only the cross-file constant
        // above noticed, which is a drift check rather than an oracle and covers exactly the one
        // configuration it was blessed on.
        //
        // The oracle is the rig's own contract, `LightingRig.js` above line 1195: at the focus the
        // panel half and the caster half deliver exactly the authored irradiance, split by
        // `shadowFraction`. That is what makes the caster half a REDISTRIBUTION of the panel half,
        // which is the whole reason a panels-only reading of the incident light is bounded at all.
        // Derived here from the placement table and three's attenuation model, compared against the
        // built objects — a second derivation rather than a copy. `LightingRig.selftest.mjs` holds
        // the same two clauses against its own copy; neither file may import the other's helper.
        //
        // REACH is separate because MAGNITUDE is structurally blind to the cone: `penumbra` is 1 on
        // every caster this rig builds, so on-axis attenuation is `smoothstep( cos angle, 1, 1 )`,
        // which is 1 at EVERY angle. A cone scaled by 1.4 leaves the focus reading bit-identical
        // and moves what lands on this floor point. Both clauses are equalities at float noise; a
        // tolerance wide enough to be an opinion would be a threshold wearing an equality's name.
        const casterFocus = ( unit ) => {

            const toPanel = unit.area.position.clone().sub( bodyShot.focus ).length();
            const fromPanel = unit.area.intensity * projectedSolidAngle( unit.area.width, unit.area.height, toPanel );

            // 🎯 `/ toFocus.lengthSq()` STOOD HERE, AND IT IS WHERE THE THIRD MECHANISM LIVED. It
            // is the right arithmetic at `decay` 2 and `distance` 0 and it assumes both, so a
            // caster at `decay` 1 delivered something different to every pixel in the frame while
            // this equality read exact to 1e-9. Deriving the same number through
            // `spotIrradianceFactor` turns the assumption into an input.
            const fromCaster = unit.shadowCaster.intensity * spotIrradianceFactor( unit.shadowCaster, bodyShot.focus );

            return { fromPanel, fromCaster, total: fromPanel + fromCaster };

        };

        /** Both clauses over one rig, as booleans, so the known-bad table can print them. */
        const magnitudeAndReach = ( rig ) => {

            const shadowed = rig.units.filter( ( unit ) => unit.shadowCaster !== null );

            const magnitude = shadowed.map( ( unit ) => {

                const { fromCaster, total } = casterFocus( unit );
                const authored = unit.placement.irradiance * rig.exposure;

                return Math.abs( total / authored - 1 ) <= 1e-9
                    && Math.abs( fromCaster / total - unit.placement.shadowFraction ) <= 1e-9;

            } );

            const reach = shadowed.map( ( unit ) => {

                const standoff = unit.placement.distanceInHeights * rig.subjectHeightMetres;

                return Math.abs( standoff * Math.tan( unit.shadowCaster.angle )
                    / ( rig.shadowCoverageInHeights * rig.subjectHeightMetres ) - 1 ) <= 1e-9;

            } );

            return {
                casters: shadowed.length,
                magnitudeRed: magnitude.includes( false ),
                reachRed: reach.includes( false ),
                detail: shadowed.map( ( unit ) => {
                    const { fromPanel, fromCaster } = casterFocus( unit );
                    return `${ unit.placement.name } ${ fromPanel.toFixed( 3 ) }+${ fromCaster.toFixed( 3 ) } at ` +
                        `f=${ unit.placement.shadowFraction }`;
                } ).join( ', ' )
            };

        };

        // The shipped rig gives a shadow to the KEY alone, so a clause checked only there says
        // nothing about the mechanism that walked past both files. The second row is a rig where
        // the back lights cast too, at fractions that differ per light.
        for ( const variant of [
            { what: 'the shipped rig', overrides: {}, casters: 1 },
            {
                what: 'a rig where every light casts, at a different fraction each',
                overrides: {
                    key: { shadowFraction: 0.45 }, fill: { shadowFraction: 0.30 },
                    rim: { shadowFraction: 0.60 }, kicker: { shadowFraction: 0.90 }
                },
                casters: 4
            }
        ] ) {

            const measured = magnitudeAndReach( rigFor( variant.overrides ) );

            report(
                `MAGNITUDE: ${ variant.what } — every caster is a redistribution of its panel, at the focus`,
                measured.casters === variant.casters && measured.magnitudeRed === false,
                `${ measured.casters } caster(s) of an expected ${ variant.casters }: ${ measured.detail }. The ` +
                'incident light this file multiplies by an albedo is only bounded by the panels if the caster half ' +
                'is a redistribution of them, and this is that sentence as an equality.'
            );

            report(
                `REACH: ${ variant.what } — every cone is the one shadowCoverageInHeights asked for`,
                measured.casters === variant.casters && measured.reachRed === false,
                `${ measured.casters } cone(s) at coverage ${ new LightingRig().shadowCoverageInHeights }. The focus ` +
                'equality cannot see a cone at all — penumbra is 1, so on-axis attenuation is 1 at every angle — ' +
                'while the cone is the only thing deciding how far off-axis the caster reaches this floor point.'
            );

        }

        /**
         * 🚩 THE MAGNITUDE INJECTOR, patching `solve` rather than `buildUnit`. The colour injector
         * further down patches `buildUnit` and is faithful, because colour is written once and
         * never again. Everything `solve` writes — intensity, position, cone — is overwritten on
         * the next `aimAt()`, so a build-time patch of any of it is a no-op with a reach counter.
         */
        const withSolvedCasters = ( { gain = 1, cone = 1, exclude = null }, body ) => {

            const solve = LightingRig.prototype.solve;
            const altered = new Set();

            LightingRig.prototype.solve = function () {

                const result = solve.call( this );

                for ( const unit of this.units ) {

                    if ( unit.shadowCaster === null || unit.placement.name === exclude ) continue;

                    unit.shadowCaster.intensity *= gain;
                    unit.shadowCaster.angle *= cone;
                    altered.add( unit.shadowCaster );

                }

                return result;

            };

            try {

                return { ...body(), altered: altered.size };

            } finally {

                LightingRig.prototype.solve = solve;

            }

        };

        // 🚩 THREE MECHANISMS IN THE MAGNITUDE CLASS, and the printed columns are the finding: the
        // premise and product columns are green on every one of them. The class is "the caster half
        // delivers the wrong AMOUNT while carrying exactly the right colour".
        console.log( '\n      injection                          premise   product   magnitude   reach   caster-inclusive' );

        for ( const variant of [
            {
                what: 'GAIN — every solved caster at 5x, colours untouched',
                injection: { gain: 5 },
                overrides: {},
                clause: 'magnitudeRed'
            },
            {
                what: 'GAIN, NON-KEY ONLY at 5x — the configuration that scored 55/55 here and 82/82 there',
                injection: { gain: 5, exclude: 'key' },
                overrides: { rim: { shadowFraction: 0.6 }, kicker: { shadowFraction: 0.6 } },
                clause: 'magnitudeRed'
            },
            {
                what: 'CONE — every cone at 1.4x, which the focus equality cannot see at all',
                injection: { cone: 1.4 },
                overrides: {},
                clause: 'reachRed'
            }
        ] ) {

            const verdict = withSolvedCasters( variant.injection, () => {

                const measured = magnitudeAndReach( rigFor( variant.overrides ) );

                return {
                    ...measured,
                    premiseRed: divergences( rigFor( variant.overrides ) ).length > 0,
                    product: reflectedBlueToRed( { rig: variant.overrides, casters: true } )
                };

            } );

            const productRejects = verdict.product >= MAXIMUM_REFLECTED_BLUE_TO_RED;

            console.log( `      ${ variant.what.slice( 0, 34 ).padEnd( 35 ) }${ ( verdict.premiseRed ? 'RED' : 'green' ).padEnd( 10 ) }` +
                `${ ( productRejects ? 'RED' : 'green' ).padEnd( 10 ) }${ ( verdict.magnitudeRed ? 'RED' : 'green' ).padEnd( 12 ) }` +
                `${ ( verdict.reachRed ? 'RED' : 'green' ).padEnd( 8 ) }${ verdict.product.toFixed( 4 ) }` );

            report(
                `KNOWN-BAD: ${ variant.what }`,
                verdict[ variant.clause ] === true && verdict.altered > 0,
                `${ verdict.altered } distinct caster object(s) altered after solve; rejected by ` +
                `${ [ verdict.magnitudeRed ? 'MAGNITUDE' : null, verdict.reachRed ? 'REACH' : null ]
                    .filter( ( clause ) => clause !== null ).join( ' and ' ) || 'NOTHING' }, while PREMISE reads ` +
                `${ verdict.premiseRed ? 'RED' : 'green' } and the product ${ verdict.product.toFixed( 4 ) } sits ` +
                `under its ${ MAXIMUM_REFLECTED_BLUE_TO_RED } ceiling.`
            );

        }

        // 🚩 NON-NESTED, ASSERTED IN BOTH DIRECTIONS, as everywhere else in these two files.
        {
            const gained = withSolvedCasters( { gain: 5 }, () => magnitudeAndReach( rigFor( {} ) ) );
            const coned = withSolvedCasters( { cone: 1.4 }, () => ( {
                ...magnitudeAndReach( rigFor( {} ) ),
                product: reflectedBlueToRed( { casters: true } )
            } ) );

            report(
                'MAGNITUDE catches something REACH cannot: a caster 5x too bright inside an untouched cone',
                gained.magnitudeRed === true && gained.reachRed === false,
                'a 5x gain leaves the cone exactly as authored, so REACH is green — and so is PREMISE, because ' +
                'the colour never moved — while the focus equality rejects it'
            );

            report(
                'REACH catches something MAGNITUDE cannot, and not by a tolerance: the focus reading is BIT-IDENTICAL',
                coned.reachRed === true && coned.magnitudeRed === false
                    && Math.abs( coned.product - reflectedBlueToRed( { casters: true } ) ) > 0.001,
                `the cone at 1.4x takes the caster-inclusive product ${ reflectedBlueToRed( { casters: true } ).toFixed( 4 ) } -> ` +
                `${ coned.product.toFixed( 4 ) } while the focus equality does not move by a bit. It moves DOWN, ` +
                'which is the opposite of the instinct: the only caster the shipped rig builds is the key\'s, it is ' +
                'WARM, and a wider cone spills more of it onto the floor. §1.25h — measure the direction, do not ' +
                'reason it. No tolerance on MAGNITUDE could catch this; the quantity it measures is unchanged.'
            );
        }

        // The injector has to be shown to restore what it patched, or the colour rows below — and
        // the STATED LIMIT that closes this block — are being measured against a rig this one
        // broke. Asserted on the focus equality as well as on the product, because the product
        // moves by 0.002 under the cone injection and a leak of that would look like rounding.
        {
            const restored = magnitudeAndReach( rigFor( {} ) );
            const incidentNow = blueToRed( incidentAtFloor( {}, true ) );

            report(
                'the magnitude injector leaves LightingRig.prototype.solve exactly as it found it',
                restored.magnitudeRed === false && restored.reachRed === false
                    && Math.abs( incidentNow - blueToRed( shippedWithCasters ) ) <= 1e-12,
                `a rig built after every injection above splits ${ restored.detail } and its caster-inclusive ` +
                `incident blue:red reads ${ incidentNow.toFixed( 6 ) } against the ` +
                `${ blueToRed( shippedWithCasters ).toFixed( 6 ) } measured before them`
            );
        }

        // 🚩 FOUR MECHANISMS IN ONE CLASS, and the printed columns are the finding. The class is
        // "a light-colour defect that reaches the floor through the caster half". Every row leaves
        // the panels untouched, so the panels-only product reads the shipped 0.319 on all four.
        //
        // Read the `product` column: NOT ONE of them is rejected by it, including the one that
        // rendered 12% of the frame blue. The product clause is doing real work on the panel axis
        // and is structurally unable to do any on this one, and saying so in a printed table is
        // worth more than a ceiling nudged until one row happens to fall over.
        console.log( '      caster colour   panels-only product   caster-inclusive product   rejected by product?   premise' );

        const casterKnownBad = [
            { hex: 0x0f30ff, what: 'the casters at the rim\'s own #0f30ff — the defect this round found' },
            { hex: 0x403830, what: 'LEVEL — the casters dimmed to the warm grey #403830, blue still its lowest channel' },
            { hex: 0xff30ff, what: 'HUE — the casters turned magenta, outside the 200-300 degree predicate entirely' },
            { hex: 0xb0c0ff, what: 'SUBTLE — the casters at #b0c0ff, the tint that reads as white in a swatch' }
        ];

        for ( const variant of casterKnownBad ) {

            const original = LightingRig.prototype.buildUnit;

            LightingRig.prototype.buildUnit = function ( placement ) {

                const unit = original.call( this, placement );

                if ( unit.shadowCaster !== null ) unit.shadowCaster.color = new Color( variant.hex );

                return unit;

            };

            let panelsOnly;
            let withCasters;
            let found;

            try {

                panelsOnly = reflectedBlueToRed( { casters: false } );
                withCasters = reflectedBlueToRed( { casters: true } );
                found = divergences( rigFor( {} ) );

            } finally {

                LightingRig.prototype.buildUnit = original;

            }

            const productRejects = withCasters >= MAXIMUM_REFLECTED_BLUE_TO_RED;

            console.log( `      #${ variant.hex.toString( 16 ).padStart( 6, '0' ) }         ` +
                `${ panelsOnly.toFixed( 4 ).padStart( 19 ) }   ${ withCasters.toFixed( 4 ).padStart( 24 ) }   ` +
                `${ ( productRejects ? 'yes' : 'NO' ).padStart( 20 ) }   ${ found.length > 0 ? 'RED' : 'green' }` );

            report(
                `KNOWN-BAD: ${ variant.what }`,
                found.length > 0 || productRejects,
                `rejected by ${ [ found.length > 0 ? 'PREMISE' : null, productRejects ? 'the product' : null ]
                    .filter( ( clause ) => clause !== null ).join( ' and ' ) || 'NOTHING' }. The panels-only product ` +
                `reads ${ panelsOnly.toFixed( 4 ) } — the shipped value to four decimals, because no panel moved — ` +
                `and the caster-inclusive one ${ withCasters.toFixed( 4 ) } against a ${ MAXIMUM_REFLECTED_BLUE_TO_RED } ceiling.`
            );

        }

        // The limit, asserted rather than described, so nobody later reads the block above as
        // covering the caster axis. If a future rig ever DID push the caster-inclusive product
        // over the ceiling, this goes red and the sentence in the header stops being true.
        {
            const original = LightingRig.prototype.buildUnit;

            LightingRig.prototype.buildUnit = function ( placement ) {

                const unit = original.call( this, placement );

                if ( unit.shadowCaster !== null ) unit.shadowCaster.color = new Color( 0x0f30ff );

                return unit;

            };

            let underCeiling;

            try {

                underCeiling = reflectedBlueToRed( { casters: true } );

            } finally {

                LightingRig.prototype.buildUnit = original;

            }

            report(
                'STATED LIMIT: the product clause CANNOT reject a blue caster, and the premise clause is why this block exists',
                underCeiling < MAXIMUM_REFLECTED_BLUE_TO_RED,
                `a #0f30ff caster reflects ${ underCeiling.toFixed( 4 ) }, comfortably under the ` +
                `${ MAXIMUM_REFLECTED_BLUE_TO_RED } ceiling — and the ceiling cannot come down to catch it, because ` +
                '0x4b3520, the floor this project shipped before the current one, reflects 0.581 and renders a ' +
                'clean S 0.2661. LEARNINGS §1.11: a structurally different assertion, not a tighter threshold.'
            );
        }
    }
}

console.log( '\nTHE WHOLE-STATE FINGERPRINT — because the three blocks above are a list of the\n' +
    'mechanisms somebody had already been bitten by, and the fourth one walks past a list\n' );

// 🎯 THE SAME SHAPE A FOURTH TIME, AND THIS TIME ANSWERED AS A SET RATHER THAN AS A CHECK.
//
// Read the block headers at the top of this file in order. THE ALBEDO gated the floor's own hex,
// and a verifier turned the rig's key and fill blue and scored 36/36. WHAT LANDS ON IT gated the
// panels, and a verifier turned the caster blue and scored 47/47. THE CASTER HALF gated the
// caster's colour, and a gain on it scored 55/55. THE CASTER'S SIZE gated its magnitude, and
// `shadowCaster.decay` 2 -> 1 and `distance` 0 -> 1.2 scored 65/65 while moving 41.64% and 79.47%
// of a rendered frame.
//
// Every one of those clauses is correct and every one of them was written from a defect that had
// already happened. What the floor puts in the frame is `albedo x occlusion x incident`, and the
// third factor is now closed by `lightRenderState` over in `LightingRig.js`. The first two live in
// this file's own objects — a `Mesh`, a `MeshStandardNodeMaterial` and three uniforms — and NOTHING
// in this file has ever asserted anything about any of them.
//
// 🚩 THE THING WORTH COPYING IS HOW THE MATERIAL HALF IS CLOSED. `MeshStandardNodeMaterial` carries
// 110 fields; a hand-written list of the interesting ones is the same enumeration that has now
// failed four times. `GroundContact.renderState` diffs the shipped material against a freshly
// constructed one instead, so the closure comes from three rather than from us: exactly the fields
// this file has moved show up, and a field somebody sets later — or a field three adds next
// release — shows up on the day it moves and not on the day somebody remembers it.

{
    const shot = { focus: new Vector3( 0, 0.91, 0 ), subjectHeightMetres: 1.825 };

    // Transcribed from `GROUND_EXTENT_IN_HEIGHTS` rather than exported and imported. An imported
    // constant agrees with itself; a transcription goes red when the extent moves without anybody
    // saying so, which is the entire job of a fingerprint.
    const EXTENT_IN_HEIGHTS = 12;

    /**
     * A synthetic left foot standing on the floor — `foot_l` -> `ball_l`, a 46 mm shell about each,
     * which is the radius `fitTo` measures off `figure_g050`'s own foot.
     *
     * 🚩 IT IS HERE BECAUSE THE FIRST VERSION OF THIS BLOCK FITTED NOTHING, AND THE EVIDENCE IT
     * PRODUCED WAS WORTHLESS. With no occluders `visibilityAt` returns exactly 1 everywhere, so
     * "every mutation leaves `visibilityAt` bit-identical" was true of a function that had no
     * output to move. LEARNINGS §1.3 — ask what a degenerate input would score. With a foot on the
     * floor the mirror reads 0.6-something under the sole and the claim starts meaning something.
     */
    function syntheticFoot() {

        const RADIUS = 0.046;

        const foot = new Bone();
        foot.name = 'foot_l';
        foot.position.set( 0, 0.055, -0.05 );

        const ball = new Bone();
        ball.name = 'ball_l';
        ball.position.set( 0, -0.01, 0.09 );

        foot.add( ball );
        foot.updateMatrixWorld( true );

        const positions = [];
        const indices = [];
        const weights = [];

        for ( let step = 0; step < 48; step += 1 ) {

            const angle = ( step / 48 ) * Math.PI * 2;

            for ( const [ boneIndex, alongZ ] of [ [ 0, -0.03 ], [ 0, 0.0 ], [ 0, 0.03 ], [ 1, 0.10 ], [ 1, 0.13 ] ] ) {

                positions.push( Math.cos( angle ) * RADIUS, 0.055 + Math.sin( angle ) * RADIUS, -0.05 + alongZ );
                indices.push( boneIndex, 0, 0, 0 );
                weights.push( 1, 0, 0, 0 );

            }

        }

        const geometry = new BufferGeometry();
        geometry.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
        geometry.setAttribute( 'skinIndex', new Uint16BufferAttribute( indices, 4 ) );
        geometry.setAttribute( 'skinWeight', new Float32BufferAttribute( weights, 4 ) );

        const mesh = new SkinnedMesh( geometry, new MeshStandardNodeMaterial() );
        mesh.bind( new Skeleton( [ foot, ball ] ), new Matrix4() );
        mesh.add( foot );
        mesh.updateMatrixWorld( true );

        return mesh;

    }

    const groundIn = ( options = {} ) => {

        const ground = new GroundContact( options );

        ground.attachTo( new Scene() );
        ground.sizeTo( shot );
        ground.fitTo( syntheticFoot() );

        return ground;

    };

    // The material this file authors, stated as a delta against stock and as nothing else. Three
    // entries, and a fourth is a FAILURE rather than a curiosity.
    const DECLARED_MATERIAL_DELTAS = {
        color: { is: '#968c34', stock: '#ffffff' },
        roughness: { is: '0.9', stock: '1' },
        colorNode: { is: 'node', stock: 'null' }
    };

    /**
     * Every row `GROUND_MESH_NODE` reads or derives, declared here rather than in the module — two
     * independent derivations of the same claim, which is the property that makes the comparison
     * worth anything.
     *
     * ⚠️ **THIS TABLE IS NO LONGER THE CLOSURE, AND THAT IS THE POINT OF THE ROUND THAT CHANGED
     * IT.** It used to be nine keys checked against a nine-key object literal, so the two agreed by
     * construction and neither could see a tenth field. The module now sweeps all **34** own keys of
     * the Mesh; this table declares the ones with values, and `unclassified` / `missing` below carry
     * the half a declaration cannot: a field nobody has met.
     */
    const declaredMesh = {
        position: [ shot.focus.x, 0, shot.focus.z ],
        rotation: [ -Math.PI / 2, 0, 0 ],
        // The same rotation as a quaternion, so a direct write to one and not the other is a fault
        // rather than a silence. sin(−π/4), 0, 0, cos(−π/4).
        quaternion: [ -Math.SQRT1_2, 0, 0, Math.SQRT1_2 ],
        scale: [ shot.subjectHeightMetres * EXTENT_IN_HEIGHTS, shot.subjectHeightMetres * EXTENT_IN_HEIGHTS, 1 ],
        pivot: null,
        // Without these two the rows above are an INTENTION rather than a place: three composes the
        // matrix from them only when it is told to.
        matrixAutoUpdate: true,
        matrixWorldAutoUpdate: true,
        visible: true,
        layers: 1,
        renderOrder: 0,
        frustumCulled: true,
        receiveShadow: true,
        castShadow: false,
        customDepthMaterial: null,
        customDistanceMaterial: null,
        morphTargetInfluences: null,
        morphTargetDictionary: null,
        count: 1,
        up: [ 0, 1, 0 ],
        parentIsScene: true,
        childCount: 0,
        geometryDescription: 'PlaneGeometry 1x1'
    };

    const sameValue = ( actual, expected ) => Array.isArray( expected )
        ? Array.isArray( actual ) && actual.length === expected.length
            && actual.every( ( entry, index ) => Math.abs( entry - expected[ index ] ) <= 1e-9 )
        : actual === expected;

    /** Every way one ground's state disagrees with what this file declares, named. */
    function groundFaults( ground, { declaredDeltas = DECLARED_MATERIAL_DELTAS, occlusion = true } = {} ) {

        const state = ground.renderState();
        const faults = [];

        for ( const [ key, expected ] of Object.entries( declaredMesh ) ) {

            if ( sameValue( state.mesh.read[ key ], expected ) === false ) {

                faults.push( `mesh.${ key } reads ${ JSON.stringify( state.mesh.read[ key ] ) } against a declared ${ JSON.stringify( expected ) }` );

            }

        }

        // 🚩 THE HALF A DECLARATION CANNOT COVER, and the reason the mesh sweep exists. A field on
        // the Mesh that the spec neither reads nor calls inert is a mechanism nobody has met — a
        // three release, a class change, or somebody setting a property this file never considered.
        for ( const key of state.mesh.unclassified ) {

            faults.push( `mesh.${ key } is on the object and GROUND_MESH_NODE neither reads it nor ` +
                'declares it inert, so nothing here can say whether it moves the floor' );

        }

        // The same instrument the other way: a field the spec says three reads that the Mesh does
        // not have is a rename in the dependency presenting as `undefined === undefined`.
        for ( const key of state.mesh.missing ) {

            faults.push( `mesh.${ key } is declared read and is not on the object — a rename in ` +
                'three, or a mesh of a class this spec was not written for' );

        }

        for ( const [ key, delta ] of Object.entries( state.materialDeltas ) ) {

            if ( key in declaredDeltas === false ) {

                faults.push( `material.${ key } has moved off its stock ${ delta.stock } to ${ delta.is } and nothing declares it` );
                continue;

            }

            if ( delta.is !== declaredDeltas[ key ].is ) {

                faults.push( `material.${ key } reads ${ delta.is } against a declared ${ declaredDeltas[ key ].is }` );

            }

        }

        for ( const key of Object.keys( declaredDeltas ) ) {

            if ( key in state.materialDeltas === false ) {

                faults.push( `material.${ key } is declared as a delta and now reads its stock value` );

            }

        }

        const expectedUniforms = {
            albedo: 0x968c34,
            occlusionEnabled: occlusion,
            strength: 1,
            strengthUniform: 1,
            activeCount: ground.occluders.length,
            occluderCount: ground.occluders.length,
            parkedSpheres: MAX_OCCLUDERS - ground.occluders.length
        };

        for ( const [ key, expected ] of Object.entries( expectedUniforms ) ) {

            if ( state.uniforms[ key ] !== expected ) {

                faults.push( `uniforms.${ key } reads ${ state.uniforms[ key ] } against a declared ${ expected }` );

            }

        }

        return { faults, state };

    }

    {
        // 🚩 THE CLOSURE'S OTHER HALF, ASSERTED ONCE BECAUSE IT IS A PROPERTY OF THE SPEC AND NOT OF
        // A GROUND. An `inert:` row is the only place in the whole instrument where a human says
        // "this cannot change the picture" and nothing measures it, so the one thing that can be
        // held is that a reader was made to write an argument down. A one-word reason is an
        // enumeration wearing a closure's clothes.
        const { mesh } = groundIn().renderState();

        const thin = Object.entries( mesh.inert )
            .filter( ( [ , why ] ) => typeof why !== 'string' || why.length < 24 )
            .map( ( [ key ] ) => key );

        report(
            'CLOSURE: every field GROUND_MESH_NODE calls inert carries a reason a reader can argue with',
            thin.length === 0,
            thin.length === 0
                ? `${ Object.keys( mesh.inert ).length } inert fields, every reason at least 24 characters; ` +
                  `${ Object.keys( mesh.read ).length } read, ${ mesh.unclassified.length } unclassified`
                : `no reason worth reading on: ${ thin.join( ', ' ) }`
        );
    }

    {
        // 🚩 THE ONLY ASSERTION IN THIS FILE THAT CAN GO RED FOR A DEFECT NOBODY HAS MET, PROVED.
        // §1.25a: a closure that has never been shown to catch an unforeseen field is a list with a
        // longer comment. Planting a property three does not ship is the cheapest stand-in for the
        // next release, for a mesh of another class, and for somebody setting something this file
        // never considered — all three arrive as "an own key the spec does not account for".
        const ground = groundIn();

        ground.mesh.tessellationBudget = 4;

        const planted = groundFaults( ground );
        const named = planted.state.mesh.unclassified.includes( 'tessellationBudget' );

        delete ground.mesh.tessellationBudget;

        const restored = groundFaults( ground );

        report(
            'RED: a field three has not shipped, planted on the ground mesh, is named by the closure',
            named === true && planted.faults.length === 1 && restored.faults.length === 0,
            named === true
                ? `unclassified named it and the ground reported ${ planted.faults.length } fault(s); ` +
                  `${ restored.faults.length } after removing it. Nothing in this file lists ` +
                  '`tessellationBudget` — the sweep asks the object what it HAS, which is why it could'
                : `unclassified reads [${ planted.state.mesh.unclassified.join( ', ' ) }] — the ` +
                  'closure did not see a field that is plainly on the object'
        );
    }

    {
        const ground = groundIn();
        const { faults, state } = groundFaults( ground );

        report(
            'CLOSURE: the shipped ground moves exactly three material fields off stock, and declares all three',
            faults.length === 0,
            faults.length === 0
                ? `${ Object.keys( state.materialDeltas ).length } delta(s) — ` +
                    `${ Object.entries( state.materialDeltas ).map( ( [ key, delta ] ) => `${ key } ${ delta.stock }->${ delta.is }` ).join( ', ' ) } — ` +
                    `against a stock MeshStandardNodeMaterial, plus ${ Object.keys( declaredMesh ).length } mesh field(s) and ` +
                    `${ Object.keys( state.uniforms ).length } uniform(s) exact. metalness, emissive, envMapIntensity, ` +
                    'toneMapped, shadowSide, flatShading and every other field three carries are at their defaults ' +
                    'and would appear here on the day one of them stopped being'
                : faults.join( '; ' )
        );
    }

    {
        // `occlusion: false` is the plate every attribution in this file's header was measured
        // against, so its state has to be declared too — otherwise the fingerprint quietly only
        // covers the shipped configuration, which is how a gate ends up describing one draw.
        const ground = groundIn( { occlusion: false } );
        const { faults } = groundFaults( ground, {
            declaredDeltas: { color: DECLARED_MATERIAL_DELTAS.color, roughness: DECLARED_MATERIAL_DELTAS.roughness },
            occlusion: false
        } );

        report(
            'CLOSURE: `occlusion: false` differs from the shipped ground in exactly ONE field, the colour node',
            faults.length === 0,
            faults.length === 0
                ? 'the flat-albedo plate is the identical plane with `colorNode` back at its stock null — one ' +
                    'delta fewer and nothing else moved, which is what makes it a valid attribution baseline ' +
                    'rather than a second, differently-built floor'
                : faults.join( '; ' )
        );
    }

    {
        // And the light half of the product, closed by the same instrument the rig owns, so this
        // file is not relying on the other one having been run.
        const scene = new Scene();
        const rig = new LightingRig( { preset: 'body' } );

        rig.attachTo( scene, null );
        rig.aimAt( { ...shot, cameraPosition: new Vector3( 0.39, 0.91, 1.83 ) } );

        const unclassified = [];
        const missing = [];

        for ( const light of rig.lights ) {

            for ( const key of lightRenderState( light ).unclassified ) unclassified.push( `${ light.name }.${ key }` );
            for ( const key of lightRenderState( light ).missing ) missing.push( `${ light.name }.${ key }` );

        }

        report(
            'CLOSURE: the third factor — every field of every light in the rig that lands on this floor is classified',
            unclassified.length === 0 && missing.length === 0,
            unclassified.length === 0 && missing.length === 0
                ? `${ rig.lights.length } light(s) fully accounted for by \`lightRenderState\`. The floor's colour is ` +
                    'albedo x occlusion x INCIDENT, and this file owns the first two; the third is closed over there ' +
                    'and asserted here so neither file depends on the other having been run'
                : `UNCLASSIFIED ${ unclassified.join( ', ' ) }; MISSING ${ missing.join( ', ' ) }`
        );
    }

    // --- proved red, four mechanisms, none of them a colour and none of them a light ----------
    //
    // 🚩 RULE 4. Every one of these leaves `visibilityAt()` BIT-IDENTICAL, and `visibilityAt` is
    // what the Monte-Carlo, union-integrator, CONTRACT, BUDGET and CONTACT PROFILE blocks all
    // measure through. Between them those five blocks are 40-odd of this file's checks and they are
    // all a test of one function; none of them looks at the object that carries it.

    const mutations = [
        {
            what: 'RECEIVE SHADOW — mesh.receiveShadow true -> false',
            why: 'the project can afford exactly ONE shadow caster (2.62 ms, more than two and a half ' +
                'area lights) and it was bought to put the figure on the ground. `AnalyticLightNode.setup` ' +
                'skips the shadow entirely for an object that does not receive one, so the floor keeps its ' +
                'occlusion darkening, keeps its albedo, and loses the cast shadow at the feet. Measured ' +
                '1.49% of a 900x1200 body frame moved at a worst Δ20/255 — the cast shadow is small and it ' +
                'is the whole of what one 2.62 ms light was bought for.',
            mutate: ( ground ) => { ground.mesh.receiveShadow = false; }
        },
        {
            what: 'METALNESS — 0 -> 0.4',
            why: 'the header\'s whole albedo argument rests on "a matte dielectric reflects albedo x ' +
                'irradiance", which is why multiplying occlusion into the albedo is sound at all. At ' +
                'metalness 0.4 the diffuse term is 60% of what it was and F0 has taken on the albedo\'s ' +
                'colour, so the floor reflects the rim\'s blue through a tinted specular the occlusion ' +
                'term never touches. The one approximation this file flags as load-bearing, unasserted. ' +
                'Measured 26.31% of a 900x1200 body frame moved at a worst Δ19/255.',
            mutate: ( ground ) => { ground.mesh.material.metalness = 0.4; }
        },
        {
            what: 'EMISSIVE — material.emissive black -> #101010',
            why: 'an emissive floor adds light that no occlusion term multiplies, so the contact ' +
                'darkening this whole file exists to produce is diluted by a constant. It is the one ' +
                'material field that can defeat the occlusion without touching it. Measured 26.31% of a ' +
                '900x1200 body frame moved at a worst Δ7/255 — 26.31% is the floor\'s own share of that ' +
                'frame, so this is EVERY ground pixel, shallowly.',
            mutate: ( ground ) => { ground.mesh.material.emissive.setHex( 0x101010 ); }
        },
        {
            what: 'TONE MAPPING — material.toneMapped true -> false',
            why: '⚠️ AND THIS ONE IS HERE WITH ITS PIXEL EFFECT MEASURED AT ZERO, WHICH IS THE POINT. ' +
                'The plausible story is that the floor stops going through ACES while the figure still ' +
                'does. Measured: 0.00% of the frame moved, 0/255 — on this page tone mapping is an OUTPUT ' +
                'pass, so a per-material flag decides nothing. §1.25h. The clause still goes red, and it ' +
                'should: a closure covers a field BEFORE it matters, and the day the floor gets its own ' +
                'material-level output the flag stops being inert with nobody having touched this file.',
            mutate: ( ground ) => { ground.mesh.material.toneMapped = false; }
        },
        {
            what: 'DESYNC — strengthUniform.value 1 -> 0 with `strength` left at 1',
            why: 'the shader reads the uniform and every CPU mirror in this file reads `this.strength`. ' +
                'Out of step, `visibilityAt()` reports the full contact darkening — so the CONTACT PROFILE ' +
                'block passes, the CONTRACT block passes, the union integrator passes — and the rendered ' +
                'floor has no occlusion on it at all. The gap between a model and the thing that draws. ' +
                'Measured 19.07% of a 900x1200 body frame moved at a worst Δ108/255 — the second largest ' +
                'excursion of any ground mechanism, on a change the CPU mirror reports as nothing.',
            mutate: ( ground ) => { ground.strengthUniform.value = 0; }
        },
        {
            what: 'TILT — the plane rolled 2.9° off horizontal',
            why: 'the occlusion model, the sphere fit and every number in the header assume a receiver at ' +
                'y = 0 with normal +Y. A tilted floor changes `normalWorld` under the whole integral and ' +
                'puts a horizon across the frame, with the material, the uniforms and the light untouched. ' +
                'Measured 31.20% of a 900x1200 body frame moved at a worst Δ104/255.',
            mutate: ( ground ) => { ground.mesh.rotation.x += 0.05; }
        }
    ];

    console.log( '      injection                                     fingerprint   visibilityAt(0.05, 0)   contact profile' );

    for ( const variant of mutations ) {

        const clean = groundIn();
        const dirty = groundIn();

        variant.mutate( dirty );

        const { faults } = groundFaults( dirty );

        // The CPU mirror the rest of this file measures through, at two points on the contact
        // profile — under a sphere and clear of it. Bit-identical is the claim, so it is compared
        // as an exact equality rather than inside a tolerance.
        const cleanProfile = [ clean.visibilityAt( 0.05, 0 ), clean.visibilityAt( 0.6, 0 ) ];
        const dirtyProfile = [ dirty.visibilityAt( 0.05, 0 ), dirty.visibilityAt( 0.6, 0 ) ];
        const profileMoved = cleanProfile.some( ( value, index ) => value !== dirtyProfile[ index ] );

        console.log( `      ${ variant.what.slice( 0, 45 ).padEnd( 46 ) }${ ( faults.length > 0 ? 'RED' : 'green' ).padEnd( 14 ) }` +
            `${ dirtyProfile[ 0 ].toFixed( 9 ).padEnd( 24 ) }${ profileMoved ? 'MOVED' : 'bit-identical' }` );

        report(
            `KNOWN-BAD: ${ variant.what }`,
            faults.length > 0 && profileMoved === false,
            `FINGERPRINT reads ${ faults[ 0 ] ?? 'NOTHING' }, while \`visibilityAt\` is bit-identical at both ` +
            `sample points (${ dirtyProfile.map( ( value ) => value.toFixed( 9 ) ).join( ', ' ) }) — so the five ` +
            `blocks above it are all green. ${ variant.why }`
        );

    }

    // MUST STILL PASS, or a fingerprint this tight would reject every legitimate reconfiguration
    // and be turned off by the next person who needed one.
    for ( const variant of [
        { what: 'a ground sized to a portrait shot', ground: () => {

            const ground = new GroundContact();
            ground.attachTo( new Scene() );
            ground.sizeTo( { focus: new Vector3( 0.3, 1.55, -0.2 ), subjectHeightMetres: 0.42 } );

            return { ground, shot: { focus: new Vector3( 0.3, 1.55, -0.2 ), subjectHeightMetres: 0.42 } };

        } }
    ] ) {

        const { ground, shot: otherShot } = variant.ground();
        const state = ground.renderState();

        const expectedScale = otherShot.subjectHeightMetres * EXTENT_IN_HEIGHTS;

        report(
            `MUST PASS: ${ variant.what }`,
            Math.abs( state.mesh.read.scale[ 0 ] - expectedScale ) <= 1e-9
                && Math.abs( state.mesh.read.position[ 0 ] - otherShot.focus.x ) <= 1e-9
                && state.mesh.read.position[ 1 ] === 0
                && Object.keys( state.materialDeltas ).length === 3,
            `scale ${ state.mesh.read.scale[ 0 ].toFixed( 4 ) } m against ${ expectedScale.toFixed( 4 ) } and the plane ` +
            `still at y = 0 under a focus 1.55 m up, with the same three material deltas — the declaration is ` +
            'derived from the shot, so a different shot is not a defect'
        );

    }
}

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
