// tools/critic/hair-af.mjs — ā_f, ā_b and β̄_f by quadrature over THIS PROJECT'S SHIPPED BSDF.
//
// ## Why this file exists
//
// Zinke, Yuksel, Weber, Keyser, "Dual Scattering Approximation for Fast Multiple Scattering in
// Hair", SIGGRAPH 2008, §4.1.1 p.6: "While computing the transmittance (Equation 5) we use a one
// dimensional lookup table for ā_f(θ_d), which is precomputed by numerical integration of
// Equation 6." ā_f is therefore NOT a constant of the literature — it is a property of whichever
// fibre BCSDF a renderer ships, and the only way to get ours is to integrate ours. Two earlier
// rounds guessed it (`ā_f = √C` from TT absorption at h = 0) and both guesses are refuted in
// docs/research/zinke-dual-scattering.md §7. This file replaces the guess with a quadrature.
//
// Eq. (6), p.4 right column, transcribed from a 400 dpi render (see the research file §2):
//
//     ā_f(θ_d) = (1/π) ∫_{Ω_f} ∫_{-π/2}^{+π/2} f_s( (θ_d, φ), ω ) cos θ_d dφ dω
//
// Eq. (12), p.5 left column, is character-for-character identical with Ω_f → Ω_b.
//
// ## 🚩 THE ONE AMBIGUITY, AND IT IS PROPAGATED RATHER THAN RESOLVED
//
// The paper never says whether Ω_f is fixed in the fibre frame or defined RELATIVE to each
// incident azimuth φ. The two readings are genuinely different integrals and the research file
// marks the interpretation [D], so this file computes BOTH and reports both:
//
//   READING A — "fixed frame". The incident azimuth sweeps the back half (φ ∈ [-π/2, +π/2],
//     range π, which is the paper's own printed limits) and Ω_f is the OPPOSITE fixed half
//     (φ_o ∈ [π/2, 3π/2]). The φ sweep is then non-degenerate and the 1/π averages it.
//   READING B — "relative frame". Ω_f is the half-space forward of each incident direction, so
//     f_s depends only on Δ = φ_o − φ_i, the φ sweep is degenerate, and 1/π exactly cancels the
//     sweep's length. This is the reading that matches Zinke's own s̃_f ("1/π for forward
//     scattering directions and zero for backward", p.4) which is unambiguously relative.
//
// Both collapse onto ONE 2-D quadrature. f_s here depends only on (θ_d, θ_o, Δ), so substituting
// Δ = φ_o − φ_i turns the inner φ average into an azimuthal WEIGHT W(Δ):
//
//     ā(θ_d) = (cos θ_d / π) ∫_{-π/2}^{π/2} cos θ_o ∫_0^{2π} W(Δ) f_s(θ_d, θ_o, Δ) dΔ dθ_o
//
// ## The substitution that makes the known-answer clauses exact
//
// The quadrature runs in u = sin θ_o, not θ_o, because dω = cos θ_o dθ_o dφ = du dφ. That deletes
// the Jacobian: ∫_{-1}^{1} du = 2 on any uniform grid, to machine precision. Written the other way
// the midpoint rule integrates cos with a relative error of h²/24 — at 180 steps that is 1.27e-5,
// which is exactly the miss V1 and V3 showed before this substitution and is NOT a property of the
// BSDF. Two reasons this is the right variable and not a trick to make a gate pass:
//   · it is the projected-solid-angle measure, which is what dω already is;
//   · M_p in Karis' form is a Gaussian in `sinθi + sinθr` — the integrand is smooth and nearly
//     band-limited IN u, and lumpy in θ_o. Sampling uniformly in u samples the lobe evenly.
//
//     W_A,front(Δ) = π − |Δ − π|          (a tent peaking at forward)
//     W_A,back(Δ)  = |Δ − π|              (the complement)
//     W_B,front(Δ) = π on (π/2, 3π/2), else 0
//     W_B,back(Δ)  = π on [0, π/2) ∪ (3π/2, 2π], else 0
//
// ⚠️ Both readings carry the SAME total weight ∫W dΔ = π², which is why they agree exactly on a
// constant BSDF and why validation V3 below cannot tell them apart. They differ only in how that
// weight is distributed over relative azimuth, which is the whole question.
//
// ## Which half is "forward"
//
// Δ = 0 is RETRO (light and view on the same azimuthal side, `cosPhi = +1` in HairMaterial's own
// variable); Δ = π is straight-through TRANSMISSION (`cosPhi = −1`). Sources for that choice, both
// of them primary to this project:
//   · Karis' TT azimuthal distribution as mirrored in `azimuthalValues`, `exp(−3.65 cosφ − 3.98)`,
//     is maximal at cosφ = −1 — TT is the transmission lobe, so cosφ = −1 must be forward.
//   · Zinke §3.1 p.4: "Note that the strong TT component of hair fiber scattering is included in
//     the front half-cone."
// So the FRONT hemisphere is cos Δ < 0, i.e. Δ ∈ (π/2, 3π/2). Stated because getting it backwards
// silently swaps ā_f and ā_b.
//
// ## What f_s is here
//
// `hairScatteringValue( tangent, toLight, toView, colour, settings ).total`, summed over the three
// lobes, from packages/core/src/material/HairMaterial.js — the CPU mirror the selftest holds to the
// same properties as the TSL shader. Two facts about it that a reader must have:
//
//   🔴 `HAIR_DEFAULTS.weightTT = 0`. TT SHIPS OFF (see its comment: the rim light casts no shadow
//      and TT renders the groom blue). TT is the dominant FORWARD lobe, so the shipped ā_f is an
//      ā_f with the forward lobe deleted. Both arms are computed.
//   🔴 The shipped BSDF has NO 1/cos²θ_d factor. Marschner 2003 writes S = M·N/cos²θ_d; neither
//      the mirror nor the TSL twin carries it (grep: no `cosThetaD*cosThetaD` divide exists).
//      That is a property of what ships, not an error introduced here, and a `--marschner` arm
//      reports what it would be with the factor restored.
//
//   node tools/critic/hair-af.mjs                # validations, then the tables
//   node tools/critic/hair-af.mjs --fine         # same at half the step, for the convergence check
//   node tools/critic/hair-af.selftest.mjs       # the validations as gate clauses

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    HAIR_DEFAULTS,
    baseColourDerivation,
    hairScatteringValue,
    longitudinalValue
} from '../../packages/core/src/material/HairMaterial.js';

const HERE = path.dirname( fileURLToPath( import.meta.url ) );

/** The material file this run actually read, hashed, so a table can be pinned to a revision. */
export function materialDigest() {

    const file = path.resolve( HERE, '../../packages/core/src/material/HairMaterial.js' );

    return { file, sha256: createHash( 'sha256' ).update( fs.readFileSync( file ) ).digest( 'hex' ) };

}

export const BASE_COLOUR = baseColourDerivation().linear;

const TANGENT = [ 1, 0, 0 ];
const HALF_PI = Math.PI / 2;
const TWO_PI = 2 * Math.PI;

/** ω(θ, φ) in the fibre frame: θ is inclination OFF the normal plane, φ the azimuth within it. */
function direction( theta, phi ) {

    const c = Math.cos( theta );

    return [ Math.sin( theta ), c * Math.sin( phi ), c * Math.cos( phi ) ];

}

// --- the azimuthal weights, one per reading × hemisphere ---------------------------------------

/** Reading A, front: the overlap length of the φ sweep with a fixed forward half. Tent at Δ = π. */
export const weightFrontFixed = ( delta ) => Math.PI - Math.abs( delta - Math.PI );
/** Reading A, back: the complement, so front + back = π at every Δ. */
export const weightBackFixed = ( delta ) => Math.abs( delta - Math.PI );
/** Reading B, front: the half-space forward of the incident direction, cos Δ < 0. */
export const weightFrontRelative = ( delta ) => ( delta > HALF_PI && delta < 3 * HALF_PI ? Math.PI : 0 );
/** Reading B, back: its complement. */
export const weightBackRelative = ( delta ) => ( delta > HALF_PI && delta < 3 * HALF_PI ? 0 : Math.PI );
/** The whole sphere, for the partition identity. */
export const weightSphere = () => Math.PI;

export const WEIGHTS = {
    'A-front': weightFrontFixed,
    'A-back': weightBackFixed,
    'B-front': weightFrontRelative,
    'B-back': weightBackRelative,
    sphere: weightSphere
};

/**
 * The integrand supplier. Returns a 3-vector (per RGB channel) for one geometry.
 *
 * Kept injectable so the validations can substitute a BSDF whose answer is known on paper — a
 * constant, or zero — through the SAME quadrature the real numbers come out of. An instrument
 * validated on a different code path is not validated.
 */
export function shippedScattering( settings = {}, colour = BASE_COLOUR, marschnerNormalised = false ) {

    return ( thetaD, thetaO, delta ) => {

        const toLight = direction( thetaD, 0 );
        const toView = direction( thetaO, delta );
        const value = hairScatteringValue( TANGENT, toLight, toView, colour, settings );

        if ( marschnerNormalised === false ) return value.total;

        const cosThetaD = Math.max( value.geometry.cosThetaD, 1e-4 );

        return value.total.map( ( v ) => v / ( cosThetaD * cosThetaD ) );

    };

}

/**
 * Eq. 6 / Eq. 12 by midpoint quadrature, per RGB channel.
 *
 * Midpoint rather than Simpson because W_B is a step function — a higher-order rule would claim an
 * accuracy its own integrand does not have across the discontinuity, and midpoint's error is then
 * honestly O(h) there and O(h²) everywhere else. The convergence check halves h and prints both.
 *
 * @param {Function} scattering - (θ_d, θ_o, Δ) → number[3]
 * @param {number} thetaD - the incident inclination, radians. The function's own argument.
 * @param {Function} weight - one of WEIGHTS; W(Δ), carrying the paper's φ average.
 * @param {{thetaSteps:number, deltaSteps:number}} grid
 * @returns {number[]} ā per channel.
 */
export function averageAttenuation( scattering, thetaD, weight, grid ) {

    const { thetaSteps, deltaSteps } = grid;
    const dU = 2 / thetaSteps;
    const dDelta = TWO_PI / deltaSteps;
    const accumulator = [ 0, 0, 0 ];

    for ( let i = 0; i < thetaSteps; i ++ ) {

        // u = sin θ_o, so dω = du dφ and there is no Jacobian left to discretise.
        const u = - 1 + ( i + 0.5 ) * dU;
        const thetaO = Math.asin( u );

        for ( let j = 0; j < deltaSteps; j ++ ) {

            const delta = ( j + 0.5 ) * dDelta;
            const w = weight( delta ) * dU * dDelta;

            if ( w === 0 ) continue;

            const value = scattering( thetaD, thetaO, delta );

            accumulator[ 0 ] += w * value[ 0 ];
            accumulator[ 1 ] += w * value[ 1 ];
            accumulator[ 2 ] += w * value[ 2 ];

        }

    }

    const scale = Math.cos( thetaD ) / Math.PI;

    return accumulator.map( ( v ) => v * scale );

}

/**
 * β̄_f — 🔴 [D], DERIVED HERE, AND THE PAPER GIVES NO EQUATION FOR IT.
 *
 * Zinke defines β̄_f only as "the average longitudinal forward scattering variance of the k-th
 * scattering event, which is directly taken from the BCSDF of the hair fiber" (below Eq. 8, p.4).
 * There is no equation number for it anywhere in the ten pages and it is not in Table 1. The
 * weighting below is MINE: each lobe's own longitudinal width β_p, weighted by that lobe's share
 * of ā_f — i.e. run Eq. 6 three times, once per lobe, and use the three results as the weights.
 *
 *     β̄_f²(θ_d) = Σ_p ā_f,p(θ_d) β_p²  /  Σ_p ā_f,p(θ_d)
 *
 * ⚠️ THE VARIABLE. Zinke's g is defined in `θ_d + θ_i` — a SUM OF ANGLES, i.e. twice Marschner's
 * half-angle. HairMaterial stores β in Karis' `sinθi + sinθr`, which is the same variable to first
 * order in the angles, and `HAIR_BETA_R`'s own comment records β_K = 2 β_M. So the widths below are
 * already in Zinke's variable and need no factor of two — but that identification is [D] and small
 * angle, not [V].
 */
export function forwardVariance( settings, colour, thetaD, weight, grid ) {

    const options = { ...HAIR_DEFAULTS, ...settings };
    const widths = {
        r: options.roughnessR,
        tt: options.roughnessR * options.roughnessRatioTT,
        trt: options.roughnessR * options.roughnessRatioTRT
    };

    const shares = {};

    for ( const lobe of [ 'r', 'tt', 'trt' ] ) {

        const only = {
            ...options,
            weightR: lobe === 'r' ? options.weightR : 0,
            weightTT: lobe === 'tt' ? options.weightTT : 0,
            weightTRT: lobe === 'trt' ? options.weightTRT : 0
        };

        shares[ lobe ] = averageAttenuation( shippedScattering( only, colour ), thetaD, weight, grid );

    }

    const variance = [];
    const beta = [];

    for ( let channel = 0; channel < 3; channel ++ ) {

        let numerator = 0;
        let denominator = 0;

        for ( const lobe of [ 'r', 'tt', 'trt' ] ) {

            numerator += shares[ lobe ][ channel ] * widths[ lobe ] * widths[ lobe ];
            denominator += shares[ lobe ][ channel ];

        }

        variance[ channel ] = denominator > 0 ? numerator / denominator : 0;
        beta[ channel ] = Math.sqrt( variance[ channel ] );

    }

    return { beta, variance, shares, widths };

}

// ==============================================================================================
// THE VALIDATIONS — every one has its expected value written down BEFORE the run
// ==============================================================================================

/**
 * Each clause returns { name, expected, actual, tolerance, detail }. They are exported so the
 * selftest can gate on them and this file can print them; there is one implementation, not two.
 */
export function validations( grid = { thetaSteps: 180, deltaSteps: 360 } ) {

    const clauses = [];
    const constant = ( c ) => () => [ c, c, c ];

    // V1 — THE SOLID ANGLE OF A HEMISPHERE IS 2π. This tests the cos θ_o Jacobian and the θ_o
    // limits in isolation: integrate f_s ≡ 1 with W_B,front (which is π on a half of Δ) and divide
    // the π back out. ∫ cosθ dθ over [-π/2,π/2] = 2, times a Δ range of π, = 2π.
    {
        // With f_s ≡ 1 and θ_d = 0 the whole of Eq. 6 reads
        //   (1/π) · ∫cosθ_o dθ_o · ∫_{π/2}^{3π/2} π dΔ  =  (1/π) · 2 · π·π  =  2π,
        // which is the solid angle of the hemisphere itself. No undoing needed — Eq. 6 evaluated
        // on a unit BSDF IS the measure of Ω_f.
        const raw = averageAttenuation( constant( 1 ), 0, weightFrontRelative, grid );
        clauses.push( {
            name: 'V1  Eq.6 on f_s ≡ 1 returns |Ω_f| = 2π',
            expected: TWO_PI,
            actual: raw[ 0 ],
            tolerance: roundOffBudget( grid, TWO_PI ),
            detail: `midpoint over ${ grid.thetaSteps } u=sinθ_o × ${ grid.deltaSteps } Δ; exact in u, so the ` +
                `tolerance is float round-off and not a quadrature budget`
        } );
    }

    // V2 — A UNIT-AREA GAUSSIAN INTEGRATES TO 1 OVER ITS OWN VARIABLE. `longitudinalValue` is
    // normalised 1/(β√2π), so ∫ M_p dx over x = sinθi+sinθr must be exactly 1. This is the clause
    // that would catch a mis-typed normalisation in the mirror, and it is independent of the
    // hemisphere machinery above.
    {
        const beta = HAIR_DEFAULTS.roughnessR;
        const shift = HAIR_DEFAULTS.shiftR;
        const span = 12 * beta;
        const steps = 20000;
        const dx = 2 * span / steps;
        let area = 0;

        for ( let i = 0; i < steps; i ++ ) {

            const x = shift - span + ( i + 0.5 ) * dx;
            area += longitudinalValue( x, 0, shift, beta ) * dx;

        }

        clauses.push( {
            name: 'V2  ∫ M_p dx = 1 over its own variable',
            expected: 1,
            actual: area,
            tolerance: 1e-9,
            detail: `β = ${ beta.toFixed( 6 ) }, α = ${ shift }, ±12β, ${ steps } midpoint steps`
        } );
    }

    // V3 — THE END-TO-END CLOSED FORM. For a CONSTANT BSDF f_s = c the whole of Eq. 6 collapses:
    //   ā_f = (cosθ_d/π) · c · ∫cosθ_o dθ_o · ∫W dΔ = (cosθ_d/π) · c · 2 · π² = 2π c cosθ_d.
    // At c = 1/4π — which is this project's own `?hairdefect=unit-bsdf` probe constant, the BSDF of
    // a perfect diffuser — that is exactly cos θ_d / 2. Written before running: 0.5 at θ_d = 0 and
    // 0.25 at θ_d = 60°. It exercises the 1/π, the cos θ_d, the Jacobian and both W's at once, and
    // it must give the SAME answer under reading A and reading B because ∫W dΔ = π² for both.
    for ( const [ label, weight ] of [ [ 'A', weightFrontFixed ], [ 'B', weightFrontRelative ] ] ) {

        for ( const degrees of [ 0, 60 ] ) {

            const thetaD = degrees * Math.PI / 180;
            const actual = averageAttenuation( constant( 1 / ( 4 * Math.PI ) ), thetaD, weight, grid );

            clauses.push( {
                name: `V3${ label } f_s = 1/4π at θ_d = ${ degrees }° gives cos θ_d / 2`,
                expected: Math.cos( thetaD ) / 2,
                actual: actual[ 0 ],
                tolerance: roundOffBudget( grid, 1 ),
                detail: `reading ${ label }; closed form 2π·c·cosθ_d with c = 1/4π. Exact in u — no discretisation error to absorb.`
            } );

        }

    }

    // V4 — A FIBRE THAT SCATTERS NOTHING RETURNS EXACTLY ZERO. Two versions, and the second is the
    // interesting one: setting `colour` to black does NOT give zero, because R never enters the
    // fibre and is achromatic. Only killing R as well makes a "perfectly absorbing fibre" in this
    // BSDF's terms. Expected: 0 for both, and the R-only arm expected NON-zero.
    {
        const dead = { weightR: 0, weightTT: 0, weightTRT: 0 };
        const absorbing = { weightR: 0, weightTT: 1, weightTRT: 1 };
        const black = [ 0, 0, 0 ];

        clauses.push( {
            name: 'V4a all lobes off gives ā_f = 0 exactly',
            expected: 0,
            actual: averageAttenuation( shippedScattering( dead ), 0, weightFrontRelative, grid )[ 0 ],
            tolerance: 0,
            detail: 'weightR = weightTT = weightTRT = 0'
        } );

        clauses.push( {
            name: 'V4b perfectly absorbing fibre (C = 0, R off) gives ā_f = 0 exactly',
            expected: 0,
            actual: averageAttenuation( shippedScattering( absorbing, black ), 0, weightFrontRelative, grid )[ 0 ],
            tolerance: 0,
            detail: 'colour = (0,0,0) so both TT and TRT absorb totally; R disabled because it never enters the fibre'
        } );

        const rOnly = averageAttenuation(
            shippedScattering( { weightTT: 0, weightTRT: 0 }, black ), 0, weightFrontRelative, grid )[ 0 ];

        clauses.push( {
            name: 'V4c R on a BLACK fibre is NOT zero — the control that makes V4b mean something',
            expected: NaN,
            actual: rOnly,
            tolerance: NaN,
            detail: `ā_f from R alone with colour = (0,0,0) is ${ rOnly.toExponential( 4 ) }; ` +
                `asserted > 1e-6, i.e. "absorbing" cannot be spelled with the colour alone`,
            predicate: () => rOnly > 1e-6
        } );
    }

    // V5 — THE PARTITION IDENTITY. W_front + W_back = π at every Δ under BOTH readings, so
    // ā_f + ā_b must equal the whole-sphere integral computed independently. This is the clause
    // that catches a front/back convention error, which is the failure that would silently swap
    // the answer to the round's question.
    for ( const [ label, front, back ] of [
        [ 'A', weightFrontFixed, weightBackFixed ],
        [ 'B', weightFrontRelative, weightBackRelative ]
    ] ) {

        const f = averageAttenuation( shippedScattering(), 0, front, grid )[ 0 ];
        const b = averageAttenuation( shippedScattering(), 0, back, grid )[ 0 ];
        const sphere = averageAttenuation( shippedScattering(), 0, weightSphere, grid )[ 0 ];

        clauses.push( {
            name: `V5${ label } ā_f + ā_b = the whole-sphere integral`,
            expected: sphere,
            actual: f + b,
            tolerance: 1e-12,
            detail: `reading ${ label }, red channel, shipped defaults: ${ f.toExponential( 6 ) } + ` +
                `${ b.toExponential( 6 ) } vs ${ sphere.toExponential( 6 ) }`
        } );

    }

    // V6 — RECIPROCITY OF THE SHIPPED MIRROR. Eq. 6's outer integral runs over the OUTGOING
    // direction; if f_s were not symmetric in its two arguments the choice of which slot to sweep
    // would matter. Measured here rather than assumed. Expected: bit-identical.
    {
        const f = shippedScattering( { weightTT: 1 } );
        let worst = 0;

        for ( let i = 0; i < 37; i ++ ) {

            for ( let j = 0; j < 37; j ++ ) {

                const a = ( - 80 + i * 4.5 ) * Math.PI / 180;
                const b = ( - 80 + j * 4.5 ) * Math.PI / 180;
                const delta = ( i * 17 + j * 29 ) % 360 * Math.PI / 180;
                const forward = f( a, b, delta )[ 0 ];
                const swapped = f( b, a, delta )[ 0 ];

                worst = Math.max( worst, Math.abs( forward - swapped ) );

            }

        }

        clauses.push( {
            name: 'V6  f_s(ω_i, ω_o) = f_s(ω_o, ω_i) — so it does not matter which slot Eq. 6 sweeps',
            expected: 0,
            actual: worst,
            tolerance: 1e-15,
            detail: `worst |Δ| over 1369 (θ_i, θ_o, Δ) triples, all three lobes on. The mirror is ` +
                `algebraically symmetric — the residual is float association order in dotProduct, ` +
                `measured at 1.4e-16 this session, so the bar is one ulp-ish at 1e-15 rather than exact 0`
        } );
    }

    return clauses;

}

/**
 * The float round-off budget for a naive running sum, so a tolerance is derived rather than tuned.
 *
 * Sequential accumulation of N terms has a worst-case relative error of order N·ε and a typical
 * error of order √N·ε; the bar here is 8·N·ε, i.e. deliberately loose against the worst case and
 * still eight orders tighter than any quadrature effect. It exists so that V1 and V3 — whose
 * answers are exact in this variable — assert "no method error at all" rather than "close enough".
 * Measured this session at the 180×360 grid: V1's residual is 5.37e-12 against a budget of 3.6e-10.
 */
export function roundOffBudget( grid, magnitude ) {

    const terms = grid.thetaSteps * grid.deltaSteps;

    return 8 * terms * Number.EPSILON * Math.max( magnitude, 1 );

}

export function clausePassed( clause ) {

    if ( typeof clause.predicate === 'function' ) return clause.predicate() === true;

    return Math.abs( clause.actual - clause.expected ) <= clause.tolerance;

}

// ==============================================================================================
// THE TABLES
// ==============================================================================================

export const ARMS = [
    [ 'shipped', {}, 'HAIR_DEFAULTS exactly — weightTT = 0, TT OFF, as the frame renders today' ],
    [ 'tt-on', { weightTT: 1 }, 'the same with the forward lobe restored (?hairlobes=r,tt,trt)' ]
];

export function table( thetaDegrees, weight, settings, grid, marschner = false ) {

    return thetaDegrees.map( ( degrees ) => {

        const thetaD = degrees * Math.PI / 180;
        const af = averageAttenuation(
            shippedScattering( settings, BASE_COLOUR, marschner ), thetaD, weight, grid );

        return { degrees, af };

    } );

}

/** n values this project has actually measured. Every one is quoted from the brief that owns it. */
export const MEASURED_N = [
    [ 1.1890, 'the shipped sheet input\'s recovered mean crossing count' ],
    [ 4.0654, 'the envelope path toward the key, azimuth 1' ],
    [ 4.7507, 'the envelope path toward the key, azimuth 2' ],
    [ 7.55, 'the card-crossing rate over all five lights' ]
];

export const DENSITY_FACTOR = 0.7; // Zinke p.4: "the density factor is set to 0.7". [V]

function formatVector( v, digits = 6 ) {

    return v.map( ( x ) => x.toExponential( digits ) ).join( '  ' );

}

function main() {

    const fine = process.argv.includes( '--fine' );
    const grid = fine ? { thetaSteps: 360, deltaSteps: 720 } : { thetaSteps: 180, deltaSteps: 360 };
    const digest = materialDigest();

    console.log( `\nhair-af.mjs — ā_f by quadrature over the shipped BSDF` );
    console.log( `  material  ${ digest.file }` );
    console.log( `  sha256    ${ digest.sha256 }` );
    console.log( `  colour    linear ${ formatVector( BASE_COLOUR ) }  (#1A0E0C)` );
    console.log( `  grid      ${ grid.thetaSteps } θ_o × ${ grid.deltaSteps } Δ midpoint` );

    console.log( `\n--- validations, expected values written down before the run -------------------\n` );

    let failed = 0;

    for ( const clause of validations( grid ) ) {

        const ok = clausePassed( clause );
        if ( ! ok ) failed += 1;
        const expected = Number.isNaN( clause.expected ) ? '(predicate)' : clause.expected.toPrecision( 10 );
        console.log( `${ ok ? 'PASS' : 'FAIL' }  ${ clause.name }` );
        console.log( `      expected ${ expected }   actual ${ clause.actual.toPrecision( 10 ) }` );
        console.log( `      ${ clause.detail }` );

    }

    console.log( `\n${ failed } failed of the validations above.\n` );

    for ( const [ armName, settings, note ] of ARMS ) {

        for ( const reading of [ 'A', 'B' ] ) {

            console.log( `\n--- ā_f  arm "${ armName }"  reading ${ reading } ---------------------------` );
            console.log( `    ${ note }` );
            console.log( `    θ_d°        ā_f.R          ā_f.G          ā_f.B        R/B` );

            for ( const row of table(
                [ 0, 10, 20, 30, 40, 50, 60, 70, 80 ], WEIGHTS[ `${ reading }-front` ], settings, grid ) ) {

                const [ r, g, b ] = row.af;
                console.log( `    ${ String( row.degrees ).padStart( 3 ) }   ` +
                    `${ r.toExponential( 6 ) }  ${ g.toExponential( 6 ) }  ${ b.toExponential( 6 ) }  ` +
                    `${ ( r / b ).toFixed( 4 ) }` );

            }

            console.log( `    θ_d°        ā_b.R          ā_b.G          ā_b.B        R/B` );

            for ( const row of table(
                [ 0, 30, 60 ], WEIGHTS[ `${ reading }-back` ], settings, grid ) ) {

                const [ r, g, b ] = row.af;
                console.log( `    ${ String( row.degrees ).padStart( 3 ) }   ` +
                    `${ r.toExponential( 6 ) }  ${ g.toExponential( 6 ) }  ${ b.toExponential( 6 ) }  ` +
                    `${ ( r / b ).toFixed( 4 ) }` );

            }

        }

    }

    console.log( `\n--- β̄_f [D], attenuation-weighted lobe widths, reading B, θ_d = 0 --------------` );

    for ( const [ armName, settings ] of ARMS ) {

        const v = forwardVariance( settings, BASE_COLOUR, 0, weightFrontRelative, grid );
        console.log( `    ${ armName.padEnd( 8 ) } β̄_f = ${ v.beta.map( ( b ) => b.toFixed( 6 ) ).join( '  ' ) } ` +
            `rad  (β_R ${ v.widths.r.toFixed( 4 ) }, β_TT ${ v.widths.tt.toFixed( 4 ) }, β_TRT ${ v.widths.trt.toFixed( 4 ) })` );

    }

    console.log( `\n--- T_f = d_f · ā_f^n at d_f = ${ DENSITY_FACTOR }, θ_d = 0 ------------------------------` );

    for ( const [ armName, settings ] of ARMS ) {

        for ( const reading of [ 'A', 'B' ] ) {

            const af = averageAttenuation(
                shippedScattering( settings ), 0, WEIGHTS[ `${ reading }-front` ], grid );

            console.log( `\n    arm "${ armName }" reading ${ reading }: ` +
                `ā_f = ${ formatVector( af ) }, ā_f.R/ā_f.B = ${ ( af[ 0 ] / af[ 2 ] ).toFixed( 6 ) }` );
            console.log( `        n        T_f.R          T_f.G          T_f.B       T_f.R/T_f.B` );

            for ( const [ n, why ] of MEASURED_N ) {

                const tf = af.map( ( a ) => DENSITY_FACTOR * Math.pow( a, n ) );
                console.log( `    ${ n.toFixed( 4 ).padStart( 7 ) }  ${ tf.map( ( t ) => t.toExponential( 6 ) ).join( '  ' ) }  ` +
                    `${ ( tf[ 0 ] / tf[ 2 ] ).toFixed( 4 ) }    ${ why }` );

            }

        }

    }

    // --- the Marschner-normalisation caveat, priced rather than argued -------------------------
    //
    // Marschner 2003 §4 writes the fibre BSDF as S = M_p(θ_h) N_p(φ) / cos²θ_d. Neither the CPU
    // mirror nor the TSL twin in HairMaterial.js carries that divisor — grep the file: there is no
    // cos²θ_d divide anywhere in it. Whether that is a defect is a shader question and not this
    // file's business; what IS this file's business is that ā_f is an integral of f_s, so the
    // missing factor moves the answer. Priced here so the caveat is a number.

    console.log( `\n--- caveat: the shipped BSDF omits Marschner's 1/cos²θ_d. What it would be with it ---` );
    console.log( `    arm       θ_d°     as shipped        ÷cos²θ_d        ratio` );

    for ( const [ armName, settings ] of ARMS ) {

        for ( const degrees of [ 0, 30, 60 ] ) {

            const thetaD = degrees * Math.PI / 180;
            const plain = averageAttenuation(
                shippedScattering( settings, BASE_COLOUR, false ), thetaD, weightFrontRelative, grid )[ 0 ];
            const normalised = averageAttenuation(
                shippedScattering( settings, BASE_COLOUR, true ), thetaD, weightFrontRelative, grid )[ 0 ];

            console.log( `    ${ armName.padEnd( 8 ) }  ${ String( degrees ).padStart( 3 ) }   ` +
                `${ plain.toExponential( 6 ) }   ${ normalised.toExponential( 6 ) }   ${ ( normalised / plain ).toFixed( 4 ) }` );

        }

    }

    // --- the convergence check: halve the step, show what survives -----------------------------
    //
    // Midpoint is O(h²) on a smooth integrand and O(h) across a discontinuity, and W_B IS a
    // discontinuity in Δ. Both behaviours show up below and neither is hidden: the rows that
    // quarter their error when the step halves are the smooth ones; the rows that only halve it are
    // the ones sitting on W_B's step. The printed tables are the COARSE grid, so this section is
    // what licenses the number of digits they are read to.

    console.log( `\n--- convergence: ${ grid.thetaSteps }×${ grid.deltaSteps } against ${ 2 * grid.thetaSteps }×${ 2 * grid.deltaSteps } ---` );
    console.log( `    arm       rd  θ_d°   coarse            halved            |rel|` );

    const halved = { thetaSteps: 2 * grid.thetaSteps, deltaSteps: 2 * grid.deltaSteps };
    let worstRelative = 0;

    for ( const [ armName, settings ] of ARMS ) {

        for ( const reading of [ 'A', 'B' ] ) {

            for ( const degrees of [ 0, 30, 60 ] ) {

                const thetaD = degrees * Math.PI / 180;
                const w = WEIGHTS[ `${ reading }-front` ];
                const coarse = averageAttenuation( shippedScattering( settings ), thetaD, w, grid )[ 0 ];
                const fine = averageAttenuation( shippedScattering( settings ), thetaD, w, halved )[ 0 ];
                const relative = Math.abs( fine - coarse ) / fine;

                worstRelative = Math.max( worstRelative, relative );

                console.log( `    ${ armName.padEnd( 8 )}  ${ reading }   ${ String( degrees ).padStart( 3 ) }  ` +
                    `${ coarse.toPrecision( 12 ) }   ${ fine.toPrecision( 12 ) }   ${ relative.toExponential( 3 ) }` );

            }

        }

    }

    console.log( `\n    worst relative change on halving the step: ${ worstRelative.toExponential( 3 ) } ` +
        `→ the tables above are stable to ${ Math.max( 1, Math.floor( - Math.log10( worstRelative ) ) ) } significant digits.` );

    process.exitCode = failed === 0 ? 0 : 1;

}

if ( process.argv[ 1 ] && path.resolve( process.argv[ 1 ] ) === path.resolve( fileURLToPath( import.meta.url ) ) ) {

    main();

}
