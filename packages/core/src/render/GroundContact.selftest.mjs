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
 * A measurement outside its range is a FAIL and exits non-zero. It is not grounds for widening
 * the range.
 *
 * Usage:  node "packages/core/src/render/GroundContact.selftest.mjs"
 */

import { Float32BufferAttribute, Matrix4, Uint16BufferAttribute } from 'three';
import { BufferGeometry, Bone, MeshStandardNodeMaterial, Skeleton, SkinnedMesh } from 'three/webgpu';

import {
    GroundContact,
    groundVisibility,
    measureBoneRadii,
    sphereOcclusion,
    MAX_OCCLUDERS,
    OCCLUDER_SEGMENTS
} from './GroundContact.js';

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

console.log( `\n${ failures === 0 ? 'PASS' : 'FAIL' }: ${ checks - failures }/${ checks } checks green\n` );

process.exitCode = failures === 0 ? 0 : 1;
