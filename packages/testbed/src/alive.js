/**
 * alive — the Phase 2 acceptance page.
 *
 * The gate this page exists to answer is subjective and it is stated in one line:
 * *does the figure read as alive when it is silent and unshaded?* Everything here serves
 * being able to LOOK at that honestly.
 *
 *   - The figure is lit by `render/LightingRig.js` — the same four RectAreaLights the look spec
 *     asks for, but authored as IRRADIANCE AT THE FOCUS rather than as raw `intensity`, which is
 *     what makes key:fill a design decision instead of an accident of panel geometry. This page
 *     used to carry its own inline rig; two of that rig's own comments were measurably wrong (the
 *     four typed intensities did not express a ratio at all — the fill panel subtends 2.485× the
 *     key's solid angle — and the full-body rim measured 1 px of band, i.e. none). Four lights is
 *     still the measured budget: 0.265 ms + 0.618 ms per Mpx lit, per light, 3.6 ms at 1080p.
 *     Exactly one of them — the key — carries a co-located shadow-casting SpotLight, because a
 *     shadow pass measures 2.62 ms and four of them would cost 77% of the frame.
 *
 *   - The body wears `material/SkinMaterial.js` (punch-list 3.2) and the two eye shells wear
 *     `material/EyeMaterial.js` (3.3/3.4). Before this they were the raw GLB materials, and a
 *     glaring white sclera is on the punch list's standing-constraints list as explicitly wrong.
 *     ?skin=0 and ?eyes=0 put the shipped GLB materials back, which is the A side of every
 *     comparison a judge is asked to make about the shading.
 *
 *   - It is framed as a portrait: crown to mid-chest, 30° FOV, camera at eye level and 12° off
 *     axis. That framing is not decoration. Blink and gaze are only readable when the eyes are
 *     large in frame, and breath is a 2–3 mm chest excursion, so the chest has to be in frame too.
 *
 *   - The figure stands in a REST POSE before anything animates it. The bind pose is not a
 *     posture — on this asset the upper arms stand 41.8° out from vertical with the forearms
 *     swung forward — and no amount of micro-motion rescues a mannequin silhouette. The pose is
 *     applied before the stack binds, so every layer's delta is a deviation from a person
 *     standing rather than from a T-pose.
 *
 *   - The full idle stack runs: breath, sway, body idle (arms, hands, fingers, trunk), head idle,
 *     gaze (eyes and head), blink, facial idle (brow, lids, cheeks, mouth, jaw), pupil. Every one
 *     of them is a contributor to a MotionStack, which is the only thing that writes to the figure.
 *
 *   - A strip chart plots what is moving. Millimetre-scale motion looks identical to no motion in
 *     a still frame, so a screenshot without the trace cannot distinguish "breathing" from
 *     "frozen". The trace is how a still frame carries evidence.
 *
 * The controls are the four dials an affect system will eventually drive: arousal (breath rate and
 * depth, pupil), cognitive load and attention (blink rate), conversation state (gaze policy), and
 * the gender axis of Identity, which reloads a different bake.
 *
 * URL parameters, for reproducible captures:
 *
 *   ?webgl          force the WebGL2 fallback tier. It has no velocity buffer, so `?aa` DOWNGRADES
 *                   to `msaa` on this tier rather than the page refusing to build — see the
 *                   comment on `aa` for the round in which `?webgl` rendered nothing at all.
 *   ?gender=0.75    start on a different bake
 *   ?preroll=6      advance the stack 6 s in fixed 1/60 steps before the first drawn frame, so a
 *                   captured frame is reproducible from the seed rather than from luck
 *   ?freeze         stop advancing after the pre-roll — a still pose at a known motion time. It
 *                   composes with ?capture, and until 2026-08-08 it did not: the capture hook
 *                   advanced the simulation unconditionally, so a "frozen" capture walked the
 *                   figure forward one step per screenshot. Every G1/G2/G4 number ever taken off
 *                   this page through capture.mjs before that date is a function of the harness's
 *                   step count. Frozen + captured is now N RENDERS of a STILL, which is also
 *                   exactly what a temporal AA mode needs in order to converge.
 *   ?seed=20260807  the motion stack's root seed
 *   ?trace=0        hide the strip chart
 *   ?bare           hide every overlay — controls, HUD, strip chart — for a clean plate. A critic
 *                   comparing this against a reference still wants pixels, not instrumentation.
 *   ?frame=body     frame the whole figure instead of a head-and-shoulders portrait
 *   ?height=0.18    override the framed height in metres. 0.18 is an eyes-only crop.
 *   ?pose=weight-left   which RestPose to stand in. `?pose=bind` shows the untouched bind pose,
 *                   which is the A side of the comparison the rest pose exists to win.
 *   ?arousal=0.8    starting value of a dial, so a capture can ask for a state rather than
 *                   needing a human to drag a slider. Same for ?load and ?attention.
 *   ?capture        stop the frame loop and hand the clock to `window.__SUGATA_STEP__`, so
 *                   tools/critic/capture.mjs can drive the page one fixed step at a time. It also
 *                   resets the renderer's FRAME STATE to a known epoch — see
 *                   `takeOverFrameLoop`, which until 2026-08-08 pinned the clock and left three
 *                   counters free-running.
 *   ?clockdefect=   deliberately break one part of that epoch. Six named ways, one of which is
 *                   what shipped; see `CAPTURE_CLOCK_DEFECTS`. Reached only from this parameter,
 *                   and they exist so `alive-capture-determinism.selftest.mjs` can prove itself
 *                   red against a PAGE rather than against a committed plate.
 *   ?skin=0         body keeps the shipped GLB material — the control for punch-list 3.2
 *   ?eyes=0         eye shells keep their shipped GLB materials — the control for 3.3. It switches
 *                   the SHADER and nothing else: the occlusion sheet stays on, so the difference
 *                   between this plate and the shipped one is the eye material alone. It used to
 *                   remove the sheet too — see `applyEyeShading` for what that cost G2.
 *   ?eyeocc=0       no eye occlusion sheet and no lacrimal strip — the control for 3.4, and the
 *                   other half of the eye's attribution pair
 *   ?cards=0        eyelash and eyebrow cards keep the shipped GLB material — the control for the
 *                   card shading, and the plate that proves gate G7 goes red
 *   ?wear=a,b       PHASE 9. Dress the figure. `?wear=female_casualsuit01,shoes01,fedora01` is
 *                   the catalogue; `?wear=` alone loads the wardrobe and wears nothing, which is
 *                   how to see the body swap on its own. Absent, NOTHING is imported and no
 *                   manifest is fetched, so the plate the seven gates are stated on is untouched
 *                   — see `WARDROBE_BODY_URL`. Needs the g050 bake; refused in words otherwise.
 *                   Live from the console as `sugata.wardrobe`.
 *   ?wearrace=      REJECTION PROOFS ONLY, and inert without `?wear`. Puts the dressing race back:
 *                   `unheld` is the defect that made every dressed plate stochastic,
 *                   `released-early` is the half-fix that looks correct. See
 *                   `WARDROBE_DRESS_DEFECTS`; gated by alive-capture-determinism.selftest.mjs.
 *   ?foundation     PHASE 9.8. Wear the foundation layer under whatever `?wear` asked for, so the
 *                   decency floor is visible on the page a judge captures. Implies the wardrobe:
 *                   `?foundation` alone dresses the figure in the floor and nothing else.
 *                   ⚠️ OPT-IN, and it must stay so — with a `decencyFloor` configured the body
 *                   does not draw until the first dress resolves, which changes the TIMING of any
 *                   plate captured before that promise settles. `?wear` without `?foundation`
 *                   keeps the pre-9.8 behaviour exactly.
 *   ?affect=joy     PHASE 5. Put a settled emotional expression on the face AND the body, through
 *                   `affect/ExpressionLayer.js` and `affect/PostureLayer.js`, composed over the
 *                   viseme and motion layers rather than replacing them. One of the
 *                   `EMOTION_PRESETS` in `affect-presets.js`, or `p,a,d` as three numbers for a
 *                   raw PAD point. Absent, nothing is imported.
 *   ?affectbody=0   The A side of the above, and the reason it exists is a measurement: before
 *                   `PostureLayer` landed, eight `?affect=` plates differed on the face and FIVE OF
 *                   SEVEN were bit-identical to neutral in the torso band, because the BAP
 *                   prescription had no actuator. Attribution needs a plate with the face on and
 *                   the body off, and `?affect=anger&affectbody=0` is it. Read on every plate, so
 *                   its absence is a plate the gate can compare against.
 *   ?identity=      PHASE 10. Apply MPFB detail targets to the figure's position buffer, once, at
 *                   load. `?identity=eyes/eye-scale-incr:1,nose/nose-width-decr:0.5` is the
 *                   general form. Absent, neither the catalogue nor the 10.8 MB of target data is
 *                   fetched. ⚠️ 10.7 and 10.9 are not built: the eyes, teeth and skeleton do NOT
 *                   follow the skin, measured at 15.000 mm of skin rise against 0.000 mm of
 *                   eyeball rise on a tall build. Expect to see it.
 *   ?nudge=2.5      Offset the FIGURE laterally by that many millimetres, after the pre-roll and
 *                   compatible with `?freeze`. It moves the BODY and not the camera on purpose — a
 *                   camera nudge changes perspective and parallax and is a different stimulus.
 *                   This exists for one measurement: the 2AFC staircase that would retire the
 *                   project's unmeasured 1.6 px indistinguishability floor. LEARNINGS §1.14a.
 *   ?statedefect=   🚩 KNOWN-BAD. Plant one whole-state light defect on the real rig, from the same
 *                   table `lighting.html` uses (`./light-defects.js`), so the light-state
 *                   fingerprint's rejection proofs are re-runnable ON THE PAGE THE SEVEN GATES ARE
 *                   MEASURED ON. One of decay, cutoff, shadowintensity, shadowfocus, rimlayer,
 *                   skyaxis, panelmirror, panelaim.
 *   ?grounddefect=  🚩 the same for the surface half: receiveshadow, metalness, emissive, desync,
 *                   tilt, tonemapped.
 *                   ⚠️ BOTH ARE INVISIBLE ON A `?bare` PLATE BY CONSTRUCTION — that is the property
 *                   they exist to demonstrate. `panelaim` moves three quarters of a frame at five
 *                   code values. The plate is identified only by its URL, by
 *                   `sugata.report().defects`, and by a console warning. A number quoted off one
 *                   of these without naming the parameter is a number about nothing.
 *   ?msaa=0         build the stage without any AA at all. Shorthand for ?aa=off.
 *   ?aa=taau|traa|msaa|off
 *                   which anti-aliasing. `taau` at 0.66 resolution scale is the DEFAULT and the
 *                   shipping configuration; `?aa=msaa` is the A side and the forward path every
 *                   Phase 2 motion number was measured on. Silhouette transitions that jump in a
 *                   single pixel: 17.9% here, 67.9% under MSAA, 75.0% with no AA.
 *   ?morphvel=off|hold|exact
 *                   whether morph targets contribute honest motion vectors. `exact` ships.
 *                   `off` is three r185 unpatched, where a HELD expression reports a large
 *                   constant velocity and fizzes at 15.96x the jitter floor against 1.60x — the
 *                   defect that kept this page off the temporal path, and the A side of 3.12.
 *   ?grade=1|0      run render/Grade.js — ACES, bloom at threshold 0.8, enveloped luminance-only
 *                   grain, vignette, RCAS after the transfer. ON by default; `?grade=0` is the A
 *                   side. Note that `?aa=msaa` alone does NOT take the grade off, so the fully
 *                   pre-2026-08-08 plate is `?aa=msaa&grade=0`.
 *   ?sharp=0.2      RCAS strength inside the TEMPORAL RESOLVE (TRAAPost), which defaults to none —
 *                   a sharpen in that position puts G4 out of band. Not to be confused with
 *                   ?gsharp, which is the grade's own and is the one that ships on.
 *   ?gsharp=none    remove the grade's RCAS pass, which is the A side of the G4 recovery claim.
 *                   Defaults to Grade.js's TEMPORAL_RECOVERY_SHARPNESS (1.2) on this page.
 *   ?cavity=0       skin without the baked hemisphere-visibility term — the A side of the cavity
 *                   occlusion, which darkens and SATURATES creases (lip seam, nostril, alar
 *                   crease, ear-to-skull gap, eye sockets) rather than greying them. `?cavity=0.5`
 *                   sweeps the strength.
 *   ?gtao=0         PUNCH-LIST 3.10. ON by default. Ground-truth ambient occlusion, the bent
 *                   normal fed to the ambient diffuse, and specular occlusion on the ambient
 *                   specular — `render/GTAO.js`. `?gtao=0` is the A side and is the pre-3.10
 *                   frame exactly: the hemisphere ambient goes back into the forward shader as a
 *                   `HemisphereLight` and no occlusion term exists anywhere.
 *                   ⚠️ THE AMBIENT MOVES WITH THE FLAG. With 3.10 on, `LightingRig` is built
 *                   `ambient: false` and the hemisphere is re-evaluated per pixel in the
 *                   composite. Two plates that differ on `?gtao` therefore differ on where the
 *                   ambient is computed as well as on whether it is occluded; the sub-flags below
 *                   are what separate the halves without moving that.
 *   ?gtaoq=low|medium|high
 *                   sample budget, and `low` — 8 samples at half resolution — is what SHIPS,
 *                   because that is what the timing said. GPU timestamps at 1080x1920 full body:
 *                   off 12.1494 ms p50, low 12.9949 (+0.845, p95 13.921), medium 14.0262 (+1.877,
 *                   p95 25.855), high 22.4699 (+10.320). Only `low` keeps BOTH p50 and p95 inside
 *                   the 16.6 ms budget, and it keeps four fifths of the occlusion depth. The full
 *                   table is beside `GTAO_SHIPPING_QUALITY` in `render/GTAO.js`.
 *   ?bentnormal=0   the ambient diffuse gathers along the GEOMETRIC normal instead of the bent
 *                   one. Occlusion unchanged, direction wrong — the A side for the bent normal
 *                   ALONE, and the only plate that attributes anything to it.
 *   ?specocc=0      the ambient specular is present and UN-OCCLUDED. This is the plastic look
 *                   punch-list 3.10 names, reproducible on the page a judge captures, and it is
 *                   the A side for specular occlusion separately from AO.
 *   ?ambspec=0      no ambient specular term at all — three's own behaviour, where a
 *                   `HemisphereLight` lights the diffuse half of a material and none of the
 *                   specular half. The attribution plate for the term this item ADDS.
 *                   ⚠️ IT IS ALSO THE G6 LEVER. Whole-image p0.1 luma at 900x1200 goes 0.00420 ->
 *                   0.00754 at portrait (band 0.004-0.016, in) and 0.01597 -> 0.01989 at
 *                   `?frame=body` (OUT). `&ambspec=0` reads 0.01597 at body, the pre-3.10 value,
 *                   so the lift is this term and it is the floor at grazing incidence.
 *   ?gtaoradius=0.035
 *                   world-space radius of the occlusion search, in metres. 0.035 ships and it is
 *                   swept in `render/GTAO.js` — three's own 0.25 m default steps clean over every
 *                   crease on a face, because with N samples the NEAREST tap is already radius/N
 *                   away and a nostril is 5 mm.
 *   ?gtaostrength=0 gamma on the visibility, and 0 is the one that matters: `pow( v, 0 )` is 1
 *                   everywhere, so `?gtaostrength=0&bentnormal=0&ambspec=0` is the deferred
 *                   ambient with every 3.10 term neutralised. It has to reproduce the
 *                   `HemisphereLight` it replaced, and whatever it does not reproduce is a defect
 *                   in the reconstruction rather than an effect. That is the identity control.
 *   ?gtaoview=ao|bent|specocc|ambient
 *                   replace the beauty image with one of 3.10's own intermediates. `ao` is the
 *                   visibility, `bent` the bent normal as a colour, `specocc` the specular
 *                   occlusion alone, `ambient` the whole ambient term this file adds and nothing
 *                   else. ⚠️ all four still go through ACES and the output transfer, so read them
 *                   as ORDERED and not as calibrated.
 *   ?gtaodefect=packed
 *                   🚩 KNOWN-BAD, in the same spirit as `?statedefect=`. Runs the horizon search
 *                   on normals put through `n*0.5+0.5` and renormalised — the `packNormalToRGB`
 *                   round trip `GBuffer.js` warns against, which confines every direction to the
 *                   positive octant. The plate looks entirely plausible and the occlusion is
 *                   wrong. This is `GTAO.selftest.mjs`'s rejection proof, re-runnable from a URL.
 *   ?specaa=0       skin keeps its raw region-map roughness — the A side of punch-list 3.11's
 *                   screen-space normal-variance filter. Measured on a 6 deg/s orbit: forehead
 *                   high-frequency temporal RMS 1.800 -> 1.410/255 with it on.
 *   ?ground=0       no ground plane, no contact occlusion — the attribution plate for 3.8's
 *                   floating-figure blocker. With the term on, the floor darkens toward a sole by
 *                   +0.0307 of luma over 128 px; with it off, -0.0012.
 *                   ⚠️ THAT IS A BODY-FRAMING NUMBER AND THE FLAG IS INERT AT PORTRAIT. Measured
 *                   2026-08-08 on `?bare&freeze&seed=1&aa=msaa&grade=0`, the deterministic forward
 *                   path: adding `&ground=0` renders BYTE-IDENTICAL to the base plate, because a
 *                   head-and-shoulders frame contains no floor. Add `&frame=body` and the two
 *                   plates differ. Nothing said so, and a portrait A/B of this flag therefore
 *                   attributes zero to it and looks like a working control while being none.
 *                   Both halves are gated by `alive-toggles.selftest.mjs`.
 *   ?hair=1         PUNCH-LIST 3.5/3.6. Load `assets/hair/bob01/`'s groom for this bake, shade it
 *                   with `material/HairMaterial.js` — Karis' closed-form Marschner, three lobes —
 *                   and put its fragments through `render/HairOIT.js`'s recommended arm.
 *                   OPT-IN; see `HAIR_GROOM_ID` for why the default plate still has no hair on it
 *                   and what the round that flips it owes. Absent this key nothing is fetched and
 *                   the keys below are never consulted.
 *   ?hairoit=       PUNCH-LIST 3.6/3.21, and it is the key that decides how a dozen overlapping
 *                   cards resolve into one pixel. `blend` | `cutout` | `hash` | `stochastic` |
 *                   `wboit`. `stochastic` SHIPS from 3.21 and `hash` is its A side — the two differ
 *                   in one term, whether the dither threshold advances per frame, and that term is
 *                   the difference between a coverage estimate the temporal resolve can integrate
 *                   and a pattern it can only reproject. `HairOIT.js`'s ## THE COVERAGE DECISION
 *                   has the measurement; the console handles are
 *                   `sugata.session.hairMaterial.hairDitherStep` (null | 'frozen-dither' |
 *                   'white-dither') and `.hairDitherPhase`, both live with no reload.
 *                   ⚠️ `stochastic` cannot run under `?aa=msaa` and falls back to `cutout` with a
 *                   warning — see `attachHair`. The default is
 *                   `HairOIT.js`'s own `HAIR_OIT_DEFAULT_MODE` rather than a literal typed here, so
 *                   the page and the shipping recommendation cannot drift apart. `blend` is the
 *                   DEFECT arm and is the control every other one is measured against; `cutout` is
 *                   what the groom's glTF asks for and what this page ran until this round; `wboit`
 *                   is the best picture and needs the deferred path and an adapter that allows
 *                   40 bytes per sample of colour attachment. See `attachHair` for what each arm
 *                   costs ON THIS PAGE — every delta in `HairOIT.js`'s header was taken on
 *                   `stage.html`, against a control frame a fraction of this one's, so none of
 *                   them transfers. Re-measured here.
 *   ?hairbsdf=0     the groom with its shipped GLB material instead — the A side of 3.5 on its own,
 *                   holding the GEOMETRY constant. This is the plate that shows what a card looks
 *                   like under an isotropic lobe about its plane normal, which is the thing 3.5
 *                   exists to replace.
 *   ?hairlobes=r    which of R, TT and TRT are live, comma separated. DEFAULT `r,trt` — TT ships
 *                   OFF, see `HAIR_DEFAULTS.weightTT` for the measurement, and `?hairlobes=r,tt,trt`
 *                   is the plate that shows why.
 *                   🎯 THIS IS HOW THE DUAL BAND IS MEASURED SEPARATELY. `?hairlobes=r` is the
 *                   primary band alone and `?hairlobes=trt` the secondary alone, so their
 *                   longitudinal separation is a measurement over two plates rather than an
 *                   inference from one. A gate that only ever saw their sum could not tell a dual
 *                   band from one wide one.
 *   ?hairscatter=0  remove slide 39's multiple-scattering term, which Karis calls "a giant
 *                   artistic hack and not physically based in the slightest". ROUND 26: it now
 *                   takes any scalar in [0,8], so the pedestal can be SWEPT and not only removed.
 *   ?hairbeta=0.2   PUNCH-LIST 3.5, round 26. The R lobe's longitudinal width, `roughnessR`.
 *                   🚩 IT IS IN KARIS' VARIABLE, β_K = 2 β_Marschner. Marschner Table 1's measured
 *                   β_R of 5°…10° is 0.174533…0.349066 HERE, and reading 0.26 as "14.9°" is the
 *                   unit error that sent one round looking for a defect that was not there.
 *                   β_TT and β_TRT follow by Marschner's ratios, so this is ONE free parameter.
 *   ?hairweightr=4  scale the R lobe. Composes with `?hairlobes=` rather than replacing it.
 *                   ⚠️ THESE THREE ARE THE CONTRAST BUDGET AND NONE OF THEM IS ON THE JUDGED URL.
 *   ?hairvis=0      remove the card-scale side visibility. 🚩 THE PLATE THIS PRODUCES IS THE ONE
 *                   THAT MADE THE TERM NECESSARY: with no shadow on the rim panel, an unoccluded
 *                   Marschner lobe takes the rim's #0f30ff at full strength on every hair pixel in
 *                   the frame, including the cards in front of the head, and the groom renders
 *                   BLUE. `HairLightingModel.scatter` carries the measurement.
 *   ?hairrootao=0   remove the root darkening
 *   ?hairdefect=constant-tangent
 *                   🚩 the rejection proof for the anisotropy: a fixed VIEW-space strand direction
 *                   for every fragment, so the highlight is welded to the screen instead of running
 *                   across the strand. It renders a plausible picture. See `HAIR_DEFECTS`.
 *   ?hairmotion=0   PUNCH-LIST 6.6. The A side of the hair DYNAMICS, which ship ON with `?hair=1`.
 *                   `motion/HairDynamics.js` — DFTL on the card centrelines, one WebGPU compute
 *                   pass a frame — reads the head bone the idle stack is already turning and moves
 *                   the groom's card centrelines behind it. `?hairmotion=0` leaves the groom a rigid
 *                   SkinnedMesh welded to the head, which is what every plate before this round
 *                   was, and it is the control every judged plate needs. See `attachHairDynamics`
 *                   for what the toggle is worth on a STILL plate, which is the property that makes
 *                   it a control rather than a second stimulus.
 *   ?shadows=0      build the rig without its shadow-casting half (2.62 ms, measured)
 *   ?gputime=1      request GPU timestamp queries at device creation, so
 *                   `renderer.resolveTimestampsAsync('render')` and `info.render.timestamp` work.
 *                   ⚠️ It CANNOT be turned on later — `renderer.trackTimestamp = true` after
 *                   `init()` leaves the timestamp undefined forever, measured 0 of 200 samples
 *                   valid — which is why this is a URL key rather than a console call. Off by
 *                   default: a plate captured for pixels should not pay for a number nobody reads.
 *   ?ov=rim.irradiance:0,kicker.irradiance:0
 *                   override LightingRig placement fields, same syntax as lighting.html. One
 *                   plate per light is how a colour cast gets attributed to a light rather than
 *                   guessed at.
 */

import {
    Color,
    Matrix4,
    Mesh,
    MeshPhysicalNodeMaterial,
    MeshStandardNodeMaterial,
    PlaneGeometry,
    // three's own skinning `Skeleton`, ALIASED because this file already imports the project's
    // `figure/Skeleton.js` — a different class with the same name, which walks a figure's bones for
    // the pose system. Importing both unaliased would silently shadow one of them.
    Skeleton as SkinSkeleton,
    Vector3
} from 'three/webgpu';
import { max, texture, vec3, vec4 } from 'three/tsl';
import { Box3, SRGBColorSpace } from 'three';

import { plantGroundDefect, plantLightDefect } from './light-defects.js';

import { Stage } from '../../core/src/render/Stage.js';
import { LightingRig } from '../../core/src/render/LightingRig.js';
import { GroundContact } from '../../core/src/render/GroundContact.js';
import { Grade, TEMPORAL_RECOVERY_SHARPNESS } from '../../core/src/render/Grade.js';
import { createGroundTruthOcclusion } from '../../core/src/render/GTAO.js';
import { EyeMaterial } from '../../core/src/material/EyeMaterial.js';
import { buildEyeOcclusion } from '../../core/src/material/EyeOcclusion.js';
import {
    applySkinMaterial,
    cavityMapUrlFor,
    createSkinMaterial,
    curvatureMapUrlFor
} from '../../core/src/material/SkinMaterial.js';
import { HAIR_DEFECTS, createHairMaterial } from '../../core/src/material/HairMaterial.js';
import {
    HAIR_OIT_DEFAULT_MODE,
    HAIR_OIT_MODES,
    configureHairMaterial,
    viewDepthExtent
} from '../../core/src/render/HairOIT.js';
import {
    HAIR_VELOCITY_DEFAULT_MODE,
    HAIR_VELOCITY_MODES,
    installHairVelocity
} from '../../core/src/render/HairVelocity.js';
import { Figure } from '../../core/src/figure/Figure.js';
import { Identity } from '../../core/src/figure/Identity.js';
import { RestPose } from '../../core/src/figure/RestPose.js';
import { Skeleton } from '../../core/src/figure/Skeleton.js';
import { MotionStack, createMotionTarget } from '../../core/src/motion/MotionStack.js';
import { Blink } from '../../core/src/motion/Blink.js';
import { BodyIdle } from '../../core/src/motion/BodyIdle.js';
import { Breath } from '../../core/src/motion/Breath.js';
import { FacialIdle } from '../../core/src/motion/FacialIdle.js';
import { Gaze } from '../../core/src/motion/Gaze.js';
import { HandIdle } from '../../core/src/motion/HandIdle.js';
import { IdleMotion } from '../../core/src/motion/IdleMotion.js';
import { Pupil } from '../../core/src/motion/Pupil.js';
import { Sway } from '../../core/src/motion/Sway.js';

// --- framing ---------------------------------------------------------------------------------

// 24–40° is the portrait range. 26° puts the camera ~1.1 m out, which is long enough that the
// nose does not balloon the way a 40° lens at half a metre would.
const PORTRAIT_FIELD_OF_VIEW_DEGREES = 26;

// Vertical extent of the frame, in metres: a little above the crown down to the top of the chest.
// Wide enough that the sternum is in shot — breath is 2–3 mm of chest and has to be *in frame* —
// tight enough that an eyelid is dozens of pixels tall, which is what blink needs.
const PORTRAIT_HEIGHT_METRES = 0.42;

// Where the eye line sits in the frame, measured from the top. A third is the portrait rule, and
// anchoring on the eyes rather than on the crown is what makes a tighter crop still land on the
// face instead of climbing up the forehead.
const EYE_LINE_FROM_TOP = 1 / 3;

// How far off the facing axis the camera stands. Dead-on is flatter and reads as a mugshot; 12°
// gives the cheek and jaw some form without turning the eyes away from the viewer.
const CAMERA_AZIMUTH_DEGREES = 12;

// The mesh the eye line is read off. MakeHuman names its eyeball proxy for its topology rather
// than its anatomy, and GLTFLoader strips the dot, so 'Human.high-poly' arrives as
// 'Humanhigh-poly'. Matched by pattern rather than by an exact string on purpose: this used to be
// the literal 'Humanlow-poly', and when the pipeline swapped proxies the lookup returned undefined
// and eyeLineHeight quietly fell back to a guess. A miss now says so out loud.
const EYEBALL_MESH_PATTERN = /high-poly|low-poly|eyeball/i;

// How much air to leave around the figure in the full-body frame, as a fraction of its height.
// A body cropped hard at crown and heel reads as a passport photo of a corpse; a little headroom
// is what lets the eye see the silhouette, which is the whole point of looking at a rest pose.
const BODY_FRAME_MARGIN = 1.10;

// The posture the figure stands in when no URL says otherwise.
const DEFAULT_REST_POSE = 'relaxed-standing';

// --- the backdrop ----------------------------------------------------------------------------

/**
 * The backdrop. The look spec wants it 1.5–2.0 stops below the subject, cooler and desaturated —
 * a black void is as wrong as a blown one, because the silhouette then has nothing to separate
 * from and the head reads as a cut-out.
 *
 * Its base colour is BLACK and its emissive carries the whole value, so the card states its own
 * exposure and the rig cannot touch it. That is deliberate, and the reason recorded here before
 * was wrong in a way worth correcting: it said a RectAreaLight behind the figure "throws its light
 * forward, away from anything further back", so lighting a card would need a fifth light. The key
 * and the fill do point at the card and would light it perfectly well. The real obstacle, isolated
 * by execution on the lighting browsercheck, is that a RectAreaLight illuminates only the
 * half-space in FRONT OF ITS OWN PLANE, with a hard cut at the plane — on a curved subject that
 * boundary is invisible, but across a large flat card behind the figure the rim and kicker draw a
 * straight-edged wedge. Rim and kicker at zero give a clean backdrop; rim and kicker alone give
 * black plus one hard wedge. A black-albedo emissive card cannot show that seam at all, which is
 * why this one stays as it is rather than becoming a lit surface with the arrival of 3.8.
 */
// Gate G6 asks for a whole-image 0.1st-percentile luma of 0.004-0.016 and this hex is the whole
// of what it measures ONCE THE CARDS HAVE A FLOOR: the backdrop is then the darkest thing in
// frame, and being emissive it lights nothing, so sweeping it moves the black point and touches
// nothing else.
//
// ⚠️ THE SWEEP THAT USED TO STAND HERE IS SUPERSEDED AND IS NOT APPENDED TO, BECAUSE IT WAS TAKEN
// ON A DIFFERENT PICTURE. It read `0x11151f / 0x0a0d13 / 0x050709` -> portrait 0.02047 / 0.00842 /
// 0.00393, body 0.03785 / 0.02467 / 0.01652, at a time when the eyelash and eyebrow cards rendered
// at literally RGB(0,0,0) and OWNED the whole tail — so on the portrait plate it was measuring the
// cards through the backdrop's name. See CARD_ALBEDO_FLOOR for the 1,431 pure-black pixels.
//
// 🎯 RE-MEASURED AT INTEGRATION, on the shipped default with the card floor in place, ONE FLAG
// APART, `?bare&freeze&seed=1&capture` 60 steps at 900x1200 dpr 1:
//
//   | backdrop  | portrait p0.1 | body p0.1 |
//   |-----------|--------------:|----------:|
//   | 0x050709  |       0.00393 |   0.01260 |   portrait 0.00007 UNDER the 0.004 floor
//   | 0x070a0e  |       0.00420 |   0.01597 |   both in band
//
// 0x050709's portrait reading is exactly 1/255 — it IS the backdrop's own output code value, so
// the failure was never about the picture, it was about the darkest surface in frame sitting one
// code value below where the gate starts counting.
//
// ⚠️ AND THE WINDOW IS ONE OUTPUT CODE VALUE WIDE. Body clears the 0.016 ceiling by 0.00003, i.e.
// 0.2% of the band, and the next step up (0x090c12) puts body OUT at 0.01989. That is not a
// comfortable constant and it should not be read as one: it is a value chosen so BOTH framings can
// be measured at all, on a gate the punch list already records as asking one question of two
// populations. The durable fix is PUNCHLIST's, not this line's — state G6 against a plate that HAS
// an environment, rather than against a void with a card in front of it.
const BACKDROP_EMISSIVE = 0x070a0e;
const BACKDROP_DISTANCE_METRES = 1.9;

// --- the wardrobe ------------------------------------------------------------------------------

/**
 * The wardrobe-ready body, and the manifest that says what may be worn over it.
 *
 * 🎯 WHY `?wear` IS OPT-IN AND THE DEFAULT PLATE IS UNTOUCHED. This page carries every measured
 * gate in `docs/PROGRESS.md` and it is the page 8.1's blind critic captures. Dressing changes the
 * silhouette, the draw-call count and the body's own triangle count, and loading the wardrobe body
 * changes the bake's sha256 — so with no `?wear` in the URL nothing here is imported, nothing is
 * fetched, and the plate is byte-for-byte the plate the seven gates are stated on. Verified by
 * execution at integration, not asserted: the shipped default's sha256 is unchanged by this file's
 * wardrobe code being present.
 *
 * ⚠️ THE BODY IS A DIFFERENT ARTEFACT FROM `assets/figures/figure_g050.glb`, DELIBERATELY. It is
 * the same MPFB2 build plus the per-vertex `_HIDE_*` attributes the runtime rebuild needs, which
 * costs 174,708 bytes (58,068 per garment, as FLOAT32) and — the reason it is not simply merged —
 * a different sha256 on a file several committed gates are measured against. Merging them is the
 * right end state and belongs in the same round as that re-measurement, not before it.
 *
 * ⚠️ AND ONLY `g050` EXISTS. Punch-list 9.4 owns the other four bakes and the fit thresholds that
 * would make them trustworthy, so `?wear` with `?gender` anywhere other than 0.5 is REFUSED in
 * words rather than silently ignored — a wardrobe that quietly does nothing on four fifths of the
 * identity range is worse than one that says which fifth it has.
 */
const WARDROBE_BODY_URL = new URL( '../../../assets/wardrobe/body/g050.glb', import.meta.url ).href;

// --- the hair ------------------------------------------------------------------------------

/**
 * The groom, and why `?hair` is OPT-IN on the page that carries every committed gate.
 *
 * ⚠️ NO CARD COUNT IS WRITTEN IN THIS FILE ANY MORE, and the omission is deliberate. It said "254"
 * for two rounds after the groom stopped being 254, REQ-067 was filed to say so, and while THIS
 * round's wiring was being measured the generator rebuilt `g050.glb` again: `verify_glb.mjs` read
 * it as **294 cards / 10,648 verts at 2,774,184 bytes** early in the session and as **370 cards /
 * 13,232 verts at 2,840,540 bytes** an hour later, with the other four bakes still at 294. The
 * bakes are gitignored build products, so a clean tree is no evidence about them.
 * `tools/figure-pipeline/verify_glb.mjs` prints the census of whatever is on disk; nothing here
 * repeats it, and nothing here should.
 *
 * Punch-list 3.6 built `assets/hair/bob01/` — five identity bakes of the groom plus a
 * four-sheet atlas — 3.5 is the BSDF that shades it, and `render/HairOIT.js` is how its fragments
 * reach the frame buffer. All three now compose on this page behind the one key.
 *
 * 🚩 AND THE DEFAULT PLATE IS STILL UNCHANGED, DELIBERATELY. This was RE-DECIDED this round rather
 * than inherited, because the case for flipping it is real: a blind judge told to capture "the
 * avatar" captures `alive.html`, and what they get is bald. It stays opt-in anyway, and the reason
 * is that flipping it is not a one-line change to this file — it MOVES EVERY COMMITTED NUMBER IN
 * THE REPOSITORY. G1 through G7, every region rect in `regions.lighting-portrait.json`, every
 * recorded plate sha256, the whole-scene fingerprint `alive-toggles.selftest.mjs` walks, and the
 * baselines other agents are measuring against concurrently. A round that flips the default owes a
 * re-measurement of all seven gates on the new picture, and taking that unilaterally in the round
 * that first composed the three pieces would be publishing numbers nobody re-derived — the exact
 * failure this project keeps logging. It is filed as a request instead; see the round report.
 *
 * So `?hair=1` is the plate 3.5 and 3.6 are measured on, `HairMaterial.selftest.mjs` takes every
 * reading it reports from that plate, and the judge's hair plates are captured by URL.
 *
 * ⚠️ ONE BAKE EXISTS PER IDENTITY AND THE NAMES MUST MATCH. The groom is generated per figure bake
 * because the scalp region is a vertex group over the basemesh and its crown height tracks the
 * identity (1.5912 m at g000 to 1.7291 m at g100); a g050 groom on a g100 head sits inside the
 * skull. The file is resolved from the same bake name the curvature and cavity maps are, so a
 * `?gender` the groom has no bake for fails in words rather than rendering a sunken cap.
 */
const HAIR_GROOM_ID = 'bob01';

/**
 * Keyed on the FIGURE's bake name — what `bakeNameFrom` returns — because that is the only name the
 * load path has in hand, and mapped to a RESOLVED URL rather than to a file name.
 *
 * 🚩 EVERY ENTRY IS A LITERAL INSIDE `new URL( …, import.meta.url )` AND THAT IS NOT VERBOSITY.
 * `IDENTITY_CATALOGUE_URL` below records the rule: a URL built by string concatenation is invisible
 * to rollup, so `vite build` emits no asset and the built page 404s on data the dev server served
 * happily. This table was written the concise way FIRST — one directory URL plus
 * `${ directory }${ bake }.glb` — and it 404'd on the DEV server too, because vite's asset rewrite
 * fires only on a static string and a trailing-slash directory is not one. The failure arrives as
 * `SyntaxError: Unexpected token '<'` out of `GLTFLoader.parse`, which is `index.html` being parsed
 * as glTF, and it names neither this file nor the missing asset.
 *
 * A bake with no groom is therefore a MISS in this map rather than a 404 discovered at fetch time,
 * so `attachHair` can refuse in words before it requests anything.
 */
const HAIR_BAKES = new Map( [
    [ 'figure_g000', new URL( '../../../assets/hair/bob01/g000.glb', import.meta.url ).href ],
    [ 'figure_g025', new URL( '../../../assets/hair/bob01/g025.glb', import.meta.url ).href ],
    [ 'figure_g050', new URL( '../../../assets/hair/bob01/g050.glb', import.meta.url ).href ],
    [ 'figure_g075', new URL( '../../../assets/hair/bob01/g075.glb', import.meta.url ).href ],
    [ 'figure_g100', new URL( '../../../assets/hair/bob01/g100.glb', import.meta.url ).href ]
] );

/**
 * The two SIDECAR sheets, which no GLB carries.
 *
 * `albedo.png` and `normal.png` are embedded in every groom bake; `flow.png` (strand tangent, root
 * →tip parameter, strand id) and `depth.png` (depth within the bundle) are not, because glTF has no
 * socket for either. They are shared across all five bakes — one atlas, one seed — so they are
 * named once here rather than derived per identity.
 */
const HAIR_SHEET_URLS = {
    flow: new URL( '../../../assets/hair/bob01/flow.png', import.meta.url ).href,
    depth: new URL( '../../../assets/hair/bob01/depth.png', import.meta.url ).href
};

// Phase 10. Written as a bundler-visible `new URL(..., import.meta.url)` for the reason
// `IdentityTargets.js`'s own region table gives: a URL built by string concatenation is invisible
// to rollup, so `vite build` emits no asset and the built page 404s on data the dev server served
// happily. Only fetched when `?identity=` asked for something.
const IDENTITY_CATALOGUE_URL = new URL( '../../../assets/identity/catalogue.json', import.meta.url ).href;
const WARDROBE_MANIFEST_URL = new URL( '../../../assets/wardrobe/manifest.json', import.meta.url ).href;

/** The one bake the wardrobe has fragments for. See WARDROBE_BODY_URL. */
const WARDROBE_BAKE = 'figure_g050';

const FIXED_STEP_SECONDS = 1 / 60;

/**
 * A `URLSearchParams` that REMEMBERS WHICH KEYS IT WAS ASKED FOR.
 *
 * 🎯 This exists so the toggle surface of this page is a MEASUREMENT rather than a list somebody
 * maintains. `alive-toggles.selftest.mjs` gates the claim "one toggle switches one subsystem", and
 * it can only gate the toggles it has been told about — so for two rounds it gated eight of them
 * while this file quietly read thirty-odd keys, and a confound planted on any of the other
 * twenty-something passed it 24/24. A hand-written inventory of a thing the code is free to change
 * is not an inventory; it is a hope.
 *
 * Recording the reads makes the page state its own surface, and the gate then FAILS on any key it
 * has no classification for. Adding a `query.get( 'newthing' )` below therefore breaks the build
 * until somebody says, in one line, whether it is a subsystem switch or not.
 *
 * ⚠️ ONE HONEST LIMIT, and it is why this is not the only new check. It records keys that were
 * ACTUALLY READ, so a key consulted only inside a branch this plate did not take goes unrecorded.
 * `buildGrade`'s keys are the live example: they are read only when the grade is on. The gate
 * therefore unions the surface across every plate it loads rather than trusting one, and the
 * whole-scene fingerprint below is the check that does not depend on this inventory at all.
 *
 * `get` and `has` are the only two methods this file uses; anything else would arrive as
 * `undefined` at the call site rather than silently escaping the recorder.
 */
function recordingQuery( search ) {

    const parameters = new URLSearchParams( search );
    const keysRead = new Set();

    return {
        get: ( key ) => {

            keysRead.add( key );
            return parameters.get( key );

        },
        has: ( key ) => {

            keysRead.add( key );
            return parameters.has( key );

        },
        keysRead: () => [ ...keysRead ].sort()
    };

}

// --- boot ---------------------------------------------------------------------------------

async function boot() {

    const query = recordingQuery( window.location.search );
    const hud = document.getElementById( 'hud' );

    // ⚠️ "MSAA IS ON HERE" IS WHAT THIS COMMENT USED TO OPEN WITH, AND IT HAS BEEN FALSE SINCE THE
    // PAGE MOVED TO TAAU. The default is `?aa=taau` — see the `aa` line below — and MSAA is now the
    // A side rather than the shipped state. Measured on the shipped default plate,
    // `?bare&freeze&seed=1`, by `alive-toggles.selftest.mjs`: `multisampleSamples 0`, and
    // `?aa=msaa` takes it `0 -> 4`. The stale line matters because a reviewer who believes it
    // captures `?msaa=0` thinking it is turning something off, and last round one did.
    //
    // What survives from that paragraph is the COUPLING, which is still live: the eyelash and
    // eyebrow cards are alpha-to-coverage, and alpha to coverage on a single-sampled target
    // silently degrades to the same binary cut it replaced — so `applyCardShading` is told which
    // target it got and the two can never disagree. On the default TAAU path it is told `false`,
    // and the temporal resolve antialiases those cards better than coverage did (27.1% vs 44.5%
    // single-pixel transitions, recorded below).
    //
    // 🚩 AND IT IS GENUINELY ANTI-ALIASING THIS PAGE. An earlier version of this comment said that
    // with 3.12 open "there is nothing else anti-aliasing this page", and that was measured FALSE:
    // `Renderer._getFrameBufferTarget()` builds the tone-mapping intermediate with
    // `samples: this.samples`, so `antialias: true` really does multisample a forward tone-mapped
    // frame. Measured on the head silhouette at 900x1200, largest single-pixel luma jump across
    // the edge: 0.6933 with MSAA, 0.8733 with `?msaa=0`. A whole review round was spent chasing a
    // terminator defect whose numbers reproduce ONLY on the toggle-off plate.
    //
    // What MSAA does NOT do is anything at all for SHADING aliasing: under a moving camera the
    // flat-forehead high-frequency temporal RMS reads 1.408/255 with and without it, identical to
    // three decimals. That is what `?specaa` (punch-list 3.11) and temporal AA are for.
    //
    // 🎯 AND MSAA IS NO LONGER THE DEFAULT. The blocker that kept the page on the forward path was
    // punch-list 3.12's held-morph defect — three reports a large constant motion vector for a
    // morph target whose weight has not changed, so a held expression fizzed. That is fixed at
    // source in `render/MorphVelocity.js`, which supplies the previous-frame morphed position:
    // jawOpen HELD at 0.8 with the camera still, converged to frame 150, goes from 15.96x the
    // jitter floor to 1.60x. `?morphvel=off` is three r185 unpatched and is the A side.
    //
    // With that gone, the measurement decides it. One run at 3840x5120 — the width G4's band is
    // stated at — converged to frame 60 with a ZERO simulation step, so packagesDigest cannot
    // differ between rows:
    //
    //   | configuration           |     G1 |     G4 |   G5   |   G6    |   G7    |
    //   |-------------------------|-------:|-------:|-------:|--------:|--------:|
    //   | 4x MSAA, no grade       | 1.6163 | 1.7457 | 2.0e-6 | 0.00001 | 0.00070 |
    //   | TAAU 0.66 + grade + 1.2 | 1.6621 | 1.6291 | 2.0e-6 | 0.00001 | 0.00068 |
    //
    // Both pass; TAAU is better centred in G4's 1.5-2.1 band. What decides it is EDGES, which is
    // what anti-aliasing is actually for, at 900x1200 converged to frame 300: the share of
    // silhouette transitions that jump in a single pixel goes 67.9% -> 17.9%, a 3.8x improvement,
    // and the eyelash/brow card band 44.5% -> 30.8%.
    //
    // ⚠️ THAT LAST NUMBER REVERSES A CLAIM THIS FILE USED TO MAKE. Alpha to coverage needs MSAA,
    // and 3.12 recorded that turning MSAA off would turn the card anti-aliasing off with it.
    // Measured, it goes the other way: the temporal resolve antialiases the lash and brow cards
    // BETTER than alpha to coverage did (27.1% TAAU / 35.5% TRAA / 44.5% MSAA / 68.7% no AA).
    //
    // What TAAU costs that MSAA does not: a 0.1176/255 per-pixel temporal residual on flat skin
    // with a STILL camera, against MSAA's exact 0.0000 — a forward frame of a static scene being
    // bit-identical. That is well inside the 1.41/255 this project already accepts from 3.11's
    // post-fix camera-motion figure. GPU timestamp index at 1920x1080, free-running: 7.31 ms ->
    // 21.36 ms, both holding 120 fps on this machine, so nothing here is frame-limited at 1080p —
    // and on weaker hardware `?aa=msaa` is one parameter away.
    const requestedAA = query.get( 'aa' ) ?? ( query.get( 'msaa' ) === '0' ? 'off' : 'taau' );
    const forceWebGL = query.has( 'webgl' );

    // 🚩 `?webgl` USED TO RENDER NOTHING AT ALL, and it had done since TAAU became the default.
    // This branch wrote a sentence into the HUD and RETURNED BEFORE `Stage` was constructed. The
    // canvas therefore stayed at its untouched 300x150, `window.sugata` was never defined and
    // `window.__SUGATA_STEP__` never appeared — so `capture.mjs`, `measure.mjs` and every gate in
    // the repo timed out on the one flag a reviewer reaches for first. The fallback tier had to be
    // invoked with THREE flags to work, which is not a fallback.
    //
    // ⚠️ ONE THING THE PHASE 8 DIAGNOSTIC SAID ABOUT THIS IS NOT TRUE and it is worth writing down
    // rather than quietly fixing: it recorded `?webgl&bare` as "a completely blank, silent page"
    // because `?bare` hides the HUD. It does not — the `?bare` branch is fifty lines BELOW this
    // one, so the early return ran first and the HUD was never hidden. Measured on the refusing
    // build: `getComputedStyle( hud ).display` is `block` and its height is non-zero under
    // `?webgl&bare` and under `?webgl` alike, both showing the refusal text. The page said why it
    // was empty. What it did not do is render, and that is the whole of the defect.
    //
    // What replaces the refusal is a DOWNGRADE. WebGL2 genuinely has no velocity buffer, so traa
    // and taau genuinely cannot run on it — but the right answer to "this tier cannot do the
    // default" is to serve the tier's own default, not to serve nothing. Measured at 450x600,
    // `?webgl&aa=msaa&bare&freeze&seed=1&capture`: canvas 450x600, backend `webgl2`,
    // `renderer.samples` 4, 63.51% of the frame above black — against canvas 300x150, no
    // `sugata`, `__SUGATA_STEP__` absent on the refusing path.
    //
    // ⚠️ IT DOWNGRADES `?aa` AND NOTHING ELSE. The 7/7 recipe the Phase 8 round measured was
    // `?webgl&aa=msaa&gsharp=none` (G4 2.0587), and it would be easy to read that as "the tier
    // also wants the grade's RCAS pass off". `?gsharp` is an A/B toggle with its own attribution,
    // this fallback has no measurement saying RCAS costs the WebGL2 tier a gate, and a fallback
    // that silently moves two dials cannot be attributed. `?webgl&aa=msaa` renders with RCAS on —
    // same 63.51%, no page errors — and the 7/7 recipe is still reachable verbatim. One dial.
    const aa = ( forceWebGL && ( requestedAA === 'traa' || requestedAA === 'taau' ) )
        ? 'msaa'
        : requestedAA;

    if ( aa !== requestedAA ) {

        console.warn( `alive: ?aa=${ requestedAA } needs the velocity buffer, which WebGL2 does ` +
            'not have. The WebGL2 tier is rendering at ?aa=msaa instead. Drop ?webgl for the ' +
            'temporal path, or say ?aa=msaa to silence this.' );

    }

    // MSAA and temporal AA are mutually exclusive and `Stage` throws on the pair. The grade needs
    // the deferred pipeline too, and both now ship ON, so this page's default path is the DEFERRED
    // one.
    //
    // ⚠️ THE COST OF THAT IS REAL AND IT IS NOT A RENDER COST. Every Phase 2 motion number — every
    // travel.mjs band figure, every heatmap, every clip-based statistic in PROGRESS.md — was
    // measured on the forward path. They are not invalidated, but they are no longer same-build
    // comparisons, and anything A/B'd across this commit has to be re-run on one side or pinned
    // with `?aa=msaa&grade=0` on both.
    const temporalAA = ( aa === 'traa' || aa === 'taau' ) ? aa : 'off';
    const multisampled = aa === 'msaa';
    const wantsGrade = query.get( 'grade' ) !== '0';

    // Punch-list 3.10. Read here, next to the other two default-on post stages, because it wants
    // the same two things they want: the deferred pipeline, and a decision taken before
    // `LightingRig` is constructed. The rig loses its `HemisphereLight` when this is on — see
    // `Stage.setAmbientOcclusion` — so the flag has to be known before the rig exists, not after.
    const occlusion = {
        enabled: query.get( 'gtao' ) !== '0',
        quality: query.get( 'gtaoq' ) ?? undefined,
        bentNormal: query.get( 'bentnormal' ) !== '0',
        specularOcclusion: query.get( 'specocc' ) !== '0',
        ambientSpecular: query.get( 'ambspec' ) !== '0',
        defect: query.get( 'gtaodefect' ) ?? 'none',
        view: query.get( 'gtaoview' ) ?? 'off',
        strength: query.has( 'gtaostrength' ) ? Number( query.get( 'gtaostrength' ) ) : undefined,
        radius: query.has( 'gtaoradius' ) ? Number( query.get( 'gtaoradius' ) ) : undefined
    };

    // 🎯 PUNCH-LIST 3.5/3.6, AND THE READ IS HERE RATHER THAN BESIDE THE REST OF THE HAIR STATE
    // BECAUSE THE OIT ARM IS A PROPERTY OF THE RENDER PASS. Only `wboit` allocates `hairAccum` and
    // `hairWeight`, and an attachment set belongs to the render target the pass was built with —
    // `Stage.create` is the last moment it can be chosen, and `Stage` refuses in words if the
    // adapter cannot carry it. Reading it here also keeps the property `readHairRequest` documents:
    // the sub-keys are consulted ONLY when `?hair=1` is present, so a bare plate's recorded toggle
    // surface carries `hair` and nothing else.
    const hairEnabled = query.get( 'hair' ) === '1';
    const hairRequest = hairEnabled ? readHairRequest( query ) : null;

    const stage = new Stage();
    await stage.create( document.getElementById( 'stage' ), {
        fieldOfView: PORTRAIT_FIELD_OF_VIEW_DEGREES,
        near: 0.01,
        far: 50,
        forceWebGL,
        antialias: multisampled,
        pipeline: temporalAA !== 'off' || wantsGrade || occlusion.enabled,

        // 🚩 GPU TIMESTAMPS HAVE TO BE ASKED FOR AT DEVICE CREATION AND CANNOT BE TURNED ON LATER,
        // which is why this is a URL key and not a console call. `renderer.trackTimestamp = true`
        // after `init()` silently leaves `info.render.timestamp` undefined forever — measured, 0 of
        // 200 samples valid on three r185 — because the `timestamp-query` feature was never
        // requested of the adapter. Off by default: the queries cost a little every frame, so a
        // plate captured for pixels must not be paying for a number nobody reads.
        trackTimestamp: query.get( 'gputime' ) === '1',
        temporalAA,
        resolutionScale: query.has( 'scale' ) ? Number( query.get( 'scale' ) ) : undefined,
        sharpness: query.get( 'sharp' ) === 'none' ? null
            : ( query.has( 'sharp' ) ? Number( query.get( 'sharp' ) ) : undefined ),
        // The A side of punch-list 3.12. `off` is three r185 unpatched — a held morph reporting a
        // large constant motion vector — and it is the cheapest possible rejection proof that the
        // fix is doing anything. `hold` and `exact` must agree exactly on a held morph, so a
        // disagreement between them is a frame lag off by one.
        morphVelocity: query.get( 'morphvel' ) ?? undefined,

        // `undefined` on every plate that did not ask for hair, which is `Stage`'s own default of
        // `'off'` — so the shipped plate allocates nothing, requests no device limit and carries no
        // extra Stage member. Measured: `stage.hairOIT` stays null, so instrument 5's Stage-member
        // walk in `alive-toggles.selftest.mjs` sees the same set it always did.
        hairOIT: hairRequest?.oit
    } );

    if ( wantsGrade ) stage.setGrade( buildGrade( query ) );

    stage.scene.background = new Color( 0x08080a );

    // The linearly-transformed-cosine tables every RectAreaLight needs before first use are
    // installed by LightingRig.attachTo(); without them the lights contribute nothing at all and
    // the figure renders black, which looks exactly like a broken material.

    const bare = query.has( 'bare' );

    if ( bare ) {

        for ( const id of [ 'controls', 'hud', 'trace' ] ) {

            document.getElementById( id ).style.display = 'none';

        }

    }

    // `?backdrop=0x11151f` sweeps the card's emissive. Gate G6 measures the whole-image 0.1st
    // percentile, so it is a measurement of whatever is darkest in frame — this card, or the
    // eyelash cards once they stopped claiming a specular lobe, or the floor. A sweep is what
    // separates those three.
    const backdrop = buildBackdrop( stage, query.has( 'backdrop' )
        ? Number( query.get( 'backdrop' ) )
        : BACKDROP_EMISSIVE );

    // 🎯 THE FIGURE USED TO FLOAT, and a shadow map could never have fixed it: measured on the
    // shipped rig, turning the rim and kicker to zero takes the floor 1 px below a sole from
    // 0.3315 to 0.1328, so 60% of the light landing there comes from two RectAreaLights, which
    // cannot cast a shadow at all (three.js #14161). `GroundContact` occludes the hemisphere in
    // closed form instead of casting into it, using spheres whose radii are measured off THIS
    // bake's own bones. Contact profile below a sole: +0.0307 of luma over 128 px with the term
    // on, -0.0012 with `?ground=0`, and every other statistic on the plate byte-comparable.
    const ground = new GroundContact( { occlusion: query.get( 'ground' ) !== '0' } );

    if ( query.get( 'ground' ) !== 'none' ) ground.attachTo( stage.scene );

    const poseName = query.get( 'pose' ) ?? DEFAULT_REST_POSE;

    // Everything that changes when the gender dial moves lives in one place, so the reload path
    // has exactly one object to swap and the frame loop has exactly one thing to null-check.
    const session = {
        identity: new Identity( { gender: Number( query.get( 'gender' ) ?? 0.5 ) } ),
        figure: null,
        skeleton: null,
        target: null,
        loadToken: 0,
        // 'bind' is not a pose file, it is the absence of one: the untouched asset, which is the
        // A side of the comparison RestPose exists to win.
        restPose: poseName === 'bind' ? null : RestPose.load( poseName ),
        frameMode: query.get( 'frame' ) === 'body' ? 'body' : 'portrait',
        heightOverride: query.has( 'height' ) ? Number( query.get( 'height' ) ) : null,
        framedHeightMetres: PORTRAIT_HEIGHT_METRES,

        // The shading. Both are rebuilt per bake, because every constant in them is measured off
        // the mesh that is actually loaded: EyeMaterial fits the sclera sphere, the corneal axis
        // and the iris plane at construction, and the curvature map is baked per figure.
        skinEnabled: query.get( 'skin' ) !== '0',
        // Punch-list 3.11: screen-space normal-variance roughness on the skin's micro-normal.
        // three's own specular AA is geometric only, so a micro-normal at 48 repeats has no
        // defence and crawls. `?specaa=0` is the A side.
        skinSpecularAntiAliasing: query.get( 'specaa' ) !== '0',
        // The baked hemisphere-visibility term, applied CHROMATICALLY through the Jimenez
        // multi-bounce fit so a crease darkens AND saturates rather than greying. It already
        // reached this page — `createSkinMaterial` derives the cavity URL beside the curvature one
        // — but with no switch there was no way to produce the A plate on the page a judge
        // captures, and every attribution for it came off skin.html. `?cavity=0` is the A side and
        // `?cavity=0.5` sweeps the strength.
        skinCavityStrength: query.has( 'cavity' ) ? Number( query.get( 'cavity' ) ) : undefined,
        // TWO switches, not one. The eye shader and the eye occlusion sheet are separate
        // subsystems — different meshes, different materials, opposite signs on G2 — and a
        // single switch over both made every number ever attributed to `?eyes=0` a sum of the
        // two. `applyEyeShading` carries the measurement.
        eyesEnabled: query.get( 'eyes' ) !== '0',
        eyeOcclusionEnabled: query.get( 'eyeocc' ) !== '0',
        cardsEnabled: query.get( 'cards' ) !== '0',

        // Punch-list 3.5 / 3.6. OPT-IN — see `HAIR_GROOM_ID` for why the default plate has no hair
        // on it this round. Both were read above `Stage.create`, because the OIT arm has to be
        // chosen before the render pass exists; `?hair` is the ONLY hair key read on a plate that
        // did not ask for hair, and the seven inside `readHairRequest` are therefore invisible to a
        // bare plate's recorded toggle surface. That is the `?clockdefect` pattern and it is
        // deliberate: a key that can only change a plate containing a groom should not appear on
        // the surface of a plate that has none.
        hairEnabled,
        hairRequest,
        multisampled,
        skin: null,
        eyes: null,
        eyeOcclusion: null,
        cards: [],
        hair: null,
        hairMaterial: null,

        // The per-frame slab fit the `wboit` arm needs, or null on every other arm. Held on the
        // session because `trackFigure` is what calls it — see the 🚩 in `attachHair` for the frame
        // path that made `stage.onFrame` the wrong home for it.
        hairSlabUpdate: null,

        // Punch-list 6.6. The DFTL solver, or null on a plate with no groom or with
        // `?hairmotion=0`. Two handles rather than one because they have different readers:
        // `hairDynamics` is the solver itself — `reset()`, `stepsTaken`, `readCentrelines()`, all
        // of which a capture driver and a gate need — and `hairMotionUpdate` is the per-frame
        // closure, which lives beside `hairSlabUpdate` for the same reason it does: `trackFigure`
        // is the only per-frame path both halves of this page share.
        hairDynamics: null,
        hairMotionUpdate: null,

        // Phase 9. `?wear=female_casualsuit01,shoes01` dresses the figure; `?wear=` with nothing
        // after it loads the wardrobe and wears nothing, which is the way to see the body swap on
        // its own. See `WARDROBE_BODY_URL` for why this is opt-in and what it costs when it is on.
        //
        // `?foundation` (9.8) IMPLIES the wardrobe, because the decency floor is a wardrobe
        // mechanism — `Wardrobe.dress()` unions the floor into every outfit — so asking for the
        // floor on a page with no wardrobe would be asking for nothing.
        wardrobeRequest: ( query.has( 'wear' ) || query.has( 'foundation' ) )
            ? ( query.get( 'wear' ) ?? '' ).split( ',' ).map( ( id ) => id.trim() ).filter( ( id ) => id !== '' )
            : null,
        foundationEnabled: query.has( 'foundation' ),

        // Rejection proofs for the dressing race. Read here rather than in `dressFigure` so the
        // key is consulted exactly once, on the same line as the request it perturbs. `none` on
        // every plate that does not ask; see `WARDROBE_DRESS_DEFECTS`.
        wardrobeDressDefect: query.get( 'wearrace' ) ?? 'none',
        wardrobe: null,

        // Phase 10. Null unless `?identity=` asked for something — see `applyIdentityTargets`,
        // which is where the 10.8 MB of target data is (not) fetched.
        identityRequest: parseIdentityRequest( query.get( 'identity' ) ),
        identityReport: null,

        // Phase 5. Null unless `?affect=` asked for one; the module is not imported otherwise.
        affectRequest: query.get( 'affect' ),
        // Read unconditionally, so the key appears in the url surface `alive-toggles.selftest.mjs`
        // records from live reads even on a plate with no `?affect` at all. A toggle that only
        // exists on plates nobody captures is a toggle no gate can classify.
        affectBodyEnabled: query.get( 'affectbody' ) !== '0',
        affect: null,

        // A commanded static lateral offset of the figure, in metres. On `session` rather than in
        // `boot`'s scope because a gender swap builds a whole new root and would otherwise drop it
        // silently — which on a psychophysical staircase is a trial reported at the wrong distance.
        nudgeMetres: ( query.has( 'nudge' ) ? Number( query.get( 'nudge' ) ) : 0 ) / 1000
    };

    // The rig is preset per framing, not scaled from one. The portrait rim azimuth measures 1 px
    // of band on a full-body thigh — no band at all — which is the open lead PROGRESS.md records
    // as "rim and kicker stop reading at body scale".
    const lights = new LightingRig( {
        preset: session.frameMode,
        shadows: query.get( 'shadows' ) !== '0',
        overrides: parseLightOverrides( query.get( 'ov' ) ),

        // 🎯 THE AMBIENT MOVES WITH 3.10, and this line is the whole mechanism. With GTAO on, the
        // hemisphere term is re-evaluated per pixel in the composite through the bent normal; if
        // the light were left in the scene as well, the frame would carry the ambient twice — a
        // uniform lift that reads as an exposure mistake rather than as a double count.
        ambient: occlusion.enabled === false
    } );

    lights.attachTo( stage.scene, stage.renderer );

    // Installed after the rig, because the composite needs the ambient the rig would have built.
    // `describeAmbient()` reports it whether or not the light was attached, which is what makes
    // "the term moved" a property of one flag rather than of two files agreeing.
    const gtao = occlusion.enabled
        ? createGroundTruthOcclusion( {
            gbuffer: stage.gbuffer,
            camera: stage.camera,
            ambient: lights.describeAmbient(),
            quality: occlusion.quality,
            bentNormal: occlusion.bentNormal,
            specularOcclusion: occlusion.specularOcclusion,
            ambientSpecular: occlusion.ambientSpecular,
            defect: occlusion.defect,
            view: occlusion.view,
            strength: occlusion.strength,
            radius: occlusion.radius
        } )
        : null;

    if ( gtao !== null ) {

        stage.setAmbientOcclusion( gtao );

        if ( occlusion.defect !== 'none' ) {

            console.warn( `🚩 DEFECT PLANTED — gtaodefect=${ occlusion.defect }. The occlusion on ` +
                'this plate is computed from normals confined to the positive octant. It looks ' +
                'entirely plausible and it is wrong. Quote no number off it without naming the flag.' );

        }

    }

    // 🚩 KNOWN-BADS, ON THE PAGE THE SEVEN OBJECTIVE GATES ARE MEASURED ON. The tables are shared
    // with `lighting.html` rather than copied, because a rejection proof that only runs on the
    // browsercheck cannot be re-run against the plate anybody actually quotes. Planted on the rig's
    // `solve` rather than on its constructor: `solve()` runs on every re-aim, so a one-shot
    // mutation is a no-op wearing a defect's name.
    //
    // ⚠️ `plantLightDefect` and `plantGroundDefect` both return null for an absent parameter and
    // touch nothing, so the default plate is untouched with this code present. MEASURED, not
    // argued: `capture.mjs --plate` at 3840x5120, 60 steps at 60 fps, seed 1, three loads returns
    // sha256 d3c9946f73e5eaa1 — this repository's own recorded mode for the shipped default —
    // 3/3 pairs bit-identical, residue 0 px at Δ0, and all seven objective gates to the last digit.
    // ⚠️ `alive-toggles.selftest.mjs` does NOT gate that: it compares plates against each other,
    // so it would be blind to a change that moved every plate the same way. The digest is the gate,
    // and it has to be re-taken by hand whenever this file grows a switch.
    const defects = {
        light: plantLightDefect( lights, query.get( 'statedefect' ) ),
        ground: plantGroundDefect( ground, query.get( 'grounddefect' ) )
    };

    if ( defects.light !== null || defects.ground !== null ) {

        console.warn( `🚩 DEFECT PLANTED — statedefect=${ defects.light?.name ?? 'none' } ` +
            `(${ defects.light?.altered ?? 0 } distinct light object(s)), ` +
            `grounddefect=${ defects.ground ?? 'none' }. This plate LOOKS clean and is not. ` +
            'Quote no number off it without naming the parameter.' );

    }

    const stack = new MotionStack( { seed: Number( query.get( 'seed' ) ?? 20260807 ) } );

    const breath = new Breath();
    const bodyIdle = new BodyIdle();

    // The fingers were the one part of the body a judge could see was frozen: BodyIdle's finger
    // idle moves an index fingertip 0.73 mm over seven minutes — 0.48 px at full-body framing,
    // against the 1.6 px this project already has on record as indistinguishable. HandIdle
    // re-roots the amplitude as a fraction of each joint's own measured resting flexion and takes
    // the finger channel off BodyIdle on its first frame, handing it back on dispose.
    const handIdle = new HandIdle();

    // Sway measures the weight shift; the arms answer it with one small decaying swing instead of
    // drifting on obliviously while the pelvis moves. The callback carries the drawn amplitude, so
    // a big shift gets a big swing — which is the whole reason the arms are worth coupling.
    const sway = new Sway( { onWeightShift: ( shift ) => bodyIdle.onWeightShift( shift ) } );

    // 'auto' is IdleMotion's own answer to the arm-doubling problem: it declares the six arm bones
    // and so does BodyIdle, and bone contributions SUM. With a layer named 'bodyIdle' in the stack
    // it stands down to the head alone, which is the split this page wants.
    const idle = new IdleMotion( { armsEnabled: 'auto' } );

    const gaze = new Gaze( { partnerYawDegrees: CAMERA_AZIMUTH_DEGREES } );
    const blink = new Blink();
    const facialIdle = new FacialIdle();
    const pupil = new Pupil();

    // The eye layer and the head layer are two members of one pair, added separately because they
    // sit in different slots — HEAD runs before GAZE so the eyes can counter-rotate against the
    // head position this frame actually landed on. FacialIdle comes after Blink for the same kind
    // of reason: it reads this frame's lid closure to know how much lid-follow is left to give.
    const layers = {
        breath, sway, idle, bodyIdle, handIdle, gazeHead: gaze.head, gaze, blink, facialIdle, pupil
    };

    await swapFigure( session, stack, stage, lights, backdrop, ground );

    for ( const layer of Object.values( layers ) ) stack.add( layer );

    // Phase 5, opt-in. Added after the ten shipped layers so its MOTION_ORDER slot decides where it
    // runs rather than insertion order, and so an absent `?affect` imports nothing.
    session.affect = await attachAffect( stack, session );

    // Pupil dilation lands on the eye shader's own uniform. Written through a sink rather than
    // through `pupil.driveUniform` on purpose: the gender dial rebuilds `session.eyes`, and
    // `driveUniform` appends to a list with no way to remove an entry, so every swap would leave
    // a dead uniform being written for the rest of the session. One sink, added once, reads
    // whichever eye material is current.
    let pupilScale = 1;
    pupil.addSink( ( scale ) => {

        pupilScale = scale;
        if ( session.eyes !== null ) session.eyes.pupilScaleUniform.value = scale;

    } );

    const trace = createTrace( document.getElementById( 'trace' ) );
    if ( bare || query.get( 'trace' ) === '0' ) trace.setVisible( false );

    // A capture has to be able to ask for a state — "the same twenty seconds, but aroused" — and
    // a slider only a human can drag makes that impossible. Written to the input rather than to
    // the layer so the control and the figure cannot disagree about what the value is.
    //
    // 🚩 `gender` is in this list and its omission made `?gender` completely inert, which is worth
    // recording because the mechanism is invisible from either end. `session.identity` was built
    // from the URL, but the slider kept its HTML default of 0.5; `bindDial` publishes once at
    // setup so every dial starts in sync, that publish carried 0.5, and it reloaded g050 over
    // whichever bake the URL had just fetched. Proven by execution: `?gender=1` requested
    // figure_g100.glb AND THEN figure_g050.glb, and the plate came back byte-identical to
    // `?gender=0`. The guard in `bindDial('gender')` was written to stop exactly that redundant
    // fetch, and could not, because it compares two values that this loop is what keeps equal.
    for ( const id of [ 'arousal', 'load', 'attention', 'gender' ] ) {

        if ( query.has( id ) ) document.getElementById( id ).value = query.get( id );

    }

    bindControls( { session, stack, stage, lights, backdrop, layers } );
    bindKeyboard( { blink, trace } );

    const samplers = { head: createHeadSampler( session ), hand: createHandSampler( session ) };

    /**
     * One simulated frame: advance the stack and record what moved. Every clock the page has —
     * pre-roll, rAF, the capture hook — comes through here, so a capture and a live run cannot
     * drift into being different simulations.
     */
    const advanceSimulation = ( deltaSeconds ) => {

        stack.update( deltaSeconds );

        // The eye frame is rebuilt from the head bone's WORLD matrix and from this frame's
        // eyeLook* morph weights, so it has to run after the stack has committed both — and after
        // the world matrices have been brought up to date. The renderer would do that itself, but
        // only during render(), which is one frame too late: read there, the eye would look where
        // the head was last frame. A 7-mesh, 53-bone subtree costs nothing to walk.
        if ( session.eyes !== null ) {

            session.figure.root.updateMatrixWorld( true );
            session.eyes.update();

        }

        trace.push( deltaSeconds, sampleSignals( stack, layers, samplers ) );

    };

    // A pre-roll is the difference between a screenshot that means something and one that does
    // not: it puts the stack at a known motion time, and it fills the strip chart, so a single
    // captured frame carries the history that a 240 ms blink lives in.
    const prerollSeconds = Number( query.get( 'preroll' ) ?? 0 );
    const frozen = query.has( 'freeze' );

    for ( let step = 0; step < Math.round( prerollSeconds / FIXED_STEP_SECONDS ); step ++ ) {

        advanceSimulation( FIXED_STEP_SECONDS );

    }

    // 🎯 `?nudge=<mm>` — a commanded lateral offset of the FIGURE, for the one experiment that can
    // retire this project's 1.6 px indistinguishability floor.
    //
    // That floor is cited by gates all over the repo as "the one empirical datum this project owns
    // on the subject" and nobody measured it (LEARNINGS §1.14a); its two halves are out by 1.85x.
    // What the project really owns is a bracket between two blind-judge observations: 0.48 px
    // peak-to-peak reported as "the hands never move", and 10.6 px of pelvis excursion reported as
    // a counted event. A 2AFC staircase closes it in about twenty captures — pairs at d in
    // {0.5, 0.75, 1.1, 1.7, 2.5, 3.8, 5.6, 8.4} mm through `blind_ab.mjs`, with a d = 0 catch trial.
    //
    // 🚩 IT MOVES THE BODY, NOT THE CAMERA, and that is not a detail. A camera nudge changes
    // perspective and parallax, so it is a different stimulus and its threshold would be a
    // different number. Applied to the figure root AFTER the pre-roll so it is a static offset
    // rather than something the stack integrates, and it composes with `?freeze` for the same
    // reason: nothing downstream of here writes the root's x.
    if ( session.nudgeMetres !== 0 && session.figure !== null ) {

        session.figure.root.position.x = session.nudgeMetres;
        session.figure.root.updateMatrixWorld( true );
        ground.update();

    }

    /**
     * Everything that has to follow the bones after they have moved, on EVERY frame path.
     *
     * It exists as a named function rather than as two lines in the rAF callback because there
     * are two frame paths on this page and they had already diverged once: `?capture` takes the
     * loop away from requestAnimationFrame, so a `stage.onFrame` callback stops firing and a
     * contact shadow silently stops following the feet — on precisely the plates a judge
     * measures. Anything per-frame and figure-shaped belongs here, not in the callback.
     *
     * @param {number} deltaSeconds - the frame's step. It takes one now because punch-list 6.6's
     *   solver is a fixed-timestep integrator with an accumulator, and a layer advanced once per
     *   FRAME rather than per fixed step has a trajectory that depends on the frame rate
     *   (LEARNINGS §1.13). Both call sites already know the number; nothing else here reads it.
     */
    function trackFigure( deltaSeconds ) {

        ground.update();

        // Punch-list 3.6. Null on every arm but `wboit`, which fits its weight curve to the
        // groom's own view-space depth slab and therefore has to be told where the groom is once
        // per frame. It is HERE for this function's own stated reason: `?capture` bypasses
        // `stage.onFrame` entirely, and a slab that stopped being fitted on exactly the plates a
        // judge measures is the contact-shadow defect this function was written after.
        session.hairSlabUpdate?.();

        // 🎯 PUNCH-LIST 6.6, and it is HERE rather than in the rAF callback for the reason this
        // whole function exists — `?capture` bypasses `stage.onFrame`, and hair that stopped
        // simulating on exactly the plates a judge measures is the defect this round is repairing
        // one level up.
        //
        // ⚠️ IT RUNS UNDER `?freeze` TOO, deliberately. Frozen means the motion stack does not
        // advance, so the head does not move, so the solver is the identity — and running it there
        // is what makes the frozen plate a real test of the wiring rather than a plate the
        // subsystem was switched off for. If that identity ever stops holding, every gate plate in
        // the repository moves, which is the loudest possible way to find out.
        session.hairMotionUpdate?.( deltaSeconds );

    }

    stage.onFrame( ( deltaSeconds ) => {

        if ( session.figure === null ) return;   // a bake is being swapped in

        if ( frozen === false ) advanceSimulation( deltaSeconds );

        trackFigure( deltaSeconds );

        if ( bare ) return;

        trace.draw();
        hud.textContent = describeState( stage, stack, layers, session, pupilScale );

    } );

    // --- the deterministic capture hook -------------------------------------------------------
    //
    // Aliveness is a temporal property, and a still frame cannot carry it. Under ?capture the
    // renderer's own frame loop is stopped and tools/critic/capture.mjs becomes the clock: it
    // calls __SUGATA_STEP__(1/fps), reads the pixels back, and repeats. Simulation time stops
    // depending on wall-clock time altogether, so a capture is exactly as long as it claims and
    // a seeded run reproduces frame for frame regardless of machine, load or thermal state.
    const advanceRendererFrame = query.has( 'capture' )
        ? takeOverFrameLoop( stage, query.get( 'clockdefect' ) ?? 'none' )
        : null;

    // PUNCH-LIST 6.6's leg of the same epoch. `takeOverFrameLoop` puts the RENDERER's frame state
    // at a known value; the solver's state is its own — a GPU storage buffer and a step counter,
    // both invisible to `alive-capture-determinism.selftest.mjs`, which reads renderer counters.
    // AFTER the takeover and not before, because `renderer._animation.stop()` is what stops
    // `stage.onFrame` firing and a reset taken ahead of it would be undone by the next rAF tick.
    // Keyed off `?capture` rather than off `advanceRendererFrame`, which is also null on the
    // fallback path where the renderer internals could not be reached — that path has already lost
    // bit-exactness and does not need a second reason for it.
    //
    // ⚠️ AND ON THIS PAGE, TODAY, IT IS A NO-OP. Said out loud rather than left looking
    // load-bearing. REQ-069 asked for it on the grounds that rAF runs during the async boot, so
    // "without this the first captured frame carries a count of how many frames the machine fitted
    // into loading a GLB" — which is exactly true of `nodeFrame.frameId` and is NOT true of the
    // solver here: nothing drives it until `stage.onFrame` is registered thirty lines up, and the
    // path from that registration to `takeOverFrameLoop` contains no `await`, so no rAF task can
    // interleave. Measured rather than reasoned out: with this line deleted,
    // `HairDynamics.selftest.mjs`'s A4 still read `hairSteps` 120 and 120 from boot epochs 15 and
    // 106. It stays because it is one call and because the ordering it relies on is three
    // statements that a future edit could put an `await` between — a GUARD, not a fix, and it is
    // not quoted as one anywhere.
    if ( query.has( 'capture' ) ) session.hairDynamics?.reset();

    /**
     * Advances the motion stack by exactly `deltaSeconds`, draws one frame, and resolves once
     * the GPU has finished it — so the caller may read the canvas back immediately.
     *
     * The await is the whole point of the return value being a promise. `render()` only submits
     * work; the screenshot that follows is a separate process asking the compositor for the
     * canvas, and without a barrier it sometimes wins that race and gets the PREVIOUS frame.
     * On millimetre-scale idle motion that mis-capture is invisible — a fraction of a percent of
     * pixels along lash and lid edges — which is exactly why it has to be closed here rather
     * than eyeballed later.
     *
     * @param {number} deltaSeconds - fixed simulation step, e.g. 1/30.
     * @returns {Promise<boolean>} false while a bake is still loading, so the caller can retry.
     */
    window.__SUGATA_STEP__ = async ( deltaSeconds ) => {

        if ( session.figure === null ) return false;

        // 🚩 `?freeze` IS HONOURED HERE TOO, and for two rounds it was not. The rAF path eight
        // lines above has always guarded this call; this one advanced unconditionally, so
        // `?freeze&capture` was a contradiction the page resolved silently in favour of motion —
        // every "frozen plate" taken through capture.mjs was a plate of a figure that had been
        // walked forward one simulation step per screenshot. Three agents hit it independently in
        // one round. Measured before this line changed: `?bare&freeze&capture&seed=1` stepped 300
        // frames at 1/60 on the MSAA FORWARD path — where a static scene must be bit-identical —
        // read forehead temporalRms 3.6400/255; it now reads 0.0000 and frames 1 and 300 are the
        // same bytes. On the lighting gates the same bug read G1 1.5976 / 1.1948 / 1.3740 /
        // 1.0657 / 1.1110 at 1 / 5 / 15 / 30 / 60 steps of the SAME seed and framing — a 1.5x
        // spread across a reference band 0.21 wide — and G2 0.7836 captured against 0.9200 frozen,
        // which is the whole of punch-list 3.3's supposed red.
        //
        // A capture of a frozen page is a sequence of RENDERS of a still, which is exactly what a
        // temporal AA mode needs to converge, so the two compose and neither is redundant.
        if ( frozen === false ) advanceSimulation( deltaSeconds );

        if ( bare === false ) {

            trace.draw();
            hud.textContent = describeState( stage, stack, layers, session, pupilScale );

        }

        trackFigure( deltaSeconds );

        // The renderer's per-frame internal tick, which normally rides on rAF. Skinning is
        // updated here, so skipping it renders a live simulation onto a frozen pose — see
        // takeOverFrameLoop() for what that looked like when it was missed.
        advanceRendererFrame?.( deltaSeconds );

        // 🚩 `stage.draw()`, NOT `stage.renderer.render()`. On the deferred path the pipeline is
        // what binds the MRT and runs the composite, so calling the renderer directly renders the
        // scene and throws the grade and the temporal resolve away. It fails SILENTLY and it
        // looks exactly like a feature that does nothing: measured before this line changed,
        // `?grade=1` produced a plate byte-identical to no grade across all seven gates, and
        // `?aa=traa` was indistinguishable from `?msaa=0`. On the forward path `draw()` falls
        // through to `renderer.render()`, so the default plate is unchanged.
        stage.draw();

        // Barrier one: the GPU has finished the frame. WebGL2 has no equivalent, so the fallback
        // tier keeps the race — capture.mjs reports the backend, and a WebGL2 capture is a
        // degraded artefact for other reasons anyway.
        await stage.renderer.backend?.device?.queue?.onSubmittedWorkDone();

        // Barrier two: the compositor has painted it. The screenshot arrives out of band, from
        // another process asking the compositor for the canvas — so GPU-done is not enough on
        // its own, and two paints are what make "the pixels the caller reads" the frame we just
        // drew rather than the one before it.
        await nextPaint();

        return true;

    };

    // Handy for poking at any of it from the console. `frame( 0.16 )` pushes in until the frame is
    // 160 mm tall, which is the only way to inspect an eyelid roll closely without a second page;
    // `frame( 1.9, 'body' )` pulls back to the whole figure.
    window.sugata = {
        stage,
        stack,
        layers,
        session,
        lights,

        // What this plate ACTUALLY contains, counted off the scene. Every `?x=0` attribution claim
        // on this page is a claim about this object, so it is readable from outside rather than
        // being something a reviewer has to infer from the source.
        subsystems: () => censusOfShading( session, stage ),

        // The other half of the same claim, and the half the nine counters above cannot make: not
        // "the named subsystem went to zero" but "AND NOTHING ELSE MOVED". Whole scene, keyed by
        // entity — see `shadingFingerprint` for why a sample of the render state was the wrong
        // model for a claim about all of it.
        shadingState: () => shadingFingerprint( session, stage ),

        // And the surface `shadingState` cannot close by listing fields: every readable property
        // of the three objects the draw call takes — renderer, scene AND CAMERA — walked. A
        // `?cards=0` confound routed through `renderer.toneMappingExposure` was invisible to
        // nineteen hand-picked pipeline fields, and a second one through `camera.filmOffset` was
        // invisible to a walk of the first two subjects. This is the deny-by-default answer to the
        // whole class. Separate from `shadingState` because several honest toggles move render
        // state — `?frame=body` moves the camera — and would read as collateral inside it.
        renderState: () => frameSubjectState( stage ),

        // Which URL keys this page actually consulted on this load. The gate's inventory of
        // toggles used to be a list in the test file, which is a list of what somebody remembered;
        // this is a list of what the code did.
        toggleSurface: () => query.keysRead(),

        // Phase 9, live. Null unless `?wear` was in the URL — see WARDROBE_BODY_URL for why the
        // default plate must not pay for this. `sugata.wardrobe.dress([...])`, `.undress()`,
        // `.putOn([...])`, `.takeOff([...])` and `.stats()` all work from the console.
        get wardrobe() { return session.wardrobe; },

        /**
         * Everything a screenshot of this page cannot carry, as a plain object a capture driver can
         * read and record beside the pixels.
         *
         * 🚩 `defects` IS THE LOAD-BEARING FIELD AND IT IS WHY THIS EXISTS. A `?bare` plate with a
         * planted defect is INDISTINGUISHABLE FROM A CLEAN ONE by construction — `panelaim` moves
         * 73% of a frame at five code values — so the only things that identify it are the URL,
         * this object and a console warning. A capture driver that screenshots one of these
         * without recording the query string produces a number about nothing.
         */
        report: () => ( {
            defects: {
                light: defects.light === null
                    ? null
                    : { name: defects.light.name, lightsAltered: defects.light.altered },
                ground: defects.ground
            },
            nudgeMillimetres: session.nudgeMetres * 1000,
            affect: session.affect === null ? null : session.affect.preset,

            // The posture the BAP prescription actually produced, in degrees, so a gate can state
            // WHY the torso band moved rather than only that it did. Null when `?affectbody=0`.
            affectPostureDegrees: session.affect?.posture == null
                ? null
                : { ...session.affect.posture.appliedDegrees },
            identity: session.identityReport,
            foundation: session.foundationEnabled
                ? ( session.wardrobe?.worn ?? null )
                : null
        } ),

        // Every per-frame counter a shader or a resolve can read, so a gate can state what they
        // SHOULD be after N steps rather than only whether two runs happen to agree. Two runs
        // agreeing is cross-observer agreement and it is blind to anything wrong the same way for
        // both of them — LEARNINGS §1.25g — and `frozen-frame` below is exactly that shape.
        captureClock: () => readCaptureClock( stage, session ),
        frame: ( heightMetres, mode = session.frameMode ) => {

            const framed = frameFigure( stage, session.figure, { mode, heightMetres } );

            lights.setPreset( mode === 'body' ? 'body' : 'portrait' );
            aimRigAt( lights, session, framed.focus, heightMetres, stage );

        }
    };

}

/**
 * Resolves after the browser has painted, which takes two animation frames: the first callback
 * runs *before* the paint it was scheduled for, the second only after that paint has happened.
 *
 * This is the one place capture still depends on rAF, and it is a barrier rather than a clock —
 * so a throttled tab makes a capture slow, never wrong. Measured in Playwright's headless
 * Chromium, rAF runs at 120 Hz and this costs about 16 ms a frame against the ~50 ms a
 * screenshot already takes.
 */
function nextPaint() {

    return new Promise( ( resolve ) => {

        requestAnimationFrame( () => requestAnimationFrame( resolve ) );

    } );

}

/**
 * 🚩 The named ways the capture epoch can be wrong, in the shape `GRAIN_DEFECTS` uses in
 * `render/Grade.js`: one of them shipped, the other five exist only to be shot at.
 *
 * A rejection proof written against the defect the gate was designed from proves the two are
 * consistent, not that either is right (LEARNINGS §1.25a). So the list below is stated as a
 * CLASS — *any renderer-side per-frame counter that `?capture` does not put at a known value* —
 * and enumerated, and every entry is reachable from `?clockdefect=` so the proof is a page rather
 * than a committed plate.
 *
 * The interesting two are `frozen-frame` and `offset-epoch`. `frozen-frame` is perfectly
 * reproducible and perfectly wrong, so no two-runs-agree check can see it; `offset-epoch` is
 * reproducible AND animating, and only an oracle that says what the counter SHOULD read catches
 * it. Between them they are the reason this page reports `captureClock()` at all.
 */
export const CAPTURE_CLOCK_DEFECTS = {
    'drifting-epoch': 'what shipped until 2026-08-08: the counters are not reset at all, so they ' +
        'start wherever the rAF frames that ran during the async boot left them. Measured on ' +
        'three back-to-back loads of ?bare&freeze&capture&seed=1: frameId at the first step ' +
        '2392 / 1216 / 1961. ⚠️ Its effect on a PIXEL check is machine-dependent by construction — ' +
        'against a warm vite with the file watcher off, two loads can boot in the same number of ' +
        'frames and the plates then match. That is the defect being lucky, not absent, and it is ' +
        'why `random-epoch` exists beside it.',
    'random-epoch': 'the same defect with the environmental source made explicit: the epoch is ' +
        '`Math.floor( Math.random() * 4096 )` rather than a count of boot frames. Nothing about ' +
        'the mechanism differs — a frame counter starting at a value the page does not control — ' +
        'and it lets a rejection proof of a two-run pixel check stop depending on how many frames ' +
        'the browser fitted into loading a GLB.',
    'unpinned-resolve': 'the node clock is reset but the temporal resolve is not, so its Halton ' +
        'jitter phase and its history buffer carry the boot frames in. Invisible under ?aa=msaa ' +
        'and fatal under the default — a different mechanism from the one above, in the same class.',
    'frozen-frame': 'the frame index is pinned to 0 for the whole capture. Bit-identical across ' +
        'runs and across STEPS, which is the degenerate input every reproducibility check passes ' +
        'trivially (§1.3). The grain stops being grain and becomes dirt on the lens.',
    'offset-epoch': 'the epoch is reset to 1000 rather than to 0. Reproducible, animating, and ' +
        'still wrong: nothing else that captures this recipe lands on the same frame indices.',
    'wall-clock-time': 'the frame index is pinned but `nodeFrame.time` is fed from ' +
        '`performance.now()`. Any node that animates off the node clock rather than off the ' +
        'frame index drifts with machine load, and the frame-index oracle cannot see it.'
};

/**
 * Takes the renderer's per-frame tick away from requestAnimationFrame so a capture can drive it,
 * and puts the renderer's frame state at a known epoch before the first step.
 *
 * Three things have to happen together, and doing any of them alone is a trap:
 *
 *   1. STOP the rAF chain. `setAnimationLoop( null )` is the public way and it is not enough —
 *      it only clears the user callback, while three's internal Animation keeps requesting
 *      frames and keeps calling `nodeFrame.update()` on each one. Whether one of those lands
 *      between two capture steps depends on how many ticks the browser fitted in, which is
 *      wall-clock time leaking back in through the side door. Measured: two runs of the same
 *      seed diverged at frame 54 of 600, along lash and lid edges.
 *
 *   2. DRIVE that tick yourself, once per captured frame. `nodeFrame.update()` is where skinning
 *      is refreshed. Stopping the chain without replacing it renders a live simulation onto a
 *      pose frozen near rest — and the failure is quiet and deeply convincing: the eyes still
 *      blink (morphs update elsewhere), the strip chart still moves, the head just never turns.
 *      It measured as *perfectly* reproducible, because a still image always is.
 *
 *   3. 🎯 RESET THE FRAME STATE, which for two rounds this did not do, and which is the whole of
 *      punch-list 3.20. Steps 1 and 2 pin the CLOCK — `time` and `deltaTime` — and the renderer's
 *      frame state is not only a clock. Three counters were left running:
 *
 *        - `nodeFrame.frameId`, which `Grade.SHIPPED_GRAIN_SEED` draws the film grain from;
 *        - the temporal node's `_jitterIndex`, which selects the Halton camera offset;
 *        - the temporal node's history render target, which holds resolved colour.
 *
 *      All three advance on every rAF frame, and rAF starts inside `stage.create()` while `boot()`
 *      is still awaiting the figure — so their value at the first captured step is a count of how
 *      many frames the machine fitted into loading a GLB. Measured 2026-08-08, one vite, one
 *      Chromium, `?bare&freeze&capture&seed=1` stepped 60x(1/60) at 900x1200 dpr 1, three loads:
 *      `frameId` 2392 / 1216 / 1961 and three distinct plates. The clock was bit-exact in all
 *      three — `time` 1.0000000000000013 — which is precisely why this hid: the one counter
 *      anybody thought to check was the one that was right.
 *
 *      Attribution, same page, same harness, by pinning each counter from outside before stepping:
 *
 *        | pinned                          | ?aa=msaa (forward) | default ?aa=taau |
 *        |---------------------------------|--------------------|------------------|
 *        | nothing (as shipped)            | 3 distinct of 3    | 3 distinct of 3  |
 *        | frameId + node clock            | **reproducible**   | 2 distinct of 2  |
 *        | + `_jitterIndex`                | —                  | 2 distinct of 2  |
 *        | + history render target         | —                  | **reproducible** |
 *
 *      So the grain needed one pin, and the temporal resolve needed all three. A fix that stopped
 *      at `frameId` would have made the A-side plate reproducible and left the SHIPPED DEFAULT
 *      exactly as broken, which is §1.25c's trap wearing a fix's clothes.
 *
 *   4. ⚠️ AND WHAT IS LEFT AFTER ALL THAT IS 1 LSB ON 0.0008% OF SAMPLES, WHICH IS NOT ZERO.
 *      Re-verified 2026-08-08 at HEAD `2ec7db9` by SEPARATE BROWSER LAUNCHES in separate node
 *      processes against one un-watched vite — a stronger test than two contexts of one browser,
 *      which share a GPU process and a shader cache. `?bare&freeze&seed=1&capture` stepped
 *      60×(1/60) at 900×1200 dpr 1. The counters are pinned EXACTLY on every run: `frameId` 60,
 *      `jitterIndex` 29, `time` 1.0000000000000013 to sixteen significant figures. The pixels are
 *      not quite:
 *
 *        | configuration                       | launches | result                              |
 *        |-------------------------------------|----------|-------------------------------------|
 *        | `?aa=msaa&grade=0` (the A side)     | 4        | byte-identical, sha `afd763f4535435fd` |
 *        | `?aa=msaa` (grade on, no resolve)   | 3        | byte-identical                      |
 *        | `?aa=taau&grade=0` (resolve, no grade) | 3     | byte-identical                      |
 *        | `?grain=0` (resolve + grade, no grain) | 3     | byte-identical                      |
 *        | **shipped default**                 | 10       | 5-34 of 4,320,000 samples differ, every one of them by exactly 1/255 |
 *
 *      IT TAKES BOTH THE RESOLVE AND THE GRAIN; neither alone does it, and `?grain=0` is the
 *      single flag that attributes it. The mechanism is a quantiser, not a counter: the temporal
 *      resolve accumulates in float and a GPU is free to reorder the reductions inside a
 *      dispatch, so its output differs in the last bits between launches — invisible until a
 *      dither is added on top, which pushes a few dozen pixels across a code boundary. It does
 *      not grow with the clip (9 samples at 240 steps against 34 at 60).
 *
 *      So the honest statement of what `?capture` now guarantees on the shipped default is
 *      "reproducible to 1 code value on under 0.001% of samples", not "byte-identical", and a
 *      gate that compares two plates must state a TOLERANCE rather than a digest. `capture.mjs`'s
 *      header already says this about its own reproducibility check, and it is the reason
 *      `alive-capture-determinism.selftest.mjs` compares decoded pixels rather than sha256.
 *      Anyone quoting a sha for a shipped-default plate is quoting one draw.
 *
 * Both `_animation` and `_nodes` are private, so this reaches into the renderer and says so. If
 * an upgrade renames either, capture falls back to leaving rAF running: correct pictures, no
 * bit-exactness, and a console line saying which — never the frozen-pose failure, which is the
 * one that would look fine and be worthless.
 *
 * @param {Stage} stage - taken whole rather than as `stage.renderer`, because the temporal resolve
 *   is part of the frame state and it hangs off the stage.
 * @param {string} [defect='none'] - one of `CAPTURE_CLOCK_DEFECTS`, or 'none'.
 * @returns {?Function} call once per frame before rendering, or null if rAF was left running.
 */
function takeOverFrameLoop( stage, defect = 'none' ) {

    if ( defect !== 'none' && CAPTURE_CLOCK_DEFECTS[ defect ] === undefined ) {

        throw new Error(
            `alive: ?clockdefect must be one of none, ${ Object.keys( CAPTURE_CLOCK_DEFECTS ).join( ', ' ) }.`
        );

    }

    const renderer = stage.renderer;
    const nodeFrame = renderer._nodes?.nodeFrame;

    if ( typeof renderer._animation?.stop !== 'function' || typeof nodeFrame?.update !== 'function' ) {

        console.warn(
            'capture: could not reach renderer._animation / _nodes.nodeFrame, so the rAF chain is ' +
            'still running. Frames are correct but not bit-reproducible — see takeOverFrameLoop().'
        );

        return null;

    }

    renderer._animation.stop();

    // How many frames the boot burned before the capture took the loop over. Recorded rather than
    // discarded because it is the DEFECT'S INPUT: it is what used to leak into every plate, and a
    // gate that perturbs it (by holding the GLB back) needs to be able to see that its
    // perturbation worked, or "the two plates matched" means nothing.
    captureBootFrameId = nodeFrame.frameId;

    // The epoch. `frameId` is set one BELOW the first frame's index because `nodeFrame.update()`
    // increments before anything reads it, so step 1 renders at frameId 1 and step N at N — which
    // is the oracle `alive-capture-determinism.selftest.mjs` asserts against.
    if ( defect !== 'drifting-epoch' ) {

        nodeFrame.frameId = startingFrameIdFor( defect );
        nodeFrame.time = 0;
        nodeFrame.deltaTime = 0;

        // `NodeFrame.update()` seeds `lastTime` from `performance.now()` on its first call and
        // differences it thereafter. Clearing it here stops the first captured frame inheriting
        // however long the boot took as its delta, before the two lines below overwrite it.
        nodeFrame.lastTime = undefined;

    }

    if ( defect !== 'drifting-epoch' && defect !== 'unpinned-resolve' ) stage.temporal?.resetFrameEpoch?.();

    let elapsedSeconds = 0;

    return ( deltaSeconds ) => {

        nodeFrame.update();

        // ...and then overwrite the clock it just read. `NodeFrame.update()` derives its own
        // time and deltaTime from `performance.now()`, which is the last place wall-clock
        // time hides: any node that animates from them would drift with machine load. Pin
        // both to the simulation's fixed step so the renderer shares the capture's clock.
        elapsedSeconds += deltaSeconds;
        nodeFrame.deltaTime = deltaSeconds;
        nodeFrame.time = defect === 'wall-clock-time' ? performance.now() / 1000 : elapsedSeconds;

        if ( defect === 'frozen-frame' ) nodeFrame.frameId = CAPTURE_EPOCH_FRAME_ID;

    };

}

/**
 * The frame index the renderer is put at before the first captured step, so that step N renders
 * at `frameId === N`. Zero, and named rather than inline because the gate's oracle is stated in
 * terms of it and a silently changed epoch would move every capture plate in the repository.
 */
export const CAPTURE_EPOCH_FRAME_ID = 0;

/** `nodeFrame.frameId` at the instant the capture took the frame loop over. See its assignment. */
let captureBootFrameId = null;

/** Where a capture starts counting. Zero unless a `?clockdefect=` has been asked to move it. */
function startingFrameIdFor( defect ) {

    if ( defect === 'offset-epoch' ) return CAPTURE_EPOCH_FRAME_ID + 1000;

    // Deliberately unrepeatable, which is the point: it is the shipped defect's machine-dependence
    // with the machine taken out, so a rejection proof of a two-run pixel check does not itself
    // depend on how many rAF frames the browser fitted into loading a GLB.
    if ( defect === 'random-epoch' ) return Math.floor( Math.random() * 4096 );

    return CAPTURE_EPOCH_FRAME_ID;

}

/**
 * Every per-frame counter that a shader, a resolve or a gate can read, in one object.
 *
 * This exists because "two runs agree" is the wrong question on its own (§1.25g): a counter that
 * is wrong the same way on every run — pinned to a constant, or offset by a thousand — makes two
 * observers agree exactly. The gate reads this and compares it against values derived from the
 * step count, which is a different kind of check from a pixel diff and catches a different half.
 */
function readCaptureClock( stage, session ) {

    const nodeFrame = stage.renderer._nodes?.nodeFrame ?? null;
    const resolveClock = stage.temporal?.frameEpoch?.() ?? null;

    return {
        frameId: nodeFrame?.frameId ?? null,
        time: nodeFrame?.time ?? null,
        deltaTime: nodeFrame?.deltaTime ?? null,
        jitterIndex: resolveClock?.jitterIndex ?? null,
        jitterPeriod: resolveClock?.jitterPeriod ?? null,
        historyWidth: resolveClock?.historyWidth ?? null,
        bootFrameId: captureBootFrameId,

        // 🎯 PUNCH-LIST 6.6's COUNTER, and it belongs in this object rather than beside it for the
        // reason the object exists: `frameId` is here because a per-frame counter the capture does
        // not pin is a plate nobody can reproduce, and the hair solver's step count is exactly
        // that kind of counter — it advances on every rAF tick of the boot and it is invisible to
        // every renderer statistic. `null` on a plate with no groom or with `?hairmotion=0`, which
        // is a different reading from 0 and has to be.
        //
        // The oracle a gate can state against it is exact: after N captured steps at 1/60 the
        // solver has run 2N substeps of 1/120, because `1/60 − 1/120 − 1/120` is exactly zero in
        // binary floating point. See `HairDynamics.update`.
        hairSteps: session?.hairDynamics?.stepsTaken ?? null
    };

}

/**
 * Aims the rig at the shot, and hands the eye shader the key's direction.
 *
 * `aimAt` wants the framed height rather than the figure's stature — a 0.42 m portrait crop and a
 * 1.87 m full-body frame are different shots of the same person and want different rigs — and it
 * wants the camera, because every placement azimuth is measured from the camera direction rather
 * than from the world axes. That is what makes the same key:fill hold at both framings.
 *
 * The eye's analytic iris caustic is computed against one key direction, and its default is the
 * inline rig this page used to carry. Left unset it would light the iris from a key that is no
 * longer there.
 */
function aimRigAt( lights, session, focus, framedHeightMetres, stage ) {

    lights.aimAt( { focus, subjectHeightMetres: framedHeightMetres, cameraPosition: stage.camera.position } );

    if ( session.eyes === null ) return;

    const key = lights.units.find( ( unit ) => unit.placement.name === 'key' );
    if ( key === undefined ) return;

    session.eyes.keyLightDirectionUniform.value
        .copy( key.area.position )
        .sub( focus )
        .normalize();

}

/**
 * `?ov=rim.irradiance:0,kicker.irradiance:0` — arbitrary rig overrides from the URL.
 *
 * `packages/testbed/src/lighting.html` has had this since 3.8, and the integrated page did not,
 * which meant no light on THIS page could be subtracted and looked at. That gap is what let the
 * blue eyelash cards sit in PROGRESS as an unattributed "violet cast" for two rounds: attributing
 * a colour to one of four lights takes one plate per light, and there was no way to ask for one.
 *
 * The syntax is deliberately identical to lighting.html's so a sweep transfers between the two
 * pages unchanged. Kept as its own small parser rather than imported from the other page: a
 * browsercheck importing another browsercheck's internals couples two things that are meant to be
 * independently readable.
 *
 * @param {?string} spec - e.g. `key.elevationDegrees:34,rim.irradiance:9`
 * @returns {Object} per-light field overrides, keyed by light name.
 */
function parseLightOverrides( spec ) {

    if ( spec === null || spec === '' ) return {};

    const overrides = {};

    for ( const clause of spec.split( ',' ) ) {

        const [ path, value ] = clause.split( ':' );
        const [ light, field ] = path.split( '.' );

        overrides[ light ] = { ...( overrides[ light ] ?? {} ), [ field ]: Number( value ) };

    }

    return overrides;

}

/**
 * The 3.13 grade, with every knob exposed so a judge can A/B what was measured.
 *
 * Two of the defaults are not the look spec's stated numbers, and both differences were found by
 * measurement rather than by eye:
 *
 * **Bloom threshold is 0.8, not the spec's "low/none".** That clause is correct for UE, whose
 * bloom is energy-conserving, and wrong for three, whose `BloomNode` ADDS a blurred copy. At the
 * spec's own intensity of 0.30, threshold 0 lifts whole-image p0.1 luma from 0.02496 to 0.08630 —
 * a 4.3x black lift, which the same spec forbids in bold. Threshold 0.8 keeps the intensity and
 * returns the black point to 0.02496 exactly.
 *
 * **Grain is enveloped, not flat.** Flat additive grain at sigma 1.5/255 has a 5.2/255 half-width,
 * so against a backdrop sitting near 3/255 it clips a tail of pixels to zero and CRUSHES the
 * blacks: p0.1 went 0.00869 -> 0.00057. A `4L(1-L)` midtone envelope fixes it (0.00842) and is
 * also the physics — grain is a fluctuation in developed silver density, and an unexposed region
 * has no grains to fluctuate.
 */
function buildGrade( query ) {

    const number = ( key, fallback ) => query.has( key ) ? Number( query.get( key ) ) : fallback;

    return new Grade( {
        toneCurve: query.get( 'tone' ) ?? 'aces',
        exposure: number( 'exposure', 1 ),
        bloomStrength: number( 'bloom', undefined ),
        bloomThreshold: number( 'thresh', undefined ),
        grainSigmaCodes: number( 'grain', undefined ),
        vignette: number( 'vignette', undefined ),
        saturation: number( 'sat', undefined ),
        // RCAS is an LDR perceptual-space operator and the grade runs it AFTER the transfer, on
        // architectural grounds. It defaults ON here and OFF in the constructor, and the split is
        // the point: a forward MSAA'd frame has nothing to recover, a temporal resolve does, and
        // this page is temporal by default. `TEMPORAL_RECOVERY_SHARPNESS` carries the sweep that
        // chose 1.2 — inside G4's band with 8% of margin, against `none`'s 2.5%.
        //
        // ⚠️ The reason this comment used to give for the after-the-transfer placement — that RCAS
        // before tone mapping takes the iris to luma 0.4159 / saturation 0.1268 against 0.1237 /
        // 0.2997, "a brown iris rendering grey" — DOES NOT REPRODUCE. Re-measured on post.html at
        // the same rect, converged frame 120: 0.1169/0.4086 with no sharpen, 0.1164/0.4032 with
        // RCAS 0.4 before tone mapping, 0.1172/0.4065 under MSAA. A 1.3% difference, not 2.4x. The
        // pass IS in the graph — it moves G4 by 1.26x — it simply does not do that. The placement
        // stands on the architecture; the number is withdrawn.
        sharpness: query.get( 'gsharp' ) === 'none' ? null
            : ( query.has( 'gsharp' ) ? Number( query.get( 'gsharp' ) ) : TEMPORAL_RECOVERY_SHARPNESS )
    } );

}

function buildBackdrop( stage, emissive = BACKDROP_EMISSIVE ) {

    const material = new MeshStandardNodeMaterial( {
        color: 0x000000,
        emissive,
        emissiveIntensity: 1,
        roughness: 1,
        metalness: 0
    } );

    const backdrop = new Mesh( new PlaneGeometry( 8, 6 ), material );

    // Named because `shadingFingerprint` keys on mesh names, and an unnamed mesh would land under
    // `mesh:anonymous` — which is a bucket, not an identity, and would collide with the next
    // unnamed mesh anybody adds.
    backdrop.name = 'backdrop';

    stage.add( backdrop );

    return backdrop;

}

/**
 * Loads the bake the current identity resolves to, puts it in the scene in place of whatever was
 * there, and rebinds the motion stack to it.
 *
 * Rebinding rather than resetting is deliberate: the stack re-snapshots the new figure's rest pose
 * and every layer's `onBind` runs again, but the layers keep their phase, so breath does not jump
 * back to end-expiration and the figure does not visibly restart when the dial moves.
 */
async function swapFigure( session, stack, stage, lights, backdrop, ground ) {

    const plan = await session.identity.resolve();
    const token = ++ session.loadToken;

    // The wardrobe needs the body that carries the `_HIDE_*` attributes; everything else — the
    // curvature map, the cavity map, the eye fit — is still keyed on the identity's own bake name,
    // because the two files are the same geometry and differ only by those attributes.
    const figure = await Figure.load( wardrobeBodyOr( plan.figures[ 0 ].url, session ) );

    // A fast slider drag starts several loads; only the newest may land.
    if ( token !== session.loadToken ) {

        figure.dispose();
        return;

    }

    // Phase 10. BEFORE the skin material and before the pose, because identity rewrites the
    // position buffer and everything downstream measures off it — `EyeMaterial` fits the sclera
    // sphere, `GroundContact` measures occluder radii, and `framedHeightFor` reads the bounds.
    // Absent `?identity=`, this returns immediately and fetches nothing.
    session.identityReport = await applyIdentityTargets( figure, session );

    // The skin material is built BEFORE the old figure comes out of the scene, because building it
    // fetches this bake's own baked curvature map and a fetch is another chance for a newer load
    // to overtake this one. Doing it here means the page never shows a gap.
    const skin = session.skinEnabled
        ? await createSkinMaterial( {
            albedoMap: figure.body.material.map ?? null,
            curvatureMapUrl: curvatureMapUrlFor( bakeNameFrom( plan.figures[ 0 ].url ) ),
            // Named explicitly rather than left to be derived, so `censusOfShading` can report
            // whether this plate has the cavity term without inferring it from a sibling path.
            cavityMapUrl: session.skinCavityStrength === 0
                ? null
                : cavityMapUrlFor( bakeNameFrom( plan.figures[ 0 ].url ) ),
            specularAntiAliasing: session.skinSpecularAntiAliasing,
            settings: session.skinCavityStrength === undefined
                ? undefined
                : { cavityStrength: session.skinCavityStrength }
        } )
        : null;

    if ( token !== session.loadToken ) {

        skin?.dispose();
        figure.dispose();
        return;

    }

    disposeShading( session );

    if ( session.figure !== null ) {

        stage.scene.remove( session.figure.root );
        session.figure.dispose();

    }

    stage.add( figure.root );

    // `?nudge` survives a bake swap. See `session.nudgeMetres`.
    figure.root.position.x = session.nudgeMetres;
    figure.root.updateMatrixWorld( true );

    // The rest pose goes on BEFORE the stack binds, and the order is the whole trick. MotionStack
    // snapshots rest from whatever pose the bones are in at bind time, and every layer composes
    // its delta onto that snapshot. Pose first and the arms micro-move about a body standing at
    // ease; pose after and they micro-move about a T-pose while the figure visibly snaps.
    const skeleton = new Skeleton( figure.root );

    if ( session.restPose !== null ) {

        const absent = session.restPose.applyTo( skeleton );
        if ( absent.length > 0 ) console.warn( `rest pose '${ session.restPose.name }': this figure has no ${ absent.join( ', ' ) }` );

        skeleton.update();
        figure.root.updateMatrixWorld( true );

    }

    session.figure = figure;
    session.skeleton = skeleton;
    session.target = createMotionTarget( figure.root );

    applyShading( session, skin );

    stack.bind( session.target );

    // Measured after posing, because the pose changes the figure's height by centimetres.
    session.framedHeightMetres = framedHeightFor( figure, session.frameMode, session.heightOverride );

    const { focus } = frameFigure( stage, figure, {
        mode: session.frameMode,
        heightMetres: session.framedHeightMetres
    } );

    aimRigAt( lights, session, focus, session.framedHeightMetres, stage );

    // The card does not move with the rig. It is emissive, so distance costs it nothing, and at
    // 8 x 6 m it still fills a full-body frame from 1.9 m behind the subject.
    backdrop.position.set( focus.x, focus.y, focus.z - BACKDROP_DISTANCE_METRES );

    // The occluder radii are MEASURED off the bake that just landed, so this has to re-run on
    // every gender swap rather than once at boot — a g100 thigh is not a g000 thigh.
    const unfitted = ground.fitTo( figure.root );

    if ( unfitted.length > 0 ) console.warn( `ground contact: this figure has no ${ unfitted.join( ', ' ) }` );

    ground.sizeTo( { focus, subjectHeightMetres: session.framedHeightMetres } );

    // LAST, and the order is load-bearing in two directions. The ground's occluder radii are
    // MEASURED off the meshes under `figure.root`, so dressing before `fitTo` would fit a capsule
    // to a trouser leg; and `dress()` rebuilds the body's index buffer, so framing before it is
    // framing on the whole body rather than on whatever the outfit leaves showing — which is what
    // keeps `?wear` from moving the camera relative to a nude plate.
    await dressFigure( session );

    // AFTER the wardrobe, and only because that is the order that reads: the groom is skinned to
    // the head alone and no garment can move it, so the placement is order-independent. It is last
    // so that a hair failure cannot take the body off the page.
    await attachHair( session, plan.figures[ 0 ].url, stage );

}

/**
 * The hair-shading request, read off the URL in one place.
 *
 * 🎯 Called ONLY when `?hair=1` is present, and that is a deliberate property rather than an
 * optimisation. `recordingQuery` makes this page state its own toggle surface from live reads, and
 * `alive-toggles.selftest.mjs` requires every observed key to be classified; the seven keys read
 * below can only change a plate CONTAINING a groom, so they have nothing to say about a plate that
 * has none and appearing on its surface would be seven rows gating nothing. `?clockdefect` and
 * `?trace` are classified the same way and for the same reason.
 */
function readHairRequest( query ) {

    // ⚠️ THE DEFAULT IS `r,trt` AND NOT `r,tt,trt`. TT is the transmission lobe and it ships OFF;
    // `HAIR_DEFAULTS.weightTT` carries the measurement, and the short version is that a rim light
    // with no shadow map transmits straight through the head and renders the groom blue.
    // `?hairlobes=r,tt,trt` is the plate that shows it.
    const lobes = ( query.get( 'hairlobes' ) ?? 'r,trt' )
        .split( ',' ).map( ( name ) => name.trim().toLowerCase() ).filter( ( name ) => name !== '' );

    const unknown = lobes.filter( ( name ) => [ 'r', 'tt', 'trt' ].includes( name ) === false );

    if ( unknown.length > 0 ) {

        throw new Error( `alive: ?hairlobes must be a comma-separated subset of r,tt,trt — got '${ unknown.join( ',' ) }'.` );

    }

    const defect = query.get( 'hairdefect' ) ?? 'none';

    if ( Object.hasOwn( HAIR_DEFECTS, defect ) === false ) {

        throw new Error( `alive: ?hairdefect must be one of ${ Object.keys( HAIR_DEFECTS ).join( ', ' ) }.` );

    }

    // 🎯 THE DEFAULT IS THE MODULE'S OWN RECOMMENDATION AND NOT A LITERAL, so this page cannot ship
    // an arm the measurements do not support. Until this round `alive.js` never imported `HairOIT`
    // at all, so `createHairMaterial`'s `alphaTest = 0.5` stood and the shipped avatar ran CUTOUT —
    // the arm 3.6 measured as the WORST under motion. `stage.js?hair=1` makes the same read.
    const oit = query.get( 'hairoit' ) ?? HAIR_OIT_DEFAULT_MODE;

    if ( HAIR_OIT_MODES.includes( oit ) === false ) {

        throw new Error( `alive: ?hairoit must be one of ${ HAIR_OIT_MODES.join( ', ' ) } — got '${ oit }'.` );

    }

    // 🎯 PUNCH-LIST 6.6, AND IT DEFAULTS **ON** RATHER THAN OFF, WHICH IS A DEPARTURE FROM THE
    // REQUEST THAT ASKED FOR IT (REQ-069 asked for `?hairmotion=1`).
    //
    // The reason is the blind critic's reading of the shipped build — *"nothing moves, and I can
    // say that from the data rather than by squinting"* — and the shape of every other A/B key on
    // this page: `?gtao=0`, `?specocc=0`, `?morphvel=off` all name the DEFECT side, because the
    // plate a judge captures should be the shipped one and the control should cost a flag. A
    // solver reachable only from `?hairmotion=1` is the round-13 HairOIT failure again: a working
    // subsystem that no judged plate contains.
    //
    // It is only safe to default on because the solver is a CONTROL-PRESERVING toggle with the head
    // still — see `attachHairDynamics` for what that is worth in pixels on this page — so `?freeze`
    // plates, which is every gate plate in the repository, do not move.
    const motion = query.get( 'hairmotion' ) ?? '1';

    if ( [ '0', '1' ].includes( motion ) === false ) {

        throw new Error( `alive: ?hairmotion must be 0 or 1 — got '${ motion }'.` );

    }

    // 3.22's A/B. `off` is three's behaviour — the solver overwrites `positionLocal` and nothing
    // assigns `positionPrevious`, so the groom reports its displacement from the skinned rest pose
    // as a per-frame velocity — and it is the control every number in `render/HairVelocity.js`'s
    // header is stated against. It names the DEFECT side for `?hairmotion`'s reason: the plate a
    // judge captures should be the shipped one.
    const velocity = query.get( 'hairvel' ) ?? HAIR_VELOCITY_DEFAULT_MODE;

    if ( HAIR_VELOCITY_MODES.includes( velocity ) === false ) {

        throw new Error( `alive: ?hairvel must be one of ${ HAIR_VELOCITY_MODES.join( ', ' ) } — got '${ velocity }'.` );

    }

    // 🎯 ROUND 26'S THREE SWEEP KNOBS, AND THEY EXIST BECAUSE THE DIAGNOSIS COULD NOT BE TESTED
    // WITHOUT THEM. R26 measured the primary lobe's 99th percentile over 207,947 gated hair pixels
    // at 6.80e-2 against a shipped mass mean of 6.78e-2 — the specular term's bright end landing on
    // the AVERAGE brightness of the mass it is meant to sit on top of — and named the three numbers
    // that set that ratio: `roughnessR`, `weightR` and `scatter`. Every other hair term on this page
    // already had a key; these three could only be changed by editing the module, which means no
    // round could sweep them and every claim about them was a CPU-mirror inference.
    //
    // ⚠️ ALL THREE DEFAULT TO `HAIR_DEFAULTS` AND NONE OF THEM CHANGES THE SHIPPED PLATE. They are
    // measuring instruments in the sense `?hairlobes=` is: the judged URL carries none of them, and
    // a plate that does carries it in its manifest through `describe()`.
    //
    // `?hairbeta=` is in KARIS' VARIABLE, β_K, which is the one `HAIR_DEFAULTS.roughnessR` holds and
    // is TWICE Marschner's β_M — see this material's header for the conversion, and read the band as
    // 0.174533…0.349066 rather than as 5…10. A key named in the wrong variable is exactly how R26's
    // own diagnosis came to report the shipped 0.26 as "14.9° against Marschner's 5–10°".
    const number = ( key, fallback, lowest, highest ) => {

        const raw = query.get( key );

        if ( raw === null ) return fallback;

        const value = Number( raw );

        if ( Number.isFinite( value ) === false || value < lowest || value > highest ) {

            throw new Error( `alive: ?${ key } must be a number in [${ lowest }, ${ highest }] — got '${ raw }'.` );

        }

        return value;

    };

    return {
        // The geometry stays, the shader goes. Holding the groom constant is what makes this the A
        // side of 3.5 rather than the A side of 3.6.
        bsdf: query.get( 'hairbsdf' ) !== '0',
        motion: motion === '1',
        velocity,
        lobes,
        oit,

        // `?hairscatter=0` is unchanged and every tool that passes it keeps working; what is new is
        // that it now accepts any scalar, so the pedestal can be swept rather than only removed.
        scatter: number( 'hairscatter', 1, 0, 8 ),

        // Upper bounds are generous on purpose: these are probes, and a probe that clamps silently
        // is worse than one that refuses. β_K is bounded BELOW at 1e-3 because `longitudinalNode`
        // clamps at EPSILON and a caller asking for zero would get the clamp rather than an error.
        roughnessR: number( 'hairbeta', undefined, 1e-3, 2 ),
        weightRScale: number( 'hairweightr', 1, 0, 16 ),

        sideVisibility: query.get( 'hairvis' ) === '0' ? 0 : 1,
        rootOcclusion: query.get( 'hairrootao' ) === '0' ? 1 : undefined,
        defect
    };

}

/**
 * Loads the groom for the bake that has just landed, rebinds it to the figure's live skeleton and
 * puts `HairMaterial` on it.
 *
 * ## Why the groom is REBOUND rather than added beside the figure
 *
 * `assets/hair/bob01/g050.glb` carries the whole 53-bone rig — `hair_cards.py` exports through the
 * same MPFB2 path the body does — but every one of the groom's 7,256 vertices is weighted 1.000 to
 * `head` and nothing else (verified by `verify_glb.mjs`, worst weight sum 1.000000, zero unweighted
 * vertices). Its own rig is therefore a copy of the bind pose that would sit motionless while the
 * body's head turned. What is kept is its `boneInverses`; what is thrown away is its bones. The
 * mesh is then reparented under `figure.root`, so `?nudge`, the rest pose and every head-idle
 * degree the motion stack writes reach the hair for free and cannot drift out of step with the
 * face by construction.
 *
 * 🚩 `frustumCulled` GOES OFF. A `SkinnedMesh`'s bounding sphere is computed in BIND pose and three
 * does not refit it as the skeleton moves; at portrait framing the groom is most of the frame, and
 * a head turn that took the bind-pose sphere off screen would delete the hair rather than crop it.
 * The cost is one draw call that is never rejected, on a mesh that is on screen in every frame this
 * page renders.
 *
 * The import is dynamic for `dressFigure`'s reason: a plate with no `?hair=1` must not pay for the
 * module, the 2.67 MB GLB or the two sidecar sheets, which is what keeps the default plate the one
 * the seven gates are stated on.
 *
 * ## 🎯 And the third piece: how the fragments reach the frame buffer
 *
 * A groom is a few hundred cut-out ribbons and a dozen of them overlap any given pixel, so the BSDF is only
 * half the picture — the other half is what a stack of overlapping cards resolves to.
 * `render/HairOIT.js` owns that and `configureHairMaterial` is the seam. Until this round this file
 * did not import it, so the material kept `HairMaterial`'s own `alphaTest = 0.5` and this page ran
 * the CUTOUT arm without ever saying so.
 *
 * The arm is `?hairoit` and its default is `HAIR_OIT_DEFAULT_MODE`. `HairOIT.js`'s header carries
 * the argument for that recommendation; what it CANNOT carry is what the arms cost HERE, because
 * every number in it was taken on `stage.html`, whose control frame is a groom and three lights
 * against this page's whole deferred stack. So both halves were re-measured on THIS page.
 *
 * ## What each arm costs on alive.html
 *
 * GPU timestamps, `?bare&freeze&seed=1&capture&gputime=1` at 1920x1080 dpr 1. Driven through
 * `__SUGATA_STEP__( 0 )` — a frozen page rendered again and again — so one `resolveTimestampsAsync`
 * corresponds to exactly one drawn frame. Polling a FREE-RUNNING rAF loop instead was tried first
 * and is not a measurement: three logs `WebGPUTimestampQueryPool [render]: Maximum number of
 * queries exceeded` and the samples come back as low as 4.03 ms on a frame that cannot be that
 * cheap, with `hash` reading 2.4 ms FASTER than the same page carrying no groom at all. 100 samples
 * after 60 warm-up steps.
 *
 *     | arm       | GPU p50 | GPU p95 | Δ p50   | Δ p95   |
 *     |-----------|--------:|--------:|--------:|--------:|
 *     | no `?hair`|  12.038 |  13.347 |       — |       — |
 *     | `blend`   |  11.777 |  19.239 |  −0.261 |  +5.892 |
 *     | `cutout`  |  12.799 |  14.311 |  +0.761 |  +0.964 |
 *     | `hash`    |  13.267 |  15.308 |  +1.229 |  +1.961 |
 *     | `wboit`   |  12.864 |  22.763 |  +0.826 |  +9.416 |
 *
 * ⚠️ THE NOISE FLOOR IS STATED BECAUSE TWO OF THOSE ROWS ARE INSIDE IT. The control was measured
 * again at the END of the same run — 12.016 p50, 12.663 p95 — so p50 reproduces to 0.022 ms and p95
 * to 0.684 ms across the run. `hash` was also measured twice (the second time as the default, with
 * no `?hairoit` in the url): 15.308 and 14.713 p95. So read `hash` as costing roughly 1.4-2.0 ms of
 * p95 and `blend`'s −0.261 p50 as zero.
 *
 * Against a 16.6 ms budget: `hash` lands at 15.3 ms p95 with about 1.3 ms in hand, and `wboit` at
 * 22.8 — SIX MILLISECONDS OVER, on a page that has to carry the skin, the eyes, the occlusion and
 * the grade as well. That is the same verdict `HairOIT.js` reached, on a much tighter margin: it
 * was choosing against a control frame of about 2 ms and this one is 13.347, so the whole hair
 * budget on the page that matters is the 3.25 ms the figure leaves.
 *
 * ## And what the cheapest arm costs in the picture, which is why `cutout` is not the default
 *
 * `?bare&seed=1&capture&grain=0` at 900x1200, the shipped TAAU path with the grade's frame-indexed
 * grain removed (it is a per-frame random field that sits on every arm equally and would swamp the
 * comparison). Motion stack LIVE — this page has no camera orbit, so the stimulus is head idle,
 * which is the motion a judge actually sees. 60 warm-up steps at 1/60, then 20 frames accumulated
 * with Welford per pixel; mean per-pixel temporal sigma in 8-bit code values.
 *
 * Two bands, because one threshold cannot separate the groom from what the groom changes AROUND
 * itself: `mass` is the groom's own pixels (272,609 px, 25.24% of the frame), `touched` is every
 * pixel it moves at all — its cast shadow, and the card wash the next section is about — at
 * 475,209 px, 44.00%. Both bands are measured once and applied to every arm, so an arm that chews
 * its own silhouette cannot shrink its own denominator.
 *
 *     | arm      | σ mass | σ touched | local grain, mass |
 *     |----------|-------:|----------:|------------------:|
 *     | `blend`  | 3.9825 |    3.7046 |            0.5971 |
 *     | `cutout` | 6.4631 |    5.2545 |            1.2061 |
 *     | `hash`   | 5.2204 |    4.6488 |            1.3045 |
 *     | `wboit`  | 3.5387 |    3.4495 |            0.5404 |
 *
 * `cutout` is the least stable arm here, as it was on `stage.html`, and `hash` is 1.24x steadier
 * than it for 1.0 ms more of p95. That is the trade this page takes, and it is why the default is
 * not the arm that was shipping by accident.
 *
 * ## 🚩 AND WHAT LOOKING AT THE PLATE FOUND, WHICH NEITHER NUMBER ABOVE CONTAINS
 *
 * Moving off `cutout` puts a CARD-SHAPED WASH across the chest and shoulders — flat translucent
 * slabs with straight edges, where the cut-out leaves clean skin. It is visible at a glance and no
 * statistic in either table above reports it, which is the whole argument for capturing the plate
 * and looking at it. `captures/hair-compose/ghost-chest-{hash,cutout}.png` is the pair.
 *
 * Measured on the 1200x1600 portrait plates, over region R — the lit body pixels the `cutout` arm
 * leaves within 2/255 of the same plate with no hair at all, 830,020 px:
 *
 *     | arm      | mean Δ over R | worst Δ | pixels over 8/255      |
 *     |----------|--------------:|--------:|------------------------|
 *     | `cutout` |        0.1843 |     2.0 | 0 (0.000% of frame)    |
 *     | `hash`   |        5.2190 |   164.9 | 221,203 (11.521%)      |
 *     | `blend`  |        6.0944 |   117.1 | 237,436 (12.366%)      |
 *     | `wboit`  |        6.0960 |   117.0 | 237,522 (12.371%)      |
 *
 * 🎯 THREE ARMS OUT OF FOUR SHOW IT AND THEY ARE THE THREE THAT KEEP PARTIAL COVERAGE, so it is NOT
 * a property of hashed alpha testing and swapping arms cannot fix it. It is the GROOM's: a card's
 * alpha is mip-filtered strand coverage, so at the minification a chest card is seen at, the whole
 * quad carries a low but non-zero alpha, and every arm that does not throw that tail away renders
 * the quad. `cutout` is the outlier — a binary test at 0.5 deletes the tail and, with it, the
 * evidence. It was hiding an asset defect, which is the worst reason to keep a default.
 *
 * So the arm stays `hash` and the finding is filed against the groom rather than absorbed here:
 * the cards extend past their strands and the atlas alpha needs coverage-preserving mips or
 * trimmed cards. `?hair=1&hairoit=cutout` is the plate that hides it, from a URL, whenever somebody
 * wants to see the difference again.
 *
 * 🎯 THE SAME MECHANISM EXPLAINS THE BALD CROWN THE BLIND CRITIC REPORTED, and that is the
 * cheerful half of it. On `?hairoit=wboit` the lit patch at the parting is GONE — the low-alpha
 * cards over the scalp are drawn instead of discarded, so they cover it — while on `cutout` and, to
 * a lesser degree, `hash` it is still there. `captures/hair-compose/portrait-hair-wboit.png` beside
 * `portrait-hair-cutout.png`. Some of what was read as a groom defect is a coverage defect, and it
 * will move when the alpha tail does.
 *
 * 🚩 ONE OF `HairOIT.js`'s FINDINGS DOES NOT REPRODUCE HERE AND IS RECORDED RATHER THAN QUIETLY
 * DROPPED. It measured `hash` as FINER-grained than the cut-out it replaces — 1.636 against 1.938
 * on a converged still. On this page the ordering is the other way round: 1.3045 against 1.2061, so
 * `hash` is 1.08x grainier, not 1.18x finer. The two are not the same measurement — that one was a
 * static camera on a still, this one is the shipped temporal resolve over a moving head — but the
 * honest reading is that the stipple `hash` hands the resolve is NOT integrated away here, which is
 * exactly the caveat `HairOIT.js` flags: `getAlphaHashThreshold` takes no frame index, so the
 * pattern is fixed in object space and reprojection preserves it.
 *
 * ## 🎯 PUNCH-LIST 3.21: THE DEFAULT MOVES TO `stochastic`, AND THE CAPTURE COLLISION WAS NOT REAL
 *
 * The paragraph above ends "giving the hash a per-frame seed remains the open item, and it belongs
 * to whoever owns the capture contract". It was checked rather than inherited, and there is no
 * collision: `?capture` pins `nodeFrame.frameId` to the step count exactly — that is 3.20's whole
 * subject and `alive-capture-determinism.selftest.mjs`'s O check asserts it — so a seed derived
 * from `frameId` is pinned with it and a seeded capture still reproduces frame for frame. Verified
 * by running that gate on this change. The seed is therefore taken, in `render/HairOIT.js`, and
 * this page's default arm moves with `HAIR_OIT_DEFAULT_MODE`.
 *
 * What it is worth ON THIS PAGE, measured this session at 900x1200 dpr 1, `?bare&seed=1&grain=0`,
 * motion stack LIVE, 60 warm-up steps at 1/60 then 20 frames, over the 510,162 px the groom moves
 * against the same page with no groom (47.24% of the frame):
 *
 *     | arm          | local grain | temporal sigma |
 *     |--------------|------------:|---------------:|
 *     | `blend`      |      0.5764 |         3.7434 |
 *     | `cutout`     |      0.9417 |         4.8938 |
 *     | `hash`       |      1.1551 |         4.6060 |
 *     | `stochastic` |      1.1555 |     **4.3292** |
 *
 * ⚠️ **UNDER LIVE MOTION THE GRAIN IS A DEAD HEAT and only the stability moves — 6.0% steadier.**
 * The gain is on the CONVERGED STILL, which is what a judge captures and what the blind critic
 * looked at: seed dependence there is 3.7620 cv RMS against a frozen field's 14.3079, a 3.80x
 * reduction, and local grain keeps falling past the floor `hash` cannot pass. `HairOIT.js`'s ##
 * THE COVERAGE DECISION carries both tables, and it names the reason the live figure is so much
 * weaker: `TAAUNode.js:678` reads a stochastic alpha test's own depth flicker as a disocclusion and
 * throws the history away at exactly the pixels that needed it. That is filed against
 * `render/TRAAPost.js` and it caps what the arm can buy here.
 */
async function attachHair( session, figureUrl, stage ) {

    if ( session.hairEnabled !== true ) return;

    // A gender swap runs this again over a fresh groom, so last bake's slab fit has to go before
    // this one's is installed — otherwise a bake with no groom would keep fitting the slab to the
    // box of a groom that is no longer in the scene. The solver is dropped for the same reason and
    // it matters more: it holds a rest pose derived from the OLD groom's vertex buffer, and a
    // solver left running across a bake swap would drive the new groom from the old one's chains.
    session.hairSlabUpdate = null;
    session.hairMotionUpdate = null;
    session.hairDynamics = null;

    const bake = bakeNameFrom( figureUrl );
    const groomUrl = HAIR_BAKES.get( bake );

    if ( groomUrl === undefined ) {

        console.warn( `?hair=1 is ignored on ${ bake }: the '${ HAIR_GROOM_ID }' groom is baked per ` +
            `identity and only ${ [ ...HAIR_BAKES.keys() ].join( ', ' ) } have one. Run ` +
            'tools/figure-pipeline/build_figure.py --hair for this bake.' );

        return;

    }

    const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );
    const groom = await new GLTFLoader().loadAsync( groomUrl );

    const request = session.hairRequest;
    const skinned = [];

    groom.scene.traverse( ( object ) => {

        if ( object.isSkinnedMesh === true ) skinned.push( object );

    } );

    if ( skinned.length === 0 ) throw new Error( `alive: ${ groomUrl } carries no SkinnedMesh — the groom did not export skinned.` );

    // The rebind. Missing bones are reported by NAME rather than by count, because the failure this
    // guards against is a rig rename in the figure pipeline, and "3 bones missing" would send the
    // next reader to the wrong file.
    const figureBones = new Map();
    session.figure.root.traverse( ( object ) => {

        if ( object.isBone === true ) figureBones.set( object.name, object );

    } );

    for ( const mesh of skinned ) {

        const absent = mesh.skeleton.bones.filter( ( bone ) => figureBones.has( bone.name ) === false );

        if ( absent.length > 0 ) {

            throw new Error( `alive: the groom is skinned to ${ absent.map( ( bone ) => bone.name ).join( ', ' ) }, ` +
                'which this figure\'s rig does not have. The groom and the figure are out of step.' );

        }

        const bones = mesh.skeleton.bones.map( ( bone ) => figureBones.get( bone.name ) );

        mesh.bind( new SkinSkeleton( bones, mesh.skeleton.boneInverses ), new Matrix4() );
        mesh.frustumCulled = false;

        // Hair shadowing the forehead is a large part of why hair reads as hair, and the key is the
        // only shadow caster on this rig (3.8, at a measured 2.62 ms per caster).
        //
        // 🚩 BUT THE CUT-OUT DOES NOT REACH THE DEPTH PASS, AND THE COMMENT HERE USED TO SAY IT
        // DID. Measured this round rather than reasoned about. three's shadow pass swaps in one
        // shared material — `getShadowMaterial( light )`, `ShadowFilterNode.js`, whose `colorNode`
        // is `vec4( 0, 0, 0, 1 )` — and `Renderer.js:3585` copies exactly two alpha fields onto it
        // from the object's own material: `alphaTest` and `alphaMap`. `alphaHash` is not among
        // them, and `HairMaterial` carries the strand coverage in its `colorNode` rather than in
        // `alphaMap` — nothing in this file or in `configureHairMaterial` assigns one, and
        // `sugata.session.hairMaterial.alphaMap` was read live off the page as null on the `cutout`
        // and `hash` arms. The depth material therefore tests an alpha of 1 against the cutoff,
        // discards nothing, and the groom casts the shadow of its CARD QUADS, not of its strands.
        //
        // That is a defect and it is not this file's to fix: the repair is `alphaMap` set beside
        // the colour node in `packages/core/src/material/HairMaterial.js`, plus a floor for the
        // arms that zero `alphaTest`. Filed as a request. It is arm-independent — it was true of
        // the cut-out this page shipped before this round too.
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        session.figure.root.add( mesh );

    }

    session.hair = { root: session.figure.root, meshes: skinned, bake };

    if ( request.bsdf === false ) {

        // ⚠️ AND THE ARM DOES NOT REACH THIS PLATE, WHICH IS WORTH SAYING OUT LOUD RATHER THAN
        // LEAVING AS A SURPRISE. `GLTFLoader` builds a `MeshStandardMaterial`; the WebGPU backend
        // converts it to a node material internally and per render, so anything
        // `configureHairMaterial` set on it would be set on an object the renderer discards. What
        // this plate runs is the groom's own glTF `alphaMode: MASK` at cutoff 0.5 — which IS the
        // `cutout` arm, so the A side of 3.5 is honest, and a `?hairoit` on it would be a lie.
        if ( request.oit !== 'cutout' ) {

            console.warn( `?hairoit=${ request.oit } is ignored under ?hairbsdf=0: the shipped GLB ` +
                'material is a glTF MASK cutout and the backend rebuilds it every render, so no ' +
                'OIT configuration survives on it. This plate is the cutout arm.' );

        }

        // 🚩 AND THE SOLVER CANNOT RUN ON THIS PLATE EITHER, FOR THE SAME MECHANISM ONE LINE UP.
        // `HairDynamics` delivers its answer as a `positionNode`, and a node set on the GLB's
        // `MeshStandardMaterial` is set on an object the WebGPU backend rebuilds every render. So
        // `?hairbsdf=0&hairmotion=1` would be a plate that says it simulates and does not, which is
        // worse than one that refuses. It refuses, in words.
        if ( request.motion === true ) {

            console.warn( '?hairmotion is ignored under ?hairbsdf=0: the solver drives the groom ' +
                'through material.positionNode, and the shipped GLB material is rebuilt by the ' +
                'backend every render, so no node survives on it. This plate is a RIGID groom.' );

        }

        console.log( `hair: ${ bake } groom on the page with its SHIPPED GLB material — ?hairbsdf=0, the A side of 3.5.` );
        return;

    }

    const material = await createHairMaterial( {
        flowMapUrl: HAIR_SHEET_URLS.flow,
        depthMapUrl: HAIR_SHEET_URLS.depth,
        alphaMap: skinned[ 0 ].material?.map ?? null,
        multisampled: session.multisampled,
        defect: request.defect,
        settings: {
            // `?hairlobes=` decides whether R is live at all and `?hairweightr=` scales it, so the
            // two compose: `?hairlobes=trt&hairweightr=4` is still R off. Multiplying rather than
            // replacing is what keeps the existing key's meaning intact.
            weightR: ( request.lobes.includes( 'r' ) ? 1 : 0 ) * request.weightRScale,
            weightTT: request.lobes.includes( 'tt' ) ? 1 : 0,
            weightTRT: request.lobes.includes( 'trt' ) ? 1 : 0,
            scatter: request.scatter,
            sideVisibility: request.sideVisibility,
            ...( request.rootOcclusion === undefined ? {} : { rootOcclusion: request.rootOcclusion } ),

            // `undefined` is the "not asked for" signal rather than a sentinel value: the spread
            // below is over `HAIR_DEFAULTS`, and writing `roughnessR: undefined` into it would
            // overwrite the default with undefined and take β_TT and β_TRT down with it.
            ...( request.roughnessR === undefined ? {} : { roughnessR: request.roughnessR } )
        }
    } );

    // 🎯 THE THIRD PIECE, AND IT IS ONE CALL BECAUSE THAT IS WHAT THE SEAM IS FOR. `HairMaterial`
    // decides what a hair pixel LOOKS like and leaves `alphaTest = 0.5` behind it; `HairOIT`
    // decides how a dozen of them stack, and overwrites that. Nothing about the BSDF is visible
    // from the OIT side — the accumulation reads `output`, which is whatever the material computed.
    //
    // `alphaToCoverage` is carried through rather than decided in either place: it is the CALLER's
    // MSAA decision, it is inert without a multisampled target, and the shipped path is TAAU.
    // 🚩 AND THE ARM HAS TO BEND HERE, BECAUSE ONE PAIR IS GENUINELY INCOMPATIBLE. The shipped
    // `stochastic` arm refuses `alphaToCoverage` — `NodeMaterial` would swap its coverage test for
    // an edge softener around a per-pixel-random threshold — so an `?aa=msaa` plate that asked for
    // hair would throw and lose the groom. It falls back to `cutout`, which is the arm
    // alpha-to-coverage is FOR, and says so, rather than either throwing or silently running an
    // estimator nothing integrates.
    const arm = ( request.oit === 'stochastic' && session.multisampled ) ? 'cutout' : request.oit;

    if ( arm !== request.oit ) {

        console.warn( `?hairoit=${ request.oit } cannot run under ?aa=msaa — the stochastic arm's ` +
            'threshold is per-pixel noise and alpha-to-coverage would smoothstep across it. This ' +
            'plate is the cutout arm. Use the temporal resolve (the default) for the shipped arm.' );

    }

    configureHairMaterial( material, arm, {
        alphaToCoverage: session.multisampled,
        slab: stage.hairOIT?.slab ?? null,
        defect: null
    } );

    // Punch-list 6.6, and it runs BEFORE the material is handed to the meshes on purpose: it sets
    // `material.positionNode`, and a node added to a material the renderer has already drawn with
    // needs the program rebuilt. Nothing has drawn with this one yet.
    if ( request.motion === true ) await attachHairDynamics( session, stage, skinned, material );

    for ( const mesh of skinned ) mesh.material = material;

    session.hairMaterial = material;

    // The `wboit` arm's weight curve is fitted to the GROOM'S OWN depth slab rather than to the
    // camera frustum — `HairOIT.js` measured the published curve as giving a head 3.7x-4.0x of
    // front-to-back discrimination with the near plane setting the absolute weight — so the slab
    // has to be told where the groom is. Every other arm allocates no slab and this stays null.
    //
    // 🚩 IT IS A CLOSURE ON THE SESSION AND NOT A `stage.onFrame` CALLBACK, and that is the whole
    // reason `trackFigure` exists: `?capture` takes the frame loop away from requestAnimationFrame
    // and calls `stage.draw()` directly, so registered frame callbacks stop firing — on precisely
    // the plates a judge measures. This page has already shipped a contact shadow that stopped
    // following the feet that way.
    //
    // ⚠️ THE BOX IS THE BIND-POSE ONE, and that is a deliberate approximation with a stated bound.
    // `Box3.expandByObject` on a `SkinnedMesh` transforms the GEOMETRY's box by `matrixWorld` and
    // does not skin it, so head idle — degrees, not radians — moves the real groom inside a box
    // computed once. A slab slightly too wide only flattens the weight curve, and
    // `HAIR_WEIGHT_RANGE`'s own sweep measured three thousand times that curve as worth about 1.5
    // code values. What does have to be per frame is the VIEW transform, because `?frame=body` and
    // any console `frame()` move the camera and the slab is expressed in view depth.
    if ( stage.hairOIT !== null ) {

        const bounds = new Box3();
        const scratch = new Vector3();

        for ( const mesh of skinned ) bounds.expandByObject( mesh );

        session.hairSlabUpdate = () => {

            // `viewDepthExtent` states that `matrixWorldInverse` must be current, and this runs
            // BEFORE the draw that would refresh it. One 4x4 invert against a deferred frame.
            stage.camera.updateMatrixWorld();

            const extent = viewDepthExtent( bounds, stage.camera, scratch );
            stage.hairOIT.setSlab( extent.near, extent.far );

        };

    }

    console.log( `hair: ${ bake } groom, ${ skinned.length } mesh(es), oit ${ request.oit }, ` +
        `motion ${ session.hairDynamics === null ? 'off' : 'on' }, ` +
        `${ JSON.stringify( material.describe() ) }` );

}

/**
 * PUNCH-LIST 6.6 — puts `motion/HairDynamics.js` on the groom this page just rebound.
 *
 * ## Why this exists as its own function and why the round it landed in matters
 *
 * The solver landed a round before this wiring did, gated at 25/25 by
 * `packages/core/src/motion/HairDynamics.selftest.mjs`, and was reachable only from
 * `packages/testbed/src/hair.html?motion=1` — a page nobody judges. **That is the second time this
 * project has built a working piece that never reached the acceptance page**: round 13 shipped
 * `render/HairOIT.js` with `alive.js` not importing it at all, so the judged plate ran the CUTOUT
 * arm while the module recommended something else, and both times only an adversarial pass found
 * it. The blind critic's reading of the build this replaces is the cost of that:
 * *"Nothing moves, and I can say that from the data rather than by squinting."*
 *
 * ## The coupling, in one sentence
 *
 * The groom is skinned 1.000 to `head` and nothing else, so its skinned position is
 * `mesh.matrixWorld · head.matrixWorld · boneInverse[head] · restLocal` — ONE rigid transform, which
 * is why `setHeadMatrix` is the entire input to the simulation and why `MotionStack`'s head idle,
 * gaze and sway reach the hair without any of them knowing the hair exists.
 *
 * ⚠️ `boneInverse[head]` IS THE GROOM'S OWN, and it survives the rebind by reference rather than by
 * being kept aside: `attachHair` calls `mesh.bind( new SkinSkeleton( bones, mesh.skeleton.boneInverses ), … )`,
 * so the new skeleton is the FIGURE's bones with the GROOM's inverses, and reading
 * `mesh.skeleton.boneInverses[ i ]` after the rebind reads the same matrix it would have before.
 * The bone at the same index is now the figure's `head`, which is exactly the other half this needs.
 *
 * ## 🎯 WHY IT IS SAFE TO DEFAULT ON: the toggle is a CONTROL, not a second stimulus
 *
 * `HairDynamics.selftest.mjs`'s clause E measures the solver against the rigid pose with the head
 * STILL and requires them to agree to 0.01 mm; the run that gated it read 0.000132 mm over 4,998
 * particles. Every objective gate in this repository captures `?freeze`, where the head does not
 * move — so those plates get a groom the solver reproduces rather than a groom it perturbs. The
 * pixel half of that claim is measured on THIS page rather than inherited, in the ALIVE section of
 * `HairDynamics.selftest.mjs`.
 *
 * ## What is NOT fixed by this, named so its absence is not read as a claim
 *
 * The TANGENT. `HairMaterial` reads a baked tangent (`hair.md` §6.1) and a card that has moved is
 * shaded off a strand direction that no longer points along the strand. The rebuild kernel already
 * computes the live one; deciding how it reaches the BSDF is the shading owner's, and it is REQ-070
 * in `docs/OPEN-REQUESTS.md`.
 *
 * The SHADOW is not in that list, and it was expected to be: r185's `Renderer._getShadowNodes`
 * reads `material.positionNode` (`node_modules/three/src/renderers/common/Renderer.js:3416-3418`)
 * and assigns it to the shadow override material (`:3610`), so the groom casts from where the
 * solver put it. Read out of the renderer source rather than assumed, because the neighbouring
 * comment in `attachHair` records the opposite finding for `alphaHash`, which is NOT copied.
 *
 * @param {Object} session - the live session; the two handles are installed on it.
 * @param {Stage} stage - for `stage.renderer`, which the solver submits its own compute pass on.
 * @param {Array} meshes - the groom's skinned meshes, already rebound to the figure's skeleton.
 * @param {Object} material - the `HairMaterial` the solver's `positionNode` is installed on.
 */
async function attachHairDynamics( session, stage, meshes, material ) {

    // `deriveCardGroom` reads ONE geometry, and a two-mesh groom would need one solver each with a
    // shared collider fit. The shipped bakes are one mesh; a refusal in words is the honest answer
    // to a groom that is not, rather than a solver silently driving the first mesh of two.
    if ( meshes.length !== 1 ) {

        console.warn( `?hairmotion: the solver needs one SkinnedMesh and this groom has ` +
            `${ meshes.length }. The groom is RIGID on this plate.` );

        return;

    }

    const mesh = meshes[ 0 ];
    const boneIndex = mesh.skeleton.bones.findIndex( ( bone ) => bone.name === 'head' );

    if ( boneIndex < 0 ) {

        console.warn( '?hairmotion: the groom\'s skeleton has no `head` bone to hang the solver on. ' +
            'The groom is RIGID on this plate.' );

        return;

    }

    const headBone = mesh.skeleton.bones[ boneIndex ];
    const headBoneInverse = mesh.skeleton.boneInverses[ boneIndex ].clone();

    // The fit below reads world matrices off the figure, and `attachHair` has just reparented the
    // groom under it. Nothing has rendered since, so nothing has refreshed them.
    session.figure.root.updateMatrixWorld( true );

    // Dynamic for `attachHair`'s own reason one function up: a plate that did not ask for hair must
    // not fetch a module it cannot use. Everything expensive in `HairDynamics.js` is inside
    // `createHairDynamics`, so the import itself is the module graph and nothing else.
    const { createHairDynamics } = await import( '../../core/src/motion/HairDynamics.js' );

    const dynamics = createHairDynamics( { renderer: stage.renderer, geometry: mesh.geometry } );

    dynamics.setHeadMatrix( mesh.matrixWorld, headBone.matrixWorld, headBoneInverse );

    // The shoulder capsule. `fitColliders` sizes it by the same rule it sizes the skull by — the
    // largest radius the REST pose does not already violate — because a collider the rest pose
    // violates pushes the groom out of one shape and into the other on frame one, and that is what
    // would stop the still plate being a control. `HairDynamics.fitColliders` carries the afternoon
    // that measurement cost.
    const bones = new Map();
    session.figure.root.traverse( ( object ) => {

        if ( object.isBone === true ) bones.set( object.name, object );

    } );

    const clavicleLeft = bones.get( 'clavicle_l' ) ?? null;
    const clavicleRight = bones.get( 'clavicle_r' ) ?? null;
    const leftShoulder = new Vector3();
    const rightShoulder = new Vector3();

    const colliders = dynamics.fitColliders( {
        shoulderLeft: clavicleLeft === null ? null : clavicleLeft.getWorldPosition( leftShoulder ),
        shoulderRight: clavicleRight === null ? null : clavicleRight.getWorldPosition( rightShoulder )
    } );

    // 🎯 THE ONE LINE THE WHOLE SUBSYSTEM ARRIVES THROUGH. `NodeMaterial.setupPosition` runs
    // `skinning( object )` and THEN overwrites `positionLocal` with `positionNode` (r185,
    // `NodeMaterial.js:774` and `:802`), so a card vertex takes the solver's answer and the two
    // 326-vertex scalp cap shells — which are head, not hair — keep their skinning. The choice is
    // one `select` on `vertexIndex` inside `HairDynamics`, not a second dispatch here.
    material.positionNode = dynamics.positionNode;

    // 🎯 AND THE LINE THAT HAS TO ACCOMPANY IT, which for two rounds did not. Overwriting
    // `positionLocal` without also assigning `positionPrevious` does not leave the groom with no
    // velocity — it leaves it reporting the whole displacement from its skinned rest pose as this
    // frame's motion, measured at p90 259.9 px/frame against `TAAUNode.maxVelocityLength` 128, on a
    // groom that is geometrically static. `render/HairVelocity.js` carries the measurement and the
    // six knobs that exclude the resolve. It is a `render/**` repair rather than a solver one for
    // the same reason `MorphVelocity.js` is: the defect is in what the velocity buffer contains.
    installHairVelocity( material, session.hairRequest?.velocity ?? HAIR_VELOCITY_DEFAULT_MODE );

    session.hairDynamics = dynamics;

    session.hairMotionUpdate = ( deltaSeconds ) => {

        // The bones moved in `advanceSimulation` and the renderer will not refresh their world
        // matrices until it draws, which is after this. `advanceSimulation` does this walk itself
        // — but only when the eye rig is live, so `?eyes=0` and `?freeze` both reach here with
        // matrices from the previous frame, and the hair would lag the head by one frame on
        // exactly the plates that are hardest to notice it on.
        session.figure.root.updateMatrixWorld( true );

        dynamics.setHeadMatrix( mesh.matrixWorld, headBone.matrixWorld, headBoneInverse );

        // The skull rides the head matrix above; the capsule does not, because it hangs off the
        // clavicles and `Sway` moves the whole column.
        if ( clavicleLeft !== null && clavicleRight !== null ) {

            dynamics.setShoulders(
                clavicleLeft.getWorldPosition( leftShoulder ),
                clavicleRight.getWorldPosition( rightShoulder ) );

        }

        return dynamics.update( deltaSeconds );

    };

    console.log( `hair: DFTL on ${ dynamics.groom.chainCount } chains x ` +
        `${ dynamics.groom.pointsPerChain } rings = ${ dynamics.groom.particleCount } particles, ` +
        `skull r=${ ( colliders.skullRadius * 1000 ).toFixed( 1 ) } mm, ` +
        `capsule r=${ ( colliders.capsuleRadius * 1000 ).toFixed( 1 ) } mm. ` +
        '?hairmotion=0 is the rigid control.' );

}

/**
 * The body a figure should be loaded from: the wardrobe's, when this plate is dressing.
 *
 * Refuses in words rather than degrading, because a wardrobe that silently does nothing on four
 * fifths of the identity range reads as a broken wardrobe rather than as an unbuilt one.
 */
function wardrobeBodyOr( url, session ) {

    if ( session.wardrobeRequest === null ) return url;

    if ( bakeNameFrom( url ) !== WARDROBE_BAKE ) {

        console.warn( `?wear is ignored on ${ bakeNameFrom( url ) }: punch-list 9.4 owns the other ` +
            `four bakes and only ${ WARDROBE_BAKE } has garment fragments. Load ?gender=0.5 to dress.` );

        session.wardrobeRequest = null;
        return url;

    }

    return WARDROBE_BODY_URL;

}

/**
 * Builds the wardrobe over the figure that has just landed and wears what the URL asked for.
 *
 * The import is dynamic so a plate with no `?wear` never pays for it — neither the module nor the
 * manifest fetch — which is what makes the shipped default byte-identical with this code present.
 *
 * A refused outfit is REPORTED and the page carries on nude, rather than throwing out of the boot
 * path and leaving a blank canvas. Two garments at one layer is a caller error, not a page error,
 * and the failure a judge needs to see is the figure plus the reason.
 */
async function dressFigure( session ) {

    if ( session.wardrobeRequest === null ) return;

    if ( WARDROBE_DRESS_DEFECTS[ session.wardrobeDressDefect ] === undefined ) {

        throw new Error( `alive: ?wearrace must be one of ${ Object.keys( WARDROBE_DRESS_DEFECTS ).join( ', ' ) }.` );

    }

    // 🚩 THE FIGURE IS HIDDEN FOR THE WHOLE OF THE WARDROBE'S ASYNC WINDOW, AND THIS IS WHAT MAKES
    // A DRESSED PLATE REPRODUCIBLE. Until this line, `?wear` made every dressed plate STOCHASTIC:
    // the same URL loaded three times returned three distinct images, so no dressed plate could be
    // gated at all and the whole of Phase 9 was unmeasurable.
    //
    // The mechanism, measured rather than reasoned out. `swapFigure` adds the figure to the scene
    // and only THEN awaits this function, which dynamically imports `Wardrobe.js`, fetches the
    // manifest and fetches one GLB per garment. rAF is still running through all of it — `?capture`
    // does not take the frame loop over until `boot()` reaches `takeOverFrameLoop`, well after
    // `swapFigure` returns — so the figure is RENDERED for however many frames those fetches
    // happen to take. That count is a property of the machine and the disk cache, not of the URL.
    //
    // Per-frame renderer state then carries the count past the capture epoch. `takeOverFrameLoop`
    // pins `nodeFrame.frameId`, the resolve's jitter index and its history (3.20) and all three
    // read correct on every one of these loads — the leak is state that advances only on frames
    // where the MESH is drawn, which no epoch reset reaches. A nude page never showed it because
    // `swapFigure` returns immediately after adding the figure, so ZERO boot frames draw it; the
    // wardrobe's awaits are what open the window.
    //
    // ⚠️ WHICH counter it is was NOT fully isolated, and the fix does not depend on knowing. Two
    // partial attributions, both by execution: `?morphvel=hold` makes the dressed plate
    // reproducible 3 of 3 where `exact` and `off` are 1 of 3, and deleting `MorphVelocity`'s
    // `live.frameId === frameId` guard — which holds a BOOT frame index across the epoch reset —
    // moves the outcome from 1 of 3 agreeing to 3 of 4 without closing it. So the previous-
    // influence shift is implicated and is not the whole of it, and chasing the rest would be the
    // enumeration trap this repo has been burned by three times: the counters are an open set and
    // the BOOT FRAME COUNT is the single input all of them read. Removing the input closes the
    // class. `MorphVelocity`'s stale guard is filed separately as a latent hazard for the other
    // pages that render during boot.
    //
    // Measured at 450x600, `?bare&freeze&seed=1&aa=traa&grade=0&wear=&capture`, 12 steps, one
    // vite, separate browser contexts, reading `sugata.captureClock().bootFrameId` beside each
    // plate. **The plate was an exact function of the boot frame count** — eight loads, three
    // epochs, three digests, no exceptions:
    //
    //   | bootFrameId | plate sha (16) | loads |
    //   |-------------|----------------|-------|
    //   | 12          | d4c39944a3966be4 | 1   |
    //   | 13          | 713be99f9eca75e5 | 5   |
    //   | 14          | 4dbb93ae41cd43ed | 2   |
    //
    // and the nude control on the same recipe read bootFrameId 10 on 4 of 4 loads and one digest.
    // Worst residue between dressed loads: 1653 px of 270,000 at Δ117/255 (`?wear=`), and on the
    // shipped default at 3840x5120 the Phase 8 harness recorded up to Δ122 on 224 px.
    //
    // With the figure hidden across the window the same probe reads, still across three distinct
    // boot epochs: `?wear=` 6 loads -> worst 1 px at Δ1/255; `?wear=female_casualsuit01,shoes01`
    // 5 loads BYTE-IDENTICAL on the temporal path (boot epochs 23 and 25) and 5 loads
    // byte-identical on the shipped default (boot epochs 25 and 26). The 1-px remainder is the
    // resolve-plus-grain quantiser this file already documents under `takeOverFrameLoop`.
    //
    // ⚠️ IT IS A VISIBILITY FLAG, NOT A REMOVAL. `stage.add` has already happened, the ground
    // contact has already been fitted and the camera has already been framed off the whole body —
    // all three read the object, not the draw — so nothing upstream of here changes. And it is the
    // same promise 9.8 already makes for the decency floor one level down: a body that is going to
    // be dressed is not drawn undressed first. On a live gender swap it costs a blink while the
    // new bake's garments load, which is the correct trade for the same reason.
    const defect = WARDROBE_DRESS_DEFECTS[ session.wardrobeDressDefect ];

    session.figure.root.visible = defect.holds === false;

    try {

        await putGarmentsOn( session, defect );

    } finally {

        session.figure.root.visible = true;

    }

}

/**
 * The named ways the dressing race can be reintroduced, so the gate on it is proved against a PAGE
 * rather than against a hand edit — the same discipline `CAPTURE_CLOCK_DEFECTS` follows, and for
 * the same reason: §1.25a, a gate that only catches its own known-bad is decorative.
 *
 * The class is stated out loud rather than left to be inferred from the two rows: **any window in
 * which the figure is DRAWN while the wardrobe is still resolving.** Both rows below are instances
 * of it and neither is the other's special case — `unheld` is what shipped, `released-early` is the
 * half-fix a reader who stopped at "hold it over the import" would write next, and it is the more
 * useful of the two because it looks correct.
 *
 * `holds` is whether the figure is hidden at the start of the window; `releaseBeforeDress` releases
 * it one await early, with the garment GLB fetches still to come.
 */
const WARDROBE_DRESS_DEFECTS = {
    none: { holds: true, releaseBeforeDress: false },

    // The shipped defect. Measured at 450x600 on `?aa=traa&grade=0&wear=`: eight loads, three boot
    // epochs, three digests, plate an exact function of bootFrameId — see `dressFigure`.
    unheld: { holds: false, releaseBeforeDress: false },

    // The half-fix. The module import and the manifest fetch are covered and the per-garment GLB
    // fetches are not, so the window narrows and does not close — which is precisely the shape of
    // defect a two-load pixel check passes whenever both loads happen to boot at the same epoch.
    'released-early': { holds: true, releaseBeforeDress: true }
};

/**
 * Builds the wardrobe and wears the request. Split out of `dressFigure` only so the visibility
 * hold above has a single body to wrap, and so a `return` in the empty-outfit case cannot skip it.
 */
async function putGarmentsOn( session, defect ) {

    const { Wardrobe } = await import( '../../core/src/wardrobe/Wardrobe.js' );

    // Punch-list 9.8. ⚠️ OPT-IN, AND IT MUST STAY SO. With a `decencyFloor` configured the
    // `Wardrobe` constructor hides the body until the first dress resolves — that is 9.8's fix for
    // a bare body being drawn between construction and the first `dress()` — which changes the
    // TIMING of any plate captured before that promise settles. `?wear` without `?foundation`
    // therefore takes the no-floor path and behaves exactly as it did before 9.8 existed.
    const floor = session.foundationEnabled
        ? await buildFoundationFloor()
        : null;

    session.wardrobe = await Wardrobe.create( session.figure, WARDROBE_MANIFEST_URL,
        floor === null ? undefined : { decencyFloor: floor } );

    // 🚩 `?foundation` MUST STILL DRESS, and finding out why cost a plate. `dress()` is what unions
    // the decency floor into an outfit, and with a floor configured the `Wardrobe` constructor
    // hides the body until the first dress resolves — so the early return below, on an EMPTY
    // request, produced a page with no figure on it at all. Measured: `?bare&freeze&capture` at
    // 900x1200 differed from the nude plate on 60.2% of samples at worst Δ252/255, which is what
    // "the body is not drawn" looks like as a number. `dress([])` is the empty outfit, and the
    // empty outfit is still the floor.
    if ( session.wardrobeRequest.length === 0 && session.foundationEnabled === false ) {

        console.log( 'wardrobe: loaded, wearing nothing. ' +
            `Hide masks available: ${ session.wardrobe.availableHideMasks().join( ', ' ) }` );
        return;

    }

    // `?wearrace=released-early`. See WARDROBE_DRESS_DEFECTS — the garment fetches below are the
    // half of the window this puts back.
    if ( defect.releaseBeforeDress === true ) session.figure.root.visible = true;

    try {

        const stats = await session.wardrobe.dress( session.wardrobeRequest );

        console.log( `wardrobe: wearing ${ stats.worn.join( ', ' ) } — ` +
            `body ${ stats.bodyTriangles } tris (${ stats.hiddenTriangles } hidden) + ` +
            `${ stats.garmentTriangles } garment tris in ${ stats.drawCalls } draw calls, ` +
            `dressed in ${ stats.lastDressMs.toFixed( 3 ) } ms` );

    } catch ( error ) {

        console.warn( `wardrobe: ${ error.message }` );

    }

}

/**
 * `?identity=eyes/eye-scale-incr:1,nose/nose-width-decr:0.5` — the slider stack, parsed.
 *
 * Returns null for an absent or empty parameter, which is what keeps the whole of Phase 10 —
 * a 211 KB catalogue and up to 10.81 MB of packed target data — out of the default plate.
 *
 * @returns {?Object<string, number>}
 */
function parseIdentityRequest( spec ) {

    if ( spec === null || spec === '' ) return null;

    const values = {};

    for ( const clause of spec.split( ',' ) ) {

        const separator = clause.lastIndexOf( ':' );

        if ( separator < 0 ) {

            console.warn( `?identity: "${ clause }" has no ":weight". Expected slider-id:weight.` );
            continue;

        }

        values[ clause.slice( 0, separator ).trim() ] = Number( clause.slice( separator + 1 ) );

    }

    return Object.keys( values ).length === 0 ? null : values;

}

/**
 * Applies Phase 10 identity targets to the figure's position buffer, once, at load time.
 *
 * 🎯 Identity morphs never animate, so they are not GPU morph targets and cost NOTHING per frame:
 * this rewrites the buffer and there is no per-frame entry point to call. Measured against a
 * headless MPFB build, it reproduces Blender to 1.151e-4 mm on all 19,158 vertices.
 *
 * ⚠️ 10.7 AND 10.9 ARE NOT BUILT AND IT IS VISIBLE. The eyes, cornea, teeth, tongue, brows and
 * lashes are separate mhclo-fitted meshes and the skeleton is placed from the body's vertices;
 * neither is refitted here. On the shipped figure a "tall build" raises the skin at the eye line
 * 15.000 mm and the eyeball proxy 0.000 mm. That is a known gap, not a bug in this function, and a
 * judge shown an identity plate should be told which one they are looking at.
 *
 * Only the regions the request actually names are fetched — `loadRegions` is per region precisely
 * so a product pays for what it edits.
 *
 * @returns {Promise<?Object>} the apply report, or null when no identity was asked for.
 */
async function applyIdentityTargets( figure, session ) {

    if ( session.identityRequest === null ) return null;

    const [ { IdentityCatalogue }, targetsModule ] = await Promise.all( [
        import( '../../core/src/figure/IdentityCatalogue.js' ),
        import( '../../core/src/figure/IdentityTargets.js' )
    ] );

    const { IdentityTargets, AXIS_GLTF, FIGURE_VERTEX_MAP_URL, FIGURE_VERTEX_MAP_BIN_URL } = targetsModule;

    const catalogue = await IdentityCatalogue.load( { url: IDENTITY_CATALOGUE_URL } );
    const targets = new IdentityTargets( catalogue );

    const manifest = await ( await fetch( FIGURE_VERTEX_MAP_URL ) ).json();
    const map = new Uint16Array( await ( await fetch( FIGURE_VERTEX_MAP_BIN_URL ) ).arrayBuffer() );

    // The glTF NODE is named 'Human' and its mesh 'base.001'; three keeps the node name, so
    // matching on the mesh name finds nothing. The position count is what the vertex map is keyed
    // to anyway, and it is the property that would have to change for this lookup to be wrong.
    let body = null;
    figure.root.traverse( ( node ) => {

        if ( node.isMesh && node.geometry.attributes.position.count === manifest.positionCount ) body = node;

    } );

    if ( body === null ) {

        console.warn( `?identity: no mesh with ${ manifest.positionCount } positions in this bake. ` +
            'Phase 10 is keyed to the g050 vertex map; load ?gender=0.5.' );
        return null;

    }

    targets.useVertexMap( map );

    // A misspelled slider id is a CALLER error, and it must not throw out of the boot path and
    // leave a blank canvas — the same reasoning `dressFigure` gives for a refused outfit. The
    // failure a judge needs to see is the figure plus the reason, not an empty page.
    let stack;

    try {

        stack = catalogue.resolve( session.identityRequest );

    } catch ( error ) {

        console.warn( `?identity: ${ error.message } The figure is at the catalogue default. ` +
            `Region ids look like 'eyes/eye-scale-decr-incr'; ${ catalogue.sliders.length } exist.` );
        return null;

    }

    const regions = [ ...new Set( Object.keys( session.identityRequest )
        .map( ( id ) => id.includes( '/' ) ? id.slice( 0, id.indexOf( '/' ) ) : id ) ) ];

    await targets.loadRegions( regions );

    const report = targets.apply( body.geometry.attributes.position.array, stack, { axis: AXIS_GLTF } );

    body.geometry.attributes.position.needsUpdate = true;
    body.geometry.computeBoundingSphere();

    console.log( `identity: ${ Object.keys( session.identityRequest ).length } slider(s), ` +
        `${ report.targetsApplied } target(s), ${ report.verticesMoved } vertices moved, ` +
        `worst displacement ${ report.maxDisplacementMm?.toFixed( 3 ) ?? '?' } mm. ` +
        '⚠️ Punch-list 10.7/10.9: the eyes, teeth and skeleton do NOT follow the skin yet.' );

    return report;

}

/**
 * Builds punch-list 9.8's decency floor over the garment manifest.
 *
 * Dynamic, like the wardrobe itself, so `?wear` without `?foundation` imports nothing new and the
 * pre-9.8 behaviour is byte-for-byte what it was.
 */
async function buildFoundationFloor() {

    const [ { FoundationLayer }, { GarmentManifest } ] = await Promise.all( [
        import( '../../core/src/wardrobe/FoundationLayer.js' ),
        import( '../../core/src/wardrobe/GarmentManifest.js' )
    ] );

    const foundation = new FoundationLayer( await GarmentManifest.load( WARDROBE_MANIFEST_URL ) );

    console.log( `foundation: floor is ${ foundation.floor().join( ', ' ) }` );

    return foundation.floor;

}

/**
 * Adds Phase 5's expression layers to the motion stack and settles them on the requested emotion.
 *
 * 🚩 TWO LAYERS, NOT ONE, AND THE SECOND ONE IS THE FIX FOR A MEASURED BLOCKER. `ExpressionLayer`
 * owns the face; `PostureLayer` is the actuator for the BAP body prescription the map has been
 * computing since 5.4. Without it, eight `?affect=` plates differed on the face and five of the
 * seven non-neutral ones had a torso band bit-identical to neutral — the avatar emoted from the
 * eyebrows up. `?affectbody=0` is the A side, kept so that claim stays attributable.
 *
 * 🚩 IT COMPOSES OVER THE VISEME LAYER RATHER THAN REPLACING IT, which is 5.5's whole invariant:
 * the layer DECLARES brow, eye, cheek, nose and exactly four mouth-corner shapes, so writing any
 * absolute mouth, jaw or viseme shape throws rather than being caught by a runtime check. The
 * posture layer is the same idea on bones: it declares four, and the lumbar and the head are
 * shared with sway, idle and gaze on purpose, because contributions add.
 *
 * Settled rather than left mid-attack, because a still plate of a face caught 80 ms into a 200 ms
 * attack is a plate of a different face and there is no other way to make it reproducible.
 *
 * @returns {Promise<?Object>} `{ layer, posture, preset }`, or null when no emotion was asked for.
 */
async function attachAffect( stack, session ) {

    if ( session.affectRequest === null || session.affectRequest === '' ) return null;

    const [ { ExpressionLayer }, { EMOTION_PRESETS } ] = await Promise.all( [
        import( '../../core/src/affect/ExpressionLayer.js' ),
        import( './affect-presets.js' )
    ] );

    // `?affect=0.9,0.6,0.5` is a raw PAD point; anything else is a preset name.
    const numeric = session.affectRequest.split( ',' ).map( Number );
    const pad = numeric.length === 3 && numeric.every( Number.isFinite )
        ? { pleasure: numeric[ 0 ], arousal: numeric[ 1 ], dominance: numeric[ 2 ] }
        : EMOTION_PRESETS[ session.affectRequest ];

    if ( pad === undefined ) {

        console.warn( `?affect: '${ session.affectRequest }' is not a preset and is not "p,a,d". ` +
            `Known: ${ Object.keys( EMOTION_PRESETS ).join( ', ' ) }.` );
        return null;

    }

    const layer = new ExpressionLayer();

    if ( pad.trigger !== undefined ) layer.trigger( pad.trigger );

    layer.state.push( { pleasure: pad.pleasure, arousal: pad.arousal, dominance: pad.dominance } );

    // 3 s at a 10 ms step is fifteen attack time constants; the residual is under 1e-6 of an axis.
    // The same arithmetic the frame loop runs, at a larger step — not a back door around it.
    for ( let step = 0; step < 300; step ++ ) layer.state.update( 0.01 );

    stack.add( layer );

    // Built from the expression layer rather than constructed alongside it, so the two cannot end
    // up holding different states and rendering two different emotions.
    const posture = session.affectBodyEnabled ? layer.postureLayer() : null;
    if ( posture !== null ) stack.add( posture );

    console.log( `affect: ${ session.affectRequest } settled at PAD ` +
        `(${ pad.pleasure }, ${ pad.arousal }, ${ pad.dominance })` +
        ( posture === null ? '  ·  body OFF (?affectbody=0)' : '' ) );

    return { layer, posture, preset: session.affectRequest };

}

/** The bake's own name — `figure_g050` — which is what the curvature map is keyed on. */
function bakeNameFrom( url ) {

    return url.slice( url.lastIndexOf( '/' ) + 1 ).replace( '.glb', '' );

}

/**
 * Puts the two Phase 3 materials on the figure that has just landed.
 *
 * Both are per-bake and neither is cheap to rebuild, which is why they live on `session` rather
 * than being constructed once at boot: `EyeMaterial` fits the sclera sphere, the corneal axis, the
 * iris plane and the eight gaze rotations off the mesh in front of it, and the curvature map is a
 * different PNG per figure. A material built against g050 and left on g100 would be describing a
 * different eye.
 *
 * ⚠️ `markAsSkin` is deliberately NOT called. It writes `material.mrtNode`, and a material
 * carrying one cannot be forward-rendered — `NodeMaterial.setup` uses it alone against the
 * unnamed intermediate target every tone-mapped canvas frame allocates, emits an empty WGSL
 * output struct, and the object silently stops drawing (LEARNINGS Part 2, GBuffer.js). This page
 * is on the forward path: `stage.create` is called without `pipeline: true`, because the deferred
 * G-buffer would change the render path every Phase 2 motion number was measured against, and
 * nothing here consumes a G-buffer channel yet.
 *
 * Shadows are switched on per mesh here rather than at load, because the rig's shadow half is the
 * only thing that wants them and a figure with `castShadow` false produces a perfectly configured
 * shadow map of nothing at all.
 *
 * 🚩 AND THAT SENTENCE, ALONE, IS THE ONE THAT MADE A ROUND-LONG BUG INVISIBLE. It is an accurate
 * account of the FIGURE and a silently incomplete account of the SCENE. This traverse runs at the
 * `applyShading( session, skin )` call above; `dress()` runs a hundred lines later. A traverse
 * cannot reach an object that does not exist yet, and it never runs again — so for a full round
 * every garment and every accessory was parented with both flags at three's default of `false`,
 * and a hat cast no shadow on the forehead beneath it. Three blind judges named it as their joint
 * strongest tell that this was a render.
 *
 * 🎯 THE FIX IS NOT HERE, AND MUST NOT BE MOVED HERE. `Wardrobe.#adoptFragment` shades every
 * fragment itself via `applyFragmentShading()`, so the flags now arrive WITH the fragment, on any
 * page that dresses a figure rather than only on this one. A second traverse added below `dress()`
 * would paper over a regression in the library and take
 * `packages/core/src/wardrobe/shadow.selftest.mjs` green on a live bug — that gate measures the
 * rendered consequence (the forehead under the fedora brim is 31.68% darker than the same forehead
 * bareheaded) and it is not able to tell who set the flag.
 *
 * No behaviour change was made to this function. The note is here because this is where the next
 * reader who notices garments were missed will reach, and the paragraph above currently argues for
 * the version that failed.
 */
function applyShading( session, skin ) {

    const figure = session.figure;

    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;
        object.castShadow = true;
        object.receiveShadow = true;

    } );

    if ( skin !== null ) {

        applySkinMaterial( figure, skin );
        session.skin = skin;

    }

    if ( session.cardsEnabled ) session.cards = applyCardShading( figure, session.multisampled );

    applyEyeShading( session );

}

/**
 * The eye's TWO subsystems, switched independently — `?eyes=0` and `?eyeocc=0`.
 *
 * 🚩 THEY USED TO SHARE ONE SWITCH, and that quietly confounded every attribution ever made
 * against it. `?eyes=0` returned before both `new EyeMaterial()` and `buildEyeOcclusion()`, so the
 * plate it produced was missing the eye SHADER *and* the four occlusion and lacrimal meshes — and
 * the difference between it and the shipped plate was read, in PROGRESS.md and in a review round,
 * as the shader's contribution alone.
 *
 * Measured 2026-08-08 on ONE page load of `?bare&freeze&seed=1` at 900x1200 CSS (canvas
 * 1800x2400), four states differing only in what was switched — same frame, same seed, same
 * process, same GPU state — through `measure.mjs` against `regions.lighting-portrait.json`:
 *
 *   | state                                  | G2 luma ratio | G2 saturation ratio |
 *   |----------------------------------------|--------------:|--------------------:|
 *   | shipped: material attached, sheet on   |   0.9203 PASS |              1.3355 |
 *   | sheet off only                         |   0.9449 PASS |              1.2585 |
 *   | material off only                      |   0.8815 FAIL |              0.7479 |
 *   | both off — what `?eyes=0` used to give |   0.9086 FAIL |              0.7059 |
 *
 * The two contributions have OPPOSITE SIGNS on the luma half: the material costs 0.0388 and the
 * sheet hands 0.0246 back, so the old combined control reported 0.0117 — under a third of the
 * shader's real effect, on a plate that had no way to say so. On the chroma half they compound
 * instead, which is how the same control could look informative.
 *
 * ⚠️ The coupling was STRUCTURAL, not careless. `buildEyeOcclusion` needs `EyeMaterial#geometry` —
 * the fitted sclera sphere, corneal axis and iris plane — so the shortest way to skip the material
 * also destroyed the only measurement the sheet is built from. The resolution is that constructing
 * the material IS the measurement and `attach()` is the visual change: the material is therefore
 * always built, and only conditionally worn. An unattached `EyeMaterial` still gets its per-frame
 * `update()` and its pupil and key-light uniforms written, deliberately — the A plate should differ
 * from the B plate in the RENDER, not in how much per-frame work the page did.
 */
function applyEyeShading( session ) {

    // Not fatal if it throws: a figure built with the superseded single-shell eye proxy has no
    // corneal dome to refract through, and the page is more useful reporting that in the console
    // and rendering the GLB's own eye than it is refusing to boot.
    let eyes;

    try {

        eyes = new EyeMaterial( { figure: session.figure } );

    } catch ( error ) {

        console.warn( `eye material not applied: ${ error.message }` );
        return;

    }

    session.eyes = eyes;

    if ( session.eyesEnabled ) eyes.attach();

    if ( session.eyeOcclusionEnabled ) {

        session.eyeOcclusion = buildEyeOcclusion( { figure: session.figure, geometry: eyes.geometry } );

    }

}

/**
 * WHICH SHADING SUBSYSTEMS ARE ACTUALLY LIVE, read off the scene graph rather than off the flags
 * that were supposed to put them there.
 *
 * 🎯 This is the model the page was missing, and its absence is the defect above. Attribution is a
 * claim about the SET of subsystems a plate contains, and until now nothing on the page ever stated
 * that set: the toggles were scattered `query.get(...) !== '0'` reads and the control flow of
 * `applyShading` decided what a plate really held. A reviewer could only learn what `?eyes=0`
 * removed by reading the function, and nobody did for two rounds. A census that a test can execute
 * turns "this toggle switches one thing" from an argument into a measurement.
 *
 * Read from the SCENE on purpose. Reporting the flags back would be a tautology and would have
 * reported the old bug as correct.
 *
 * One honest limit: `skinMaterial` compares identity against the material this page built, so it
 * reads 0 both when the skin was never built and when it was built and never applied. It cannot
 * distinguish those two, and it does not need to — either way the plate has no skin shader on it.
 *
 * @returns {Object} counts of live meshes/lights per subsystem — `alive-toggles.selftest.mjs`
 *   loads the page once per toggle and asserts exactly the named entry moved.
 */
function censusOfShading( session, stage ) {

    const census = {
        skinMaterial: 0,
        eyeMaterial: 0,
        eyeOcclusion: 0,
        cardShading: 0,
        shadowCastingLights: 0,

        // The cavity term is not a mesh, so it cannot be counted by traversal — it is a map and a
        // strength on the skin material's node graph. Reported as the STRENGTH THAT IS LIVE rather
        // than as a boolean: 0 covers both "no map loaded" and "map loaded, strength dialled to
        // nothing", which render identically and are the same plate.
        //
        // 🚩 `null` MEANS NOT APPLICABLE AND IS NOT THE SAME AS 0. The cavity is a term INSIDE the
        // skin shader, not a subsystem beside it, so `?skin=0` leaves nothing that could carry it.
        // Reporting 0 there would say "the cavity was switched off", and `alive-toggles` would
        // correctly read that as `?skin=0` moving two entries — the confound `?eyes=0` really had.
        // This coupling is different in kind: there is no plate anywhere with the cavity and
        // without the skin shader, so there is no attribution to confound.
        skinCavityStrength: session.skin === null
            ? null
            : ( session.skin.skin?.cavityMap == null ? 0 : session.skin.skin.cavityStrength.value ),

        // Which anti-aliasing and whether the grade is in the graph, read off the renderer and the
        // pipeline rather than off the URL. They belong in the census for the same reason the eye
        // pair does: both are now DEFAULT-ON subsystems that a toggle can remove, so a plate has to
        // be able to say which of them it contains.
        temporalResolve: stage.temporal === null || stage.temporal === undefined ? 0 : 1,
        grade: stage.grade === null || stage.grade === undefined ? 0 : 1,

        // Punch-list 3.10, and it is reported as a SHAPE rather than as a boolean because the
        // three halves come off independently: a plate can carry the occlusion with the bent
        // normal disabled, or the ambient specular un-occluded, and those are different pictures
        // that a 1 would report identically. `null` is "no 3.10 in this frame at all", which also
        // means the hemisphere ambient is back in the forward shader.
        // ⚠️ NESTED, NOT A TOP-LEVEL COUNTER, and the reason is a gate in a file this one does not
        // own. `alive-toggles.selftest.mjs` requires every top-level census counter to be NON-ZERO
        // on the shipped plate — "a census of zeros would make every 'went to zero' check pass for
        // the wrong reason" — and `hemisphereLightsInScene` is zero on the shipped plate BY DESIGN,
        // because 3.10 owns the ambient. A correct reading would have read as a broken subsystem.
        ambientOcclusion: stage.ambientOcclusion == null
            ? null
            : { ...stage.ambientOcclusion.describe(), hemisphereLightsInScene: 0 },

        // Punch-list 3.5/3.6, reported as a SHAPE and NESTED, for the reason recorded on
        // `ambientOcclusion` immediately above: `alive-toggles.selftest.mjs` requires every
        // TOP-LEVEL census counter to be non-zero on the shipped plate, and the shipped plate has
        // no hair on it by design (see `HAIR_GROOM_ID`). A top-level zero here would read as a
        // broken subsystem. `null` is "no groom in this frame at all", which is every plate that
        // did not ask for one; a groom present but unshaded — `?hairbsdf=0` — reports the shape
        // with `shadedMeshesInScene` at 0, and those two states are different pictures.
        //
        // `oit` says which arm the FRAGMENTS actually go through, which is not always the one the
        // URL asked for — the reason the `multisampleSamples` entry below is read off the renderer.
        // Under `?hairbsdf=0` the groom keeps its glTF `alphaMode: MASK` at cutoff 0.5, which IS
        // the cutout arm however `?hairoit` was spelled, so that is what is reported; otherwise it
        // comes off the STAGE, because `Stage` refuses `wboit` on an adapter that cannot carry the
        // two attachments and a census echoing the request back would report a refused arm as live.
        // `motion` is punch-list 6.6 and it is the field a plate is identified by: a still frame
        // cannot show whether the groom is simulated, and until this round the answer was "no" on
        // every plate ever captured off this page. `null` is a RIGID groom — `?hairmotion=0`, or
        // `?hairbsdf=0`, which cannot carry a `positionNode` at all — and the shape reports the
        // problem size and the step count rather than a boolean, because a solver that is present
        // and not being stepped reads identically to one that is absent in every other instrument.
        hair: session.hair === null
            ? null
            : {
                bake: session.hair.bake,
                groomMeshes: session.hair.meshes.length,
                shadedMeshesInScene: 0,
                oit: session.hairMaterial === null ? 'cutout' : stage.hairOITMode,
                motion: session.hairDynamics === null
                    ? null
                    : {
                        chains: session.hairDynamics.groom.chainCount,
                        pointsPerChain: session.hairDynamics.groom.pointsPerChain,
                        particles: session.hairDynamics.groom.particleCount,
                        substepSeconds: session.hairDynamics.substepSeconds,
                        steps: session.hairDynamics.stepsTaken,
                        computeCallsLastFrame: session.hairDynamics.computeCallsLastFrame
                    },
                ...( session.hairMaterial === null ? { shaded: false } : session.hairMaterial.describe() )
            },

        // Read off the renderer rather than off `session.multisampled`, so it says what the
        // frame-buffer IS rather than what the URL asked for.
        //
        // ⚠️ THIS IS THE ONE ENTRY THAT IS LEGITIMATELY ZERO ON THE SHIPPED PLATE, since the page
        // moved to TAAU. `?aa=msaa` turns it on and turns `temporalResolve` off — the two are
        // mutually exclusive and `Stage.create` throws on the pair — so it is a MODE SWITCH rather
        // than an off switch, and `alive-toggles.selftest.mjs` gates it as one.
        multisampleSamples: stage.renderer.samples ?? 0
    };

    stage.scene.traverse( ( object ) => {

        if ( object.isLight === true && object.castShadow === true ) census.shadowCastingLights ++;

        // The other side of 3.10's coin, counted off the SCENE rather than read off the flag: with
        // the effect on there must be no `HemisphereLight` left in the graph, or the ambient is in
        // the frame twice. Null when 3.10 is absent, because then the light is supposed to be there.
        if ( object.isHemisphereLight === true && census.ambientOcclusion !== null ) {

            census.ambientOcclusion.hemisphereLightsInScene ++;

        }

        if ( object.isMesh !== true || object.visible === false ) return;

        const name = object.material?.name ?? '';

        if ( session.skin !== null && object.material === session.skin ) census.skinMaterial ++;
        if ( name === 'sugata.eye.globe' || name === 'sugata.eye.cornea' ) census.eyeMaterial ++;
        if ( name === 'sugata.eye.occlusion' || name === 'sugata.eye.lacrimal' ) census.eyeOcclusion ++;
        if ( name.startsWith( 'sugata.card.' ) ) census.cardShading ++;

        // 3.5, counted off the SCENE by material name, so the entry says what the plate CONTAINS
        // rather than what the URL asked for. `?hairbsdf=0` leaves the groom in the frame with its
        // GLB material and this correctly reports zero shaded meshes for it, which is the whole
        // point of that toggle.
        if ( census.hair !== null && name === 'sugata.hair' ) census.hair.shadedMeshesInScene ++;

    } );

    return census;

}

// --- the whole-scene shading fingerprint --------------------------------------------------------

/**
 * How deep into a node graph the structural signature walks, and how many nodes it may visit in
 * total before it gives up and says so.
 *
 * Depth first: the skin's `roughnessNode` is the shallowest thing this has to tell apart —
 * `filteredRoughness( r )` against `r` — and that shows at depth 1. The eye's `colorNode` is the
 * deepest measured at 7. 10 is that plus margin; the budget is what stops a pathological DAG from
 * turning a gate into a hang, and it is reported rather than swallowed so a truncated signature can
 * never be mistaken for a complete one.
 */
const NODE_SIGNATURE_MAX_DEPTH = 10;
const NODE_SIGNATURE_NODE_BUDGET = 20000;

/**
 * Floats are rounded before they go into a signature, because a signature is compared for EQUALITY
 * across two page loads and an exact bit compare would report the last mantissa bit of a light's
 * position as a subsystem change. Six decimals is finer than anything on this page means — the
 * smallest deliberate quantity anywhere in the rig is a millimetre — and coarse enough that
 * recomputing the same placement twice lands on the same string.
 */
function rounded( value ) {

    // 🚩 UNWRAP UNIFORMS. Nearly every tunable on `Grade` is a TSL uniform node rather than a plain
    // number, and an earlier version of this function did not know that: `String( uniform )` is
    // `'[object Object]'` for every value it will ever hold, so `?exposure=`, `?bloom=`, `?grain=`,
    // `?vignette=`, `?sat=` and `?thresh=` ALL measured as an empty fingerprint diff — six live
    // attribution parameters that the instrument reported as changing nothing.
    const scalar = value !== null && typeof value === 'object' && typeof value.value === 'number'
        ? value.value
        : value;

    return Number.isFinite( scalar ) ? scalar.toFixed( 6 ) : String( scalar );

}

/**
 * What a texture IS, in terms that survive a page reload.
 *
 * Deliberately not `uuid`: three mints a fresh one per instance, so every reload would report every
 * texture as changed and the whole instrument would read as noise. The source URL is the identity
 * that matters here — swapping which image a material samples is exactly the kind of collateral
 * this fingerprint exists to catch, and two loads of the same URL fetch the same bytes.
 */
function textureIdentity( texture ) {

    if ( texture === null || texture === undefined ) return 'nil';

    const source = texture.source?.data;
    const url = source?.src ?? source?.currentSrc ?? texture.name;

    // Blob URLs are minted per load. The dimensions are what is left that is stable, and they are
    // enough to catch a swap between two different maps.
    const stable = typeof url === 'string' && url.startsWith( 'blob:' ) === false && url !== ''
        ? url.split( '/' ).pop()
        : `${ source?.width ?? '?' }x${ source?.height ?? '?' }`;

    return `${ stable }|${ texture.channel ?? 0 }|${ texture.flipY }|${ texture.colorSpace }`;

}

/**
 * The scalar a uniform or constant node is holding, or `null` for a node that carries no readable
 * value.
 *
 * Deliberately narrow. A `Vector3` is worth reading — it is a colour or a direction somebody chose
 * — and a `Matrix4` is not, because it is recomputed from the camera every frame and would report
 * the whole graph as drifting. Anything longer than four components is treated as machinery.
 */
function leafValue( node ) {

    const value = node.value;

    if ( typeof value === 'number' ) return rounded( value );
    if ( typeof value === 'boolean' || typeof value === 'string' ) return String( value );

    if ( value !== null && typeof value === 'object' && typeof value.toArray === 'function' ) {

        const components = value.toArray();
        return components.length <= 4 ? components.map( rounded ).join( ',' ) : null;

    }

    return null;

}

/**
 * The STRUCTURE of a TSL node graph, as a string.
 *
 * 🎯 This is what lets the fingerprint see a change that has no mesh and no counter behind it.
 * `?specaa=0` swaps `material.roughnessNode` from `filteredRoughness( roughness )` to `roughness` —
 * no mesh appears or disappears, no material is replaced, no scalar moves, and the nine-entry
 * census is blind to it by construction. The node graph is where that change actually lives, so
 * that is what gets read.
 *
 * Structure AND the scalar VALUE a leaf carries, which is more than the first version recorded.
 * Structure alone leaves a whole class of confound invisible: a toggle that scales a strength
 * uniform rather than swapping a node changes the frame and leaves the graph shape untouched, and
 * the instrument would have reported "nothing else moved". Values are included from `uniform` and
 * `constant` leaves only, and only when they are scalars or short arrays — a matrix or a texture
 * would be noise, not signal.
 *
 * ⚠️ THAT ONLY WORKS BECAUSE THE PLATE IS FROZEN, and the claim is checked rather than assumed. A
 * uniform an animation writes every frame would make the signature drift and the whole instrument
 * would degrade into noise. `alive-toggles.selftest.mjs` loads the base plate TWICE and requires
 * the two fingerprints to be identical before it believes any other reading, so this is a
 * measurement rather than an argument — and it is why the gate's very first check is that one.
 *
 * The cycle guard is PER PATH rather than global. A global `seen` would let a subgraph reached
 * twice print in full the first time and as `cycle` the second, which makes the signature depend on
 * sibling order — and worse, would let a change hide behind an earlier visit.
 */
function nodeSignature( node, depth, path, budget ) {

    if ( node === null || node === undefined ) return 'nil';
    if ( typeof node !== 'object' ) return typeof node === 'number' ? rounded( node ) : String( node );

    if ( budget.visited ++ > NODE_SIGNATURE_NODE_BUDGET ) return 'over-budget';
    if ( depth > NODE_SIGNATURE_MAX_DEPTH ) return 'over-depth';
    if ( path.has( node ) ) return 'cycle';

    path.add( node );

    const children = [];
    const carried = leafValue( node );

    if ( carried !== null ) children.push( `=${ carried }` );

    for ( const key of Object.keys( node ).sort() ) {

        const value = node[ key ];

        if ( value !== null && typeof value === 'object' && value.isNode === true ) {

            children.push( `${ key }:${ nodeSignature( value, depth + 1, path, budget ) }` );

        }

    }

    path.delete( node );

    const name = node.constructor?.name ?? 'Object';

    return children.length === 0 ? name : `${ name }(${ children.join( ',' ) })`;

}

/**
 * Every scalar on a material that changes what it renders. Sampled by NAME rather than by walking
 * the object, because a material also carries a version counter, a uuid and a handful of caches
 * that move for reasons that are not shading.
 */
const MATERIAL_SHADING_PROPERTIES = [
    'alphaTest', 'alphaToCoverage', 'blending', 'clearcoat', 'clearcoatRoughness', 'depthTest',
    'depthWrite', 'dispersion', 'emissiveIntensity', 'envMapIntensity', 'flatShading', 'forceSinglePass',
    'ior', 'iridescence', 'metalness', 'opacity', 'premultipliedAlpha', 'reflectivity', 'roughness',
    'sheen', 'sheenRoughness', 'side', 'specularIntensity', 'thickness', 'toneMapped', 'transmission',
    'transparent', 'vertexColors', 'wireframe'
];

/**
 * WHAT THIS PLATE IS SHADED WITH — the whole of it, read off the scene graph.
 *
 * ## Why this exists next to `censusOfShading` rather than instead of it
 *
 * The census answers "did the toggle do its job": nine counters, each a subsystem going to zero.
 * That is a good, readable instrument and it stays. What it cannot answer is the OTHER half of an
 * attribution — "and it did nothing else" — because it can only see the nine things it was told to
 * count. A confound planted anywhere else is invisible to it, and one was: making `?cards=0` also
 * switch off the skin's specular anti-aliasing left all nine counters exactly at their baselines
 * and the gate reported 24/24 green, while `?specaa=0` alone is worth 24.88% of the frame's pixels.
 *
 * 🎯 THE MODEL ERROR WAS TREATING A SAMPLE OF THE RENDER STATE AS THE RENDER STATE. "Nothing else
 * changed" is a claim about everything, and it cannot be checked against a list of nine. So this
 * returns the whole of the shading state, keyed by entity, and the gate requires the set of entries
 * a toggle CHANGES to be a subset of the entries that toggle declares it owns. Deny by default: an
 * entry nobody declared is collateral, whether or not anybody thought of it in advance.
 *
 * ## What is in it
 *
 * - one entry per MESH, keyed by name: visibility, its material's identity, every shading scalar,
 *   every texture it samples, and the STRUCTURE of every node on its material's graph
 * - one entry per LIGHT, keyed by name: type, colour, intensity, placement, shadow configuration
 * - one entry for the PIPELINE: which anti-aliasing, whether the grade is in the graph, the
 *   multisample count, the resolution scale, the sharpen, the morph-velocity mode
 *
 * ## What is deliberately NOT in it
 *
 * Anything that moves per frame — bone matrices, morph weights, the camera, uniform VALUES. This is
 * a fingerprint of the shading CONFIGURATION, which is what an attribution claim is about, and a
 * frame-varying quantity in here would make the instrument non-deterministic and therefore useless.
 * The pixel checks in `alive-toggles.selftest.mjs` are what cover the state this cannot see: they
 * need no bookkeeping at all, so they are the backstop for any confound that lives outside shading.
 *
 * Keyed by NAME and not by traversal index on purpose. `?eyeocc=0` removes four meshes, and an
 * index-keyed map would report every entry after them as changed — a gate that goes red for a
 * hundred reasons is a gate that gets muted.
 *
 * @returns {Object<string,string>} entity key -> signature. Compared for equality, never parsed.
 */
function shadingFingerprint( session, stage ) {

    const fingerprint = {};
    const budget = { visited: 0 };

    // Two meshes may share a name — the GLB has none that do today, but nothing enforces it — so a
    // collision gets an ordinal rather than silently overwriting and shrinking the fingerprint.
    const claim = ( key ) => {

        if ( fingerprint[ key ] === undefined ) return key;

        for ( let ordinal = 2; ; ordinal ++ ) {

            if ( fingerprint[ `${ key }#${ ordinal }` ] === undefined ) return `${ key }#${ ordinal }`;

        }

    };

    stage.scene.traverse( ( object ) => {

        if ( object.isLight === true ) {

            fingerprint[ claim( `light:${ object.name || object.type }` ) ] = [
                object.type,
                `visible=${ object.visible }`,
                `color=${ object.color?.getHexString() ?? 'nil' }`,
                `intensity=${ rounded( object.intensity ) }`,
                `size=${ rounded( object.width ?? 0 ) }x${ rounded( object.height ?? 0 ) }`,
                `at=${ object.position.toArray().map( rounded ).join( ',' ) }`,
                `quat=${ object.quaternion.toArray().map( rounded ).join( ',' ) }`,
                `castShadow=${ object.castShadow }`,
                `shadowMap=${ object.shadow?.mapSize?.x ?? 0 }x${ object.shadow?.mapSize?.y ?? 0 }`,
                `shadowBias=${ rounded( object.shadow?.bias ?? 0 ) }`,
                `shadowRadius=${ rounded( object.shadow?.radius ?? 0 ) }`
            ].join( ' ' );

            return;

        }

        if ( object.isMesh !== true ) return;

        const material = object.material;

        if ( material === null || material === undefined ) {

            fingerprint[ claim( `mesh:${ object.name || 'anonymous' }` ) ] = 'no material';
            return;

        }

        const parts = [
            `visible=${ object.visible }`,
            `castShadow=${ object.castShadow }`,
            `receiveShadow=${ object.receiveShadow }`,
            `material=${ material.constructor?.name ?? '?' }:${ material.name || 'anonymous' }`,
            `color=${ material.color?.getHexString() ?? 'nil' }`,
            `emissive=${ material.emissive?.getHexString() ?? 'nil' }`
        ];

        for ( const property of MATERIAL_SHADING_PROPERTIES ) {

            const value = material[ property ];
            if ( value === undefined ) continue;
            parts.push( `${ property }=${ typeof value === 'number' ? rounded( value ) : String( value ) }` );

        }

        for ( const key of Object.keys( material ).sort() ) {

            const value = material[ key ];

            if ( value !== null && typeof value === 'object' && value.isTexture === true ) {

                parts.push( `${ key }=${ textureIdentity( value ) }` );

            } else if ( value !== null && typeof value === 'object' && value.isNode === true ) {

                parts.push( `${ key }=${ nodeSignature( value, 0, new Set(), budget ) }` );

            }

        }

        fingerprint[ claim( `mesh:${ object.name || 'anonymous' }` ) ] = parts.join( ' ' );

    } );

    // The post stack is not a mesh and not a light, so without this entry a whole class of toggle —
    // `?gsharp`, `?sharp`, `?tone`, `?scale`, `?morphvel`, every grade parameter — changes the frame
    // while the fingerprint reports nothing at all. Measured before this line existed: `?gsharp=none`
    // and `?morphvel=off` both produced an EMPTY entity diff. Each field here is one such toggle's
    // only foothold in the instrument.
    const grade = stage.grade;
    const temporal = stage.temporal;

    fingerprint.pipeline = [
        `temporal=${ temporal == null ? 'none' : `${ temporal.constructor?.name ?? '?' }:${ temporal.mode ?? '?' }` }`,
        `temporalSharpen=${ temporal?.sharpenNode == null ? 'none' : 'on' }`,
        `resolutionScale=${ rounded( stage.resolutionScale ?? 1 ) }`,
        `morphVelocity=${ stage.morphVelocity ?? 'default' }`,
        `viewMode=${ stage.viewMode ?? 'default' }`,
        `velocityGain=${ rounded( stage.velocityGain ?? 0 ) }`,
        `depthGain=${ rounded( stage.depthGain ?? 0 ) }`,
        `ambientOcclusion=${ stage.ambientOcclusion == null
            ? 'none'
            : Object.entries( stage.ambientOcclusion.describe() ).map( ( [ key, value ] ) => `${ key }:${ value }` ).join( ',' ) }`,
        `grade=${ grade == null ? 'none' : 'on' }`,
        `tone=${ grade?.toneCurveName ?? 'nil' }`,
        `exposure=${ rounded( grade?.exposure ?? 0 ) }`,
        `bloom=${ rounded( grade?.bloomStrength ?? 0 ) }/${ rounded( grade?.bloomThreshold ?? 0 ) }/${ rounded( grade?.bloomRadius ?? 0 ) }`,
        `grain=${ rounded( grade?.grainSigmaCodes ?? 0 ) }`,
        `vignette=${ rounded( grade?.vignette ?? 0 ) }`,
        `saturation=${ rounded( grade?.saturation ?? 0 ) }`,
        `gradeSharpen=${ grade?.sharpness == null ? 'none' : rounded( grade.sharpness ) }`,
        `samples=${ stage.renderer.samples ?? 0 }`,
        `background=${ stage.scene.background?.getHexString?.() ?? 'nil' }`,
        `toneMapping=${ stage.renderer.toneMapping }`,
        `toneMappingExposure=${ rounded( stage.renderer.toneMappingExposure ) }`,
        `outputColorSpace=${ stage.renderer.outputColorSpace }`
    ].join( ' ' );

    // Reported so a truncated walk can never be read as a complete one — see the budget constants.
    fingerprint.nodesWalked = budget.visited > NODE_SIGNATURE_NODE_BUDGET ? 'OVER BUDGET' : 'within budget';

    return fingerprint;

}

/**
 * Every readable configuration property of the three objects that produce a frame, walked rather
 * than listed: `renderer.render( scene, camera )`.
 *
 * ## Why this exists beside `shadingFingerprint` instead of inside it
 *
 * `shadingFingerprint`'s `pipeline` row is nineteen hand-picked renderer fields — a SAMPLE of the
 * render state standing in for a claim about ALL of it, which is the same "an enumeration is not a
 * closure" error the fingerprint itself was built to fix, one level up. An independent verifier
 * routed a `?cards=0` confound through `renderer.toneMappingExposure` and every instrument on this
 * page reported the plate as clean.
 *
 * It is a SEPARATE entry point rather than extra rows in the fingerprint because the fingerprint is
 * compared as an exact entity set: `?shadows=0` legitimately moves `renderer.shadowMap.enabled`,
 * `?aa=off` moves the camera's jitter offset and `?frame=body` moves the camera itself, so folding
 * the walk into the same key space would make honest toggles read as collateral. Two questions, two
 * objects — "what shading did this plate use" and "what render state did this plate use".
 *
 * ## 🚩 THE SUBJECT LIST IS THE PART THAT KEEPS BEING WRONG
 *
 * The first version of this function walked the renderer and the scene, and a second verifier
 * routed `?cards=0` through `stage.camera.filmOffset`: `alive-toggles.selftest.mjs` reported
 * **147/147 green** on a plate where 53.8625% of samples differ from the baseline. The subjects are
 * now the argument list of the draw call rather than a choice, and the walk closes the list itself
 * by recording every object-valued member of the `Stage` — the gate requires each to be walked or
 * excused. Keep this function and the gate's own copy in step: the gate checks that they report the
 * same property paths and says so by name when they diverge.
 *
 * ## What it reads, and the deliberate limits
 *
 * - **Own properties**, underscore-prefixed ones included: `_samples` is where the MSAA count
 *   lives and its public accessor is a second reading of the same thing. Deny-by-default is
 *   cheaper than adjudicating which of two spellings is canonical.
 * - **Prototype accessors**, through a try/catch. A getter that throws is recorded as `threw`
 *   rather than skipped, so a property that STARTS throwing is a change rather than a silence.
 * - **Three's math values BY VALUE**, through `toArray` — identified by the method rather than by a
 *   list of class names. Recorded as `object:Vector3`, a 20 mm camera dolly is invisible.
 * - **One level into CONFIGURATION BAGS** — a member carrying nothing but scalars. That reaches
 *   `shadowMap.enabled`, `debug.checkShaderErrors`, `camera.view.fullWidth` and `camera.layers.mask`
 *   and keeps `backend`, `info` and `_nodes` out, so a per-frame counter cannot make it drift.
 * - **`undefined` values are dropped.** Measured: `scene.backgroundNode` is an own property
 *   holding `undefined` on some plates and absent on others, and those are the same state.
 * - **Numbers are rounded to 1e-6**, so `lookAt` re-deriving the same yaw to within a few ULP does
 *   not read as a rotation. The cost: a confound under a micron of camera travel is invisible.
 * - **Exclusions are recorded as `excluded:<path>` markers, not skipped**, so a stale one is
 *   visible. Two: `uuid` on any subject, and the temporal resolve's per-frame jitter offsets.
 *
 * @returns {Object<string,string>} property path -> value. Compared for equality, never parsed.
 */
function frameSubjectState( stage ) {

    const subjects = { renderer: stage.renderer, scene: stage.scene, camera: stage.camera };
    const state = {};

    const excludedReason = ( propertyPath ) => {

        if ( propertyPath.endsWith( '.uuid' ) ) return 'a fresh uuid is minted per instance, every load';

        // TAAU calls `setViewOffset` before each frame and `clearViewOffset` after it, leaving the
        // last Halton sample behind. These two record which frame was read, not the configuration.
        if ( propertyPath === 'camera.view.offsetX' || propertyPath === 'camera.view.offsetY' ) {

            return 'the temporal resolve rewrites it every frame; it records the frame, not the configuration';

        }

        return null;

    };

    const roundedNumber = ( value ) => {

        if ( Number.isFinite( value ) === false ) return String( value );

        return String( Number( value.toFixed( 6 ) ) );

    };

    const describe = ( value ) => {

        if ( value === null ) return 'null';
        if ( typeof value === 'number' ) return roundedNumber( value );
        if ( typeof value === 'boolean' || typeof value === 'string' ) return String( value );
        if ( typeof value === 'function' ) return null;
        if ( Array.isArray( value ) ) return `array(${ value.length })`;
        if ( typeof value !== 'object' ) return String( value );

        if ( value.isColor === true ) return `color:${ value.getHexString() }`;

        if ( typeof value.toArray === 'function' ) {

            try {

                const numbers = value.toArray();

                if ( Array.isArray( numbers ) ) {

                    const described = numbers
                        .map( ( entry ) => typeof entry === 'number' ? roundedNumber( entry ) : String( entry ) );

                    return `${ value.constructor?.name ?? '?' }(${ described.join( ',' ) })`;

                }

            } catch {

                // not a value object after all — fall through to the type name
            }

        }

        return `object:${ value.constructor?.name ?? '?' }`;

    };

    /** A member carrying nothing but scalars is configuration; anything holding an object is machinery. */
    const isConfigurationBag = ( value ) => {

        if ( value === null || typeof value !== 'object' || Array.isArray( value ) ) return false;
        if ( typeof value.toArray === 'function' ) return false;

        for ( const key of Object.keys( value ) ) {

            const inner = value[ key ];
            if ( inner !== null && typeof inner === 'object' ) return false;

        }

        return true;

    };

    const record = ( propertyPath, value ) => {

        if ( value === undefined ) return;

        const reason = excludedReason( propertyPath );

        if ( reason !== null ) {

            state[ `excluded:${ propertyPath }` ] = reason;
            return;

        }

        const described = describe( value );

        if ( described !== null ) state[ propertyPath ] = described;

    };

    for ( const [ label, subject ] of Object.entries( subjects ) ) {

        const seen = new Set();

        for ( const key of Object.keys( subject ).sort() ) {

            seen.add( key );

            const propertyPath = `${ label }.${ key }`;
            let value;

            try {

                value = subject[ key ];

            } catch {

                state[ propertyPath ] = 'threw';
                continue;

            }

            record( propertyPath, value );

            let bag = false;

            try {

                bag = isConfigurationBag( value );

            } catch {

                bag = false;

            }

            if ( bag === false ) continue;

            for ( const inner of Object.keys( value ).sort() ) {

                try {

                    record( `${ propertyPath }.${ inner }`, value[ inner ] );

                } catch {

                    state[ `${ propertyPath }.${ inner }` ] = 'threw';

                }

            }

        }

        let prototype = Object.getPrototypeOf( subject );

        while ( prototype !== null && prototype !== Object.prototype ) {

            for ( const key of Object.getOwnPropertyNames( prototype ).sort() ) {

                if ( seen.has( key ) ) continue;

                const descriptor = Object.getOwnPropertyDescriptor( prototype, key );

                if ( descriptor === undefined || typeof descriptor.get !== 'function' ) continue;

                seen.add( key );

                try {

                    record( `${ label }.get:${ key }`, subject[ key ] );

                } catch {

                    state[ `${ label }.get:${ key }` ] = 'threw';

                }

            }

            prototype = Object.getPrototypeOf( prototype );

        }

    }

    // Not a property of any subject, and the one piece of render state that lives on the canvas:
    // `?scale` is applied with `setSize`, so this is where a resolution confound would show.
    const canvas = stage.renderer.domElement;

    state[ 'renderer.canvasPixels' ] = `${ canvas.width }x${ canvas.height }`;

    // THE SUBJECT LIST, CLOSED. Every object-valued member of the Stage, by identity, so a Stage
    // that grows a member nobody walks is visible from outside rather than being a silent hole.
    for ( const key of Object.keys( stage ).sort() ) {

        const member = stage[ key ];

        if ( member === null || typeof member !== 'object' ) continue;

        state[ `stage.${ key }` ] = `object:${ member.constructor?.name ?? '?' }`;

    }

    return state;

}

/**
 * The alpha value below which a card texel is sheet background rather than painted fibre.
 *
 * Not a taste setting — read off the two card textures' own alpha histograms, measured on
 * `figure_g050.glb`'s embedded PNGs at 512x512:
 *
 *   | texture      | texels in alpha 0.0–0.1 | of 262,144 |
 *   |--------------|------------------------:|-----------:|
 *   | eyelashes01  |                 225,416 |      86.0% |
 *   | eyebrow001   |                 236,954 |      90.4% |
 *
 * Everything above that first decile is painted. glTF `alphaMode: MASK` defaults `alphaCutoff` to
 * 0.5, which throws away the whole soft ramp between 0.1 and 0.5 — 15,368 eyelash texels and
 * 20,262 eyebrow texels, i.e. most of the brow's density and every lash tip. That is where the
 * "visible holes in the brow" came from.
 *
 * With alpha-to-coverage doing the in/out decision continuously, the cutoff's only remaining job
 * is to keep the transparent sheet out of the depth buffer, so it belongs at the top of the empty
 * decile rather than half way up the ramp.
 */
const CARD_ALPHA_CUTOFF = 0.1;

/**
 * The darkest albedo a hair card is allowed to claim, as an sRGB hex.
 *
 * 🎯 THIS IS THE WHOLE OF G6 AT PORTRAIT FRAMING, and it is a measurement rather than a taste
 * setting. Both card textures' cores are **0.0000 linear** — not dark, ZERO — and an ungraded
 * shipped plate at 900x1200 carried **1,431 pixels at literally RGB(0,0,0), 100% of them in the
 * brow and lash row band**. `?grade=0&cards=0` on the same build has **no** pure-black pixel at
 * all and a minimum of 0.003922, which is the backdrop.
 *
 * A surface at zero albedo with `specularIntensity 0` cannot be raised by any light, any ambient
 * term, any ground bounce or any grade — so the black point was never a black point, and three
 * rounds of looking at `LightingRig`, `Grade` and `GroundContact` for it were looking in the wrong
 * file. Proven by toggle: `?grain=0` reads 0.00225 against the shipped 0.00225 (identical to five
 * decimals, so the grain crushes nothing) and `?grade=0` reads 0.00001 (so the grade LIFTS).
 *
 * The value is the look spec's own published hair base albedo — §Hair states it as a measurement,
 * "base albedo is essentially black — luma 0.067 (#150F17)" — which is 0.0060 linear, i.e. the
 * texture cores are 27x below the reference and are not a physical reflectance. It is a FLOOR on
 * the albedo and not an emissive, so the cards still respond to the rig; an emissive was used to
 * bound the magnitude during attribution and is not what ships.
 *
 * Measured with that magnitude probe: the brow+lash band's p0.1 goes 0.00113 -> 0.00843 and the
 * whole-frame G6 goes 0.00225 -> 0.00393. A much darker floor (#0A070B) gives the same 0.00393,
 * which is the finding: ANY non-zero floor takes the cards out of the tail, so this constant is
 * chosen for being the spec's published value rather than for the number it produces.
 *
 * ⚠️ Punch-list 3.5's Karis hair BSDF is what eventually makes hair's colour come from its
 * anisotropic lobes rather than its albedo, exactly as the spec describes. When that lands, this
 * floor is the thing to re-derive, not to keep.
 */
const CARD_ALBEDO_FLOOR = 0x150F17;

/**
 * Shades the alpha-masked hair cards — the eyelashes and the eyebrows.
 *
 * These two meshes were the only ones on the figure `applyShading` skipped, and leaving them on
 * MakeHuman's default `roughness 0.5 / metalness 0` slab is what made them the most visually wrong
 * thing in the frame: at portrait framing they rendered as saturated blue spikes, more saturated
 * than anything else on screen, on an asset whose own texture is near-black.
 *
 * ## Why a card must not claim an isotropic specular lobe
 *
 * A hair card's shading normal is its plane normal, and that is a lie about what the card stands
 * for — a bundle of fibres. A real fibre confines its highlight to a cone about its own TANGENT,
 * so it can only ever produce a band ALONG the strand. An isotropic GGX lobe about the card's
 * plane normal instead puts the highlight wherever the card happens to face, and a fan of lash
 * blades standing perpendicular to the lid faces, by construction, close to the half-vector of a
 * light behind the head. The portrait rim sits at azimuth −152°, so its half-vector lands ~76° off
 * the view axis — exactly the grazing geometry where Fresnel runs from 0.04 to ~1.
 *
 * Nothing dilutes it. The mean sRGB of `eyelashes01`'s opaque texels is (0.033, 0.012, 0.004),
 * i.e. ~0.003 in linear, so the diffuse term contributes essentially nothing and the rendered
 * pixel is 100% the rim's own colour. Measured on `?freeze&bare` at 900x1200, over the four lash
 * and brow rects `regions.lighting-portrait.json` now carries:
 *
 *   | plate                                   | G7 cool-chroma outliers |
 *   |-----------------------------------------|------------------------:|
 *   | shipped, before this change             |                  0.847% |
 *   | cards hidden altogether (the floor)      |                  0.011% |
 *   | rim and kicker at zero irradiance        |                  0.000% |
 *   | this treatment                           |                  0.028% |
 *
 * So the lobe is removed rather than tuned: `specularIntensity 0` measures at the floor, and the
 * intermediate values do not (0.35 → 0.336%, 0.5 → 0.656%). Punch-list 3.5's Karis hair BSDF is
 * what puts a lobe back, anisotropically, where the fibre tangent says it belongs — the look spec
 * is explicit that hair's apparent colour comes almost entirely from those lobes, so this is an
 * interim that owes 3.5 a replacement, not a final answer.
 *
 * ⚠️ It is NOT the rig's fault, and that was checked before this file was touched. The rim band on
 * skin measures 0.7482 encoded luma against key-lit skin at 0.7935 — 0.943×, at the bottom of the
 * look spec's own 1.0–1.5× band, so the rim is if anything under-powered. Moving the rig's shadow
 * budget off the key and onto the back lights was tried and rejected by measurement: at
 * `shadowFraction` 0.45 the cards barely improve (0.847% → 0.656% equivalent), and at 1.0 the rim
 * band is destroyed (band contrast against skin 40 px inboard falls 1.0967 → 0.9340, i.e. the rim
 * band becomes darker than the skin it is meant to separate from the backdrop).
 *
 * ## Why alpha to coverage
 *
 * `alphaMode: MASK` at cutoff 0.5 draws a texel covering 20% of a pixel at 100% opacity. That is
 * the hard staircase on every lash tip and brow edge, and before the lobe came off it also showed
 * a maximum-Fresnel specular at full strength on a sliver of card. Alpha to coverage turns the
 * binary decision into a sample count, which is both the anti-aliasing fix and a proportional
 * dilution of whatever the card reflects.
 *
 * It needs a multisampled target to mean anything, so it is applied only when the stage actually
 * has one — otherwise the flag would sit on the material reading like a fix while the hard cut
 * carried on underneath.
 *
 * @param {import('../../core/src/figure/Figure.js').Figure} figure
 * @param {boolean} multisampled - whether the stage was built with MSAA.
 * @returns {Array<import('three').Material>} the materials installed, for disposal.
 */
function applyCardShading( figure, multisampled ) {

    const installed = [];

    figure.root.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;

        // Matched on the asset's own alpha mode rather than on mesh names. `verify_glb.mjs`
        // asserts that the brow and lash cards are the only two non-opaque meshes in the bake, and
        // a name matcher has already had to be widened once on this project when `low-poly`
        // became `high-poly` (LEARNINGS, the figure asset). glTF `alphaMode: MASK` arrives as a
        // non-zero `alphaTest`.
        const previous = object.material;
        const isAlphaMaskedCard = previous !== undefined && previous !== null && previous.alphaTest > 0;
        if ( isAlphaMaskedCard === false ) return;

        const card = new MeshPhysicalNodeMaterial();
        card.name = `sugata.card.${ previous.name }`;
        card.map = previous.map;
        card.color.copy( previous.color );
        card.side = previous.side;

        // The albedo floor — see CARD_ALBEDO_FLOOR. Written as an explicit `colorNode` rather than
        // left to `materialColor` because the floor has to be applied to the SAMPLED texel, and
        // the alpha has to survive it: `alphaTest` reads `diffuseColor.a`, and `vec4( someVec3 )`
        // pads the alpha with ZERO, which would discard every texel on the card and delete the
        // brows and lashes outright. So the alpha is carried across from the same sample
        // explicitly, and the browsercheck below counts the meshes that came out the other side.
        if ( previous.map !== null && previous.map !== undefined ) {

            const floor = new Color().setHex( CARD_ALBEDO_FLOOR, SRGBColorSpace );
            const sampled = texture( previous.map );

            card.colorNode = vec4(
                max( sampled.rgb.mul( vec3( previous.color.r, previous.color.g, previous.color.b ) ),
                    vec3( floor.r, floor.g, floor.b ) ),
                sampled.a
            );

        }

        // Kept from the asset rather than re-chosen: with no specular lobe they change nothing,
        // and a number that changes nothing should not be silently re-authored.
        card.roughness = previous.roughness;
        card.metalness = 0;

        card.specularIntensity = 0;
        card.alphaTest = CARD_ALPHA_CUTOFF;
        card.alphaToCoverage = multisampled;

        object.material = card;
        installed.push( card );

    } );

    console.log( `card shading: ${ installed.length } mesh(es) — ${ installed.map( ( m ) => m.name ).join( ', ' ) }` +
        `   alphaToCoverage ${ multisampled }` );

    return installed;

}

/** Drops whatever the previous bake was wearing. Called before the figure itself is disposed. */
function disposeShading( session ) {

    session.eyeOcclusion?.dispose();
    session.eyes?.dispose();
    session.skin?.dispose();
    for ( const card of session.cards ) card.dispose();

    // The groom's meshes are children of `figure.root`, so the figure's own dispose takes their
    // geometry and their embedded textures. What it cannot take is this material and the two
    // SIDECAR sheets, which were fetched here and are not on any mesh the figure knows about.
    session.hairMaterial?.hairUniforms.flowMap?.value?.dispose();
    session.hairMaterial?.hairUniforms.depthMap?.value?.dispose();
    session.hairMaterial?.dispose();

    session.eyeOcclusion = null;
    session.eyes = null;
    session.skin = null;
    session.cards = [];
    session.hair = null;
    session.hairMaterial = null;

}

/**
 * Reads back what the loaded asset actually is, so the page can say it rather than assume it.
 *
 * This page used to carry two workarounds here — one reparenting the unskinned face meshes onto
 * the head bone, one forcing every BLEND material opaque. Both are gone, because the figure
 * pipeline now exports all seven meshes skinned and only the brow and lash cards non-opaque. A
 * check replaces them: if a regressed bake is ever dropped in, the HUD says so in words instead
 * of the page quietly gluing the face back on and hiding it.
 *
 * Materials this page installed are skipped, and the distinction is the whole point of the check:
 * it is an account of the ASSET, and a blend that Phase 3 chose is not a defect in the bake. The
 * corneal shell is deliberately transparent with depth writing off, so without this it would raise
 * a permanent false alarm on the one line a judge reads to find real ones.
 *
 * @returns {string} one HUD line — the asset's own account of itself.
 */
function describeAsset( figure ) {

    const unskinned = [];
    const blended = [];

    for ( const mesh of figure.meshes ) {

        if ( mesh.isSkinnedMesh !== true ) unskinned.push( mesh.name );

        const materials = Array.isArray( mesh.material ) ? mesh.material : [ mesh.material ];
        for ( const material of materials ) {

            if ( material.name?.startsWith( 'sugata.' ) === true ) continue;
            if ( material.transparent === true ) blended.push( `${ mesh.name }/${ material.name }` );

        }

    }

    if ( unskinned.length === 0 && blended.length === 0 ) {

        return `${ figure.meshes.length }/${ figure.meshes.length } meshes skinned, none blended`;

    }

    return `⚠ unskinned [${ unskinned.join( ' ' ) }]  blended [${ blended.join( ' ' ) }]`;

}

/**
 * Puts the camera on the figure and reports where it is looking and how far away it stands.
 *
 * Two framings, because the Phase 2 gate asks two different questions of the same figure. A
 * PORTRAIT is the only frame in which a blink or a saccade is legible — an eyelid has to be dozens
 * of pixels tall before the roll of it means anything. A BODY frame is the only one in which a
 * rest pose, an arm that hangs, and a weight shift are legible at all. Neither answers for the
 * other, so the page does both rather than compromising on one.
 *
 * The portrait is anchored on the EYE LINE, read off the eyeball mesh rather than guessed from a
 * bone: the five bakes differ in height by centimetres, and the `head` joint sits at the base of
 * the skull, well below the eyes. Anchoring on the eyes means the same rule produces a correct
 * head-and-shoulders at 0.42 m and a correct eyes-only crop at 0.17 m.
 *
 * The body frame is anchored on the figure's own bounding box instead, because "the whole person"
 * is a statement about the mesh, not about the face.
 *
 * @returns {{ focus: Vector3, distanceMetres: number }} the point the lights should aim at, and
 *   the camera's distance, which is what the lighting rig scales itself against.
 */
function frameFigure( stage, figure, { mode, heightMetres } ) {

    figure.root.updateMatrixWorld( true );

    const focus = mode === 'body'
        ? bodyFocus( figure, heightMetres )
        : new Vector3( 0, eyeLineHeight( figure ) + heightMetres * ( EYE_LINE_FROM_TOP - 0.5 ), 0 );

    const halfFieldOfView = ( PORTRAIT_FIELD_OF_VIEW_DEGREES / 2 ) * Math.PI / 180;
    const distance = ( heightMetres / 2 ) / Math.tan( halfFieldOfView );
    const azimuth = CAMERA_AZIMUTH_DEGREES * Math.PI / 180;

    stage.camera.position.set(
        focus.x + Math.sin( azimuth ) * distance,
        focus.y,
        focus.z + Math.cos( azimuth ) * distance
    );

    stage.camera.lookAt( focus );

    return { focus, distanceMetres: distance };

}

/** Vertical centre of the figure's bounding box, on the figure's own axis rather than the box's. */
function bodyFocus( figure ) {

    const bounds = new Box3().setFromObject( figure.root );

    return new Vector3( 0, ( bounds.min.y + bounds.max.y ) / 2, 0 );

}

/**
 * The framed height the requested mode wants, in metres — a portrait crop, or the figure's own
 * measured height plus a margin.
 *
 * Measured rather than assumed because the five bakes differ by centimetres and because a rest
 * pose changes the number: the relaxed pose drops the arms and settles the pelvis, so the same
 * figure is not the same height posed as it is in bind.
 */
function framedHeightFor( figure, mode, override ) {

    if ( Number.isFinite( override ) ) return override;
    if ( mode !== 'body' ) return PORTRAIT_HEIGHT_METRES;

    const bounds = new Box3().setFromObject( figure.root );

    return ( bounds.max.y - bounds.min.y ) * BODY_FRAME_MARGIN;

}

/**
 * World height of the pupils, taken as the centre of the eyeball mesh. Falls back to the crown of
 * the bounding box less a head's worth, so a figure without that mesh still frames somewhere sane
 * rather than at the navel — but says so, because a silent fallback here moves the portrait crop
 * without moving anything a gate looks at.
 */
function eyeLineHeight( figure ) {

    let eyeballs = null;
    figure.root.traverse( ( object ) => {

        if ( object.isMesh === true && EYEBALL_MESH_PATTERN.test( object.name ) ) eyeballs = object;

    } );

    if ( eyeballs !== null ) {

        return new Box3().setFromObject( eyeballs ).getCenter( new Vector3() ).y;

    }

    console.warn( `alive: no mesh matching ${ EYEBALL_MESH_PATTERN } — the portrait frame is ` +
        'guessing at the eye line from the top of the bounding box.' );

    return new Box3().setFromObject( figure.root ).max.y - 0.11;

}

// --- signals -------------------------------------------------------------------------------

/**
 * Measures how far the head has actually travelled, in millimetres, against where it sat on the
 * frame this sampler was built. Sway and breath are both millimetre-scale, so "did anything move"
 * is a question only a measurement can answer.
 */
function createHeadSampler( session ) {

    // Re-zeroed whenever a different bake arrives: the five figures differ in height by
    // centimetres, and measuring the new head against the old one's rest would swamp the
    // millimetres we are actually trying to see.
    let referenceHead = null;
    let restPosition = null;
    const current = new Vector3();

    return () => {

        const head = session.figure?.root.getObjectByName( 'head' );
        if ( head === undefined || head === null ) return { medioLateral: 0, anteroPosterior: 0 };

        session.figure.root.updateMatrixWorld( true );
        current.setFromMatrixPosition( head.matrixWorld );

        if ( head !== referenceHead ) {

            referenceHead = head;
            restPosition = current.clone();

        }

        return {
            medioLateral: ( current.x - restPosition.x ) * 1000,
            anteroPosterior: ( current.z - restPosition.z ) * 1000
        };

    };

}

/**
 * Measures how far each hand has travelled from where it rested at bind, in millimetres.
 *
 * The two hands are plotted as two traces rather than one, because the question BodyIdle exists
 * to answer is not "do the arms move" but "do they move independently". Two lines that wander
 * apart are the evidence; one line, or two that mirror, is the tell that a rig is driving both
 * from the same stream.
 */
function createHandSampler( session ) {

    const rest = new Map();     // Bone -> its position at first sight
    const current = new Vector3();

    const displacementOf = ( boneName ) => {

        const hand = session.figure?.root.getObjectByName( boneName );
        if ( hand === undefined || hand === null ) return 0;

        current.setFromMatrixPosition( hand.matrixWorld );

        if ( rest.has( hand ) === false ) rest.set( hand, current.clone() );

        return current.distanceTo( rest.get( hand ) ) * 1000;

    };

    return () => {

        // World matrices are refreshed by the head sampler on the same frame; refreshing again
        // here would be a second full traverse for the same answer.
        return { left: displacementOf( 'hand_l' ), right: displacementOf( 'hand_r' ) };

    };

}

function sampleSignals( stack, layers, samplers ) {

    const head = samplers.head();
    const hand = samplers.hand();

    return {
        blinkClosure: stack.morphChannels.get( 'eyeBlinkLeft' )?.committed ?? 0,
        breathLevel: layers.breath.level,
        eyeYawDegrees: layers.gaze.currentEyeYawDegrees,
        headYawDegrees: layers.gaze.headYawDegrees,
        headMedioLateralMm: head.medioLateral,
        leftHandMm: hand.left,
        rightHandMm: hand.right
    };

}

function describeState( stage, stack, layers, session, pupilScale ) {

    const { breath, sway, bodyIdle, gaze, blink, facialIdle } = layers;
    const stats = stage.stats;
    const faceEvents = facialIdle.eventCounts;

    return [
        `${ stats.backend }   ${ stats.fps.toFixed( 0 ) } fps   ${ stats.frameMs.toFixed( 2 ) } ms cpu   ` +
            `${ stats.drawCalls } draws   ${ ( stats.triangles / 1000 ).toFixed( 0 ) }k tris   dpr ${ stats.dpr }`,
        `motion time ${ stack.time.toFixed( 1 ) } s   conflicts ${ stack.conflicts.length }`,
        '',
        `figure   gender ${ session.identity.gender.toFixed( 2 ) }   asset ${ describeAsset( session.figure ) }`,
        `pose     ${ session.restPose === null ? 'BIND (no rest pose)' : session.restPose.name }` +
            `   frame ${ session.frameMode } ${ session.framedHeightMetres.toFixed( 2 ) } m`,
        `breath   ${ breath.breathsPerMinute.toFixed( 1 ) } brpm   level ${ breath.level.toFixed( 2 ) }   ×${ breath.exaggeration }`,
        `sway     ML ${ ( sway.displacement.x * 1000 ).toFixed( 1 ) } mm   AP ${ ( sway.displacement.z * 1000 ).toFixed( 1 ) } mm` +
            `   shifts ${ sway.eventCounts.shift + sway.eventCounts.discourseShift }`,
        `body     arousal ${ bodyIdle.arousal.toFixed( 2 ) }   settles ${ bodyIdle.eventCounts.shoulderSettle }` +
            `   arm swings ${ bodyIdle.eventCounts.weightShiftSwing }`,
        `gaze     ${ gaze.conversationState } / ${ gaze.region }   eye ${ gaze.currentEyeYawDegrees.toFixed( 1 ) }°` +
            ` head ${ gaze.headYawDegrees.toFixed( 1 ) }°   ${ gaze.saccadeCount } saccades`,
        `blink    ${ blink.blinkCount } blinks   ${ blink.effectiveRatePerMinute().toFixed( 1 ) }/min asked` +
            `   down ${ ( blink.closingDuration * 1000 ).toFixed( 0 ) } ms  up ${ ( blink.openingDuration * 1000 ).toFixed( 0 ) } ms`,
        `face     brow ${ faceEvents.browRaise }/${ faceEvents.browFurrow }` +
            `   lip press ${ faceEvents.lipPress }   swallow ${ faceEvents.swallow }`,
        `pupil    scale ${ pupilScale.toFixed( 3 ) }   ${ layers.pupil.physiologicalDiameterMillimetres.toFixed( 2 ) } mm` +
            `   ${ session.eyes?.attached === true ? 'on EyeMaterial.pupilScaleUniform' : '(no eye shader — nowhere to land)' }`,
        // The eye shader and the occlusion sheet are reported SEPARATELY because they switch
        // separately, and a HUD that says "eyes ON" over a plate missing one of them is how the
        // confound survived. `attached` rather than `!== null`: the material is always built, since
        // building it is what measures the geometry the sheet needs.
        `shading  skin ${ session.skin === null ? 'OFF (shipped GLB material)' : 'SkinMaterial' }` +
            `   eyes ${ session.eyes?.attached === true ? 'EyeMaterial' : 'OFF (shipped GLB materials)' }` +
            `   eyeocc ${ session.eyeOcclusion === null ? 'OFF' : `${ session.eyeOcclusion.meshes.length } sheets` }` +
            `   cards ${ session.cards.length === 0 ? 'OFF (shipped GLB materials)'
                : `${ session.cards.length } lobe-free${ session.multisampled ? ' + a2c' : ', NO MSAA — a2c inert' }` }`
    ].join( '\n' );

}

// --- controls ------------------------------------------------------------------------------

function bindControls( { session, stack, stage, lights, backdrop, layers } ) {

    const { breath, sway, bodyIdle, handIdle, gaze, blink, pupil } = layers;

    bindDial( 'arousal', ( value ) => {

        breath.setArousal( value );
        pupil.setArousal( value );
        bodyIdle.setArousal( value );
        handIdle.setArousal( value );

    } );

    bindDial( 'load', ( value ) => blink.setCognitiveLoad( value ) );
    bindDial( 'attention', ( value ) => blink.setAttention( value ) );

    document.getElementById( 'conversation' ).addEventListener( 'change', ( event ) => {

        gaze.setConversationState( event.target.value );

    } );

    document.getElementById( 'discourse' ).addEventListener( 'change', ( event ) => {

        gaze.setDiscourse( event.target.value === '' ? null : event.target.value );

    } );

    document.getElementById( 'filled-pause' ).addEventListener( 'click', () => gaze.markFilledPause() );
    document.getElementById( 'turn-end' ).addEventListener( 'click', () => gaze.markTurnEnd() );
    document.getElementById( 'boundary' ).addEventListener( 'click', () => {

        sway.markDiscourseBoundary( { speakerChanged: true } );

    } );

    // The gender dial is the one control that reloads an asset. Identity's NEAREST mode snaps to
    // the closest of five bakes, so a drag across the axis loads at most five files and the slider
    // moves in five visible steps — that is the mode's honest behaviour, not a bug.
    //
    // The value guard matters: bindDial publishes once at setup so every other dial starts in
    // sync, and without it that publish would fetch an 11 MB GLB the page has already loaded.
    bindDial( 'gender', ( value ) => {

        if ( value === session.identity.gender ) return;

        session.identity.set( { gender: value } );
        swapFigure( session, stack, stage, lights, backdrop, ground ).catch( reportFailure );

    } );

    buildLayerToggles( layers );

    const exaggerate = document.getElementById( 'exaggerate' );
    exaggerate.addEventListener( 'click', () => {

        breath.exaggeration = breath.exaggeration > 1 ? 1 : 8;
        exaggerate.setAttribute( 'aria-pressed', String( breath.exaggeration > 1 ) );

    } );

    document.getElementById( 'conflicts' ).addEventListener( 'click', () => {

        console.log( stack.describeConflicts() );

    } );

}

function bindDial( id, apply ) {

    const input = document.getElementById( id );
    const output = document.getElementById( `${ id }-value` );

    const publish = () => {

        const value = Number( input.value );
        output.textContent = value.toFixed( 2 );
        apply( value );

    };

    input.addEventListener( 'input', publish );
    publish();

}

/** One on/off button per motion layer, so any of them can be subtracted and the loss looked at. */
function buildLayerToggles( layers ) {

    const container = document.getElementById( 'layer-toggles' );

    for ( const [ key, layer ] of Object.entries( layers ) ) {

        const button = document.createElement( 'button' );
        button.type = 'button';
        button.textContent = key;
        button.setAttribute( 'aria-pressed', String( layer.enabled ) );

        button.addEventListener( 'click', () => {

            layer.enabled = ! layer.enabled;
            button.setAttribute( 'aria-pressed', String( layer.enabled ) );

        } );

        container.appendChild( button );

    }

}

function bindKeyboard( { blink, trace } ) {

    window.addEventListener( 'keydown', ( event ) => {

        if ( event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT' ) return;

        const key = event.key.toLowerCase();

        if ( key === 'b' ) blink.blinkNow();
        if ( key === 's' ) blink.triggerWithSaccade( 35 );
        if ( key === 't' ) trace.toggle();

    } );

}

// --- the strip chart ---------------------------------------------------------------------------

/**
 * A rolling plot of the five signals that carry aliveness. Without it a screenshot of this page
 * cannot distinguish a breathing figure from a frozen one, because the whole motion is
 * millimetres. The picture is the sanity check; the trace is the evidence.
 */
function createTrace( canvas ) {

    const context = canvas.getContext( '2d' );
    const windowSeconds = 12;

    const channels = [
        { key: 'blinkClosure', colour: '#f2a65a', label: 'blink closure 0..1', min: 0, max: 1 },
        { key: 'breathLevel', colour: '#7fd1a0', label: 'breath level 0..1', min: 0, max: 1 },
        { key: 'eyeYawDegrees', colour: '#8ab4f8', label: 'eye yaw ±15°', min: -15, max: 15 },
        { key: 'headYawDegrees', colour: '#c58af9', label: 'head yaw ±15°', min: -15, max: 15 },
        { key: 'headMedioLateralMm', colour: '#e57bb0', label: 'head ML ±12 mm', min: -12, max: 12 },
        // Two hands, two lines. Whether the arms are alive is answered by either line moving;
        // whether they are a rig is answered by the two moving together.
        { key: 'leftHandMm', colour: '#f4e07a', label: 'left hand 0..14 mm', min: 0, max: 14 },
        { key: 'rightHandMm', colour: '#79e0d8', label: 'right hand 0..14 mm', min: 0, max: 14 }
    ];

    const samples = [];
    let elapsed = 0;

    return {

        push( deltaSeconds, values ) {

            elapsed += deltaSeconds;
            samples.push( { time: elapsed, values } );

            while ( samples.length > 0 && samples[ 0 ].time < elapsed - windowSeconds ) samples.shift();

        },

        draw() {

            if ( canvas.style.display === 'none' ) return;

            const rowHeight = canvas.height / channels.length;

            context.clearRect( 0, 0, canvas.width, canvas.height );

            channels.forEach( ( channel, row ) => {

                const top = row * rowHeight;

                context.strokeStyle = 'rgba(255,255,255,0.08)';
                context.beginPath();
                context.moveTo( 0, top + rowHeight * 0.5 );
                context.lineTo( canvas.width, top + rowHeight * 0.5 );
                context.stroke();

                context.fillStyle = channel.colour;
                context.font = '9px ui-monospace, monospace';
                context.fillText( channel.label, 6, top + 10 );

                context.strokeStyle = channel.colour;
                context.lineWidth = 1.25;
                context.beginPath();

                samples.forEach( ( sample, index ) => {

                    const x = canvas.width * ( 1 - ( elapsed - sample.time ) / windowSeconds );
                    const normalised = ( sample.values[ channel.key ] - channel.min ) / ( channel.max - channel.min );
                    const y = top + rowHeight - 3 - normalised * ( rowHeight - 6 );

                    if ( index === 0 ) context.moveTo( x, y );
                    else context.lineTo( x, y );

                } );

                context.stroke();

            } );

        },

        setVisible( visible ) {

            canvas.style.display = visible ? 'block' : 'none';

        },

        toggle() {

            this.setVisible( canvas.style.display === 'none' );

        }

    };

}

function reportFailure( error ) {

    document.getElementById( 'hud' ).textContent = `failed\n${ error.message }`;
    console.error( error );

}

// The one catch-all: the boundary where a failure has to become something a human can read.
boot().catch( reportFailure );
