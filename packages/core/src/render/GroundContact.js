/**
 * GroundContact — the floor the figure stands on, and the reason it stops hovering.
 *
 * ## The defect, and why a shadow map was never going to fix it
 *
 * A judge measured the shipped body plate down the column through a sole: the last skin pixel at
 * **luma 0.4789**, the backdrop immediately below it at **0.0735**, falling smoothly to 0.0721
 * fifty-seven pixels further down — 0.0014 of luma over 57 px, which is the backdrop card's own
 * gradient and nothing else. No floor, no contact shadow, no ground darkening of any kind.
 *
 * The instinct is to reach for the shadow map, and `LightingRig` already renders one. It cannot
 * work, and the arithmetic says so before any code is written. Measured on
 * `packages/testbed/src/lighting.html` at full-body framing, the floor next to a sole:
 *
 *   | what is switched off        | floor luma 1 px below the sole |
 *   |-----------------------------|-------------------------------:|
 *   | nothing (shipped rig)       |                         0.3315 |
 *   | rim and kicker at zero      |                         0.1328 |
 *
 * i.e. **60% of the light on the floor at the feet comes from the two backlights**, which cast no
 * shadow because `RectAreaLight` cannot (three.js #14161). Of what is left, the hemisphere ambient
 * casts no shadow either, and the key — the one light with a shadow caster — arrives at 18°
 * elevation from 4.7 m away with only 0.45 of its irradiance in the shadowing half. `docs/PROGRESS
 * .md` records the sweep that established this from the other end: moving the key's elevation
 * 18 → 30 → 42° moved the floor near the feet from 0.3045 to 0.3251 encoded, i.e. nothing.
 *
 * ## What actually darkens ground contact, and what it costs
 *
 * A point on the floor two centimetres from a foot does not see a dark *light*; it sees **less
 * sky**. The cue is occlusion of the whole upper hemisphere, and the reason the render has none is
 * that nothing in the scene occludes ambient at all. So this file computes that occlusion in
 * closed form — Quilez's analytic sphere occlusion for a Lambert receiver, summed over a dozen
 * spheres fitted to the figure — and multiplies it into the ground's albedo.
 *
 * 🚩 **Multiplying the ALBEDO, not just the ambient term, is a deliberate approximation and it is
 * only sound because of what this surface is.** A matte dielectric reflects albedo × irradiance,
 * so scaling the albedo scales the direct and indirect halves together — which is what "this point
 * can see less of everything" means. On a glossy or metallic surface it would be wrong, and on the
 * figure it would be wrong. `three`'s `aoNode` is the physically-scoped alternative and it was
 * measured and rejected: it multiplies `reflectedLight.indirectDiffuse` only, and the indirect
 * term is a minority of the floor's light here (the table above), so the same occlusion applied
 * through `aoNode` moves the near-sole floor by a fraction of what the defect needs.
 *
 * ## Why spheres, and where their radii come from
 *
 * The occlusion integral over a plane is dominated by the nearest occluder, so a crude body proxy
 * is enough — but a proxy with invented radii is a proxy nobody can check. The radii here are
 * **measured off the asset**: `fitTo()` walks the skinned mesh once, assigns every vertex to its
 * dominant bone by skin weight, and takes the 75th percentile of the perpendicular distance from
 * those vertices to that bone's own segment. On `figure_g050.glb` that yields a **46.4 mm foot,
 * 37.3 mm toe ball, 57.7 mm calf, 91.4 mm thigh, 127.6 mm pelvis and 145.6 mm chest** — the
 * numbers a tape measure would give on a 1.70 m figure, and none of them typed in.
 *
 * The spheres then ride the bones, so the contact darkening follows a weight shift, a hip hike or
 * a planted foot without anything having to tell it that the pose changed.
 *
 * ## Cost
 *
 * Measured on `lighting.html?perf=1` at 1920×1080, WebGPU, against the same scene with the ground
 * plane present but `occlusion: false` (`?ground=0`). The loop is 16 spheres of ~20 ALU plus two
 * transcendentals each, over the ground's pixels only, and the measured cost is in the round's
 * report alongside the rig's own 3.6 ms.
 *
 * @example
 * const ground = new GroundContact();
 * ground.attachTo( stage.scene );
 * ground.fitTo( figure.root );        // measures the radii once
 * ground.update();                    // per frame: re-reads the bone world matrices
 */

import {
    Color,
    Matrix4,
    Mesh,
    MeshStandardNodeMaterial,
    PlaneGeometry,
    Vector3,
    Vector4
} from 'three/webgpu';

import { color, Fn, float, Loop, normalWorld, positionWorld, uniformArray, uniform, vec3 } from 'three/tsl';

/**
 * How many spheres the shader loop runs. Not a taste decision — every entry is a per-ground-pixel
 * `acos` and `atan`, and the ground is the largest single surface in a full-body frame. Sixteen is
 * what `OCCLUDER_SEGMENTS` below needs to cover both feet at three spheres each, both legs, the
 * trunk, the head and the arms — everything that can plausibly shadow a floor the figure stands on.
 */
export const MAX_OCCLUDERS = 16;

/**
 * The body, as bone segments, in the order they matter to a FLOOR.
 *
 * Feet first, and with THREE spheres each, because the occlusion integral over a plane is
 * dominated by the nearest occluder and the nearest occluder is always a foot. That was not the
 * first version. One sphere per foot, sitting at the ankle-to-ball midpoint with the measured
 * 46 mm radius, produced a contact pool that fell to 0.65 visibility only 60 mm out and left the
 * TOES with no shadow at all — visible on the plate, because a foot is 230 mm long and a 46 mm
 * sphere covers its middle third. `ball_l`/`ball_r` are tip bones with no child, which is why the
 * fit has to handle those rather than skip them.
 *
 * The list is truncated at `MAX_OCCLUDERS`, so the order IS the priority: a figure with fewer
 * bones loses the tail, and the tail is the arms, which contribute a broad weak term the floor
 * barely reads.
 *
 * `spheres` distributes that many evenly along the segment (a limb is a capsule, and one sphere
 * per capsule under-covers it). `child: null` marks a tip bone: the sphere sits at the bone
 * itself and its axis for the radius fit comes from its parent.
 */
const OCCLUDER_SEGMENTS = [
    { bone: 'foot_l', child: 'ball_l', spheres: 2 },
    { bone: 'foot_r', child: 'ball_r', spheres: 2 },
    { bone: 'ball_l', child: null, spheres: 1 },
    { bone: 'ball_r', child: null, spheres: 1 },
    { bone: 'calf_l', child: 'foot_l', spheres: 1 },
    { bone: 'calf_r', child: 'foot_r', spheres: 1 },
    { bone: 'thigh_l', child: 'calf_l', spheres: 1 },
    { bone: 'thigh_r', child: 'calf_r', spheres: 1 },
    { bone: 'pelvis', child: 'spine_01', spheres: 1 },
    { bone: 'spine_02', child: 'spine_03', spheres: 1 },
    { bone: 'neck_01', child: 'head', spheres: 1 },
    { bone: 'upperarm_l', child: 'lowerarm_l', spheres: 1 },
    { bone: 'upperarm_r', child: 'lowerarm_r', spheres: 1 },
    { bone: 'lowerarm_l', child: 'hand_l', spheres: 1 },
    { bone: 'lowerarm_r', child: 'hand_r', spheres: 1 }
];

/**
 * Which percentile of the dominant vertices' distance-to-axis becomes the sphere radius.
 *
 * The maximum would be captured by one stray vertex — a fingertip weighted to the forearm, a
 * nipple weighted to the chest — and the mean would sit inside the surface because a limb's
 * cross-section is not a shell. 0.75 is the shoulder of that distribution. It is stated here
 * rather than buried in the fit because it is the one number in the fit that IS a choice.
 */
const RADIUS_PERCENTILE = 0.75;

/**
 * The look spec puts the background "1.5–2.0 stops below subject, cooler and desaturated", and
 * §3 adds that the grade drains the environment by 15% of saturation while the character gains 8%.
 *
 * 🚩 The floor's albedo has BLUE AS ITS LOWEST CHANNEL, and that is the correction, not a taste.
 * The previous studio floor was `#2e3036`, whose blue channel is its HIGHEST — under a saturated
 * blue rim that is a mirror, and the measured result was a floor at HSV saturation 0.62 filling
 * the bottom third of every full-body frame. A warm-neutral floor reflects the same rim at a
 * fraction of the chroma while sitting at the same level.
 */
const FLOOR_ALBEDO = 0x4b3520;

/** Extent of the ground plane in framed subject heights. Large enough to leave frame at both. */
const GROUND_EXTENT_IN_HEIGHTS = 12;

// --- the occlusion integral --------------------------------------------------------------------

/**
 * Analytic ambient occlusion of a Lambert receiver by one sphere (Iñigo Quilez, "sphere ambient
 * occlusion", https://iquilezles.org/articles/sphereao/). Closed form, exact, no sampling.
 *
 * Returns the fraction of the receiver's cosine-weighted hemisphere the sphere covers, in 0..1.
 * `groundContact.selftest.mjs` checks it against a 200k-ray Monte-Carlo integration of the same
 * configuration rather than against itself, because a closed form that is subtly wrong is
 * indistinguishable from one that is right when the only test is "does it look darker".
 *
 * ⚠️ Defined for receiver points OUTSIDE the sphere. `h2` is clamped just above 1 so a point that
 * has been swallowed by an occluder returns full occlusion instead of NaN — a NaN here would come
 * out of the shader as a black hole on the floor that no one could attribute.
 *
 * @param {number[]} position - receiver point, world
 * @param {number[]} normal - receiver normal, unit
 * @param {number[]} centre - sphere centre, world
 * @param {number} radius
 * @returns {number} occlusion in 0..1
 */
export function sphereOcclusion( position, normal, centre, radius ) {

    const dx = centre[ 0 ] - position[ 0 ];
    const dy = centre[ 1 ] - position[ 1 ];
    const dz = centre[ 2 ] - position[ 2 ];

    const distance = Math.hypot( dx, dy, dz );
    if ( distance < 1e-6 ) return 1;

    const cosine = ( normal[ 0 ] * dx + normal[ 1 ] * dy + normal[ 2 ] * dz ) / distance;

    const h2 = Math.max( ( distance / radius ) ** 2, 1.0001 );
    const k2 = 1 - h2 * cosine * cosine;

    // k2 <= 0 is the sphere sitting entirely on one side of the horizon plane. There the exact
    // form's inner square roots go imaginary and the distant-sphere solid angle is exact anyway.
    if ( k2 <= 0.001 ) return Math.max( 0, cosine ) / h2;

    const inner = Math.min( 1, Math.max( -1, -cosine * Math.sqrt( ( h2 - 1 ) / ( 1 - cosine * cosine ) ) ) );

    let result = cosine * Math.acos( inner ) - Math.sqrt( k2 * ( h2 - 1 ) );
    result = result / h2 + Math.atan( Math.sqrt( k2 / ( h2 - 1 ) ) );

    return Math.min( 1, Math.max( 0, result / Math.PI ) );

}

/**
 * The same integral, over a set of spheres.
 *
 * Combined MULTIPLICATIVELY — `∏ (1 − occlusion_i)` — rather than by summing the occlusions.
 * Summing double-counts wherever two spheres overlap on the receiver's hemisphere, and adjacent
 * spheres along a limb overlap almost completely, which would put a black band under every calf.
 * The product under-counts instead, which reads as a softer contact and is the failure mode a
 * viewer forgives.
 *
 * @param {number[]} position
 * @param {number[]} normal
 * @param {Array<{centre: number[], radius: number}>} occluders
 * @returns {number} visibility in 0..1, 1 = unoccluded
 */
export function groundVisibility( position, normal, occluders ) {

    let visibility = 1;

    for ( const occluder of occluders ) {

        visibility *= 1 - sphereOcclusion( position, normal, occluder.centre, occluder.radius );

    }

    return visibility;

}

// --- the class -----------------------------------------------------------------------------------

export class GroundContact {

    /**
     * @param {Object} [options]
     * @param {number} [options.albedo] - floor base colour. See `FLOOR_ALBEDO` for why it is warm.
     * @param {boolean} [options.occlusion=true] - build the occlusion term at all. `false` gives
     *   the identical plane with a flat albedo, which is the plate every attribution in this
     *   file's header was measured against.
     * @param {number} [options.strength=1] - scales the occlusion the ground receives. 1 is the
     *   physical answer; the dial exists so a browsercheck can sweep past it and back.
     * @param {number} [options.roughness=0.9]
     */
    constructor( options = {} ) {

        this.albedo = options.albedo ?? FLOOR_ALBEDO;
        this.occlusionEnabled = options.occlusion !== false;
        this.strength = options.strength ?? 1;

        this.mesh = new Mesh(
            new PlaneGeometry( 1, 1 ),
            new MeshStandardNodeMaterial( { color: new Color( this.albedo ), roughness: options.roughness ?? 0.9, metalness: 0 } )
        );
        this.mesh.name = 'ground';
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;

        /** @type {Array<{bone: Object3D, child: Object3D, radius: number}>} */
        this.occluders = [];

        // Sphere centres and radii live in ONE uniform array as xyz + radius in w, so the shader
        // loop reads one vec4 per occluder instead of two aligned arrays that can fall out of step.
        this.spheres = Array.from( { length: MAX_OCCLUDERS }, () => new Vector4( 0, -1e4, 0, 0.001 ) );
        this.sphereUniform = uniformArray( this.spheres, 'vec4' );
        this.activeCount = uniform( 0, 'int' );
        this.strengthUniform = uniform( this.strength );

        if ( this.occlusionEnabled ) this.mesh.material.colorNode = this.buildOcclusionNode();

    }

    /** Puts the ground in the scene. */
    attachTo( scene ) {

        scene.add( this.mesh );

        return this;

    }

    /** Sizes the plane to the shot. Same units the rig uses, so one number drives both. */
    sizeTo( { focus, subjectHeightMetres } ) {

        const extent = subjectHeightMetres * GROUND_EXTENT_IN_HEIGHTS;
        this.mesh.scale.set( extent, extent, 1 );
        this.mesh.position.set( focus.x, 0, focus.z );

        return this;

    }

    /**
     * Measures the occluder radii off the figure, once.
     *
     * Every radius is the 75th percentile perpendicular distance from that bone's dominant
     * vertices to the bone's own segment — a measurement of THIS asset, so a different figure, a
     * different gender bake or a rescaled rig produces different spheres without anything here
     * changing. Bones the figure does not have are skipped and reported, rather than silently
     * producing a sphere of radius zero that occludes nothing and looks like a working feature.
     *
     * @param {import('three').Object3D} root
     * @returns {string[]} names of the segments that could not be fitted
     */
    fitTo( root ) {

        const bones = new Map();
        let skinned = null;

        root.traverse( ( object ) => {

            if ( object.isBone === true ) bones.set( object.name, object );
            if ( object.isSkinnedMesh === true && skinned === null ) skinned = object;

        } );

        const missing = [];
        this.occluders.length = 0;

        const radii = skinned === null ? new Map() : measureBoneRadii( skinned );

        for ( const segment of OCCLUDER_SEGMENTS ) {

            if ( this.occluders.length >= MAX_OCCLUDERS ) break;

            const bone = bones.get( segment.bone );
            const child = segment.child === null ? bone : bones.get( segment.child );
            const label = `${ segment.bone }->${ segment.child ?? 'tip' }`;

            if ( bone === undefined || child === undefined ) {

                missing.push( label );
                continue;

            }

            const radius = radii.get( segment.bone );

            if ( radius === undefined || radius <= 0 ) {

                missing.push( `${ label } (no vertices)` );
                continue;

            }

            // Evenly spaced along the segment, at the midpoints of `spheres` equal sub-segments,
            // so two spheres land at 0.25 and 0.75 rather than at the ends where they would
            // duplicate the neighbouring bones' spheres.
            for ( let index = 0; index < segment.spheres; index += 1 ) {

                if ( this.occluders.length >= MAX_OCCLUDERS ) break;

                this.occluders.push( { bone, child, radius, along: ( index + 0.5 ) / segment.spheres } );

            }

        }

        this.activeCount.value = this.occluders.length;
        this.update();

        return missing;

    }

    /**
     * Re-reads the bone world positions. Cheap enough to call every frame and it must be: a
     * contact shadow that does not move with a planted foot is worse than none, because it tells
     * the viewer the figure is sliding.
     */
    update() {

        for ( let index = 0; index < this.occluders.length; index += 1 ) {

            const { bone, child, radius, along } = this.occluders[ index ];

            bone.getWorldPosition( _boneWorld );
            child.getWorldPosition( _childWorld );

            // The world scale of the rig is applied to the measured radius here rather than at fit
            // time, so a figure rescaled after fitting stays correct.
            const scale = bone.getWorldScale( _scale ).length() / Math.sqrt( 3 );

            this.spheres[ index ].set(
                _boneWorld.x + ( _childWorld.x - _boneWorld.x ) * along,
                _boneWorld.y + ( _childWorld.y - _boneWorld.y ) * along,
                _boneWorld.z + ( _childWorld.z - _boneWorld.z ) * along,
                Math.max( 1e-3, radius * scale )
            );

        }

        // Everything past the active count is parked far below the floor at a pinpoint radius, so
        // a stale entry cannot leave a shadow of a limb that is no longer in the list.
        for ( let index = this.occluders.length; index < MAX_OCCLUDERS; index += 1 ) {

            this.spheres[ index ].set( 0, -1e4, 0, 1e-3 );

        }

        this.sphereUniform.needsUpdate = true;

        return this;

    }

    /** What the ground would measure at one world point, on the CPU. For gates and for the HUD. */
    visibilityAt( x, z ) {

        // Read off the SPHERES, not off `this.occluders`, because the spheres are what the shader
        // reads: a CPU mirror that recomputed the centres from the bones could agree with the
        // geometry and disagree with the picture.
        const occluders = this.occluders.map( ( _unused, index ) => ( {
            centre: [ this.spheres[ index ].x, this.spheres[ index ].y, this.spheres[ index ].z ],
            radius: this.spheres[ index ].w
        } ) );

        const raw = groundVisibility( [ x, 0, z ], [ 0, 1, 0 ], occluders );

        return 1 - ( 1 - raw ) * this.strength;

    }

    dispose() {

        this.mesh.removeFromParent();
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();

    }

    // --- the shader ------------------------------------------------------------------------

    /**
     * The albedo, times the visibility of the sky from each ground point.
     *
     * The loop runs to `activeCount` rather than to `MAX_OCCLUDERS` so a figure with fewer bones
     * does not pay for twelve, and the parked spheres above mean a wrong count degrades to "too
     * dark somewhere far away" instead of to garbage.
     */
    buildOcclusionNode() {

        const spheres = this.sphereUniform;
        const count = this.activeCount;
        const strength = this.strengthUniform;

        const occludedVisibility = Fn( () => {

            const visibility = float( 1 ).toVar();

            Loop( { start: 0, end: count, type: 'int', condition: '<' }, ( { i } ) => {

                const sphere = spheres.element( i );
                const toCentre = sphere.xyz.sub( positionWorld );
                const distance = toCentre.length().max( 1e-4 );
                const cosine = normalWorld.dot( toCentre.div( distance ) );

                const h2 = distance.div( sphere.w ).pow( 2 ).max( 1.0001 );
                const k2 = float( 1 ).sub( h2.mul( cosine ).mul( cosine ) );

                // Both branches of the CPU function, written branchlessly. The exact form's inner
                // square roots go imaginary for k2 <= 0, so they are evaluated on a clamped k2 and
                // the distant-sphere form is mixed in by `step` — a branch here would diverge
                // per-pixel across a contact edge, which is the worst place on the floor for it.
                const safeK2 = k2.max( 0.001 );
                const denominator = float( 1 ).sub( cosine.mul( cosine ) ).max( 1e-5 );
                const inner = cosine.negate().mul( h2.sub( 1 ).div( denominator ).sqrt() ).clamp( -1, 1 );

                const exact = cosine.mul( inner.acos() ).sub( safeK2.mul( h2.sub( 1 ) ).sqrt() )
                    .div( h2 )
                    .add( safeK2.div( h2.sub( 1 ).max( 1e-5 ) ).sqrt().atan() )
                    .div( Math.PI );

                const distant = cosine.max( 0 ).div( h2 );

                const occlusion = k2.greaterThan( 0.001 ).select( exact, distant ).clamp( 0, 1 );

                visibility.mulAssign( float( 1 ).sub( occlusion.mul( strength ) ) );

            } );

            return visibility;

        } );

        return color( this.albedo ).mul( vec3( occludedVisibility() ) );

    }

}

// --- fitting -------------------------------------------------------------------------------------

/**
 * The 75th-percentile perpendicular distance from each bone's dominant vertices to that bone's own
 * segment, in the figure's own units.
 *
 * "Dominant" is the bone with the largest skin weight on that vertex — not a weighted average.
 * A weighted average over a joint would place a vertex halfway down a limb it does not belong to
 * and inflate both radii; the argmax puts every vertex on exactly one bone, which is what a
 * capsule fit wants.
 *
 * The geometry is read in BIND space (`geometry.attributes.position` with the mesh's `bindMatrix`
 * applied), because that is the pose the bone inverses describe. Reading a posed vertex against a
 * bind-pose bone would measure the pose, not the body.
 *
 * @param {import('three').SkinnedMesh} mesh
 * @returns {Map<string, number>} bone name -> radius
 */
export function measureBoneRadii( mesh ) {

    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const skinIndex = geometry.attributes.skinIndex;
    const skinWeight = geometry.attributes.skinWeight;
    const bones = mesh.skeleton?.bones ?? [];

    if ( positions === undefined || skinIndex === undefined || skinWeight === undefined ) return new Map();

    // Bone bind-space transforms, from the inverses three already stores.
    const boneBindPosition = bones.map( ( bone, index ) => {

        const inverse = mesh.skeleton.boneInverses[ index ];
        const bind = _matrix.copy( inverse ).invert();

        return new Vector3().setFromMatrixPosition( bind );

    } );

    // Each bone as a SEGMENT rather than a point. A bone's own position is its head; its first
    // bone child gives its direction, which keeps the segment inside the limb.
    //
    // 🚩 A TIP bone — a toe ball, a fingertip — has no child, and skipping it is wrong here rather
    // than merely incomplete: the ball of the foot is the occluder closest to the floor in the
    // whole figure, and it is exactly the one that has no child. So a tip inherits its PARENT's
    // direction, continued forward from its own position, which is the toe's own axis.
    const boneAxis = bones.map( ( bone, index ) => {

        const child = bone.children.find( ( entry ) => entry.isBone === true );

        if ( child !== undefined ) {

            const childIndex = bones.indexOf( child );
            if ( childIndex >= 0 ) return boneBindPosition[ childIndex ].clone().sub( boneBindPosition[ index ] );

        }

        const parentIndex = bone.parent === null ? -1 : bones.indexOf( bone.parent );
        if ( parentIndex < 0 ) return null;

        return boneBindPosition[ index ].clone().sub( boneBindPosition[ parentIndex ] );

    } );

    const distances = new Map();

    for ( let vertex = 0; vertex < positions.count; vertex += 1 ) {

        // argmax over the four influences.
        let bestBone = -1;
        let bestWeight = 0;

        for ( const component of [ 'x', 'y', 'z', 'w' ] ) {

            const weight = skinWeight[ `get${ component.toUpperCase() }` ]( vertex );
            if ( weight <= bestWeight ) continue;

            bestWeight = weight;
            bestBone = skinIndex[ `get${ component.toUpperCase() }` ]( vertex );

        }

        if ( bestBone < 0 || bestBone >= bones.length ) continue;

        const axis = boneAxis[ bestBone ];
        if ( axis === null ) continue;

        _vertex.fromBufferAttribute( positions, vertex ).applyMatrix4( mesh.bindMatrix );

        const offset = _offset.copy( _vertex ).sub( boneBindPosition[ bestBone ] );
        const lengthSquared = axis.lengthSq();
        const along = lengthSquared === 0 ? 0 : Math.min( 1, Math.max( 0, offset.dot( axis ) / lengthSquared ) );

        const perpendicular = offset.sub( _axisScaled.copy( axis ).multiplyScalar( along ) ).length();

        const name = bones[ bestBone ].name;
        if ( distances.has( name ) === false ) distances.set( name, [] );
        distances.get( name ).push( perpendicular );

    }

    const radii = new Map();

    for ( const [ name, samples ] of distances ) {

        samples.sort( ( a, b ) => a - b );
        radii.set( name, samples[ Math.min( samples.length - 1, Math.floor( RADIUS_PERCENTILE * samples.length ) ) ] );

    }

    return radii;

}

// Scratch. Separate instances rather than one shared vector — LEARNINGS §1.12: a scratch vector
// used as both an input and an output aliases itself and the answer looks plausible.
const _boneWorld = new Vector3();
const _childWorld = new Vector3();
const _scale = new Vector3();
const _vertex = new Vector3();
const _offset = new Vector3();
const _axisScaled = new Vector3();
const _matrix = new Matrix4();
