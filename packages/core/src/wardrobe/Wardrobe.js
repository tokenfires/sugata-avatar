/**
 * Wardrobe — punch-list 9.3. `dress(ids)` and `undress()` on a live figure, at runtime.
 *
 * THE PROBLEM THIS CLASS EXISTS TO SOLVE
 * --------------------------------------
 * A garment does not sit on top of the body. It REPLACES a region of it. MakeHuman's mhclo
 * carries a `delete_verts` list for exactly that reason, and it is load-bearing rather than an
 * optimisation: with body hiding stripped, **525 body vertices sit within 2 mm outside the suit
 * shell, 152 of them within 0.5 mm** — z-fighting across the whole torso. With hiding on that
 * collapses to **9 vertices within 2 mm**, all at the garment's own boundary
 * (`docs/research/wardrobe-system.md` §1.2).
 *
 * The pipeline's own answer is a Blender MASK modifier baked at export, and it is fatal here:
 * **a body whose torso has been deleted cannot undress.** So `build_figure.py --hide-mask-attribute`
 * ships the same vertex set as a per-vertex `_HIDE_<ID>` attribute on the whole body, and this
 * class rebuilds the body's index buffer from the union of whichever masks are currently worn.
 *
 * That is not an approximation of the bake. Measured, this repo, g050:
 *
 *     union of _hide_female_casualsuit01 + _hide_shoes01  ->  17,012 triangles
 *     baked build, same two garments                      ->  17,012 triangles
 *     _hide_female_casualsuit01 alone                     ->  21,380 triangles
 *     baked build, suit alone                             ->  21,380 triangles
 *     no mask at all (undressed)                          ->  26,756 triangles
 *
 * `wardrobe.selftest.mjs` re-measures those and — because a count is a weak identity — also
 * compares the kept triangles as a SET of centroids against the baked build, so a mask that
 * flagged the wrong vertices in the right quantity cannot pass.
 *
 * ⚠️ **That sentence stood alone for a round and it was not enough, because a centroid is a MEAN
 * and a mean is invariant under the permutation that matters.** Reversing the winding of every
 * triangle this class rebuilds left the count identical, the centroid multiset identical, and every
 * one of the gate's assertions green — on a body that does not render, since `Human.body` is
 * `doubleSided: false` and a back-facing triangle is culled. The gate now also compares the kept
 * triangles as ORIENTED CORNER TRIPLES (position + UV, canonicalised over rotations only), and
 * asserts intrinsically that every kept triangle's geometric normal agrees with its shading
 * normal — in BOTH regimes, because the restore branch below has no baked artefact to be compared
 * against and a defect there is visible to nothing else.
 *
 * ## Why fragments, and why atomically
 *
 * Garments arrive as their own small GLBs, fetched on demand. Research §3.5 chose that over one
 * atlas GLB because **textures are 81% of a one-garment figure and 87% of a three-garment one**,
 * and VRAM is the wardrobe's binding constraint; a fragment holds only what is worn. Geometry is
 * free either way — a fully dressed figure has FEWER triangles than a nude one, 35,784 against
 * 36,924, because `delete_verts` removes more body than the garment adds.
 *
 * **Every fragment an outfit needs is loaded BEFORE anything on screen changes.** `dress()` awaits
 * all its fetches, then applies the whole outfit in one synchronous block: index rebuild, removals
 * and additions together. No frame can observe a half-applied outfit, which is what makes 9.8's
 * decency invariant enforceable at intermediate states and not just at the endpoints.
 *
 * ## Rebinding, and why the joint order is remapped rather than assumed
 *
 * A fragment GLB carries a copy of the rig, because a skinned glTF mesh has to name its joints.
 * That copy is thrown away: the garment is bound to the FIGURE's live skeleton so it deforms with
 * everything else. The joint arrays are remapped **by bone name**, not by position. Measured on
 * this build the remap is the identity — both GLBs export MPFB's 53-bone `game_engine` rig in the
 * same order — but assuming that is how a rig change becomes a garment that hangs off the wrong
 * limb with no error anywhere. `stats().jointRemapIsIdentity` reports which case you are in.
 *
 * ## 🎯 Where 9.8's decency invariant plugs in — it is one function, and it is already called
 *
 * Pass `decencyFloor`, a function returning the garment ids that must be worn in every reachable
 * state. **`#resolveOutfit` unions it into every outfit, and `dress()`, `undress()`, `putOn()` and
 * `takeOff()` all go through `#resolveOutfit`** — there is no path to the body that skips it.
 * `undress()` is therefore "return to the floor", not "remove everything", and its behaviour with
 * a floor of `[]` is the degenerate case rather than the design. `FoundationLayer` (9.8) is what
 * supplies the floor in practice; nothing in this class knows its name.
 *
 * ## 🎯 `_UNDER_*`: how a garment that can never be removed is still not drawn through a coat
 *
 * 9.8's foundation garments are conformal shells 3 mm off the skin, and the skin they are cut from
 * pokes through `female_casualsuit01` at rest — 26.37% of the covered vertices, worst depth
 * 9.19 mm (punch-list 9.4). On the BODY that does not matter, because the suit's `_HIDE_*` mask
 * deletes the skin underneath. A bra worn under the same suit has no such mask and would poke
 * through it everywhere the skin would.
 *
 * So a garment fragment may carry `_UNDER_<other garment>` attributes, written by
 * `build_figure.py` as a rename of the body's own `_hide_<other garment>` — the same vertices,
 * because a shell cut from the body inherits the body's mapping exactly. This class rebuilds a
 * garment's index buffer from the union of the `_UNDER_*` masks of whatever OPAQUE garments are
 * worn OUTSIDE it, by the same code that rebuilds the body's.
 *
 * ⚠️ **This is not removal and it does not weaken 9.8.** The garment is still worn, still in
 * `worn`, still in every stat; the part of it that is not drawn is the part an opaque garment is
 * covering, which is exactly the condition under which the decency invariant is satisfied by that
 * garment instead. `occlusionOf()` reports it per garment so a gate can assert the pairing rather
 * than trust it, and a MASK or BLEND garment is refused the privilege — you can see through those.
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * How a hide-mask attribute name in the manifest is matched against one in the GLB.
 *
 * 🚩 Blender's glTF exporter UPPER-CASES custom attribute names. Authored `_hide_shoes01`, the
 * file carries `_HIDE_SHOES01`, and three.js keeps the exported spelling. Verified on the built
 * file. Every lookup here lowercases both sides.
 */
function normaliseAttributeName( name ) {

    return name.toLowerCase();

}

/** The prefix a garment carries the region it sits underneath another garment in. See the header. */
const UNDER_MASK_PREFIX = '_under_';

/** The prefix the BODY carries a garment's deleted region under. */
const HIDE_MASK_PREFIX = '_hide_';

/** Every `_hide_*` / `_under_*` attribute on a geometry, keyed by its lowercased name. */
function maskAttributesOf( geometry, prefix ) {

    const found = new Map();

    for ( const [ name, attribute ] of Object.entries( geometry.attributes ) ) {

        if ( normaliseAttributeName( name ).startsWith( prefix ) === false ) continue;

        found.set( normaliseAttributeName( name ), attribute );

    }

    return found;

}

/**
 * A per-vertex 0/1 array over the union of the named masks, or null when nothing is hidden.
 *
 * Exported as a free function because the body and every garment run the same union: the body's
 * masks are named `_hide_<id>` and a garment's are named `_under_<id>`, and past the naming there
 * is one rule.
 */
function unionOfMasks( attributes, names, vertexCount ) {

    const present = names
        .map( ( name ) => attributes.get( normaliseAttributeName( name ) ) )
        .filter( ( attribute ) => attribute !== undefined );

    if ( present.length === 0 ) return null;

    const hidden = new Uint8Array( vertexCount );

    for ( const attribute of present ) {

        for ( let vertex = 0; vertex < vertexCount; vertex += 1 ) {

            // Exported as FLOAT. Anything above a half is flagged; the writer only ever sets
            // 0.0 or 1.0, and a threshold beats an equality test on a float that has been
            // through a file.
            if ( attribute.getX( vertex ) > 0.5 ) hidden[ vertex ] = 1;

        }

    }

    return hidden;

}

/**
 * Rewrites a geometry's index buffer to the triangles none of whose vertices is hidden.
 *
 * 🚩 **THE ORDER `a, b, c` IS LOAD-BEARING IN BOTH BRANCHES.** The body is backface culled, so a
 * triangle written the other way round is not drawn — and reordering an index buffer is exactly
 * the shape a plausible cache-locality "optimisation" takes. Two of them were tried against this
 * function: a full reversal, and a canonicalisation putting the lowest index first, which reverses
 * 6,897 of 21,380 triangles. Both leave the count and the centroid multiset untouched.
 * `wardrobe.selftest.mjs` catches both; nothing else in the repo does.
 *
 * "Any vertex hidden drops the triangle" is not a choice either — it is what Blender's MASK
 * modifier does, and reproducing the bake exactly is the whole claim.
 *
 * The index array is edited in place and the tail is cut off with `drawRange` rather than
 * reallocated: same GPU buffer, one upload, and the full triangle list is still there to restore
 * from when the garment comes off.
 */
function rebuildIndex( geometry, fullIndex, hidden ) {

    const index = geometry.index;

    if ( hidden === null ) {

        index.array.set( fullIndex );
        index.needsUpdate = true;
        geometry.setDrawRange( 0, fullIndex.length );
        return fullIndex.length;

    }

    const target = index.array;
    let written = 0;

    for ( let offset = 0; offset < fullIndex.length; offset += 3 ) {

        const a = fullIndex[ offset ];
        const b = fullIndex[ offset + 1 ];
        const c = fullIndex[ offset + 2 ];

        if ( hidden[ a ] === 1 || hidden[ b ] === 1 || hidden[ c ] === 1 ) continue;

        target[ written ] = a;
        target[ written + 1 ] = b;
        target[ written + 2 ] = c;
        written += 3;

    }

    index.needsUpdate = true;
    geometry.setDrawRange( 0, written );

    return written;

}

export class Wardrobe {

    /**
     * @param {Figure} figure - A loaded figure. `figure.body` must be the skinned body mesh and
     *   must carry the `_HIDE_*` attributes — i.e. built with `--hide-mask-attribute`.
     * @param {GarmentManifest} manifest
     * @param {Object} [options]
     * @param {string} [options.figureKey='g050'] - Which per-figure fragment to fetch. A garment
     *   fragment CANNOT be shared across the five figures: `female_casualsuit01` drifts mean
     *   95.145 mm / max 143.066 mm between g000 and g100, and cross-fitting puts 84.4% of the
     *   covered skin outside the cloth (research §3.3).
     * @param {() => string[]} [options.decencyFloor] - Punch-list 9.8's hook. See the header.
     * @param {(url: string) => Promise<Object>} [options.loadFragment] - Fetches and parses one
     *   fragment GLB, given the URL the manifest resolves to. Injected so the node selftest can
     *   read from disk.
     */
    constructor( figure, manifest, options = {} ) {

        this.figure = figure;
        this.manifest = manifest;

        this.figureKey = options.figureKey ?? 'g050';
        this.decencyFloor = options.decencyFloor ?? ( () => [] );
        this.loadFragment = options.loadFragment ?? defaultFragmentLoader;

        this.body = figure.body;

        if ( this.body === null || this.body === undefined ) {

            throw new Error( 'Wardrobe: the figure has no body mesh to dress.' );

        }

        // The undressed index buffer, kept whole. Every rebuild starts from this, so dressing and
        // undressing cannot accumulate drift — the body is never edited, only re-indexed.
        const index = this.body.geometry.index;

        if ( index === null ) {

            throw new Error( 'Wardrobe: the body geometry is not indexed, so there is no index ' +
                'buffer to rebuild.' );

        }

        this.fullIndex = index.array.slice();
        this.fullTriangleCount = this.fullIndex.length / 3;

        // 🚩 A geometry with material groups ignores drawRange entirely — three renders the groups
        // instead. The body has exactly one material, so a group here means the pipeline changed
        // under us and the hide rebuild would silently do nothing.
        if ( this.body.geometry.groups.length > 1 ) {

            throw new Error( `Wardrobe: the body geometry has ${ this.body.geometry.groups.length } ` +
                'material groups; drawRange would be ignored and hiding would silently fail.' );

        }

        this.hideAttributes = maskAttributesOf( this.body.geometry, HIDE_MASK_PREFIX );
        this.#warnIfNoHideMasks();
        this.fragments = new Map();      // garment id -> { mesh, jointRemapIsIdentity }
        this.wornMeshes = new Map();     // garment id -> SkinnedMesh currently in the scene
        this.worn = [];                  // garment ids, innermost first

        this.lastDressMs = 0;
        this.lastRebuildMs = 0;

        // A fresh geometry's drawRange is (0, Infinity). Normalising it here means `stats()`
        // reports a real triangle count before the first `dress()` rather than Infinity.
        this.#rebuildBodyIndex( [] );

        // 🚩 THE FRAME BETWEEN CONSTRUCTION AND THE FIRST `dress()`, which is a real frame.
        //
        // A wardrobe is built over a figure that is already in the scene, and the first outfit has
        // to fetch its fragments over the network before anything can be worn. Every frame drawn
        // in that window is a bare body — measured by `decency.selftest.mjs`, which samples the
        // live scene at every point the event loop can yield during a change and found six
        // indecent samples, all of them in the first dress.
        //
        // So a figure with a decency floor does not DRAW until the floor is on. Not "is dressed
        // in a placeholder", not "fades in" — not drawn, which is the only state that is
        // guaranteed decent. A wardrobe with no floor is unchanged: `alive.html?wear=…` passes no
        // `decencyFloor`, so `hasFloor` is false and the body is visible exactly as before.
        this.dressedAtLeastOnce = false;
        this.body.visible = this.#hasFloor() === false;

    }

    /**
     * Loads a manifest and returns a Wardrobe over the given figure.
     *
     * @param {Figure} figure
     * @param {string} manifestUrl
     * @param {Object} [options] - As the constructor.
     */
    static async create( figure, manifestUrl, options = {} ) {

        const { GarmentManifest } = await import( './GarmentManifest.js' );
        return new Wardrobe( figure, await GarmentManifest.load( manifestUrl ), options );

    }

    /**
     * Wears exactly this outfit, plus whatever the decency floor requires. Absolute, not additive.
     *
     * Rejects an outfit whose garments would interpenetrate before it touches anything, because
     * MPFB will not: two suits at the same layer both attach, both delete groups apply as a union,
     * and there is no warning (research §2.2).
     *
     * @param {string[]} garmentIds
     * @returns {Promise<Object>} the same shape as `stats()`
     */
    async dress( garmentIds ) {

        const outfit = this.#resolveOutfit( garmentIds );

        const conflicts = this.manifest.conflicts( outfit );

        if ( conflicts.length > 0 ) {

            throw new Error( `Wardrobe: this outfit cannot be worn:\n  ${ conflicts.join( '\n  ' ) }` );

        }

        // Fetch first, mutate second. Nothing on screen changes until every fragment is in hand,
        // so there is no frame in which the body is unmasked and the garment is not yet there.
        for ( const id of outfit ) await this.#fragmentFor( id );

        const startedAt = now();
        this.#applyOutfit( outfit );
        this.lastDressMs = now() - startedAt;

        return this.stats();

    }

    /**
     * Returns to the decency floor — today that is nothing, and when 9.8 lands it is the
     * foundation layer. Deliberately NOT "remove every garment": see the header.
     */
    async undress() {

        return this.dress( [] );

    }

    /** Adds garments to what is already worn. */
    async putOn( garmentIds ) {

        return this.dress( [ ...this.worn, ...garmentIds ] );

    }

    /** Removes garments from what is worn. The floor is re-added by `#resolveOutfit`. */
    async takeOff( garmentIds ) {

        const removing = new Set( garmentIds );
        return this.dress( this.worn.filter( ( id ) => removing.has( id ) === false ) );

    }

    /** What is worn, what it costs, and what the body currently draws. */
    stats() {

        return {
            worn: [ ...this.worn ],
            bodyVisible: this.body.visible,
            bodyTriangles: this.body.geometry.drawRange.count / 3,
            fullBodyTriangles: this.fullTriangleCount,
            hiddenTriangles: this.fullTriangleCount - this.body.geometry.drawRange.count / 3,
            garmentTriangles: this.worn.reduce(
                ( total, id ) => total + this.fragments.get( id ).drawnTriangles, 0 ),
            occlusion: this.occlusionOf(),
            drawCalls: 1 + this.wornMeshes.size,
            residentFragments: this.fragments.size,
            insulation: this.manifest.insulationOf( this.worn ),
            lastDressMs: this.lastDressMs,
            lastRebuildMs: this.lastRebuildMs,
            jointRemapIsIdentity: [ ...this.fragments.values() ]
                .every( ( fragment ) => fragment.jointRemapIsIdentity )
        };

    }

    /**
     * Per worn garment: how much of it is drawn, and which OPAQUE outer garments cover the rest.
     *
     * 🎯 This is what makes `_UNDER_*` auditable rather than a claim. 9.8's invariant is that the
     * foundation layer is worn in every reachable state; the interesting question is whether the
     * part of it that is NOT drawn is exactly the part something opaque is covering, and a gate
     * can only ask that if the runtime says which garment did the covering.
     */
    occlusionOf() {

        return this.worn.map( ( id ) => {

            const fragment = this.fragments.get( id );

            return {
                id,
                drawnTriangles: fragment.drawnTriangles,
                fullTriangles: fragment.fullTriangles,
                occludedBy: [ ...fragment.occludedBy ],
                carriesUnderMasks: fragment.underMasks.size > 0
            };

        } );

    }

    /** Hide-mask attribute names the body actually carries, in the file's own spelling. */
    availableHideMasks() {

        return [ ...this.hideAttributes.keys() ];

    }

    /**
     * Frees a garment's GPU memory and forgets it, so putting it back on refetches.
     *
     * A garment taken off stays cached by default, because the second wearing is then free and an
     * avatar changing outfits by mood will wear the same few things repeatedly. That is a
     * deliberate trade AGAINST research §3.4, which names VRAM as the wardrobe's binding
     * constraint — one 4096² RGBA8 normal is ≈85 MB resident with mips, and the measured fragment
     * for `female_casualsuit01` carries 8.76 MB of PNG for two maps. So the trade needs an escape
     * hatch, and this is it: call `release` on what the avatar is done with.
     *
     * A worn garment is refused rather than pulled off the figure underneath the caller.
     */
    release( id ) {

        if ( this.wornMeshes.has( id ) ) {

            throw new Error( `Wardrobe: '${ id }' is being worn. Take it off before releasing it.` );

        }

        const fragment = this.fragments.get( id );
        if ( fragment === undefined ) return false;

        fragment.mesh.geometry.dispose();

        for ( const value of Object.values( fragment.mesh.material ) ) {

            if ( value !== null && value?.isTexture === true ) value.dispose();

        }

        fragment.mesh.material.dispose();
        this.fragments.delete( id );

        return true;

    }

    // --- the outfit ------------------------------------------------------------------------

    /**
     * 🎯 The single funnel every outfit passes through, and 9.8's insertion point.
     *
     * De-duplicates, unions in the decency floor, and sorts innermost-first so two runs of the
     * same outfit dress in the same sequence and a diff against the worn set is comparable.
     */
    #resolveOutfit( garmentIds ) {

        const wanted = new Set( [ ...this.decencyFloor(), ...garmentIds ] );

        for ( const id of wanted ) this.manifest.require( id );

        return this.manifest.sortByLayer( [ ...wanted ] );

    }

    /**
     * Puts the outfit on, synchronously and completely. Every fragment is already loaded.
     *
     * Order is deliberate: rebuild the body first, then remove what is leaving, then add what is
     * arriving. All three happen inside one call, between two frames.
     */
    #applyOutfit( outfit ) {

        const startedAt = now();
        this.#rebuildBodyIndex( this.manifest.hideMasksFor( outfit ) );
        this.#rebuildGarmentIndices( outfit );
        this.lastRebuildMs = now() - startedAt;

        const arriving = new Set( outfit );

        for ( const [ id, mesh ] of this.wornMeshes ) {

            if ( arriving.has( id ) ) continue;

            mesh.removeFromParent();
            this.wornMeshes.delete( id );

        }

        for ( const id of outfit ) {

            if ( this.wornMeshes.has( id ) ) continue;

            const mesh = this.fragments.get( id ).mesh;
            this.body.parent.add( mesh );
            this.wornMeshes.set( id, mesh );

        }

        this.worn = outfit;

        // The floor is on. From here the body draws, and never stops.
        this.dressedAtLeastOnce = true;
        this.body.visible = true;

    }

    /** Whether a decency floor is configured. A floor that throws counts as one — see the header. */
    #hasFloor() {

        try {

            return this.decencyFloor().length > 0;

        } catch ( error ) {

            console.warn( `Wardrobe: the decency floor threw (${ error.message }). Treating the ` +
                'figure as one that has a floor, so it stays hidden until it is dressed.' );
            return true;

        }

    }

    /** Rebuilds the body's index buffer from the union of the worn garments' hide masks. */
    #rebuildBodyIndex( hideMaskNames ) {

        const geometry = this.body.geometry;
        const hidden = unionOfMasks( this.hideAttributes, hideMaskNames,
            geometry.attributes.position.count );

        rebuildIndex( geometry, this.fullIndex, hidden );

    }

    /**
     * Rebuilds each worn garment's index buffer from what is worn OPAQUE outside it.
     *
     * A garment with no `_UNDER_*` attributes — every mhclo garment in the catalogue — is restored
     * whole every time, which costs one `set()` on an already-resident buffer and means this
     * method has no special case for "the ordinary garment".
     */
    #rebuildGarmentIndices( outfit ) {

        for ( const id of outfit ) {

            const fragment = this.fragments.get( id );
            const geometry = fragment.mesh.geometry;

            // Only garments this fragment actually carries a mask for. Reporting every opaque
            // outer garment as an occluder would name `shoes01` as covering a bra, which is true
            // of the sort order and false of the geometry.
            const covering = outfit.filter( ( other ) => other !== id &&
                this.manifest.orderOf( other ) > this.manifest.orderOf( id ) &&
                this.manifest.get( other ).alphaMode === 'OPAQUE' &&
                fragment.underMasks.has( `${ UNDER_MASK_PREFIX }${ other }` ) );

            const hidden = unionOfMasks( fragment.underMasks,
                covering.map( ( other ) => `${ UNDER_MASK_PREFIX }${ other }` ),
                geometry.attributes.position.count );

            const drawn = rebuildIndex( geometry, fragment.fullIndex, hidden );

            fragment.drawnTriangles = drawn / 3;
            fragment.occludedBy = hidden === null ? [] : covering;

        }

    }

    /**
     * 🚩 An empty hide-mask map is the silent failure this whole path is exposed to: Blender's
     * glTF exporter has `export_attributes` OFF by default, and a build without it succeeds,
     * reports success, and produces a figure that can wear a garment and never hide anything under
     * it. So an empty map is not treated as "no garments in the catalogue" — the caller is told,
     * once, at load.
     */
    #warnIfNoHideMasks() {

        if ( this.hideAttributes.size > 0 ) return;

        console.warn( 'Wardrobe: the body carries no _HIDE_* attributes. Rebuild it with ' +
            '`build_figure.py --hide-mask-attribute` — without them a garment will be worn ' +
            'over a body that is still fully drawn underneath it.' );

    }

    // --- fragments -------------------------------------------------------------------------

    /** Loads one garment fragment, rebinds it to the figure's skeleton, and caches it. */
    async #fragmentFor( id ) {

        const cached = this.fragments.get( id );
        if ( cached !== undefined ) return cached;

        const gltf = await this.loadFragment( this.manifest.fragmentUrl( id, this.figureKey ) );
        const fragment = this.#adoptFragment( id, gltf );

        this.fragments.set( id, fragment );

        return fragment;

    }

    /**
     * Takes the skinned mesh out of a fragment GLB and binds it to the figure's own skeleton.
     *
     * The fragment's copy of the rig is discarded. What is kept is the geometry, the material and
     * the skin weights — and the joint indices are rewritten through a name lookup into the
     * figure's skeleton, so a rig whose bone ORDER changed produces a loud error here rather than
     * a garment that follows the wrong limb.
     */
    #adoptFragment( id, gltf ) {

        let garmentMesh = null;
        gltf.scene.traverse( ( object ) => {

            if ( object.isSkinnedMesh === true && garmentMesh === null ) garmentMesh = object;

        } );

        if ( garmentMesh === null ) {

            throw new Error( `Wardrobe: the fragment for '${ id }' contains no SkinnedMesh.` );

        }

        const remap = this.#jointRemapFor( id, garmentMesh.skeleton );
        const identity = remap.every( ( target, source ) => target === source );

        if ( identity === false ) rewriteJointIndices( garmentMesh.geometry, remap );

        garmentMesh.name = `garment_${ id }`;
        garmentMesh.removeFromParent();

        // The skinning shader still multiplies by the mesh's own world matrix, so a garment that
        // is not posed like the body it was fitted to would be skinned correctly and drawn in the
        // wrong place. Both come off the same rig at identity, and this keeps them that way.
        garmentMesh.position.copy( this.body.position );
        garmentMesh.quaternion.copy( this.body.quaternion );
        garmentMesh.scale.copy( this.body.scale );

        garmentMesh.bind( this.figure.skeleton ?? this.body.skeleton, this.body.bindMatrix );

        // A garment is skinned to the same bones as the body, so it is inside the same shadow and
        // frustum volume; three's per-object cull would otherwise use the fragment's own bind-pose
        // bounds, which do not follow the pose.
        garmentMesh.frustumCulled = false;

        return {
            mesh: garmentMesh,
            jointRemapIsIdentity: identity,
            underMasks: maskAttributesOf( garmentMesh.geometry, UNDER_MASK_PREFIX ),
            fullIndex: garmentMesh.geometry.index.array.slice(),
            fullTriangles: garmentMesh.geometry.index.count / 3,
            drawnTriangles: garmentMesh.geometry.index.count / 3,
            occludedBy: []
        };

    }

    /** For each joint slot in the fragment's skeleton, which slot the figure's skeleton uses. */
    #jointRemapFor( id, fragmentSkeleton ) {

        const figureSkeleton = this.figure.skeleton ?? this.body.skeleton;
        const byName = new Map( figureSkeleton.bones.map( ( bone, slot ) => [ bone.name, slot ] ) );

        return fragmentSkeleton.bones.map( ( bone ) => {

            const slot = byName.get( bone.name );

            if ( slot === undefined ) {

                throw new Error( `Wardrobe: '${ id }' is skinned to a bone named '${ bone.name }' ` +
                    'that the figure\'s skeleton does not have.' );

            }

            return slot;

        } );

    }

}

/** Rewrites a skinned geometry's joint indices through a slot remap, in place. */
function rewriteJointIndices( geometry, remap ) {

    const skinIndex = geometry.attributes.skinIndex;

    for ( let vertex = 0; vertex < skinIndex.count; vertex += 1 ) {

        skinIndex.setXYZW(
            vertex,
            remap[ skinIndex.getX( vertex ) ],
            remap[ skinIndex.getY( vertex ) ],
            remap[ skinIndex.getZ( vertex ) ],
            remap[ skinIndex.getW( vertex ) ] );

    }

    skinIndex.needsUpdate = true;

}

async function defaultFragmentLoader( url ) {

    return new GLTFLoader().loadAsync( url );

}

function now() {

    return typeof performance !== 'undefined' ? performance.now() : Date.now();

}
