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

### 1.12 Practical traps that cost real time

**A scratch vector passed as an output target aliases itself.** `selfCheckFractionOfStature` called
`centreOfMass( this.scratch )`, and `centreOfMass` used `this.scratch` as its own per-segment temp.
The result was garbage that *looked* like a plausible small number (0.0239). It was caught only
because the gate ran on known-bad input in the same pass and both directions returned the same
wrong value. Give measurement methods their own result vector.

**A concurrent agent's file edit will kill a long browser capture.** Vite's watcher fired HMR while
`capture.mjs` was 211 frames into a 3600-frame run; Playwright reported "Execution context was
destroyed, most likely because of a navigation." Long captures and fan-out edits do not mix — run
captures either before the fan-out or after it lands.

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

### LM Studio

See `research/lm-studio-integration.md`. Two blockers: **schema-constrained output arrives in
`reasoning_content`, not `content`**, and thinking **cannot be disabled** by any documented path,
so the schema constraint is load-bearing rather than optional. ~0.7 s per call.

---

## Part 3 — Commands known to work

```bash
# Dev server (serves packages/testbed)
npm run dev                                    # http://localhost:5173/alive.html

# ⚠️ `npm run build` builds ONLY packages/testbed/index.html — vite's default single entry.
# alive.html and every page under src/ are NOT in it, so a broken import in alive.js, stage.js,
# skin.js, eye.js or lighting.js passes the build. To prove the pages resolve, build them
# explicitly with a temp config listing all six HTML entries:
#   index.html, alive.html, src/stage.html, src/skin.html, src/eye.html, src/lighting.html
npx vite build --config <temp config listing all six HTML entries>
# (68 modules vs 13; alive, stage, skin, eye and lighting each get their own chunk.)
# Confirmed in that build: SkinMaterial's `new URL(`...${figureName}-curvature.png`, import.meta.url)`
# IS handled — vite's dynamic-URL glob emits all five curvature PNGs as hashed assets, so the
# runtime lookup resolves in production as well as in dev.

# Perf spike pages (need a repo-rooted vite; the main config roots at the testbed
# and SPA-falls-back, returning HTTP 200 with the WRONG page)
npm run spikes

# Rebuild all five figures (~6 s each, byte-for-byte reproducible)
bash tools/figure-pipeline/build.sh

# The asset gate — skinning, materials, ARKit 52, visemes, all seven meshes, eye geometry
node tools/figure-pipeline/verify_glb.mjs

# The corneal radius of curvature, and whether the docs still agree with it (§1.11c)
node docs/eye-optics-claims.selftest.mjs

# Objective visual gates (the six measured Stellar Blade properties)
node tools/critic/measure.mjs <png> <regions.json>
node tools/critic/selftest.mjs                 # 79 checks

# Committed region files. Both were authored against 900x1200 at the portrait framing constants
# (26 deg FOV, 0.42 m portrait height, eye line a third from the top, camera 12 deg off axis),
# which packages/testbed/alive.html and src/lighting.html SHARE — so one file measures both.
# ⚠️ Pin the motion state first: alive.html at ?preroll=6 yaws the head 35.8 deg and the rects
# then land on different anatomy. Use ?freeze with NO pre-roll. See §1.17.
node tools/critic/measure.mjs <png> tools/critic/regions.lighting-portrait.json --human
node tools/critic/measure.mjs <png> tools/critic/regions.lighting-body.json --human

# The Phase 3 shading gates
node packages/core/src/material/EyeMaterial.selftest.mjs      # 99 checks
node packages/core/src/render/LightingRig.selftest.mjs        # 34 checks
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

# alive.html now carries the Phase 3 materials. Controls for an A/B:
#   ?skin=0     body keeps the shipped GLB material
#   ?eyes=0     eye shells keep theirs
#   ?shadows=0  rig without its shadow-casting half

# Blind A/B — strips provenance so a critic genuinely cannot tell which is ours
node tools/critic/blind_ab.mjs <a.png> <b.png>
node tools/critic/blind_ab.mjs reveal

# Deterministic video capture — THE observation instrument. Byte-reproducible.
# --keep-frames is NOT optional if you intend to heat-map the result; without it the
# PNG sequence is deleted and only the mp4/gif survive.
node tools/critic/capture.mjs --url "http://localhost:5173/alive.html?bare&frame=body" \
     --seconds 90 --fps 30 --width 700 --height 1200 --seed 1 --keep-frames --out captures/idle

# Per-pixel temporal-σ heat map — see §1.10. PIN --normalise to compare two clips.
node tools/critic/heatmap.mjs <capture-dir> --stride 5 --normalise 12 --bands 12
node tools/critic/heatmap.selftest.mjs           # 57 checks

# The dev server the captures drive. Start it through the harness (.claude/launch.json,
# name `sugata-testbed`), NOT with bash — and note that ANY file edit while a capture is
# running fires HMR and kills it. See §1.12.

# Motion-layer selftests
node packages/core/src/figure/bodymass.selftest.mjs
node packages/core/src/figure/figure.selftest.mjs
node packages/core/src/motion/MotionStack.selftest.mjs
node packages/core/src/motion/ocular.selftest.mjs
node packages/core/src/motion/Gaze.selftest.mjs
node packages/core/src/motion/idle-motion.selftest.mjs
node packages/core/src/motion/sway.selftest.mjs
node packages/core/src/motion/BodyIdle.selftest.mjs
node packages/core/src/motion/FacialIdle.selftest.mjs
node packages/core/src/figure/restpose.selftest.mjs

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
