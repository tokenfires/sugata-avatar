/**
 * HairOIT — order-independent transparency for the hair groom. Punch-list 3.6.
 *
 * A groom is 254 cards, every one of them a cut-out ribbon, and at any camera angle a dozen of
 * them overlap the same pixel. `RenderList.js` sorts OBJECTS — `reversePainterSortStable` orders
 * `groupOrder`, then `renderOrder`, then `a.z` (r185, :45–62), and `sort()` is called on the
 * `transparent` array (:393) — so a groom that is ONE `SkinnedMesh` is ONE entry in that array and
 * the cards inside it are drawn in index-buffer order, forever. Alpha-blend them in that order and
 * the result depends on the order rather than on the depth; alpha-TEST them instead and the
 * silhouette is chewed. This file is the third answer.
 *
 * ## 🎯 What was measured, and the verdict it forces
 *
 * Every figure below was measured in the session that wrote this file, on the real groom
 * (`assets/hair/bob01/g050.glb`, 254 cards, 7,224 triangles) through
 * `packages/testbed/src/stage.js?hair=1` on a real WebGPU device. None is copied from `docs/`.
 *
 * The defect is measured as **draw-order dependence**, which is the definition of the thing rather
 * than a proxy for it: the same frame is rendered twice from the same camera with the groom's
 * triangle order REVERSED, and the two plates are differenced. Nothing about the geometry, the
 * camera, the lights or the shading differs — only the sequence fragments arrive in. A method that
 * is order independent returns the same picture. See `?cardorder=reverse`.
 *
 * | arm      | order RMS | worst px | frame >2cv | motion sigma | GPU p50 | GPU p95 |
 * |----------|----------:|---------:|-----------:|-------------:|--------:|--------:|
 * | `blend`  | **17.8682** |  221.3 | **18.961%** |       8.6131 | +2.832  | +3.201  |
 * | `cutout` |    0.0104 |      1.0 |     0.000% |  **13.3460** | +0.730  | +0.790  |
 * | `hash`   |    0.0104 |      1.2 |     0.000% |       9.9667 | +1.549  | +1.775  |
 * | `wboit`  |    0.0829 |     13.8 |     0.003% |   **5.6239** | +3.967  | +4.971  |
 *
 * Order RMS and the worst pixel are 8-bit code values over the whole 560x700 frame, converged 40
 * frames. Motion sigma is the mean per-pixel temporal standard deviation over the hair band across
 * 20 converged frames of a 0.25 deg/frame orbit, Welford-accumulated. GPU columns are milliseconds
 * at **1920x1080** from `?gputime=1`, stated as a DELTA against the identical page with the groom
 * loaded but not added to the scene (`?nohair=1`, 1.805 ms p50 / 2.095 p95), p50/p95 over 100
 * samples after 60 warm-up steps.
 *
 * Read across the rows and the item decides itself.
 *
 * 1. **The defect is real and it is large.** Reversing the draw order moves 18.96% of the frame by
 *    more than 2 code values and one pixel by 221. That is `blend`, and `blend` is what a groom
 *    gets by default from `material.transparent = true`.
 * 2. **All three candidate arms remove it**, by 215x to 1,721x. `cutout` and `hash` are exact — a
 *    depth test does not care what order it is asked in — and `wboit`'s 0.0829 is fp16 addition
 *    being non-associative, on 0.003% of pixels.
 * 3. **`wboit` is the best picture and this project cannot afford it.** It is the most temporally
 *    stable arm by 1.8x over `hash` and 2.4x over `cutout`, and it costs **+4.971 ms of p95 against
 *    a hair budget of roughly 2.6 ms** — 1.9x the whole budget, before punch-list 3.5's Karis BSDF
 *    spends anything. Attributed further: the two attachments plus the resolve pass are only
 *    **+0.761 ms p95** on their own (`?oit=wboit&nohair=1`, 2.856 against 2.095). The other 4.2 ms
 *    is the transparent, depth-write-off draw shading every one of a dozen overlapping cards per
 *    pixel with nothing rejecting them — a cost `blend` pays too (+3.201) and one that gets WORSE
 *    with a more expensive BSDF, not better.
 * 4. **`cutout` is the cheapest and the worst thing that moves.** Its motion sigma is 13.3460, the
 *    highest in the table, 2.4x the accumulation arm. That is punch-list 3.12's finding arriving on
 *    hair: a binary coverage decision on a card silhouette crawls, and a temporal resolve cannot
 *    integrate a decision it was never shown.
 * 5. **`hash` is the answer, and it is `HAIR_OIT_DEFAULT_MODE`.** Order independent to the same
 *    exactness as `cutout`, 1.34x more stable under motion, +1.775 ms of p95 — inside the budget,
 *    and its cost profile IMPROVES with a heavier BSDF because it writes depth and lets the depth
 *    test reject the fragments behind it.
 *
 * ⚠️ **The one thing `hash` does not do is converge.** `getAlphaHashThreshold` seeds from
 * `positionLocal` and screen-space derivatives and takes NO frame index (read at r185), so the
 * dither pattern is fixed in object space. A temporal resolve reprojects it and preserves it rather
 * than averaging it away — the noise is stable, not integrated. Measured as mean |pixel − 3x3 mean|
 * over the hair band on a converged still: `wboit` 0.689, `blend` 0.961, `hash` 1.636, `cutout`
 * 1.938 code values. So `hash` is grainier than the accumulation arm and finer-grained than the
 * cut-out it replaces, and 3.5 should expect visible strand-scale stipple in the interior. Giving
 * the hash a per-frame seed would make it converge and is a one-line change to a three.js internal;
 * it is NOT made here because it would interact with `alive-capture-determinism.selftest.mjs`, and
 * that is a decision for whoever owns the capture contract.
 *
 * ## The four modes, and why each one is in the tree
 *
 *   `blend`   Naive alpha blending in index-buffer order. **This is the defect**, kept as the
 *             control that every other arm is measured against. Not a shipping candidate.
 *   `cutout`  Alpha test at 0.5 — what the groom's own glTF material asks for (`MASK`,
 *             `alphaCutoff` 0.5). Order independent by construction, because a cut-out fragment
 *             either wins the depth test or is not there. Its cost is the silhouette.
 *   `hash`    Wyman & McGuire 2017 hashed alpha testing, which r185 ships as `material.alphaHash`
 *             (`nodes/functions/material/getAlphaHashThreshold.js`, `ALPHA_HASH_SCALE = 0.05`).
 *             Stochastic, order independent, depth-tested, and it hands the integration to the
 *             temporal resolve — which punch-list 3.12 measured as this project's BEST card
 *             antialiaser (TAAU 27.1% hard transitions against alpha-to-coverage's 44.5%).
 *   `wboit`   McGuire & Bavoil weighted-blended OIT, Listing 4 form. Two extra attachments, one
 *             extra full-screen resolve, no sorting, no discard.
 *
 * ## The primary artefact, read in this session and not quoted from a summary
 *
 * Morgan McGuire & Louis Bavoil, *Weighted Blended Order-Independent Transparency*, JCGT Vol. 2
 * No. 2, 2013, <https://jcgt.org/published/0002/02/09/paper.pdf>. sha256
 * `3472477725e1f84e604f0c91e53c03e20b7158a07576aa26f38668189f858c32`, `Author: Morgan McGuire and
 * Louis Bavoil`, `Producer: pdfTeX-1.40.13`. Text extracted with `pdftotext -layout`; equations
 * (7)–(11) are on page 129 and Listings 3 and 4 on page 131.
 *
 * Listing 4 verbatim, and it is Listing 4 rather than Listing 3 for a reason three.js decides for
 * us — see the clear constraint two sections down, and `hairAccumBlendMode()`:
 *
 *     glColorClearValue(0,0,0,1); glClear();
 *     glDepthMask(GL_FALSE); glEnable(GL_BLEND);
 *     glBlendFuncSeparate(GL_ONE, GL_ONE, GL_ZERO, GL_ONE_MINUS_SRC_ALPHA);
 *       gl_FragData[0]   = vec4(Ci * w(zi, ai), ai);
 *       gl_FragData[1].r = ai * w(zi, ai);
 *     // composite
 *     glBlendFunc(GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA);
 *       vec4 accum = texelFetch(ATexture, ivec2(gl_FragCoord.xy), 0);
 *       float r = accum.a;
 *       accum.a = texelFetch(BTexture, ivec2(gl_FragCoord.xy), 0).r;
 *       gl_FragColor = vec4(accum.rgb / clamp(accum.a, 1e-4, 5e4), r);
 *
 * `Ci` is PREMULTIPLIED — page 129: *"Although we use premultiplied coverage, under which
 * low-coverage particles already have a very small color contribution"* — so `Ci = αi·ci` and the
 * quotient is a weighted average of `ci` with weights `αi·w`. Getting that wrong is not visible as
 * a bug; it is visible as hair that is slightly the wrong colour where it is thin.
 *
 * ## 🎯 The constraint that picks the formulation, and the mechanism is NOT the one on file
 *
 * `docs/research/hair.md` §4.3(a) records that `MRTNode.merge()` silently discards per-output blend
 * modes — it assigns the merged table to `mrtTarget.blendings` while `getBlendMode()` reads
 * `this.blendModes` (r185 `MRTNode.js`, and the grep is two hits, both inside that file). That is a
 * real bug and the measurement behind it is real. **But it is not why `accum`/`reveal` cannot live
 * on `material.mrtNode`, and the difference matters to anyone reading this next.**
 *
 * Re-verified against the installed source this session: `WebGPUPipelineUtils.js:132` reads
 * `renderObject.context.mrt`, and `RenderContexts.js:74` fills that field from the argument of
 * `Renderer.setMRT()` (`Renderer.js:1175`, stored as `_mrt`, passed at `:746`, `:911`, `:1589`).
 * The merged material MRT never reaches the pipeline's blend lookup at all. **Per-attachment blend
 * state is a property of the PASS, not of the material, and it applies identically to every draw in
 * that pass.** `merge()` losing the table is therefore invisible today and would stay invisible if
 * it were fixed.
 *
 * That single fact shapes everything below:
 *
 *   - the two OIT attachments are declared on the pass-level MRT (`GBuffer`), with their blend
 *     modes set there;
 *   - every OTHER material in the pass is blended by those same rules into those attachments, so
 *     the pass MRT writes `vec4(0)`/`float(0)` there by default and the arithmetic below shows that
 *     is exactly a no-op;
 *   - the hair material overrides only the VALUES, through `material.mrtNode`, which `merge()`
 *     handles correctly for `outputNodes`.
 *
 * Why an opaque draw writing zeros cannot disturb the buffers, spelled out because it is the whole
 * licence for putting the OIT attachments on the shared pass:
 *
 *     accum.rgb : src·ONE + dst·ONE                  -> dst + 0        unchanged
 *     accum.a   : src.a·ZERO + dst.a·(1 − src.a)     -> dst.a·(1 − 0)  unchanged
 *     weight.r  : src·ONE + dst·ONE                  -> dst + 0        unchanged
 *
 * ## 🎯 And the second constraint, which is three's and not the paper's
 *
 * Only MRT attachment 0 can be cleared to a chosen value. `WebGPUBackend.js` does it twice
 * independently — `_getRenderPassDescriptor` (`let clearValue = { r: 0, g: 0, b: 0, a: 1 }` then
 * `if ( i === 0 && colorAttachmentsConfig.clearValue )`) and the render-pass start (`i === 0` takes
 * `renderContext.clearColorValue`, everything else takes `{ 0, 0, 0, 1 }`) — and the WebGL2
 * fallback matches (`clearBufferfv( gl.COLOR, i, [ 0, 0, 0, 1 ] )` for `i > 0`).
 *
 * Listing 3 needs `revealageTexture` cleared to `float(1)` on attachment 1. three r185 cannot
 * express that. Listing 4 clears BOTH targets to `(0,0,0,1)` — which is precisely three's fixed
 * clear — and packs revealage into `A.a`, whose starting value must be 1 and is. The constraint
 * chooses the formulation and the choice is free.
 *
 * ## 🚩 The weight function had to be re-fitted, and the reason is arithmetic, not taste
 *
 * Equations (7)–(10) are tuned, in the paper's own words, *"to work well for 16-bit floating point
 * accumulation buffers with 0.1 ≤ |z| ≤ 500"*. A groom on a head occupies about 0.3 m, from 0.55 m
 * to 0.85 m in front of the camera at the framing this arm captures at.
 *
 * ⚠️ **Equation (11)'s sign convention is a trap and it was walked into once in this session.**
 * The paper writes `d(z) = ((z_near·z_far)/z − z_far)/(z_near − z_far)` and then, one line later,
 * *"where all z values are negative in camera space"* — which applies to `z_near` and `z_far` as
 * well as to `z`. Feed it POSITIVE near and far, as every graphics API states them, and `d` comes
 * back outside 0..1 (2.005 at the near plane for `n = 0.05, f = 20`), the cubic goes negative, and
 * the weight pins at the `1e-2` floor everywhere. `clipDepthValue` below negates all three, and the
 * gate asserts `d(near) = 0` and `d(far) = 1` so nobody can undo that quietly. A first draft of this
 * header stated the published curve was "clamped flat over a head", which is what the WRONG sign
 * produces. It is not, and the corrected numbers are below.
 *
 * `w/α` from equation (10), recomputed this session across the groom's own 0.55–0.85 m slab:
 *
 *     | near | far | front (0.55 m) | back (0.85 m) | ratio  | back at the clamp floor |
 *     |------|-----|----------------|---------------|--------|-------------------------|
 *     | 0.05 |  20 |      2.08869   |    0.54007    | 3.867x | no                      |
 *     | 0.05 | 100 |      2.22029   |    0.59608    | 3.725x | no                      |
 *     | 0.10 |  12 |     16.06234   |    4.01835    | 3.997x | no                      |
 *     | 0.01 | 100 |      0.01774   |    0.01000    | 1.774x | **yes**                 |
 *
 * Two things follow, and neither is the thing the first draft said.
 *
 * 1. The published curve gives a groom **3.7x–4.0x** of front-to-back discrimination, and the
 *    ABSOLUTE weight swings 30x between frustums that differ only in their near plane. A weight
 *    function whose behaviour is set by the near plane is a weight function nobody can tune: move
 *    the camera's near from 0.05 to 0.01 — a change with no visual meaning — and the back of the
 *    groom lands ON the clamp floor and the discrimination collapses to 1.774x.
 * 2. 3.7x is not enough separation for a groom that stacks ten to fifty cards. The measured
 *    operating point is `HAIR_WEIGHT_RANGE`, and it is an order of magnitude above that.
 *
 * The paper anticipates exactly this case and says what to do, page 132: *"For the specific cases
 * of particle systems and hair … Because the depth extent of the individual system is small and
 * known, in this case one can tune a very effective depth weighting function."* So the weight is
 * fitted to the GROOM'S OWN SLAB rather than to the camera frustum: `t` is the fragment's position
 * between the near and far faces of the hair's view-space bounding depth, and the curve spans
 * `HAIR_WEIGHT_RANGE` across it. The shape stays the paper's cubic and the clamps stay the paper's
 * clamps, because those exist to stop 16-bit underflow and overflow and that hazard is unchanged.
 * What the re-fit buys is that the ratio is a number an author sets, and the near plane cannot
 * reach it.
 *
 * ## What this does NOT do, and why, so nobody re-derives it
 *
 * **Tile-binned / per-pixel-linked-list OIT is not built, and the measurements say it would not
 * help.** Punch-list 3.6 says "tile-binned on WebGPU" and that entry is a plan, not a contract.
 * Two independent reasons, and the second is the one that matters.
 *
 * The first is that there is nothing to build it on. `WGSLNodeBuilder.js:1681` defines
 * `enableDualSourceBlending()` and `WebGPUConstants.js:345` defines the feature string, and NOTHING
 * IN three CALLS EITHER — grep returns those two lines only — so `@blend_src(1)` is unreachable;
 * and there is no OIT node, no depth-peel node and no fragment-stage storage-buffer material path
 * to hang a per-pixel bin on. Building one means writing a parallel renderer.
 *
 * The second is arithmetic on the table above. **The cost of the accumulation arm is not the
 * accumulation.** Attaching the two buffers and running the resolve is +0.761 ms of p95; drawing the
 * groom through them is +4.210 ms more, and that is a transparent depth-write-off pass shading every
 * overlapping card because nothing rejects it. A tile-binned method pays that identical overdraw and
 * then adds binning, sorting and a resolve on top. It cannot be cheaper than the thing that is
 * already 1.9x over budget. That is the finding, and it is why the recommendation is a method with
 * NO buffer at all.
 *
 * **Per-card depth sorting is not built either, and it is not for the reason on file.** The reason
 * usually given is "three sorts objects" — true, and beside the point, because a groom is one mesh
 * and its 254 cards could be re-sorted inside its own index buffer on the CPU each frame. The real
 * reasons are that it is a 43 KB index upload per frame in the middle of a 16.6 ms budget, that it
 * is still WRONG wherever two cards interpenetrate (which is most of a groom), and that it cannot
 * be made to work on a skinned mesh without re-transforming every card centroid on the CPU after
 * the skeleton has moved. It survives here only as the gate's REFERENCE arm, where being expensive
 * does not matter.
 */

// `BlendMode` comes from `three/webgpu` and NOT from `three/src/renderers/common/BlendMode.js`,
// even though the latter resolves: the `./src/*` export is a second copy of the module graph, and a
// `BlendMode` built there would be paired with a second set of blend-factor constants. Same names,
// different objects, and the symptom would be a pipeline silently taking the default blend.
import {
    AddEquation,
    BlendMode,
    CustomBlending,
    HalfFloatType,
    NearestFilter,
    NoColorSpace,
    NormalBlending,
    OneFactor,
    OneMinusSrcAlphaFactor,
    RedFormat,
    ZeroFactor
} from 'three/webgpu';

import { float, mix, mrt, output, positionView, rtt, uniform, vec3, vec4 } from 'three/tsl';

/**
 * The four ways a hair card can reach the frame buffer. `blend` is the defect and is only ever the
 * control arm; the other three are all order independent, by three different mechanisms.
 */
export const HAIR_OIT_MODES = [ 'blend', 'cutout', 'hash', 'wboit' ];

/**
 * The mode a groom should ship in, and it is a measurement rather than a preference: order
 * independent to 0.0104 code values, 1.34x more temporally stable than the cut-out it replaces, and
 * +1.775 ms of p95 against a hair budget of roughly 2.6 — the only arm in the header's table that
 * is both correct and affordable. `wboit` wins on picture and loses on cost by 1.9x.
 */
export const HAIR_OIT_DEFAULT_MODE = 'hash';

/**
 * 🚩 **THE CONSTRAINT THAT ALMOST KILLED THIS ARM, FOUND BY EXECUTION AND NOT BY READING.**
 *
 * WebGPU caps the total bytes-per-sample across a render pass's colour attachments, and the
 * GUARANTEED value of `maxColorAttachmentBytesPerSample` is **32**. Sugata's five-attachment
 * G-buffer already spends most of it; adding `hairAccum` and `hairWeight` takes the pass over.
 * Measured, verbatim, from Chrome's own validation message on the first run of the `wboit` arm:
 *
 *     Total color attachment bytes per sample (40) exceeds maximum (32) with formats
 *     ([ RGBA16Float RGBA8Unorm RGBA16Float RG16Float R8Unorm RGBA16Float R16Float ]).
 *     This adapter supports a higher maxColorAttachmentBytesPerSample of 128.
 *
 * Every pipeline in the pass then fails to create — the failure is per-material and names the
 * MATERIAL, so the console fills with `Render pipeline creation failed (renderPipeline_Human.body)`
 * and points at the figure rather than at the attachment set that caused it.
 *
 * The repair is a device limit, requested at `requestDevice` time and therefore at `Stage.create`
 * time: three r185 passes `parameters.requiredLimits` straight through (`WebGPUBackend.js:93`,
 * `:243`), so no patch is needed. `Stage` asks for the ADAPTER'S OWN maximum rather than for a
 * number typed here — requesting exactly what the adapter reports always succeeds, and a constant
 * would be a guess about hardware this project has never run on.
 *
 * ⚠️ **This is a portability floor, not a detail.** An adapter that reports the spec minimum of 32
 * cannot run the `wboit` arm at all, whatever the code does. `Stage` reads the limit before it
 * builds the renderer and refuses with a message that says so, rather than letting a viewer meet it
 * as an unexplained black frame. It is one more reason the measured recommendation in
 * `HairOIT.selftest.mjs` matters: the arm that wins there needs no attachments and no limit.
 */
export const HAIR_OIT_MINIMUM_ATTACHMENT_BYTES = 40;

/**
 * The two attachments `wboit` adds to the G-buffer, in the form `GBuffer` consumes.
 *
 * `hairAccum` is RGBA16F because it holds a premultiplied HDR colour SUM and the paper's clamps are
 * stated against 16-bit float. `hairWeight` is R16F because it holds one scalar sum. Both are
 * point-sampled: the resolve reads them at exactly its own pixel, and a filtered read across a
 * silhouette would average an accumulated colour against an empty one.
 *
 * 10 bytes per pixel, and they are only allocated when the mode is `wboit` — the other three modes
 * pay nothing at all for the machinery they do not use.
 */
export const HAIR_OIT_CHANNELS = [
    {
        name: 'hairAccum',
        format: null,               // inherit RGBA
        type: HalfFloatType,
        filter: NearestFilter,
        colorSpace: NoColorSpace,
        description: 'Σ premultiplied colour · w in rgb, Π(1 − α) revealage in a (RGBA16F)'
    },
    {
        name: 'hairWeight',
        format: RedFormat,
        type: HalfFloatType,
        filter: NearestFilter,
        colorSpace: NoColorSpace,
        description: 'Σ α · w — the divisor of the weighted average (R16F)'
    }
];

/**
 * Listing 4's `glBlendFuncSeparate(GL_ONE, GL_ONE, GL_ZERO, GL_ONE_MINUS_SRC_ALPHA)` for the
 * accumulation target: RGB accumulates additively, and the ALPHA channel multiplies down by
 * `(1 − α)` per fragment, which turns three's fixed `a = 1` clear into the revealage product.
 *
 * Built fresh per call rather than shared, because a `BlendMode` is stored by reference on the MRT
 * node and a caller that mutated a shared one would change every pass that had ever asked for it.
 */
export function hairAccumBlendMode() {

    const blend = new BlendMode( CustomBlending );

    blend.blendSrc = OneFactor;
    blend.blendDst = OneFactor;
    blend.blendEquation = AddEquation;

    blend.blendSrcAlpha = ZeroFactor;
    blend.blendDstAlpha = OneMinusSrcAlphaFactor;
    blend.blendEquationAlpha = AddEquation;

    return blend;

}

/** Listing 4's weight target: pure additive, `GL_ONE, GL_ONE`, no separate alpha. */
export function hairWeightBlendMode() {

    const blend = new BlendMode( CustomBlending );

    blend.blendSrc = OneFactor;
    blend.blendDst = OneFactor;
    blend.blendEquation = AddEquation;

    return blend;

}

// --- the weight function -------------------------------------------------------------------------

/**
 * The paper's clamps, page 129. They are not tuning: *"Without the range clamping in these
 * functions, underflow will result in overly-dark areas where α is small and |z| is large. Overflow
 * will result in infinity (which renders as black on most GPUs) where |z| is small."*
 */
export const HAIR_WEIGHT_FLOOR = 1e-2;
export const HAIR_WEIGHT_CEILING = 3e3;

/**
 * How much more a fragment at the FRONT of the groom's depth slab is worth than one at the back.
 *
 * This is 3.6's one free parameter, and it is nominally the whole difference between "weighted" and
 * "blended": at 1 the method degenerates to a coverage-weighted average with no occlusion cue at
 * all, and very large values should collapse towards a one-layer depth peel.
 *
 * 🚩 **MEASURED, AND IT BARELY MATTERS ON A GROOM. Do not spend a round tuning it.** Swept on the
 * real groom at the arm's fixed azimuth, converged 40 frames, 560x700, whole-frame RMS in code
 * values against the previous row and against the `cutout` arm:
 *
 *     | range | hair high-pass | band median | vs the row above | vs cutout |
 *     |-------|---------------:|------------:|-----------------:|----------:|
 *     |     1 |          0.668 |       47.40 |                — |    15.015 |
 *     |     4 |          0.678 |       48.19 |            0.640 |    14.890 |
 *     |    16 |          0.686 |       48.97 |            0.507 |    14.830 |
 *     |    64 |          0.689 |       49.11 |            0.232 |    14.813 |
 *     |   256 |          0.690 |       49.16 |            0.100 |    14.810 |
 *     |  3000 |          0.690 |       49.19 |            0.058 |    14.809 |
 *
 * Three thousand times the discrimination, end to end, moves the frame by about 1.5 code values in
 * total, and past 64 every further quadrupling moves it by less than a quarter of one — below what
 * an 8-bit plate can carry. The mechanism is that the sums are dominated by `α²` (α enters once
 * through the premultiplied colour and once through `w`), and a groom's coverage varies far more
 * between cards than its depth does across a 0.3 m slab.
 *
 * So `64` is chosen as the knee — the point past which the picture stops changing — and the honest
 * reading of the table is that the "weighted" half of weighted-blended OIT contributes almost
 * nothing here. What the arm actually buys is smooth accumulation, which is real (it is the most
 * temporally stable row in the header's table) and which is not what the depth weight is for.
 *
 * ⚠️ **There is no ground-truth reference in this repository and this parameter has NOT been solved
 * against one**, the way `SCLERA_BRIGHTNESS` was solved against a measured plate. The right
 * reference would be a per-card depth-sorted render of the same frame — expensive, still wrong
 * wherever two cards interpenetrate, and worth building only if somebody wants to defend a
 * different value. The `vs cutout` column is a distance from a DIFFERENT approximation, not an
 * error.
 */
export const HAIR_WEIGHT_RANGE = 64;

/**
 * The weight `w(z, α)`, in the paper's shape and on the groom's own depth slab.
 *
 * A CPU MIRROR of the TSL in `configureHairMaterial`, following the `...Value` convention `GTAO.js`
 * uses for the same reason: a closed form that only exists inside a shader is a closed form nobody
 * can assert anything about. The two must be read side by side when either changes — the gate
 * checks this one, and only the shape of the picture checks the other.
 *
 * ⚠️ `α` is INSIDE the weight, as it is in equations (7)–(10) — `w(z,α) = α · max(...)`. The
 * accumulation then writes `Ci·w` with a premultiplied `Ci` and `αi·w`, so both sums carry `α²` and
 * the quotient is a weighted average of the unpremultiplied colour. Hoisting `α` out of here to
 * "simplify" changes the picture and is the most plausible-looking way to get this wrong.
 *
 * @param {number} slabT - Where the fragment sits between the near and far faces of the groom's
 *   view-space depth extent: 0 at the front, 1 at the back. Values outside 0..1 are clamped, which
 *   is what a flyaway in front of the bounding slab needs.
 * @param {number} alpha - Coverage after the strand texture, 0..1.
 * @param {number} [range=HAIR_WEIGHT_RANGE]
 * @returns {number}
 */
export function hairWeightValue( slabT, alpha, range = HAIR_WEIGHT_RANGE ) {

    const t = Math.min( 1, Math.max( 0, slabT ) );

    // The paper's cubic, re-based on the slab. At t = 0 this is `range`, at t = 1 it is 1, and the
    // exponent is the paper's — evaluated as repeated products exactly as page 129 recommends.
    const falloff = ( 1 - t ) * ( 1 - t ) * ( 1 - t );
    const curve = 1 + ( range - 1 ) * falloff;

    return alpha * Math.min( HAIR_WEIGHT_CEILING, Math.max( HAIR_WEIGHT_FLOOR, curve ) );

}

/**
 * Equation (11), page 129: the value a perspective projection leaves in `gl_FragCoord.z`.
 *
 * ⚠️ **All three arguments are negated, and that is the paper's convention and not a liberty.**
 * Page 129 says *"where all z values are negative in camera space"* immediately after the equation,
 * and `z_near`/`z_far` are z values. Passed as the positive numbers every API states them in, the
 * formula returns 2.005 at the near plane instead of 0. The caller gives positive metres, this
 * negates them, and `HairOIT.selftest.mjs` asserts the two fixed points — `d(near) = 0` and
 * `d(far) = 1` — so a future simplification cannot quietly drop the negation.
 *
 * Present so the header's table can be checked by execution rather than believed: the re-fit below
 * is justified by what this function returns over a groom, and if the published curve ever turns
 * out to be good enough there, the re-fit is unnecessary and the gate should say so.
 *
 * @param {number} viewDepth - Distance in front of the camera, positive metres.
 * @param {number} near - Positive metres.
 * @param {number} far - Positive metres.
 */
export function clipDepthValue( viewDepth, near, far ) {

    const z = - Math.abs( viewDepth );
    const zNear = - Math.abs( near );
    const zFar = - Math.abs( far );

    return ( ( zNear * zFar ) / z - zFar ) / ( zNear - zFar );

}

/** Equation (10) exactly as published, for the degeneracy check. Not used by the shader. */
export function publishedWeightValue( viewDepth, alpha, near, far ) {

    const d = clipDepthValue( viewDepth, near, far );
    const falloff = ( 1 - d ) * ( 1 - d ) * ( 1 - d );

    return alpha * Math.max( HAIR_WEIGHT_FLOOR, HAIR_WEIGHT_CEILING * falloff );

}

// --- the material side ------------------------------------------------------------------------

/**
 * Puts one hair material into one of the four modes.
 *
 * This is the seam punch-list 3.5 attaches to: `material/HairMaterial.js` builds the Karis BSDF and
 * hands the finished material here, and this file decides how its fragments reach the frame buffer.
 * Nothing about the BSDF is visible from this side — the accumulation reads `output`, which is
 * whatever the material computed, so a change to the shading never needs a change here.
 *
 * ⚠️ **`forceSinglePass` is set on every transparent arm and it is worth 2× the draw calls.**
 * `Renderer.js:3620` draws a `transparent && DoubleSide` object twice, back faces then front faces,
 * unless the material opts out. `Material.js:418–430` documents the exemption and names our exact
 * case — *"when rendering flat vegetation like grass sprites"*. A hair card is a grass sprite.
 *
 * @param {NodeMaterial} material - Mutated in place and returned, for chaining.
 * @param {'blend'|'cutout'|'hash'|'wboit'} mode
 * @param {Object} [options]
 * @param {number} [options.alphaTest=0.5] - Used by `cutout`. The groom's own glTF says 0.5.
 * @param {boolean} [options.alphaToCoverage=false] - The caller's MSAA decision, carried through
 *   rather than decided here. Inert without MSAA, and MSAA is not the shipped path.
 * @param {?{ near: Node, far: Node, range: Node }} [options.slab] - The uniforms from
 *   `createHairOIT()`. Required for `wboit`, ignored otherwise.
 * @param {?'material-blend'} [options.defect=null] - 🚩 **The red proof, and it is a defect on
 *   purpose.** `material-blend` sets the two OIT blend modes on `material.mrtNode` — the placement
 *   that looks correct, that a reader who has only seen `docs/research/hair.md` §4.3(a) would
 *   expect to work once `MRTNode.merge()` is fixed, and that CANNOT work because
 *   `WebGPUPipelineUtils.js:132` never reads a material MRT. `GBuffer` must be built with the
 *   matching `hairOITDefect` so the pass stops setting them, or the two would both be live and the
 *   proof would prove nothing. With the defect the accumulation attachments get NO blending at all,
 *   the sums become last-write-wins, and the `wboit` arm goes back to being order dependent — which
 *   is exactly what `HairOIT.selftest.mjs` requires it to do.
 * @returns {NodeMaterial}
 */
export function configureHairMaterial( material, mode, options = {} ) {

    if ( HAIR_OIT_MODES.includes( mode ) === false ) {

        throw new Error( `HairOIT: mode must be one of ${ HAIR_OIT_MODES.join( ', ' ) }, not '${ mode }'.` );

    }

    // Cleared first so a material can be moved between modes at runtime — the A/B toggle does
    // exactly that — without carrying a flag from the arm it came from. A leftover `alphaHash` on
    // the `blend` arm would make the control arm partly stochastic and the comparison meaningless.
    material.transparent = false;
    material.depthWrite = true;
    material.alphaTest = 0;
    material.alphaHash = false;
    material.mrtNode = null;

    // Carried through rather than forced, because it is the CALLER's MSAA decision and not this
    // file's — `material/HairMaterial.js` sets it from its own `multisampled` option. It is
    // defaulted OFF because the hardware half needs MSAA (`WebGPUPipelineUtils.js`:
    // `alphaToCoverage && sampleCount > 1`), MSAA is mutually exclusive with the temporal resolve,
    // and 3.12 measured the temporal resolve as the better card antialiaser of the two anyway —
    // 27.1% of silhouette transitions jumping in one pixel against alpha-to-coverage's 44.5%.
    // The `smoothstep( αT, αT + fwidth(α), α )` half at `NodeMaterial.js:877` is free of MSAA and
    // is worth keeping on the `cutout` arm on its own merits.
    material.alphaToCoverage = options.alphaToCoverage === true;
    material.forceSinglePass = true;

    // Written explicitly. Leaving it `undefined` to "let three use its default" makes
    // `WebGPUPipelineUtils._getBlending` fall off the end of its switch and log
    // `THREE.WebGPURenderer: Invalid blending: undefined` once, after which the pipeline is built
    // with no blend at all — a transparent arm that draws opaque. Measured on the first run.
    material.blending = NormalBlending;

    if ( mode === 'cutout' ) {

        // Opaque bucket, depth written, discard below the cutoff. Order independent because the
        // depth test decides, and the whole cost is that the decision is binary.
        material.alphaTest = options.alphaTest ?? 0.5;
        material.needsUpdate = true;
        return material;

    }

    if ( mode === 'hash' ) {

        // Wyman & McGuire 2017, three's own implementation. Still the opaque bucket with depth
        // written — that is what makes it order independent, and it is why the noise has to be
        // integrated by something downstream rather than resolved here.
        //
        // ⚠️ `getAlphaHashThreshold` seeds from `positionLocal`, and `Skinning.js:171` assigns the
        // SKINNED position into `positionLocal`, so on a skinned groom the hash seed moves with the
        // head. Whether that decorrelates helpfully for the temporal resolve or crawls is exactly
        // what `HairOIT.selftest.mjs` measures rather than argues.
        material.alphaHash = true;
        material.needsUpdate = true;
        return material;

    }

    // Both remaining arms are transparent draws with depth writes off, so they see the opaque
    // depth and never occlude each other.
    material.transparent = true;
    material.depthWrite = false;

    if ( mode === 'blend' ) {

        material.needsUpdate = true;
        return material;

    }

    if ( options.slab === undefined || options.slab === null ) {

        throw new Error( 'HairOIT: the wboit mode needs the slab uniforms from createHairOIT().' );

    }

    const { near, far, range } = options.slab;

    // Where this fragment sits inside the groom's own depth extent. `positionView.z` is negative in
    // front of the camera, so its negation is the distance the slab is expressed in.
    const viewDepth = positionView.z.negate();
    const slabT = viewDepth.sub( near ).div( far.sub( near ).max( 1e-4 ) ).clamp( 0, 1 );

    const falloff = slabT.oneMinus();
    const curve = float( 1 ).add( range.sub( 1 ).mul( falloff ).mul( falloff ).mul( falloff ) );
    const weightCurve = curve.clamp( HAIR_WEIGHT_FLOOR, HAIR_WEIGHT_CEILING );

    // `output` is the material's finished fragment — the Karis BSDF's answer once 3.5 lands, and
    // whatever placeholder is in front of it until then.
    const shaded = output;
    const alpha = shaded.a.clamp( 0, 1 );
    const weight = alpha.mul( weightCurve );

    const materialMRT = mrt( {

        // The one channel hair must NOT touch. Under the material's own `NormalBlending` a source
        // of `vec4(0)` leaves the destination exactly where it was — `src·srcAlpha + dst·(1 − 0)`
        // — so the opaque image survives untouched and the resolve is the only thing that writes
        // hair into it. Omitting this line instead would let the material's real colour through
        // AND accumulate it, i.e. draw the hair twice.
        output: vec4( 0 ),

        // Listing 4. `Ci` is premultiplied, hence the extra `alpha`.
        hairAccum: vec4( shaded.rgb.mul( alpha ).mul( weight ), alpha ),
        hairWeight: alpha.mul( weight )

    } );

    if ( options.defect === 'material-blend' ) {

        materialMRT
            .setBlendMode( 'hairAccum', hairAccumBlendMode() )
            .setBlendMode( 'hairWeight', hairWeightBlendMode() );

    }

    material.mrtNode = materialMRT;
    material.needsUpdate = true;

    return material;

}

// --- the resolve ---------------------------------------------------------------------------------

/**
 * Builds the OIT resolve and the uniforms the hair material needs.
 *
 * ## Where the resolve sits, and why it is an `rtt` rather than a node in the composite
 *
 * The resolve has to land BEFORE the temporal resolve. Punch-list 3.12 measured that the temporal
 * resolve is this project's best card antialiaser, and hair is the most aliasing-prone geometry in
 * the repository; compositing it after TRAA/TAAU would hand the judge an aliased groom over an
 * antialiased face.
 *
 * But `TAAUNode`/`TRAANode` are constructed as `taau( convertToTexture( beauty ), … )`
 * (`TAAUNode.js:835`), and `convertToTexture` does not recognise a computed node — it falls through
 * to `rtt( node )` at the DRAWING BUFFER's size, which is wrong for TAAU twice over: it costs a
 * full-resolution pass (`TRAAPost.js` measures 5.62 ms for exactly that mistake) and it hands TAAU
 * an input whose size disagrees with the depth and velocity attachments it reads beside it.
 *
 * So the resolve is an explicit `rtt` at the SCENE PASS's resolution scale. `RTTNode` sets
 * `isRTTNode`, which is the branch `TAAUNode.js:398` and `:512` take to find the input size, so the
 * node reports the same dimensions the scene pass rendered at. One full-screen pass at
 * `resolutionScale²` of the drawing buffer, sampling three textures and writing one.
 *
 * @param {Object} options
 * @param {GBuffer} options.gbuffer - Must have been built with `{ hairOIT: true }`.
 * @param {number} [options.resolutionScale=1] - The scene pass's scale, so the resolve matches it.
 * @param {number} [options.weightRange=HAIR_WEIGHT_RANGE]
 * @returns {{ beautyNode: Node, slab: Object, setSlab: function(number, number): void,
 *   setWeightRange: function(number): void, setResolutionScale: function(number): void,
 *   dispose: function(): void }}
 */
export function createHairOIT( { gbuffer, resolutionScale = 1, weightRange = HAIR_WEIGHT_RANGE } ) {

    if ( gbuffer.hasHairOIT !== true ) {

        throw new Error( 'HairOIT: createHairOIT() needs a GBuffer built with { hairOIT: true } — ' +
            'the two attachments and their blend modes are pass state and cannot be added later.' );

    }

    // Defaults that are deliberately WIDE rather than plausible. A slab narrower than the groom
    // clamps every fragment behind its far face to t = 1 and quietly turns the weighting off for
    // them; a slab that is too wide only flattens the curve. `setSlab` is called every frame from
    // the groom's own bounds, and these values are what a caller who forgets sees.
    const near = uniform( 0.1 );
    const far = uniform( 10 );
    const range = uniform( weightRange );

    const accum = gbuffer.node( 'hairAccum' );
    const weight = gbuffer.node( 'hairWeight' );
    const scene = gbuffer.node( 'output' );

    // Listing 4's composite, in order: the revealage rides in the accumulation buffer's alpha, and
    // the divisor comes from the second target. The clamp is the paper's, and it is what stops a
    // pixel with one nearly-invisible fragment from dividing by something close to zero.
    const revealage = accum.a;
    const hairColour = accum.rgb.div( weight.r.clamp( 1e-4, 5e4 ) );

    // `glBlendFunc(GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA)` with `gl_FragColor = vec4(C, r)` is
    // `dst = C·(1 − r) + dst·r`, which is a mix towards the scene by the revealage. Written as a
    // mix rather than as a blend state because this is a full-screen resolve into a fresh target,
    // not a blended draw over the scene.
    const composited = mix( vec3( hairColour ), scene.rgb, revealage );

    const beautyNode = rtt( vec4( composited, scene.a ) );
    beautyNode.setResolutionScale( resolutionScale );

    return {

        beautyNode,

        /** Handed to `configureHairMaterial`, so the shader and the resolve share one slab. */
        slab: { near, far, range },

        /**
         * The groom's view-space depth extent this frame, in metres in front of the camera.
         *
         * Called per frame from the caller's own bounds rather than derived here, because this
         * module has no scene graph and a groom on a moving head changes its slab every frame.
         */
        setSlab( nearMetres, farMetres ) {

            near.value = nearMetres;
            far.value = Math.max( farMetres, nearMetres + 1e-4 );

        },

        setWeightRange( value ) {

            range.value = value;

        },

        setResolutionScale( scale ) {

            beautyNode.setResolutionScale( scale );

        },

        dispose() {

            beautyNode.renderTarget?.dispose();

        }

    };

}

/**
 * The view-space depth extent of an object, for `setSlab`.
 *
 * Computed from the eight corners of the world-space bounding box rather than from the box's own
 * min/max z, because a box that is axis-aligned in WORLD space is not axis-aligned in VIEW space
 * and taking its z extent directly under-reports the slab whenever the camera is off-axis — which
 * is every frame of an orbit, which is the clip this item is gated on.
 *
 * @param {Box3} worldBounds
 * @param {Camera} camera - `matrixWorldInverse` must be current.
 * @param {Vector3} scratch - Reused so the frame loop allocates nothing.
 * @returns {{ near: number, far: number }} Positive distances in front of the camera.
 */
export function viewDepthExtent( worldBounds, camera, scratch ) {

    let near = Infinity;
    let far = - Infinity;

    for ( let corner = 0; corner < 8; corner ++ ) {

        scratch.set(
            ( corner & 1 ) === 0 ? worldBounds.min.x : worldBounds.max.x,
            ( corner & 2 ) === 0 ? worldBounds.min.y : worldBounds.max.y,
            ( corner & 4 ) === 0 ? worldBounds.min.z : worldBounds.max.z
        );

        scratch.applyMatrix4( camera.matrixWorldInverse );

        const depth = - scratch.z;

        if ( depth < near ) near = depth;
        if ( depth > far ) far = depth;

    }

    return { near: Math.max( near, 1e-4 ), far: Math.max( far, 1e-3 ) };

}
