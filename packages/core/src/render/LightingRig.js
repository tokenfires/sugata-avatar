/**
 * LightingRig — the four-light portrait/full-body rig, punch list 3.8.
 *
 * The single highest-leverage parameter in `docs/research/stellar-blade-look-spec.md` is not a
 * shader constant. It is a lighting ratio: **the reference face is flat-lit at key:fill ≈ 1.25:1
 * encoded (1.43–1.64 linear)**, where western photoreal cinematics run 4:1–8:1. A skin shader
 * tuned under a dramatic three-point rig is tuned to the wrong image. So this file lands before
 * 3.2 and 3.3, and its gate — `tools/critic/measure.mjs` G1, face key:shadow < 2:1 linear — is
 * the thing those two get judged against.
 *
 * ## Why an irradiance budget rather than four hand-tuned intensities
 *
 * `RectAreaLight.intensity` is a **radiance** (nits). The light a face actually receives from a
 * panel is that radiance times the panel's *projected solid angle*, which changes whenever the
 * panel is resized or moved. So four authored intensities do not express a lighting ratio — they
 * express one only for the exact geometry they were typed against, and silently stop meaning it
 * the moment the rig scales from a head to a whole body.
 *
 * Every light here is therefore authored as the **irradiance it delivers at the focus point**,
 * and the panel radiance is *derived* from the geometry:
 *
 *     radiance = irradiance / projectedSolidAngle( width, height, distance )
 *
 * `key:fill` is then literally the ratio of two authored numbers, and it survives every rescale
 * the rig performs. That is what makes 1.25:1 a design decision instead of an emergent accident.
 *
 * ## Why every light is a PAIR
 *
 * 🚩 **RectAreaLight casts no shadow.** three.js issue #14161 has been open since 2018, there is
 * no shadow code in `RectAreaLightNode.js`, and `ClusteredLightsNode` filters to non-shadowing
 * point lights only, so nothing rescues it. `research/eyes-and-lighting.md` records the standing
 * decision: area lights for the *shading*, a co-located punctual light for the *shadowing* — a
 * cheap form of the Heitz et al. (I3D 2018) ratio estimator.
 *
 * The split here is by ENERGY, not by adding a second light on top. A light with `shadowFraction`
 * f puts f of its authored irradiance into a shadow-casting `SpotLight` and (1 − f) into the
 * `RectAreaLight`. Two consequences, both wanted:
 *
 *   - Total irradiance **at the focus** is unchanged, so `shadowFraction` cannot move the
 *     exposure or the authored key:fill.
 *   - The **deepest shadow that light can cast is exactly f** of its own contribution. Shadow
 *     density becomes a dial with a number on it, which is the only way to hold a < 2:1 face
 *     while still having a figure that sits in the world rather than floating in it.
 *
 * ⚠️ "Orthogonal to the gate" was the claim, and the measurement does not quite support it, so it
 * is written down as measured rather than as intended. Sweeping the key's fraction on the real
 * render moves G1's measured face ratio by **6.6%** — the two halves are equal only ON the focus
 * point, and a face is 200 mm deep:
 *
 *   | key shadowFraction | measured face key:shadow, linear |
 *   |--------------------|----------------------------------|
 *   | 0.00               | 1.551                            |
 *   | 0.30               | 1.599                            |
 *   | **0.45 (shipped)** | **1.625**                        |
 *   | 0.60               | 1.654 — outside the 1.43–1.64 reference band |
 *
 * 0.45 is chosen off that table as the deepest shadow that keeps the rendered ratio inside the
 * reference band, with the panel still carrying 55% of the key so the broad softbox lobe stays
 * the dominant specular. Anyone raising it past 0.60 is trading the look spec's flat face for
 * shadow density, and should say so out loud rather than discover it in a critic's report.
 *
 * ⚠️ It costs something, and the cost is specular character. A punctual light gives a small tight
 * highlight where the panel gives the broad wrapped softbox streak that `eyes-and-lighting.md`
 * calls "the #1 tell" of the AAA portrait look, and the look spec explicitly wants "broad, soft,
 * low-intensity highlights ... no tight glints." So `shadowFraction` is kept modest on the key and
 * zero on the fill — a fill that casts a shadow is not a fill — and the micro-contact shadowing it
 * cannot resolve is punch-list 3.9's screen-space job, not this file's.
 *
 * 🚩 **The shadow half is a `SpotLight`, and it started as a `DirectionalLight`.** The swap was
 * forced by a measurement, and the measurement is worth recording because the defect was
 * invisible on the subject and obvious two metres behind it. A directional has **no distance
 * falloff at all**, so splitting a light between a panel (falls off as 1/d²) and a directional
 * (does not) makes the pair's falloff depend on the split. At the focus they agree by
 * construction; on a backdrop 1.9 m further back they do not. Measured: turning shadows OFF made
 * the backdrop *darker* — 0.296 → 0.254 encoded on the shadow side, 0.440 → 0.419 on the key side
 * — which is physically impossible for a shadow and is really the directional's missing falloff
 * being removed. A `SpotLight` with the default inverse-square decay falls off the same way the
 * panel does, so the split becomes what it claims to be: a redistribution, not a change of light.
 * `research/eyes-and-lighting.md` sanctions either ("a co-located DirectionalLight/SpotLight
 * shadow map"); only one of them is neutral.
 *
 * 🚩 **A RectAreaLight behind the subject draws a straight-edged wedge across any large flat
 * surface further back, and it is not a bug in this rig.** A `RectAreaLight` illuminates only the
 * half-space in front of its own plane, with a hard cut at the plane itself; on a curved subject
 * that boundary lands on a surface already turned away and is invisible, but on a flat backdrop it
 * is a straight line across the frame. Isolated by execution on
 * `packages/testbed/src/lighting.html`: with the rim and kicker at zero the backdrop is a clean
 * smooth gradient, and with ONLY the rim and kicker it is black with one hard-edged bright wedge.
 *
 * This is very likely why `alive.js` made its backdrop emissive and wrote it off as "a fifth light
 * we cannot afford" — the real obstacle is geometric, not budgetary. Three ways out, none free:
 * keep the backdrop CLOSER to the subject than the rim and kicker so their planes never cross it;
 * give the card an emissive floor so the step is a small fraction of its value; or keep large flat
 * surfaces out of shot. The testbed does none of them on purpose, so the artefact is on the plate
 * where the next person can see it.
 *
 * ✅ **AT BODY FRAMING THE FIRST WAY OUT IS NOW TAKEN, AND THE WEDGE IS GONE.** A judge reported a
 * hard-edged wedge in the top-left of `alive.html?bare&frame=body`; this is what it was. It went
 * with the standoff — at 0.65 heights the body rim's plane no longer reaches the card, which sits
 * 4.86 m back. Measured on that page at 900×1200, seed 1, one `__SUGATA_STEP__` after load, on
 * two fixed rects — one inside the wedge, one on clean backdrop 0.74 of the frame away:
 *
 *   | rim standoff | wedge rect     | clean rect     |
 *   |--------------|----------------|----------------|
 *   | 1.4 (was)    | rgb(5, 10, 60) | rgb(7, 7, 33)  |
 *   | 0.65         | rgb(5, 4, 4)   | rgb(6, 5, 5)   |
 *
 * The two rects are now the same colour to within a code value, which is the difference between
 * "there is a wedge" and "there is not." **Portrait framing keeps its 2.6-height standoff and so
 * keeps the wedge**, and on `lighting.html`'s lit grey card it is large: 30.4% of the portrait
 * frame sits above HSV S 0.5 in a 200–280° hue. That is a real open item, recorded rather than
 * fixed, because the portrait standoff is doing a different job — see `EDGE_LIGHTS`.
 *
 * ## Two framings, and the azimuth swing that was WITHDRAWN
 *
 * `docs/PROGRESS.md` records the open lead: *"Full-body lighting is a scaled portrait rig; rim
 * and kicker stop reading at body scale."* Uniform scaling is not the bug — it is provably
 * neutral. Scale panel size and standoff by the same factor and the solid angle, the irradiance
 * and the wrap ANGLE are all unchanged; the subject keeps its exposure and its relative softness.
 * `key` and `fill` are therefore authored in units of subject height and are genuinely
 * scale-free: the same two entries serve both presets, unchanged.
 *
 * A rim is different, because what a viewer judges is not an angle. It is a **band of pixels**.
 * Model a limb as a cylinder of radius R seen side-on, with the rim at azimuth φ measured from
 * the camera direction. The surface is lit where the light is above the horizon, so the lit arc
 * visible to the camera runs from θ = φ − 90° to the silhouette at θ = 90°, and it projects to a
 * band of screen width
 *
 *     bandWidth = R · ( 1 − sin( φ − 90° ) ) = R · ( 1 + cos φ )
 *
 * `1 + cos φ` — the fraction of the limb's radius the rim covers — is scale-free, and R in pixels
 * is not. Measured on this project's own two framings: the portrait frames 0.42 m over the
 * canvas height and the head is ~0.09 m in radius, so R is 21.4% of frame height; the body frame
 * is ~1.87 m and an upper arm is ~0.045 m, so R is 2.4%. **The same rim covers 8.9× fewer pixels
 * at body framing.** That derivation is correct and it stands.
 *
 * 🚩 **What was WRONG was the conclusion drawn from it.** The previous round swung the body rim
 * from φ = −152° to −134° to take `1 + cos φ` from 0.117 to 0.305, on the reasoning that a wider
 * band is a more legible rim. It is not, because `1 + cos φ` is the fraction of a LIMB's radius,
 * and the largest thing in a full-body frame is not a limb — it is a torso of radius ~0.15 m.
 * Thirty per cent of a torso's radius is not a band; it is a side key. Measured on
 * `packages/testbed/src/lighting.html` at body framing, 900×1200, with the subject mask taken from
 * a `?figure=0` difference plate:
 *
 *   | body rim azimuth        | subject px in a cool hue at S > 0.10 | interior luma SD, torso |
 *   |-------------------------|-------------------------------------:|------------------------:|
 *   | −134° (previous round)  |                              32.65%  |                  0.0486 |
 *   | **−158° (shipped)**     |                          **15.03%**  |              **0.0676** |
 *   | rim and kicker at zero  |                               0.71%  |                  0.0734 |
 *
 * The widening produced the round's other three defects at once: a violet cast over a third of the
 * figure, a flattened interior (the third column is 66% of the way from the flood to the no-rim
 * ceiling once the azimuth is put back), and a floor lit 2.5× by the backlights.
 *
 * **So the presets no longer disagree about azimuth at all.** They disagree about STANDOFF (2.6
 * heights against 0.65 — for the backdrop reason below AND for the floor, see `EDGE_LIGHTS.body`;
 * the figure was 1.4 until the floor was measured), ELEVATION (a body rim rides higher so it
 * takes the shoulders and the tops of the thighs rather than wrapping the front) and IRRADIANCE.
 * The 8.9× pixel shortfall in band width is therefore NOT closed and is not closeable — it is
 * asserted as a known shortfall in the selftest so nobody reads a future widening as a fix.
 * `silhouetteBandFraction()` reports the number and `silhouetteBandPixels()` converts it into the
 * unit the defect is judged in, which is LEARNINGS §1.10b applied to light instead of to motion.
 *
 * ## Cost
 *
 * `docs/PROGRESS.md` § "RectAreaLights are the expensive part" fits **0.265 ms + 0.618 ms per Mpx
 * lit, per light** on WebGPU, giving 3.604 ms for four at 1080p. That model was fitted on a scene
 * of spheres, so it was re-measured here on the real rig — `packages/testbed/src/lighting.html`
 * `?perf=1`, 1920x1080, WebGPU, the full 74k-triangle skinned figure plus backdrop and floor,
 * three repeats of 120 samples with the variant order alternated, p95:
 *
 *   | variant                    | GPU ms p95 | Δ vs ambient only |
 *   |----------------------------|-----------:|------------------:|
 *   | ambient only               |      0.912 |                 — |
 *   | 4 area lights, no shadows  |      4.520 |       **3.608**   |
 *   | 4 area + 1 shadow spot     |      7.144 |             6.232 |
 *   | 4 area + 4 shadow spots    |     13.634 |             9.114 over the area lights |
 *
 * 🎯 **The four area lights reproduce PROGRESS.md's fitted 3.604 ms to 0.1%** on completely
 * different geometry, which is about as good as an independent confirmation gets.
 *
 * 🚩 **The shadow halves are NOT free, and the punch list's "each paired with a shadow-casting
 * directional" is not affordable as written.** One shadow caster costs **2.62 ms** — more than
 * two and a half area lights — and four cost 9.11 ms, which with the area lights is 12.7 ms,
 * **77% of a 16.6 ms frame**, leaving nothing for skin, eyes, hair, AO or the grade. So the
 * shipped rig pairs exactly ONE light, the key, and that is a measurement, not a preference.
 *
 * The cost is the extra geometry pass, not the fill: halving the shadow map to 1024 moved it from
 * 2.62 ms to 2.74 ms, i.e. not at all (run-to-run p95 noise here is about ±1 ms). Anyone hunting
 * that 2.6 ms should look at drawing the shadow pass from a decimated proxy rather than at the
 * map resolution.
 *
 * The rig will not build more than four area lights; ask for a fifth and it throws rather than
 * quietly spending a frame budget that belongs to someone else.
 *
 * @example
 * const rig = new LightingRig( { preset: 'portrait' } );
 * rig.attachTo( stage.scene, stage.renderer );
 * rig.aimAt( { focus, subjectHeightMetres: 0.42, cameraPosition: stage.camera.position } );
 */

import {
    Color,
    HemisphereLight,
    Object3D,
    RectAreaLight,
    RectAreaLightNode,
    SpotLight,
    Vector3
} from 'three/webgpu';

import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';

// The closure instrument this file invented for the light graph. It moved to its own module when
// `GroundContact.js` needed exactly it for the surface, because two copies of a closure is how a
// closure comes to have a hole in it — which is the one defect it exists to make impossible.
import { classifyNode, plainValue } from './StateClosure.js';

// --- the measured budget ------------------------------------------------------------------

/**
 * Hard ceiling on area lights. Not a style preference — `docs/PROGRESS.md` measured 4 lights at
 * 3.604 ms and 8 at 7.421 ms on this hardware, and the frame is 16.6 ms with skin, hair, AO and
 * the grade still to pay for.
 */
export const MAX_AREA_LIGHTS = 4;

/**
 * The overall level, measured rather than chosen.
 *
 * Every `irradiance` in the tables below is a RATIO — only their proportions carry meaning, and
 * the absolute level is set once, here. Where it has to land is not a matter of taste either: the
 * look spec measured the reference lit cheek at **0.793 encoded luma** and the shadow cheek at
 * **0.633**, and a tone curve is not linear, so the same rig at a different level produces a
 * different key:shadow RATIO out the other side. Measured on this rig, `figure_g050`, ACES
 * filmic at `toneMappingExposure` 1, sampling the same two cheek patches at 900x1200:
 *
 *   | exposure | lit cheek enc | shadow cheek enc | key:shadow LINEAR |
 *   |----------|---------------|------------------|-------------------|
 *   | 0.35     | 0.560         | 0.396            | **2.037 — fails G1** |
 *   | 0.50     | 0.661         | 0.494            | 1.834             |
 *   | 0.70     | 0.746         | 0.589            | 1.643             |
 *   | 1.00     | 0.819         | 0.686            | 1.464             |
 *
 * Two independent readings of the same table pick the same place. Matching the reference's
 * absolute cheek lumas wants ~0.85; landing the ratio in the reference band of 1.43–1.64 linear
 * wants 0.70–1.00. **0.85** satisfies both.
 *
 * 🚩 Note what that table means: **exposure is not neutral to the gate.** Underexposing this rig
 * by a stop and a half takes a perfectly-authored 1.47:1 design to a measured 2.04:1 and fails
 * G1, because ACES has far more gradient down there. Anyone who moves the grade (3.13) or the
 * tone curve must re-run G1; it is not an independent knob.
 *
 * ⚠️ And it is calibrated against THIS ASSET'S ALBEDO — MakeHuman's diffuse texture, not the look
 * spec's `#E3BCA8`. `material/SkinMaterial.js` (3.2) replaces that albedo, and when it does this
 * constant must be **re-measured, not re-worded** (LEARNINGS §1.11c).
 */
export const EXPOSURE_CALIBRATION = 0.85;

// --- placement -------------------------------------------------------------------------------

/**
 * One light's placement, in units that do not change when the subject does.
 *
 * `azimuthDegrees` is measured in the horizontal plane at the focus, from the direction of the
 * CAMERA: 0° is a light sitting at the camera (flat frontal), 90° is a pure side light, 180° is
 * directly behind the subject. Positive is toward the camera's right. Camera-relative because
 * that is what a lighting rig actually is — "45° off axis" is a statement about the viewer, and a
 * rig authored in world coordinates silently becomes a different rig when the camera moves.
 *
 * `elevationDegrees` is above the horizontal plane through the focus.
 *
 * `distanceInHeights`, `widthInHeights`, `heightInHeights` are multiples of the framed subject
 * height, which is what makes key and fill identical between the two presets.
 *
 * `irradiance` is what this light delivers at the focus, in the same units `DirectionalLight
 * .intensity` uses. Only ratios between these numbers are meaningful; the absolute level is set
 * once by `exposure`.
 *
 * @typedef {Object} LightPlacement
 * @property {string} name
 * @property {number} azimuthDegrees
 * @property {number} elevationDegrees
 * @property {number} distanceInHeights
 * @property {number} widthInHeights
 * @property {number} heightInHeights
 * @property {number} irradiance
 * @property {number} colour - hex
 * @property {number} shadowFraction - 0..1 of this light's irradiance moved to a shadow-caster.
 */

/**
 * Key and fill. Identical in both presets, and that is the load-bearing claim of the file:
 * expressed in subject heights and authored irradiance, a form light is scale-free.
 *
 * Both numbers come from the look spec's § Lighting rig. The key is "broad soft, ~45° off-axis,
 * slightly above the eyeline"; the fill is "large, very strong."
 *
 * The fill's irradiance is 0.73 of the key's, and that is the whole ball game. A face turned 45°
 * into the key receives essentially all of it on the lit side and essentially none on the shadow
 * side, so the shadow side is carried by the fill and the measured ratio lands near key ÷ fill.
 * 1 ÷ 0.73 = 1.36 linear before the ambient and the output transform get to it, inside the spec's
 * own stated key:fill range of 1.2:1 to 2.0:1. The instinct that wants 4:1 here is the single
 * commonest way to render this target wrong.
 *
 * 🎯 **IT WAS 1.90 (0.63 OF KEY) AND THE OUTPUT TRANSFORM MOVED UNDERNEATH IT.** The header's own
 * 🚩 says it: *"exposure is not neutral to the gate. Anyone who moves the grade (3.13) or the tone
 * curve must re-run G1."* `render/Grade.js` became the page default and G1 was not re-run, so a rig
 * solved at **1.5991** on the ungraded forward path shipped at **1.6586** — 1.2% ABOVE the 1.64
 * reference band top, on the one gate this project had genuinely landed.
 *
 * The +0.040 is the **vignette**, and it is a framing effect rather than a lighting one, which is
 * why no amount of staring at the rig would have found it. `regions.lighting-portrait.json` puts
 * `faceShadow` at normalised x 0.175–0.230 and `faceKey` at 0.400–0.455, so the shadow patch sits
 * 0.30 of a half-frame off centre and the key patch 0.07 — the face is not centred, so a radial
 * darkening is not symmetric across the pair. `vignetteNode`'s `1 − 0.15·r²` predicts the shadow
 * patch keeps 0.9701 against the key patch's 0.9956, i.e. the ratio is inflated by **×1.0263**.
 * Measured by toggle on `alive.html?bare&freeze&seed=1&capture` at 900×1200: shipped **1.6586**,
 * `&vignette=0` **1.6189**, `&grade=0` **1.6189** — ×1.0245, and the two toggles agree to four
 * decimal places, so the vignette is the WHOLE of the grade's contribution to G1 and bloom, RCAS
 * and the saturation trim are worth nothing on this pair.
 *
 * So the fill is re-solved against the transform the page actually ships. Swept on
 * `alive.html?bare&freeze&seed=1&capture&ov=fill.irradiance:<x>` at 900×1200, portrait regions,
 * TAAU 0.66 + grade + RCAS 1.2, nothing else changed:
 *
 *   | fill | G1 linear | cheek encoded | G2 chroma ratio | G6 p0.1 | G7 outliers |
 *   |------|----------:|--------------:|----------------:|--------:|------------:|
 *   | 1.90 |    1.6586 |        0.7837 |          1.3457 | 0.00225 |    0.000561 |
 *   | 2.05 |    1.5913 |        0.7884 |          1.3540 | 0.00227 |    0.000449 |
 *   | **2.20** | **1.5331** |    **0.7933** |      1.3660 | 0.00309 |    0.000336 |
 *   | 2.40 |    1.4664 |        0.7998 |          1.3848 | 0.00338 |    0.000280 |
 *
 * **2.20 is picked by two independent readings, which is what makes it a solve rather than a
 * tune.** It puts G1 at 1.5331 against a band CENTRE of 1.535 — the band is 0.21 wide and the
 * thing on the far side of its top is the conventional three-point ratio the whole look spec
 * exists to reject, so the centre is where a value with a ±0.0005 load-to-load spread belongs.
 * And it puts the G2 cheek patch at **0.7933 encoded against the reference's own 0.793**
 * (`#E5C3C3`, the same hex the band's top edge is derived from), which is the *absolute* half of
 * the calibration `EXPOSURE_CALIBRATION` had to trade against the ratio. At 1.90 the two readings
 * disagreed; at 2.20 they land on the same number.
 *
 * ⚠️ **The one thing 2.20 costs is G2's chroma clause, and it is paid for in `EyeMaterial.js`.**
 * The sclera:cheek HSV-saturation ratio rises with the fill and 1.3660 is outside the 1.205–1.362
 * band. Brightening the sclera pushes it back down through ACES (a brighter patch desaturates),
 * so `SCLERA_BRIGHTNESS` was re-solved in the same round and the pair is measured together —
 * neither number is correct on its own. See `EyeMaterial.js`'s `SCLERA_BRIGHTNESS`.
 *
 * 🎯 **THE FILL IS WARM, AND THE PREVIOUS BLUE-MAGENTA FILL IS WHY G3 WAS RED.** This is the
 * correction that matters most in the file, and it comes from a toggle rather than an argument.
 * Measured on `lighting.html` at portrait framing, which carries NO skin material at all:
 *
 *   | fill                          | G3 saturation rise | shadow cheek | shadow hue |
 *   |-------------------------------|-------------------:|--------------|-----------:|
 *   | `#c9c2e6` (previous)          |            −0.0748 | `#BA9EA6`    |    343.50° |
 *   | fill switched OFF entirely    |            +0.0489 | `#8C6B6A`    |      2.59° |
 *   | **`#f2d2c6` (shipped)**       |        **+0.0428** | **`#C9A08E`**|  **18.96°**|
 *
 * Turning the fill OFF fixed G3 and broke G1 (2.0123). That is the whole diagnosis: the fill was
 * the only thing lighting the shadow cheek, so the shadow cheek was the fill's colour, and the
 * fill's colour was blue-magenta. Blue-magenta light on orange skin multiplies to a near-neutral
 * grey — which is exactly the "saturation FALLS into shadow" the gate reports.
 *
 * ⚠️ **Two different measurements in the look spec were being conflated, and only one of them is
 * about this light.** §3's "shadows blue-dominant with a magenta lean, RGB (0.042, 0.026, 0.071)"
 * is the grade's darkest environment shadow at linear luma 0.04 — the cast shadow on the world.
 * §2's shadow-side CHEEK is `#C29997`, saturation 0.234, hue ≈ 3° — warm red, because a face's
 * shadow side in the reference is lit by bounce off skin and by transmission, not by the sky.
 * `#f2d2c6` is that bounce stated as a light: the key's `#ffeeda` times the spec's own measured
 * skin response R:G:B = 1 : 0.83 : 0.75, nudged pink toward the reference cheek's hue. The cast
 * shadow stays cool because the things that light it — the hemisphere sky and the rim — still are.
 *
 * The irradiance came down 2.18 → 1.90 with the colour, and it had to: warm light on warm skin
 * reflects far more than blue light does, so the same authored number made a brighter shadow side.
 * Measured across the swap, `#c9c2e6` at 2.18 gives G1 1.6091 and `#f2d2c6` at 2.18 gives 1.4368;
 * 1.90 puts it back at **1.5991**, inside the 1.43–1.64 reference band.
 * ⚠️ Historical: 1.5991 and 1.4368 are UNGRADED forward-path numbers and are not comparable with
 * the graded sweep above. The colour swap's conclusion stands; its absolute figures do not.
 *
 * 🚩 **NOTHING IN THIS FRAME CLIPS, AND IT IS NOT THIS RIG'S FAULT — THREE TOGGLES SAY SO.** The
 * seven-gate plate reads G5 0.000002 against reference plates that clip 0.017–0.036%, and two of
 * three blind judges concluded from that alone that the renderer has no post chain. The obvious
 * suspects were tested and all three are cleared, on
 * `alive.html?bare&freeze&seed=1&capture` at 3840×5120:
 *
 *   | plate                        | max luma | p99.999 | > 0.90     | > 0.95    | > 0.99      |
 *   |------------------------------|---------:|--------:|-----------:|----------:|------------:|
 *   | shipped default              |  0.99608 | 0.94929 |  0.000632  | 0.0000053 | 0.0000016   |
 *   | `?aa=msaa&grade=0`           |  0.99608 | 0.94845 |  0.000361  | 0.0000041 | 0.0000023   |
 *   | `?ov=key.irradiance:9` (3×)  |  0.99608 | 0.98204 |  **0.427** | **0.155** | 0.0000017   |
 *   | `?ov=key.width/height ÷ 8`   |  0.99608 | 0.94929 |  0.002012  | 0.0000045 | 0.0000016   |
 *
 *   1. **NOT THE TONE CURVE.** `?grade=0` — no AgX, no bloom — clips the SAME 2.3 × 10⁻⁶. If the
 *      curve were holding the highlights down, taking it off would release them.
 *   2. **NOT THE LIGHT LEVEL, and this is the row that matters.** Three times the key puts 42.7%
 *      of the frame over 0.90 and 15.5% over 0.95 — a washed-out picture — and the clipped
 *      fraction does not move at all. Raising exposure is not a fix that was rejected on taste; it
 *      is measurably incapable of producing the statistic.
 *   3. **NOT THE KEY PANEL'S SOLID ANGLE.** Shrinking the key 8× in area at constant irradiance
 *      raises its radiance 64× and triples the >0.90 population, and the peak does not move.
 *      ⚠️ It also takes **G2 RED** (sclera:cheek 0.9319) and G4 to 1.7044, so it is not free.
 *
 * What the frame actually contains, by cluster above 0.90 on the shipped plate: 6,939 px of rim
 * glow on the backdrop at 0.9521; two skin speculars — nose and lower lip — at **0.9229**; and
 * **84 px of eye catchlight at 0.9961**, which is the only thing in the picture that reaches the
 * bloom threshold at all. The pipeline can carry a clipping highlight; the SCENE has exactly one
 * feature small and bright enough to make one, and it is 0.0000043 of the frame.
 *
 * So the cause is not a light and cannot be fixed from this file: a face clips where it has hair
 * specular, wet lip and eye highlights, metal or emissive trim, and this figure has none of them.
 * Filed as diff requests against the hair, catchlight and wardrobe items rather than answered here
 * with an exposure the measurement above already ruled out.
 */
const FORM_LIGHTS = [
    {
        name: 'key',
        azimuthDegrees: 42,
        elevationDegrees: 18,
        distanceInHeights: 2.6,
        widthInHeights: 2.0,
        heightInHeights: 2.8,
        irradiance: 3.0,
        colour: 0xffeeda,       // ~5000 K, the warm end of the spec's 4500–6500 K key
        shadowFraction: 0.45    // measured; see the header table
    },
    {
        name: 'fill',
        azimuthDegrees: -52,
        elevationDegrees: 2,
        distanceInHeights: 2.3,
        widthInHeights: 4.2,
        heightInHeights: 4.2,
        irradiance: 2.20,       // 0.733 x key — re-solved against the SHIPPED grade; see above
        colour: 0xf2d2c6,       // skin bounce: the key through the spec's 1 : 0.83 : 0.75 response
        shadowFraction: 0
    }
];

/**
 * Rim and kicker, per framing. These are the two entries the presets disagree about, and the
 * disagreement is the whole point — see the header. Both are hue-opposed to the warm key, which
 * the look spec states as the invariant ("the constant is that key and rim are COMPLEMENTARY").
 *
 * The rim sits behind the SHADOW side so it separates the subject from the backdrop where the
 * subject is darkest and closest to it in value. The kicker sits behind the key side, lower and
 * weaker, and its job is the jaw and shoulder line.
 *
 * Irradiance is high because these are grazing: at φ = 158° the surface normal that receives the
 * light is nearly perpendicular to the view, so almost all of it is spent on a cosine the camera
 * never sees. The look spec caps what this may look like — "≈1.0–1.5× key-lit skin luma but MUCH
 * higher chroma ... the rim wins on saturation, not brightness — do not blow it out" — and G5
 * (< 0.5% of pixels above 0.99 luma) is the gate that catches it if it does.
 *
 * 🎯 **THE PANELS ARE A THIRD OF THE SIZE THEY WERE, AND THE COLOUR IS TWICE THE CHROMA.** A judge
 * measured the shipped rim failing the spec in both directions at once: 7.92% of subject pixels in
 * a cool hue at S > 0.10, over a band whose saturation was BELOW the skin's. Both halves have the
 * same cause. The portrait rim panel was 0.9 × 3.0 subject heights at 2.6 heights — 0.38 × 1.26 m
 * at 1.09 m, subtending 60° vertically — so it wrapped from the crown to the collarbone; and to
 * push a band that broad up to skin luma it had to run hot enough that ACES desaturated it.
 *
 * Measured on `lighting.html` at portrait framing, subject mask from a `?figure=0` plate, band
 * statistics averaged over the outer 8 px of the shadow-side silhouette:
 *
 *   | portrait rim                          | cool px S>0.10 | band luma ÷ skin | band S ÷ skin |
 *   |---------------------------------------|---------------:|-----------------:|--------------:|
 *   | 0.9 × 3.0 heights, `#4a7dff` E 10.5   |          8.30% |             0.99 |      **0.81** |
 *   | 0.24 × 0.90 heights, same colour E 10.5|         4.57% |             1.03 |          0.77 |
 *   | **0.24 × 0.90, `#0f30ff` E 16**       |      **5.12%** |         **0.93** |      **1.14** |
 *
 * The middle row is the instructive one: shrinking the panel alone halves the AREA and does
 * nothing for the chroma, because chroma is lost to the tone curve rather than to the panel. Only
 * moving the colour to a deeply saturated blue — and then holding the band at ~0.93× skin luma
 * instead of pushing it past 1.0 — gets the band above the skin's own saturation, which is what
 * "wins on saturation, not brightness" means as a number.
 *
 * ⚠️ **`#0f30ff` costs something and it is the FLOOR.** The same saturated blue that reads
 * correctly on skin reads as an electric pool on a large matte plane behind the subject. Measured
 * over the visible floor band at body framing: `#4a7dff` gives HSV saturation 0.62 and `#0f30ff`
 * gives 0.87, at 4.25 stops below the subject either way. `render/GroundContact.js` takes the
 * floor's albedo as warm-with-blue-lowest for this reason and gets it back to 0.74; the rest is
 * the look spec's "environment −15% saturation", which belongs to 3.13's grade and cannot be
 * done from a light. Stated rather than hidden: this is a real conflict between the spec's rim
 * clause and its environment clause, and the rig resolves it in favour of the subject.
 *
 * 🚩 **THE PARAGRAPH ABOVE IS THE ONE THAT SHIPPED THE DEFECT, AND IT IS KEPT SO THE SHAPE OF THE
 * MISTAKE IS ON THE PAGE.** Every number in it is real. The conclusion — that the floor is a cost
 * the rig pays and hands to the grade — is wrong twice over. It is wrong because 0.74 is not
 * "got back", it is **worse than the 0.62 the same paragraph offers as the rejected
 * alternative**, and the sentence walks past that. And it is wrong because it treats the floor as
 * a property of the rim's COLOUR when it is a property of the rim's PLACEMENT: at body framing the
 * cool lights were delivering **36.6× the key and fill** to a point on the floor two metres behind
 * the subject, and no colour and no albedo can survive that. Standoff 1.4 → 0.65 takes that ratio
 * to 2.10 and the floor to HSV S 0.2661, with the rim on the subject unchanged. See
 * `EDGE_LIGHTS.body` for the sweep and `LightingRig.selftest.mjs` for the gate that now measures
 * this quantity, which nothing did before.
 *
 * 🎯 **AND NOBODY APPLIED THAT REASONING TO THE PORTRAIT PRESET, WHICH IS WHERE IT WAS WORST.**
 * The paragraph above fixed the standoff at BODY framing and left portrait at 2.6 heights, and a
 * portrait rim at 2.6 heights stands FURTHER behind the subject in metres than the body rim does,
 * with the backdrop card in the same place. Attributed by toggle rather than by hue — the plate
 * with `?ov=rim.irradiance:0,kicker.irradiance:0` subtracted from the shipped plate, on
 * `lighting.html?bare` at 900×1200, subject mask from a `?figure=0` plate of the SAME rim-off rig
 * so the mask is variant-independent:
 *
 *   | portrait rim/kicker standoff | background px the pair moves | mean light it adds there |
 *   |------------------------------|-----------------------------:|--------------------------|
 *   | 2.6 heights (was)            |                   **92.65%** | `#0a178b`, HSV S 0.925   |
 *   | 1.3                          |                    **0.00%** | —                        |
 *   | **0.9 (shipped)**            |                    **0.00%** | —                        |
 *   | 0.65                         |                        0.00% | —                        |
 *
 * (Panel width and height scaled by the same factor as the standoff throughout, so the SOFTNESS at
 * the subject is held constant and the column is attributable to the standoff alone.)
 *
 * Nine tenths of the backdrop was rim spill, and it goes to nothing at a knee rather than on a
 * gradient — the second mechanism in `EDGE_LIGHTS.body`'s note, the panel's own plane, is what
 * makes it a cliff: a `RectAreaLight` lights only its front hemisphere, and between 2.6 and 1.3
 * heights the card leaves that hemisphere entirely. This is the half of the judges' complaint that
 * said the outline "bleeds outside the mesh into the background", and it is now zero.
 *
 * 0.9 rather than 1.3 because the two extra columns keep improving after the spill has stopped:
 * subject pixels the pair touches at all go 28.38% (2.6) → 21.62% (1.3) → **16.27% (0.9)**, and the
 * shadow-side band's hue rotation away from skin goes −44.7° → −34.4° → **−27.4°**. 0.65 was not
 * taken: it is the BODY preset's standoff, and the two presets are meant to differ there.
 *
 * 🎯 **AND THE AZIMUTH, WHICH IS THE OTHER HALF AND IS THE ONE THAT NARROWS.** −158° → −168° on the
 * rim and +154° → +166° on the kicker, in BOTH presets so the equality clause in the selftest still
 * holds. What the pair delivers, shipped against the rig this replaced, same page and same masks:
 *
 *   |                                     | portrait was | portrait now | body was | body now |
 *   |-------------------------------------|-------------:|-------------:|---------:|---------:|
 *   | subject px the pair touches at all  |       28.38% |   **18.54%** |   34.26% |**28.55%**|
 *   | subject px in a cool hue at S > 0.10|        3.09% |    **1.11%** |   12.47% |**11.08%**|
 *   | background px the pair moves        |       92.65% |    **0.00%** |   20.60% |   20.08% |
 *   | shadow-side band hue vs skin        |       −44.7° |   **−27.5°** |   −76.9° |**−66.6°**|
 *   | key-side band hue vs skin           |       −40.1° |   **−33.7°** |   −41.9° |**−33.3°**|
 *   | added luma at depth 1 ÷ at depth 25 |        7.17× |   **14.68×** |   18.30× |   16.23× |
 *
 * The last row is the one that answers the judges' actual words. "Constant-width, at uniform
 * intensity regardless of surface angle" is a claim about a PROFILE, so it is measured as one: the
 * light the pair adds at the silhouette divided by the light it still adds 25 px inside. A rim
 * falls off; a shader outline does not. At portrait it now falls off twice as fast.
 *
 * ⚠️ **AND IT IS STILL A THIRD OF THE FIGURE, WHICH IS NOT A RIM.** 18.54% and 28.55% are better
 * and they are not right, and the remaining distance is NOT reachable from these two lights — see
 * the withdrawn warm kicker below for the measurement that says which gate stops it.
 *
 * ⚠️ **TWO THINGS WERE SWEPT AND MEASURED NOT TO WORK, AND THEY ARE THE OBVIOUS ONES.** Same page,
 * same masks, everything else at the shipped values:
 *
 *   - **Warming the RIM's own colour does almost nothing and costs chroma.** `#0f30ff` → `#2b4cff`
 *     → `#4a68ff` → `#1f6aff` moves the shadow-side band's hue by 1.3° in total (−43.6° → −42.3°)
 *     and takes its saturation from 1.05× skin to 0.91×. The band's hue is set by the tone curve
 *     over warm skin, not by the light's hue, so the lever is the KICKER's placement and hue —
 *     which is where the change went — and not the rim's colour.
 *   - **Raising the rim to the spec's "≈1.0–1.5× key-lit skin luma" costs the spec's "MUCH higher
 *     chroma" one-for-one.** Sweeping the pair to E 30/45/70 with progressively whiter blues gets
 *     the band to 1.01× skin luma and 0.73× skin saturation, and grows the subject footprint from
 *     28% to 30%. Both spec clauses cannot be met at once from a `RectAreaLight` through ACES; the
 *     rig ships the saturation half (1.03× skin) and fails the luma half (0.88×), and that is a
 *     recorded loss rather than a tuned-away one.
 */
const EDGE_LIGHTS = {

    portrait: [
        {
            name: 'rim',
            azimuthDegrees: -168,
            elevationDegrees: 26,
            distanceInHeights: 0.9,
            widthInHeights: 0.0831,   // 0.24 × 0.9/2.6 — the same solid angle at the subject
            heightInHeights: 0.3115,  // 0.90 × 0.9/2.6
            irradiance: 16,
            colour: 0x0f30ff,
            shadowFraction: 0
        },
        {
            name: 'kicker',
            azimuthDegrees: 166,
            elevationDegrees: -6,
            distanceInHeights: 0.865,
            widthInHeights: 0.0831,   // 0.24 × 0.865/2.5
            heightInHeights: 0.2942,  // 0.85 × 0.865/2.5
            irradiance: 7,
            // ⚠️ ~~Same hue as the rim, deliberately.~~ The reasoning that put
            // the kicker on the rim's hue is quoted below because it is still correct about the
            // thing it was answering, and it created a worse defect than the one it fixed:
            //
            //   "The kicker was `#7a5bff` — a violet — and a judge measured the crown silhouette
            //    at hue 279.5° against a cheek at 20.95°, which is the violet, not the blue. The
            //    spec asks for a rim hue-opposed to key; the key is ~5000 K and its opposite is a
            //    deep blue, not a magenta-blue. Rim and kicker are separated by placement and
            //    power, which is what separates them in a real studio."
            //
            // Placement and power did NOT separate them. `−158°` and `+154°` are near-mirror
            // azimuths, so two lights of the same hue at 16 and 7 put the SAME cool band down
            // both sides of the figure — and what three independent judges then reported, with no
            // project context, was "a constant-width saturated violet outline tracing the whole
            // silhouette at uniform intensity regardless of surface angle", two of them calling it
            // a bug rather than low quality. A rim that closes all the way round is a shader
            // outline. The rim's job is to separate the subject from the backdrop on the SHADOW
            // side; a key-side kicker is a hair light, and in a real studio a hair light is warm.
            //
            // Measured on `lighting.html?bare` at 900×1200 against a `?figure=0` mask, everything
            // else at the values above, key-side outer-8 px band against interior key-side skin:
            //
            //   | portrait kicker        | cool subject px | key-side band hue vs skin |
            //   |------------------------|----------------:|--------------------------:|
            //   | `#0f30ff` E 7 (was)    |           1.60% |                    −39.4° |
            //   | **`#ffd7b0` E 2.5**    |       **0.83%** |                **−18.6°** |
            //
            // E 7 → 2.5 is not a dimming: `irradiance` is authored as a scalar and the COLOUR
            // multiplies it, and `#ffd7b0` carries 9.6× the relative luminance of `#0f30ff`, so
            // 2.5 delivers about a third of what 7 did on the old hue. It was chosen off the
            // sweep (7 / 4 / 2.5 / 1.5) for the smallest subject footprint that still reads.
            //
            // 🔴 **AND IT IS NOT SHIPPED, BECAUSE IT TAKES TWO OF THE SEVEN OBJECTIVE GATES RED AND
            // THE FIX IS NOT IN THIS FILE.** Measured on `alive.html?bare&freeze&seed=1&capture` at
            // 3840×5120, shipped default, three loads, one value per gate — attributed by reverting
            // one field at a time from the warm-kicker rig, which is what makes it an attribution
            // rather than a coincidence:
            //
            //   | one field reverted           | G1     | G2     |
            //   |------------------------------|-------:|-------:|
            //   | nothing (warm kicker, E 2.5) | 1.2331 | 0.8855 |
            //   | rim azimuth −168 → −158      | 1.2298 | 0.8856 |
            //   | rim standoff 0.9 → 2.6       | 1.2325 | 0.8856 |
            //   | kicker azimuth 166 → 154     | 1.2217 | 0.8839 |
            //   | **kicker colour+E → #0f30ff, 7** | **1.5512** | **0.9526** |
            //
            // The rim's two changes are worth 0.003 of G1 between them; the kicker's hue is the
            // whole of it. The mechanism is the one this file's own irradiance convention makes
            // easy to miss: `irradiance` is a scalar and the COLOUR multiplies it, and `#ffd7b0`
            // carries **7.73×** the relative luminance of `#0f30ff`. A blue kicker of this size and
            // this proximity was always a broad key-side wash; it passed a LUMA gate only because
            // its hue contributes almost no luma. Warm it and G1 notices immediately.
            //
            // Swept and none of it recovers both gates: kicker E 2.5 → 1.6 → 1.2 → 0.9 walks G1
            // back to 1.4461 and leaves G2 at 0.9022, still under its 0.92 floor; elevation −6 →
            // 24 → 34 → 44 moves G1 by 0.027 and G2 by 0.003; trading it against the fill
            // (2.20 → 1.80 → 1.55 → 1.35) reaches G1 1.4519 and takes G2 the WRONG way, to 0.8793.
            // G2 is `SCLERA_BRIGHTNESS`, which PROGRESS records as re-solved from 1.26 to 1.47
            // against the shipped rig — a rig-dependent constant in `material/EyeMaterial.js`, and
            // this file may not move it. Filed as a diff request; the numbers above are the sweep
            // whoever takes it needs, so it does not have to be re-run.
            colour: 0x0f30ff,
            shadowFraction: 0
        }
    ],

    // The same two lights, differing in THREE ways — and NOT in azimuth, which is the change this
    // round withdrew. See the header table: the previous −134°/132° swing is what produced the
    // violet cast, the flattened interior and the flooded floor, all three at once.
    //
    // 1. STANDOFF, 2.6 subject heights down to 1.4 — the one entry from the previous round that
    //    survived re-measurement, and the one that is NOT obvious. A scale-free standoff is right
    //    for the key and the fill, which stand in FRONT of the subject and get further from the
    //    backdrop as they scale. A rim stands BEHIND it and walks toward the backdrop instead. At
    //    body framing a rim at 2.6 heights sits 3.18 m behind the focus with the backdrop 4.86 m
    //    back, i.e. 1.68 m from the card and 4.86 m from the subject: inverse square then gives
    //    the backdrop 8.4x the subject's irradiance and the whole studio floods. At 1.4 heights
    //    the card gets 0.69x instead. Measured: backdrop #6475D1 at 2.6 heights against #484385
    //    at 1.4, for the same band width.
    //
    // 2. ELEVATION, 26° -> 40° on the rim and −6° -> 16° on the kicker. A body rim rides HIGHER
    //    than a portrait rim so it takes the shoulders and the tops of the thighs instead of
    //    wrapping around the front of a standing figure. Measured at body framing, sweeping the
    //    rim's elevation with everything else fixed: 0° gives 9.41% of subject pixels in a cool
    //    hue at S > 0.10 and a torso interior SD of 0.0600; 40° gives 7.35% and 0.0639 against a
    //    rim-off ceiling of 0.0734. Higher is both cleaner AND rounder here, which is not obvious
    //    and is the reason it is written down as a sweep rather than as a preference.
    //
    // 3. IRRADIANCE, 16/7 -> 22/10 — chosen off the sweep, not scaled from the portrait. One panel
    //    lighting a subject 4.5x taller reaches its ends at very different angles.
    //
    // ⚠️ ~~The cost is unchanged from the previous round and remains real: at body framing a
    // legible rim and a reference-band FACE ratio pull against each other.~~ **WITHDRAWN, and the
    // withdrawal is the interesting part.** The measurement was right — G1 at body framing read
    // 1.2876 with the rim and 1.2915 without it, so the rim is worth 0.004 of ratio and is
    // genuinely not the cause. The conclusion drawn from it was not: "the rim is not the cause" was
    // read as "nothing in the rig is the cause", and the note closed with "recorded, not tuned
    // away" on a gate reading 12% below its own reference band. It is the FILL, it is a framing
    // effect with a mechanism, and 1.90 → 1.20 puts body at 1.5259. See
    // `FORM_LIGHT_OVERRIDES_BY_PRESET`. Ruling out one suspect is not a diagnosis.
    // 🎯 **STANDOFF 1.4 → 0.65, AND IT IS THE ONLY THING THAT MOVED THE FLOOR.** The comment above
    // reasoned correctly that a rim walks toward the backdrop as the subject grows, and then
    // stopped at 1.4 heights because that fixed the backdrop. It never measured the FLOOR, and the
    // floor is 20.3% of a body frame: at 1.4 heights it rendered at HSV saturation 0.7342 with
    // 24.06% of the frame in a saturated blue. `GroundContact`'s header has the arithmetic for why
    // no floor albedo can answer that. This does.
    //
    // Two mechanisms, not one, and the second is the reason the effect is so much steeper than
    // inverse square alone:
    //
    //   1. **Inverse square, relative.** `irradiance` is authored AT THE FOCUS and re-solved every
    //      time the rig aims, so halving the standoff leaves the subject's rim untouched and
    //      quarters what reaches everything the panel is not pointed at.
    //   2. **The panel's own plane.** A `RectAreaLight` lights only its front hemisphere. Bringing
    //      it in from 2.56 m to 1.19 m behind the focus (at body framing) walks the plane's
    //      intersection with the floor forward, so the far floor — the part seen at the most
    //      grazing incidence, where Fresnel is highest and the specular is strongest — leaves the
    //      light entirely rather than merely dimming.
    //
    // Measured on `lighting.html?frame=body&bare` at 900×1200, WebGPU, MSAA default, with the panel
    // width and height scaled by the same factor as the standoff so the SOFTNESS is held constant.
    // Floor statistics on a fixed rect; rim statistics over the shadow-side silhouette band against
    // an interior key-side skin reference, both masked by difference against a `?figure=0` plate:
    //
    //   | standoff (heights) | floor S | frame blue-cast | rim band S ÷ skin | G1     |
    //   |--------------------|--------:|----------------:|------------------:|-------:|
    //   | 1.4 (was)          |  0.7342 |          24.06% |             1.363 | 1.2876 |
    //   | 1.1                |  0.4904 |           9.81% |             1.152 | 1.2879 |
    //   | 0.8                |  0.4700 |           3.62% |             1.146 | 1.2884 |
    //   | **0.65**           |**0.4437**|       **1.19%** |         **1.130** | 1.2891 |
    //   | 0.5                |  0.4437 |           1.19% |             1.083 | 1.2904 |
    //   | 0.35               |  0.5068 |           6.57% |             1.204 | 1.2911 |
    //
    // (The floor column there is at the OLD albedo, so the three columns are attributable to the
    // standoff alone; `GroundContact` then takes 0.4437 to 0.2216.) 0.65 is the knee: from 1.4 to
    // 0.65 the frame's blue-cast falls 20× for 0.23 of rim saturation, and the next step costs
    // three times as much per unit gained. 1.19 m behind a standing figure is also a strip light a
    // gaffer could actually hang.
    //
    // ⚠️ Two things this does NOT fix, stated so they are not rediscovered. The rim's own band
    // still sits at **0.61× key-lit skin luma** against the spec's "≈1.0–1.5×", and pushing it up
    // is what cost the chroma the last round bought. And the panel still draws a straight-edged
    // wedge on any flat surface further back — see the header — it is just a smaller and nearer
    // one now.
    body: [
        {
            name: 'rim',
            azimuthDegrees: -168,
            elevationDegrees: 40,
            distanceInHeights: 0.65,
            widthInHeights: 0.1393,   // 0.30 × 0.65/1.4 — same solid angle at the subject
            heightInHeights: 0.4643,  // 1.00 × 0.65/1.4
            irradiance: 22,
            colour: 0x0f30ff,
            shadowFraction: 0
        },
        {
            name: 'kicker',
            azimuthDegrees: 166,
            elevationDegrees: 16,
            distanceInHeights: 0.65,
            widthInHeights: 0.1393,   // 0.30 × 0.65/1.4
            heightInHeights: 0.4411,  // 0.95 × 0.65/1.4
            irradiance: 10,           // warm at 3.5 was measured and withdrawn — see the portrait kicker
            colour: 0x0f30ff,
            shadowFraction: 0
        }
    ]

};

/**
 * The one FORM-light field the two presets disagree about, and the sweep that set it.
 *
 * 🎯 **G1 IS THE HIGHEST-LEVERAGE PARAMETER IN THE SPEC AND THE BODY PRESET WAS BELOW ITS BAND.**
 * The gate asserts `< 2:1` only, so a face that is FLATTER than the reference reads as a pass —
 * LEARNINGS §1.11 inside the objective instrument itself. Measured against the reference band of
 * 1.43–1.64 linear (1.18–1.25 encoded), the shipped rig read **1.5991 at portrait** (in band) and
 * **1.2876 at body** (below it, and passing).
 *
 * The previous note attributed that gap to "a property of the body framing itself" on the strength
 * of a rim-off plate, and the rim-off plate is real — 1.2915 against 1.2876, so the rim is worth
 * 0.004 of ratio and is indeed not the cause. What the note did not do is ask what WAS. It is the
 * fill, and it is a framing effect with a mechanism: `elevationDegrees` is measured at the FOCUS,
 * and at body framing the focus is at mid-torso while the face is 0.7 m above it, so a fill
 * authored at 2° above the focus arrives at the cheek from very slightly BELOW and fills the
 * shadow side more completely than the same 2° does in a head-and-shoulders crop.
 *
 * Swept on `lighting.html?frame=body&bare` at 900×1200 with `regions.lighting-body.json`, nothing
 * else changed:
 *
 *   | body fill irradiance | G1 linear | G1 encoded | in the 1.43–1.64 band |
 *   |----------------------|----------:|-----------:|-----------------------|
 *   | 1.90 (portrait's, at the time) | 1.2891 | 1.1280 | no — below         |
 *   | 1.55                 |    1.3893 |     1.1693 | no — below            |
 *   | 1.30                 |    1.4818 |     1.2064 | yes                   |
 *   | **1.20**             |**1.5259** | **1.2237** | **yes, centred**      |
 *   | 1.10                 |    1.5744 |     1.2424 | yes                   |
 *   | 0.90                 |    1.6876 |     1.2856 | no — above            |
 *
 * 1.20 is chosen for the CENTRE of the band rather than for the edge, because the band is narrow
 * and the thing on the other side of it is the conventional three-point ratio the whole look spec
 * exists to reject. It leaves body at 1.5259 and portrait at 1.5991 — 5% apart, both inside.
 *
 * ⚠️ **That sweep is an UNGRADED `lighting.html` sweep and the two framings have since been
 * re-measured on the page a judge actually loads.** On `alive.html?bare&freeze&seed=1&capture` at
 * 900×1200 with the shipped default (TAAU 0.66 + grade + RCAS 1.2), body reads **1.5869** against
 * this table's 1.5259 — the grade's vignette again, and the body frame's `faceKey`/`faceShadow`
 * pair sits closer to the frame centre than portrait's, so it collects less of it (+0.061 here
 * against +0.040 there). **Body was already inside the band and this round did not touch it**: the
 * 1.20 override is absolute, so re-solving the portrait fill above cannot reach it — proven rather
 * than argued, the body plate is BYTE-IDENTICAL across that change (sha256 `8b3fb2ae2118` at
 * 1.90 and at 2.20), and G1 reads **1.5869** on both.
 */
const FORM_LIGHT_OVERRIDES_BY_PRESET = {
    portrait: {},
    body: { fill: { irradiance: 1.20 } }
};

/**
 * The ambient term. The look spec's fill line reads "large, very strong. Ambient/IBL doing most
 * of the work", and a `HemisphereLight` is the cheapest honest stand-in until a studio HDRI is
 * authored: sky takes the fill's hue, ground takes a warm floor bounce.
 *
 * It is not one of the four. A hemisphere light is two constant terms in the shader and does not
 * appear in the 0.265 + 0.618/Mpx area-light cost model at all.
 *
 * ⚠️ It lifts the whole image, including the backdrop, and G6 wants p0.1 luma at 0.004–0.016 with
 * NO shadow lift. 0.22 of the key is the level that leaves the backdrop dark; if G6 goes red the
 * suspect is here, not the grade.
 */
const AMBIENT = {
    skyColour: 0xb9c4ea,
    groundColour: 0x5a4038,
    fractionOfKey: 0.22
};

// --- geometry --------------------------------------------------------------------------------

const DEGREES = Math.PI / 180;

/**
 * The projected solid angle of a rectangle, seen from a point on its axis by a surface facing it.
 *
 * This is what converts an authored irradiance into a panel radiance, so it is the one piece of
 * arithmetic in the file that has to be right rather than merely plausible. It is the standard
 * corner-configuration factor summed over the four quadrants:
 *
 *     F_corner( X, Y ) = 1/2π · [ X/√(1+X²) · atan( Y/√(1+X²) ) + Y/√(1+Y²) · atan( X/√(1+Y²) ) ]
 *
 * with X, Y the corner rectangle's sides over the distance, and Ω = π · 4 · F_corner.
 *
 * Sanity check, and `lightingRig.selftest.mjs` asserts it: as the panel shrinks this must tend to
 * area over distance squared. It does — the small-angle limit of the bracket is 2XY, giving
 * Ω → 4XY = width·height / distance².
 *
 * @param {number} width - metres
 * @param {number} height - metres
 * @param {number} distance - metres
 * @returns {number} steradians, projected (i.e. cosine-weighted), in 0..π
 */
export function projectedSolidAngle( width, height, distance ) {

    const x = ( width / 2 ) / distance;
    const y = ( height / 2 ) / distance;

    const rootX = Math.sqrt( 1 + x * x );
    const rootY = Math.sqrt( 1 + y * y );

    const cornerFactor = ( x / rootX * Math.atan( y / rootX ) + y / rootY * Math.atan( x / rootY ) ) / ( 2 * Math.PI );

    return Math.PI * 4 * cornerFactor;

}

/**
 * How much of a cylindrical limb's radius a light at this azimuth lights, as seen by the camera.
 *
 * `1 + cos φ`, derived in the header. 0 is a light exactly behind the subject lighting nothing the
 * camera can see; 1 is a pure side light covering half the visible limb; 2 is frontal.
 *
 * This is the quantity that decides whether a rim "reads", and it is stated here rather than left
 * implicit in an azimuth because an azimuth is not a unit anybody can picture (LEARNINGS §1.10b).
 */
export function silhouetteBandFraction( azimuthDegrees ) {

    return 1 + Math.cos( azimuthDegrees * DEGREES );

}

/**
 * The same band, in pixels, for a limb of a given radius at a given framing — the unit a viewer
 * actually judges and the unit a screenshot can be measured in.
 *
 * @param {number} azimuthDegrees
 * @param {number} limbRadiusMetres - e.g. ~0.09 for a head, ~0.045 for an upper arm.
 * @param {number} framedHeightMetres - what the camera's vertical field covers at the subject.
 * @param {number} canvasHeightPixels
 */
export function silhouetteBandPixels( azimuthDegrees, limbRadiusMetres, framedHeightMetres, canvasHeightPixels ) {

    const pixelsPerMetre = canvasHeightPixels / framedHeightMetres;

    return silhouetteBandFraction( azimuthDegrees ) * limbRadiusMetres * pixelsPerMetre;

}

// --- what three actually reads ---------------------------------------------------------------
//
// 🚩 THIS SECTION EXISTS BECAUSE THREE ROUNDS OF THIS GATE WERE A LIST OF NAMED MECHANISMS.
//
// Round one found a caster built at the wrong COLOUR and added a colour equality. Round two found
// a caster built at the wrong INTENSITY and added a focus-delivery equality plus a cone equality.
// Round three found `shadowCaster.decay` 2 -> 1 (41.64% of the frame moved, worst delta 8/255) and
// `shadowCaster.distance` 0 -> 1.2 (79.47% of the frame, worst delta 87/255, the key's modelling
// visibly gone) walking past all four while `LightingRig.selftest.mjs` read 98/98 and
// `GroundContact.selftest.mjs` 65/65.
//
// The three mechanisms are unrelated as mechanisms and identical as a failure: **the gate enumerated
// the properties somebody had already been bitten by.** So the question this section answers is not
// "is the decay right" — it is "what is the COMPLETE set of properties that decide what a light puts
// on the figure", answered from three's own source rather than from memory, so the gate can assert
// the SET and go red on the fourth mechanism nobody has met yet.
//
// 🚩 ROUND FOUR ARRIVED ANYWAY, AND IT CAME THROUGH THE PARAGRAPH ABOVE RATHER THAN AROUND IT. The
// set was asserted for the LIGHT and hand-read for the shadow CAMERA — seven fields out of 44, with
// the camera excluded from the sweep — so the closure was an enumeration one level down and two
// planted defects moved pixels past a green gate. The correction is a change of MODEL, not another
// row: a light's render state is an object GRAPH, and `classifyNode` sweeps every node of it. See
// `SHADOW_CAMERA_NODE` below for the plates, and read that section before adding anything here,
// because "add the field that bit us" is the move this file has now made four times.
//
// Enumerated at **three 0.185.1** by grepping every read in `three/src/nodes/lighting/*.js` and
// `three/src/nodes/accessors/Lights.js`, plus the two `reference()` forms that read through a
// string and so do not appear as `light.x`:
//
//   AnalyticLightNode.update      light.color x light.intensity          -> the light's colour node
//   AnalyticLightNode.setup       light.castShadow, renderer.shadowMap.enabled, object.receiveShadow
//   SpotLightNode.update          light.angle, light.penumbra, light.distance, light.decay
//   SpotLightNode.setupDirect     light.matrixWorld (position), light.target (direction),
//                                 light.map / light.colorNode (projector), and
//                                 getDistanceAttenuation( d, light.distance, light.decay )
//   RectAreaLightNode.update      light.width, light.height, light.matrixWorld (position AND the
//                                 extracted rotation)
//   HemisphereLightNode           light.color, light.groundColor, light.intensity, and
//                                 light.matrixWorld POSITION normalised as the sky axis
//   ShadowNode                    reference( 'intensity' | 'bias' | 'normalBias' | 'radius' |
//                                 'blurSamples' | 'mapSize', shadow ), reference( 'near' | 'far',
//                                 shadow.camera ), shadow.mapType, shadow.autoUpdate,
//                                 shadow.needsUpdate, shadow.shadowNode, shadow.filterNode,
//                                 shadow.biasNode
//   SpotLightShadow.updateMatrices  camera.fov = 2 x light.angle x shadow.focus, camera.aspect =
//                                 (mapSize.width / mapSize.height) x shadow.aspect, and
//                                 camera.far = light.distance || camera.far
//   Renderer._projectObject       object.visible, object.layers.test( camera.layers )
//
// Two of those lines are worth reading twice. `shadow.focus` is a MULTIPLIER on the shadow
// frustum's field of view and nothing in this repo had ever named it; and `light.distance` reaches
// the picture twice — once through the falloff window and once by overriding the shadow camera's
// far plane — which is why the 0 -> 1.2 injection moved 79% of the frame rather than a little of it.

/**
 * three's own distance falloff, on the CPU, so a gate can ASK what a caster delivers rather than
 * assume it.
 *
 * A faithful port of `getDistanceAttenuation` in `three/src/nodes/lighting/LightUtils.js` (Frostbite
 * 3, "Moving to Physically Based Rendering", p32 eq. 26), including both details that matter and
 * neither of which an inverse square has: the `max( ..., 0.01 )` floor on the powered distance, and
 * the squared window that switches on the moment `cutoffDistance` is greater than zero.
 *
 * 🚩 **THE HARDCODED `1 / d²` IS THE DEFECT THIS FUNCTION REPLACES.** Both selftests measured a
 * caster's contribution as `intensity / d²` and said so in a comment — *"with `distance` 0 and
 * `decay` 2 the distance term is a plain inverse square"* — which is true, and is a PREMISE about
 * two fields the same gate never read. An oracle that assumes the value of a field cannot test it.
 * Written this way, `decay` and `distance` are inputs to the answer, so a caster at `decay` 1 or
 * `distance` 1.2 fails the delivery equality on arithmetic rather than on a named check.
 *
 * @param {number} lightDistance - metres from the light to the receiving point.
 * @param {number} cutoffDistance - `SpotLight.distance`; 0 disables the window entirely.
 * @param {number} decayExponent - `SpotLight.decay`; 2 is inverse square.
 * @returns {number} the scalar three multiplies the light's colour by, for distance alone.
 */
export function distanceAttenuation( lightDistance, cutoffDistance, decayExponent ) {

    let falloff = 1 / Math.max( Math.pow( lightDistance, decayExponent ), 0.01 );

    if ( cutoffDistance > 0 ) {

        const ratio = lightDistance / cutoffDistance;
        const window = Math.min( 1, Math.max( 0, 1 - ratio * ratio * ratio * ratio ) );

        falloff *= window * window;

    }

    return falloff;

}

/**
 * Everything a `SpotLight` multiplies its colour by at one point, except the receiver's own cosine.
 *
 * `SpotLightNode.setupDirect` is `colorNode x spotAttenuation x getDistanceAttenuation`, and
 * `getSpotAttenuation` is `smoothstep( cos angle, cos( angle x (1 − penumbra) ), cos θ )` with θ
 * measured from the axis the TARGET defines. All four of `angle`, `penumbra`, `decay` and
 * `distance` therefore enter here, which is the point: one function, four fields, no premises.
 *
 * ⚠️ Axis and distance are taken from `position` and `target.position` rather than from
 * `matrixWorld`, because a headless rig never runs `updateMatrixWorld`. That is only the same thing
 * while both objects are direct children of the scene with no transform above them — which is a
 * claim about the graph, so `lightRenderState` reports `parentIsScene` and the gate asserts it
 * rather than leaving it as an assumption in this comment (LEARNINGS §1.25l).
 *
 * @param {import('three').SpotLight} spot
 * @param {import('three').Vector3} point - world position of the receiving point.
 * @returns {number} irradiance per unit `intensity` at that point.
 */
export function spotIrradianceFactor( spot, point ) {

    _axis.copy( spot.target.position ).sub( spot.position ).normalize();
    _toPoint.copy( point ).sub( spot.position );

    const distance = _toPoint.length();
    const cosine = distance === 0 ? 1 : _axis.dot( _toPoint ) / distance;

    const coneCos = Math.cos( spot.angle );
    const penumbraCos = Math.cos( spot.angle * ( 1 - spot.penumbra ) );

    const t = penumbraCos === coneCos
        ? ( cosine >= coneCos ? 1 : 0 )
        : Math.min( 1, Math.max( 0, ( cosine - coneCos ) / ( penumbraCos - coneCos ) ) );

    const cone = t * t * ( 3 - 2 * t );

    return cone * distanceAttenuation( distance, spot.distance, spot.decay );

}

/**
 * Fields that exist on every `Object3D` and cannot change what a LIGHT contributes, each with the
 * reason it cannot. Verified by grep over `three/src/nodes/**` and `three/src/renderers/common/**`
 * at three 0.185.1 — a field is inert here only if no shading path reads it FOR A LIGHT, not
 * merely because it looks like bookkeeping.
 *
 * 🚩 **AND, THIS ROUND, VERIFIED BY EXECUTION AS WELL, WHICH MOVED FOUR ROWS OUT OF THIS TABLE.**
 * A reason written from a grep is an argument, and this file has now shipped four wrong ones. Every
 * row here and in every table below is re-derived by perturbing the field on the shipped rig and
 * asking three's own update path whether the answer changed — `scene.updateMatrixWorld()` then the
 * quantities `RectAreaLightNode.update`, `SpotLightNode.setupDirect` and `HemisphereLightNode`
 * actually pull (world position, `extractRotation( matrixWorld )`, colour, intensity, width, height,
 * angle, penumbra, distance, decay, the target's world position, visible, layers, castShadow). The
 * prober lives in `LightingRig.selftest.mjs` as the LIVENESS clause, so the tables are not merely
 * asserted against themselves. What it found:
 *
 *   | field                   | was                                       | measured |
 *   |-------------------------|-------------------------------------------|----------|
 *   | `matrixAutoUpdate`      | inert, "decides WHEN `matrix` is recomposed" | **LIVE** on `RectAreaLight` and `SpotLight` |
 *   | `matrixWorldAutoUpdate` | inert, "as above"                         | **LIVE** on all three classes |
 *   | `pivot`                 | inert, "folded into `matrix`"             | **LIVE** on `RectAreaLight` |
 *   | `isLight`               | inert, "a type brand"                     | **LIVE** — `Renderer._projectObject` collects a light with `else if ( object.isLight )`, so a light without the brand contributes nothing at all |
 *
 * The first three share one mistake: each reason names a mechanism that folds the field into
 * something else that IS classified, and each is true only if something recomposes that
 * something-else. Nothing does. `matrixAutoUpdate` false leaves `matrix` at the identity it was
 * constructed with, so the light sits at the world origin however carefully `solve()` set its
 * `position`. "Folded into a classified field" is a statement about the LAST write, and these three
 * decide whether the write happens.
 */
const INERT_ON_ANY_LIGHT = {
    isObject3D: 'a type brand — and unlike `isLight` below, nothing in the WebGPU path branches on it',
    uuid: 'keys the node cache (`AnalyticLightNode.getHash`); a different uuid rebuilds the same light',
    name: 'labels the shadow render pass in a debug capture and nothing else',
    type: 'the light node class is chosen by constructor lookup in `NodeLibrary`, not by this string',
    parent: 'covered instead by `parentIsScene`, which is the property the world-space claim needs',
    children: 'a light with children still contributes exactly its own term',
    up: 'consumed by `lookAt`; the result of that call is `quaternion`, which IS classified. ⚠️ Read '
        + 'the SHADOW CAMERA\'s entry before copying this reason anywhere: there `lookAt` runs inside '
        + '`LightShadow.updateMatrices` every frame and the resulting quaternion is NOT classified, '
        + 'so the same field is live one level down',
    rotation: 'the Euler mirror of `quaternion`; the same state read twice, and three keeps the two '
        + 'in step through `_onRotationChange`, so a rig that set this instead fails the panel '
        + 'orientation invariant. Measured: setting `rotation` on the key panel does move the render '
        + 'state, and it moves it BY moving `quaternion`',
    quaternion: 'only a `RectAreaLight` is oriented — a spot points at its target and a hemisphere '
        + 'light reads its POSITION as the sky axis, so neither consults its own rotation. Promoted '
        + 'to a read field for `RectAreaLight` below',
    scale: 'reaches the picture only through `extractRotation( matrixWorld )`, which a `RectAreaLight` '
        + 'does and no other light here does. Promoted for `RectAreaLight` below — and read the '
        + 'measurement there before assuming which scales matter, because the obvious answer is wrong',
    matrix: 'the local composition of position/quaternion/scale/pivot, all four of which ARE '
        + 'classified — and `matrixAutoUpdate`, which decides whether the composition happens at all, '
        + 'is classified too. That last clause is what was missing when this row was written',
    matrixWorld: 'ditto, one level up, with `matrixWorldAutoUpdate` and `parentIsScene` closing it',
    matrixWorldNeedsUpdate: 'a dirty flag: setting it true forces one extra recomposition of a matrix '
        + '`matrixAutoUpdate` already recomposes every frame. Measured inert on all three classes',
    receiveShadow: 'read on the objects being SHADED (`AnalyticLightNode.setup`), never on the light',
    frustumCulled: 'lights are collected in `_projectObject` before any frustum test',
    renderOrder: 'orders draw calls; lights are not drawn',
    animations: 'clip storage',
    customDepthMaterial: 'used when a MESH is rendered into a shadow map',
    customDistanceMaterial: 'as above',
    static: 'a hint to the render-list cache; the same light either way',
    userData: 'application storage, read by nothing in three'
};

/**
 * Per-class inert fields, same rule and same evidence.
 *
 * Empty for all three classes since the brands moved to `READ_BY_CLASS`. Kept rather than deleted
 * because the NEXT class added here will have its own bookkeeping, and a table that exists is one
 * somebody fills in.
 */
const INERT_BY_CLASS = {
    RectAreaLight: {},
    SpotLight: {},
    HemisphereLight: {}
};

/**
 * Fields three reads on every light whatever its class, then the ones it reads per class.
 *
 * 🚩 `castShadow` is a READ field on a `RectAreaLight` and on a `HemisphereLight`, which is not the
 * obvious call — neither can cast (three.js #14161; there is no hemisphere shadow path). It is here
 * because `AnalyticLightNode.setup` reads the flag before it asks whether the class supports it and
 * goes straight to `this.light.shadow.shadowNode`, and `light.shadow` is `undefined` on both. The
 * consequence of setting it is not "nothing", it is a TypeError at first compile. Classifying it as
 * inert would have been the defensible-sounding answer and the wrong one.
 *
 * 🚩 `isLight` is here for the same shape of reason and it was classified inert until this round.
 * `Renderer._projectObject` collects lights with `else if ( object.isLight ) renderList.pushLight()`,
 * so the brand is not documentation — it is the test that decides whether the light exists.
 *
 * 🚩 `matrixAutoUpdate`, `matrixWorldAutoUpdate` and `pivot` are here because they were MEASURED
 * live, having been argued inert. See the table on `INERT_ON_ANY_LIGHT`.
 */
const READ_ON_ANY_LIGHT = [
    'color', 'intensity', 'position', 'visible', 'layers', 'castShadow',
    'isLight', 'matrixAutoUpdate', 'matrixWorldAutoUpdate', 'pivot'
];

/**
 * ⚠️ `scale` IS A READ FIELD ON A `RectAreaLight` AND THE REASON IS NOT THE OBVIOUS ONE.
 *
 * The plausible argument — that `extractRotation( matrixWorld )` divides the scale out per axis, so
 * a non-uniform scale SKEWS the panel basis — is wrong, and it is wrong because `extractRotation`
 * NORMALISES each column, which removes any positive per-axis scale exactly. Measured on
 * `/src/lighting.html?frame=body` at 900x1200, WebGPU, element screenshot, one change at a time
 * with the restore verified clean:
 *
 *   | key panel scale | % of the frame moved | worst Δ/255 |
 *   |-----------------|---------------------:|------------:|
 *   | (1, 2, 1)       |            **0.00%** |       **0** |
 *   | (1, −1, 1)      |           **98.86%** |     **140** |
 *
 * A MIRROR is what moves it: `.length()` is positive, so a negative scale survives normalisation as
 * a sign, the basis changes handedness, and the panel's half-height points the other way. The field
 * stays classified as read because of the second row; the first row is kept because it is exactly
 * LEARNINGS §1.25h — a plausible mechanism is not a measured effect, and this one is zero.
 *
 * ⚠️ **`scale` IS INERT ON THE SHADOW CAMERA, MIRROR AND ALL, AND THAT IS NOT AN INCONSISTENCY.**
 * `Camera.updateMatrixWorld` decomposes its own `matrixWorld` and rebuilds `matrixWorldInverse` with
 * `_scale.set( 1, 1, 1 )` (three/src/cameras/Camera.js:126) — a camera throws its scale away, sign
 * included. Measured: `(2,2,2)`, `(1,2,3)` and `(−1,1,1)` on the key's shadow camera all leave
 * `matrixWorldInverse` bit-identical. The same field, opposite verdicts, both from three's source.
 * That is the whole argument for classifying PER NODE rather than once for the graph.
 *
 * ⚠️ **The three class brands are read fields and only one of them is genuinely read on this path.**
 * `isSpotLight` is (`LightsNode.customCacheKey`, deciding whether `map` and `colorNode` join the
 * program hash); `isRectAreaLight` and `isHemisphereLight` are read only by `WebGLLights.js`, which
 * this project does not run. They are held anyway, and the reason is stated rather than dressed up:
 * a brand is one boolean, holding it costs one declared row, and arguing about whether a brand is
 * "just a brand" has now cost this file four wrong rows. `isLight` is the cautionary case — it read
 * "a type brand" for three rounds and it is the test `_projectObject` uses to collect the light.
 */
const READ_BY_CLASS = {
    RectAreaLight: [ 'width', 'height', 'quaternion', 'scale', 'isRectAreaLight' ],
    HemisphereLight: [ 'groundColor', 'isHemisphereLight' ],
    SpotLight: [ 'distance', 'angle', 'penumbra', 'decay', 'map', 'target', 'shadow', 'isSpotLight' ]
};

/** Fields three reads that do not exist until somebody sets them. Absent is the declared state. */
const READ_WHEN_PRESENT = {
    RectAreaLight: [ 'colorNode' ],
    SpotLight: [ 'colorNode', 'iesMap' ],
    HemisphereLight: [ 'colorNode' ]
};

/** `LightShadow` fields that reach the picture, and the ones that cannot. */
const INERT_ON_SHADOW = {
    map: 'the render target itself, allocated by `ShadowNode`',
    mapPass: 'the VSM intermediate target',
    matrix: 'recomputed every frame by `LightShadow.updateMatrices`',
    isSpotLightShadow: 'a type brand',
    _frustum: 'scratch',
    _frameExtents: 'scratch',
    _viewportCount: 'scratch',
    _viewports: 'scratch'
};

/**
 * Fields on a `LightShadow` that are OBJECTS IN THE GRAPH, swept as nodes rather than read flat.
 *
 * 🚩 The same object drives BOTH the "skip it in the flat sweep" test and the node sweep itself,
 * deliberately. The old code had those as two separate edits — `if ( key === 'camera' ) continue;`
 * in one place and seven hardcoded reads in another — so a node could be excused from the flat
 * sweep without ever being swept as a node, which is exactly what happened. One table, one
 * consequence: excusing a field here IS enrolling it below.
 */
const NODES_ON_SHADOW = { camera: () => SHADOW_CAMERA_NODE };

// --- and the fields of the graph, which is the half that was missing -------------------------
//
// 🚩 THE CLOSURE WAS ITSELF AN ENUMERATION, ONE LEVEL DOWN, AND IT COST A FOURTH MECHANISM.
//
// The section above was written so that "an enumeration of remembered mechanisms structurally
// cannot cover the next one" — and then handled the shadow CAMERA with seven hardcoded reads and
// `if ( key === 'camera' ) continue;`, so the camera was never swept at all. Measured on the shipped
// body rig: 7 fields read, 44 own enumerable keys, **37 in neither list and not reported in
// `unclassified`**, with `unclassified` and `missing` both empty. An independent verifier planted
// two of them in `frameShadowCamera()` and the gate read 122/122 through both:
//
//   | planted in `frameShadowCamera()`               | gate    | % of frame moved | worst Δ/255 |
//   |------------------------------------------------|---------|-----------------:|------------:|
//   | `camera.matrixAutoUpdate = false`              | 122/122 |            1.07% |          40 |
//   | camera reparented under a translated node      | 122/122 |            0.50% |          15 |
//   | `camera.up` tilted 21°                         | 122/122 |            0.08% |           3 |
//
// (`/alive.html?bare&freeze&seed=1&capture`, 900×1200, dpr 1, seed 1, 60 steps @ 60 fps, 2 loads,
// shipped defaults aa=taau + grade + RCAS with MSAA OFF, 0 px residue within each plate.)
//
// The second one is the tell. It is a GRAPH defect, not a scalar one, and the closure already knew
// graph was a hazard — it asserts `parentIsScene` for the LIGHT and never asked the same question of
// the camera. The reason it never asked is structural: a flat map of `light.field` has nowhere to
// put "and this field is another Object3D with 44 fields of its own."
//
// So the model changes rather than the list. **A light's render state is an object GRAPH**, and
// every node in it — the light, its shadow, the shadow's camera, the spot's target — gets the same
// treatment: swept for what it HAS, every own key either read with a value or inert with a reason,
// anything else into `unclassified`. `classifyNode` in `StateClosure.js` is that sweep — it moved
// out of this file when `GroundContact.js` needed the identical instrument for the plane it draws —
// and the two tables below are the two nodes that were being read by hand.
//
// ⚠️ The classifications below are MEASURED, not grepped. Each field was perturbed on the shipped
// rig and three's own `LightShadow.updateMatrices` / `scene.updateMatrixWorld()` asked whether the
// answer moved; `LightingRig.selftest.mjs`'s LIVENESS clause is that prober kept as a gate, so the
// tables cannot drift away from three without going red.

/**
 * The shadow camera. 14 fields three reads, 30 it cannot, one derived fact about the graph.
 *
 * 🚩 **Four of the reads are fields that are INERT ON A LIGHT, and the difference is `lookAt`.** A
 * light is placed by `solve()` once and left; the shadow camera is re-placed by
 * `LightShadow.updateMatrices` on every shadow pass, which sets `position` from the light's world
 * matrix, calls `camera.lookAt( target )` and then `camera.updateMatrixWorld()`. That sequence puts
 * `up`, `isCamera` (the branch `Object3D.lookAt` takes), `matrixAutoUpdate` and
 * `matrixWorldAutoUpdate` directly in the path of the result, and it makes `position`, `rotation`
 * and `quaternion` — the three a reader would reach for first — derived and therefore inert.
 *
 * 🚩 **`focus` here is NOT `shadow.focus`.** `PerspectiveCamera.focus` is the stereo convergence
 * distance and `updateProjectionMatrix` never reads it; `shadow.focus` is the multiplier on the
 * shadow frustum's field of view and is read one level up. Two live fields one property apart with
 * the same name, and only one of them does anything here.
 */
const SHADOW_CAMERA_NODE = {

    read: [
        // the projection
        'near', 'far', 'zoom', 'filmGauge', 'filmOffset', 'view',
        // the view matrix, via `updateMatrices`
        'up', 'matrixAutoUpdate', 'matrixWorldAutoUpdate', 'pivot', 'isCamera',
        // what the shadow pass draws, and how depth is encoded
        'layers', 'isPerspectiveCamera', '_reversedDepth'
    ],

    inert: {
        isObject3D: 'a type brand; `_projectObject` never sees the shadow camera as an object',
        uuid: 'the render list is keyed by object identity (`ChainMap`), not by uuid',
        name: 'a label',
        type: 'nothing dispatches on it; the depth path branches on `isPerspectiveCamera` instead',
        parent: 'covered instead by `parentIsNull` below, which is the property the claim needs',
        children: 'the camera is not in the scene being rendered, so its children are never drawn',
        position: 'assigned from `light.matrixWorld` by `LightShadow.updateMatrices` on every pass',
        rotation: 'the Euler mirror of a quaternion `lookAt` overwrites on every pass',
        quaternion: 'assigned by `camera.lookAt( target )` inside `updateMatrices`',
        scale: '⚠️ NOT for the reason a `RectAreaLight`\'s scale is read. `Camera.updateMatrixWorld` '
            + 'rebuilds `matrixWorldInverse` with `_scale.set( 1, 1, 1 )` (Camera.js:126), so a camera '
            + 'discards its own scale — MEASURED inert at (2,2,2), (1,2,3) and the mirror (−1,1,1), '
            + 'which is the case that moved 98.86% of the frame on a panel',
        matrix: 'recomposed from position/quaternion/scale/pivot by `updateMatrix`, and '
            + '`matrixAutoUpdate` — the field that decides whether that happens — is READ above',
        matrixWorld: 'recomposed by `updateMatrixWorld`, with `matrixWorldAutoUpdate` and '
            + '`parentIsNull` closing it',
        matrixWorldNeedsUpdate: 'a dirty flag; `updateMatrices` calls `updateMatrixWorld()` regardless',
        visible: 'the camera is not in the scene being rendered',
        castShadow: 'as above',
        receiveShadow: 'as above',
        frustumCulled: 'as above',
        renderOrder: 'as above',
        animations: 'clip storage',
        customDepthMaterial: 'read on a MESH being rendered into a shadow map, never on the camera',
        customDistanceMaterial: 'as above',
        static: 'a render-list cache hint',
        userData: 'application storage',
        matrixWorldInverse: 'recomputed by `Camera.updateMatrixWorld` from `matrixWorld`',
        projectionMatrix: 'recomputed by `updateProjectionMatrix`, which `ShadowNode.render` calls on '
            + 'every shadow pass (ShadowNode.js:439)',
        projectionMatrixInverse: 'recomputed alongside it',
        coordinateSystem: 'assigned from the RENDER camera on every shadow pass '
            + '(`ShadowNode.render`, ShadowNode.js:438), so the authored value is never the one used',
        fov: 'overwritten every pass by `SpotLightShadow.updateMatrices` from `light.angle x '
            + 'shadow.focus`; the two INPUTS are what the gate holds',
        aspect: 'overwritten every pass from `mapSize.width / mapSize.height x shadow.aspect`',
        focus: '`PerspectiveCamera.focus`, the stereo convergence distance — NOT `shadow.focus`. '
            + '`updateProjectionMatrix` does not read it'
    },

    derived: {
        // Every distance and every matrix in this file assumes the shadow camera stands alone, so
        // that `updateMatrixWorld()` leaves it exactly where `updateMatrices` put it. It is never
        // added to any scene. Stated as state, because a verifier reparented it under a translated
        // node and moved 0.50% of the frame past a green gate.
        parentIsNull: ( camera ) => camera.parent === null
    }

};

/**
 * The spot's target. Three reads `setFromMatrixPosition( light.target.matrixWorld )` — a WORLD
 * position — in two places (`Lights.js` `lightTargetPosition`, and `LightShadow.updateMatrices`),
 * so the target's place in the graph is as load-bearing as its `position`.
 *
 * ⚠️ **`pivot` is read here and `rotation`/`scale` are inert, and the pair only closes together.**
 * Measured on the shipped target: pivot alone moves nothing (identity rotation makes the pivot
 * correction algebraically zero), rotation alone moves nothing (`compose` writes `position`
 * verbatim into the translation column whatever the basis), and the two TOGETHER move the target's
 * world position to (−0.043, 0.910, 0.261). Neither can be called inert on its own without assuming
 * the other's value. Reading `pivot` — one row, declared null — makes the inert reasons for
 * `rotation` and `scale` true unconditionally instead of true-given-a-field-nobody-checks.
 */
const SPOT_TARGET_NODE = {

    read: [ 'matrixAutoUpdate', 'matrixWorldAutoUpdate', 'pivot' ],

    inert: {
        isObject3D: 'a type brand; the target is an empty `Object3D` and is never drawn',
        uuid: 'nothing keys on it',
        name: 'a label',
        type: 'nothing dispatches on it',
        parent: 'covered instead by `parentIsScene` below',
        children: 'the target is read for its world position only',
        up: 'consumed by `lookAt`, which nothing calls on the target',
        position: 'the same state the light\'s own `target` row already carries, read twice',
        rotation: '`Matrix4.compose` writes `position` verbatim into the translation column whatever '
            + 'the basis, so only the pivot correction could involve the rotation — and `pivot` is '
            + 'READ above. Measured inert with `pivot` at its declared null',
        quaternion: 'the same state as `rotation`',
        scale: 'as `rotation`: it scales the basis columns, never the translation column',
        matrix: 'recomposed by `updateMatrix`, and `matrixAutoUpdate` is READ above',
        matrixWorld: 'recomposed by `updateMatrixWorld`, with `matrixWorldAutoUpdate` and '
            + '`parentIsScene` closing it',
        matrixWorldNeedsUpdate: 'a dirty flag',
        layers: 'measured inert — an empty `Object3D` draws nothing, so failing `_projectObject`\'s '
            + 'layer test removes nothing from the frame, and `scene.updateMatrixWorld()` runs before '
            + 'and independently of it',
        visible: 'measured inert, and counterintuitively so: an INVISIBLE target still aims the spot, '
            + 'because the aim is read off `matrixWorld` and not out of the render list',
        castShadow: 'the target is not a mesh',
        receiveShadow: 'as above',
        frustumCulled: 'as above',
        renderOrder: 'as above',
        animations: 'clip storage',
        customDepthMaterial: 'as `castShadow`',
        customDistanceMaterial: 'as above',
        static: 'a render-list cache hint',
        userData: 'application storage'
    },

    derived: {
        parentIsScene: ( target ) => target.parent !== null && target.parent.isScene === true
    }

};

const _axis = /* @__PURE__ */ new Vector3();
const _toPoint = /* @__PURE__ */ new Vector3();

/**
 * 🎯 THE WHOLE-STATE FINGERPRINT. Everything about one light that can change the picture, as a flat
 * map — plus, and this is the half that makes it a CLOSURE rather than a list, everything about it
 * that cannot, with a reason each, and anything that fits neither description.
 *
 * `unclassified` is the load-bearing return value. A list of named mechanisms cannot know what it
 * is missing; a closure can, because the object is asked what fields it HAS and every one of them
 * has to be accounted for. When three adds a field, when a light changes class, or when somebody
 * sets something nobody has thought about, the field lands in `unclassified` and the gate goes red
 * naming it — before anybody has to have been bitten by it.
 *
 * `missing` is the same instrument pointed the other way: a field this file says three reads, that
 * the object does not have. That is a rename in the dependency or a light of the wrong class, and
 * it would otherwise present as a check quietly comparing `undefined` against `undefined`.
 *
 * The rig does NOT say what any of these values ought to be. That belongs to the gate, derived from
 * the placement table, so the two are independent derivations rather than one written twice.
 *
 * @param {import('three').Light} light
 * @returns {{ read: Object<string, *>, inert: Object<string, string>, unclassified: string[], missing: string[] }}
 */
export function lightRenderState( light ) {

    const className = light.constructor.name;
    const readNames = [ ...READ_ON_ANY_LIGHT, ...( READ_BY_CLASS[ className ] ?? [] ) ];

    const inert = { ...INERT_ON_ANY_LIGHT, ...( INERT_BY_CLASS[ className ] ?? {} ) };
    for ( const name of readNames ) delete inert[ name ];

    const read = {};
    const missing = [];

    for ( const name of readNames ) {

        if ( name in light === false ) {

            missing.push( name );
            continue;

        }

        if ( name === 'shadow' ) continue;   // expanded below, one level down

        read[ name ] = plainValue( light[ name ] );

    }

    // The world-space claim every distance in this file makes, stated as state rather than assumed.
    read.parentIsScene = light.parent !== null && light.parent.isScene === true;

    // Fields that are absent by default and are read the moment they exist.
    for ( const name of READ_WHEN_PRESENT[ className ] ?? [] ) {

        read[ `optional.${ name }` ] = light[ name ] === undefined ? null : plainValue( light[ name ] );

    }

    const unclassified = Object.keys( light )
        .filter( ( key ) => key in inert === false && readNames.includes( key ) === false );

    if ( light.shadow !== undefined && light.shadow !== null ) {

        const shadow = light.shadow;

        for ( const key of [ 'intensity', 'bias', 'normalBias', 'radius', 'blurSamples', 'mapSize',
            'mapType', 'autoUpdate', 'needsUpdate', 'focus', 'aspect', 'biasNode' ] ) {

            if ( key in shadow === false ) missing.push( `shadow.${ key }` );
            else read[ `shadow.${ key }` ] = plainValue( shadow[ key ] );

        }

        // Absent by default, and each of them replaces a whole stage of the shadow when it is not.
        for ( const key of [ 'shadowNode', 'filterNode' ] ) {

            read[ `shadow.optional.${ key }` ] = shadow[ key ] === undefined ? null : 'set';

        }

        for ( const key of Object.keys( shadow ) ) {

            if ( key in NODES_ON_SHADOW ) continue;   // swept as a graph node, just below
            if ( key in INERT_ON_SHADOW ) continue;
            if ( `shadow.${ key }` in read ) continue;

            unclassified.push( `shadow.${ key }` );

        }

        // 🚩 The shadow's own graph nodes, swept rather than hand-read. This used to be seven
        // hardcoded reads with the camera excluded from the sweep above, which left 37 of its 44 own
        // fields in neither list AND out of `unclassified` — see the section header for the two that
        // moved pixels past a 122/122 gate. `far` is read despite `light.distance || camera.far`,
        // because a non-zero cutoff silently taking the far plane over is exactly what the gate is
        // for.
        for ( const [ key, specOf ] of Object.entries( NODES_ON_SHADOW ) ) {

            classifyNode( shadow[ key ], `shadow.${ key }`, specOf(), { read, inert, unclassified, missing } );

        }

    }

    // The spot's target is the other Object3D in the light's graph, and three reads its WORLD
    // position — so where it sits in the graph decides the aim as much as its own `position` does.
    // Same sweep, same reason.
    if ( light.target !== undefined && light.target !== null && light.target.isObject3D === true ) {

        classifyNode( light.target, 'target', SPOT_TARGET_NODE, { read, inert, unclassified, missing } );

    }

    return { read, inert, unclassified, missing };

}

// --- the rig ---------------------------------------------------------------------------------

let ltcInstalled = false;

/**
 * Installs the linearly-transformed-cosine tables `RectAreaLight` needs before its first use.
 *
 * Without this the WebGPU path contributes NOTHING from any area light and the figure renders
 * black — a failure that looks like a broken material rather than a missing table, which is why
 * the rig does it itself instead of documenting it as a caller's responsibility.
 */
function installLtcTablesOnce() {

    if ( ltcInstalled ) return;

    RectAreaLightNode.setLTC( RectAreaLightTexturesLib.init() );
    ltcInstalled = true;

}

export class LightingRig {

    /**
     * @param {Object} [options]
     * @param {'portrait'|'body'} [options.preset='portrait']
     * @param {number} [options.exposure=1] - Scales every irradiance together. Changes how bright
     *   the subject is; cannot change any ratio, and therefore cannot move G1.
     * @param {boolean} [options.shadows=true] - Build the shadow-casting halves at all.
     * @param {number} [options.shadowMapSize=4096] - Cheap: the cost sweep found the shadow pass
     *   is bound by the extra geometry draw, not by the map's fill.
     * @param {number} [options.shadowCoverageInHeights=2.2] - Half-extent of the shadow cone at
     *   the subject, in framed heights. Do not shrink it to buy texels — see `frameShadowCamera`.
     * @param {boolean} [options.ambient=true]
     * @param {?Object} [options.overrides] - Per-light field overrides keyed by name, e.g.
     *   `{ fill: { irradiance: 1.6 } }`. For the browsercheck's sliders; production callers should
     *   change the preset table instead so the change is reviewed.
     */
    constructor( options = {} ) {

        this.preset = options.preset ?? 'portrait';
        this.exposure = options.exposure ?? EXPOSURE_CALIBRATION;
        this.shadowsEnabled = options.shadows !== false;
        this.shadowMapSize = options.shadowMapSize ?? 4096;
        this.shadowCoverageInHeights = options.shadowCoverageInHeights ?? 2.2;
        this.ambientEnabled = options.ambient !== false;
        this.ambientFractionOfKey = options.ambientFractionOfKey ?? AMBIENT.fractionOfKey;
        this.overrides = options.overrides ?? {};

        this.scene = null;
        this.renderer = null;

        /** @type {Array<{placement: LightPlacement, area: RectAreaLight, shadowCaster: ?DirectionalLight, target: ?Object3D}>} */
        this.units = [];
        this.ambientLight = null;

        // Last aim, kept so a preset change or an override can re-solve without the caller having
        // to hand the framing back in.
        this.focus = new Vector3();
        this.subjectHeightMetres = 1;
        this.cameraPosition = new Vector3( 0, 0, 1 );

        this.placements = this.resolvePlacements();

    }

    // --- lifecycle -----------------------------------------------------------------------

    /**
     * Builds the lights and puts them in the scene.
     *
     * The renderer is required, and not for convenience: `Renderer.shadowMap.enabled` defaults to
     * **false** on the WebGPU path, so a rig that only touched the scene would produce four
     * perfectly-configured shadow casters and no shadows, silently.
     *
     * @param {import('three').Scene} scene
     * @param {import('three').Renderer} renderer
     */
    attachTo( scene, renderer ) {

        if ( this.scene !== null ) throw new Error( 'LightingRig.attachTo: already attached.' );

        installLtcTablesOnce();

        this.scene = scene;
        this.renderer = renderer ?? null;

        if ( this.renderer !== null && this.shadowsEnabled ) this.renderer.shadowMap.enabled = true;

        for ( const placement of this.placements ) this.units.push( this.buildUnit( placement ) );

        if ( this.ambientEnabled ) {

            this.ambientLight = new HemisphereLight(
                AMBIENT.skyColour,
                AMBIENT.groundColour,
                this.irradianceOf( 'key' ) * this.ambientFractionOfKey
            );
            this.ambientLight.name = 'ambient';
            scene.add( this.ambientLight );

        }

        this.solve();

        return this;

    }

    /**
     * Aims the whole rig at a subject.
     *
     * Everything the rig needs to know about the shot is here: where the subject is, how big it
     * is, and where it is being seen from. Nothing else — no per-light positions, no scale factor
     * the caller has to derive.
     *
     * @param {Object} shot
     * @param {import('three').Vector3} shot.focus - the point the camera is framing.
     * @param {number} shot.subjectHeightMetres - the framed height, NOT the figure's stature. A
     *   0.42 m portrait crop and a 1.87 m full-body frame are different shots of the same person.
     * @param {import('three').Vector3} shot.cameraPosition
     */
    aimAt( { focus, subjectHeightMetres, cameraPosition } ) {

        this.focus.copy( focus );
        this.subjectHeightMetres = subjectHeightMetres;
        this.cameraPosition.copy( cameraPosition );

        this.solve();

        return this;

    }

    /**
     * Swaps the rim/kicker pair for the other framing's. Key and fill do not move, because they
     * are scale-free and there is nothing to swap them for.
     *
     * @param {'portrait'|'body'} preset
     */
    setPreset( preset ) {

        if ( preset === this.preset ) return this;

        this.preset = preset;
        this.placements = this.resolvePlacements();

        // Rebuild rather than mutate: a light whose `shadowFraction` crosses zero gains or loses
        // a whole DirectionalLight, and a partially-mutated rig is the kind of state that produces
        // a measurement nobody can reproduce.
        this.rebuild();

        return this;

    }

    /**
     * Overrides one or more fields on one light and re-solves. Intended for the browsercheck's
     * sliders, so a human can find the edge of a gate by hand.
     *
     * @param {string} name
     * @param {Object} fields - any subset of a LightPlacement.
     */
    override( name, fields ) {

        this.overrides[ name ] = { ...( this.overrides[ name ] ?? {} ), ...fields };
        this.placements = this.resolvePlacements();

        const changesShadowCaster = Object.hasOwn( fields, 'shadowFraction' );
        if ( changesShadowCaster ) this.rebuild();
        else this.solve();

        return this;

    }

    /** Removes every light this rig owns from the scene and drops the GPU-side shadow maps. */
    dispose() {

        for ( const unit of this.units ) {

            unit.area.removeFromParent();
            unit.area.dispose();

            if ( unit.shadowCaster !== null ) {

                unit.shadowCaster.shadow.dispose();
                unit.shadowCaster.removeFromParent();
                unit.shadowCaster.dispose();
                unit.target.removeFromParent();

            }

        }

        this.units.length = 0;

        if ( this.ambientLight !== null ) {

            this.ambientLight.removeFromParent();
            this.ambientLight.dispose();
            this.ambientLight = null;

        }

        this.scene = null;

    }

    // --- what the rig will tell you about itself -----------------------------------------

    /** Every light in the rig, area halves and shadow halves alike. Read-only. */
    get lights() {

        const all = [];

        for ( const unit of this.units ) {

            all.push( unit.area );
            if ( unit.shadowCaster !== null ) all.push( unit.shadowCaster );

        }

        if ( this.ambientLight !== null ) all.push( this.ambientLight );

        return all;

    }

    /** Authored irradiance of one light, after overrides and exposure. */
    irradianceOf( name ) {

        const placement = this.placements.find( ( entry ) => entry.name === name );

        return placement === undefined ? 0 : placement.irradiance * this.exposure;

    }

    /**
     * The ratio the gate is about, as DESIGNED — key irradiance over fill irradiance.
     *
     * ⚠️ This is the rig's intent, not a measurement of the render. The two differ because the
     * lit cheek also picks up some fill, the shadow cheek picks up rim spill and the hemisphere
     * term lifts both — all of which push the rendered ratio DOWN from this number, i.e. flatter.
     * `tools/critic/measure.mjs` G1 on a real frame is the authority; this is the dial.
     */
    get designedKeyToFill() {

        const fill = this.irradianceOf( 'fill' );

        return fill === 0 ? Infinity : this.irradianceOf( 'key' ) / fill;

    }

    /**
     * One line per light, for a HUD or a report: the derived radiance, the solid angle it came
     * from, and — for the edge lights — the silhouette band in the unit it is judged in.
     *
     * @param {number} [canvasHeightPixels] - if given, band fractions are also reported in pixels.
     * @param {number} [limbRadiusMetres=0.045] - default is an upper arm, the hardest case.
     */
    describe( canvasHeightPixels = null, limbRadiusMetres = 0.045 ) {

        return this.units.map( ( { placement, area, shadowCaster } ) => {

            const distance = placement.distanceInHeights * this.subjectHeightMetres;
            const solidAngle = projectedSolidAngle( area.width, area.height, distance );
            const band = silhouetteBandFraction( placement.azimuthDegrees );

            return {
                name: placement.name,
                azimuthDegrees: placement.azimuthDegrees,
                elevationDegrees: placement.elevationDegrees,
                irradiance: placement.irradiance * this.exposure,
                panelMetres: [ area.width, area.height ],
                distanceMetres: distance,
                projectedSolidAngle: solidAngle,
                areaRadiance: area.intensity,
                shadowFraction: placement.shadowFraction,
                shadowCasterIntensity: shadowCaster === null ? 0 : shadowCaster.intensity,
                silhouetteBandFraction: band,
                silhouetteBandPixels: canvasHeightPixels === null
                    ? null
                    : band * limbRadiusMetres * ( canvasHeightPixels / this.subjectHeightMetres )
            };

        } );

    }

    // --- helpers -------------------------------------------------------------------------

    /**
     * The preset table, with overrides folded in and the light count checked against the measured
     * budget. Throwing here rather than at render time is deliberate: a fifth area light does not
     * look wrong, it just quietly costs 0.9 ms that skin and hair were counting on.
     */
    resolvePlacements() {

        const edge = EDGE_LIGHTS[ this.preset ];
        if ( edge === undefined ) throw new Error( `LightingRig: unknown preset '${ this.preset }'.` );

        // Three layers, and the order is the meaning of each: the form lights as authored, then
        // the preset's own disagreement with them (one field, see the table), then the caller's
        // overrides, which are the browsercheck's sliders and must win over both.
        const presetForm = FORM_LIGHT_OVERRIDES_BY_PRESET[ this.preset ] ?? {};

        const placements = [ ...FORM_LIGHTS, ...edge ].map( ( placement ) => ( {
            ...placement,
            ...( presetForm[ placement.name ] ?? {} ),
            ...( this.overrides[ placement.name ] ?? {} )
        } ) );

        if ( placements.length > MAX_AREA_LIGHTS ) {

            throw new Error(
                `LightingRig: ${ placements.length } area lights asked for, budget is ${ MAX_AREA_LIGHTS }. ` +
                'docs/PROGRESS.md measures 4 at 3.604 ms and 8 at 7.421 ms of a 16.6 ms frame.'
            );

        }

        return placements;

    }

    /** One light: the area half, and the shadow half if this light carries any shadow energy. */
    buildUnit( placement ) {

        const area = new RectAreaLight( new Color( placement.colour ), 1, 1, 1 );
        area.name = placement.name;
        this.scene.add( area );

        const wantsShadow = this.shadowsEnabled && placement.shadowFraction > 0;

        if ( wantsShadow === false ) return { placement, area, shadowCaster: null, target: null };

        // `distance` 0 and the default `decay` 2 give plain inverse-square falloff, which is what
        // makes this a redistribution of the panel's light rather than a second, differently
        // behaved light. See the header's note on why this is not a DirectionalLight.
        //
        // 🚩 BOTH LINES ARE LOAD-BEARING AND BOTH WERE UNGATED UNTIL THIS ROUND. Measured on
        // rendered pixels by an independent verifier: `decay` 2 -> 1 moves 41.64% of the frame at
        // a worst delta of 8/255; `distance` 0 -> 1.2 moves 79.47% at 87/255 and takes the key's
        // modelling away entirely — because a non-zero `distance` reaches the picture TWICE, once
        // through the falloff window in `getDistanceAttenuation` and once through
        // `SpotLightShadow.updateMatrices`, which sets `camera.far = light.distance || camera.far`
        // and so collapses the shadow frustum as well. Neither is a default three would restore;
        // both are written here explicitly so the fingerprint has something to hold them to.
        const shadowCaster = new SpotLight( new Color( placement.colour ), 1 );
        shadowCaster.name = `${ placement.name }-shadow`;
        shadowCaster.castShadow = true;
        shadowCaster.decay = 2;
        shadowCaster.distance = 0;

        // A hard-edged cone would draw a visible ellipse across the backdrop. The cone here is
        // only a shadow-map frustum, not an art choice, so it is fully feathered and sized in
        // `solve()` to cover the subject.
        shadowCaster.penumbra = 1;
        shadowCaster.shadow.mapSize.set( this.shadowMapSize, this.shadowMapSize );

        // Normal bias rather than depth bias. The figure is a skinned mesh whose surface is
        // curved everywhere, so a constant depth bias either leaves acne on the grazing parts or
        // detaches the contact shadow at the feet; offsetting the sample along the normal scales
        // with the geometry instead of with the depth range.
        shadowCaster.shadow.normalBias = 0.02;
        shadowCaster.shadow.bias = -0.0002;

        // The target must be in the graph for three to build the light's view matrix from it.
        const target = new Object3D();
        target.name = `${ placement.name }-shadow-target`;
        this.scene.add( target );
        shadowCaster.target = target;

        this.scene.add( shadowCaster );

        return { placement, area, shadowCaster, target };

    }

    rebuild() {

        const scene = this.scene;
        const renderer = this.renderer;

        if ( scene === null ) return;

        this.dispose();
        this.scene = scene;
        this.renderer = renderer;

        for ( const placement of this.placements ) this.units.push( this.buildUnit( placement ) );

        if ( this.ambientEnabled ) {

            this.ambientLight = new HemisphereLight(
                AMBIENT.skyColour,
                AMBIENT.groundColour,
                this.irradianceOf( 'key' ) * this.ambientFractionOfKey
            );
            this.ambientLight.name = 'ambient';
            scene.add( this.ambientLight );

        }

        this.solve();

    }

    /**
     * Places, sizes and powers every light for the current shot.
     *
     * The camera frame is rebuilt from scratch each time rather than cached, because the whole
     * point of a camera-relative rig is that it follows the camera; a stale basis would make the
     * rig silently wrong in exactly the case it exists for.
     */
    solve() {

        if ( this.scene === null ) return;

        const toCamera = _toCamera.subVectors( this.cameraPosition, this.focus );
        toCamera.y = 0;

        // A camera looking straight down has no horizontal direction to measure azimuth from.
        // Fall back to world +Z rather than producing NaN positions that would put every light at
        // the origin and read, on screen, as "the rig did nothing".
        if ( toCamera.lengthSq() < 1e-12 ) toCamera.set( 0, 0, 1 );
        toCamera.normalize();

        const right = _right.set( toCamera.z, 0, -toCamera.x );   // toCamera rotated -90° about +Y
        const height = this.subjectHeightMetres;

        for ( const unit of this.units ) {

            const { placement, area, shadowCaster, target } = unit;

            const azimuth = placement.azimuthDegrees * DEGREES;
            const elevation = placement.elevationDegrees * DEGREES;
            const distance = placement.distanceInHeights * height;

            _direction
                .copy( toCamera ).multiplyScalar( Math.cos( azimuth ) * Math.cos( elevation ) )
                .addScaledVector( right, Math.sin( azimuth ) * Math.cos( elevation ) )
                .addScaledVector( _up, Math.sin( elevation ) );

            _position.copy( this.focus ).addScaledVector( _direction, distance );

            area.width = placement.widthInHeights * height;
            area.height = placement.heightInHeights * height;
            area.position.copy( _position );
            area.lookAt( this.focus.x, this.focus.y, this.focus.z );

            // The derivation the whole file rests on: authored irradiance -> panel radiance.
            //
            // The share read off the UNIT rather than off the placement, deliberately. With
            // `shadows: false` no caster was built, so a placement's shadowFraction has nowhere to
            // go — and taking it out of the panel anyway would make turning shadows off darken the
            // subject by 30%, which is a change of exposure disguised as a change of technique.
            const irradiance = placement.irradiance * this.exposure;
            const solidAngle = projectedSolidAngle( area.width, area.height, distance );
            const shadowShare = shadowCaster === null ? 0 : placement.shadowFraction;

            area.intensity = ( 1 - shadowShare ) * irradiance / solidAngle;

            if ( shadowCaster === null ) continue;

            shadowCaster.position.copy( _position );
            target.position.copy( this.focus );

            // A spot's `intensity` is a luminous intensity (candela), so the irradiance it
            // delivers at the focus is intensity / distance². Solving for the authored share is
            // what keeps `shadowFraction` a pure redistribution: at the focus the pair delivers
            // exactly the authored irradiance for every value of f, and everywhere else both
            // halves fall off the same way.
            //
            // 🚩 `distance * distance` IS THE INVERSE OF `distanceAttenuation` AT `decay` 2 AND
            // `distance` 0, AND AT NO OTHER SETTING. That is a premise about two fields written
            // three lines below in `buildUnit`, and a premise stated in a comment is the shape
            // this gate failed at three times running. It is now held rather than asserted:
            // `LightingRig.selftest.mjs`'s MAGNITUDE clause measures delivery with
            // `spotIrradianceFactor`, which reads `decay` and `distance` off the light, so any
            // other value of either fails here instead of silently redistributing. Deliberately
            // NOT written as `irradiance * f / distanceAttenuation( ... )` — a coefficient that
            // adapts to the caster's own falloff would hold the focus and quietly change every
            // other point in the frame, which is the 41.64% of pixels the `decay` 2 -> 1
            // injection moved.
            shadowCaster.intensity = placement.shadowFraction * irradiance * distance * distance;

            this.frameShadowCamera( shadowCaster, distance, height );

        }

        if ( this.ambientLight !== null ) {

            this.ambientLight.intensity = this.irradianceOf( 'key' ) * this.ambientFractionOfKey;

        }

    }

    /**
     * Sizes the shadow cone and its camera to the subject.
     *
     * A spot's shadow camera is a perspective one whose field of view three derives from
     * `light.angle`, and the default angle is π/3 — a 120° cone. On a 0.42 m portrait that spends
     * 2048 texels across a 3.8 m circle, roughly 230 across the head, which is a staircase rather
     * than a shadow. Narrowing the cone to the subject is the whole difference between a usable
     * contact shadow and an obviously aliased one, and it costs nothing: the cone is a frustum,
     * not a look.
     *
     * ⚠️ How WIDE is not a free choice, and the first answer here was wrong. A cone sized snugly
     * to the subject (0.75 of the framed height) gives beautiful texel density — 1365 across a
     * portrait subject — and draws a **visible soft-edged wedge across the backdrop**, because
     * three.js derives the shadow camera's field of view from `light.angle`, so the shadow frustum
     * and the light cone are the same thing: outside it the spot contributes nothing, and that
     * boundary lands inside the frame on any surface further away than the subject.
     *
     * So the cone is sized to the studio rather than to the subject — 2.2 of the framed height —
     * which puts its edge well outside anything a camera framing the subject can see. The texel
     * density that costs is bought back by the map size instead, and that is affordable for a
     * measured reason: the cost sweep found halving the map from 2048 to 1024 changed the shadow
     * pass by nothing at all (2.62 ms -> 2.74 ms, inside the run-to-run noise), because the cost
     * is the extra geometry pass, not the fill.
     *
     * `near` is pulled in rather than left at three's 0.5 m default, which on a 1.09 m portrait
     * standoff would clip the front half of the head out of its own shadow map.
     */
    frameShadowCamera( shadowCaster, distance, framedHeightMetres ) {

        const halfExtent = framedHeightMetres * this.shadowCoverageInHeights;

        shadowCaster.angle = Math.atan2( halfExtent, distance );

        const camera = shadowCaster.shadow.camera;
        // Bracketed on the SUBJECT's own depth, not on the cone's half-extent. The cone is now
        // sized to the studio, so `distance - halfExtent * 2` collapses to the 0.01 clamp and
        // throws away most of the depth buffer's precision on empty space in front of the light.
        camera.near = Math.max( 0.01, distance - framedHeightMetres );
        camera.far = distance + framedHeightMetres * 8;
        camera.updateProjectionMatrix();

    }

}

// Scratch vectors. Given their own instances rather than shared with anything that returns a
// result — LEARNINGS §1.12: a scratch vector passed as an output target aliases itself, and the
// answer looks plausible.
const _toCamera = new Vector3();
const _right = new Vector3();
const _direction = new Vector3();
const _position = new Vector3();
const _up = new Vector3( 0, 1, 0 );
