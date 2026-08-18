/**
 * SkyEnvironment — the sky, the sun, and the image-based light they make. Punch-list **11.2**.
 *
 * ## 🚩 THIS IS THE LARGEST MISSING TERM IN THE RENDERER, AND IT WAS MISSING TO THREE DECIMALS
 *
 * `docs/CHECKPOINT.md` §7 decomposes a forehead pixel term by term and measures **IBL at 0.00%** —
 * not estimated, measured, because `scene.environment` and `environmentNode` were both `null`.
 * Every skin, eye and hair number in this repository was taken with no image-based light at all.
 * This file is what puts one there, and the punch list is explicit that the committed gates will
 * move and that the movement is the item's COST rather than a regression.
 *
 * ## What it does, in one diagram
 *
 *     sun( elevation, azimuth )  ──►  SkyMesh uniforms
 *                                          │
 *              ┌───────────────────────────┴────────────────────────┐
 *              │ BAKE 1  disc ON,  sky only        BAKE 2  disc OFF, sky + ground │
 *              ▼                                    ▼
 *        solarTarget ─────► scene.background   environmentTarget ─────► scene.environment
 *              │                                    ▲
 *              └── lights the ground disc ──────────┘
 *
 *              and the SAME `Fex` that drew the disc ──► the rig's key colour and irradiance
 *
 * ## 🎯 THE ONE CLAIM THAT MAKES THIS HONEST: THERE IS EXACTLY ONE SUN
 *
 * The punch list asks that *"the key light is aimed along the same `sunPosition` and takes its
 * colour and irradiance from the same elevation, so a scene cannot have its sky and its key
 * disagree."* The tempting way to satisfy that is a hand-authored ramp — 2000 K at the horizon,
 * 5500 K at noon, interpolate — and a hand-authored ramp is a SECOND model of the same sun, which
 * is precisely how a sky and its key come to disagree. So every number below is computed from the
 * constants that are already inside `node_modules/three/examples/jsm/objects/SkyMesh.js`:
 * `solarDiscLight()` re-evaluates SkyMesh's own extinction `Fex` on the CPU and reads the solar
 * disc out of the sky that is being drawn behind the figure.
 *
 * 🎯 **AND IT WAS VALIDATED ON PIXELS BEFORE IT WAS SHIPPED.** `tools/spikes/sky-env.html` §E ran
 * three arms against one mask on an r=0.85 sphere: sky with the disc HIDDEN reads 1.2988; the same
 * sky with the disc BAKED into a 256 cube reads 2.0979; the same sky plus an analytic
 * `DirectionalLight` carrying this file's `solarDiscLight()` irradiance and colour reads 2.1789. So
 * the baked disc captures (B−A)/(C−A) = **90.8%** of the analytic sun's energy and the analytic key
 * over-delivers by **1.10×** — two independent models of one sun agreeing to within 10% with no
 * fitting anywhere. That is the measurement that licenses the derivation.
 *
 * ## Why the analytic key is kept even though the baked disc carries 91% of its energy
 *
 * Because the two carry it in completely different places. Mirror-sphere (r = 0.05) peak radiance
 * across those same three arms: **2.15 / 536.79 / 42.13**. A 256-cube face texel spans 0.35° against
 * the disc's 0.53°, so the baked disc is a resolution-limited 537-radiance smear where the analytic
 * light gives a small sharp 42 specular. Catchlights and skin speculars are exactly the territory
 * the blind critic has been reporting for rounds, so the disc is HIDDEN in the environment bake —
 * which is also what `SkyMesh`'s own docstring instructs — and the sharp half is the rig's key.
 *
 * ## 🚩 THE GOTCHA THAT COST THE SPIKE THREE RUNS, AND HOW THIS FILE IS IMMUNE TO IT
 *
 * `Object3D.add()` RE-PARENTS; it does not share. So a `SkyMesh` that is both the backdrop and the
 * bake subject is REMOVED from the bake scene the moment it is added to the live one, and every
 * later bake renders an empty scene into the cube. Nothing errors: `fromScene()` returns a valid
 * target, `scene.environment` accepts it, the material samples it, and the subject renders black —
 * which looks exactly like a broken material and invites three wrong hypotheses.
 *
 * This file cannot hit it, because **the `SkyMesh` never enters the live scene at all**: the
 * backdrop is `scene.background = solarTarget.texture`, the PMREM of the sky rather than the sky
 * itself. That is not only a way round a bug — the spike measured the two backdrops
 * INDISTINGUISHABLE with the disc hidden (frame means 1.092527 against 1.093873, **0.12%**), it
 * costs less per frame (+0.157 ms against +0.271 ms), and it dodges the one risk the spike named
 * and did not measure: `SkyMesh` is an ordinary `Mesh`, so on this project's DEFERRED path it would
 * write the normal, velocity and sssMask attachments too, with whatever velocity the stock node
 * computes for a 10 000-scale box. `GBuffer.js`'s own header already warns about a related morph
 * case. A background texture writes none of them.
 *
 * ## 🚩 ONE RENDER TARGET PER ROLE, FOR THE LIFE OF THE RENDERER
 *
 * Measured in the spike, §D0: pointing `scene.environment` at a DIFFERENT texture costs a
 * **43–56 ms** material pipeline rebuild on the next frame; re-baking into the SAME texture's
 * contents costs **0.4–0.5 ms**. A target per scene buys the rebuild and nothing else. So both
 * targets are allocated once in `attachTo()` and every later `bake()` writes into them.
 *
 * ⏭️ And the double-buffer this implies was written, measured and RETIRED in the spike: re-baking
 * into the target currently assigned to `scene.environment` is fine (disc mean 1.29878 at 22° →
 * 1.96022 at 45° → 1.29878 back, with no detach and no `needsUpdate`). Recorded so the next reader
 * does not re-derive a second buffer from the same wrong symptom.
 *
 * ## ⚠️ CLOUDS ARE ON BY DEFAULT IN `SkyMesh` AND THEY ARE DRIVEN BY THE TSL `time` NODE
 *
 * `cloudCoverage` defaults to 0.4 and the noise is scrolled by `time`, so an environment baked with
 * clouds on is a DIFFERENT environment on every bake — no reproducible plate, and a scene's look
 * would depend on how long the page had been open. `Scene.js`'s `SKY_FIELDS` refuses the field with that reason
 * rather than exposing a knob that quietly retires every plate in the repository.
 *
 * ## ⚠️ AND THE UNITS DO NOT MATCH THE RIG'S. THIS IS THE PART THAT LOOKS WHITE IF IT IS SKIPPED
 *
 * `SkyMesh` emits its own absolute scale and it has nothing to do with a photographic rig's:
 * `LightingRig`'s key delivers irradiance **3.0**, and the same sun at 60° elevation delivers
 * **25.12** in SkyMesh units — a factor of 8.4. The spike needed `toneMappingExposure` 0.1386 to
 * put a grey sphere at 0.18 linear. A scene that switches from the studio rig to sky IBL without
 * re-anchoring does not look outdoors; it looks blown.
 *
 * 🎯 `SKY_TO_RIG_SCALE` is that one conversion and it is the SAME number in both directions:
 * `keyPlacementForSun()` multiplies the analytic sun's irradiance by it, and `Avatar` sets
 * `scene.environmentIntensity` and `scene.backgroundIntensity` to it (times the rig's own
 * `exposure`, so the environment tracks exposure exactly as the four direct lights do). One scale
 * for the light and the image means they cannot drift apart.
 *
 * Sources: A. J. Preetham, P. Shirley, B. Smits, *A Practical Analytic Model for Daylight*,
 * SIGGRAPH 1999 (the model `SkyMesh` implements); Allen, *Astrophysical Quantities* (the solar
 * angular diameter); C. S. McCamy, *Color Research & Application* 17(2), 1992 (the CCT fit).
 * The derivation, the timings and the nine screenshots are `tools/spikes/sky-env.html` and
 * `tools/spikes/results/sky-env.json`.
 */

import {
    CircleGeometry,
    Color,
    Mesh,
    MeshStandardNodeMaterial,
    PMREMGenerator,
    Scene as BakeScene,
    Vector2,
    Vector3
} from 'three/webgpu';

import {
    backgroundBlurriness,
    backgroundIntensity,
    cameraPosition,
    fog,
    pmremTexture,
    positionView,
    positionWorld,
    smoothstep,
    uniform
} from 'three/tsl';

import { SkyMesh } from 'three/examples/jsm/objects/SkyMesh.js';

import { SKY_DEFAULTS } from './Scene.js';

// --- SkyMesh's own constants, transcribed --------------------------------------------------------
//
// Every one of these appears LITERALLY in `three/examples/jsm/objects/SkyMesh.js` at r185. They are
// transcribed rather than imported because they live inside a `Fn()` closure with no export, and
// they are listed together so a reader can diff them against that file in one pass.

const TOTAL_RAYLEIGH = [ 5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5 ];
const MIE_CONST = [ 1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14 ];
const CUTOFF_ANGLE = 1.6110731556870734;   // pi / 1.95 — SkyMesh calls it the "earth shadow hack"
const STEEPNESS = 1.5;
const SUN_INTENSITY_EE = 1000.0;
const RAYLEIGH_ZENITH_LENGTH = 8.4e3;
const MIE_ZENITH_LENGTH = 1.25e3;
const SUN_DISC_GAIN = 19000.0;             // L0 += vSunE * 19000 * Fex * sundisc
const SKY_OUTPUT_SCALE = 0.04;             // texColor = ( Lin + L0 ) * 0.04 + ...

const DEGREES = Math.PI / 180;

/**
 * Solid angle of the solar disc from Earth. 0.533° mean angular diameter (Allen, *Astrophysical
 * Quantities*), so Ω = 2π(1 − cos(radius)) = 6.7967e-5 sr.
 */
export const SUN_SOLID_ANGLE_STERADIANS =
    2 * Math.PI * ( 1 - Math.cos( 0.5 * 0.533 * DEGREES ) );

/**
 * The blackbody temperature `SkyMesh`'s implicit white sun is corrected TO.
 *
 * ⚠️ **THIS IS THE ONE NON-DERIVED STEP IN THE FILE AND IT IS LABELLED AS ONE.** `SkyMesh` has no
 * spectrum: its `Fex` is a per-channel transmittance applied to an extraterrestrial sun it
 * implicitly treats as equal-energy in RGB — i.e. as white, which in a linear-sRGB pipeline means
 * D65, ~6500 K. The real extraterrestrial sun is a ~5778 K G2V blackbody. Left uncorrected this
 * model's noon sun reads about 700 K too cool.
 */
export const EXTRATERRESTRIAL_KELVIN = 5778;

/**
 * ⚠️ `sunPosition`'s MAGNITUDE IS NOT INERT, and it is a trap that is invisible at the call site.
 *
 * `SkyMesh` normalises `sunPosition` for the direction but reads its RAW `.y` for the sun-fade term
 * `exp( sunPosition.y / 450000 )`. On a unit vector that exponent is ~1e-6, so `sunfade` pins to 1
 * and `rayleighCoefficient` equals the `rayleigh` uniform exactly. Set it on a sphere of radius
 * 450000 instead — as several three.js examples do — and `sunfade` becomes elevation-dependent, the
 * rayleigh coefficient drops by up to 1, and the sky changes hue for a reason nothing in the caller
 * mentions. RADIUS 1, matching three's own `webgl_shaders_sky`. Every number here assumes it.
 */
export const SUN_POSITION_RADIUS = 1;

/**
 * The elevation at which a derived sun equals the studio key's own irradiance, and the value it
 * equals there.
 *
 * 🚩 **THIS PAIR IS A CHOICE AND IS STATED AS ONE — IT IS NOT DERIVABLE FROM ANYTHING.** Anchoring
 * a near-noon sun to `FORM_LIGHTS.key.irradiance` (3.0) means an outdoor scene at midday puts
 * roughly the studio amount of light on the subject, so `docs/PROGRESS.md`'s measured record stays
 * COMPARABLE instead of being retired by an arbitrary exposure. Any other anchor is defensible;
 * none of them is derived.
 *
 * Consequence, and it is the right physics rather than a bug: a 15° golden-hour sun then takes rig
 * irradiance 0.93 rather than 3.0 — a genuinely darker scene — and the scene's own `exposure` field
 * is what a photographer opening up corresponds to.
 */
export const IRRADIANCE_ANCHOR_ELEVATION_DEGREES = 60;
export const IRRADIANCE_ANCHOR = 3.0;

/**
 * The cube face size both bakes use.
 *
 * Measured in the spike, apple/metal-3, median of 5 after a discarded first bake:
 *
 *     | cube | atlas     | submit  | to GPU idle | first bake | texture memory |
 *     |------|-----------|---------|-------------|------------|----------------|
 *     | 128  | 384x512   | 1.00 ms |      7.0 ms |    19.0 ms |        3.75 MB |
 *     | 256  | 768x1024  | 0.90 ms |      8.8 ms |    12.8 ms |       13.50 MB |
 *     | 512  | 1536x2048 | 0.80 ms |     13.6 ms |    18.2 ms |       54.00 MB |
 *
 * 🎯 The MAIN THREAD blocks for about a millisecond; the rest is GPU. All three sit on the "fine at
 * a scene change" side of the 40 ms line by a factor of 3–6, so this is chosen for MEMORY rather
 * than for time: two targets at 256 is 27 MB against 108 MB at 512, and a Preetham sky with the
 * disc hidden has no spatial frequency for the extra resolution to carry.
 */
export const PMREM_CUBE_SIZE = 256;

/**
 * Where the cube camera stands for the bake, and how big the ground disc is.
 *
 * `fromScene`'s `position` option puts the six faces somewhere other than the world origin, which
 * matters here for exactly one reason: the ground is a plane at y = 0 and a camera AT y = 0 sits in
 * its plane, so the lower hemisphere would be a knife edge rather than a floor. 1.5 m is about a
 * standing person's eye line — the height the figure's own head is at.
 *
 * The disc radius then decides how much of the lower hemisphere is ground rather than the horizon
 * showing past its rim: at 1.5 m up, a 500 m disc closes everything below **0.17°** of the horizon.
 */
const BAKE_EYE_HEIGHT_METRES = 1.5;
const GROUND_DISC_RADIUS_METRES = 500;

// --- the air, punch-list 11.5 ---------------------------------------------------------------------

/**
 * 🎯 **THE AIR IS ONE NODE AND IT CARRIES TWO TERMS THAT ARE NOT THE SAME KIND OF THING.** Naming
 * them apart is the whole of why this block is legible, and conflating them is how a geometry
 * repair gets shipped as physics.
 *
 * **1. `haze` — the scene's own air, `scene.air.haze`, 11.5's deliverable.** Distance extinction
 * toward the sky, in the `exp( −(kd)² )` form three's own `densityFogFactor` uses. It is what puts
 * DEPTH between the subject and the background, and it is zero in every scene that does not ask
 * for it — so a scene with `haze: 0` gets exactly the picture it had before this term existed,
 * everywhere except the closure below.
 *
 * **2. `closure` — the ground plane's outer margin, and it is a TRUNCATION REPAIR, not weather.**
 * `GroundContact`'s plane is finite. Its far edge against the sky is the *"hard aliased matte
 * line"* HEAD's own commit body reports — measured on the shipped `beach` body plate at 100 code
 * values across ONE row (x=120, y=737→738, (159,182,191) → (59,89,117)), sloping 8 px across the
 * frame because the plane is a square standing at the camera's own 12° azimuth. **A coastline is
 * not a step function and no amount of haze fixes an edge the haze does not reach**, so the plane
 * dissolves into the sky over its own outer margin and its edge is never drawn. This term exists
 * whenever the ground meets a sky, at `haze: 0` as much as at `haze: 1`.
 *
 * 🚩 **AND THE COLOUR IS NOT A CHOSEN COLOUR — IT IS THE BACKDROP ITSELF, READ BACK.** The obvious
 * implementation is a horizon colour computed on the CPU and handed in as a uniform, and it is
 * wrong for a reason the plate shows: the sky's own horizon varies 43 code values ACROSS THE FRAME
 * on `beach` (x=120 reads (159,182,191) and x=800 reads (116,144,160), same 30-row band above the
 * seam), because it brightens toward the sun. One uniform closes the seam at one azimuth and opens
 * it everywhere else. So the fog colour is `pmremTexture()` of `solarTarget` — the SAME texture
 * `scene.background` is drawn from, sampled along the same view direction, through the same
 * `backgroundIntensity` and `backgroundBlurriness` three multiplies the backdrop by
 * (`Background.js:91-94`, r185). Fully hazed ground and the sky behind it are then the same
 * expression of the same texture, so **the seam closes by construction rather than by tuning** and
 * it stays closed when the sun moves, when the exposure moves, and at any width.
 *
 * ✅ **AND THE BACKDROP ITSELF CANNOT BE FOGGED, BY THREE'S OWN CONSTRUCTION RATHER THAN BY LUCK.**
 * The obvious worry about a scene-wide fog node is that it eats the sky it is supposed to blend
 * into — a fog that replaces the background with a reading of the background is a feedback loop
 * waiting for a rounding error. It cannot happen: `Background.js:125` sets `nodeMaterial.fog =
 * false` on the background mesh, and `NodeMaterial.setupOutput` gates the whole fog step on
 * `this.fog === true` (`NodeMaterial.js:1188`). Confirmed on plates as well as in the source — the
 * `sky-high` mask (620,480,240,60) reads (165.12, 197.62, 209.03) to five figures both with the
 * aerial node installed and with `?noair`.
 *
 * ⚠️ **THE SUBJECT IS UNTOUCHED AT `haze: 0`, EXACTLY, AND THAT IS DELIBERATE.** The closure is a
 * `smoothstep` on horizontal distance from the ground plane's own centre, and the figure stands at
 * that centre — so its factor is a hard zero and `mix( output, sky, 0 )` returns `output`. This
 * round does not own the light on the skin and must not move it. Verified as a measurement, not as
 * an argument: see the ROUND NOTE at the foot of `GroundContact.js`.
 */

/**
 * Distance at which `haze: 1` leaves the ground 95% dissolved into the sky. Extinction is LINEAR in
 * `haze`, so 0.5 doubles it to 50 m and 0.2 gives 125 m — i.e. the field reads as "how much air",
 * and the metres it buys are one multiplication away rather than hidden in a curve.
 *
 * 25 m is chosen so that the shipped `air.haze` range [0, 1] spans "a clean day at this framing"
 * to "you cannot see the far end of the ground plane", which is the range a scene author needs.
 */
export const HAZE_95_PERCENT_METRES_AT_FULL = 25;

/** `(k·d)² = 3` is `1 − e^−3` = 0.9502. The constant that makes the line above true. */
const HAZE_95_PERCENT_EXPONENT = Math.sqrt( 3 );

/**
 * Where the ground's dissolve begins, as a fraction of the plane's half-extent.
 *
 * 0.45 rather than something later: the closure has to be a GRADIENT and not a soft edge. At 0.8
 * the plate still reads a band; at 0.45 the ground shades into the sky over most of its far half,
 * which is what a hazy coastline looks like. Measured on plates, not chosen from a curve — the
 * ROUND NOTE carries the seam figures at both.
 */
const CLOSURE_START_FRACTION = 0.45;

// --- the sun model -------------------------------------------------------------------------------

/**
 * WORLD-SPACE sun direction from elevation and azimuth, three.js Y-up.
 *
 * `azimuthDegrees` is measured about +Y from world +Z, positive toward +X — three's own sky example
 * convention (`setFromSphericalCoords( 1, degToRad( 90 - elevation ), degToRad( azimuth ) )`).
 *
 * 🚩 **THIS IS NOT `LightingRig`'s AZIMUTH AND CONFUSING THE TWO IS THE FAILURE 11.2 EXISTS TO
 * PREVENT.** `LightingRig.js:265` measures azimuth FROM THE CAMERA — 0° is a light sitting at the
 * camera, positive toward the camera's right — precisely so a rig FOLLOWS the camera. The sun does
 * not follow the camera. Copy a world sun azimuth straight into `key.azimuthDegrees` and the key
 * swings when the camera orbits while the sky stays put. `rigAzimuthForSun()` is the conversion.
 */
export function sunDirectionWorld( elevationDegrees, azimuthDegrees ) {

    const polar = ( 90 - elevationDegrees ) * DEGREES;
    const azimuth = azimuthDegrees * DEGREES;
    const horizontal = Math.sin( polar );

    return {
        x: horizontal * Math.sin( azimuth ),
        y: Math.cos( polar ),
        z: horizontal * Math.cos( azimuth )
    };

}

/**
 * A WORLD sun azimuth into the CAMERA-RELATIVE azimuth `LightingRig` wants.
 *
 * `LightingRig.solve()` builds its basis from `toCamera` (focus→camera, flattened to horizontal) and
 * `right = ( toCamera.z, 0, −toCamera.x )`; a light at rig azimuth A sits along
 * `toCamera·cos A + right·sin A`. So rig azimuth 0 points at the camera and the camera's own world
 * azimuth is `atan2( offset.x, offset.z )`.
 *
 * @param {number} sunAzimuthDegrees - world azimuth of the sun.
 * @param {number} cameraAzimuthDegrees - world azimuth of the camera, same convention.
 * @returns {number} in (−180, 180].
 */
export function rigAzimuthForSun( sunAzimuthDegrees, cameraAzimuthDegrees ) {

    let relative = ( sunAzimuthDegrees - cameraAzimuthDegrees ) % 360;

    if ( relative > 180 ) relative -= 360;
    if ( relative <= -180 ) relative += 360;

    return relative;

}

/**
 * The whole model: an elevation and the four sky uniforms in, the light the solar disc IS out.
 *
 * The ported chain, and every line of it is in `SkyMesh.js`:
 *
 *     sunfade  = 1 − clamp( 1 − exp( sunPosition.y / 450000 ), 0, 1 )
 *     βR       = totalRayleigh · ( rayleigh − (1 − sunfade) )
 *     βM       = 0.434 · (0.2 · turbidity · 1e-17) · MieConst · mieCoefficient
 *     vSunE    = 1000 · max( 0, 1 − e^( −(cutoffAngle − acos cosZenith) / steepness ) )
 *     inverse  = 1 / ( cos θz + 0.15 · (93.885 − θz°)^-1.253 )        // Preetham's air mass
 *     Fex      = exp( −( βR·8.4e3·inverse + βM·1.25e3·inverse ) )
 *     L_disc   = vSunE · 19000 · Fex · 0.04
 *
 * `L_disc` is the disc's RADIANCE. A directional light replacing it must carry its IRRADIANCE,
 * `E = L · Ω_sun`. That is the entire derivation, and it is why the analytic key and the image-based
 * sky cannot drift: they are two readings of one `Fex`.
 *
 * ⚠️ **`irradiance` IS THE PEAK CHANNEL, NOT THE LUMINANCE, AND THE CHOICE IS FORCED.**
 * `LightingRig.js:1212` accumulates `irradiance * colour.r` per channel and `solve()` hands
 * `irradiance` to a three.js light whose contribution is `color * intensity`. Both multiply a scalar
 * by a peak-normalised colour, so peak in / peak out makes `colourLinear * irradiance ===
 * irradianceRGB` hold exactly. Define it as a luminance instead and the product comes out ~15% low
 * on a warm light, because a peak-normalised warm colour has luminance below 1.
 */
export function solarDiscLight( elevationDegrees, sky = {} ) {

    const turbidity = sky.turbidity ?? SKY_DEFAULTS.turbidity;
    const rayleigh = sky.rayleigh ?? SKY_DEFAULTS.rayleigh;
    const mieCoefficient = sky.mieCoefficient ?? SKY_DEFAULTS.mieCoefficient;

    // Vertex stage. With |sunPosition| = 1 the fade exponent is ~1e-6 and `sunfade` is 1 to eleven
    // places, so `rayleighCoefficient === rayleigh`. Computed rather than assumed, so a future
    // radius change shows up here instead of silently.
    const sunPositionY = SUN_POSITION_RADIUS * Math.sin( elevationDegrees * DEGREES );
    const sunfade = 1 - clamp( 1 - Math.exp( sunPositionY / 450000 ), 0, 1 );
    const rayleighCoefficient = rayleigh - ( 1 - sunfade );

    const betaR = TOTAL_RAYLEIGH.map( ( component ) => component * rayleighCoefficient );

    const c = 0.2 * turbidity * 1e-17;
    const betaM = MIE_CONST.map( ( component ) => 0.434 * c * component * mieCoefficient );

    const zenithAngleCos = clamp( Math.sin( elevationDegrees * DEGREES ), -1, 1 );
    const sunIntensity = SUN_INTENSITY_EE * Math.max(
        0,
        1 - Math.exp( -( CUTOFF_ANGLE - Math.acos( zenithAngleCos ) ) / STEEPNESS )
    );

    // Fragment stage along the sun's own direction. `max( 0, dot( up, dir ) )` clamps the optical
    // path at the horizon, which is what stops the 1/cos singularity.
    const zenithAngle = Math.acos( Math.max( 0, Math.sin( elevationDegrees * DEGREES ) ) );
    const zenithDegrees = zenithAngle / DEGREES;
    const airMassInverse = 1 / (
        Math.cos( zenithAngle ) + 0.15 * Math.pow( 93.885 - zenithDegrees, -1.253 )
    );

    const transmittance = [ 0, 1, 2 ].map( ( channel ) => Math.exp( -(
        betaR[ channel ] * RAYLEIGH_ZENITH_LENGTH * airMassInverse
        + betaM[ channel ] * MIE_ZENITH_LENGTH * airMassInverse
    ) ) );

    const discRadiance = transmittance.map(
        ( component ) => sunIntensity * SUN_DISC_GAIN * component * SKY_OUTPUT_SCALE );

    const irradianceRaw = discRadiance.map(
        ( component ) => component * SUN_SOLID_ANGLE_STERADIANS );

    const extraterrestrial = kelvinToLinearSRGB( EXTRATERRESTRIAL_KELVIN );
    const corrected = irradianceRaw.map( ( component, channel ) => component * extraterrestrial[ channel ] );

    const peak = Math.max( corrected[ 0 ], corrected[ 1 ], corrected[ 2 ] );
    const colourLinear = normaliseToPeak( corrected );

    return {
        elevationDegrees,
        sunIntensity,
        transmittance,
        discRadiance,
        irradiance: peak,
        irradianceRGB: corrected,
        colourLinear,
        colourHex: linearToHex( colourLinear ),
        correlatedColourTemperature: correlatedColourTemperature( corrected ),
        aboveHorizon: elevationDegrees > 0
    };

}

/**
 * The one scale that converts SkyMesh's units into the rig's, in both directions.
 *
 * Derived from the anchor pair above, once, so nothing can quote a different number: an anchor sun
 * carries `IRRADIANCE_ANCHOR` after multiplication. Measured value **0.11942** at the shipped sky
 * defaults, which is the reciprocal of the 8.37× the header quotes.
 */
export const SKY_TO_RIG_SCALE =
    IRRADIANCE_ANCHOR / solarDiscLight( IRRADIANCE_ANCHOR_ELEVATION_DEGREES ).irradiance;

/**
 * The key-light placement a scene hands `LightingRig` for a given sun.
 *
 * @param {Object} sun - `{ elevationDegrees, azimuthDegrees, occlusion }`, a scene's own `sun`.
 * @param {Object} sky - `{ turbidity, rayleigh, mieCoefficient }`, a scene's own `sky`.
 * @param {number} cameraAzimuthDegrees - the camera's WORLD azimuth. See `rigAzimuthForSun`.
 * @returns {Object} fields that drop straight into a `LightPlacement`.
 */
export function keyPlacementForSun( sun, sky, cameraAzimuthDegrees ) {

    const disc = solarDiscLight( sun.elevationDegrees, sky );

    // ⚠️ `occlusion` SCALES THE KEY AND LEAVES THE SKY ALONE, AND THAT ASYMMETRY IS THE POINT. It is
    // the fraction of the solar disc hidden by something local that the sky model does not know
    // about — leaf cover in a park, an awning, a passing cloud. What is between the subject and the
    // sun is not between the subject and the rest of the hemisphere, so a dappled scene loses its
    // key and keeps its fill. Modelling it as a turbidity change instead would have dimmed the whole
    // sky, which is a different picture entirely.
    const visible = 1 - ( sun.occlusion ?? 0 );

    // 🚩 EXACTLY FOUR FIELDS, AND NOT ONE DIAGNOSTIC AMONG THEM. This object is spread straight
    // into a `LightPlacement`, and `LightingRig` SILENTLY MERGES AND IGNORES a field it does not
    // know — measured, and one of the seven pathologies `Avatar.js`'s `PLACEMENT_FIELDS` block
    // exists against. A CCT or a sky-unit irradiance riding along here would be a number that looks
    // like it is doing something and is not. They are on `describe()` instead, where they are read
    // by `report()` and by nothing that lights anything.
    return {
        azimuthDegrees: rigAzimuthForSun( sun.azimuthDegrees, cameraAzimuthDegrees ),
        elevationDegrees: sun.elevationDegrees,
        irradiance: disc.irradiance * SKY_TO_RIG_SCALE * visible,
        colour: disc.colourHex
    };

}

// --- the live half -------------------------------------------------------------------------------

/**
 * The sky, its two PMREMs, and the ground disc that gives the lower hemisphere its bounce.
 *
 * ## 🎯 TWO BAKES, AND THE SECOND ONE IS WHAT PUNCH-LIST 11.3 IS ABOUT
 *
 * A single bake of the sky alone has a lower hemisphere too: `SkyMesh` clamps its zenith angle at
 * the horizon, so every below-horizon direction renders the HORIZON colour and the figure is lit
 * from below by a bright band of sky it should be standing on. That is not the ground and it does
 * not move when the ground's albedo does.
 *
 * So bake 2 puts a real disc at y = 0 into the bake scene and lights it with bake 1 — three's own
 * environment evaluation for a Lambert surface, which is exactly the first-bounce integral
 * `albedo · ∫L cosθ dω / π` and needs no hemisphere quadrature written here. The bounce that fills
 * the underside of a jaw on a beach is then a property of the environment map, measurable by
 * removing it, and monotone in albedo by construction.
 *
 * ⚠️ **BAKE 1 KEEPS THE SOLAR DISC AND BAKE 2 HIDES IT, AND THAT IS NOT AN OVERSIGHT.** Bake 1 is
 * the ground's light source, and outdoors the sun is most of what lands on the ground — hiding it
 * there would lose the dominant term. Bake 2 is what lights the FIGURE, and there the disc is a
 * 537-radiance smear the analytic key replaces with a sharp specular. Same sun, two jobs, and each
 * bake carries the half it needs.
 */
export class SkyEnvironment {

    /**
     * @param {Object} options
     * @param {Object} options.sun - `{ elevationDegrees, azimuthDegrees, occlusion }`.
     * @param {Object} options.sky - `{ turbidity, rayleigh, mieCoefficient, mieDirectionalG }`.
     * @param {Object} options.ground - `{ enabled, albedo, roughness }` from the scene.
     * @param {Object} [options.air] - `{ haze }` from the scene. 11.5. Absent is no air.
     * @param {number} [options.size=PMREM_CUBE_SIZE]
     */
    constructor( options ) {

        this.sun = options.sun;
        this.sky = options.sky;
        this.ground = options.ground;
        this.air = options.air ?? { haze: 0 };
        this.size = options.size ?? PMREM_CUBE_SIZE;

        // The air's four numbers, as uniforms rather than as node constants, because three keys its
        // material pipeline cache on the node GRAPH: rebuilding the fog node to change a number
        // recompiles every material in the scene, which is the same 43–56 ms this file already
        // refuses to pay for a swapped environment texture. `setAir` and `setGroundClosure` write
        // through them, and both are callable every frame without costing anything.
        this.hazeDensity = uniform( 0 );
        this.closureStart = uniform( 1e9 );
        this.closureEnd = uniform( 1e9 );
        this.closureCentre = uniform( new Vector2( 0, 0 ) );

        // Everything below is acquired in `attachTo` and released in `dispose`. Declared here so
        // `dispose()` has one object to walk and so a half-built environment is still disposable —
        // the same rule `Avatar`'s own constructor follows for the same reason.
        this.scene = null;
        this.renderer = null;
        this.pmrem = null;
        this.skyMesh = null;
        this.bakeScene = null;
        this.groundDisc = null;
        this.solarTarget = null;
        this.environmentTarget = null;
        this.bakeCount = 0;

    }

    /**
     * Builds the sky, allocates both targets, bakes, and installs the result on the live scene.
     *
     * ⚠️ `PMREMGenerator.fromScene()` THROWS if it is called before `await renderer.init()`, and
     * `fromSceneAsync()` is deprecated at r181. `Stage.create()` awaits `renderer.init()` at
     * `Stage.js:314`, so by the time `Avatar.build()` reaches this the backend is up — which is the
     * whole reason this is called from `build()` and not from the constructor.
     *
     * @param {import('three').Scene} scene - the LIVE scene, whose `environment` and `background`
     *   this will own until `dispose()`.
     * @param {Object} renderer - the `WebGPURenderer`.
     */
    attachTo( scene, renderer ) {

        if ( this.scene !== null ) {

            throw new Error( 'SkyEnvironment.attachTo: already attached. One environment per scene; ' +
                'call bake() to move the sun, which re-uses both render targets rather than ' +
                'allocating new ones — a swapped texture costs a 43–56 ms pipeline rebuild.' );

        }

        this.scene = scene;
        this.renderer = renderer;
        this.pmrem = new PMREMGenerator( renderer );

        // The sky lives HERE and only here. See the header: it never enters the live scene, so the
        // re-parenting class of bug cannot occur.
        this.bakeScene = new BakeScene();
        this.bakeScene.background = null;

        this.skyMesh = buildSkyMesh( this.sky );
        this.bakeScene.add( this.skyMesh );

        if ( this.ground.enabled === true ) {

            this.groundDisc = buildGroundDisc( this.ground );
            this.bakeScene.add( this.groundDisc );

        }

        this.bake();

        // 11.5. AFTER the bake, because the fog node samples `solarTarget` and that target does not
        // exist until `bake()` has run once. Installed on `scene.fogNode` rather than `scene.fog`
        // so the colour can be the backdrop texture instead of a `Color` three would have to be
        // told: `NodeManager.getFogNode` reads `scene.fogNode` FIRST and only falls back to the
        // `Fog`/`FogExp2` translation (`NodeManager.js:576`, r185).
        //
        // ⚠️ A STUDIO SCENE NEVER REACHES THIS LINE. `environmentRequestOf` returns null without a
        // sky, so `Avatar` never constructs a `SkyEnvironment` for `studio`, `void` or
        // `transparent`, and `scene.fogNode` stays `undefined` on the calibration control.
        this.scene.fogNode = this.buildAerialNode();

        this.setAir( this.air );

        return this;

    }

    /**
     * The scene's air, live. `haze` is `scene.air.haze` — 0 is a clean day, 1 is 95% dissolved at
     * `HAZE_95_PERCENT_METRES_AT_FULL`.
     *
     * @param {Object} air - `{ haze }`.
     */
    setAir( air ) {

        this.air = air;
        this.hazeDensity.value = ( air.haze ?? 0 ) * HAZE_95_PERCENT_EXPONENT / HAZE_95_PERCENT_METRES_AT_FULL;

        return this;

    }

    /**
     * Where the ground plane ends, so the air can close it before its edge is drawn.
     *
     * 🚩 **THIS IS PUSHED IN RATHER THAN READ OUT, AND THE REASON IS CONSTRUCTION ORDER.** The sky
     * is built in `Avatar.build()` STEP 3b and the ground in STEP 5, and the plane is not SIZED
     * until `swapFigure()` has framed the figure — three steps and one await later. An environment
     * that reached for `avatar.ground.halfExtentMetres` at attach time would read `null` and close
     * the horizon at the origin. `Avatar` calls this from the same place it calls `sizeTo`, so the
     * two cannot fall out of step.
     *
     * @param {{ x: number, z: number }} centre - the plane's centre, world.
     * @param {number} halfExtentMetres - half the plane's side. The dissolve completes here, which
     *   is the plane's INSCRIBED circle — so the square's corners are already gone and no scene
     *   ever shows one.
     */
    setGroundClosure( centre, halfExtentMetres ) {

        this.closureCentre.value.set( centre.x, centre.z );
        this.closureStart.value = halfExtentMetres * CLOSURE_START_FRACTION;
        this.closureEnd.value = halfExtentMetres;

        return this;

    }

    /**
     * `fog( the backdrop itself, haze ⊕ closure )`.
     *
     * The two factors compose as independent extinctions — `1 − (1−a)(1−b)` — rather than as a
     * `max`, so a hazy scene and a closing horizon do not fight over the last few metres and
     * either one alone reduces to itself exactly.
     */
    buildAerialNode() {

        // Distance from the camera PLANE, which is what `densityFogFactor` uses and what the
        // temporal resolve's own depth is in. The difference from radial distance is a cosine and
        // it is under 2% inside a 30° frame.
        const viewDistance = positionView.z.negate();

        const haze = viewDistance.mul( this.hazeDensity ).pow( 2 ).negate().exp().oneMinus();

        // Horizontal distance from the ground plane's centre. `y` is deliberately absent: the
        // closure is about how far across the FLOOR a point is, and the floor is flat.
        const radius = positionWorld.xz.sub( this.closureCentre ).length();
        const closure = smoothstep( this.closureStart, this.closureEnd, radius );

        const factor = haze.oneMinus().mul( closure.oneMinus() ).oneMinus();

        // The backdrop, re-read. Same texture, same rotation-free direction, same two scene
        // uniforms three multiplies the background mesh by — see the block comment above
        // `HAZE_95_PERCENT_METRES_AT_FULL` for why this is a texture read and not a colour.
        const direction = positionWorld.sub( cameraPosition ).normalize();
        const sky = pmremTexture( this.solarTarget.texture, direction, backgroundBlurriness )
            .rgb.mul( backgroundIntensity );

        return fog( sky, factor );

    }

    /**
     * Re-solves the sky for the current sun and writes both targets in place.
     *
     * Cheap enough to call on a sun change: 8–14 ms of GPU each, ~1 ms of main thread, measured.
     *
     * 🎯 **AND A CHANGE OF AZIMUTH ALONE DOES NOT NEED IT AT ALL.** A Preetham sky is rotationally
     * symmetric about the zenith except for the sun, and `scene.environmentRotation` is honoured on
     * the node path (`MaterialProperties.js:42`, r185) — so a time-of-day sweep that only swings the
     * sun sideways is one Euler and zero milliseconds. Measured in the spike: gloss-sphere left/right
     * ratio 1.402 / 0.687 / 0.845 / 1.231 across yaw 0/90/180/270, i.e. it inverts as the light
     * crosses the sphere. Only ELEVATION needs this call. Not wired to the API yet — 11.6 owns
     * `setScene`, and a rotation without a matching key azimuth would be exactly the sky/key
     * disagreement this item exists to prevent.
     */
    bake() {

        setSunUniform( this.skyMesh, this.sun );

        // ---- bake 1: the sky WITH its disc, no ground. Becomes the backdrop and the ground's light.
        this.skyMesh.showSunDisc.value = 1;
        if ( this.groundDisc !== null ) this.groundDisc.visible = false;

        // The bake scene's own environment has to be null for this pass or the ground's light would
        // include the previous bake of itself — a feedback loop that brightens on every scene change
        // and reads as "the frame got milky" with no cause anywhere in the diff.
        this.bakeScene.environment = null;

        this.solarTarget = this.pmrem.fromScene( this.bakeScene, 0, 0.1, 5000, {
            size: this.size,
            position: BAKE_ORIGIN,
            renderTarget: this.solarTarget
        } );

        // ---- bake 2: the sky WITHOUT its disc, with the ground lit by bake 1. Becomes the light.
        this.skyMesh.showSunDisc.value = 0;

        if ( this.groundDisc !== null ) {

            this.groundDisc.visible = true;
            this.bakeScene.environment = this.solarTarget.texture;
            this.bakeScene.environmentIntensity = 1;

        }

        this.environmentTarget = this.pmrem.fromScene( this.bakeScene, 0, 0.1, 5000, {
            size: this.size,
            position: BAKE_ORIGIN,
            renderTarget: this.environmentTarget
        } );

        this.bakeScene.environment = null;

        // 🚩 ASSIGNED ONCE. On every later bake these two are ALREADY these textures and the
        // assignment is a no-op — which is the point: three keys its material pipeline cache on the
        // environment's identity, so re-pointing it at a different texture recompiles every material
        // in the scene. 43–56 ms measured, against 0.4 ms for re-baking the same texture's contents.
        this.scene.background = this.solarTarget.texture;
        this.scene.environment = this.environmentTarget.texture;

        this.bakeCount ++;

        return this;

    }

    /**
     * Puts the environment and the background into the rig's photometric units.
     *
     * Called by `Avatar` on build AND on every `setLighting`, because `exposure` scales the four
     * direct lights and an environment left behind would silently change the very key-to-ambient
     * balance the whole file is calibrated on — the same failure `applyLighting`'s ambient-snapshot
     * 🚩 records against `GTAO`.
     *
     * @param {number} rigExposure - `LightingRig.exposure`, i.e. `EXPOSURE_CALIBRATION * lighting.exposure`.
     */
    setRigExposure( rigExposure ) {

        this.scene.environmentIntensity = SKY_TO_RIG_SCALE * rigExposure;
        this.scene.backgroundIntensity = SKY_TO_RIG_SCALE * rigExposure;

        return this;

    }

    /** What the environment IS, read off the live scene rather than off the request. For `report()`. */
    describe() {

        const disc = solarDiscLight( this.sun.elevationDegrees, this.sky );

        return {
            attached: this.scene !== null && this.scene.environment !== null,
            cubeSize: this.size,
            bakes: this.bakeCount,
            environmentIntensity: this.scene === null ? null : this.scene.environmentIntensity,
            groundInBake: this.groundDisc !== null,
            haze: this.air.haze ?? 0,
            hazeDensityPerMetre: this.hazeDensity.value,
            haze95PercentMetres: this.hazeDensity.value === 0
                ? null
                : HAZE_95_PERCENT_EXPONENT / this.hazeDensity.value,
            groundClosureStartMetres: this.closureStart.value,
            groundClosureEndMetres: this.closureEnd.value,
            sunElevationDegrees: this.sun.elevationDegrees,
            sunAzimuthDegrees: this.sun.azimuthDegrees,
            sunColour: disc.colourHex,
            sunKelvin: Math.round( disc.correlatedColourTemperature ),
            sunIrradianceInSkyUnits: disc.irradiance,
            skyToRigScale: SKY_TO_RIG_SCALE
        };

    }

    /**
     * Releases both targets, the generator, the sky and the disc, and takes the environment and the
     * background back off the live scene.
     *
     * ⚠️ The two scene fields are restored to `null` rather than left pointing at a disposed
     * texture. `Avatar.dispose()` disposes the `Stage` after this, but `dispose()` is documented as
     * idempotent and tolerant of a half-built avatar, so it can and does run on a scene that is
     * about to be used again.
     */
    dispose() {

        if ( this.scene !== null ) {

            this.scene.environment = null;
            this.scene.background = null;
            this.scene.environmentIntensity = 1;
            this.scene.backgroundIntensity = 1;

            // ⚠️ `null`, not `delete`. `NodeManager.getFogNode` is `scene.fogNode || …`, so either
            // works for the read — but `describe()` and `Avatar.report()` state whether the air is
            // attached, and a deleted property and a null one answer `hasOwnProperty` differently.
            this.scene.fogNode = null;

        }

        this.solarTarget?.dispose();
        this.environmentTarget?.dispose();
        this.pmrem?.dispose();

        this.skyMesh?.removeFromParent();
        this.skyMesh?.material?.dispose();
        this.skyMesh?.geometry?.dispose();

        this.groundDisc?.removeFromParent();
        this.groundDisc?.material?.dispose();
        this.groundDisc?.geometry?.dispose();

        this.solarTarget = null;
        this.environmentTarget = null;
        this.pmrem = null;
        this.skyMesh = null;
        this.groundDisc = null;
        this.bakeScene = null;
        this.scene = null;
        this.renderer = null;

    }

}

const BAKE_ORIGIN = new Vector3( 0, BAKE_EYE_HEIGHT_METRES, 0 );

/**
 * `SkyMesh`, with the uniforms a scene owns set and the one it must never be given left at zero.
 *
 * ⚠️ **`SkyMesh` IS WebGPU-ONLY**, by its own docstring: its material is a TSL `NodeMaterial` and
 * `WebGLRenderer` cannot compile it. `Avatar`'s `fallback` tier can come up on WebGL2 (`Stage.js`
 * swaps the backend in when device creation fails after a successful adapter request), so an
 * exterior scene on that path is refused in `Avatar.build` rather than left to render a black box.
 */
function buildSkyMesh( sky ) {

    const mesh = new SkyMesh();

    mesh.scale.setScalar( 10000 );
    mesh.name = 'sky';

    mesh.turbidity.value = sky.turbidity;
    mesh.rayleigh.value = sky.rayleigh;
    mesh.mieCoefficient.value = sky.mieCoefficient;
    mesh.mieDirectionalG.value = sky.mieDirectionalG;

    // ⚠️ NOT A DEFAULT AND NOT A TASTE. See the header: clouds are animated by the TSL `time` node,
    // so any non-zero coverage makes the bake depend on how long the page has been open.
    mesh.cloudCoverage.value = 0;

    return mesh;

}

/** The ground disc that turns the lower hemisphere from horizon sky into a floor. */
function buildGroundDisc( ground ) {

    const material = new MeshStandardNodeMaterial( {
        color: new Color( ground.albedo ?? DEFAULT_GROUND_ALBEDO ),
        roughness: ground.roughness ?? DEFAULT_GROUND_ROUGHNESS,
        metalness: 0
    } );

    // 64 segments rather than the default 32: the rim is 500 m away and its silhouette is the
    // horizon line of the environment map. A coarse polygon there is a visible faceted horizon in
    // the lower mips, which is the kind of defect that measures correctly and looks wrong.
    const disc = new Mesh( new CircleGeometry( GROUND_DISC_RADIUS_METRES, 64 ), material );

    disc.rotation.x = -Math.PI / 2;
    disc.name = 'sky-bake-ground';

    return disc;

}

/** Sets `sunPosition` at RADIUS 1. See `SUN_POSITION_RADIUS` for why the magnitude is load-bearing. */
function setSunUniform( skyMesh, sun ) {

    const direction = sunDirectionWorld( sun.elevationDegrees, sun.azimuthDegrees );

    skyMesh.sunPosition.value.set(
        direction.x * SUN_POSITION_RADIUS,
        direction.y * SUN_POSITION_RADIUS,
        direction.z * SUN_POSITION_RADIUS
    );

}

/** Fallbacks for a scene that declares a ground with no material. Dry sand and a rough surface. */
const DEFAULT_GROUND_ALBEDO = 0x8a8378;
const DEFAULT_GROUND_ROUGHNESS = 0.9;

// --- colour ---------------------------------------------------------------------------------------

/**
 * Blackbody colour as LINEAR sRGB, peak-normalised.
 *
 * ⚠️ An APPROXIMATION FIT and not a colorimetric computation: Tanner Helland's piecewise curve fit
 * to Mitchell Charity's blackbody table (vendian.org/mncharity/dir3/blackbody), which is tabulated
 * for sRGB DISPLAY values — so the fit is evaluated in sRGB and linearised here. A few percent
 * across the daylight range, which is finer than a difference a viewer could name. It is labelled a
 * fit because this project has shipped six numbers that were not what their comment claimed.
 */
export function kelvinToLinearSRGB( kelvin ) {

    const t = clamp( kelvin, 1000, 40000 ) / 100;

    const red = t <= 66 ? 255 : 329.698727446 * Math.pow( t - 60, -0.1332047592 );

    const green = t <= 66
        ? 99.4708025861 * Math.log( t ) - 161.1195681661
        : 288.1221695283 * Math.pow( t - 60, -0.0755148492 );

    let blue;
    if ( t >= 66 ) blue = 255;
    else if ( t <= 19 ) blue = 0;
    else blue = 138.5177312231 * Math.log( t - 10 ) - 305.0447927307;

    return normaliseToPeak( [ red, green, blue ]
        .map( ( component ) => clamp( component, 0, 255 ) / 255 )
        .map( srgbToLinear ) );

}

/**
 * CCT from a linear-sRGB triple, via CIE 1931 XYZ and McCamy's cubic (McCamy, *Color Research &
 * Application* 17(2), 1992).
 *
 * ⚠️ McCamy's fit is only meaningful near the Planckian locus, and a saturated horizon sun sits well
 * off it — so the number at low elevation is indicative rather than a temperature anybody could
 * match with a filter. Reported anyway because it is the unit a lighting person thinks in.
 */
export function correlatedColourTemperature( linearRGB ) {

    const [ r, g, b ] = linearRGB;

    const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
    const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
    const Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;

    const sum = X + Y + Z;

    if ( sum <= 0 ) return 0;

    const n = ( X / sum - 0.3320 ) / ( 0.1858 - Y / sum );

    return 437 * n * n * n + 3601 * n * n + 6861 * n + 5517;

}

function normaliseToPeak( linearRGB ) {

    const peak = Math.max( linearRGB[ 0 ], linearRGB[ 1 ], linearRGB[ 2 ] );

    return peak <= 0 ? [ 0, 0, 0 ] : linearRGB.map( ( component ) => component / peak );

}

function linearToHex( linearRGB ) {

    const bytes = linearRGB.map(
        ( component ) => Math.round( linearToSrgb( clamp( component, 0, 1 ) ) * 255 ) );

    return ( bytes[ 0 ] << 16 ) | ( bytes[ 1 ] << 8 ) | bytes[ 2 ];

}

function srgbToLinear( value ) {

    return value <= 0.04045 ? value / 12.92 : Math.pow( ( value + 0.055 ) / 1.055, 2.4 );

}

function linearToSrgb( value ) {

    return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow( value, 1 / 2.4 ) - 0.055;

}

function clamp( value, low, high ) {

    return Math.min( high, Math.max( low, value ) );

}
