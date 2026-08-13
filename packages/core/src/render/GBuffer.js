/**
 * GBuffer — the multi-render-target contract every later rendering phase reads from.
 *
 * Sugata renders the scene ONCE into five named attachments and every subsequent effect is a
 * screen-space pass over them. There is no depth prepass and no second geometry draw: the head
 * is dense and skinned, and drawing it twice would cost more than every post effect combined.
 *
 * Each channel exists because a specific punch-list item cannot be built without it. That is
 * the whole justification for the extra bandwidth, so it is written down per channel rather
 * than left as folklore:
 *
 * | channel        | format   | written by            | read by                                  |
 * |----------------|----------|-----------------------|------------------------------------------|
 * | `output`       | RGBA16F  | every material        | the composite; bloom and grade (3.13)    |
 * | `diffuseColor` | RGBA8    | every material        | denoise guide (3.6/3.10), grade (3.13)   |
 * | `normal`       | RGBA16F  | every material        | GTAO -> bent normals + spec occ (3.10)   |
 * | `velocity`     | RG16F    | every material        | TRAA and TAAU (3.12)                     |
 * | `sssMask`      | R8       | skin material only    | pre-integrated skin (3.2)                |
 * | `hairAccum`    | RGBA16F  | hair material only *  | the OIT resolve (3.6) — opt-in           |
 * | `hairWeight`   | R16F     | hair material only *  | the OIT resolve (3.6) — opt-in           |
 *
 * \* "hair material only" in the sense that only hair writes a NON-ZERO value. Every material in
 * the pass writes those two attachments, because the blend state that makes them an accumulation
 * buffer is pass state and cannot be varied per material — see the constructor, and `HairOIT.js`
 * for the arithmetic that shows a zero write is a no-op. They exist only when the pass is built
 * with `{ hairOIT: true }`, so a page with no groom pays nothing.
 *
 * Three decisions in that table are load-bearing and easy to get wrong later:
 *
 * **`normal` holds SIGNED view-space normals, not a 0..1 packing.** The obvious bandwidth win
 * is `packNormalToRGB()` into RGBA8, and `research/rendering-stack.md` even shows that form.
 * It cannot be used here: `GTAONode` samples the normal texture as
 * `normalNode.sample(uv).rgb.normalize()`, so a packed buffer would hand it a direction confined
 * to the positive octant and the ambient occlusion would be silently, plausibly wrong. Bent
 * normals (3.10) are derived from the same signed directions. The cost of the honest encoding is
 * 4 bytes per pixel, measured in `packages/testbed/src/stage.js`.
 *
 * **`normal.w` carries perceptual roughness.** The alpha channel of an RGBA16F attachment is
 * already allocated, and specular occlusion — the actual point of 3.10 — needs roughness beside
 * the bent normal. Free, and it keeps the G-buffer at five attachments instead of six.
 *
 * **`sssMask` defaults to 0 at pass level.** Non-skin materials write zero explicitly rather
 * than leaving the attachment at whatever the clear left behind, so 3.2 can branch on it without
 * an undefined-content hazard. The skin material overrides it with its own `material.mrtNode`,
 * which `MRTNode.merge()` folds over the pass-level MRT per material.
 *
 * ⚠️ **Morph targets contribute no velocity.** `three/src/nodes/accessors/Skinning.js` assigns
 * `positionPrevious` when the MRT contains a velocity channel, so bone animation reprojects
 * correctly. `Morph.js` does not. Our face is entirely morph-driven (there is no jaw bone and no
 * eye bones), so facial motion is invisible to TRAA — and worse than invisible: a morph held at
 * a constant non-zero weight produces a constant non-zero velocity, because the previous-frame
 * position is reconstructed from un-morphed geometry. Measured in `stage.js`; 3.12 has to either
 * mask the face out of the reprojection or teach `Morph.js` a previous-weights path.
 *
 * Measured on a static sphere with one morph target of 0.18 world units, camera and model matrix
 * frozen, at 1280x720: **35.5 px/frame of reported motion over 7,921 pixels**, and — the detail
 * that names the mechanism — the reading is *identical* whether the morph weight is held constant
 * at 0.8 or swept 0 -> 0.8 between the two frames. The buffer is reporting the morph offset, not
 * the morph change. A skinned cylinder bending in the same scene reports 0.87 px/frame correctly,
 * and a genuinely still frame reports 0.000, so the channel itself is sound.
 */

import {
    HalfFloatType,
    LinearFilter,
    NearestFilter,
    NoColorSpace,
    NoToneMapping,
    RedFormat,
    RGFormat,
    SRGBColorSpace,
    UnsignedByteType
} from 'three/webgpu';

import {
    diffuseColor,
    float,
    mrt,
    normalView,
    output,
    renderOutput,
    roughness,
    step,
    vec2,
    vec3,
    vec4,
    velocity
} from 'three/tsl';

import { HAIR_OIT_CHANNELS, hairAccumBlendMode, hairWeightBlendMode } from './HairOIT.js';

/**
 * The channel table above, in the form the code actually consumes.
 *
 * `format`/`type` are applied to the attachment; `filter` matters because two different
 * consumers sample these textures. Anything a screen-space effect reads per-pixel and must not
 * see blended across a silhouette (normals, motion vectors, a binary mask) is point-sampled;
 * anything that is genuinely a colour is filtered.
 */
export const GBUFFER_CHANNELS = [
    {
        name: 'diffuseColor',
        format: null,               // inherit RGBA
        type: UnsignedByteType,
        filter: LinearFilter,
        description: 'albedo before lighting (RGBA8)'
    },
    {
        name: 'normal',
        format: null,               // inherit RGBA
        type: HalfFloatType,
        filter: NearestFilter,
        description: 'view-space normal xyz + perceptual roughness w (RGBA16F)'
    },
    {
        name: 'velocity',
        format: RGFormat,
        type: HalfFloatType,
        filter: NearestFilter,
        description: 'NDC motion vector (RG16F)'
    },
    {
        name: 'sssMask',
        format: RedFormat,
        type: UnsignedByteType,
        filter: NearestFilter,
        description: 'skin selector, 0 or 1 (R8)'
    }
];

/** Every channel name in the G-buffer, `output` included. */
export const GBUFFER_NAMES = [ 'output', ...GBUFFER_CHANNELS.map( ( channel ) => channel.name ) ];

export class GBuffer {

    /**
     * Configures a `PassNode` to render the five-attachment G-buffer.
     *
     * Attachment creation has to happen here, before any material compiles: `MRTNode.setup()`
     * looks each output name up in `renderTarget.textures` and **silently skips any name it
     * cannot find**, so a channel whose texture has not been requested compiles away to nothing
     * rather than erroring. `getTexture()` is what creates it.
     *
     * @param {PassNode} scenePass - The pass returned by `pass( scene, camera )`.
     */
    constructor( scenePass, options = {} ) {

        this.pass = scenePass;
        this.textures = {};
        this.hasHairOIT = options.hairOIT === true;

        const channels = this.hasHairOIT
            ? [ ...GBUFFER_CHANNELS, ...HAIR_OIT_CHANNELS ]
            : GBUFFER_CHANNELS;

        for ( const channel of channels ) {

            const texture = scenePass.getTexture( channel.name );

            if ( channel.format !== null ) texture.format = channel.format;
            texture.type = channel.type;
            texture.minFilter = channel.filter;
            texture.magFilter = channel.filter;
            texture.generateMipmaps = false;

            // These are data, not pictures. An sRGB transfer on the way in would corrupt
            // normals and motion vectors and quietly darken albedo.
            texture.colorSpace = NoColorSpace;

            this.textures[ channel.name ] = texture;

        }

        this.textures.output = scenePass.getTexture( 'output' );

        const outputs = {
            output,
            diffuseColor,
            normal: vec4( normalView, roughness ),
            velocity,

            // Written by every material so the channel is never undefined; the skin material
            // replaces it via its own `mrtNode`. See `markAsSkin()`.
            sssMask: float( 0 )
        };

        if ( this.hasHairOIT ) {

            // 🚩 EVERY MATERIAL IN THE PASS WRITES THESE, AND THAT IS THE DESIGN RATHER THAN AN
            // OVERSIGHT. Per-attachment blend state is read from `renderObject.context.mrt`
            // (`WebGPUPipelineUtils.js:132`), which `RenderContexts.js:74` fills from
            // `Renderer.setMRT()` — i.e. from THIS node — so the OIT blend rules apply to every
            // draw in the pass whether or not it is hair, and there is no per-material escape.
            // A source of zero is exactly a no-op under those rules: the accumulation adds nothing,
            // and the revealage multiplies by `1 − 0`. `HairOIT.js` writes the arithmetic out.
            // The hair material overrides only these two VALUES via `material.mrtNode`, which is
            // the half of `MRTNode.merge()` that works.
            outputs.hairAccum = vec4( 0 );
            outputs.hairWeight = float( 0 );

        }

        const passMRT = mrt( outputs );

        // 🚩 `hairOITDefect: 'material-blend'` withholds the pass-level blend modes so the hair
        // material can carry them instead — the placement that reads as correct and is not. It is
        // the red proof for `HairOIT.selftest.mjs` and nothing else; see `configureHairMaterial`.
        if ( this.hasHairOIT && options.hairOITDefect !== 'material-blend' ) {

            passMRT
                .setBlendMode( 'hairAccum', hairAccumBlendMode() )
                .setBlendMode( 'hairWeight', hairWeightBlendMode() );

        }

        scenePass.setMRT( passMRT );

    }

    /**
     * The `TextureNode` for a channel — what a post pass binds. `getTextureNode` is memoised
     * inside `PassNode`, so repeated calls return the same node and the graph stays shared.
     *
     * @param {string} name - One of `GBUFFER_NAMES`.
     * @returns {TextureNode}
     */
    node( name ) {

        return this.pass.getTextureNode( name );

    }

    /** Scene depth as a texture node. `TRAANode` and `GTAONode` both take this directly. */
    get depthNode() {

        return this.pass.getTextureNode( 'depth' );

    }

    /** Depth remapped to 0..1 across the camera's near/far range, for display and for AO. */
    get linearDepthNode() {

        return this.pass.getLinearDepthNode();

    }

    /** Signed view-space normal, ready for `GTAONode` and for a bent-normal pass. */
    get normalViewNode() {

        return this.node( 'normal' ).rgb;

    }

    /** Perceptual roughness, riding in the normal attachment's alpha. */
    get roughnessNode() {

        return this.node( 'normal' ).a;

    }

    /** NDC motion vector, ready for `TRAANode` / `TAAUNode`. */
    get velocityNode() {

        return this.node( 'velocity' );

    }

    /**
     * Bytes of attachment per pixel, so a resolution or tier decision can be argued from a
     * number rather than a feeling. Depth is not included; it exists with or without the MRT.
     */
    get bytesPerPixel() {

        return 8      // output   RGBA16F
            + 4       // diffuseColor RGBA8
            + 8       // normal   RGBA16F
            + 4       // velocity RG16F
            + 1       // sssMask  R8
            + ( this.hasHairOIT ? 8 + 2 : 0 );   // hairAccum RGBA16F + hairWeight R16F (3.6)

    }

}

/**
 * Tags a material as skin, so the pre-integrated skin pass (3.2) can find its pixels.
 *
 * `NodeMaterial.mrtNode` is merged over the pass-level MRT for this material alone
 * (`NodeMaterial.setup` -> `mrt.merge( materialMRT )`), which is exactly the primitive the
 * separable-SSS upgrade path needs: one channel, written by one material, no extra draw.
 *
 * @param {NodeMaterial} material
 * @param {number} [profileId=1] - Reserved for multiple skin profiles later. 0 means "not skin",
 *   so any non-zero value reads as skin today.
 * @returns {NodeMaterial} The same material, for chaining.
 */
export function markAsSkin( material, profileId = 1 ) {

    // 🚩 A material carrying `mrtNode` is NOT safe to forward-render. Measured on r185, and it
    // fails with a message that names neither this file nor this material:
    //
    //     Error while parsing WGSL: structures must have at least one member
    //     struct OutputType {
    //
    // The mechanism: when a render target is bound but `renderer.getMRT()` is null,
    // `NodeMaterial.setup` uses the material MRT *alone* rather than merging it. `MRTNode.setup`
    // then resolves each output name against that target's attachments and **silently drops
    // every name it cannot find** — so if none match, the fragment shader declares an empty
    // output struct, which is invalid WGSL, and the object stops drawing.
    //
    // That is not an exotic situation. `Renderer._getFrameBufferTarget()` allocates an
    // **unnamed** intermediate target whenever tone mapping or an output colour-space conversion
    // is active and no render target is set — which is every forward-rendered frame this project
    // draws, because `Stage` sets ACES and sRGB. Verified both directions in
    // `packages/testbed/src/stage.js`: `?forward=1` logs an invalid render pipeline every frame,
    // `?forward=1&noskin=1` is silent, and the deferred path is silent either way.
    //
    // Naming `output` here does not cure that case — the intermediate target's texture has no
    // name at all — but it does cover the realistic one: this material drawn through some OTHER
    // pass that has a colour attachment and no `sssMask`. The remaining rule has to be carried
    // by the caller: **only tag materials that are drawn through a `GBuffer` pass.**
    material.mrtNode = mrt( { output, sssMask: float( profileId ) } );
    return material;

}

/**
 * Builds a display node for one G-buffer channel.
 *
 * This exists so that "did the channel get written" is answerable by eye as well as by a pixel
 * readback. Two of the five channels are invisible without help: motion vectors are subpixel per
 * frame and would render as flat black at unit gain — the exact appearance of a velocity buffer
 * that is not being written at all — and depth occupies a hair's width of the 0..1 range at
 * portrait distances. Both take an explicit gain, and the gain is on screen.
 *
 * @param {GBuffer} gbuffer
 * @param {string} view - `output` | `diffuseColor` | `normal` | `roughness` | `velocity` |
 *   `sssMask` | `depth`
 * @param {Object} [options]
 * @param {Node<float>} [options.velocityGain] - Multiplier on the motion vector before display.
 * @param {Node<float>} [options.depthGain] - Multiplier on linear depth before display.
 * @param {?Node<vec2>} [uvNode=null] - Where to sample. `null` means "wherever this pixel is",
 *   which is what a full-screen view wants; the grid passes a remapped cell coordinate.
 * @returns {Node<vec3>} A display-referred colour.
 */
export function channelDisplayNode( gbuffer, view, options = {}, uvNode = null ) {

    const velocityGain = options.velocityGain ?? float( 200 );
    const depthGain = options.depthGain ?? float( 1 );

    const at = ( name ) => uvNode === null ? gbuffer.node( name ) : gbuffer.node( name ).sample( uvNode );

    if ( view === 'output' ) {

        // The one channel that is a picture: tone map and encode it exactly as the beauty
        // path would, so the grid cell and the full-screen beauty view agree.
        return renderOutput( at( 'output' ) ).rgb;

    }

    if ( view === 'diffuseColor' ) {

        return renderOutput( at( 'diffuseColor' ), NoToneMapping, SRGBColorSpace ).rgb;

    }

    if ( view === 'normal' ) {

        return at( 'normal' ).rgb.mul( 0.5 ).add( 0.5 );

    }

    if ( view === 'roughness' ) {

        return vec3( at( 'normal' ).a );

    }

    if ( view === 'velocity' ) {

        // Red is horizontal motion, green vertical, both centred on 0.5. Blue carries the
        // magnitude so a pixel that is moving is unmistakable even at a glance.
        const motion = at( 'velocity' ).xy.mul( velocityGain );
        return vec3( motion.x.mul( 0.5 ).add( 0.5 ), motion.y.mul( 0.5 ).add( 0.5 ), motion.length() );

    }

    if ( view === 'sssMask' ) {

        return vec3( at( 'sssMask' ).r );

    }

    if ( view === 'depth' ) {

        // Linearising depth needs the scene camera's near and far, which `PassNode` holds as
        // private uniforms and only exposes through a node sampled at the current pixel. That
        // is why depth is a full-screen view and not a grid cell — see `channelGridNode`.
        if ( uvNode !== null ) throw new Error( 'GBuffer: the depth view cannot be sampled at a custom uv.' );

        // Near is white, far is black, and the gain expands the near end — a portrait subject
        // occupies a few percent of a 0.1-to-12 m range, so an ungained ramp is almost flat.
        // Invert first, then gain: gaining a value that is ~1 everywhere and then inverting it
        // drives the whole image negative, which displays as solid black and looks exactly like
        // a depth buffer that was never written.
        return vec3( gbuffer.linearDepthNode.oneMinus().mul( depthGain ) );

    }

    throw new Error( `GBuffer: unknown view '${ view }'` );

}

/**
 * Tiles several channel views into one image, so a viewer sees the whole G-buffer at once.
 *
 * Each cell shows the WHOLE frame, scaled down — the cell's local coordinate is what every
 * channel is sampled at. Sampling at the screen coordinate instead would show each cell a
 * different crop of the same picture, which looks convincing at a glance and tells you nothing
 * about the channels you cannot see.
 *
 * Cell selection is a product of two `step()`s rather than a branch: every cell samples every
 * texture, which costs nothing worth counting on a diagnostic page and keeps the node graph flat
 * and easy to read.
 *
 * `depth` cannot appear here; it needs the scene camera's near and far to linearise and
 * `PassNode` only exposes that sampled at the current pixel. Use the full-screen depth view.
 *
 * @param {GBuffer} gbuffer
 * @param {Array<string>} views - Channel names, laid out row-major.
 * @param {Node<vec2>} screenUVNode - Normally `screenUV`.
 * @param {number} columns
 * @param {number} rows
 * @param {Object} [options] - Passed through to `channelDisplayNode`.
 * @returns {Node<vec3>}
 */
export function channelGridNode( gbuffer, views, screenUVNode, columns, rows, options = {} ) {

    const cell = screenUVNode.mul( vec2( columns, rows ) );
    const cellIndex = cell.floor();
    const localUV = cell.fract();
    const index = cellIndex.y.mul( columns ).add( cellIndex.x );

    let colour = vec3( 0 );

    for ( let i = 0; i < views.length; i ++ ) {

        // 1 inside cell i, 0 outside. `step(edge, x)` is `x >= edge`.
        const inThisCell = step( float( i - 0.5 ), index ).mul( step( index, float( i + 0.5 ) ) );

        colour = colour.add( channelDisplayNode( gbuffer, views[ i ], options, localUV ).mul( inThisCell ) );

    }

    return colour;

}
