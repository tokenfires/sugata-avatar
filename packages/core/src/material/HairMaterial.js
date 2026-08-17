/**
 * HairMaterial — punch-list 3.5. Karis' closed-form Marschner, on cards, in TSL.
 *
 * ## The one thing that makes a card read as hair
 *
 * A hair card is a flat quad with a cutout on it. Under an isotropic lobe about its plane normal
 * it is a plastic ribbon, and `alive.js`'s `applyCardShading` says so at length about the eyelash
 * and eyebrow cards: the fix that shipped there was to switch the lobe OFF (`specularIntensity 0`),
 * because a wrong lobe is worse than none. That comment ends by naming this file as the thing that
 * owes it a replacement. This is the replacement.
 *
 * What replaces it is not "an anisotropic GGX with the tangent from the flow map". A fibre is a
 * dielectric CYLINDER, and light does three distinguishable things in it — bounces off the
 * cuticle (R), passes through and out the far side (TT), and passes in, reflects off the inside of
 * the far wall and comes back out (TRT). Those are three lobes with three different longitudinal
 * shifts, three different widths and — the part that decides whether a still frame reads as hair —
 * three different COLOURS. R never enters the fibre, so its attenuation is pure Fresnel and it
 * takes the LIGHT's colour. TRT crosses the pigment twice, so it takes the HAIR's colour. That is
 * the "dual band" the look spec asks for, and it is measurable in a shipped reference frame:
 * `post_ms7/08.jpg`'s warm band peaks at hue 36° (the hair) and its cool band at hue 176° (the
 * teal practicals). An anisotropic GGX produces one band in one colour and cannot produce that.
 *
 * ## Which form, and read off which artefact
 *
 * Karis, "Physically Based Hair Shading in Unreal", SIGGRAPH 2016 Physically Based Shading course
 * (blog.selfshadow.com/publications/s2016-shading-course/karis/s2016_pbs_epic_hair.pdf, 66 pp).
 * ⚠️ The equations on those slides are vector art: `pdftotext` returns the speaker notes and NOT
 * one of the formulae below. Anyone re-deriving these must read the slide IMAGES. Slide numbers
 * are given per term so that is possible.
 *
 * The factorisation (slide 13) is Marschner's:  S = Σ_p M_p(θi,θr) · N_p(θi,θr,φ), p ∈ {R,TT,TRT}.
 * Eccentricity is not modelled — slide 17, "We don't handle eccentricity" — and neither are
 * glints; slide 32 opens "For TRT we have to be brutal".
 *
 * 🚩 **M_p's argument is `sinθi + sinθr`, NOT Marschner's half-angle θh.** They are different
 * variables and therefore α and β mean different numbers in the two papers. The exact relation is
 * `sinθi + sinθr = 2 cosθd sinθh`, so a shift authored in Marschner's degrees converts as
 * `α_Karis ≈ 2 sin(α_Marschner)` and a width as `β_Karis ≈ 2 β_Marschner` (radians). Nobody writes
 * that conversion down, and dropping it authors every lobe a factor of two too tight and half as
 * shifted — which looks like "the highlight is a bit thin" rather than like a bug.
 *
 * The per-lobe numbers are NOT Karis'; he gives none. They are Marschner, Jensen, Cammarano,
 * Worley, Hanrahan, "Light Scattering from Human Hair Fibers", SIGGRAPH 2003, Table 1, page 8
 * (cs.cornell.edu/~srm/publications/SG03-hair.pdf), read off the page and then converted through
 * the relation above. See `HAIR_DEFAULTS`.
 *
 * ## Where it hooks in, and the trap that makes the obvious hook do nothing
 *
 * Sugata's rig is four `RectAreaLight`s plus one co-located shadow-casting `SpotLight`
 * (`render/LightingRig.js`). A lighting model that overrides only `direct()` therefore sees ONE of
 * the five lights — the shadow half of the key — and the four panels that carry most of the
 * irradiance go through `directRectArea()` and the linearly-transformed-cosine path instead.
 * `SkinMaterial.js` records the same trap in its own header. Both paths are implemented here.
 *
 * 🚩 **The rect-area path cannot use LTC and does not pretend to.** LTC integrates a GGX lobe over
 * the panel; Marschner's S is not GGX and is not even a function of a surface normal. What is used
 * instead is the panel's exact SOLID ANGLE from the shading point (van Oosterom & Strackee's
 * spherical-excess formula, two spherical triangles, two `atan2`s) times the BSDF evaluated at the
 * panel's CENTRE direction:
 *
 *     L_r  ≈  S( ω̄i, ωr ) · L_i · Ω
 *
 * That is exact in the small-solid-angle limit and degrades by blurring — a panel subtending a
 * large angle gets a highlight that is too tight rather than one in the wrong place. It composes
 * with the punctual path for free, because a punctual light's `lightColor` is already an
 * irradiance: `L_i · Ω` and `E` are the same quantity, so `direct()` is the same line without the
 * solid angle. There is deliberately no `N·L` anywhere in either path — Marschner's S is defined
 * about the fibre's tangent, not about a surface normal, and multiplying by a cosine against a
 * normal the model does not have is the single easiest way to make card hair look like cloth.
 *
 * ## The three things a CARD lacks, and what stands in for each
 *
 * The research round established that nothing in the closed form reads a per-strand quantity a
 * card cannot supply — R's `h` is 0 by construction, TRT's is the constant √3/2, and TT's is a
 * function of φ alone, which comes from ωi, ωr and the tangent. The card penalties are elsewhere:
 *
 *   1. **The card's plane normal is a lie about a fibre bundle.** So it is never used. `normalNode`
 *      is set to Karis' fake normal (slide 39) — `normalize( ωr − u(u·ωr) )`, the direction in the
 *      plane perpendicular to the strand that faces the viewer — which is also what goes into the
 *      G-buffer, so `render/GTAO.js` occludes against something that exists. Writing the card's
 *      own plane normal there would have GTAO shadow the groom against a set of flat plates.
 *   2. **Self-shadowing is coarser at card scale than at fibre scale.** Slide 44 is explicit that
 *      the multiple-scattering term's `Shadow` must be a PCF with EXPONENTIAL falloff, because the
 *      exponential value IS the path-length estimate that feeds the absorption exponent. We have
 *      no hair shadow map (3.8 measured a shadow pass at 2.62 ms and the budget bought exactly
 *      one). The baked `depth.png` sheet — depth within the bundle, generated per texel by
 *      `tools/figure-pipeline/hair_texture.py` — stands in for it, through the same exponential.
 *   3. **The root is not occluded by anything the renderer can see.** A baked root→tip mask
 *      (`flow.png` B) ramps a measured occlusion over the first fraction of strand length.
 *
 * ## The strand frequency lives HERE now, because the alpha channel cannot carry it
 *
 * Round 20 traced a strand run from the atlas to the frame buffer and proved it cannot survive: the
 * sheet offers 3.637 runs per card width at the width a card actually covers and the frame delivers
 * 0.786, because a 128-texel strip covers about 35 scene-pass pixels, so an authored strand run is
 * under two pixels and the trilinear filter at the sampled lod is as wide as the run itself. The
 * filter is RIGHT to remove it — keeping it would alias — and no sheet authored against a texel
 * grid can win that argument. Alpha's remaining job is the silhouette and the wisps.
 *
 * 🎯 **SO THE STRAND FREQUENCY MOVES INTO THE SHADING, WHERE THERE IS NO MIP CHAIN.** A tangent
 * perturbation evaluated per fragment is not sampled from anything; it is a function of `uv` and of
 * the fragment's own screen derivatives, so the only band limit it has is the one it is given, and
 * it can be given exactly the right one. `strandTangentNode` adds a one-dimensional value-noise
 * rotation of the strand direction, across the strand, with two halves that are separately measured:
 *
 *   AMPLITUDE  is not invented — it is the strand-scale tangent variation `flow.png` ALREADY
 *              CARRIES AND THE SAMPLER ALREADY DELETES. Measured this session on the shipped sheet,
 *              per strip, as the standard deviation of the in-plane strand angle left over after a
 *              box filter of the width the scene pass reads at: 10.4° on strip 1 and 15.0–17.5° on
 *              strips 2–5. Weighted by the hair pixels each strip actually occupies in the shipped
 *              portrait, **0.2403 rad — 13.8°**. `HAIR_DEFAULTS.strandTangentJitter` is that number,
 *              so the change reinstates a measured quantity rather than adding a new one. It is a
 *              STATISTICAL reinstatement and not a reconstruction: the sheet's own strand positions
 *              are not recoverable from a filtered read, so what is restored is the amplitude and
 *              the frequency band, not the individual hairs.
 *
 *   FREQUENCY  is set by the SCENE PASS and by nothing else. The pitch is authored in millimetres of
 *              scalp and converted per fragment through `|∂P/∂u|`, which the cotangent frame already
 *              computes, so a card carries the same physical lock spacing wherever it sits and
 *              whatever its own width is. `dFdx( uv )` is taken in render-target pixels, which is
 *              the rate the coverage decision is made at — 0.66 of a CSS pixel on this page — so the
 *              Nyquist fade is automatically in the units round 20 found the CPU gate had wrong.
 *
 * ⚠️ **THE JITTER REACHES THE G-BUFFER, AND THAT IS DELIBERATE.** `normalNode` is Karis' fake normal
 * built from this same tangent, so the strand structure lands in the normal buffer that `GTAO.js`
 * and the specular occlusion read. Making the two disagree would put the highlight on one strand
 * field and the occlusion on another.
 *
 * ## The multiple-scattering term is a hack and is labelled as one
 *
 * Slide 39's term is Square Enix's from Agni's Philosophy, and Karis' own words on that section of
 * the deck are "a giant artistic hack and not physically based in the slightest… derived by
 * looking at photos". It is here because dark hair without it reads as three thin bands on black,
 * and it is behind its own uniform so a plate can be taken without it.
 *
 * ## What is NOT here, and whose item it is
 *
 * Order-independent transparency. The groom ships `alphaMode: MASK` at cutoff 0.5 and that is what
 * this material honours; `render/**` belongs to the OIT agent this round and the weighted-blended
 * path lands there. `alphaToCoverage` is set when — and only when — the stage actually has a
 * multisampled target, for the reason `applyCardShading` gives: the flag on a single-sampled
 * target reads like a fix while the hard staircase carries on underneath.
 *
 * ## USAGE
 *
 *     const hair = await createHairMaterial( { groomDirectoryUrl, baseColour, multisampled } );
 *     applyHairMaterial( hairRoot, hair );
 *
 * Every number this file runs on has a JavaScript mirror beside it, exported, and
 * `HairMaterial.selftest.mjs` is what asserts the properties those mirrors have.
 */

import {
    Color,
    DoubleSide,
    LightingModel,
    Matrix4,
    MeshPhysicalNodeMaterial,
    SRGBColorSpace,
    TextureLoader,
    Vector3
} from 'three/webgpu';

import {
    Fn,
    abs,
    atan,
    cameraViewMatrix,
    cos,
    cross,
    dFdx,
    dFdy,
    dot,
    float,
    floor,
    fract,
    length,
    mix,
    normalize,
    positionGeometry,
    positionView,
    positionViewDirection,
    pow,
    sin,
    smoothstep,
    sqrt,
    texture,
    uniform,
    uv,
    vec2,
    vec3,
    vec4
} from 'three/tsl';

// --- the constants, and where each one was read ---------------------------------------------

/**
 * The fibre's index of refraction. Marschner Table 1, page 8, first row: **η = 1.55**. It is the
 * one number in this file that every other optical constant is derived from rather than authored.
 */
export const HAIR_IOR = 1.55;

/**
 * Normal-incidence reflectance, `((1−η)/(1+η))²`, computed here rather than typed: 0.046521 at
 * η = 1.55. Exported so the selftest can check the derivation rather than the literal.
 */
export const HAIR_F0 = Math.pow( ( 1 - HAIR_IOR ) / ( 1 + HAIR_IOR ), 2 );

/**
 * The absorption cross-sections of the two pigments that colour every human hair, per sRGB
 * channel. **NOT ours and not fitted here:** d'Eon, François, Hill, Letteri & Aubry, *An
 * Energy-Conserving Hair Reflectance Model*, EGSR 2011, §6.1 — *"The values we found are
 * σa,e = {0.419, 0.697, 1.37} and σa,p = {0.187, 0.4, 1.05}"*, obtained by integrating Donner &
 * Jensen's spectral melanin absorption over 40 bands against D65 and fitting the RGB equivalent.
 *
 * 🎯 THE ONLY PROPERTY THIS FILE USES IS THE ORDERING, AND IT IS THE WHOLE OF ROUND 23. Both
 * pigments absorb blue harder than red — 3.270x for eumelanin and 5.615x for pheomelanin, computed
 * from the rows above — so a fibre's transmitted colour
 * `exp(−k σa)` has **R > G > B at every concentration** — there is no melanin mixture, and no
 * amount of either pigment, that produces a hair with more blue in it than red. An albedo with
 * B > R is not a dark hair colour; it is a dark colour that no hair has.
 */
export const HAIR_MELANIN_ABSORPTION = {
    eumelanin: [ 0.419, 0.697, 1.37 ],
    pheomelanin: [ 0.187, 0.4, 1.05 ]
};

/**
 * 🔴 THE LOOK SPEC'S `#150F17` IS R21 G15 B23 — MORE BLUE THAN RED — AND THAT IS THE DEFECT FIVE
 * BLIND CRITICS REPORTED ACROSS FIVE ROUNDS AS "lavender", "mauve", "aubergine", "grey-lilac" and
 * "purple blob". It was read as taste every time. It is not taste; it is a channel ordering that
 * no pigment produces, and it is one constant.
 *
 * ## What was measured before this constant moved
 *
 * On `?bare&freeze&seed=1&aa=msaa&grade=0&hair=1` at 900x1200, over the 483,378 px solid hair mask
 * this file's gate already builds, the rendered mass read CIELAB **hue 334.3°, C\* 15.62, b\*
 * −6.77, with 97.8% of hair pixels on the cool side of neutral**. The same measurement with this
 * constant's chromaticity removed and nothing else changed — `#121212`, same luma, zero chroma —
 * read **hue 16.5°, b\* +1.19, cool share 29.1%**. The albedo is not a contributor to the cast; it
 * is the cast. `docs/research/hair.md` §0.00 carries the attribution of the other four suspects,
 * each measured alone on the same run: the grade moves the hue 3.5° and in the WARM direction, the
 * rim and kicker carry about half what the albedo does, and TRT — the `C^(0.8/cosθd)` path that
 * would exaggerate any cast the albedo has — contributes 0.6% of the mass's lightness on this rig,
 * because it is retroreflective and the portrait rig has no light near the view axis.
 *
 * ## The derivation, which has one free parameter and it is not free
 *
 * Two of the three CIELAB coordinates are the shipped value's own, unchanged:
 *
 *   **L\*** — the spec's *"base albedo is essentially black, luma 0.067"* is the one clause in that
 *   entry with a measurement behind it, and holding L\* holds the linear Rec.709 luma exactly
 *   (L\* is a function of Y alone). 5.0851, i.e. Y = 5.6294e−3.
 *
 *   **C\*** — 5.6464, kept because nothing measured this round says the AMOUNT of colour is wrong.
 *   The rendered mass carries C\* 15.6 against the reference's own recorded hair chroma of 2.97 at
 *   the fringe p50 and 14.40 at its p99 (`docs/research/hair.md` §2.1, re-derived into CIELAB this
 *   round); that is the right order of magnitude. What is wrong is where it points.
 *
 *   **h** — 26.4886°, and this is the derived half. It is the CIELAB hue of the eumelanin
 *   transmittance `exp(−k σa,e)` at the concentration `k = 9.2174` that lands that transmittance on
 *   the spec's own luma. So the direction comes from the pigment and the brightness comes from the
 *   measurement, and there is no third input.
 *
 * The result is a **70.2° hue rotation and nothing else**: `#150F17` → `#1A0E0C`, linear
 * (1.05058e−2, 4.36057e−3, 3.83671e−3), R > G > B at last.
 *
 * ⚠️ **THE PURE-PIGMENT COLOUR ITSELF WAS TRIED FIRST AND IT IS WRONG, WHICH IS WHY THE ROTATION
 * KEEPS `#150F17`'s CHROMA.** `exp(−9.2174 σa,e)` is (2.102e−2, 1.621e−3, 3.279e−6) — `#280500`,
 * C\* 17.73, blue extinguished — and it is *physically* the transmittance of black hair, which is
 * genuinely deep red-orange held to a light. Rendered, it reads **hue 29.8°, C\* 44.30**: a vivid
 * rust head of hair, three times the reference's recorded chroma, and unusable. The reason is
 * slide 39's multiple-scattering fake, which carries 65% of the groom's energy and paints the whole
 * mass in `sqrt(colour)`; on this shader the albedo's chromaticity is broadcast rather than
 * confined to a lobe. That is a finding about the FAKE and it is filed as one — the albedo's job
 * here is to point warm, not to carry the mass's colour, which is what the look spec has said all
 * along: *"near-black albedo whose apparent colour comes almost entirely from the specular lobes."*
 *
 * ⚠️ `alive.js`'s `CARD_ALBEDO_FLOOR` is still the OLD hex and it is the eyelash and eyebrow
 * floor, not this groom. It was chosen for being the spec's published value, so it follows this
 * constant; that file is not this round's to edit.
 */
export const HAIR_BASE_COLOUR_HEX = 0x1A0E0C;

/**
 * The derivation above, executed rather than trusted, so `HAIR_BASE_COLOUR_HEX` is checkable and
 * the material can use the exact linear triple instead of its 8-bit rounding — which costs 0.15 of
 * C\* and 2.9° of hue, small against the 4.5° the plate itself moves between harnesses, but free
 * to avoid.
 *
 * @param {number[]} [absorption] - a pigment's per-channel cross-section. Eumelanin by default;
 *   pheomelanin is offered so the selftest can show the ordering claim does not rest on one row.
 * @returns {{ linear:number[], hex:number, hue:number, concentration:number, lightness:number, chroma:number }}
 */
export function baseColourDerivation( absorption = HAIR_MELANIN_ABSORPTION.eumelanin ) {

    const specified = [ 0x15, 0x0F, 0x17 ].map( ( byte ) => encodedToLinear( byte / 255 ) );
    const [ lightness, a, b ] = linearToLabValue( specified );
    const chroma = Math.hypot( a, b );
    const luma = ( colour ) => 0.2126 * colour[ 0 ] + 0.7152 * colour[ 1 ] + 0.0722 * colour[ 2 ];

    // The concentration that puts the pigment's own transmittance on the spec's measured luma.
    // Bisection rather than a solve: the luma is strictly decreasing in k, so 200 halvings of
    // [0,60] pin it to well under a float's worth of the answer, and the code says what it means.
    let low = 0;
    let high = 60;

    for ( let step = 0; step < 200; step ++ ) {

        const middle = ( low + high ) / 2;

        if ( luma( absorption.map( ( sigma ) => Math.exp( - middle * sigma ) ) ) > luma( specified ) ) low = middle;
        else high = middle;

    }

    const concentration = ( low + high ) / 2;
    const pigmentLab = linearToLabValue( absorption.map( ( sigma ) => Math.exp( - concentration * sigma ) ) );
    const hue = ( Math.atan2( pigmentLab[ 2 ], pigmentLab[ 1 ] ) * 180 / Math.PI + 360 ) % 360;

    const linear = labToLinearValue( [ lightness,
        chroma * Math.cos( hue * Math.PI / 180 ), chroma * Math.sin( hue * Math.PI / 180 ) ] );

    const hex = linear
        .map( ( channel ) => Math.round( Math.min( 1, Math.max( 0, linearToEncoded( channel ) ) ) * 255 ) )
        .reduce( ( packed, byte ) => ( packed << 8 ) | byte, 0 );

    return { linear, hex, hue, concentration, lightness, chroma };

}

/**
 * 🚩 THE MOST EXPENSIVE MISREADING AVAILABLE IN 3.5, WRITTEN DOWN SO IT CANNOT BE MADE AGAIN.
 *
 * The punch-list says hair's specular-to-albedo contrast is "~10:1". That figure is an **ENCODED**
 * luma ratio — `tools/critic/color.mjs`'s own header records that the whole look spec was measured
 * in that domain — and the spec's own highlight band is 0.60–0.75 encoded against a 0.0661 encoded
 * base, i.e. 9.08 : 10.21 : 11.35. Re-derived in this session, and internally consistent.
 *
 * In LINEAR light, which is the space a shader actually multiplies in, the SAME band is
 * **56.6 : 73.4 : 92.8**. A build that writes `specular = albedo × 10` into a linear shader lands
 * six to nine times too dim and every plate taken from it will read as flat hair.
 *
 * Both numbers are carried, named for their domain, and the selftest asserts they describe the
 * same band rather than two different claims.
 *
 * ⚠️ `baseEncodedLuma` STAYS `#150F17`'s 0.0661 NOW THAT THE SHIPPED ALBEDO IS `#1A0E0C`, AND THAT
 * IS NOT AN OVERSIGHT. This ratio benchmarks our band against the REFERENCE's albedo — the spec's
 * own published 0.067 — and that measurement did not change when ours did. Round 23's rotation held
 * the linear luma exactly, so the two hexes differ by 0.0018 in the encoded domain (0.0643 against
 * 0.0661): under a tenth of the gap the contrast clause is failing by, and in the conservative
 * direction.
 */
export const HAIR_CONTRAST = {
    baseEncodedLuma: 0.0661,
    baseLinearLuma: 0.005629,
    bandEncoded: [ 0.60, 0.675, 0.75 ],
    encodedRatio: [ 9.08, 10.21, 11.35 ],
    linearRatio: [ 56.6, 73.4, 92.8 ]
};

/**
 * THE STRAND PITCH, in metres of scalp, and it is the frequency half of the shading's strand
 * structure. See the header for why the amplitude and the frequency come from different places.
 *
 * A pitch cannot be authored in texels here — there are none — so it is authored in the one unit
 * the groom and the eye agree on and converted per fragment through the card's own `|∂P/∂u|`.
 * Three measurements this session fix it, all off the LIVE page rather than off a file, because it
 * is the live page's skinning and the live page's camera that the shader divides by:
 *
 *   1. The card's PHYSICAL width, from the hair mesh's own POSITION and TEXCOORD_0 by inverting the
 *      UV Jacobian per triangle: `|∂P/∂u|` p10 0.1201, **p50 0.2299**, p90 0.3466 m per unit atlas
 *      u over 15,912 triangles. A strip is an eighth of u, so a card is **28.7 mm** wide.
 *      🎯 Measured TWICE and they agree to the digit: on the live page with the skinning applied and
 *      taken into VIEW space, which is the space `positionView` is in, and off `g050.glb`'s bind
 *      pose in its own local space. So the figure carries no scale and the shader's `|∂P/∂u|` is
 *      metres of scalp with nothing in between.
 *      ⚠️ `hair_texture.py`'s header says "roughly 30 mm" in one paragraph and "a 42 mm card" in
 *      another; neither is this number and the sizing that depends on either is out by up to 1.5x.
 *   2. The card's SCREEN width on the shipped plate, from `hair_screen.mjs`: **55.3 CSS pixels**
 *      early in the session and **59.6** after a groom re-bake landed in the tree from another
 *      agent mid-round. The page renders at `resolutionScale` 0.66, so those are **36.5 and 39.4
 *      scene-pass pixels** — and the scene pass is the rate that decides anything, because the
 *      coverage and the shading are computed once per one of those. One scene-pass pixel is
 *      therefore 0.79 mm of scalp at portrait framing, or 0.73 after the re-bake.
 *   3. The band limit follows from those two alone, and it is one division: a field of `n` locks per
 *      card runs at `n / 36.5` cycles per scene-pass pixel, so `strandFadeStart` at 0.25 admits
 *      **9.1 locks a card** at the narrower of the two and 9.9 at the wider.
 *
 * 🎯 SO THE PITCH IS THE FINEST ONE THE PASS CARRIES WHOLE AT THE NARROWER FRAMING: 28.7 mm over
 * 9.1 is **3.15 mm**, four scene-pass pixels a lock, and it is inside the fade on both grooms —
 * 0.249 cycles a pixel on the first and 0.231 on the second, against a fade that opens at 0.25. The
 * margin on the first is 0.3% and that is not an accident, it is the definition: any coarser and
 * the pitch is not the finest one carried whole. ⚠️ A groom whose cards get NARROWER on screen
 * moves the limit, and the selftest clause is deliberately tight enough to go red when it does.
 * Going finer does not buy finer hair, it buys the fade — swept on the
 * shipped arm this session against the `no-strand-jitter` arm, the delivered per-pixel difference
 * over 540,404 hair pixels reads sd 4.80 / 7.02 / 8.05 / 9.43 code values at 1.2 / 2.05 / 3.0 /
 * 4.0 mm, and the 1.2 mm arm is DOWN because at 0.66 resolution scale its own band limit has
 * removed it. Coarser than about 4 mm the 4x crop stops reading as locks and starts reading as fat
 * ribbons, which is where the sweep is bounded from the other side.
 *
 * 🚩 AND THE SHEET'S OWN LANE PITCH IS INSIDE THAT LIMIT RATHER THAN OUTSIDE IT, WHICH IS ROUND 20
 * RESTATED IN MILLIMETRES. `hair_texture.py`'s strip 1 is 13 lanes over 112 texels of a card, i.e.
 * a 2.4 mm lane on the 28.7 mm card the page actually draws — **0.39 cycles per scene-pass pixel,
 * 78% of Nyquist**. The alpha channel is authored just under the limit and then asked to survive a
 * trilinear filter as well; the shading is authored one fade-band inside it and has no filter to
 * survive. That is the whole difference between the two carriers, in one comparison.
 */
export const HAIR_STRAND_PITCH = 0.00315;

// --- the LOCK band, round 24 ---------------------------------------------------------------------
//
// 🎯 THE COMPLAINT IS A FREQUENCY COMPLAINT AND THE ANSWER IS A SECOND BAND. Six blind judges —
// three shown our groom and three shown an independent 11.4k-strand renderer — said the mass has no
// lock hierarchy, in these words: *"one flow field, one scale, no hierarchy"*, *"a single combed
// sheaf with PER-PIXEL NOISE STANDING IN FOR STRUCTURE"*, *"missing every intermediate level
// between one mass and individual filaments"*. `docs/CHECKPOINT.md` §4.
//
// The mechanism is `momentchan/false-earth` (MIT, three.js TSL, WebGPU compute — our exact stack),
// `src/components/grass/core/grassCompute.ts`, `getClumpInfo` lines 187–224. A 3x3 scan over hashed
// cell points tracks BOTH the nearest and the second-nearest site — `minD2`/`bestID` and
// `secondMinD2`/`secondBestID` — and blends the clump's attributes by the F2−F1 edge distance:
//
//     centerFactor = smoothstep( 0, uClumpBlendSmoothness, d2 − d1 )
//     blendFactor  = mix( 0.5, 1.0, centerFactor )
//
// It then multiplies base colour by `mix( uClumpSeedRange.x, .y, vClumpSeed )` SEPARATELY from its
// per-blade seed term. **That separation is the whole point: two independent frequency bands.**
//
// ## 🚩 WHAT THE GROOM'S LOCK IDENTITY ACTUALLY IS, READ OFF THE GENERATOR RATHER THAN ASSUMED
//
// `tools/figure-pipeline/hair_cards.py` has a real one and it is not in the mesh:
//
//   - `LOCK_COUNT = 16` centres are dart-thrown over the scalp ONCE and shared by every layer, so
//     "a lock is a column of hair from the scalp to the tip" — the file's own words, and it records
//     that per-layer locks were tried first and read as five independent grooms stacked.
//   - every card is assigned by `nearest_lock( locks, root )` — a VORONOI ON THE SCALP — and is
//     drawn toward that centre's guide by `clump · s^1.7`, so cards of one lock are spread over
//     their Voronoi cell at the root and coincident at the tip.
//   - `LOCK_DIRECTION_SHARE = 0.75`: three quarters of a card's deflection and curl belong to the
//     LOCK, not to the card.
//
// 🔴 **AND NONE OF IT REACHES THE SHADER.** `assemble_cards` writes a UV whose `u` is the card's
// ATLAS STRIP (`left_column`/`right_column`, one of eight) and whose `v` is root-to-tip. Every card
// on a strip carries the same `u`. The GLB's attributes are POSITION / NORMAL / TEXCOORD_0 /
// JOINTS_0 / WEIGHTS_0 and nothing else — there is no lock id, no card id, and no per-card UV
// offset to derive one from. `flow.png`'s fourth channel promises *"a strand id"* and cannot carry
// one, for the reason `strandTangentJitter` already records: the mean of two labels is not a label.
//
// 🎯 **SO THE LOCK IDENTITY IS RE-DERIVED IN SPACE, WHICH IS WHERE THE GENERATOR PUT IT.** The
// generator's membership test is nearest-centre over the scalp; the retarget is a hashed-cell
// Voronoi over `positionGeometry.xz` — the BIND-POSE horizontal plane — which is false-earth's flat
// XZ root grid with the ground swapped for the head's own axis. That gives cells which are vertical
// COLUMNS, which is what the generator says a lock is, and it has three properties a per-card
// random value does not:
//
//   1. **Neighbouring cards share it.** Two cards 10 mm apart are in the same cell whatever strip,
//      layer or width they have. A per-card hash would decorrelate them, which is the definition of
//      the frizz `LOCK_DIRECTION_SHARE` exists to prevent — and it is why the round brief refuses a
//      per-card value as "filament noise at a coarser scale".
//   2. **It is stable.** `positionGeometry` is the pre-skinning, pre-morph attribute, so the field
//      is welded to the groom rather than to the camera, the frame or the pose.
//   3. **It spans the layers.** The `root`, `mass`, `body`, `surface` and `flyaway` cards at one
//      azimuth get ONE value, which is the shared-centres property the generator went out of its
//      way to build.
//
// ⚠️ **AND THE ONE PLACE IT DIVERGES FROM THE GENERATOR, STATED.** A card that wanders horizontally
// — the crown, where hair radiates before it falls — crosses cells along its own length, so its
// lock value changes down the shaft. The generator's does not. This is the same limitation the
// source sweep names in false-earth: *"Root-space membership only… a hair strand is a curve"*. The
// honest reading is that this term is a lock-scale FIELD, not a per-strand lock membership, and the
// experiment is a test of whether a field at that frequency is what the judges were missing.

/** `hair_cards.py`'s own `LOCK_COUNT`. Not a parameter here — a fact about the groom being shaded. */
export const HAIR_LOCK_COUNT = 16;

/**
 * The horizontal radius the groom's mass actually sits at, in metres, measured off the shipped
 * `assets/hair/bob01/g050.glb`: the p50 of every vertex's distance from the groom's own vertical
 * axis (the median of x and z over 17,516 vertices, which lands at x −43.6 mm, z +49.5 mm).
 *
 * p10 44.8 mm, **p50 88.1 mm**, p85 131.6 mm, p99 156.1 mm. The p50 is used because it is the
 * radius at which the MASS is, and the mass is what carries a lock a viewer can read; the p85 and
 * beyond are the `flyaway` layer, whose whole job is to break the silhouette.
 */
export const HAIR_LOCK_MASS_RADIUS_M = 0.0881;

/**
 * THE LOCK CELL, in metres, and it is a division rather than a taste.
 *
 * A lock is a column, so what a viewer resolves is the AZIMUTHAL spacing between columns at the
 * radius the mass sits at — which is exactly the coordinate `tools/figure-pipeline/hair_locks.mjs`
 * argues in, and for its stated reason: *"locks catch the key light on their crowns and go dark in
 * the grooves between them"*, so the geometric property under the read is ridges running down the
 * outer surface. Sixteen of them around a circle of radius `HAIR_LOCK_MASS_RADIUS_M`:
 *
 *     2π × 88.1 mm / 16 = **34.6 mm**
 *
 * 🚩 **AND AT OUR CAPTURE SCALE THAT IS 53 PIXELS, WHICH IS ABOVE THE 10–40 px THE ROUND NOMINATED
 * AS THE LOCK BAND.** A card is 28.7 mm of scalp and 44 px of a 720-wide portrait, so 1 px is
 * 0.652 mm. The groom's own lock level is therefore COARSER than one card and coarser than the band
 * the brief guessed at. That is a finding about the brief rather than a number to tune: the groom
 * has sixteen locks because `hair_cards.py` chose sixteen, and shading a different count would be
 * shading a lock structure the geometry does not have.
 *
 * A second derivation lands in the same place and is worth recording because it uses a different
 * measurement: the groom's horizontal FOOTPRINT, by 2 mm grid occupancy over the same vertices, is
 * 28,684 mm² (equivalent circle radius 95.6 mm), and `√(28684/16)` is **42.3 mm**. The two bracket
 * the answer at 34.6–42.3 mm; the smaller is shipped because the azimuthal one is the coordinate
 * the eye reads and the footprint one counts the crown, where locks converge rather than tile.
 */
export const HAIR_LOCK_CELL_M = 2 * Math.PI * HAIR_LOCK_MASS_RADIUS_M / HAIR_LOCK_COUNT;

/**
 * false-earth's `uClumpBlendSmoothness`, in CELL units, and the derivation is a band-limit argument
 * rather than a look.
 *
 * `d2 − d1` is zero on a cell boundary and grows to roughly half a cell at a cell core, so a
 * smoothstep over `[0, f]` puts the whole seed transition inside a strip `f` cells wide. At `f = 0`
 * the field is piecewise constant — a Voronoi with hard edges — and **a step is broadband**: it
 * would deposit energy in the filament band this term is supposed to leave alone, and it would
 * alias under motion the way `strandNoiseValue`'s header says a `floor` of the phase would.
 *
 * 0.5 is the largest value that still leaves a cell core: the transition then spans half a cell
 * either side of every boundary and the field has no spatial content above its OWN cell frequency.
 * That is the property that makes this a BAND rather than a new source of broadband noise, which is
 * the entire claim the round is testing.
 */
export const HAIR_LOCK_BLEND_FRACTION = 0.5;

/**
 * 🎯 THE AMPLITUDE, AS THE PEAK-TO-PEAK MULTIPLICATIVE SPREAD OF THE LOCK'S BASE COLOUR, SOLVED
 * FROM TWO MEASUREMENTS RATHER THAN CHOSEN. Every number below was measured this round on
 * `?bare&freeze&seed=1&hair=1&aa=msaa&grade=0` at 720x900 through `tools/critic/band-power.mjs`,
 * over the eroded solid-hair mask that file builds.
 *
 * **The rule.** The round's hypothesis is that a band is MISSING, so the non-arbitrary amount to
 * put into it is what already reaches that band by another route. The existing per-fragment strand
 * field — isolated by `?hairdefect=no-strand-jitter`, so the two arms differ in one rotation and
 * nothing else — is that route, and matching it is the rule: **this term delivers into the lock
 * band exactly what the incoherent strand field already delivers there.** Below that the new
 * structure is quieter than the noise it is meant to replace; above it, the term is louder than any
 * texture term this project has accepted.
 *
 * 🔴 **AND THE FIRST MEASUREMENT PARTLY REFUTES THE HYPOTHESIS AS THE ROUND STATED IT.** "We vary
 * at filament scale and mass scale with NOTHING at lock scale" is false: the strand field delivers
 * **13.39% of the plate's mean in the filament band and 13.69% in the lock band** (portrait, 5/41
 * px boxes, 120,069 px). One-dimensional value noise is FLAT below its own lattice frequency and
 * its phase is decorrelated card to card, so it fills the lock band with noise. What is absent at
 * lock scale is not power — it is COHERENCE, power that neighbouring cards share. That is what this
 * term adds and it is the sharpened claim.
 *
 * **The band split had to be corrected before the solve, and that is a finding too.** The round
 * nominated 10–40 px as the lock band. The groom's own lock cell is `HAIR_LOCK_CELL_M` = 34.6 mm =
 * **53 px** at this framing, which is OUTSIDE that band and coarser than a card. Read with 5/41 px
 * boxes this term lands mostly in the MASS band (0.98 / 1.09 / 2.63 filament / lock / mass at
 * s = 0.30) and looks like a failure; read with 11/121 px boxes, whose lock band actually contains
 * 53 px, it lands where it was aimed (1.03 / 2.11 / 1.61). Same plates, same operator, one
 * parameter — see `tools/critic/band-power.mjs`, whose validation is analytic at any box width.
 *
 * **The transfer, which is why an image-domain amplitude lands three times short.** An albedo
 * multiplied by `m = 1 + ε` does not move the plate by `ε`, because two of the four terms carrying
 * the groom's radiance never read the albedo:
 *
 *   | term                                              | share of median radiance | response to `m` |
 *   |---------------------------------------------------|-------------------------:|-----------------|
 *   | indirect (3.10's composite; `indirect()` is empty) | 9.7 %                    | none            |
 *   | slide 39's multiple-scattering fake                | 59.0 %                   | `√m`            |
 *   | R                                                  | 31.1 %                   | none — R never enters the fibre |
 *   | TRT                                                | 0.5 %                    | `m^(0.8/cosθd)` ≈ `m^0.85` |
 *
 * Shares are this file's own: 9.7% from `indirect()`'s note, 65.4/35.0 of the remainder from
 * `HAIR_DEFAULTS.scatter`'s, TRT's 0.6% of lightness from `HAIR_BASE_COLOUR_HEX`'s. So
 * `dL/L ≈ 0.590·(ε/2) + 0.005·0.85ε = 0.300 ε`.
 *
 * **The solve.** The delivered fraction that lands inside a band has no closed form — it depends on
 * the Voronoi's spectrum against the box widths — so it was measured at a nominal `s = 0.30` and
 * scaled, the response being linear in `s` to first order:
 *
 *   | view          | strand field, lock band | this term at s = 0.30 | solved s | px     |
 *   |---------------|------------------------:|----------------------:|---------:|-------:|
 *   | portrait      | 10.595 %                | 2.114 %               | 1.504    |  4,779 |
 *   | three-quarter |  7.141 %                | 1.719 %               | 1.246    | 61,741 |
 *
 * Weighted by measured pixels — the portrait's mask is small because an 11/121 decomposition erodes
 * 60 px and the portrait's hair is narrower — the solve is **1.26**, which is shipped.
 *
 * ⚠️ **AND THE BOUND IS 2.** `HAIR_LOCK_SPREAD_MAX` is the widest a multiplicative albedo can be
 * before a lock goes negative, so this constant sits at 63% of the arithmetic ceiling. There is no
 * headroom argument left: if a louder lock band were wanted it would have to come from a different
 * quantity than the albedo.
 */
export const HAIR_LOCK_ALBEDO_SPREAD = 1.26;

/**
 * The widest a MULTIPLICATIVE albedo spread can be, and it is arithmetic: the multiplier is
 * `1 ± s/2`, so `s = 2` is locks running 0x to 2x the base colour and anything above it asks for a
 * negative albedo. Reached by `?hairdefect=lock-albedo-max`, and its whole job is to bound the
 * hypothesis — a lock band that does not move at the physical maximum cannot be moved by tuning.
 */
export const HAIR_LOCK_SPREAD_MAX = 2;

// --- the LOBE WIDTH, round 26 --------------------------------------------------------------------
//
// 🎯 R26'S ONE LEVER, AND IT IS A CHOICE **INSIDE** MARSCHNER'S BAND RATHER THAN A NEW NUMBER.
//
// The round opened with a blind judge answering "is the specular one broad band or broken across
// bundles?" with a third option — *"there is no lobe"* — and a decomposition then measured why.
// Over 216,745 gated hair pixels of the judged URL, with the primary lobe isolated and the mass
// measured on the same arm, R's 99th percentile was **1.026x the mass mean** and its single
// brightest pixel **1.107x**. The specular term's bright end was landing on the AVERAGE brightness
// of the mass it is meant to sit on top of. Not missing — measured at 41.7% of the mass — but flat.
//
// ## 🚩 THE UNIT ERROR THAT NEARLY SENT THIS ROUND SOMEWHERE ELSE, AND IT IS THE FIFTH INSTANCE
//
// The diagnosis that commissioned this change reported the shipped width as *"`roughnessR` is 0.26
// rad = 14.9° against Marschner's β_R of 5–10°"* and filed it as a defect. **It is not one.** This
// file's own header derives the conversion at length: M_p's argument in Karis' form is
// `sinθi + sinθr`, not Marschner's half-angle θh, so a width converts as `β_K = 2 β_M`. The shipped
// 0.26 is `β_M = 0.130000 rad = 7.4485°` — the MIDDLE of Table 1's 5–10° — and `HAIR_DEFAULTS`
// already said "mid-band of 0.1745…0.3491" two lines from the value. Reading β_K as β_M is a factor
// of two, and it turned "authored mid-band" into "50% wider than the paper's widest sample".
// `docs/LEARNINGS.md` §1.25r, fifth instance: **a number in prose is a claim and nothing in the
// tree checks it.** `tools/critic/hair-lobe-sweep.mjs --selftest` is now the clause that does.
//
// So the lever is not "the lobe is wider than physics allows". It is that **β_R is one of this
// model's two free parameters and it was authored at the middle of its range by default rather
// than by measurement**, and the measurement now exists.
//
// ## THE SWEEP, ON PIXELS, ON THE JUDGED URL
//
// `tools/critic/hair-lobe-sweep.mjs`, 216,745 pixels that are inside the twice-eroded groom mask,
// below the hair-shaded gate and invertible in all 21 arms. Every row reads R alone against the
// mass **rendered at the same β**, so the ratio is a property of that arm and not of last round's
// plate. Rendered at `toneMappingExposure` 4 and inverted at 4, because a single lobe on a #1A0E0C
// fibre lands at code 2–12 and the 8-bit floor would otherwise discard most of the groom.
//
//   | β_K      | β_M      | R p99     | mass mean | **R p99 / mass** | R peak / mass | >2x R's own mean |
//   |----------|----------|-----------|-----------|------------------|---------------|------------------|
//   | 0.349066 | 10.000°  | 5.146e-2  | 6.320e-2  | 0.814            | 0.862         |  3.228%          |
//   | 0.26     |  7.448°  | 6.785e-2  | 6.612e-2  | **1.026**        | 1.107         |  8.548%          |
//   | 0.20     |  5.730°  | 8.560e-2  | 6.814e-2  | 1.256            | 1.392         | 12.822%          |
//   | 0.174533 |  5.000°  | 9.585e-2  | 6.896e-2  | **1.390**        | 1.584         | 14.852%          |
//   | 0.12     |  3.438°  | 1.260e-1  | 7.045e-2  | 1.789            | 2.266         | 18.095%          |
//   | 0.08     |  2.292°  | 1.594e-1  | 7.106e-2  | 2.243            | 3.354         | 20.656%          |
//
// The last two rows are **outside Marschner's band** and are not candidates — nothing in either
// source licenses a fibre smoother than the smoothest one measured. They are there so the trend has
// a shape, and they carry the round's real forward finding: a band that a shape statistic can see
// at all (0.90% and 4.91% of the groom above 4x R's own mean, against **0.0000% at every setting
// inside the band**) only appears below 5°. **Narrowing the lobe is not the whole gap.**
//
// ## WHY THE OTHER TWO KNOBS THE DIAGNOSIS NAMED ARE NOT THIS
//
// Both were swept in the same run, on the same pixels, and both fail on the same test — they move
// the LEVEL and not the SHAPE, which is `docs/research/hair.md` §9.4's own discriminator:
//
//   * `scatter` 1 → 0.25 reads a better ratio (p99/mass 1.735) by **darkening the whole groom 40.9%**
//     (mass mean 6.612e-2 → 3.910e-2) while R's own p99 stays at 6.785e-2 to every printed digit —
//     the three plates are BYTE-IDENTICAL, which is the run's own null control. That is
//     CHECKPOINT §2's floor-limited contrast with the floor in the numerator, and it is a
//     brightness cut wearing a contrast ratio.
//   * `weightR` 1 → 4 reads 1.932 by making R 74.1% of the mass. Karis gives no such scalar; 1 is
//     the form. Multiplying a flat term by four gives a brighter flat term.
//
// Narrowing β does neither: R's p99 rises **41.3%** while R's own MEAN rises **10.6%** and the mass
// mean rises **4.3%**. Same energy, more concentrated. That is what a lobe is — M_p normalises by
// `1/(β√2π)`, so moving from the band's midpoint 0.261799 to its narrow end raises the lobe's PEAK
// by exactly the WIDTH RATIO, `HAIR_BETA_R_MID / HAIR_BETA_R` = **1.500000x**, while conserving the
// term's energy — which is the arithmetic behind the whole table.
//
// 🔴 THAT NUMBER READ 1.4897x WHEN THIS ROUND SHIPPED IT, AND THIS ROUND'S OWN NEW GATE PASSED IT.
// 1.4897 is `0.26 / 0.174533` — the ratio against the value β_R happened to hold BEFORE this change
// (a taste default from R13), not against the band midpoint the sentence names. The true answer is
// **1.5 by construction and not by measurement**: Marschner's band is [2·sin 5°, 2·sin 10°] in the
// Karis convention, so its midpoint is exactly 1.5× its narrow end and no plate is involved.
//
// Fifth instance of LEARNINGS §1.25r, and the informative part is HOW IT SURVIVED: the gate built
// in this very round to catch exactly this only checks TAGGED claims, and this sentence was not
// tagged. It is now. **A gate's coverage is part of its verdict** — `quoted-numbers` reports 9
// tagged claims against 23,497 numerals in comment prose, 0.038%, and prints that fraction on every
// run precisely so a green result is never mistaken for a checked tree.
//
// ## 🎯 TAGGED CLAIMS — the six numbers above that a gate now re-derives
//
// This block exists because the round it belongs to began with a wrong number in prose, so the five
// conversions it argues from are tagged for `tools/quoted-numbers.mjs`: it runs the producer and
// compares. The measured table above is NOT tagged and cannot be — its producer is a 21-arm capture
// against a live GPU — and saying so is the point of the gate's own coverage line. What is checked
// is every number that is arithmetic.
//
// @claim 0.174533 :: node tools/critic/hair-lobe-sweep.mjs --selftest :: derived  band in Karis variable #1
// @claim 0.349066 :: node tools/critic/hair-lobe-sweep.mjs --selftest :: derived  band in Karis variable #2
// @claim 0.261799 :: node tools/critic/hair-lobe-sweep.mjs --selftest :: derived  band in Karis variable #3
// @claim 5.000 :: node tools/critic/hair-lobe-sweep.mjs --selftest :: derived  shipped width in Marschner degrees #1
// @claim 7.4485 :: node tools/critic/hair-lobe-sweep.mjs --selftest :: derived  shipped width in Marschner degrees #2
// @claim 1.4897 :: node tools/critic/hair-lobe-sweep.mjs --selftest :: derived  peak ratio, previous midpoint over shipped width #1

/** Marschner 2003 Table 1 p8's measured β_R, in HIS variable, in degrees. The source, verbatim. */
export const HAIR_BETA_R_MARSCHNER_DEGREES = [ 5, 10 ];

/**
 * The same band in KARIS' variable, which is the one this material stores and shades with.
 *
 * `β_K = 2 β_M` — see the header. Written as the expression rather than as `[0.174533, 0.349066]`
 * for `STRAND_NOISE_SD`'s reason: a literal here would silently stop being the right number the day
 * the conversion or the table was re-read, and this file has now watched exactly that mistake made
 * in prose by a round that had the header in front of it.
 */
export const HAIR_BETA_R_BAND = HAIR_BETA_R_MARSCHNER_DEGREES.map( ( d ) => 2 * d * Math.PI / 180 );

/**
 * 🎯 THE SHIPPED PRIMARY LOBE WIDTH: **the NARROW end of Marschner's measured band**, 0.174533.
 *
 * The band is a measurement across SAMPLES — different heads of hair — so choosing inside it is
 * choosing whose cuticle this groom has, and that is an authored identity decision that has to be
 * made from something. It is made from the sweep above: it is the largest primary-lobe contrast the
 * source permits, at a 4.3% change in the mass's brightness.
 *
 * **It is also the fix a red gate already nominated for itself.** `docs/research/hair.md` §9.4 and
 * the green proof inside this file's own contrast clause both record `β_R 0.26 → 0.1745` taking the
 * plate's radiance p95/p50 from 1.872 to **6.030** against a floor of 4.0 — one of only two arms
 * measured that clear it, the other being REQ-064's light move — and both say in as many words that
 * the gate is red partly because *"a lobe authored at the middle of its own range"*. This is that
 * sentence acted on.
 *
 * ⚠️ **AND IT IS ONE FREE PARAMETER, NOT FOUR.** `β_TT = β_R/2` and `β_TRT = 2 β_R` follow by
 * Marschner's own ratios, and `material.roughness` — the isotropic summary written to the G-buffer
 * — follows β_TRT. TT ships OFF (`weightTT` 0) so its width is inert on the judged plate; TRT is
 * 0.10% of the mass, measured. What moves the picture is R.
 */
export const HAIR_BETA_R = HAIR_BETA_R_BAND[ 0 ];

/**
 * The A side: the middle of the band, which is what shipped from round 13 through round 25.
 *
 * Reached by `?hairdefect=wide-lobe`. It is 0.261799 rather than the 0.26 literal the file carried,
 * because the literal was a rounding of this expression and the arm should be the DERIVED midpoint
 * — the two differ by 0.7%, which is 0.05° of β_M and below anything the sweep resolves.
 */
export const HAIR_BETA_R_MID = ( HAIR_BETA_R_BAND[ 0 ] + HAIR_BETA_R_BAND[ 1 ] ) / 2;

// --- the LOCK TILT, round 25 ---------------------------------------------------------------------
//
// 🎯 R24's DURABLE FINDING IS THAT ALBEDO IS THE WRONG QUANTITY, AND THIS IS THE RIGHT ONE.
// Grass clumps genuinely differ in albedo — different plants, different age, different dryness —
// which is why false-earth's `clumpSeed01` into base colour works there. **Every fibre on one head
// shares one melanin.** A lock reads as a lock because of SHADING: self-shadow, tilt, and the
// highlight breaking across it. Measured at the physical maximum, the albedo term read as PATCHY
// DYE and a blind judge could not tell the two arms apart at 1:1, 4x or 5x. `docs/CHECKPOINT.md` §7.
//
// The judges' own first mechanism, in their own order, was **the highlight breaking across locks**:
// *"one broad band"* where hair has one band per lock. That is a statement about M_p's argument,
// and M_p's argument is a function of the TANGENT.
//
// ## 🚩 AND THE LOCK ID IS NOW A VERTEX ATTRIBUTE RATHER THAN A FIELD RE-DERIVED IN SPACE
//
// R24 hashed a Voronoi over `positionGeometry.xz` because the GLB carried no lock id to read. R25's
// `hair_cards.py` emits the membership `nearest_lock()` has computed since R22 into **TEXCOORD_1**,
// which `GLTFLoader.js:2228` maps to the geometry attribute `uv1` and TSL's `uv(1)` reads — both
// verified against the installed three r185 rather than assumed. `u1` is `(index + 0.5)/16`,
// CONSTANT over a whole card, and `v1` is the Voronoi edge distance at the card's root.
//
// That is a different KIND of quantity from R24's field and the difference is the round:
//
//   * it is the GENERATOR'S OWN membership, not a re-derivation that happens to be at lock scale;
//   * it is a LABEL, so it is piecewise constant with hard boundaries — which is what "the highlight
//     BREAKS at a lock boundary" requires and what a smooth field cannot produce;
//   * it does not change down a card that wanders horizontally, which R24 recorded as the one place
//     its spatial retarget diverged from the generator.
//
// ## THE MECHANISM: A PER-LOCK TILT OF THE STRAND, WHICH IS AN α SHIFT IN DISGUISE
//
// Marschner's α is the cuticle tilt: the scale surfaces sit at an angle to the fibre axis, and the
// specular cone shifts because of it. A tilt of the FIBRE about an axis perpendicular to itself
// does the same thing to the same term, so the round's change is one rotation of `this.tangent`,
// out of the card's plane, by an angle that is constant across a lock and discontinuous between
// locks.

/**
 * 🎯 THE AMPLITUDE, AS THE PEAK-TO-PEAK TILT IN RADIANS, AND IT IS MARSCHNER'S OWN MEASURED BAND
 * RATHER THAN A TASTE VALUE.
 *
 * **The source.** Marschner, Jensen, Cammarano, Worley, Hanrahan, SIGGRAPH 2003, Table 1, page 8:
 * `α_R` is measured across their samples at **−10° … −5°**, a 5° band. `docs/research/hair.md`
 * carries the table and `HAIR_DEFAULTS` carries this file's conversion into Karis' variable,
 * `α_K = 2 sin α_M`, which puts the same band at `−0.3473 … −0.1743` — **0.17299 rad wide**.
 *
 * **The equivalence, which is what makes a tilt an α.** M_p's argument is `sinθi + sinθr` and the
 * shift enters as `(sinθi + sinθr) − α`. Rotating the tangent `t` by a small angle δ about an axis
 * `a ⊥ t` moves it by `δ(a × t)`, so
 *
 *     Δ( sinθi + sinθr )  =  δ · (a × t) · (ωi + ωr)
 *
 * whose magnitude is at most `2δ`, since `|ωi + ωr| ≤ 2`, and is exactly `2δ` in the aligned limit
 * `ωi = ωr` with `a` chosen in the longitudinal plane. **So a tangent tilt of δ is an α shift of up
 * to 2δ**, and a peak-to-peak tilt spread of `W/2` spans an α band of width `W`.
 *
 * **The solve.** Setting the α band this term spans equal to the band Marschner MEASURED:
 *
 *     spread = 0.17299 / 2 = **0.086492 rad = 4.956°**
 *
 * 🎯 AND THE TWO FACTORS OF TWO CANCEL, WHICH IS WHY THE ANSWER IS MARSCHNER'S 5° BACK AGAIN. The
 * ×2 in `α_K = 2 sin α_M` and the ×2 in the tilt-to-α equivalence divide out, so the shipped tilt
 * spread is `sin 10° − sin 5°` — the small-angle image of the very 5° band the paper reports. It is
 * written as that expression rather than as `0.086492` for the reason `STRAND_NOISE_SD` is: a
 * literal here would silently stop being the right number the day the band was re-read.
 *
 * **What it is worth against the lobe it is shifting.** `HAIR_DEFAULTS.roughnessR` is
 * `HAIR_BETA_R` = 0.174533, so the peak-to-peak α excursion of 0.172985 is **0.9911 of one lobe
 * width**. Two neighbouring locks at opposite ends of the band put their primary bands very nearly
 * one full width apart. That ratio is the whole design and it is the number to argue with, not the
 * radians.
 *
 * 🚩 **AND ROUND 26 MOVED IT, WHICH IS A COUPLING AND NOT A SECOND KNOB.** Through R25 this read
 * 0.6653 against a mid-band β_R of 0.26; narrowing β_R to Marschner's tight end left the tilt
 * spread untouched — it is derived from the α band and nothing else — and raised the RATIO to
 * 0.9911, i.e. from 33.3% of `HAIR_LOCK_TILT_MAX` to 49.56%. That is arithmetic, not authoring, and
 * the round measured what it costs rather than arguing it: with the lock tilt removed at the new β
 * (`?hairdefect=no-lock-tilt`) the groom's mass mean and R's peak/mass-mean move by less than the
 * run's own re-render drift. The tilt was worth ≤0.02x of peak/mass-mean at the old width and it is
 * worth no more at the new one, so a ratio that has grown by half has not brought a second free
 * variable with it. Stated here because a reader arriving at 0.9911 would otherwise reasonably
 * conclude the tilt had been re-authored.
 *
 * ⚠️ **AND IT IS A SPREAD, NOT AN OFFSET.** The hash is centred by subtracting 0.5, so the MEAN
 * tilt over the sixteen locks is within a few thousandths of zero (measured: hash mean 0.5192 over
 * indices 1…16, i.e. a residual bias of 0.0017 rad = 0.10°). The groom's overall highlight position
 * is therefore unmoved; only its continuity changes. A term that shifted the whole band would be a
 * change to `shiftR` wearing a lock's name.
 */
export const HAIR_LOCK_TILT_SPREAD = Math.sin( 10 * Math.PI / 180 ) - Math.sin( 5 * Math.PI / 180 );

/**
 * The bound on the tilt, and it is geometric rather than arbitrary: **the spread at which two
 * neighbouring locks' primary bands are separated by exactly one full lobe width.**
 *
 * The α excursion is `2 × spread`, and one lobe width is `β_R`, so the bound is `spread = β_R` =
 * `HAIR_DEFAULTS.roughnessR` = `HAIR_BETA_R` — and it is now the SAME CONSTANT rather than a
 * literal asserted equal to one. R26 changed β_R and this bound had to follow it; a second literal
 * would have been a silent drift of exactly the kind the assertion was written to catch, so the
 * assertion stays and the duplication goes.
 * At that setting the mass has no continuous highlight anywhere: every lock's band is disjoint from
 * its neighbour's, which is what a groom made of sixteen separate cylinders would look like and is
 * not a bob. Reached by `?hairdefect=lock-tilt-max`, and its job is the same as
 * `HAIR_LOCK_SPREAD_MAX`'s was — if the picture does not move at the structural maximum then no
 * setting of the shipped constant can move it, and the hypothesis is refused by arithmetic rather
 * than by taste. The shipped value is 49.56% of it — 33.3% through R25, moved by R26's narrowing of
 * β_R and not by any change to the tilt. See `HAIR_LOCK_TILT_SPREAD`.
 */
export const HAIR_LOCK_TILT_MAX = HAIR_BETA_R;

/**
 * `hair_cards.py`'s hash offset for the lock seed, and the one degenerate input it avoids.
 *
 * `strandHashValue( 0 )` is **exactly 0** — `fract(0 · 0.1031)` is 0 and every operation after it
 * multiplies by zero — so hashing the raw index would hand lock 0 the extreme end of the band by
 * construction rather than by chance. Offsetting by 1 gives sixteen seeds spanning 0.051…0.942 with
 * a mean of 0.5192, measured. `strandNoiseValue` has the same zero and does not care, because its
 * lattice cell 0 is one cell of thousands; here it would be one lock of sixteen.
 */
export const HAIR_LOCK_HASH_OFFSET = 1;

/**
 * The standard deviation of `strandNoiseValue`, in closed form, so the jitter uniform is the
 * jitter's own standard deviation IN RADIANS rather than the amplitude of some unnamed wave.
 *
 * One-dimensional value noise is `mix( h0, h1, s )` with `h ~ U[0,1]` independent per lattice cell
 * and `s = f²(3−2f)`. For fixed `f` the variance is `Var(h)·((1−s)² + s²)`; averaged over `f`
 * uniform on the cell, `E[s] = 1/2` and `E[s²] = 13/35`, so the variance is `(26/35)/12` and the
 * field mapped to [−1,1] has sd `2√(26/420) = 0.49761`. Written as the expression rather than as the
 * literal, because a literal here would silently stop being the right number the moment the
 * interpolant changed.
 */
export const STRAND_NOISE_SD = 2 * Math.sqrt( 26 / 420 );

// ================================================================================================
// 🎯 ROUND 28 — THE PEDESTAL'S DEPTH INPUT BECOMES GEOMETRY, BECAUSE THE SHEET IT READ IS NOISE
//
// R27's forward finding, and it is the only reason anything below exists: slide 44's `Shadow` is
// `exp(−shadowDensity · depth.png sampled at uv())` — THE CARD'S OWN ATLAS COORDINATE. One baked
// number per texel, shared by all 462 cards, and `tools/figure-pipeline/hair_texture.py` fills that
// sheet with `random.random()` per strand. It cannot vary with light direction, with head
// orientation, or with how many other cards lie between the fragment and a light. Zinke & Weber's
// `n` (EG 2008 Eq. 4-5) counts fibres along the SHADOW PATH; ours counted depth WITHIN ONE CARD'S
// BUNDLE. Right histogram, wrong spatial referent.
//
// 🚩 AND THE RIG BOUNDS WHICH REPLACEMENT IS REACHABLE. Every real-time source derives that depth
// from the LIGHT'S VIEW — Zinke §4.1.3, Frostbite slide 27, deep opacity maps — and this rig can
// only do that for the key SpotLight: three's `RectAreaLight` has no shadow code at all and
// RectAreaLights carry 66-73% of a hair pixel (CHECKPOINT §9). So deep opacity maps do NOT fit and
// Frostbite's own Tier-3 fallback does: `T_f = d_f · exp(−σ_hair · l)`, per channel, on a
// GEOMETRIC path length. Frostbite states its own limitation plainly and it is inherited here in
// full: it will not adapt to actual changes in hair volume.
//
// WHAT `l` IS HERE. The groom is not a surface — CHECKPOINT §2 measured its outer envelope as an
// ELEVEN-MILLIMETRE CLOUD (p85−p50 of 10.03-11.69 mm inside one 3°×30 mm bin) — but a cloud still
// has a fitted shape, and hair occupies the SHELL between the scalp and that shape. A ray from a
// fragment toward a light behind the head crosses that shell twice and the skull in between, where
// there are no fibres. So
//
//     l = (chord inside the OUTER ellipsoid, forward of the fragment)
//       − (chord inside the INNER ellipsoid, forward of the fragment)
//
// which is two quadratics, no loop, no map, and no shadow pass — and therefore available to the
// four RectAreaLights that can never have one.
//
// 🎯 MEASURED AGAINST THE ONE THING THAT IS GROUND TRUTH HERE, which is R27's CPU ray cast: the
// number of hair cards the segment from the visible fragment to each light actually crosses.
// `tools/critic/hair-envelope.mjs --geometry` re-ran that cast on this tree (its per-light means
// reproduce R27's to three figures: key 3.68 vs 3.665, fill 4.29 vs 4.286, rim 29.53 vs 29.673) and
// scored both inputs against it over 7,913 sampled pixels of the judged URL:
//
//   | input to `n`                        | ρ vs ray cast, key | fill  | rim   | POOLED, 3 energy lights |
//   |-------------------------------------|-------------------:|------:|------:|------------------------:|
//   | `depth.png` at the card's atlas uv  |             0.0207 | 0.1156| −0.0339|                  0.0598 |
//   | the envelope shell path length      |             0.5804 | 0.6525|  0.1339|                  0.6118 |
//
// The pooled column is over `key`, `key-shadow` and `fill`, which is where the energy is: CHECKPOINT
// §9 measured rim and kicker at 0.02-0.87% of a hair pixel. **A tenfold rise in rank correlation
// with the quantity the term is supposed to be a function of.**
//
// ⚠️ AND THE HONEST HALF OF THE SAME TABLE: the rim reads 0.13. An ellipsoid fitted to a bob has an
// RMS residual of 0.385 in its own radial coordinate, so the model is a poor description of the
// silhouette a back light rakes along, and it is not claimed to be better than that.
//
// ------------------------------------------------------------------------------------------------
// 🔴 AND THE ROUND IS A NEGATIVE ON THE PICTURE. NOTHING BELOW SHIPS. THE SHIPPED PLATE IS
// BYTE-IDENTICAL TO HEAD's — same SHA-256, same URL, same page, the two materials swapped under it.
//
// The input was the mandate and the input is fixed and PROVEN directional. Three legs, and the
// first is the one R27 asked for by name:
//
//   1. ONE TOKEN APART, ON PIXELS. `?hairdefect=envelope-depth` and
//      `?hairdefect=envelope-fixed-direction` share every line of this file — the same fitted shell,
//      the same σ, the same two chords, the same slide-39 form around them — and differ only in
//      whether the chord is taken toward the light. **160,646 of 225,126 gated hair pixels move
//      (71.36%)**, max |ΔRGB| p50 2.223e-3, p90 8.860e-3, against a noise floor of EXACTLY ZERO
//      measured on two loads of one URL. The shipped input cannot produce a single moved pixel on
//      that A/B, because it has no direction in its expression.
//   2. ARITHMETIC, NO PLATE. Moving the key from azimuth 42° to −20° with the camera fixed, over
//      the 7,913 fragments the ray cast measured: `n` toward the key goes **mean 4.7507 → 4.0654**,
//      |Δn| p50 1.5381, p90 4.5439, and only 0.45% of fragments are unchanged. For the sheet the
//      same move gives |Δn| = 0 at every percentile, by construction.
//   3. The plate-ratio form of R27's own operator agrees, at 2.86× the shipped arm and 2.44× the
//      fixed-direction control — reported with its quantisation caveat rather than as a headline.
//
// 🎯 AND THE PICTURE DOES NOT MOVE, FOR A REASON THAT IS IN THE ALGEBRA RATHER THAN IN THE INPUT,
// AND THAT HAS A HARD CEILING. Slide 39 spends `Shadow` on ONE thing: the chromaticity exponent
// `(C/Luma(C))^(1−Shadow)`. Sweeping that exponent across its WHOLE domain moves the term's
// luminance by **1.0927×** — measured by running `scatterValue`, the shipped CPU mirror, over
// `Shadow` ∈ [0, 1] (`HairEnvelope.selftest.mjs` §F2), and independently the same 1.0927 R27's
// `hair-transmittance.selftest.mjs` produced from plates. **That is the ceiling on what ANY depth
// input can buy inside this form**, however correct the input is, and R26 bought 1.19× of dynamic
// range from one lobe-width constant. R27 had already measured it from the third side: pedestal
// mean at shadowDensity 0 / 3 / 12 is 3.4916e-2 / 3.7420e-2 / 3.9466e-2, a 13.03% swing across a
// twelvefold change in the input.
//
// 🔴 ⚠️ AND THE TEMPTING ONE-LINE VERSION OF THAT ARGUMENT IS FALSE. "The factor divides the colour
// by its own luminance, so it is luminance-preserving and cannot change brightness" is true of the
// FACTOR — exactly 1 at both ends, checked to twelve decimals — and false of the TERM, because the
// factor multiplies `√C` CHANNEL BY CHANNEL and the two are positively correlated: the exponent
// boosts precisely the channel `√C` is already largest in, and `Luma(a ⊙ b) ≠ Luma(a)·Luma(b)`.
// R28's own gate shipped that wrong claim for one run, printed 0.00%, and was corrected by
// measuring the term instead of arguing about the factor. Both statements are now clauses.
//
// Measured on 225,126 gated hair pixels of the judged URL, at exposure 4, above the indirect floor.
// The last column is the pedestal ALONE, whose percentile RATIO is exactly invariant to `scatter`
// and therefore cannot be flattered by a level match — there is no level left in it to cut:
//
//   | arm                                          | R p99 / mass | mass p95/p50 | pedestal p95/p50 |
//   |----------------------------------------------|-------------:|-------------:|-----------------:|
//   | shipped — slide 39 on the baked sheet        |       1.4063 |       1.9753 |           1.4478 |
//   | slide 39 on the envelope path, σ 74.75       |       1.3705 |       1.9511 |           1.4449 |
//   | slide 39 on the envelope path, σ mean-matched|       1.4275 |       1.9818 |           1.4554 |
//   | 🔴 the same path toward a FIXED direction    |       1.3622 |       1.9471 |           1.4349 |
//
// **The pedestal's own shape moves by 0.21%.** `>4× R's own mean` is **0.0000% in every arm**, which
// is where R26 and R27 left it. The third row is the honest best case — σ set so the geometric `n`
// carries the SHIPPED `n`'s mean (1.1890 events, recovered off the plate pair with R27's operator),
// so the arms differ in the input's STRUCTURE and not in its level — and it is +1.5% on one
// statistic and +0.3% on the other. That is not a shipping case, and R26's own bar says why: it
// bought +19.0% on the same statistic from one constant.
//
// ⏭️ SO THE NEXT LEVER IS THE FORM, AND FOR THE FIRST TIME IT CAN BE TESTED — but not at this σ.
// Zinke's `√C^(1+n)` does spend `n` on energy, and with `n` at the card-crossing rate (mean 7.55
// over all five lights) the product ANNIHILATES the term: the pedestal reads p50 **1.434e-5** and
// p10 **0** against the shipped 3.719e-2, i.e. at and below what an 8-bit plate can carry, so its
// contrast statistics are a near-zero term amplified by a scalar of 248 and are not quoted as
// contrast. ⚠️ THE CONTROL SAYS THE SAME THING FROM THE OTHER SIDE: the SHEET input driven to the
// SAME mean `n` (`shadowDensity` 3 → 19.0483) annihilates it harder — pedestal mean 1.841e-5
// against the envelope input's 1.418e-4, a factor of 7.7 — which is the geometric input's structure
// showing through, and both arms are past the point where the form is measurable.
//
// ⚠️ `ā_f = √C` is 0.1016/0.0663/0.0606 — R27 took it from this material's own `absorbTT` at h = 0 —
// and the exponent the term raises it to is `1 + n` ≈ 8.5, which is nothing. The noise input hid it because it never drove
// `n` past ~1.6. **`ā_f` is the next untested constant in this term, and R28's contribution to the
// form question is that it is now the one that is obviously wrong.** No value is asserted here:
// Zinke Eq. 4-5 gives `d_f = 0.7` in [0.6, 0.8] and does not state ā_f's magnitude, and this
// project does not invent numbers.
//
// 🚩 CANDIDATE (B) IS REFUSED BY THIS MEASUREMENT RATHER THAN BY PREFERENCE, and no line of
// `tools/figure-pipeline/hair_texture.py` was touched. Baking a real per-card depth into
// `depth.png` in place of `random.random()` would still be ONE NUMBER PER FRAGMENT, so it is
// strictly weaker than the arm measured above — and that arm, a correct per-fragment per-LIGHT
// depth, moves the pedestal's shape by 0.21%. A weaker input into the same form cannot do more. The
// generator fix is worth making when the form can spend depth on energy, and not before.
//
// @claim 71.36 :: node packages/core/src/material/HairEnvelope.selftest.mjs :: directional A/B fraction #1
// @claim 4.7507 :: node packages/core/src/material/HairEnvelope.selftest.mjs :: n toward the key #1
// @claim 4.0654 :: node packages/core/src/material/HairEnvelope.selftest.mjs :: n toward the key #2
// @claim 1.4478 :: node packages/core/src/material/HairEnvelope.selftest.mjs :: pedestal shape, shipped input #1
// @claim 1.4449 :: node packages/core/src/material/HairEnvelope.selftest.mjs :: pedestal shape, envelope input #1
// ================================================================================================

/**
 * The two quantiles of the groom's own radial coordinate that define the hair shell.
 *
 * 🚩 THEY ARE QUANTILES AND NOT LENGTHS, AND THAT IS FORCED BY CHECKPOINT §2. The groom's outer
 * envelope is an eleven-millimetre cloud of cards at seven standoffs, so no single surface IS the
 * envelope and any threshold on it is a quantile of a spread. p02/p98 puts the two boundaries
 * outside 96% of the groom's own vertices, which is what "the envelope of a cloud" has to mean.
 *
 * ⚠️ FIXED BEFORE THE SCORES WERE READ, and `hair-envelope.mjs --models` prints the sweep that says
 * so: p10/p90 and p25/p75 trade the key and fill down (pooled ρ 0.6118 → 0.5521 → 0.5046) to buy
 * the rim up (0.1339 → 0.1508 → 0.2171). p02/p98 is kept because the rim and kicker are 0.02-0.87%
 * of a hair pixel and the key and fill are two thirds of it — not because it scored best.
 */
export const HAIR_ENVELOPE_QUANTILES = [ 0.02, 0.98 ];

/**
 * σ_hair — the extinction of the groom, in forward-scattering events per METRE of path.
 *
 * 🎯 MEASURED, NOT CHOSEN, AND THE MEASUREMENT IS A REGRESSION AGAINST THE RAY CAST. `n` has to come
 * out in the units slide 44's exponent is already in: `HAIR_DEFAULTS.shadowDensity`'s own docstring
 * reads `density · depth` as "the optical path length in units of one attenuation event", i.e.
 * Zinke's fibre count. So the conversion from metres to events is the least-squares slope through
 * the origin of the ray-cast CARD CROSSINGS on the shell path length, over 23,739 (pixel, light)
 * pairs on the three lights that carry ~99% of a hair pixel:
 *
 *     74.75 card crossings per metre        (key alone 82.9, fill alone 63.8)
 *
 * ⚠️ ONE CARD IS NOT ONE FIBRE AND THIS NUMBER IS THEREFORE A FLOOR. A card is a drawn bundle of
 * strands, so a crossing is at least one forward-scattering event and probably many. Taking one
 * card as one event is the conservative reading and it is stated here rather than buried: the true
 * σ_hair of this groom is ≥ this, and nothing downstream may quote it as the fibre count.
 *
 * @claim 74.75 :: node packages/core/src/material/HairEnvelope.selftest.mjs :: sigma from the ray cast #1
 */
export const HAIR_ENVELOPE_EXTINCTION = 74.75;

/**
 * The three arms that evaluate the geometric path length. Named once, because the test appears in
 * four places — the shader's per-fragment frame, the per-light `n`, the census and the fit hook —
 * and four copies of a three-way `||` is how a fifth arm gets added to three of them.
 */
export function isEnvelopeArm( defect ) {

    return defect === 'envelope-depth' ||
        defect === 'envelope-zinke' ||
        defect === 'envelope-fixed-direction';

}

/**
 * Where a ray leaves an axis-aligned ellipsoid, in the ray's own units.
 *
 * The ellipsoid is `|(p − c)/r| = 1`, so substituting `p = o + t·d` gives a plain quadratic in `t`
 * whose roots are already in world units — which is the reason no distance is ever measured in the
 * normalised space and no `length()` of a scaled vector appears anywhere below.
 *
 * @param {number[]} origin - the ray's start, in the ellipsoid's own frame.
 * @param {number[]} direction - unit, same frame.
 * @param {number[]} radii - the three semi-axes.
 * @returns {?number[]} `[tEnter, tExit]`, or null when the ray misses.
 */
export function ellipsoidSpanValue( origin, direction, radii ) {

    const ox = origin[ 0 ] / radii[ 0 ];
    const oy = origin[ 1 ] / radii[ 1 ];
    const oz = origin[ 2 ] / radii[ 2 ];
    const dx = direction[ 0 ] / radii[ 0 ];
    const dy = direction[ 1 ] / radii[ 1 ];
    const dz = direction[ 2 ] / radii[ 2 ];

    const a = dx * dx + dy * dy + dz * dz;
    const b = 2 * ( ox * dx + oy * dy + oz * dz );
    const c = ox * ox + oy * oy + oz * oz - 1;

    const discriminant = b * b - 4 * a * c;

    if ( discriminant <= 0 || a === 0 ) return null;

    const root = Math.sqrt( discriminant );

    return [ ( - b - root ) / ( 2 * a ), ( - b + root ) / ( 2 * a ) ];

}

/**
 * The part of a span that lies FORWARD of the fragment. Everything behind it is light that has
 * already arrived; only `t > 0` is between the fragment and the light.
 */
export function forwardChordValue( span ) {

    if ( span === null ) return 0;

    return Math.max( 0, Math.max( 0, span[ 1 ] ) - Math.max( 0, span[ 0 ] ) );

}

/**
 * 🎯 THE MODEL. Metres of hair shell between a fragment and a light.
 *
 * Mirrors `envelopePathNode` expression for expression, and the two are held together by
 * `HairEnvelope.selftest.mjs`, which runs this one and reads the other's own arithmetic.
 *
 * @param {number[]} origin - the fragment, in the envelope's frame (centre already subtracted).
 * @param {number[]} direction - toward the light, unit, same frame.
 * @param {{outer:number[], inner:number[]}} envelope - the two sets of semi-axes.
 * @returns {number} metres.
 */
export function shellPathValue( origin, direction, envelope ) {

    const outer = forwardChordValue( ellipsoidSpanValue( origin, direction, envelope.outer ) );
    const inner = forwardChordValue( ellipsoidSpanValue( origin, direction, envelope.inner ) );

    return Math.max( 0, outer - inner );

}

/**
 * The least-squares quadric through a point cloud, as a centred axis-aligned ellipsoid.
 *
 * Fits `A x² + B y² + C z² + D x + E y + F z = 1` by normal equations — six unknowns, one 6×6 solve
 * — then completes the square to recover a centre and three semi-axes.
 *
 * 🔴 THE FIT RUNS ON MEAN-CENTRED POINTS AND THAT IS NOT TIDINESS. The groom sits at y ≈ 1.5 m with
 * a 0.1 m radius, so the raw design matrix carries a `y²` column of ~2.25 beside an `x²` column of
 * ~0.01 — and normal equations SQUARE the condition number. Fitted raw, this solve returned a
 * NEGATIVE squared coefficient (a hyperboloid) on a cloud that was an ellipsoid by construction.
 * `HairEnvelope.selftest.mjs` carries that as a red proof rather than as a comment.
 *
 * @param {ArrayLike<number>} points - xyz triples.
 * @returns {{centre:number[], radii:number[], residual:number}} `residual` is the RMS of the
 *   quadric's own value minus 1 — unitless, and the honest statement of how badly an ellipsoid
 *   describes a bob. It reads 0.385 on the shipped groom.
 */
export function fitEllipsoidValue( points ) {

    const count = points.length / 3;
    const mean = [ 0, 0, 0 ];

    for ( let i = 0; i < count; i ++ ) {

        mean[ 0 ] += points[ i * 3 ];
        mean[ 1 ] += points[ i * 3 + 1 ];
        mean[ 2 ] += points[ i * 3 + 2 ];

    }

    for ( let d = 0; d < 3; d ++ ) mean[ d ] /= count;

    const normal = new Float64Array( 36 );
    const rhs = new Float64Array( 6 );
    const row = new Float64Array( 6 );

    for ( let i = 0; i < count; i ++ ) {

        const x = points[ i * 3 ] - mean[ 0 ];
        const y = points[ i * 3 + 1 ] - mean[ 1 ];
        const z = points[ i * 3 + 2 ] - mean[ 2 ];

        row[ 0 ] = x * x; row[ 1 ] = y * y; row[ 2 ] = z * z;
        row[ 3 ] = x; row[ 4 ] = y; row[ 5 ] = z;

        for ( let r = 0; r < 6; r ++ ) {

            rhs[ r ] += row[ r ];
            for ( let c = 0; c < 6; c ++ ) normal[ r * 6 + c ] += row[ r ] * row[ c ];

        }

    }

    const [ a, b, c, d, e, f ] = solveSixBySix( normal, rhs );

    if ( a <= 0 || b <= 0 || c <= 0 ) {

        throw new Error( 'HairMaterial: the groom\'s quadric fit is not an ellipsoid — a squared ' +
            'coefficient came out non-positive, which means the point cloud is not shell-shaped.' );

    }

    const local = [ - d / ( 2 * a ), - e / ( 2 * b ), - f / ( 2 * c ) ];
    const k = 1 + ( d * d ) / ( 4 * a ) + ( e * e ) / ( 4 * b ) + ( f * f ) / ( 4 * c );

    let sum = 0;

    for ( let i = 0; i < count; i ++ ) {

        const x = points[ i * 3 ] - mean[ 0 ];
        const y = points[ i * 3 + 1 ] - mean[ 1 ];
        const z = points[ i * 3 + 2 ] - mean[ 2 ];
        const value = a * x * x + b * y * y + c * z * z + d * x + e * y + f * z;

        sum += ( value - 1 ) ** 2;

    }

    return {
        centre: [ local[ 0 ] + mean[ 0 ], local[ 1 ] + mean[ 1 ], local[ 2 ] + mean[ 2 ] ],
        radii: [ Math.sqrt( k / a ), Math.sqrt( k / b ), Math.sqrt( k / c ) ],
        residual: Math.sqrt( sum / count )
    };

}

/** Gaussian elimination with partial pivoting. Six unknowns; no library earns its supply chain. */
function solveSixBySix( matrix, vector ) {

    const n = 6;
    const m = Float64Array.from( matrix );
    const v = Float64Array.from( vector );

    for ( let col = 0; col < n; col ++ ) {

        let pivot = col;

        for ( let r = col + 1; r < n; r ++ ) {

            if ( Math.abs( m[ r * n + col ] ) > Math.abs( m[ pivot * n + col ] ) ) pivot = r;

        }

        if ( pivot !== col ) {

            for ( let c = 0; c < n; c ++ ) {

                const t = m[ col * n + c ];
                m[ col * n + c ] = m[ pivot * n + c ];
                m[ pivot * n + c ] = t;

            }

            const t = v[ col ]; v[ col ] = v[ pivot ]; v[ pivot ] = t;

        }

        const diagonal = m[ col * n + col ];

        if ( Math.abs( diagonal ) < 1e-18 ) throw new Error( 'HairMaterial: singular normal equations.' );

        for ( let r = col + 1; r < n; r ++ ) {

            const factor = m[ r * n + col ] / diagonal;

            if ( factor === 0 ) continue;

            for ( let c = col; c < n; c ++ ) m[ r * n + c ] -= factor * m[ col * n + c ];

            v[ r ] -= factor * v[ col ];

        }

    }

    const out = new Float64Array( n );

    for ( let r = n - 1; r >= 0; r -- ) {

        let sum = v[ r ];

        for ( let c = r + 1; c < n; c ++ ) sum -= m[ r * n + c ] * out[ c ];

        out[ r ] = sum / m[ r * n + r ];

    }

    return out;

}

/**
 * The groom's own hair shell, fitted to its vertices and scaled to `HAIR_ENVELOPE_QUANTILES`.
 *
 * One fit, two scales. A single least-squares quadric over a filled cloud lands in the MIDDLE of
 * it rather than on either boundary, which is exactly what is wanted here: the two boundaries are
 * then the same shape at two measured radial quantiles, so the shell has one orientation and one
 * aspect ratio and cannot end up with an inner surface poking through its outer one.
 *
 * @param {ArrayLike<number>} points - the groom's vertices, xyz triples, in one frame.
 * @param {number[]} [quantiles] - inner and outer radial quantiles.
 * @returns {Object} centre, the fitted radii, the two scaled sets, and the fit's own diagnostics.
 */
export function hairEnvelopeValue( points, quantiles = HAIR_ENVELOPE_QUANTILES ) {

    const fit = fitEllipsoidValue( points );
    const count = points.length / 3;
    const radial = new Float64Array( count );

    for ( let i = 0; i < count; i ++ ) {

        const x = ( points[ i * 3 ] - fit.centre[ 0 ] ) / fit.radii[ 0 ];
        const y = ( points[ i * 3 + 1 ] - fit.centre[ 1 ] ) / fit.radii[ 1 ];
        const z = ( points[ i * 3 + 2 ] - fit.centre[ 2 ] ) / fit.radii[ 2 ];

        radial[ i ] = Math.sqrt( x * x + y * y + z * z );

    }

    const sorted = Float64Array.from( radial ).sort();
    const at = ( q ) => sorted[ Math.min( sorted.length - 1, Math.max( 0, Math.round( q * ( sorted.length - 1 ) ) ) ) ];

    const innerScale = at( quantiles[ 0 ] );
    const outerScale = at( quantiles[ 1 ] );

    return {
        centre: fit.centre,
        radii: fit.radii,
        residual: fit.residual,
        innerScale,
        outerScale,
        inner: fit.radii.map( ( r ) => r * innerScale ),
        outer: fit.radii.map( ( r ) => r * outerScale ),
        vertexCount: count
    };

}

/**
 * The lobe parameters, in Karis' variable.
 *
 * Marschner Table 1 gives, in HIS variable and in degrees: α_R −10°…−5°, α_TT = −α_R/2,
 * α_TRT = −3α_R/2; β_R 5°…10°, β_TT = β_R/2, β_TRT = 2β_R. Signs: R shifts toward the ROOT, TT and
 * TRT toward the TIP. Converted by `α_K = 2 sin α_M`, `β_K = 2 β_M` (see the header) the bands are
 *
 *     α_R   −0.3473 … −0.1743      β_R    0.1745 … 0.3491
 *     α_TT  +0.0873 … +0.1743      β_TT   0.0873 … 0.1745
 *     α_TRT +0.2611 … +0.5176      β_TRT  0.3491 … 0.6981
 *
 * 🚩 **α_R STILL SITS MID-BAND; β_R NO LONGER DOES, AND THAT IS ROUND 26.** `shiftR` is −0.26, the
 * middle of α_R. `roughnessR` is `HAIR_BETA_R` = 0.174533, the band's NARROW END, chosen from a
 * measured sweep on the judged plate rather than from the mid-band default it carried through R25 —
 * see the block above `HAIR_BETA_R` for the six arms and the two rejected knobs. Read every one of
 * these numbers as β_K: **0.174533 is Marschner's 5°, not 10°** and it is not 0.174533 radians of
 * his half-angle. That conversion is the whole reason this table is printed in both variables.
 *
 * **α_R and β_R are 3.5's two free parameters** and
 * everything else is derived from them by Marschner's ratios, so the model cannot be detuned into
 * a shape physics does not permit — in particular `β_TRT = 2 β_R` is what makes the secondary band
 * broad and soft, which is the look spec's own adjective for it arriving from fibre optics rather
 * than from taste.
 *
 * ⚠️ The look spec §5's own per-lobe numbers — "Primary (R) shift +0.02…+0.05, roughness 0.25;
 * Secondary (TRT) shift −0.05…−0.10, roughness 0.45" — are DISCARDED here. They carry no unit, no
 * rect and no procedure; they are an order of magnitude below the sine-space α; and their sign
 * convention is inverted relative to Marschner's. The one thing that survives from them is the
 * ratio: 0.45/0.25 = 1.8× against Marschner's 2×, agreeing to 10%, which is mild evidence they
 * were eyeballed off a render rather than invented.
 */
// ================================================================================================
// 🔴 ROUND 27: THE PHYSICALLY DERIVED REPLACEMENT FOR THE MULTIPLE-SCATTERING TERM IS
// INDISTINGUISHABLE FROM TURNING `HAIR_DEFAULTS.scatter` DOWN, AND THAT IS THE ROUND'S RESULT.
//
// `?hairdefect=zinke-transmittance` rebuilds the multiple-scattering term as Zinke Eq.5's
// per-channel forward transmittance — the ENERGY half slide 39 discards by dividing out Luma(C) —
// with every constant derived and none chosen (`scatterValue` carries the derivation). Measured on
// 230,277 gated hair pixels of the judged URL `?bare&freeze&seed=1&hair=1&capture&aa=msaa&grade=0`,
// in radiance at exposure 4 above the indirect floor, against a control captured by the same
// pipeline on the same run:
//
//   | arm                                              | pedestal share | p95/p50 | graded gate |    sat |
//   |--------------------------------------------------|---------------:|--------:|------------:|-------:|
//   | slide 39, what ships                             |         57.40% |   2.020 |        6.02 | 0.5649 |
//   | Zinke T_f, the probe                             |         11.49% |   2.829 |        4.67 | 0.2542 |
//   | slide 39 at ?hairscatter=0.09658, LEVEL MATCHED  |              — |   2.804 |        4.61 | 0.2844 |
//
// ⚠️ REPRODUCED ON A SECOND, INDEPENDENT CAPTURE RUN with different URLs on the same tree: every
// figure in the table landed to three significant figures, and the gate itself moved by 30 pixels
// of 230,277 because the stochastic OIT reshuffles the mask's fringe from load to load. Read these
// to three figures and not further.
//
// The third row is the control and it is SOLVED, NOT CHOSEN: `hair-transmittance.mjs` captures the
// A-side term at five scalars, interpolates the one whose mean mass rise equals the probe's, then
// captures at it and confirms the match landed to -0.00%.
//
// 🎯 THE DISCRIMINATOR. A level-matched CONSTANT moves radiance p95/p50 by 38.8%; the depth
// dependence adds 0.9% on top of that. Spearman between the two arms is 0.9763 over the same
// pixels, and the crown crops — `captures/hair-r27-crops/disc-crown-mass-tf.png` against
// `disc-crown-ctl.png`, nearest-neighbour at 3x — are the same picture. THE GAIN IS A BRIGHTNESS
// CUT WEARING A CONTRAST RATIO, which is CHECKPOINT §9's own warning about `scatter` 1 -> 0.25,
// landing this time on a term that had a published derivation behind it.
//
// ⚠️ AND BOTH SIDES OF THE TRAP MOVED THE WAY CHECKPOINT §2 SAYS THEY DO. The graded contrast gate
// falls 6.02 -> 4.67 while the plate's own dynamic range rises. Neither arm is green, and the
// probe's mass saturation collapses 0.5649 -> 0.2542 — the direction six blind judges complained
// about — because the pedestal was the only warm term under an achromatic R lobe.
//
// 🚩 WHY, AND IT IS THE FORWARD FINDING. `Shadow` is exp(-3 * depth.png at the CARD'S OWN ATLAS UV)
// and that sheet is `random.random()` per strand (`tools/figure-pipeline/hair_texture.py:791`) — a
// per-strand uniform random in TEXTURE space, which cannot vary with light direction, head
// orientation, or how many other cards lie between the fragment and a light. Giving a correct FORM
// a white-noise INPUT buys a per-pixel wobble (B/C luminance ratio p10 0.55, p90 1.31) and no
// structure. THE INPUT COMES BEFORE THE FORM. The signal Karis' own slide 44 names is the shadow
// map this build already casts into, and wiring it is `render/**`.
//
// ⚠️ NOT MEASURED BY THIS FILE OR ITS GATE, AND ATTRIBUTED RATHER THAN RESTATED: the same round's
// pixel probe (`tools/critic/hair-pedestal.mjs`, `captures/hair-r27-pedestal/`) scored the shipped
// `Shadow` against a CPU ray-cast count of cards between the fragment and each light and read it
// UNCORRELATED WITH THE SIGN BACKWARDS. Read that number there, where its instrument is.
//
// Every figure above is tagged. The producer is an arithmetic selftest that prints a
// MACHINE-WRITTEN record of the capture, because `/captures/` is gitignored and a producer that
// read the plates would go red on a clean tree — `hair-transmittance.mjs`'s header states that
// limit in full, including what it therefore does NOT prove.
//
// @claim 230,277 :: node tools/critic/hair-transmittance.selftest.mjs :: gate size #1
// @claim 57.40 :: node tools/critic/hair-transmittance.selftest.mjs :: pedestal share #2
// @claim 11.49 :: node tools/critic/hair-transmittance.selftest.mjs :: pedestal share #3
// @claim 2.020 :: node tools/critic/hair-transmittance.selftest.mjs :: radiance dynamic range #4
// @claim 2.829 :: node tools/critic/hair-transmittance.selftest.mjs :: radiance dynamic range #5
// @claim 2.804 :: node tools/critic/hair-transmittance.selftest.mjs :: radiance dynamic range #6
// @claim 6.02 :: node tools/critic/hair-transmittance.selftest.mjs :: graded contrast gate #2
// @claim 4.67 :: node tools/critic/hair-transmittance.selftest.mjs :: graded contrast gate #3
// @claim 4.61 :: node tools/critic/hair-transmittance.selftest.mjs :: graded contrast gate #4
// @claim 0.5649 :: node tools/critic/hair-transmittance.selftest.mjs :: mass saturation #2
// @claim 0.2542 :: node tools/critic/hair-transmittance.selftest.mjs :: mass saturation #3
// @claim 0.2844 :: node tools/critic/hair-transmittance.selftest.mjs :: mass saturation #4
// @claim 0.09658 :: node tools/critic/hair-transmittance.selftest.mjs :: the level match solved at hairscatter #1
// @claim 0.9763 :: node tools/critic/hair-transmittance.selftest.mjs :: Spearman between the two arms #1
// @claim 38.8 :: node tools/critic/hair-transmittance.selftest.mjs :: level-matched CONSTANT moves radiance #3
// @claim 0.9 :: node tools/critic/hair-transmittance.selftest.mjs :: level-matched CONSTANT moves radiance #4
// ================================================================================================

export const HAIR_DEFAULTS = {
    /** Cuticle tilt of the R lobe, Karis' variable. Mid-band of −0.3473…−0.1743. Free parameter. */
    shiftR: -0.26,

    /**
     * Longitudinal width of the R lobe, β_K. **The NARROW end of 0.1745…0.3491**, which is
     * Marschner's β_R = 5°. R26's one lever; see `HAIR_BETA_R` for the sweep that chose it and
     * `?hairdefect=wide-lobe` for the mid-band arm it replaces.
     */
    roughnessR: HAIR_BETA_R,

    /** Marschner's ratios, applied to the two above. Not independently authorable on purpose. */
    shiftRatioTT: -0.5,
    shiftRatioTRT: -1.5,
    roughnessRatioTT: 0.5,
    roughnessRatioTRT: 2,

    /** Per-lobe on/off, for the A/B plates. 1 is on; anything else scales the lobe. */
    weightR: 1,
    weightTRT: 1,

    /**
     * 🔴 TT SHIPS OFF, AND THE REASON IS A MEASUREMENT RATHER THAN A PREFERENCE.
     *
     * TT is the TRANSMISSION lobe: light that went in one side of the fibre and out the other. It
     * is the term that makes back-lit hair glow, and on a rig with directional occlusion it is the
     * best thing in the model. This rig has none. `render/LightingRig.js`'s rim is a
     * `RectAreaLight` at irradiance 16 with `shadowFraction 0`; three has had no rect-area shadow
     * since 2018 (issue #14161); and irradiance 16 against the key's 1.65 is authored on the
     * assumption of an `N·L` that this BSDF correctly does not have. So the rim reaches the cards
     * in FRONT of the head at full strength, TT transmits it straight at the camera, and — because
     * TT's attenuation `C^(√(1−h²a²)/2cosθd)` on a near-black fibre is small and the rim is
     * `#0f30ff` — the groom renders BLUE. Measured on `?bare&freeze&seed=1&hair=1`: with TT on,
     * frame mean 0.4195 and a visibly violet-blue head of hair; the R/TRT/scatter side-visibility
     * term does not touch it, because TT is the one lobe that term deliberately exempts.
     *
     * Karis drops TT for the same class of reason on slide 47 — an SH environment probe has no
     * "behind", so the environment path removes TT entirely. A rim light with no shadow map is the
     * same situation wearing a different hat.
     *
     * `?hairlobes=r,tt,trt` turns it back on, and that plate is the evidence for this paragraph.
     * The thing that would earn it a place in the shipped frame is a shadow caster on the rim, or
     * the OIT round's per-card depth, and both are `render/**`.
     */
    weightTT: 0,

    /**
     * Slide 39's multiple-scattering fake, as a scalar over the whole term. Karis calls the
     * section a hack; this is the dial that removes it from a plate.
     *
     * 🔴 IT SHIPS AT 1 AND IT IS THE LARGEST TERM IN THE GROOM, WHICH IS THE DIAGNOSIS FOR "FLAT
     * MATTE WITH A PLUM CAST" AND IS NOT A REASON TO CHANGE THIS NUMBER HERE.
     *
     * Measured in RADIANCE on `?bare&freeze&seed=1&aa=msaa&grade=0`, as a share of the groom's whole
     * rise above its indirect floor: the fake carries **65.4%** and R + TRT together **35.0%** over
     * 265,261 solid hair pixels; even over the brightest 5% of solid hair the fake is **42.1%**. A
     * second capture the same session, over a mask of 255,850 px, read 65.8 / 35.4 / 46.2 — the
     * hashed-alpha coverage reshuffles the fringe of the mask from load to load, so read these to a
     * couple of points and not further. The conclusion is not close to that margin.
     *
     * The term is bandless by construction — its entire angular dependence is `(n·ωi + 1)/4π`, a
     * wrap-around cosine with no shift, no width and no azimuth — so every unit of energy it
     * carries is energy that cannot form a band.
     *
     * 🚩 AND TURNING IT DOWN IS NOT THE FIX, WHICH IS WHY THIS IS A COMMENT AND NOT AN EDIT. The
     * shipped contrast gate divides p95 by an ASSUMED albedo, so the fake is the only dial that
     * moves it toward its target: swept 0 → 4 on the shipped plate it walks the gate from 2.92 to
     * 7.97 : 1 while walking the picture's own p95/p50 from 3.00 down to 1.22. The two numbers are
     * monotone in opposite directions and neither is green at any setting of this scalar, so there
     * is no value of it that is the answer. What the sweep locates is a MISSING PEAK: at the rig's
     * measured delivery the lobes cannot reach the reference band on any base colour (see the
     * albedo sweep in the selftest's contrast diagnosis), and the fake was standing in for it.
     * `docs/research/hair.md` §9 carries the sweep; REQ-063/064 carry the rig changes that would
     * let the lobes do the work this term is doing.
     *
     * 🔴 AND ROUND 27 PROVED THE SAME THING ABOUT THE PHYSICS. The block above this table measures
     * a derived, published replacement for the term against a level-matched constant multiple of
     * this scalar, and they are the same picture. Read it before spending a round here.
     */
    scatter: 1,

    /**
     * Karis slide 47's card-scale occlusion, as a blend against "no occlusion at all". 1 ships it;
     * 0 is `?hairvis=0`, the arm on which the groom renders blue. It is a `mix` weight rather than
     * a boolean so a plate can sit between the two, and it is in this table because it was NOT —
     * `createHairMaterial` read `settings.sideVisibility` off an object that had no such key, so
     * every caller that did not pass one built `uniform( undefined )`. `alive.js` always passes.
     */
    sideVisibility: 1,

    /**
     * How fast the baked bundle depth is turned into slide 44's exponential shadow. `Shadow` runs
     * `exp( −density · depth )`, so 0 is "every texel fully lit" and the depth dependence vanishes.
     * 3.0 puts the deepest baked texel at e⁻³ = 0.050.
     *
     * 🎯 ROUND 27 GAVE THIS NUMBER A SECOND, SHARPER READING AND DID NOT CHANGE IT. Because
     * `Shadow` is Beer–Lambert, `density · depth` IS the optical path length in units of one
     * attenuation event — i.e. Zinke Eq.5's `n`, the count of fibres between the fragment and the
     * light. So 3.0 is now also the assertion that the deepest baked texel sits behind three
     * forward-scattering events, and `scatterValue` reads it that way rather than as a curve shape.
     * It stays at 3.0 because moving it would be a second free variable in the round that changed
     * what the exponent means.
     */
    shadowDensity: 3.0,

    /**
     * σ_hair, in forward-scattering events per metre of geometric path through the groom's shell.
     * Read `HAIR_ENVELOPE_EXTINCTION` for the regression that produced it and for the reason it is
     * a FLOOR rather than a fibre count.
     *
     * ⚠️ It is only reached on the `envelope-*` arms. The shipped path still takes `n` from
     * `shadowDensity · depth.png`, because R28 measured the swap and the measurement — not this
     * table — decides which one ships. See `HAIR_DEFECTS`.
     */
    envelopeExtinction: HAIR_ENVELOPE_EXTINCTION,

    /**
     * Root occlusion, as a LINEAR multiplier, and the restatement is the point.
     *
     * The punch-list says "root AO 0.35–0.5". That clause has no rect, no procedure and no
     * artefact behind it, and a photograph cannot separate AO from light falloff anyway. What can
     * be measured on the reference bounds it: ponytail immediately under the hair tie against
     * mid-shaft reads **0.368 encoded / 0.188 linear**. 0.368 lands squarely inside the published
     * band and 0.188 does not, which says the original figure was read in the ENCODED domain like
     * everything else in the look spec. Converted through the sRGB EOTF, an encoded darkening of
     * 0.35–0.50 is a linear multiplier of **0.0805–0.1895**; the midpoint is shipped.
     *
     * A linear 0.40 — the naive reading — produces an encoded darkening of 0.683, roughly half
     * what the plate shows.
     */
    rootOcclusion: 0.135,

    /** Fraction of strand length the occlusion ramps over. The reference's tie shadow is short. */
    rootOcclusionLength: 0.15,

    /**
     * 🎯 THE STRAND JITTER, AS THE STANDARD DEVIATION OF THE IN-PLANE STRAND ANGLE IN RADIANS, AND
     * IT IS THE ROUND'S WHOLE CLAIM. This is what the round before last declared as `shiftJitter`
     * and never wired; it is wired now, through the TANGENT rather than through the cuticle tilt,
     * and at a number that was measured rather than guessed.
     *
     * 🚩 IT IS NOT A NEW QUANTITY. IT IS THE ONE `flow.png` ALREADY CARRIES AND THE SAMPLER ALREADY
     * DELETES. `hair_texture.py` bakes a per-texel strand direction into the sheet's R and G, and
     * the mip chain averages it away in exactly the band a strand lives in. Measured this session
     * on the shipped `assets/hair/bob01/flow.png`, decoded through this material's own
     * reconstruction (`atan2( r, g )` after the ±1 remap) and differenced against a box filter of
     * the width the scene pass reads at — the residual IS what the filter removes:
     *
     *   | strip | removed at lod 1 | at lod 2 | at lod 3 | hair px on the shipped plate |
     *   |------:|-----------------:|---------:|---------:|-----------------------------:|
     *   |     0 |            0.6°  |    0.9°  |    1.1°  |                          100 |
     *   |     1 |            6.8°  |   10.4°  |   13.8°  |                      161,945 |
     *   |     2 |           11.3°  |   15.6°  |   18.2°  |                       45,170 |
     *   |     3 |           11.1°  |   15.0°  |   17.1°  |                       62,901 |
     *   |     4 |           12.9°  |   17.2°  |   19.4°  |                       50,756 |
     *   |     5 |           13.4°  |   17.5°  |   19.5°  |                       57,716 |
     *   |     6 |           11.5°  |   15.4°  |   17.5°  |                       60,937 |
     *   |     7 |            9.4°  |   12.7°  |   14.2°  |                      100,879 |
     *
     * Round 20 measured the lod the scene pass actually samples at — all-strip p50 **2.011** — so
     * the lod-2 column is the one that applies, and weighted by the pixel counts beside it the
     * groom loses **0.2403 rad, 13.8°**, of strand direction on the way to the frame. That is this
     * number. Restoring it is a correction, not an embellishment, and the sign of the argument is
     * what matters: if the measurement had come out at 2° there would be nothing here to do.
     *
     * ⚠️ AND `flow.png`'s FOURTH CHANNEL STAYS UNREAD, NOW WITH A REASON RATHER THAN A TODO. The
     * sheet's channel table promises *"A strand id"*, and a strand id is a LABEL: the mean of two
     * labels is not a label, so the one channel whose whole purpose is per-strand decorrelation is
     * the one channel a filter cannot carry at all. That is not a defect in the bake and it is not
     * fixable in the bake; it is why the decorrelation is generated here instead.
     */
    strandTangentJitter: 0.2403,

    /** Metres of scalp between strand locks. See `HAIR_STRAND_PITCH` for the three measurements. */
    strandPitch: HAIR_STRAND_PITCH,

    /**
     * Where the jitter starts and finishes fading out, in CYCLES PER SCENE-PASS PIXEL, and the
     * second number is not a taste: **0.5 is Nyquist**. A lock period under two pixels cannot be
     * carried by the pass at all, so past that the field is not detail, it is noise that the
     * temporal resolve will crawl. The fade opens one octave earlier, at 0.25, because value noise
     * puts energy above its own lattice frequency and an abrupt cut at Nyquist would let the first
     * sidelobe through. Both are pinned by mutation in the selftest, which reports the value at
     * which the rendered structure stops surviving the resolve.
     *
     * 🎯 THE UNITS ARE THE POINT. `dFdx` in the fragment shader is per RENDER-TARGET pixel, and this
     * page ships `resolutionScale` 0.66, so this limit is in the same units the coverage decision is
     * made in — which is the correction round 20 found the CPU-side lod gate was missing.
     */
    strandFadeStart: 0.25,
    strandFadeEnd: 0.5,

    /**
     * 🎯 THE LOCK BAND, AND IT IS DELIBERATELY THE ONLY NEW TERM IN ROUND 24. See
     * `HAIR_LOCK_ALBEDO_SPREAD` for the amplitude's two measurements and its solve,
     * `HAIR_LOCK_CELL_M` for the cell's division, and the block above `HAIR_LOCK_COUNT` for why
     * this is a spatial field rather than a per-card value.
     *
     * It is kept STRICTLY separate from `strandTangentJitter`: that one rotates the TANGENT per
     * fragment and this one multiplies the base COLOUR per lock. They share no code, no uniform and
     * no frequency, which is the separation false-earth's `clumpSeed01` has from its per-blade seed
     * and is the whole reason its two bands read as two bands.
     */
    lockSpread: HAIR_LOCK_ALBEDO_SPREAD,
    lockCell: HAIR_LOCK_CELL_M,
    lockBlend: HAIR_LOCK_BLEND_FRACTION,

    /**
     * 🎯 THE LOCK TILT, AND IT IS THE ONLY NEW TERM IN ROUND 25. See `HAIR_LOCK_TILT_SPREAD` for
     * the Marschner Table 1 derivation, and the block above it for why the lock id is now a vertex
     * attribute rather than a field re-derived in space.
     *
     * It is kept STRICTLY separate from both terms already here, which is the same discipline R24
     * applied and for the same reason. `strandTangentJitter` rotates the tangent IN the card's
     * plane, per FRAGMENT, at filament frequency. `lockSpread` multiplies the base COLOUR, per
     * spatial cell. This one rotates the tangent OUT of the card's plane, per LOCK ID, and shares
     * no uniform, no coordinate and no expression with either.
     */
    lockTilt: HAIR_LOCK_TILT_SPREAD
};

/** The named A/B defects, reachable from the page. See `HairLightingModel.strandTangent`. */
export const HAIR_DEFECTS = {
    none: 'the shipped path — the tangent comes from the card, rotated by the flow sheet',
    'constant-tangent': 'a fixed VIEW-space tangent for every fragment, so the highlight is ' +
        'locked to the screen instead of running across the strand. The rejection proof for the ' +
        'anisotropy: it stays entirely plausible in a thumbnail and is obviously wrong the moment ' +
        'the band is measured against the strand direction.',
    'no-flow': 'the card\'s own ∂P/∂v, with the per-texel flow rotation removed. Weaker than ' +
        'constant-tangent: it isolates the flow SHEET rather than the card frame.',
    'no-strand-jitter': '🎯 THE A SIDE OF THIS ROUND, and the two arms differ in one rotation. ' +
        'The per-fragment strand field is removed and everything else — the flow sheet, the card ' +
        'frame, every lobe, the scatter fake — is left exactly as it ships, so a pixel that moves ' +
        'between the arms moved because of the strand structure and for no other reason. It is ' +
        'ORTHOGONAL to no-flow: that one removes the baked sheet and keeps the jitter, this one ' +
        'removes the jitter and keeps the sheet.',
    'no-lock-albedo': '🎯 THE A SIDE OF ROUND 24, and the two arms differ in ONE MULTIPLY. The ' +
        'lock-scale albedo field is removed — `lockSpread` goes to zero, so every lock takes the ' +
        'same base colour — and the per-fragment strand jitter, the flow sheet, the card frame, ' +
        'every lobe and the scatter fake are left exactly as they ship. It is ORTHOGONAL to ' +
        'no-strand-jitter: that one removes the FILAMENT band and keeps the lock band, this one ' +
        'removes the LOCK band and keeps the filament band. Both together are the groom with one ' +
        'colour and one flow field, which is what six blind judges described.',
    'lock-albedo-max': '🎯 THE BOUND ON ROUND 24, and it is a probe rather than a defect. The ' +
        'lock spread is forced to HAIR_LOCK_SPREAD_MAX — the widest a MULTIPLICATIVE albedo can ' +
        'be before a lock goes negative, i.e. locks running 0x to 2x the base colour. If the ' +
        'lock band does not move on THIS plate then no setting of the shipped constant can move ' +
        'it, and the hypothesis is refused by arithmetic rather than by taste.',
    'no-lock-tilt': '🎯 THE A SIDE OF ROUND 25, and the two arms differ in ONE ROTATION. The ' +
        'per-lock tangent tilt is removed — `lockTilt` goes to zero, so every lock shades on the ' +
        'card\'s own strand direction and the primary band runs smoothly across the whole mass — ' +
        'and the flow sheet, the per-fragment strand jitter, the lock albedo field, the card ' +
        'frame, every lobe and the scatter fake are left exactly as they ship. It is ORTHOGONAL ' +
        'to no-strand-jitter and to no-lock-albedo: those remove a FILAMENT-band rotation and a ' +
        'LOCK-band colour, this removes a LOCK-band rotation, and no expression is shared by any ' +
        'two of the three.',
    'lock-tilt-max': '🎯 THE BOUND ON ROUND 25, and it is a probe rather than a defect. The tilt ' +
        'spread is forced to HAIR_LOCK_TILT_MAX — the spread at which two neighbouring locks\' ' +
        'primary bands are separated by one full lobe width, i.e. a mass with no continuous ' +
        'highlight anywhere. If the picture does not move on THIS plate then no setting of the ' +
        'shipped constant can move it, and the hypothesis is refused by arithmetic rather than ' +
        'by taste.',
    'wide-lobe': '🎯 THE A SIDE OF ROUND 26, and the two arms differ in ONE NUMBER. The primary ' +
        'lobe\'s longitudinal width β_R is put back to HAIR_BETA_R_MID — the MIDDLE of Marschner ' +
        'Table 1\'s measured 5-10 degree band, which is what shipped from round 13 through round ' +
        '25 — and the shift, the weights, the scatter fake, the lock tilt, the lock albedo, the ' +
        'strand jitter, the flow sheet and the card frame are left exactly as they ship. β_TT and ' +
        'β_TRT follow it by Marschner\'s own ratios and material.roughness follows β_TRT, because ' +
        'those are derivations rather than parameters: the arm is ONE free variable. ' +
        '⚠️ IT OVERRIDES ?hairbeta= RATHER THAN COMPOSING WITH IT. A control that another key can ' +
        'silently un-defect is not a control, and this one and that key move the same number.',
    'zinke-transmittance': '🔴 ROUND 27\'S EXPERIMENT, AND IT IS A NEGATIVE RESULT KEPT REACHABLE ' +
        'RATHER THAN A DEFECT. The multiple-scattering term is rebuilt as Zinke Eq.5\'s ' +
        'per-channel forward transmittance √C^(1+n) — the ENERGY half slide 39 discards by ' +
        'dividing out Luma(C) — with ā_f = √C taken from this material\'s own absorbTT at h = 0 ' +
        'and n = shadowDensity·depth taken from slide 44\'s own exponent, so no constant is ' +
        'chosen anywhere and at n = 0 the two arms are bit-identical. Everything else — the ' +
        'lobes, the lock albedo, the lock tilt, the strand jitter, the flow sheet, the card ' +
        'frame, the side visibility, the root occlusion — is untouched, and both arms read the ' +
        'same shadowDensity uniform off the same sheet, so a census of that uniform describes ' +
        'both arms and no effective value differs from the written one. ' +
        '🚩 WHY IT DID NOT SHIP: it makes the pedestal collapse and both contrast statistics rise, ' +
        'and a LEVEL-MATCHED CONSTANT multiple of the term it replaces does the same thing on the ' +
        'same pixels — the two arms are the same picture by rank and by eye. The depth dependence ' +
        'is not the lever while the signal it depends on is white noise in atlas space. The ' +
        'measurement, with every figure tagged, is the comment on HAIR_DEFAULTS.scatter; the ' +
        'instrument is tools/critic/hair-transmittance.mjs and the plates are captures/hair-r27-tf/.',
    'envelope-depth': '🎯 THE A SIDE OF ROUND 28, AND THE TWO ARMS DIFFER IN ONE INPUT. Slide 39\'s ' +
        'form is untouched, byte for byte; what changes is where its `Shadow` comes from. Instead ' +
        'of exp(−shadowDensity · depth.png at the CARD\'S OWN ATLAS UV) — one baked ' +
        'random.random() per strand, shared by all 462 cards, which cannot vary with light ' +
        'direction at all — `n` becomes envelopeExtinction × the GEOMETRIC path length through the ' +
        'groom\'s fitted shell, from this fragment toward THIS LIGHT. Every lobe, the lock albedo, ' +
        'the lock tilt, the strand jitter, the flow sheet, the side visibility and the root ' +
        'occlusion are left exactly as they ship. Scored against R27\'s CPU ray cast the new input ' +
        'reads Spearman 0.6118 where the sheet reads 0.0598 — see HAIR_ENVELOPE_EXTINCTION.',
    'envelope-zinke': '🎯 R27\'s FORM ON R28\'s INPUT, and it is the arm the two rounds were built ' +
        'to make possible. Zinke Eq.5\'s per-channel √C^(1+n), exactly as `zinke-transmittance` ' +
        'evaluates it, with `n` taken from the envelope path length rather than from the sheet. ' +
        'R27 could not tell its own form apart from a scalar BECAUSE the input was white noise; ' +
        'this is the same form with an input that has a spatial referent, and it is the only arm ' +
        'in which a depth-dependent term can attenuate ENERGY rather than only chromaticity.',
    'envelope-fixed-direction': '🔴 THE FALSIFICATION ARM FOR ROUND 28, AND IT IS THE ONE THAT ' +
        'DECIDES WHETHER ANYTHING WAS ACHIEVED. The envelope path length is evaluated toward a ' +
        'CONSTANT view-space direction instead of toward each light, so the term keeps every other ' +
        'property it has — per-fragment, geometric, ellipsoid-derived — and loses ONLY its ' +
        'dependence on where the light is. R27 killed the previous attempt by showing it was a ' +
        'scalar in disguise; if `envelope-depth` and this arm render the same picture, R28 is one ' +
        'too, and the round is a negative by its own instrument rather than by argument.',
    'unit-bsdf': '🎯 THE IRRADIANCE PROBE, and it is a measuring instrument rather than a defect. ' +
        'S is replaced by the constant 1/4π — the BSDF of a perfectly diffusing sphere — so the ' +
        'rendered LINEAR value on a hair pixel is exactly Σ(L_i · Ω_i) / 4π over the five lights ' +
        'that reach it. That number is what the rig DELIVERS to the groom, measured rather than ' +
        'derived from the rig\'s authored irradiance, and without it a dim highlight cannot be ' +
        'attributed to the BSDF rather than to the light level. REQ-061 is a request to tell ' +
        'those two apart.'
};

// --- the arithmetic, mirrored in JavaScript ---------------------------------------------------
//
// Everything below has a TSL twin further down the file. They are written as two expressions of
// one formula rather than one shared implementation because TSL nodes cannot be evaluated on the
// CPU, and the selftest's whole job is to hold them to the same properties.

/** Schlick's Fresnel at a dielectric interface. `cosine` is the angle at the interface, not N·V. */
export function fresnelValue( cosine, f0 = HAIR_F0 ) {

    const clamped = Math.min( 1, Math.max( 0, cosine ) );

    return f0 + ( 1 - f0 ) * Math.pow( 1 - clamped, 5 );

}

/**
 * M_p — the longitudinal scattering function, Karis slide 18.
 *
 * `M_p = exp( −(sinθi + sinθr − α)² / 2β² ) / ( β √(2π) )`
 *
 * ⚠️ This is EPIC's Gaussian and not Weta's energy-conserving form, which slide 18 gives and then
 * rejects. The normalisation `1/(β√2π)` means a TIGHTER lobe is a BRIGHTER lobe — that is what
 * makes the primary band a sharp bright line and the secondary a broad dim one from one formula —
 * so a caller that widens β without expecting the peak to fall has misread it.
 */
export function longitudinalValue( sinThetaI, sinThetaR, shift, roughness ) {

    const width = Math.max( roughness, 1e-4 );
    const offset = sinThetaI + sinThetaR - shift;

    return Math.exp( - ( offset * offset ) / ( 2 * width * width ) ) / ( width * Math.sqrt( 2 * Math.PI ) );

}

/**
 * η′, the azimuthal index of refraction, as a function of θd. Karis slide 27 gives the fit
 * `η′ ≈ 1.19/cosθd + 0.36 cosθd` for η = 1.55 and claims "error < 0.68%".
 *
 * Re-derived in this session against the exact `√(η² − sin²θd)/cosθd`: max relative error
 * **0.675% at θd = 45°** (0.000 / 0.154 / 0.487 / 0.675 / 0.428 % at 0/15/30/45/60°). The claim
 * holds exactly, which is worth knowing because it is the one place a wrong constant would
 * produce a TT lobe in the wrong place rather than no TT lobe at all.
 */
export function modifiedIorValue( cosThetaD ) {

    const cosine = Math.max( cosThetaD, 1e-4 );

    return 1.19 / cosine + 0.36 * cosine;

}

/**
 * The TT offset `h`, Karis slide 26's closed form for the exact root of slide 25.
 *
 * The exact expression carries `sign(φ)`, which needs the signed azimuth; slide 26 drops it
 * ("ignoring sign of h") and what is left is a function of `cos φ` alone. That is the whole reason
 * this material never computes an azimuth: every azimuthal term in Karis' deck reduces to a
 * polynomial or an exponential in `cos φ`, which is one dot product.
 */
export function transmittedOffsetValue( cosPhi, cosThetaD ) {

    const a = 1 / modifiedIorValue( cosThetaD );
    const cosHalfPhi = Math.sqrt( Math.max( 0, 0.5 + 0.5 * cosPhi ) );

    return ( 1 + a * ( 0.6 - 0.8 * cosPhi ) ) * cosHalfPhi;

}

/**
 * The three azimuthal terms, per lobe, evaluated for one colour channel.
 *
 * `colour` is the hair's base colour in LINEAR light, per channel. It appears only in TT and TRT —
 * R never enters the fibre, so `N_R` is achromatic and the R band takes the light's colour. That
 * asymmetry is the dual band's colour split and it is not a choice made here; it falls out of
 * `A(p,h) = (1−f)² f^(p−1) T(μa,h)^p` at p = 0, 1, 2 (slide 23).
 *
 * @returns {{ r:number, tt:number, trt:number }} the three N_p for this channel.
 */
export function azimuthalValues( cosPhi, cosThetaD, dotIncidentView, colour ) {

    const cosHalfPhi = Math.sqrt( Math.max( 0, 0.5 + 0.5 * cosPhi ) );
    const safeCosThetaD = Math.max( cosThetaD, 1e-4 );

    // R — slide 20. A(0,h) with h = 0 by construction, so the attenuation is pure Fresnel at the
    // half-angle between ωi and ωr, and `√(½ + ½ ωi·ωr)` is that cosine without an inverse trig.
    const r = 0.25 * cosHalfPhi * fresnelValue( Math.sqrt( Math.max( 0, 0.5 + 0.5 * dotIncidentView ) ) );

    // TT — slides 24-29. Pixar's absorption, which Karis takes over Weta's because he "found the
    // look more pleasant": the exponent is chosen so that `colour` IS the base colour rather than
    // an extinction coefficient somebody has to invert.
    const a = 1 / modifiedIorValue( safeCosThetaD );
    const h = transmittedOffsetValue( cosPhi, safeCosThetaD );
    const fresnelTT = fresnelValue( safeCosThetaD * Math.sqrt( Math.max( 0, 1 - h * h ) ) );
    const absorbTT = Math.pow( colour, Math.sqrt( Math.max( 0, 1 - h * h * a * a ) ) / ( 2 * safeCosThetaD ) );
    const distributionTT = Math.exp( - 3.65 * cosPhi - 3.98 );
    const tt = ( 1 - fresnelTT ) * ( 1 - fresnelTT ) * absorbTT * distributionTT;

    // TRT — slide 32, "we have to be brutal". h is the constant √3/2, so `√(1−h²) = 0.5` and the
    // Fresnel has no azimuthal dependence at all; the absorption exponent 0.8 already covers both
    // crossings, so `colour` is NOT squared here.
    const fresnelTRT = fresnelValue( safeCosThetaD * 0.5 );
    const absorbTRT = Math.pow( colour, 0.8 / safeCosThetaD );
    const distributionTRT = Math.exp( 17 * cosPhi - 16.78 );
    const trt = ( 1 - fresnelTRT ) * ( 1 - fresnelTRT ) * fresnelTRT * absorbTRT * distributionTRT;

    return { r, tt, trt };

}

/**
 * The whole BSDF for one geometric configuration, per channel, with the three lobes kept apart.
 *
 * 🎯 THE LOBES ARE RETURNED SEPARATELY AND THAT IS THE POINT. 3.5 asks for two bands with a
 * longitudinal shift between them, and a gate that only ever sees their sum cannot tell a dual
 * band from one wide one — which is the mistake specular occlusion nearly shipped with last round.
 *
 * @param {number[]} tangent - unit, the fibre direction (root → tip).
 * @param {number[]} toLight - unit, fragment → light.
 * @param {number[]} toView - unit, fragment → camera.
 * @param {number[]} colour - linear base colour, three channels.
 * @param {Object} [settings] - overrides over `HAIR_DEFAULTS`.
 * @returns {{ r:number[], tt:number[], trt:number[], total:number[], geometry:Object }}
 */
export function hairScatteringValue( tangent, toLight, toView, colour, settings = {} ) {

    const options = { ...HAIR_DEFAULTS, ...settings };

    const sinThetaI = dotProduct( tangent, toLight );
    const sinThetaR = dotProduct( tangent, toView );
    const cosThetaI = Math.sqrt( Math.max( 0, 1 - sinThetaI * sinThetaI ) );
    const cosThetaR = Math.sqrt( Math.max( 0, 1 - sinThetaR * sinThetaR ) );

    // cosθd without an inverse trig: θd = (θr − θi)/2, and the half-angle identity turns that into
    // one square root of quantities already in hand. θr − θi ∈ [−π, π], so the cosine is ≥ 0 and
    // the root is real.
    const cosThetaD = Math.sqrt( Math.max( 0,
        0.5 + 0.5 * ( cosThetaI * cosThetaR + sinThetaI * sinThetaR ) ) );

    // φ is the azimuth between the two directions PROJECTED off the tangent. The projections have
    // lengths cosθi and cosθr exactly, so the normalisation is free.
    const perpendicularI = subtractScaled( toLight, tangent, sinThetaI );
    const perpendicularR = subtractScaled( toView, tangent, sinThetaR );
    const cosPhi = dotProduct( perpendicularI, perpendicularR ) /
        Math.max( cosThetaI * cosThetaR, 1e-6 );

    const shiftTT = options.shiftR * options.shiftRatioTT;
    const shiftTRT = options.shiftR * options.shiftRatioTRT;
    const roughnessTT = options.roughnessR * options.roughnessRatioTT;
    const roughnessTRT = options.roughnessR * options.roughnessRatioTRT;

    const longitudinalR = longitudinalValue( sinThetaI, sinThetaR, options.shiftR, options.roughnessR );
    const longitudinalTT = longitudinalValue( sinThetaI, sinThetaR, shiftTT, roughnessTT );
    const longitudinalTRT = longitudinalValue( sinThetaI, sinThetaR, shiftTRT, roughnessTRT );

    const dotIncidentView = dotProduct( toLight, toView );

    const r = [];
    const tt = [];
    const trt = [];
    const total = [];

    for ( let channel = 0; channel < 3; channel ++ ) {

        const azimuthal = azimuthalValues( cosPhi, cosThetaD, dotIncidentView, colour[ channel ] );

        r[ channel ] = options.weightR * longitudinalR * azimuthal.r;
        tt[ channel ] = options.weightTT * longitudinalTT * azimuthal.tt;
        trt[ channel ] = options.weightTRT * longitudinalTRT * azimuthal.trt;
        total[ channel ] = r[ channel ] + tt[ channel ] + trt[ channel ];

    }

    return {
        r, tt, trt, total,
        geometry: { sinThetaI, sinThetaR, cosThetaD, cosPhi, shiftTT, shiftTRT, roughnessTT, roughnessTRT }
    };

}

/**
 * The strand field's hash, and it is Hoskins' `hash11` transcribed operation for operation
 * (`www.shadertoy.com/view/4djSRW`, the one-in one-out row) rather than the `fract(sin(x)·43758.5)`
 * everybody reaches for first. The reason is arithmetic and it matters here: `sin` of a large
 * argument loses most of its mantissa in 32-bit float, and this hash's argument is an ARC LENGTH IN
 * PITCH UNITS — a couple of hundred by the far edge of the atlas — which is exactly the regime
 * where the sine version starts repeating.
 *
 * ⚠️ `Math.fround` AFTER EVERY OPERATION, AND IT IS NOT DECORATION. The shader runs this in f32 and
 * JavaScript would run it in f64; the two diverge into completely different hash values within
 * three multiplies, so a mirror computed in double precision would be a mirror of a different
 * function. The emulation is still not a bit-exact promise — a backend is free to contract a
 * multiply-add — so the selftest asserts the field's PROPERTIES rather than its samples.
 */
export function strandHashValue( x ) {

    const f32 = Math.fround;

    let p = f32( f32( x ) * f32( 0.1031 ) );
    p = f32( p - Math.floor( p ) );
    p = f32( p * f32( p + f32( 33.33 ) ) );
    p = f32( p * f32( p + p ) );

    return f32( p - Math.floor( p ) );

}

/**
 * One-dimensional value noise on the strand axis, normalised to unit standard deviation.
 *
 * 🚩 THE INTERPOLANT IS WHY THIS IS VALUE NOISE AND NOT A LATTICE OF RANDOM NUMBERS, and it is the
 * whole band-limiting argument. `floor` of the phase would be a strand id — the right idea and an
 * infinite-bandwidth signal, which on a screen is a staircase that crawls. Smoothstepping between
 * neighbouring cells puts the field's energy at and below the lattice frequency instead, which is
 * the property that lets `strandFadeValue` retire it cleanly against Nyquist.
 *
 * @param {number} phase - across-strand arc length in units of `strandPitch`.
 * @returns {number} mean 0, standard deviation 1, band-limited at the lattice frequency.
 */
export function strandNoiseValue( phase ) {

    const cell = Math.floor( phase );
    const offset = phase - cell;
    const weight = offset * offset * ( 3 - 2 * offset );
    const low = strandHashValue( cell );
    const high = strandHashValue( cell + 1 );

    return ( ( low + ( high - low ) * weight ) * 2 - 1 ) / STRAND_NOISE_SD;

}

/**
 * THE PER-LOCK TILT ANGLE, in radians, mirrored by `lockTiltNode`.
 *
 * @param {number} identity - the emitted `uv1.x`, `(index + 0.5) / HAIR_LOCK_COUNT`.
 * @param {Object} [settings] - overrides over `HAIR_DEFAULTS`; only `lockTilt` is read.
 * @returns {number} centred on zero, inside ±spread/2 by construction.
 */
export function lockTiltValue( identity, settings = {} ) {

    const spread = settings.lockTilt ?? HAIR_DEFAULTS.lockTilt;
    const index = lockIndexValue( identity );

    return ( strandHashValue( index + HAIR_LOCK_HASH_OFFSET ) - 0.5 ) * spread;

}

/**
 * The lock index a shader recovers from the emitted `uv1.x`, and the recovery is EXACT.
 *
 * `(i + 0.5)/n` sits in the middle of its own `1/n` bin, so `floor(u · n)` returns `i` for every
 * `i`; and at `n = 16` every emitted value is an odd multiple of 1/32, a binary fraction stored
 * without error in f32. `tools/figure-pipeline/hair_lockid.selftest.mjs` sweeps the round trip over
 * every index of every count from 2 to 64 through a `Float32Array`, which is the storage the GLB
 * actually uses.
 *
 * 🚩 THE CLAMP IS NOT DEFENSIVE PADDING. The scalp CAP writes this channel per VERTEX rather than
 * per face — `hair_cards.assemble_cards` explains why, and the short version is that a per-face
 * value would shatter the cap into hundreds of components and take the card-count gate with it — so
 * the cap's identity INTERPOLATES across a face and can land on exactly 1.0 at a shared corner.
 * `floor(1.0 · 16)` is 16, one past the end.
 */
/**
 * The tilt spread the SHADER will run at, which is not always the one the material was built with.
 *
 * Both R25 defect arms bypass the uniform — `no-lock-tilt` returns before the rotation and
 * `lock-tilt-max` substitutes `HAIR_LOCK_TILT_MAX` — so a census that printed `nodes.lockTilt.value`
 * would describe the wrong picture on exactly the two plates whose whole purpose is to be a
 * different picture. R24's `lock.spread` has that shape and says so in its own comment; this is the
 * repair rather than the repetition.
 */
export function effectiveLockTilt( defect, settings = {} ) {

    if ( defect === 'no-lock-tilt' ) return 0;
    if ( defect === 'lock-tilt-max' ) return HAIR_LOCK_TILT_MAX;

    return settings.lockTilt ?? HAIR_DEFAULTS.lockTilt;

}

/**
 * The primary lobe width the SHADER will run at, which is not always the one the caller asked for.
 *
 * 🎯 THE R25 LESSON, APPLIED AT BUILD TIME RATHER THAN AT REPORT TIME. `effectiveLockTilt` exists
 * because two defect arms bypass a uniform and a census printing that uniform would describe the
 * wrong picture. R26's arm does not bypass anything: this function runs BEFORE the uniforms are
 * created, so `nodes.roughnessR` — and β_TT, β_TRT and `material.roughness`, which are derived from
 * it — all carry the effective value, and `describe()` reads the truth without a special case. That
 * is the better shape of the same repair, and it is available here only because a width is one
 * number rather than a branch in the node graph.
 *
 * ⚠️ The defect WINS over an explicit `settings.roughnessR`. `?hairdefect=wide-lobe&hairbeta=0.08`
 * renders the wide arm, because a control an unrelated key can quietly cancel is not a control.
 *
 * @param {string} defect - one of `HAIR_DEFECTS`.
 * @param {Object} [settings] - overrides over `HAIR_DEFAULTS`; only `roughnessR` is read.
 */
export function effectiveRoughnessR( defect, settings = {} ) {

    if ( defect === 'wide-lobe' ) return HAIR_BETA_R_MID;

    return settings.roughnessR ?? HAIR_DEFAULTS.roughnessR;

}

export function lockIndexValue( identity ) {

    return Math.min( HAIR_LOCK_COUNT - 1, Math.max( 0, Math.floor( identity * HAIR_LOCK_COUNT ) ) );

}

/**
 * How much of the strand field survives at this sampling rate. 1 where the lock is comfortably
 * resolved, 0 where its period has fallen under two pixels of the pass that is drawing it.
 *
 * @param {number} cyclesPerPixel - the field's own screen frequency, per RENDER-TARGET pixel.
 */
export function strandFadeValue( cyclesPerPixel, settings = {} ) {

    const options = { ...HAIR_DEFAULTS, ...settings };

    return 1 - smoothstepValue( options.strandFadeStart, options.strandFadeEnd, cyclesPerPixel );

}

/**
 * The strand rotation itself, in radians, as the shader applies it to the tangent.
 *
 * @param {number} phase - across-strand arc length in units of `strandPitch`.
 * @param {number} cyclesPerPixel - the field's screen frequency, per render-target pixel.
 */
export function strandJitterValue( phase, cyclesPerPixel, settings = {} ) {

    const options = { ...HAIR_DEFAULTS, ...settings };

    return options.strandTangentJitter * strandFadeValue( cyclesPerPixel, options ) *
        strandNoiseValue( phase );

}

/**
 * Hoskins' `hash12` — two in, one out (`www.shadertoy.com/view/4djSRW`), transcribed operation for
 * operation and run in f32 so the mirror is a mirror of the SHADER's function rather than of a
 * double-precision one. See `strandHashValue` for why that matters at all.
 *
 * This is the LOCK's seed: one scalar per Voronoi cell, uniform on [0,1].
 */
export function lockHash12Value( x, y ) {

    const f32 = Math.fround;
    const p = [ f32( x * 0.1031 ), f32( y * 0.1031 ), f32( x * 0.1031 ) ].map( ( v ) => f32( v - Math.floor( v ) ) );
    const shifted = [ f32( p[ 1 ] + 33.33 ), f32( p[ 2 ] + 33.33 ), f32( p[ 0 ] + 33.33 ) ];
    const offset = f32( f32( f32( p[ 0 ] * shifted[ 0 ] ) + f32( p[ 1 ] * shifted[ 1 ] ) ) + f32( p[ 2 ] * shifted[ 2 ] ) );

    const q = p.map( ( v ) => f32( v + offset ) );
    const value = f32( f32( q[ 0 ] + q[ 1 ] ) * q[ 2 ] );

    return f32( value - Math.floor( value ) );

}

/**
 * Hoskins' `hash22` — two in, two out. This is the cell's SITE JITTER, i.e. where inside its cell
 * each Voronoi point sits, which is what stops the field from being a square grid.
 */
export function lockHash22Value( x, y ) {

    const f32 = Math.fround;
    const scale = [ 0.1031, 0.1030, 0.0973 ];
    const p = [ f32( x * scale[ 0 ] ), f32( y * scale[ 1 ] ), f32( x * scale[ 2 ] ) ]
        .map( ( v ) => f32( v - Math.floor( v ) ) );

    const shifted = [ f32( p[ 1 ] + 33.33 ), f32( p[ 2 ] + 33.33 ), f32( p[ 0 ] + 33.33 ) ];
    const offset = f32( f32( f32( p[ 0 ] * shifted[ 0 ] ) + f32( p[ 1 ] * shifted[ 1 ] ) ) + f32( p[ 2 ] * shifted[ 2 ] ) );

    const q = p.map( ( v ) => f32( v + offset ) );
    const first = f32( f32( q[ 0 ] + q[ 1 ] ) * q[ 2 ] );
    const second = f32( f32( q[ 0 ] + q[ 2 ] ) * q[ 1 ] );

    return [ f32( first - Math.floor( first ) ), f32( second - Math.floor( second ) ) ];

}

/**
 * THE LOCK FIELD, in cell units, and it is false-earth's `getClumpInfo` with the grass's ground
 * plane swapped for the head's own horizontal plane.
 *
 * A 3x3 scan over hashed cell points tracking the nearest (F1) AND the second-nearest (F2), then
 * blending the two seeds by the F2−F1 edge distance. The blend is the part that is easy to drop and
 * is the reason the field reads as locks rather than as tiling: at a cell boundary `d2 − d1` is
 * zero, so the two neighbours' seeds meet at 50/50 and the boundary itself carries no step.
 *
 * @param {number} x - horizontal position in CELL units (metres divided by `HAIR_LOCK_CELL_M`).
 * @param {number} y - the other horizontal axis, same units.
 * @returns {{ seed:number, nearest:number, second:number, centre:number }} `seed` is the blended
 *   lock value on [0,1]; `centre` is false-earth's `centerFactor`, 0 on a boundary and 1 at a core.
 */
export function lockFieldValue( x, y, settings = {} ) {

    const options = { ...HAIR_DEFAULTS, ...settings };

    const cellX = Math.floor( x );
    const cellY = Math.floor( y );

    let nearest = Infinity;
    let second = Infinity;
    let nearestSeed = 0;
    let secondSeed = 0;

    for ( let dy = - 1; dy <= 1; dy ++ ) {

        for ( let dx = - 1; dx <= 1; dx ++ ) {

            const neighbourX = cellX + dx;
            const neighbourY = cellY + dy;
            const jitter = lockHash22Value( neighbourX, neighbourY );
            const distance = Math.hypot( x - ( neighbourX + jitter[ 0 ] ), y - ( neighbourY + jitter[ 1 ] ) );
            const seed = lockHash12Value( neighbourX, neighbourY );

            if ( distance < nearest ) {

                second = nearest;
                secondSeed = nearestSeed;
                nearest = distance;
                nearestSeed = seed;

            } else if ( distance < second ) {

                second = distance;
                secondSeed = seed;

            }

        }

    }

    const centre = smoothstepValue( 0, options.lockBlend, second - nearest );

    return { seed: secondSeed + ( nearestSeed - secondSeed ) * ( 0.5 + 0.5 * centre ), nearest, second, centre };

}

/**
 * The lock's albedo multiplier: the field mapped to `[1 − spread/2, 1 + spread/2]`.
 *
 * 🚩 IT IS A MULTIPLIER ON THE BASE COLOUR AND NOT AN ADDITION TO THE RESULT, which is
 * false-earth's own choice and is the one that keeps the term physical: a lock that is lighter is a
 * lock with less pigment in it, so it is lighter in the terms that read pigment (the
 * multiple-scattering fake and TRT) and IDENTICAL in the one that does not (R, which never enters
 * the fibre). Adding a scalar to the output would have lifted the primary highlight too, which no
 * amount of melanin does.
 */
export function lockAlbedoValue( x, y, settings = {} ) {

    const options = { ...HAIR_DEFAULTS, ...settings };
    const { seed } = lockFieldValue( x, y, options );

    return 1 - options.lockSpread / 2 + options.lockSpread * seed;

}

/**
 * Root occlusion as a linear multiplier over the whole scattering result.
 *
 * @param {number} rootToTip - 0 at the scalp, 1 at the tip. `flow.png`'s blue channel.
 */
export function rootOcclusionValue( rootToTip, settings = {} ) {

    const options = { ...HAIR_DEFAULTS, ...settings };
    const ramp = smoothstepValue( 0, options.rootOcclusionLength, rootToTip );

    return options.rootOcclusion + ( 1 - options.rootOcclusion ) * ramp;

}

/**
 * The multiple-scattering term, per channel. **What SHIPS is slide 39 verbatim**; the alternative
 * below it is round 27's derived replacement, reachable at `?hairdefect=zinke-transmittance` and
 * **measured, refused, and kept only as a probe.** Read `HAIR_DEFECTS['zinke-transmittance']` for
 * the refusal before spending a round on this line again.
 *
 *   shipped   `S = √C · (n̂·ωi + 1)/4π · (C / Luma(C))^(1 − Shadow)`
 *   probe     `S = ā_f^(1 + n) · (n̂·ωi + 1)/4π`,  `ā_f = √C`,  `n = −ln(Shadow) = shadowDensity · depth`
 *
 * ## Why the probe was built, and the diagnosis stands even though the fix did not
 *
 * Round 27 measured slide 39's third factor over its whole `Shadow` range on the shipped albedo and
 * it is **ISOLUMINANT AND POINTED THE WRONG WAY** — it gets BRIGHTER as it deepens, because
 * dividing by `Luma(C)` is exactly what removes the level from a per-channel attenuation and leaves
 * only its chromaticity. The tagged block below this docstring carries the ratio. **A floor that cannot
 * get darker anywhere is a floor no lobe can peak through**, and CHECKPOINT §9 measured R's p99
 * against the mass mean at a ratio of 1.00 for that reason. Karis concedes the term's status in the
 * speaker notes `docs/research/hair.md` §1.8 already transcribes: *"a giant artistic hack and not
 * physically based in the slightest… derived by looking at photos, not ground truth renders."*
 *
 * Zinke, Yuksel, Weber & Keyser, *Dual Scattering Approximation for Fast Multiple Scattering in
 * Hair*, SIGGRAPH 2008, §3.1 Eq.5, is the published form of the same quantity:
 *
 *   `T_f(x, ω_d) = d_f(x, ω_d) · Π_{k=1..n} ā_f(θ_d^k)`
 *
 * — a PER-CHANNEL product over the `n` fibres on the shadow path, so it darkens geometrically as
 * `ā_f^n` while its channel ratio sharpens as `(ā_f,R / ā_f,B)^n`. Level and chroma are driven by
 * ONE variable and they move together. §3.1.1 sets `T_f = 1` at `n = 0`.
 *
 * ## Where the amplitude comes from, and it introduces NO new constant
 *
 * **`ā_f = √C` is this material's own fibre, not a fit.** `HairLightingModel.scatter`'s TT lobe
 * already carries the fibre's transmittance as `absorbTT = C^( √(1 − h²a²) / (2 cosθ_d) )`. At the
 * ray through the fibre's centre (`h = 0`) at normal incidence (`cosθ_d = 1`) that is exactly
 * `C^(1/2)`. So `√C` — the factor Karis already writes and gives no derivation for — IS the
 * shortest-path transmittance of one of our own fibres, which is what Zinke's `ā_f` is an average
 * of. It is the LEAST attenuating choice available (it drops the `(1−F)²` Fresnel loss and the
 * fraction scattered outside the forward cone), so it errs bright.
 *
 * **`n = −ln(Shadow)` is Karis' own slide 44 inverted.** `Shadow = exp(−shadowDensity · depth)` is
 * Beer–Lambert, so its own exponent IS the optical path length in units of one attenuation event.
 * No constant is chosen here: the shader multiplies `depth` by `shadowDensity` and this mirror
 * takes the logarithm, and `hair-transmittance.selftest.mjs` §A asserts the two agree to 1e-12.
 *
 * **The exponent is `1 + n` and not `n`, and the `1` is `Ψ^G`'s own scattering event.** `T_f` is
 * the transmittance of the light on its way TO the shading point; the light then has to scatter
 * once more to leave. That single traverse is Karis' original `√C`, so at `n = 0` the probe returns
 * `√C · wrap` — **bit for bit what the shipped branch returns there** — and Zinke §3.1.1's
 * `T_f = 1` at `n = 0` holds exactly. The A/B is zero on the fully-lit boundary and grows with
 * depth, which is the only place a depth term is entitled to act, and it is what makes a moved
 * pixel attributable. `hair-transmittance.selftest.mjs` §B asserts the equality to 1e-15.
 *
 * **`d_f` is deliberately NOT applied.** Zinke ships a density factor of 0.7 (§6 calls it the
 * method's only user-adjustable term). It is a CONSTANT multiplier on the pedestal, and a constant
 * multiplier on the pedestal is `HAIR_DEFAULTS.scatter` — the knob CHECKPOINT §2's trap is about
 * and the one free variable round 27 was explicitly not spending. Applying it would also break
 * the `n = 0` boundary equality above.
 *
 * 🚩 **THE INPUT IS THE WRONG COORDINATE AND THIS EXPRESSION DOES NOT FIX THAT — WHICH IS WHY IT
 * IS A PROBE.** `Shadow` reads `depth.png` at the CARD'S OWN ATLAS UV, and
 * `tools/figure-pipeline/hair_texture.py:791` bakes that sheet as `random.random()` per strand.
 * Measured against a CPU ray-cast count of cards between the fragment and each light — by the same
 * round's pixel probe, `tools/critic/hair-pedestal.mjs`, not by this file's own gate — the shipped
 * `Shadow` is UNCORRELATED and the sign is backwards. Fixing the FORM of a depth
 * dependence whose SIGNAL is white noise buys a per-pixel wobble and nothing else, which is exactly
 * what round 27 went on to measure. The signal needs a light-view path length (slide 44's actual
 * shadow map), which is `render/**` plumbing and not this file's. See
 * `docs/research/hair-multiple-scattering.md` for the sheet measurements.
 *
 * @param {number} dotFakeNormalLight - `n̂ · ωi`, Karis' synthesised normal against the light.
 * @param {number[]} colour - the fragment's linear albedo, after the lock field.
 * @param {number} shadow - slide 44's exponential, `exp(−shadowDensity · depth)`, in (0, 1].
 */
// The two terms' response to their own depth input, on the shipped albedo. ⚠️ EACH IS QUOTED OVER
// ITS OWN DOMAIN AND THE TWO DOMAINS ARE NOT THE SAME, so the numbers are NOT a ratio of each
// other: slide 39's luminance RISES by 1.0927 as `Shadow` sweeps 0 → 1, and Zinke's `T_f` FALLS by
// 1927.5 as the fibre count `n` sweeps 0 → 3. What the probe tested is the SIGN, which is opposite,
// and the sign is domain-independent. The magnitudes are not comparable and must never be divided.
//
// 🔴 THIS SENTENCE ONCE READ AS THOUGH BOTH NUMBERS SHARED ONE DOMAIN — "over the full range the
// shipped `shadowDensity` can produce" — which is true of the first and false of the second. SIXTH
// instance of LEARNINGS §1.25r, and the informative part is that **the gate passed it**: both
// numbers ARE what their tagged command prints, because `hair-transmittance.selftest.mjs:105-106`
// computes them over the two different domains too. **A gate that re-derives a number from its
// producer cannot catch an error the producer shares** — it checks transcription, not meaning. That
// is a real and permanent limit of `quoted-numbers`, and it belongs beside its 0.038% coverage
// figure as the second half of what its green result does not mean.
//
// @claim 1.0927 :: node tools/critic/hair-transmittance.selftest.mjs :: slide 39 luminance, Shadow 0 → 1 #4
// @claim 1927.5 :: node tools/critic/hair-transmittance.selftest.mjs :: Zinke T_f luminance, n 0 → 3 #3
export function scatterValue( dotFakeNormalLight, colour, shadow, settings = {} ) {

    const options = { ...HAIR_DEFAULTS, ...settings };
    const wrap = ( dotFakeNormalLight + 1 ) / ( 4 * Math.PI );

    if ( options.defect === 'zinke-transmittance' ) {

        const events = forwardScatteringEvents( shadow );

        return colour.map( ( channel ) =>
            options.scatter * wrap * Math.pow( Math.sqrt( channel ), 1 + events ) );

    }

    const luma = Math.max( 0.2126 * colour[ 0 ] + 0.7152 * colour[ 1 ] + 0.0722 * colour[ 2 ], 1e-5 );

    return colour.map( ( channel ) =>
        options.scatter * Math.sqrt( channel ) * wrap * Math.pow( channel / luma, 1 - shadow ) );

}

/**
 * `n`, the number of forward-scattering events on the path to the light, out of slide 44's
 * exponential. `Shadow = exp(−n)` is Beer–Lambert, so `n = −ln(Shadow)` is an inversion and not a
 * model — the shader never runs it, because it holds `shadowDensity · depth` directly.
 *
 * Clamped at the bottom because `Shadow = 0` is `n = ∞`. The floor is this file's own `EPSILON`,
 * and the clamp exists only so a caller handing this function a zero gets a number rather than an
 * infinity — see the tagged block below for where it lands.
 */
// EPSILON is 1e-4, so `n` is capped at 9.210340. The shipped sheet's deepest texel is
// `n = shadowDensity = 3.0`, which puts the clamp 3.07x outside anything the groom can produce.
//
// @claim 9.210340 :: node tools/critic/hair-transmittance.selftest.mjs :: events clamp at EPSILON #2
// @claim 3.07 :: node tools/critic/hair-transmittance.selftest.mjs :: events clamp at EPSILON #3
export function forwardScatteringEvents( shadow ) {

    return - Math.log( Math.max( shadow, EPSILON ) );

}

/**
 * The card-scale occlusion stand-in, Karis slide 47: `saturate( ωi·ωr + 1 )`.
 *
 * One argument, because that is all the term has: the cosine between the incident and the outgoing
 * direction. It is 1 for every light on the viewer's side of the fragment and rolls to 0 only at
 * exact backlight, which is the geometry a head is in the way of. `saturate` is what makes it an
 * attenuator rather than a shaping term — see `HairLightingModel.scatter` for the A/B that chose it
 * over the cosine-against-the-fake-normal it replaced.
 *
 * @param {number} dotIncidentView - `ωi · ωr`, both unit and both pointing away from the fragment.
 */
export function sideVisibilityValue( dotIncidentView ) {

    return Math.min( 1, Math.max( 0, dotIncidentView + 1 ) );

}

/**
 * The exact solid angle a rectangle subtends at a point, by spherical excess.
 *
 * van Oosterom & Strackee, "The solid angle of a plane triangle", IEEE Trans. Biomed. Eng. BME-30
 * (1983): `tan(Ω/2) = |a·(b×c)| / ( |a||b||c| + (a·b)|c| + (a·c)|b| + (b·c)|a| )`, summed over the
 * quad's two triangles. Mirrored here because it is the one part of the rect-area path that has a
 * closed-form answer the selftest can check against a hemisphere and a small square.
 *
 * @param {number[][]} corners - four vectors from the shading point to the panel's corners.
 */
export function solidAngleValue( corners ) {

    return sphericalTriangle( corners[ 0 ], corners[ 1 ], corners[ 2 ] ) +
        sphericalTriangle( corners[ 0 ], corners[ 2 ], corners[ 3 ] );

}

function sphericalTriangle( a, b, c ) {

    const lengthA = Math.hypot( ...a );
    const lengthB = Math.hypot( ...b );
    const lengthC = Math.hypot( ...c );

    const numerator = Math.abs( dotProduct( a, crossProduct( b, c ) ) );
    const denominator = lengthA * lengthB * lengthC +
        dotProduct( a, b ) * lengthC +
        dotProduct( a, c ) * lengthB +
        dotProduct( b, c ) * lengthA;

    return 2 * Math.atan2( numerator, denominator );

}

function dotProduct( a, b ) {

    return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];

}

/** `a − b·scale`, i.e. the component of `a` left after removing `scale` of `b`. */
function subtractScaled( a, b, scale ) {

    return [ a[ 0 ] - b[ 0 ] * scale, a[ 1 ] - b[ 1 ] * scale, a[ 2 ] - b[ 2 ] * scale ];

}

function crossProduct( a, b ) {

    return [
        a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
        a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
        a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ]
    ];

}

function smoothstepValue( edge0, edge1, x ) {

    const t = Math.min( 1, Math.max( 0, ( x - edge0 ) / Math.max( edge1 - edge0, 1e-6 ) ) );

    return t * t * ( 3 - 2 * t );

}

/** sRGB EOTF, used to convert the look spec's encoded readings into the space a shader multiplies in. */
export function encodedToLinear( encoded ) {

    return encoded <= 0.04045 ? encoded / 12.92 : Math.pow( ( encoded + 0.055 ) / 1.055, 2.4 );

}

/** sRGB OETF. Only needed to state a derived linear colour back as the hex a spec entry can carry. */
export function linearToEncoded( linear ) {

    return linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow( linear, 1 / 2.4 ) - 0.055;

}

// --- the warm/cool axis, in the one space where it is a straight line ---------------------------
//
// 🎯 THE OPERATOR IS HERE RATHER THAN IN THE GATE BECAUSE THE CONSTANT BELOW IS DERIVED WITH IT.
// A hue asserted in the gate and a hue used to author the albedo have to be the same function or
// the assertion is about the gate. `tools/critic/color.mjs` was read first and carries HSV, which
// is the wrong tool for this question twice over: HSV's hue is a hexagonal coordinate on the
// ENCODED triple with no perceptual spacing, and its "saturation" of a near-black is dominated by
// the ratio of two single-digit code values. CIELAB's a* and b* are Cartesian, so a set of pixels
// can be averaged without the wraparound that makes a mean of hue ANGLES report the colour
// opposite the one it is, and b*'s sign IS the warm/cool axis by construction.

const LAB_WHITE = [ 0.9504559271, 1.0, 1.0890577508 ];

const LINEAR_RGB_TO_XYZ = [
    [ 0.4123907993, 0.3575843394, 0.1804807884 ],
    [ 0.2126390059, 0.7151686788, 0.0721923154 ],
    [ 0.0193308187, 0.1191947798, 0.9505321522 ]
];

const XYZ_TO_LINEAR_RGB = [
    [ 3.2409699419, - 1.5373831776, - 0.4986107603 ],
    [ - 0.9692436363, 1.8759675015, 0.0415550574 ],
    [ 0.0556300797, - 0.2039769589, 1.0569715142 ]
];

/**
 * CIELAB (D65) of a LINEAR sRGB triple. Values above 1 are fine — the plate never has them, but the
 * radiance behind it does.
 *
 * @returns {number[]} `[ L*, a*, b* ]`.
 */
export function linearToLabValue( linear ) {

    const f = LINEAR_RGB_TO_XYZ
        .map( ( row ) => row[ 0 ] * linear[ 0 ] + row[ 1 ] * linear[ 1 ] + row[ 2 ] * linear[ 2 ] )
        .map( ( value, axis ) => {

            const t = value / LAB_WHITE[ axis ];

            return t > 216 / 24389 ? Math.cbrt( t ) : ( 841 / 108 ) * t + 4 / 29;

        } );

    return [ 116 * f[ 1 ] - 16, 500 * ( f[ 0 ] - f[ 1 ] ), 200 * ( f[ 1 ] - f[ 2 ] ) ];

}

/** The inverse, so a colour can be authored at a stated lightness, chroma and hue. */
export function labToLinearValue( [ lightness, a, b ] ) {

    const fy = ( lightness + 16 ) / 116;
    const f = [ fy + a / 500, fy, fy - b / 200 ];
    const inverse = ( t ) => t > 6 / 29 ? t * t * t : 3 * ( 6 / 29 ) ** 2 * ( t - 4 / 29 );
    const xyz = f.map( ( value, axis ) => inverse( value ) * LAB_WHITE[ axis ] );

    return XYZ_TO_LINEAR_RGB.map( ( row ) => row[ 0 ] * xyz[ 0 ] + row[ 1 ] * xyz[ 1 ] + row[ 2 ] * xyz[ 2 ] );

}

/**
 * The chroma-weighted mean colour of a set of sRGB samples, as CIELAB, plus the share of them on
 * the COOL side of neutral.
 *
 * 🚩 THE MEAN IS TAKEN IN a* AND b*, NEVER IN DEGREES, and the cool share is reported beside it
 * because a mean is exactly the statistic that cannot tell a uniformly slightly-warm mass from one
 * that is half warm and half violet. Both are asserted; that pair is the round-4 lesson applied to
 * a colour instead of to a silhouette.
 *
 * @param {Iterable<number[]>} samples - sRGB triples in 0..1, display-encoded.
 * @returns {{ lightness:number, a:number, b:number, hue:number, chroma:number, coolShare:number, count:number }}
 */
export function meanLabValue( samples ) {

    let sumLightness = 0;
    let sumA = 0;
    let sumB = 0;
    let cool = 0;
    let count = 0;

    for ( const sample of samples ) {

        const [ lightness, a, b ] = linearToLabValue( sample.map( encodedToLinear ) );

        sumLightness += lightness;
        sumA += a;
        sumB += b;
        if ( b < 0 ) cool += 1;
        count += 1;

    }

    if ( count === 0 ) return { lightness: 0, a: 0, b: 0, hue: NaN, chroma: 0, coolShare: 0, count: 0 };

    const a = sumA / count;
    const b = sumB / count;

    return {
        lightness: sumLightness / count, a, b,
        hue: ( Math.atan2( b, a ) * 180 / Math.PI + 360 ) % 360,
        chroma: Math.hypot( a, b ),
        coolShare: cool / count,
        count
    };

}

// --- the GPU side -------------------------------------------------------------------------------

/** `1e-4` guards, named once so the CPU mirror and the shader cannot drift on the value. */
const EPSILON = 1e-4;

/**
 * The floor on the UV Jacobian's determinant, and it is a DIFFERENT number from `EPSILON` for a
 * measured reason — see `strandTangentNode`. The determinant's own p50 on the live page is 1.109e−5,
 * so a guard has to sit orders of magnitude below that or it stops being a guard and becomes a
 * divisor. 1e−12 is below anything a non-degenerate quad can produce and above f32's denormals.
 */
const DEGENERATE_DETERMINANT = 1e-12;

/**
 * Schlick, in TSL. `f0` is a node so a defect plate can move it without a recompile.
 */
const fresnelNode = /*@__PURE__*/ Fn( ( [ cosine, f0 ] ) => {

    const clamped = cosine.saturate();

    return f0.add( float( 1 ).sub( f0 ).mul( clamped.oneMinus().pow( 5 ) ) );

} );

/** Karis slide 47's occlusion, in TSL. Mirrored by `sideVisibilityValue`. */
const sideVisibilityNode = /*@__PURE__*/ Fn( ( [ toLight, toView ] ) => {

    return toLight.dot( toView ).add( 1 ).saturate();

} );

/** Hoskins' `hash11`, in TSL. Mirrored by `strandHashValue`, which emulates this one's f32. */
const strandHashNode = /*@__PURE__*/ Fn( ( [ x ] ) => {

    const p = fract( x.mul( 0.1031 ) ).toVar();
    p.mulAssign( p.add( 33.33 ) );
    p.mulAssign( p.add( p ) );

    return fract( p );

} );

/** One-dimensional value noise on the strand axis, unit sd. Mirrored by `strandNoiseValue`. */
const strandNoiseNode = /*@__PURE__*/ Fn( ( [ phase ] ) => {

    const cell = floor( phase );
    const offset = phase.sub( cell );
    const weight = offset.mul( offset ).mul( float( 3 ).sub( offset.mul( 2 ) ) );

    return mix( strandHashNode( cell ), strandHashNode( cell.add( 1 ) ), weight )
        .mul( 2 ).sub( 1 ).div( STRAND_NOISE_SD );

} );

/** Hoskins' `hash12`, in TSL. Mirrored by `lockHash12Value`. One scalar per lock cell. */
const lockHash12Node = /*@__PURE__*/ Fn( ( [ point ] ) => {

    const p = fract( vec3( point.x, point.y, point.x ).mul( 0.1031 ) ).toVar();
    p.addAssign( dot( p, vec3( p.y, p.z, p.x ).add( 33.33 ) ) );

    return fract( p.x.add( p.y ).mul( p.z ) );

} );

/** Hoskins' `hash22`, in TSL. Mirrored by `lockHash22Value`. The cell's site jitter. */
const lockHash22Node = /*@__PURE__*/ Fn( ( [ point ] ) => {

    const p = fract( vec3( point.x, point.y, point.x ).mul( vec3( 0.1031, 0.1030, 0.0973 ) ) ).toVar();
    p.addAssign( dot( p, vec3( p.y, p.z, p.x ).add( 33.33 ) ) );

    return fract( vec2( p.x.add( p.y ), p.x.add( p.z ) ).mul( vec2( p.z, p.y ) ) );

} );

/**
 * THE LOCK FIELD, in TSL. Mirrored by `lockFieldValue`.
 *
 * 🚩 THE 3x3 SCAN IS UNROLLED IN JAVASCRIPT AND THE MIN-TRACKING IS BRANCHLESS, and both are
 * deliberate. Nine iterations of a compile-time loop emit nine straight-line blocks the backend can
 * schedule; a TSL `Loop` with an `If` inside it emits real control flow around a texture-free
 * arithmetic kernel, for no benefit. And the four `select`s below all read the PRE-UPDATE values —
 * every `assign` happens after all four are computed — which is the one thing a hand-written F1/F2
 * tracker gets wrong.
 *
 * @param {Node} point - horizontal position in CELL units.
 * @param {Node} blend - `HAIR_LOCK_BLEND_FRACTION`, in cell units.
 */
const lockFieldNode = /*@__PURE__*/ Fn( ( [ point, blend ] ) => {

    const cell = floor( point ).toVar();

    const nearest = float( 1e9 ).toVar();
    const second = float( 1e9 ).toVar();
    const nearestSeed = float( 0 ).toVar();
    const secondSeed = float( 0 ).toVar();

    for ( let dy = - 1; dy <= 1; dy ++ ) {

        for ( let dx = - 1; dx <= 1; dx ++ ) {

            const neighbour = cell.add( vec2( dx, dy ) ).toVar();
            const site = neighbour.add( lockHash22Node( neighbour ) );
            const distance = length( point.sub( site ) ).toVar();
            const seed = lockHash12Node( neighbour ).toVar();

            const closer = distance.lessThan( nearest );

            const nextSecond = closer.select( nearest, second.min( distance ) ).toVar();
            const nextSecondSeed = closer
                .select( nearestSeed, distance.lessThan( second ).select( seed, secondSeed ) ).toVar();
            const nextNearest = nearest.min( distance ).toVar();
            const nextNearestSeed = closer.select( seed, nearestSeed ).toVar();

            second.assign( nextSecond );
            secondSeed.assign( nextSecondSeed );
            nearest.assign( nextNearest );
            nearestSeed.assign( nextNearestSeed );

        }

    }

    // false-earth's `centerFactor` / `blendFactor`, verbatim in shape: zero on a cell boundary,
    // one at a cell core, and the seed meets its neighbour's at 50/50 exactly on the boundary.
    const centre = smoothstep( float( 0 ), blend, second.sub( nearest ) );

    return mix( secondSeed, nearestSeed, mix( float( 0.5 ), float( 1 ), centre ) );

} );

/**
 * The lock's albedo multiplier, in TSL. Mirrored by `lockAlbedoValue`.
 *
 * 🎯 `positionGeometry` IS THE COORDINATE AND THE CHOICE IS LOAD-BEARING. It is the raw POSITION
 * attribute — before skinning, before morphs — so the field is welded to the groom rather than to
 * the pose, the camera or the frame. `positionLocal` would drift with the head; `positionWorld`
 * would slide the locks across the hair every time the figure moved; a screen-space coordinate
 * would put the judges' word "noise" back with a bigger cell.
 *
 * 🚩 AND IT IS `.xz` BECAUSE A LOCK IS A COLUMN. The glTF export is Y-up, so xz is the head's
 * horizontal plane and the cells are vertical prisms — which is `hair_cards.py`'s own definition of
 * a lock, *"a column of hair from the scalp to the tip"*, and is false-earth's flat XZ root grid
 * with the ground swapped for the head.
 */
function lockAlbedoNode( nodes ) {

    if ( nodes.defect === 'no-lock-albedo' ) return float( 1 );

    const spread = nodes.defect === 'lock-albedo-max' ? float( HAIR_LOCK_SPREAD_MAX ) : nodes.lockSpread;

    const point = vec2( positionGeometry.x, positionGeometry.z ).div( nodes.lockCell );
    const seed = lockFieldNode( point, nodes.lockBlend );

    return float( 1 ).sub( spread.mul( 0.5 ) ).add( spread.mul( seed ) );

}

/**
 * THE PER-LOCK TILT ANGLE, in TSL. Mirrored by `lockTiltValue`.
 *
 * 🎯 `uv(1)` IS THE GENERATOR'S OWN LOCK MEMBERSHIP AND NOT A RE-DERIVATION OF IT. `hair_cards.py`
 * writes `(nearest_lock index + 0.5) / LOCK_COUNT` into TEXCOORD_1's `u`, constant over a whole
 * card; `GLTFLoader.js:2228` maps TEXCOORD_1 to the `uv1` attribute; `nodes/accessors/UV.js`
 * resolves `uv(1)` to it. `verify_glb.mjs`'s lock clause re-derives the index from the sixteen
 * centres in the file's own extras and fails the build if under 90% of cards agree.
 *
 * 🚩 THE FIELD IS PIECEWISE CONSTANT WITH HARD BOUNDARIES, AND THAT IS THE POINT RATHER THAN A
 * COMPROMISE. R24's lock term smoothstepped across its Voronoi edges precisely so it would not be
 * broadband. This one must NOT: "the highlight breaks at a lock boundary" is a statement about a
 * discontinuity, and a smoothed label is not a label. It costs no new aliasing class, because the
 * only places it is discontinuous are card boundaries, and every card in this groom is already its
 * own connected component with its own normal and its own UV — the discontinuity lands exactly
 * where the geometry already has one.
 */
const lockTiltNode = /*@__PURE__*/ Fn( ( [ identity, spread ] ) => {

    // `.min(...)` for the reason `lockIndexValue` gives: the CAP's identity interpolates and can
    // reach exactly 1.0 at a shared corner, and `floor(1.0 · 16)` is one past the last lock.
    const index = floor( identity.mul( HAIR_LOCK_COUNT ) ).min( HAIR_LOCK_COUNT - 1 ).max( 0 );

    return strandHashNode( index.add( HAIR_LOCK_HASH_OFFSET ) ).sub( 0.5 ).mul( spread );

} );

/**
 * The forward chord of an axis-aligned ellipsoid, in TSL. Mirrors `ellipsoidSpanValue` composed
 * with `forwardChordValue`, and `HairEnvelope.selftest.mjs` holds the two together.
 *
 * ⚠️ THE MISS CASE IS A SELECT AND NOT A BRANCH, because a discriminant that goes negative is the
 * COMMON case here rather than the exceptional one: most fragments face most lights across open
 * air. `disc.max(0).sqrt()` keeps the square root defined on every lane and the select then throws
 * the result away, which is what a GPU does anyway with a branch that both sides of a warp take.
 */
const forwardChordNode = /*@__PURE__*/ Fn( ( [ origin, direction, radii ] ) => {

    const o = origin.div( radii );
    const d = direction.div( radii );

    const a = d.dot( d );
    const b = o.dot( d ).mul( 2 );
    const c = o.dot( o ).sub( 1 );

    const discriminant = b.mul( b ).sub( a.mul( c ).mul( 4 ) );
    const root = discriminant.max( 0 ).sqrt();
    const scale = float( 0.5 ).div( a.max( EPSILON ) );

    const enter = b.negate().sub( root ).mul( scale ).max( 0 );
    const exit = b.negate().add( root ).mul( scale ).max( 0 );

    return discriminant.greaterThan( 0 ).select( exit.sub( enter ).max( 0 ), float( 0 ) );

} );

/** M_p, in TSL. See `longitudinalValue` for what the normalisation means. */
const longitudinalNode = /*@__PURE__*/ Fn( ( [ sinThetaSum, shift, roughness ] ) => {

    const width = roughness.max( EPSILON );
    const offset = sinThetaSum.sub( shift );

    return offset.mul( offset ).div( width.mul( width ).mul( 2 ) ).negate().exp()
        .div( width.mul( Math.sqrt( 2 * Math.PI ) ) );

} );

/**
 * The lighting model. Everything that is specific to hair is in here and in `strandFrame`.
 *
 * It extends `LightingModel` rather than `PhysicalLightingModel` deliberately: hair has no
 * Lambert diffuse and no GGX lobe, and inheriting them would pay for two BRDFs per light in order
 * to throw both away. The cost of that decision is that this model must supply its own indirect
 * term, which it does not — see `indirect()`.
 */
export class HairLightingModel extends LightingModel {

    /**
     * @param {Object} nodes - the material's uniforms and sampled sheets, from `createHairMaterial`.
     */
    constructor( nodes ) {

        super();

        this.nodes = nodes;

        // All assigned in `start()`. Every one of them is per-fragment and independent of which
        // light is being evaluated, so they are computed once rather than five times.
        this.tangent = null;
        this.fakeNormal = null;
        this.colour = null;
        this.sinThetaR = null;
        this.perpendicularR = null;
        this.cosThetaR = null;
        this.shadow = null;
        this.forwardEvents = null;
        this.occlusion = null;

        // Round 28. The groom's fitted shell, brought into the space the lights already live in.
        this.envelopeOrigin = null;
        this.envelopeAxes = null;

    }

    /**
     * The per-fragment frame, computed before `super.start()` walks the light list.
     */
    start( builder ) {

        const nodes = this.nodes;

        this.tangent = this.strandTangent().toVar( 'hairTangent' );

        // ωr. `positionViewDirection` is fragment → camera and already unit.
        const toView = positionViewDirection;

        this.sinThetaR = this.tangent.dot( toView ).toVar( 'hairSinThetaR' );
        this.cosThetaR = float( 1 ).sub( this.sinThetaR.mul( this.sinThetaR ) ).max( 0 ).sqrt().toVar( 'hairCosThetaR' );
        this.perpendicularR = toView.sub( this.tangent.mul( this.sinThetaR ) ).toVar( 'hairPerpR' );

        // Karis' fake normal, slide 39. The direction in the plane perpendicular to the strand
        // that faces the viewer. It is also what this material writes to the G-buffer.
        this.fakeNormal = normalize( this.perpendicularR ).toVar( 'hairFakeNormal' );

        // 🎯 ROUND 24'S WHOLE CHANGE IS THIS ONE MULTIPLY. The lock field modulates the BASE COLOUR,
        // so it reaches the two terms that read pigment — slide 39's fake and TRT — and correctly
        // does not reach R, which never enters the fibre. It is separate from the strand jitter by
        // construction: that one is a rotation of `this.tangent` above, this one is a scalar on the
        // colour, and no expression is shared between them.
        //
        // ⚠️ IT IS APPLIED HERE AND NOT TO `material.colorNode`. `colorNode` is the G-buffer's
        // `diffuseColor` guide that the denoise and the grade read; leaving it unmodulated means
        // the A/B between this arm and `?hairdefect=no-lock-albedo` differs in the LIGHTING and in
        // nothing else, which is what makes the measured delta attributable. A term in both places
        // would be two changes wearing one name.
        this.colour = nodes.baseColour.mul( lockAlbedoNode( nodes ) ).toVar( 'hairColour' );

        // Slide 44's exponential, standing on the baked bundle depth. See the header, penalty 2.
        //
        // 🎯 ROUND 27 KEEPS BOTH HALVES OF THE SAME QUANTITY, and that is not redundancy. `Shadow`
        // is `exp(−n)` and `n` is the optical path length in units of one attenuation event, so the
        // exponent IS the fibre count Zinke's Eq.5 is a product over. `scatterValue` takes `Shadow`
        // and inverts it; the shader has `n` already and must never pay for a log to get it back.
        const depth = nodes.depthMap === null ? float( 0 ) : nodes.depthMap.sample( uv() ).r;
        this.forwardEvents = depth.mul( nodes.shadowDensity ).toVar( 'hairForwardEvents' );
        this.shadow = this.forwardEvents.negate().exp().toVar( 'hairShadow' );

        // 🎯 ROUND 28. THE GROOM'S OWN SHELL, IN VIEW SPACE, COMPUTED ONCE PER FRAGMENT.
        //
        // 🚩 AND NOT COMPUTED AT ALL ON THE SHIPPED PATH. Four `mat4 × vec4` products and three dot
        // products per fragment is not free, and R28 did not earn them: its measurement is a
        // negative on the picture (see `HAIR_ENVELOPE_EXTINCTION`). `envelopeArm` is resolved from a
        // constant at build time, so the shipped shader contains none of this — which is the
        // condition under which "R28 costs the default build exactly nothing" is a fact about the
        // emitted code rather than a hope about the optimiser.
        //
        // The envelope is fitted in WORLD space and tracked to the head bone (`applyHairMaterial`),
        // but every light this model sees arrives in VIEW space — `direct()` is handed a view-space
        // direction and `directRectArea()` builds one out of `positionView`. Rather than lift the
        // fragment and five directions into world space, the ellipsoid's frame is brought down
        // here: `cameraViewMatrix` is world→view, so it moves the centre as a POINT (w = 1) and the
        // three axes as DIRECTIONS (w = 0). Four matrix products per fragment, none per light.
        //
        // ⚠️ THE AXES ARE ORTHONORMAL, SO A DOT PRODUCT IS THE CHANGE OF BASIS. `applyHairMaterial`
        // ships unit, mutually perpendicular axes because the head bone's world matrix is rigid;
        // if that ever stops being true the projection below silently stops being a rotation, which
        // is why the gate asserts orthonormality on the uniforms rather than trusting the source.
        if ( isEnvelopeArm( nodes.defect ) ) {

            const centreView = cameraViewMatrix.mul( vec4( nodes.envelopeCentre, 1 ) ).xyz;
            const axisX = cameraViewMatrix.mul( vec4( nodes.envelopeAxisX, 0 ) ).xyz.toVar( 'hairEnvelopeAxisX' );
            const axisY = cameraViewMatrix.mul( vec4( nodes.envelopeAxisY, 0 ) ).xyz.toVar( 'hairEnvelopeAxisY' );
            const axisZ = cameraViewMatrix.mul( vec4( nodes.envelopeAxisZ, 0 ) ).xyz.toVar( 'hairEnvelopeAxisZ' );

            this.envelopeAxes = [ axisX, axisY, axisZ ];

            const offset = positionView.sub( centreView );
            this.envelopeOrigin = vec3( offset.dot( axisX ), offset.dot( axisY ), offset.dot( axisZ ) )
                .toVar( 'hairEnvelopeOrigin' );

        }

        this.occlusion = this.rootOcclusion().toVar( 'hairRootOcclusion' );

        super.start( builder );

    }

    /**
     * 🎯 `n` FOR ONE LIGHT — the whole of round 28, and the only quantity in this material that is
     * a function of BOTH the fragment and the light direction.
     *
     * `l` is the metres of hair shell on the segment from this fragment toward this light: the
     * forward chord of the outer ellipsoid minus the forward chord of the inner one, because a ray
     * to a light behind the head crosses the shell twice and the skull in between, where there are
     * no fibres. `n = σ_hair · l` puts it in the units slide 44's exponent is already written in.
     *
     * 🚩 THE DEGENERATE CASE IS EXACTLY ZERO AND THAT IS BY CONSTRUCTION. `createHairMaterial`
     * initialises both radii to the same vector, so before `applyHairMaterial` fits the groom the
     * two chords are the same expression on the same numbers and their difference is 0 — which
     * makes `Shadow` exactly 1 and the term identical to a build with no depth sheet at all. A
     * material that never meets a mesh therefore degrades to a defined picture rather than to a
     * NaN, and no `if` is needed anywhere on the GPU to say so.
     *
     * @param {Node} toLight - unit, view space, exactly as the two light paths supply it.
     * @returns {Node} `n`, in forward-scattering events.
     */
    envelopeEvents( toLight ) {

        const nodes = this.nodes;
        const [ axisX, axisY, axisZ ] = this.envelopeAxes;

        // 🔴 THE FALSIFICATION ARM. Everything else about the term survives — it is still a
        // per-fragment chord through the fitted shell — and only the direction stops being the
        // light's. If the two arms render the same picture then this term is a scalar in disguise,
        // which is precisely the verdict R27 returned on its own predecessor.
        const toward = nodes.defect === 'envelope-fixed-direction'
            ? normalize( nodes.constantTangent )
            : toLight;

        const direction = vec3( toward.dot( axisX ), toward.dot( axisY ), toward.dot( axisZ ) );

        const outer = forwardChordNode( this.envelopeOrigin, direction, nodes.envelopeOuter );
        const inner = forwardChordNode( this.envelopeOrigin, direction, nodes.envelopeInner );

        return outer.sub( inner ).max( 0 ).mul( nodes.envelopeExtinction );

    }

    /**
     * THE STRAND DIRECTION, and the whole anisotropy claim rests on this function.
     *
     * 🎯 It is derived from the CARD, not from the screen and not from a vertex attribute. The
     * groom carries no `TANGENT` accessor — checked against the exported GLB, whose only
     * attributes are POSITION / NORMAL / TEXCOORD_0 / JOINTS_0 / WEIGHTS_0 — so a `tangentView`
     * read would silently fall back to something that is not the strand. What IS available and is
     * exact is the card's own UV parameterisation: `hair_cards.py` lays every card out with `v`
     * running root-at-top to tip-at-bottom and no card rotated in UV space (254 of 254 sit on
     * exactly two u columns), so ∂P/∂v IS the fibre direction, and it can be recovered from screen
     * derivatives by inverting the 2×2 UV Jacobian.
     *
     * The flow sheet then rotates it per texel, inside the card's own plane, so that neighbouring
     * strands on one card do not all point the same way — which is the difference between a card
     * that reads as a bundle and one that reads as a ribbon.
     *
     * 🚩 `?hairdefect=constant-tangent` returns a fixed view-space direction instead. That is the
     * rejection proof for this whole file: it renders a perfectly plausible picture with a
     * highlight welded to the screen, and only a measurement against the strand direction can tell
     * the two apart.
     */
    strandTangent() {

        return strandTangentNode( this.nodes );

    }

    /**
     * The measured root darkening. See `HAIR_DEFAULTS.rootOcclusion` for why it is a LINEAR 0.135
     * and not the punch-list's 0.40.
     */
    rootOcclusion() {

        const nodes = this.nodes;

        if ( nodes.flowMap === null ) return float( 1 );

        const rootToTip = nodes.flowMap.sample( uv() ).b;
        const ramp = smoothstep( float( 0 ), nodes.rootOcclusionLength, rootToTip );

        return mix( nodes.rootOcclusion, float( 1 ), ramp );

    }

    /**
     * The BSDF for one incident direction, all three lobes, per channel.
     *
     * Returns radiance per unit incident radiance-times-solid-angle, so both light paths finish by
     * multiplying it by exactly that: `lightColor` for a punctual light (already an irradiance) and
     * `lightColor · Ω` for a panel.
     */
    scatter( toLight ) {

        const nodes = this.nodes;
        const tangent = this.tangent;

        // The irradiance probe — see `HAIR_DEFECTS['unit-bsdf']`. Returned before any of the
        // geometry is computed so the plate measures the LIGHT PATH and nothing else.
        if ( nodes.defect === 'unit-bsdf' ) return vec3( 1 / ( 4 * Math.PI ) );

        const sinThetaI = tangent.dot( toLight ).toVar();
        const cosThetaI = float( 1 ).sub( sinThetaI.mul( sinThetaI ) ).max( 0 ).sqrt().toVar();

        // cosθd by the half-angle identity — see the CPU mirror for the derivation.
        const cosThetaD = float( 0.5 )
            .add( cosThetaI.mul( this.cosThetaR ).add( sinThetaI.mul( this.sinThetaR ) ).mul( 0.5 ) )
            .max( 0 ).sqrt().max( EPSILON ).toVar();

        const perpendicularI = toLight.sub( tangent.mul( sinThetaI ) );
        const cosPhi = perpendicularI.dot( this.perpendicularR )
            .div( cosThetaI.mul( this.cosThetaR ).max( 1e-6 ) )
            .clamp( - 1, 1 ).toVar();

        const cosHalfPhi = float( 0.5 ).add( cosPhi.mul( 0.5 ) ).max( 0 ).sqrt().toVar();
        const sinThetaSum = sinThetaI.add( this.sinThetaR ).toVar();

        // --- R ---------------------------------------------------------------------------------
        // Achromatic by construction, which is why the primary band takes the LIGHT's colour.
        const halfCosine = float( 0.5 ).add( toLight.dot( positionViewDirection ).mul( 0.5 ) ).max( 0 ).sqrt();
        const azimuthalR = cosHalfPhi.mul( 0.25 ).mul( fresnelNode( halfCosine, nodes.fresnelF0 ) );
        const lobeR = longitudinalNode( sinThetaSum, nodes.shiftR, nodes.roughnessR )
            .mul( azimuthalR ).mul( nodes.weightR );

        // --- TT --------------------------------------------------------------------------------
        const modifiedIor = float( 1.19 ).div( cosThetaD ).add( cosThetaD.mul( 0.36 ) );
        const a = float( 1 ).div( modifiedIor );
        const offsetTT = float( 1 ).add( a.mul( float( 0.6 ).sub( cosPhi.mul( 0.8 ) ) ) ).mul( cosHalfPhi ).toVar();
        const oneMinusHSquared = float( 1 ).sub( offsetTT.mul( offsetTT ) ).max( 0 );
        const fresnelTT = fresnelNode( cosThetaD.mul( oneMinusHSquared.sqrt() ), nodes.fresnelF0 );
        const absorbTT = pow( this.colour, vec3(
            float( 1 ).sub( offsetTT.mul( offsetTT ).mul( a ).mul( a ) ).max( 0 ).sqrt().div( cosThetaD.mul( 2 ) ) ) );
        const distributionTT = cosPhi.mul( - 3.65 ).sub( 3.98 ).exp();
        const lobeTT = absorbTT
            .mul( fresnelTT.oneMinus().mul( fresnelTT.oneMinus() ).mul( distributionTT ) )
            .mul( longitudinalNode( sinThetaSum, nodes.shiftTT, nodes.roughnessTT ) )
            .mul( nodes.weightTT );

        // --- TRT -------------------------------------------------------------------------------
        // h is the constant √3/2, so √(1−h²) is exactly 0.5 and the Fresnel loses its azimuth.
        const fresnelTRT = fresnelNode( cosThetaD.mul( 0.5 ), nodes.fresnelF0 );
        const absorbTRT = pow( this.colour, vec3( float( 0.8 ).div( cosThetaD ) ) );
        const distributionTRT = cosPhi.mul( 17 ).sub( 16.78 ).exp();
        const lobeTRT = absorbTRT
            .mul( fresnelTRT.oneMinus().mul( fresnelTRT.oneMinus() ).mul( fresnelTRT ).mul( distributionTRT ) )
            .mul( longitudinalNode( sinThetaSum, nodes.shiftTRT, nodes.roughnessTRT ) )
            .mul( nodes.weightTRT );

        // --- the card-scale visibility, and it is the single most load-bearing hack here --------
        //
        // 🚩 WITHOUT THIS THE FIGURE RENDERS WITH BRIGHT BLUE HAIR AND IT IS NOT A COLOUR BUG.
        // Marschner's S carries no `N·L` — a fibre has no surface normal and multiplying by a
        // cosine against one is how card hair starts reading as cloth — but that is only correct
        // for an ISOLATED fibre, which can be seen from every side. A card in a groom is one layer
        // of an opaque mass, and the thing that stops a light behind the head from reaching the
        // cards in FRONT of it is occlusion by the head. On this rig nothing supplies that: the rim
        // is a `RectAreaLight` at irradiance 16 with `shadowFraction 0`, three has had no
        // rect-area shadow since 2018 (issue #14161), and the key's `SpotLight` is the only caster
        // in the scene. So the rim's radiance arrived at every hair pixel in the frame at full
        // strength, and since R's attenuation is achromatic it took the rim's colour — `#0f30ff`.
        // MEASURED before this term existed: the whole groom rendered at hue ~250°, i.e. the rim's,
        // against the base colour's 285° violet.
        //
        // 🎯 THE FORM IS KARIS' OWN AND IT USED TO BE A HOME-MADE COSINE, WHICH COST HALF THE
        // HIGHLIGHT. Slide 47 hits precisely this problem in the environment path and answers it
        // with `saturate( ωi·ωr + 1 )` — his note: *"We don't have shadowing from shadow maps so we
        // need to artificially shadow paths that would likely be blocked by a volume of hair. These
        // are primarily those that are coming from the opposite side."* `saturate` clamps at 1, so
        // it is a pure attenuator: every light on the viewer's side of the fragment passes at full
        // strength and only the last 90° — a light coming back at the camera through the head — is
        // rolled off. The term this replaced was `saturate( fake normal · ωi )`, which is not in the
        // deck, and a cosine against a synthesised normal charges every light in the frame for a
        // fault that belongs to one of them.
        //
        // The A/B, on 260,402 solid hair pixels of `?bare&freeze&seed=1&aa=msaa&grade=0&hair=1`,
        // measured this session with `render/SourcePatchProbe.mjs` so the two arms differ in this
        // one expression and nothing else, effective BSDF from the unit-BSDF probe:
        //
        //   | arm                                    | p95 sr⁻¹ | peak sr⁻¹ | top 2% hue / sat |
        //   |----------------------------------------|---------:|----------:|------------------|
        //   | `saturate( n·ωi )`, what shipped       |  0.00789 |   0.01473 | 341° / 0.247     |
        //   | `saturate( ωi·ωr + 1 )`, slide 47      |  0.01644 |   0.02794 | 332° / 0.233     |
        //   | no term at all (`?hairvis=0`)          |  0.02011 |   0.03163 | **261° / 0.429** |
        //   | no term, rim irradiance forced to 0    |  0.01678 |   0.02858 | 321° / 0.232     |
        //
        // Read the last two rows together: switching the term off and switching the RIM off land
        // within 2% of each other, so the rim is the whole of what this term exists to remove — and
        // slide 47's form reproduces "rim removed" to 2% while the cosine it replaced was a further
        // 2.08x down at p95. That factor was not buying anything; row 3 is the blue-hair defect and
        // rows 2 and 4 are not.
        //
        // TT is deliberately LEFT ALONE, because it is the transmission lobe: light through the
        // hair is exactly the thing that is supposed to arrive from behind, and
        // `D_TT = exp(−3.65 cosφ − 3.98)` already confines it to that geometry.
        //
        // ⚠️ Karis applies this to R alone and only in the environment path. Applying it to the
        // direct lights, and to TRT and the scatter fake as well, is an EXTENSION: those three are
        // all reflective, they all take the rim at full strength without it, and the rig has no
        // rect-area shadow to do the job properly. A shadow caster on the rim is what retires it —
        // `docs/OPEN-REQUESTS.md` REQ-063 — and with one, this whole term becomes `1`.
        const lightSide = sideVisibilityNode( toLight, positionViewDirection );
        const visibility = mix( float( 1 ), lightSide, nodes.sideVisibility );

        // --- the multiple-scattering term ------------------------------------------------------
        //
        // 🔴 ROUND 27 BUILT THE PHYSICALLY DERIVED REPLACEMENT FOR THIS TERM, MEASURED IT, AND DID
        // NOT SHIP IT. The `else` branch is what ships and is unchanged from round 26. The
        // `zinke-transmittance` branch is the experiment, kept reachable so the next round inherits
        // a plate rather than a paragraph — `scatterValue` carries the derivation and
        // `HAIR_DEFECTS['zinke-transmittance']` carries the measurement that refused it.
        const wrap = this.fakeNormal.dot( toLight ).add( 1 ).div( 4 * Math.PI );

        // 🎯 ROUND 28 SPLITS THE TERM INTO AN INPUT AND A FORM, WHICH IS WHAT R27's CLOSING LINE
        // ASKED FOR: *"Until `Shadow` stops being noise, no shading change to this term is
        // attributable."* The two axes are now independent and named separately, so a plate can
        // hold one fixed and move the other.
        //
        //   INPUT   `n`, the forward-scattering events on the path to the light. Either the baked
        //           sheet — `shadowDensity · depth.png` at the CARD'S OWN ATLAS UV, which is one
        //           random.random() per strand and cannot vary with light direction — or R28's
        //           geometric chord through the groom's fitted shell, which is a function of the
        //           fragment AND the light.
        //   FORM    slide 39's chromaticity exponent `(C/Luma(C))^(1−Shadow)`, or Zinke Eq.5's
        //           per-channel transmittance `√C^(1+n)`. See `scatterValue` for both derivations.
        //
        // ⚠️ THE SHIPPED PATH IS UNTOUCHED. With no defect named, `events` IS `this.forwardEvents`
        // and `shadow` IS `this.shadow` — the same node objects the previous round built in
        // `start()` — so the emitted expression is the one round 26 shipped, and R28 costs the
        // default build exactly nothing.
        const geometric = isEnvelopeArm( nodes.defect );

        const events = geometric ? this.envelopeEvents( toLight ) : this.forwardEvents;
        const shadow = geometric ? events.negate().exp() : this.shadow;

        const transmittance = nodes.defect === 'zinke-transmittance' || nodes.defect === 'envelope-zinke';

        let scatter;

        if ( transmittance ) {

            scatter = pow( sqrt( this.colour ), vec3( events.add( 1 ) ) )
                .mul( wrap )
                .mul( nodes.scatter );

        } else {

            const luma = this.colour.dot( vec3( 0.2126, 0.7152, 0.0722 ) ).max( 1e-5 );

            scatter = sqrt( this.colour )
                .mul( wrap )
                .mul( pow( this.colour.div( luma ), vec3( shadow.oneMinus() ) ) )
                .mul( nodes.scatter );

        }

        // R, TRT and the multiple-scattering fake are all REFLECTIVE — they return light on the side
        // it arrived from — so all three take the visibility. TT alone does not: it is the
        // transmission lobe, it is supposed to fire from behind, and leaving it unmodulated is what
        // keeps a rim light able to glow THROUGH the silhouette instead of merely stopping at it.
        // The rim's contribution to this frame is therefore TT and nothing else, which is the
        // physically right term for it and is a stricter statement than the rig has ever made.
        return lobeR.add( lobeTRT ).add( scatter ).mul( visibility ).add( lobeTT ).mul( this.occlusion );

    }

    /**
     * Punctual lights — the key's co-located shadow-casting `SpotLight`, and nothing else on this
     * rig. `lightColor` arrives already attenuated by distance, by the spot cone AND by the shadow
     * map, so this is the only term in the material that knows about cast shadows at all.
     */
    direct( { lightDirection, lightColor, reflectedLight } ) {

        reflectedLight.directSpecular.addAssign( this.scatter( lightDirection ).mul( lightColor ) );

    }

    /**
     * Rect-area lights — the four panels that carry the rig's irradiance.
     *
     * See the header for why this is a solid angle and not an LTC evaluation. The two guards are
     * both real: a `RectAreaLight` emits into one hemisphere only, so a fragment behind the panel
     * gets nothing, and the solid angle of a panel seen edge-on collapses to zero on its own.
     */
    directRectArea( { lightColor, lightPosition, halfWidth, halfHeight, reflectedLight } ) {

        const corner0 = lightPosition.add( halfWidth ).sub( halfHeight ).sub( positionView );
        const corner1 = lightPosition.sub( halfWidth ).sub( halfHeight ).sub( positionView );
        const corner2 = lightPosition.sub( halfWidth ).add( halfHeight ).sub( positionView );
        const corner3 = lightPosition.add( halfWidth ).add( halfHeight ).sub( positionView );

        const solidAngle = sphericalTriangleNode( corner0, corner1, corner2 )
            .add( sphericalTriangleNode( corner0, corner2, corner3 ) );

        // three's own comment on the corner order: "counterclockwise; light shines in local neg z
        // direction". `cross( halfWidth, halfHeight )` is therefore local +z and the emission is
        // its negation, so a lit fragment is one the panel's back is turned away from.
        //
        // 🚩 WRITTEN AS AN EXPLICIT COMPARISON RATHER THAN AS `step`, AND THE REASON IS A MEASURED
        // DEFECT THAT SHIPPED FOR AN AFTERNOON. The first version read
        // `d.step( 0 ).oneMinus()`, which is the natural way to write "1 when d > 0" if you assume
        // TSL's method chaining puts the receiver in `step`'s FIRST slot (the edge). It does not —
        // `x.step( edge )` is `step( edge, x )` — so the whole test was inverted, every one of the
        // rig's four panels was masked off for hair and only the key's co-located `SpotLight` lit
        // the groom at all. It did not look broken: the hair was dark, which is what dark hair
        // looks like. It was found by forcing this term to 1 and re-measuring — the primary band's
        // mean rise over a 240 x 640 px strand band went **0.000000 → 0.075860** (peak 0.3064) with
        // the key's shadow half removed by `?ov=key.shadowFraction:0`, i.e. the panels were
        // contributing exactly nothing.
        const emission = normalize( cross( halfWidth, halfHeight ) ).negate();
        const inFront = positionView.sub( lightPosition ).dot( emission ).greaterThan( 0 ).select( float( 1 ), float( 0 ) );

        const toLight = normalize( lightPosition.sub( positionView ) );

        reflectedLight.directSpecular.addAssign(
            this.scatter( toLight ).mul( lightColor ).mul( solidAngle ).mul( inFront ) );

    }

    /**
     * ⚠️ DELIBERATELY EMPTY, AND IT IS A KNOWN GAP RATHER THAN A DECISION THAT HAIR HAS NO
     * AMBIENT.
     *
     * Karis' environment path (slide 47) samples an SH of the environment in the fake-normal
     * direction, treats it as a directional light, multiplies by π, then multiplies R by
     * `saturate(ωi·ωr + 1)`, REMOVES TT entirely and adds 0.2 to each β. Two of the three inputs
     * that needs do not exist on this build: `scene.environment` is null on `alive.html`, and
     * punch-list 3.10 moved the hemisphere ambient OUT of the forward shader into
     * `render/GTAO.js`'s composite — which reads the G-buffer and applies its own split-sum
     * environment BRDF against the bent normal. So hair's ambient specular currently comes from
     * 3.10's composite using this material's FAKE NORMAL and the roughness it writes to `normal.w`,
     * which is an isotropic approximation of an anisotropic lobe.
     *
     * 🔴 AND THE GAP IS REAL BUT IT IS TEN TIMES SMALLER THAN THIS PARAGRAPH USED TO SAY.
     * `?hairlobes=&hairscatter=0` renders the groom with S identically zero, so whatever a hair
     * pixel reads on that plate IS its entire indirect term. The previous version of this note
     * called it "~1% of what the groom emits" by dividing a LINEAR reading (0.00063) by an ENCODED
     * one (0.1165) — two different transfer functions, and the ratio meant nothing.
     *
     * Re-measured in RADIANCE, over 255,850 solid hair pixels of
     * `?bare&freeze&seed=1&aa=msaa&grade=0&hair=1`, with three's ACES inverted out of the plate
     * (`HairMaterial.selftest.mjs` carries the mirror and the additivity proof that licenses it):
     * the indirect term reads **4.53e−3 at p50 and 6.66e−3 at p95**, against the same plate's
     * shipped hair at **4.65e−2 and 7.98e−2**. So the environment contributes **9.7% of the
     * groom's median radiance**, not 1%.
     *
     * The conclusion survives the correction and the number that changed is the size of the prize:
     * 3.10's composite is running and hair is in its G-buffer, but the term it computes on a
     * `#150F17` diffuse albedo with a dielectric F0 of 0.04 is a tenth of what the groom emits and
     * Karis' slide-47 path is genuinely MISSING energy rather than duplicating energy already there.
     *
     * Karis' own note on slide 47 is that bent cones would replace his fudge; 3.10 already built
     * bent cones, so the right version of this is better than UE4's and it is a `render/**` change,
     * which is not this file's to make. `docs/OPEN-REQUESTS.md` REQ-065. Filed rather than
     * half-built — and note that half-building it HERE is not available: the rig is constructed
     * with `ambient: false` when GTAO is installed, so there is no ambient light in the forward
     * pass for this method to read even if it wanted to.
     */
    indirect() {}

}

/** The spherical-excess term, in TSL. Mirrored by `sphericalTriangle` above. */
const sphericalTriangleNode = /*@__PURE__*/ Fn( ( [ a, b, c ] ) => {

    const lengthA = length( a );
    const lengthB = length( b );
    const lengthC = length( c );

    const numerator = abs( dot( a, cross( b, c ) ) );
    const denominator = lengthA.mul( lengthB ).mul( lengthC )
        .add( dot( a, b ).mul( lengthC ) )
        .add( dot( a, c ).mul( lengthB ) )
        .add( dot( b, c ).mul( lengthA ) );

    return atan( numerator, denominator ).mul( 2 );

} );

/**
 * The material.
 *
 * `MeshPhysicalNodeMaterial` is subclassed rather than `NodeMaterial` so that the alpha cutout, the
 * alpha-to-coverage path, the skinning and — the one that matters downstream — the G-buffer's
 * roughness channel all keep working exactly as they do for every other material in the frame. Its
 * lighting model is replaced wholesale, so none of the physical BRDF is ever evaluated.
 */
export class HairNodeMaterial extends MeshPhysicalNodeMaterial {

    /** Makes the scene graph self-describing: a mesh reads as `HairNodeMaterial`. */
    static get type() {

        return 'HairNodeMaterial';

    }

    constructor( nodes, parameters ) {

        super( parameters );

        this.isHairNodeMaterial = true;
        this.hair = nodes;

    }

    setupLightingModel() {

        return new HairLightingModel( this.hair );

    }

}

/**
 * Builds the hair material against a groom directory.
 *
 * @param {Object} options
 * @param {?string} [options.flowMapUrl] - the SIDECAR strand-tangent sheet. Null disables the flow
 *   rotation AND the root occlusion, which both read it. `albedo.png` and `normal.png` are already
 *   EMBEDDED in the GLB and are taken off the mesh's own material instead, so the material and the
 *   groom can never disagree about which bake they are.
 * @param {?string} [options.depthMapUrl] - the SIDECAR within-bundle depth sheet. Null makes slide
 *   44's exponential shadow a constant 1, i.e. "every texel fully lit".
 * @param {?string} [options.groomDirectoryUrl] - convenience for a caller with no bundler: derives
 *   both sheet URLs from a directory. ⚠️ A bundled page must NOT use this — vite's asset rewrite
 *   fires only on a static literal, so a URL assembled from a directory 404s in dev and emits no
 *   asset in a build. `alive.js`'s `HAIR_BAKES` carries the rule at length.
 * @param {?Texture} [options.alphaMap=null] - the groom's embedded base-colour map. Its ALPHA is
 *   the cutout and its RGB is deliberately NOT used as albedo: hair's colour comes from the lobes.
 * @param {number} [options.baseColourHex] - linear base colour, as an sRGB hex.
 * @param {boolean} [options.multisampled=false] - whether the stage has an MSAA target.
 * @param {string} [options.defect='none'] - one of `HAIR_DEFECTS`.
 * @param {Object} [options.settings] - overrides over `HAIR_DEFAULTS`.
 * @returns {Promise<HairNodeMaterial>} resolves once the sidecar sheets have decoded, so a capture
 *   never sees a half-loaded material.
 */
export async function createHairMaterial( options = {} ) {

    const requested = { ...HAIR_DEFAULTS, ...( options.settings ?? {} ) };
    const defect = options.defect ?? 'none';

    if ( Object.hasOwn( HAIR_DEFECTS, defect ) === false ) {

        throw new Error( `HairMaterial: unknown defect '${ defect }'. Known: ${ Object.keys( HAIR_DEFECTS ).join( ', ' ) }` );

    }

    // 🎯 ROUND 26'S ARM IS RESOLVED HERE, BEFORE ANY UNIFORM EXISTS, and that ordering is the whole
    // repair — see `effectiveRoughnessR`. β_TT, β_TRT and `material.roughness` are all derived from
    // this number below, so applying the defect to the SETTING makes every derived value follow it
    // and leaves `describe()` reporting the picture that was actually drawn with no special case.
    const settings = { ...requested, roughnessR: effectiveRoughnessR( defect, requested ) };

    const flowUrl = options.flowMapUrl === undefined
        ? beside( options.groomDirectoryUrl, 'flow.png' )
        : options.flowMapUrl;

    const depthUrl = options.depthMapUrl === undefined
        ? beside( options.groomDirectoryUrl, 'depth.png' )
        : options.depthMapUrl;

    const flowMap = flowUrl == null ? null : await loadDataSheet( flowUrl );
    const depthMap = depthUrl == null ? null : await loadDataSheet( depthUrl );

    // A caller that names a hex gets that hex; the default is the DERIVATION rather than its 8-bit
    // rounding, because the rounding is only there so a spec entry and `alive.js` have something to
    // carry. `Color` is still used for the caller's path so the sRGB decode stays three's.
    const derived = baseColourDerivation().linear;

    const colour = options.baseColourHex === undefined
        ? { r: derived[ 0 ], g: derived[ 1 ], b: derived[ 2 ] }
        : new Color().setHex( options.baseColourHex, SRGBColorSpace );

    const nodes = {
        defect,
        flowMap: flowMap === null ? null : texture( flowMap ),
        depthMap: depthMap === null ? null : texture( depthMap ),
        baseColour: uniform( new Vector3( colour.r, colour.g, colour.b ) ),
        fresnelF0: uniform( HAIR_F0 ),
        shiftR: uniform( settings.shiftR ),
        roughnessR: uniform( settings.roughnessR ),
        shiftTT: uniform( settings.shiftR * settings.shiftRatioTT ),
        shiftTRT: uniform( settings.shiftR * settings.shiftRatioTRT ),
        roughnessTT: uniform( settings.roughnessR * settings.roughnessRatioTT ),
        roughnessTRT: uniform( settings.roughnessR * settings.roughnessRatioTRT ),
        weightR: uniform( settings.weightR ),
        weightTT: uniform( settings.weightTT ),
        weightTRT: uniform( settings.weightTRT ),
        scatter: uniform( settings.scatter ),
        sideVisibility: uniform( settings.sideVisibility ),
        shadowDensity: uniform( settings.shadowDensity ),
        rootOcclusion: uniform( settings.rootOcclusion ),
        rootOcclusionLength: uniform( settings.rootOcclusionLength ),
        strandTangentJitter: uniform( settings.strandTangentJitter ),
        strandPitch: uniform( settings.strandPitch ),
        strandFadeStart: uniform( settings.strandFadeStart ),
        strandFadeEnd: uniform( settings.strandFadeEnd ),
        lockSpread: uniform( settings.lockSpread ),
        lockCell: uniform( settings.lockCell ),
        lockBlend: uniform( settings.lockBlend ),
        lockTilt: uniform( settings.lockTilt ),

        // Only read on the defect path. View space, pointing up-and-right across the frame, so a
        // reader who sees the plate can tell at a glance that the band is welded to the screen.
        // `envelope-fixed-direction` reads it too, for the same reason and in the same space.
        constantTangent: uniform( new Vector3( 0.6, 0.8, 0 ) ),

        // 🎯 ROUND 28's ENVELOPE. Written by `applyHairMaterial` from the groom's own vertices and
        // then tracked to the head bone, so these are LIVE uniforms rather than authored constants.
        //
        // 🚩 THE INITIAL VALUES ARE A DEGENERATE SHELL AND THAT IS THE FALLBACK. `outer` and
        // `inner` start EQUAL, so `envelopeEvents` computes the same chord twice and returns
        // exactly 0 — `Shadow` = 1, the term collapses to its no-depth boundary value, and a
        // material that is never applied to a mesh renders a defined picture instead of a NaN. The
        // radius is 1 m rather than 0 so the quadratic is well-conditioned while it waits.
        envelopeCentre: uniform( new Vector3( 0, 0, 0 ) ),
        envelopeAxisX: uniform( new Vector3( 1, 0, 0 ) ),
        envelopeAxisY: uniform( new Vector3( 0, 1, 0 ) ),
        envelopeAxisZ: uniform( new Vector3( 0, 0, 1 ) ),
        envelopeOuter: uniform( new Vector3( 1, 1, 1 ) ),
        envelopeInner: uniform( new Vector3( 1, 1, 1 ) ),
        envelopeExtinction: uniform( settings.envelopeExtinction )
    };

    const material = new HairNodeMaterial( nodes );

    material.name = 'sugata.hair';
    material.metalness = 0;

    // 🎯 ROUND 28's ENVELOPE HOOK, and it is an OBJECT update rather than a render one for a reason
    // that cost this round a smoke run: it needs `frame.object`, which is the mesh being drawn, and
    // that is the only place the material meets its groom on the shipped page. See
    // `ensureHairEnvelope`. The fit inside it runs at most once; after that the callback is a
    // matrix multiply and four vector transforms.
    //
    // ⚠️ INSTALLED ONLY ON AN ENVELOPE ARM, for the same reason `start()` skips the frame there: the
    // fit walks 17,516 skinned vertices, and a default page must not pay for a term it does not
    // evaluate. `describe().envelope.fitted` therefore reads FALSE on the shipped arm, with `live`
    // false beside it — the census says which arm it is rather than implying a failure.
    if ( isEnvelopeArm( defect ) ) {

        nodes.envelopeCentre.onObjectUpdate( ( frame ) => {

            ensureHairEnvelope( material, frame.object );

            return trackHairEnvelope( material );

        } );

    }

    // Written to the G-buffer's `normal.w` and read by 3.10's specular occlusion. β_TRT is the
    // widest lobe this material carries, so it is the honest isotropic summary of the shape.
    material.roughness = Math.min( 1, settings.roughnessR * settings.roughnessRatioTRT );

    // 🚩 THE ALPHA IS THE ONLY THING TAKEN FROM THE BASE-COLOUR SHEET, and the RGB is thrown away
    // on purpose. The look spec's whole claim about this material is that hair's apparent colour
    // comes from its lobes rather than from its albedo; leaving the sampled RGB in would put a
    // second, isotropic, un-shifted colour term underneath the three lobes and dilute exactly the
    // effect 3.5 exists to produce. What the diffuse colour carries instead is the base colour, so
    // that the G-buffer's `diffuseColor` guide — which the denoise and the grade read — describes
    // hair rather than white.
    //
    // ⚠️ `vec4( someVec3 )` pads alpha with ZERO, which would discard every texel on the groom.
    // `applyCardShading` records the same trap. The alpha is carried across explicitly.
    if ( options.alphaMap != null ) {

        material.colorNode = vec4( nodes.baseColour, texture( options.alphaMap ).a );

    }

    // The fake normal, into the G-buffer. See the header, card penalty 1. `normalNode` is consumed
    // in VIEW space by `NodeMaterial.setupNormal`, which is the space this expression is already in.
    const normalTangent = strandTangentNode( nodes );
    material.normalNode = normalize(
        positionViewDirection.sub( normalTangent.mul( normalTangent.dot( positionViewDirection ) ) ) );

    material.transparent = false;
    material.alphaTest = 0.5;                // the groom's own `alphaMode: MASK` cutoff
    material.alphaToCoverage = options.multisampled === true;
    material.side = DoubleSide;              // a card is lit from both faces
    material.forceSinglePass = true;         // see the header — the DoubleSide double draw buys nothing

    material.hairUniforms = nodes;
    material.hairSettings = settings;
    material.hairDefect = defect;

    material.describe = () => ( {
        defect,
        lobes: {
            r: nodes.weightR.value,
            tt: nodes.weightTT.value,
            trt: nodes.weightTRT.value
        },
        shifts: {
            r: nodes.shiftR.value,
            tt: nodes.shiftTT.value,
            trt: nodes.shiftTRT.value
        },
        roughnesses: {
            r: nodes.roughnessR.value,
            tt: nodes.roughnessTT.value,
            trt: nodes.roughnessTRT.value
        },

        // 🚩 ROUND 26, AND IT IS IN THE CENSUS BECAUSE A UNIT ERROR ON THIS EXACT NUMBER COST THE
        // ROUND'S OWN DIAGNOSIS ITS LEVER. `roughnesses.r` above is β_K; a reader who takes it for
        // Marschner's β_M is out by a factor of two and will conclude the lobe is 50% wider than the
        // paper's widest sample when it is in fact at the paper's narrowest. So the census states
        // BOTH variables and whether the value is inside the source's band, and `defect` beside it
        // says which arm the plate is. Reported from the LIVE uniform, so the `wide-lobe` arm
        // describes itself rather than the default.
        lobeWidth: {
            betaKaris: nodes.roughnessR.value,
            betaMarschnerDegrees: ( nodes.roughnessR.value / 2 ) * 180 / Math.PI,
            marschnerBandKaris: [ ...HAIR_BETA_R_BAND ],
            insideBand: nodes.roughnessR.value >= HAIR_BETA_R_BAND[ 0 ] &&
                nodes.roughnessR.value <= HAIR_BETA_R_BAND[ 1 ]
        },
        scatter: nodes.scatter.value,
        sideVisibility: nodes.sideVisibility.value,
        rootOcclusion: nodes.rootOcclusion.value,

        // The strand field, in the census for `shadowAlphaCutoff`'s reason: it is a knob that moves
        // the picture, and two plates taken a round apart at different pitches would otherwise be
        // indistinguishable from their manifests. The pitch is reported in millimetres because that
        // is the unit it is authored and argued in.
        strand: {
            jitterRadians: nodes.strandTangentJitter.value,
            pitchMillimetres: nodes.strandPitch.value * 1000,
            fade: [ nodes.strandFadeStart.value, nodes.strandFadeEnd.value ]
        },

        // Round 24, in the census for the same reason the strand block is: it is a knob that moves
        // the picture, and two plates taken a round apart at different spreads would otherwise be
        // indistinguishable from their manifests. `defect === 'no-lock-albedo'` reports the spread
        // the material was BUILT with, so the census also records the arm — read `defect` beside it.
        lock: {
            spread: nodes.lockSpread.value,
            cellMillimetres: nodes.lockCell.value * 1000,
            blendCells: nodes.lockBlend.value,
            live: defect !== 'no-lock-albedo'
        },

        // Round 25, in the census for the same reason the two blocks above are: it is a knob that
        // moves the picture, and two plates taken a round apart at different tilts would otherwise
        // be indistinguishable from their manifests. `tiltRadians` reports the spread the material
        // was BUILT with — read `live` and `defect` beside it to know which arm the plate is — and
        // `alphaEquivalent` is the number the derivation is actually argued in: the peak-to-peak
        // shift of M_p's argument, against `roughnessR` as one lobe width.
        lockTilt: {
            spreadRadians: effectiveLockTilt( defect, settings ),
            spreadDegrees: effectiveLockTilt( defect, settings ) * 180 / Math.PI,
            alphaEquivalent: effectiveLockTilt( defect, settings ) * 2,
            lobeWidths: effectiveLockTilt( defect, settings ) * 2 / nodes.roughnessR.value,
            built: nodes.lockTilt.value,
            live: defect !== 'no-lock-tilt'
        },
        sheets: {
            flow: flowMap !== null,
            depth: depthMap !== null,
            alpha: options.alphaMap != null
        },

        // 🎯 ROUND 28, in the census for the reason every block above it is: it is a knob that
        // moves the picture, and two plates taken a round apart on different grooms would
        // otherwise be indistinguishable from their manifests. `fitted` is the one to read first —
        // false means `applyHairMaterial` never saw a mesh, the shell is degenerate, and any
        // `envelope-*` arm on that plate rendered with `n` identically zero. `residual` is how
        // badly an ellipsoid describes this groom and it belongs beside the radii rather than in a
        // README: 0.385 on `bob01`.
        envelope: {
            fitted: material.hairEnvelope != null,
            centre: [ nodes.envelopeCentre.value.x, nodes.envelopeCentre.value.y, nodes.envelopeCentre.value.z ],
            outerMillimetres: [
                nodes.envelopeOuter.value.x * 1000,
                nodes.envelopeOuter.value.y * 1000,
                nodes.envelopeOuter.value.z * 1000
            ],
            innerMillimetres: [
                nodes.envelopeInner.value.x * 1000,
                nodes.envelopeInner.value.y * 1000,
                nodes.envelopeInner.value.z * 1000
            ],
            extinctionPerMetre: nodes.envelopeExtinction.value,
            quantiles: [ ...HAIR_ENVELOPE_QUANTILES ],
            residual: material.hairEnvelope?.residual ?? null,
            vertexCount: material.hairEnvelope?.vertexCount ?? null,
            tracksBone: material.hairEnvelopeBone ?? null,
            live: isEnvelopeArm( defect )
        },
        alphaToCoverage: material.alphaToCoverage,

        // REQ-066. `HAIR_SHADOW_ALPHA_CUTOFF` is the single number deciding whether the groom casts
        // strand shadows or opaque card slabs, and the census already carries every other knob that
        // moves the picture — so two plates taken a round apart at different cutoffs used to be
        // indistinguishable from their manifests. `configureHairMaterial` runs AFTER this function
        // and writes the uniform onto the material; `describe` is a closure over `material`, so it
        // reads the live value at call time. The `?? null` is load-bearing: a page that never calls
        // `configureHairMaterial` must report null rather than throw.
        shadowAlphaCutoff: material.hairShadowCutoff?.value ?? null
    } );

    return material;

}

/**
 * THE STRAND DIRECTION, in TSL, as an expression rather than as a stored variable.
 *
 * It is called from two places — `HairLightingModel.start()` and the material's `normalNode` — and
 * it is a plain function rather than a cached node because those two are built into DIFFERENT
 * sub-builds. `NodeMaterial` builds `normalNode` under a `'NORMAL'` sub-build before the lighting
 * context exists, and a TSL variable declared in one sub-build is not in scope in the other. Two
 * calls emit the same expression twice; the compiler's common-subexpression pass is welcome to it.
 *
 * See `HairLightingModel.strandTangent` for what the expression IS and why the card's UV
 * parameterisation is the right source for it.
 */
function strandTangentNode( nodes ) {

    if ( nodes.defect === 'constant-tangent' ) return normalize( nodes.constantTangent );

    // The cotangent frame, from the fragment's own screen derivatives. `determinant` is the UV
    // Jacobian's, and dividing by it is what makes the result ∂P/∂u and ∂P/∂v rather than something
    // proportional to them — which used not to matter and now does. See the guard below.
    const positionDx = dFdx( positionView );
    const positionDy = dFdy( positionView );
    const uvDx = dFdx( uv() );
    const uvDy = dFdy( uv() );

    // 🔴 THE GUARD USED TO BE `determinant + sign(determinant)·1e-4 + 1e-4` AND IT WAS EIGHTEEN
    // TIMES THE THING IT WAS GUARDING. Measured on the live page this session, over 15,912 hair
    // triangles rasterised with the shipped camera and the shipped skinning, the UV Jacobian's
    // determinant in RENDER-TARGET pixels reads p10 4.42e−6, **p50 1.109e−5**, p90 5.72e−5 — a
    // strip is a 128th of the atlas across and a card is hundreds of pixels long, so the product of
    // two small gradients is genuinely tiny and there is nothing wrong with that. Adding 2e−4 to it
    // divided ∂P/∂u by roughly twenty.
    //
    // It never showed, because until this round BOTH cotangents went straight into `normalize` and
    // a common positive factor is exactly what normalising removes. The moment `|∂P/∂u|` is read as
    // a LENGTH — which the strand pitch below does, because a pitch in millimetres has to be
    // divided by metres per unit u — the same expression is off by that factor, and the first
    // measurement of the strand field came back at 1 cycle per card against the 14 it was authored
    // for. That ratio IS the epsilon: `det/(det + 2e−4)` at the measured p50 is 0.053.
    //
    // The replacement clamps the MAGNITUDE and keeps the sign, so a determinant of any workable size
    // passes through untouched and a degenerate quad lands on a huge but finite cotangent rather
    // than on a NaN. A fragment that lands there is then removed by the Nyquist fade on its own,
    // because a huge `|∂P/∂u|` is a huge screen frequency — the guard and the band limit agree
    // without being told to.
    const determinant = uvDx.x.mul( uvDy.y ).sub( uvDy.x.mul( uvDx.y ) );
    const magnitude = abs( determinant ).max( DEGENERATE_DETERMINANT );
    const safeDeterminant = determinant.lessThan( 0 ).select( magnitude.negate(), magnitude );

    // ∂P/∂v and ∂P/∂u, from [∂P/∂x ∂P/∂y] = [∂P/∂u ∂P/∂v] · J, inverted.
    const alongStrand = positionDy.mul( uvDx.x ).sub( positionDx.mul( uvDy.x ) ).div( safeDeterminant );
    const acrossStrand = positionDx.mul( uvDy.y ).sub( positionDy.mul( uvDx.y ) ).div( safeDeterminant );

    const cardTangent = normalize( alongStrand );
    const across = normalize( acrossStrand );

    // The strand direction as a pair of weights in the card's own (across, along) basis. The flow
    // sheet's RG is exactly that, stored 0..1; with no sheet the strand is the card's own axis. Two
    // weights rather than a vector because the strand field below is a ROTATION of them, and a
    // rotation of two coefficients is two multiplies where a rotation of a vector is a matrix.
    //
    // 🚩 THEY ARE REBOUND IN JAVASCRIPT AND NOT WITH `assign`. This function runs at material
    // construction time to build `normalNode`, which is OUTSIDE any `Fn()` stack, and TSL's
    // `assign` needs one — it throws "No stack defined for assign operation" and the page loads
    // with no groom at all. Reassigning the JavaScript binding builds the same expression tree
    // without asking the node graph for a mutable variable.
    const sheeted = nodes.flowMap !== null && nodes.defect !== 'no-flow';
    const flow = sheeted ? nodes.flowMap.sample( uv() ).rg.mul( 2 ).sub( 1 ) : vec2( 0, 1 );
    let alongWeight = flow.g;
    let acrossWeight = flow.r;

    if ( nodes.defect !== 'no-strand-jitter' ) {

        // THE STRAND FIELD. See the header: the amplitude is the strand-scale tangent variation the
        // mip chain deletes from `flow.png`, and the frequency is whatever this pass can carry.
        //
        // `acrossStrand` is ∂P/∂u in VIEW space, which is a rigid transform of world, so its length
        // is metres of scalp per unit atlas u and needs no scale factor. `u · |∂P/∂u|` is therefore
        // the arc length across the strand, in metres, from the atlas's own u origin — and dividing
        // by the pitch turns it into a lock count. That the origin is the ATLAS's rather than the
        // card's is the useful accident: a card sitting at strip 5 starts five strips along the
        // phase, and cards of different widths advance through it at different rates, so no two
        // cards put their locks in the same place and the groom cannot read as corrugation.
        const acrossMetres = length( acrossStrand );
        const phase = uv().x.mul( acrossMetres ).div( nodes.strandPitch );

        // The field's own screen frequency. `|∇u|` comes off the Jacobian already in hand rather
        // than out of a second derivative of `phase` — a derivative of a derivative is constant
        // across a 2x2 quad and backends disagree about what it means.
        const cyclesPerPixel = length( vec2( uvDx.x, uvDy.x ) ).mul( acrossMetres ).div( nodes.strandPitch );
        const fade = float( 1 ).sub( smoothstep( nodes.strandFadeStart, nodes.strandFadeEnd, cyclesPerPixel ) );

        const angle = strandNoiseNode( phase ).mul( nodes.strandTangentJitter ).mul( fade );
        const turn = cos( angle );
        const swing = sin( angle );

        // An in-plane rotation of the two weights. Doing it here rather than to the assembled vector
        // is what keeps the strand ON the card: the result is a combination of ∂P/∂v and ∂P/∂u and
        // can no more leave the surface than the flow sheet's own rotation can.
        const rotatedAlong = alongWeight.mul( turn ).sub( acrossWeight.mul( swing ) );
        const rotatedAcross = alongWeight.mul( swing ).add( acrossWeight.mul( turn ) );
        alongWeight = rotatedAlong;
        acrossWeight = rotatedAcross;

    }

    // The ε keeps a flow texel of exactly (0.5, 0.5) — an unwritten one — from normalising a zero
    // vector, and it is added along the card's own axis so the fallback is the card rather than a
    // NaN that would propagate into the G-buffer normal and out into GTAO.
    const inPlane = normalize( cardTangent.mul( alongWeight ).add( across.mul( acrossWeight ) )
        .add( cardTangent.mul( EPSILON ) ) );

    if ( nodes.defect === 'no-lock-tilt' ) return inPlane;

    // 🎯 ROUND 25'S WHOLE CHANGE IS THIS ONE ROTATION, AND IT IS THE LAST THING THAT HAPPENS TO THE
    // TANGENT. Everything above stays inside the card's plane — the flow sheet's rotation and the
    // strand jitter are both combinations of ∂P/∂u and ∂P/∂v and can no more leave the surface than
    // the sheet can. This one deliberately leaves it, because Marschner's α is a tilt of the
    // scattering frame OUT of the fibre's own plane and an in-plane rotation is a change of azimuth
    // rather than a change of shift. See `HAIR_LOCK_TILT_SPREAD` for the equivalence and its solve.
    //
    // 🚩 THE AXIS IS THE CARD'S PLANE NORMAL AND IT IS USED AS AN AXIS, NEVER AS A NORMAL. This
    // file's header is explicit that the card's plane normal is a lie about a fibre bundle and is
    // never shaded with; `normalNode` stays Karis' fake normal, rebuilt from the tilted tangent
    // below by the caller. What is used here is only the DIRECTION `inPlane` is rotated toward, and
    // `cross( across, cardTangent )` is exactly perpendicular to the plane both of them span, so
    // the rotation is exact rather than approximately orthogonal.
    const spread = nodes.defect === 'lock-tilt-max'
        ? float( HAIR_LOCK_TILT_MAX )
        : nodes.lockTilt;

    const angle = lockTiltNode( uv( 1 ).x, spread );
    const cardNormal = normalize( cross( across, cardTangent ) );

    return normalize( inPlane.mul( cos( angle ) ).add( cardNormal.mul( sin( angle ) ) ) );

}

/**
 * Puts the material on every mesh under a groom root, and hands back the base-colour maps it found
 * so the caller can wire the cutout.
 *
 * 🎯 IT ALSO FITS ROUND 28's ENVELOPE, WHEN AN ENVELOPE ARM IS LIVE. `createHairMaterial` never
 * sees a mesh — it takes URLs — so the groom's own shape first exists here. Fitting it from the
 * vertices rather than authoring it means a different identity, a different `--hair-length` or a
 * regenerated groom carries its own envelope with no constant to update, which is the same
 * discipline `hair_cards.py` applies by cutting the cap from the scalp region itself.
 *
 * ⚠️ THIS IS NOT THE ONLY PATH ONTO A GROOM AND IT IS NOT THE ONE THE PAGE TAKES. `alive.js:2513`
 * assigns the material to its meshes directly, so the fit ALSO runs from the node graph — see
 * `ensureHairEnvelope`, which is where that cost this round a smoke run.
 *
 * @returns {{ meshes:number, alphaMap:?Object, envelope:?Object }} `envelope` is null on the
 *   shipped arm, which does not evaluate one.
 */
export function applyHairMaterial( root, material ) {

    let meshes = 0;
    let alphaMap = null;
    const positions = [];

    root.updateMatrixWorld( true );

    root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;

        if ( alphaMap === null && object.material?.map != null ) alphaMap = object.material.map;

        collectWorldPositions( object, positions );

        object.material = material;
        meshes ++;

    } );

    // ⚠️ AND ONLY ON AN ENVELOPE ARM, so this function and the node graph's own hook agree about
    // when the fit exists. Fitting here on the shipped arm would leave `describe()` reporting
    // `fitted true, tracksBone head` on a material whose uniforms nothing updates — a census that
    // describes a shell the picture does not have, which is worse than one that says "not fitted".
    const envelope = isEnvelopeArm( material.hairDefect )
        ? installHairEnvelope( material, root, positions )
        : null;

    return { meshes, alphaMap, envelope };

}

/**
 * A mesh's vertices in WORLD space, skinned if it is skinned.
 *
 * ⚠️ `applyBoneTransform` IS USED RATHER THAN THE RAW ATTRIBUTE, and the two are only the same at
 * bind pose. `tools/critic/hair-envelope.mjs` reads the live figure exactly this way, so the
 * envelope this function fits and the envelope that tool scores against the ray cast are the same
 * surface — which is what makes the correlation in `HAIR_ENVELOPE_EXTINCTION` a statement about
 * what ships rather than about a lookalike.
 */
function collectWorldPositions( mesh, into ) {

    const attribute = mesh.geometry?.attributes?.position;

    if ( attribute == null ) return;

    const skinned = mesh.isSkinnedMesh === true &&
        mesh.skeleton != null &&
        mesh.geometry.attributes.skinIndex != null;

    const point = new Vector3();

    for ( let i = 0; i < attribute.count; i ++ ) {

        point.fromBufferAttribute( attribute, i );

        if ( skinned ) mesh.applyBoneTransform( i, point );

        point.applyMatrix4( mesh.matrixWorld );

        into.push( point.x, point.y, point.z );

    }

}

/**
 * Fits the groom's shell and wires it to the head bone.
 *
 * 🚩 THE ENVELOPE IS FITTED ONCE AND THEN TRACKED, NOT REFITTED. Refitting per frame would cost a
 * pass over 17,516 vertices every render and would also be wrong: the shell is a property of the
 * GROOM, and a head that turns moves it rigidly rather than reshaping it. So the fit is taken once,
 * the head bone's world matrix is recorded beside it, and each render the uniforms are the fitted
 * shell carried through whatever rigid motion that bone has made since. That is the property
 * CHECKPOINT §10 named as missing — *"it cannot vary with light direction, head orientation…"* —
 * and it is the half of it that costs one matrix multiply.
 *
 * ⚠️ AND THE LIMIT IS STATED RATHER THAN HIDDEN: the groom is skinned to more than one bone, so a
 * strong neck or jaw motion deforms the cards inside a shell that only the head bone moves. This is
 * Frostbite's own stated Tier-3 limitation in our own geometry — *it will not adapt to actual
 * changes in hair volume* — and it is accepted here for the reason Frostbite accepts it: the
 * alternative needs a pass this budget does not have.
 *
 * @returns {?Object} the fitted envelope, or null when there were not enough vertices to fit one.
 */
function installHairEnvelope( material, root, positions ) {

    const nodes = material.hair;

    if ( nodes == null || positions.length < 3 * 6 ) return null;

    const envelope = hairEnvelopeValue( positions );

    nodes.envelopeCentre.value.set( ...envelope.centre );
    nodes.envelopeOuter.value.set( ...envelope.outer );
    nodes.envelopeInner.value.set( ...envelope.inner );
    nodes.envelopeAxisX.value.set( 1, 0, 0 );
    nodes.envelopeAxisY.value.set( 0, 1, 0 );
    nodes.envelopeAxisZ.value.set( 0, 0, 1 );

    material.hairEnvelope = envelope;
    material.hairEnvelopeBone = null;

    const bone = findHeadBone( root );

    if ( bone !== null ) {

        material.hairEnvelopeBone = bone.name;
        material.hairEnvelopeTracking = {
            bone,
            restInverse: bone.matrixWorld.clone().invert(),
            restCentre: new Vector3( ...envelope.centre ),
            motion: new Matrix4()
        };

    }

    return envelope;

}

/**
 * 🔴 THE LAZY FIT, AND IT EXISTS BECAUSE THE SHIPPED PAGE NEVER CALLS `applyHairMaterial`.
 *
 * `alive.js:2513` assigns the material to its meshes directly — `for ( const mesh of skinned )
 * mesh.material = material;` — so the documented apply path is one of two ways the material reaches
 * a groom and the shipped page takes the other one. The first version of this round shipped the fit
 * only in `applyHairMaterial` and every live plate came back with `envelope.fitted false`, i.e.
 * `n` identically zero on every envelope arm. It was caught by the capture tool's own provenance
 * check on the first smoke run, which is the entire reason that check reads `describe()` rather
 * than trusting the URL.
 *
 * So the fit also runs from the node graph's OBJECT update, where `frame.object` IS the mesh being
 * drawn. That hook is reached however the material got onto the mesh, which makes the envelope a
 * property of the material rather than of the caller's manners.
 *
 * @param {Object} material - the hair material.
 * @param {?Object3D} object - the object currently being drawn.
 */
function ensureHairEnvelope( material, object ) {

    if ( material.hairEnvelope != null || object == null || object.isMesh !== true ) return;

    const positions = [];

    object.updateMatrixWorld( true );
    collectWorldPositions( object, positions );

    // The root for the bone search is the mesh itself: a `SkinnedMesh` carries its own skeleton, so
    // the traversal in `findHeadBone` finds the head from here exactly as it would from the groom's
    // parent.
    installHairEnvelope( material, object, positions );

}

/**
 * Carries the fitted shell through whatever rigid motion the head bone has made since the fit.
 *
 * 🚩 ONE HOOK UPDATES ALL FOUR UNIFORMS, AND THAT IS DELIBERATE RATHER THAN LAZY. The centre and the
 * three axes are ONE rigid transform; giving each its own callback would build the same matrix and
 * take the same inverse four times per draw for four thirds of a vector each. The callback returns
 * the centre — `UniformNode.onUpdate` assigns a returned value to `.value` — and writes the axes as
 * it goes, which is why the hook sits on `envelopeCentre` and not on an arbitrary member of the
 * four.
 */
function trackHairEnvelope( material ) {

    const tracking = material.hairEnvelopeTracking;
    const nodes = material.hair;

    if ( tracking == null ) return nodes.envelopeCentre.value;

    const motion = tracking.motion.multiplyMatrices( tracking.bone.matrixWorld, tracking.restInverse );

    nodes.envelopeAxisX.value.set( 1, 0, 0 ).transformDirection( motion );
    nodes.envelopeAxisY.value.set( 0, 1, 0 ).transformDirection( motion );
    nodes.envelopeAxisZ.value.set( 0, 0, 1 ).transformDirection( motion );

    return nodes.envelopeCentre.value.copy( tracking.restCentre ).applyMatrix4( motion );

}

/** The bone the groom hangs from, by name, off whichever skinned mesh under the root has one. */
function findHeadBone( root ) {

    let found = null;

    root.traverse( ( object ) => {

        if ( found !== null || object.isSkinnedMesh !== true || object.skeleton == null ) return;

        for ( const bone of object.skeleton.bones ) {

            if ( bone.name === 'head' ) { found = bone; return; }

        }

    } );

    return found;

}

/** The convenience path only. Null in, null out, so "no directory" means "no sheets". */
function beside( directoryUrl, file ) {

    return directoryUrl == null ? null : `${ directoryUrl }${ file }`;

}

/**
 * A linear-space data sheet. `flow` and `depth` are DATA — a direction, a root-tip parameter, a
 * strand id and a depth — and putting them through the sRGB decode would bend every one of them.
 */
function loadDataSheet( url ) {

    return new Promise( ( resolve, reject ) => {

        new TextureLoader().load(
            url,
            ( map ) => {

                map.flipY = false;          // matches glTF's UV convention, which the groom is authored in
                map.generateMipmaps = true;
                resolve( map );

            },
            undefined,
            () => reject( new Error( `HairMaterial: could not load ${ url }. ` +
                'Run `python3 tools/figure-pipeline/hair_texture.py --out assets/hair/bob01`.' ) )
        );

    } );

}
