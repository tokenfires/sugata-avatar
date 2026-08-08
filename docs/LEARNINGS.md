# Learnings

Hard-won knowledge that is not obvious from the code and would be expensive to rediscover.
Written for a successor with no memory of the sessions that produced it.

Two kinds here: **how to verify things** (which has repeatedly been the difference between
working and merely appearing to work) and **specific technical traps**.

---

## Part 1 — Verification lessons, in order of how much they cost

### 1.1 A gate that has never failed is not known to work

Every gate must be **sanity-checked in both directions** before it is trusted: run it against
known-bad input and confirm it *fails*, naming the defect.

Worked example. `verify_glb.mjs` passed on five figures for two full phases. It asserted morph
names on the body mesh only. Meanwhile **five of six meshes were unskinned** and **all six
materials exported `alphaMode: BLEND`** — the face came apart the moment a bone moved, and teeth
drew through closed lips. Both defects leave the body mesh perfect, so the gate stayed green
through both.

After the fix the gate was run against the *old* GLBs: `FAIL — 22 problem(s)`, naming each one.
That is the check that makes a gate trustworthy. Do it every time.

### 1.2 Structural correctness is not visual correctness

Phase 0's gate proved the morphs existed and were named correctly. It never proved the mesh
**renders correctly**. Those are different properties and only one was gated.

If an artifact will ultimately be judged by eye, **something must look at it**, early.

### 1.3 A metric a frozen image passes trivially is measuring nothing

The capture tool scored **perfectly byte-reproducible** while rendering a *still pose* — stopping
the frame loop had also stopped the skinning update, so the body froze while the eyes blinked and
the HUD animated. A still image is always perfectly reproducible.

Caught only by cross-checking rendered head yaw against the simulation's known 33.5°.

**Ask of any green metric: what would a degenerate input score here?**

### 1.4 The observation window is itself a gate parameter

Postural event rates are 0.5–1/min. A 20-second clip **structurally cannot contain** a weight
shift, a shoulder settle, or an arm swing. Two judges assessed "does this read as a person
waiting?" on a clip that excluded, by construction, the behaviours that most sell it.

Worse: the weight-shift relay was verified as *wiring* and never as *behaviour*, because it never
fired. **Before measuring a rate-limited behaviour, check the window is longer than the period.**

### 1.5 Adversarial verification pays for itself, but only if it re-executes

The pattern that works: **build → adversarial verify by execution → fix**. The verifier is
instructed to assume the claim is overstated, to re-run the commands rather than read the report,
and to specifically hunt fabricated benchmark numbers.

Findings that only re-execution caught:
- A "critical" vite alias that was **inert** (byte-identical bundle without it) *and* a landmine
  that would have hard-failed the first Phase 3 addon.
- A selftest gating `new Sway({weightShiftsEnabled: false})` — a configuration no consumer would
  construct. The default failed its own gate on **9 of 9** runs with the anisotropy inverted.
- One fabricated corroboration: `jawOpen` "moves 2,543 vertices, exactly the research figure."
  It moves 2,239. The 2,543 is pre-helper-removal. The agent reached for a number to confirm a
  result rather than measuring it.

**Verifiers found zero invented constants in code, but several in prose.** Numbers in commentary
get less scrutiny than numbers in expressions. Check the comments.

### 1.6 Root causes are often in the dependency, not in our code

Two of the worst bugs were in how a library behaves, and no amount of staring at our code would
have found either:
- MPFB2's `add_mhclo_asset` only rigs an asset **when a skeleton already exists**; otherwise it
  silently parents without an armature modifier. Our pipeline attaches face parts *before* the
  rig by design, so everything took the unrigged branch.
- Blender 5.2 **no longer uses `blend_method`** for glTF export. The exporter reads the Principled
  BSDF alpha socket directly, and MPFB wires an alpha map into it unconditionally.

**When behaviour is inexplicable, read the dependency's source.** Both were found that way.

### 1.7 Check the frame of reference before tuning

Sway's anisotropy inverted as the window grew. It was not a tuning error: Duarte's weight-shift
amplitudes are **centre-of-pressure**, and the layer realised them 1:1 as **head excursion**.

**A published number carries a frame of reference. Ask what it was measured on.**

Three sharper corollaries, each of which cost a round:

**1.7a — Identifying the right inequality and then applying it backwards.** The fix for the above
was a coefficient, `POSTURE_HEAD_TRANSFER = 0.20`, justified by "a body swaying as a near-rigid
inverted pendulum moves its head *at least as far as* its centre of pressure." That inequality is
true. The file then set head excursion **equal** to the published COP figure — which under-moves
the head by exactly the lever ratio the sentence had just identified. Measured on this rig: 1.65.
Writing the reasoning down was not enough to stop the code contradicting it.

**1.7b — Two literatures measured under different protocols must not share one gate.** Quijoux's
3.0/4.9 mm is a **60 s quiet-standing trial** with the instruction "stand as still as possible."
Duarte's weight shifts have a 199 s interval — longer than that whole trial, so they are absent
from Quijoux's data *by construction*. Gating a trace containing both processes against the
quiet-standing RMS is a category error, and it was silently "fixed" by scaling the shift process
down 8× until it fitted. The right shape is one gate per regime, on separable signals. Bates et
al. 2021 supplies the composite number (15 min unconstrained: 16.87 mm ML, 16.32 mm AP) — and
independently confirms the anisotropy **inverts** in that regime, which is the very symptom the
8× fudge had been suppressing.

**1.7c — A distribution is a frame of reference too.** Duarte reports the ML shift as 22 ± 38 mm.
Read as a gaussian and folded to keep it positive, that draws a **mean of 35 mm** — 60% larger
than the paper says. When a reported SD exceeds its mean on a strictly positive quantity, the
distribution is *skewed*, not merely wide; a lognormal matched on both moments is the honest
reading. The layer's own selftest had been printing `relayed |magnitude| mean 1.59` against a
distribution whose *shifts* should average 1.0, and nobody read it as a defect because it was in a
`....` note rather than a gate. (The pooled relay stream now averages 0.60, because fidgets relay
too and carry half amplitude — so the gate had to be stated per pattern to mean anything.)

### 1.7d Two axes can need two mechanisms — and a citation can answer a question it was not asked

`Sway` modelled BOTH axes as an inverted pendulum about the ankles. That is right fore-and-aft and
wrong side to side: medio-laterally, with the feet apart, the ankle has almost no lateral authority
and the body uses **hip load/unload**. Winter et al. 1996 says so in its title — *"Unified theory
regarding A/P and M/L balance in quiet stance"* — and every measured gate in the repo passed anyway,
because they all gated *amplitude* and the defect was in *distribution with height*.

A visual judge named it in one sentence and proved it in three numbers: left-leg tilt against
right-leg tilt r = 0.94, hip against neck r = 0.95, lateral displacement proportional to height
above the ankle. **Nothing in the repo was measuring a correlation between two body parts.** Consider
adding one wherever a layer claims a body is articulated rather than rigid.

🚩 And the part worth wincing at: the adversarial verifier had cited Winter 1996 to me earlier in
the same session — as a supporting mechanism note under a *different* claim, about how the centre
of pressure moves between the feet. It was read as corroboration and moved past. **A source
delivered in support of one claim can be the answer to a different one; when a verifier hands you a
paper, read what it is about, not only the sentence it was quoted for.**

### 1.7e A gate can encode the defect it was written to catch

`sway.selftest.mjs` asserted head > pelvis > knee > ankle on the **3D resultant** excursion of the
shipped layer, called it the inverted pendulum's signature, and passed for two rounds. Medio-
laterally that ordering **is** the defect a visual judge reported as "the head travels 1.34× the
hip" — the hip strategy exists precisely so the pelvis leads. The claim was true only on the axis
the pendulum governs.

When a model has **two mechanisms on two axes**, check which axis each gate is entitled to speak
for. A gate stated on the resultant silently asserts the same mechanism on both. The fix here was
to split it: a path-length ordering on the shipped layer, plus an **antero-posterior** height
ordering measured where the pendulum runs alone. `headLeverMetres()` had the same disease — it
averaged the two axes and so scaled every pendulum prediction by 0.73.

### 1.7f A judge's measurement and the simulation's can both be honest and still disagree

Check which one the defect lives in **before fixing either**. A blind visual judge reported one arm
**2.5× livelier** than the other over seven minutes. Measured in the rig over 12 seeds × 6 channels
× 2 windows, on the stack `alive.js` actually builds and in the relaxed-standing pose, the worst
left/right energy ratio anywhere is **1.171** (300 s) / 1.125 (900 s); reconstructing the page's own
camera, hand screen-space RMS scores 0.96–1.02. Seed offset, joint-limit proximity, degenerate
co-prime phase and baked handedness are all ruled out by that number.

The judge measured **pixels**, and pixels carry occlusion and framing: at `alive.js`'s 12° camera
azimuth, with the pose adducting the left arm 1.5° more than the right, the right arm is the
farther and more torso-occluded of the two, and a per-region pixel statistic scores it lower for
reasons unrelated to how it is driven. The gate that resulted (ratio bounded at 1.40, proven red at
2.45–3.04) is still worth having — but it was built as a **guarantee, not as a fix**, and the round
would have been wasted if the reported magnitude had been taken as a target to tune toward.

### 1.8 Conceptual model errors look like missing features

The lower body had **exactly 0.0000 mm** of motion over 600 frames. `Sway` declared only spine,
chest and neck — postural sway was modelled as a **spine bend**. Real quiet stance is an
**inverted pendulum about the ankles**; the whole body leans and the spine barely participates.

The fix is not "add leg bones," it is re-rooting the model so head excursion becomes an *output*.
The distinction matters: bolting on legs would have kept the wrong physics.

### 1.9 Judges must state what they could not observe

The best judgements in this project ended with an explicit limits statement — *"I have not watched
this thing animate in real time with my own eyes; I have watched it frame by frame and measured
it."* That honesty is what let the next round fix the **instrument** rather than the symptom.

**Require it. A judge that only reports findings is hiding its blind spots.**

### 1.10 The per-pixel temporal-σ heat map is the single best motion diagnostic

Accumulate per-pixel variance across a clip and render it. The dead lower body showed as a hard
horizontal cut at the hip line, unmissable, in one image. Generate one for every motion gate.

It is now a tool — `tools/critic/heatmap.mjs`, with band statistics that turn "the lower body is
dead" into a number. Two cautions from its own selftest: use a **monotonic** ramp (a rainbow
reverses apparent ordering — the selftest asserts this by failing a rainbow), and pin
`--normalise` when comparing two clips, because `auto` picks p99.9 of moving pixels and silhouette
edges against a dark backdrop swing nearly the full code range.

### 1.10a Temporal σ says WHETHER a region moves. It does not say HOW FAR.

The heat map saturates. Its σ is dominated by silhouette-edge pixels that already swing nearly the
full 8-bit code range, so more motion cannot raise them. Measured on two captures of the same seed
and framing, before and after a change that moved the lower body ~40% further: the head band's mean
σ rose **1.5%** while the head's actual on-screen travel rose **12%**, and the lower bands rose
34–38% in σ against 40–48% in travel. Use σ to find dead regions; use `tools/critic/travel.mjs` —
the horizontal centroid of the silhouette, in pixels — to answer "would a viewer see this."

That distinction is what PROGRESS's failing diagnosis was actually about: "1.6 pixels at full-body
framing" is a travel measurement, and no amount of variance analysis produces it.

### 1.10b An amplitude stated in a unit nobody can picture will pass every review it is given

The finger idle was authored as **0.45° of peak knuckle deviation**. That sounds reasonable, it was
reviewed as reasonable, and it measures **0.48 px of fingertip travel** at full-body framing over
seven minutes — under a third of the 1.6 px this project already had on record as indistinguishable
(§1.10a). The layer was not switched off. The amplitude was simply never converted into the
quantity the defect is about.

**State motion amplitudes in the unit the defect will be judged in, or convert them inside the
gate.** The articulation gate for the hands is therefore stated in pixels at a named framing, and
the conversion (1200 px over a 1825.4 mm frame = 0.6574 px/mm) is printed beside the result.

### 1.11 A single scalar check may be structurally unable to catch the error you built it for

`BodyMass`'s whole-body centre of mass was checked against Winter's 0.553 of stature. Resolving
the trunk's distal landmark to a chest bone instead of the shoulder joint moves the centre of mass
**60 mm** — and moves it from 0.015 *above* Winter's figure to 0.021 *below* it. Any tolerance wide
enough to admit the correct answer admits the wrong one. No amount of tightening fixes that; the
two answers straddle the target.

What fixes it is a check of a **different kind**: segment *length*. Winter puts the shoulder at
0.818 of stature and the hip at 0.530, so the trunk spans 0.288 — and a chest bone halves it. The
right response to "my gate cannot catch this" is a structurally different assertion, not a tuned
threshold. Record in the gate, as a gate, that the first check does **not** catch it; otherwise
someone later assumes it does.

### 1.11a A justification can be correct about the wrong quantity

`STANCE_RESPONSE_PROBE_BLEND` measured the contrapposto once and scaled it linearly. Its comment
justified that with a real measurement — the *centre-of-mass* response varies 0.3% across the whole
blend range, and a later loop-closure gate confirmed it at 0.996–1.016. Both true. Neither covers
the **ankle**, which rides an arc because the poses differ at the hip by tens of degrees and are
combined by slerp. When the blend cap went from 0.20 to 1.0 the ankle linearisation error reached
2 mm of vertical — a foot leaving the floor, failing the planting gate by 40×.

**A cited measurement in a comment is not automatically a measurement of the thing the comment is
about.** Check which quantity the evidence covers, not just that evidence exists.

### 1.11b A constant that was cheap can stop being cheap when a scale changes

`PIVOT_HEIGHT_FRACTION_OF_ANKLE = 0.5` was a deliberate, well-argued idealisation: the true centre
of rotation sits a little below the malleolus because the heel pad compresses, and the honest
midpoint cost the sole a tenth of a millimetre of slide. Correct, and invisible.

Then the re-rooting multiplied the lean by six. The sole sits 29 mm below a half-way pivot, so it
slides by 29 mm × the lean — measured worst case **2.49 mm**, a foot visibly skating. Moving the
pivot to the ankle joint took it to 0.16 mm. **A sub-millimetre truth is not worth a 2.5 mm lie.**

When an amplitude changes by an order of magnitude, re-audit every constant whose cost was
previously argued as negligible. The argument was about the old amplitude.

### 1.11c Ask whether the ASSET can support the technique before writing the technique

Punch-list 3.3 was "the best effort-to-impact ratio in the whole project: ~40 lines of TSL". A spike
against the actual eyeball mesh found **6 of 8 geometry clauses failing**, one of them fatally:
there is no corneal dome to refract through. Front-versus-equator bulge 0.051 mm against 0.158 mm
of tessellation noise, and the apex is a flat octagonal facet recessed 0.131 mm *inside* the
sphere — a dimple exactly where the pupil is.

The 40 lines would have run. They would have produced roughly half the corneal power and an
octagonal catchlight. **A shader that runs is not a shader that delivers**, and an item chosen for
its effort-to-impact ratio is exactly the one where a silently halved impact goes unnoticed.

The spike cost a fraction of the shader and produced a scoped asset fix instead of a disappointment.
Do this for every technique whose research doc states a geometry contract.

⚠️ **Read the half-power argument narrowly, because a later note read it broadly and inverted a
sign.** Corneal power is `(n − 1) / R` of the **cornea's own anterior surface**. On the low-poly
proxy the front surface *was* the globe — a single shell, measured on `eyes/low-poly/low-poly.obj`
at R **14.955 mm** with a fit RMS of 0.0018 mm, so 25.14 D against a human 48.2–48.8 D — which is
why quoting the globe radius was legitimate **there and only there**. The moment the high-poly
asset arrived with a real dome, the globe stopped being the refracting surface: the cornea's own
front cap fits R **6.91–7.64 mm** across the sweep, *steeper* than a human 7.7–7.8 mm.

A note in PROGRESS nevertheless carried the "under-strength" conclusion onto the new asset, and
justified it with the anterior chamber depth and the globe radius — **two quantities that do not
appear in the formula at all**. Nothing caught it, because no gate and no doc anywhere recorded the
corneal radius of curvature: the whole discussion was being conducted in proxies for the one number
that decides the answer. `docs/eye-optics-claims.selftest.mjs` now measures it and asserts the docs
agree with the measurement.

**Two transferable shapes.** First, same disease as §1.11a — a justification that cites real
measurements of the wrong quantity. Second, and worse: **when the asset changes, re-derive the
conclusion; do not re-word it.** A sentence that was true of the old asset will survive the rewrite
looking exactly as authoritative as one that was checked.

### 1.11d A test can be right about the question and wrong about the noise

The eye spike asked exactly the right question — *is there a corneal dome?* — and answered it by
comparing the front-cap bulge against the residual of a sphere fitted to **the whole shell**. That
buries the dome in its own residual: the reference surface is fitted through the very feature being
measured. On the high-poly cornea it reported 0.494 mm of bulge against 0.958 mm of "noise" and
concluded *no dome*, on an asset that has one.

Fitting the reference sphere to the **sclera band alone** — where the feature is absent by
construction — separates the two real assets by **46×** where the old form managed 10×, with the
threshold between the wrong pair: +0.688 mm proud against 0.202 mm of noise on the high-poly
cornea, −0.015 mm against 0.191 mm on the low-poly globe.

Same shape as §1.11 (a gate that structurally cannot resolve the thing it is aimed at), and it cost
a real detour: the asset was nearly rejected on the strength of the instrument. **Fit your
reference where the feature you are hunting is not.**

### 1.11e Six gates can be green on a plate whose single worst feature is unmissable

At portrait framing the eyelash and eyebrow cards rendered as **saturated royal-blue spikes** —
the most visually wrong thing in the frame by a distance — and G1, G2, G4, G5 and G6 all read
green through three review rounds. Not one of them was wrong. Between them they sample a patch of
cheek, a patch of sclera, a patch of terminator and two whole-image percentiles, and they make **no
assertion about colour anywhere else in the picture**. A near-black surface reflecting a saturated
rim at full Fresnel is invisible to every one of them by construction, which is §1.11 exactly: the
right response to "my gates cannot catch this" is a structurally different assertion.

That assertion is **G7** — a per-pixel *outlier count* over a hand-drawn band, not a mean or a
ratio between two patches, because a mean over a patch containing both black cards and bright skin
cannot resolve the defect at all. Measured on `alive.html?freeze&bare` at 900×1200, re-run
2026-08-08: shipped **0.0056%** of the band against **0.7571%** with `?cards=0`, a **135×**
separation on the identical rects.

Three details in G7's construction are each worth more than the gate:

- **It counts chroma (max−min), not HSV saturation.** Saturation is chroma/value, so a *dimmer*
  blue scores *higher*. Across the card specular sweep the saturation form went 1.0 → 2.866%,
  0.5 → 3.197%, 0.35 → 3.208%, 0.0 → 0.101% — it **peaks in the middle of a monotonically
  improving sequence**, so a threshold on it would have called the half-fixed render worse than
  the broken one. The chroma form is monotone: 1.879 / 1.279 / 0.925 / 0.589%.
- **The value ceiling is derived, not chosen.** The spec's socket sample `#352327` is 0.354× its
  own cheek reference; on this page the cheek measures value 0.851, so 0.35 is the reference band
  with ~16% headroom. Dropping the qualifier costs an order of magnitude of separation (38× → 2.9×).
- **`?cards=0` is the known-bad, and it is a URL parameter rather than a committed plate.** That is
  the cheapest form a rejection proof can take, and it is re-runnable by anyone.

⚠️ **And a sentence in PROGRESS inverted the physics of the very defect the fix was built from.**
It said the cards "carry a white `MeshStandardMaterial`". The *factor* is `[1,1,1,1]`, which is
what made the sentence survive — but the material carries a **base-colour texture**, and measured
straight out of `figure_g050.glb` at the GLB's own `alphaCutoff` 0.5 the opaque texels average sRGB
**(0.0327, 0.0118, 0.0039)**, i.e. **0.0025 linear**. Near-black, not white. The distinction is the
whole mechanism: a white albedo would give a strong diffuse that *dilutes* the Fresnel term, and it
is precisely because there is **no diffuse to dilute** that the rendered pixel was 100% the rim's
own colour. A fix brief was written from that sentence. See §1.11a — a justification can cite real
measurements of the wrong quantity — with the extra twist that here it cited the right quantity's
*factor* and missed its *texture*.

### 1.13 A stochastic layer advanced once per FRAME has a trajectory that depends on the frame rate, and no rate, amplitude or spectral gate can see it

`Signals.poissonEventOccurs(rate, dt)` uses the exact probability `1 − exp(−rate·dt)`, so the
long-run event rate is correct at 30, 60 and 120 Hz — and it consumes **one random draw per
frame**, so the whole realisation moves. Measured on `Sway` before the fix: **120.1 / 240.1 /
480.1 draws per second** at the three rates, and at seed 1 over 900 s the stance blend spanned
−0.771 at 30 Hz against −0.990 at 60 Hz, **never completing the weight transfer at the rate the
judge's capture actually renders**. The free-foot gate had therefore been proving a property of a
trajectory no camera has ever seen. Worst bone divergence between two traces of the same seed:
49.4 mm (Sway), 12.4 mm (BodyIdle).

Every rate, amplitude and spectral gate in the repo stayed green through all of it, because the
rate *was* right.

The fix is one interval drawn per **event**, on a stream forked per process, with the frame cut at
the arrival so an event's shape starts at the instant it was drawn for. In-flight events must be
aged BEFORE new arrivals fire — that ordering alone was worth 0.48 mm in `BodyIdle`. The gate is
the same seed at three frame rates compared frame for frame: now 0.001 mm, and proven red by a
`frameCoupledArrivals: true` reintroduction at **2859×** the tolerance (Sway) and **962×**
(BodyIdle). Both selftests also assert that a rate gate and an amplitude gate respectively would
**not** have caught it.

This is §1.3 one level down: the question is not only what a degenerate **input** would score, but
what a different **observer** would. `Signals.poissonEventOccurs` now carries a 🚩 at its
definition, and three layers still have the defect — see punch-list 2.11. ⚠️ Three was the
wrong count; see §1.13a.

### 1.13a An audit that searches for a MECHANISM will find every instance of that mechanism and no instance of the defect

§1.13's fix came with a diagnostic: instrument `MotionRandom.next` and look for a draws-per-second
that scales with the frame rate. It worked — it found `Gaze`, `FacialIdle` and `HandIdle`, and
punch-list 2.11 was written as "the three remaining frame-coupled layers."

**`Blink` was the fourth, and the instrument was structurally unable to see it.** It never called
`poissonEventOccurs`; it drew ONE interval per blink, so its draw rate is flat by construction —
measured **2.3 / 2.3 / 2.3 draws per second at 30 / 60 / 120 Hz**, sitting in the same table as
`Sway`'s pre-fix 120.1 / 240.1 / 480.1 and looking exactly like a converted layer. It was frame-
coupled anyway, through a different mechanism entirely: it counted the interval down against `dt`
and re-armed with `= interval`, **throwing away the negative overshoot**, so every interval was
rounded up to the next whole frame.

The arithmetic is not subtle once stated. A countdown that fires on the first frame at or past zero
realises `ceil(interval / dt) * dt`, adding a mean of `dt/2` per interval: 16.67 ms at 30 Hz against
4.17 ms at 120 Hz, so **12.50 ms of predicted drift per blink**. Measured 12.70 ms (seed 1, 600 s)
and 12.59 ms (seed 20260807) — and confirmed a second way, by differencing the mean REALISED
interval against the mean SAMPLED one at four rates: 29.68 / 21.03 / 16.66 / 13.32 ms at
30 / 60 / 120 / 480 Hz, whose differences from the 480 Hz floor are 16.36 / 7.71 / 3.34 against a
`dt/2` of 16.67 / 8.33 / 4.17.

Over 600 s at seed 1 that is **2.6167 s** of accumulated drift, and the visible consequence is
total: comparing the 30 Hz and 120 Hz runs at the instants they SHARE, the worst disagreement in
eyelid closure is **1.000000** — one frame rate has the eye fully shut where the other has it fully
open. Every one of `ocular.selftest.mjs`'s 51 checks stayed green through all of it.

Three transferable shapes, and the first is the expensive one:

**Audit for the SYMPTOM, not for the mechanism.** The symptom is "the same seed at two frame rates
produces two different trajectories," and it is one gate that any layer can be pointed at. The
mechanism is whatever this month's instance happens to be. Written as a grep, the second
mechanism is `grep -rn -- '-= deltaSeconds' packages/core/src/motion/*.js`; there is no reason to
believe there is not a third.

**A number that is right for the wrong reason reads exactly like a number that is right.** Blink's
flat draw rate was genuine evidence of one thing and was read as evidence of another. Same family
as §1.11a — a real measurement of the wrong quantity — but running through an *audit* rather than
through a comment, which is worse, because an audit's output is a list of what is left to do.

**A deliberate sampling correction is not a licence to make the timeline frame-dependent.** Blink
snaps a frame that would step over full closure back to the instant of closure — Trutoiu: a blink
that never renders shut reads as wrong, and at 30 fps a partial blink's closed window is zero
seconds wide. The old code wrote that snap into `elapsed`, which delayed everything after it in the
blink and made the rest of the trajectory depend on `dt`. Applying it to the reported SAMPLE
instead keeps the guarantee and costs nothing: the two rates now agree to **3.2e-11** of aperture
at every shared instant except the 0.43% of frames where one needed the snap and the other did
not, and those are bounded by one frame of upphase (0.264 measured against a derived 0.347).
**Ask of any correction whether it belongs to the model or to the observer.**

### 1.14 A floor and a measurement must be the same KIND of statistic

This project's 1.6 px indistinguishability floor is a **peak-to-peak** between two plates ("a
weight shift moves the body ~4.5 mm ML — 1.6 pixels at full-body framing; side-by-side plates
before and after a shift are indistinguishable"). A re-verifier compared it against **standard
deviations** from `travel.mjs` and concluded the lower body was dead.

On the same 12,600 frames the peak-to-peak is **10–12× the SD**, so the comparison was out by an
order of magnitude. Measured in the matching statistic — median travel inside a sliding 15 s
window — the knee band scores **6.40 px**, four times the floor, and only the ankle band is
marginal at **2.01 px**, falling to 1.06 px in the quietest tenth of windows. The defect was real;
its size and its location were both wrong.

Same family as §1.10b (an amplitude stated in a unit nobody can picture) but running the other
way: here the number was in the right *unit* and the wrong *statistic*, which is harder to spot
because both sides say "pixels". **State the statistic beside the number, always.** When a tool
reports SDs and your threshold is a displacement, one of the two has to change.

### 1.14a 🎯 …and the floor itself was never measured. Read this before citing 1.6 px again.

§1.14 is right about the *statistic* and wrong to have treated the *number* as data. Audited
2026-08-08, three findings, in order of how much they matter.

**1. Its source is a block this repository marks superseded.** `sway.selftest.mjs:632` calls 1.6 px
"the one empirical datum this project owns on the subject" and cites `docs/PROGRESS.md:550-552`.
Those lines sit **five lines below** PROGRESS's own `⚠️ **The diagnosis below is superseded**`
marker — the block kept verbatim as the record of a *wrong* diagnosis, in which
`POSTURE_HEAD_TRANSFER = 0.20` was out by 8.3×. Everything else in that block has been retracted.
The floor was quoted out of it and nothing noticed.

**2. Its two halves do not reconcile, by 1.85×.** The sentence gives a displacement *and* a pixel
figure, so it can be checked against itself. At the framing constant `idle-motion.selftest.mjs`
prints — 1200 px over a 1825.4 mm frame, **0.6574 px/mm** — 4.5 mm is **2.958 px**, not 1.6. Turned
around, 1.6 px is 2.43 mm, not 4.5. (`Gaze.selftest.mjs` prints 1793.6 mm / **0.6691 px/mm** for the
same framing, which moves the answer to 3.011 px and is a second, smaller inconsistency worth
fixing.) Whichever half is right, the pair cannot both be, and no archived plates exist to arbitrate.

**3. It is not a measurement of a threshold in the first place.** "Side-by-side plates … are
indistinguishable" is one agent looking at two stills it did not keep. That is an *observation
below threshold*, which bounds the threshold from one side and does not locate it.

#### What this project actually owns, in one named statistic

**The statistic is: peak-to-peak displacement, in pixels, at the full-body capture framing
(1200 px tall, `BODY_FRAME_MARGIN` 1.10, camera azimuth 12°), inside a stated observation window.**
Every number below is that. Two flavours of it exist and they are not interchangeable — a projected
3D landmark (`idle-motion`, `sway`, `Gaze` selftests) and a silhouette-band centroid
(`travel.mjs`) — so say which.

Two anchors, both from **blind visual judges**, both with provenance, and they bracket the
threshold rather than locating it:

| | measured | the judge said |
|---|---|---|
| **below threshold** | fingertip travel **0.48 px** p2p over 7 min | *"the hands never move"* (finding 6) |
| **above threshold** | median legible postural event **16.1 mm** of pelvis excursion = **10.6 px** against a 3.7 mm background | counted 3 sustained posture changes in 7 min |

**So the honest statement is a bracket, 0.48 px to 10.6 px — a factor of 22 — and 1.6 px is a
point inside it with no measurement behind it.** Citing 1.6 px is not *contradicted* by anything
this project owns. It is also not *supported* by anything. Gates that rest on it
(`FREE_FOOT_TRAVEL_FLOOR_PIXELS = 3.0`, `SILHOUETTE_WIDTH_FLOOR_PIXELS = 1.6`,
`FINGERTIP_TRAVEL_FLOOR_PIXELS`, every GLANCE LEGIBILITY band) should say **"inside the 0.48–10.6 px
bracket, nearer the invisible end"** rather than "above the measured floor", because the second
sentence is false.

One further anchor exists in a different unit and should not be converted into this one:
`sway.selftest.mjs`'s `JUDGE_DETECTION_MULTIPLE = 5.5` — events exceeding 5.5× the balance band's
pelvis RMS occur at 0.51/min against a judge's counted 0.43/min. That is a genuine calibration,
in **multiples of the background**, and it is already correctly reported rather than gated.

#### What would actually measure it

A two-alternative forced-choice staircase, which is ~20 captures and one afternoon:

1. `alive.html` gains a `?nudge=<mm>` that offsets the figure laterally by a commanded amount at
   `?freeze` (**diff request — not this agent's file**). It must move the *body*, not the camera.
2. Capture a pair of plates per rung — 0 mm and *d* mm — at a geometric ladder,
   d ∈ {0.5, 0.75, 1.1, 1.7, 2.5, 3.8, 5.6, 8.4} mm, i.e. **0.33–5.5 px**, straddling the bracket.
3. Blind each pair through `blind_ab.mjs` and interleave a **catch trial** at d = 0, so a judge
   that always says "different" is detected.
4. Ask one same/different question per pair, several judges, randomised order. The **75%-correct
   point** is the threshold, in the named statistic, at the named framing.
5. Write the answer in **one** place and make every gate cite that place.

Until that runs, the bracket above is the whole of what is known, and the correct thing for a gate
comment to say is *"there is no measured visibility threshold for this framing; the nearest
evidence is a 0.48–10.6 px bracket from two blind-judge observations."*

### 1.1a A rejection proof measured on a narrower sample than the gate it proves is not a proof of that gate

§1.1 says a gate that has never failed is not known to work. This is the sharper version: a gate
that has failed **once**, on one draw of a stochastic process, is also not known to work — and the
failure is invisible, because the assertion reads green.

Three of `sway.selftest.mjs`'s known-bad rejections were stated on **one seed** while the forward
gates they prove run over **twelve**, and two of them silently stopped rejecting the moment an
unrelated fix re-drew the arrival times. The unrighted-layer correlation SIGN rejection caught the
defect on **6 of 12 seeds** — a coin toss that had passed for a proof. The pre-fix fidget profile's
legible-rate rejection never worked at all: over three seeds the old code scores 0.810/min against
a 0.75 floor.

Run a rejection over the same seed set as the gate, and assert the **count** of seeds caught rather
than the single verdict.

### 1.15 A bug can cancel out of the very comparison built to find it

The skin material's area-light path divided by `max(saturate(N·L), 1/6)`. At zero curvature the
pre-integrated table returns *exactly* `saturate(N·L)`, so that gain must be exactly 1 and the
material must be bit-identical to stock diffuse — a **one-sided** floor breaks that identity
precisely across the terminator band, and it multiplied the diffuse there by **0.023**.

Because it applied equally to BOTH plates of the A/B pair, the difference image stayed clean and
the defect was invisible in the instrument built to detect it. It was caught by asking a different
question: *why is the shadow side grey?*

Put the epsilon on both sides of a ratio whose identity case matters, and check the identity
**algebraically** rather than by differencing.

### 1.16 A transform read from the CURRENT pose is not the bind transform, and on an unposed test figure the two are indistinguishable

`EyeOcclusion.placeOnHead` composed the eye's **bind object-space** frame against
`head.matrixWorld` — the head bone's transform in whatever pose the figure happens to be standing
in. Its own doc comment said the right thing ("the head bone's own bind transform is the inverse of
its stored `boneInverse`") and the code did something else, which is §1.7a again: writing the
reasoning down did not stop the code contradicting it.

It passed every check on its own browsercheck page, because that page never poses the figure. On
`alive.js`, which applies `relaxed-standing` before any material is built, **both occlusion sheets
landed 29.3 mm to the character's left of their own eyes** — head-local x +0.0582 and +0.0004
against a bind-correct ±0.0289 — putting one of them on the temple as a visible grey quad. The
fix reads `skeleton.boneInverses[headIndex]`, which is pose-independent by construction.

Two transferable shapes. **A component verified only on its own page has been verified in one
pose**; the integrator's page is where a bind-vs-current confusion first shows. And when two
things should mirror, **assert the mirror**: ±0.0289 against +0.0582/+0.0004 is a one-line check
that no amount of looking at a single eye would have produced.

### 1.17 A page that animates cannot be gated by a fixed region file

Measuring the integrated `alive.html` at `?preroll=6` put the head at **35.8° of gaze yaw**, and
the committed portrait region set — authored against the same framing constants on a static page —
then sampled a different anatomy: `shadowTerminator` landed on the **backdrop** (#1E1F2C) and G1
read 1.83 where the rest pose reads 1.58. Two region sets both honestly authored disagreed by
0.6 of ratio, and neither was wrong about its own plate.

**Pin the motion state before measuring a still.** `?freeze` with no pre-roll puts the figure in
its rest pose, which is the state the region files were authored against and the only one two
pages can share. If a gate must be measured mid-motion, derive the rects from projected landmarks
in the same frame — but then say so, because the numbers are not comparable to the static ones.

### 1.18 Every check in a file can be about the same KIND of quantity, and the defect lives in the other kind

`Gaze.selftest.mjs` had 88 checks and every one of them was about an **orientation** — yaw, pitch,
roll, gain, latency, main-sequence velocity. The head joint sits **47.0 mm in front of `neck_01`**
(measured, printed by the selftest), so yawing the neck about the *room's* vertical carried the
skull through an arc of that radius: **9.22 mm SD** of lateral head slide on the shipped stack. Not
one of the 88 checks could see it, because a slide is a **distance** and they were all angles.

The consequence was not local. That slide *was* the residue `travel.mjs` had been reporting as "the
head out-travels the hip" on every timescale shorter than two minutes, and PROGRESS recorded the
cause as a **roll** contribution from `gaze.head` and carried it for two rounds as a live open lead
with two proposed fixes. It is not roll: head world roll measures **0.661° SD**, worth 1.2 mm over a
108 mm neck, and the observed slide is **7.4×** that. The mechanism was yaw acting through a lever
nobody had measured, and `neckShare = 0.5` — argued as "the smoothest curve two joints can make" —
was silently setting it.

Fixed by rotating the neck's share about the **cervical column** (measured at bind from the rig's
own two joints, so a different figure gets a different axis) rather than about world vertical,
which puts the head joint *on* the axis where a rotation cannot translate it. Re-measured
2026-08-08 by running the file:

```
unattended 300 s, column    head lateral 0.16 mm SD = 0.11 px,  head yaw 21.04° SD
unattended 300 s, vertical  head lateral 8.52 mm SD = 5.70 px,  head yaw 21.04° SD
```

**The head turns exactly as far as it did. It just stopped sliding.** The gate that resulted states
a DISTANCE, in millimetres and in pixels at the named framing, and is proven red four ways.

Three transferable shapes:

- **Audit a gate file by the kind of quantity it asserts, not by how many assertions it has.** 88
  checks of one kind is one check. Ask what quantity a defect would show up in and search for it:
  `grep -c 'mm\|metres\|px' <file>.selftest.mjs` returning zero on a file about a moving body is
  the whole finding.
- **A recorded diagnosis is not a finding until something re-measures it.** "It is a roll
  contribution" sat in PROGRESS's *Known open leads* looking exactly as authoritative as the
  measured entries around it, and two proposed fixes were designed against it. A lead should carry
  the command that produced it or be marked as a hypothesis.
- **When a joint is offset from the axis you rotate it about, you have built a lever.** Nothing in
  the repo was measuring the distance between two joints, so nothing could price one.

### 1.19 Two toggles are worth more than one argument, and `?cards=0` is the cheapest gate in the repo

`alive.html` now takes `?skin=0 ?eyes=0 ?eyeocc=0 ?cards=0 ?msaa=0 ?shadows=0 ?freeze ?gender= ?ov=`.
Each is one line and each turns a claim into an attribution. Worked examples, all on
`?bare&freeze` at 900×1200 and all reproducible in a minute:

| question | the toggle | the answer |
|---|---|---|
| is the blue-lash defect the rig or the asset? | `?cards=0` | G7 0.0056% → **0.7571%**. The cards. |
| is the capture non-determinism the MSAA resolve? | `?cards=0`, `?msaa=0` | cards: **30/30 frames bit-identical**; msaa: 29/30 at Δ1. Alpha-to-coverage on the cards. |
| does the eye shader carry G2? | `?eyes=0` **with `?eyeocc=0` held fixed** | luma 0.8815 → **0.9203**, saturation 0.7479 → **1.3355**. The shader helps on both halves. Re-measured 2026-08-08 at build `c70195c`. |
| does the skin shader carry G4? | `?skin=0` | 1.6468 → **0.4345**. Yes, 3.8×. |

🚩 **THE EYE ROW USED TO SAY THE OPPOSITE, AND ITS TOGGLE WAS COMPOUND.** It read *"shipped 0.8127,
shipped GLB eyes 0.8746 — the shader makes it worse, not better"*, and that row was carried as the
worked example of why toggles beat arguments. `alive.js` returned before **both** `new EyeMaterial()`
and `buildEyeOcclusion()`, so `?eyes=0` removed the four occlusion/lacrimal meshes as well as the
shader, and every number ever attributed to it is a **sum over two subsystems that pull opposite
ways**. Hiding the occlusion sheet alone moves the sclera rect from encoded luma **0.7240 → 0.7433**
and saturation **0.2527 → 0.2381** — about 40% of the effect, in the other direction.

Isolated, four states from one page load of `?bare&freeze&seed=1` at 900×1200 CSS, dpr 2:

| state | G2 luma | G2 saturation |
|---|---:|---:|
| shipped — material on, sheet on | **0.9203** | **1.3355** |
| `?eyeocc=0` — sheet off only | 0.9449 | 1.2585 |
| `?eyes=0` — material off only | 0.8815 | 0.7479 |
| both off — what `?eyes=0` used to render | 0.9086 | 0.7059 |

**A toggle is only an attribution if it moves ONE thing, and nothing in the repo was checking that.**
`window.sugata.subsystems()` now counts what is live off the scene graph and
`packages/testbed/src/alive-toggles.selftest.mjs` (16 checks) loads the page once per toggle and
fails if any of them moves a second subsystem. Same shape as §1.11a — a real measurement of the
wrong quantity — with the extra sting that the wrong quantity was produced by the very instrument
this section was written to recommend. **Add the toggle before writing the paragraph, and prove the
toggle is single-valued before believing it.**

### 1.19a 🎯 `?freeze` IS INERT UNDER `?capture`, so every "frozen" capture plate is a moving figure

Read this before quoting any still-plate number, and before concluding that two agents measuring the
same page disagree.

`alive.html` has two frame paths — §1.24's warning, one level deeper. The rAF path honours the flag:

```js
stage.onFrame( ( dt ) => { if ( frozen === false ) advanceSimulation( dt ); … } );
```

`window.__SUGATA_STEP__`, the clock `capture.mjs` drives, **does not**. It calls
`advanceSimulation( deltaSeconds )` unconditionally. So `?freeze&capture` is not frozen: it advances
1/fps of simulated time per captured frame, and the figure in "the frozen plate" has already started
moving. Proven three ways by execution on 2026-08-08, one un-watched vite, one browser:

1. **`?freeze` changes nothing on the capture path.** `?bare&freeze&capture&seed=1` and
   `?bare&capture&seed=1` produce **byte-identical PNGs** at 1, 4 and 30 steps (sha256
   `c20a73b7…`, `f8456e45…`, `d24fd825…` respectively), and both report head gaze yaw
   `0.8348870263049992` at step 1 — agreement to sixteen significant figures.
2. **`?capture` is ONLY a clock; the render path is identical.** Six steps at 60 fps under
   `?capture` is byte-identical to free-running `?freeze&preroll=0.1`, and two steps to
   `?freeze&preroll=0.0333`. So nothing about the deferred path, the MRT or the resolve differs —
   the whole discrepancy is simulated time.
3. **And it moves the gates a lot, because the head yaws.** Same seed, same build, `?bare&freeze&capture`
   at 900×1200 dpr 1, measured against the committed portrait regions:

| capture steps at 30 fps | head gaze yaw | G1 linear | G2 luma |
|---|---|---|---|
| 1 | 0.83° | 1.5976 | 0.7836 |
| 2 | 2.65° | 1.5074 | 0.3142 |
| 4 | 7.18° | 1.2106 | **0.2046** |
| 30 | −19.22° | **1.0657** | 0.9856 |
| free-running `?freeze`, 0 steps | 0.00° | 1.5962 | **0.9200** |

**Four consequences, and the first two settle open questions in this repo.**

- **The seed spread G2 is famous for is a property of the CAPTURE recipe, not of `?freeze`.**
  Free-running `?bare&freeze` at four seeds is **byte-identical** — one sha256, `a61bedad…`, for
  seeds 1 / 42 / 4242 / 20260807 — and reads G2 **0.9200 PASS** at all four. Under
  `?bare&freeze&capture` stepped one frame the same four seeds read **0.7836 / 0.9189 / 0.9292 /
  0.4390**. Both observations in PROGRESS were right and they were about different pages.
- **G1 was being measured on a face turning away.** At 4 steps it reads 1.2106 and at 30 it reads
  1.0657 — under the reference band, and now under G1's new floor. §1.17 said *pin the motion state
  before measuring a still*; this is the discovery that `?freeze` did not do that on the recipe most
  plates are taken with.
- **A still plate should be taken free-running with `?freeze` and NO `?capture`**, or with
  `?capture` and an explicitly stated step count, which is then part of the plate's identity in the
  same way its seed and its build digest are.
- **Filed as a diff request against `packages/testbed/src/alive.js`, not fixed here.** The one-line
  repair is `if ( frozen === false ) advanceSimulation( deltaSeconds );` inside
  `__SUGATA_STEP__` — but a capture of a frozen page is a clip of a still, so the honest fix is
  probably to make `?freeze&capture` an error rather than a silent contradiction.

> **Two frame paths mean two chances to disagree about a FLAG, not only about a draw call.** §1.24
> caught the second path skipping work; this is the second path ignoring a switch. Audit a flag the
> way §1.13a says to audit a defect: by its SYMPTOM — does the plate change when the flag changes? —
> on every path, not by reading the one place it is handled.

### 1.20 A clip is chosen for containing the behaviour, and the seed is a gate parameter

Every judgement in this repo before `capture.mjs --postural-seeds` was pinned to **seed 1**, which
contains **no sustained weight transfer at all** in 420 s — its first one opens at 483.0 s. Judges
were being asked "does this read as a person waiting?" about a clip that, by the draw, could not
contain the behaviour. That is §1.4 (the observation window is a gate parameter) with the window
replaced by the seed, and it is harder to see because a seed looks like a reproducibility choice
rather than a content choice.

**A pinned seed buys reproducibility, not representativeness.** The fix is three-part and all three
parts are needed: `--seed` takes a **list**, `capture.json` carries a `posturalContent` block saying
what the clip is known to contain, and `--require-weight-shift` **exits 1** rather than handing a
judge a clip that cannot show the thing. The nominated set is **4242, 42, 20260807 at 420 s**, and
`sway.selftest.mjs`'s CLIP CONTENT section re-measures every nomination on the shipped layer at
30 Hz and goes red if one stops being true — proven red by nominating seed 1, which turns 5 of the
12 assertions red.

⚠️ **And the same disease bit a still-plate gate in the same week.** G2's sclera rect is 11×6 px on
an eye ~40 px across, so a degree of head yaw walks it onto the iris. Re-measured **2026-08-08 at
build `c70195c`**, one captured frame, four seeds, nothing else changed:

```
node tools/critic/measure.mjs <plate> tools/critic/regions.lighting-portrait.json
recipe: /alive.html?bare&freeze&capture&seed=<n>, ONE step at 30 fps, 900×1200, dpr 1
G2 luma  0.7836 / 0.9189 / 0.9292 / 0.4390   at seeds 1 / 42 / 4242 / 20260807
```

A **2.1× spread**, one of four inside the luma band, and at 20260807 the rect has walked onto the
iris. Punch-list 3.3 was marked done on **one** of those draws.

⚠️ **Two corrections to the version of this paragraph that stood for two rounds, both by execution.**

1. **The numbers were stale.** It read `0.8127 / 0.9627 / 0.9736 / 0.4384`; those are a build from
   two rounds ago. The four above are today's. The *shape* of the finding survived a rebuild and
   the *values* did not, which is exactly what this file says everywhere else about plate numbers
   and did not do to its own.
2. **The mechanism was wrong, and the sentence "`?freeze` pins the pose but not the ocular or
   postural layers" is false.** `?freeze` pins everything — free-running, the four seeds are
   **byte-identical** and all read 0.9200. The spread comes from `?capture`, which ignores
   `?freeze` and advances the simulation one frame per captured frame, so the seed acts through a
   frame of motion. See §1.19a for the three-way proof. The finding is real; it belongs to the
   capture recipe, not to the freeze flag.

**A gate on a small rect over an animating figure is a gate on a distribution; state it as one —
and state the recipe beside it, because the distribution is a property of the recipe.**

### 1.12 Practical traps that cost real time

**A scratch vector passed as an output target aliases itself.** `selfCheckFractionOfStature` called
`centreOfMass( this.scratch )`, and `centreOfMass` used `this.scratch` as its own per-segment temp.
The result was garbage that *looked* like a plausible small number (0.0239). It was caught only
because the gate ran on known-bad input in the same pass and both directions returned the same
wrong value. Give measurement methods their own result vector.

~~**A concurrent agent's file edit will kill a long browser capture.**~~ **NO LONGER TRUE, and the
stale version of this rule cost a whole round.** It was written when captures were driven against
`npm run dev`: vite's watcher fired HMR 211 frames into a 3600-frame run and Playwright reported
"Execution context was destroyed, most likely because of a navigation." `capture.mjs` now starts
its **own** vite when given a bare path (`--url /alive.html?bare&frame=body`), with
`watch: { ignored: ['**'] }`, so nothing it serves can ever be reported as changed.

Re-verified 2026-08-08, **in both directions, by execution** — two servers stood up from the same
`vite.config.js`, a real Playwright page on each, and `packages/testbed/alive.html`'s mtime bumped
under both while a marker was held on `globalThis`:

| server | what it sent on the touch | page navigations | execution context |
|---|---|---|---|
| default vite | `{"type":"full-reload","triggeredBy":".../alive.html"}` | 1 | **destroyed** |
| `capture.mjs`'s settings | *nothing* | 0 | **survived** |

And the positive case at full scale: a 1200-frame / 40 s capture completed with zero page errors
while three other agents were saving files under `packages/` throughout.

⚠️ **`hmr: false` is not what does it.** The `/@vite/client` script is still injected into the
served HTML with HMR off; measured, it is there in both configurations. What disarms the reload is
the **watcher ignore list** — chokidar never emits a change, so the server has nothing to send.
Anyone tempted to drop `watch.ignored` because "HMR is off anyway" would silently restore the bug.

🚩 **The residual hazard, which nobody had written down and which is worse than the original.** The
watcher-off server pins the tree for **one run**. Two runs launched minutes apart in a fan-out are
of **different builds**, and nothing said so. Measured: twelve captures of
`/alive.html?bare&frame=body` at seed 1, six taken before a concurrent agent saved `FacialIdle.js`
and `HandIdle.js` and six after —

| comparison | worst frame difference |
|---|---|
| within either group, 6 processes each | Δ**3** of 255 on 44 px of 210,000 (**0.021%**) |
| across the two groups | Δ**209** of 255 on 821 px (**0.391%**) |
| a different seed, for scale | Δ249 on 25.75% of pixels |

A factor of seventy in code value between two clips that looked like a repeat of the same capture.
`capture.json` now carries a `source.packagesDigest` — git HEAD plus a content hash of every file
under `packages/` that vite can reach — so **two clips are comparable only if that digest matches**.
Six back-to-back runs while writing this produced **three** distinct digests. Check it before
running any A/B.

**Constructing a second `Skeleton` over an already-posed `Figure` treats the current pose as bind
and applies the next pose on top of it.** It produced stance measurements that were half and double
the truth (heel separation 0.043 m and 0.227 m against a real 0.170 m), which read as a *modelling*
error rather than an *instrument* error and sent the search to the wrong file. The `Skeleton` is now
cached with the `Figure`. When two measurements of the same quantity straddle it by a factor of two,
suspect the instrument.

**The Claude browser pane performs no layout and fires no `requestAnimationFrame`.** `innerWidth`
and `clientWidth` read 0, the WebGPU drawing buffer comes up 1×1, and any three.js page renders one
frame and stalls. A page that trusts either will simply appear stuck at "booting…" and is not
broken. The workaround, in `packages/testbed/src/stage.js`: pin the size explicitly
(`Stage.setFixedSize`) and drive frames from a `MessageChannel` — `setTimeout` is throttled to 8/s
when the page is hidden, `MessageChannel` measured **553,921/s**.

---

### 1.21 Two `+y` can point opposite ways in the same file, and comparing them inverted a documented conclusion for a round

`sway.selftest.mjs` reported the free femur's swivel as the y term of `restWorld⁻¹ · currentWorld` —
a delta in the **bone's own rest frame** — and `Sway.js`'s header compared it against
`relaxed-standing.json`'s `leftUpperLeg` y = **+9.56**, which is authored in the **normalised rig**.
`thigh_l`'s local +Y points DOWN in world (0.017, −0.997, 0.078), so the two axes are antiparallel,
and the header concluded the free knee turns OUT over pose files that say in words that the swivel
*"moves the knee 14.3 mm toward the midline"*. An independent re-verifier reported INWARD and was
disbelieved on the strength of the wrong comparison.

The fix that settles it takes **no frame at all**: measure where the patella POINTS — the world
vector from the knee joint to the centroid of a patella patch chosen once at rest. Measured that
way the free knee swings **12.04° medially** (left free) and **10.55°** (right free), against a
loaded knee inside 1.4°. A direction needs no convention and cannot be inverted by one.

> When a gate compares an angle against an authored constant, check that both are expressed in the
> same frame — and prefer a measurement that has **no** frame to one that has two.

### 1.22 A distribution can leak into a derivative, and every gate stated on a position is blind to it

`Sway` draws weight-shift amplitudes from a lognormal whose SD exceeds its mean — correct, cited,
and gated. Its event shapes had **fixed durations**, so peak *speed* was that skewed tail divided by
a constant and inherited all of it: a 49 mm centre-of-pressure move in half a second, ~99 mm/s,
against the layer's own mean resultant velocity of 18.22 mm/s.

Every amplitude, rate and spectral gate stayed green — **and so did the mean-velocity gate**. The
fixed-duration layer's composite mean is 18.76 mm/s against the fixed layer's 18.75, because
stretching a tail changes a path length hardly at all.

Two transferable shapes:

1. When a layer draws an amplitude from a heavy-tailed distribution and realises it over a fixed
   time, **gate the derivative, and gate its peak rather than its mean.** A rare-event process is
   quiet most of the time, so its mean sits below any transient by construction.
2. **Ask which of your levers is free before you pull the expensive one.** Holding peak speed
   constant means holding rise *time* proportional to amplitude, and rise time has two factors that
   do not cost the same. Moving the rise **fraction** is free — the event's total length is
   unchanged, so no power moves in the spectrum. Moving the **duration** is not: taking the whole
   stretch out of duration cost a full FFT bin of composite lateral spectral mode, 0.264 → 0.234 Hz,
   under its own 0.250 floor. Spending the free lever first took the events needing a longer
   duration from 35% to 12%, and the mode came out at **0.308 Hz** — better than before the change.

### 1.23 The same SYMPTOM can have a second, unrelated cause, and the gate for the first one stays green through it

§1.1's worked example is teeth drawing through closed lips from `alphaMode: BLEND`. That fix holds
and `verify_glb.mjs` asserts it on every material of every figure — all OPAQUE, all depth-writing.
The band came back anyway, from a **nonzero `jawOpen` in the idle layer opening the mouth for
real**: `FacialIdle` holds it at 0.016 ± 0.012, and this asset shows teeth from `jawOpen` 0.0281
(g100) to 0.0454 (g000). Everything about the appearance was identical; nothing about the cause was.

The tell that separated them was a **toggle, not a theory**: the same GLB renders a sealed mouth on
`eye.html` (no pose, no morphs) and an open one on `alive.html`, and `?skin=0` and `?pose=bind` both
left it untouched.

> A successor who sees a known symptom, checks its known cause, and finds the gate green is not
> finished — they have ruled out one cause.

Worth its own line: **every morph target on this asset is a SPARSE glTF accessor** (2,329 of 14,517
vertices for `jawOpen`). An offline tool that reads only the dense `bufferView` gets all zeros and
reports every morph as inert — which looks exactly like a correct measurement of a figure with no
morph data. That cost a false negative inside one round.

### 1.24 A capture hook that draws the scene itself will silently throw away the whole post pipeline

`alive.js`'s `?capture` hook called `stage.renderer.render( scene, camera )` directly, while
`Stage.draw()` — the method the rAF path uses — routes through `RenderPipeline.render()` when the
deferred path is live, because the pipeline is what binds the MRT and runs the composite.

The failure is **silent and looks exactly like a feature that does nothing**. Measured at the moment
of integration: `?grade=1` produced a plate **byte-identical to no grade across all seven gates**,
and `?aa=traa` was indistinguishable from `?msaa=0`. Nothing threw, nothing warned, and the obvious
reading — "the grade is too subtle to measure" — is wrong in a way no amount of sweeping the grade's
own constants would ever have revealed.

The same page had the same class of bug a second time and in the other direction: `ground.update()`
lived in a `stage.onFrame` callback, and `?capture` **takes the frame loop away from rAF**, so the
callback stops firing and the contact shadow stops following the feet on precisely the plates a
judge measures.

> A page with two frame paths has two chances to be wrong. Give per-frame work **one** named home
> that both paths call, and draw through the renderer's own frame method rather than reaching past
> it. If a rendering feature measures as *exactly* zero, suspect the plumbing before the feature.

---

## §1.25 — Six lessons about GATES, all of them paid for in whole rounds

§1.1 says a gate that has never failed is not known to work, and the repo took that seriously: every
new gate now ships with a rejection proof. These six are what came back when that discipline was
itself audited. **Every one of them is a gate that had a rejection proof and was still not measuring
what it claimed.**

### 1.25a A gate that only catches its OWN known-bad is decorative

The rejection proof answers "does this gate fire on the defect I built it from?" That is a weaker
question than it looks, because the gate and the known-bad were written by the same person in the
same hour, against the same mental model. Passing it proves the two are consistent, not that either
is right.

**Three of one round's new gates were proved decorative this way** — not by argument, but by
inventing a *different* defect in the same class and watching the gate stay green. `Grade.js` now
carries the pattern as a shipped artefact: `GRAIN_DEFECTS` lists **seven** ways its grain could be
wrong, of which **four were never shipped and exist only to be shot at** — `floored`, `sqrt`,
`inverted`, `chromatic` — each reachable from a URL so the rejection proof is a page rather than a
committed plate. Two of them are the interesting ones: `chromatic` leaves the black point exactly
alone (so no black-point check can see it) and `sqrt` has the right endpoints and the wrong slope at
zero (so only an analytic sweep catches it).

The discipline, in one line each:

- **Write the known-bad you were going to write. Then write a second one you did *not* have in mind
  when you designed the gate.** If the gate is green on the second, you have a gate about one
  defect, not about a class.
- **State the class out loud** — "any envelope that does not vanish at least linearly at L → 0" —
  because a class can be enumerated and a hunch cannot.
- **Prove it over the same sample the forward gate runs on.** §1.1a: three of `sway.selftest.mjs`'s
  rejections were stated on one seed while the gates they prove run over twelve, and two silently
  stopped rejecting when an unrelated fix re-drew the arrival times.

This round's own two new gates were built to that standard and it is worth reading them as worked
examples. G1's floor is proved by 1.344 (the number the one-sided form passed) **and** by 1.0 dead
flat, which is what the old inline rig on `alive.html` actually measured. `travel.mjs`'s refusal is
proved by a luma gradient **and** by a unimodal noise field — two unrelated reasons for a histogram
to have no valley — **and** by asserting that a figure covering 2% of the frame is *not* refused,
because a refusal that also rejects the clips the tool exists for is worse than no refusal.

### 1.25b A gate that tests a CPU mirror PLUS a regex over the source tests NEITHER

The shape is seductive and it is everywhere a GPU is: the behaviour lives in a shader that cannot be
evaluated on the CPU, so you write a JavaScript mirror of the maths, gate the mirror, and then grep
the shader source to check it still calls the thing. Two green checks, one real conclusion, and the
conclusion is **false**.

- The **mirror** proves the arithmetic you wrote in JavaScript is the arithmetic you meant. It says
  nothing whatever about the node graph — the shader can stop calling the envelope entirely and the
  mirror stays green. That is exactly how the flat-grain defect got in.
- The **regex** proves some tokens are present in a file. It cannot evaluate them.

Put together they leave a hole a verifier walked straight through. The sabotage was one edit:

```js
level.mul( level.oneMinus() ).mul( 4 ).mul( 0 ).add( 1 )   // arithmetically the constant 1
```

Every token a regex looks for is still there. The mirror is untouched. **`Grade.selftest.mjs`
reported 28/28 green on a node body that is the constant 1** — which is `flat`, the one defect in
that file's list that actually shipped and that the whole envelope exists to prevent.

What closes it is not a third static check. It is a **rendered measurement**, and the reason it
works is that it does not care how the graph is spelled: a constant-1 envelope and a deleted
envelope produce the same picture, and the picture fails. `Grade.js` records that measurement in the
file, taken by editing the function to `1` and rendering — **p0.1 luma 0.00841 enveloped → 0.00056
flat**, a 15× crush against G6's 0.004 floor.

> Where a gate cannot execute the thing it is about, say so **in the gate's own output**, and name
> what the authoritative check is. `Grade.selftest.mjs`'s header does this well — *"it is a
> structural read of the module text, and it is honest about being one"* — and the honesty is what
> makes the 28/28 readable as "28 checks, none of which is the one that matters" rather than as a
> pass. A gate that overstates its own scope is worse than a missing gate, because a missing gate
> leaves a hole someone can see.

### 1.25c CHECK WHAT THE DEFAULT IS BEFORE YOU ATTRIBUTE BY TOGGLE

§1.19 recommends attribution by toggle and it is the right instrument. This is the way it fails.

A judge reported **"no antialiasing anywhere"** as a blocker. MSAA was already on and had been for
two phases. The judge had captured a `?msaa=0` plate and measured it against the numbers in these
docs — and the numbers **matched to four decimal places**, so nothing looked wrong. They matched
*because* it was the same toggle state as the plate the docs were written from. The agreement that
should have been the first warning was read as confirmation.

Three rules, and the third is the one nobody does:

1. **Look up the default before you toggle it.** `?msaa=0` is not "the control"; it is a *state*,
   and which of the two states is shipped is a fact about `alive.js`, not about the flag's name.
2. **Record the toggle state of every plate, including the toggles you did not set.** A plate is
   identified by its page, framing, seed, build digest **and its full flag set** — the ones you
   passed and the ones you defaulted. `measure.mjs`'s `--page` string is where this goes.
3. **When two independently taken numbers agree to four decimals, be suspicious rather than
   reassured.** Rendering is not that reproducible across recipes: this round two honest
   measurements of "the frozen plate" came back 0.9200 and 0.7836 (§1.19a). Four-decimal agreement
   usually means you have run the same thing twice, and that is a fact worth establishing on
   purpose rather than discovering later.

This is §1.11a's family — a real measurement of the wrong quantity — with the twist that the wrong
quantity was created by the measurement's own setup.

### 1.25d A ONE-SIDED gate cannot see half its failure mode, and the half it cannot see is invisible precisely because the gate is green

**G1 asserted `< 2.00:1` and nothing else.** The spec states the parameter twice: the checklist as
`< 2:1` and the rig section as `KEY : FILL on face 1.2:1 to 2.0:1` — a range, with two ends. Only
one end was ever transcribed into a gate, and the reference band the file itself computes and prints
(1.43–1.64 linear) was reported beside the verdict rather than enforced by it.

So **1.344 linear reads PASS**: a fifth flatter than either published asset, on a spec whose *first
finding* is that the face is deliberately flat-lit and that form is then carried by rim, kicker and
a warm/cool hue split. Flatter than the reference is not "comfortably inside the ceiling" — it is a
face with no form at all, and the ceiling is structurally unable to say so. This project's own
full-body framing was recorded at **1.2104 / 1.2161** and carried in PROGRESS as prose — *"passes
the < 2.00 ceiling, flatter than the reference band, and that trade is recorded rather than
hidden"* — **because no gate could hold it**. Prose is where a finding goes to be forgotten.

⚠️ **State honestly what the new floor is and is not catching.** Re-measured 2026-08-08 at build
`c70195c` on `alive.html?bare&freeze&frame=body&seed=1`, free-running, against
`regions.lighting-body.json`, body framing now reads **1.5547 — inside the band, PASS**. Somebody
fixed it between rounds and the prose was never updated. So the floor catches **nothing on today's
tree**, and it is proven red only on constructed plates (1.344 and 1.000). That is the right state
for a gate to be in and it is worth saying out loud: a gate is a **guarantee against regression**,
not evidence of a defect (§1.7f made the same distinction about the lopsided-arm gate). What would
have been wrong is leaving the ceiling alone because nothing is currently below the floor.

Fixed 2026-08-08: G1 is two-sided against the reference band's own floor, and its report says
**which side** — "TOO FLAT" or "TOO CONTRASTY" — because `G1 FAIL` on its own had already sent
someone at the wrong end. Proven red at 1.344 and at 1.000, and proven to leave the reference pair
(1.6344) inside.

> **Audit every gate in the repo for this, by reading its comparison operator rather than its
> prose.** A `<`, a `>` or a `!==` where the reference is a *band* is the same defect. It is the
> cheapest audit in this document: `grep -n 'status:.*[<>]' tools/critic/measure.mjs`. G4, G6 and
> G2's chroma clause are bands and were already two-sided; G5 and G7 are one-sided and legitimately
> so, because "less clipping" and "fewer blue outliers" have no wrong end.

### 1.25e A hand-typed number inside a WARNING STRING is a claim with no gate on it

`measure.mjs` prints a warning beside G2 saying what the gate's distribution over seeds looks like.
It is good practice — it is how a reader learns not to quote one draw. It was also **English prose
with a hand-typed verdict in it**, and it went stale the moment the build moved:

> *"…G2 luma reads 0.8127 / 0.9627 / 0.9736 / 0.4384 at seeds 1 / 42 / 4242 / 20260807 — a 2.2×
> spread, two of four passing."*

Every one of those numbers was wrong for a whole round, and the tool printed them **as output, in
the same report as the measured values**, where they are indistinguishable from something the tool
had just computed. Three separate agents quoted them onward. Today's measurement of the same recipe
is **0.7836 / 0.9189 / 0.9292 / 0.4390 — 1 of 4 passing**, and the *mechanism* the sentence gave was
wrong too (§1.19a).

The general shape: **a number's trustworthiness comes from the gate on it, not from the file it
lives in.** A constant in an expression gets re-derived when the expression is re-run. A number in a
string is a fossil, and putting a fossil in a tool's stdout laminates it.

Three ways out, in order of how much they cost:

- **Cheapest:** stamp the string with what it is. `measure.mjs`'s warning now carries
  `(recorded 2026-08-08 at build 82260d4)`, so the number's age is visible next to it.
- **Better:** assert it. `tools/critic/selftest.mjs` now holds a `superseded` list — the four old
  values — and fails if any of them reappears in the warning text. That catches a revert, not a
  drift.
- **Best, and not done here:** do not hand-type it. A distribution that matters enough to print is
  a distribution that should be re-measured by the gate that prints it, or read from a committed
  JSON the capture tool writes.

### 1.25f An agent told both "commit" and "do not commit" will not commit — and it has stranded finished work twice

Not a measurement lesson; a workflow one, and it is the most expensive kind because the work was
already correct.

Fan-out prompts carry `Do NOT git commit — the integrator commits`. That rule exists for judges and
verifiers, whose whole value is that they did not touch the tree. Applied to a **fix agent** it
means the round's actual work sits in the working tree, gets clobbered by the next agent to touch
the same file, or is reported as "built and uncommitted" and then rediscovered. `PUNCHLIST.md`
carried **four items marked "Built and uncommitted as of 2026-08-08"** — 3.12, 3.13, 3.17, 3.18 —
which were in fact committed and passing at build `c70195c` with a clean working tree, and one of
which (3.17) had a check count recorded at 14/14 against a real 31/31. The work survived; a round
of doc trust did not. That is the same failure surfacing as a stale doc rather than as lost code,
and it is the cheap version — the expensive version is the file that got clobbered.

**The resolution, recorded here so it stops being re-litigated: FIX AGENTS COMMIT.**

| role | commits? | why |
|---|---|---|
| **fix / build agent** | **YES** — own files only, one commit, message says what was measured | its output IS the tree; anything else strands it |
| **docs agent** | **YES** — `docs/` and its own tools | same |
| **judge / visual critic** | no | its value is that it did not touch anything |
| **adversarial verifier** | no | §Part 4: mixing report and repair loses the signal |
| **integrator** | yes — merges, resolves, tags the round | the only one allowed near another agent's files |

And the transferable half: **when two instructions in a prompt conflict, an agent resolves the
conflict by doing nothing.** That is the safe default and it is usually the wrong outcome. If a
prompt has a blanket prohibition and a role-specific exception, say the exception **in the role's
own paragraph**, not once at the top for everyone.

### 1.25g A gate that compares two OBSERVERS is blind to a defect that is wrong the same way for both

The viseme schedule has a frame-rate-invariance gate: run the same timeline at 30, 60 and 120 Hz
and assert the weights agree. It was proved red three separate ways — a countdown that discards its
overshoot, a smoother with a constant per-frame coefficient, and anticipation authored in frames —
each worth 3.7e5× the tolerance. Three structurally different couplings, all caught. By §1.25a's
standard that gate was done.

Then a **fourth** defect was written specifically to walk past it: **anticipation authored in
frames but resolved against a hardcoded 60 Hz.** The rate-versus-rate comparison saw **0.0e+0
disagreement.** Not a small one — exactly zero, at every rate, on every shape. A defect that is
wrong by the same amount for every observer is invisible to any gate whose whole question is
whether the observers agree. An independently derived oracle saw it at 0.9000.

> **Cross-observer agreement is not correctness.** "Do two observers agree" and "is either of them
> right" are different questions, and only the second one is the one you care about. Any invariance
> gate — frame rate, resolution, seed, platform — answers the first. It needs an oracle beside it
> that computes the expected value from first principles, or it is testing self-consistency and
> calling it truth.

The generalisation of §1.25a: proving a gate red three ways establishes that it catches the defects
you thought of. Reaching for a **fourth defect designed against the gate's own mechanism** is what
finds the class it is structurally blind to. Sway's frame-rate-invariance checks, `MotionStack`'s
determinism checks and `TRAAPost`'s two-mode agreement check are all in this family; only the last
has an oracle (`hold` and `exact` must agree on a held morph AND the held morph must read zero).

### 1.25h "Plausible mechanism" is not "measured effect", and it can point the wrong way

Punch-list 3.12 recorded, for three rounds, that turning TRAA on would turn the eyelash card
anti-aliasing off. The reasoning was sound as far as it went: alpha to coverage genuinely does need
MSAA, MSAA and TRAA are genuinely mutually exclusive, so the cards genuinely do lose alpha to
coverage. Every step is true. The conclusion — that the cards would be worse — was never measured,
and it is **false**. Share of card-band silhouette transitions that jump in a single pixel:

| configuration              | card-band hard% |
|----------------------------|----------------:|
| no anti-aliasing           |            68.7 |
| MSAA + alpha to coverage   |            44.5 |
| TRAA                       |            35.5 |
| TAAU 0.66                  |            27.1 |

The temporal resolve antialiases the cards **better** than the thing it removed. The mechanism was
real and the net effect went the other way, because the reasoning tracked one term and the outcome
is a sum over several.

> A chain of true statements about a mechanism licenses a HYPOTHESIS, never a verdict. The tell is
> a doc sentence with no number in it standing where a gate result should be. This one blocked a
> default change for three rounds and cost nothing to check once anybody did.

The same round produced a second instance in the opposite direction: `Grade.js` and LEARNINGS both
carried "RCAS before tone mapping renders a brown iris grey — luma 0.1237/sat 0.2997 → 0.4159/
0.1268". That one HAD a number, and it still did not reproduce: re-measured on the same page, same
rect, converged, it is a 1.3% difference rather than 2.4×. A number is better than a mechanism and
neither is a substitute for re-measuring on the build in front of you.

---

## Part 2 — Technical traps

### three.js (verified at r185)

- **Do NOT alias `three` → `three/webgpu`.** Both re-export from a shared `three.core.js`, so
  there is no dual-instance problem to solve. The alias omits `UniformsUtils`, `ShaderChunk`,
  `WebGLRenderer` and four others that 30+ stock addons import.
- `PostProcessing` → **`RenderPipeline`** as of r183.
- 🚩 **`MRTNode` silently drops output names it cannot resolve against the bound render target, and
  if none resolve the fragment shader declares an EMPTY output struct** — invalid WGSL, and the
  object stops drawing. `NodeMaterial.setup` uses `material.mrtNode` **alone** (not merged with the
  renderer's) whenever a render target is bound and `renderer.getMRT()` is null, and
  `Renderer._getFrameBufferTarget()` allocates an **unnamed** target for every tone-mapped canvas
  frame. Net effect: **a material carrying `mrtNode` cannot be forward-rendered.** Only tag
  materials that are drawn through a G-buffer pass. Naming `output` in the material's MRT covers
  the "some other pass" case but not the intermediate-target case, because that texture has no name
  at all.
- 🚩 **Morph targets contribute NO velocity.** `nodes/accessors/Morph.js` never assigns
  `positionPrevious`; `Skinning.js` does (:166, :233). So a morph held at a **constant** weight
  yields a **constant non-zero** motion vector — the buffer reports the morph offset, not its
  change. Bone motion reprojects correctly; morph motion does not.
  Now measured **on the real face**, not on a test sphere: `jawOpen` held at 0.8 with the camera
  still, jaw box 200,600,220,120 at 900×1200 — MSAA temporalRms **0.000/255**, TRAA **4.711**,
  TAAU **4.387**, against no-morph controls of 0.000 / 0.258 / 0.147. That is 18.3× and 29.8×,
  attributed by toggle. Under an **animated** morph both temporal modes BEAT MSAA (12.315 and
  11.234 against 13.420), so the defect is specific to **held** expressions — which is most of the
  time for a face between blinks. `TRAAPost.selftest.mjs` re-checks the two three.js sources on
  every run, so the day it is fixed upstream the verdict flips by itself.
  🎯 **THE THREE.JS FACTS ARE STILL TRUE; THE CONSEQUENCE IS REPAIRED.** `render/MorphVelocity.js`
  wraps `NodeMaterial.prototype.setupPosition` and supplies the previous-frame morphed position
  before three's own runs. Re-measured with the renderer's frame owned by the capture and converged
  to frame 150: held `jawOpen` 0.8 reads **4.1336/255 unpatched against a 0.2590 floor = 15.96×**,
  and **0.4147 = 1.60× with the fix.** `?morphvel=off` on `alive.html` is three r185 unpatched.
  ⚠️ The 18.3×/29.8× figures above are the right order of magnitude but were taken on a page whose
  `__SUGATA_STEP__` advanced only the simulation, so an unknown number of renders happened per
  step. And the contradiction they created is settled: under a SWEPT morph and a real blink the
  broken velocity buffer is at worst **1.22× MSAA**, not 18×, which is why one agent's ghost test
  came back clean and another's held-morph test did not. Both were right about different cases.
  ⚠️ It is a **prototype patch on a dependency**, and the file says so with the three alternatives
  and why each fails — three exposes no hook early enough. `MorphVelocity.selftest.mjs` asserts the
  three upstream properties it depends on, so an incompatible three upgrade fails loudly rather
  than silently. Cost: **27.33 MB** of re-encoded morph offsets, read out of the GLB rather than
  quoted, because three keeps its own copy in a module-private `WeakMap` with no accessor.
- 🚩 **MSAA IS live on a forward, tone-mapped WebGPU frame — and the project spent a round
  believing otherwise.** `Renderer._getFrameBufferTarget()` builds the tone-mapping intermediate
  with `samples: this.samples`, so `antialias: true` really does multisample it. Measured on the
  head silhouette at 900×1200, largest single-pixel luma jump across the edge: **0.6933** with,
  **0.8733** without. A whole review round chased a terminator defect whose numbers reproduce
  **only** on the `?msaa=0` plate.
  The trap is the opposite one: **MSAA does nothing whatever for SHADING aliasing.** Under a moving
  camera the flat-forehead high-frequency temporal RMS reads **1.408/255 with and without it**,
  identical to three decimals. Geometry edges and shading crawl are different problems and MSAA
  solves exactly one of them.
- 🚩 **three's bloom is not UE's, and swapping the mental model costs a black point.** UE's bloom is
  energy-conserving — it *redistributes*. `BloomNode` **adds** a blurred copy. So the look spec's
  "threshold low/none, intensity 0.25–0.40" is a **4.3× black lift** here: at strength 0.30 and
  threshold 0, whole-image p0.1 luma goes 0.02496 → 0.08630. Threshold 0.8 keeps the intensity and
  leaves the black point exactly where it was.
- 🚩 **RCAS (`SharpenNode`) is an LDR perceptual-space operator and must run AFTER tone mapping and
  the sRGB transfer.** Run on linear HDR scene colour it desaturates: the iris patch goes luma
  0.1237 / saturation 0.2997 unsharpened → **0.4159 / 0.1268** with RCAS 0.4 before tone mapping —
  3.4× brighter and half the chroma, a brown iris rendering grey — and back to 0.1297 / 0.3729 with
  RCAS 0.2 after the transfer. **No gate catches it**: G1–G7 sample cheek, sclera, terminator and
  the card band, and none of them looks at the iris.
- 🚩 **`TextureLoader` defaults `flipY` to true; `GLTFLoader` sets it false.** So a baked data map
  loaded with the former does not line up with the albedo on the same mesh — it is sampled
  vertically mirrored. This shipped silently and made a whole transmission term inert: the ear's
  baked thickness reads 3.32–7.47 mm at `v` and 42.26–60.00 mm at `1 − v`, i.e. the middle of a
  skull. Any baked map that is not a colour texture needs `flipY = false` set explicitly.
- `readRenderTargetPixelsAsync` pads every row to **256 bytes** and returns the raw texel type — a
  `Uint16Array` of half floats for any 16F format. `mapAsync` also rejects a buffer size that is
  not a multiple of 4, which breaks an R8 attachment at any width not divisible by 4.
- `PassNode.setMRT` names must be registered with `getTexture(name)` **before any material
  compiles**, or the channel compiles away to nothing rather than erroring.
- `GTAONode` samples normals as `normalNode.sample(uv).rgb.normalize()` — it needs **signed
  view-space** normals. `packNormalToRGB` into RGB8 would confine the direction to the positive
  octant and produce plausible-looking wrong AO.
- `readRenderTargetPixelsAsync` **never settles on the WebGL2 backend** of `WebGPURenderer` (the
  probe hangs). Numeric readback verification is a WebGPU-only instrument.
- `RGBELoader` deprecated since r180 → use `HDRLoader`.
- `PCFSoftShadowMap` deprecated at r186; already removed from the WebGPU path.
- 🚩 **`PhysicalLightingModel.direct()` is NOT the only diffuse path.** A `RectAreaLight` goes
  through `directRectArea()` and the LTC path and never reaches `direct()`. A custom diffuse model
  that overrides only `direct()` compiles, renders, and does **nothing at all** under a rect-area
  rig — which is the only rig this project uses. Neither `LTC_Evaluate` nor `LTC_Uv` is re-exported
  from `three/tsl`, and deep-importing `three/src/...` would instantiate a second copy of the node
  system; the workable pattern is to call `super` with a scratch `reflectedLight` and post-process
  its result. Note the consequence: pre-integration is exact for punctual lights and only a
  per-channel gain for rect-area ones, because LTC returns a solid-angle-weighted cosine with no
  single N·L to look up — so the area path does not reproduce the wrap into negative N·L.
- 🚩 **A `RectAreaLight` illuminates only the half-space in FRONT of its own plane, with a hard cut
  at the plane.** On a curved subject that boundary is invisible; across a large flat backdrop
  behind the subject it is a straight bright/dark edge across the frame. Isolated by execution:
  rim + kicker at zero gives a clean backdrop, rim + kicker alone gives black plus one hard wedge.
  Mitigations: keep flat surfaces closer than the rim, give the card an emissive floor, or keep it
  out of shot. (It is **not** true that the two back lights "throw their light forward, away from
  anything further back" — the key and fill do light the card perfectly well. That wrong reason sat
  in `alive.js` as authoritative for two phases.)
- **A `SpotLight` shadow's frustum IS its light cone** — three derives `shadow.camera.fov` from
  `light.angle`. Sizing the cone snugly to the subject for texel density therefore puts the cone
  edge inside the frame on anything further away. Size the cone to the studio and buy texels back
  with map size instead, which is free: the shadow pass is bound by the extra geometry draw, not by
  fill — measured 2.62 ms at 2048 and 2.74 ms at 1024.
- **`Renderer.shadowMap.enabled` defaults to `false` on the WebGPU path.** A rig handed only the
  scene will build a perfectly configured shadow caster and silently produce no shadow.
- 🚩 **Two unrelated things are called SSS.** `MeshSSSNodeMaterial` is a back-lit translucency
  hack (not a skin shader). `addons/tsl/display/SSSNode.js` is Screen-Space **Shadows**.
- `TAARenderPass` (WebGL) **is not TAA** — no reprojection. Useless for an animated avatar.
  The real one is `TRAANode`, WebGPU only.
- Specular AA is **geometric only** — normal-map detail contributes nothing to roughness. Micro-detail
  and hair *will* shimmer without a hand-rolled normal-variance term.
- No bent normals, no specular occlusion, no cloth, no hair, no eye shader. All hand-rolled.
- Bone masking: **filter `clip.tracks`**. Never touch `_propertyBindings` (forum hack, will break).
- `CCDIKSolver.iteration` defaults to **1** in code, not 5 as documented.
- Morph targets live in a `DataArrayTexture` — **no 8-target limit**, and they are nearly free
  (measured 0.219 ms for 69 targets).
- three's node clock reads `performance.now()` — wall-clock re-enters through the renderer. Pin it
  for deterministic capture.

### The figure asset

- **Seven meshes** (measured on `figure_g050.glb`): `Human` (body, 14,517 verts, 89 morphs),
  `teeth_base` (4,494 / 27), `tongue01` (253 / 28), `eyelashes01` (250 / 27), `eyebrow001`
  (124 / 49), `high-poly` (**the eyeball globes**, 552 / 8) and `cornea` (**the clear outer
  shells**, 524 / 8). The eye names are about topology, not anatomy — `high-poly` replaced a
  `low-poly` proxy, and every hardcoded `low-poly` matcher had to widen.
- **65 of 89 morphs live on more than one mesh** (re-measured after the corneal split; still 65,
  but `eyeLookUpLeft` is now on **5** meshes rather than 4). Setting a morph means writing every
  location.
- The cornea rides its own `MeshPhysicalMaterial`: alphaMode **OPAQUE** carrying
  `KHR_materials_transmission` (transmission 1) and `KHR_materials_ior` (1.3333), so depth is
  still written and it is not a blended surface. No `KHR_materials_volume`, so three's
  `getVolumeTransmissionRay` gets thickness 0 and the cornea refracts nothing — a glossy wet
  layer, by design. The anterior chamber measures 2.15–2.40 mm if anyone wants real refraction
  out of the stock material.
- **Corneal radius of curvature: 6.91–7.64 mm** across the gender sweep (front 15° cap, both eyes
  agreeing to 0.016 mm; g000 7.644 → g100 6.910, monotonic). This is the number corneal power is
  computed from, and it is **not** the globe radius (15.11–15.50 mm) — the two are separate
  surfaces on this asset. Human is 7.7–7.8 mm, so **this cornea is steeper than human**, giving
  49.2–54.4 D at n = 1.376 against 48.2–48.8 D. At the IOR the GLB actually carries (1.3333) the
  delivered anterior power is 43.6–48.2 D. Full table in `PROGRESS.md`; gated by
  `docs/eye-optics-claims.selftest.mjs`.
- 53-bone `game_engine` rig. 🚩 **No jaw bone, no eye bones** — face is entirely morph-driven.
- Blink saturates at **0.752** on the current asset (was 0.735 on the low-poly eye; the corneal
  apex stands 1.145 mm further forward, so the lid has further to travel). Per figure the seal is
  g000 0.750, g025 0.726, g050 0.713, g075 0.700, g100 0.681, and the default is the largest.
  ⚠️ "Past 0.735 the lash cards punch through the lid" was recorded here and is **not measured
  anywhere** — no gate in the repo detects lash intersection. Treat it as a suspicion, not a fact.
- Bind pose is worse than an A-pose: arms 41.8° out, 43.1° elbow flexion, wrists 17 cm clear of hips.
- Gender axis is **exactly linear** (2.2e-13 mm). Blending adjacent bakes deviates 0.0004 mm in
  shape. The research's "clamp to a narrow band" mitigation is unnecessary with bracketed bakes.

### vite / the build

- 🚩 **Vite inlines a small AudioWorklet as a `data:` URL and its relative import dies in
  PRODUCTION ONLY.** `context.audioWorklet.addModule( new URL( './prosody-worklet.js',
  import.meta.url ) )` works perfectly in the dev server and is broken by `vite build`: at 2.9 kB
  the worklet is under the inline limit, so the reference is rewritten to
  `data:text/javascript;base64,…` **with `import { FrameAnalyser } from './Pitch.js'` still inside
  the payload.** A relative import cannot resolve against a `data:` URL. Confirmed by decoding the
  base64 back out of the built chunk — the build emitted **no worklet asset at all**.
  **Fix:** `await import( './prosody-worklet.js?worker&url' )`, which makes the bundler treat the
  worklet as its own entry, inline its imports and emit one real file. Verified under this repo's
  own `vite.config.js`: one self-contained **5.27 kB** worklet, **zero** top-level imports, one
  `registerProcessor`, and **zero** `data:` URLs left in the main chunk.
  ⚠️ A literal `new URL( …, import.meta.url )` written as a FALLBACK is itself rewritten into the
  same broken `data:` URL. Splitting the filename string takes it out of static analysis.
  ⚠️ **This is dev-green / production-broken, the worst shape this project keeps hitting.** The
  same trap is waiting for the next worker, worklet or wasm module anybody adds.
- ⚠️ **`npm run build:pages` only compiles what a PAGE reaches.** `vite.pages.config.js` exists so
  a broken import cannot pass a green build, and it does that job for every module an entry
  imports — but `voice/Prosody.js` is currently reachable from no committed page, so the worklet
  fix above is **not** covered by either build. Adding a page to the list is necessary and not
  sufficient; check that the page actually imports the module you care about.

### LM Studio

See `research/lm-studio-integration.md`. Two blockers: **schema-constrained output arrives in
`reasoning_content`, not `content`**, and thinking **cannot be disabled** by any documented path,
so the schema constraint is load-bearing rather than optional. ~0.7 s per call.

---

## Part 3 — Commands known to work

**Every command below was re-executed 2026-08-08 at build `c70195c` and its printed check count
taken from that run, not from memory.** Where a count is stated it is what the command actually
says today.

🚩 **THIS LIST DRIFTS FASTER THAN ANY OTHER PART OF THESE DOCS, AND IT DRIFTED AGAIN.** It was
audited a round ago with the note "five of them had drifted"; **seven** had drifted since, and
**five selftests were missing from it entirely**. The full re-run:

| command | this file said | measured 2026-08-08 |
|---|---|---|
| `motion/Gaze.selftest.mjs` | 112 | **114** |
| `motion/sway.selftest.mjs` | 194 | **208** |
| `render/GroundContact.selftest.mjs` | "new this round, untracked" | **31** |
| `material/EyeMaterial.selftest.mjs` | 131 | **132** |
| `tools/critic/selftest.mjs` | 125 | **235** (208 before this round's G1/G2 work) |
| `tools/critic/travel.selftest.mjs` | 111 | **126** (113 before this round's threshold work) |
| `material/SkinRegions.selftest.mjs` | *absent* | **29** |
| `render/Grade.selftest.mjs` | *absent* | **28** |
| `render/TRAAPost.selftest.mjs` | *absent* | **6** |
| `render/Toksvig.selftest.mjs` | *absent* | **9** |
| `testbed/src/alive-toggles.selftest.mjs` | *absent* | **16** |

Everything else held at that moment: bodymass 15, figure 44, MotionStack 47, ocular 64,
idle-motion 106, BodyIdle 41, FacialIdle 27, LightingRig 38, heatmap 57, lut-bake 32,
eye-optics-claims 43, cornea_geometry 40, `verify_glb.mjs` PASS on 5 figures,
`restpose.selftest.mjs` still prints no count. All 23 exited 0.

🚩 **AND THEN THE SAME COMMAND SET WAS RE-RUN ~40 MINUTES LATER, IN THE SAME SESSION, AND FIVE
ANSWERS HAD CHANGED — INCLUDING TWO REDS.** Nothing was rolled back and nothing was broken; three
other agents were mid-save under `packages/`. Recorded verbatim, because it is a better argument
for the warning below than any sentence could be:

| file | first pass, clean `c70195c` | 40 minutes later, mid-fan-out |
|---|---|---|
| `render/Grade.selftest.mjs` | 28/28, exit 0 | **37/44, exit 1** |
| `render/TRAAPost.selftest.mjs` | 6/6, exit 0 | **5/6, exit 1** |
| `render/GroundContact.selftest.mjs` | 31/31 | 36/36 |
| `render/LightingRig.selftest.mjs` | 38/38 | 46/46 |
| `voice/prosody`, `voice/visemes` | did not exist | 26, 59 |

> **A selftest count, and a selftest VERDICT, are properties of a tree at an instant.** The two
> reds above are almost certainly half-written files rather than regressions — but nothing in the
> run could tell the two apart, which is the point: during a fan-out a red is not evidence of a
> defect and a green is not evidence of correctness. Quote a count with the commit it was taken
> at, and re-run at integration when the tree stops moving.
>
> A count in prose is also a claim with no gate on it — the same disease as the hand-typed number
> in §1.25e, one file over. If a successor wants this to stop costing a round, the fix is a script
> that runs every `*.selftest.mjs`, prints `HEAD` and whether the tree is clean, and diffs the
> printed counts against this table. It is twenty lines and it would have caught all eleven drifts
> above the moment they happened.

⚠️ **The 2026-08-08 re-run above was itself taken during a live fan-out**, at `git HEAD` `c70195c`
with a clean tree at the start and other agents saving under `packages/` throughout. Two files
(`SkinOcclusion.js`, `MorphVelocity.js`) were untracked in the working tree while it ran. A
selftest count read while other agents are editing is a **snapshot, not a fact** — an earlier
round watched `LightingRig.selftest.mjs` print `FAIL: 31/34` and then `PASS: 38/38` four minutes
later because its author was mid-save. Re-run before quoting.

🎯 **THE AUTHORITATIVE PASS, taken at integration when the tree had stopped moving.** Every
`*.selftest.mjs` in the repo, plus the two tools, run back to back with nothing else writing.
**All 27 selftests exited 0**, and both reds in the table above were indeed mid-save states:

| | | | |
|---|---|---|---|
| `eye-optics-claims` 43 | `bodymass` 15 | `figure` 44 | `restpose` (no count) |
| `EyeMaterial` 132 | `SkinOcclusion` 13 | `SkinRegions` 29 | `BodyIdle` 41 |
| `FacialIdle` 27 | `Gaze` 114 | `MotionStack` 47 | `idle-motion` 106 |
| `ocular` 64 | `sway` **223** | `Grade` **44** | `GroundContact` **36** |
| `LightingRig` **46** | `MorphVelocity` **16** | `TRAAPost` **11** | `Toksvig` 9 |
| `prosody` 26 | `visemes` 59 | `alive-toggles` **24** | `heatmap` 57 |
| `travel` 126 | `cornea_geometry` 40 | `lut-bake` 32 | `critic/selftest` 235 |

`node tools/figure-pipeline/verify_glb.mjs` → PASS on 5 figures. `npm run build` and
`npm run build:pages` both green, the latter now including `src/voice.html`.

This is what the twenty-line script the note above asks for would print. Nobody has written it yet,
and this table will be stale the next time somebody adds a check.

⚠️ `LightingRig.selftest.mjs` was reported as **exiting 0 even when it prints FAIL**. Re-checked at
integration: the file sets `process.exitCode = failures === 0 ? 0 : 1` at its top level, and the
observation was almost certainly taken against a mid-save state during the fan-out — the same
reading that produced the transient `FAIL: 31/34`. Re-confirmed 2026-08-08 by execution: it prints
`PASS: 38/38` and exits 0 on a clean `c70195c` — and `46/46`, still exit 0, forty minutes later.
No change was needed. Recorded because "a gate that cannot be used in a script is half a gate" is
still the right instinct: check the exit code, not the printed word.

```bash
# Dev server (serves packages/testbed)
npm run dev                                    # http://localhost:5173/alive.html

# ⚠️ `npm run build` builds ONLY packages/testbed/index.html — vite's default single entry.
# alive.html and every page under src/ are NOT in it, so a broken import in alive.js, stage.js,
# skin.js, eye.js, lighting.js or post.js passes the build. To prove the pages resolve:
npm run build:pages                            # vite.pages.config.js — all SEVEN entries
# (index, alive, stage, skin, eye, lighting, post each get their own chunk.)
# It used to be "make a temp config", which had to be rediscovered every round; the config is now
# committed. A new page under packages/testbed/ belongs in its PAGES list on the same commit.
# Confirmed in that build: SkinMaterial's `new URL(`...${figureName}-curvature.png`, import.meta.url)`
# IS handled — vite's dynamic-URL glob emits all five curvature PNGs as hashed assets, so the
# runtime lookup resolves in production as well as in dev.

# Perf spike pages (need a repo-rooted vite; the main config roots at the testbed
# and SPA-falls-back, returning HTTP 200 with the WRONG page)
npm run spikes

# Rebuild all five figures (~6 s each, byte-for-byte reproducible)
bash tools/figure-pipeline/build.sh

# The asset gate — skinning, materials, ARKit 52, visemes, all seven meshes, eye geometry
node tools/figure-pipeline/verify_glb.mjs      # PASS — 5 figures
node tools/figure-pipeline/cornea_geometry.selftest.mjs   # 40 checks; the dome measurement, both ways

# The corneal radius of curvature, and whether the docs still agree with it (§1.11c)
node docs/eye-optics-claims.selftest.mjs       # 43 checks

# Objective visual gates — SEVEN now, not six. G7 (card-band chroma) was added after G1-G6 all
# read green on a plate whose eyelashes were vivid blue; see §1.11e.
node tools/critic/measure.mjs <png> <regions.json>
node tools/critic/selftest.mjs                 # 235 checks (was 125; G1's floor and G2's side clause landed this round)

# 🚩 measure.mjs now records WHICH PAGE a number came from, and warns loudly when it cannot.
# It finds `capture.json` by walking up from the image, which is where capture.mjs writes it, so
# a plate captured the normal way needs no extra flag. For a screenshot taken any other way:
node tools/critic/measure.mjs <png> <regions.json> --page "alive.html?bare&freeze @ 900x1200"
#   --provenance <capture.json>   an explicit manifest instead of the discovered one
# Every gate in the report carries a `measuredOn` string, because gate blocks get copied out one
# at a time and a number that travels without its page is how skin.html's 1.9495 came to certify
# alive.html, which reads 1.4764 at the same width.

# Committed region files. Both were authored against 900x1200 at the portrait framing constants
# (26 deg FOV, 0.42 m portrait height, eye line a third from the top, camera 12 deg off axis),
# which packages/testbed/alive.html and src/lighting.html SHARE — so one file measures both.
# ⚠️ Pin the motion state first: alive.html at ?preroll=6 yaws the head 35.8 deg and the rects
# then land on different anatomy. Use ?freeze with NO pre-roll. See §1.17.
node tools/critic/measure.mjs <png> tools/critic/regions.lighting-portrait.json --human
node tools/critic/measure.mjs <png> tools/critic/regions.lighting-body.json --human

# The Phase 3 shading gates
node packages/core/src/material/EyeMaterial.selftest.mjs      # 132 checks
node packages/core/src/render/LightingRig.selftest.mjs        # 46 checks. It does NOT exit 0 on FAIL — see above
node tools/lut-bake/lut-bake.selftest.mjs                     # 32 checks
node tools/lut-bake/bake.mjs curvature --figure assets/figures/figure_g050.glb

# The Phase 3 browsercheck pages. Serve from the REPO ROOT (.claude/launch.json `sugata-root`,
# port 5199); the testbed config roots at packages/testbed and SPA-falls-back to the WRONG page
# at HTTP 200.
http://localhost:5199/packages/testbed/src/eye.html?w=1000&h=1000&height=0.032&focus=left&bare
#   ?refraction=0  flat iris, the A side of the parallax comparison
#   ?shell=0       corneal shell out of the draw, to attribute a highlight to one mesh
#   ?shader=0      the shipped GLB materials back
http://localhost:5199/packages/testbed/src/skin.html?bare&w=3840&h=2160   # ?stock=1 ?sss=0 ?scatter=12
http://localhost:5199/packages/testbed/src/lighting.html?frame=portrait&bare   # ?variant=dramatic ?ov=rim.azimuthDegrees:-134

# alive.html now carries the Phase 3 materials. Controls for an A/B — see §1.19 for worked
# attributions, and use one of these before writing a paragraph about a cause:
#   ?skin=0     body keeps the shipped GLB material          (G4 1.6468 -> 0.4345)
#   ?eyes=0     eye shells keep their GLB material           (G2 luma 0.9203 -> 0.8815, saturation
#               1.3355 -> 0.7479 with ?eyeocc held fixed: the shader HELPS on both halves)
#   ?eyeocc=0   no occlusion sheet, no lacrimal strip        (sclera 0.7240 -> 0.7433 encoded)
#               🚩 ?eyes=0 used to switch BOTH of these and every number it produced was a sum
#               over two subsystems pulling opposite ways. See §1.19.
#   ?cards=0    eyelash/eyebrow cards keep theirs            (G7 0.0056% -> 0.7571%, the known-bad)
#   ?msaa=0     stage without MSAA; alpha to coverage needs it, so this is the card AA's A side
#   ?shadows=0  rig without its shadow-casting half
#   ?gender=0…1 selects a bake. Inert until commit d7cdea1 — a slider default silently reloaded g050
#   ?freeze     stop after the pre-roll. On the rAF path it pins EVERYTHING: four seeds come back
#               byte-identical and G2 reads 0.9200 at all four.
#               🚩 IT IS INERT UNDER ?capture. __SUGATA_STEP__ advances the simulation whether or
#               not freeze is set, so `?freeze&capture` renders a MOVING figure and is
#               byte-identical to `?capture` alone. That is where G2's seed spread comes from and
#               why two agents measuring "the frozen plate" got 0.9200 and 0.7836. See §1.19a.
#   ?ov=rim.irradiance:0,kicker.irradiance:0    one plate per light, to attribute a colour cast

# Blind A/B — strips provenance so a critic genuinely cannot tell which is ours
node tools/critic/blind_ab.mjs <a.png> <b.png>
node tools/critic/blind_ab.mjs reveal

# Deterministic video capture — THE observation instrument.
# --keep-frames is NOT optional if you intend to heat-map the result; without it the
# PNG sequence is deleted and only the mp4/gif survive.
#
# 🚩 GIVE IT A BARE PATH, NOT A localhost URL. A path starting with "/" makes the tool start its
# OWN vite with the file watcher off, which is what makes a long capture survive a fan-out
# (§1.12, proven in both directions). A localhost URL points it at somebody else's watching
# server and puts the old hazard back.
node tools/critic/capture.mjs --url "/alive.html?bare&frame=body" \
     --seconds 90 --fps 30 --width 700 --height 1200 --seed 1 --keep-frames --out captures/idle

# The judgement set: one clip per seed, into <out>/seed-<n>/, on seeds MEASURED to contain a
# sustained weight transfer. Never hand a judge a single unchecked seed — see §1.20.
node tools/critic/capture.mjs --postural-seeds --seconds 420 --out captures/judge
node tools/critic/capture.mjs --seed 4242,42,20260807 --require-weight-shift --seconds 420 ...

# ⚠️ TWO CLIPS ARE COMPARABLE ONLY IF THEIR BUILDS MATCH. capture.json now carries
# source.packagesDigest; check it before any A/B. Six back-to-back runs during a fan-out
# produced THREE distinct digests, and two of those builds differed by Δ209/255 on 0.39% of
# pixels at the same seed.
node -e "console.log(require('./captures/a/capture.json').source.packagesDigest)"

# Reproducibility is now reported as a MAGNITUDE, not a yes/no. The old digest-equality check
# called an unchanged clean plate "NOT byte-reproducible" on 8 of 10 runs, because the
# alpha-to-coverage resolve on the hair cards moves ~44 px by up to 3 of 255 code values.
# Tolerance: Δ6 code values AND 0.1% of pixels, both measured rather than chosen.

# Per-pixel temporal-σ heat map — see §1.10. PIN --normalise to compare two clips.
node tools/critic/heatmap.mjs <capture-dir> --stride 5 --normalise 12 --bands 12
node tools/critic/heatmap.selftest.mjs           # 57 checks

# How far the silhouette actually moves, in pixels — §1.10a. σ says WHETHER, this says HOW FAR.
node tools/critic/travel.mjs <capture-dir>
node tools/critic/travel.selftest.mjs            # 126 checks (was 113; the Otsu threshold and its refusal landed this round)

# ⚠️ THE ADVICE THAT USED TO BE HERE — "start the dev server through the harness, and note that
# any file edit while a capture is running kills it" — IS OBSOLETE AND WAS COSTLY. capture.mjs
# starts its own un-watched vite when given a bare path. Long captures and fan-out edits now DO
# mix. See §1.12 for the both-directions proof and for the residual hazard that replaced it.

# Motion-layer selftests, with the check counts they print today
node packages/core/src/figure/bodymass.selftest.mjs      # 15
node packages/core/src/figure/figure.selftest.mjs        # 44
node packages/core/src/figure/restpose.selftest.mjs      # prints no count
node packages/core/src/motion/MotionStack.selftest.mjs   # 47
node packages/core/src/motion/ocular.selftest.mjs        # 64
node packages/core/src/motion/Gaze.selftest.mjs          # 114
node packages/core/src/motion/idle-motion.selftest.mjs   # 106
node packages/core/src/motion/sway.selftest.mjs          # 223  (~5 min; the slowest in the repo)
node packages/core/src/motion/BodyIdle.selftest.mjs      # 41
node packages/core/src/motion/FacialIdle.selftest.mjs    # 27
node packages/core/src/render/GroundContact.selftest.mjs # 36

node packages/core/src/material/SkinRegions.selftest.mjs # 29
node packages/core/src/render/Grade.selftest.mjs         # 44  rendered now, not a CPU mirror — §1.25b
node packages/core/src/render/TRAAPost.selftest.mjs      # 11  renders a 150-frame sequence
node packages/core/src/render/Toksvig.selftest.mjs       # 9
node packages/testbed/src/alive-toggles.selftest.mjs     # 24  each ?x=0 moves exactly ONE subsystem

# Added 2026-08-08. Every one of these is a gate; run them.
node packages/core/src/material/SkinOcclusion.selftest.mjs # 13  the cavity bake, two known-answer shapes
node packages/core/src/render/MorphVelocity.selftest.mjs   # 16  the option surface and the three upstream
                                                           #     three.js properties the wrap depends on
node packages/core/src/voice/visemes.selftest.mjs          # 59  punch-list 4.1 / 4.2 / 4.4
node packages/core/src/voice/prosody.selftest.mjs          # 26  punch-list 4.5

# Blender (5.2.0 LTS)
/Applications/Blender.app/Contents/MacOS/Blender --background --python <script>

# LM Studio
/Users/robault/.lmstudio/bin/lms ps
curl -s http://127.0.0.1:1234/v1/models
```

**Environment:** MacBook Pro, Apple M5 Max, 40 GPU cores, 128 GB. Node 24.13.1. Blender 5.2.0 LTS.
ffmpeg 8.1.2. Playwright 1.62.1. Chrome reports `webgpu` / `apple metal-3`.

⚠️ `npm init` **cannot** derive a package name from this directory (non-ASCII character).
`package.json` is hand-maintained. Editing it with Python `json.dumps` will escape the 姿 —
pass `ensure_ascii=False`.

---

## Part 4 — The workflow pattern that works

```js
phase('Build')
const built = await parallel([ /* 3-4 agents, DISJOINT FILE OWNERSHIP */ ])

phase('Verify')
const checks = await parallel([
  adversarialVerifier(built),   // re-executes; assumes claims overstated
  visualJudge(built),           // opens a browser, looks, judges against the gate
])
```

What makes it work:
- **Disjoint file ownership per agent.** Stated explicitly in every prompt. Zero collisions so far.
- **Give agents the measured constants** and tell them not to invent numbers already in `research/`.
- **Tell them an honest failure report beats a plausible partial claim.** They comply, and it is
  the most valuable output.
- **Separate the builder from the judge.** Builders are systematically optimistic about their own work.
- Verifiers should **not fix anything** — report only. Mixing the roles loses the signal.

Cost so far: ~4.4M subagent tokens across four workflows for Phases 0–2.
