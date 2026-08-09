/**
 * Toksvig — normal-map variance folded back into roughness, so micro-detail stops shimmering.
 *
 * Punch-list 3.11. The defect this exists to fix is source-verified rather than suspected:
 * `three/src/nodes/functions/material/getGeometryRoughness.js` takes screen-space derivatives of
 * **`normalViewGeometry`** — the interpolated VERTEX normal — and `getRoughness.js` adds that to
 * the material roughness. So three's specular antialiasing is geometric only, and **a normal map
 * contributes nothing to it**, however violently it aliases. `research/rendering-stack.md` ranks
 * this second of the six gaps to a PS5 character, and the skin material on this figure carries a
 * micro-normal at 48 repeats, which is exactly the signal that has no defence.
 *
 * Measured on `post.html?bare&orbit=1` at 900x1200 with the camera yawing 6 deg/s, over a flat
 * forehead patch (300,180,120,80), RMS of the frame-to-frame 3x3 high-pass in 8-bit code values:
 *
 *   | mode      | highFreqRms |
 *   |-----------|-------------|
 *   | no AA     |    1.408    |
 *   | 4x MSAA   |    1.408    |  <- identical to three decimals: MSAA does nothing here
 *   | TRAA      |    0.822    |
 *   | TAAU 0.66 |    0.371    |
 *
 * That MSAA and no-AA agree to three decimal places is the whole argument for this file: coverage
 * antialiasing cannot touch a shading frequency, and temporal antialiasing only hides it after
 * the fact. Prefiltering the roughness fixes it at the source, and it is the only one of the three
 * that costs nothing per frame.
 *
 * ## Two forms, and when each applies
 *
 * **`specularAntiAliasedRoughness` — Kaplanyan's screen-space normal filtering** (Kaplanyan,
 * Hill, Patney, Lefohn, "Filtering Distributions of Normals for Shading Antialiasing", HPG 2016).
 * It estimates the normal's variance inside one pixel from the screen-space derivatives of the
 * SHADING normal — the one the normal map has already perturbed — and adds that variance to the
 * GGX alpha in quadrature. This is the form to reach for: it needs nothing from the asset, it
 * scales automatically with distance and grazing angle, and it is a drop-in for the material's
 * `roughnessNode`.
 *
 * **`toksvigRoughness` — the classic Toksvig factor** (Toksvig, "Mipmapping Normal Maps", 2005).
 * It reads the LENGTH of a mip-averaged normal: averaging unit normals shortens the result, and
 * how much shorter says how spread out they were. Exact where the averaging really happened —
 * i.e. where a mip chain of the normal map exists and is being sampled — and unavailable where it
 * did not. Offered because a baked micro-normal with mips is the case where it beats the
 * screen-space estimate, and because it is the form the punch list names.
 *
 * ## Where this is applied, and why it is not applied here
 *
 * Roughness is a material property and this repository puts materials in `packages/core/src/
 * material/`, which this file's author does not own. `render/` can offer the node; only the
 * material can install it — that division is still why the node lives in this file.
 *
 * ✅ It is installed. `material/SkinMaterial.js` reads
 * `material.roughnessNode = specularAntiAliasing ? filteredRoughness( roughness ) : roughness`,
 * which is the diff request this section used to point at, resolved. See
 * `docs/OPEN-REQUESTS.md` REQ-026. `post.html?specaa=1` still runs the experiment from the page,
 * so the number in the table above keeps its partner now that the fix is the default.
 */

import { float, Fn, normalView, vec3 } from 'three/tsl';

/**
 * Kaplanyan's screen-space variance, as a multiplier on the filter width.
 *
 * 0.5 is the paper's own `SIGMA` for a pixel-wide box: the derivative already spans one pixel, so
 * the half-width is what the variance of a symmetric filter over that span wants. Exposed rather
 * than inlined because a supersampled or temporally-jittered pass genuinely covers a wider
 * footprint and would want more.
 */
export const DEFAULT_VARIANCE_SCALE = 0.5;

/**
 * Ceiling on the added alpha-squared, from the same paper (`THRESHOLD`).
 *
 * Without it, a silhouette — where the normal swings through a large angle inside one pixel —
 * drives roughness to 1 and draws a dull grey rim around every curved object. 0.18 is the
 * published value and it is a measurement of where that artefact starts, not a taste setting.
 */
export const DEFAULT_VARIANCE_CEILING = 0.18;

/**
 * Roughness with the sub-pixel normal variance folded in.
 *
 * GGX alpha is `perceptualRoughness^2`, variances add, so the filtered alpha is
 * `sqrt( alpha^2 + kernelAlpha^2 )` and the perceptual roughness that produces it is the square
 * root of that. Doing the arithmetic in alpha rather than in perceptual roughness matters: the
 * two differ by a square, and adding variances in the wrong space over-roughens smooth materials
 * and under-roughens rough ones.
 *
 * @param {Node<float>} perceptualRoughness - The material's roughness, 0..1.
 * @param {Node<vec3>} [shadingNormal=normalView] - The normal AFTER the normal map, in any
 *   consistent space. View space is the default because that is what the G-buffer stores.
 * @param {Object} [options]
 * @param {number} [options.varianceScale=0.5]
 * @param {number} [options.ceiling=0.18]
 * @returns {Node<float>} A perceptual roughness, ready to hand to `material.roughnessNode`.
 */
export const specularAntiAliasedRoughness = /*@__PURE__*/ Fn( ( [ perceptualRoughness, shadingNormal, varianceScale, ceiling ] ) => {

    const normal = vec3( shadingNormal );

    const dx = normal.dFdx();
    const dy = normal.dFdy();

    // The paper's variance estimate: half the summed squared derivative length, i.e. the mean
    // squared deviation of the normal across the pixel.
    const variance = dx.dot( dx ).add( dy.dot( dy ) ).mul( varianceScale );

    const kernelAlphaSquared = variance.mul( 2 ).min( ceiling );

    const alpha = perceptualRoughness.mul( perceptualRoughness );

    return alpha.mul( alpha ).add( kernelAlphaSquared ).sqrt().sqrt();

} );

/**
 * Convenience wrapper with this project's defaults bound, because a call site that has to repeat
 * two constants will eventually get one of them wrong.
 *
 * @param {Node<float>} perceptualRoughness
 * @param {Node<vec3>} [shadingNormal]
 */
export function filteredRoughness( perceptualRoughness, shadingNormal = normalView ) {

    return specularAntiAliasedRoughness(
        perceptualRoughness,
        shadingNormal,
        float( DEFAULT_VARIANCE_SCALE ),
        float( DEFAULT_VARIANCE_CEILING )
    );

}

/**
 * The classic Toksvig factor, for the case where a mip-averaged normal is actually available.
 *
 * `averagedNormalLength` is `length()` of the normal sampled from a MIPPED normal map without
 * renormalising — the shortening IS the signal. 1 means every normal in the footprint agreed and
 * nothing is filtered; 0.9 means they were spread and the lobe should widen to match.
 *
 * Toksvig works in Blinn-Phong specular power, so this converts both ways using the usual
 * `power = 2 / alpha^2 - 2` correspondence. The round trip is exact, not an approximation, so the
 * only approximation here is Toksvig's own.
 *
 * @param {Node<float>} perceptualRoughness
 * @param {Node<float>} averagedNormalLength - 0..1.
 * @returns {Node<float>}
 */
export const toksvigRoughness = /*@__PURE__*/ Fn( ( [ perceptualRoughness, averagedNormalLength ] ) => {

    const alpha = perceptualRoughness.mul( perceptualRoughness ).max( 1e-4 );
    const power = float( 2 ).div( alpha.mul( alpha ) ).sub( 2 ).max( 1e-4 );

    // ft = |N| / ( |N| + s * ( 1 - |N| ) ), the factor the specular power is scaled by.
    const length = averagedNormalLength.clamp( 1e-4, 1 );
    const factor = length.div( length.add( power.mul( length.oneMinus() ) ) );

    const filteredPower = power.mul( factor ).max( 1e-4 );

    return float( 2 ).div( filteredPower.add( 2 ) ).sqrt().sqrt();

} );

// --- CPU mirrors, so the selftest can assert the arithmetic without a GPU --------------------

/**
 * `specularAntiAliasedRoughness` evaluated on the CPU.
 *
 * The mirror exists because the properties that matter here are algebraic — zero variance must
 * be the identity, variance must only ever roughen, and the ceiling must bind — and a GPU is not
 * needed to state any of them. Keep it in step with the node above; the selftest checks the two
 * agree on the identity case, which is the one that catches a divergence.
 *
 * @param {number} perceptualRoughness
 * @param {number} variance - The `dx.dx + dy.dy` sum, already scaled.
 * @param {number} [ceiling=0.18]
 */
export function filteredRoughnessValue( perceptualRoughness, variance, ceiling = DEFAULT_VARIANCE_CEILING ) {

    const kernelAlphaSquared = Math.min( variance * 2, ceiling );
    const alpha = perceptualRoughness * perceptualRoughness;

    return Math.pow( alpha * alpha + kernelAlphaSquared, 0.25 );

}

/** `toksvigRoughness` evaluated on the CPU. See `filteredRoughnessValue`. */
export function toksvigRoughnessValue( perceptualRoughness, averagedNormalLength ) {

    const alpha = Math.max( perceptualRoughness * perceptualRoughness, 1e-4 );
    const power = Math.max( 2 / ( alpha * alpha ) - 2, 1e-4 );

    const length = Math.min( Math.max( averagedNormalLength, 1e-4 ), 1 );
    const factor = length / ( length + power * ( 1 - length ) );

    const filteredPower = Math.max( power * factor, 1e-4 );

    return Math.pow( 2 / ( filteredPower + 2 ), 0.25 );

}
