/**
 * Grade — the last thing that happens to a frame, and the one place a "cinematic" instinct is
 * most likely to make the render look less like the reference rather than more.
 *
 * Punch-list 3.13. Every constant below is quoted from `docs/research/stellar-blade-look-spec.md`
 * §3 and §5, which measured them off reference stills. They are measurements, not taste, and the
 * spec moves before this file does.
 *
 *     toneMapping           ACESFilmic (three's). AgX and Neutral are both available at r185.
 *     highlight clipping    TARGET < 0.5% of pixels above 0.99 luma  (reference 0.017-0.036%)
 *     black point           NO LIFT. p0.1 luma must land 0.004-0.016.
 *     saturation            global 1.00-1.05
 *     bloom                 threshold low/none, intensity 0.25-0.40, WIDE radius
 *     film grain            LUMINANCE-ONLY, sigma ~1-2/255, scale with resolution
 *     chromatic aberration  0.0
 *     vignette              0.10-0.20  [the spec's own "unmeasured estimate"]
 *
 * ## The three decisions worth arguing about
 *
 * **No black lift, and the constant exists so a reader can see it is zero.** `BLACK_LIFT` is
 * `0` and `blackLift` is not a constructor option. The spec calls a lifted shadow "the commonest
 * mistake when people try to make a render look cinematic", and the project's standing
 * constraints repeat it. A film-emulation grade that lifts blacks would put G6 red from the
 * grade's own side, on top of whatever the scene is doing.
 *
 * **Chromatic aberration is absent, not disabled.** UE4's `SceneFringeIntensity` defaults to 0
 * and the spec could not detect any in the reference. There is no option for it, so nobody can
 * turn it on by filling in a config object.
 *
 * **The grade owns the output transform.** `appliesOutputTransform` is `true` and `Stage` skips
 * its own `renderOutput` when a grade is installed. That is forced by the grain: film grain is a
 * DISPLAY-referred quantity — "sigma 1-2/255" is a statement about 8-bit code values — and adding
 * 1/255 of signal to a linear HDR buffer before an ACES curve means something different at every
 * exposure level. So this file tone-maps and encodes, then grains.
 *
 * ## Order of operations, and why
 *
 *     linear HDR -> bloom -> vignette -> saturation -> tone map -> sRGB transfer -> grain
 *
 * Bloom is a lens/sensor effect and belongs in linear light, before the curve, or bright areas
 * bloom by an amount that depends on where the shoulder put them. Vignette is also a lens effect
 * and goes in linear for the same reason — and there is a second, measurable consequence: a
 * vignette applied in linear is pushed through the tone curve's toe, so it darkens the frame's
 * darkest region rather than scaling an already-encoded value. That is the only lever in this
 * file that moves G6 at all, and it is a small one — 27% at the top of the spec's band, against a
 * gate that needed 1.3x. See `DEFAULT_VIGNETTE`.
 *
 * Grain is last because it is display-referred. It is added equally to R, G and B, which is what
 * "achromatic / luminance-only" means: the noise moves brightness and never hue.
 *
 * ## Why the RCAS sharpen lives HERE as well as in `TRAAPost.js`
 *
 * ⚠️ **The table that used to be here does not reproduce, and it is corrected rather than
 * deleted, because a retracted measurement is more use to a successor than a missing one.**
 *
 * It claimed that RCAS run on the linear HDR scene colour — the placement in `TRAAPost.js` —
 * desaturates: iris luma 0.1237 / saturation 0.2997 unsharpened against 0.4159 / 0.1268 with RCAS
 * 0.4 before tone mapping, "a brown iris rendering grey". Re-measured 2026-08-08 on exactly that
 * page and rect (`post.html?aa=traa&bare` at 900x1200, iris 330..350 x 360..375), with the frame
 * loop owned by the capture and the resolve converged to frame 120:
 *
 *   | sharpen placement                     | iris luma | iris HSV saturation |
 *   |---------------------------------------|-----------|---------------------|
 *   | none                                  |  0.1169   |       0.4086        |
 *   | RCAS 0.4 before tone mapping          |  0.1164   |       0.4032        |
 *   | 4x MSAA, for scale                    |  0.1172   |       0.4065        |
 *
 * A 1.3% difference in saturation, not a 2.4x one. The sharpen is genuinely in the graph — it
 * moves gate G4 from 1.6318 to 2.8920 at 900 px — so this is not "the pass was inert"; it simply
 * does not do to the iris what was recorded. The most likely reading is that the original was
 * taken before `docs/LEARNINGS.md` §1.24 was fixed, when `?capture` drew the scene directly and
 * threw the whole post chain away, but that is a hypothesis and it is labelled as one.
 *
 * **What survives, and is still the reason this pass exists here:** RCAS is defined as an LDR
 * perceptual-space operator and FSR2 applies it after tone mapping, so this is the reference
 * ordering. What has changed is that it is no longer ON by default in either place —
 * `TRAAPost.DEFAULT_SHARPNESS` is `null` because a sharpen in EITHER position pushes G4 out of the
 * spec's band on this rig. Its table is the one to read before switching either back on.
 */

import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping, SRGBColorSpace } from 'three/webgpu';

import {
    convertToTexture,
    float,
    Fn,
    luminance,
    saturation as adjustSaturation,
    screenCoordinate,
    screenUV,
    toneMapping,
    uniform,
    vec2,
    vec3,
    vec4,
    workingToColorSpace
} from 'three/tsl';

import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { sharpen } from 'three/addons/tsl/display/SharpenNode.js';

/**
 * The additive floor this grade puts under the blacks. It is zero, it is named, and it is not a
 * constructor option — see the header. Anything that wants to argue with it argues with the
 * look spec's p0.1 measurement of 0.004-0.016 first.
 */
export const BLACK_LIFT = 0;

/**
 * Spec §3: "intensity 0.25-0.40, WIDE radius, threshold low/none".
 *
 * ⚠️ The threshold is **0.8, not 0**, and that is a translation of the spec rather than a
 * departure from it. UE's bloom is energy-conserving: it redistributes light, so "threshold none"
 * costs the black point nothing. `BloomNode` ADDS a blurred copy, so threshold 0 is a global lift.
 * Measured on `post.html?aa=traa&bare&grade=1` at 900x1200, whole-image p0.1 luma and the far
 * backdrop patch (760,80,120,120), with grain and vignette at zero:
 *
 *   | strength | threshold | p0.1 luma | far backdrop |
 *   |----------|-----------|-----------|--------------|
 *   |     0.00 |     0     |  0.02496  |    0.0250    |  <- the ungraded frame, for reference
 *   |     0.02 |     0     |  0.02888  |    0.0320    |
 *   |     0.04 |     0     |  0.03309  |    0.0372    |
 *   |     0.10 |     0     |  0.04485  |    0.0548    |
 *   |     0.30 |     0     |  0.08630  |    0.1066    |  <- 4.3x the black point, 4.3x the card
 *   |     0.30 |    0.6    |  0.02805  |    0.0304    |
 *   |     0.30 |    0.9    |  0.02496  |    0.0250    |  <- indistinguishable from no bloom
 *
 * So threshold 0 at the spec's own intensity is a 4.3x black lift, which the same spec forbids in
 * bold. 0.8 keeps the spec's intensity and leaves the black point where the scene put it.
 */
export const DEFAULT_BLOOM = { strength: 0.30, radius: 0.85, threshold: 0.8 };

/**
 * Grain sigma in 8-bit code values. Spec §3: "sigma ~0.4-0.7/255 on compressed press assets ->
 * likely ~1-2/255 in-game". 1.5 is the middle of the in-game estimate.
 */
export const DEFAULT_GRAIN_SIGMA_CODES = 1.5;

/**
 * How many output pixels wide one grain cell is at the reference height. The spec says grain is
 * "resolution-scaled", which means the grain stays the same size on the SCREEN as the render gets
 * denser — not that it stays one pixel. `GRAIN_REFERENCE_HEIGHT` is the height at which one cell
 * is exactly `GRAIN_CELL_PIXELS`.
 */
export const GRAIN_CELL_PIXELS = 1.0;
export const GRAIN_REFERENCE_HEIGHT = 1080;

/**
 * The frame seed the shipped grain is drawn from: the renderer's own frame counter, wrapped.
 *
 * Named rather than written inline in the constructor so it reads as a claim and so the broken
 * drivers sit in one table beside it. Two properties make it right: it advances on every frame,
 * and it depends on NOTHING but the frame index, which is what makes a stepped capture
 * byte-reproducible. T1 and T3 measure exactly those two.
 *
 * `4096` is a wrap, not a period the eye can see: the hash below decorrelates on a seed change of
 * 1, so consecutive seeds are already independent fields and the wrap only keeps the float small
 * enough that `sin()` still has bits left at the far end of a long session.
 */
function SHIPPED_GRAIN_SEED( frame ) {

    return frame.frameId % 4096;

}

/** Spec §3: "global 1.00-1.05". */
export const DEFAULT_SATURATION = 1.02;

/**
 * 🎯 The RCAS strength a TEMPORAL path should pass as `sharpness`, and the sweep that chose it.
 *
 * It is not the constructor default, and that is deliberate: a forward, MSAA'd frame has nothing
 * to recover, so `sharpness` stays `null` unless a caller asks. This constant exists so the value
 * a temporal page should use is a named measurement rather than a number in somebody's diff.
 *
 * Swept on `alive.html?bare&freeze&aa=taau&grade=1`, converged with a zero simulation step. G4 is
 * the flat-skin high-pass sigma at **3840x5120**, the width its 1.5-2.1/255 band is stated at;
 * `hard%` is the share of silhouette transitions that jump in a single pixel, over six rows at
 * 900x1200, which is what a jaggy IS:
 *
 *   | grade RCAS | G4 /255 | silhouette hard% | card-band hard% |
 *   |------------|---------|------------------|-----------------|
 *   | none       | 1.5375  |      11.4        |      27.1       |
 *   | 1.2        | 1.6223  |      17.9        |      30.8       |  <- ships
 *   | 0.9        | 1.6609  |      26.2        |      32.7       |
 *   | 0.6        | 1.7146  |      31.8        |      30.2       |
 *   | 0.2        | 1.9029  |      47.0        |      33.0       |
 *   | 4x MSAA, for scale     | 1.7457  |      67.9        |      44.5       |
 *
 * The trade is monotone and it is a real one: every step of sharpening buys high-pass detail and
 * spends edge softness. `none` reads G4 1.5375, which is inside the band by 2.5% and too close to
 * its floor to survive a re-measurement on a different plate. **1.2 buys 8% of margin for 6.5
 * points of edge hardness and is still 3.8x better on edges than the MSAA default.** 0.2, which an
 * earlier note proposed, costs 4x the hardness for detail the band did not need.
 */
export const TEMPORAL_RECOVERY_SHARPNESS = 1.2;

/**
 * Spec §3: "0.10-0.20 [unmeasured estimate]".
 *
 * 0.15 is the middle of that band. It is worth being clear about what it does and does not buy:
 * measured on `post.html?aa=traa&bare&grade=1&bloom=0.30&thresh=0.8&grain=0`, whole-image p0.1
 * luma went 0.02833 (vignette 0) -> 0.02384 (0.12) -> 0.02076 (0.20) while the cheek moved
 * 0.8417 -> 0.8409 -> 0.8404. So the vignette darkens the corners and leaves the face alone, as
 * it should, and it takes 27% off the black point at the top of the spec's band — **which is not
 * enough to bring G6 into 0.004-0.016 on its own.** G6 is a measurement of the backdrop card, and
 * the number that moves it is in `alive.js`.
 *
 * ✅ It landed: `docs/OPEN-REQUESTS.md` REQ-010, `CARD_ALBEDO_FLOOR` and
 * `BACKDROP_EMISSIVE = 0x070a0e`. G6 moved 0.00001 -> 0.0042 on the shipped default, and `?cards=0`
 * and the default now read the SAME G6 — which is what "the cards are no longer the darkest thing
 * in frame" means as a measurement rather than as a claim. This paragraph used to point at a round
 * report, which is a document this repository does not contain.
 */
export const DEFAULT_VIGNETTE = 0.15;

/** Uniform noise on [-0.5, 0.5] has standard deviation 1/sqrt(12); the amplitude follows. */
const UNIFORM_NOISE_SIGMA = 1 / Math.sqrt( 12 );

const TONE_CURVES = {
    aces: ACESFilmicToneMapping,
    agx: AgXToneMapping,
    neutral: NeutralToneMapping
};

export class Grade {

    /**
     * @param {Object} [options]
     * @param {'aces'|'agx'|'neutral'} [options.toneCurve='aces'] - The spec measured a UE4
     *   ACES-derived filmic curve, so `aces` is the default. `agx` is offered because it holds
     *   highlight hue better and the spec's own note says three's ACES "desaturates highlights
     *   more than UE's — compensate +3-5% saturation".
     * @param {number} [options.exposure=1] - Multiplier into the curve.
     * @param {number} [options.bloomStrength=0.30]
     * @param {number} [options.bloomRadius=0.85] - 0..1, the mip-blend spread. Wide, per spec.
     * @param {number} [options.bloomThreshold=0] - Zero means everything blooms a little.
     * @param {number} [options.grainSigmaCodes=1.5] - Grain standard deviation in /255.
     * @param {number} [options.vignette=0.12] - Fractional darkening at the frame corners.
     * @param {number} [options.saturation=1.02]
     * @param {?number} [options.sharpness=null] - RCAS strength in `SharpenNode`'s scale, where
     *   **0 is maximum sharpening and 2 is none**. `null` skips the pass. It exists to give back
     *   the micro-detail a temporal resolve removes — measured in `TRAAPost.js` — so a forward,
     *   MSAA'd frame has no business asking for it.
     * @param {?string} [options.rebuildGrainDefect=null] - 🚩 **REBUILDS A DEFECT ON PURPOSE.**
     *   One of `GRAIN_DEFECTS`. Never set it in an application; it exists so the gate can render
     *   the broken grade and watch its own checks go red, which is the only thing that separates a
     *   real gate from a decorative one (`docs/LEARNINGS.md` §1.1). Same pattern, and the same
     *   flag, as `motion/Blink.js`'s `frameQuantisedArrivals`.
     */
    constructor( options = {} ) {

        const curveName = options.toneCurve ?? 'aces';

        if ( TONE_CURVES[ curveName ] === undefined ) {

            throw new Error( `Grade: toneCurve must be one of ${ Object.keys( TONE_CURVES ).join( ', ' ) }.` );

        }

        this.toneCurveName = curveName;
        this.toneCurve = TONE_CURVES[ curveName ];

        // Everything a page might want to drag a slider over is a uniform, so changing it does
        // not recompile the node graph — a recompile mid-session resets TRAA's history.
        this.exposure = uniform( options.exposure ?? 1 );
        this.bloomStrength = uniform( options.bloomStrength ?? DEFAULT_BLOOM.strength );
        this.bloomRadius = uniform( options.bloomRadius ?? DEFAULT_BLOOM.radius );
        this.bloomThreshold = uniform( options.bloomThreshold ?? DEFAULT_BLOOM.threshold );
        this.grainSigmaCodes = uniform( options.grainSigmaCodes ?? DEFAULT_GRAIN_SIGMA_CODES );
        this.vignette = uniform( options.vignette ?? DEFAULT_VIGNETTE );
        this.saturation = uniform( options.saturation ?? DEFAULT_SATURATION );

        // The grain has to change every frame or it reads as dirt on the lens rather than as
        // grain. Driven off `frameId` rather than off a clock, because three's node clock reads
        // `performance.now()` and the deterministic capture tool pins wall time — a wall-clock
        // grain would make a byte-reproducible capture stop reproducing.
        //
        // ⚠️ Both halves of that sentence are claims about a SEQUENCE, and for a round nothing
        // measured either: the gate's sixteen checks were all single-frame statistics, so
        // `onFrameUpdate( () => 0 )` — the exact defect this comment warns against — scored 44/44
        // green. The T-checks in `Grade.selftest.mjs` render a seven-frame sequence and two
        // independent runs, and are what makes this comment enforceable rather than advisory.
        this.grainFrame = uniform( 0 ).onFrameUpdate( SHIPPED_GRAIN_SEED );

        // Not a uniform: `SharpenNode` takes its strength at construction and the pass either
        // exists in the graph or it does not, so changing it is a recompile either way.
        this.sharpness = options.sharpness ?? null;

        this.rebuiltGrainDefect = options.rebuildGrainDefect ?? null;

        if ( this.rebuiltGrainDefect !== null && GRAIN_DEFECTS[ this.rebuiltGrainDefect ] === undefined ) {

            throw new Error( `Grade: rebuildGrainDefect must be one of ${ Object.keys( GRAIN_DEFECTS ).join( ', ' ) }.` );

        }

        // 🚩 Five of the rebuilt defects break the CLOCK rather than the amplitude or the envelope,
        // so they replace the driver above rather than anything in `compose`. See
        // `GRAIN_SEED_DRIVERS`, and the T-checks in the selftest that exist to catch them.
        if ( GRAIN_SEED_DRIVERS[ this.rebuiltGrainDefect ] !== undefined ) {

            this.grainFrame = uniform( 0 ).onFrameUpdate( GRAIN_SEED_DRIVERS[ this.rebuiltGrainDefect ] );

        }

        // 🚩 STRUCTURAL, NOT ARITHMETIC — AND THE REASON IS THAT `?bloom=0` WAS NOT MEASURING
        // BLOOM.
        //
        // `bloomStrength` is a uniform so a page can drag it without recompiling the graph. But
        // `bloom( … )` builds TWELVE render passes — a bright pass, five horizontal and five
        // vertical separable blurs, and a composite — and it builds all twelve whether the
        // uniform reads 0.30 or 0. A strength of exactly zero multiplies the composite by
        // nothing, so the chain still renders and the frame still pays for it.
        //
        // That is how the perf round came to record bloom as costing **+0.001 ms**: the toggle it
        // measured changed a multiply, not a pass list. With this flag in place the same toggle,
        // same page, same 1080p portrait, 600 samples after 150 warm-up frames, moved the frame
        // from **15.808 ms to 14.591 ms** — 1.217 ms, three orders of magnitude more than the
        // number the toggle used to report.
        //
        // ⚠️ Measured BEFORE `TRAAPost`'s redundant-RTT removal landed. Re-measured after it, on a
        // contended machine, the same pair fell inside run-to-run spread, so **do not quote 1.217
        // as the bloom chain's cost on the current build** — quote it as what the toggle was
        // failing to see. The chain's cost today is unmeasured and is the next thing to measure.
        this.bloomEnabled = ( options.bloomStrength ?? DEFAULT_BLOOM.strength ) !== 0;

        this.bloomNode = null;
        this.sharpenNode = null;

    }

    /** `Stage` reads this and skips its own `renderOutput`. See the header. */
    get appliesOutputTransform() {

        return true;

    }

    /**
     * Builds the graded output node.
     *
     * @param {GBuffer} gbuffer - Unused today; taken so the signature matches `setComposeOutput`
     *   and so a future grade can read `diffuseColor` for a character/environment saturation
     *   split (spec §3: "character +8%, environment -15%") without changing every caller.
     * @param {Node} colourNode - Linear HDR scene colour, already temporally resolved.
     * @returns {Node<vec4>} Display-referred, sRGB-encoded.
     */
    compose( gbuffer, colourNode ) {

        // BloomNode renders its own mip chain by sampling the input, so the input has to be
        // texture-backed. `convertToTexture` makes that true for anything a caller composes in.
        //
        // ⚠️ THIS COMMENT USED TO SAY THE INPUT "ALREADY IS ON BOTH LIVE PATHS (a pass texture, or
        // TRAA's resolve texture)", AND FOR THE TEMPORAL PATH THAT WAS FALSE. `TAAUNode` and
        // `TRAANode` are `TempNode`s, not `TextureNode`s, so `convertToTexture` did not recognise
        // them and quietly built an `RTTNode` — a full-resolution HalfFloat pass per frame whose
        // only output was a copy of a full-resolution HalfFloat buffer. It cost **5.62 ms of a
        // 15.99 ms frame** at 1080p, and it was invisible because the picture was byte-identical
        // either way. `TRAAPost.createTemporalResolve` now hands out `getTextureNode()`, so the
        // sentence is true and this call is the no-op it always read as. The measurement, the
        // three-round A/B and the two red-proofs are in `TRAAPost.js` and its selftest.
        const source = convertToTexture( colourNode );

        // 🚩 **THE FRAME'S ALPHA, CARRIED. THE LINE AT THE BOTTOM OF THIS FUNCTION USED TO RETURN A
        // LITERAL `1` AND IT WAS THE LAST OF FOUR WRITES THAT MADE A TRANSPARENT CANVAS IMPOSSIBLE
        // — AND THE ONLY ONE THAT SURVIVED FIXING THE OTHER THREE.** The renderer is already
        // configured for it and always was: `Renderer.js:98` defaults `alpha` to true,
        // `Renderer.js:465`/`:473` therefore clear to `Color4( 0, 0, 0, 0 )`, and
        // `WebGPUBackend.js:349` configures the canvas `premultiplied`. Three writes in `Avatar.js`
        // put an opaque background, an 8x6 m emissive card and a 20 m ground plane in front of that,
        // and this one threw the alpha away after all of them.
        //
        // ⚠️ **AND CARRYING IT MEANS THIS FILE ALSO OWES THE PREMULTIPLY.** `appliesOutputTransform`
        // is true, so `Stage.js:713-717` does NOT wrap the graded node in `renderOutput()` — which
        // means the grade skips three's `premultiplyAlpha` (`RenderOutputNode.js:137`) as well as
        // its tone map. On a canvas the backend configures as `premultiplied`, an unpremultiplied
        // edge fringes BRIGHT on a light host UI. So the return below multiplies.
        //
        // 🎯 THE DEFAULT PATH IS BIT-IDENTICAL AND THAT IS THE PROPERTY THAT MADE THIS SAFE TO LAND.
        // With `background: 'studio'` the scene has an `isColor` background, `Background.js:71-76`
        // sets `_clearColor.a = 1`, every drawn surface writes 1, and `x * 1.0 === x` exactly in
        // IEEE-754 for every finite x. Every committed G1–G7 number is stated on that path.
        //
        // 🚩 **THE ALPHA THAT ARRIVES HERE IS CORRECT, AND THE TEMPORAL RESOLVE DESTROYS IT. BOTH
        // HALVES MEASURED IN A REAL GPU CHROMIUM ON 2026-08-17**, by returning `vec4( vec3( alpha ),
        // 1 )` from this function and reading the plate back — the alpha displayed as a picture:
        //
        //     | configuration                          | alpha = 0 | alpha = 1 |
        //     |----------------------------------------|----------:|----------:|
        //     | studio background, tier `high`          |     0.00% |   100.00% |
        //     | transparent background, tier `high`     |     0.00% |   100.00% |
        //     | transparent background, tier `fallback` |    41.63% |    57.80% |
        //
        // Row 3 is this chain working exactly as designed: 41.63% of the frame is empty and carries
        // alpha 0, 57.80% is the figure and carries alpha 1. Row 1 is the shipped path and is why
        // the change is safe — alpha is 1 everywhere, and `x * 1.0 === x` exactly.
        //
        // 🔴 Row 2 is the defect, and it is NOT in this file: `high` and `balanced` differ from
        // `fallback` in the TEMPORAL RESOLVE, and with it on the alpha reaching this function is 1
        // over the whole frame including the empty region. `TAAUNode`/`TRAANode` are three's and
        // resolve into a buffer whose alpha is not carried. Until that is repaired, a transparent
        // canvas is impossible on the two tiers that ship a temporal resolve, and `Avatar.create`
        // refuses `background.colour: null` in words rather than presenting an opaque black
        // rectangle. This chain is ready for the day the resolve is fixed.
        //
        // ⚠️ And for a FRACTIONAL alpha the multiply is applied after the tone curve rather than
        // before it, which is an approximation. Exact for the arms this project ships, all of which
        // are opaque-bucket (`cutout`/`hash`/`stochastic`) and produce alpha in { 0, 1 }.
        const alpha = vec4( colourNode ).a.clamp( 0, 1 ).toVar();

        this.bloomNode = this.bloomEnabled === false
            ? null
            : bloom( source, this.bloomStrength, this.bloomRadius, this.bloomThreshold );

        const bloomed = this.bloomNode === null ? source : source.add( this.bloomNode );

        const vignetted = bloomed.rgb.mul( vignetteNode( this.vignette ) );

        const saturated = adjustSaturation( vignetted, this.saturation );

        const mapped = toneMapping( this.toneCurve, this.exposure, saturated );

        const encoded = workingToColorSpace( mapped, SRGBColorSpace );

        let sharpened = encoded;

        if ( this.sharpness !== null ) {

            // `denoise` stays false: it attenuates sharpening where the neighbourhood is noisy,
            // and on this figure the "noise" is the skin micro-normal — exactly the signal G4
            // measures and exactly what this pass is here to bring back.
            this.sharpenNode = sharpen( vec4( encoded.xyz, 1 ), this.sharpness, false );
            sharpened = this.sharpenNode.rgb;

        }

        const grained = sharpened.add( grainTermFor(
            this.rebuiltGrainDefect, this.grainSigmaCodes, this.grainFrame, luminance( sharpened.xyz )
        ) );

        // Clamped because the transfer is done: anything outside 0..1 is not a highlight any
        // more, it is a value the swap chain will wrap or clip unpredictably.
        // `.xyz` rather than the bare node: `workingToColorSpace` carries its input's arity
        // through, so `encoded` is vec4 when the chain started at a texture and vec3 when it did
        // not, and `vec4( aVec4, 1 )` is five components and a compile error at r185. That arity
        // note is also why the fix is NOT `1` -> `grained.a`: `grained` may be a vec3.
        //
        // 🚩 ALPHA IS FORCED TO 1, AND CARRYING IT WAS A MEASURED REGRESSION ON THE COMMONEST TIER.
        //
        // The reasoning above is right about premultiplication and wrong about who writes alpha. It
        // argues the default path is bit-identical because "every drawn surface writes 1" — true on
        // the two WebGPU tiers, and false on `fallback`, which is the ONLY tier built with
        // `antialias: true` (`Avatar.js:604`) and is what `quality: 'auto'` resolves to on every
        // browser without WebGPU. MSAA's coverage resolve writes FRACTIONAL alpha at every silhouette
        // edge regardless of what any surface wrote, and a groom is nothing but silhouette edges.
        //
        // Measured in a real WebGL2 Chromium on 2026-08-17, canvas composited over #ffffff and over
        // #000000 and differenced — an opaque frame gives identical composites:
        //
        //     fallback + hair : the host page shows through on 13.728% of pixels, worst 130/255
        //     fallback + bald : 0.190%, worst 105/255
        //     with alpha forced back to 1 : 0.000%
        //
        // `Grade.selftest.mjs` is 68/68 and contains the string "alpha" zero times, so nothing in
        // the suite could see it. A transparent background is REFUSED at `Avatar.create` (see its
        // TypeError), so the frame is opaque by contract and there is no case where this should
        // carry coverage. The premultiply stays as a no-op against alpha 1, which is exactly the
        // arithmetic the paragraph above wanted and is bit-identical to the pre-change path.
        return vec4( grained.xyz.clamp( 0, 1 ).mul( alpha ), 1 );

    }

    /**
     * Frees the bloom node's render targets. Safe before `compose` has ever run.
     */
    dispose() {

        this.bloomNode?.dispose?.();
        this.sharpenNode?.dispose?.();
        this.bloomNode = null;
        this.sharpenNode = null;

    }

}

// --- the two effects this file implements itself ---------------------------------------------

/**
 * A radial darkening towards the corners, in linear light.
 *
 * `amount` is the fraction of light removed AT THE CORNER, so `0.12` means the extreme corner
 * keeps 88% and the centre is untouched. Expressed that way because that is how the spec states
 * it ("0.10-0.20 normalised") and because it makes the CPU mirror in the selftest trivial.
 *
 * The falloff is `1 - amount * r^2` on the normalised radius, `r` measured from the frame centre
 * with the corner at 1. Squared rather than linear so the middle two thirds of the frame are
 * essentially untouched — a linear ramp is visible as a grey wash across a face.
 *
 * It is computed on `screenUV`, so the iso-lines are ellipses that follow the frame rather than
 * circles inscribed in it. That is the conventional photographic choice and it is the one that
 * behaves sanely on a 3:4 portrait: a circular vignette in a tall frame darkens the top and
 * bottom of the head and leaves the sides alone.
 */
export const vignetteNode = /*@__PURE__*/ Fn( ( [ amount ] ) => {

    const centred = screenUV.sub( 0.5 ).mul( 2 );

    // lengthSq is 2 at the corner, so the halving puts `r^2 = 1` exactly there and `amount` is
    // read directly as "fraction of light removed at the corner".
    return float( 1 ).sub( amount.mul( centred.lengthSq().mul( 0.5 ) ) );

} );

/**
 * Achromatic film grain, in display-referred units.
 *
 * `sigmaCodes` is the standard deviation in 8-bit code values, which is the unit the reference was
 * measured in. The shader draws uniform noise on [-0.5, 0.5], whose standard deviation is
 * 1/sqrt(12), so the amplitude is `sigmaCodes / 255 / (1/sqrt(12))`. Getting that conversion
 * wrong is how a grade ends up with grain three times the spec's and nobody can say by how much.
 *
 * The hash is the usual `fract(sin(dot(.)) * k)` value noise: boring, dependency-free, and good
 * enough for a per-pixel dither. It is seeded on the frame index so successive frames get
 * independent noise, and quantised to a grain cell so the grain size is a screen-space property
 * rather than a pixel-count property.
 */
export const grainNode = /*@__PURE__*/ Fn( ( [ sigmaCodes, frameSeed, displayLuma ] ) => {

    const amplitude = sigmaCodes.div( 255 ).div( float( UNIFORM_NOISE_SIGMA ) );

    return unitGrainNoise( frameSeed ).mul( amplitude ).mul( grainEnvelope( displayLuma ) );

} );

/**
 * How far the frame seed slides the hash's input per frame.
 *
 * 🎯 **These two numbers have to be irrational, and that is the whole of why the grain is grain
 * rather than a moving texture.** The hash is evaluated on the integer grain cell plus this
 * offset. An INTEGER offset would make frame N's field an exact spatial translation of frame 0's —
 * every pixel gets a value some other pixel already had, so the grain slides across the screen
 * like a sheet of dirt being dragged. With an irrational offset the hash lands somewhere new on
 * every frame and no translation of one frame matches another.
 *
 * The failure is invisible to any per-pixel temporal statistic: a slid field is still perfectly
 * decorrelated at zero offset, still deterministic, still the right sigma. `grain-scrolls` rebuilds
 * it and T4 is the check that sees it. See `SCROLL_SEED_STEP`.
 */
const GRAIN_SEED_STEP = [ 0.7548776662, 0.5698402909 ];

/** 🚩 The integer version, reached only via `GRAIN_DEFECTS['grain-scrolls']`. */
const SCROLL_SEED_STEP = [ 3, 7 ];

/**
 * Zero-mean uniform noise on [-0.5, 0.5], one draw per grain cell per frame, for a given per-frame
 * seed step.
 *
 * Split out so the deliberately broken variants below reuse the SAME hash: a rejection proof that
 * also changed the noise source would be proving two things at once.
 */
const steppedGrainNoise = /*@__PURE__*/ Fn( ( [ frameSeed, stepX, stepY ] ) => {

    const cell = screenCoordinate.xy.div( float( GRAIN_CELL_PIXELS ) ).floor();

    const seeded = cell.add( frameSeed.mul( vec2( stepX, stepY ) ) );

    const noise = seeded.dot( vec2( 12.9898, 78.233 ) ).sin().mul( 43758.5453 ).fract();

    return noise.sub( 0.5 );

} );

/** The shipped noise: `steppedGrainNoise` at the irrational step. */
export const unitGrainNoise = /*@__PURE__*/ Fn( ( [ frameSeed ] ) =>
    steppedGrainNoise( frameSeed, float( GRAIN_SEED_STEP[ 0 ] ), float( GRAIN_SEED_STEP[ 1 ] ) ) );

/** 🚩 The same hash, slid by whole cells, so the grain translates instead of redrawing. */
const scrollingGrainNoise = /*@__PURE__*/ Fn( ( [ frameSeed ] ) =>
    steppedGrainNoise( frameSeed, float( SCROLL_SEED_STEP[ 0 ] ), float( SCROLL_SEED_STEP[ 1 ] ) ) );

/**
 * How much grain a given display luma gets, peaking at 1 in the midtones and reaching 0 at both
 * ends. `4L(1-L)` — the standard film-emulation shape, and it is the physics: grain is a
 * fluctuation in developed silver density, so an unexposed region has no grains to fluctuate and
 * a fully exposed one has no unexposed grains left.
 *
 * It also fixes a measured gate failure, which is how the omission was found rather than
 * reasoned about. Flat grain at sigma 1.5/255 has a half-width of 5.2/255, so on a backdrop
 * sitting at 3/255 it drives a tail of pixels to zero and CRUSHES them. Measured on
 * `post.html?aa=msaa&bare&specaa=1&grade=1&backdrop=0x0a0d13` at 900x1200, whole-image p0.1 luma:
 *
 *   | grain            | p0.1 luma | verdict against 0.004-0.016 |
 *   |------------------|-----------|-----------------------------|
 *   | off              |  0.00869  | in band                     |
 *   | flat 1.5/255     |  0.00057  | crushed, 7x below the band  |
 *   | enveloped 1.5/255|  0.00842  | in band                     |
 *
 * Re-measured independently on the same page and viewport when the selftest below was written,
 * by editing this function to `1` and rendering: **0.00841 enveloped -> 0.00056 flat**, i.e. the
 * table above reproduces to 1e-5 and the crush is real, not a stale note.
 *
 * So the grade WAS lifting nothing and crushing something, which is the same mistake in the other
 * direction and just as invisible by eye.
 *
 * The property that makes that true is not the exact curve, it is that the envelope vanishes AT
 * LEAST LINEARLY at L -> 0: the grain's half-width then falls faster than the signal it is added
 * to, so no pixel can be pushed below zero at any luma. `grainHalfWidthAt` states it, and the
 * selftest sweeps it. `sqrt(4L(1-L))` has the same endpoints and FAILS it.
 *
 * Mirrored on the CPU by `grainEnvelopeAt` at the foot of this file.
 */
export const grainEnvelope = /*@__PURE__*/ Fn( ( [ displayLuma ] ) => {

    const level = displayLuma.saturate();
    return level.mul( level.oneMinus() ).mul( 4 );

} );

// --- 🚩 the rebuilt defects, so the gate can watch itself go red -------------------------------

/**
 * Every way this file's grain has been, or could plausibly be, wrong — each one reachable from a
 * URL so a rejection proof is a page rather than a committed plate (`docs/LEARNINGS.md` §1.11e).
 *
 * The list is not the history of this file. Four of these were never shipped; they are here
 * because a gate that only rejects the defect it was written for is decorative, and the way to
 * find that out is to invent a DIFFERENT defect in the same class and see whether the gate notices.
 *
 * ⚠️ `flat` is also the sabotage an independent verifier used to prove the old gate decorative:
 * `level.mul( level.oneMinus() ).mul( 4 ).mul( 0 ).add( 1 )` is arithmetically the constant 1 with
 * every token a regex looks for still present. A gate that reads source text cannot tell the two
 * apart. A gate that renders cannot tell them apart either — and does not need to, because they
 * produce the same picture and it fails on the picture.
 */
export const GRAIN_DEFECTS = {
    flat: 'no envelope at all — grain at full strength in the blacks. The defect that shipped, and ' +
        'what the `.mul(0).add(1)` sabotage evaluates to.',
    floored: '0.25 + 0.75 E — "keep a little grain in the shadows". Crushes an eighth as hard.',
    sqrt: 'sqrt(E) — right endpoints, wrong slope at zero. Below the 8-bit floor; the analytic sweep ' +
        'is what catches this one.',
    inverted: '1 - L — most grain where there is least light.',
    chromatic: 'independent noise per channel. Leaves the black point alone and makes the grain ' +
        'coloured, which no black-point check can see.',
    'naive-amplitude': 'amplitude = sigma/255, missing the sqrt(12) that turns a uniform width into ' +
        'a standard deviation. Delivers 0.43/255 instead of 1.5.',
    off: 'no grain at all. The one an eye is least likely to notice and a sigma measurement catches ' +
        'instantly.',

    // The six that break TIME. Every statistic above is a single-frame one and cannot see any of
    // these; they are the class the gate was blind to for a round.
    frozen: 'the seed never advances. One fixed noise field, which is dirt on the lens and not ' +
        'grain — the defect the constructor comment names, and the one that scored 44/44 green.',
    'two-frame': 'the seed alternates 0,1,0,1. Consecutive frames DO differ, so a gate that only ' +
        'diffs neighbours passes it; it is two pieces of dirt taking turns at 30 Hz.',
    'four-frame': 'the seed cycles 0,1,2,3. It exists because it BEAT the first version of T2, whose ' +
        'four consecutive frames landed on four distinct seeds — a repeat check sees a period only ' +
        'when two of its frames are congruent modulo it.',
    'quarter-rate': 'the seed advances once every four frames. Three neighbouring pairs in four are ' +
        'identical, so a single-pair check passes it three times out of four.',
    'wall-clock': 'the seed is performance.now(). It looks perfect in motion and destroys ' +
        'reproducibility: the same frame index renders a different field on every run.',
    'grain-scrolls': 'the per-frame seed step is a whole number of cells, so every frame is an exact ' +
        'TRANSLATION of one fixed field. Decorrelated at zero offset, deterministic, right sigma — ' +
        'it defeats every other check in this file and reads as grain sliding across the screen.'
};

/**
 * 🚩 The broken frame-seed drivers, in `onFrameUpdate`'s signature. Reached only via
 * `GRAIN_DEFECTS`, and they replace `SHIPPED_GRAIN_SEED` rather than anything inside `compose` —
 * the grain they produce is the shipped grain with a broken clock, which is the point. A defect
 * that also changed the amplitude or the envelope would be caught by R3 or R5 and would prove
 * nothing about the temporal checks.
 */
const GRAIN_SEED_DRIVERS = {
    frozen: () => 0,
    'two-frame': ( frame ) => frame.frameId % 2,
    'four-frame': ( frame ) => frame.frameId % 4,
    'quarter-rate': ( frame ) => Math.floor( frame.frameId / 4 ) % 4096,
    // Wrapped at 4096 like the shipped seed, so the ONLY difference from shipped is where the
    // number comes from. An unwrapped clock would also change the hash's numeric range.
    'wall-clock': () => performance.now() % 4096
};

/** The wrong envelopes, in the same units as `grainEnvelope`. Reached only via `GRAIN_DEFECTS`. */
const BROKEN_ENVELOPES = {
    flat: () => float( 1 ),
    floored: ( luma ) => grainEnvelope( luma ).mul( 0.75 ).add( 0.25 ),
    sqrt: ( luma ) => grainEnvelope( luma ).sqrt(),
    inverted: ( luma ) => luma.saturate().oneMinus()
};

/**
 * The grain contribution added to the encoded image, as a vec3.
 *
 * @param {?string} defect - `null` for the shipped grain, or a key of `GRAIN_DEFECTS`.
 * @param {Node} sigmaCodes
 * @param {Node} frameSeed
 * @param {Node} displayLuma
 * @returns {Node<vec3>}
 */
export function grainTermFor( defect, sigmaCodes, frameSeed, displayLuma ) {

    if ( defect === 'off' ) return vec3( 0 );

    // The temporal defects are the shipped grain term with a broken seed; the constructor has
    // already swapped the driver, so there is nothing left for this function to do differently.
    if ( defect === null || GRAIN_SEED_DRIVERS[ defect ] !== undefined ) {

        return vec3( grainNode( sigmaCodes, frameSeed, displayLuma ) );

    }

    if ( defect === 'chromatic' ) {

        // Three independent draws. The offsets are arbitrary and only have to decorrelate the hash.
        return vec3(
            grainNode( sigmaCodes, frameSeed, displayLuma ),
            grainNode( sigmaCodes, frameSeed.add( 101 ), displayLuma ),
            grainNode( sigmaCodes, frameSeed.add( 211 ), displayLuma )
        );

    }

    if ( defect === 'naive-amplitude' ) {

        return vec3( unitGrainNoise( frameSeed )
            .mul( sigmaCodes.div( 255 ) )
            .mul( grainEnvelope( displayLuma ) ) );

    }

    if ( defect === 'grain-scrolls' ) {

        return vec3( scrollingGrainNoise( frameSeed )
            .mul( sigmaCodes.div( 255 ).div( float( UNIFORM_NOISE_SIGMA ) ) )
            .mul( grainEnvelope( displayLuma ) ) );

    }

    const amplitude = sigmaCodes.div( 255 ).div( float( UNIFORM_NOISE_SIGMA ) );

    return vec3( unitGrainNoise( frameSeed )
        .mul( amplitude )
        .mul( BROKEN_ENVELOPES[ defect ]( displayLuma ) ) );

}

// --- the CPU mirror the selftest measures against ---------------------------------------------

/**
 * The vignette's multiplier at a normalised offset from centre, mirroring `vignetteNode`.
 *
 * A mirror is worth its risk of drifting from the shader only when it makes an assertion possible
 * that otherwise would not be: this one lets the selftest state "the centre is untouched and the
 * corner keeps exactly `1 - amount`" without a GPU, which is the property the spec constrains.
 *
 * @param {number} amount
 * @param {number} offsetX - -1..1 across the frame.
 * @param {number} offsetY - -1..1 down the frame.
 */
export function vignetteMultiplier( amount, offsetX, offsetY ) {

    return 1 - amount * ( ( offsetX * offsetX + offsetY * offsetY ) * 0.5 );

}

/**
 * The grain amplitude, in 0..1 display units, that produces a given sigma in 8-bit code values.
 * Mirrors the conversion in `grainNode`.
 */
export function grainAmplitudeFor( sigmaCodes ) {

    return ( sigmaCodes / 255 ) / UNIFORM_NOISE_SIGMA;

}

/**
 * How much grain a pixel at `displayLuma` receives, 0..1, mirroring `grainEnvelope`.
 *
 * Same justification as `vignetteMultiplier`: it buys an assertion that is otherwise unreachable
 * without a GPU — here, that the grain cannot crush the black point, which is a statement about
 * the whole luma range and not about any one constant.
 *
 * @param {number} displayLuma - Display-referred luma. Values outside 0..1 are clamped, matching
 *   the shader's `saturate()`; without that clamp an HDR-ish luma of 2 would ask for -8x grain.
 */
export function grainEnvelopeAt( displayLuma ) {

    const level = Math.min( 1, Math.max( 0, displayLuma ) );

    return 4 * level * ( 1 - level );

}

/**
 * The largest amount the grain can move a pixel at `displayLuma`, in 0..1 display units. The
 * shader's noise is uniform on [-0.5, 0.5] before scaling, so the excursion is half the amplitude.
 *
 * This is the quantity the black point actually depends on, and the invariant is one line:
 * **`grainHalfWidthAt( sigma, L ) < L` for every L > 0**, or the grade crushes shadow pixels to
 * zero and G6 reads a black point the scene never produced.
 */
export function grainHalfWidthAt( sigmaCodes, displayLuma ) {

    return 0.5 * grainAmplitudeFor( sigmaCodes ) * grainEnvelopeAt( displayLuma );

}
