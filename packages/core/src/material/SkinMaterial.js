/**
 * SkinMaterial — punch-list 3.2. Pre-integrated subsurface scattering, a baked curvature map, a
 * second specular lobe, and a tiled micro-normal, on top of three's physical lighting model.
 *
 * ## The one thing that makes skin read as skin
 *
 * `docs/research/stellar-blade-look-spec.md` §2 measures it on the reference and §6 turns it into
 * a gate: **saturation RISES into shadow and the hue shifts red** — 0.15 lit → 0.23–0.26 shadow →
 * 0.41 where light transmits through an ear. Diffuse-only skin does the opposite: it desaturates
 * toward grey as N·L falls. Nothing else in a skin shader is worth as much.
 *
 * Red does that because skin's diffusion profile is several times wider in red than in green or
 * blue, so red light keeps arriving at shading points the other two have already given up on.
 * `PreintegratedSkinLut.js` holds the profile, the integral and the reasoning; this file is the
 * part that runs on the GPU.
 *
 * ## Where it hooks in
 *
 * `MeshPhysicalNodeMaterial.setupLightingModel()` returns a `PhysicalLightingModel` whose `direct`
 * and `directRectArea` are the only two places a light's diffuse response is computed. Overriding
 * those two replaces `BRDF_Lambert` with the table lookup and leaves absolutely everything else —
 * specular, energy compensation, IBL, tone mapping, the MRT — exactly as three wrote it.
 *
 * 🚩 **`direct()` alone is not enough, and this is the trap worth naming.** Sugata's lighting rig
 * is four `RectAreaLight`s (`alive.js`, and the measured 3.604 ms budget in `docs/PROGRESS.md`),
 * and a rect-area light never reaches `direct()`. It goes through `directRectArea()` and the
 * linearly-transformed-cosine path instead. A skin shader that overrides only `direct()` compiles,
 * renders, and does *nothing at all* under this project's own lighting.
 *
 * ## Two light types, two levels of honesty
 *
 * **Punctual lights are exact.** There is a single N·L, so `saturate(N·L)·albedo/π` is replaced
 * outright by `LUT(N·L, ringCurvature)·albedo/π`. Light wraps past the terminator because the
 * table says it does, including where N·L is negative and Lambert is zero.
 *
 * **Area lights are an approximation, and it is a documented one.** `LTC_Evaluate` returns a
 * solid-angle-weighted cosine integral over the light's polygon; there is no single N·L to look up
 * and no way to re-run the LTC integral per channel without three LTC evaluations per light. So
 * the base model's diffuse is computed as usual and multiplied by the per-channel *gain* the table
 * implies at the direction of the light's centre:
 *
 *     gain = ( LUT(N·L_centre, ringCurvature) + ε ) / ( saturate(N·L_centre) + ε )
 *
 * 🚩 **The ε is on BOTH sides, and that is the whole design of this expression.** The obvious form
 * — divide by `max(saturate(N·L), floor)` — was written first and was wrong in a way that produced
 * a plausible picture: at zero curvature the table returns exactly `saturate(N·L)`, so the gain
 * MUST be exactly 1 and the material MUST be bit-identical to stock diffuse. A one-sided floor
 * breaks that identity everywhere `N·L < floor`, which is precisely the terminator band the whole
 * item is about. Measured with a floor of 1/6: the diffuse response over the entire near-terminator
 * region was multiplied by 0.023 instead of 1, darkening the turning band in BOTH plates of the
 * A/B pair equally — so the difference image stayed clean and the defect was invisible in it.
 * With ε on both sides the zero-curvature identity holds algebraically for any ε.
 *
 * ε is a numerical floor on a ratio, not a model of anything. It sets how much brightening the
 * terminator gets where Lambert has bottomed out.
 *
 * Past the terminator LTC clips the polygon to the horizon and eventually returns zero, so the
 * product is zero — the area-light path does **not** reproduce the wrap into negative N·L that the
 * punctual path does. That is the approximation's real cost, stated rather than hidden.
 *
 * ## Dual-lobe specular rides on `clearcoat`, deliberately
 *
 * Skin's highlight is two lobes: a broad soft one from the dermis and a tight one from the oil
 * layer. The look spec's implementable block asks for exactly that and names the mechanism —
 * `clearcoat 0.06 – 0.12`, `clearcoatRoughness 0.22 – 0.30`, with the comment "dual-lobe
 * approximation". Taking it at its word is also the only form that works here: three already
 * evaluates clearcoat through **both** light paths, and for a rect-area light that means a second,
 * genuine LTC evaluation at the second roughness. A hand-rolled second `BRDF_GGX` would only ever
 * fire on punctual lights, i.e. never, for the reason two paragraphs up. The one deviation from a
 * true dual lobe is that a coat also attenuates what is under it by `1 − clearcoat·F`, which at a
 * weight of 0.09 costs a few percent of the base response.
 *
 * ## What this material deliberately does NOT do
 *
 * PUNCHLIST's standing constraints, all four measured on the reference and all four
 * counter-intuitive: **no facial asymmetry, no blemish noise, no pore detail, no white sclera.**
 * The micro-normal here is band-limited noise sized to the spec's own high-pass σ target and
 * contains no pore structure (`SkinMicroNormal.js` says so at more length). Nothing in this file
 * touches albedo chroma, and the sclera is a different mesh and a different punch-list item.
 *
 * It also does not do transmission. The glowing ear (`#755052` at saturation 0.41) needs a baked
 * thickness map and a back-lit term; that is a separate piece of work and pretending a
 * pre-integrated wrap covers it would be the §1.11a mistake — a real technique credited with a
 * result it does not produce.
 *
 * ## 🎯 What the subsurface half is measured to be worth, which is almost nothing
 *
 * This is the most important paragraph in the file and it is not the one anyone expects.
 *
 * Measured on `packages/testbed/src/skin.html` at 3840 x 2160 with the head at 57.4% of frame
 * height, comparing the SSS-off plate against the SSS-on plate pixel for pixel over 1,824,098 skin
 * pixels, with the shipped scatter distance of 1.25 mm:
 *
 *     pixels changed by more than one code value        0.00 %
 *     mean |Δ luma|                                     0.00000
 *     max  |Δ luma|                                     0.01148   (2.9 code values, at one pixel)
 *
 * That is not a bug and it is not a wiring failure — the same measurement at larger scatter
 * distances rises smoothly and exactly where it should, so the plumbing is provably live:
 *
 *     scatter    pixels changed   mean |Δ luma|   mean Δ(R/B)
 *      1.25 mm        0.00 %        0.00000        -0.00001
 *      3    mm        1.25 %        0.00021        +0.00064
 *      6    mm        2.83 %        0.00071        +0.00144
 *     12    mm        5.46 %        0.00187        +0.00251
 *     25    mm        9.29 %        0.00422        +0.00305
 *     50    mm       13.64 %        0.00755        +0.00181
 *
 * The reason is arithmetic, and both halves of it are measured rather than assumed. The table's
 * only input is `scatterDistance x curvature`, and `tools/lut-bake/` measures this head's MEDIAN
 * mean curvature at **0.00455 /mm** — a 220 mm radius of curvature, because a forehead is closer to
 * a cylinder than to a sphere and a cylinder's mean curvature is half its section's. 1.25 x 0.00455
 * is a ring curvature of 0.006, and the table is Lambert to four decimal places there. The
 * separation only opens up past ring curvature ~0.1, which needs the p90 of this surface: the alar
 * rim, the lip border, the eyelid margin, the nostril, the ear. An amplified difference image
 * confirms exactly that — the change is a warm rim on those features and flat nothing on the cheek.
 *
 * 🚩 **And that agrees with what the technique's own authors say.** `rendering-stack.md` records
 * Penner's weakness verbatim — *"Weak at shadow penumbrae"* — and adds *"pre-integrated's weakness
 * is exactly the shadow-penumbra region, which is where a portrait camera lives."* Under four soft
 * RectAreaLights there is no sharp terminator anywhere on the face for a 1.25 mm profile to soften:
 * the key panel subtends about 25° of half-angle, so the light's own penumbra is an order of
 * magnitude wider in N·L than the diffusion profile is.
 *
 * **The default is left at the spec's physical value on purpose.** Turning `scatterDistance` up to
 * 12–25 mm makes the terminator visibly redden and would make a subjective judge happier, but the
 * uniform would then be a look control wearing the name of a physical quantity, and this repository
 * has already paid for that mistake twice (LEARNINGS §1.7, §1.11a). The number is in the sweep above
 * for whoever wants to make that call deliberately.
 *
 * **What actually closes the cheek terminator is the other technique**, and the G-buffer is already
 * built for it: separable screen-space SSS (Jimenez) blurs *irradiance* across the surface, so its
 * reach is set by the scatter distance and not by the curvature, and 12 mm of blur across a soft
 * terminator is exactly the red band the reference has. `GBuffer.js` carries an `sssMask` channel
 * written by this material and by nothing else, for precisely that upgrade.
 *
 * ## Cost
 *
 * GPU timestamp queries at 1920 x 1080, deferred path, 300 samples per run, three runs per variant
 * in alternating order, median of the three medians:
 *
 *     stock MeshPhysicalNodeMaterial   1.609 ms
 *     skin, all four parts             1.910 ms      +0.301 ms   = 1.8% of a 16.6 ms frame
 *     skin without the second lobe     1.707 ms      so the second lobe is ~0.20 ms of that
 *     skin without the micro-normal    1.915 ms      within run-to-run noise of the full material
 *
 * Two thirds of the cost is the second specular lobe, because `clearcoat` means a second LTC
 * evaluation per rect-area light and there are four of them. The LUT and curvature fetches do not
 * separate from noise. `docs/PROGRESS.md` leaves ~12.7 ms of the frame after the lights and morphs;
 * this item spends 2.4% of that.
 */

import {
    ClampToEdgeWrapping,
    DataTexture,
    FloatType,
    LinearFilter,
    LinearMipmapLinearFilter,
    MeshPhysicalNodeMaterial,
    NoColorSpace,
    PhysicalLightingModel,
    RepeatWrapping,
    RGBAFormat,
    TextureLoader,
    UnsignedByteType
} from 'three/webgpu';

import {
    float,
    fwidth,
    length,
    normalize,
    normalMap,
    normalView,
    normalWorldGeometry,
    positionView,
    positionWorld,
    property,
    texture,
    uniform,
    uv,
    vec2,
    vec3
} from 'three/tsl';

import {
    buildPreintegratedSkinLut,
    MAX_RING_CURVATURE
} from './PreintegratedSkinLut.js';

import { CURVATURE_ENCODE_MAX_PER_MILLIMETRE } from './SkinCurvature.js';
import { buildSkinMicroNormal } from './SkinMicroNormal.js';

/**
 * `diffuseContribution` is three's own albedo-after-metalness property. It is not re-exported from
 * `three/tsl`, but `PropertyNode` hashes on its name and is marked global, so rebuilding it here
 * resolves to the same shader variable the base material assigned in `setupVariants()`.
 */
const DIFFUSE_CONTRIBUTION = property( 'vec3', 'DiffuseContribution' );

const METRES_TO_MILLIMETRES = 1000;

/**
 * Defaults, every one of them from `docs/research/stellar-blade-look-spec.md` §5 unless the
 * comment says otherwise. Nothing here is a taste judgement that has not been labelled as one.
 */
export const SKIN_DEFAULTS = {

    // §5: "scatter distance 1.0 – 1.5 mm at head scale". Midpoint.
    //
    // ⚠️ Read this next to what the bake measured, because the two together are the single most
    // surprising number in this item. `tools/lut-bake/out/figure_g050-curvature.json`: the head's
    // MEDIAN mean curvature is 0.00455 /mm — a 220 mm radius of curvature — and its p90 is
    // 0.145 /mm. At a 1.25 mm scatter distance the broad planes of the face therefore sit at a
    // ring curvature of 0.006, where the table is Lambert to four decimal places. Pre-integration
    // at physical scatter distances is an effect on ALAE, LIP BORDER, EYELID, NOSTRIL, EAR and
    // FINGER — the p90-and-above of the surface — and it is very nearly a no-op on a cheek. Turn
    // this dial up and the whole face reddens, but the number stops being a scatter distance.
    scatterDistanceMillimetres: 1.25,

    // Ceiling on the area-light gain. A guard, not a look control — the gain is a ratio of two
    // quantities that both approach zero, and nothing physical should multiply a diffuse response
    // by more than a few.
    maxScatterGain: 6.0,

    // The ε above, in units of full Lambert response. 0.02 says "treat a Lambert response below 2%
    // of full as 2% when forming the ratio". Small enough that the lit side is untouched to four
    // decimal places, large enough that the terminator's gain stays finite and smooth.
    scatterGainFloor: 0.02,

    // Blend from the baked curvature map toward the screen-space estimate. Zero by default:
    // rendering-stack.md's whole reason for asking for a bake is that the runtime term is noisy on
    // a skinned, morphing face. Exposed because Penner blends them and because a future
    // wrinkle/tension system would want the runtime half back.
    runtimeCurvatureBlend: 0.0,

    // §5: cheeks 0.42–0.50. One value, because this asset ships no roughness map — the GLB's body
    // material carries a base colour texture and nothing else. A T-zone/cheek/lip split needs a
    // map that does not exist yet; until it does, the cheek value is the one the gate measures.
    roughness: 0.46,

    // §5: "clearcoat 0.06 – 0.12 // dual-lobe approximation", "clearcoatRoughness 0.22 – 0.30".
    secondLobeWeight: 0.09,
    secondLobeRoughness: 0.26,

    // §5: "normalScale (detail) 0.15 – 0.25 // target high-pass σ 1.5–2.1/255 at 4K".
    microNormalScale: 0.20,

    // §5: "detail normal map tiled 8–12× across the face at 2K". The body atlas is one UV square
    // for the whole figure and the face occupies a fraction of it, so a repeat over the ATLAS is
    // not a repeat across the face. Set by measurement on the browsercheck page, not by arithmetic.
    microNormalRepeat: 48
};

/**
 * The lighting model. Everything specific to skin is these two methods and the term they share.
 */
export class SkinLightingModel extends PhysicalLightingModel {

    /**
     * @param {Object} nodes - the material's uniform nodes and sampled maps.
     * @param {boolean} useClearcoat - passed straight through; the second specular lobe is a coat.
     */
    constructor( nodes, useClearcoat ) {

        super( useClearcoat );

        this.nodes = nodes;

        // Assigned in `start()`, read by both light paths. Both are per-fragment and independent
        // of which light is being evaluated, so they are computed once rather than per light.
        this.ringCurvature = null;
        this.lutV = null;

    }

    /**
     * `super.start()` is what walks the light list and calls `direct`/`directRectArea`, so
     * anything those two need has to exist before it runs.
     */
    start( builder ) {

        const baked = this.nodes.curvatureMap === null
            ? float( 0 )
            : decodeBakedCurvature( this.nodes.curvatureMap );

        // Penner's own screen-space estimate, on the GEOMETRIC normal rather than the shading
        // normal. Taking derivatives of the shading normal would measure the micro-normal's slope
        // — a 256 px noise tile at repeat 48 — and report the whole face as maximally curved.
        const runtime = length( fwidth( normalWorldGeometry ) )
            .div( length( fwidth( positionWorld ) ).max( 1e-6 ) )
            .div( METRES_TO_MILLIMETRES );

        const curvature = baked.mix( runtime, this.nodes.runtimeCurvatureBlend );

        this.ringCurvature = curvature.mul( this.nodes.scatterDistanceMillimetres ).toVar( 'skinRingCurvature' );

        // The table's v axis is sqrt-encoded, and `PreintegratedSkinLut.encodeRingCurvature` is the
        // same expression in JavaScript. The two cannot drift on the constant, because
        // MAX_RING_CURVATURE is imported from that module rather than repeated here; they can still
        // drift on the *shape* of the encoding, and nothing can assert that across the JS/WGSL
        // boundary — so if one changes, change both.
        this.lutV = this.ringCurvature.div( MAX_RING_CURVATURE ).saturate().sqrt().toVar( 'skinLutV' );

        super.start( builder );

    }

    /**
     * The pre-integrated response for one light direction: what Lambert's `saturate(N·L)` becomes.
     *
     * @param {Node<float>} dotNL - signed, -1 to 1.
     * @returns {Node<vec3>}
     */
    scatteredLambert( dotNL ) {

        return this.nodes.lut.sample( vec2( dotNL.mul( 0.5 ).add( 0.5 ), this.lutV ) ).rgb;

    }

    /**
     * Punctual lights — exact. The base model's diffuse is discarded and replaced; its specular,
     * sheen and clearcoat work is kept by letting it run into a scratch accumulator.
     */
    direct( input, builder ) {

        const scratch = scratchReflectedLight();

        super.direct( { ...input, reflectedLight: scratch }, builder );

        input.reflectedLight.directSpecular.addAssign( scratch.directSpecular );

        const dotNL = normalView.dot( input.lightDirection );

        input.reflectedLight.directDiffuse.addAssign(
            input.lightColor.mul( this.scatteredLambert( dotNL ) ).mul( DIFFUSE_CONTRIBUTION ).mul( 1 / Math.PI )
        );

    }

    /**
     * Rect-area lights — the gain approximation described in this file's header. This is the path
     * that actually runs under Sugata's lighting rig.
     */
    directRectArea( input, builder ) {

        const scratch = scratchReflectedLight();

        super.directRectArea( { ...input, reflectedLight: scratch }, builder );

        input.reflectedLight.directSpecular.addAssign( scratch.directSpecular );

        // `lightPosition` is the panel's centre in view space; `LTC_Evaluate` works in the same
        // space against `positionView`, so this is the same frame the base model just used.
        const toLight = normalize( input.lightPosition.sub( positionView ) );
        const dotNL = normalView.dot( toLight );

        const floor = this.nodes.scatterGainFloor;
        const gain = this.scatteredLambert( dotNL ).add( floor )
            .div( dotNL.saturate().add( floor ) )
            .min( this.nodes.maxScatterGain );

        input.reflectedLight.directDiffuse.addAssign( scratch.directDiffuse.mul( gain ) );

    }

}

/**
 * A `reflectedLight` that goes nowhere, so the base lighting model can be run for its specular
 * without its diffuse reaching the frame.
 *
 * Only `directDiffuse` and `directSpecular` are provided because those are the only two members
 * `PhysicalLightingModel`'s two direct methods touch — verified against r185's source, not assumed.
 */
function scratchReflectedLight() {

    // Unnamed on purpose. `NodeBuilder.getVarFromNode` uses an explicit name verbatim, so two
    // lights asking for the same one would declare the same variable twice in one scope.
    return {
        directDiffuse: vec3( 0 ).toVar(),
        directSpecular: vec3( 0 ).toVar()
    };

}

/** Undoes `SkinCurvature.encodeCurvature`: red is convex, square-root encoded. */
function decodeBakedCurvature( map ) {

    const encoded = map.sample( uv() ).r;
    return encoded.mul( encoded ).mul( CURVATURE_ENCODE_MAX_PER_MILLIMETRE );

}

/**
 * The material.
 *
 * `MeshPhysicalNodeMaterial` is subclassed rather than patched per instance so that reading the
 * scene graph tells you which objects are skin.
 */
export class SkinNodeMaterial extends MeshPhysicalNodeMaterial {

    /**
     * `NodeMaterial.type` is a getter over `constructor.type`, so declaring this makes the scene
     * graph self-describing: a mesh's material reads as `SkinNodeMaterial` rather than as the base
     * class. three's shader cache keys on the node graph rather than on this string, so it changes
     * nothing about what compiles.
     */
    static get type() {

        return 'SkinNodeMaterial';

    }

    constructor( nodes, parameters ) {

        super( parameters );

        this.isSkinNodeMaterial = true;
        this.skin = nodes;

    }

    setupLightingModel() {

        return new SkinLightingModel( this.skin, this.useClearcoat );

    }

}

/**
 * Builds the skin material.
 *
 * @param {Object} [options]
 * @param {?Texture} [options.albedoMap=null] - the figure's own base-colour map, reused as is.
 * @param {?string} [options.curvatureMapUrl] - the baked map from `tools/lut-bake/bake.mjs`.
 *   Passing `null` disables the baked term, which is how the effect-off plate is produced.
 * @param {Object} [options.settings] - overrides over `SKIN_DEFAULTS`.
 * @returns {Promise<SkinNodeMaterial>} resolves once the curvature map has decoded, so the caller
 *   never puts a half-loaded material in front of a capture.
 */
export async function createSkinMaterial( options = {} ) {

    const settings = { ...SKIN_DEFAULTS, ...( options.settings ?? {} ) };

    const curvatureMap = options.curvatureMapUrl == null
        ? null
        : await loadCurvatureMap( options.curvatureMapUrl );

    const nodes = {
        lut: texture( createLutTexture() ),
        curvatureMap: curvatureMap === null ? null : texture( curvatureMap ),
        scatterDistanceMillimetres: uniform( settings.scatterDistanceMillimetres ),
        runtimeCurvatureBlend: uniform( settings.runtimeCurvatureBlend ),
        maxScatterGain: uniform( settings.maxScatterGain ),
        scatterGainFloor: uniform( settings.scatterGainFloor )
    };

    const material = new SkinNodeMaterial( nodes );

    material.map = options.albedoMap ?? null;
    material.metalness = 0;                       // skin is a dielectric; nothing about it is metal
    material.roughness = settings.roughness;

    // §5: ior 1.40–1.45, F0 ≈ 0.045–0.05. `MeshPhysicalMaterial` derives specular F0 from ior.
    material.ior = 1.42;

    // The second specular lobe. See the header: this is the dual lobe, not a varnish.
    material.clearcoat = settings.secondLobeWeight;
    material.clearcoatRoughness = settings.secondLobeRoughness;

    const microTexture = createMicroNormalTexture();
    const microScale = uniform( settings.microNormalScale );
    const microRepeat = uniform( settings.microNormalRepeat );

    material.normalNode = normalMap(
        texture( microTexture, uv().mul( microRepeat ) ).xyz,
        vec2( microScale, microScale )
    );

    nodes.microNormalScale = microScale;
    nodes.microNormalRepeat = microRepeat;

    // Everything a tuning UI or a gate script needs to move, in one place, named for what it is.
    material.skinUniforms = {
        scatterDistanceMillimetres: nodes.scatterDistanceMillimetres,
        runtimeCurvatureBlend: nodes.runtimeCurvatureBlend,
        maxScatterGain: nodes.maxScatterGain,
        scatterGainFloor: nodes.scatterGainFloor,
        microNormalScale: microScale,
        microNormalRepeat: microRepeat
    };

    material.skinSettings = settings;

    return material;

}

/**
 * The pre-integrated table as a float texture.
 *
 * `FloatType` rather than 8-bit, and the reason is the gate: the interesting part of this function
 * is a few percent of full range, and 1/255 quantisation on it is the same order as the high-pass
 * σ of 1.5–2.1/255 that G4 measures. An 8-bit table would put its own contouring into the number.
 * The whole texture is 128 × 64 × RGBA16F = 64 KB.
 */
function createLutTexture() {

    const lut = buildPreintegratedSkinLut();

    // RGBA rather than RGB: WebGPU has no three-channel 16-bit float texture format, and three
    // silently pads a mismatched one.
    const data = new Float32Array( lut.width * lut.height * 4 );

    for ( let i = 0; i < lut.width * lut.height; i ++ ) {

        data[ i * 4 ] = lut.data[ i * 3 ];
        data[ i * 4 + 1 ] = lut.data[ i * 3 + 1 ];
        data[ i * 4 + 2 ] = lut.data[ i * 3 + 2 ];
        data[ i * 4 + 3 ] = 1;

    }

    const map = new DataTexture( data, lut.width, lut.height, RGBAFormat, FloatType );
    map.minFilter = LinearFilter;
    map.magFilter = LinearFilter;

    // RGBA16F would halve the footprint, but `FloatType` costs 128 x 64 x 16 B = 128 KB and takes
    // the half-float rounding out of a function the gate measures to a fraction of a code value.
    //
    // Clamped, because both axes are physically bounded: N·L cannot leave [-1, 1] and a curvature
    // past the last row has already saturated. Wrapping either one would fold the terminator's
    // answer onto the fully-lit end of the table.
    map.wrapS = ClampToEdgeWrapping;
    map.wrapT = ClampToEdgeWrapping;
    map.generateMipmaps = false;
    map.colorSpace = NoColorSpace;                // this is a function, not a picture
    map.needsUpdate = true;

    return map;

}

/** The tiled micro-normal as a `DataTexture`. Generated, not fetched — see `SkinMicroNormal.js`. */
function createMicroNormalTexture() {

    const micro = buildSkinMicroNormal();

    const map = new DataTexture( micro.rgba, micro.size, micro.size, RGBAFormat, UnsignedByteType );

    map.wrapS = RepeatWrapping;
    map.wrapT = RepeatWrapping;
    map.minFilter = LinearMipmapLinearFilter;
    map.magFilter = LinearFilter;

    // Mipmaps are the distance fade `rendering-stack.md` asks for, and they are not optional here:
    // three's specular anti-aliasing is geometric only, so an unfiltered micro-normal at a repeat
    // this high would shimmer and nothing downstream would catch it.
    map.generateMipmaps = true;
    map.anisotropy = 8;
    map.colorSpace = NoColorSpace;                // normals are data
    map.needsUpdate = true;

    return map;

}

/**
 * Loads a baked curvature map.
 *
 * `NoColorSpace` is load-bearing: the map stores `sqrt(|H|/max)`, and an sRGB decode on the way in
 * would apply a 2.4 gamma to a number the shader then squares — quietly reporting every surface as
 * far flatter than it is, with no error anywhere.
 */
function loadCurvatureMap( url ) {

    return new Promise( ( resolve, reject ) => {

        new TextureLoader().load(
            url,
            ( map ) => {

                map.colorSpace = NoColorSpace;
                map.minFilter = LinearFilter;     // no mips: this is data, and a mip chain would
                map.magFilter = LinearFilter;     // average convex against concave across a crease
                map.generateMipmaps = false;
                map.wrapS = ClampToEdgeWrapping;
                map.wrapT = ClampToEdgeWrapping;
                map.needsUpdate = true;
                resolve( map );

            },
            undefined,
            () => reject( new Error( `SkinMaterial: could not load the curvature map at ${ url }. Run: node tools/lut-bake/bake.mjs curvature` ) )
        );

    } );

}

/**
 * Replaces the body mesh's material on a loaded `Figure`.
 *
 * Only the body. The other six meshes in a figure GLB are teeth, tongue, lashes, brows and the two
 * eye shells; none of them is skin and two of them are punch-list 3.3's business.
 *
 * @param {Figure} figure
 * @param {SkinNodeMaterial} material
 * @returns {{replaced: string[], albedoMap: ?Texture}}
 */
export function applySkinMaterial( figure, material ) {

    const replaced = [];
    let albedoMap = null;

    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;
        if ( object !== figure.body ) return;

        albedoMap = object.material.map ?? null;
        if ( material.map === null ) material.map = albedoMap;

        object.material = material;
        replaced.push( object.name );

    } );

    return { replaced, albedoMap };

}

/** The default URL of the baked curvature map for a figure, resolved relative to this module. */
export function curvatureMapUrlFor( figureName = 'figure_g050' ) {

    return new URL( `../../../../tools/lut-bake/out/${ figureName }-curvature.png`, import.meta.url ).href;

}
