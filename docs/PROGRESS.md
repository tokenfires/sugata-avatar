# Sugata 姿 — progress and resume state

**Read on resume, in this order:**

1. **[`BRIEF.md`](BRIEF.md) — the original request, verbatim.** Everything else is
   interpretation. When interpretation and the brief disagree, the brief wins.
2. **[`LEARNINGS.md`](LEARNINGS.md)** — verification lessons, technical traps, and every command
   known to work. Read Part 1 before writing any gate; it is the accumulated cost of getting
   this wrong repeatedly.
3. **This file** — where the work stands.
4. **[`PUNCHLIST.md`](PUNCHLIST.md)** — the next item and its acceptance gate.

Update this file whenever a phase changes state. It is written to survive total context loss.

Last updated: 2026-08-07 — five of the visual judge's seven findings closed by measurement; the eye asset gained a real cornea; the deferred render pipeline (3.1) landed; the corneal radius of curvature is measured and recorded at last, and the "under-strength corneal power" claim is retracted — it had the sign backwards.

---

## What this project is

A browser-based (Three.js) real-time 3D avatar system that gives an AI agent a body.
The agent configures its own identity — male, female, or anywhere between — and the
avatar embodies what the agent says and how it says it, across the full range of human
emotion, face and body.

**Name:** 姿 (*sugata*) — the figure, form, or bearing of a person.

## Decisions locked in (2026-08-06, with the user)

| Decision | Choice |
|---|---|
| Character source | **Asset-agnostic engine, parametric primary.** Verified: **MPFB2** (CC0 assets, build-time only — code is GPLv3). It ships canonical **ARKit-52 as CC0** in the `faceunits01` pack, plus 22 MS and 15 OVR visemes. Gender axis is **exactly linear**, so identity ships as one morph pair around an androgynous base. See [`research/base-mesh-verification.md`](research/base-mesh-verification.md) — authoritative, supersedes the two earlier asset docs. |
| Completion gate | **Same-tier, not better.** Harsh blind critics must place renders in the same visual family as real-time AAA character work, *and* the emote comparison must decisively beat Live2D/VTuber. Explicitly NOT "critics prefer ours over Stellar Blade" — that gate does not terminate. |
| Audio | **Full duplex.** TTS out drives visemes and prosody; live mic in drives listening behavior, gaze, and backchannel. |
| Consumer | **Portable library.** Clean runtime API any agent embeds, shipped with a demo harness. |

### Standing constraint from the user

Do not scope the vision down. Phase it instead — bigger vision means *more* design,
spikes, and isolated prototypes, not less ambition.

### The honest limit, stated up front

Stellar Blade's character fidelity is largely **art labor**: scan-derived multi-thousand-pixel
PBR texture stacks, artist-groomed hair, baked lighting. That content cannot be authored
from a terminal. What is reachable is **technique parity** — an engine whose shading and
animation are genuinely AAA-tier, so the ceiling is set by the asset fed to it rather than
by the renderer. On the animation/emote axis, beating Live2D is winnable outright: Live2D
is 2.5D mesh deformation with no true gaze, no real head rotation, no body IK, and no
physics beyond hair springs.

---

## Environment (verified 2026-08-06)

- Host: MacBook Pro, Apple M5 Max, 40 GPU cores, 128 GB unified memory, 2.4 TB free.
- Node v24.13.1, npm 10.9.8.
- LM Studio at `http://127.0.0.1:1234`, no auth. `qwen/qwen3.6-35b-a3b` loaded.
  Integration quirks and the model bake-off are documented in
  [`research/lm-studio-integration.md`](research/lm-studio-integration.md) — **read it
  before writing any LM Studio client code**, it contains two non-obvious blockers.
- Repo: git initialised on `main`. No remote configured.

---

## Phase status

**Order revised after research** — the ocular/idle layer has the highest perceptual return per unit
of effort and needs neither shaders nor the affect pipeline, so it moves ahead of rendering and lets
the emote critic loop run in parallel with renderer work.

| # | Phase | Status |
|---|---|---|
| 0 | Foundation — scaffold, asset pipeline, critic harness, spikes | **done** (0.4/0.5/0.9/0.11 open) |
| 1 | Body and identity — gender morph pair, ARKit bank, rig | **done** |
| 2 | **Ocular + idle** — blink, saccade, VOR, breath, sway | **built; all measured gates green, visual judgement outstanding** |
| 3 | Rendering — skin, eyes, hair, cloth, lighting, post | **3.1 done** (deferred G-buffer); 3.3's asset blocker cleared; rest not started |
| 4 | Speech — viseme timeline, TTS, coarticulation | not started |
| 5 | Affect — PAD, WASABI activation, AU mapping, mic-in | not started |
| 6 | Body motion — gesture, posture, IK, physics | not started |
| 7 | Runtime API and testbed | not started |
| 8 | Blind critic loops until same-tier | not started |

### 2026-08-07, later — the POSTURE_HEAD_TRANSFER disagreement is resolved

**It was not a tuning disagreement. It was a frame-of-reference error, and the coefficient was out
by 8.3×.** The section below is kept as the record of how it was diagnosed; what follows supersedes
its conclusion.

Static equilibrium decides the coefficient rather than leaving it to be tuned: a body that is not
accelerating has no net moment, so the ground reaction force acts along a line through the centre
of mass, and its point of application on the floor — the centre of pressure — sits under it.
Duarte's "shifting" is, in his own words, *"a fast displacement of the average position of COP from
one region to another"*: a change in the **sustained mean**, so the identity applies. A 22 mm
centre-of-pressure shift IS a 22 mm centre-of-mass shift.

So the model is re-rooted the same way the pendulum was: every amplitude is now stated in
centre-of-pressure metres, the new `figure/BodyMass.js` says where the centre of mass is for a
given pose, both the lean and the contrapposto blend are **solved** so the centre of mass lands
where the literature says, and **head excursion is an output**. Measured on figure_g050:

| quantity | measured | was |
|---|---|---|
| head travel per unit centre-of-mass travel | **1.676** | assumed 0.20 |
| contrapposto response per unit blend | COM 38.0 / −40.7 mm, head 57.1 / −63.3 mm | head only |
| lateral postural events per minute | **1.51** | 0.28 |
| balance band, centre-of-pressure RMS | ML 3.05, AP 4.87 mm (medians, 900 s) | applied as head excursion |
| composite centre-of-pressure RMS, 900 s | ML median 11.63, AP median 8.22 mm | — |
| worst sole slide over 900 s | **0.17 mm** | 0.54 mm, then 2.49 before the pivot fix |

Four further defects were found in the same pass, each independently confirmed:

- **The amplitude draw.** `|N(22, 38)|` has a mean of 35 mm, not Duarte's 22 — the layer drew
  shifts 60% too large. A reported SD exceeding its mean on a positive quantity means the
  distribution is *skewed*; it is now lognormal matched on both moments.
- **Fidgets are weight shifts too.** Duarte separates fidget from shift on whether the body
  *returns*, not on whether it loaded a leg. Only shifts relayed, at 0.30/min, which is why 7 of
  12 ninety-second windows contained no postural event. Counting both gives 1.575/min — punch-list
  2.9's 1–1.5 and Cassell's independently measured 1.4–1.6.
- **A shift that springs back in 30 s is a fidget.** `SHIFT_RETURN_SECONDS = 30` against a 199 s
  inter-shift interval contradicted the paper being implemented, and cost most of the composite
  amplitude. It now holds for one interval.
- **Fidget direction was never drawn** — every fidget in the layer's history pushed the body toward
  the character's left.

**The elderly-cohort correction, applied in the same pass.** Quijoux's two sets are aged 71.3 and
78.7, and sway rises from about age 60 — so those are elderly reference values driving a young
avatar. That is the *same class* of error as the frame one and it points the other way; fixing one
and not the other would have made the result uninterpretable. No young-adult COP RMS in millimetres
was found to substitute, so the correction taken is to author at the force-plate column itself
(3.0 / 4.9 mm) rather than at the gate-band midpoint — the low end, which is the side the age bias
says to err on.

**Two more defects, found by the rewritten gates rather than by the code's author** — both the
same lesson, both now in LEARNINGS §1.11a/b: *when an amplitude changes by an order of magnitude,
re-audit every constant whose cost was argued as negligible.*

- **Foot planting broke by 40×.** `STANCE_RESPONSE_PROBE_BLEND` measured the contrapposto once
  and scaled linearly, justified by a genuine measurement — the *centre-of-mass* response varies
  0.3% across the range. True, and it does not cover the **ankle**, which rides an arc. At blend
  1.0 the linearisation left 2 mm of vertical: a foot off the floor. It is a table now.
- **`PIVOT_HEIGHT_FRACTION_OF_ANKLE = 0.5`** was a well-argued idealisation costing a tenth of a
  millimetre — until the lean grew six-fold and the sole, 29 mm below that pivot, slid **2.49 mm**.
  At the joint it is 0.16 mm and the sole is planted for free.

**Measured on screen** — lateral silhouette-centroid travel in pixels, `tools/critic/travel.mjs`:

| band | before, 90 s | after, 90 s | after, **420 s** |
|---|---|---|---|
| head | 4.92 / 26.6 | 5.55 / 31.7 | **9.91 / 69.5** |
| shoulder | 1.99 / 13.0 | 2.87 / 18.2 | **7.82 / 45.5** |
| hip | 1.45 / 9.5 | 2.02 / 12.9 | **6.00 / 36.6** |
| knee | 0.75 / 5.1 | 1.04 / 6.8 | **3.11 / 18.1** |
| ankle | 0.27 / 2.2 | 0.31 / 2.6 | **0.85 / 4.6** |

The 90 s columns measure the balance band almost alone — at 0.30 shifts/min a 90 s window cannot
contain a weight shift (§1.4, again), which is why the 420 s column exists. Against the failing
diagnosis's **1.6 pixels**, the hip now travels **36.6 px peak-to-peak**.

### The one shortfall, recorded rather than tuned away

The fore-and-aft composite sits at **8.22 mm** against Bates' lower quartile of 10.34. Two
calibration attempts are written up in `Sway.js`; the second is the informative one, because
widening the clamp moved it 0.05 mm and proved the clamp was never what held it down. Worked the
other way: Duarte's fore-and-aft processes carry 6.7 mm of the 8.22 where Bates would need 15.6 —
**2.3× his shift amplitude or five times his rate, both of which contradict the paper this layer
implements event by event.** Duarte is the process; Bates is a composite from another task. Where
they conflict the process wins, and the shortfall is asserted in both selftests as a known state
that goes red the day it closes. The lateral axis — the visible one — sits inside Bates' IQR.

### 2026-08-07, later still — the visual judge, and the error the numbers could not see

**Verdict: "a well-animated head bolted to a rigid mannequin being tilted on an ankle hinge."**
Every measured gate was green and the judge was still right, which is §1.2 in its purest form.

🎯 **THE FINDING: LATERAL BALANCE IS NOT AN ANKLE STRATEGY.** The inverted pendulum governs
antero-posterior balance. Medio-laterally, with the feet apart, the ankle has almost no lateral
authority and the body uses a **hip load/unload** mechanism — pelvis over the loaded foot,
abductors hiking that side, lumbar spine counter-bending, head parked over the base of support.
That is the title of Winter, Prince, Frank, Powell & Zabjek 1996: *"Unified theory regarding A/P
and M/L balance in quiet stance."* **Two axes, two mechanisms.**

🚩 The adversarial verifier cited that paper to me earlier in the session, as a mechanism note
under a different claim. I read it and moved on. It was the central modelling fact for the lateral
axis. *A citation delivered in support of one claim can be the answer to a different one.*

The judge's evidence, which no gate in the repo was looking for: left-leg tilt against right-leg
tilt **r = 0.94**, hip against neck **r = 0.95**, and lateral displacement **proportional to height
above the ankle** — so the head travelled 2.5× as far as the pelvis. A real weight shift is the
other way round.

**Two fixes, both measured:**

| | before | after |
|---|---|---|
| ankle path over 900 s | 550 mm | **60 mm** (legs stop swinging as a plank) |
| contrapposto head / centre-of-mass | 1.50 | **1.00** |
| head ML RMS, 900 s | 18.4 mm | **12.9 mm** |
| on-screen head / hip travel | 1.89 | **1.34** |
| on-screen hip peak-to-peak | 36.7 px | **43.9 px** |

1. **The whole lateral signal now goes through the hip mechanism**, not just the weight shifts —
   `solveStanceBlend` reads `displacement.x`, not `postureDisplacement.x`. One line; it fixed the
   articulation but *not* the displacement profile, because —
2. **the authored contrapposto carries the same head-over-pelvis ratio the pendulum did.** Its
   prose says "the lumbar spine bends back the other way to bring the head over the support"; its
   measured angles move the head 1.5× the pelvis. `STANCE_TRUNK_RIGHTING` adds a lumbar
   counter-bend sized at bind from the pose's own measured overshoot — 2.89° per unit blend — and
   leaves the authored pose alone, because a deliberate contrapposto and an involuntary balance
   correction are different behaviours that happen to share a shape.

**The judge's seven findings, after the round that answered them.** Five are closed by
measurement, one is closed inside the layer that owns it with a residue that is not, and one is
**not reproducible in the simulation at all**.

| # | Finding | State |
|---|---|---|
| 1 | Head travels 1.34× the hip | **Fixed in `Sway`**, residue elsewhere — see below |
| 2 | The stance is ~480 mm outer-to-outer | **Fixed** — 480.0 → **295.5 mm** outer-to-outer, 379.9 → **169.8 mm** between heel centres |
| 3 | Head-on-neck adds to the trunk lean (r = +0.10) | **Fixed** — negative on every seed |
| 4 | Only 3 postural events read in 7 minutes | **Fixed** — median event 11.4 → 16.1 mm against a 3.7 mm background; 0.60 → **0.967 legible events/min** |
| 5 | The feet read as welded | **Fixed** — the unloaded foot's toes lift 2.5°, raising the skinned toe geometry **1.48 mm** while the loaded foot moves 0.003 mm |
| 6 | The hands never move | **Fixed** — 0.73 mm / **0.48 px** shipped, now 8.65 mm / **5.69 px** via `motion/HandIdle.js` |
| 7 | One arm is 2.5× livelier than the other | **NOT REPRODUCIBLE** — see below |

**Finding 1 — where the remaining head travel comes from, isolated by execution.** `Sway` alone now
measures head/pelvis lateral **0.84 RMS / 0.83 peak-to-peak** (was 1.02 / 1.13) and a head-on-neck
correlation of **−0.996** (was +0.99 unrighted). The full `alive.js` stack measures 0.68–1.18
peak-to-peak across three seeds against the judge's 1.34. **Every millimetre of that residue is
`gaze.head`**: rebuilding the exact stack offline and removing one layer at a time, removing
`IdleMotion` changes head/pelvis by less than 0.0001 while removing `gaze.head` takes it from 1.278
to 0.941 and the correlation from +0.1125 to −0.9360. `gaze.head` adds ~8 mm RMS of lateral head
displacement uncorrelated with the trunk. It is a **roll** contribution — yaw and pitch do not move
the head joint. `Sway` was deliberately *not* over-corrected against it: you cannot cancel
independent noise with a different signal.

**Finding 7 — the arms are not asymmetric in the rig.** Measured over 12 seeds × 6 channels × 2
windows on the stack `alive.js` builds, in relaxed-standing, the worst left/right energy ratio
anywhere is **1.171** (300 s) / 1.125 (900 s); hand screen-space RMS through a reconstruction of the
page's own camera lands **0.96–1.02**. Seed offset, joint-limit proximity, degenerate co-prime
phase and baked handedness are all ruled out by that number. Leading remaining explanation is the
render side: `CAMERA_AZIMUTH_DEGREES = 12` puts the camera on the character's left and
`relaxed-standing.json` adducts `leftUpperArm` 28.5° against `rightUpperArm`'s 27.0°, so the right
arm is both farther and closer to the trunk silhouette — a per-region pixel statistic would score it
lower for reasons unrelated to how it is driven. **Unconfirmed: it needs a capture.** Gated
regardless — `idle-motion.selftest` bounds the ratio at 1.40 and is proven red at 2.45–3.04. See
LEARNINGS §1.7f.

### Phase 3.3's asset blocker is CLEARED — the eye has a cornea now

`tools/spikes/eye-geometry.mjs` had measured the old eyeball mesh at **6 of 8 clauses failing**, one
of them not shader-fixable: no corneal dome, front-versus-equator bulge 0.051 mm against 0.158 mm of
tessellation noise, and a flat octagonal apex facet recessed 0.131 mm *inside* the sphere. The
figures now build with `makehuman_system_assets`' `eyes/high-poly/high-poly.mhclo` instead, and
`build_figure.py` splits the outer shell onto its own transmissive material. **The spike goes to 3 of
8 passing, and the clause that flipped is the one that blocked 3.3.**

Both of the flagged unknowns resolved favourably, by measurement:

- **All eight ARKit `eyeLook*` morphs transfer through the proxy swap, onto BOTH shells.** Nothing
  lost, nothing renamed. The two shells turn as one body to within **0.874°**, which nothing in the
  glTF forces — they are separate meshes with separate copies of the same eight morphs — so the
  spike now measures it.
- **The corneal dome survives MPFB's fitting**, at ~76% of its authored amplitude: 0.650 mm on the
  source `.obj` at GLB scale, 0.494 mm after fitting.

**Three statements in the superseded text above were wrong, and the corrections matter:**

1. **The +7.7% dome figure does not reproduce.** Measured +4.29% on the source `.obj` and +3.25%
   after fitting. The useful number is the sclera-fitted one: the front 15° cap sits **0.688 mm
   proud** of a sphere fitted to the sclera band (RMS 0.202 mm), **3.41× the fit noise** against a
   3× threshold, with an anterior chamber of 2.291 mm.
2. **"Its UV island in `brown_eye.png` is fully opaque" is the reverse of what is in the file.** The
   cornea island is mean alpha **21/255** — almost entirely transparent. What made it an opaque grey
   dome was **our own `force_alpha_modes`** pinning every OPAQUE part's alpha to a constant 1.0. The
   conclusion (split the material) is unchanged; the reason is not.
3. **`alive.js:105` was the silent-failure case as predicted** — but `ocular.selftest.mjs:1027` threw
   outright rather than failing silently, which is the better of the two outcomes and is why it was
   found first.

**And the instrument was wrong before the asset was.** The dome does not survive the spike's
*original* test form, and that turned out to be a defect in the test: comparing the bulge against a
sphere fitted to the whole shell compares the dome against itself. Fitting the reference to the
sclera alone separates the two real assets by **46×** where the old form managed 10×, with the
threshold between the wrong pair. See LEARNINGS §1.11d.

**Now gated.** `verify_glb.mjs` asserts the dome, the anterior chamber (0.5 mm floor; measured
2.150–2.402 mm) and the cornea material's transmission and IOR on every figure, and
`cornea_geometry.selftest.mjs` (40 checks) sanity-checks the measurement in both directions on
synthesised shapes — necessary because **both** real known-bad figures stop the gate at "no corneal
shell" and never reach the dome test (§1.1).

⚠️ **The dome gate's margin is thin, and it was not widened to suit.** The five figures land at
3.15×–3.53× the fit noise against the 3× threshold, so `figure_g000` clears by 5%. The *physical*
separation from known-bad is enormous (+0.688 mm vs −0.015 mm); it is the noise estimate, not the
signal, that is marginal, and four different reference bands moved the ratio immaterially. If a
future `--age` or `--muscle` change turns it red, read the number before touching the threshold:
anything still comfortably positive is a shallower dome, not an absent one.

**The corneal radius of curvature, which is the number 3.3 actually needs.** It was recorded
nowhere until now. Measured on the shipped GLBs, both eyes, vertices welded by position, with a
least-squares sphere fitted to the **front cap alone** at the same 15° cut the dome gate already
uses (`node docs/eye-optics-claims.selftest.mjs`):

| figure | R anterior, left / right | that fit's RMS | sclera-band R | power at n=1.376 | power at the shipped IOR 1.3333 |
|---|---|---|---|---|---|
| g000 | 7.644 / 7.629 mm | 0.018 mm | 15.110 mm | 49.19 D | 43.60 D |
| g025 | 7.463 / 7.447 mm | 0.020 mm | 15.202 mm | 50.38 D | 44.66 D |
| g050 | 7.252 / 7.236 mm | 0.025 mm | 15.295 mm | 51.85 D | 45.96 D |
| g075 | 7.117 / 7.104 mm | 0.032 mm | 15.393 mm | 52.83 D | 46.83 D |
| g100 | 6.910 / 6.909 mm | 0.042 mm | 15.496 mm | 54.41 D | 48.24 D |

Left and right agree to **0.016 mm** worst case, and the cap fit's RMS is **5.9× (g100) to 10.5×
(g000) tighter** than the same shell's sclera-band fit, so this is a genuine second radius rather
than fit noise. The cap fit is only trustworthy inside the dome: at a 30° cut g075 and g100 read
8.802 mm (RMS 0.2725) and 9.088 mm (RMS 0.3034), because that cap has walked off the cornea onto
the sclera. Quote the 15° figure.

⚠️ **The cornea is STEEPER than human, not flatter — its power is over-strength, not under.**
A human anterior cornea runs 7.7–7.8 mm, i.e. 48.83–48.21 D at n = 1.376. Every figure here sits
below that radius; the ratio against the 7.7 mm reference spans **1.007 (g000) to 1.114 (g100)**.
The steepening is monotonic with the gender axis, so the masculine end is the extreme.

🚩 **The superseded claim, and why it was wrong, because the shape of the error is worth keeping.**
This paragraph previously read: *"the anterior chamber is shallow against anatomy … 2.15–2.40 mm on
a globe that is itself 1.27× human radius (15.3 mm against ~12 mm) … it means 3.3's corneal power
will be somewhat under-strength even now."* Corneal power is **(n − 1) / R of the cornea's own
anterior surface**. Neither the chamber depth nor the globe radius appears in it. The claim reached
a conclusion about one surface from the dimensions of two others, and it inverted the sign.

It got there by inheritance. The spike's original "half power" argument (LEARNINGS §1.11c) was
**correct for the low-poly proxy**, where there was no dome and the front surface therefore *was*
the globe. Measured directly on MakeHuman's source mesh, `mpfb/data/eyes/low-poly/low-poly.obj`,
one eye's 48 welded vertices fit a single sphere of R **14.955 mm** at an RMS of **0.0018 mm** — so
flawlessly spherical there is nothing else there to be a cornea — giving **25.14 D**, 51% of a
human 48.83 D. (Source-mesh units × 100 = mm, the MakeHuman convention; the built low-poly figure
was *not* rebuilt to check this, because `assets/figures/` is shared with four agents editing
concurrently. The conclusion does not depend on the fitted value: a shell whose radius is uniform
to 0.0018 mm has no second surface to fit, at any scale.)

That argument stopped applying the moment a real dome existed, and the note carried the conclusion
across without re-deriving it against the new geometry. **When the asset changes, re-derive; do not
re-word.**

⚠️ **The chamber depth is still shallow, but it buys something else.** 2.15–2.40 mm against a real
eye's ~3 mm is MakeHuman's authoring, not our fitting — the source `.obj` is already like this. What
it costs is the *path length* a refracted ray crosses before it reaches the iris plane, so the iris
will parallax less than a real one under gaze. It does not change the corneal power.

⚠️ **The shipped material IOR is 1.3333, not the cornea's 1.376.** That is what the last column
above is for: at the IOR the GLB actually carries, the delivered anterior power is 43.60–48.24 D —
at or slightly *below* the human anterior-surface figure, despite the steeper geometry. 3.3 gets to
choose whether to keep 1.3333 (aqueous, which is the right index for a shell modelled as one
interface into the anterior chamber) or raise it to 1.376; the geometry supports either and the
gate asserts both numbers. Note the clinical keratometric convention uses n = 1.3375 and would
report these corneas as 44.15–48.85 D against a human 43.27 D — same conclusion, different scale.
Do not compare a 1.376 number against a 1.3375 one.

⚠️ **Nothing has looked at these eyes.** Every claim here is geometric and material-level. The
cornea should render as clear glass with a Fresnel specular — three r185's WebGPU node path does
implement transmission with a real refraction ray (`PhysicalLightingModel.js:128`) — but no judge has
seen it. What to look for: a wet corneal highlight over the iris, and **not** a grey or blue-tinted
dome.

### Where Phase 2 actually stands

The gate is **"reads as alive when silent and unshaded."** It has failed twice, both times with a
precise, useful diagnosis. What works and what does not:

**Works, measured:** blink asymmetry (33–67 ms closing, 167–267 ms opening — a 3–4× ratio, the
snap-shut/roll-open that Live2D ships backwards); Poisson blink timing at 25.8/min with sd ≈ mean;
45 saccades/min with a real fixation-duration distribution; arms decorrelated left-to-right at
r = −0.05; **no loop** — image self-similarity is minimal at the shortest lag and rises
monotonically to 15 s; no drift, jitter or accumulation over 20 s; arousal visibly changes the
*character* of motion (hand path ×2.16 vs excursion ×1.68 — faster, not just bigger, which is the
correct signature).

**Fails:** the lower body had **exactly 0.0000 mm** of motion (Sway modelled as a spine bend rather
than an ankle-rooted inverted pendulum); the face below the eyes never moved once in 20 s
(`ExpressionBank` exists, was never in the stack); the 20 s clip could not contain any postural
event; eyes sit pinned near their mechanical limit because the head does not share the load.

**All four were fixed (commit `Sway becomes an ankle-rooted pendulum`).** Gate result at that
point:

**PORTRAIT: PASS. FULL BODY: FAIL.**

⚠️ **The diagnosis below is superseded** — see the 2026-08-07 entry above. It was recorded as a
modelling disagreement to be settled by choosing between two budgets. It was neither: it was a
frame-of-reference error, and the coefficient was out by 8.3× rather than 2.7×. Kept verbatim
because how a wrong diagnosis was written down is worth as much as the right one.

- Weight shifts fire at **0.28/min**, so **7 of 12** ninety-second windows contain none at all.
- When one does fire it moves the body ~4.5 mm ML — **1.6 pixels** at full-body framing.
  Side-by-side plates before and after a shift are indistinguishable.
- Cause: `POSTURE_HEAD_TRANSFER = 0.20` bounds the contrapposto blend to 0.077 of the pose, so a
  shift buys articulation (hip roll, lumbar counter-bend, free-knee flexion) but almost no travel.
  Duarte's 22 mm ML COP shift is ~a fifth of a full weight transfer; the two budgets disagree by
  ~2.7×. Raising the coefficient would move the validated head-RMS gates, so it was documented
  rather than changed.

### 🔜 Next actions, in order

1. **Close out the Phase 2 full-body gate.** The modelling disagreement is resolved (see above);
   what remains is evidence, not design:
   - a **300–600 s** full-body capture — long enough to contain weight shifts, which 90 s cannot;
   - the portrait gate re-checked, because head excursion grew 1.65× and the portrait gate was
     passing before this change;
   - a blind visual judge on the long clip.
2. **Phase 3 rendering** — the eyes and skin will read as dead until the eye and skin shaders
   exist. That is expected and was correctly excluded from the motion gate. `3.3` (eyes) has the
   best effort-to-impact ratio in the whole project: ~40 lines of TSL.
3. Open Phase 0 items: `0.4`/`0.5` (Anny morph pair + vertex-order diff), `0.9` (hair perf spike),
   `0.11` (faceunit visual check at gender extremes).

### Known open leads, recorded so they are not rediscovered

- 🎯 **`gaze.head` is the sole remaining contributor to head-on-neck noise**, isolated by removing
  one layer at a time from a rebuild of the exact `alive.js` stack (numbers under Finding 1 above).
  It adds ~8 mm RMS of lateral head displacement uncorrelated with the trunk, and it is the **roll**
  component that does it — yaw and pitch do not move the head joint. Two fixes worth considering, in
  order: (a) reduce the frontal-plane roll component of the head layer's idle/recruitment motion
  specifically; (b) give the head layer a stabilisation term that reads the neck's own lateral
  displacement and opposes it — which is what the vestibulo-collic reflex does and what `Sway` now
  does for its own two lateral mechanisms. A gate on `pearson(head.x − neck.x, neck.x) < 0` measured
  on the full stack would hold it; `pearson`/`peakToPeak` helpers exist in `sway.selftest.mjs` to
  copy. **Not applied this round — it is a design change to a file the balance agent did not own.**
- 🎯 **Morph targets write no velocity, and it is worse than writing none** (three r185). See
  punch-list 3.12 and LEARNINGS Part 2. This rig's face is 100% morph-driven, so it is not an edge
  case for us.
- **The fidget duration is capped at 1.8 s by a gate that may be measuring the wrong signal.** A
  longer fidget is better by every legibility measure (3.0 s buys 5.3% duty cycle against 1.8 s's
  3.2%), and it moves `idle-motion.selftest`'s **composite** lateral spectral mode from 0.264 to
  0.176 Hz — out of a band taken from Quijoux's 60 s "stand as still as possible" trials, which
  cannot contain a weight-shift process at 49–199 s intervals. That is §1.7b verbatim. The cap was
  honoured anyway, because a slower composite rock is a real change in what a viewer sees and there
  is no source saying it is right, and because honouring it costs 0.02 legible events per minute,
  measured. **Revisit with a source, not a preference.**
- **Punch-list 2.9's "1–1.5 posture shifts/min" is Cassell's CONVERSATIONAL rate**, delivered by
  `markDiscourseBoundary()`. Duarte's sustained lateral shift fires at 0.30/min, so a silent idle
  cannot reach 1–1.5 without contradicting the paper the layer implements event by event. The judge
  counting 3 sustained posture changes in 7 minutes is **2.1 expected** from 0.30/min — the model was
  not under-firing; the existing rate gate was counting a different quantity from the one being
  watched. Same shape as the antero-posterior composite shortfall below.
- **The foot residue the contrapposto asks `Sway` to cancel grew with the narrower stance**, from
  ~18 mm to ~29 mm fore-and-aft at full blend, because external rotation at the hip swings an ankle
  that is no longer under it. Planting corrects it in full and its gate is unchanged (1.5 mm
  horizontal / 0.05 mm vertical / 0.02° of sole tilt) — but the correction is an offset on the foot
  bone, so at full blend the shank is visually 29 mm longer or shorter than it is. Not measured on
  screen. **The most likely place for a new visual defect to have been introduced this round.**
- **Two constants landed this round with no primary support**, both flagged in the code:
  `TOE_UNLOAD_LIFT_DEGREES = 2.5` (chosen for a ~1.5 mm tip lift; the argued part is the
  *direction* — extension only, so nothing can be driven through the floor) and
  `FIDGET_DURATION_SECONDS = 1.8` (the shape is argued from Duarte's wording and from muscle; the
  duration is the largest value the spectral cap allows). In `HandIdle`:
  `HAND_RESETTLE_RATE = 3/min` per hand — there is no measured resting-hand fidget rate in
  `research/`, and it is anchored only to the ORDER of the three-way postural-event convergence
  (Duarte ~1.2/min, Bates 2.39/min, Cassell 1.4–1.6/min), which is a trunk rate, not a hand one.
  `FINGER_DRIFT_FRACTION_OF_RESTING_FLEXION = 0.12` and `RESETTLE_FRACTION = 0.16` land the index
  finger at 23–29% of its resting curl. **This is the number a visual judge should be asked about
  explicitly on the next round.**
- **The stance-width gate is not proven by reintroduction in code.** It was proven by execution
  during the work — the pre-change poses measure 0.3795 m and 5.9° against a band of 0.150–0.190 m
  and 10–18° — but unlike the other eight new gates there is no committed known-bad input, because
  the defect lives in JSON data rather than behind a constructor option.
- **The fore-and-aft composite shortfall** — 8.22 mm against Bates' Q1 of 10.34. Analysed above;
  closing it requires contradicting Duarte. Asserted as a known state in both selftests.
- **Sway mean resultant velocity measures 18.2 mm/s** against Quijoux's 11–20 eyes-open — inside
  the band, but at the *Wii-board* end while every amplitude is now authored at the *force-plate*
  end (11.0). Reported, not gated. It is the strongest remaining lead on the balance-band spectrum
  and closing it means slowing the upper noise band and re-running the f95 gates.
- **The anthropometry is Dempster (1955), eight elderly male cadavers.** de Leva's 1996 adjustment
  of Zatsiorsky–Seluyanov is the modern standard and is re-referenced to joint centres, which is
  exactly what `BodyMass` needs. It would move the head/centre-of-mass lever by perhaps 10% — a
  second-order correction to a defect that was 8×, but worth half an hour with the paper before
  anyone quotes the lever to three digits.
- **Quijoux's cohorts are elderly** (mean 71 and 79) and no young-adult COP RMS in millimetres was
  found. Mitigated by authoring at the low end of the band; not resolved.
- **Swallows render as lip compression only** — the asset has no throat articulation.
- Full-body lighting is a scaled portrait rig; rim and kicker stop reading at body scale.

Detailed per-item punch list lives in [`PUNCHLIST.md`](PUNCHLIST.md) once the design is
approved.

## Research — complete

All eight passes are in [`research/`](research/). Read in this order when resuming:

1. [`base-mesh-verification.md`](research/base-mesh-verification.md) — **authoritative on the
   character source**, supersedes the two earlier asset docs.
2. [`stellar-blade-look-spec.md`](research/stellar-blade-look-spec.md) — measured render parameters
   and the **six objective critic gates**.
3. [`affect-and-animation.md`](research/affect-and-animation.md) — PAD tables, WASABI activation,
   lipsync, gaze, physics. Contains a **licensing landmine** (NRC-VAD is non-commercial).
4. [`rendering-stack.md`](research/rendering-stack.md) and
   [`eyes-and-lighting.md`](research/eyes-and-lighting.md) — three.js reality, verified at r185.
5. [`body-motion-numbers.md`](research/body-motion-numbers.md) — implementable constants.
6. [`lm-studio-integration.md`](research/lm-studio-integration.md) — **read before any LLM client code.**
7. [`character-assets.md`](research/character-assets.md),
   [`generative-3d-and-template-bases.md`](research/generative-3d-and-template-bases.md) —
   superseded on the character choice, still useful for licensing landscape and the
   "six services died in eight months" record.

---

## Measured budgets (2026-08-07, this hardware)

Real GPU-timestamp measurements from `tools/spikes`, independently reproduced by a second agent.
**Use these; do not re-estimate.** Full detail and the fitted cost model in `tools/spikes/README.md`.

### Morph targets are essentially free

| Targets (13.7k verts, all weights animated every frame) | WebGPU Δ | WebGL2 Δ |
|---|---|---|
| 52 | 0.164 ms | — |
| **69** (52 ARKit + 15 OVR + 2 gender) | **0.219 ms** | 0.215 ms |
| 69 **with morph normals** | **0.504 ms** | 0.505 ms |

≈ 0.0032 ms per target, ~3% of a 16.6 ms frame at our full rig. **The blendshape budget is a
non-constraint** — a genuine surprise, since three.js iterates a `DataArrayTexture` layer per
target. Morph normals cost 2.3×; enable them only if the shading visibly needs it.

WebGPU and WebGL2 are within noise of each other here.

### RectAreaLights are the expensive part

Fitted cost model, WebGPU: **0.265 ms + 0.618 ms per Mpx lit, per light.**
(WebGL2: 0.539 + 0.682.)

| Lights @1080p | WebGPU Δ |
|---|---|
| **4** (key + fill + rim + kicker) | **3.604 ms — 22% of frame** |
| 8 | 7.421 ms — 45% of frame |

**The classic portrait rig costs about a fifth of the frame.** Affordable, and it confirms the
3–4 light budget. Eight is not viable alongside skin, hair and the post chain.

⚠️ Measured caveat: at 7–8 lights the WebGL2 tier goes non-monotonic under sustained load
(thermal drift across a suite run). The 4-light figure was stable in every run.

### The deferred pipeline is nearly free

1920×1080, dpr 1, WebGPU / apple metal-3, three r185, timestamp queries active, 600 samples per
variant, **one render call per frame**, two independent runs agreeing to within 0.3%.

| Variant | median |
|---|---|
| Same test scene, forward | 0.590 ms |
| Deferred, single attachment + composite | 0.590 ms |
| Deferred, full five-attachment G-buffer | **0.721 ms** |
| Full G-buffer at `resolutionScale` 0.66 | **0.393 ms** |

Derived: **pipeline machinery over forward 0.100 ms**; the four extra attachments **0.122 ms**; the
0.66 lever saves **0.310 ms (44%)**. G-buffer footprint 25 bytes/pixel = **51.8 MB at 1080p**.

⚠️ Read the total with its scope: 0.696 ms *includes the test scene's own shading* (5 meshes, ~110k
triangles, one directional light plus ambient). The 0.100 ms overhead and the 0.122 ms attachment
cost generalise; the total does not — the avatar's geometry and lighting replace that part.

⚠️ The GPU timer is quantised to **0.065536 ms** on this machine (measured as the smallest non-zero
gap between distinct samples, not assumed). The 0.100 ms figure is ~1.5 quanta and should be read as
"roughly one timer step", not three significant figures. The 0.696 and 0.386 figures span 6–11
quanta and are solid.

⚠️ **The Phase 0 spikes' passes-per-frame trick does not work here.** At `passes=4` it reported the
deferred path as *cheaper* than forward rendering, which cannot be true. `?passes=N` still exists on
`stage.html`; anyone re-opening it must re-validate the ordering first.

**Budget left:** with 4 RectAreaLights (3.604 ms) and 69 morphs (0.219 ms), roughly **12.7 ms of the
16.6 ms frame remains** for skin, eyes, hair, AO and the grade.

## Session log

### 2026-08-06 — design phase

- Confirmed empty repo, initialised git on `main`.
- Verified hardware and toolchain.
- **Spike: LM Studio affect inference.** Found two blockers and resolved both; selected
  `qwen3.6-35b-a3b` over `trinity-mini` and `gemma-4-26b` by measurement. Established that
  affect inference must be two-tier (reflex + appraisal) because the LLM pass costs ~0.7 s.
  Full write-up in `research/lm-studio-integration.md`.
- Ran eight design-research passes (see above). Key outcomes:
  - **WebGPU/TSL is forced as the primary path** — TAA, SSGI, SSR and temporal upscaling exist
    only there, and no velocity buffer exists in WebGL at all.
  - **MPFB2 confirmed as the character source**, and it ships ARKit-52 as CC0 — reversing the
    earlier "no blendshapes" finding. **The highest-risk assumption (headless operation) is
    resolved**: first-class supported path.
  - **The gender axis is exactly linear**, so identity is one morph pair around an androgynous base.
  - **Dominance is not readable from a static face** — it must be carried by posture, gaze policy
    and gesture amplitude. Structural argument for full-body.
  - **Animate early**: every timing constraint agrees, and AV-sync tolerance is asymmetric.
  - Stellar Blade decomposed into measured parameters, yielding **six objective critic gates**.
- Design spec updated with all of the above; phase order revised.
- **Next:** user approval on the spec, then write the implementation plan and punch list, then
  Phase 0.

---

## How to resume after a usage-limit interruption

1. Read this file, then `PUNCHLIST.md`, then the design spec in `docs/superpowers/specs/`.
2. Read `research/lm-studio-integration.md` before touching affect or LLM code.
3. `git log --oneline -20` for what actually landed.
4. Find the first punch-list item not marked done and continue there.
5. Update the session log and the phase table before stopping.

### 2026-08-07 — Phases 0–2 built; paused for an OS update

Four workflows, ~4.4M subagent tokens. Phase 0 and 1 complete, Phase 2 built with the portrait
gate passing and the full-body gate failing on one documented coefficient.

Shipped: deterministic byte-reproducible video capture; MPFB2 pipeline producing five figures
with 52 named ARKit morphs + 15 visemes across the gender sweep; Figure/ExpressionBank/Identity/
Skeleton; MotionStack; Blink, Gaze, Breath, Sway, IdleMotion, BodyIdle, FacialIdle, Pupil;
RestPose with contrapposto variants; the six objective critic gates.

Every defect this session was found by adversarial verification or visual judgement, never by
the agent that wrote the code. That pattern is documented in LEARNINGS.md Part 4 and should
continue.
