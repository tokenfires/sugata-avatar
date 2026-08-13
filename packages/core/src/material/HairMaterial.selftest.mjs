/**
 * Gate for `material/HairMaterial.js` — punch-list 3.5.
 *
 * Two halves, and this file says which is which because only one of them is worth much.
 *
 * The WEAK HALF is arithmetic. Every closed form in `HairMaterial.js` has a JavaScript mirror and
 * the properties asserted against those mirrors are ones that, if they broke, would produce a
 * plausible picture rather than an obvious failure: a dual band that is really one wide band, a
 * secondary lobe that takes the light's colour instead of the hair's, an `η′` fit off by a percent,
 * a contrast figure read in the wrong transfer domain.
 *
 * The STRONG HALF renders `alive.html?hair=1` on a real GPU and reads pixels back. Every number in
 * the report below was measured by this file in the session that ran it. 🎯 THE HAIR MASK IS ITSELF
 * A MEASUREMENT and it is the thing that makes the rest of the rendered half trustworthy: hair
 * pixels are the pixels on which `?hairdefect=unit-bsdf` and the shipped BSDF DISAGREE. The two
 * arms share geometry, alpha coverage, shadow casting and every other material flag, so a pixel
 * that moves between them can only be a hair texel. The obvious mask — diff against the no-hair
 * plate — was tried first and was 25% of frame of which most was SKIN, because hair casts shadows
 * and the temporal resolve smears an edge; every percentile above p90 then read identically in
 * every arm, which is exactly what a mask that is measuring the wrong pixels looks like.
 *
 *   DUAL BAND     3.5's whole ask. Measured TWICE and separately, never as a sum:
 *                 on the CPU, as the distance between the two lobes' peaks in Karis' own variable
 *                 and in degrees of strand inclination; and on the PLATE, as the distance in
 *                 PIXELS between the brightest row of `?hairlobes=r` and the brightest row of
 *                 `?hairlobes=trt` down a band of the side hair mass, where the strand runs
 *                 vertically in screen space. A gate that only ever saw R+TRT could not tell a
 *                 dual band from one wide one — the mistake specular occlusion nearly shipped with.
 *
 *   COLOUR SPLIT  R is achromatic and TRT is not. This is the mechanism behind the reference's
 *                 measured warm band at hue 36° (the hair) and cool band at hue 176° (the teal
 *                 practicals), and it is asserted on the mirror because a plate cannot separate
 *                 the two lobes' hues without lights of two different colours in two known places.
 *
 *   CONTRAST      Specular-to-albedo, on the rendered plate, in the ENCODED domain the look spec
 *                 was measured in — and the LINEAR figure beside it, because a build that writes
 *                 `specular = albedo × 10` into a linear shader lands six to nine times too dim.
 *                 🔴 THIS ONE FAILS ON THE SHIPPED BUILD AND THE FAILURE IS THE RESULT. See the
 *                 diagnosis printed by the section itself.
 *
 *   ENERGY        REQ-061's number: the share of frame above 0.90 luma and above the bloom
 *                 threshold, with hair and without. Reported, not tuned to.
 *
 *   ANISOTROPY    🚩 `?hairdefect=constant-tangent` feeds every fragment a fixed VIEW-space strand
 *                 direction. The plate stays entirely plausible — dark hair, visible groom — and
 *                 the band measurement collapses. That is the rejection proof for the one claim
 *                 this material cannot make any other way: that the highlight follows the CARD.
 *
 *   COST          GPU timestamps at 1080p, hair on and off. Wall-clock instruments on this page are
 *                 non-measurements: the step helper ends in two rAF waits and every arm reads
 *                 exactly 16.700 ms of vsync.
 *
 * A measurement outside its range is a FAIL and exits non-zero. It is not grounds for widening the
 * range. Where a range is not met, the check FAILS and says by how much.
 *
 * Usage:  node "packages/core/src/material/HairMaterial.selftest.mjs"
 */

import {
    HAIR_CONTRAST,
    HAIR_DEFAULTS,
    HAIR_F0,
    HAIR_IOR,
    azimuthalValues,
    encodedToLinear,
    fresnelValue,
    hairScatteringValue,
    longitudinalValue,
    modifiedIorValue,
    rootOcclusionValue,
    scatterValue,
    sideVisibilityValue,
    solidAngleValue,
    transmittedOffsetValue
} from './HairMaterial.js';

let checks = 0;
let failures = 0;

function report( name, passed, detail ) {

    checks += 1;
    if ( passed !== true ) failures += 1;
    console.log( `${ passed ? 'PASS' : 'FAIL' }  ${ name }\n      ${ detail }` );

}

/** The hair's own linear base colour, from the published hex, computed rather than typed. */
const BASE_COLOUR = [ 0x15, 0x0F, 0x17 ].map( ( byte ) => encodedToLinear( byte / 255 ) );

/**
 * 🎯 THE CEILING THE WHOLE ROUND TURNS ON: the largest value the SHIPPED combination of terms can
 * take anywhere on the sphere, on a `#150F17` fibre.
 *
 * Shipped means all of it — R, TT, TRT, slide 39's multiple-scattering fake, and slide 47's
 * occlusion over the three reflective terms — evaluated exactly as `HairLightingModel.scatter`
 * assembles them, and searched over the three angles that matter: the view's inclination to the
 * strand, the light's inclination, and the azimuth between them. Nothing here is a render; it is
 * the mirror functions this file already asserts elsewhere, so it is only as good as they are.
 *
 * ⚠️ The previous version of this number sat inline in the CONTRAST section, swept θi ALONE at
 * φ = 0 with the view fixed perpendicular to the strand, and summed R + TT + TRT while omitting
 * the fake — one line through a three-parameter space, missing the term that carries roughly half
 * the peak. It reported 0.0182 sr⁻¹. Re-derived here over the sphere and over the shipped
 * combination it is above 0.03, so every "factor of N" quoted against 0.0182 in rounds 13 and 14
 * was a property of that sweep and does not reproduce.
 */
const closedFormPeak = ( () => {

    const tangent = [ 1, 0, 0 ];
    const dot3 = ( a, b ) => a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
    let best = { total: 0 };

    for ( let thetaR = 0; thetaR <= 70; thetaR += 5 ) {

        const view = thetaR * Math.PI / 180;
        const toView = [ Math.sin( view ), 0, Math.cos( view ) ];
        const perpendicular = toView.map( ( v, i ) => v - tangent[ i ] * dot3( tangent, toView ) );
        const scale = Math.hypot( ...perpendicular );
        const fakeNormal = perpendicular.map( ( v ) => v / scale );

        for ( let thetaI = - 89; thetaI <= 89; thetaI += 1 ) {

            const inclination = thetaI * Math.PI / 180;

            for ( let phi = 0; phi <= 180; phi += 1 ) {

                const azimuth = phi * Math.PI / 180;
                const toLight = [ Math.sin( inclination ),
                    Math.cos( inclination ) * Math.sin( azimuth ),
                    Math.cos( inclination ) * Math.cos( azimuth ) ];

                const lobes = hairScatteringValue( tangent, toLight, toView, BASE_COLOUR );
                const fake = scatterValue( dot3( fakeNormal, toLight ), BASE_COLOUR, 1 );
                const occlusion = sideVisibilityValue( dot3( toLight, toView ) );

                for ( let channel = 0; channel < 3; channel ++ ) {

                    const total = ( lobes.r[ channel ] + lobes.trt[ channel ] + fake[ channel ] ) *
                        occlusion + lobes.tt[ channel ];

                    if ( total > best.total ) best = { total, thetaI, phi, thetaR, channel,
                        r: lobes.r[ channel ], trt: lobes.trt[ channel ], scatter: fake[ channel ] };

                }

            }

        }

    }

    return best;

} )();

// ==============================================================================================
// THE WEAK HALF — arithmetic, on the CPU mirrors
// ==============================================================================================

console.log( '\n--- the optical constants, derived rather than typed --------------------------\n' );

{
    // Marschner Table 1, page 8, first row: η = 1.55. Everything optical in the file hangs off it,
    // and a literal F0 would be a place the two could silently disagree.
    const expected = Math.pow( ( 1 - 1.55 ) / ( 1 + 1.55 ), 2 );

    report(
        'F0 is derived from η rather than typed',
        HAIR_IOR === 1.55 && Math.abs( HAIR_F0 - expected ) < 1e-12,
        `η ${ HAIR_IOR }, F0 ${ HAIR_F0.toFixed( 6 ) } (= ((1−η)/(1+η))² = ${ expected.toFixed( 6 ) })`
    );

    // Fresnel must reach 1 at grazing, because that is the only thing that makes the primary band
    // survive on hair whose albedo is 0.006. A Schlick that bottoms out at F0 everywhere would
    // produce a highlight 20x too dim and would look like "the hair is a bit flat".
    report(
        'Schlick runs from F0 at normal incidence to 1 at grazing',
        Math.abs( fresnelValue( 1 ) - HAIR_F0 ) < 1e-12 && Math.abs( fresnelValue( 0 ) - 1 ) < 1e-12,
        `F(1) = ${ fresnelValue( 1 ).toFixed( 6 ) }, F(0.5) = ${ fresnelValue( 0.5 ).toFixed( 4 ) }, F(0) = ${ fresnelValue( 0 ).toFixed( 6 ) }`
    );
}

console.log( '\n--- η′, against the exact expression it approximates ---------------------------\n' );

{
    // Karis slide 27 claims "error < 0.68%" for `1.19/cosθd + 0.36 cosθd` at η = 1.55. Re-derived
    // here against `√(η² − sin²θd)/cosθd` rather than believed, because a wrong constant in this
    // fit puts the TT lobe in the wrong PLACE rather than removing it, which is invisible.
    const exact = ( thetaD ) => Math.sqrt( HAIR_IOR * HAIR_IOR - Math.pow( Math.sin( thetaD ), 2 ) ) / Math.cos( thetaD );

    let worst = 0;
    let worstAt = 0;

    for ( let degrees = 0; degrees <= 60; degrees += 0.25 ) {

        const thetaD = degrees * Math.PI / 180;
        const relative = Math.abs( modifiedIorValue( Math.cos( thetaD ) ) - exact( thetaD ) ) / exact( thetaD );

        if ( relative > worst ) { worst = relative; worstAt = degrees; }

    }

    const row = [ 0, 15, 30, 45, 60 ].map( ( degrees ) => {

        const thetaD = degrees * Math.PI / 180;
        const relative = Math.abs( modifiedIorValue( Math.cos( thetaD ) ) - exact( thetaD ) ) / exact( thetaD );

        return `${ degrees }° ${ ( relative * 100 ).toFixed( 3 ) }%`;

    } ).join( ', ' );

    report(
        'the slide-27 fit holds its published 0.68% over θd 0–60°',
        worst < 0.0068,
        `max ${ ( worst * 100 ).toFixed( 4 ) }% at θd ${ worstAt }°  —  ${ row }`
    );
}

console.log( '\n--- M_p, and the variable it is a function of ----------------------------------\n' );

{
    // 🚩 THE CONVERSION NOBODY WRITES DOWN. Karis' longitudinal argument is `sinθi + sinθr`;
    // Marschner's is the half angle θh. They are related EXACTLY by `sinθi + sinθr = 2 cosθd sinθh`,
    // and that identity is what licenses `α_Karis = 2 sin α_Marschner` and `β_Karis = 2 β_Marschner`.
    // Asserted as an identity over a grid rather than as prose, because every per-lobe number in
    // `HAIR_DEFAULTS` is a conversion through it and a factor of two here authors every band half
    // as shifted and twice as tight.
    let worst = 0;

    for ( let i = - 70; i <= 70; i += 5 ) {

        for ( let r = - 70; r <= 70; r += 5 ) {

            const thetaI = i * Math.PI / 180;
            const thetaR = r * Math.PI / 180;
            const karis = Math.sin( thetaI ) + Math.sin( thetaR );
            const marschner = 2 * Math.cos( ( thetaR - thetaI ) / 2 ) * Math.sin( ( thetaI + thetaR ) / 2 );

            worst = Math.max( worst, Math.abs( karis - marschner ) );

        }

    }

    report(
        'sinθi + sinθr = 2 cosθd sinθh exactly, which is what converts Marschner\'s α and β',
        worst < 1e-12,
        `worst |Karis − Marschner| over a 29 x 29 grid of ±70° = ${ worst.toExponential( 2 ) }`
    );

    // The Gaussian peaks where its argument equals the shift. If it did not, every lobe would sit
    // at the wrong inclination and the two bands would still be two bands — a plausible picture.
    let peakWorst = 0;

    for ( const shift of [ - 0.35, - 0.26, 0, 0.26, 0.52 ] ) {

        let best = - Infinity;
        let bestAt = 0;

        for ( let s = - 2; s <= 2; s += 0.001 ) {

            const value = longitudinalValue( s, 0, shift, 0.26 );
            if ( value > best ) { best = value; bestAt = s; }

        }

        peakWorst = Math.max( peakWorst, Math.abs( bestAt - shift ) );

    }

    report(
        'M_p peaks exactly where sinθi + sinθr equals its shift',
        peakWorst < 2e-3,
        `worst |argmax − α| over five shifts = ${ peakWorst.toFixed( 5 ) } (sweep step 0.001)`
    );

    // 🚩 A TIGHTER LOBE IS A BRIGHTER LOBE, because of the 1/(β√2π). That is the whole reason one
    // formula produces a sharp bright primary and a broad dim secondary, and a caller who widens β
    // expecting only a wider band has misread it.
    const tight = longitudinalValue( 0, 0, 0, 0.13 );
    const broad = longitudinalValue( 0, 0, 0, 0.52 );

    report(
        'the normalisation makes a tighter lobe brighter, which is where the band contrast comes from',
        Math.abs( tight / broad - 4 ) < 1e-9,
        `β 0.13 peaks at ${ tight.toFixed( 4 ) }, β 0.52 at ${ broad.toFixed( 4 ) } — exactly 4x, the β ratio`
    );
}

console.log( '\n--- THE DUAL BAND, on the mirror ------------------------------------------------\n' );

{
    // The geometry: a strand along +x, the camera along +z, the light swept through the plane that
    // contains both. That sweep is exactly a sweep of the LONGITUDINAL angle, which is the axis the
    // two bands are separated along, so the two peaks in it ARE the two bands.
    const tangent = [ 1, 0, 0 ];
    const toView = [ 0, 0, 1 ];

    const rows = [];

    for ( let degrees = - 89; degrees <= 89; degrees += 0.25 ) {

        const angle = degrees * Math.PI / 180;
        const toLight = [ Math.sin( angle ), 0, Math.cos( angle ) ];
        const scattering = hairScatteringValue( tangent, toLight, toView, BASE_COLOUR );

        rows.push( {
            degrees,
            r: scattering.r[ 1 ],
            tt: scattering.tt[ 1 ],
            trt: scattering.trt[ 1 ],
            sinSum: scattering.geometry.sinThetaI + scattering.geometry.sinThetaR
        } );

    }

    const peakOf = ( lobe ) => rows.reduce( ( best, row ) => row[ lobe ] > best[ lobe ] ? row : best );

    const peakR = peakOf( 'r' );
    const peakTRT = peakOf( 'trt' );
    const peakTT = peakOf( 'tt' );

    const separationDegrees = peakTRT.degrees - peakR.degrees;
    const separationSinSum = peakTRT.sinSum - peakR.sinSum;

    console.log( `      lobe   peak at    value        sinθi+sinθr` );
    for ( const [ name, row, key ] of [ [ 'R  ', peakR, 'r' ], [ 'TT ', peakTT, 'tt' ], [ 'TRT', peakTRT, 'trt' ] ] ) {

        console.log( `      ${ name }   ${ String( row.degrees ).padStart( 7 ) }°  ${ row[ key ].toExponential( 3 ) }   ${ row.sinSum.toFixed( 4 ) }` );

    }

    // The separation is not a free number: it is α_TRT − α_R, i.e. Marschner's own ratio applied to
    // the one free shift. Asserting it against that identity is what stops somebody "fixing" the
    // band spacing by nudging a lobe off the physics.
    const predicted = HAIR_DEFAULTS.shiftR * HAIR_DEFAULTS.shiftRatioTRT - HAIR_DEFAULTS.shiftR;

    // ⚠️ THE TOLERANCE IS 15% AND IT IS NOT SLACK. The peak of `M_p · N_p` is not the peak of `M_p`:
    // the azimuthal term varies over the same sweep and pulls each product's maximum off its
    // Gaussian's centre. What the α ratio predicts is the separation of the two GAUSSIANS; what is
    // measured here is the separation of the two rendered LOBES, and the two agree to within the
    // pull. Asserting equality to three decimals would be asserting that N_p is constant, which it
    // is not, and it would fail for the right reason on a correct implementation.
    report(
        'THE TWO BANDS ARE SEPARATE, and their separation tracks Marschner\'s α ratio',
        Math.abs( separationSinSum - predicted ) < predicted * 0.15 && separationDegrees > 20,
        `R peaks at ${ peakR.degrees }°, TRT at ${ peakTRT.degrees }° — ${ separationDegrees.toFixed( 1 ) }° apart, ` +
            `${ separationSinSum.toFixed( 4 ) } in Karis' variable against α_TRT − α_R = ${ predicted.toFixed( 4 ) } ` +
            `(${ ( ( separationSinSum / predicted - 1 ) * 100 ).toFixed( 1 ) }%; the azimuthal terms pull each product's ` +
            `maximum off its Gaussian's centre)`
    );

    // 🔴 AND THEY DO NOT RESOLVE IN THE SUM, WHICH IS A FINDING AND NOT A DEFECT. The first version
    // of this check asserted that the sum DIPS between the two peaks, on the assumption that a dual
    // band means two visible maxima. Measured: it does not. On a #150F17 fibre, `C^(0.8/cosθd)` with
    // C ≈ 0.006 attenuates TRT to about a twentieth of R, and R's own tail at TRT's inclination is
    // larger than TRT's peak — so the sum is monotone and the secondary is a SHOULDER, not a second
    // maximum. That is why 3.5's ask has to be met by measuring the two lobes SEPARATELY, and it is
    // why `?hairlobes=` exists.
    //
    // What can be asserted, and is: TRT owns a much larger share of the total where it peaks than
    // where R does. That is the same claim — the second lobe lives somewhere else — stated as
    // something a monotone sum cannot hide.
    const shareAt = ( row ) => row.trt / ( row.r + row.trt );

    report(
        'the two lobes do NOT resolve into two maxima on dark hair, and the secondary is still separable',
        shareAt( peakTRT ) > shareAt( peakR ) * 10,
        `TRT's share of R+TRT is ${ ( shareAt( peakR ) * 100 ).toFixed( 3 ) }% at the primary's inclination and ` +
            `${ ( shareAt( peakTRT ) * 100 ).toFixed( 1 ) }% at its own — ${ ( shareAt( peakTRT ) / shareAt( peakR ) ).toFixed( 0 ) }x.\n` +
        `      The SUM has no dip between them (trough/dimmer-peak = ` +
            `${ ( ( () => { const between = rows.filter( ( row ) => row.degrees > peakR.degrees && row.degrees < peakTRT.degrees );
                const trough = between.reduce( ( best, row ) => ( row.r + row.trt ) < ( best.r + best.trt ) ? row : best );
                return ( trough.r + trough.trt ) / ( peakTRT.r + peakTRT.trt ); } )() ).toFixed( 3 ) }x, i.e. above 1.0), ` +
            `because R's tail at TRT's inclination\n      exceeds TRT's own peak on a fibre this dark. The secondary is a ` +
            `SHOULDER, which is exactly why 3.5 has to be gated on two\n      plates rather than on one.`
    );

    // β_TRT = 2 β_R is what makes the secondary BROAD, which is the look spec's own adjective for
    // it. Measured as a full width rather than read off the parameter, so the check survives a
    // change of parameterisation.
    const widthOf = ( lobe, peak ) => {

        const half = peak[ lobe ] / 2;
        const above = rows.filter( ( row ) => row[ lobe ] >= half );

        return above[ above.length - 1 ].degrees - above[ 0 ].degrees;

    };

    const widthR = widthOf( 'r', peakR );
    const widthTRT = widthOf( 'trt', peakTRT );

    report(
        'the secondary band is measurably BROADER than the primary, from β_TRT = 2 β_R',
        widthTRT > widthR * 1.5,
        `full width at half maximum: R ${ widthR.toFixed( 1 ) }°, TRT ${ widthTRT.toFixed( 1 ) }° ` +
            `(${ ( widthTRT / widthR ).toFixed( 2 ) }x). The look spec's eyeballed 0.45/0.25 = 1.8x ` +
            `against Marschner's 2x is the only part of §5's lobe table that survives.`
    );
}

console.log( '\n--- the colour split, which is what makes the two bands DIFFERENT colours -------\n' );

{
    // R never enters the fibre, so `A(0,h)` is pure Fresnel and the primary band is the LIGHT's
    // colour. TRT crosses the pigment and takes the HAIR's. Measured on the reference in the
    // research round: warm band hue 36° (the hair), cool band hue 176° (the teal practicals).
    const cosPhi = 0.6;
    const cosThetaD = 0.9;
    const dotIncidentView = 0.5;

    const perChannel = BASE_COLOUR.map( ( channel ) => azimuthalValues( cosPhi, cosThetaD, dotIncidentView, channel ) );

    const spread = ( key ) => {

        const values = perChannel.map( ( entry ) => entry[ key ] );

        return ( Math.max( ...values ) - Math.min( ...values ) ) / Math.max( ...values );

    };

    report(
        'N_R is ACHROMATIC to floating point, so the primary band takes the light\'s colour',
        spread( 'r' ) < 1e-12,
        `three channels of N_R: ${ perChannel.map( ( e ) => e.r.toFixed( 8 ) ).join( ', ' ) }`
    );

    report(
        'N_TRT is CHROMATIC, so the secondary band takes the hair\'s colour',
        spread( 'trt' ) > 0.05,
        `three channels of N_TRT: ${ perChannel.map( ( e ) => e.trt.toExponential( 3 ) ).join( ', ' ) } ` +
            `— ${ ( spread( 'trt' ) * 100 ).toFixed( 1 ) }% channel spread`
    );

    // And the chromaticity must follow the HAIR, not be some third colour. `C^k` preserves the
    // ordering of the channels and exaggerates it, so the darkest channel stays darkest.
    const order = ( values ) => values.map( ( _, index ) => index ).sort( ( a, b ) => values[ a ] - values[ b ] ).join( '' );

    report(
        'the secondary band\'s channel ORDER is the base colour\'s, so it reads as this hair',
        order( perChannel.map( ( e ) => e.trt ) ) === order( BASE_COLOUR ),
        `base colour order ${ order( BASE_COLOUR ) }, N_TRT order ${ order( perChannel.map( ( e ) => e.trt ) ) } ` +
            `(0 = R, 1 = G, 2 = B; the published #150F17 is violet at hue 285°)`
    );
}

console.log( '\n--- the TT offset and its azimuthal behaviour -----------------------------------\n' );

{
    // h_TT must stay inside the fibre. It is a normalised offset across a unit circle, so |h| > 1
    // is a ray that missed, and `√(1 − h²)` under the Fresnel would go imaginary — in a shader,
    // NaN. Slide 26's approximation drops the sign of h, so the bound is what has to be checked.
    let worst = 0;

    for ( let cosPhi = - 1; cosPhi <= 1; cosPhi += 0.01 ) {

        for ( const cosThetaD of [ 0.2, 0.5, 0.8, 1 ] ) {

            worst = Math.max( worst, transmittedOffsetValue( cosPhi, cosThetaD ) );

        }

    }

    report(
        'the slide-26 h_TT approximation stays inside the fibre over the whole azimuth',
        worst <= 1.0,
        `max h_TT over cosφ ∈ [−1,1] x four θd = ${ worst.toFixed( 4 ) } (the fibre wall is 1.0)`
    );

    // TT is a FORWARD-scattering lobe: it is light that went through the hair, so it must be at its
    // brightest when the light is behind the strand and near zero when it is beside the camera.
    // That is why slide 47 removes it from the environment path — an SH probe has no "behind".
    const forward = azimuthalValues( - 1, 0.95, - 1, BASE_COLOUR[ 1 ] ).tt;
    const backward = azimuthalValues( 1, 0.95, 1, BASE_COLOUR[ 1 ] ).tt;

    report(
        'TT is a BACK-LIGHT lobe — orders of magnitude brighter in forward scattering',
        forward > backward * 100,
        `cosφ = −1 (light behind) ${ forward.toExponential( 3 ) }, cosφ = +1 (light at the camera) ` +
            `${ backward.toExponential( 3 ) } — ${ ( forward / backward ).toExponential( 1 ) }x`
    );
}

console.log( '\n--- the two transfer domains, and the misreading that costs six to nine times ----\n' );

{
    // 🚩 THE MOST EXPENSIVE MISREADING AVAILABLE IN 3.5. The punch-list's "~10:1" is an ENCODED
    // ratio. This check exists to make the two domains describe the SAME band, and — the half that
    // makes it able to fail — to require them to be measurably DIFFERENT numbers, because a check
    // both readings passed would not distinguish them.
    const baseEncoded = 0.2126 * ( 0x15 / 255 ) + 0.7152 * ( 0x0F / 255 ) + 0.0722 * ( 0x17 / 255 );
    const baseLinear = 0.2126 * BASE_COLOUR[ 0 ] + 0.7152 * BASE_COLOUR[ 1 ] + 0.0722 * BASE_COLOUR[ 2 ];

    const encodedRatios = HAIR_CONTRAST.bandEncoded.map( ( level ) => level / baseEncoded );
    const linearRatios = HAIR_CONTRAST.bandEncoded.map( ( level ) => encodedToLinear( level ) / baseLinear );

    report(
        'the published #150F17 luma is re-derived here and matches what the file carries',
        Math.abs( baseEncoded - HAIR_CONTRAST.baseEncodedLuma ) < 5e-4 &&
            Math.abs( baseLinear - HAIR_CONTRAST.baseLinearLuma ) < 5e-6,
        `#150F17: encoded ${ baseEncoded.toFixed( 4 ) } (spec says 0.067 — the third decimal differs), ` +
            `linear ${ baseLinear.toFixed( 6 ) }`
    );

    report(
        'the "~10:1" figure is an ENCODED ratio and the file\'s band reproduces it',
        encodedRatios.every( ( ratio, index ) => Math.abs( ratio - HAIR_CONTRAST.encodedRatio[ index ] ) < 0.02 ),
        `encoded band ${ HAIR_CONTRAST.bandEncoded.join( ' / ' ) } over ${ baseEncoded.toFixed( 4 ) } = ` +
            `${ encodedRatios.map( ( r ) => r.toFixed( 2 ) ).join( ' : ' ) }`
    );

    report(
        'the SAME band in LINEAR light is six to nine times larger, so the domain has to be stated',
        linearRatios.every( ( ratio, index ) => Math.abs( ratio / HAIR_CONTRAST.linearRatio[ index ] - 1 ) < 0.01 ) &&
            linearRatios[ 1 ] > encodedRatios[ 1 ] * 6,
        `linear ${ linearRatios.map( ( r ) => r.toFixed( 1 ) ).join( ' : ' ) } against encoded ` +
            `${ encodedRatios.map( ( r ) => r.toFixed( 2 ) ).join( ' : ' ) } — a shader that multiplies by 10 ` +
            `lands ${ ( linearRatios[ 1 ] / 10 ).toFixed( 1 ) }x too dim`
    );

    // Root occlusion, restated the same way. The punch-list's 0.35–0.50 is an encoded darkening;
    // the shipped multiplier is linear. A build that types 0.40 into the shader darkens the root by
    // an encoded 0.683 — roughly half what the reference plate shows.
    const encodedOfShipped = Math.pow( HAIR_DEFAULTS.rootOcclusion, 1 / 2.4 );
    const naiveEncoded = Math.pow( 0.40, 1 / 2.4 );

    report(
        'the shipped root occlusion lands inside the published 0.35–0.50 ENCODED band',
        encodedOfShipped > 0.35 && encodedOfShipped < 0.50 && naiveEncoded > 0.55,
        `linear ${ HAIR_DEFAULTS.rootOcclusion } → encoded ${ encodedOfShipped.toFixed( 4 ) }; the naive ` +
            `linear 0.40 → encoded ${ naiveEncoded.toFixed( 4 ) }, outside the band. Reference bound: ` +
            `ponytail under the tie is 0.368 encoded / 0.188 linear against mid-shaft.`
    );

    // And the ramp has to be a ramp: full occlusion at the scalp, none past the ramp length.
    report(
        'the root ramp is monotone, starts at the authored multiplier and reaches 1',
        Math.abs( rootOcclusionValue( 0 ) - HAIR_DEFAULTS.rootOcclusion ) < 1e-9 &&
            Math.abs( rootOcclusionValue( 1 ) - 1 ) < 1e-9 &&
            rootOcclusionValue( 0.05 ) > rootOcclusionValue( 0 ) &&
            rootOcclusionValue( 0.10 ) > rootOcclusionValue( 0.05 ),
        `root ${ rootOcclusionValue( 0 ).toFixed( 4 ) }, 5% ${ rootOcclusionValue( 0.05 ).toFixed( 4 ) }, ` +
            `10% ${ rootOcclusionValue( 0.10 ).toFixed( 4 ) }, 15% ${ rootOcclusionValue( 0.15 ).toFixed( 4 ) }, ` +
            `tip ${ rootOcclusionValue( 1 ).toFixed( 4 ) }`
    );
}

console.log( '\n--- the rect-area path\'s solid angle -------------------------------------------\n' );

{
    // The rect-area path replaces LTC with an exact solid angle, so the solid angle had better be
    // exact. Two known answers: a plane at unit distance stretched to infinity is a hemisphere, and
    // a small square is its area over the square of its distance.
    const huge = 1e5;
    const hemisphere = solidAngleValue( [ [ - huge, - huge, 1 ], [ huge, - huge, 1 ], [ huge, huge, 1 ], [ - huge, huge, 1 ] ] );

    report(
        'an infinite plane subtends exactly 2π',
        Math.abs( hemisphere - 2 * Math.PI ) < 1e-4,
        `${ hemisphere.toFixed( 6 ) } against 2π = ${ ( 2 * Math.PI ).toFixed( 6 ) }`
    );

    const small = solidAngleValue( [ [ - 0.05, - 0.05, 1 ], [ 0.05, - 0.05, 1 ], [ 0.05, 0.05, 1 ], [ - 0.05, 0.05, 1 ] ] );

    report(
        'a small square subtends its area over its distance squared',
        Math.abs( small - 0.01 ) / 0.01 < 0.005,
        `0.1 x 0.1 at d = 1: ${ small.toFixed( 6 ) } sr against the small-angle 0.010000 ` +
            `(${ ( ( small / 0.01 - 1 ) * 100 ).toFixed( 3 ) }% — the exact answer is smaller, as it must be)`
    );

    // And it must not depend on the receiver's orientation, which is the difference between a solid
    // angle and a form factor and is the whole reason this path does not apply an N·L.
    const tilted = solidAngleValue( [ [ - 0.05, - 0.05, 1 ], [ 0.05, - 0.05, 1 ], [ 0.05, 0.05, 1 ], [ - 0.05, 0.05, 1 ] ]
        .map( ( corner ) => [ corner[ 0 ], corner[ 1 ] * Math.cos( 0.7 ) - corner[ 2 ] * Math.sin( 0.7 ),
            corner[ 1 ] * Math.sin( 0.7 ) + corner[ 2 ] * Math.cos( 0.7 ) ] ) );

    report(
        'the solid angle is invariant under rotation of the whole configuration',
        Math.abs( tilted - small ) < 1e-9,
        `rotated 40° about x: ${ tilted.toFixed( 8 ) } against ${ small.toFixed( 8 ) }`
    );
}

console.log( '\n--- the card-scale occlusion, and the property that keeps it honest -------------\n' );

{
    // 🚩 AN OCCLUSION THAT CAN EXCEED 1 IS NOT AN OCCLUSION, IT IS A TUNING FACTOR WEARING A NAME.
    // Karis' slide-47 term is `saturate( ωi·ωr + 1 )` and the `saturate` is the whole of what makes
    // it shippable here: it is 1 for every light on the viewer's side of the fragment, so it cannot
    // brighten anything, and it falls to 0 only where a head would be in the way. Asserted as a
    // bound over the interval rather than at three points, because the failure this guards against
    // — somebody dropping the clamp to "recover energy" — is invisible at ωi·ωr = 0 and worth 2x at
    // retro, which is exactly the size of the fudge this round was told not to ship.
    let above = 0;
    let below = 0;
    let onePast = 0;

    for ( let cosine = - 1; cosine <= 1.0001; cosine += 0.001 ) {

        const value = sideVisibilityValue( cosine );

        if ( value > 1 ) above ++;
        if ( value < 0 ) below ++;
        if ( cosine >= 0 && Math.abs( value - 1 ) > 1e-12 ) onePast ++;

    }

    report(
        'slide 47\'s occlusion is an ATTENUATOR: never above 1, never below 0, exactly 1 on the viewer\'s side',
        above === 0 && below === 0 && onePast === 0,
        `over ωi·ωr ∈ [−1, 1] at 0.001: ${ above } samples above 1, ${ below } below 0, ${ onePast } of the ` +
            `ωi·ωr ≥ 0 half not exactly 1.\n      Endpoints: F(−1) = ${ sideVisibilityValue( - 1 ).toFixed( 4 ) } ` +
            `(exact backlight, fully occluded), F(−0.98) = ${ sideVisibilityValue( - 0.98 ).toFixed( 4 ) } (the rim at ` +
            `−168°),\n      F(0) = ${ sideVisibilityValue( 0 ).toFixed( 4 ) } (a light across the view), F(0.74) = ` +
            `${ sideVisibilityValue( 0.74 ).toFixed( 4 ) } (the key at +42°).`
    );
}

console.log( '\n--- anisotropy, on the mirror: the highlight follows the TANGENT ----------------\n' );

{
    // The claim: rotating the strand moves the band. Held against a fixed light and a fixed camera,
    // so the only thing that changes is the fibre direction.
    const toView = [ 0, 0, 1 ];
    const toLight = [ Math.sin( 0.4 ), 0.2, Math.cos( 0.4 ) ];
    const norm = Math.hypot( ...toLight );
    const light = toLight.map( ( component ) => component / norm );

    const responses = [];

    for ( let degrees = 0; degrees < 180; degrees += 2 ) {

        const angle = degrees * Math.PI / 180;
        const tangent = [ Math.cos( angle ), Math.sin( angle ), 0 ];
        const scattering = hairScatteringValue( tangent, light, toView, BASE_COLOUR );

        responses.push( { degrees, value: scattering.total[ 1 ] } );

    }

    const brightest = responses.reduce( ( best, row ) => row.value > best.value ? row : best );
    const dimmest = responses.reduce( ( best, row ) => row.value < best.value ? row : best );

    report(
        'the response depends STRONGLY on the strand direction — this is the anisotropy',
        brightest.value > dimmest.value * 5,
        `over 90 tangent orientations at one fixed light and camera: brightest ${ brightest.value.toExponential( 3 ) } ` +
            `at ${ brightest.degrees }°, dimmest ${ dimmest.value.toExponential( 3 ) } at ${ dimmest.degrees }° ` +
            `— ${ ( brightest.value / dimmest.value ).toFixed( 1 ) }x. An isotropic lobe would read 1.0x here.`
    );
}

// ==============================================================================================
// THE STRONG HALF — rendered pixels, on a real GPU
// ==============================================================================================
//
// 🎯 Every reading below is measured on `alive.html` at 900x1200, converged to frame 6 with a ZERO
// simulation step. The step has to be zero: `?freeze` stops the motion stack, but a non-zero step
// would still advance the temporal resolve's convergence differently between arms.
//
// The DUAL BAND and the RED PROOF are taken on `&aa=msaa&grade=0` — the deterministic forward path
// — because they are differences of a few code values between arms and the temporal resolve
// smears them. The CONTRAST and the ENERGY are taken on the SHIPPED path, grade and all, because
// both are compared against numbers measured on a tone-mapped reference plate and reading them off
// an ungraded buffer would be comparing two different transfer functions.

console.log( '\n--- the rendered gate ------------------------------------------------------------\n' );

const probe = await import( '../render/MotionProbe.mjs' );

const WIDTH = 900;
const HEIGHT = 1200;
const FRAME = 6;

/**
 * The side hair mass, placed by eye on the rendered plate and stated in pixels rather than derived
 * from bones — the same real limitation `GTAO.selftest.mjs` records about its crease boxes. It is
 * the one region of this groom where the cards hang top-to-bottom in SCREEN space, which is what
 * makes a row index a position along the strand and therefore what makes a band separation in
 * pixels mean anything at all.
 */
const STRAND_BAND = { x: 470, y: 120, width: 240, height: 640 };

let server = null;
let browser = null;
const plates = {};

const FORWARD = '&aa=msaa&grade=0';

const ARMS = {
    // The deterministic forward path, for the band geometry and the red proof.
    zero:       `${ FORWARD }&hair=1&hairlobes=&hairscatter=0`,
    unit:       `${ FORWARD }&hair=1&hairdefect=unit-bsdf`,
    primary:    `${ FORWARD }&hair=1&hairlobes=r&hairscatter=0`,
    secondary:  `${ FORWARD }&hair=1&hairlobes=trt&hairscatter=0`,
    defect:     `${ FORWARD }&hair=1&hairlobes=r&hairscatter=0&hairdefect=constant-tangent`,

    // 🎯 THE HEADLAMP ARM, and it exists because of a finding rather than for convenience. TRT's
    // azimuthal distribution is `exp(17 cosφ − 16.78)`: it is a RETROREFLECTIVE lobe, appreciable
    // only where the light is azimuthally near the view. That is real optics — it is why hair
    // haloes toward a light source — and it means the shipped portrait rig, whose four panels sit
    // at +42°, −52°, −168° and +166°, contains almost no geometry where TRT can fire. The secondary
    // band is therefore unmeasurable on the shipped plate, and measuring it needs a light on the
    // camera axis. `?ov=` moves the key there and nothing else; the camera stands 12° off the
    // facing axis (`CAMERA_AZIMUTH_DEGREES`), so that is where the key goes.
    headZero:   `${ FORWARD }&hair=1&hairlobes=&hairscatter=0&ov=key.azimuthDegrees:12`,
    headR:      `${ FORWARD }&hair=1&hairlobes=r&hairscatter=0&ov=key.azimuthDegrees:12`,
    headTRT:    `${ FORWARD }&hair=1&hairlobes=trt&hairscatter=0&ov=key.azimuthDegrees:12`,

    // 🚩 THE PANEL ARM, and it is here because of a defect it found rather than for completeness.
    // `?ov=key.shadowFraction:0` puts ALL of the key's energy into its `RectAreaLight` and removes
    // the co-located shadow-casting `SpotLight` — so this plate has NO punctual light in it at all
    // and everything the hair receives comes down `directRectArea`. The first version of that
    // method masked every panel off through an inverted front-face test, and on this arm the R
    // lobe's mean rise measured EXACTLY ZERO while the shipped plate still looked like dark hair.
    // Nothing else in this file could have caught it: on the shipped rig the `SpotLight` alone
    // produced a plausible band.
    panelZero:  `${ FORWARD }&hair=1&hairlobes=&hairscatter=0&ov=key.shadowFraction:0`,
    panelR:     `${ FORWARD }&hair=1&hairlobes=r&hairscatter=0&ov=key.shadowFraction:0`,

    // The shipped BSDF on the DETERMINISTIC FORWARD path. It exists so the rendered scattering
    // function can be inverted out of the plate — see the effective-BSDF section, which needs
    // `zero`, `unit` and this one in the same transfer domain, and the grade is not one.
    forward:    `${ FORWARD }&hair=1`,

    // The shipped path, for the numbers that are compared against a tone-mapped reference.
    shipped:    '&hair=1',
    plainCard:  '&hair=1&hairbsdf=0',
    bald:       ''
};

try {

    server = await probe.startProbeServer( { port: 5191 } );
    browser = await probe.launchProbeBrowser();

    for ( const [ name, query ] of Object.entries( ARMS ) ) {

        const shot = await probe.capturePlates( {
            browser, baseUrl: server.baseUrl, page: '/alive.html',
            query: `?bare&freeze&seed=1${ query }`,
            width: WIDTH, height: HEIGHT, frames: FRAME, stepSeconds: 0, keep: [ FRAME ]
        } );

        if ( shot.errors.length > 0 ) throw new Error( `${ name }: ${ shot.errors.slice( 0, 2 ).join( ' | ' ) }` );

        plates[ name ] = shot.frames.get( FRAME );

    }

} catch ( error ) {

    report( 'the rendered probe came up on a real GPU', false, `it did not: ${ error.message }` );

}

if ( plates.shipped !== undefined ) {

    const luma = ( plate, x, y ) => probe.lumaAt( plate, x, y );

    /**
     * Rec.709 luma in LINEAR light, which `probe.lumaAt` deliberately does not give: it reads the
     * framebuffer, and on `&grade=0` the framebuffer is an sRGB encode of radiance. Only used where
     * the question is "how much light is this", not "how bright does this look".
     */
    const linearLumaAt = ( plate, x, y ) => {

        const index = ( y * plate.width + x ) * 4;

        return 0.2126 * encodedToLinear( plate.data[ index ] ) +
            0.7152 * encodedToLinear( plate.data[ index + 1 ] ) +
            0.0722 * encodedToLinear( plate.data[ index + 2 ] );

    };

    const percentileOf = ( plate, mask ) => {

        const values = mask.map( ( [ x, y ] ) => luma( plate, x, y ) ).sort( ( a, b ) => a - b );
        const at = ( p ) => values[ Math.min( values.length - 1, Math.floor( p * values.length ) ) ];

        return { p50: at( 0.5 ), p90: at( 0.9 ), p95: at( 0.95 ), p99: at( 0.99 ), max: values[ values.length - 1 ] };

    };

    // --- the mask, which is itself a measurement ------------------------------------------------
    const hairMask = [];

    for ( let y = 0; y < HEIGHT; y ++ ) {

        for ( let x = 0; x < WIDTH; x ++ ) {

            if ( Math.abs( luma( plates.unit, x, y ) - luma( plates.zero, x, y ) ) > 0.01 ) hairMask.push( [ x, y ] );

        }

    }

    report(
        'the hair mask is a MEASUREMENT — the pixels two BSDFs on identical geometry disagree about',
        hairMask.length > 40_000 && hairMask.length < WIDTH * HEIGHT * 0.6,
        `${ hairMask.length.toLocaleString() } px, ${ ( hairMask.length / ( WIDTH * HEIGHT ) * 100 ).toFixed( 2 ) }% of frame. ` +
            'Built from ?hairdefect=unit-bsdf against a zero BSDF: same groom, same alpha coverage, same ' +
            'shadow casting, so a pixel that moves can only be a hair texel. A diff against the BALD plate ' +
            'was tried first and was mostly shadowed SKIN.'
    );

    // --- 🔴 THE SECOND MASK, AND IT EXISTS BECAUSE THE FIRST ONE WAS MEASURING THE BACKDROP -----
    //
    // The mask above answers "is there hair here". It does not answer "is this pixel's VALUE hair",
    // and for a percentile statistic that is the question. `?hairoit=hash` is stochastic alpha: a
    // card texel below the hash threshold drops its sample, so a fringe pixel is part groom and
    // part whatever is behind it — the backdrop card at 0.75 encoded, or lit forehead. Those pixels
    // pass the mask test (they move between the two BSDF probes, because SOME of their coverage is
    // hair) and then sit at the top of every percentile above p90 on their backdrop content alone.
    //
    // The discriminator is the zero-BSDF plate, which is free and already captured: with S ≡ 0 a
    // fully covered hair pixel emits only the indirect term, and that is worth 0.0006 linear on
    // this build (see `HairLightingModel.indirect`). Anything materially brighter than that is not
    // hair, whatever the mask says. The floor is 0.01 LINEAR — sixteen times the measured indirect,
    // so it cannot be excluding pixels for being brightly lit hair, and 0.089 in encoded luma.
    const COVERAGE_FLOOR = 0.01;
    const solidMask = hairMask.filter( ( [ x, y ] ) => linearLumaAt( plates.zero, x, y ) < COVERAGE_FLOOR );

    // 🎯 THE PREDICATE IS THE PROPERTY, NOT THE HEADCOUNT. What has to be true of a mask the
    // contrast is measured on is that switching the BSDF OFF leaves it dark: a mask that reads
    // 0.41 encoded at p95 with no hair shader in the graph is measuring something else, and no
    // amount of it being "86.9% of the pixels" makes the top of its distribution hair. So the
    // assertion is on the zero-BSDF plate's p95 over the mask, and 0.10 encoded is six times the
    // measured value and a sixth of the contaminated one — it discriminates by a wide margin in
    // both directions rather than sitting between two numbers that are nearly equal.
    report(
        '🚩 the CONTRAST mask excludes part-covered card texels, which is where the old number came from',
        percentileOf( plates.zero, solidMask ).p95 < 0.10 &&
            solidMask.length > 40_000 && solidMask.length / hairMask.length > 0.5,
        `${ solidMask.length.toLocaleString() } of ${ hairMask.length.toLocaleString() } masked px are solid hair ` +
            `(${ ( 100 * solidMask.length / hairMask.length ).toFixed( 1 ) }%).\n` +
        `      🔴 WHAT THE OTHER ${ ( 100 - 100 * solidMask.length / hairMask.length ).toFixed( 1 ) }% WERE DOING TO THIS FILE'S HEADLINE NUMBER: on the ` +
            `zero-BSDF plate — no lobes, no scatter, no BSDF of any kind —\n      the FULL mask reads p95 ` +
            `${ percentileOf( plates.zero, hairMask ).p95.toFixed( 4 ) } encoded, i.e. ` +
            `${ ( percentileOf( plates.zero, hairMask ).p95 / HAIR_CONTRAST.baseEncodedLuma ).toFixed( 2 ) } : 1 against ` +
            `#150F17 with the hair shader switched off.\n      The solid mask reads ` +
            `${ percentileOf( plates.zero, solidMask ).p95.toFixed( 4 ) } — ` +
            `${ ( percentileOf( plates.zero, solidMask ).p95 / HAIR_CONTRAST.baseEncodedLuma ).toFixed( 2 ) } : 1. Every ` +
            `contrast figure this file reported before this round was ~94% backdrop.`
    );

    const percentiles = percentileOf;

    // --- THE DUAL BAND, IN PIXELS ---------------------------------------------------------------
    {
        // Per row of the strand band, the mean rise of each lobe over the zero-BSDF plate, over hair
        // pixels only. The zero plate is the right baseline rather than the bald plate: it has the
        // same groom in the same place with the same ambient on it and S identically zero, so the
        // subtraction leaves the lobe and nothing else.
        const inBand = hairMask.filter( ( [ x, y ] ) =>
            x >= STRAND_BAND.x && x < STRAND_BAND.x + STRAND_BAND.width &&
            y >= STRAND_BAND.y && y < STRAND_BAND.y + STRAND_BAND.height );

        const rowsOfBand = new Map();

        for ( const [ x, y ] of inBand ) {

            if ( rowsOfBand.has( y ) === false ) rowsOfBand.set( y, [] );
            rowsOfBand.get( y ).push( x );

        }

        const profileOf = ( arm, baseline ) => {

            const rows = [];

            for ( let y = STRAND_BAND.y; y < STRAND_BAND.y + STRAND_BAND.height; y ++ ) {

                const columns = rowsOfBand.get( y ) ?? [];

                if ( columns.length < 12 ) { rows.push( { y, value: 0, n: columns.length } ); continue; }

                const rise = columns.reduce( ( sum, x ) =>
                    sum + luma( plates[ arm ], x, y ) - luma( plates[ baseline ], x, y ), 0 );

                rows.push( { y, value: rise / columns.length, n: columns.length } );

            }

            return rows;

        };

        // A 9-row box filter. A single row of a cutout groom is a few dozen scattered texels and its
        // mean is noisy; the bands this is looking for are tens of rows wide, so the filter costs
        // nothing it is trying to measure.
        const smooth = ( rows ) => rows.map( ( row, index ) => {

            const window = rows.slice( Math.max( 0, index - 4 ), index + 5 );

            return { y: row.y, value: window.reduce( ( sum, entry ) => sum + entry.value, 0 ) / window.length };

        } );

        const argmax = ( rows ) => rows.reduce( ( best, row ) => row.value > best.value ? row : best );

        const primary = smooth( profileOf( 'primary', 'zero' ) );
        const secondary = smooth( profileOf( 'secondary', 'zero' ) );
        const defect = smooth( profileOf( 'defect', 'zero' ) );

        const peakPrimary = argmax( primary );
        const peakSecondary = argmax( secondary );

        // One 8-bit code value is 1/255 = 0.0039 of luma. These are MEANS over ~100 px of a row, so
        // a rise well below a code value is still a real measurement — but it is worth stating in
        // code values, because a reader looking at the plate will not see it.
        const CODE_VALUE = 1 / 255;

        report(
            'the PRIMARY band is a real, locatable feature on the plate',
            peakPrimary.value > 2 * CODE_VALUE,
            `down ${ STRAND_BAND.width } x ${ STRAND_BAND.height } px of side hair mass, ${ inBand.length.toLocaleString() } ` +
                `masked px: R peaks at row ${ peakPrimary.y }, +${ peakPrimary.value.toFixed( 4 ) } luma over a zero BSDF ` +
                `(${ ( peakPrimary.value / CODE_VALUE ).toFixed( 1 ) } code values)`
        );

        // 🚩 THE RED PROOF. A constant view-space tangent renders a perfectly plausible groom and
        // cannot put a band where the strand is. Two independent halves are required, because
        // either one alone has an innocent explanation: the peak must COLLAPSE (a band that is not
        // aligned with the strand cannot reach the aligned band's amplitude) AND it must MOVE
        // somewhere else entirely (a uniform dimming would leave it in place).
        const peakDefect = argmax( defect );
        const moved = Math.abs( peakDefect.y - peakPrimary.y );

        // ⚠️ NEITHER AMPLITUDE NOR A PLAIN CORRELATION IS THE PROOF, AND BOTH WERE TRIED FIRST.
        //
        // A fixed tangent still produces a band — the band a single enormous flat fibre would
        // produce — and on this rig it comes out about half as bright. "Half as bright" is not
        // evidence of anything; any innocent loss of energy reads the same. A Pearson correlation
        // over the raw lobe images does not separate them either: MEASURED r = 0.6965, because both
        // images are multiplied by the same alpha cutout and the same illumination envelope, and
        // that shared envelope dominates the covariance.
        //
        // What does separate them is WHICH PIXELS ARE THE BRIGHT ONES. The discriminator is the
        // Jaccard overlap of the two images' top deciles: if the highlight follows the card, the
        // brightest tenth of the shipped image and the brightest tenth of the defect image are
        // different tenths. It is a set comparison, so a common multiplicative envelope cancels out
        // of it by construction.
        const topDecileOverlap = ( ( ) => {

            const brightest = ( arm ) => {

                const values = inBand
                    .map( ( [ x, y ] ) => ( { key: `${ x },${ y }`, value: luma( plates[ arm ], x, y ) - luma( plates.zero, x, y ) } ) )
                    .sort( ( a, b ) => b.value - a.value );

                return new Set( values.slice( 0, Math.floor( values.length * 0.1 ) ).map( ( entry ) => entry.key ) );

            };

            const shipped = brightest( 'primary' );
            const broken = brightest( 'defect' );

            let shared = 0;
            for ( const key of broken ) if ( shipped.has( key ) ) shared ++;

            return shared / ( shipped.size + broken.size - shared );

        } )();

        report(
            '🚩 RED PROOF — a CONSTANT tangent puts the band on DIFFERENT PIXELS, not merely dimmer ones',
            topDecileOverlap < 0.5 && peakDefect.value < peakPrimary.value * 0.75,
            `?hairdefect=constant-tangent, over ${ inBand.length.toLocaleString() } hair pixels of the strand band: ` +
                `the brightest tenth of the two lobe images\n      overlaps by a Jaccard index of ` +
                `${ topDecileOverlap.toFixed( 4 ) } — the highlight is on different hair.\n      Amplitude, for scale: ` +
                `peak +${ peakDefect.value.toFixed( 4 ) } at row ${ peakDefect.y } against the card tangent's ` +
                `+${ peakPrimary.value.toFixed( 4 ) } at row ${ peakPrimary.y } — ` +
                `${ ( peakPrimary.value / Math.max( peakDefect.value, 1e-9 ) ).toFixed( 2 ) }x dimmer, ${ moved } px away.\n` +
            `      The defect plate stays entirely plausible: dark hair, visible groom, a band on it, nothing a ` +
                `thumbnail could reject.\n      That is what makes this a proof of the ANISOTROPY and not of the plumbing — ` +
                `a fixed tangent still makes A highlight, just not\n      one that belongs to the strand it is sitting on.`
        );

        // --- the same two lobes, with a light on the camera axis --------------------------------
        const headPrimary = smooth( profileOf( 'headR', 'headZero' ) );
        const headSecondary = smooth( profileOf( 'headTRT', 'headZero' ) );

        const headPeakR = argmax( headPrimary );
        const headPeakTRT = argmax( headSecondary );
        const headSeparation = Math.abs( headPeakTRT.y - headPeakR.y );

        // --- the four panels, which are where the rig's irradiance actually is -------------------
        const panelProfile = smooth( profileOf( 'panelR', 'panelZero' ) );
        const panelPeak = argmax( panelProfile );
        const panelMean = panelProfile.reduce( ( sum, row ) => sum + row.value, 0 ) / panelProfile.length;

        report(
            '🚩 THE RECT-AREA PATH CARRIES THE BAND ON ITS OWN, with every punctual light removed',
            panelPeak.value > 2 * CODE_VALUE,
            `?ov=key.shadowFraction:0 leaves NO punctual light in the scene, so all of this comes through ` +
                `directRectArea:\n      the R band peaks at +${ panelPeak.value.toFixed( 4 ) } ` +
                `(${ ( panelPeak.value / CODE_VALUE ).toFixed( 1 ) } code values) at row ${ panelPeak.y }, mean rise ` +
                `+${ panelMean.toFixed( 6 ) } over the band.\n      This check exists because the first ` +
                `directRectArea masked every panel off through an inverted front-face test and measured EXACTLY\n` +
                `      0.000000 here while the shipped plate still looked like dark hair. See the comment on ` +
                `\`inFront\`.`
        );

        // 🎯 THE DIAGNOSIS FOR THE SHIPPED RIG'S MISSING SECOND BAND, ASSERTED RATHER THAN ARGUED.
        // `D_TRT = exp(17 cosφ − 16.78)` is RETROREFLECTIVE: it fires only where the light is
        // azimuthally near the view, which is why hair haloes toward a lamp. The portrait rig's four
        // panels sit at +42°, −52°, −168° and +166°, so the shipped frame contains almost no
        // geometry TRT can fire in — and the reference plate the look spec measured its two bands on
        // has teal PRACTICALS beside the lens, which is exactly the light this rig lacks. The claim
        // "the rig, not the lobe" is falsifiable: move one light and the same lobe must come back.
        report(
            'the secondary band is missing from the shipped rig because TRT is RETROREFLECTIVE, not because the lobe is dead',
            headPeakTRT.value > peakSecondary.value * 5 && peakSecondary.value < peakPrimary.value * 0.1,
            `shipped rig: TRT peaks at row ${ peakSecondary.y }, +${ peakSecondary.value.toFixed( 5 ) } luma ` +
                `(${ ( peakSecondary.value / CODE_VALUE ).toFixed( 2 ) } code values), ` +
                `${ ( peakPrimary.value / Math.max( peakSecondary.value, 1e-9 ) ).toFixed( 0 ) }x under the primary.\n` +
            `      key on the camera axis: the SAME lobe reaches +${ headPeakTRT.value.toFixed( 5 ) } ` +
                `(${ ( headPeakTRT.value / CODE_VALUE ).toFixed( 1 ) } code values), ` +
                `${ ( headPeakTRT.value / Math.max( peakSecondary.value, 1e-9 ) ).toFixed( 1 ) }x more, ` +
                `off a light MOVE and not a parameter change.\n      Consequence for the look, and it belongs to the ` +
                `lighting rig rather than to this file: the reference's dual band needs a practical beside the lens.`
        );

        // ⚠️ THE FLOOR HERE IS ONE CODE VALUE AND THAT IS NOT A WEAK GATE, BUT IT DOES NEED SAYING
        // WHY. Each row of this profile is a mean over ~100 masked pixels, then box-filtered over 9
        // rows — roughly 900 samples — so its standard error is under a thirtieth of the per-pixel
        // noise. A 1.1-code-value MEAN is a solid measurement even though a 1.1-code-value PIXEL
        // would not be. What it also means is that the secondary band is invisible to a human on
        // this plate, and that is a statement about the picture rather than about the arithmetic.
        report(
            'THE DUAL BAND, MEASURED SEPARATELY AND IN PIXELS, with a light the secondary lobe can fire in',
            headPeakR.value > 2 * CODE_VALUE && headPeakTRT.value > 1 * CODE_VALUE && headSeparation >= 20,
            `key moved to the camera axis (?ov=key.azimuthDegrees:12 — the camera stands 12° off the facing ` +
                `axis), everything else unchanged:\n      R peaks at row ${ headPeakR.y }, +${ headPeakR.value.toFixed( 4 ) } ` +
                `(${ ( headPeakR.value / CODE_VALUE ).toFixed( 1 ) } code values); TRT at row ${ headPeakTRT.y }, ` +
                `+${ headPeakTRT.value.toFixed( 4 ) } (${ ( headPeakTRT.value / CODE_VALUE ).toFixed( 1 ) } code values) ` +
                `— ${ headSeparation } px apart down the strand.\n      Measured on two plates that differ in ONE lobe ` +
                `weight, so neither number contains any part of the other.`
        );
    }

    // --- THE CONTRAST, on the shipped plate -----------------------------------------------------
    {
        const shipped = percentiles( plates.shipped, solidMask );
        const plain = percentiles( plates.plainCard, solidMask );
        const unit = percentiles( plates.unit, solidMask );
        const zero = percentiles( plates.zero, solidMask );

        const ratio = shipped.p95 / HAIR_CONTRAST.baseEncodedLuma;
        const target = HAIR_CONTRAST.encodedRatio;

        console.log( `      arm                       p50      p90      p95      p99      max      (solid hair only)` );
        for ( const [ name, entry ] of [ [ 'shipped BSDF', shipped ], [ '?hairbsdf=0 (GLB card)', plain ],
            [ 'unit BSDF probe', unit ], [ 'zero BSDF', zero ] ] ) {

            console.log( `      ${ name.padEnd( 24 ) } ${ entry.p50.toFixed( 4 ) }   ${ entry.p90.toFixed( 4 ) }   ` +
                `${ entry.p95.toFixed( 4 ) }   ${ entry.p99.toFixed( 4 ) }   ${ entry.max.toFixed( 4 ) }` );

        }

        // 🎯 THE IRRADIANCE ATTRIBUTION. `?hairdefect=unit-bsdf` renders S = 1/4π, so its LINEAR
        // value on a hair pixel is Σ(L_i·Ω_i)/4π over the five lights. Inverting it says what the
        // rig delivers to the groom, which is the only way to tell a dim BSDF from a dim rig — and
        // telling those two apart is precisely what REQ-061 asks for.
        //
        // ⚠️ TWO HONEST LIMITS ON THE ARITHMETIC BELOW, BOTH OF WHICH THE PREVIOUS ROUND'S VERSION
        // STATED MORE CONFIDENTLY THAN IT WAS ENTITLED TO. (1) `unit.p95` and `shipped.p95` are rank
        // statistics over the same mask, not the same PIXEL — the sentence "at the same p95 pixel"
        // was wrong and is gone. (2) `requiredBsdf` inverts the sRGB transfer only; the shipped arm
        // is graded, so the true linear scene value behind an encoded 0.675 is HIGHER than
        // `encodedToLinear` says and the required BSDF is therefore a LOWER BOUND.
        const deliveredAtP95 = encodedToLinear( unit.p95 ) * 4 * Math.PI;
        const requiredBsdf = encodedToLinear( HAIR_CONTRAST.bandEncoded[ 1 ] ) / deliveredAtP95;

        // The ceiling, over the sphere and over the shipped combination. See `closedFormPeak`.
        const peak = closedFormPeak;

        report(
            'the specular-to-albedo contrast reaches the look spec\'s measured 9.08–11.35 : 1 ENCODED band',
            ratio >= target[ 0 ] && ratio <= target[ 2 ],
            `SOLID hair p95 ${ shipped.p95.toFixed( 4 ) } encoded over #150F17's ${ HAIR_CONTRAST.baseEncodedLuma } = ` +
                `${ ratio.toFixed( 2 ) } : 1, against ${ target[ 0 ] }–${ target[ 2 ] } : 1.\n` +
            `      🔴 DIAGNOSIS. The unit-BSDF probe reads p95 ${ unit.p95.toFixed( 4 ) } encoded on the same mask, so the rig delivers\n` +
                `      Σ(L·Ω) = ${ deliveredAtP95.toFixed( 3 ) } sr·nits to a hair pixel at that rank. Reaching the reference band needs at least\n` +
                `      ${ requiredBsdf.toFixed( 4 ) } sr⁻¹. The shipped combination — R + TRT + slide 39's fake, under slide 47's occlusion —\n` +
                `      peaks over the whole sphere at ${ peak.total.toFixed( 4 ) } sr⁻¹ (θi ${ peak.thetaI }°, φ ${ peak.phi }°, θr ${ peak.thetaR }°, channel ${ peak.channel };\n` +
                `      R ${ peak.r.toFixed( 4 ) } + fake ${ peak.scatter.toFixed( 4 ) }), a factor of ${ ( requiredBsdf / peak.total ).toFixed( 2 ) } short before the rig is even consulted.\n` +
            `      What this rules out: a misread transfer domain, and an exposure — raising exposure is the move REQ-061 rules out.\n` +
            `      What it leaves: R is Fresnel-limited (F0 = ${ HAIR_F0.toFixed( 4 ) }) and its real peak lives at near-backlight grazing,\n` +
                `      which slide 47's occlusion deliberately discards because the rim has no shadow map. REQ-063.`
        );

        // ⚠️ COMPARED AT p95 AND NOT AT p50, AND THE REASON IS WORTH A LINE. The two materials'
        // MEDIANS are nearly equal — 0.154 against 0.164 on the plate this was written against —
        // because most hair pixels are in shadow under either shader and both are dark there. Where
        // they differ is in the top decile, which is exactly where a highlight lives. A median
        // comparison would have called two very different pictures the same.
        report(
            'the BSDF is doing something the plain card cannot: it moves the top of the distribution',
            Math.abs( shipped.p95 - plain.p95 ) > 0.05,
            `p50 ${ shipped.p50.toFixed( 4 ) } against the GLB card's ${ plain.p50.toFixed( 4 ) } — nearly equal; ` +
                `p95 ${ shipped.p95.toFixed( 4 ) } against ${ plain.p95.toFixed( 4 ) }, and p90 ` +
                `${ shipped.p90.toFixed( 4 ) } against ${ plain.p90.toFixed( 4 ) }.\n      ?hairbsdf=0 is the A side: ` +
                'a MeshPhysical lobe about the card\'s PLANE NORMAL, which is brighter and is wrong in the way ' +
                '`applyCardShading` spent a round documenting.'
        );
    }

    // --- 🎯 THE EFFECTIVE BSDF, INVERTED OUT OF THE PLATE ---------------------------------------
    //
    // This is the section that makes "ship a multiplier until the gate goes green" impossible, and
    // that is why it is here rather than in a scratch file. Three forward plates differ in exactly
    // one thing, the scattering function:
    //
    //     zero      S ≡ 0            →  linear value = the indirect term alone
    //     unit      S ≡ 1/4π         →  linear value = indirect + Σ(L·Ω)/4π
    //     forward   S = the shipped closed form
    //
    // Subtracting the first from the other two leaves, per pixel and with no model in the way,
    //
    //     Σ(L·Ω)(x)  = ( unit − zero ) · 4π          the rig's delivery, measured not authored
    //     S_eff(x)   = ( forward − zero ) / Σ(L·Ω)   the scattering function the SHADER computed
    //
    // and `S_eff` is directly comparable to the CPU mirror's own peak over the sphere. A shader
    // that is doing what the closed form permits lands under that ceiling everywhere; a shader
    // carrying a tuning factor lands above it, on some pixel, by exactly the factor. The check
    // below is that ceiling, and it is the one gate in this file that gets stricter as the picture
    // gets better.
    {
        const linearAt = ( plate, x, y ) => linearLumaAt( plate, x, y );

        const delivery = [];
        const effective = [];

        for ( const [ x, y ] of solidMask ) {

            const indirect = linearAt( plates.zero, x, y );
            const delivered = ( linearAt( plates.unit, x, y ) - indirect ) * 4 * Math.PI;

            // ⚠️ A PIXEL THE RIG BARELY REACHES DIVIDES A SMALL NUMBER BY A SMALL NUMBER, AND THE
            // MAX OF THAT RATIO IS NOISE RATHER THAN A MEASUREMENT. The floor is ONE steradian-nit
            // against a mask median of about four, which is the level below which a hair pixel is
            // inside the key's shadow rather than lit by anything. It was 1e-3 for one run and the
            // peak it reported moved by 14x between two captures of the SAME source, because the
            // hashed-alpha coverage reshuffles the fringe of the mask from load to load.
            if ( delivered <= 1 ) continue;

            delivery.push( delivered );
            effective.push( ( linearAt( plates.forward, x, y ) - indirect ) / delivered );

        }

        const rank = ( values ) => {

            const sorted = values.slice().sort( ( a, b ) => a - b );
            const at = ( p ) => sorted[ Math.min( sorted.length - 1, Math.floor( p * sorted.length ) ) ];

            return { p50: at( 0.5 ), p90: at( 0.9 ), p95: at( 0.95 ), p99: at( 0.99 ), max: sorted[ sorted.length - 1 ] };

        };

        const measuredBsdf = rank( effective );
        const measuredDelivery = rank( delivery );

        console.log( `      quantity                  p50      p90      p95      p99      max` );
        console.log( `      Σ(L·Ω) sr·nits          ${ measuredDelivery.p50.toFixed( 3 ) }    ${ measuredDelivery.p90.toFixed( 3 ) }    ` +
            `${ measuredDelivery.p95.toFixed( 3 ) }    ${ measuredDelivery.p99.toFixed( 3 ) }    ${ measuredDelivery.max.toFixed( 3 ) }` );
        console.log( `      S_eff sr⁻¹              ${ measuredBsdf.p50.toFixed( 5 ) }  ${ measuredBsdf.p90.toFixed( 5 ) }  ` +
            `${ measuredBsdf.p95.toFixed( 5 ) }  ${ measuredBsdf.p99.toFixed( 5 ) }  ${ measuredBsdf.max.toFixed( 5 ) }` );

        report(
            '🎯 the RENDERED scattering function stays under the closed form\'s own ceiling — the anti-fudge gate',
            measuredBsdf.max <= closedFormPeak.total * 1.05,
            `over ${ effective.length.toLocaleString() } solid hair pixels the shader's measured S peaks at ` +
                `${ measuredBsdf.max.toFixed( 5 ) } sr⁻¹\n      against the CPU mirror's ${ closedFormPeak.total.toFixed( 5 ) } sr⁻¹ over the whole sphere — ` +
                `${ ( 100 * measuredBsdf.max / closedFormPeak.total ).toFixed( 1 ) }% of it. A shader carrying a tuning\n` +
            `      multiplier lands ABOVE 100% by exactly the multiplier, which is what this check is for; the 5% ` +
                `slack is 8-bit quantisation.\n` +
            `      🔴 AND THE GAP AT p95 IS THE RIG, NOT THE MODEL: S peaks at ${ measuredBsdf.max.toFixed( 5 ) } but reads ` +
                `${ measuredBsdf.p95.toFixed( 5 ) } at p95, because the four\n      panels sit at +42°, −52°, −168° and +166° and the ` +
                `closed form's peak needs a light near the view axis. Moving the key there\n      (?ov=key.azimuthDegrees:12) is measured ` +
                `in the DUAL BAND section above and it is a rig change, filed as REQ-064.`
        );
    }

    // --- THE HIGHLIGHT ENERGY, which is what REQ-061 asked for ----------------------------------
    {
        const share = ( plate, threshold ) => {

            let count = 0;

            for ( let y = 0; y < HEIGHT; y ++ ) {

                for ( let x = 0; x < WIDTH; x ++ ) if ( luma( plate, x, y ) > threshold ) count ++;

            }

            return { count, share: count / ( WIDTH * HEIGHT ) };

        };

        const rows = [ [ 'bald (the shipped plate)', plates.bald ], [ 'hair, Karis BSDF', plates.shipped ],
            [ 'hair, GLB card material', plates.plainCard ] ];

        console.log( `      arm                          >0.90 luma            >0.99 luma (bloom)` );
        const measured = {};

        for ( const [ name, plate ] of rows ) {

            const bright = share( plate, 0.90 );
            const clipped = share( plate, 0.99 );

            measured[ name ] = { bright, clipped };
            console.log( `      ${ name.padEnd( 26 ) } ${ String( bright.count ).padStart( 7 ) } px  ` +
                `${ ( bright.share * 100 ).toFixed( 5 ) }%   ${ String( clipped.count ).padStart( 7 ) } px  ` +
                `${ ( clipped.share * 100 ).toFixed( 5 ) }%` );

        }

        // 🎯 REPORTED, NOT TUNED TO. The task this file was written for says so explicitly, and it is
        // the right instruction: a threshold moved until a number lands is a number about the
        // threshold. The reference plates carry 0.017–0.036% of frame above the bloom threshold and
        // this build carried 0.0000043 before hair existed.
        const baldClipped = measured[ 'bald (the shipped plate)' ].clipped.share;
        const hairClipped = measured[ 'hair, Karis BSDF' ].clipped.share;

        report(
            'hair puts the frame\'s clipped-highlight share into the reference\'s 0.017–0.036% band',
            hairClipped >= 0.00017 && hairClipped <= 0.00036,
            `bald ${ ( baldClipped * 100 ).toFixed( 5 ) }% of frame over 0.99 luma, with hair ` +
                `${ ( hairClipped * 100 ).toFixed( 5 ) }%. Reference plates: 0.017–0.036%.\n` +
            `      🔴 THE HONEST MISS, WITH ITS DIAGNOSIS. REQ-061 recorded that this scene has nothing small and\n` +
                `      bright enough to clip and named hair specular as the largest of the three candidates. Hair is now\n` +
                `      in the frame and it does not clip either, for the reason the sections above measure: the shipped\n` +
                `      combination peaks at ${ closedFormPeak.total.toFixed( 4 ) } sr⁻¹ over the whole sphere on a #150F17 fibre and the rig delivers\n` +
                `      Σ(L·Ω) of order 4 to 6 sr·nits to the groom, so the product lands one to two stops below the tone\n` +
                `      curve's shoulder. What this rules out: "the scene has no hair" is no longer the explanation, and\n` +
                `      neither is a dim BSDF relative to its own model — the anti-fudge check above measures the shader\n` +
                `      just under the closed form's own ceiling. What it leaves open: a specular lobe on a WET or oiled\n` +
                `      surface, the eye catchlight cubemap (3.4), and Phase 9's metal trim — all three of which are\n` +
                `      small, bright and NOT governed by a fibre's absorption.\n` +
            `      ⚠️ AND THE TARGET BAND ITSELF DOES NOT REPRODUCE. docs/research/hair.md §0.2 re-measured the look\n` +
                `      spec's 0.017% on overview_character.jpg and read 0.0137% (810 px of 5,891,200) under encodedLuma,\n` +
                `      with four other plausible luma definitions giving 0.0040%, 0.0088% and 0.0719%. The reference\n` +
                `      images are deliberately not in the repository, so this round could not re-measure them and the\n` +
                `      0.017–0.036% band is left standing rather than quietly widened to whichever number passes.`
        );
    }

}

// --- COST -------------------------------------------------------------------------------------
//
// GPU timestamps, because wall clock on this page is a non-measurement: the step helper ends in two
// rAF waits and every arm reads exactly 16.700 ms of vsync. `?gputime=1` has to be in the URL —
// `renderer.trackTimestamp = true` after `init()` leaves the timestamp undefined forever, measured
// 0 of 200 samples valid on three r185, which is why it is a URL key and not a console call.

console.log( '\n--- cost, at 1080p, against a 16.6 ms budget -------------------------------------\n' );

if ( browser !== null ) {

    const COST_WIDTH = 1080;
    const COST_HEIGHT = 1920;
    const SAMPLES = 180;

    const timeFor = async ( query ) => {

        const context = await browser.newContext( { viewport: { width: COST_WIDTH, height: COST_HEIGHT }, deviceScaleFactor: 1 } );
        const page = await context.newPage();

        // A page that throws during boot leaves `waitForFunction` to time out with a message about
        // the predicate rather than about the error, which is a bad half-hour. Surfaced instead.
        const pageErrors = [];
        page.on( 'pageerror', ( error ) => pageErrors.push( error.message ) );

        try {

            await page.goto( `${ server.baseUrl }/alive.html?bare&seed=1&frame=body&gputime=1${ query }`, { waitUntil: 'load' } );
            await page.waitForFunction( () => globalThis.sugata?.session?.figure != null, null, { timeout: 120_000 } );
            await page.waitForTimeout( 3000 );

            if ( pageErrors.length > 0 ) throw new Error( pageErrors[ 0 ] );

            return await page.evaluate( async ( count ) => {

                const renderer = globalThis.sugata.stage.renderer;
                const samples = [];

                for ( let i = 0; i < count; i ++ ) {

                    await new Promise( ( done ) => requestAnimationFrame( done ) );

                    // 🚩 `resolveTimestampsAsync` HAS TO BE CALLED. `info.render.timestamp` is not a
                    // live counter — it is written by the resolve, and a loop that only reads it
                    // gets `undefined` on every one of 180 samples. Measured: 0 valid samples
                    // without this line, on the same build that reports them fine with it.
                    await renderer.resolveTimestampsAsync( 'render' );

                    const value = renderer.info?.render?.timestamp;
                    if ( typeof value === 'number' && value > 0 ) samples.push( value );

                }

                samples.sort( ( a, b ) => a - b );

                return {
                    valid: samples.length,
                    p50: samples[ Math.floor( samples.length * 0.5 ) ] ?? null,
                    p95: samples[ Math.floor( samples.length * 0.95 ) ] ?? null
                };

            }, SAMPLES );

        } finally {

            await context.close().catch( () => {} );

        }

    };

    try {

        const bald = await timeFor( '' );
        const hair = await timeFor( '&hair=1' );

        console.log( `      bald  ${ bald.valid } valid samples: p50 ${ bald.p50?.toFixed( 3 ) } ms, p95 ${ bald.p95?.toFixed( 3 ) } ms` );
        console.log( `      hair  ${ hair.valid } valid samples: p50 ${ hair.p50?.toFixed( 3 ) } ms, p95 ${ hair.p95?.toFixed( 3 ) } ms` );

        const BUDGET_MS = 16.6;
        const headroom = BUDGET_MS - ( hair.p95 ?? Infinity );

        report(
            'the groom plus its BSDF fits inside the 16.6 ms budget at 1080p',
            hair.valid > 20 && hair.p95 !== null && hair.p95 < BUDGET_MS,
            `hair adds ${ ( ( hair.p50 ?? 0 ) - ( bald.p50 ?? 0 ) ).toFixed( 3 ) } ms p50 and ` +
                `${ ( ( hair.p95 ?? 0 ) - ( bald.p95 ?? 0 ) ).toFixed( 3 ) } ms p95; p95 lands at ` +
                `${ hair.p95?.toFixed( 3 ) } ms, ${ headroom.toFixed( 3 ) } ms under budget. ` +
                'One draw call, 7,224 triangles, no extra pass — the whole cost is the fragment shader and the ' +
                'shadow-map draw the groom now also makes.'
        );

    } catch ( error ) {

        report( 'GPU timestamps resolved at 1080p', false, `they did not: ${ error.message }` );

    }

}

if ( browser !== null ) await browser.close();
if ( server !== null ) await server.close();

console.log( `\n${ failures === 0 ? 'ALL GREEN' : 'RED' } — ${ checks - failures }/${ checks } checks passed\n` );

process.exit( failures === 0 ? 0 : 1 );
