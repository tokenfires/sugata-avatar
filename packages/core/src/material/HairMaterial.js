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
    MeshPhysicalNodeMaterial,
    SRGBColorSpace,
    TextureLoader,
    Vector3
} from 'three/webgpu';

import {
    Fn,
    abs,
    atan,
    cross,
    dFdx,
    dFdy,
    dot,
    float,
    length,
    mix,
    normalize,
    positionView,
    positionViewDirection,
    pow,
    smoothstep,
    sqrt,
    texture,
    uniform,
    uv,
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
 * The look spec's published base albedo, `#150F17` — "base albedo is essentially black —
 * luma 0.067". Measured here from the hex rather than quoted: encoded Rec.709 luma **0.0661**,
 * linear luma **0.005629**, hue 285°. `alive.js`'s `CARD_ALBEDO_FLOOR` is the same hex and its
 * comment names this item as the thing that should re-derive it; see `HAIR_CONTRAST` for what
 * actually changed.
 */
export const HAIR_BASE_COLOUR_HEX = 0x150F17;

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
 */
export const HAIR_CONTRAST = {
    baseEncodedLuma: 0.0661,
    baseLinearLuma: 0.005629,
    bandEncoded: [ 0.60, 0.675, 0.75 ],
    encodedRatio: [ 9.08, 10.21, 11.35 ],
    linearRatio: [ 56.6, 73.4, 92.8 ]
};

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
 * and the two shipped values below sit mid-band. **α_R and β_R are 3.5's two free parameters** and
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
export const HAIR_DEFAULTS = {
    /** Cuticle tilt of the R lobe, Karis' variable. Mid-band of −0.3473…−0.1743. Free parameter. */
    shiftR: -0.26,

    /** Longitudinal width of the R lobe. Mid-band of 0.1745…0.3491. The other free parameter. */
    roughnessR: 0.26,

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
     * `exp( −density · depth )`, so 0 is "every texel fully lit" and the term's colour shift
     * vanishes. 3.0 puts the deepest baked texel at e⁻³ = 0.050.
     */
    shadowDensity: 3.0,

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
     * 🔴 DECLARED AND NOT CONSUMED. GREPPED THIS ROUND: `shiftJitter` appears exactly once in this
     * repository, on this line.
     *
     * What it was written for is real and the bake already carries it — `hair_texture.py`'s own
     * channel table reads *"`flow.png` | R,G tangent · B root→tip · **A strand id**"*, and the
     * alpha channel exists for nothing else. What it would do is jitter the cuticle tilt per
     * strand, so neighbouring fibres do not put their highlight in exactly the same place; that is
     * the card-scale stand-in for the eccentricity Karis explicitly does not model (slide 17). The
     * shader samples `flowMap.rg` and `flowMap.b` and never `.a`.
     *
     * It is left here rather than deleted because deleting it also deletes the only record that a
     * baked channel is going unread. It is NOT implemented on the round that found it, and the
     * reason is a measurement: jitter spreads the band, and this round's whole result is a 2.08x
     * recovery of band energy that has not yet been looked at by a human. Widening it the same
     * afternoon would confound the two. In Karis' α units when somebody does wire it.
     */
    shiftJitter: 0.04
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
 * Slide 39's multiple-scattering fake, per channel.
 *
 * `S_scatter = √C · (n·ωi + 1)/4π · (C / Luma(C))^(1 − Shadow)`
 *
 * The last factor is what the term is for: as `Shadow` falls the result is pushed toward the hair's
 * own CHROMATICITY, so deep hair goes saturated rather than grey. `Shadow` is slide 44's
 * exponential — a path-length estimate, not a binary visibility — and on this build it comes out
 * of the baked bundle-depth sheet rather than out of a shadow map we do not have.
 */
export function scatterValue( dotFakeNormalLight, colour, shadow, settings = {} ) {

    const options = { ...HAIR_DEFAULTS, ...settings };
    const luma = Math.max( 0.2126 * colour[ 0 ] + 0.7152 * colour[ 1 ] + 0.0722 * colour[ 2 ], 1e-5 );
    const wrap = ( dotFakeNormalLight + 1 ) / ( 4 * Math.PI );

    return colour.map( ( channel ) =>
        options.scatter * Math.sqrt( channel ) * wrap * Math.pow( channel / luma, 1 - shadow ) );

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

// --- the GPU side -------------------------------------------------------------------------------

/** `1e-4` guards, named once so the CPU mirror and the shader cannot drift on the value. */
const EPSILON = 1e-4;

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
        this.occlusion = null;

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

        this.colour = nodes.baseColour.toVar( 'hairColour' );

        // Slide 44's exponential, standing on the baked bundle depth. See the header, penalty 2.
        const depth = nodes.depthMap === null ? float( 0 ) : nodes.depthMap.sample( uv() ).r;
        this.shadow = depth.mul( nodes.shadowDensity ).negate().exp().toVar( 'hairShadow' );

        this.occlusion = this.rootOcclusion().toVar( 'hairRootOcclusion' );

        super.start( builder );

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

        // --- the multiple-scattering hack ------------------------------------------------------
        const luma = this.colour.dot( vec3( 0.2126, 0.7152, 0.0722 ) ).max( 1e-5 );
        const wrap = this.fakeNormal.dot( toLight ).add( 1 ).div( 4 * Math.PI );
        const scatter = sqrt( this.colour )
            .mul( wrap )
            .mul( pow( this.colour.div( luma ), vec3( this.shadow.oneMinus() ) ) )
            .mul( nodes.scatter );

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

    const settings = { ...HAIR_DEFAULTS, ...( options.settings ?? {} ) };
    const defect = options.defect ?? 'none';

    if ( Object.hasOwn( HAIR_DEFECTS, defect ) === false ) {

        throw new Error( `HairMaterial: unknown defect '${ defect }'. Known: ${ Object.keys( HAIR_DEFECTS ).join( ', ' ) }` );

    }

    const flowUrl = options.flowMapUrl === undefined
        ? beside( options.groomDirectoryUrl, 'flow.png' )
        : options.flowMapUrl;

    const depthUrl = options.depthMapUrl === undefined
        ? beside( options.groomDirectoryUrl, 'depth.png' )
        : options.depthMapUrl;

    const flowMap = flowUrl == null ? null : await loadDataSheet( flowUrl );
    const depthMap = depthUrl == null ? null : await loadDataSheet( depthUrl );

    const colour = new Color().setHex( options.baseColourHex ?? HAIR_BASE_COLOUR_HEX, SRGBColorSpace );

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

        // Only read on the defect path. View space, pointing up-and-right across the frame, so a
        // reader who sees the plate can tell at a glance that the band is welded to the screen.
        constantTangent: uniform( new Vector3( 0.6, 0.8, 0 ) )
    };

    const material = new HairNodeMaterial( nodes );

    material.name = 'sugata.hair';
    material.metalness = 0;

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
        scatter: nodes.scatter.value,
        sideVisibility: nodes.sideVisibility.value,
        rootOcclusion: nodes.rootOcclusion.value,
        sheets: {
            flow: flowMap !== null,
            depth: depthMap !== null,
            alpha: options.alphaMap != null
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

    // The cotangent frame. `determinant` is the UV Jacobian's; a degenerate quad makes it zero, and
    // the guard keeps that fragment on the card's own direction rather than on a NaN that would
    // propagate into the G-buffer normal and out into GTAO.
    const positionDx = dFdx( positionView );
    const positionDy = dFdy( positionView );
    const uvDx = dFdx( uv() );
    const uvDy = dFdy( uv() );

    const determinant = uvDx.x.mul( uvDy.y ).sub( uvDy.x.mul( uvDx.y ) );
    const safeDeterminant = determinant.add( determinant.sign().mul( EPSILON ) ).add( EPSILON );

    // ∂P/∂v and ∂P/∂u, from [∂P/∂x ∂P/∂y] = [∂P/∂u ∂P/∂v] · J, inverted.
    const alongStrand = positionDy.mul( uvDx.x ).sub( positionDx.mul( uvDy.x ) ).div( safeDeterminant );
    const acrossStrand = positionDx.mul( uvDy.y ).sub( positionDy.mul( uvDx.y ) ).div( safeDeterminant );

    const cardTangent = normalize( alongStrand );

    if ( nodes.flowMap === null || nodes.defect === 'no-flow' ) return cardTangent;

    // The flow sheet's RG is a direction in the card's own (u, v) basis, stored 0..1. It is applied
    // as a rotation WITHIN the card plane so the result can never leave the surface — a flow map
    // that tilted the strand off the card would put the highlight in front of or behind the
    // geometry it belongs to. The ε keeps a texel of exactly (0.5, 0.5) — an unwritten one — from
    // normalising a zero vector.
    const flow = nodes.flowMap.sample( uv() ).rg.mul( 2 ).sub( 1 );
    const across = normalize( acrossStrand );

    return normalize( cardTangent.mul( flow.g ).add( across.mul( flow.r ) ).add( cardTangent.mul( EPSILON ) ) );

}

/**
 * Puts the material on every mesh under a groom root, and hands back the base-colour maps it found
 * so the caller can wire the cutout.
 *
 * @returns {{ meshes:number, alphaMap:?Object }}
 */
export function applyHairMaterial( root, material ) {

    let meshes = 0;
    let alphaMap = null;

    root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;

        if ( alphaMap === null && object.material?.map != null ) alphaMap = object.material.map;

        object.material = material;
        meshes ++;

    } );

    return { meshes, alphaMap };

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
