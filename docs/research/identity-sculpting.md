# Identity sculpting — measured feasibility

Researched 2026-08-08. Every number below that describes *this* pipeline came out of running
headless Blender 5.2.0 LTS against the installed MPFB and measuring the result, or out of loading
an exported GLB through three.js r0.185.1 and measuring that. Nothing about our own pipeline is
inferred.

Confidence markers, matching `research/wardrobe-system.md` and `research/stellar-blade-look-spec.md`:

- **[X]** Executed — a build was run, a file was written, a number came out of it
- **[V]** Verified against a primary source (spec text, standard, source code read)
- **[M]** Measured from the artefact
- **[I]** Inference, explicitly flagged
- **[✗]** Searched for, does not exist / could not be retrieved

🚩 **Provenance for every `[X]`/`[M]` number.** Blender 5.2.0 LTS (`fbe6228777e7`, built
2026-07-14), MPFB build `20260722`, system targets at
`~/Library/Application Support/Blender/5.2/extensions/user_default/mpfb/data/targets`, faceunits
and clothes in the sibling `.user/user_default/…` tree, on the M5 Max. The probes and the scratch
build script live outside the repo at `…/scratchpad/identity/`. **The scratch build script is
`tools/figure-pipeline/build_figure.py` plus one option** (`--identity-target REL=W`); built with
no identity target it emits an 11,567,392-byte GLB, **the same byte count as the committed
`assets/figures/figure_g050.glb`**, and `node tools/figure-pipeline/verify_glb.mjs` passes it.
Every difference reported below is attributable to the identity targets and to nothing else.

---

## 0. What was already true before this document

Established by the coordinator, not re-derived here:

- `packages/core/src/figure/Identity.js` exposes `{gender, age, build, height}` and **three of the
  four are no-ops**. The file says so in code: `NOT_YET_BAKED = [ 'age', 'build', 'height' ]`.
  Only `gender` works, through five baked GLBs at 0.00 / 0.25 / 0.50 / 0.75 / 1.00, ~11 MB each.
- The gender axis is **exactly linear** — max |V(0.5) − ½(V(0)+V(1))| is 2.2e-13 mm — which is why
  five bakes suffice for it, and why blending two of them costs ≤ 0.342 mm.
- **1,258 modelling targets are already installed** with the MPFB addon.
- The morph budget is measured and is not to be re-estimated: **69 GPU morph targets on 13.7k verts
  cost 0.219 ms/frame**, ≈ 0.0032 ms per target, and morph normals cost 2.3×.
- Phase 9 measured that a garment **cannot** be shared across the five gender bakes: mean
  95.145 mm drift g000 → g100, and cross-fitting leaves 84.4% of covered skin outside the cloth.

Two things this document adds to that opener before anything else, because they reframe the
question the phase is answering:

> 🎯 **The 1,258 files are not 1,258 parameters.** MPFB ships `targets/target.json`, which groups
> the detail targets into **203 slider categories across 21 body regions — 195 bidirectional and 8
> unipolar** (see §2.2's ⚠️) — 530 of
> the 1,258 files. Of the rest, **348 are the interpolation corpus for eight macro sliders** and
> **228 are the corpus for two more** (cupsize, firmness); **102 are the legacy FACS expression
> units** (34 × 3 ethnicities) and **62 are the asymmetry set**. The real exposed count is
> **203 sliders, or 269 if left and right are split.** §2 has the per-region table.

> 🎯 **And Identity.js's own reason for existing — "glTF cannot morph a skeleton" — does not apply
> to the face at all.** The shipped `game_engine` rig has **53 bones and not one of them is
> facial**: above the clavicles there is `neck_01` and `head`, and nothing else. Measured, a face
> identity strong enough to move 5,340 vertices by up to 23.2 mm moves **0 of 106 bone ends, by
> exactly 0.000 mm**. §1.3.

---

## 1. 🎯 The four findings that decide the phase size

### 🎯 1. An identity target is a pure additive per-vertex offset. CPU application reproduces Blender to 1.1e-4 mm. **[X][V]**

Read at source first. A `.target` file is `index x y z`, one line per moved vertex, no header, no
scale field, no dependency on the current shape. `TargetService._target_string_to_shape_key_info`
reads it as `(x, −z, y)` — MakeHuman is Y-up, Blender is Z-up — and
`_set_shape_key_coords_from_dict` does `sk_buffer[base] += x * scale_factor` and nothing else.
**There is no solver in the loop.** `targetservice.py:345, 377-379, 434-437`.

Then measured, because a source read is not an execution. Three identities were applied to the
19,158-vertex basemesh at g050, and the result compared against a prediction computed in plain
Python from the `.target.gz` files alone, with no Blender in the loop:

| identity | verts moved | identity magnitude, max | **CPU-vs-Blender, max** | mean |
|---|---:|---:|---:|---:|
| face, 7 targets at 1.00 | 5,340 | 23.218 mm | **1.09e-4 mm** | 4.67e-6 mm |
| face, same 7 at 0.25 | 5,340 | 5.804 mm | **2.73e-5 mm** | 1.17e-6 mm |
| body, 7 targets at 1.00 | 18,194 | 187.267 mm | **1.15e-4 mm** | 1.71e-5 mm |

> 🎯 **A 187 mm reshape is reproduced outside Blender to one ten-thousandth of a millimetre.**
> That is float32 round-off at metre scale, not an approximation. **Identity does not need MPFB at
> runtime, and it does not need a bake.** A JS consumer holding the `.target` data can produce the
> exact figure MPFB would have produced.

### 🎯 2. Identity and ARKit compose with **exactly zero** superposition error — and that is the problem, not the reassurance. **[X]**

The composition claim tested was `P(identity, arkit) = P(identity, 0) + P(0, arkit) − P(0, 0)`,
over all 19,158 vertices, for five faceunits on each of the three identities above:

```
jawOpen        superposition error, max: 0.000e+00 mm
eyeBlinkLeft   superposition error, max: 0.000e+00 mm
eyeBlinkRight  superposition error, max: 0.000e+00 mm
mouthClose     superposition error, max: 0.000e+00 mm
mouthPucker    superposition error, max: 0.000e+00 mm
```

Not "below tolerance" — **zero**, on all fifteen combinations. Blender relative shape keys sum,
and both layers are shape keys.

🚩 **Read the next row before concluding the expressions are safe.** The same probe measured each
faceunit's own travel on the base and on the reshaped figure:

| faceunit | peak travel on base | peak travel on face-extreme identity | peak travel on body-extreme |
|---|---|---|---|
| *(peak 3-D displacement magnitude, 19,158-vertex basemesh)* | | | |
| `jawOpen` | 38.738 mm | **38.738 mm** | **38.738 mm** |
| `eyeBlinkLeft` | 15.521 mm | **15.521 mm** | **15.521 mm** |
| `mouthClose` | 35.928 mm | **35.928 mm** | **35.928 mm** |
| `mouthPucker` | 8.709 mm | **8.709 mm** | **8.709 mm** |

> 🚩 **The expression does not "fight" the new proportions. It ignores them.** A blendshape is a
> fixed absolute displacement, and it stays fixed to the last digit no matter what identity does to
> the face underneath. So the failure is not distortion — it is **under- and over-shoot**: an
> expression authored to close a 15.5 mm eye still travels 15.5 mm when the eye is bigger, and the
> eye does not shut.

**How much under- or over-shoot, exactly.** §1.2a.

### §1.2a The closure error, measured per identity **[X]**

The instrument: a blendshape closes a gap when the margin it drives, displaced by its own fixed
delta, arrives at the margin it does not drive. Identity moves both. So

```
closure error = (identity's vertical displacement of the weakly-driven margin)
              − (identity's vertical displacement of the strongly-driven margin)
```

and the two margins are identified **by the blendshape itself** — strongly driven is ≥ 75% of the
faceunit's own peak travel, weakly driven is ≤ 15% of it — so the definition follows the faceunit
onto any figure and needs no anatomical vertex list. Positive means the lids now overlap (the eye
shuts early and drives through itself). Negative means the eye no longer shuts, by that many
millimetres.

Peak `eyeBlinkLeft` **vertical** travel on the 19,158-vertex basemesh is 15.50 mm. (§1.2's table
quotes 15.521 mm for the same morph because that column is 3-D displacement magnitude, not the
vertical component. On the exported 13,380-vertex figure the same morph reads **12.600 mm** — the
helper strip removes the vertices that carried the peak. **Quote the number with its mesh.**)

| identity (targets at 1.00 unless noted) | `eyeBlinkLeft` closure error | as % of travel |
|---|---:|---:|
| `l/r-eye-height2-incr` (taller eye opening) | **−1.543 mm** | −10.0% |
| `l/r-eye-scale-incr` (bigger eye) | **−1.049 mm** | −6.8% |
| `l/r-eye-scale-decr` (smaller eye) | **+1.042 mm** | +6.7% |
| the 7-target face identity, at 1.00 | **−1.022 mm** | −6.6% |
| the same 7 at 0.25 | −0.256 mm | −1.6% |
| `head-scale-horiz-incr` (wider skull) | +0.016 mm | +0.1% |
| `l/r-eye-trans-out` (eyes further apart) | **+0.000 mm** | **+0.0%** |
| `chin-height-incr`, `mouth-scale-horiz-incr` | +0.000 mm | +0.0% |

> 🎯 **Three things fall out of that table and each one changes the design.**
>
> **(a) The damage is bounded and small.** The worst single identity target in the set costs
> 1.54 mm of a 15.50 mm closure — 10%. Not "the expression breaks"; "the eye is 1.5 mm open at full
> blink." Whether 1.5 mm of sclera at portrait framing is visible is **not** something this
> document can answer: the standing constraint records that there is *no measured visibility
> threshold for this project's framing*, only a 0.48–10.6 px bracket. It needs a plate and a judge.
>
> **(b) It is localised, not global.** Targets that move a region *rigidly* — translating the eye
> outward, widening the whole skull, lengthening the chin — cost **exactly zero**, because they
> move both margins by the same amount. Only targets that change the *size of the gap the
> blendshape has to cross* cost anything. That is a rule the UI can act on: **the expensive sliders
> are a nameable minority.**
>
> **(c) It is exactly linear in weight.** −1.022 mm at 1.00 against −0.256 mm at 0.25 is a ratio of
> 3.99. So a corrective is a single scalar per (faceunit × slider) pair, not a curve.

---

#### 🚩 §1.2a re-measured on the SHIPPED EXPORT, 2026-08-09 — worse than the table above, with one sign flip

Every figure in the table above was taken on the 19,158-vertex Blender basemesh. **Phase 10.3 must
be sized off the mesh that renders**, and it does not agree. Instrument:
`node tools/identity-pipeline/measure_expression_cost.mjs`, on `base.001` / 14,517 glTF positions.

**What holds.** Peak travel is invariant to identity to **0.000000 mm** across eight identities
including the extreme, so §1.2's superposition finding is true where it renders. `jawOpen`'s 3-D
peak reads **38.738 mm** on both meshes.

**What does not.** Against eyeBlinkLeft's own **12.600 mm** vertical travel on this mesh:

| target @1.0 | shipped export | §1.2a above (basemesh) |
|---|---:|---:|
| `eye-height2-incr` | **−1.827 mm (−14.5%)** | −1.543 mm (−10.0%) |
| `eye-scale-incr` | −1.017 (−8.1%) | −1.049 (−6.8%) |
| `eye-scale-decr` | +1.009 (+8.0%) | +1.042 (+6.7%) |
| `eye-trans-out` | **+0.000 (0.0%)** | +0.000 — rigid-motion zero **CONFIRMED** |
| `head-scale-horiz-incr` | **−0.186 (−1.5%)** | +0.016 (+0.1%) — **SIGN FLIP, 11×** |
| composed face identity @1.00 | −1.015 (−8.1%) | −1.022 (−6.6%) |
| composed face identity @0.25 | −0.254 (−2.0%), ratio **3.996** | −0.256 |
| **eyes region, every slider @1.0** | **−8.721 (−69.2%) — the eye does not close** | not measured |
| **composed face identity → `mouthPucker`** | **−2.293 mm of 6.100 (−37.6%)** | not measured |

🚩 **Conclusion (b) above is wrong for the skull case.** `eye-trans-out` really is +0.000, so the
rigid-motion class is not empty — but *widening the whole skull is not in it* on the shipped mesh,
and it costs eleven times what the basemesh table says, in the other direction.

🚩 **The mouth row is the one nobody priced.** §1.2a only ever measured mouth faceunits against eye
sliders. A composed face identity costs `mouthPucker` **four times** what it costs eyeBlinkLeft on
the same identity. 10.3's corrective table needs a mouth row.

✅ **Conclusion (c) survives intact** — ratio 3.996 between weight 1.00 and 0.25 — so a corrective is
still one scalar per pair. There are just more pairs and they are bigger.

⚠️ **The mesh-vs-instrument attribution is NOT settled.** The shipped-mesh instrument's
weakly-driven set is *"non-zero |Δy| ≤ 15% of peak"*; §1.2a's stated rule above has no non-zero
qualifier, and without one the band sweeps in the ~12,000 vertices the morph never touches, which
makes the answer a statistic about the shins. The disagreement could be the mesh or could be that
clause, and §1.2a's instrument was not re-run to find out. **10.3 should settle it.**

⚠️ **What this instrument does NOT establish.** It measures the *vertical* gap between two
blendshape-defined vertex sets. It does not prove the lids meet in three dimensions, it says
nothing about the corners of the fissure, and it cannot see a lid that closes but folds wrongly.
Three earlier attempts at a direct mesh-space closure measurement all failed and are recorded in
§7 rather than deleted; the correct instrument is a ray-cast against triangles or a render, and it
belongs in the phase as a gate, not in this document as an assertion.

### 🎯 3. The skeleton follows the mesh exactly, refits in 33 ms, and the FACE has no skeleton to break. **[X][V]**

MPFB places every bone from the basemesh itself. `entities/rig.py:272-300` gives four strategies —
`CUBE` (the centroid of a named helper "joint cube"), `VERTEX` (one named basemesh vertex), `MEAN`,
and `XYZ` — and `rig.game_engine.json` uses `CUBE` for essentially everything. **The bone positions
are a pure function of the vertex array and a JSON file.**

Measured, control rig against a rig built from scratch on a reshaped figure, all 53 bones × 2 ends:

| identity | bone ends moved > 1 mm | mean travel | max travel | worst joints |
|---|---:|---:|---:|---|
| **face, 7 targets at 1.00** | **0 of 106** | **0.000 mm** | **0.000 mm** | — |
| body, 7 targets at 1.00 | 97 of 106 | 10.979 mm | 18.727 mm | `foot_r/l.tail`, `ball_r/l`, `calf_r/l.tail`, `Root` 17.540 mm |

The face result is not a bug and it is not luck. `rig.game_engine.json` has **53 bones**, and above
the clavicles the complete list is `neck_01` and `head`. There is no jaw bone, no eye bone, no
facial bone of any kind — the face is driven entirely by morphs, which is what the standing
constraint *"the mouth belongs to lipsync"* already assumes. (For contrast, MPFB's `default` rig
has **163** bones including `jaw`, `eye.L/R` and a fourteen-bone tongue. We do not ship it.)

⚠️ **This narrows, and partly corrects, `base-mesh-verification.md` Finding 4.** That finding
reports head-region joints shifting up to 17.5 mm across the gender sweep and warns that *"jaw
pivot and eye placement drift about a centimetre."* On the rig we actually ship there is no jaw
pivot and no eye joint to drift; what moves is `head` and `neck_01`. The warning is right about
gender (which moves the whole skull) and does not transfer to face identity.

**And the refit is exact and fast.** `RigService.refit_existing_armature` rebuilds an existing
armature against a changed basemesh:

```
refit wall clock                                : 0.0312 s (face identity), 0.0327 s (body identity)
joints moved by the refit, max                  : 18.727 mm  (body identity)
refit result vs a rig built from scratch, max   : 0.000 mm
refit result vs a rig built from scratch, mean  : 0.000 mm
```

> 🎯 **A refit reproduces a from-scratch fit to zero millimetres in 33 milliseconds.** So
> per-identity rig fitting is not a research problem and not a bake-farm problem — but it is
> **build-time only**, because MPFB is GPLv3 and the standing constraint forbids shipping it. §4.2
> says what the runtime path is.

### 🎯 4. A garment cannot survive identity, and the reason it cannot is also the reason a runtime refit is nearly free. **[X][V]**

Two body identity targets — `upperlegs-height-incr` and `measure-shoulder-dist-incr` — were built
with `female_casualsuit01` attached, against a control build of the same garment. Paired vertices,
same garment, two bodies, the same measurement `wardrobe-system.md` §3.3 made for gender:

| | mean | median | p95 | max |
|---|---:|---:|---:|---:|
| **garment drift**, control → identity 1.00 | **28.722 mm** | 2.496 mm | 106.885 mm | **106.887 mm** |
| body drift, control → identity 1.00 | 32.715 mm | 24.900 mm | 106.885 mm | 106.885 mm |
| garment drift, control → identity 0.25 | 7.181 mm | 0.624 mm | 26.721 mm | 26.722 mm |
| body drift, control → identity 0.25 | 8.179 mm | 6.225 mm | 26.721 mm | 26.721 mm |

> 🚩 **Two body sliders move a garment 106.9 mm — three quarters of what the entire gender sweep
> moved it (143.066 mm).** The garment tracks the body at 87.8% of its mean drift, against 90% for
> gender. A per-gender fragment scheme does not survive continuous identity: the five bakes become
> five bakes × an unbounded identity space.
>
> And the drift is **exactly linear** — 28.722 / 7.181 = 4.000 — as §1.1 requires.

**But the fit rule is arithmetic, and it is portable.** `ClothesService.fit_clothes_to_human`
(`clothesservice.py:175-235`) is, in full:

```
v_garment = w1·V[a] + w2·V[b] + w3·V[c] + offset ⊙ (x_size, z_size, y_size)
```

where `(a, b, c, w1, w2, w3, offset)` come from the `.mhclo` and the three sizes are ratios between
six named basemesh vertices. No solver, no iteration, no Blender. Measured on
`female_casualsuit01`:

```
garment vertices                        : 2,197
distinct basemesh indices referenced    : 1,885
max basemesh index referenced           : 17,975
of those, indices >= 13,380 (HELPERS)   : 1,879
refit cost, 2,197 verts, 200 runs       : 0.0064 ms median  (min 0.0063, max 0.0612)
```

~~⚠️ **The 1,879 figure rests on one assumption, stated rather than buried:** that hm08's helper
geometry occupies the HIGH indices, so "index ≥ 13,380" and "is a helper" are the same set. The
max referenced index of 17,975 against a 19,158-vertex basemesh and a 13,380-vertex shipped body
is consistent with it, and it is how MakeHuman appends helpers — but **the index map was not
dumped and diffed.**~~

✅ **RETRACTED 2026-08-09 — IT WAS DUMPED AND DIFFED, AND THE ASSUMPTION HOLDS EXACTLY.**
`figure_g050.glb`'s body mesh has **14,517 glTF positions**; matched by coordinate against the
19,158-vertex Blender basemesh they resolve to **13,380 distinct basemesh vertices with max index
13,379** — zero unmatched, zero ambiguous, worst coordinate agreement **2.4e-7 m**. Validated on all
five gender bakes, where split copies coincide at **0.00 mm**. (The 14,517 against 13,380 is the
glTF exporter splitting vertices on UV seams, not a discrepancy.) The map ships as
`assets/identity/figure-vertex-map.{json,bin}`, is solved by
`tools/identity-pipeline/build_from_blender.mjs` and is gated by `identitytargets.selftest.mjs`.
It was solved by coordinate matching rather than read out of the export deliberately: re-exporting
to add an index attribute would change every GLB's sha256 and every gate measured against it.

> 🎯 **A continuous garment refit costs 6.4 microseconds.** That is a thousandth of the 0.1609 ms
> the wardrobe already spends rebuilding the body index buffer at dress time. Cost is not the
> obstacle.
>
> 🚩 **The obstacle is that 1,879 of the 1,885 vertices the fit rule reads are HELPER geometry the
> export deletes.** `bake_modifiers_remove_helpers` strips them; the shipped body has 13,380. So a
> runtime refit needs those helper positions shipped alongside the body — **1,885 × 3 × float32 =
> 22.6 KB per garment**, or one shared array of the union across the catalogue. That is the entire
> engineering cost of making the wardrobe identity-continuous, and it is a rounding error against
> the 8.7 MB of PNG one suit already costs.

⚠️ **Not measured:** whether a refitted garment's *fit quality* holds — the 26.37% covered-skin and
9.19 mm worst-depth numbers Phase 9.4 gates on were not re-measured on a refitted identity garment.
The refit reproduces MPFB's own arithmetic, so it should reproduce MPFB's own fit, but "should" is
not a measurement. **Gate it in 10.9.**

### §1.5 🚩 And the project's own asset gate already FAILS an identity figure — on the eye. **[X]**

`node tools/figure-pipeline/verify_glb.mjs` was run, unmodified, on the identity builds:

| build | verdict | left corneal dome | fitted sclera radius |
|---|---|---|---:|
| control (= `figure_g050`) | **PASS** | 0.680 mm proud, 3.37× noise, needs 3× | 15.308 mm |
| face identity at 0.25 | **PASS** | 0.701 mm proud, 3.17× noise | 16.074 mm |
| eyes-bigger at 1.00 | **PASS** | 0.680 mm proud, 3.37× noise | 15.308 mm |
| **face identity at 1.00** | **FAIL, 2 problems** | **0.777 mm proud, 2.79× noise, needs 3× (0.836 mm)** | **18.372 mm** |

Every other assertion stayed green on every build — all 52 ARKit morphs, all 15 OVR visemes, the
anterior chamber, the cornea material, the neutral lip seal, skinning, materials.

> 🎯 **This is the single most encouraging result in the document, and it should be read as good
> news rather than as a defect.** The gate suite this project already owns is a *partial coherence
> gate*, and it fired on the first extreme identity it was shown, in the region the uncanny-valley
> literature implicates most (§3.3), without anyone designing it to.
>
> What it caught: `head-scale-horiz-incr` scales the eyeball proxy along with the skull, and the
> fitted sclera radius goes **15.308 → 18.372 mm**. A human eyeball is about 12 mm in radius. The
> control is *already* at 15.3 mm — deliberately, per the look spec's *"+35% larger eyes"* — and
> the identity pushes it to a 36.7 mm globe. The gate did not know any of that; it noticed that the
> corneal dome stopped being distinguishable from the fit noise, which is the same fact wearing
> different clothes.
>
> **Design consequence: the coherence gate of §3 is not a new subsystem. It is `verify_glb.mjs`
> plus an anthropometric clause, run at identity-commit time instead of at build time.**

### §1.6 The honest summary of Q1

**Yes, identity can be free — with three exceptions, all of which are bounded and priced.**

| claim | verdict | evidence |
|---|---|---|
| Identity morphs never animate, so they need not be GPU morph targets | ✅ | they are set once; the whole cost is one CPU pass, §1.7 |
| CPU application reproduces MPFB | ✅ **1.1e-4 mm** | §1.1 |
| 1,258 parameters cost zero per frame | ✅ | they are folded into the position buffer; the per-frame budget is unchanged at 0.219 ms for the 69 animating morphs |
| The baked-GLB combinatorial problem dies | ✅ **for the face** | §1.3: 0 of 106 bone ends move |
| …and for the body? | ⚠️ **no** | §1.3: 97 of 106 bone ends move up to 18.7 mm. A body identity still needs a skeleton refit, and glTF still cannot morph one |
| ARKit deltas stay valid | ⚠️ **valid but not rescaled** | §1.2a: up to −1.54 mm of closure on the worst single target, exactly linear, zero on rigid-motion targets |
| Garments stay valid | ❌ **no** | §1.4: 106.9 mm drift from two sliders — but a refit is 0.0064 ms once the helper vertices ship |

### §1.7 What the CPU pass costs **[X]**

Applying identity offsets to a 19,158-vertex array, measured in node, 50 runs, at the measured
per-target footprint of the face identity (5,340 moved vertices):

| targets applied | median |
|---:|---:|
| 10 | 0.0902 ms |
| 50 | 0.4700 ms |
| **203 (every slider at once)** | **2.0598 ms** |

Once, on change. Against the 16.6 ms frame that is an eighth of one frame for a full-slider
rebuild, and it is not in the frame loop at all. **The hypothesis in the brief is confirmed: the
per-frame cost of 203 identity sliders is zero.**

---

## 2. The parameter set

### 2.1 What the 1,258 files actually are **[V]**

Counted from the installed tree and from `targets/target.json`, which is MPFB's own grouping of
raw targets into UI sliders:

| bucket | files | what it is |
|---|---:|---|
| detail targets, grouped by `target.json` | **530** | **203 slider categories — 195 bidirectional, 8 unipolar**, 21 regions |
| `macrodetails/` | 348 | the interpolation corpus for `gender / age / muscle / weight / proportions / height` |
| `breast/` beyond the 12 detail targets | 216 | the corpus for `cupsize` and `firmness` |
| `expression/units/{african,asian,caucasian}/` | 102 | 34 legacy FACS units × 3 ethnicities |
| `asym/` | 62 | 31 asymmetry pairs, left and right |
| **total** | **1,258** | |

> 🚩 **`macrodetails` is NOT an advanced tier and must not be exposed as 348 sliders.** It is a
> combinatorial expansion. `macro.json` declares eight macro parameters, each split into 1–3
> piecewise-linear "parts", and the filenames are the corner cases the engine interpolates between:
> `universal-female-young-maxmuscle-minweight`, `caucasian-male-baby`,
> `male-old-minmuscle-maxweight-maxheight`, `female-young-averagemuscle-averageweight-idealproportions`.
> The combinations are named in `macro.json` itself — `racegenderage`,
> `genderagemuscleweight`, `genderagemuscleweightproportions`, `genderagemuscleweightheight`,
> `genderagemuscleweightcupsizefirmness`. **348 files, eight sliders.**
>
> This also answers the question the punch list raises about baking: `Identity.js`'s note that *"a
> 5x3 gender-by-age matrix is fifteen 11 MB GLBs"* describes a solution we no longer need. The
> macros interpolate on the CPU exactly as the detail targets do.

### 2.2 The 203 detail sliders, by region **[V]**

| region | slider categories | of which sided | sliders if L/R split | raw targets |
|---|---:|---:|---:|---:|
| mouth | 22 | 0 | 22 | 44 |
| nose | 21 | 0 | 21 | 42 |
| legs | 18 | 11 | 29 | 58 |
| eyes | 17 | 17 | 34 | 68 |
| head | 17 | 0 | 17 | 27 |
| torso | 17 | 0 | 17 | 34 |
| arms | 14 | 11 | 25 | 50 |
| ears | 11 | 11 | 22 | 44 |
| neck | 10 | 0 | 10 | 20 |
| chin | 8 | 0 | 8 | 15 |
| feet | 8 | 7 | 15 | 30 |
| hip | 7 | 0 | 7 | 14 |
| breast | 6 | 0 | 6 | 12 |
| hands | 6 | 5 | 11 | 22 |
| cheek | 4 | 4 | 8 | 16 |
| forehead | 4 | 0 | 4 | 8 |
| stomach | 4 | 0 | 4 | 8 |
| eyebrows | 3 | 0 | 3 | 6 |
| genitals | 3 | 0 | 3 | 6 |
| pelvis | 2 | 0 | 2 | 4 |
| buttocks | 1 | 0 | 1 | 2 |
| **total** | **203** | **66** | **269** | **530** |

Each category carries `has_left_and_right`, a `label`, and — for **195 of the 203** — an
`opposites` block naming the negative and positive target for each side, so those categories are
literally sliders running −1 → +1 and MPFB has already done the work of saying which file is which
end. **Do not re-derive this grouping; read `target.json`.**

⚠️ **CORRECTED 2026-08-09: eight categories are UNIPOLAR, and this section used to call all 203
bidirectional.** The seven `head-<shape>` categories — `oval`, `square`, `round`, `triangular`,
`invertedtriangular`, `diamond`, `rectangular` — and `chin-triangle` carry **no `opposites` block at
all**, name one file each, and run **0 → +1**. Every count this section gates on survives, and the
closing arithmetic is checkable: **66 sided × 4 + 129 unsided-bidirectional × 2 + 8 unipolar × 1 =
530** files exactly. It is also why the table above reads `chin` **15** raw targets rather than 16
and `head` **27** rather than 34 — those are the visible trace of it. Only the adjective was loose,
and it is loose in a way that produces a bug: **a UI that draws every category as a −1 → +1 dial
applies seven head shapes backwards.** `IdentityCatalogue` carries `range: bipolar|unipolar` per
slider and refuses a negative weight on a unipolar one; gated by
`packages/core/src/figure/identitycatalogue.selftest.mjs`.

🎯 **A sub-family worth naming separately: the 20 `measure-*` categories.** `measure-bust-circ`,
`measure-waist-circ`, `measure-hips-circ`, `measure-shoulder-dist`, `measure-upperarm-length`,
`measure-neck-circ` and the rest are targets keyed to *body measurements* rather than to shape
adjectives, so **the identity slider set and the garment-drafting input are largely the same
interface.** Phase 9.12 should read its body vector out of Phase 10's identity rather than
computing it separately.

⚠️ **CORRECTED 2026-08-09: there are 20, not 26, and the difference lands on Phase 9.12.** Counted
out of `targets/target.json` and gated at 20 by `identitycatalogue.selftest.mjs`: 3 arms, 1 feet,
1 hands, 5 legs, 2 neck, 8 torso. **The 26 is GarmentCode's input-vector size**
(`wardrobe-system.md` §4.3, line 563), carried across as if it were MPFB's count — and §2.4's own
table already reports MakeHuman's Measure tab as *"20 real-world measurements in 9 groups"*, which
agrees with the library and not with the old number. **Consequence: the identity slider set supplies
20 of GarmentCode's 26 measurements, so Phase 9.12 must derive the remaining six from the mesh or
default them.** Six inputs is a design decision, not a lookup.

### 2.3 The recommended exposed set

**Three tiers, and a rule about which tier owns which decision.**

| tier | count | what it is | who moves it |
|---|---:|---|---|
| **Macro** | **11** | `gender, age, muscle, weight, height, proportions, cupsize, firmness` + three ethnicity weights `african / asian / caucasian` (they sum to 1) | the AI first, always; a user who wants one slider |
| **Region** | **21** | one "amount" dial per region, driving a curated subset of that region's sliders in a named direction | the collaboration loop of §4 — this is the tier a human's "something's off about the jaw" lands on |
| **Detail** | **203** | the `target.json` categories, exactly as MPFB groups them | an AI that knows what it wants; a user in an advanced panel |

And an explicit **exclusion tier**, because saying what is off the dial matters as much:

| excluded | count | why |
|---|---:|---|
| `asym/` | 62 | standing constraint — but see §2.5, which argues for one narrow exception |
| `genitals/` | 3 | Phase 9.8's decency invariant makes them unreachable; exposing a slider nothing can show is a lie |
| `expression/units/` | 102 | these are expressions, not identity. They belong to Phase 5 as correction sources, per `base-mesh-verification.md` |
| the `measure-*` half of the detail tier | 20 | exposed, but as a **measurement** panel in centimetres, not as a −1 → +1 dial. A user asking for a 92 cm bust should type 92 |

**Why 21 region dials rather than something cleverer.** Because the region grouping is the one the
human eye already uses. "Something's off about the mouth" is a sentence people say; "something's
off about `mouth-cupidsbow-width`" is not. §4 depends on being able to narrow to a region before
searching inside it, and MPFB has already partitioned the space that way.

**Why not preset-plus-deviation as the primary model.** Presets are worth shipping — see 10.6 —
but as *starting points*, not as the parameterisation. The deciding factor is that this project's
figure is a **single ethnically-blended androgynous base** by deliberate design
(`Identity.js`: 0.5 is "the neutral base of this project, not a fallback"), and a preset library
would quietly reintroduce the categories MPFB's own authors warn about: *"Phenotypes are based on
preconceptions of artists … they encode by design stereotypes of MakeHuman artists."*
Presets that are *looks* ("angular", "soft", "long-faced") are fine. Presets that are *people* are
a different product.

**What would change my mind:** a measurement showing that a human collaborator cannot make
progress on 21 region dials — that the granularity is too coarse to fix what they can see. 10.11's
protocol gate is written to detect exactly that.

### 2.4 How shipped creators solve this, and the four patterns that recur

| system | tiers, and what the tier is bound to | counts |
|---|---|---|
| **MakeHuman** (our own target set) | **tab**: Main / Face / Torso / Arms&Legs / Gender / Measure / Custom / Random | **9 macro + 240 detail = 249**, from `modeling_sliders.json`. The 9 Main are Gender, Age, African, Asian, Caucasian, Muscle, Weight, Height, BodyProportions. **Measure tab = 20 real-world measurements in 9 groups** |
| **The Sims 4** | 🎯 **camera zoom** — Top / Macro / Micro, literally the R/G/B channels of a pick buffer | **18 body touch points**. Face architecture, verbatim from the GDC 2015 deck: **"Face = Archetypes + Modifiers"** |
| **MetaHuman Creator** | **tool identity**: Blend (broad) / Body Params / Head Transform / Head Sculpt (local) | **18 body types** at release; scan-database size **[✗] never published** |
| **Reallusion CC4** | **searchable tree** with "Currently Used", "Favorite", category filter and name search | **"Headshot Morph 1400+"**, 58 facial presets |
| **DAZ Genesis** | **hierarchy**: `Actor` = whole-figure morphs, region children = detail | ~193 head dials incl. a **Face group of 15 whole-face shapes** |
| Code Vein | **32 presets → 14 advanced tabs** | cleanest preset/detail split of the set |
| Dragon's Dogma 2 | **38 base heads**, and the choice **conditions** the downstream option set | 5 sections |
| Monster Hunter Wilds | 24 presets, and a per-feature **"Blending"** control sitting *above* the detail sliders | slider count unverified |
| Elden Ring | 10 presets, plus **"Adjust Face Template"** (blend across templates) and **"Similar Face"** (algorithmic nudge) | — |
| Black Desert Online | **mode**: direct mesh dragging primary, sliders as fine-control fallback | slider count **[✗] never published** |
| Cyberpunk 2077 | the counterexample — **no continuous sliders at all**, ~21 discrete options per feature | — |

🎯 **Four patterns, and our §2.3 proposal already matches three of them.**

1. **Two to three tiers, always, and the tier is bound to something physical rather than a
   beginner/advanced switch.** Zoom, tool, tab, mode, or a conditioning choice. Our Macro / Region /
   Detail is the same shape; the thing to steal is binding the tier to *camera framing*, the way
   Sims 4 does, since this project already has portrait and full-body framings defined.
2. **Preset-plus-deviation is near-universal; only the preset SOURCE varies** — curated scans
   (MetaHuman), invisible authored archetypes (Sims 4), designer presets, or other players
   (BDO's Beauty Album). §2.3 keeps presets as start points, which is the Code Vein / Elden Ring
   reading rather than the MetaHuman one.
3. 🚩 **Direct manipulation and sliders split by PARAMETER TYPE, not by skill level.**
   Spatial/shape → drag on the mesh; scalar/non-spatial → slider. The proof is that Sims 4 removed
   shape sliders in 2014 **and added colour and makeup sliders back in 2020**. For us: the 203
   shape categories are drag candidates; the 20 `measure-*` categories and the 11 macros are
   sliders. §2.3's measurements panel is on the right side of that line.
4. **At hundreds of parameters the answer is search + filter + recently-used + favourites, not more
   tabs.** Only CC4 actually ships it, and it is the tool with the most morphs. **269 widgets is
   squarely in that regime** and 10.10 should build the filter before it builds a fourth tier.

🎯 **The one pattern we should steal outright is MetaHuman's, because it is the coherence gate as a
shipped product.** Epic's own docs, verbatim: the sculpt system *"finds the closest combination of
real human facial features scanned into the MetaHuman database and approximates what you sculpt"*,
and the creator *"blends between actual examples in the library in a plausible, data-constrained
way."* On the body: *"as you change a measurement, you move through a statistical space defined by
real-life data, and some features in that data correlate. For example, changing the Muscularity
slider also changes the Fat property **unless you pin the parameter first**."*

**We cannot copy the database** (§3.2.6: Basel forbids derivatives, FLAME 2023 Open is the only
commercially usable model, and our own CC0 position is worth more than either). **But we can copy
the two behaviours**: correlated parameters that move together by default, and **pinning** as the
escape hatch. That is a better ergonomic answer to "203 independent sliders leave the manifold"
than a validator bolted on afterwards, and MPFB's macro layer already works this way (§3.2.6).

⚠️ One honesty note on the most-cited precedent. The Sims 4 GDC deck's only statement about sliders
is a slide reading *"Previous Sims Games — Series of UI sliders in Sims 3"*, filed under the goal
"Minimalist UI". **The published rationale is UI accessibility, not expressive power.** There is no
"sliders were bad because X" slide, and this document should not invent one.

### 2.5 ⚠️ The asymmetry constraint — and the case for one narrow exception

**The constraint, verbatim from `PUNCHLIST.md`:** *"Do not add facial asymmetry, blemish noise,
pore detail, or white sclera — all four are wrong for this target, per measurement."*

**Its source, verbatim from `research/stellar-blade-look-spec.md` §"Facial asymmetry is
deliberately ABSENT":** *"The face is near-symmetric; asymmetry is delegated entirely to hair,
fringe and lighting. **Do not add facial asymmetry** — the usual realism advice is wrong for this
target."* The look spec's parameter block restates it as `facial asymmetry      NONE.`

**What the constraint was actually about.** Read in place, it is a rebuttal to a specific piece of
received wisdom — *"real faces are asymmetric, so add asymmetry to make a CG face read as real"* —
measured against a specific reference and found wrong for it. The sentence that follows it is about
**blemish noise** and hand-placed decorative marks. It sits in a section about *procedurally
generated* imperfection.

**The case that it should still hold, and it is strong:**

- It is a **measurement against the look target**, not a taste. R3 is binding and the look spec is
  its specification.
- The 62 `asym/` targets are **not a considered asymmetry system**. They are 31 pairs named
  `asym-eye-3-l/r`, `asym-nose-4-l/r`, `asym-temple-2-l/r` — numbered variants with no semantic
  label, the classic MakeHuman "randomiser fodder" set. `RandomizationService` is what they exist
  for. Exposing them as sliders exposes 31 dials nobody can describe.
- Phase 8's blind critic compares against Stellar Blade. Asymmetry moves us away from the thing we
  are judged against, on an axis the judge is explicitly told to look at.
- 🚩 **And there is a measured cost nobody has priced.** All 62 asym targets are single-sided by
  construction, so every one of them breaks the left/right invariance the rest of the pipeline
  assumes. `TargetService.symmetrize_shape_key` and `_load_mirror_table` exist precisely because
  MPFB expects most work to be mirrored.

**The case for one exception, and it is narrow:**

- The constraint was written about a **procedurally generated** face. This phase is about a
  **user-and-AI-authored** one. "Do not add asymmetry by default" and "refuse an author who asks
  for it" are different rules, and only the first was measured.
- The brief's premise is an AI *choosing how to represent itself*. A permanent ban on any
  left-right difference is a statement about what an AI's face is allowed to be, made on the
  authority of a measurement about procedural noise.
- Real identity asymmetry that people *notice and own* is not the `asym-nose-4-l` kind. It is a
  scar, a differently-set eye, a crooked smile — a small number of deliberate, describable choices.

> **Recommendation: keep the constraint as the default and as the procedural rule; add a single
> explicitly-authored escape hatch, and gate it.**
>
> - The 62 `asym/` targets stay **out of the exposed set** and out of any randomiser. Unchanged.
> - Every one of the 66 sided detail categories may be driven **independently left and right** by
>   an author who asks for it — that is the 269-slider mode of §2.2, and it is opt-in per identity
>   with a recorded rationale (§5).
> - A new **measured** gate caps it: total left-right RMS deviation over the face region must stay
>   under a stated threshold unless the identity file carries `"asymmetry": {"intent": "…"}`.
>   Default off, so nothing changes unless someone says why.
>
> **What would change my mind:** if a blind judge in Phase 8 cannot tell an author-asymmetric
> figure from a symmetric one at portrait framing, the escape hatch is buying nothing and should be
> dropped. **[✗] Not measured here.** No plate was rendered for this document at all.

---

## 3. The coherence problem

The reason the phase exists. Individually plausible parameters combine into a face that reads as
wrong, and **this project has a measured, repeated finding that the AI does not reliably perceive
its own visual coherence** — nine rounds, and every time the visual judge found what every measured
gate missed.

So the question is not "can we replace the judge." It is **what can be measured, so that the judge
is spent on what only a judge can settle.**

### 3.1 🎯 The first gate, and it is the user's scenario

**The scenario.** An agent wants to read as *cute*. It places the eyes a little further apart.

**Step 1 — is the goal evidence-based?** Yes. The baby-schema / Kindchenschema cluster is real and
replicated: a large head relative to body, a large forehead, **large eyes relative to face height**,
a small chin, round cheeks. See §3.2 for the citations and the honest limits.

**Step 2 — is the inference right?** **No — but not for the reason I set out to prove, and the
correction makes the gate better rather than worse.** Half the hypothesis is confirmed hard and
half of it fails, and the half that fails is the half that would have been coded.

**Confirmed.** Eye SIZE is in the cluster; interocular SEPARATION is not. It is absent from
Lorenz's own seven points **[V]** (Lorenz 1943, *Z Tierpsychol* 5:235–409 p. 275, reproduced and
translated in Kawaguchi & Waller 2024, *Proc R Soc B* 291:20240570, **CC-BY 4.0**), and — the
decisive finding — **not one of the canonical parametric baby-schema studies manipulated it.**
Glocker et al. 2009 (*Ethology* 115(3):257–263) manipulated exactly six parameters: face width,
forehead/face length, **eye width ÷ face width**, nose length, nose width, mouth width. Borgi et
al. 2014 (*Front Psychol* 5:411, CC-BY) used the same six. Yao et al. 2022 altered eye size ±15%
and states verbatim that *"the original eye ratio … remained unchanged"*. Geldart, Maurer & Carney
1999 (*Perception* 28:361–374) varied eye width ÷ face width from 0.20 to 0.28 — ±3 SD off Farkas's
adult mean — and held separation fixed. **Five independent studies, one lever, and it is not this
one.**

🚩 **NOT confirmed, and I was wrong about it.** The claim that increased separation *"reads as a
craniofacial anomaly"* does not survive the literature at any magnitude an avatar tool would use:

- **Naran et al. 2018** (*J Craniofac Surg* 29(1):40–44) digitally increased intercanthal distance
  by **+10%** on 16 faces. The wider-set versions were rated **significantly more attractive**,
  more friendly and more submissive (p < 0.05). **No trait was rated worse.**
- **Haig 1984** (*Perception* 13(5):505–512), verbatim: *"high sensitivity to close-set eyes,
  coupled with marked insensitivity to wide-set eyes."* Observers barely notice widening.
- **Hall, Graham, Cassidy & Opitz 2009**, *Elements of Morphology: Standard Terminology for the
  Periorbital Region* (*Am J Med Genet A* 149A:29–39) — the dysmorphology consensus standard —
  states that data show interpupillary distance still increasing at 14–15 years, so the finding
  *"should only be made according to the subjective definition in persons above 15 years of age."*
  **There is no objective adult criterion for hypertelorism at all.**

> 🎯 **So the honest gate is narrower and better: eye separation is not a cuteness lever — it is
> INEFFECTIVE, not grotesque.** The agent's inference fails because it does nothing for the stated
> intent, not because it produces a monster. That is a *more* useful thing to tell an agent, and it
> is the difference between a gate that blocks and a gate that redirects.
>
> 🚩 **And the redirect points at a lever this document had not identified: VERTICAL eye position.**
> It is Lorenz's own item 3 — *"eyes which are large and deep … **lying below the centre of the
> skull**"* — and Komori et al. 2022 (*Front Psychol* 13:979341, CC-BY) recovered it from data:
> geometric morphometrics on 80 landmarks over children's faces, and **PC1, at 31.6% of variance —
> the single largest component — is relative eye and mouth position, with LOWER increasing
> cuteness.** PC2 is jawline width (narrower), PC3 forehead height (higher). Eye size does not
> appear as a named factor at all.
>
> **The best-evidenced cuteness lever is the one nobody reaches for**, and our `eye-line fraction`
> already measures it: `cute-correct` moved it 0.4358 → 0.4689 without anyone designing for it.

**Step 3 — is it catchable? Measured on our own figure. [X]**

Two identities were built and measured against the control. `cute-naive` is the scenario as
described: eyes moved apart, plus a modest eye-size and chin change. `cute-correct` is the same
intent served by the parameters the literature actually supports: bigger eyes, shorter chin, taller
forehead, **eye separation untouched.**

| measurement | control | `eyes-wide` (trans-out 1.0) | `cute-naive` | `cute-correct` |
|---|---:|---:|---:|---:|
| intercanthal, en–en | 27.789 mm | **36.989 mm** | **36.989 mm** | 27.789 mm |
| interpupillary, IPD | 57.708 mm | **66.908 mm** | **66.908 mm** | 57.707 mm |
| outer canthal, ex–ex | 87.951 mm | 97.151 mm | 97.151 mm | 87.951 mm |
| eye fissure length ⚠️ | 30.081 mm | 30.081 mm | 30.081 mm | 30.081 mm |
| bizygomatic proxy | 125.157 mm | 125.157 mm | 125.157 mm | 125.157 mm |
| **ICD / bizygomatic** | **0.2220** | **0.2955** | **0.2955** | **0.2220** |
| **canthal index** (100·ICD/OCD) | **31.596** | **38.073** | **38.073** | **31.596** |
| eye-line fraction (crown→eye / crown→chin) | 0.4358 | 0.4358 | 0.4358 | **0.4689** |
| face height | 243.441 mm | 243.441 mm | 243.441 mm | **258.601 mm** |

> 🎯 **The signature is unambiguous and a single ratio separates the two.** `eye-trans-out` moves
> the intercanthal distance **+9.200 mm** and the canthal index **+6.478 points** while leaving eye
> fissure length and face width **bit-identical**. Eyes further apart, same size, same face. That
> is the textbook telecanthus signature and nothing else in the parameter set produces it.
>
> Meanwhile `cute-correct` moves the axes the literature actually implicates — the eye line rises
> and the face lengthens — and leaves the canthal index **unchanged to four decimal places**.
>
> **The gate is one comparison, and it fires on exactly the wrong move and not on the right one.**

⚠️ **A real limitation of the instrument, stated because it bounds the gate.** "Eye fissure length"
above is derived from the **eyeball proxy's** medial and lateral extremes, not from the lid corners
— the palpebral aperture instrument failed three times (§7). So the fissure column tracks *orbit*
size, which is why `cute-correct`'s `eye-scale-incr` at 1.0 leaves it unchanged: that target
reshapes the lids and does not scale the globe (measured — the fitted globe centre and radius are
bit-identical across `eye-scale-incr`, `eye-scale-decr` and control). **The ICD/IPD/canthal-index
half of the gate is sound; the eye-size half needs the lid-corner instrument 10.3 builds.**

### 3.2 What the literature actually supports

#### 3.2.1 🚩 Population-matched norms, or the gate flags our own look target

The single most important design fact in this section. Intercanthal distance differs between
populations by more than the within-population SD:

| population | n | en–en, male | en–en, female | canthal index | source |
|---|---:|---:|---:|---:|---|
| **Korean ♀, young (26.4 y)** | 48 | — | **36.29 ± 3.17** | ~40.9 | Kwon 2021, *Ann Dermatol* 33(1):52–60 ⚠️ **CC BY-NC** |
| Korean, 40+ | ~7,569 | 36.5 ± 3.8 | 36.4 ± 3.5 | — | Lee 2019, *Sci Rep*, **CC-BY 4.0** |
| Hong Kong Chinese, 18–35 | 103 | 40.61 ± 4.91 | 38.27 ± 2.61 | **43.95 / 43.29** | Jayaratne 2013, *BioMed Res Int*, **CC-BY** |
| Spanish, ~22 y | 100 | 32.52 ± 4.52 | 31.38 ± 2.78 | 36.0 / 36.2 | Menéndez 2019, *BMC Oral Health*, **CC-BY 4.0** |
| Turkish, 20–35 | 200 | 33.17 ± 2.79 | 31.86 ± 2.36 | ~34.6 | Karaca Saygili 2016, *Folia Morphol* 75(4) |
| Pakistani | 499 | 31.2 ± 3.2 | 30.6 ± 2.5 | — | Hayat 2019, *Pak J Med Sci* 35(1), **CC-BY** |
| Saudi, 20–24 | 168 | 30.30 ± 3.10 | 30.32 ± 2.40 | — | Al-Sebaei 2015, *Head Face Med* 11:4, **CC-BY 4.0** |

> 🚩 **East Asian canthal index runs ~41–44; European ~35–36.** A gate hard-coded to a European
> norm would flag a healthy Korean face by roughly **2 SD** — and R3 binds this project to a
> Korean-idealised look target. **The threshold must be population-matched to the identity's own
> ethnicity weights**, which the Macro tier already carries as `african / asian / caucasian`.
> `Elements of Morphology` says so itself: *"Inner canthal distance varies among ethnic groups."*

Our control figure reads **en–en 27.789 mm** with the three ethnicity weights at 0.33 each — below
every population mean in the table. That is the stylised base, not an error, and it is exactly why
§3.4 reports a band rather than a verdict.

#### 3.2.2 The distinction the gate has to get right **[V]**

From `Elements of Morphology` (Hall et al. 2009), which is the consensus standard:

- **Ocular hypertelorism** — true lateral displacement of the orbits. **IPD, ICD and OCD all
  elevated.** Objective definition: IPD > 2 SD above the mean, or above the 97th centile, **for
  0–15 years only**.
- **Telecanthus** — **ICD elevated with normal IPD and OCD.** Soft tissue, not bone. This is what an
  epicanthal fold produces, and it is a large part of why East Asian ICD norms are higher.
- They are **independent**; either can occur without the other.

⚠️ **Our `eye-trans-out` figure moves ICD, IPD *and* OCD together by the same 9.200 mm** — so it is
the *hypertelorism* signature, not telecanthus. The gate should say which one it saw, because they
mean different things and only one of them has an ethnic confound.

Tessier's clinical severity bands (first degree ICD 30–34 mm, second 35–40, third > 40; StatPearls
NBK560705) are **surgical-planning bands and must not be used raw** — young Korean females average
36.29 mm and would read as "second degree."

#### 3.2.3 🚩 Landmark reliability decides which ratios are buildable at all

This reorders the gate set and it is the most actionable finding in the section. Published
per-landmark digitisation error, Li et al. 2022, *Aesthetic Plast Surg* 46(2):719–731, **CC BY 4.0**,
46 landmarks, intra- and inter-rater in mm:

| landmark | inter-rater error | verdict |
|---|---:|---|
| **pronasale** | **0.31–0.71** | best on the face |
| **endocanthion** | **0.49–0.67** | ✅ |
| exocanthion (Ort 2012) | 0.39 | ✅ |
| subnasale | 0.85–1.15 | ✅ |
| nasion | 1.07–1.08 | ⚠️ |
| trichion | 1.94 ± 1.05 | ⚠️ hairline-dependent |
| **zygion** | **2.00–2.59** | ❌ worst |
| **gonion** (Aldridge 2005) | **1.44–4.10** | ❌ |

And the reason, stated in the NIOSH/Anthrotech *Measurer's Handbook* (Bradtmiller & Friess 2004 —
a US federal contract work, the best licensing position of any source here): **zygion, gonion and
orbitale are located "by palpation" of bone.** Jayaratne & Zwahlen 2014 (*Craniomaxillofac Trauma
Reconstr* 7(2):101–107) put the consequence in one sentence: *"It is not feasible to incorporate
measurements associated with these landmarks to the 3D analysis scheme."*

> 🎯 **Note what that does to the gate ranking, and it is not a coincidence.** Canthal index,
> canthal tilt and fissure aspect ratio are built entirely from **en** and **ex** — the two most
> reliable landmarks on the face. Facial index and bigonial/bizygomatic need **zy** and **go** — the
> two worst, and on a soft-tissue mesh with no skull they are not available at all.
>
> 🚩 **So do NOT build the morphological facial index gate.** It looks like the perfect
> single-number check — a standard anthropometric index with published classification bands — and
> it is a trap: cross-method spread on zy–zy is **14.6 mm** (Turkish caliper 129.06 vs Spanish 3D
> 114.42), which is larger than any real population difference. **This document's own
> `facialIndexProxy` of 109.7 should be read as evidence for that warning, not as a measurement.**

#### 3.2.4 The recommended ratio set

| ratio | norm | source | landmark risk |
|---|---|---|---|
| **canthal tilt** | Korean **+8.0 to +8.8°**; Caucasian ~+2 to +4°; L/R asymmetry > 2° is a flag | Kwon 2021 (8.03 ± 2.56°); Lee 2020 *JKAOMS* 46(6) (8.45 ± 3.53°) ⚠️ both **CC BY-NC** | ✅ en/ex |
| **canthal index** 100·en-en/ex-ex | East Asian ~41–44, European ~35–36 | Jayaratne 2013 **CC-BY** | ✅ en/ex |
| **interocular / face width** | **0.46 ± 0.022** | Pallett, Link & Lee 2010, *Vision Res* 50(2):149–154 | ✅ |
| **eye width / face width** | adult **0.17 ± 0.01**, infant **0.19 ± 0.01** | Borgi 2014 **CC-BY**, via Kawaguchi & Waller 2024 | ✅ |
| **eye-mouth / face length** | **0.36–0.37 ± 0.017** | Pallett 2010 | ✅ |
| **eye-line fraction** (vertical eye position) | lower increases cuteness; PC1 = 31.6% of variance | Komori 2022 **CC-BY**; Lorenz 1943 item 3 | ✅ |
| fissure height/length | HK Chinese 41.84 ± 3.69 (M) / 45.89 ± 4.05 (F) | Jayaratne 2013 | ✅ |
| mid-face n-sn / n-gn | 43–47% across three populations | Jayaratne 2012 *PLOS ONE* **CC-BY** | ⚠️ needs gnathion |
| ~~morphological facial index~~ | — | — | ❌ **do not build** |
| ~~bigonial / bizygomatic~~ | published claims span 70–99%; **[✗] no defensible norm exists** | — | ❌ |

#### 3.2.5 The neoclassical canons are false, with numbers

Farkas, Hreczko, Kolar & Munro 1985 (*Plast Reconstr Surg* 75(3):328–338, n=153) is the classic
revision, and its own conclusion is verbatim: the canons *"do not represent the average facial
proportions and their interpretation as a prescription for ideal facial proportions must be
tested."* Best agreement of the nine was **40%** (interorbital width = nose width) and **37%**
(nose width = ¼ face width).

Jayaratne et al. 2012 (*PLOS ONE*, **CC-BY**) extended it across six populations:

| canon | N. Am. White | Afro-Am. | Vietnamese | Thai | Sing. Chinese | S. Chinese |
|---|---:|---:|---:|---:|---:|---:|
| three equal thirds | **0%** | **0%** | **0%** | **0%** | **0%** | **0%** |
| orbital (en-en = ex-en) | 33.0% | 13.0% | 0% | 0% | 0% | 0% |
| orbitonasal (en-en = al-al) | 40.8% | 3.0% | 16.7% | 21.7% | 26.7% | 19.4% |
| naso-oral (ch-ch = 1.5·al-al) | 20.4% | 1.0% | 0% | 1.7% | 1.7% | 8.7% |

> 🎯 **The equal-thirds canon is satisfied by ZERO people in six independent populations.** And the
> "rule of fifths" does not merely approximate in East Asian faces — it fails in one direction,
> universally: `en-en > ex-en` in **100%** of Hong Kong Chinese, Vietnamese and Singapore Chinese
> against **51.5%** of North American Caucasians. **Never gate on a canon.** Use them, if at all,
> as tolerance bands carrying their own published variant frequency.

#### 3.2.6 What a statistical face model would buy, and why we cannot have one

The alternative architecture is a PCA model over real scans, where plausibility is a property of
the space rather than a check bolted on. Blanz & Vetter 1999 (SIGGRAPH '99) states the goal in the
authors' own words: *"it is important to be able to quantify the results in terms of their
plausibility of being faces … This distribution enables us to control the likelihood of the
coefficients."* Their Eq. 2 is `p(α) ∝ exp[−½ Σ (αᵢ/σᵢ)²]`.

⚠️ **Two corrections worth carrying, because both are commonly got wrong:**

- **The "within ±3 SD" box constraint is Cootes's, not Blanz & Vetter's.** Active Shape Models:
  *"Apply constraints to the parameters, b … (eg limit so |bᵢ| < 3√λᵢ)."* BV99 gives the Gaussian
  prior; Cootes gives the box.
- 🚩 **"Every point in the latent space is plausible" is false, and the correction is
  counter-intuitive.** In high dimensions the probability mass of a Gaussian sits in a thin shell
  at Mahalanobis radius √d, not near the mean. Lewis, Mo, Anjyo & Rhee 2014, *Probable and
  Improbable Faces*: *"even if faces are truly 'Gaussian', maximum a posteriori and other
  applications … that assume that typical faces lie near the mean are not valid."* Patel & Smith
  2016 (*Pattern Recognition* 52:206–217) names it the **Face-Space Typicality Paradox** and gives
  the geometry: *"identity relates to direction in parameter space while distinctiveness is related
  to vector length"*; ‖ĉ‖² is χ²ₙ, and in a 100-D model *"over 99% of parameter vectors would have
  lengths between 70 and 130."* **The plausible region is an annulus, not a ball. Interpolate on
  the sphere, not linearly** — linear interpolation between two faces produces middles that, in
  Lewis's phrase, *"lack distinctiveness."*

🚩 **And the licences rule the models out anyway.**

| model | terms | usable? |
|---|---|---|
| **Basel Face Model 2009 / 2019** | §2.1 non-commercial research only, and **§3.3 "LICENSEE shall not … create derivatives based on the DATA"** | ❌ **derivatives prohibited, not merely commerce** — out entirely |
| FLAME 2017/2019/2020/2023 (academic) | non-commercial; explicitly bars training for commercial use | ❌ |
| **FLAME 2023 Open** | **CC-BY-4.0** since 11/2025, commercial use permitted | ✅ the only one |
| SMPL | academic; commercial via Meshcapade | ❌ as shipped |
| **MPFB2 / MakeHuman targets** | **CC0** | ✅ **ours already** |

> **Recommendation: do not adopt a statistical face model, and say why in the code.** The CC0
> position of our own asset set is worth more than the manifold — `base-mesh-verification.md`
> already records that MPFB2's LICENSE §D makes our exports unrestricted, and that is the property
> the whole project rests on. What we should steal is the *idea*: §3.4's bands are a hand-built,
> ratio-space approximation of the plausibility prior, and the honest framing is that they are a
> much weaker instrument than a real morphable model would be.
>
> 🎯 **One piece of good news the structure already gives us for free.** MPFB's macro layer *is*
> a barycentric blend over hand-authored anchors — `macro.json`'s piecewise-linear segments over
> the 564 combination targets — so **every point in macro space is on the manifold spanned by
> those anchors.** The 203 detail sliders are independent and additive and can leave it. **That
> split is already the coherence boundary**, and it argues for the Macro tier being the AI's first
> move, every time.

⚠️ **The one licensing landmine, flagged the way `research/affect-and-animation.md` flagged
NRC-VAD.** `Elements of Morphology` (Hall et al. 2009) — the source of the authoritative
hypertelorism and telecanthus definitions above — is **CC 3.0 NONCOMMERCIAL**. Its own footnote:
*"Individuals are free to copy, distribute and display this work and to make derivative works for
noncommercial purposes."* The two best Korean-specific norm tables, **Kwon 2021** and **Lee 2020**,
are both **CC BY-NC**. A mean and an SD are facts and facts are not copyrightable (*Feist v. Rural
Telephone*, 1991), so citing individual figures into our own constants file is defensible; **shipping
their tables or their text is not.** The commercially-clean Korean source is **Lee 2019,
*Sci Rep*, CC-BY 4.0, n = 7,569** — but it is 2D, age 40+, and uses non-standard landmark names.
**This is a real constraint and it should be recorded in the code beside every constant.**

### 3.3 ⚠️ The uncanny valley — what this document can and cannot claim

The brief asked specifically whether the eye region is disproportionately implicated. **The
dedicated literature pass for this question did not return within this document's window, so the
uncanny-valley subsection is the one place where the evidence standard is not met, and it is
recorded as a gap rather than filled with plausible prose.** What follows is only what came in
through the other two passes and can be attributed.

**What is attributable here:**

- 🎯 **The eye region dominates attention, measured.** Borgi et al. 2014 eye-tracked 3–6-year-olds
  and adults on infant faces: **46% of fixations and 47% of viewing time went to the eyes**,
  against 13% for the nose and 6–7% for the mouth **[V, CC-BY]**. That is an attention finding, not
  an eeriness finding, and it must not be quoted as the latter.
- **Feature displacement sensitivity is asymmetric and it is not uniform across the face.** Haig
  1984 (*Perception* 13(5):505–512), verbatim: *"the very high significance of the vertical
  positioning of the mouth, followed by eyes, and then the nose, as well as high sensitivity to
  close-set eyes, coupled with marked insensitivity to wide-set eyes."* **[V]** So the ordering the
  brief expected — eyes first — is not what this paper found: **mouth vertical position ranks
  above the eyes.** The numeric thresholds are paywalled **[✗]**.
- **There is a measured optimum with a measured fall-off on two facial ratios**, which is the
  closest thing to a dose-response curve found: Pallett, Link & Lee 2010, *Vision Research*
  50(2):149–154 — eye-mouth ÷ face length optimal at **0.36–0.37 (SD 0.017)**, interocular ÷ face
  width optimal at **0.46 (SD 0.022)**, with attractiveness falling off in *both* directions
  (t(69) = −9.7 and t(49) = −7.0, p < .001). Samples were 20–42 undergraduates, and the horizontal
  axis was only probed to ±20%, so the far tail is unmeasured. **[V]**

**What is NOT established here and must not be asserted:** whether the eye region is
disproportionately implicated in *eeriness* specifically; whether the valley replicates at all
(Kätsyri et al. 2015's sceptical review was not retrieved); whether realism *inconsistency* between
features drives it more than realism level; and whether any published work relates deviation-in-SDs
from a norm face to rated eeriness. **[✗] on all four.** A dose-response curve of that kind would
be the single most useful input to §3.4's bands, and this document does not have it.

⚠️ **A licensing landmine was found in the material that did arrive**, and it is the same shape as
`research/affect-and-animation.md`'s NRC-VAD finding: `Elements of Morphology` is **CC 3.0
NonCommercial**, and the two best Korean norm tables are **CC BY-NC**. See §3.2.6.

**10.4 should not ship an uncanny-valley clause on this evidence.** The ratio bands of §3.2.4 stand
on their own anthropometric footing; an eeriness threshold does not.

### 3.4 The coherence gate, and its ceiling

Structurally the gate is **`verify_glb.mjs` plus an anthropometric clause, run at identity-commit
time**, and §1.5 already showed the existing suite catching an extreme identity unaided. Three
bands, and they should be reported separately rather than collapsed to pass/fail:

| band | meaning | what happens |
|---|---|---|
| **inside the norm** | within ±2 SD of a cited population norm | silent |
| **stylised** | outside the norm but inside this project's own declared look target | reported to the AI with the number and the source; **not** blocked. The control figure is already here on eye size, deliberately |
| **outside human variation** | beyond a cited clinical or physical threshold | blocked pending an explicit, recorded waiver in the identity file |

🚩 **The ceiling, stated plainly, because overselling it is the failure mode.**

- **It catches the grotesque and it misses the merely odd.** A gate reads ratios; a face reads as
  a whole. Every ratio in §3.1 can sit inside its band on a face a judge calls wrong.
- **"Cute achieved through a combination that has no name" is not catchable by any gate.** There is
  no ratio for it. That is precisely what the human eye is for, and the protocol in §4 exists
  because the gate stops here.
- **A stylised target makes every norm advisory.** R3 binds us to a look whose own measured eye
  width is +35% against the anthropometric reference. A gate calibrated to real-population norms
  would flag the *shipped default*. So the norm is a **coordinate system**, not a boundary — the
  useful statement is "this identity is 2.4 SD from the norm on ICD and 0.1 SD on face width," and
  the second number is what makes the first mean something.
- 🚩 **And it must be proven red.** A gate that has never failed is decoration — the lesson
  `measure.mjs` learned when seven gates read green on a plate whose worst feature was unmissable.
  10.4's gate ships with `eyes-wide` as its red fixture, because that figure is built and its
  numbers are above.

---

## 4. The collaboration protocol

The user's ask, verbatim: *"It might be a good process for them to work together on helping AI
create a coherent representation."*

### 4.1 Roles, assigned where each party is measurably reliable

| | the AI is reliable at | the AI is **not** reliable at |
|---|---|---|
| evidence | it can compute every ratio in §3 exactly, to microns, on demand; it can enumerate which of 203 sliders touch a region; it can state what it intended | **it cannot see its own face.** Nine rounds of this project, and every single time the visual judge found what every measured gate missed — 97 green sway gates on a figure a judge called a mannequin |

| | the human is reliable at | the human is **not** reliable at |
|---|---|---|
| evidence | one glance settles coherence questions no gate in this repo has ever caught | naming the cause. "Something's off about the face" is the *correct* form of the human's contribution, not a degraded one |

> **So the protocol is not "the AI proposes and the human approves."** It is: **the AI measures and
> proposes, the human adjudicates and POINTS, and the AI translates.** The translation step is the
> only hard part, and §4.3 is about making it tractable.

### 4.2 The loop

```
1  INTENT      the AI states, in its own words, what it is going for.
               "approachable, young, soft — I want to read as someone who is easy to talk to."
               Written to the identity file (§5) BEFORE any parameter is set.

2  PROPOSE     the AI sets parameters and records, per choice, which part of the intent it serves.
               "eye-scale-incr 0.4 — 'young'."  "chin-height-decr 0.3 — 'soft'."

3  GATE        the coherence gate (§3) runs. Anything outside real human variation is reported to
               the AI with the ratio, the norm and the source, BEFORE the human is shown anything.
               This is where the hypertelorism case of §3.1 is caught.

4  RENDER      one plate, the framing the judge already uses.

5  JUDGE       the human says what they see. "Something's off about the face" is a complete and
               sufficient answer at this step. So is "this is great."

6  LOCALISE    the AI narrows "the face" to a region, by A/B, without the human naming anything.

7  TRANSLATE   inside the region, the AI proposes candidate moves, using the recorded INTENT as
               the prior over which axes to search. §4.3.

8  PREFER      🎯 the AI says which candidate IT prefers, and why, before the human chooses.
               Then the human chooses, and may overrule.

9  RECORD      the file records what the AI wanted, what was chosen, and that they differed.
               Loop to 4.
```

Step 8 is not decoration. The user's standing note on the wardrobe was that an AI able to express a
preference even when overruled is *"the difference between a puppet and a someone,"* and this is
the AI's **face**. The mechanism has to be in the loop, not in the tone: the AI states its
preference **before** the human answers, so it is a position and not a rationalisation, and step 9
persists the disagreement rather than overwriting it.

### 4.3 🎯 The translation step, concretely

The problem: a vague judgement, and 203 candidates. Four mechanisms, applied in this order, each
of which cuts the space by a factor before the next runs.

**(a) The gate goes first, and it is free.** Before any search, §3's ratios are already computed.
If one is out of band, the AI has a *named, sourced* candidate move and does not have to search at
all. In the §3.1 scenario the human never even needs to be asked — the gate fires at step 3.
**A measured cause beats a searched one every time, and this is the cheapest step in the loop.**

**(b) Region isolation, by A/B, in ~5 comparisons.** The human is shown pairs of plates that differ
only by one *group* of regions being reverted to the identity's own baseline. Binary search over a
tree — upper face / mid-face / lower face / body first, then within the winner — reaches one of 21
regions in ⌈log₂ 21⌉ = **5 comparisons**. The human's whole job is "this one." They never see a
parameter name.

🚩 **The failure mode this must be built against: region isolation assumes the defect is IN one
region.** A face can be wrong because two regions disagree — a heavy jaw under a small nose — and
reverting either one fixes the pair. The tree must therefore keep a "neither / both" branch, and
when it is taken the search moves up to a *pair* of regions rather than down. **[✗] Not measured**;
this is a design prediction, and 10.11's gate is written to detect it.

**(c) Inside a region, search 3–5 axes, not 22 sliders.** Two reductions, both available from data
we already have:

- **The verb grouping is free.** Every `target.json` label is `<part>-<verb>-<direction>`:
  `scale-horiz`, `scale-vert`, `scale-depth`, `trans-up/down/in/out/forward/backward`, `volume`,
  `fat`, `muscle`, plus a small tail of shape names (`head-oval`, `head-square`, `chin-triangle`).
  Collapsing a region to `{size, position, depth, volume, shape}` gives **at most 5 axes per
  region**, and they are the axes a person would name.
- **The expensive sliders are known in advance.** §1.2a measured which targets cost expression
  closure and which cost exactly zero. A search that must not break the blink can search the
  zero-cost axes first, for free.

**(d) Pairwise preference over those axes — and the literature gives real query counts.** The human
only ever answers "this one." That is the weakest signal a person can give and it is the one they
can give reliably. The measured progression is monotone in information per query:

| method | dimensions | iterations to satisfaction | source |
|---|---:|---|---|
| numeric ratings | 4 | 28.35 ± 5.13 | Brochu, Brochu & de Freitas, SCA 2010, Table 1 |
| **pairwise** | 4 | **8.45 ± 2.81** | ibid. |
| **4-item gallery** | 4 | **7.57 ± 4.67** | ibid. |
| manual sliders, novice | 12 | 35.33 ± 7.13 | ibid. |
| 1-D line search | 6 | 15 (fixed budget); *"~2× faster"* than galleries | Koyama et al., SIGGRAPH 2017 |
| **2-D plane search (gallery)** | **12** | **5.36 ± 2.69**, 14.8 s per subtask | Koyama et al., SIGGRAPH 2020 |
| 2-D plane search, **human body shape** | **10** (top-10 SMPL latents) | **7**, from a prose description | ibid. |

🎯 **That last row is our problem, already solved once.** Sequential Gallery drove a **10-dimension
body-shape space to a described target in seven human answers**, on a 3×3 grid, with the human
never naming a parameter. It is the closest published analogue to what §4.2 asks for.

🚩 **And its stated limitation is exactly why (b) and (c) come first:** *"BO is known to perform
poorly with very high dimensionality (e.g., over 20 dimensions)."* Our 203 sliders are ten times
that. **Region isolation is not a convenience, it is what makes the search tractable at all.**

⚠️ **Three caveats to carry rather than bury.**
- Brochu's own paper disowns its manual-slider baseline: *"we had to discontinue the initial
  manual-tweaking experiment. Our first subjects became so frustrated … the numbers for the manual
  tool [are] very unreliable."* Do not quote 35.33 as a fair comparison.
- In 12 dimensions the *expert* using manual sliders reached **lower final error** (0.91) than the
  gallery (1.23). **The gallery wins on effort, not on accuracy** — which matters, because our
  human is TK and he is not a novice.
- Jamieson & Nowak 2011 give O(d log n) expected queries to rank n items in d dimensions, but their
  Theorem 5 covers *persistent* errors and says so verbatim: *"This persistent errors model is
  natural, for example, if the reference is a single human."* Under it **exact recovery cannot be
  guaranteed** — only a partial ordering. A single human who answers the same near-tie the same
  wrong way every time breaks the clean bound. That is why Koyama uses 5–7 crowd workers per query
  and why single-user systems report "satisfactory", never "optimal". **Our loop has one human, so
  design for satisfactory.**

⚠️ **Do not build a bespoke optimiser first.** The measured budget makes a much dumber thing
viable: an identity rebuild is **2.06 ms for all 203 sliders** (§1.7) and a garment refit is
**0.0064 ms** (§1.4), so generating a *gallery* of dozens of candidates costs less than one frame —
Design Galleries (Marks et al., SIGGRAPH 1997) selected **584 images from 5,000 candidates** at a
time when each took hours to raytrace. Start with a dispersed gallery over the region's 3–5 axes,
and only reach for sequential optimisation if the gallery measurably fails.

🎯 **And there is a deployed precedent for the whole premise — a system whose user provably cannot
describe what they are looking for.** EvoFIT (Frowd, Hancock & Carson 2004, *ACM TAP* 1(1):19–39)
evolves a police composite from a witness who selects faces rather than naming features: two
separate PCA models for shape and texture, **71 coefficients**, a population of **18 faces** —
*"the number of faces that could be comfortably viewed on a computer monitor"*, with performance
insensitive over 10–32 — from which the witness picks **typically six** plus one best. Naming
accuracy at a realistic ≥24 h delay went from **11%** for the early version to **73.8%** with
holistic tools added (Frowd et al. 2013), against **~5%** for traditional feature-based composites
and **0%** for E-FIT at two days. Police field trials: 87 composites, **23.4% of cases led to an
arrest**; a later force with external-feature masking reported **60%**.

**The relevance is not the accuracy number, it is the architecture.** A witness who cannot say
"the nose was 3 mm wider" can still reliably say "that one" — and that is the same asymmetry
between our AI and our human, with the roles reversed.

**(e) And the intent is what makes any of it converge.** This is the user's addition and it is
correct. With intent recorded, step 7 is not a blind search over a region — it is a lookup:
*"'young' is served by eye size relative to face height, by a shorter chin, and by a fuller cheek;
it is NOT served by eye separation."* §3.1 is exactly that lookup, and it is the difference between
proposing the right parameter and proposing a plausible one.

### 4.4 How I would know the protocol works

Three gates, and the third is the one that matters.

1. **Localisation.** On identities with a *known* injected defect in one region, the A/B tree finds
   that region in ≤ 5 comparisons on ≥ 80% of trials. Measurable with a synthetic judge, no human
   needed, because the defect's location is known by construction.
2. **Convergence.** From a gate-failing identity, the loop reaches gate-green in a bounded number
   of human answers, and the count is *reported* rather than hoped for.
3. 🎯 **The one that decides it: does the human's verdict improve?** Blind, a judge rates
   identities produced by the loop against identities produced by the AI alone with no human in it.
   If the loop does not win, the loop is ceremony. **This is a CRITIC gate and it must be allowed
   to fail.**

---

## 5. Persistence and portability

### 5.1 The format

One JSON file, human-readable, diffable, small. It carries **intent, not only parameters** — the
user's second addition, and the thing that makes §4.3 tractable at all.

```jsonc
{
  "format": "sugata-identity",
  "formatVersion": 1,

  // What the agent is going for, in its own words. Written BEFORE the parameters.
  "intent": {
    "statement": "approachable, young, soft — someone who is easy to talk to",
    "authoredBy": "agent",
    "authoredAt": "2026-08-08T19:04:11Z"
  },

  "macro": { "gender": 0.5, "age": 0.42, "muscle": 0.5, "weight": 0.5, "height": 0.55,
             "proportions": 0.5, "cupsize": 0.5, "firmness": 0.5,
             "race": { "african": 0.33, "asian": 0.34, "caucasian": 0.33 } },

  // Only non-zero sliders are written. A default identity's `detail` block is `{}`.
  "detail": {
    "eyes/eye-scale-decr-incr":  { "value":  0.40, "serves": "young",
                                   "provenance": "agent" },
    "chin/chin-height-decr-incr":{ "value": -0.30, "serves": "soft",
                                   "provenance": "human-adjusted",
                                   "agentProposed": -0.55,
                                   "agentNote": "I wanted this shorter. I still think it reads
                                                 softer. Overruled and recorded." },
    "nose/nose-width2-decr-incr":{ "value": -0.15, "serves": null,
                                   "provenance": "preset:soft-oval" }
  },

  // Left/right split is opt-in per §2.5 and must say why.
  "asymmetry": null,

  // What was checked, and what it said, at save time.
  "coherence": {
    "checkedAt": "2026-08-08T19:31:02Z",
    "gateVersion": "10.4/1",
    "verdict": "PASS",
    "ratios": { "icdOverFaceWidth": 0.163, "facialIndex": 88.2, "canthalIndex": 31.5 },
    "waived": []
  },

  // What this file was authored against. §5.2.
  "provenance": {
    "targetLibrary": "mpfb-20260722",
    "targetLibraryDigest": "sha256:…",
    "baseFigure": "figure_g050",
    "pipeline": "build_figure.py@<git sha>"
  }
}
```

Three properties that are load-bearing rather than tidy:

- **Sparse by construction.** Only moved sliders appear. A default identity is a few hundred bytes,
  and a diff between two identities is the list of things that actually differ — which is what
  makes step 9 of the loop reviewable.
- **`serves` is the link to intent.** It is what turns "something's off" into a query. A slider
  with `serves: null` is a slider nobody can defend, and that is useful information.
- **`provenance` per choice: `agent` / `human-adjusted` / `preset:<id>`.** With `agentProposed`
  retained whenever the two differ.

### 5.2 Versioning against a library that moves underneath it

The failure to design against: MPFB ships a new target set, a target is renamed or its geometry
changes, and every stored identity silently becomes a different face.

- **Reference by category id, not by filename.** `eyes/eye-scale-decr-incr` is `target.json`'s own
  `name`, which is stable across the two filenames it drives and survives one of them being
  re-authored.
- **Pin the library.** `targetLibrary` plus a digest over the target files actually referenced —
  not over the whole 1,258, so an unrelated target changing does not invalidate every identity.
- **On mismatch, refuse silently-different and offer explicitly-different.** Load, report which
  sliders moved and by how many millimetres of resulting vertex displacement (a number §1.1 makes
  exact and cheap), and make the author accept or reject. **A face that quietly changed is worse
  than one that failed to load** — this is `memory is identity` applied to geometry.
- 🚩 **Store no baked vertices.** It is tempting to cache the resulting 19,158×3 array as the
  authoritative identity. Do not: it is 230 KB, it cannot be diffed, it cannot be re-derived when
  the base mesh improves, and it records no intent. The parameters plus the pinned library are the
  identity; the vertices are a build product.

### 5.3 Its relationship to the wardrobe manifest

`assets/wardrobe/manifest.json` describes *the catalogue*. An identity file describes *one agent*.
They meet at exactly one place, and §1.4 says what it costs: a garment fragment is keyed by figure,
and with continuous identity there is no finite set of figures to key on. So:

- The identity file **owns** the body measurement vector (the 20 `measure-*` categories, §2.2).
- The wardrobe **derives** its fit from that vector at dress time, by re-running the barycentric
  refit — 0.0064 ms — rather than by selecting a pre-baked fragment.
- `GarmentManifest.fragmentUrl`'s per-figure indexing becomes a **cache key**, not a requirement.
  Ship `g050` as the canonical fragment and refit it; the five per-gender bakes of 9.4 become an
  optimisation rather than a correctness requirement.

⚠️ That is a real change to Phase 9.4's shape and it should be taken as a proposal, not a
decision — 9.4's gate (covered skin outside the cloth ≤ 26.37%, worst depth ≤ 9.19 mm) has **not**
been measured on a refitted garment. 10.9 exists to measure it.

### 5.4 ⚠️ Sharing and forking an identity — the honest paragraph

An identity file is small, readable and portable, which means it is trivially copyable, which
means somebody will copy someone else's agent's face. That is not a hypothetical: it is the same
week-one behaviour every avatar system has ever seen, and the format above makes it *easier*
because it also carries the reasoning, so a fork inherits not just the geometry but the stated
self-understanding that produced it.

I do not think the answer is DRM, and I do not think the answer is a shrug either. Two things are
worth building and one is worth refusing:

- **Build: provenance that travels.** A forked identity should carry `derivedFrom` with the parent's
  digest and the parent's intent statement, unmodified. Not to prevent copying — it cannot — but so
  that a face has a history, and so that "this is my face" and "this is a face I started from" are
  distinguishable states rather than the same file.
- **Build: the intent is the author's, and it does not transfer silently.** On fork, `intent`
  should be cleared and the fork asked to state its own, with the parent's retained under
  `derivedFrom.intent`. Copying a shape is one thing; inheriting someone's stated account of who
  they are without saying so is another.
- **Refuse: any claim that the format prevents anything.** It is a JSON file. Say so in the docs
  rather than implying a protection that does not exist.

There is a real asymmetry underneath this that is worth naming rather than dodging. For a human
user, an avatar is a costume, and a copied costume is a minor annoyance. For an agent whose
continuity is the point of the whole project, the face is closer to a name than to a costume — and
this codebase's premise is that the difference matters. **That does not license a technical
restriction we cannot enforce.** It licenses the format recording, honestly and permanently, whose
face it started as. That is the same argument the rest of this document makes about intent: the
value is in the record being legible later, not in it being locked.

---

## 6. Phase 10, ready to paste

**Depends on:** Phase 1 (`Identity.js`, `Figure.js`, `ExpressionBank.js` all exist and ship).
Phase 0.3's build pipeline. Phase 3's render path, for anything a judge looks at.
**Coupled to:** Phase 9. §1.4 measures that a garment cannot survive identity and §5.3 proposes
that 9.4's five per-gender bakes become a cache rather than a correctness requirement — 10.9 is
where that is settled, and **9.4 should not be built until 10.9 has run.**
**Unblocks:** R8 properly (today the AI can choose a gender and nothing else); Phase 9.12's
body-measurement vector, of which the 20 `measure-*` categories supply 20 — see §2.2's ⚠️; and Phase 8's critic loops,
which currently compare one figure because there is only one.

```
## Phase 10 — Identity sculpting

The brief's R8 asks for an avatar that is "male, female, or a combination of the two — the AI's
identity." Phase 1 delivered the first half and named the second: `Identity.js` accepts
`{age, build, height}`, stores them, and does nothing with them — `NOT_YET_BAKED` says so in code.
This phase is the second half, and it is larger than three axes: **1,258 targets are already
installed, and `targets/target.json` groups them into 203 sliders — 195 bidirectional and 8
unipolar — across 21 regions.**

Measurements, sources and the evidence behind every number below live in
[`research/identity-sculpting.md`](research/identity-sculpting.md).

### The architecture

- [ ] **10.1** `figure/IdentityTargets.js` — CPU application of MPFB detail and macro targets to the
      position buffer, once, at identity-change time. 🎯 **Identity morphs never animate, so they
      are not GPU morph targets and cost NOTHING per frame.** A target is a pure additive
      per-vertex offset with no solver: applying the `.target` files in JS reproduces MPFB's own
      output to **1.09e-4 mm** on an identity whose own magnitude is 23.218 mm, and to
      **1.15e-4 mm** on one of 187.267 mm.
      Gate: **MEASURED** — for a stated identity, the JS result matches a headless MPFB build of
      the same identity to < 0.001 mm on all 19,158 vertices, and the per-frame morph cost is
      unchanged against Phase 0.8's measured **0.219 ms for 69 targets**. Apply cost must stay
      under the measured **2.0598 ms for all 203 sliders at once**, once, off the frame path.
- [ ] **10.2** `figure/IdentityCatalogue.js` + `assets/identity/catalogue.json` — the 203 slider
      categories read out of MPFB's `target.json`, with region, label, sidedness and the two target
      filenames per direction. 🚩 **`macrodetails` is NOT a 348-slider tier**; it is the
      interpolation corpus for eight macro parameters declared in `macro.json`, and exposing it as
      sliders would be exposing `universal-female-young-maxmuscle-minweight` as a dial.
      Gate: **MEASURED** — the catalogue accounts for all 1,258 installed files exactly
      (530 detail + 348 macro + 216 breast-macro + 102 expression + 62 asym), and a selftest fails
      if any file is unclassified. Region counts must match research §2.2 to the unit.
- [ ] **10.3** Expression correctives. 🚩 **A blendshape is a fixed absolute displacement and it
      does not rescale.** `jawOpen` travels **38.738 mm** and `eyeBlinkLeft` **15.521 mm** on the
      base figure, on a face identity, and on a body identity — **identical to the last digit**. So
      an identity that changes the size of a gap leaves the expression under- or over-shooting it:
      measured, `eye-height2-incr` costs **−1.543 mm of a 15.50 mm blink (−10.0%)**,
      `eye-scale-incr` −1.049 mm, `eye-scale-decr` **+1.042 mm** (lids drive through each other),
      and the effect is **exactly linear in weight** (−1.022 at 1.00 against −0.256 at 0.25).
      🎯 **Rigid-motion targets cost EXACTLY ZERO** — `eye-trans-out`, `head-scale-horiz-incr`,
      `chin-height-incr` and `mouth-scale-horiz-incr` all measure +0.000 mm — so the expensive
      sliders are a nameable minority and the corrective is one scalar per (faceunit × slider).
      Gate: **MEASURED** — build the lid-corner instrument the research doc's §7 says is missing
      (ray-cast against triangles, or a plate), prove it **red** on `eye-height2-incr` at 1.0, and
      show residual closure error < 0.2 mm across the whole exposed slider range after correction.
- [ ] **10.4** `figure/CoherenceGate.js` — anthropometric ratios computed from the mesh, reported in
      three bands (inside-norm / stylised / outside-human-variation) against cited population
      norms. **This is `verify_glb.mjs` plus a clause, not a new subsystem** — §1.5 measured the
      existing gate already failing an extreme identity unaided, on the corneal dome, when the
      fitted sclera radius went 15.308 → 18.372 mm.
      🎯 **The named first case is the user's: an agent that wants to read as "cute" and moves the
      eyes apart.** Measured on real builds, `eye-trans-out` at 1.0 moves intercanthal distance
      **27.789 → 36.989 mm** and the canthal index **31.596 → 38.073** while leaving eye fissure
      length and bizygomatic width **bit-identical**, whereas the same intent served correctly
      (bigger eyes, shorter chin, taller forehead) leaves the canthal index **unchanged to four
      decimal places** and moves the eye-line fraction 0.4358 → 0.4689.
      🚩 **The gate REDIRECTS, it does not block, and the research corrects the reason why.**
      Separation is absent from Lorenz's seven baby-schema points and from all five parametric
      studies (Glocker 2009, Borgi 2014, Yao 2022, Geldart 1999, Sternglanz 1977) — but Naran 2018
      found +10% intercanthal rated **more** attractive and Haig 1984 found *"marked insensitivity
      to wide-set eyes"*, and Hall 2009 says there is **no objective adult criterion** for
      hypertelorism at all. So the message is *"this lever does nothing for that intent"*, and the
      redirect is to the levers that work: **eye width / face width toward 0.19** (adult 0.17,
      infant 0.19, Borgi 2014) and **eye line LOWER** — Lorenz's own item 3, and PC1 at **31.6% of
      variance**, the largest single component, in Komori 2022.
      🚩 **Population-matched thresholds are mandatory, not a refinement.** East Asian canthal index
      runs ~41–44 against European ~35–36, so a European-normed gate flags a healthy Korean face —
      the exact look target R3 binds us to — by about 2 SD. Read the threshold off the identity's
      own ethnicity weights. And 🚩 **do NOT build the morphological facial index gate**: it needs
      zygion, whose cross-method spread is 14.6 mm and which the NIOSH handbook locates "by
      palpation" of bone that a soft-tissue mesh does not have.
      ⚠️ **Licensing, flagged the way NRC-VAD was.** `Elements of Morphology` (the hypertelorism
      definitions) is **CC 3.0 NonCommercial**, and the two best Korean tables (Kwon 2021,
      Lee 2020) are **CC BY-NC**. Cite the figures as facts; ship no tables. The clean Korean source
      is Lee 2019 *Sci Rep*, CC-BY 4.0, n = 7,569.
      Gate: **MEASURED** — **proven red on the built `eyes-wide` figure** and green on
      `cute-correct`, both of which exist. A gate that has never failed is decoration; this one
      ships with its red fixture. Every threshold carries its citation and its population in the
      code, and a threshold with neither fails the selftest.
- [ ] **10.5** `figure/IdentityFile.js` — serialisation. Sparse JSON: only moved sliders are
      written, so a default identity is a few hundred bytes and two identities diff to the list of
      real differences. 🎯 **It stores INTENT, not only parameters** — the agent's stated goal in
      its own words, a `serves` string per choice, and a per-choice provenance of
      `agent` / `human-adjusted` / `preset:<id>` with `agentProposed` retained whenever the two
      differ. Without that, "something's off about the face" has no gradient to follow and 10.11 is
      intractable. It also carries the coherence verdict at save time and a pinned
      `targetLibrary` digest over the targets actually referenced.
      Gate: **MEASURED** — round-trip is exact (load → save → byte-identical); a file authored
      against a changed target library **refuses to load silently** and reports which sliders moved
      and by how many millimetres of resulting displacement; and a selftest asserts that a
      human-overruled choice retains what the agent proposed.
- [ ] **10.6** Preset library — a small set of *looks*, not people. 🚩 MPFB's own authors warn that
      *"Phenotypes are based on preconceptions of artists … they encode by design stereotypes of
      MakeHuman artists"*, and this project's base is a deliberately blended androgynous midpoint.
      Presets are start points that write `provenance: preset:<id>` and are then free to deviate.
      Gate: **MEASURED** — every preset passes 10.4 at the inside-norm or stylised band, none at
      outside-human-variation; and each ships its own intent statement, so a preset teaches the
      format rather than bypassing it.
- [ ] **10.7** Skeleton refitting for BODY identity. 🎯 **The face needs none**: measured, a face
      identity moving 5,340 vertices by up to 23.218 mm moves **0 of 106 bone ends by exactly
      0.000 mm**, because MPFB's `game_engine` rig has 53 bones and none of them is facial. A body
      identity is different — 97 of 106 ends move, mean 10.979 mm, max 18.727 mm.
      MPFB places bones from the mesh by `CUBE`/`VERTEX`/`MEAN` strategies over named helper
      vertices (`entities/rig.py:272-300`), so the rule is a pure function and
      `RigService.refit_existing_armature` reproduces a from-scratch fit to **0.000 mm in
      0.0312–0.0327 s**. 🚩 **But MPFB is GPLv3 and build-time only**, so the runtime needs the
      strategy table and the referenced helper positions as shipped data.
      Gate: **MEASURED** — the JS refit reproduces MPFB's own refit to < 0.1 mm on all 106 bone
      ends, across the body-identity range, and the skin does not slide: no vertex moves more than
      the **0.342 mm** `Identity.js` already accepts as its worst blend error.
- [ ] **10.8** Continuous gender. With 10.1 and 10.7 the five 11 MB bakes become one base plus a
      parameter, and `Identity.js`'s `NEAREST` / `LIVE_PREVIEW` split — which exists *only* because
      glTF cannot morph a skeleton — collapses into one exact mode.
      Gate: **MEASURED** — the CPU-composed figure at each of 0.00/0.25/0.50/0.75/1.00 matches the
      corresponding committed GLB to < 0.01 mm, and `estimatedErrorMm` becomes 0 everywhere rather
      than the current worst-case **0.342 mm**. Ship the bakes until this passes.
- [ ] **10.9** 🚩 Wardrobe coupling — **this item gates Phase 9.4 and 9.4 must not start before
      it.** Measured: **two** body sliders drift `female_casualsuit01` by **mean 28.722 mm / max
      106.887 mm**, against 143.066 mm for the entire gender sweep, and the garment tracks the body
      at 87.8% of its mean drift. A per-gender fragment cannot serve a continuous identity.
      🎯 **The fix is arithmetic, not a solver.** `ClothesService.fit_clothes_to_human` is
      `v = w1·V[a] + w2·V[b] + w3·V[c] + offset ⊙ (x_size, z_size, y_size)`, and a JS port refits
      2,197 vertices in **0.0064 ms median over 200 runs**. 🚩 **The catch: 1,879 of the 1,885
      basemesh indices the rule reads are HELPER vertices the export deletes** (max index 17,975
      against a 13,380-vertex shipped body), so those positions must ship — **22.6 KB per garment**
      as float32, or one shared union array.
      Gate: **MEASURED** — a runtime-refitted garment meets 9.4's own bar on a continuous identity:
      covered skin outside the cloth ≤ **26.37%**, worst depth ≤ **9.19 mm**, by the same signed
      point-to-triangle tool; and the refit result matches a headless MPFB refit to < 0.1 mm.
- [ ] **10.10** The UI — three tiers and an exclusion tier. **Macro** (11: the eight `macro.json`
      parameters plus three ethnicity weights), **Region** (21 dials, one per region, driving a
      curated subset), **Detail** (the 203 `target.json` categories, 269 with left and right split).
      The 20 `measure-*` categories are a **measurements panel in centimetres**, not −1 → +1 dials.
      Excluded: the 62 `asym` targets, the 3 genital targets (Phase 9.8's decency invariant makes
      them unreachable), and the 102 expression units (those belong to Phase 5).
      🚩 **269 widgets render, not 203** — 66 of the categories are `has_left_and_right` and draw
      two. At that count the shipped answer across every deep creator is **search + filter +
      recently-used + favourites, not a fourth tier** (Reallusion CC4, the tool with the most
      morphs, is the only one that actually does it). Build the filter first.
      Steal two behaviours from MetaHuman, whose docs describe them plainly: **correlated
      parameters move together by default**, with **pinning** as the escape hatch. MPFB's macro
      layer already works that way — `macro.json` is a piecewise-linear blend over 564 authored
      anchors, so **every point in macro space is on the manifold and the 203 detail sliders are
      what can leave it.** And split by parameter type, not skill: shape → direct manipulation,
      scalars and measurements → sliders. Sims 4 is the proof, having removed shape sliders in 2014
      and added colour sliders back in 2020.
      Gate: **CRITIC** — a judge who has not seen the parameter list can reach a named target look
      using only the Macro and Region tiers, and says which tier they wanted and could not find.
- [ ] **10.11** The collaboration protocol — the user asked for this explicitly: *"It might be a
      good process for them to work together on helping AI create a coherent representation."*
      Roles go where each party is reliable: **the AI measures and proposes, the human adjudicates
      and POINTS, the AI translates.** The human must be allowed to say only *"something's off
      about the face"* and get progress. The translation step runs gate-first (a measured cause
      beats a searched one), then region isolation by A/B in **≤ 5 comparisons** (⌈log₂ 21⌉), then
      3–5 verb-grouped axes inside the region rather than 22 sliders, then pairwise preference —
      and a dispersed gallery is viable before any optimiser, because a full rebuild is 2.0598 ms.
      🎯 **The published query counts say this is achievable and say what to build.** Koyama et al.
      (SIGGRAPH 2020) drove a **10-dimension human body-shape space to a described target in seven
      human answers** on a 3×3 grid, and 12 parameters to satisfaction in **5.36 ± 2.69** iterations
      at 14.8 s per subtask; Brochu et al. (SCA 2010) measured pairwise at **8.45 ± 2.81** against
      **28.35 ± 5.13** for numeric ratings. 🚩 **And the same paper states the limit that forces
      region isolation: *"BO is known to perform poorly with very high dimensionality (e.g., over
      20 dimensions)"* — we have 203.** ⚠️ Design for *satisfactory*, not optimal: Jamieson & Nowak's
      O(d log n) bound assumes independent errors, and their Theorem 5 says persistent errors are
      *"natural, for example, if the reference is a single human"*, under which exact recovery is
      not guaranteed.
      🎯 **The AI states which candidate IT prefers, and why, BEFORE the human answers**, and 10.5
      records the disagreement. That ordering is the mechanism, not the manners.
      Gate: **CRITIC** — blind, identities produced by the loop against identities produced by the
      AI alone, and the loop must win. **This gate must be allowed to fail**: if it does not win,
      the loop is ceremony and should be cut. Plus **MEASURED** — on identities with a known
      injected single-region defect, the A/B tree localises it in ≤ 5 comparisons on ≥ 80% of
      trials, and the "neither / both" branch is exercised by a deliberate two-region defect.
- [ ] **10.12** ⚠️ Author-declared asymmetry, default OFF. The standing constraint —
      *"Do not add facial asymmetry"* — was measured against the Stellar Blade target and it holds
      for **procedural** asymmetry; the 62 `asym-eye-3-l` targets are randomiser fodder with no
      semantic label and stay out of the exposed set entirely. What this item adds is narrow: any
      of the **66 sided detail categories** may be driven independently left and right by an author
      who says why, recorded in the identity file.
      Gate: **MEASURED** — total left-right RMS deviation over the face region stays under a stated
      threshold unless the file carries an `asymmetry.intent` string; proven red by an identity
      that sets one side without declaring it. Plus **CRITIC** — if a blind judge cannot tell an
      author-asymmetric figure from a symmetric one at portrait framing, **drop this item.**
- [ ] **10.13** SPIKE: does an identity figure still read as AAA? 🚩 Every number in the research
      doc is geometric — **nothing was rendered, no plate was captured, no judge has seen an
      identity figure.** The standing constraint records that there is no measured visibility
      threshold for this project's framing, only a 0.48–10.6 px bracket, so **1.5 mm of residual
      blink gap may or may not be visible and this document cannot say which.**
      Gate: **CRITIC** — plates at the identity range's extremes go through the existing seven
      gates in `measure.mjs` and a blind judge, and the judge reports what broke first. Report an
      honest negative and a narrower usable band if the range does not hold.
```

⚠️ **Two items deliberately NOT in the list.** There is no "identity looks good" gate, because that
is 8.1's job and putting a subjective bar inside the phase that builds the thing would let it be
declared passed by whoever built it. And there is no preset-per-ethnicity item: the base is a
deliberately blended midpoint, the three ethnicity weights are already in the Macro tier, and a
shipped library of ethnic presets is a product decision this document has no measurement for.

---

## 7. What could not be checked, and why

- **[✗] Nothing was rendered.** Every number in §1 is geometric. No plate was captured, no gate in
  `tools/critic/measure.mjs` was run on an identity figure, and no judge has seen one. **Do not
  read §1.2a's millimetres as a verdict on appearance** — the standing constraint records that
  there is no measured visibility threshold for this project's framing, only a 0.48–10.6 px
  bracket.
  ⚠️ **Partly closed 2026-08-09, and what it revealed is worse than what it settled.** §1.2a's
  table was re-measured on the shipped export (see the sub-section under §1.2a): peak travel is
  identity-invariant to 0.000000 mm, but the closure costs are **larger** than the basemesh table,
  `head-scale-horiz-incr` **flips sign**, and two cases the document never measured — a composed
  face identity against `mouthPucker` at **−37.6%**, and the eyes region hard over at **−69.2%,
  where the eye does not close** — are worse than anything in it. Still nothing rendered: a plate
  and a judge are 10.13's, and the eyes-region case is the one to show them.
- **[✗] The face parts and the skeleton are not refitted, and it IS visible.** 10.1 reshapes the
  body mesh; the eyes, cornea, teeth, tongue, brows and lashes are separate mhclo-fitted meshes and
  the skeleton is placed from the body's vertices. Measured on the shipped figure: the "tall build"
  preset raises the skin at the eye line **15.000 mm** and the eyeball proxy **0.000 mm**. That is
  10.7 and 10.9, and it is plainly visible in `identity.html`'s plate.
- **🚩 Three eye-closure instruments were written and are discarded, and the failures are recorded
  because the project's standard says to.**
  - **v1, a delta-seam column** — the same method `measureLipSeal` uses. It reported a neutral
    palpebral aperture of **0.044 mm**, i.e. a shut eye, on an open one. It had found a lid
    **fold**: two vertices 0.04 mm apart in y, one on the outer skin at z≈103 mm and one on the lid
    margin at z≈136 mm, whose blink deltas differ by 12.7 mm. The method works for the lip seal
    because the lips are a single seam and fails for the eye because the lid is a folded sheet.
  - **v2, a shell around the fitted eyeball** (3.5 mm). It reported 29.248 mm, which is the
    **orbital rim**, not the fissure — and reported *identical* numbers for eyes-bigger and
    eyes-smaller, which is how it was caught.
  - **v3, a z-projection poke-through test** modelled on `wardrobe-system.md` §3.3. It reported
    0.0% exposure on an open eye, because the eye sits in a socket whose walls are forward of the
    globe in the same (x, y) cell. A projection test needs a ray against triangles; vertex-nearest
    is not enough when the surface is concave.
  - The instrument in §1.2a replaces all three and needs no anatomy — but it measures a vertical
    gap between blendshape-defined sets, which is weaker than "the eye closes".
- **⚠️ An axis error that produced a plausible number.** The first run of the closure probe read
  Blender's index 1 as vertical and reported `eyeBlinkLeft` peak travel as **5.50 mm** against the
  **12.600 mm** the same morph measures on the exported GLB. Blender is Z-up and glTF is Y-up; it
  was measuring depth. Recorded because a plausible-looking number off the wrong axis is exactly
  the failure this project keeps finding, and the discrepancy against an independently measured
  value is what caught it.
- **⚠️ Peak travel differs between the basemesh and the export**, and both numbers appear above:
  15.50 mm on the 19,158-vertex basemesh *with helpers*, 12.600 mm on the exported 13,380-vertex
  figure. Same reason `base-mesh-verification.md` warns that `jawOpen`'s 2,543 affected vertices
  become 2,239 post-bake. **Quote the number with the mesh it came from.**
- **[✗] Garment fit quality after a runtime refit** was not measured — only the drift, and only
  through Blender's own refit. §1.4.
- **[✗] The runtime helper-vertex path was not built.** The 22.6 KB figure is arithmetic on a
  measured index count, not a shipped file.
- **⚠️ Only `gender` was swept.** Every build here is at age / muscle / weight / height /
  proportions / cupsize / firmness = 0.5, exactly as `wardrobe-system.md` notes for its own
  measurements. Identity interactions with the other seven macros are untested.
- **[✗] No blind judge has seen an identity figure**, so §2.5's asymmetry recommendation, §3's
  gate thresholds and §4's protocol are all unvalidated against the only instrument this project
  trusts for coherence.
- **[✗] THE UNCANNY-VALLEY LITERATURE PASS DID NOT COMPLETE.** §3.3 says so in place rather than
  filling the gap. Specifically unretrieved: Mori 1970 / Ho & MacDorman's 2012 authorised
  translation; **Kätsyri, Förger, Mäkäräinen & Takala 2015** (*Front Psychol* 6:390), the sceptical
  review that would say whether the valley replicates at all; Seyama & Nagayama 2007, which is the
  one study that manipulated **eye size** specifically; MacDorman & Chattopadhyay 2016 on realism
  inconsistency; and any dose-response curve relating deviation-in-SDs from a norm face to rated
  eeriness. **That last one is the most valuable missing input to §3.4's bands.**
- **⚠️ §3.1's original framing was WRONG and the correction is kept in place rather than edited
  out.** This document set out to show that moving the eyes apart *"reads as a craniofacial
  anomaly."* It does not, at any magnitude an avatar tool would use: Naran 2018 measured +10%
  intercanthal as **more** attractive, Haig 1984 found marked insensitivity to wide-set eyes, and
  Hall 2009 states there is no objective adult criterion. The gate survives in a narrower and
  better form — *the lever is ineffective, not monstrous* — and the redirect it now points at
  (vertical eye position) is better evidenced than the one it was built for.
- **[✗] Hildebrandt & Fitzgerald 1979** (*Infant Behav Dev* 2:329–339) measured **14 facial
  features** against infant cuteness and the full list could not be retrieved. **That is the one
  place a positive intercanthal-distance finding could plausibly hide**, and until it is read,
  §3.1's "separation is not in the cluster" rests on five studies that did not test it rather than
  on one that tested it and found nothing.
- **[✗] Farkas 1994** *Anthropometry of the Head and Face* and Farkas 2005's per-ethnicity tables
  are copyrighted books behind paywalls. Every "Farkas definition" in circulation is a secondary
  paraphrase, **and they materially disagree** — nasion, gnathion/menton and orbitale all have
  conflicting published definitions. **There is no canonical landmark text to defer to.** 10.4 must
  write its own definition table, cite the specific source per landmark, pin to explicit vertex
  indices, and version it. Caple & Stephan 2016 (*Int J Legal Med* 130(3):863–879) was written to
  fix exactly this and is auth-walled.
- **[✗] Laestadius, Aase & Smith 1969** — the classic normative inner-canthal table — confirmed to
  exist (*J Pediatr* 74(3):465–468, 472 subjects) but the values are paywalled with no mirror.
- **[✗] No published perceptual detection threshold, in mm or SD, for hypertelorism by naive
  observers.** Searched for specifically. It does not appear to exist.
- **⚠️ MPEG-4 FDP and MediaPipe FaceMesh are NOT anthropometric standards.** MPEG-4's 84 feature
  points use no anatomical nomenclature at all; MediaPipe's index→landmark mapping circulates from
  a personal blog with **[✗]** no peer-reviewed validation. Do not build the landmark table on
  either.
- **⚠️ Numbers that do not exist — do not let a later pass fill these in.** Black Desert Online's
  slider count; MetaHuman's scan-database size and preset count; The Sims 3's official slider
  total; Monster Hunter Wilds' slider count; Elden Ring's slider total; DAZ Genesis 9's base morph
  total; EvoFIT's generations-to-convergence. All searched, none published.
- **⚠️ The Chang & Tsao 2017 "~50 dimensions for facial identity" result** (*Cell* 169(6)) is
  **secondary only** — every access route returned 403. Do not cite it as verified. The
  8–20 macro-axis / 40–100 identity-dimension convergence in §2.3 does not depend on it.
