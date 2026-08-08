/**
 * PreintegratedSkinLut — the skin diffusion profile, and the Penner lookup table built from it.
 *
 * This file has NO three.js import, on purpose. It is the shared source of truth for three
 * consumers that cannot all live in a browser: `SkinMaterial.js` builds a `DataTexture` from it at
 * material-creation time, `tools/lut-bake/bake.mjs` writes a PNG of it for a human to look at, and
 * `tools/lut-bake/lut-bake.selftest.mjs` asserts properties of it in both directions.
 *
 * ## What the table is
 *
 * Penner's pre-integrated skin shading (SIGGRAPH 2011, *Advances in Real-Time Rendering*) rests on
 * one observation: for a convex surface, the *result* of light scattering around the shading point
 * depends almost entirely on two numbers — how far the surface is tilted away from the light
 * (N·L) and how tightly it curves (1/r). So the whole scattering integral can be evaluated offline
 * over those two axes and looked up. No gather taps, no blur passes, no extra render targets: one
 * texture fetch replaces `BRDF_Lambert`.
 *
 * The integral, as Penner states it: walk a ring of radius *r* tangent to the surface, weight each
 * point on the ring by how much light diffuses from there to the centre, and average the Lambert
 * response over that weighted ring.
 *
 *     scattered(cosθ, r) = ∫ saturate(cos(θ + x)) · P(2r·sin(x/2)) dx  /  ∫ P(2r·sin(x/2)) dx
 *
 * `2r·sin(x/2)` is the straight-line chord across the ring — the distance light actually travels
 * through the tissue — not the arc length.
 *
 * Because the red channel of skin's diffusion profile is several times wider than green and blue,
 * red keeps arriving at shading points green and blue have already given up on. That is the
 * red-shifted terminator, and it is the whole reason the technique exists.
 *
 * ## Only one number matters, and that is why the table is dimensionless
 *
 * Scaling the ring radius by *k* is exactly equivalent to scaling the profile's spatial extent by
 * 1/k — every term in the integral above depends on `r` only through `P(2r·sin(x/2))`. So the
 * table's second axis is not a curvature and not a distance but their **product**:
 *
 *     ringCurvature = scatterDistanceMillimetres × curvaturePerMillimetre        [dimensionless]
 *
 * The profile is therefore normalised to a red-channel RMS radius of exactly 1 mm, and the
 * material carries the real scatter distance as a uniform. One table serves every scatter
 * distance, and the uniform means what its name says.
 *
 * ## The profile
 *
 * Six-Gaussian fit to the three-layer skin BSSRDF, from d'Eon & Luebke, *Advanced Techniques for
 * Realistic Real-Time Skin Rendering*, GPU Gems 3 chapter 14, table 14-1. Variances are in mm² at
 * the paper's own scale and the weights sum to exactly 1.0 per channel, so the profile carries
 * unit albedo and the ring average is a redistribution of light rather than a gain.
 *
 * ⚠️ The paper's channel ratio is NOT this project's target, and the difference is measured rather
 * than assumed. `docs/research/stellar-blade-look-spec.md` §5 asks for
 *
 *     scatter distance 1.0 – 1.5 mm at head scale, R:G:B ≈ 1.00 : 0.35 : 0.22
 *
 * The published fit's own RMS radii — computed by `profileRmsRadiiMillimetres()` below, not quoted
 * from anywhere — are 1.6631 / 0.3691 / 0.2226 mm, a ratio of 1.000 : 0.222 : 0.134. It is
 * *redder* than the spec asks for. Each channel is therefore rescaled radially onto the spec's
 * ratio. Per-channel radial rescaling is the standard retint — it is what Jimenez's separable SSS
 * exposes as its falloff colour — and it changes only each channel's spatial scale, never the
 * shape and never the unit albedo.
 *
 * ## Why the table is built at runtime instead of loaded from a file
 *
 * Both were viable; the deciding number is that it is cheap. Measured in node at the shipping size
 * (`tools/lut-bake/lut-bake.selftest.mjs` prints it), the whole table costs single-digit
 * milliseconds — far less than the figure GLB's parse — and building it in memory sidesteps an
 * 8-bit PNG's 1/255 quantisation on a function whose interesting range is a few percent wide, plus
 * a fetch, plus a URL that has to resolve under two different Vite roots. `tools/lut-bake/` still
 * writes the PNG, for looking at and for regression-diffing.
 */

// --- the diffusion profile --------------------------------------------------------------------

/**
 * d'Eon & Luebke's six-Gaussian sum, GPU Gems 3 table 14-1. `variance` is in mm²; `weight` is
 * [R, G, B] and each column sums to 1.0.
 */
export const SKIN_PROFILE_GAUSSIANS = [
    { variance: 0.0064, weight: [ 0.233, 0.455, 0.649 ] },
    { variance: 0.0484, weight: [ 0.100, 0.336, 0.344 ] },
    { variance: 0.1870, weight: [ 0.118, 0.198, 0.000 ] },
    { variance: 0.5670, weight: [ 0.113, 0.007, 0.007 ] },
    { variance: 1.9900, weight: [ 0.358, 0.004, 0.000 ] },
    { variance: 7.4100, weight: [ 0.078, 0.000, 0.000 ] }
];

/**
 * The look spec's per-channel scatter ratio, §5: "R:G:B ≈ 1.00 : 0.35 : 0.22". Red is normalised
 * to 1 mm here because the table is dimensionless; the absolute distance lives on the material.
 */
export const SPEC_SCATTER_CHANNEL_RATIO = [ 1.00, 0.35, 0.22 ];

/**
 * The largest ring curvature the table resolves. Beyond about 1.5 the ring is smaller than the
 * profile in every channel, the response has gone fully isotropic (all three channels converge on
 * the ring mean of saturate(cos), ≈1/π) and the colour separation the technique exists for has
 * *closed again*. 2.0 leaves headroom past that turning point without wasting rows.
 */
export const MAX_RING_CURVATURE = 2.0;

/** Table dimensions. u is N·L over [-1, 1]; v is ring curvature, square-root encoded. */
export const LUT_WIDTH = 128;
export const LUT_HEIGHT = 64;

/**
 * The v axis is `sqrt( ringCurvature / MAX_RING_CURVATURE )`.
 *
 * A linear axis would be wrong for this function: a face's broad surfaces (cheek, forehead,
 * 50–90 mm radius) all land in the first row or two, which is exactly where the response is
 * changing fastest per row. The square root spends half the table below ring curvature 0.5, which
 * is where every facial feature that matters sits. `SkinMaterial` applies the same expression in
 * TSL against this module's own `MAX_RING_CURVATURE`, so the constant cannot drift; the shape of
 * the encoding is duplicated across the JS/WGSL boundary and has to be changed in both places.
 */
export function encodeRingCurvature( ringCurvature ) {

    return Math.sqrt( clamp01( ringCurvature / MAX_RING_CURVATURE ) );

}

export function decodeRingCurvature( v ) {

    return v * v * MAX_RING_CURVATURE;

}

/** Samples around the ring. Penner's own listing uses ~63; this is 4x that. */
const RING_SAMPLES = 256;

/**
 * RMS radius of each channel of a Gaussian-sum profile, in mm.
 *
 * For a normalised 2D Gaussian of variance v, E[r²] = 2v, so the RMS radius of a weighted sum is
 * sqrt( Σ wᵢ·2vᵢ / Σ wᵢ ). This is the quantity the look spec's "scatter distance" is compared
 * against, and it is measured here rather than quoted so the comparison can be re-run if the
 * profile is ever replaced.
 *
 * @param {Array<{variance:number, weight:number[]}>} [gaussians]
 * @returns {number[]} [R, G, B] RMS radii in millimetres.
 */
export function profileRmsRadiiMillimetres( gaussians = SKIN_PROFILE_GAUSSIANS ) {

    const radii = [];

    for ( let channel = 0; channel < 3; channel ++ ) {

        let weightSum = 0;
        let secondMoment = 0;

        for ( const gaussian of gaussians ) {

            weightSum += gaussian.weight[ channel ];
            secondMoment += gaussian.weight[ channel ] * 2 * gaussian.variance;

        }

        radii.push( Math.sqrt( secondMoment / weightSum ) );

    }

    return radii;

}

/**
 * The per-channel radial scale that moves the published profile onto the look spec's ratio, with
 * red normalised to an RMS radius of exactly 1 mm. Scaling a radius by s scales a variance by s².
 *
 * @returns {number[]} [R, G, B] dimensionless scale factors.
 */
export function specScatterScales( gaussians = SKIN_PROFILE_GAUSSIANS, channelRatio = SPEC_SCATTER_CHANNEL_RATIO ) {

    const measured = profileRmsRadiiMillimetres( gaussians );

    return channelRatio.map( ( ratio, channel ) => ratio / measured[ channel ] );

}

/**
 * The profile the table actually integrates: the published Gaussians, rescaled per channel.
 *
 * @returns {Array<{variance:number[], weight:number[]}>} variance is now per channel, in mm².
 */
export function scaledProfile( gaussians = SKIN_PROFILE_GAUSSIANS, channelRatio = SPEC_SCATTER_CHANNEL_RATIO ) {

    const scales = specScatterScales( gaussians, channelRatio );

    return gaussians.map( ( gaussian ) => ( {
        variance: scales.map( ( scale ) => gaussian.variance * scale * scale ),
        weight: gaussian.weight
    } ) );

}

/**
 * The diffusion profile evaluated at a chord distance, per channel.
 *
 * @param {number} distanceMillimetres - in units of the red channel's RMS radius.
 * @param {Array} [profile] - as returned by `scaledProfile()`.
 * @returns {number[]} [R, G, B], units of 1/mm².
 */
export function diffusionProfile( distanceMillimetres, profile = scaledProfile() ) {

    const value = [ 0, 0, 0 ];
    const rSquared = distanceMillimetres * distanceMillimetres;

    for ( const gaussian of profile ) {

        for ( let channel = 0; channel < 3; channel ++ ) {

            const variance = gaussian.variance[ channel ];
            value[ channel ] += gaussian.weight[ channel ]
                * Math.exp( - rSquared / ( 2 * variance ) ) / ( 2 * Math.PI * variance );

        }

    }

    return value;

}

// --- the table ----------------------------------------------------------------------------------

/**
 * Builds the pre-integrated skin table.
 *
 * Row 0 (ring curvature 0, i.e. an infinite radius) is `saturate(N·L)` exactly, stated rather than
 * taken as a numerical limit. That row is what makes the technique falsifiable: a shader indexing
 * it at zero curvature must render *precisely* Lambert, so any difference between the effect-off
 * and effect-on plates is attributable to curvature and to nothing else.
 *
 * @param {Object} [options]
 * @param {number} [options.width=LUT_WIDTH]
 * @param {number} [options.height=LUT_HEIGHT]
 * @param {number} [options.ringSamples=RING_SAMPLES]
 * @param {Array} [options.gaussians=SKIN_PROFILE_GAUSSIANS] - swap the profile's weights.
 * @param {number[]} [options.channelRatio=SPEC_SCATTER_CHANNEL_RATIO] - swap the retint. The
 *   selftest passes grey weights AND a grey ratio, to prove the table's colour separation comes
 *   from the profile and not from the integrator. Both matter: the published weights and the spec's
 *   retint are two independent sources of separation and a known-bad has to remove both.
 * @returns {{data: Float32Array, width: number, height: number, channels: number,
 *            ringSamples: number, buildMilliseconds: number}}
 *   `data` is RGB, row-major, v increasing with the row index.
 */
export function buildPreintegratedSkinLut( options = {} ) {

    const width = options.width ?? LUT_WIDTH;
    const height = options.height ?? LUT_HEIGHT;
    const ringSamples = options.ringSamples ?? RING_SAMPLES;

    const startedAt = now();

    const profile = scaledProfile(
        options.gaussians ?? SKIN_PROFILE_GAUSSIANS,
        options.channelRatio ?? SPEC_SCATTER_CHANNEL_RATIO
    );
    const data = new Float32Array( width * height * 3 );

    // The ring is walked over [-π/2, +π/2]: beyond a quarter turn either way the surface has
    // curved out of sight of the shading point and contributes nothing a diffuse term can carry.
    const angles = new Float64Array( ringSamples );
    for ( let s = 0; s < ringSamples; s ++ ) {

        angles[ s ] = - Math.PI / 2 + ( Math.PI * ( s + 0.5 ) ) / ringSamples;

    }

    // Row 0: zero curvature is Lambert, stated rather than integrated.
    for ( let i = 0; i < width; i ++ ) {

        const lambert = Math.max( 0, texelDotNL( i, width ) );
        data[ i * 3 ] = lambert;
        data[ i * 3 + 1 ] = lambert;
        data[ i * 3 + 2 ] = lambert;

    }

    // Weights depend only on the row's radius and the ring angle, so they are computed once per
    // row rather than once per texel. That is the whole reason this costs milliseconds and not
    // seconds — it turns a six-exponential evaluation per texel-sample into a multiply-add.
    const weights = new Float64Array( ringSamples * 3 );

    for ( let j = 1; j < height; j ++ ) {

        const ringCurvature = decodeRingCurvature( j / ( height - 1 ) );
        const radius = 1 / ringCurvature;

        let weightSumR = 0;
        let weightSumG = 0;
        let weightSumB = 0;

        for ( let s = 0; s < ringSamples; s ++ ) {

            const chord = Math.abs( 2 * radius * Math.sin( angles[ s ] * 0.5 ) );
            const p = diffusionProfile( chord, profile );

            weights[ s * 3 ] = p[ 0 ];
            weights[ s * 3 + 1 ] = p[ 1 ];
            weights[ s * 3 + 2 ] = p[ 2 ];

            weightSumR += p[ 0 ];
            weightSumG += p[ 1 ];
            weightSumB += p[ 2 ];

        }

        for ( let i = 0; i < width; i ++ ) {

            const theta = Math.acos( clampSigned( texelDotNL( i, width ) ) );

            let lightR = 0;
            let lightG = 0;
            let lightB = 0;

            for ( let s = 0; s < ringSamples; s ++ ) {

                const lambert = Math.cos( theta + angles[ s ] );
                if ( lambert <= 0 ) continue;

                lightR += lambert * weights[ s * 3 ];
                lightG += lambert * weights[ s * 3 + 1 ];
                lightB += lambert * weights[ s * 3 + 2 ];

            }

            const at = ( j * width + i ) * 3;
            data[ at ] = lightR / weightSumR;
            data[ at + 1 ] = lightG / weightSumG;
            data[ at + 2 ] = lightB / weightSumB;

        }

    }

    return {
        data,
        width,
        height,
        channels: 3,
        ringSamples,
        maxRingCurvature: MAX_RING_CURVATURE,
        buildMilliseconds: now() - startedAt
    };

}

/**
 * Bilinear read of a built table, in the same coordinates the shader uses. Exists so the selftest
 * can assert what the *shader* will see rather than what the array happens to hold.
 *
 * @param {{data:Float32Array,width:number,height:number}} lut
 * @param {number} dotNL - -1 to 1.
 * @param {number} ringCurvature - dimensionless, scatterDistanceMm × curvaturePerMm.
 * @returns {number[]} [R, G, B]
 */
export function sampleLut( lut, dotNL, ringCurvature ) {

    const u = clamp01( dotNL * 0.5 + 0.5 ) * ( lut.width - 1 );
    const v = encodeRingCurvature( ringCurvature ) * ( lut.height - 1 );

    const i0 = Math.floor( u );
    const j0 = Math.floor( v );
    const i1 = Math.min( i0 + 1, lut.width - 1 );
    const j1 = Math.min( j0 + 1, lut.height - 1 );
    const fu = u - i0;
    const fv = v - j0;

    const out = [ 0, 0, 0 ];

    for ( let c = 0; c < 3; c ++ ) {

        const a = lut.data[ ( j0 * lut.width + i0 ) * 3 + c ];
        const b = lut.data[ ( j0 * lut.width + i1 ) * 3 + c ];
        const d = lut.data[ ( j1 * lut.width + i0 ) * 3 + c ];
        const e = lut.data[ ( j1 * lut.width + i1 ) * 3 + c ];

        out[ c ] = ( a * ( 1 - fu ) + b * fu ) * ( 1 - fv ) + ( d * ( 1 - fu ) + e * fu ) * fv;

    }

    return out;

}

/** The N·L a texel column stands for. Column 0 is -1, the last column is +1. */
function texelDotNL( i, width ) {

    return ( i / ( width - 1 ) ) * 2 - 1;

}

function clamp01( value ) {

    return value < 0 ? 0 : ( value > 1 ? 1 : value );

}

function clampSigned( value ) {

    return value < -1 ? -1 : ( value > 1 ? 1 : value );

}

function now() {

    return typeof performance !== 'undefined' ? performance.now() : Date.now();

}
