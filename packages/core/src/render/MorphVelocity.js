/**
 * MorphVelocity — gives morph targets a previous-frame position, which three.js does not.
 *
 * Punch-list 3.12's blocker, fixed at the source rather than worked around.
 *
 * ## The defect, stated exactly
 *
 * `VelocityNode.setup()` differences two clip positions: the current one built from
 * `positionLocal`, and the previous one built from `positionPrevious`. `positionPrevious` starts
 * life as the raw `position` attribute (`nodes/accessors/Position.js:54`) and is only ever
 * reassigned by `Skinning.js` (:166, :233) and `Instance.js` (:228). `Morph.js` adds its offsets
 * into `positionLocal` and touches `positionPrevious` nowhere.
 *
 * So on a morphed mesh the velocity buffer reports
 *
 *     current(morphed, skinned)  -  previous(UN-morphed, skinned)
 *
 * which is not a velocity at all — it is the morph offset itself, reported forever. A morph HELD
 * at a constant weight, on a still camera, reports a large constant motion vector. That is worse
 * than reporting none: a temporal filter told "this pixel moved" fetches its history from a pixel
 * that never contained this surface.
 *
 * This rig has no jaw bone and no eye bones (`docs/LEARNINGS.md`, the figure-asset section), so
 * the entire face is morph-driven and the entire face is affected.
 *
 * ## What this file does
 *
 * It assigns `positionPrevious` the PREVIOUS FRAME'S morphed local position, before three's own
 * `setupPosition` runs. Everything downstream then works unchanged: `skinning()` reads
 * `positionPrevious` as its input and transforms it by the previous bone matrices, so bone motion
 * and morph motion compose correctly and neither is double-counted.
 *
 *     positionPrevious = positionGeometry * previousBase + SUM previousInfluence[i] * offset[i]
 *
 * `previousBase` mirrors three's `base`: 1 for relative (glTF) morph targets, `1 - sum(weights)`
 * for absolute ones. This asset's targets are relative — measured straight out of
 * `figure_g050.glb`, every primitive's targets carry POSITION only and glTF morph targets are
 * displacements by specification — so `base` is 1 here and the term is carried for correctness on
 * other assets rather than for this one.
 *
 * ## Why it re-encodes the morph offsets instead of reusing three's texture
 *
 * `Morph.js` keeps its `DataArrayTexture` in a module-private `WeakMap` and exports no accessor,
 * and `getEntry` is not exported either. Deep-importing `three/src/nodes/accessors/Morph.js` to
 * reach them would instantiate a SECOND copy of the node system — `positionLocal` in that copy is
 * a different object from `positionLocal` in `three/tsl`, so nothing would connect. See
 * `docs/LEARNINGS.md` Part 2 on `LTC_Evaluate`, the same trap.
 *
 * The cost is therefore a second copy of the position offsets, and it is a real number rather than
 * a hand-wave: the layout mirrors three's own (4096-wide RGBA32F, one array layer per target), so
 * `figure_g050.glb`'s body mesh is 4096 x 4 x 4 floats x 89 targets = **23.33 MB**, and all seven
 * meshes together are **27.33 MB** — measured by `MorphVelocity.selftest.mjs`, which reads the GLB
 * rather than quoting this line, and prints the per-mesh breakdown. Three's own copy is the same
 * size, because these targets have no morph normals for it to also carry. `HalfFloatType` would
 * halve it for 0.024 mm of offset precision, which is 1.6e-5 px at the project's full-body framing;
 * `Float32Array` ships because it is bit-for-bit what three stores and needs no argument.
 *
 * ## Three modes, because a fix that cannot be switched off cannot be attributed
 *
 *   `exact`  the fix. Previous-frame influences, so a held morph produces exactly zero velocity
 *            and a moving one produces the true one.
 *   `hold`   current-frame influences. Morphs then contribute NO velocity — correct for a held
 *            expression, an under-report for a moving one. This is the cheap mitigation, kept
 *            because it isolates "the bogus vector was the problem" from "the true vector is the
 *            fix", and the two are different claims.
 *   `off`    three's behaviour, unpatched. The known-bad, for rejection proofs.
 *
 * `MorphVelocity.selftest.mjs` gates the CPU side; the rendered proof is in
 * `packages/testbed/src/post.js` (`?morphvel=`) and in the numbers in `docs/PROGRESS.md`.
 */

import { DataArrayTexture, FloatType, NearestFilter, NodeMaterial } from 'three/webgpu';

import {
    float,
    Fn,
    If,
    int,
    ivec2,
    Loop,
    OnObjectUpdate,
    positionGeometry,
    positionPrevious,
    textureLoad,
    uniform,
    uniformArray,
    vertexIndex
} from 'three/tsl';

/** The modes `setMorphVelocityMode` accepts. See the header for what each one means. */
export const MORPH_VELOCITY_MODES = [ 'off', 'hold', 'exact' ];

/**
 * three's own limit in `Morph.js` (`const maxTextureSize = 4096`), copied so the two encodings
 * have the same shape and a reader comparing them is comparing like with like.
 */
const MAX_TEXTURE_SIZE = 4096;

/** One RGBA32F texel per vertex per target: xyz is the offset, w is unused padding. */
const FLOATS_PER_TEXEL = 4;

const _offsetTextures = new WeakMap();
const _previousInfluences = new WeakMap();

let installedMode = 'off';
let originalSetupPosition = null;

// --- the public surface -------------------------------------------------------------------

/**
 * Installs the fix by wrapping `NodeMaterial.prototype.setupPosition`.
 *
 * A prototype wrap is not the first choice and it is worth saying why it is the only one. The
 * assignment has to land BEFORE `skinning()` reads `positionPrevious` and AFTER nothing at all,
 * and the three hooks a material exposes — `positionNode`, `geometryNode`, `vertexNode` — all run
 * after `setupPosition` has finished. Wrapping is the one place that is early enough, it is
 * idempotent, and it costs nothing on any material that is not morphed or is not being rendered
 * into a velocity buffer, because both are checked per build.
 *
 * @param {'off'|'hold'|'exact'} [mode='exact']
 * @returns {{ mode: string, patched: boolean }}
 */
export function installMorphVelocity( mode = 'exact' ) {

    setMorphVelocityMode( mode );

    if ( originalSetupPosition === null ) {

        originalSetupPosition = NodeMaterial.prototype.setupPosition;

        NodeMaterial.prototype.setupPosition = function ( builder ) {

            assignPreviousMorphedPosition( builder );

            return originalSetupPosition.call( this, builder );

        };

    }

    return { mode: installedMode, patched: true };

}

/**
 * Switches mode. Node graphs are compiled, so this only takes effect for materials built
 * afterwards — a page changes it before loading its figure, or reloads.
 *
 * @param {'off'|'hold'|'exact'} mode
 */
export function setMorphVelocityMode( mode ) {

    if ( MORPH_VELOCITY_MODES.includes( mode ) === false ) {

        throw new Error( `MorphVelocity: mode must be one of ${ MORPH_VELOCITY_MODES.join( ', ' ) }, not '${ mode }'.` );

    }

    installedMode = mode;

}

/** What mode is live. `off` also means "never installed". */
export function morphVelocityMode() {

    return installedMode;

}

/**
 * The bytes this file's offset encoding costs for one geometry, so a page can print the number
 * instead of a reader trusting the header.
 *
 * @param {BufferGeometry} geometry
 * @returns {number}
 */
export function morphOffsetBytes( geometry ) {

    const targets = geometry.morphAttributes?.position;

    if ( targets === undefined || targets.length === 0 ) return 0;

    const { width, height } = offsetTextureShape( geometry.attributes.position.count );

    return width * height * FLOATS_PER_TEXEL * targets.length * Float32Array.BYTES_PER_ELEMENT;

}

// --- the node ---------------------------------------------------------------------------------

/**
 * Assigns `positionPrevious` for one build, or does nothing and says why by doing nothing.
 *
 * Three conditions, each one a real skip rather than a guard against a hypothetical:
 *   - mode `off`: the caller asked for three's behaviour.
 *   - `needsPreviousData()` false: no velocity attachment is bound, so `positionPrevious` is never
 *     read and the whole loop would be dead code in every forward frame the project renders.
 *   - no position morph targets: nothing to add.
 */
function assignPreviousMorphedPosition( builder ) {

    if ( installedMode === 'off' ) return;

    const { object, geometry } = builder;

    if ( builder.needsPreviousData() !== true ) return;
    if ( geometry.morphAttributes?.position === undefined ) return;
    if ( geometry.morphAttributes.position.length === 0 ) return;
    if ( Array.isArray( object.morphTargetInfluences ) === false ) return;

    previousMorphedPosition( object, installedMode );

}

/**
 * The vertex-stage assignment itself.
 *
 * Written as a `Fn` so it lands on the builder's current stack in the same way `morphReference`
 * and `skinning` do — the emitted statement order in the vertex shader is what makes the
 * `positionPrevious -> skinning -> velocity` chain work.
 */
const previousMorphedPosition = /*@__PURE__*/ Fn( ( [ mesh, mode ] ) => {

    const { geometry } = mesh;
    const targetCount = geometry.morphAttributes.position.length;

    const { texture: offsetMap, width } = morphOffsetTexture( geometry );
    const state = previousInfluenceState( mesh, targetCount, mode );

    const widthNode = int( width );

    positionPrevious.assign( positionGeometry.mul( state.base ) );

    Loop( targetCount, ( { i } ) => {

        const influence = float( state.influences.element( i ) ).toVar();

        // Same shape as `Morph.js`'s own loop: a target at zero weight contributes nothing, and
        // skipping its texel fetch is most of why 89 targets cost 0.219 ms rather than 89 x that.
        If( influence.notEqual( 0 ), () => {

            const texelIndex = int( vertexIndex );
            const y = texelIndex.div( widthNode );
            const x = texelIndex.sub( y.mul( widthNode ) );

            const offset = textureLoad( offsetMap, ivec2( x, y ) ).depth( i ).xyz;

            positionPrevious.addAssign( offset.mul( influence ) );

        } );

    } );

}, 'void' );

/**
 * The per-mesh influence state, and the one-frame delay that makes `exact` exact.
 *
 * `mode: 'hold'` binds the mesh's LIVE influence array, so the previous position equals the
 * current one and morphs contribute no velocity.
 *
 * `mode: 'exact'` binds a separate array holding frame N-1's weights. Two buffers are needed, not
 * one: by the time any node update runs, the application has already written frame N's weights
 * into `mesh.morphTargetInfluences`, so "copy the mesh's array" would capture the present. The
 * shift is therefore `previous <- lastSeen` then `lastSeen <- current`, guarded on `frameId` so a
 * mesh drawn twice in one frame (shadow pass, then the G-buffer) shifts once.
 *
 * ⚠️ Both arrays start as copies of the current weights rather than as zeros. Starting at zero
 * would make the FIRST frame report the full morph offset as a velocity — precisely the defect
 * this file removes, reintroduced for one frame, on the frame a `?freeze` plate captures.
 */
function previousInfluenceState( mesh, targetCount, mode ) {

    if ( mode === 'hold' ) {

        return {
            influences: uniformArray( mesh.morphTargetInfluences, 'float' ),
            base: baseUniformFollowing( mesh, mesh.morphTargetInfluences )
        };

    }

    let state = _previousInfluences.get( mesh );

    if ( state === undefined || state.count !== targetCount ) {

        const previous = Float32Array.from( mesh.morphTargetInfluences );
        const lastSeen = Float32Array.from( mesh.morphTargetInfluences );

        state = {
            count: targetCount,
            previous,
            lastSeen,
            lastSeenBase: baseValueFor( mesh ),
            frameId: -1,
            influences: uniformArray( previous, 'float' ),
            base: uniform( baseValueFor( mesh ) )
        };

        _previousInfluences.set( mesh, state );

    }

    OnObjectUpdate( ( { object, frameId } ) => {

        const live = _previousInfluences.get( object );

        // 🚩 A LATENT CAPTURE HAZARD, RECORDED WHERE THE MECHANISM LIVES. `live.frameId` is seeded
        // from whatever `nodeFrame.frameId` this mesh was last DRAWN at, which on a page that
        // renders during boot is a BOOT frame index. `?capture`'s `takeOverFrameLoop` resets
        // `nodeFrame.frameId` to 0 and counts up again — and nothing resets `live.frameId`. If a
        // page's boot frame count lands inside the captured range, the shift below is skipped for
        // exactly one captured frame, silently, and WHICH frame depends on the machine.
        //
        // This is a member of the class punch-list 3.20 names: renderer-side per-frame state that
        // `?capture` does not put at a known value. Measured, and only PARTLY attributed — on the
        // pre-fix dressed `alive.html`, `?morphvel=hold` was reproducible 3 of 3 where `exact` and
        // `off` were 1 of 3, and deleting this guard moved the outcome to 3 of 4 WITHOUT closing
        // it. So this is implicated and is not the whole of it; do not read the note as a full
        // attribution.
        //
        // `alive.html` is immune as of 9.22 because it no longer draws the figure during boot — the
        // fix removed the INPUT rather than enumerating the counters, which is the only move that
        // closes an open set. ⚠️ Two pages still render during boot and still carry this:
        // `packages/testbed/src/wardrobe.js` and `packages/testbed/src/post.js`. Capture from
        // either and this is a candidate before the renderer is.
        //
        // The clean repair, if a third page ever needs it, is an exported epoch reset that clears
        // every live `frameId` to -1, called beside `stage.temporal?.resetFrameEpoch?.()`.
        if ( live === undefined || live.frameId === frameId ) return;

        live.frameId = frameId;

        live.previous.set( live.lastSeen );
        live.base.value = live.lastSeenBase;

        live.lastSeen.set( object.morphTargetInfluences );
        live.lastSeenBase = baseValueFor( object );

        live.influences.update();

    } );

    return state;

}

/**
 * three's `base`, live: 1 for relative targets, `1 - sum(weights)` for absolute ones, which is how
 * `Morph.js` keeps an absolute target set normalised.
 */
function baseValueFor( mesh ) {

    if ( mesh.geometry.morphTargetsRelative === true ) return 1;

    let total = 0;
    for ( const weight of mesh.morphTargetInfluences ) total += weight;

    return 1 - total;

}

/** `base` for the `hold` mode, which has no history and so simply follows the current weights. */
function baseUniformFollowing( mesh, influences ) {

    const node = uniform( baseValueFor( mesh ) );

    OnObjectUpdate( ( { object } ) => {

        if ( object.morphTargetInfluences !== influences ) return;

        node.value = baseValueFor( object );

    } );

    return node;

}

// --- the offset encoding ------------------------------------------------------------------

/**
 * The shape of the array texture for a vertex count, mirroring `Morph.js`'s own packing so the two
 * are comparable: one texel per vertex, rows of at most 4096, as many layers as there are targets.
 */
function offsetTextureShape( vertexCount ) {

    let width = vertexCount;
    let height = 1;

    if ( width > MAX_TEXTURE_SIZE ) {

        height = Math.ceil( width / MAX_TEXTURE_SIZE );
        width = MAX_TEXTURE_SIZE;

    }

    return { width, height };

}

/**
 * Encodes one geometry's position morph offsets, once, and caches it against the geometry.
 *
 * Disposed with the geometry, in the same way `Morph.js` disposes its own — a figure swapped for a
 * different gender bake otherwise leaks 23 MB per swap.
 */
function morphOffsetTexture( geometry ) {

    const targets = geometry.morphAttributes.position;
    let entry = _offsetTextures.get( geometry );

    if ( entry !== undefined && entry.count === targets.length ) return entry;

    if ( entry !== undefined ) entry.texture.dispose();

    const { width, height } = offsetTextureShape( geometry.attributes.position.count );
    const layerFloats = width * height * FLOATS_PER_TEXEL;
    const buffer = new Float32Array( layerFloats * targets.length );

    for ( let target = 0; target < targets.length; target += 1 ) {

        const attribute = targets[ target ];
        const layerOffset = layerFloats * target;

        for ( let vertex = 0; vertex < attribute.count; vertex += 1 ) {

            const texel = layerOffset + vertex * FLOATS_PER_TEXEL;

            buffer[ texel + 0 ] = attribute.getX( vertex );
            buffer[ texel + 1 ] = attribute.getY( vertex );
            buffer[ texel + 2 ] = attribute.getZ( vertex );

        }

    }

    const texture = new DataArrayTexture( buffer, width, height, targets.length );
    texture.type = FloatType;
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.needsUpdate = true;

    entry = { texture, width, height, count: targets.length };
    _offsetTextures.set( geometry, entry );

    const dispose = () => {

        texture.dispose();
        _offsetTextures.delete( geometry );
        geometry.removeEventListener( 'dispose', dispose );

    };

    geometry.addEventListener( 'dispose', dispose );

    return entry;

}
