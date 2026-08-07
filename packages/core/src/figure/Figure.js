/**
 * Figure — one clean surface over the six meshes a built figure actually arrives as.
 *
 * THE PROBLEM THIS CLASS EXISTS TO SOLVE
 * --------------------------------------
 * A figure GLB is not one mesh. It is six: the body (`Human`), plus teeth, tongue, eyelashes,
 * eyebrows and eyeballs. The morph targets are spread across all six, and — this is the part
 * that bites — many of them live on SEVERAL meshes at once. Measured on figure_g050:
 *
 *     jawOpen         -> Human, Humaneyebrow001, Humanteeth_base, Humantongue01   (4 meshes)
 *     eyeLookUpLeft   -> Human, Humaneyebrow001, Humaneyelashes01, Humanlow-poly  (4 meshes)
 *     eyeBlinkLeft    -> Human, Humaneyebrow001, Humaneyelashes01                 (3 meshes)
 *     tongueOut       -> Human, Humantongue01                                     (2 meshes)
 *
 * Setting `body.morphTargetInfluences[dict.jawOpen] = 1` opens the lips and leaves the teeth
 * and tongue behind inside the head. Every caller that touches a morph would otherwise have to
 * know that, and would have to know it correctly, every time. So the registry is built ONCE at
 * load — name -> [{ influences, index }] over every mesh that carries it — and `setMorph(name, w)`
 * writes every location. That single mapping is the whole point of the class.
 *
 * THE PER-FRAME APPLY MODEL
 * -------------------------
 * Blink, gaze, lipsync, breath and affect all want to move overlapping shapes on the same frame.
 * If each of them called setMorph directly they would clobber each other in registration order,
 * and the last writer would win. So the normal path is accumulate-then-commit:
 *
 *     figure.beginFrame();                     // every layer starts from zero
 *     figure.weights.jawOpen   += 0.40;        // lipsync
 *     figure.weights.jawOpen   += 0.05;        // a surprise reaction, additive
 *     figure.weights.eyeBlinkLeft = 1.0;       // blink owns its own shapes absolutely
 *     figure.commit();                         // one pass out to the influence arrays
 *
 * `weights` is a plain object carrying every morph name, so layers can read what came before
 * them and add to it. `commit()` clamps to [0,1] on the way out — outside that range the shapes
 * go off-model, and an additive stack will overshoot sooner or later.
 *
 * Cost is not a concern here. Measured on this machine (docs/research, spike 0.8): 69 morph
 * targets animated every frame cost 0.219 ms. Morph targets are essentially free; a couple of
 * hundred float writes per frame are noise beside that.
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * The humanoid bones procedural motion asks for, and the rig-specific names they may arrive
 * under. Candidates are tried in order and matched case-insensitively.
 *
 * The shipped figures use MPFB2's `game_engine` (Unreal-style) skeleton: 53 bones, `pelvis`,
 * `spine_01..03`, `neck_01`, `head`. It has NO jaw bone and NO eye bones — jaw and gaze are
 * morph-driven on this asset (jawOpen, eyeLookUp/Down/In/OutLeft/Right). Absent bones are
 * reported once at load so a motion layer never silently animates `undefined`.
 */
const HUMANOID_BONE_ALIASES = {
    root:       [ 'Root', 'root', 'Armature' ],
    hips:       [ 'pelvis', 'hips', 'mixamorigHips' ],
    spine:      [ 'spine_01', 'spine', 'mixamorigSpine' ],
    chest:      [ 'spine_02', 'chest', 'mixamorigSpine1' ],
    upperChest: [ 'spine_03', 'upperChest', 'mixamorigSpine2' ],
    neck:       [ 'neck_01', 'neck', 'mixamorigNeck' ],
    head:       [ 'head', 'mixamorigHead' ],
    jaw:        [ 'jaw', 'c_jaw', 'jaw_01' ],
    eyeLeft:    [ 'eye_l', 'l_eye', 'LeftEye', 'eye.L', 'eye_left' ],
    eyeRight:   [ 'eye_r', 'r_eye', 'RightEye', 'eye.R', 'eye_right' ]
};

export class Figure {

    constructor( gltf ) {

        this.gltf = gltf;
        this.root = gltf.scene;

        // Every mesh that carries at least one morph target. The body is the skinned one; the
        // other five are plain meshes parented under it.
        this.meshes = [];
        this.body = null;
        this.skeleton = null;

        // name -> [{ influences, index }], one entry per mesh carrying that name. The registry.
        this.morphRegistry = new Map();
        this.morphNames = [];

        // The per-frame accumulator. Plain object, one key per morph name, all zero.
        this.weights = {};

        // Bones, by lowercased rig name, plus the canonical humanoid names resolved once.
        this.bonesByRigName = new Map();
        this.humanoidBones = {};
        this.missingHumanoidBones = [];

        // Unknown-name warnings are emitted once each. A typo that silently does nothing is a
        // bad bug to chase; a warning per frame is a worse one to read past. Morphs and bones
        // keep separate sets because a rig can legitimately name a bone after a shape.
        this.warnedMorphNames = new Set();
        this.warnedBoneNames = new Set();

        this.buildMorphRegistry();
        this.buildBoneIndex();

    }

    /**
     * Loads a figure GLB over the network. The browser path.
     *
     * @param {string} url - e.g. '/assets/figures/figure_g050.glb'
     * @returns {Promise<Figure>}
     */
    static async load( url ) {

        const gltf = await new GLTFLoader().loadAsync( url );
        return new Figure( gltf );

    }

    /**
     * Builds a figure from bytes already in hand. Used by the node self-test, which reads the
     * GLB off disk where fetch cannot reach it, and by any caller that has its own asset cache.
     *
     * @param {ArrayBuffer} arrayBuffer - The whole .glb file.
     * @param {string} [resourcePath=''] - Base path for external resources, if the GLB has any.
     * @returns {Promise<Figure>}
     */
    static async parse( arrayBuffer, resourcePath = '' ) {

        const loader = new GLTFLoader();
        const gltf = await new Promise( ( resolve, reject ) => {

            loader.parse( arrayBuffer, resourcePath, resolve, reject );

        } );

        return new Figure( gltf );

    }

    // --- morphs ----------------------------------------------------------------------------

    /**
     * Sets one morph and pushes it out immediately, to every mesh that carries it.
     *
     * This is the direct path — posing, tests, one-off adjustments. Per-frame animation should
     * go through `weights` + `commit()` instead so layers can stack additively.
     *
     * @param {string} name - An ARKit target, an OVR viseme, or any other name in the asset.
     * @param {number} weight - Clamped to [0,1].
     */
    setMorph( name, weight ) {

        const locations = this.morphRegistry.get( name );

        if ( locations === undefined ) {

            this.warnUnknownMorph( name );
            return;

        }

        const clamped = clampToUnitRange( weight );
        this.weights[ name ] = clamped;

        for ( const location of locations ) {

            location.influences[ location.index ] = clamped;

        }

    }

    /**
     * The intended weight of a morph — what `commit()` would write, not necessarily what is on
     * screen this instant. `weights` is the single source of truth for a figure's pose.
     */
    getMorph( name ) {

        if ( ! this.hasMorph( name ) ) {

            this.warnUnknownMorph( name );
            return 0;

        }

        return this.weights[ name ];

    }

    /**
     * Sets several morphs at once and pushes them out. Sugar over setMorph for expression
     * presets, which are naturally written as a name -> weight object.
     *
     * @param {Object<string, number>} values
     */
    setMorphs( values ) {

        for ( const name in values ) {

            this.setMorph( name, values[ name ] );

        }

    }

    hasMorph( name ) {

        return this.morphRegistry.has( name );

    }

    /**
     * How many meshes carry this name. Mostly a diagnostic — the self-test asserts jawOpen
     * lands on more than one — but a caller building its own registry may want it too.
     */
    morphLocationCount( name ) {

        const locations = this.morphRegistry.get( name );
        return locations === undefined ? 0 : locations.length;

    }

    /**
     * Back to the neutral face, on screen, now. Zeroes the accumulator and commits it.
     */
    resetMorphs() {

        this.beginFrame();
        this.commit();

    }

    /**
     * Start of a frame: clear the accumulator so every motion layer contributes from zero.
     * Deliberately does NOT touch the influence arrays — nothing changes on screen until
     * `commit()`, so a half-built frame is never visible.
     */
    beginFrame() {

        for ( const name of this.morphNames ) {

            this.weights[ name ] = 0;

        }

    }

    /**
     * End of a frame: push the accumulator out to every morph location, clamped to [0,1].
     *
     * One flat pass. Reading each weight once and fanning it out to its locations is both the
     * obvious shape and the cheap one — roughly 215 float writes for the shipped figures.
     */
    commit() {

        for ( const name of this.morphNames ) {

            const weight = clampToUnitRange( this.weights[ name ] );

            for ( const location of this.morphRegistry.get( name ) ) {

                location.influences[ location.index ] = weight;

            }

        }

    }

    // --- bones -----------------------------------------------------------------------------

    /**
     * Looks up a bone by canonical humanoid name ('head', 'neck', 'eyeLeft', 'jaw', ...) or,
     * failing that, by its raw name in the rig. Case-insensitive on the raw path.
     *
     * Returns undefined when the bone does not exist on this rig, and warns once. Callers that
     * can degrade — gaze falling back to eyeLook morphs, jaw to jawOpen — should test for
     * undefined rather than assume; see `missingHumanoidBones`.
     *
     * @param {string} name
     * @returns {import('three').Bone|undefined}
     */
    bone( name ) {

        const humanoid = this.humanoidBones[ name ];
        if ( humanoid !== undefined ) return humanoid;

        const raw = this.bonesByRigName.get( name.toLowerCase() );
        if ( raw !== undefined ) return raw;

        this.warnMissingBone( name );
        return undefined;

    }

    /** Every bone name in the rig, sorted. For diagnostics and for retarget tooling. */
    get boneNames() {

        return [ ...this.bonesByRigName.values() ].map( ( bone ) => bone.name ).sort();

    }

    /**
     * Releases the GPU resources this figure owns. The caller still has to remove `root` from
     * whatever scene it was added to.
     */
    dispose() {

        this.root.traverse( ( object ) => {

            if ( object.isMesh !== true ) return;

            object.geometry.dispose();

            const materials = Array.isArray( object.material ) ? object.material : [ object.material ];
            for ( const material of materials ) {

                if ( material !== null && material !== undefined ) material.dispose();

            }

        } );

        this.morphRegistry.clear();
        this.bonesByRigName.clear();
        this.meshes.length = 0;

    }

    // --- helpers ---------------------------------------------------------------------------

    /**
     * Walks the loaded scene once and inverts three.js's per-mesh `morphTargetDictionary` into
     * a single name -> locations map. This is the load-time half of the class's reason to exist.
     */
    buildMorphRegistry() {

        const names = new Set();

        this.root.traverse( ( object ) => {

            if ( object.isMesh !== true || object.morphTargetDictionary === undefined ) return;

            this.meshes.push( object );

            // Morphed and skinned bounds move with the animation, and three.js culls against
            // the static bind-pose bounding sphere. A face at the edge of frame can pop out.
            // Six meshes is not a culling budget worth defending.
            object.frustumCulled = false;

            for ( const name in object.morphTargetDictionary ) {

                const index = object.morphTargetDictionary[ name ];

                if ( ! this.morphRegistry.has( name ) ) this.morphRegistry.set( name, [] );
                this.morphRegistry.get( name ).push( {
                    mesh: object,
                    influences: object.morphTargetInfluences,
                    index
                } );

                names.add( name );

            }

            // The body is the skinned mesh; the face parts hang off it as plain meshes.
            if ( object.isSkinnedMesh === true && this.body === null ) {

                this.body = object;
                this.skeleton = object.skeleton;

            }

        } );

        this.morphNames = [ ...names ].sort();

        for ( const name of this.morphNames ) {

            this.weights[ name ] = 0;

        }

    }

    /**
     * Indexes the skeleton and resolves the humanoid bones we care about, once. Rigs disagree
     * about naming; alias lists keep that disagreement in one table instead of at every call
     * site, and the absence report keeps a missing bone from becoming a silent no-op later.
     */
    buildBoneIndex() {

        this.root.traverse( ( object ) => {

            if ( object.isBone === true ) this.bonesByRigName.set( object.name.toLowerCase(), object );

        } );

        for ( const canonicalName in HUMANOID_BONE_ALIASES ) {

            for ( const candidate of HUMANOID_BONE_ALIASES[ canonicalName ] ) {

                const bone = this.bonesByRigName.get( candidate.toLowerCase() );
                if ( bone === undefined ) continue;

                this.humanoidBones[ canonicalName ] = bone;
                break;

            }

            if ( this.humanoidBones[ canonicalName ] === undefined ) {

                this.missingHumanoidBones.push( canonicalName );

            }

        }

        if ( this.missingHumanoidBones.length > 0 ) {

            console.warn(
                `Figure: this rig has no ${ this.missingHumanoidBones.join( ', ' ) } bone(s) ` +
                `(${ this.bonesByRigName.size } bones found). Motion layers that need them must ` +
                'fall back — jaw to the jawOpen morph, gaze to the eyeLook* morphs.'
            );

        }

    }

    warnUnknownMorph( name ) {

        if ( this.warnedMorphNames.has( name ) ) return;

        this.warnedMorphNames.add( name );
        console.warn( `Figure: no morph target named '${ name }' on this figure. Ignored.` );

    }

    warnMissingBone( name ) {

        if ( this.warnedBoneNames.has( name ) ) return;

        this.warnedBoneNames.add( name );
        console.warn( `Figure: no bone named '${ name }' on this rig. Returned undefined.` );

    }

}

/**
 * Morph weights outside [0,1] drive the shape past the sculpted extreme, which reads as a
 * broken face rather than a stronger expression. An additive stack of motion layers will
 * overshoot eventually, so the clamp lives at the one point everything passes through.
 */
function clampToUnitRange( weight ) {

    if ( ! ( weight > 0 ) ) return 0;   // also catches NaN and undefined
    if ( weight > 1 ) return 1;
    return weight;

}
