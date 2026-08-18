/**
 * InteriorEnvironment — a room, and the window that is a PORTAL TO THE SAME SKY. Punch-list **11.4**.
 *
 * ## 🎯 THE ONE IDEA, AND IT IS WHAT KEEPS THE CORPUS SMALL
 *
 * `docs/research/scene-system.md` §4 states it in five words — *the window is a portal, not a
 * texture.* A morning kitchen is not a photograph of a kitchen. It is **the same Preetham sky, at
 * the same sun, seen through a rectangle**, bounced once off a warm wall. Six of the design's twelve
 * scenes are interiors, and the reason they cost almost nothing is that they do not carry a second
 * sun, a second sky, or a second set of authored daylight numbers. They carry a BOX.
 *
 * Concretely, and this is the whole file in one diagram:
 *
 *     sun( elevation, azimuth ) ──► SkyMesh ──► BAKE 1 ──► solarTarget (the sky, disc ON)
 *                │                                             │
 *                │                        ┌────────────────────┼───────────────────┐
 *                │                        ▼                    ▼                   ▼
 *                │              the WINDOW PANE's       every WALL's           the analytic
 *                │              own pixels, read        radiance, read          KEY, through
 *                │              along the view ray      along the window's      the aperture
 *                │                        │             outward normal              │
 *                │                        └────────┬───────────┘                    │
 *                │                                 ▼                                │
 *                │                    BAKE 2 ──► interiorTarget ──► scene.environment│
 *                │                                 └──────────────► scene.background │
 *                └──────────────────── keyPlacementForSun() ───────────────────────►─┘
 *
 * 🔴 **CORRECTION, MEASURED AFTER THIS HEADER WAS WRITTEN, AND IT DEMOTES THE FILE'S OWN NAME.**
 * *"The window's own pixels"* in that diagram **are never drawn.** An adversary hid the live
 * `interior-window` mesh in-page and diffed against every shipped interior plate:
 *
 *     kitchen portrait / kitchen body / bedroom-morning body /
 *     bedside-night body / desk body / living-room body
 *         →  0 px changed (0.0000%), worst Δ0.0/255, on all six
 *
 * **THE PANE CONTRIBUTES EXACTLY ZERO PIXELS TO EVERY SHIPPED INTERIOR PLATE.** A domestic window is
 * not in a portrait frame and is behind or outside the frustum at body framing, which this file's
 * own frame arithmetic says elsewhere and which the diagram above contradicts. Confirmed a second
 * way by simply opening the six plates: there is no window in any of them.
 * ⚠️ And the round's own PROOF table contains no window-pane rect — **nothing in its evidence set
 * ever measured the pixels the headline claim is about.**
 *
 * 🎯 **WHAT SURVIVES IS THE BETTER HALF, AND IT REPRODUCES DIGIT FOR DIGIT.** The room really does
 * move with the sun, through `sunFluxThroughWindow()`, the closed-form enclosure term and
 * `windowAdmittance` scaling the key — all real, all re-run by an adversary and by the integrator.
 * **So this is a LIGHT MODEL, not a portal.** The window is an APERTURE: it admits flux, it is not
 * a hole you can see the sky through. Three consumers of one `sunPosition`, not four, and the pane
 * survives only inside the PMREM bake where it feeds the IBL.
 * The honest five words are *the window is an aperture, not a texture* — which keeps the corpus
 * exactly as small, because what was never authored twice was the LIGHT.
 *
 * Move `sun.elevationDegrees` by itself and the walls' brightness, the image-based light and the
 * key's direction, colour and level all move together, because not one of them is authored. That
 * co-movement is 11.4's gate and
 * the ROUND NOTE at the foot of this file is the measurement.
 *
 * ## 🚩 THE GOTCHA THAT COST THE SPIKE THREE RUNS, AND WHY THIS FILE CANNOT HIT IT EITHER
 *
 * `PMREMGenerator.fromScene()` bakes **whatever is in the scene you hand it**, and
 * `Object3D.add()` **RE-PARENTS** rather than sharing. Hand it the live scene and the avatar lights
 * itself; add one mesh to both scenes and the bake scene silently loses it. Nothing errors — the
 * target is valid, the material samples it, and the subject renders black.
 *
 * `SkyEnvironment` is immune because its `SkyMesh` never enters the live scene at all. This file
 * cannot use that dodge: **item 4 requires the room to BE the background**, so the room has to exist
 * in the live scene as real geometry. So the rule here is the other one: **two `Mesh` instances per
 * face, one owned by `bakeScene` and one by the live scene, sharing geometry and material and
 * never a parent.** `assertRoomsAreDisjoint()` is that rule as an assertion rather than as a
 * comment, because a silent re-parent is exactly the class of bug a comment does not catch.
 *
 * ## 🚩 ONE RENDER TARGET PER ROLE, FOR THE LIFE OF THE RENDERER
 *
 * Same measurement `SkyEnvironment` records and the same consequence: pointing `scene.environment`
 * at a DIFFERENT texture costs a 43–56 ms material pipeline rebuild on the next frame, against
 * 0.4–0.5 ms to re-bake into the same texture's contents. Both targets are allocated once in
 * `attachTo()` and every later `bake()` writes into them.
 *
 * ## 🎯 WHY EVERY SURFACE IN THIS ROOM IS AN **UNLIT** MATERIAL, WHICH LOOKS WRONG UNTIL IT DOESN'T
 *
 * A room's walls are the background of the frame. If they are lit materials then the rig lights
 * them, and the rig's rim is a saturated `#0f30ff` panel — which is `36ba35d` exactly: *"the rim was
 * painting the floor, and that is why park's lawn was navy."* One scene further in, that defect is a
 * violet wall behind a face, at portrait framing, filling the frame.
 *
 * ⚠️ **AND `layers` CANNOT PREVENT IT** — three's node path tests `object.layers.test(
 * camera.layers )` for LIGHTS (`Renderer.js:973`), i.e. light-versus-CAMERA. There is no per-object
 * light mask on this renderer and that was measured, not assumed.
 *
 * So the walls carry `MeshBasicNodeMaterial` with `lights = false`, and their radiance is a NODE
 * computed from the window. `NodeMaterial.setupLighting` (`NodeMaterial.js:1088-1093`, r185) is
 * explicit about what that buys: with `lights === false` the material contributes no
 * `materialLightings`, takes no `builder.lightsNode`, and `setupOutgoingLight` returns
 * `diffuseColor.rgb` unchanged (`:926`). **The room's pixels are exactly what this file computes and
 * nothing else can reach them** — not the rig, not the environment, not a later scene change.
 *
 * ⏭️ **A SECOND, NARROWER MECHANISM WAS FOUND WHILE ESTABLISHING THAT AND IS RECORDED FOR WHOEVER
 * NEEDS IT.** `material.lightsNode = lights( [] )` (from `three/tsl`) leaves `this.lights === true`,
 * so the material KEEPS its environment/IBL term and loses only the scene's analytic lights — a
 * genuine per-object *analytic-light* mask on this renderer, which the `layers` finding above does
 * not rule out because it is a different mechanism at a different layer. Not used here (this room
 * wants no IBL either; its light is derived), but it is the tool a future lit set-dressing mesh
 * wants, and it means the standing note *"there is NO per-object light mask"* is true of `layers`
 * and false in general.
 *
 * ## The light on the wall is the point-source limit of a rectangle, and it is stated as one
 *
 * A wall's irradiance from a window is the Hottel rectangle form factor. This file uses its
 * **point-source limit** — `E = L·A·cosθ_w·cosθ_s / d²` — which is exact beyond about two window
 * widths and over-bright inside that. It is chosen over a constant because a CONSTANT IS THE DEFECT
 * THE EXTERIORS WERE FILED FOR: *"the two exterior portrait backdrops are the same picture, mean |Δ|
 * 2.42 code values."* A flat wall is that complaint with plaster on it. The `d²` term is what puts a
 * gradient across the back wall, and the gradient is what a judge reads as a room.
 *
 * ⚠️ The near-field is clamped at `WINDOW_NEAR_CLAMP_METRES` rather than left to blow up, and the
 * inter-reflection that a point source cannot produce is a separate closed-form term —
 * `INTER_REFLECTION` below — so a wall facing away from the window is dim rather than black.
 *
 * ## 🎯 AND THE WINDOW'S RADIANCE IS NOT A NUMBER — IT IS THE SKY, READ BACK
 *
 * The obvious implementation is a CPU-computed "daylight through a window" scalar, and it is the
 * same mistake 11.5 already made once and repaired: a CPU horizon colour was wrong because the sky's
 * own horizon varies 43 code values across a frame. So the window's radiance is
 * `pmremTexture( solarTarget.texture, windowNormal, WINDOW_SAMPLE_ROUGHNESS )` — the SAME texture
 * the backdrop is drawn from, sampled along the window's own outward normal, at a roughness that
 * makes the read an average over the sky that window faces. It is the sky's own units, so it goes
 * through the same `SKY_TO_RIG_SCALE` everything else does, and it moves when the sun moves without
 * a line of code knowing that it did.
 *
 * Sources: the sky model, its constants and `SKY_TO_RIG_SCALE` are `render/SkyEnvironment.js` and
 * are IMPORTED rather than re-derived — there is one sun in this system and this file does not get
 * to have an opinion about it. H. C. Hottel's rectangle form factor is the closed form the
 * point-source term above is the limit of.
 */

import {
    Color,
    Group,
    Mesh,
    MeshBasicNodeMaterial,
    PlaneGeometry,
    PMREMGenerator,
    Scene as BakeScene,
    Vector3
} from 'three/webgpu';

import {
    backgroundBlurriness,
    cameraPosition,
    float,
    normalWorld,
    pmremTexture,
    positionWorld,
    uniform,
    vec3
} from 'three/tsl';

import {
    BAKE_ORIGIN,
    PMREM_CUBE_SIZE,
    SKY_TO_RIG_SCALE,
    buildSkyMesh,
    keyPlacementForSun,
    kelvinToLinearSRGB,
    setSunUniform,
    solarDiscLight,
    sunDirectionWorld
} from './SkyEnvironment.js';

/**
 * The PMREM roughness the window's radiance is read at.
 *
 * 🚩 NOT 0 AND NOT 1, AND BOTH ENDS ARE WRONG FOR A REASON. At 0 the read is the sky in ONE
 * direction — a window whose whole wall would flicker in level as the sun crossed its normal. At 1
 * the read is the full irradiance convolution, i.e. the average over the ENTIRE sphere including
 * the ground and the room's own side of the wall, which is not what a window sees. 0.55 averages
 * over roughly the outward hemisphere, which is what a window's aperture actually admits.
 */
const WINDOW_SAMPLE_ROUGHNESS = 0.55;

/**
 * Where the point-source limit stops being allowed to grow.
 *
 * The `1/d²` term is exact in the far field and diverges as a surface approaches the aperture. A
 * clamp at 0.6 m is about the window's own half-width in the shipped rooms, which is where the
 * limit's error reaches ~25% — beyond that it is under 6%. Stated because the clamp is a bound on a
 * KNOWN approximation rather than a fudge on an unknown one.
 */
const WINDOW_NEAR_CLAMP_METRES = 0.6;

/**
 * How much light a fixture's own bulb glare adds to the surface it is mounted on, as a fraction of
 * its irradiance at 1 m. A ceiling fixture is not a point in its own plane; this stops the ceiling
 * around it going black next to a bright disc.
 */
const FIXTURE_MOUNT_SPILL = 0.35;

/** The radius of the emissive disc a fixture draws on the ceiling, in metres. */
const FIXTURE_DISC_RADIUS_METRES = 0.11;

/**
 * The offset that keeps the window pane off the wall it is set into.
 *
 * ⚠️ NOT COSMETIC. Two coplanar quads at the same depth is z-fighting, and z-fighting inside a
 * PMREM bake is a per-face-random speckle in the environment map that reads as noise on the SUBJECT
 * and has no visible cause anywhere in the frame.
 */
const WINDOW_INSET_METRES = 0.012;

/** A room with no explicit dimensions. A domestic room, in metres. */
export const ROOM_DEFAULTS = Object.freeze( {
    widthMetres: 4.2,
    depthMetres: 6.4,
    heightMetres: 2.6,
    centreOffsetMetres: Object.freeze( { x: 0, z: 1.5 } )
} );

/**
 * The subject's own width, used to soften the window's admittance of the direct sun.
 *
 * 🚩 A PERSON IS NOT A POINT AND A SUNBEAM DOES NOT SWITCH ON. Without this the derived key's
 * irradiance is a step function of `sun.elevationDegrees` — the exact shape that makes a
 * "the light moves with the sun" gate pass on one pair of elevations and fail on the next. The
 * admittance is the fraction of a `SUBJECT_WIDTH_METRES` disc, centred on the sun's own hit point in
 * the window's plane, that lands inside the aperture.
 */
const SUBJECT_WIDTH_METRES = 0.42;

/** Where the subject's face is, for the aperture test. Roughly the figure's eye line. */
const SUBJECT_EYE_HEIGHT_METRES = 1.5;

// --- the description a scene hands in ------------------------------------------------------------

/**
 * A room's geometry, resolved into world planes.
 *
 * The figure stands at the world origin, so the room is described RELATIVE TO THE FIGURE and
 * `centreOffsetMetres.z` is what puts more floor behind the camera than in front of the subject —
 * the camera stands at `+Z` and is 0.9 m out at portrait and about 4.1 m out at body framing, so a
 * room centred on the figure would put a body-framed camera through its back wall.
 *
 * ⚠️ **AND THAT IS A MEASUREMENT, NOT A MARGIN.** `Avatar`'s body frame is
 * `1.87 m / (2·tan 13°) = 4.05 m` from the focus. The shipped depth of 6.4 m at offset +1.5 m puts
 * the back wall at z = +4.7 m, which clears it by 0.65 m. A shallower room is a scene whose body
 * framing renders the outside of a box.
 */
export function resolveRoomGeometry( room ) {

    const widthMetres = room.widthMetres ?? ROOM_DEFAULTS.widthMetres;
    const depthMetres = room.depthMetres ?? ROOM_DEFAULTS.depthMetres;
    const heightMetres = room.heightMetres ?? ROOM_DEFAULTS.heightMetres;
    const centre = room.centreOffsetMetres ?? ROOM_DEFAULTS.centreOffsetMetres;

    const bounds = {
        minX: centre.x - widthMetres / 2,
        maxX: centre.x + widthMetres / 2,
        minZ: centre.z - depthMetres / 2,
        maxZ: centre.z + depthMetres / 2,
        minY: 0,
        maxY: heightMetres
    };

    return { widthMetres, depthMetres, heightMetres, centre, bounds, window: windowOnWall( room.window, bounds ) };

}

/**
 * The window, placed on whichever wall its azimuth points through.
 *
 * `azimuthDegrees` is the WORLD azimuth of the window's OUTWARD normal — the same convention
 * `SkyEnvironment.sunDirectionWorld` uses, measured about +Y from +Z toward +X — so a window and a
 * sun that share an azimuth are a window the sun shines straight into. The wall is chosen by the
 * dominant axis of that direction, which is the whole of the mapping: a box has four walls and an
 * azimuth names one.
 */
function windowOnWall( request, bounds ) {

    const direction = sunDirectionWorld( 0, request.azimuthDegrees );
    const alongX = Math.abs( direction.x ) >= Math.abs( direction.z );

    const widthMetres = request.widthMetres;
    const heightMetres = request.heightMetres;
    const sillMetres = request.sillMetres;
    const offsetMetres = request.offsetMetres ?? 0;

    const centreY = sillMetres + heightMetres / 2;

    if ( alongX ) {

        const sign = direction.x >= 0 ? 1 : -1;
        const x = sign > 0 ? bounds.maxX : bounds.minX;

        return {
            normal: { x: sign, y: 0, z: 0 },
            centre: { x, y: centreY, z: ( bounds.minZ + bounds.maxZ ) / 2 + offsetMetres },
            widthMetres,
            heightMetres,
            areaSquareMetres: widthMetres * heightMetres,
            axis: 'x',
            sign
        };

    }

    const sign = direction.z >= 0 ? 1 : -1;
    const z = sign > 0 ? bounds.maxZ : bounds.minZ;

    return {
        normal: { x: 0, y: 0, z: sign },
        centre: { x: ( bounds.minX + bounds.maxX ) / 2 + offsetMetres, y: centreY, z },
        widthMetres,
        heightMetres,
        areaSquareMetres: widthMetres * heightMetres,
        axis: 'z',
        sign
    };

}

/**
 * What fraction of the direct solar beam this window admits onto the subject, in [0, 1].
 *
 * 🎯 **THIS IS THE ONLY THING THE INTERIOR DOES TO THE SUN AND IT IS PURE GEOMETRY.** The key's
 * azimuth, elevation, colour and irradiance are `keyPlacementForSun`'s — the SAME function both
 * exteriors use, from the same `Fex`. All an interior adds is *"and then there is a wall in the
 * way, with a hole in it"*: trace the ray from the subject toward the sun, find where it crosses the
 * window's plane, and ask how much of a subject-width disc at that point is inside the aperture.
 *
 * ⚠️ **IT IS NOT A PANEL-SIZE DERIVATION AND MUST NOT BECOME ONE.** `Scene.js`'s ROUND NOTE records
 * that deriving the key's PANEL from the sun's angular diameter grows an orange subsurface glow
 * along the nose, lips and eyelids that no lighting statistic catches. This function returns a
 * SCALAR on `irradiance` and touches no geometry field of the placement.
 *
 * @returns {{ admittance: number, transmission: number, hit: ?Object, sunIsUp: boolean }}
 */
export function windowAdmittance( sun, geometry, transmission ) {

    const direction = sunDirectionWorld( sun.elevationDegrees, sun.azimuthDegrees );
    const win = geometry.window;

    if ( sun.elevationDegrees <= 0 ) {

        return { admittance: 0, transmission, hit: null, sunIsUp: false };

    }

    const eye = { x: 0, y: SUBJECT_EYE_HEIGHT_METRES, z: 0 };

    // The wall's plane, and the distance along the ray to it. A sun on the room's side of the wall
    // (t <= 0) is a sun behind the subject's own window, which admits nothing.
    const axis = win.axis;
    const planeCoordinate = axis === 'x' ? win.centre.x : win.centre.z;
    const eyeCoordinate = axis === 'x' ? eye.x : eye.z;
    const rayCoordinate = axis === 'x' ? direction.x : direction.z;

    if ( Math.abs( rayCoordinate ) < 1e-6 ) {

        return { admittance: 0, transmission, hit: null, sunIsUp: true };

    }

    const t = ( planeCoordinate - eyeCoordinate ) / rayCoordinate;

    if ( t <= 0 ) return { admittance: 0, transmission, hit: null, sunIsUp: true };

    const hit = {
        x: eye.x + direction.x * t,
        y: eye.y + direction.y * t,
        z: eye.z + direction.z * t
    };

    const acrossHit = axis === 'x' ? hit.z : hit.x;
    const acrossCentre = axis === 'x' ? win.centre.z : win.centre.x;

    // The fraction of a subject-width disc inside the aperture, per axis, multiplied. `overlap`
    // is a linear ramp over the subject's own width rather than a smoothstep, because a linear
    // overlap IS the geometry — a disc leaving a straight edge loses area in proportion to how far
    // it has left — and this project has one number too many that came from a curve nobody derived.
    const across = overlap( Math.abs( acrossHit - acrossCentre ), win.widthMetres / 2 );
    const vertical = overlap( Math.abs( hit.y - win.centre.y ), win.heightMetres / 2 );

    return { admittance: across * vertical, transmission, hit, sunIsUp: true };

}

/** 1 well inside a half-extent, 0 well outside it, linear across the subject's own width. */
function overlap( distanceFromCentre, halfExtent ) {

    const half = SUBJECT_WIDTH_METRES / 2;
    const inner = halfExtent - half;
    const outer = halfExtent + half;

    if ( distanceFromCentre <= inner ) return 1;
    if ( distanceFromCentre >= outer ) return 0;

    return ( outer - distanceFromCentre ) / ( outer - inner );

}

/**
 * The key-light placement an INTERIOR hands `LightingRig` — the exterior's, through the aperture.
 *
 * @param {Object} sun - the scene's `sun`.
 * @param {Object} sky - the scene's `sky`. There is one sky and an interior has it too.
 * @param {Object} room - the scene's `room`.
 * @param {number} cameraAzimuthDegrees - the camera's WORLD azimuth.
 */
export function keyPlacementForInteriorSun( sun, sky, room, cameraAzimuthDegrees ) {

    const base = keyPlacementForSun( sun, sky, cameraAzimuthDegrees );
    const geometry = resolveRoomGeometry( room );
    const gate = windowAdmittance( sun, geometry, room.window.transmission ?? 1 );

    return {
        ...base,
        irradiance: base.irradiance * gate.admittance * gate.transmission
    };

}

// --- the live half -------------------------------------------------------------------------------

/**
 * The room, its two PMREMs, and the geometry that is both the background and the bake subject.
 */
export class InteriorEnvironment {

    /**
     * @param {Object} options
     * @param {Object} options.sun - `{ elevationDegrees, azimuthDegrees, occlusion }`.
     * @param {Object} options.sky - `{ turbidity, rayleigh, mieCoefficient, mieDirectionalG }`.
     * @param {Object} options.room - the scene's `room`.
     * @param {Object} options.ground - `{ enabled, albedo, roughness }` from the scene.
     * @param {number} [options.size=PMREM_CUBE_SIZE]
     */
    constructor( options ) {

        this.sun = options.sun;
        this.sky = options.sky;
        this.room = options.room;
        this.ground = options.ground;
        this.size = options.size ?? PMREM_CUBE_SIZE;

        this.geometry = resolveRoomGeometry( this.room );

        // The uniforms the room's own material graph reads. Uniforms rather than node constants for
        // the reason `SkyEnvironment` states: three keys its material pipeline cache on the node
        // GRAPH, so rebuilding a node to change a number recompiles every material in the scene —
        // the same 43–56 ms this project already refuses to pay for a swapped environment texture.
        this.windowCentre = uniform( new Vector3() );
        this.windowNormal = uniform( new Vector3() );
        this.windowArea = uniform( 0 );
        this.windowTransmission = uniform( 1 );
        this.interReflection = uniform( 0 );
        this.sunAmbient = uniform( new Vector3() );
        this.roomIntensity = uniform( 1 );

        this.scene = null;
        this.renderer = null;
        this.pmrem = null;
        this.skyMesh = null;
        this.bakeScene = null;
        this.bakeRoom = null;
        this.liveRoom = null;
        this.materials = null;
        this.geometries = null;
        this.solarTarget = null;
        this.interiorTarget = null;
        this.bakeCount = 0;

    }

    /**
     * Builds the sky, the room, both targets, bakes, and installs the result.
     *
     * ⚠️ `PMREMGenerator.fromScene()` THROWS before `await renderer.init()`. `Stage.create()` awaits
     * it, so by the time `Avatar.build()` reaches here the backend is up — which is why this is
     * called from `build()` and not from the constructor.
     */
    attachTo( scene, renderer ) {

        if ( this.scene !== null ) {

            throw new Error( 'InteriorEnvironment.attachTo: already attached. One environment per ' +
                'scene; call bake() to move the sun, which re-uses both render targets rather than ' +
                'allocating new ones — a swapped texture costs a 43–56 ms pipeline rebuild.' );

        }

        this.scene = scene;
        this.renderer = renderer;
        this.pmrem = new PMREMGenerator( renderer );

        this.writeRoomUniforms();

        // The sky lives in the BAKE scene and only there, exactly as `SkyEnvironment` keeps it out
        // of the live one. It is bake 1's whole subject and it is never drawn in a frame — what the
        // viewer sees of it is the window pane, which reads the same texture along the view ray.
        this.bakeScene = new BakeScene();
        this.bakeScene.background = null;

        this.skyMesh = buildSkyMesh( this.sky );
        this.bakeScene.add( this.skyMesh );

        // BAKE 1 alone, so `solarTarget.texture` exists before any room material samples it.
        this.bakeSky();

        this.materials = this.buildRoomMaterials();
        this.geometries = { quad: new PlaneGeometry( 1, 1 ), disc: new PlaneGeometry( 1, 1 ) };

        // 🚩 TWO INSTANCES, ONE MATERIAL SET, NO SHARED PARENT. See the header: `add()` re-parents,
        // so a single mesh in both scenes is a bake that quietly renders an empty room from the
        // second bake onward. Geometry and materials are shared — they have no parent and cannot be
        // stolen — and only the `Mesh` wrappers are duplicated.
        this.bakeRoom = this.buildRoomGroup( { includeFloor: true } );
        this.liveRoom = this.buildRoomGroup( { includeFloor: false } );

        this.bakeScene.add( this.bakeRoom );
        this.scene.add( this.liveRoom );

        this.assertRoomsAreDisjoint();

        this.bake();

        return this;

    }

    /**
     * 🚩 THE RE-PARENT ASSERTION. The failure this guards is SILENT — a valid target, a material
     * that samples it, and a subject that renders black — so it is checked rather than commented.
     */
    assertRoomsAreDisjoint() {

        const bakeMeshes = this.bakeRoom.children.length;
        const liveMeshes = this.liveRoom.children.length;

        if ( bakeMeshes === 0 || liveMeshes === 0 ) {

            throw new Error( 'InteriorEnvironment: a room group lost its meshes — ' +
                `bake ${ bakeMeshes }, live ${ liveMeshes }. Object3D.add() RE-PARENTS, so one Mesh ` +
                'handed to both scenes leaves the bake empty and the avatar lighting itself. Two ' +
                'instances, shared geometry and material, never a shared parent.' );

        }

        for ( const mesh of this.bakeRoom.children ) {

            if ( mesh.parent !== this.bakeRoom ) {

                throw new Error( 'InteriorEnvironment: a bake mesh was re-parented out of the bake ' +
                    'group. See the header.' );

            }

        }

    }

    /** The scene's numbers into the material graph's uniforms. Called on attach and on any change. */
    writeRoomUniforms() {

        const win = this.geometry.window;

        this.windowCentre.value.set( win.centre.x, win.centre.y, win.centre.z );
        this.windowNormal.value.set( win.normal.x, win.normal.y, win.normal.z );
        this.windowArea.value = win.areaSquareMetres;
        this.windowTransmission.value = this.room.window.transmission ?? 1;

        const gain = this.enclosureGain();

        this.interReflection.value = Math.PI * win.areaSquareMetres * gain;

        const sunFlux = this.sunFluxThroughWindow();

        this.sunAmbient.value.set(
            sunFlux[ 0 ] * gain, sunFlux[ 1 ] * gain, sunFlux[ 2 ] * gain );

    }

    /**
     * The enclosure's inter-reflection gain: `ρ̄ / (A·(1−ρ̄))`, in reciprocal square metres.
     *
     * Closed form, and it is the standard radiosity result for an enclosure with one aperture: a
     * flux `Φ` entering a room of interior area `A` at mean reflectance `ρ̄` settles at a mean
     * irradiance `Φ·ρ̄ / (A·(1−ρ̄))` once the bounces have converged. The FIRST bounce is not in
     * here — that is the point-source term in the material graph — so the two do not double count.
     *
     * ⚠️ `ρ̄` is CAPPED AT 0.9 because the `1/(1−ρ̄)` pole is real and a scene author could reach it
     * with three white hexes. At 0.9 the term is already ten times the first bounce, which is more
     * enclosure gain than any painted room has.
     */
    enclosureGain() {

        const { widthMetres, depthMetres, heightMetres } = this.geometry;

        const area = 2 * ( widthMetres * depthMetres )
            + 2 * ( widthMetres * heightMetres )
            + 2 * ( depthMetres * heightMetres );

        const albedos = [ this.room.wall, this.room.floor, this.room.ceiling ]
            .map( ( hex ) => linearLuminanceOfHex( hex ) );

        const meanAlbedo = Math.min( 0.9, albedos.reduce( ( a, b ) => a + b, 0 ) / albedos.length );

        return meanAlbedo / ( area * ( 1 - meanAlbedo ) );

    }

    /**
     * 🎯 **THE SUN'S OWN FLUX THROUGH THE APERTURE, AND LEAVING IT OUT WAS THE ROUND'S FIRST WRONG
     * PICTURE.** Measured, not reasoned: with the room's light read ONLY as
     * `pmremTexture( sky, windowNormal, 0.55 )`, the shipped kitchen rendered a muddy brown wall
     * about four stops under the face, and the reason is in the read itself — a roughness-0.55
     * convolution averages the solar disc away over most of a hemisphere, so the single biggest
     * term arriving through a sunlit window was being smeared to nothing.
     *
     * `E_sun · cosθ_window · A_window` is that flux, out of `solarDiscLight`'s own `irradianceRGB`
     * — the SAME `Fex` the key and the sky are read from — so the room warms and brightens as the
     * sun climbs, and it is not a second model of anything.
     *
     * ⚠️ **`sun.occlusion` IS DELIBERATELY NOT APPLIED HERE, AND THE ASYMMETRY IS THE FIELD'S OWN
     * DEFINITION.** `Scene.js` defines `occlusion` as the fraction of the solar DISC hidden by
     * something local — for an interior, a net curtain or a sheer at the glass. A sheer stops the
     * disc from being a disc; it does not stop the energy from entering the room, it re-emits it
     * diffusely. So the key loses it and the enclosure keeps it, which is exactly what a sheer does
     * and is why a curtained kitchen has a soft face and a bright wall rather than a dim both.
     */
    sunFluxThroughWindow() {

        const disc = solarDiscLight( this.sun.elevationDegrees, this.sky );

        if ( disc.aboveHorizon === false ) return [ 0, 0, 0 ];

        const direction = sunDirectionWorld( this.sun.elevationDegrees, this.sun.azimuthDegrees );
        const normal = this.geometry.window.normal;

        const cosine = Math.max( 0,
            direction.x * normal.x + direction.y * normal.y + direction.z * normal.z );

        const admitted = cosine * this.geometry.window.areaSquareMetres
            * ( this.room.window.transmission ?? 1 );

        return disc.irradianceRGB.map( ( component ) => component * admitted );

    }

    /**
     * One material per face colour, plus the pane.
     *
     * 🎯 EVERY FACE IS THE SAME GRAPH WITH A DIFFERENT ALBEDO, which is what makes the room a dozen
     * triangles and no bytes: `wall`, `floor` and `ceiling` are three hex numbers and the rest is
     * shared.
     */
    buildRoomMaterials() {

        // 🎯 THE WINDOW'S RADIANCE, AND IT IS THE SKY RATHER THAN A NUMBER. Same texture the
        // window pane draws and the same one `scene.background` carries — see the header.
        const windowRadiance = pmremTexture(
            this.solarTarget.texture, this.windowNormal, float( WINDOW_SAMPLE_ROUGHNESS )
        ).rgb.mul( this.windowTransmission );

        const toWindow = this.windowCentre.sub( positionWorld );
        const distanceSquared = toWindow.dot( toWindow ).max( float( WINDOW_NEAR_CLAMP_METRES ** 2 ) );
        const towards = toWindow.normalize();

        // Both cosines are a dot with the SAME direction, and that is not a coincidence: the vector
        // from a wall point to the window is the negative of the vector from the window to the wall
        // point, so the window's own cosine `dot( −n_w, −d )` and the surface's `dot( n_s, d )` are
        // `dot( n_w, d )` and `dot( n_s, d )`.
        const cosineAtSurface = normalWorld.dot( towards ).max( 0 );
        const cosineAtWindow = this.windowNormal.dot( towards ).max( 0 );

        const direct = windowRadiance
            .mul( this.windowArea )
            .mul( cosineAtSurface )
            .mul( cosineAtWindow )
            .div( distanceSquared );

        const ambient = windowRadiance.mul( this.interReflection ).add( this.sunAmbient );

        const fixtures = this.buildFixtureTerms();

        const irradiance = direct.add( ambient ).add( fixtures );

        const surface = ( hex ) => {

            const material = new MeshBasicNodeMaterial();

            // 🚩 THE LINE THAT MAKES THE ROOM IMMUNE TO THE RIG. `NodeMaterial.js:1090` gates
            // `setupMaterialLightings` on `lights === true` and `:1091` gates the scene's lights
            // node on it, so a false here is a surface no light in the scene can reach. The rim
            // painted `park`'s lawn navy; it cannot paint this wall.
            material.lights = false;
            material.colorNode = irradiance.mul( vec3( ...linearOfHex( hex ) ) )
                .div( Math.PI )
                .mul( this.roomIntensity );

            return material;

        };

        return {
            wall: surface( this.room.wall ),
            floor: surface( this.room.floor ),
            ceiling: surface( this.room.ceiling ),
            pane: this.buildWindowPaneMaterial(),
            fixture: this.buildFixtureDiscMaterials()
        };

    }

    /**
     * 🎯 **THE PORTAL, AND IT IS FOUR LINES.**
     *
     * The sky is at infinity, so what a rectangle in a wall shows is the sky along the VIEW RAY —
     * not a texture pinned to the rectangle, not a picture of a sky, and nothing this file authors.
     * `pmremTexture( solarTarget.texture, normalize( positionWorld − cameraPosition ) )` is exactly
     * that statement, and it is the same expression 11.5's aerial node already uses to close the
     * horizon seam by construction (`SkyEnvironment.buildAerialNode`). Move the sun and this
     * rectangle's pixels move, with no code path in between.
     *
     * ⚠️ `backgroundBlurriness` rather than a literal 0, so a scene that softens its backdrop softens
     * what its windows show as well. It is the scene's own uniform and it is 0 by default.
     */
    buildWindowPaneMaterial() {

        const material = new MeshBasicNodeMaterial();

        material.lights = false;

        const direction = positionWorld.sub( cameraPosition ).normalize();

        material.colorNode = pmremTexture( this.solarTarget.texture, direction, backgroundBlurriness )
            .rgb.mul( this.windowTransmission ).mul( this.roomIntensity );

        return material;

    }

    /**
     * The fixtures' contribution to every surface, as point sources.
     *
     * A fixture is `{ kelvin, irradiance, heightMetres }` — a colour temperature and a level, which
     * is the pair a lighting person names a bulb by. `kelvinToLinearSRGB` is `SkyEnvironment`'s own
     * fit, imported, so a 2700 K bulb and a 2700 K sunset are the same colour by construction.
     *
     * ⚠️ The level is in the SAME sky units everything else here is, so `roomIntensity` carries it
     * through `SKY_TO_RIG_SCALE` with the daylight. A fixture that had its own scale would be the
     * second photometric system this file exists to avoid.
     */
    buildFixtureTerms() {

        const fixtures = this.room.fixtures ?? [];

        let total = vec3( 0, 0, 0 );

        for ( const fixture of fixtures ) {

            const position = this.fixturePosition( fixture );
            const centre = uniform( new Vector3( position.x, position.y, position.z ) );
            const colour = kelvinToLinearSRGB( fixture.kelvin );

            const toFixture = centre.sub( positionWorld );
            const distanceSquared = toFixture.dot( toFixture ).max( float( 0.25 ) );
            const towards = toFixture.normalize();

            // The mount spill: a ceiling fixture lies IN the ceiling's plane, so the cosine there is
            // zero and the ceiling around a bright disc would render black. `FIXTURE_MOUNT_SPILL` is
            // the fraction of a real fitting's output that reaches its own mounting surface.
            const cosine = normalWorld.dot( towards ).max( float( FIXTURE_MOUNT_SPILL ) );

            total = total.add(
                vec3( colour[ 0 ], colour[ 1 ], colour[ 2 ] )
                    .mul( fixture.irradiance )
                    .mul( cosine )
                    .div( distanceSquared )
            );

        }

        return total;

    }

    /** Where a fixture hangs: on the room's centre line, below the ceiling. */
    fixturePosition( fixture ) {

        const { centre, heightMetres } = this.geometry;

        return {
            x: centre.x + ( fixture.offsetMetres ?? 0 ),
            y: fixture.heightMetres ?? ( heightMetres - 0.12 ),
            z: centre.z
        };

    }

    /** The emissive discs that make the fixtures visible in the frame and in the bake. */
    buildFixtureDiscMaterials() {

        return ( this.room.fixtures ?? [] ).map( ( fixture ) => {

            const material = new MeshBasicNodeMaterial();
            const colour = kelvinToLinearSRGB( fixture.kelvin );

            material.lights = false;
            material.colorNode = vec3( colour[ 0 ], colour[ 1 ], colour[ 2 ] )
                .mul( fixture.irradiance / ( Math.PI * FIXTURE_DISC_RADIUS_METRES ** 2 ) )
                .mul( this.roomIntensity );

            return material;

        } );

    }

    /**
     * The box: six faces and a pane, as `Mesh`es on a shared geometry.
     *
     * ⚠️ **`includeFloor` IS FALSE FOR THE LIVE ROOM AND THAT IS NOT AN OMISSION.** `GroundContact`
     * already owns the plane the figure stands on, at y = 0, with this scene's own `ground.albedo` —
     * and it is what carries the contact shadow the figure needs not to float. Two coplanar floors
     * is z-fighting across the whole lower frame. The BAKE keeps its floor, because the bounce off
     * it is the term that lands under a jaw and `GroundContact`'s plane is not in the bake scene.
     */
    buildRoomGroup( { includeFloor } ) {

        const group = new Group();
        const { bounds, widthMetres, depthMetres, heightMetres } = this.geometry;
        const centre = this.geometry.centre;

        group.name = includeFloor ? 'interior-bake-room' : 'interior-room';

        const face = ( material, size, position, rotation ) => {

            const mesh = new Mesh( this.geometries.quad, material );

            mesh.scale.set( size[ 0 ], size[ 1 ], 1 );
            mesh.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );
            mesh.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );
            group.add( mesh );

            return mesh;

        };

        if ( includeFloor ) {

            face( this.materials.floor, [ widthMetres, depthMetres ],
                [ centre.x, bounds.minY, centre.z ], [ -Math.PI / 2, 0, 0 ] );

        }

        face( this.materials.ceiling, [ widthMetres, depthMetres ],
            [ centre.x, bounds.maxY, centre.z ], [ Math.PI / 2, 0, 0 ] );

        // The four walls, each rotated to face INWARD.
        face( this.materials.wall, [ depthMetres, heightMetres ],
            [ bounds.minX, heightMetres / 2, centre.z ], [ 0, Math.PI / 2, 0 ] );

        face( this.materials.wall, [ depthMetres, heightMetres ],
            [ bounds.maxX, heightMetres / 2, centre.z ], [ 0, -Math.PI / 2, 0 ] );

        face( this.materials.wall, [ widthMetres, heightMetres ],
            [ centre.x, heightMetres / 2, bounds.minZ ], [ 0, 0, 0 ] );

        face( this.materials.wall, [ widthMetres, heightMetres ],
            [ centre.x, heightMetres / 2, bounds.maxZ ], [ 0, Math.PI, 0 ] );

        this.addWindowPane( group );
        this.addFixtureDiscs( group );

        return group;

    }

    /** The pane, inset off its wall so two coplanar quads cannot fight for depth. */
    addWindowPane( group ) {

        const win = this.geometry.window;

        const mesh = new Mesh( this.geometries.quad, this.materials.pane );

        mesh.scale.set( win.widthMetres, win.heightMetres, 1 );

        mesh.position.set(
            win.centre.x - win.normal.x * WINDOW_INSET_METRES,
            win.centre.y,
            win.centre.z - win.normal.z * WINDOW_INSET_METRES
        );

        if ( win.axis === 'x' ) mesh.rotation.set( 0, win.sign > 0 ? -Math.PI / 2 : Math.PI / 2, 0 );
        else mesh.rotation.set( 0, win.sign > 0 ? Math.PI : 0, 0 );

        mesh.name = 'interior-window';
        group.add( mesh );

    }

    /** The fixtures, as small horizontal discs below the ceiling. */
    addFixtureDiscs( group ) {

        ( this.room.fixtures ?? [] ).forEach( ( fixture, index ) => {

            const position = this.fixturePosition( fixture );
            const mesh = new Mesh( this.geometries.disc, this.materials.fixture[ index ] );

            mesh.scale.setScalar( FIXTURE_DISC_RADIUS_METRES * 2 );
            mesh.position.set( position.x, position.y, position.z );
            mesh.rotation.set( Math.PI / 2, 0, 0 );
            mesh.name = `interior-fixture-${ index }`;
            group.add( mesh );

        } );

    }

    /** BAKE 1 — the sky with its disc. The window's radiance, the pane's pixels, and nothing else. */
    bakeSky() {

        setSunUniform( this.skyMesh, this.sun );

        this.skyMesh.visible = true;
        this.skyMesh.showSunDisc.value = 1;

        if ( this.bakeRoom !== null ) this.bakeRoom.visible = false;

        this.bakeScene.environment = null;

        this.solarTarget = this.pmrem.fromScene( this.bakeScene, 0, 0.1, 20000, {
            size: this.size,
            position: BAKE_ORIGIN,
            renderTarget: this.solarTarget
        } );

    }

    /**
     * Re-solves the sky and the room, and writes both targets in place.
     *
     * ⚠️ **BAKE 2 HIDES THE SKY MESH**, and that is a correctness clause rather than a saving: the
     * room's faces are opaque and enclose the bake camera, so a visible 10 000-unit sky box behind
     * them contributes nothing except at the exact depth-precision seams where the two meet. The
     * sky reaches the interior map through the WINDOW PANE, which is the whole claim of this file.
     */
    bake() {

        this.bakeSky();

        this.skyMesh.visible = false;
        this.bakeRoom.visible = true;
        this.bakeScene.environment = null;

        this.interiorTarget = this.pmrem.fromScene( this.bakeScene, 0, 0.1, 200, {
            size: this.size,
            position: BAKE_ORIGIN,
            renderTarget: this.interiorTarget
        } );

        // 🚩 ASSIGNED ONCE. On every later bake these are ALREADY these textures and the assignment
        // is a no-op — which is the point: re-pointing `scene.environment` at a DIFFERENT texture
        // recompiles every material in the scene, 43–56 ms against 0.4 ms to re-bake the same one.
        this.scene.environment = this.interiorTarget.texture;
        this.scene.background = this.interiorTarget.texture;

        this.bakeCount ++;

        return this;

    }

    /**
     * Moves the sun, and only the sun. The gate for this item.
     *
     * 🎯 One assignment and one re-bake move FOUR things — the pane's pixels, every wall's radiance,
     * the image-based light, and (through `Avatar.lightOverridesFor`, which calls
     * `keyPlacementForInteriorSun`) the key's direction, colour and level. Nothing else in the room
     * is touched, which is what makes the measurement in the ROUND NOTE an attribution.
     */
    setSunElevation( elevationDegrees ) {

        this.sun = { ...this.sun, elevationDegrees };

        return this.bake();

    }

    /**
     * Puts the room and its environment into the rig's photometric units.
     *
     * ⚠️ **THE SAME `SKY_TO_RIG_SCALE` AS THE EXTERIORS, AND THAT IS THE POINT RATHER THAN A REUSE
     * OF CONVENIENCE.** Every radiance in this file is in `SkyMesh`'s own units — the window's read
     * off the sky's PMREM, the walls' derived from it, the fixtures' authored in it — so one
     * conversion serves the whole room exactly as it serves a beach. An interior is dimmer than a
     * beach because the ROOM IS DIMMER, not because it is scaled differently, and `scene.exposure`
     * is where a photographer opening up belongs.
     *
     * @param {number} rigExposure - `LightingRig.exposure`.
     */
    setRigExposure( rigExposure ) {

        const scale = SKY_TO_RIG_SCALE * rigExposure;

        this.roomIntensity.value = scale;
        this.scene.environmentIntensity = scale;
        this.scene.backgroundIntensity = scale;

        return this;

    }

    /** What the environment IS, read off the live scene rather than off the request. For `report()`. */
    describe() {

        const disc = solarDiscLight( this.sun.elevationDegrees, this.sky );
        const gate = windowAdmittance( this.sun, this.geometry, this.room.window.transmission ?? 1 );

        return {
            attached: this.scene !== null && this.scene.environment !== null,
            kind: 'interior',
            cubeSize: this.size,
            bakes: this.bakeCount,
            environmentIntensity: this.scene === null ? null : this.scene.environmentIntensity,
            roomInFrame: this.liveRoom !== null && this.liveRoom.parent !== null,
            liveFaces: this.liveRoom === null ? 0 : this.liveRoom.children.length,
            bakeFaces: this.bakeRoom === null ? 0 : this.bakeRoom.children.length,
            widthMetres: this.geometry.widthMetres,
            depthMetres: this.geometry.depthMetres,
            heightMetres: this.geometry.heightMetres,
            windowAreaSquareMetres: this.geometry.window.areaSquareMetres,
            windowAzimuthDegrees: this.room.window.azimuthDegrees,
            windowAdmittance: gate.admittance,
            windowTransmission: gate.transmission,
            interReflection: this.interReflection.value,
            sunAmbientIrradiance: [ this.sunAmbient.value.x, this.sunAmbient.value.y, this.sunAmbient.value.z ],
            fixtures: ( this.room.fixtures ?? [] ).map( ( f ) => ( { kelvin: f.kelvin, irradiance: f.irradiance } ) ),
            sunElevationDegrees: this.sun.elevationDegrees,
            sunAzimuthDegrees: this.sun.azimuthDegrees,
            sunColour: disc.colourHex,
            sunKelvin: Math.round( disc.correlatedColourTemperature ),
            sunIrradianceInSkyUnits: disc.irradiance,
            keyIrradianceInRigUnits: disc.irradiance * SKY_TO_RIG_SCALE * gate.admittance * gate.transmission,
            skyToRigScale: SKY_TO_RIG_SCALE
        };

    }

    /** Releases both targets, the generator, the sky, the room, and the two scene fields. */
    dispose() {

        if ( this.scene !== null ) {

            this.scene.environment = null;
            this.scene.background = null;
            this.scene.environmentIntensity = 1;
            this.scene.backgroundIntensity = 1;

        }

        this.liveRoom?.removeFromParent();
        this.bakeRoom?.removeFromParent();

        this.solarTarget?.dispose();
        this.interiorTarget?.dispose();
        this.pmrem?.dispose();

        this.skyMesh?.removeFromParent();
        this.skyMesh?.material?.dispose();
        this.skyMesh?.geometry?.dispose();

        if ( this.materials !== null ) {

            for ( const material of [ this.materials.wall, this.materials.floor,
                this.materials.ceiling, this.materials.pane, ...this.materials.fixture ] ) {

                material.dispose();

            }

        }

        this.geometries?.quad?.dispose();
        this.geometries?.disc?.dispose();

        this.solarTarget = null;
        this.interiorTarget = null;
        this.pmrem = null;
        this.skyMesh = null;
        this.bakeScene = null;
        this.bakeRoom = null;
        this.liveRoom = null;
        this.materials = null;
        this.geometries = null;
        this.scene = null;
        this.renderer = null;

    }

}

// --- colour -------------------------------------------------------------------------------------

/** A packed sRGB hex into a linear triple. `Color`'s own conversion, so there is one of them. */
function linearOfHex( hex ) {

    const colour = new Color();

    colour.setHex( hex, 'srgb' );

    return [ colour.r, colour.g, colour.b ];

}

/** The Rec.709 luminance of a hex albedo, linear. Used for the enclosure's mean reflectance. */
function linearLuminanceOfHex( hex ) {

    const [ r, g, b ] = linearOfHex( hex );

    return 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;

}

// 📋 --- ROUND NOTE: 11.4, measured 2026-08-18 ------------------------------------------------------
//
/**
 * 📋 **WHERE EVERY NUMBER IN THIS FILE CAME FROM, WHAT WAS REFUTED BY LOOKING, AND THE ONE CLAIM
 * THIS ROUND IS NOT ENTITLED TO MAKE.**
 *
 * Provenance for the whole note, and it is one command per table rather than a recollection —
 * `docs/LEARNINGS.md` §1.25r has nine instances and three of them were figures nobody could re-run:
 *
 *     npm run dev                                  # read the port; 5173-5179 were taken, this was 5180
 *     U=http://localhost:<port>/@fs<repo>/tools/critic/avatar-plate.html
 *     node tools/critic/interior-probe.mjs --selftest
 *     node tools/critic/interior-probe.mjs --url-base "$U" --out <dir> --between --scenes studio,beach,park,kitchen
 *     node tools/critic/interior-probe.mjs --url-base "$U" --out <dir> --scene kitchen --backdrop
 *     node tools/critic/interior-probe.mjs --url-base "$U" --out <dir> --scene kitchen --sun --elevations 4,10,15,22,30,45,60
 *     node tools/critic/interior-probe.mjs --url-base "$U" --out <dir> --scene kitchen --red
 *     node tools/critic/interior-probe.mjs --url-base "$U" --out <dir> --scene kitchen --exposure --ladder 1,1.8,2.4,3,3.4
 *
 * 900×1200, 1 step at 60 fps, seed 1, `?freeze`, quality `auto`, apple/metal-3 WebGPU. Luminances
 * are SCENE-LINEAR through `lightpath-probe.mjs`'s validated inverse of `Stage`'s ACES + sRGB; code
 * values are the plate's own sRGB, and where both appear the code column is the one the complaint
 * this item answers was filed in.
 *
 * ✅ **THE WHOLE BATTERY RUNS AS ONE SCRIPT THAT FINGERPRINTS THE TREE BEFORE AND AFTER ITSELF**,
 * which is the mechanism `GroundContact.js`'s ROUND NOTE asked for and the answer to the failure
 * that cost the last two rounds: a plate taken before another agent's edit in the same tree is not
 * a control. Run 1 opened and closed at `5b2c58d5b515a510…`; run 2 at `1706f8cb7772fb60…`. Neither
 * run moved under itself.
 *
 * 🔴 **AND THAT FINGERPRINT WAS STRUCTURALLY BLIND TO THE FILE IT IS WRITTEN IN, WHICH IS THIS
 * PROJECT'S OWN FAILURE MODE ARRIVING IN THE GUARD RATHER THAN IN THE GATE.** It was
 * `git diff | shasum`, and `git diff` does not report an UNTRACKED file — so on a round whose main
 * deliverable is a NEW file, the one thing the guard could not see was `InteriorEnvironment.js`
 * entire. It read identically before and after edits of any size to it. Caught by noticing the hash
 * did not move across a write that certainly changed the tree. The widened form is
 * `{ git diff; git status --porcelain; git ls-files --others --exclude-standard | xargs shasum } |
 * shasum`, and it is what a successor should bracket a battery with.
 *
 * ⚠️ **NO FINGERPRINT IS QUOTED FOR THE FINAL TREE, DELIBERATELY.** Writing one into this file
 * changes the tree it describes, so a quoted hash of the shipped tree is false the instant it is
 * written and the regress has no bottom. What closes it instead is two things that do not move: the
 * REPRODUCTION above, and the four plate digests below, re-taken after the last write to any file
 * in this round.
 * 🎯 Same shape as the eight structurally blind statistics `docs/LEARNINGS.md` counts: it was not
 * WRONG, it was answering a narrower question than the one it was being read for. A guard against
 * stale measurement that cannot see new files is a guard that passes hardest on the round that
 * needs it most.
 *
 * 🚩 **AND THE TWO RUNS ARE THE POINT, BECAUSE `docs/LEARNINGS.md` §1.25r's SHARPEST FORM IS *"a
 * table is only as fresh as the last write to the FILE it describes"* — AND THIS TABLE IS INSIDE
 * THAT FILE.** Quoting one fingerprint would be a lie by construction: writing the number changes
 * the tree the number describes, so the regress has no bottom. What closes it is not a hash, it is
 * a REPRODUCTION: run 1 was taken on the last functional tree, run 2 on the documented tree after
 * every comment below was written, and **every figure in this note is identical to the digit across
 * both** — including all four plate digests and the `studio` control's. The only edits between them
 * were comments and two gate clauses. That is the claim the last round could not make and stated
 * anyway.
 *
 * ✅ **THE FOUR DIGESTS, `--plate-loads 2`, RE-TAKEN AFTER THE LAST WRITE TO ANY FILE THIS ROUND
 * TOUCHED:**
 *
 *     ?bg=studio                 fence loads=2 sha=fac62c50d56590fb bitident=1/1 worst=0 px=0
 *     ?scene=studio              fence loads=2 sha=fac62c50d56590fb bitident=1/1 worst=0 px=0
 *     ?scene=kitchen             fence loads=2 sha=659afaf32efb8af0 bitident=1/1 worst=0 px=0
 *     ?scene=kitchen&frame=body  fence loads=2 sha=2b445a70e7c68dff bitident=1/1 worst=0 px=0
 *
 * 🚩 **THE FIRST TWO ARE THE CALIBRATION CONTROL AND THEY ARE THE DIGEST IT HAS CARRIED SINCE
 * 11.1** — `fac62c50d56590fb`, through `background: 'studio'` AND through `scene: 'studio'`. This
 * round added a scene KIND, a second environment engine, a new branch in `Avatar.build`, a changed
 * tier condition and three `export` words in `SkyEnvironment.js`, and the control did not move by a
 * subpixel. It cannot acquire a room by accident either: `environmentRequestOf` returns `null` for
 * a scene with no `room` and no `sky`, so no studio scene ever constructs the object.
 *
 * ## 🎯 THE ITEM'S GATE: ONE SUN, FOUR CONSUMERS, AND `sun.elevationDegrees` MOVED ALONE
 *
 * `?sceneover={"sun":{…,"elevationDegrees":E}}` — the public schema, the room held byte for byte,
 * nothing else touched. `admit` and `key irr` are read back off `report().scene.environment`; the
 * three luminances are masked rects on the plate.
 *
 *     elev  admit   key irr (rig)  key colour   near wall Y   far wall Y   forehead Y   frame Y
 *        4  1.0000        0.1992     #ffa846     1.7051e-2    2.1626e-2    1.9356e-1   1.1091e-1
 *       10  1.0000        0.5314     #ffce89     5.5088e-2    4.1849e-2    3.5982e-1   2.4539e-1
 *       15  1.0000        0.7957     #ffd9a2     6.2646e-2    4.4028e-2    3.9282e-1   2.6525e-1   ← SHIPPED
 *       22  1.0000        1.1405     #ffe0b4     1.2223e-1    6.1342e-2    7.2404e-1   5.3080e-1
 *       30  0.7481        1.1226     #ffe5c0     9.8435e-2    5.8159e-2    5.5851e-1   4.0521e-1
 *       45  0.0000        0.0000     #ffe9ca     3.9944e-2    5.5430e-2    1.7916e-1   1.0821e-1
 *       60  0.0000        0.0000     #ffeacf     4.1355e-2    5.8163e-2    1.8009e-1   1.0941e-1
 *
 * **The key moves 0.1992 → 1.1405 → 0.0000 and its colour walks #ffa846 → #ffeacf (1965 K → 5028 K),
 * the near wall moves 7.2×, the far wall 2.8×, the face 3.7× and the whole frame 4.8× — off ONE
 * assignment.** Not one of those five is authored: the key is `keyPlacementForSun`, the colour is
 * `Fex`, the walls are `pmremTexture` of the sky plus `solarDiscLight`'s own `irradianceRGB`, and
 * the frame is what they add up to.
 *
 * 🎯 **THE ROW PAIR THAT PROVES IT IS A MODEL AND NOT A GAIN IS 30 → 45.** The key switches OFF —
 * the solar beam has climbed above the window head and `windowAdmittance` returns 0, which is
 * geometry and is arithmetic in `windowAdmittance`'s own units — and **the far wall goes UP**
 * (5.8159e-2 → 5.5430e-2 → 5.8163e-2, i.e. it holds) while the face falls by 3.1×. A scene that had
 * one hidden brightness knob could not do that. The room keeps the sun's flux through the aperture
 * after the beam stops reaching the subject, which is what a room does.
 *
 * ⚠️ **AND THE FAR WALL IS NOT MONOTONE IN ELEVATION — IT PEAKS AT 22° AND SETTLES.** Stated because
 * a reader will expect monotone and the cause is real rather than noise: the wall carries two terms
 * that move oppositely. `sunFluxThroughWindow` rises with elevation (E_sun climbs faster than
 * cos θ_window falls, up to ~50°), while the point-source term reads `pmremTexture` along the
 * window's HORIZONTAL outward normal — and a sun at 60° is nowhere near that direction, so the read
 * falls. Two derived terms, opposite signs, one physical picture: a wall opposite a window is most
 * strongly lit when the sun is low enough to shine straight in.
 *
 * ## 🔴 RED PROOFS, IN CODE VALUES SO A BLACK ARM STILL REPORTS
 *
 *     arm                      forehead code        far wall          near wall        frame mean
 *     shipped                 (207.1,167.8,132.5)  ( 54.6, 42.4, 32.5)  ( 77.1, 55.8, 39.7)   112.07
 *     ?noenv — no IBL         (150.6,103.9, 74.3)  ( 53.6, 41.7, 32.0)  ( 42.9, 30.8, 22.1)    75.98
 *     ?noroom, shipped tier   (  0.0,  0.0,  0.0)  (  0.0,  0.0,  0.0)  (  0.0,  0.0,  0.0)     0.00
 *     balanced tier           (204.1,162.7,123.5)  ( 51.9, 39.7, 29.0)  ( 73.1, 52.2, 35.3)   106.67
 *     ?noroom on balanced     (204.1,162.7,123.5)  ( 51.3, 39.2, 28.4)  ( 75.0, 54.4, 37.5)   106.73
 *     no fixtures             (191.6,157.6,126.3)  ( 35.0, 33.7, 29.1)  ( 58.1, 46.3, 35.3)   102.88
 *     window transmission 0   (145.5, 82.3, 48.4)  ( 21.0,  6.3,  0.9)  ( 19.0,  5.5,  0.7)    45.88
 *
 * 🔴 **REMOVING THE ROOM'S ENVIRONMENT CHANGES THE FRAME.** `?noenv` takes the frame mean 112.07 →
 * 75.98 (−32.2%) and the forehead 207.1 → 150.6 on red and 132.5 → 74.3 on blue. The far wall barely
 * moves (54.6 → 53.6, −1.8%), which is the CONTROL inside the control: the walls are unlit materials
 * and `scene.environment` has no path to them, so a large move there would have meant this file was
 * lying about what lights what.
 *
 * 🔴 **WALLING OFF THE WINDOW CHANGES THE LIGHT.** `?sceneover` with the room's own
 * `window.transmission` at 0 — the public schema, no instrument flag — takes the derived key
 * **0.7957 → 0.0000**, the far wall (54.6, 42.4, 32.5) → **(21.0, 6.3, 0.9)** and the frame mean
 * 112.07 → 45.88 (−59.1%). What is left is the 2900 K fixture and nothing else, and the residue's
 * colour says so: blue falls by 97% where red falls by 62%.
 *
 * 🔴 **AND THE FIXTURE IS A REAL SECOND SOURCE AT A SECOND COLOUR TEMPERATURE.** Removing it takes
 * the far wall (54.6, 42.4, 32.5) → (35.0, 33.7, 29.1) — 36% of its red and 11% of its blue — so the
 * wall's R:B goes 1.68 → 1.20. An interior is the only scene family whose light has two sources that
 * disagree about white, and this is that, measured.
 *
 * ## ⚠️ ITEM 6, MEASURED AND NOT ASSUMED: AN INTERIOR **IS** THE FIRST SCENE KIND THAT RUNS ON THE
 * OCCLUSION TIERS
 *
 * The blocker `docs/PUNCHLIST.md` 11.2 records is *"with `backdrop: false` GTAO returns an all-black
 * frame"*, and `Avatar.js` refuses the combination in words. That refusal is about **nothing at
 * background depth**, not about the card — so `Avatar.build` now computes
 * `nothingAtBackgroundDepth = backdrop === false && scene.room === null`, and an interior does not
 * meet it. Measured, whole-frame mean code and the share of pure-black pixels:
 *
 *     kitchen, quality 'high'      112.07   0.00% black    ← `auto` resolves here
 *     kitchen, quality 'balanced'  106.67   0.00% black
 *     kitchen, quality 'fallback'  112.12   0.00% black
 *     beach,   quality 'high'      REFUSED in words, unchanged
 *
 * 🎯 **AND THE OCCLUSION IS DOING WORK RATHER THAN BEING TOLERATED**: `high` against `balanced` on
 * the same scene moves **99.91% of the frame at a worst Δ31/255, mean Δ5.394**. The near-global
 * share is expected and not a smell — GTAO scales the INDIRECT term and an interior's indirect term
 * is most of its light.
 *
 * 🔴 **AND THE `?noroom` ROW ABOVE IS THE PROOF FOR BOTH HALVES AT ONCE.** On the shipped tier,
 * taking the live room out reproduces the measured blackout EXACTLY — frame mean 0.00, every rect
 * (0,0,0). So the room is not decoration standing in front of a working occlusion pass; it is the
 * geometry that pass needs, and removing it puts an interior back into the exteriors' failure.
 *
 * ## 🚩 WHAT THE ROOM'S GEOMETRY IS WORTH AS A **BACKDROP**, AND THE HONEST ANSWER IS "IT DEPENDS
 * ON THE FRAMING", WHICH IS NOT WHAT THIS ITEM ASSUMED
 *
 * Same injection with the occlusion out of the way (`quality: 'balanced'`), whole-plate diff:
 *
 *     portrait   32.80% of pixels move, worst **Δ4/255**, mean Δ0.301
 *     body       63.41% of pixels move, worst **Δ46/255**, mean Δ4.175
 *
 * 🎯 **At portrait the live walls are very nearly redundant, and the reason is a good one rather than
 * a bug: `scene.background` is the PMREM of the SAME bake**, so a cube looked up by view direction
 * and a real wall 2.6 m away agree to within 4 code values. At body framing the walls are metres
 * across the frame, parallax is large, and the geometry is most of the picture.
 * ⏭️ So the accurate form of item 11.4.4 is: **the ROOM is the background at both framings; its
 * GEOMETRY is the background at body framing and its BAKE is the background at portrait.** Both come
 * out of the same seven quads and the same two bakes, which is why the distinction costs nothing —
 * but a successor reading "the room is the background" and deleting `scene.background` would find
 * portrait unchanged and body full of holes.
 *
 * ## 🚩 THE BACKDROP QUESTION, IN THE UNIT THE COMPLAINT WAS FILED IN
 *
 * `docs/CHECKPOINT.md` §14's flagship finding is **not** that the exteriors are flat — a sky has a
 * large gradient and `--backdrop` measures one. It is that they are *"the same picture"*: mean |Δ|
 * **2.42 code values** between `beach` and `park`. So the statistic that answers it is pairwise and
 * between scenes, over the same five masked background rects:
 *
 *     pair                mean |Δ| code values
 *     beach   vs park             1.98   ← the filed defect, reproduced on this instrument
 *     studio  vs kitchen         41.14
 *     beach   vs kitchen        120.08
 *     park    vs kitchen        121.20
 *     studio  vs beach          161.22
 *
 * **The interior is 61× further from `beach` than `park` is.** ⚠️ And that is a necessary condition
 * and not a sufficient one, said plainly: it rules out "another sky", it does not establish that a
 * judge can NAME the room. 11.6's blind judge is the only thing that can, and this tool must not be
 * quoted as standing in for it.
 *
 * Within one plate, the same rects, brightest over darkest:
 *
 *     studio  1.2073×,  0.76 codes   ← the emissive card, i.e. the flat control
 *     kitchen 1.4789×, 15.81 codes
 *     park    2.5912×, 64.02 codes
 *     beach   3.0868×, 75.06 codes
 *
 * ⚠️ **THE INTERIOR'S OWN SPAN IS THE SMALLEST OF THE THREE PLACES AND THAT IS QUOTED RATHER THAN
 * HIDDEN.** A wall lit by one window is a gentler gradient than a sky. Twenty times the studio card
 * and a fifth of a beach is the honest position, and the thing that makes it a room rather than a
 * brown card is the HUE and the corner, not the span.
 *
 * ## 🚩 THE ARITHMETIC THAT DECIDES WHAT AN INTERIOR CAN PUT IN A PORTRAIT FRAME, AND IT RULES OUT
 * THE OBVIOUS ANSWER
 *
 * The obvious move is "put the window in shot". It is not available, and the reason is the framing
 * contract rather than the room. `Avatar`'s portrait frame is 0.42 m of subject at a 26° vertical
 * field of view, which stands the camera **0.91 m** out; at the back wall 2.59 m away the frame is
 * **1.27 m wide and 0.48 m either side of the axis**. The camera sits at world azimuth 12°, so the
 * visible strip of back wall runs x ∈ [−0.84, +0.12] — and the subject's own head fills x ∈ [−0.4,
 * +0.25] of it. **No window on any wall of a domestic room is in a portrait frame, and the only
 * corner that can reach the frame lands behind the head.** Measured by placing one there: at
 * `centreOffsetMetres.x` 1.5 the corner projects to screen x ≈ 225 of 900 and the head covers
 * 80–540.
 *
 * 🎯 So what an interior actually puts behind a face at portrait is **a warm wall and a 1.48×
 * gradient across it** — and that is what the shipped plate has.
 *
 * 🔴 **THIS PARAGRAPH ALSO CLAIMED "a bright reveal at the frame's left edge where the window's own
 * wall runs out of shot", AND THAT IS RETRACTED.** With the figure hidden, the left edge is FLAT at
 * ~42 code values top to bottom (x=3: 36–46; x=60: 38–46). With the figure present, x=60 runs
 * 64 → 143 → 71 with its peak at y≈440–480 — **exactly where the head's lit cheek is. It is the
 * figure's own bloom, and it tracks the head.** The same retraction applies to `bedside-night`'s
 * "curtained window visible as a dark rectangle at body framing", which measures 0 px.
 * ⚠️ **And the tell was in this very paragraph**: the arithmetic directly above rules a window out
 * of a portrait frame, and the sentence four lines later described seeing one. A file that contains
 * both its own proof and its own contradiction is the §1.25r pattern at its purest — the number was
 * right, the prose beside it was written from expectation.
 *
 * The corner IS a body-framing asset and is genuinely there: `kitchen` at `frame=body` shows the
 * corner, the ceiling line, the floor and the falloff. The WINDOW is not, at either framing.
 *
 * ## Exposure: what it was anchored on, and what that cost
 *
 * An interior at `exposure: 1` is **2.09 stops** under the `studio` control on the same forehead
 * probe `docs/CHECKPOINT.md` §7 used. The ladder, against the control's 5.9640e-1 (which this
 * instrument reproduces to five figures from the committed record):
 *
 *     exposure   forehead Y   × control   cheek Y     far wall Y   wall:face
 *         1.00   1.5223e-1     0.2552    1.1434e-1   1.7619e-2     0.1157
 *         1.80   2.7874e-1     0.4674    2.1195e-1   3.2307e-2     0.1159
 *         2.40   3.9282e-1     0.6586    3.0047e-1   4.4028e-2     0.1121   ← SHIPPED
 *         3.00   5.1776e-1     0.8681    3.9219e-1   5.6358e-2     0.1088
 *         3.40   6.3860e-1     1.0708    4.5418e-1   6.4657e-2     0.1012
 *
 * 🔴 **THE ANCHOR IS THE PLATE AND NOT THE STATISTIC, AND THIS ROUND EARNED THAT THE HARD WAY.**
 * The obvious anchor is "match the control's forehead", which is `exposure ≈ 3.2`. It was shipped
 * for one iteration and the plate is **chalky** — a white, chroma-poor face with the whole lit side
 * flattened. **Every number said it was fine**: the forehead was 0.96–1.07× the control, G5 clipping
 * was **0 at every rung including 3.4**, and the cheek's C\* was *higher* than the control's at every
 * exposure (26.57 at 2.4, 21.70 at 3.4, against `studio`'s 18.66) because the patch is also darker.
 * Nothing in the battery could see it. Opening the plate could. That is `docs/LEARNINGS.md` §1.2
 * happening inside the round written to honour it, and the correction is the item's discipline, not
 * a footnote to it.
 *
 * **So `exposure: 2.4` is chosen off the picture and its cost is stated: the forehead sits at
 * 0.6586× the `studio` control — 0.60 stops under — and `report().scene.lighting.calibrated` reads
 * false, as it does for `beach` (1.22) and `park` (1.90).** ⚠️ And `lighting.exposure` is capped at
 * 4.0 by `Avatar.resolveLightingOption`, so a darker interior — `bedside-night`, `living-room` — has
 * about 0.74 stops of headroom left on this axis and will need its light rather than its stop.
 *
 * ⚠️ **THE ONE RATIO EXPOSURE CANNOT MOVE, AND IT IS THE ITEM'S REAL LIMIT.** `wall:face` is
 * 0.1157 → 0.1012 across the whole ladder: **the far wall is 3.1 stops under the face and no stop
 * fixes it**, because it is geometry — the subject is 1.2 m from a 2.1 m² aperture and the wall is
 * 2.6 m from it. That is what a window portrait IS, and it is why the frame reads as one.
 *
 * ## 🔴 REFUTED THIS ROUND, BY LOOKING AND BY MEASURING
 *
 *   - **A ROOM LIT ONLY BY `pmremTexture( sky, windowNormal )`.** The first working build read the
 *     window's radiance off the sky's PMREM at roughness 0.55 and nothing else, and it rendered a
 *     muddy brown wall about four stops under the face. The cause is in the read: a 0.55 convolution
 *     averages the solar disc over most of a hemisphere, so the largest term arriving through a
 *     sunlit window was being smeared to nothing. `sunFluxThroughWindow()` is the repair and it adds
 *     no model — `solarDiscLight().irradianceRGB`, the same `Fex`, times a cosine and an area.
 *   - **THE STUDIO RIG'S ANALYTIC BUDGET INDOORS.** Before the `scales` above, `report()` showed the
 *     rim at irradiance **2.4 against a derived key of 0.318** — the blue edge light was 7.5× the
 *     sun, the floor rendered violet at body framing exactly as `36ba35d` describes, and every
 *     measurement of "the interior's light" would have been a measurement of the rim. Cut to
 *     `rim × 0.02`, `fill × 0.15`, `kicker × 0.10` the floor renders hue **16.9–20.3** against its
 *     declared `#6b5443` at **25.5** and the wall **27.2** against `#d8cfc2` at 35.5 — both warm, in
 *     the right direction for a low sun, and neither violet.
 *     ⚠️ Note the shape of the fix: indoors the fill IS the room, and the room is the environment
 *     map. An analytic fill at studio strength is the same light counted twice.
 *   - **A SHEER CURTAIN VIA `sun.occlusion`, TRIED AND DROPPED.** `occlusion: 0.6` reads correctly
 *     against the field's own definition (it dims the disc and leaves the enclosure's flux, which is
 *     what a net does) and it does soften the key — but it cannot move `wall:face`, because it scales
 *     the numerator of a ratio whose denominator it also feeds. Kept at 0 so `kitchen` has one fewer
 *     number that does not earn its place; the field still works and `living-room` is where it will.
 *
 * ## 🔴 AND ONE BUG WORTH THE SPACE, BECAUSE ITS SYMPTOM POINTS AT THE WRONG FILE
 *
 * The first build rendered the room **exactly black — every background pixel (0,0,0)**, with the
 * subject correctly lit, no error on any path and `report()` reporting a fully attached environment
 * with 7 live faces and 8 bake faces. The cause is one call: `vec3( linearOfHex( hex ) )` was handed
 * a JS **array**. TSL's `vec3()` takes components, not an array, and the result is a node that
 * compiles and evaluates to zero. `vec3( ...linearOfHex( hex ) )` is the whole fix.
 * 🎯 The lesson is the one the header already states for `PMREMGenerator`: on this stack an
 * argument-shape mistake does not throw, it renders black — and a black frame is indistinguishable
 * from a broken material, a re-parented bake scene, a failed PMREM and a wrong tier. **The way out
 * was reading the plate's actual code values and finding a HARD zero rather than a small number**;
 * a dim room would have been an exposure problem and an exact zero is an arithmetic one.
 *
 * ## 🚩 THIS IS ONE INTERIOR, AND ONE PROVES A SPECIAL CASE
 *
 * `beach` and `park` are two on purpose, and the design doc says why: two scenes that differ in five
 * parameters with no code path between them are what makes a model parametric rather than fitted.
 * **`kitchen` is one, so the honest claim is "an interior can be built out of the same sun", and no
 * more.** What the second one must vary is listed above `kitchen` in `Scene.js` and is repeated here
 * because it is the actionable half: a window on a DIFFERENT WALL (the back-wall case, where the sun
 * is behind the subject and the enclosure is the whole key); a sun BELOW the horizon (where
 * `windowAdmittance` returns 0 and the fixtures are the only light — a branch `kitchen` never
 * enters); and a room whose walls are NOT warm (wall albedo is the interior's answer to what ground
 * albedo is outdoors, and 11.3 swept that over 70× before it believed it).
 *
 * ⏭️ **AND ONE THING THAT IS NOT MODELLED, NAMED SO IT IS VISIBLE.** The sun's beam through the
 * window makes a bright PATCH on the floor and the opposite wall, and it is the strongest secondary
 * source in a real sunlit room. Its energy is in the enclosure term, spread evenly; its SHAPE is
 * not. That is a projected-quad term against `InteriorEnvironment`, or 11.8's set dressing, and it
 * is not claimed here.
 */
