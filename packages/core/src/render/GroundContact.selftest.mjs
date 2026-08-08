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
 *   COMBINATION           Visibility over a set is the product of per-sphere transmittances, is
 *                         monotone in the occluder count, and stays inside 0..1.
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

import { groundVisibility, measureBoneRadii, sphereOcclusion, MAX_OCCLUDERS } from './GroundContact.js';

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

console.log( '\nCOMBINATION\n' );

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
