/**
 * EyeMaterial — punch-list 3.3. Cornea refraction, shader-side pupil dilation, a view-dependent
 * limbal ring, and the dual-normal sclera/iris split, on the asset we actually ship.
 *
 * WHAT THE ASSET IS, AND WHY THIS FILE IS SHAPED THE WAY IT IS
 * -----------------------------------------------------------
 * `docs/research/eyes-and-lighting.md` §1 states a *geometry contract*, taken from HDRP: one eye
 * per object, centred on its own origin, XY in [-0.5, 0.5], cornea facing +Z, a real corneal dome,
 * planar UV along the cornea axis, and a flat iris plane behind it. `tools/spikes/eye-geometry.mjs`
 * measured our figures against that contract and **five of the eight clauses fail** (measured on
 * `figure_g050.glb`, 2026-08-07). Every one of the five is absorbed here rather than in the asset:
 *
 *   1. "one eye per object"           — 2 islands, one buffer, one material, one draw range.
 *                                       -> the two eyes are separated in the SHADER, on the sign of
 *                                          the bind-space x, and every per-eye constant is carried
 *                                          twice and mixed. See `selectPerEye()`.
 *   2. "eye centred on its own origin" — the eye centre is 1558 mm from the origin (head height).
 *   3. "XY roughly in [-0.5, 0.5]"     — the figure is authored in real metres; sclera R 14.894 mm.
 *                                       -> 2 and 3 are the same fix: the shader re-derives an
 *                                          EYE-LOCAL frame from measured uniforms — origin at the
 *                                          fitted sclera centre, +z along the cornea axis, metres —
 *                                          and does all of its work there. HDRP's normalised space
 *                                          never appears; its constants are re-derived, not copied.
 *   4. "iris map separate from sclera" — one composited `brown_eye.png`, 15.8% of each eye square
 *                                          is iris.
 *                                       -> the map is sampled TWICE, at two different coordinates:
 *                                          the mesh's own UV for the sclera, and the REFRACTED hit
 *                                          point for the iris. Because the iris disc occupies
 *                                          exactly the middle of the square, the sclera sample
 *                                          never lands on iris texels and vice versa, so a
 *                                          composited map costs nothing here. What it does cost is
 *                                          the per-property SSS blend of research §5, which stays
 *                                          out of scope until a lighting-model override exists
 *                                          (punch-list 3.10 will add one).
 *   5. "static eye in object space"    — gaze rotates the globe up to 15.1° and moves its centre
 *                                          1.72 mm.
 *                                       -> the motion is RIGID (residual 5.7% of peak), so the eye
 *                                          frame survives as ONE mat3 per eye per frame. `update()`
 *                                          recomposes it from the eight `eyeLook*` morph weights
 *                                          and the head bone. Nothing else in the shader moves.
 *
 * None of the five blocked the work. The one that would have — a missing corneal dome — was fixed
 * in the asset last round: the front 15° cap sits **0.688 mm proud** of a sphere fitted to the
 * sclera band, 3.41x the 0.202 mm fit noise (`tools/figure-pipeline/cornea_geometry.mjs`).
 *
 * THE TWO SHELLS, AND WHICH ONE DOES WHAT
 * ---------------------------------------
 * The figure ships two meshes per eye and they map onto the two halves of research §5's
 * dual-normal requirement almost exactly as authored:
 *
 *   `Humanhigh-poly`  the opaque GLOBE. Carries the iris, the pupil, the sclera and the only UV
 *                     set that means anything. Gets the DIFFUSE half: refraction into the iris
 *                     plane, the pupil remap, the limbal ring, and a diffuse normal that flattens
 *                     toward the eye axis inside the iris. Its specular is switched OFF over the
 *                     iris, which is research §5's "the specular snaps flat inside the iris".
 *
 *   `Humancornea`     the clear outer SHELL. Gets the SPECULAR half, off its own real dome normals
 *                     — no reconstruction, no approximation — plus the per-eye catchlight of §6.
 *                     Drawn additively with depth test on and depth write off, so it adds a
 *                     highlight and can never darken or occlude anything.
 *
 * That split is why this file does not need a custom lighting model to get two normals: the two
 * normals are on two meshes. The alternative — one mesh, one `normalNode`, and a blend between the
 * flat iris and the corneal dome — halves both effects, and is what a single-shell asset forces.
 *
 * ⚠️ The corneal shell's own UVs are NOT usable. Measured: both eyes map to the same 0.11 x 0.11
 * square in the corner of the texture (u 0.8795-0.9911, v 0.8775-0.9890) and the material carries
 * no map at all. Everything textured reads the globe.
 *
 * WHAT IS MEASURED AND WHAT IS AUTHORED
 * -------------------------------------
 * Every geometric constant the shader runs on is measured from the loaded mesh at construction —
 * sclera centre and radius, cornea axis, corneal anterior radius and centre, iris plane depth, and
 * the planar UV map — so the five bakes across the gender sweep each get their own numbers rather
 * than g050's. `describe()` prints them, and `EyeMaterial.selftest.mjs` asserts them against the
 * figures on disk.
 *
 * Two constants come from the TEXTURE instead, because they are properties of `brown_eye.png` and
 * not of any mesh. Both were measured off the shipped PNG about the left eye's own geometric
 * forward pole, 360 samples per annulus, and both are stated in UV so they survive a change of
 * eye scale (`IRIS_RADIUS_UV`, `PUPIL_RADIUS_UV` below).
 *
 * USAGE
 *
 *     const eyes = new EyeMaterial( { figure } );
 *     eyes.attach();                             // swaps the two materials in
 *     pupil.driveUniform( eyes.pupilScaleUniform );
 *     stage.onFrame( () => eyes.update() );      // one mat3 per eye; ~30 CPU ops
 */

import {
    AdditiveBlending,
    Color,
    Matrix3,
    Matrix4,
    MeshPhysicalNodeMaterial,
    Vector3
} from 'three/webgpu';

import {
    cameraPosition,
    cameraViewMatrix,
    float,
    mix,
    normalGeometry,
    normalize,
    normalViewGeometry,
    positionGeometry,
    positionViewDirection,
    positionWorld,
    pow,
    reflect,
    refract,
    saturate,
    smoothstep,
    step,
    texture,
    uniform,
    uv,
    vec3,
    vec4
} from 'three/tsl';

// The dome measurement is shared with the asset gate so the shader and the gate cannot disagree
// about the same file (docs/LEARNINGS.md §1.11d). Reaching from packages/core into tools/ is
// deliberate and narrow: this is the one module both sides have to agree on, and duplicating a
// least-squares sphere fit is exactly how two answers to one question get born.
import { fitSphere } from '../../../../tools/figure-pipeline/cornea_geometry.mjs';

import {
    buildCatchlightCubeTexture,
    CATCHLIGHT_PRESETS,
    resolveCatchlightRig
} from './EyeCatchlight.js';

// --- what the meshes are called ----------------------------------------------------------------
//
// MakeHuman names the eyeball proxies for their TOPOLOGY, not their anatomy, and GLTFLoader strips
// the dot — so `Human.high-poly` arrives as `Humanhigh-poly`. Matched by pattern because this used
// to be `low-poly` and every hardcoded matcher in the repo had to widen when the proxy changed.

export const EYE_GLOBE_MESH_PATTERN = /high-poly|low-poly|eyeball/i;
export const EYE_CORNEA_MESH_PATTERN = /cornea/i;

// --- constants measured off the shipped texture ------------------------------------------------
//
// `brown_eye.png`, 1024 x 1024, sampled on 360-point annuli about the left eye's geometric forward
// pole at uv (0.29268, 0.69913). Both radii are read off the SATURATION profile, because the eye
// square's luma runs 0.00 (pupil) to 0.64 (sclera) and saturation separates iris from both ends:
//
//     uvR 0.000-0.024   luma 0.0000  sat 0.000   pupil, exactly black
//     uvR 0.044-0.100   luma 0.06-0.11  sat 0.95-0.97   iris, saturated plateau
//     uvR 0.1135        sat 0.500                       half-saturation: the limbus
//     uvR 0.136+        luma 0.64    sat 0.031          sclera
//
// Stated in UV rather than millimetres on purpose: the texture is shared by all five bakes while
// the eye geometry is not, so a UV constant converts to the right millimetre figure for each.
export const IRIS_RADIUS_UV = 0.1135;

// The pupil is the exactly-black core: luma is 0.0000 out to 0.024 and first non-zero at 0.024-0.026.
// The feather from there to the saturated plateau at 0.044 is authored INTO the map, so the shader's
// remap only has to move the boundary, not draw the edge.
export const PUPIL_RADIUS_UV = 0.0250;

// --- constants from the research doc and from anatomy -------------------------------------------

// research §1: IOR 1.333-1.336; punch-list 3.3 says 1.333-1.4. The GLB's own corneal material
// carries 1.3333 and HDRP's CORNEA_IOR is 1.3333, so that is what this uses.
//
// ⚠️ Do NOT "correct" this to the cornea's own 1.376. The shader models ONE interface, air into the
// anterior chamber, and the chamber is aqueous — n 1.336. Using the corneal stroma's index for a
// single-interface model over-bends the ray. PROGRESS records the same distinction on the power
// side: at 1.3333 the delivered anterior power is 43.6-48.2 D across the sweep, against a human
// 48.2-48.8 D, on geometry that is *steeper* than human.
export const CORNEA_IOR = 1.3333;

// Unreal's Eye shading model, quoted in research §3: Limbus Dark Scale 2.0-2.15, Limbus Pow
// 15.0-22.0. Midpoints of both.
const LIMBUS_POW = 18.0;
const LIMBUS_DARK_SCALE = 2.075;

// How black the ring goes at its darkest, before the view-dependent term. 0.82 leaves the limbus
// legible as a dark ring rather than a hole; a real limbus is a gradient, not a line.
const LIMBAL_RING_DARKNESS = 0.82;

// The front cap the corneal anterior sphere is fitted to, in degrees off the eye axis. Same 15° cut
// the dome gate uses, and for the same reason: at 30° the cap has walked off the cornea onto the
// sclera and the fit reads 8.8-9.1 mm instead of 6.9-7.6 (PROGRESS, corneal radius table).
const CORNEA_CAP_DEGREES = 15;

// Everything past this is sclera by construction, which is where the reference sphere is fitted.
// Matches POSTERIOR_BAND_MIN_DEGREES in cornea_geometry.mjs.
const SCLERA_BAND_MIN_DEGREES = 30;

// The iris plane is fitted to the globe's front dish inside this fraction of the iris radius.
// Measured on g050: 96 vertices inside 5 mm, mean z 12.887 mm, RMS about that plane 0.377 mm — so
// "flat iris plane" is a 0.38 mm approximation to a shallow bowl, not a fiction.
const IRIS_PLANE_FIT_FRACTION = 0.78;

// Sclera brightness multiplier on the sampled map.
//
// SOLVED against the gate rather than chosen: with the map passed through at 1.0 the sclera
// measures 0.6963 encoded luma against a cheek at 0.7603, i.e. a ratio of 0.9157 where G2 wants
// 0.98 +/- 0.06. Closing that in ENCODED luma needs a linear factor of (0.745/0.6963)^2.4 = 1.18.
//
// Note what this is NOT. The shipped map's sclera is a warm mid-grey, RGB 160,153,145, and 1.18 of
// it is still a warm mid-grey — the punch list's standing constraint is against a WHITE sclera, and
// the gate it is paired with says the eye that reads as real is barely brighter than the skin
// around it. Matching the cheek IS the constraint; 1.0 was under it, not safely inside it.
//
// 🎯 **1.26 WAS SOLVED WITHOUT THE OCCLUSION SHEET IN THE PICTURE, AND IT COSTS EXACTLY THE
// DIFFERENCE BETWEEN G2 GREEN AND G2 RED.** Attributed by toggle on
// `alive.html?bare&freeze&seed=1&capture` at 900x1200, shipped default (TAAU 0.66 + grade + RCAS),
// changing one thing at a time:
//
//   | plate                | G2 luma ratio | sclera encoded | verdict against the 0.92 floor |
//   |----------------------|--------------:|---------------:|--------------------------------|
//   | shipped              |        0.9189 |         0.7202 | FAIL by 0.0011                 |
//   | `&eyeocc=0`          |        0.9444 |         0.7401 | PASS                           |
//   | `&grade=0`           |        0.9188 |         0.7216 | FAIL — so it is NOT the grade  |
//   | `&aa=msaa&grade=0`   |        0.9208 |         0.7243 | FAIL                           |
//
// So `EyeOcclusion.js`'s sheet is worth **0.0255 of ratio** and the grade is worth 0.0001. The
// sheet is not the defect — its own header records that the ramp was squeezed against the lid
// margin precisely so it would stop eating the temporal sclera, and it now reads 0.9361 there
// against 0.6322 before that fix. What is stale is THIS constant: 0.9157 -> 1.26 was solved on a
// plate with no sheet over the eye at all, and the sheet then took a quarter of it back. A
// multiplier solved against a render is only valid for the render it was solved on (§1.11c —
// when the asset changes, re-derive the conclusion rather than re-wording it).
//
// 🎯 RE-SOLVED, on the rig this round also re-solved (`LightingRig.js` portrait fill 1.90 -> 2.20,
// which moves the cheek this ratio is measured against). Swept by setting
// `scleraBrightnessUniform` from the page before the first capture step — proven equivalent to
// editing this constant, because the sweep's 1.26 plate is BYTE-IDENTICAL to the file-edited one
// (sha256 29ee8996bfa7):
//
//   | brightness | G2 luma ratio | G2 chroma ratio | both clauses in band? |
//   |------------|--------------:|----------------:|-----------------------|
//   | 1.26       |        0.9169 |          1.3660 | no — luma low AND chroma high |
//   | 1.41       |        0.9448 |          1.2842 | yes                   |
//   | 1.45       |        0.9512 |          1.2636 | yes                   |
//   | **1.47**   |    **0.9547** |      **1.2523** | **yes, balanced**     |
//   | 1.48       |        0.9564 |          1.2495 | yes                   |
//   | 1.55       |        0.9673 |          1.2126 | yes, 0.007 off the chroma floor |
//   | 1.65       |        0.9817 |          1.1701 | no — chroma below 1.205 |
//   | 1.85       |        1.0069 |          1.0850 | no — chroma below 1.205 |
//
// 🚩 **THE TWO CLAUSES PULL OPPOSITE WAYS AND NEITHER CAN BE CENTRED**, which is why the value is
// an equal-margin solve rather than a target. Brightening the sclera raises its luma AND
// DESATURATES it — ACES compresses, so a brighter patch comes out of the transfer with less
// chroma. Luma wants 0.98 (brightness ~1.65); chroma wants the reference 1.2839 (brightness
// ~1.41). 1.47 is where the two normalised margins meet: luma 0.9547 sits 0.578 of a half-band
// above the 0.92 floor and chroma 1.2523 sits 0.598 of a half-band above the 1.2052 floor.
// Anyone re-solving one clause alone will push the other out — measure both or move neither.
//
// ⚠️ **1.47 IS OUTSIDE research §6's "Sclera Brightness 0.9-1.3", and the band does not transfer.**
// That is HDRP's slider range on an HDRP-authored sclera map; the multiplicand here is MakeHuman's
// `brown_eye.png`, whose sclera is sRGB (160,153,145) — encoded luma 0.6036, a mid-grey rather
// than a sclera white — so the same rendered result needs a larger number in front of it (§1.7: a
// published number carries a frame of reference; ask what it was measured ON). The constraint that
// does transfer is physical, and it is close enough to be worth stating: the pink tint's red gain
// is 1.6476, so the red albedo reaches unit reflectance at brightness **1.727**. At 1.47 the sclera
// albedo is linear (0.851, 0.385, 0.355), under 1.0 in every channel with 15% of headroom. Past
// 1.73 this stops being a reflectance and starts being an emission, and no gate would say so.
const SCLERA_BRIGHTNESS = 1.47;

/**
 * 🎯 The sclera's CHROMA, which is the half of the look spec no gate was measuring.
 *
 * The spec's eye table gives the sclera as `#9D7274` and states the rule in words as well:
 * *"The sclera is NOT white. It measures the same luminance as the surrounding cheek and is MORE
 * saturated than skin (0.275 vs 0.215), pink-tinted."* Two clauses, and only the first has ever
 * been gated. G2 measures sclera:cheek LUMA and passes; measured on a 2160x2700 portrait the
 * sclera came out `#c2b8b2` at HSV saturation 0.0822 against a cheek at 0.2152 — a sclera:cheek
 * saturation ratio of 0.38 where the reference is 0.275/0.215 = 1.28. Out by 3.4x, entirely
 * inside the gate's blind spot, and it is why the eye reads as a grey glass bead.
 *
 * The cause is the asset, not the shader: `brown_eye.png`'s sclera is RGB 160,153,145, a warm
 * NEUTRAL grey at saturation 0.094, and `SCLERA_BRIGHTNESS` only scales it. Scaling a grey gives
 * a grey.
 *
 * The fix is a per-channel gain whose LINEAR luma is exactly 1, so it rotates the sclera's
 * chromaticity toward `#9D7274` without moving the quantity G2 gates on. `SCLERA_CHROMA` blends
 * between the map's own colour (0) and the spec chromaticity (1); it is a blend rather than a
 * hard set because the sclera also carries the map's vein detail, and a full replacement flattens
 * it. The shipped value is solved against a measurement, not chosen — see PROGRESS.
 */
export const SCLERA_SPEC_SRGB = [ 0x9D / 255, 0x72 / 255, 0x74 / 255 ];

// Solved, not chosen. At full gain the tint OVERSHOOTS: the map's sclera is not perfectly neutral
// (saturation 0.0938, warm) so the pink gain compounds with what is already there and lands at
// 0.327 against the spec's 0.274. The albedo blend that lands exactly on the spec chromaticity is
// 0.71, and that is the starting point; the SHIPPED value is then solved against the RENDER,
// because what the spec actually constrains is a ratio — "MORE saturated than skin, 0.275 vs
// 0.215" — and our skin is not the reference's skin. Both numbers are asserted in the self-test.
export const SCLERA_CHROMA = 1.0;

// research §6: sclera Roughness 0.0-0.1. The wet film is on the globe outside the corneal cap,
// where the corneal shell no longer contributes.
const SCLERA_ROUGHNESS = 0.24;

// Inside the iris the globe carries NO specular at all: the corneal shell owns it. Roughness is
// pushed up as well as intensity down, so anything that reaches the lobe is broad rather than a
// second competing highlight.
const IRIS_ROUGHNESS = 0.62;

// The corneal shell. research §6 wants a wet surface; 0.06 is a polished dielectric with just
// enough spread that a panel edge is a gradient rather than a cut.
const CORNEA_ROUGHNESS = 0.08;

/**
 * How much of the SCENE's specular the corneal shell takes, on top of `material.ior`.
 *
 * ⚠️ This is a mitigation, not a physical constant, and it is here because of a defect that is not
 * in this file. Measured: with the shell at its physical reflectance — `ior` 1.376, so F0 0.0250 —
 * the portrait rig's key panel (0.85 x 1.20 m at about 1.3 m, i.e. roughly 37° x 51° as seen from
 * the eye) reflects as a hard-edged slab covering most of the iris at an sRGB luma of about 0.36,
 * against skin at about 0.80. A corneal reflection of a light source that is DARKER than the skin
 * beside it reads as a plastic overlay, and that is exactly what it looked like.
 *
 * The reflection is not wrong; the panel is. `RectAreaLight` intensity 5.5 was chosen so the skin
 * exposes correctly, and it leaves the panel with no HDR headroom — a real softbox is many stops
 * above the skin it lights, so its corneal reflection clips white and occupies a small bright
 * rectangle instead of a large grey one. Punch-list 3.8 owns the rig; until it lands, the shell
 * takes a third of the scene specular and the per-eye catchlight of `EyeCatchlight.js` carries the
 * highlight, which is the job research §6 says Epic gives it anyway.
 *
 * **Set this back to 1 when the lighting rig has real headroom.** It is a named option on the
 * constructor for that reason.
 */
const CORNEA_SCENE_SPECULAR = 0.05;

/**
 * 🎯 The catchlight's LINEAR radiance, and why it has to be far above 1.
 *
 * `EyeCatchlight.js` writes an 8-bit sRGB cube texture, so the brightest value it can hold is
 * exactly 1.0 in linear light. Fed straight into `emissiveNode` that produced a plateau at
 * **0.7305-0.7321 encoded luma against a cheek at 0.7541** — measured on a 4K portrait, a
 * catchlight 0.97x as bright as the skin beside it. The look spec wants **1.32x** (`§ Eyes`,
 * catchlight p99 0.651 against a cheek 0.492). A highlight darker than the face is the single
 * most reliable way to make an eye look dead, and no amount of reshaping the cubemap fixes it,
 * because the ceiling is the texture format.
 *
 * So the texture carries the SHAPE and this constant carries the radiance. The value is solved
 * against the tone curve rather than picked: the page is rendered at a sweep of intensities and
 * the one whose measured peak lands on 1.32x cheek is taken. ACES has a long shoulder, which is
 * why the number is this large — a real softbox IS many stops above the skin it lights, and that
 * is exactly the headroom `CORNEA_SCENE_SPECULAR` records the rig as not having.
 *
 * Re-solve it if the tonemapper, the exposure calibration or the key's intensity changes. The
 * sweep that produced it is one command; it is in PROGRESS beside the number.
 */
const CATCHLIGHT_PEAK = 26.0;

// How far out from the eye axis the corneal shell keeps contributing, as a multiple of the iris
// radius. Measured clearance between the two shells (from the cornea's own band centre): +2.96 mm
// at 0-10° off axis, +0.90 mm at 10-20°, +0.14 mm at 20-30°, and interleaving beyond that — the
// two shells are 0.17-0.40 mm apart on average with 0.2-0.3 mm of tessellation lumpiness each, so
// past ~30° the globe can poke through and the additive pass would speckle. 1.45 x the iris radius
// is 9.2 mm, which is 38° — comfortably inside the eyelids, and past the corneal cap anyway.
const CORNEA_COVERAGE_LIMIT = 1.45;
const CORNEA_COVERAGE_FEATHER = 0.35;

// Iris caustic, the analytic form. research §4: HDRP bakes a 3D LUT, Unreal exposes an analytic
// Iris Concavity Power / Scale, and the stated decision rule is "static key light -> analytic is
// fine; moving key -> bake the LUT". Our key is static, so this is the analytic branch and the LUT
// is deliberately not built.
const IRIS_CAUSTIC_SCALE = 0.55;
const IRIS_CAUSTIC_POWER = 2.4;

// --- finding the meshes -------------------------------------------------------------------------

/**
 * The globe and the corneal shell, by pattern, out of anything with a `traverse`.
 *
 * Returns nulls rather than throwing so a caller can report a missing shell in its own words —
 * a figure built with the superseded `low-poly` proxy has a globe and no cornea at all, and that
 * is a legitimate input to detect, not an exception.
 */
export function findEyeMeshes( root ) {

    let globe = null;
    let cornea = null;

    root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;
        if ( globe === null && EYE_GLOBE_MESH_PATTERN.test( object.name ) ) globe = object;
        if ( cornea === null && EYE_CORNEA_MESH_PATTERN.test( object.name ) ) cornea = object;

    } );

    return { globe, cornea };

}

// --- measuring one eye ---------------------------------------------------------------------------

/**
 * Every number the shader runs on, measured from the two shells of ONE eye.
 *
 * The order matters and each step feeds the next:
 *
 *   1. A sphere through the whole corneal shell gives a provisional centre, which is only used to
 *      point the axis. The cornea is two radii, so this fit is deliberately not trusted for
 *      anything else (LEARNINGS §1.11d).
 *   2. The axis is the mean outward direction of the corneal shell about that centre. Measured
 *      3.9° off +Z on g050, which is why nothing here assumes +Z.
 *   3. The EYE CENTRE and the sclera radius come from the globe's posterior band alone — past 30°
 *      off the axis there is no cornea and no iris dish, so the fit is reading the eyeball.
 *   4. The corneal anterior sphere comes from the front 15° cap about that centre. This is the
 *      surface the refraction happens at, and it is a different sphere from either shell's overall
 *      fit: R 7.33-7.34 mm against a 15.3 mm shell.
 *   5. The iris plane is the mean axial depth of the globe's front dish.
 *   6. The UV map is a least-squares affine fit of (u, v) on the eye-local (t, s) of the globe's
 *      front hemisphere. R² 0.9945/0.9958 measured — this is the one contract clause the asset
 *      already satisfies, and the fit is what turns it into a usable transform.
 *
 * @param {Array<Array<number>>} globePoints  - welded [x,y,z] of one eye's globe.
 * @param {Array<Array<number>>} globeUvs     - the matching [u,v], same order.
 * @param {Array<Array<number>>} corneaPoints - welded [x,y,z] of the same eye's corneal shell.
 */
export function measureEye( globePoints, globeUvs, corneaPoints ) {

    const provisional = fitSphere( corneaPoints );
    const provisionalAxis = meanDirection( corneaPoints, provisional.centre );

    const scleraBand = globePoints.filter(
        ( point ) => angleFromAxisDegrees( point, provisional.centre, provisionalAxis ) > SCLERA_BAND_MIN_DEGREES );
    const sclera = fitSphere( scleraBand );

    const centre = sclera.centre;
    const axis = meanDirection( corneaPoints, centre );
    const [ tangent, bitangent ] = frameAbout( axis );

    const cap = corneaPoints.filter(
        ( point ) => angleFromAxisDegrees( point, centre, axis ) <= CORNEA_CAP_DEGREES );
    const corneaAnterior = fitSphere( cap );

    // Eye-local coordinates of every globe vertex: (t, s) across, z along the axis.
    const local = globePoints.map( ( point, index ) => {
        const offset = subtract( point, centre );
        return {
            t: dot( offset, tangent ),
            s: dot( offset, bitangent ),
            z: dot( offset, axis ),
            u: globeUvs[ index ][ 0 ],
            v: globeUvs[ index ][ 1 ]
        };
    } );

    const front = local.filter( ( vertex ) => vertex.z > 0 );
    const uFit = fitAffine( front, ( vertex ) => vertex.u );
    const vFit = fitAffine( front, ( vertex ) => vertex.v );

    // UV per metre, as the mean of the two singular directions of the jacobian. The map is very
    // nearly a rotation + uniform scale (measured 17.545/-2.426/-2.317/-17.878 on g050's left eye),
    // so |det|^0.5 is the honest single number and it is what the UV-space radii convert through.
    const jacobian = [ uFit[ 0 ], uFit[ 1 ], vFit[ 0 ], vFit[ 1 ] ];
    const uvPerMetre = Math.sqrt( Math.abs( jacobian[ 0 ] * jacobian[ 3 ] - jacobian[ 1 ] * jacobian[ 2 ] ) );
    const irisRadius = IRIS_RADIUS_UV / uvPerMetre;

    const dish = front.filter( ( vertex ) => Math.hypot( vertex.t, vertex.s ) < irisRadius * IRIS_PLANE_FIT_FRACTION );
    const irisPlaneZ = dish.reduce( ( total, vertex ) => total + vertex.z, 0 ) / dish.length;
    const irisPlaneRms = Math.sqrt(
        dish.reduce( ( total, vertex ) => total + ( vertex.z - irisPlaneZ ) ** 2, 0 ) / dish.length );

    return {
        centre,
        axis,
        tangent,
        bitangent,
        scleraRadius: sclera.radius,
        scleraResidualRms: sclera.residualRms,
        corneaCentreZ: dot( subtract( corneaAnterior.centre, centre ), axis ),
        corneaRadius: corneaAnterior.radius,
        corneaResidualRms: corneaAnterior.residualRms,
        corneaCapCount: cap.length,
        irisPlaneZ,
        irisPlaneRms,
        irisRadius,
        uvCentre: [ uFit[ 2 ], vFit[ 2 ] ],
        uvJacobian: jacobian,
        uvPerMetre
    };

}

/**
 * Both eyes, split on the sign of x, with duplicate positions welded first.
 *
 * Welding is not cosmetic. glTF stores one vertex per (position, uv) pair, so a UV seam is written
 * twice; the spike records 12 duplicates out of 524 on the corneal shell, and left alone they drag
 * the measured opening axis 85° off true. The UV array is kept alongside because the planar fit
 * needs the pairing — welding on position keeps the FIRST uv seen at each position, which is
 * correct here because the seam runs round the back of the globe, outside the front hemisphere the
 * fit uses at all.
 */
export function measureEyeGeometry( globeMesh, corneaMesh ) {

    const globe = weldedByPosition( globeMesh.geometry );
    const cornea = weldedByPosition( corneaMesh.geometry );

    const eye = ( sign ) => {
        const keep = ( entry ) => ( sign > 0 ? entry.point[ 0 ] > 0 : entry.point[ 0 ] <= 0 );
        const globeSide = globe.filter( keep );
        return measureEye(
            globeSide.map( ( entry ) => entry.point ),
            globeSide.map( ( entry ) => entry.uv ),
            cornea.filter( keep ).map( ( entry ) => entry.point ) );
    };

    // +X is the figure's OWN left. The spike confirms it independently of any handedness
    // convention: only the *Left gaze morphs move the +X island, and eyeLookInLeft moves it toward
    // the midline.
    return { left: eye( 1 ), right: eye( -1 ) };

}

// --- the material ---------------------------------------------------------------------------------

export class EyeMaterial {

    /**
     * @param {Object} options
     * @param {Object} [options.figure]      - a `Figure`; its `root` is searched for the two shells.
     * @param {Object} [options.globeMesh]   - or pass the two meshes directly.
     * @param {Object} [options.corneaMesh]
     * @param {number} [options.corneaIor=1.3333]
     * @param {number} [options.scleraBrightness=1.26]
     * @param {number} [options.scleraChroma=0.85] - 0 keeps the map's near-grey sclera, 1 is the
     *   look spec's full chromaticity. See SCLERA_SPEC_SRGB.
     * @param {number} [options.catchlight='softbox'] - a key of CATCHLIGHT_PRESETS, or null for none.
     * @param {number} [options.catchlightIntensity=26] - linear radiance of the highlight's core.
     *   The default is solved against the tone curve; see CATCHLIGHT_PEAK.
     * @param {boolean} [options.refraction=true] - false pins the iris to its own UV, which is the
     *   A side of the parallax comparison. Nothing else changes, so the difference between the two
     *   renders is exactly the refraction.
     */
    constructor( options = {} ) {

        const meshes = options.figure !== undefined
            ? findEyeMeshes( options.figure.root ?? options.figure )
            : { globe: options.globeMesh ?? null, cornea: options.corneaMesh ?? null };

        if ( meshes.globe === null ) {

            throw new Error( `EyeMaterial: no mesh matching ${ EYE_GLOBE_MESH_PATTERN } — ` +
                'this figure has no eyeball globe.' );

        }

        if ( meshes.cornea === null ) {

            throw new Error( `EyeMaterial: no mesh matching ${ EYE_CORNEA_MESH_PATTERN }. ` +
                'This figure was built with the superseded single-shell eye proxy, which has no ' +
                'corneal dome and therefore no refracting surface (docs/LEARNINGS.md §1.11c). ' +
                'Rebuild with tools/figure-pipeline/build.sh.' );

        }

        this.globeMesh = meshes.globe;
        this.corneaMesh = meshes.cornea;
        this.geometry = measureEyeGeometry( this.globeMesh, this.corneaMesh );

        this.originalGlobeMaterial = this.globeMesh.material;
        this.originalCorneaMaterial = this.corneaMesh.material;

        // Uniforms a consumer drives. `pupilScaleUniform` is the sink motion/Pupil.js expects:
        // anything with a `.value`, clamped by Pupil to PUPIL_SCALE_BOUNDS so `1 - pupilEdge` here
        // can never reach zero.
        this.pupilScaleUniform = uniform( 1 );
        this.scleraBrightnessUniform = uniform( options.scleraBrightness ?? SCLERA_BRIGHTNESS );
        this.scleraChromaUniform = uniform( options.scleraChroma ?? SCLERA_CHROMA );
        this.limbalRingUniform = uniform( LIMBAL_RING_DARKNESS );
        this.catchlightIntensityUniform = uniform( options.catchlightIntensity ?? CATCHLIGHT_PEAK );
        this.causticScaleUniform = uniform( IRIS_CAUSTIC_SCALE );

        // The key light direction the analytic caustic is computed against, world space, pointing
        // FROM the eye TOWARD the light. Set it from the rig; the default is the portrait key's
        // direction in alive.js (offset +0.90, +0.45, +0.95 from the focus point).
        this.keyLightDirectionUniform = uniform( new Vector3( 0.90, 0.45, 0.95 ).normalize() );

        this.corneaIor = options.corneaIor ?? CORNEA_IOR;
        this.corneaRoughness = options.corneaRoughness ?? CORNEA_ROUGHNESS;
        this.corneaSceneSpecular = options.corneaSceneSpecular ?? CORNEA_SCENE_SPECULAR;
        this.refractionEnabled = options.refraction !== false;

        // Per-eye frames. The bind basis never changes; the world<->eye pair is rebuilt every frame
        // by update() from the gaze morphs and the head bone.
        this.frames = {
            left: this.createEyeFrame( this.geometry.left ),
            right: this.createEyeFrame( this.geometry.right )
        };

        // The rig's emitter sizes are stated as a fraction of IRIS DIAMETER, which only becomes an
        // angle once this figure's own cornea has been measured — so the resolve happens here,
        // after `measureEyeGeometry`, and against the mean of the two eyes. The two differ by about
        // 1% in iris radius, and one shared cubemap serves both.
        this.catchlightPeak = options.catchlightIntensity ?? CATCHLIGHT_PEAK;
        this.catchlightRig = options.catchlight === null
            ? null
            : resolveCatchlightRig(
                CATCHLIGHT_PRESETS[ options.catchlight ?? 'softbox' ],
                {
                    irisRadius: ( this.geometry.left.irisRadius + this.geometry.right.irisRadius ) / 2,
                    corneaRadius: ( this.geometry.left.corneaRadius + this.geometry.right.corneaRadius ) / 2
                },
                options.catchlightSizeScale ?? 1 );

        this.catchlight = this.catchlightRig === null
            ? null
            : buildCatchlightCubeTexture( this.catchlightRig );

        this.globeMaterial = this.buildGlobeMaterial();
        this.corneaMaterial = this.buildCorneaMaterial();

        // Scratch for update(). Allocated once: a per-frame allocation in a per-frame method is how
        // a 60 Hz path acquires a garbage-collection stutter.
        this.scratch = {
            objectToWorld: new Matrix4(),
            rotation: new Matrix3(),
            gaze: new Matrix3(),
            composed: new Matrix3(),
            axis: new Vector3(),
            offset: new Vector3()
        };

        this.attached = false;

    }

    /** Swaps the two built materials onto the two meshes. Idempotent. */
    attach() {

        if ( this.attached === true ) return this;

        this.globeMesh.material = this.globeMaterial;
        this.corneaMesh.material = this.corneaMaterial;
        this.attached = true;

        this.update();

        return this;

    }

    /** Puts the GLB's own materials back, so a page can A/B against the unshaded asset. */
    detach() {

        if ( this.attached === false ) return this;

        this.globeMesh.material = this.originalGlobeMaterial;
        this.corneaMesh.material = this.originalCorneaMaterial;
        this.attached = false;

        return this;

    }

    /**
     * Rebuilds the world <-> eye rotation for each eye. Call once per frame, after the motion stack
     * has written the morph weights and after the skeleton has updated.
     *
     * This is the whole answer to the spike's fifth failing clause. Gaze moves the eye — 15.1° of
     * rotation and 1.72 mm of centre travel at weight 1 — but it moves it RIGIDLY (residual 5.7% of
     * peak), so the eye-local frame survives as a rotation. The translation never enters: the
     * shader reads the BIND position for its eye-local coordinate, which is exact for a rigid body,
     * and uses the world position only to form a view direction.
     */
    update() {

        this.updateEyeFrame( 'left' );
        this.updateEyeFrame( 'right' );

    }

    dispose() {

        this.detach();
        this.globeMaterial.dispose();
        this.corneaMaterial.dispose();
        this.catchlight?.dispose();

    }

    /** Every measured number, for a report or a HUD. Millimetres, because that is the scale. */
    describe() {

        const line = ( label, eye ) => `${ label }: ` +
            `sclera R ${ ( eye.scleraRadius * 1000 ).toFixed( 3 ) } mm (rms ${ ( eye.scleraResidualRms * 1000 ).toFixed( 3 ) }), ` +
            `cornea R ${ ( eye.corneaRadius * 1000 ).toFixed( 3 ) } mm over ${ eye.corneaCapCount } verts ` +
            `(rms ${ ( eye.corneaResidualRms * 1000 ).toFixed( 4 ) }) centred ${ ( eye.corneaCentreZ * 1000 ).toFixed( 3 ) } mm forward, ` +
            `iris plane ${ ( eye.irisPlaneZ * 1000 ).toFixed( 3 ) } mm (rms ${ ( eye.irisPlaneRms * 1000 ).toFixed( 3 ) }), ` +
            `iris R ${ ( eye.irisRadius * 1000 ).toFixed( 3 ) } mm, ` +
            `anterior chamber ${ ( ( eye.corneaCentreZ + eye.corneaRadius - eye.irisPlaneZ ) * 1000 ).toFixed( 3 ) } mm, ` +
            `axis ${ eye.axis.map( ( value ) => value.toFixed( 3 ) ).join( ' ' ) }`;

        return [ line( 'left ', this.geometry.left ), line( 'right', this.geometry.right ) ].join( '\n' );

    }

    // --- construction helpers -------------------------------------------------------------------

    /**
     * The uniforms for one eye. `bindBasis` maps a bind-object-space vector into eye-local; the
     * other two are its animated counterparts and are rewritten every frame.
     */
    createEyeFrame( eye ) {

        const basis = new Matrix3().set(
            eye.tangent[ 0 ], eye.tangent[ 1 ], eye.tangent[ 2 ],
            eye.bitangent[ 0 ], eye.bitangent[ 1 ], eye.bitangent[ 2 ],
            eye.axis[ 0 ], eye.axis[ 1 ], eye.axis[ 2 ] );

        return {
            measurement: eye,
            basis,
            bindBasis: uniform( basis ),
            worldToEye: uniform( basis.clone() ),
            eyeToWorld: uniform( basis.clone().transpose() ),
            centre: uniform( new Vector3().fromArray( eye.centre ) ),

            // Carried per eye rather than shared, because the two eyes' UV squares are fitted
            // separately and their scales differ: 17.545 against 17.797 uv per metre on g050, so a
            // shared iris radius would be 1.3% wrong on one of them — 0.08 mm of limbus, which is
            // about a pixel of iris edge at the eyes-only crop this material is judged at.
            irisRadius: uniform( eye.irisRadius ),
            corneaCentreZ: uniform( eye.corneaCentreZ ),
            corneaRadius: uniform( eye.corneaRadius ),
            irisPlaneZ: uniform( eye.irisPlaneZ ),
            scleraRadius: uniform( eye.scleraRadius ),

            uvCentre: uniform( new Vector3( eye.uvCentre[ 0 ], eye.uvCentre[ 1 ], 0 ) ),
            uvJacobian: uniform( new Matrix3().set(
                eye.uvJacobian[ 0 ], eye.uvJacobian[ 1 ], 0,
                eye.uvJacobian[ 2 ], eye.uvJacobian[ 3 ], 0,
                0, 0, 1 ) ),
            gazeRotationVectors: this.measureGazeRotations( eye )
        };

    }

    /**
     * The rotation each `eyeLook*` morph applies to this eye, as an axis-angle vector in radians.
     *
     * Recovered by least squares from the morph's own delta field. A rigid rotation about any pivot
     * displaces vertex i by `omega x (x_i - centroid)` plus a constant translation, so removing the
     * mean delta leaves a field that is linear in omega and solvable in closed form. That is the
     * same reasoning the spike uses to report "residual / peak" — and its answer, 4.3-5.7%, is what
     * says this decomposition is worth doing at all.
     *
     * Composition at runtime is by SUMMING the rotation vectors, which is exact only in the limit
     * of small angles. Worst case here: the four morphs that drive one eye peak at 15.08°, they are
     * never all at weight 1 together (up and down are opposed, in and out are opposed), and a gaze
     * layer writing a 20° combined excursion accumulates under a degree of composition error. The
     * eye is a 15 mm ball; a degree is 0.26 mm at its surface.
     */
    measureGazeRotations( eye ) {

        const mesh = this.globeMesh;
        const dictionary = mesh.morphTargetDictionary ?? {};
        const deltas = mesh.geometry.morphAttributes.position ?? [];
        const position = mesh.geometry.attributes.position;
        const sign = eye.centre[ 0 ] > 0 ? 1 : -1;

        const indices = [];
        for ( let vertex = 0; vertex < position.count; vertex ++ ) {

            const x = position.getX( vertex );
            if ( sign > 0 ? x > 0 : x <= 0 ) indices.push( vertex );

        }

        const centroid = [ 0, 0, 0 ];
        for ( const vertex of indices ) {

            centroid[ 0 ] += position.getX( vertex );
            centroid[ 1 ] += position.getY( vertex );
            centroid[ 2 ] += position.getZ( vertex );

        }
        for ( let axis = 0; axis < 3; axis ++ ) centroid[ axis ] /= indices.length;

        const rotations = [];

        for ( const [ name, index ] of Object.entries( dictionary ) ) {

            const delta = deltas[ index ];
            if ( delta === undefined ) continue;

            const meanDelta = [ 0, 0, 0 ];
            for ( const vertex of indices ) {

                meanDelta[ 0 ] += delta.getX( vertex );
                meanDelta[ 1 ] += delta.getY( vertex );
                meanDelta[ 2 ] += delta.getZ( vertex );

            }
            for ( let axis = 0; axis < 3; axis ++ ) meanDelta[ axis ] /= indices.length;

            // Normal equations for  minimise  sum | -K(r_i) w - (d_i - dbar) |^2,
            // where K(r) v = r x v. Three unknowns, so a 3x3 solve.
            const matrix = [ [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ] ];
            const vector = [ 0, 0, 0 ];
            let peak = 0;

            for ( const vertex of indices ) {

                const r = [
                    position.getX( vertex ) - centroid[ 0 ],
                    position.getY( vertex ) - centroid[ 1 ],
                    position.getZ( vertex ) - centroid[ 2 ]
                ];
                const d = [
                    delta.getX( vertex ) - meanDelta[ 0 ],
                    delta.getY( vertex ) - meanDelta[ 1 ],
                    delta.getZ( vertex ) - meanDelta[ 2 ]
                ];
                peak = Math.max( peak, Math.hypot( delta.getX( vertex ), delta.getY( vertex ), delta.getZ( vertex ) ) );

                // Rows of -K(r).
                const rows = [
                    [ 0, r[ 2 ], -r[ 1 ] ],
                    [ -r[ 2 ], 0, r[ 0 ] ],
                    [ r[ 1 ], -r[ 0 ], 0 ]
                ];

                for ( let row = 0; row < 3; row ++ ) {

                    for ( let a = 0; a < 3; a ++ ) {

                        for ( let b = 0; b < 3; b ++ ) matrix[ a ][ b ] += rows[ row ][ a ] * rows[ row ][ b ];
                        vector[ a ] += rows[ row ][ a ] * d[ row ];

                    }

                }

            }

            if ( peak < 1e-9 ) continue;   // this morph does not drive this eye at all

            const omega = solveSymmetric3( matrix, vector );
            if ( omega === null ) continue;

            rotations.push( { name, index, omega } );

        }

        return rotations;

    }

    /**
     * The globe: refraction, pupil, limbal ring, and a diffuse-side normal.
     *
     * Read this as three coordinate systems handed off in order — bind object space (what the
     * attribute buffer holds), eye-local metres (where all the optics happens), and iris-disc UV
     * (where the texture is). Nothing crosses a boundary without a named conversion.
     */
    buildGlobeMaterial() {

        const material = new MeshPhysicalNodeMaterial();
        material.name = 'sugata.eye.globe';

        const source = Array.isArray( this.originalGlobeMaterial )
            ? this.originalGlobeMaterial[ 0 ]
            : this.originalGlobeMaterial;
        const map = source.map;

        // Which eye this fragment belongs to. Read off the BIND position, which is a compile-time
        // constant per vertex and therefore immune to anything the gaze morphs do.
        const isLeft = step( float( 0 ), positionGeometry.x );
        const perEye = ( pick ) => mix( pick( this.frames.right ), pick( this.frames.left ), isLeft );

        // --- eye-local frame ---------------------------------------------------------------------
        //
        // p: the fragment's own position, exact in the bind frame because the eye is rigid.
        // v: the direction to the camera, brought back through this frame's animated rotation.
        const p = perEye( ( frame ) => frame.bindBasis.mul( positionGeometry.sub( frame.centre ) ) );
        const viewWorld = normalize( cameraPosition.sub( positionWorld ) );
        const v = normalize( perEye( ( frame ) => frame.worldToEye.mul( viewWorld ) ) );

        const irisRadius = perEye( ( frame ) => frame.irisRadius );
        const radiusOnGlobe = p.xy.length().div( irisRadius );

        // --- refraction at the corneal anterior sphere -------------------------------------------
        //
        // research §1 steps 2-4, with our own geometry substituted for HDRP's normalised space. The
        // ray is traced from the shaded point OUT to the cornea rather than refracted at the shaded
        // point's own normal, because on this asset the shaded point is on the globe's iris dish and
        // the refracting surface is a different shell 2-3 mm in front of it.
        const corneaCentre = vec3( 0, 0, perEye( ( frame ) => frame.corneaCentreZ ) );
        const corneaRadius = perEye( ( frame ) => frame.corneaRadius );

        const toCentre = p.sub( corneaCentre );
        const halfB = toCentre.dot( v );
        const c = toCentre.dot( toCentre ).sub( corneaRadius.mul( corneaRadius ) );
        const discriminant = halfB.mul( halfB ).sub( c ).max( 0 );
        const exit = p.add( v.mul( halfB.negate().add( discriminant.sqrt() ) ) );
        const corneaNormal = normalize( exit.sub( corneaCentre ) );

        const refracted = refract( v.negate(), corneaNormal, float( 1 / this.corneaIor ) );

        // Ray-plane, with the divisor clamped away from zero. A refracted ray always travels back
        // into the eye, so refracted.z is negative; the clamp only protects the degenerate case
        // where the view is so grazing that the quadratic above was already clamped.
        const irisPlaneZ = perEye( ( frame ) => frame.irisPlaneZ );
        const travel = irisPlaneZ.sub( exit.z ).div( refracted.z.min( -1e-4 ) );
        const hit = exit.add( refracted.mul( travel ) );

        // Refraction off is the A side of the parallax comparison: the iris is then read at the
        // fragment's own position, which is what a flat disc does.
        const irisPoint = this.refractionEnabled === true ? hit.xy : p.xy;

        // --- pupil dilation, the two-piece radial remap ------------------------------------------
        //
        // motion/Pupil.js states this contract in full, including why the annulus outside the pupil
        // has to be remapped rather than the pupil circle merely scaled: the iris fibres have to
        // STRETCH as the pupil opens.
        const authoredPupil = float( PUPIL_RADIUS_UV / IRIS_RADIUS_UV );
        const irisRadial = saturate( irisPoint.length().div( irisRadius ) );
        const pupilEdge = authoredPupil.mul( this.pupilScaleUniform ).clamp( 0.02, 0.9 );

        const insidePupil = irisRadial.div( pupilEdge ).mul( authoredPupil );
        const outsidePupil = authoredPupil.add(
            irisRadial.sub( pupilEdge ).div( pupilEdge.oneMinus() ).mul( authoredPupil.oneMinus() ) );
        const remapped = mix( outsidePupil, insidePupil, step( irisRadial, pupilEdge ) );

        // Divided rather than normalized: at the exact pupil centre the direction is undefined, and
        // `normalize` there is a NaN that propagates through the texture fetch and blackens a texel
        // in the middle of the pupil. The pupil is black anyway, so the floor costs nothing.
        const irisDirection = irisPoint.div( irisPoint.length().max( 1e-9 ) );
        const sampleXy = irisDirection.mul( remapped.mul( irisRadius ) );

        // --- the two texture reads ----------------------------------------------------------------
        //
        // The composited map, sampled twice at two coordinates. The sclera read is the mesh's own UV
        // and therefore carries the authored vein and shading detail; the iris read is the refracted
        // hit point pushed through the measured planar map.
        const irisUv = perEye( ( frame ) =>
            frame.uvCentre.add( frame.uvJacobian.mul( vec3( sampleXy, 0 ) ) ) ).xy;

        const scleraSample = texture( map, uv() );
        const irisSample = texture( map, irisUv );

        // --- the radial mask ------------------------------------------------------------------------
        //
        // research §5: "a radial mask with a deliberately sharp pow(x, 8) falloff". Taken literally.
        // At radius 0.8 of the iris this is still 0.83, at 0.95 it is 0.34, at 1.0 it is 0 — a
        // transition concentrated in the outer fifth of the iris, which is 1.3 mm and is what a real
        // limbus actually is. Measured on the GLOBE's own radius, not the refracted one, so the
        // boundary is geometrically stable while the iris parallaxes inside it.
        const irisMask = saturate( pow( saturate( radiusOnGlobe ), 8 ).oneMinus() );

        // --- the limbal ring, view-dependent ---------------------------------------------------------
        //
        // research §3: two functions, iris-side and sclera-side, both tightening and fading edge-on
        // via NdotV. Unreal's Limbus Pow 15-22 and Limbus Dark Scale 2.0-2.15 are the two dials.
        const facing = saturate( normalViewGeometry.dot( positionViewDirection ) );
        const grazing = facing.oneMinus();
        const ringPower = float( LIMBUS_POW ).mul( mix( float( 1 ), float( LIMBUS_DARK_SCALE ), grazing ) );

        // Both smoothsteps are written low-edge-first and inverted. GLSL and WGSL both leave
        // smoothstep undefined when the edges are given in descending order, and a shader that
        // relies on it works until the backend changes.
        const ringIris = pow( saturate( radiusOnGlobe ), ringPower ).mul( irisMask );
        const ringSclera = smoothstep( float( 1.0 ), float( 1.14 ), radiusOnGlobe )
            .oneMinus().mul( irisMask.oneMinus() );
        const ring = ringIris.add( ringSclera ).clamp( 0, 1 ).mul( mix( float( 0.55 ), float( 1 ), facing ) );

        // --- the iris caustic, analytic ----------------------------------------------------------------
        //
        // research §4's decision rule: static key -> analytic. Light entering the far side of the
        // cornea is focused onto the near wall of the iris, so the bright crescent sits OPPOSITE the
        // key. `keyInEye` is the key direction brought into this eye's frame, and the dot against the
        // iris-plane position is negative on the lit side and positive where the caustic lands.
        const keyInEye = normalize( perEye( ( frame ) => frame.worldToEye.mul( this.keyLightDirectionUniform ) ) );
        const causticAlong = saturate( irisDirection.dot( keyInEye.xy.negate() ) );
        const caustic = pow( causticAlong, float( IRIS_CAUSTIC_POWER ) )
            .mul( irisRadial )
            .mul( this.causticScaleUniform )
            .mul( irisMask );

        // --- albedo -------------------------------------------------------------------------------
        //
        // The sclera is brightened (G2's luma ratio) and then TINTED (the spec's chroma clause).
        // The tint is a per-channel gain whose Rec.709 linear luma is exactly 1, so it rotates the
        // colour without touching the brightness the gate reads. See SCLERA_SPEC_SRGB.
        const scleraTint = lumaNeutralGain( SCLERA_SPEC_SRGB );
        const tinted = scleraSample.rgb.mul( vec3( ...scleraTint ) );
        const sclera = mix( scleraSample.rgb, tinted, this.scleraChromaUniform )
            .mul( this.scleraBrightnessUniform );
        const iris = irisSample.rgb.mul( float( 1 ).add( caustic ) );
        const albedo = mix( sclera, iris, irisMask ).mul( ring.mul( this.limbalRingUniform ).oneMinus() );

        material.colorNode = vec4( albedo, 1 );

        // --- the diffuse normal ---------------------------------------------------------------------
        //
        // research §5 keeps two normals and snaps the SPECULAR one flat inside the iris "because the
        // specular comes off the smooth cornea, not the bumpy iris". Here the specular is on the
        // other mesh entirely, so this normal is the diffuse one, and its job is the opposite: the
        // globe's own mesh normal inside the iris is the normal of a 2.5 mm-deep BOWL, which shades
        // the iris like a dish and is the single most doll-like thing the unshaded asset does. It is
        // replaced by the eye's own smooth sphere normal — what the iris would shade like if the
        // dish were not modelled — and the mesh normal is kept for the sclera, where it is correct.
        // Both halves are analytic, and the mesh's own interpolated normal is used for neither. The
        // globe is a sphere with a dish cut into its front, and both of those are described exactly
        // by numbers already measured off it — whereas its shipped normals deviate from the fitted
        // sphere by a median 3.53° and a maximum 23.51° (spike §3), which at these roughnesses is
        // enough to break a highlight into facets. See the corneal shell for what that looked like.
        const scleraNormalEye = normalize( p );
        const irisNormalEye = normalize( vec3( p.xy, perEye( ( frame ) => frame.scleraRadius ).mul( 0.85 ) ) );

        const diffuseNormalEye = normalize( mix( scleraNormalEye, irisNormalEye, irisMask ) );
        const diffuseNormalWorld = perEye( ( frame ) => frame.eyeToWorld.mul( diffuseNormalEye ) );

        material.normalNode = normalize( cameraViewMatrix.mul( vec4( diffuseNormalWorld, 0 ) ).xyz );

        // --- specular ----------------------------------------------------------------------------
        //
        // Inside the iris the globe is matte and the corneal shell carries the whole highlight.
        // Outside it the sclera keeps its own wet film — the corneal shell stops contributing at
        // 1.45 x the iris radius, so something has to.
        material.roughnessNode = mix( float( SCLERA_ROUGHNESS ), float( IRIS_ROUGHNESS ), irisMask );
        material.metalnessNode = float( 0 );

        return material;

    }

    /**
     * The corneal shell: specular only, off the mesh's own dome normals, plus the catchlight.
     *
     * Additive with depth write off. A clear shell can only ADD light — it has no albedo of its own
     * — so additive is not a cheat here, it is the physically correct compositing operator for the
     * one term the shell contributes. Depth write off keeps it from occluding the eyelashes, which
     * pass through the same 0.4 mm gap.
     */
    buildCorneaMaterial() {

        const material = new MeshPhysicalNodeMaterial();
        material.name = 'sugata.eye.cornea';

        material.transparent = true;
        material.blending = AdditiveBlending;
        material.depthWrite = false;
        material.depthTest = true;
        material.ior = 1.376;                 // the corneal stroma's own index, for the Fresnel term
        material.color = new Color( 0x000000 );
        material.roughness = this.corneaRoughness;
        material.metalness = 0;
        material.specularIntensity = this.corneaSceneSpecular;

        const isLeft = step( float( 0 ), positionGeometry.x );
        const perEye = ( pick ) => mix( pick( this.frames.right ), pick( this.frames.left ), isLeft );

        const p = perEye( ( frame ) => frame.bindBasis.mul( positionGeometry.sub( frame.centre ) ) );
        const radiusOnCornea = p.xy.length().div( perEye( ( frame ) => frame.irisRadius ) );

        // Coverage: full over the corneal cap, feathered out before the two shells get close enough
        // to interleave. See CORNEA_COVERAGE_LIMIT for the measured clearances. Written with the
        // low edge first and inverted, because smoothstep with descending edges is undefined.
        const coverage = smoothstep(
            float( CORNEA_COVERAGE_LIMIT - CORNEA_COVERAGE_FEATHER ),
            float( CORNEA_COVERAGE_LIMIT ),
            radiusOnCornea ).oneMinus();

        // --- the corneal normal, analytic rather than interpolated -------------------------------
        //
        // 🚩 The shell's OWN normals cannot carry a mirror specular, and this was found by looking.
        // `tools/spikes/eye-geometry.mjs` measures them at a median 3.53° and a maximum 23.51° off
        // the fitted sphere's radial direction, over 256 vertices per eye — and at roughness 0.03 a
        // 3.5° normal error is a whole highlight width. The first render of this material put a
        // hard-edged polygonal grey slab across each iris; that slab was the panel reflected in a
        // facetted normal field, not a bug in the lighting.
        //
        // So the shell is shaded against the two spheres that were fitted to it: the anterior cap
        // inside the cornea, the eyeball outside it, blended across the join. Both are measured
        // from this very mesh, so the surface being shaded and the surface being described are the
        // same surface — this is a smoothing of the normal field, not a substitution of a different
        // shape.
        const capNormal = normalize( p.sub( vec3( 0, 0, perEye( ( frame ) => frame.corneaCentreZ ) ) ) );
        const shellNormal = normalize( p );
        const joinBlend = smoothstep(
            perEye( ( frame ) => frame.irisRadius ).mul( 0.85 ),
            perEye( ( frame ) => frame.irisRadius ).mul( 1.25 ),
            p.xy.length() );

        const normalEye = normalize( mix( capNormal, shellNormal, joinBlend ) );
        const normalWorldNode = normalize( perEye( ( frame ) => frame.eyeToWorld.mul( normalEye ) ) );

        material.normalNode = normalize( cameraViewMatrix.mul( vec4( normalWorldNode, 0 ) ).xyz );
        material.opacityNode = coverage;

        {

            const viewWorld = normalize( cameraPosition.sub( positionWorld ) );

            // WORLD space, deliberately. A reflection of a fixed panel stays put in the world while
            // the eye rotates under it; sampling in eye space would drag the catchlight around with
            // gaze, which is the painted-on-dot failure the cubemap exists to avoid.
            const reflectWorld = reflect( viewWorld.negate(), normalWorldNode );

            const fresnel = pow( saturate( viewWorld.dot( normalWorldNode ) ).oneMinus(), float( 3 ) )
                .mul( 0.6 ).add( 0.4 );

            if ( this.catchlight !== null ) {

                // Two terms with two different scales, and keeping them apart is the whole point.
                // The DOMINANT highlight comes out of the cube texture, which is 8-bit sRGB and
                // therefore clamps at linear 1.0, and is multiplied by CATCHLIGHT_PEAK to give it
                // the headroom a real softbox has. The WASH is a constant at unit scale. Adding
                // the wash to the texture and scaling both together produces a veil over the whole
                // iris at 0.02 x 26 = 0.5 linear — measured, by looking at it.
                const wash = this.catchlightRig.wash ?? { colour: [ 0, 0, 0 ], intensity: 0 };
                const washColour = vec3(
                    wash.colour[ 0 ] * wash.intensity,
                    wash.colour[ 1 ] * wash.intensity,
                    wash.colour[ 2 ] * wash.intensity );

                material.emissiveNode = this.catchlight.node( reflectWorld )
                    .mul( this.catchlightIntensityUniform )
                    .add( washColour )
                    .mul( fresnel )
                    .mul( coverage );

            }

        }

        return material;

    }

    // --- per-frame ---------------------------------------------------------------------------------

    updateEyeFrame( side ) {

        const frame = this.frames[ side ];
        const mesh = this.globeMesh;

        // 1. Bind object space -> world, through the single bone this mesh is skinned to. Measured:
        //    every one of the 524 corneal vertices is weighted 1.0 to `head`, so the skin transform
        //    is one rigid matrix rather than a blend, and it can be composed on the CPU exactly.
        const objectToWorld = this.scratch.objectToWorld;
        const skeleton = mesh.skeleton;

        if ( skeleton !== undefined && skeleton !== null ) {

            const boneIndex = mesh.geometry.attributes.skinIndex.getX( 0 );
            objectToWorld
                .multiplyMatrices( skeleton.bones[ boneIndex ].matrixWorld, skeleton.boneInverses[ boneIndex ] )
                .premultiply( mesh.bindMatrixInverse )
                .multiply( mesh.bindMatrix )
                .premultiply( mesh.matrixWorld );

        } else {

            objectToWorld.copy( mesh.matrixWorld );

        }

        const objectRotation = this.scratch.rotation.setFromMatrix4( objectToWorld );
        orthonormalise( objectRotation );

        // 2. The gaze rotation, summed from the morph weights and turned into a matrix.
        const gaze = this.scratch.gaze;
        const influences = mesh.morphTargetInfluences;
        let omegaX = 0;
        let omegaY = 0;
        let omegaZ = 0;

        if ( influences !== undefined ) {

            for ( const rotation of frame.gazeRotationVectors ) {

                const weight = influences[ rotation.index ];
                if ( weight === 0 ) continue;
                omegaX += weight * rotation.omega[ 0 ];
                omegaY += weight * rotation.omega[ 1 ];
                omegaZ += weight * rotation.omega[ 2 ];

            }

        }

        setFromRotationVector( gaze, omegaX, omegaY, omegaZ );

        // 3. eyeToWorld = objectRotation * gaze * bindBasis^T, and worldToEye is its transpose.
        const composed = this.scratch.composed.copy( frame.basis ).transpose();
        composed.premultiply( gaze ).premultiply( objectRotation );

        frame.eyeToWorld.value.copy( composed );
        frame.worldToEye.value.copy( composed ).transpose();

    }

}

// --- small maths ------------------------------------------------------------------------------------

/**
 * A per-channel gain that gives a NEUTRAL linear colour the chromaticity of `srgbTarget` while
 * leaving its Rec.709 linear luma exactly where it was.
 *
 * Neutral is the case that matters and it is the case this is exact for: the shipped map's sclera
 * is RGB 160,153,145, saturation 0.094, so the input is grey to within a rounding error and the
 * gain moves chroma without moving the quantity G2 reads. On a strongly coloured input the gain is
 * only approximately luma-neutral, which is why it is applied to the sclera and not to the iris.
 *
 * Exported because it is the one line of the tint that can be wrong in a way nothing looks like:
 * get the transfer function backwards and the gain is luma-neutral in the wrong space, so the
 * sclera brightens or darkens and G2 moves for a reason that has nothing to do with G2.
 * `EyeMaterial.selftest.mjs` asserts both properties.
 */
export function lumaNeutralGain( srgbTarget ) {

    const linear = srgbTarget.map( srgbToLinearScalar );
    const luma = 0.2126 * linear[ 0 ] + 0.7152 * linear[ 1 ] + 0.0722 * linear[ 2 ];

    return linear.map( ( channel ) => channel / luma );

}

function srgbToLinearScalar( encoded ) {

    return encoded <= 0.04045 ? encoded / 12.92 : Math.pow( ( encoded + 0.055 ) / 1.055, 2.4 );

}

/** The mean outward direction of a point cloud about a centre — the axis of an open cap. */
function meanDirection( points, centre ) {

    const sum = [ 0, 0, 0 ];

    for ( const point of points ) {

        const offset = subtract( point, centre );
        const length = Math.hypot( ...offset );
        for ( let axis = 0; axis < 3; axis ++ ) sum[ axis ] += offset[ axis ] / length;

    }

    const length = Math.hypot( ...sum );
    return sum.map( ( value ) => value / length );

}

/**
 * Two unit vectors perpendicular to `axis` and to each other.
 *
 * Seeded from world up, so on a figure standing upright the tangent runs across the face and the
 * bitangent runs up it. That is not required by any of the maths — the UV fit absorbs whatever
 * frame it is handed — but it makes every printed number in `describe()` readable.
 */
function frameAbout( axis ) {

    const seed = Math.abs( axis[ 1 ] ) < 0.9 ? [ 0, 1, 0 ] : [ 1, 0, 0 ];
    const tangent = normaliseVector( crossProduct( seed, axis ) );
    return [ tangent, crossProduct( axis, tangent ) ];

}

function angleFromAxisDegrees( point, centre, axis ) {

    const offset = subtract( point, centre );
    const length = Math.hypot( ...offset );
    const cosine = Math.min( 1, Math.max( -1, dot( offset, axis ) / length ) );
    return Math.acos( cosine ) * 180 / Math.PI;

}

/** Least squares  target = a*t + b*s + c  over eye-local vertices. */
function fitAffine( vertices, target ) {

    const matrix = [ [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ] ];
    const vector = [ 0, 0, 0 ];

    for ( const vertex of vertices ) {

        const row = [ vertex.t, vertex.s, 1 ];
        const value = target( vertex );

        for ( let a = 0; a < 3; a ++ ) {

            for ( let b = 0; b < 3; b ++ ) matrix[ a ][ b ] += row[ a ] * row[ b ];
            vector[ a ] += row[ a ] * value;

        }

    }

    return solveSymmetric3( matrix, vector ) ?? [ 0, 0, 0 ];

}

/** Gauss-Jordan on a 3x3. Returns null if the system is singular rather than returning NaNs. */
function solveSymmetric3( matrix, vector ) {

    const augmented = matrix.map( ( row, index ) => [ ...row, vector[ index ] ] );

    for ( let column = 0; column < 3; column ++ ) {

        let pivot = column;
        for ( let row = column + 1; row < 3; row ++ ) {

            if ( Math.abs( augmented[ row ][ column ] ) > Math.abs( augmented[ pivot ][ column ] ) ) pivot = row;

        }

        if ( Math.abs( augmented[ pivot ][ column ] ) < 1e-18 ) return null;

        [ augmented[ column ], augmented[ pivot ] ] = [ augmented[ pivot ], augmented[ column ] ];

        for ( let row = 0; row < 3; row ++ ) {

            if ( row === column ) continue;
            const factor = augmented[ row ][ column ] / augmented[ column ][ column ];
            for ( let k = column; k <= 3; k ++ ) augmented[ row ][ k ] -= factor * augmented[ column ][ k ];

        }

    }

    return [ 0, 1, 2 ].map( ( index ) => augmented[ index ][ 3 ] / augmented[ index ][ index ] );

}

/**
 * Every vertex position paired with its UV, duplicates on position removed.
 *
 * Positions come out of a float32 accessor, so equal positions are bit-equal and a string key is
 * exact — no epsilon, and therefore nothing that could weld two genuinely different vertices.
 */
function weldedByPosition( geometry ) {

    const position = geometry.attributes.position;
    const uvAttribute = geometry.attributes.uv;
    const seen = new Set();
    const entries = [];

    for ( let vertex = 0; vertex < position.count; vertex ++ ) {

        const x = position.getX( vertex );
        const y = position.getY( vertex );
        const z = position.getZ( vertex );
        const key = `${ x },${ y },${ z }`;

        if ( seen.has( key ) ) continue;
        seen.add( key );

        entries.push( {
            point: [ x, y, z ],
            uv: uvAttribute === undefined ? [ 0, 0 ] : [ uvAttribute.getX( vertex ), uvAttribute.getY( vertex ) ]
        } );

    }

    return entries;

}

/**
 * Rodrigues, writing a rotation vector (axis * angle, radians) into a Matrix3.
 *
 * Small-angle safe: below a milliradian the series is truncated at first order rather than dividing
 * by a vanishing angle. A milliradian on a 15 mm eye is 15 microns.
 */
function setFromRotationVector( matrix, x, y, z ) {

    const angle = Math.hypot( x, y, z );

    if ( angle < 1e-3 ) {

        matrix.set( 1, -z, y, z, 1, -x, -y, x, 1 );
        return matrix;

    }

    const ax = x / angle;
    const ay = y / angle;
    const az = z / angle;
    const sine = Math.sin( angle );
    const cosine = Math.cos( angle );
    const t = 1 - cosine;

    matrix.set(
        t * ax * ax + cosine, t * ax * ay - sine * az, t * ax * az + sine * ay,
        t * ax * ay + sine * az, t * ay * ay + cosine, t * ay * az - sine * ax,
        t * ax * az - sine * ay, t * ay * az + sine * ax, t * az * az + cosine );

    return matrix;

}

/**
 * Gram-Schmidt on a Matrix3, so a transpose really is an inverse.
 *
 * `Matrix3.setFromMatrix4` keeps whatever scale the Matrix4 carried, and the shader inverts these
 * by transposing. A figure scaled by its consumer would otherwise turn a transpose into a wrong
 * answer that still looks like a rotation.
 */
function orthonormalise( matrix ) {

    const e = matrix.elements;   // column-major: e[0..2] is column 0

    const column = ( index ) => [ e[ index * 3 ], e[ index * 3 + 1 ], e[ index * 3 + 2 ] ];
    const write = ( index, value ) => {

        e[ index * 3 ] = value[ 0 ];
        e[ index * 3 + 1 ] = value[ 1 ];
        e[ index * 3 + 2 ] = value[ 2 ];

    };

    const first = normaliseVector( column( 0 ) );
    const second = normaliseVector( crossProduct( column( 2 ), first ) );
    const third = crossProduct( first, second );

    write( 0, first );
    write( 1, second );
    write( 2, third );

    return matrix;

}

function subtract( a, b ) {

    return [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];

}

function dot( a, b ) {

    return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];

}

function crossProduct( a, b ) {

    return [
        a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
        a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
        a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ]
    ];

}

function normaliseVector( a ) {

    const length = Math.hypot( ...a );
    return [ a[ 0 ] / length, a[ 1 ] / length, a[ 2 ] / length ];

}
