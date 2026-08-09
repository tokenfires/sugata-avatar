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

Last updated: **2026-08-08, FIFTH pass — integration of a six-agent fan-out onto `2ec7db9`.**

## 🎯 **THE SHIPPED DEFAULT PASSES SEVEN OF SEVEN.** First clean sweep this file has recorded.

`alive.html?bare&freeze&seed=1&capture` at 3840×5120 dpr 1, 60 steps at 60 fps, on the shipped
default (TAAU 0.66 + grade + RCAS 1.2, MSAA OFF) — **three loads, one PNG, sha256
`d3c9946f73e5eaa1`**, spanning the whole integration including the wardrobe landing between the
first load and the third.

**G1 1.5378 · G2 0.9544 · G3 PASS · G4 1.6346 · G5 0.000002 · G6 0.0042 · G7 0.000601.**

Three separate pieces of work had to land in one round for it, and none of them was tuning:

- **G1 was over because the rig was solved on the wrong transform.** It was fitted at 1.5991 on the
  ungraded forward path, and the grade then became the page default without G1 being re-run —
  which `LightingRig.js`'s own header had already warned about in writing. The whole +0.040 is the
  **vignette**, and it is a framing effect rather than a lighting one: the G1 rects sit at 0.30 and
  0.07 of a half-frame off centre, so a radial `1 − 0.15r²` is not symmetric across the pair.
  Predicted ×1.0263 from the rect coordinates alone, measured ×1.0245, and `?vignette=0` reproduces
  `?grade=0` to four decimals — so bloom, RCAS and the saturation trim are worth nothing here.
- **G2 was a stale constant, not a configuration result.** `SCLERA_BRIGHTNESS` 1.26 was solved on a
  plate with no occlusion sheet over the eye; the sheet takes a quarter of it back (`?eyeocc=0`
  alone moves the ratio 0.0255, against `?grade=0`'s 0.0001). Re-solved to 1.47.
- **G6 was never a black point.** The eyelash and eyebrow cards rendered at literally RGB(0,0,0) —
  1,431 pure-black pixels, all in the brow/lash row band — and nothing downstream can raise a
  zero-albedo surface. See PUNCHLIST's G6 block.

**✅ And BOTH of the previous two headlines are retracted and superseded.** `?freeze` is no longer
inert under `?capture` (fixed in `c9fa59c`), and the shipped default is no longer irreproducible
(punch-list 3.20, `4aafd91`). **Every number in the "five distinct PNGs / FIVE of seven / G2 reads
0.9194–0.9198" headline that stood here is unreachable at HEAD** — that mechanism is gone, and the
render it described has since moved again. Do not quote 0.9372, 0.9197, 0.9201 or 1.6630.

⚠️ **A collapsed distribution is not summarised by the value that replaces it, and one generation
on that has now bitten twice.** G1 fell 1.6630 → 1.5378 and G2 rose 0.9197 → 0.9544, both far
outside anything the superseded spreads would have bounded. LEARNINGS §1.25m.

### 🎯 Phase 9 started, and the avatar is no longer permanently naked

R18's omission is answered in code rather than in a plan. `?wear=female_casualsuit01,shoes01,
fedora01` on `alive.html`, or `window.sugata.wardrobe.dress([…])` from the console. Measured on
this repo's own artefacts, all new numbers:

| what | measured |
|---|---|
| runtime index rebuild vs the baked build | **17,012 = 17,012** and **21,380 = 21,380** — identical as a **1 µm centroid multiset**, not merely in count |
| dress step | **0.1663 ms** median over 30 runs in node (min 0.0826, max 0.2346); 0.20 ms in the browser, where `performance.now` is clamped to 100 µs |
| dressed vs nude triangles | **25,812** (17,012 body + 8,800 garment) against **26,756** nude — a dressed figure draws FEWER, as research §1.1 predicted |
| hide-mask attribute cost | body 11,742,100 bytes against the nude 11,567,392 — **+58,068 per garment**, as FLOAT32 |
| draw calls | 4 dressed, 1 undressed |
| cold fetch of three fragments | ~18 s, **18.9 MB of which 18.6 MB is PNG** — 9.6's KTX2 work is not optional |
| Blender build wall clock, this machine | nude **8.56 s**, suit + shoes 8.73 s, four garments 9.54 s — research §3.1's 12.30 s is a machine state, not a constant |

**Both frame paths verified per LEARNINGS §1.24**, which is the check `alive.html` has silently
failed twice: on the forward MSAA path a dressed frozen plate is **byte-identical** (`9e315115…`)
taken through rAF and through 60 × `__SUGATA_STEP__`, and the capture epoch pin holds with garments
on — `frameId` 60 exactly, `time` 1.0000000000000013, `jitterIndex` 29, the same oracle values the
undressed default returns.

**And 9.16's fabric spike is green.** Twill angle recovered from `{weave, ends, picks, tex, gsm}`
alone to **0.0000–0.0001°** on a periodic patch and 0.018–0.197° on an incommensurate one, against
±1.0°; plain weave refused at uniqueness exactly 1.000000; the rendered anisotropy basis correct to
**0.09°** over a 150° sweep. It also found that an FFT peak gate is blind to a *painted* diagonal
with no interlacing underneath, which passes it cleanly — so the item now specifies a second,
independent instrument. `tools/spikes/fabric-weave.mjs --gate`, `packages/testbed/src/fabric.html`.

**The instrument gained two-sidedness and stopped guessing.** G1 was `< 2.00` only, so 1.344 linear read green against a reference band of 1.43–1.64; it is now two-sided and says which end. G2's hue clause folded the colour circle (`min(hue, 360−hue)`), so a magenta sclera beside an orange cheek passed; it now asserts the side, with the neutral zone derived from the reference sclera's own 2.791° from red so the clause provably cannot reject the spec's palette. `travel.mjs`'s auto threshold was three underived constants that put the cut at 0.1938 on a histogram whose valley is at 0.3588 — which is why a judge pinned `--threshold 0.30` by hand on every measurement; it is now Otsu's cut with a separability refusal, and it **refuses to guess** rather than reporting the centroid of the lit side of a cheek as travel.

**Treat any number in this file without a re-run date behind it as a claim, not a fact** — and check the RECIPE and the WIDTH beside the page. Earlier this day: punch-list 2.11 closed (all four motion layers frame-rate invariant, gated both ways); `measure.mjs` gained page provenance and the chroma half of G2; `capture.mjs`'s reproducibility check was found to be a false-negative generator and now reports a magnitude. The project's 1.6 px "indistinguishability floor" turns out never to have been measured — see LEARNINGS §1.14a.

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
| 2 | **Ocular + idle** — blink, saccade, VOR, breath, sway | **built; all measured gates green, visual judgement outstanding.** ✅ 2.11 CLOSED 2026-08-08 — all four layers are frame-rate invariant and each rejects a `frameCoupledArrivals` reintroduction |
| 3 | Rendering — skin, eyes, hair, cloth, lighting, post | **Done and gated: 3.1, 3.2, 3.3, 3.4, 3.8, 3.11, 3.12, 3.13, 3.16.** 🎯 **THE SHIPPED DEFAULT NOW PASSES SEVEN OF SEVEN** (G1 1.5378 · G2 0.9544 · G3 · G4 1.6346 · G5 0.000002 · G6 0.0042 · G7 0.000601, three loads one PNG `d3c9946f73e5eaa1`), which closes 3.2’s first half, 3.3 and 3.13 in one round. **3.3 was a stale constant, not a configuration result**: `SCLERA_BRIGHTNESS` 1.26 was solved on a plate with no occlusion sheet over the eye and the sheet took a quarter of it back — `?eyeocc=0` alone moves the ratio 0.0255 against `?grade=0`’s 0.0001 — re-solved to 1.47. **3.13’s G6 was never a black point**: the hair cards rendered at literally RGB(0,0,0), 1,431 pure-black pixels all in the brow/lash band, and nothing downstream can raise a zero-albedo surface; they now carry the look spec’s own `#150F17` albedo floor. `Grade.selftest.mjs` **65/65** and its horizon is now 600 rendered frames rather than a seven-frame window. **Still built and RED:** 3.2b — 3.2’s terminator half is G3, which passes on three’s stock material too and therefore certifies nothing. **Built and UNGATED — no MEASURED plate result exists, so none of these may be marked done:** 3.9 (`SkinOcclusion`, 13/13 on the bake and nothing on the render), 3.17 (`GroundContact`, **55/55** and no plate), 3.18 (`SkinRegions`, 29/29 and neither of its two effects attributed on a plate). **Not started:** 3.5, 3.6, 3.7, 3.10, 3.14, 3.15 — hair, hair OIT, cloth, GTAO/bent normals, DOF, and the blind critic loop |
| 4 | Speech — viseme timeline, TTS, coarticulation | **4.1, 4.2, 4.5 built** — `voice/{Visemes,VisemeSchedule,VisemeLayer,Coarticulation,Prosody,Pitch}.js` + `prosody-worklet.js`, 59/59 viseme and 26/26 prosody gates green, scheduled against simulated time and asserted frame-rate invariant from day one. 4.3 (TTS) and 4.4's on-screen sync gate not started. ⚠️ This row read "not started" for one round after the work landed — written during Build, committed after |
| 5 | Affect — PAD, WASABI activation, AU mapping, mic-in | not started |
| 6 | Body motion — gesture, posture, IK, physics | not started |
| 7 | Runtime API and testbed | not started |
| 8 | Blind critic loops until same-tier | not started. ⚠️ No longer blocked on reference: `reference/stellar-blade/` now holds **203 plates across 103 outfits, front and back**, extracted from a user-supplied webarchive. Same shot type as our own `?frame=body` capture — one figure, neutral stance, flat dark backdrop — so framing, pose and background are already matched, which is normally the hard part of a blind set. **All are ~200×434**; no `/original` was archived, so they support silhouette, palette and material-family judgement and NOT microdetail. Crop the Japanese UI chrome or it is a provenance tell. See `reference/stellar-blade/EXTRACTION-NOTES.md` |
| 9 | **Wardrobe** — garments, layering, fabric, mood/season, the dressing screen | **STARTED. 9.1, 9.2, 9.3 and 9.5 are done and gated** (`wardrobe.selftest.mjs` 35 assertions; `verify_glb.mjs` PASS on 10 files, where a clothed figure used to fail by construction), and **9.16’s procedural-fabric spike is green** (`tools/spikes/fabric-weave.mjs --gate`). The runtime index rebuild equals the baked build exactly — 17,012 = 17,012 and 21,380 = 21,380, identical as a 1 µm centroid multiset and not merely in count — dressing costs **0.1663 ms** median, and a dressed figure draws **25,812** triangles against **26,756** nude. Wired onto `alive.html` as `?wear=…`, opt-in so the judge’s plate is untouched. Remaining: 16 items, every one gated |
| 10 | **Identity sculpting** — face and body proportion, the coherence gate, the human–AI loop | **specified, not started.** 13 items, every one gated; `research/identity-sculpting.md`. 🎯 The architecture is measured, not assumed: identity targets are pure additive per-vertex offsets, so CPU application reproduces Blender to **1.1e-4 mm** and 203 sliders cost **2.06 ms ONCE, zero per frame** — the baked-GLB combinatorics are dead. ARKit deltas stay valid but never rescale (worst −10% of a blink, exactly linear, bounded); the face has no skeleton to break (0 of 106 bone ends move); the body skeleton refits to **0.000 mm in 33 ms**. ⚠️ **Garments do NOT survive identity** — two body sliders drift a suit **106.9 mm** — and the JS refit is 0.0064 ms but needs **22.6 KB of helper vertices per garment** shipped, because the exporter deletes the 1,879 of 1,885 verts it reads. **That gates 9.4.** |

### 2026-08-08, second pass — `?freeze` was inert under `?capture`, and three gates were half-blind

**🎯 The page renders differently free-running than under `?capture`, and that is a defect rather than a curiosity.**
Full derivation and the three-way proof are in LEARNINGS §1.19a; the consequence for this file is
that **most still-plate numbers recorded above were taken through `?capture` and are therefore
measurements of a figure already in motion.** One step at 30 fps puts the head at 0.83° of gaze
yaw; four steps put it at 7.18° and drag G1 from 1.5976 to 1.2106. Re-taken free-running at each
gate's own reference width on `alive.html?bare&freeze&seed=1`:

⚠️ **SUPERSEDED 2026-08-08 (third pass). Read the table at the top of this file and PUNCHLIST's
seven-gate block instead.** Two of the four claims in this section measured false at HEAD
`1985425`: `?freeze` is no longer inert under `?capture` (fixed in `c9fa59c`), and the free-running
G1 1.6265 / G2 0.9372 / G7 0.0739% below do not reproduce under either AA/grade configuration —
`c70195c` predates TAAU + grade becoming the default, so this table describes the old forward
default. **Do not quote 0.9372.** The 1.5547 body-framing figure could not be reproduced from any
configuration and is withdrawn. Kept as written because the reasoning about step count is still
correct and is what the fix was built on.

| gate | measured at `c70195c` | verdict then | note |
|---|---|---|---|
| G1 | 1.6265 linear | PASS | inside the 1.43–1.64 band; the **1.5547 at body framing** here is withdrawn |
| G2 | 0.9372 luma, 1.29× sat | PASS, all four clauses | 0.9200 at 900 px; four seeds byte-identical. **Does not reproduce at HEAD** |
| G3 | saturation rises, hue reddens | PASS | still cannot certify a material — passes on stock too |
| G4 | **1.7469** /255 at 3840 px | PASS | mid-band. The same plate reads 2.1849 at 900 px, where the band does not apply. This one DOES reproduce, on `?aa=msaa&grade=0` |
| G5 | 0.0002% clipped | PASS | |
| G6 | 0.00001 | FAIL | `?cards=0` → 0.00393. It is measuring eyelashes, not a black point |
| G7 | 0.0739% of the band | PASS | |

**Six of seven was the reading at `c70195c`; it is five of seven at HEAD.** The diff request filed
against `packages/testbed/src/alive.js` for the `?freeze`/`?capture` contradiction was actioned.

**Three gates were one-sided or folded, and are not any more.**

1. **G1 was `< 2.00` and nothing else.** The spec states the parameter as a range — *"KEY : FILL on
   face 1.2:1 to 2.0:1"* — and only the ceiling was transcribed, so **1.344 linear read PASS**
   against a computed reference band of 1.43–1.64 that the tool printed beside the verdict without
   enforcing. Now two-sided against the band's own floor, reporting **which side** ("TOO FLAT" /
   "TOO CONTRASTY"), proven red at 1.344 *and* at a dead-flat 1.000 — which is what this page's old
   inline rig actually measured — and proven not to reject the spec's own reference pair at 1.6344.
2. **G2's hue clause folded the colour circle.** `hueDistanceFromRed` returns `min(hue, 360 − hue)`,
   which throws away the side, and the clause was explicitly defended on that symmetry. The defence
   is wrong about the reference: the spec's two hexes are on the **same** side of red — sclera
   `#9D7274` at 357.209° and cheek `#96767D` at 346.875°, both magenta-of-red — so co-siding is a
   measured property of the published palette rather than an invented band. A magenta sclera beside
   an orange cheek passed the ordinal clause outright and is now caught. The neutral zone is the
   reference sclera's **own** 2.791° from red, which makes it provable that the clause cannot
   reject the palette it came from — asserted, not assumed. It also closed a false pass the file's
   own hue sweep had been printing as a survivor at 15°.
3. **`travel.mjs`'s auto threshold guessed, and guessed wrong.** `p5 + 0.20·(p99 − p5)` — three
   constants, none derived from the image — put the cut at **0.1938** on a frame whose histogram
   valley is at **0.3588**, which is why a judge pinned `--threshold 0.30` by hand on every
   measurement it took. It survived by being robust rather than right: the silhouette edge is steep,
   so being 85% of the way to the wrong answer still catches the same pixels (0.04 px of head travel
   on a 4.22 px SD). Where it is not robust it failed silently — on a crop with no backdrop in it
   the cut moved 3.54× and the "silhouette" became the lit 80% of a patch of skin, whose centroid
   tracks the lighting. Replaced by **Otsu's cut** (no free constant) plus a **separability
   refusal**: η below 0.90 and the tool says *"REFUSED TO GUESS"* and exits 1. Floor sized from
   measurement — six real framings score 0.9542–0.9790, the degenerate crop 0.7132. Verified the
   change does not move the repo's recorded travel: `captures/r5-body` head SD 11.44 → 11.36 px.

**`measure.mjs`'s plate identity was also wrong in one specific way**: `canonicalPageKey` stripped
`capture` from a page key on the ground that it is a delivery mechanism. It is the flag that decides
whether `?freeze` works, so two recipes shared one key and the G2 reproduction check would have
called a correct free-running plate a drift.

**Gate counts after the round:** `tools/critic/selftest.mjs` **235/235** (was 208),
`travel.selftest.mjs` **126/126** (was 113), `heatmap.selftest.mjs` 57/57. Six of the counts
recorded in LEARNINGS Part 3 had drifted and five files were missing from that list entirely.
⚠️ **Every selftest in the repo exited 0 on a clean `c70195c` at the start of this pass, and forty
minutes later — same session, three other agents mid-save — `Grade.selftest.mjs` read 37/44 exit 1
and `TRAAPost.selftest.mjs` 5/6 exit 1, while `GroundContact` went 31 → 36 and `LightingRig`
38 → 46.** Almost certainly half-written files rather than regressions, but nothing in the run
could tell the two apart. **The integrator must re-run the full set once the tree stops moving;
do not read either colour above as a verdict.** LEARNINGS Part 3.

---

### 2026-08-08 — the docs were audited against execution, and the instrument was audited against itself

⚠️ **READ THIS BEFORE QUOTING ANY PLATE NUMBER BELOW.** Every `alive.html` measurement in this
section was taken **during a live fan-out**, with three other agents saving files under `packages/`
throughout, and the page moved under the instrument while it was being audited. Worked example: G2
read **0.8127** at build `cf338259…`, and **0.7216** at build `7eda3451…` ninety minutes later,
with the cheek reference moving 0.7515 → 0.8494 — somebody changed the shading, legitimately, and
neither reading is wrong. The **mechanisms** below are robust and re-derivable; the **values** are
stamped to a build and will not reproduce after the integrator lands this round. Re-run
`node tools/critic/measure.mjs <plate> tools/critic/regions.lighting-portrait.json --human` and
compare `capture.json`'s `source.packagesDigest` before treating any of them as current.

**Six statements in `docs/` measured false.** Each is corrected in place, at the line it lived on,
with the command that produced the correction. Listed here so a reader who trusts this file knows
what kind of error it is prone to.

| statement | where | measured |
|---|---|---|
| eyelash cards "carry a white `MeshStandardMaterial`" | PROGRESS, open leads | the texture's opaque texels are sRGB **(0.0327, 0.0118, 0.0039)** — near-black. The *factor* is white; the sentence inverts the mechanism |
| AP composite shortfall "8.22 mm … Bates' Q1 10.34" | PROGRESS, open leads | **8.77 mm**, shortfall **1.57 mm**. The table 400 lines above already said so |
| `gaze.head`'s residue "is a **roll** contribution" | PROGRESS, open leads | roll is 0.661° SD = 1.2 mm; the slide was **9.22 mm** and it was **yaw through a 47 mm lever**. Fixed in `1df749b`, left standing as a live lead for two rounds |
| "the three remaining frame-coupled layers — `Gaze.js:1100`, …" | PUNCHLIST:103 | **two**, then **zero**. Gaze was already converted, and `Gaze.js:1100` never held the call |
| "a concurrent agent's file edit will kill a long browser capture" | LEARNINGS §1.12 | **false since `capture.mjs` started its own un-watched vite.** Proven both ways: default vite sends `full-reload` and destroys the context; the tool's settings send nothing and it survives |
| G2 sclera:cheek **0.9641** on `alive.html`, gate green | PROGRESS + PUNCHLIST 3.3 | **Resolved 2026-08-08 and the gate is green again.** The red readings (0.8127, then 0.7836, and the four-seed spread) were all taken through `?capture`, which ignores `?freeze` and advances the simulation. Free-running `?bare&freeze&seed=1`: **0.9372 PASS at 3840 px, 0.9200 at 900 px, and byte-identical across four seeds** |
| "the eye shader makes G2 worse … −0.062 of ratio", from `?eyes=0` | PROGRESS 3.3, added the same day | **the control was compound.** `?eyes=0` removed the occlusion sheet too (`eyeOcclusion 4 → 0`), and the two subsystems pull opposite ways on the luma half. Isolated: shader **+0.0388** luma (dpr 2) / **+0.0414** (dpr 1) and **+0.5876** saturation. Fixed in `alive.js`; gated by `alive-toggles.selftest.mjs` 16/16. Re-challenged for reversing sign under `?capture` and **upheld** — see the four-recipe table below |
| `?freeze` "pins the POSE but not the ocular or postural layers" | LEARNINGS §1.20, `measure.mjs`'s G2 warning | **false on the rAF path and true only under `?capture`.** Free-running, `?freeze` pins everything: four seeds, one byte-identical PNG. `__SUGATA_STEP__` advances the simulation regardless of the flag, so `?freeze&capture` ≡ `?capture` byte for byte |
| G1 "< 2:1", one-sided | `measure.mjs`, PUNCHLIST 3.8 | the spec states the parameter as a **range** — "KEY : FILL on face 1.2:1 to 2.0:1" — and only the ceiling was gated, so **1.344 linear read PASS** against a reference band of 1.43–1.64. Two-sided since 2026-08-08; body framing, recorded here as 1.2104, now measures **1.5547** |
| `travel.mjs`'s auto threshold | tool + LEARNINGS Part 3 | `p5 + 0.20·(p99 − p5)` put the cut at **0.1938** where the histogram's valley is at **0.3588**, and returned a cut even on a frame with no valley — an all-figure crop got 0.6852 catching 79.8%, inside the plausible band, no warning. Otsu + a separability refusal since 2026-08-08 |
| eleven selftest check counts in LEARNINGS Part 3 | LEARNINGS Part 3 | **six had drifted and five files were missing entirely.** Gaze 112→114, sway 194→208, GroundContact "untracked"→31, EyeMaterial 131→132, critic 125→235, travel 111→126; absent: SkinRegions 29, Grade 28, TRAAPost 6, Toksvig 9, alive-toggles 16 |

Two of those had already been *corrected elsewhere in the same file* and left standing in the
place a reader looks first. **A number that appears twice will be updated once.**

**🎯 And the floor the gates are built on was never measured.** `sway.selftest.mjs:632` calls 1.6 px
"the one empirical datum this project owns on the subject" and cites `PROGRESS.md:550-552` — five
lines inside the block this file marks `⚠️ superseded`. Its two halves are out by **1.85×** (4.5 mm
at the printed 0.6574 px/mm is **2.958 px**, not 1.6). What this project actually owns is a
**bracket** from two blind-judge observations: **0.48 px** peak-to-peak reported as "the hands never
move", and **10.6 px** of pelvis excursion reported as a counted event. Full audit and a concrete
staircase design in LEARNINGS §1.14a. Every gate that cites 1.6 px should cite the bracket instead.

**The objective instrument was blind in three places and is not any more.**

1. **G2 measured half its own spec sentence.** The spec says the sclera matches the cheek's
   luminance *and* is more saturated than skin (0.275 vs 0.215). Only the luma clause was gated, so
   a grey eyeball at the right brightness scored green. G2 now gates both, against a reference
   **1.2839** recomputed at run time from the spec's own hexes (`#9D7274` / `#96767D`) rather than
   transcribed from its prose. Measured on `alive.html`: **0.417×**, out by 3.1×. Proven red by a
   grey sclera solved to match the reference luma to one code value, so the luma half provably is
   not what catches it, and by a weak-chroma sclera that passes the ordinal test and fails the band.
2. **A gate number could be transplanted between pages and nothing said so.** G4's 1.9495/255 was
   measured on `skin.html` and quoted as certifying `alive.html`, which reads **1.4764** at the
   same width. `measure.mjs` now discovers `capture.json` beside the plate, prints a `measured on:`
   line, stamps `measuredOn` into **every gate's** measured block — because gate blocks get copied
   out one at a time — and warns loudly when a plate has no provenance at all.
3. **`capture.mjs`'s byte-reproducibility check was a false-negative generator.** It compared
   SHA-256 digests, which is a boolean over the last code value, and called an unchanged clean
   plate "NOT byte-reproducible" on **8 of 10 runs** (diverging at frames 8, 11, 14, 15, 21, 21,
   22, 24). Differenced in pixels instead, six independent processes of `/alive.html?bare&frame=body`
   at seed 1 agree on **29 of 30 frames** and the thirtieth differs on **44 px of 210,000 (0.021%)
   by at most Δ3/255**. Attributed by toggle rather than argued: `?cards=0` → **30 of 30**
   bit-identical, `?msaa=0` → one pixel at Δ1. It is the alpha-to-coverage resolve on the hair
   cards. The check now reports a magnitude against a Δ6 / 0.1% tolerance, both sized from that
   measurement, with the bit-identical count kept as a reported fact rather than as the verdict.

**🚩 A new hazard replaced the one §1.12 used to warn about, and it is worse.** The watcher-off
server pins the tree for **one run**; two runs in a fan-out are of different builds. Measured:
twelve captures at seed 1, six either side of a concurrent agent saving `FacialIdle.js` and
`HandIdle.js` — **within** a group, worst Δ3/255 on 0.021% of pixels; **across** the groups,
Δ**209**/255 on **0.391%**. `capture.json` now carries `source.packagesDigest` (git HEAD plus a
content hash of every file under `packages/` vite can reach). Six back-to-back runs while writing
this produced **three** distinct digests.

**Punch-list 2.11 is closed and 3.3 is reopened.** 2.11: every surviving `poissonEventOccurs` call
is inside a known-bad branch, `FacialIdle.selftest` is 27/27 with a 2.1e8× rejection and
`idle-motion.selftest` 106/106 with 1.1e7×. 3.3: G2 is red, and **the claim that the eye shader was
on the losing side of its own control is withdrawn** — `?eyes=0` was removing the occlusion sheet
as well as the shader, so it was never that shader's control. Isolated, the shader takes G2 luma
0.8815 → 0.9203 and saturation 0.7479 → 1.3355. See 3.3/3.4 below.

**Five documented selftest counts had drifted** and every command in LEARNINGS Part 3 was re-run:
`tools/critic/selftest.mjs` 79 → **125** (now 125 including the new provenance and comparison
gates), `EyeMaterial.selftest.mjs` 99 → **131**, `LightingRig.selftest.mjs` 34 → **38**,
`sway.selftest.mjs` **194**, and `travel.selftest.mjs` (**111**) was missing from the list
entirely. ⚠️ `LightingRig.selftest.mjs` **exits 0 even when it prints FAIL** — it cannot be used in
a script. Filed as a diff request.

### 2026-08-07, latest — Phase 3 shading is on the aliveness page, and the motion layers were rendering a trajectory no camera sees

**🎯 The finding that matters most this round is not a shader.** Every stochastic motion layer drew
its Poisson arrivals **once per frame**, so the event RATE was dt-invariant and the TRAJECTORY was
not. Measured before the fix: `Sway` consumed **120.1 / 240.1 / 480.1 random draws per second** at
30 / 60 / 120 Hz, `BodyIdle` 30 / 60 / 120, `Breath` 0.3 at all three. At seed 1 over 900 s the
stance blend spanned −0.771 at 30 Hz against −0.990 at 60 Hz — **the weight transfer never
completed at the frame rate the judge's captures are taken at.** Worst bone divergence between two
traces of the same seed: **49.4 mm** (Sway), **12.4 mm** (BodyIdle), 0.039 mm (Breath). Every rate,
amplitude and spectral gate in the repo stayed green throughout. Fixed in `Sway`, `BodyIdle` and
`Breath` by `Signals.PoissonSchedule` — one interval per EVENT on a per-process forked stream, the
frame cut at the arrival, in-flight events aged before new ones fire. All three are now dt-invariant
to float dust (worst 0.0008 mm), and both selftests carry a FRAME-RATE INVARIANCE gate proven red by
reintroduction at **2859×** and **962×** the tolerance. `Gaze`, `FacialIdle` and `HandIdle` still
have the defect — punch-list 2.11. See LEARNINGS §1.13.

**Composite centre-of-pressure RMS moved, because the dt fix re-rolled the realisation.** 900 s,
12 seeds:

| | before | after | reference |
|---|---|---|---|
| ML median | 11.63 mm | **10.23 mm** | inside Bates' IQR 9.58–66.5 |
| AP median | 8.22 mm | **8.77 mm** | still BELOW Bates' Q1 of 10.34 |
| AP shortfall vs Bates Q1 | 2.12 mm | **1.57 mm** | recorded known state, gate still passes |
| mean resultant velocity | 18.2 mm/s | **18.22 mm/s** | unchanged |

Read the AP direction carefully: the shortfall got **smaller**, which brings the known-red assertion
nearer to closing without closing it. Decomposed by execution, the whole move is the dt fix; the new
`MEDIO_LATERAL_ANKLE_SHARE` moved the composite by exactly nothing (ML 10.69 / AP 8.95 either way on
the commanded signal), which is the design claim and is now measured rather than asserted.

**Lower-body legibility: the defect was real, and both its size and its location were wrong.** The
1.6 px indistinguishability floor is a **peak-to-peak**; the report that said the lower body was
dead compared it against **standard deviations**, which on these traces are 10–12× smaller. Measured
in the matching statistic — median travel inside a sliding 15 s window, `captures/r5-body`, 12,600
frames:

| band | 15 s travel | quiet tenth | global SD | × the 1.6 px floor |
|---|---|---|---|---|
| head | 20.84 px | 16.20 | 11.03 | 13.0 |
| shoulder | 11.88 px | 9.99 | 10.83 | 7.4 |
| hip | 11.79 px | 10.01 | 10.92 | 7.4 |
| knee | **6.40 px** | 5.07 | 5.72 | **4.0** |
| ankle | **2.01 px** | **1.06** | 2.04 | 1.3 |

Only the ankle band is marginal, and it is **geometrically bounded, not amplitude-bounded**: its
centroid sits ~80 mm above the ankle joint on a 420 mm shank whose lower end friction-pins, so it
travels ~0.19× whatever the knee does. Turning the free-foot yaw release and the toe lift off
together changes it by **0.01 px**. A GLANCE LEGIBILITY gate now states per-band travel in pixels at
the named framing, proven red against the historical spine-bend model which scores exactly
**0.0000 px** at knee and ankle. See LEARNINGS §1.14.

### 2026-08-07, latest — Phase 3.2 / 3.3 / 3.4 / 3.8, and what each is worth

**3.8 `render/LightingRig.js` — GREEN, and it replaced `alive.js`'s inline rig.** Lights are
authored as **irradiance at the focus**, derived through a closed-form projected solid angle,
rather than as `intensity`. That matters because `RectAreaLight.intensity` is a *radiance*: four
typed intensities express a ratio only for the exact panel geometry they were typed against, and
this rig's fill panel subtends **2.485×** the key's solid angle. The old inline rig's own header
claimed "a key:fill around 1.5:1" and measured **key:shadow 0.99 linear** — dead flat.

| plate | G1 linear | note |
|---|---|---|
| `lighting.html` portrait | **1.6091** | inside the reference band 1.43–1.64 |
| `alive.html` portrait, skin OFF | **1.6091** | the rig transferred exactly |
| `alive.html` portrait, skin ON | **1.5813** | the skin material costs 0.028 of ratio |
| `lighting.html` full body | 1.2104 | passes the < 2.00 ceiling, flatter than the band |
| `alive.html` full body | 1.2161 | " |
| known-bad: conventional 4:1 rig | **3.1497** | RED, as constructed |

The **"rim stops reading at body scale"** open lead is closed with a residue. Measured on the thigh
at full-body framing, the portrait rim azimuth (−152°) produces **no band at all** — 1 px, and the
luma profile inward from the silhouette is monotonic. The body preset (−134°, standoff pulled from
2.6 to 1.4 subject heights, irradiance 22) measures **14 px at 1.185×** contrast. Residue: no
azimuth makes a body-framing rim as wide as a portrait one, because the same rim covers **8.9×
fewer pixels** — an upper arm is 2.4% of the frame where a head is 21.4% — and at body framing a
legible rim and a reference-band face ratio pull against each other.

Frame cost, measured on the real 74k-triangle skinned figure at 1920×1080: **four area lights
3.608 ms**, independently reproducing this file's fitted 3.604 ms on entirely different geometry;
**one shadow caster 2.624 ms**, four 9.114 ms. The shadow cost is the extra geometry pass, not the
map's fill — halving the map 2048 → 1024 moved it 2.62 → 2.74 ms, i.e. not at all. **Four shadow
casters would be 12.7 ms of a 16.6 ms frame, so exactly one ships.** The caster is a `SpotLight`
rather than a `DirectionalLight` because a directional has no distance falloff, and with one,
turning shadows OFF measurably made the backdrop *darker*.

**3.2 `material/SkinMaterial.js` — half green, and the red half is arithmetic.** The high-pass σ
gate passes at **1.9495/255** at 3840×2160 against a stock-material control of 0.2244; on the
integrated `alive.html` at 900 px it reads **1.6357 with the material against 0.4347 without**, a
3.76× attribution. The terminator half is red and is **not closable by pre-integration**: at the
look spec's own 1.0–1.5 mm scatter distance it changes **0.00% of skin pixels** by more than one
code value. Cause measured, not guessed — this head's **median mean curvature is 0.00455/mm**
(r 220 mm; p90 0.1453, p99 0.4389; 0.00437–0.00510 median across the gender sweep), and
1.25 × 0.00455 is a ring curvature of 0.006 where the table is Lambert to four decimals. The
plumbing is provably live:

| scatter distance | 1.25 mm | 3 mm | 6 mm | 12 mm | 25 mm | 50 mm |
|---|---|---|---|---|---|---|
| skin pixels changed > 1 code value | **0.00%** | 1.25% | 2.83% | 5.46% | 9.29% | **13.64%** |

The default is left at the physical value rather than dialled to 12–25 mm to force a subjective win
(LEARNINGS §1.7, §1.11a). Budget **+0.301 ms** at 1080p, of which ~0.20 ms is the second specular
lobe. What actually closes a cheek terminator is the *other* technique — separable screen-space SSS
over the G-buffer's `sssMask` channel, which this material already writes and nothing else does.
New punch-list item 3.2b.

**3.3 / 3.4 `material/EyeMaterial.js` + `EyeOcclusion.js` + `EyeCatchlight.js` — ✅ THE G2 HALF IS
GREEN AGAIN, AND THE WHOLE RED EPISODE WAS A RECIPE.**

⚠️ **This block is kept as the record of how it was diagnosed. Its verdict is superseded by the
recipe table below it.** What it got right: G2 is a small-rect gate over an animating figure and
must be quoted as a distribution. What it got wrong: it attributed the distribution to `?freeze`.

**Current state, 2026-08-08, build `c70195c`, `alive.html?bare&freeze&seed=1` free-running (no
`?capture`), committed `regions.lighting-portrait.json`: G2 PASSES all four clauses — luma
0.9372 at 3840 px and 0.9200 at 900 px, saturation 1.29×, sclera more saturated than cheek, sclera
and cheek on the same side of red. Four seeds return one byte-identical PNG.**

The block as it stood:

1. ~~**It is a distribution, not a number.**~~ **HALF WITHDRAWN.** The distribution is real and it
   belongs to `?capture`, not to `?freeze`. `?freeze` pins everything on the rAF path — measured
   byte-identical across seeds 1 / 42 / 4242 / 20260807, one sha256 — while `__SUGATA_STEP__`
   advances the simulation whether or not the flag is set. Under `?bare&freeze&capture` stepped one
   frame the four seeds read **0.7836 / 0.9189 / 0.9292 / 0.4390** and the recorded quartet
   (0.8127 / 0.9627 / 0.9736 / 0.4384) is that same recipe two builds ago. The sclera rect really
   is 11×6 px on a ~40 px eye and really does walk onto the iris — after the head has moved, which
   on a genuinely frozen plate it has not.
2. ~~**The eye shader makes G2 WORSE on this page, not better.**~~ **WITHDRAWN 2026-08-08 — the
   control was compound and the sign does not survive isolation.** `?eyes=0` returned before both
   `new EyeMaterial()` *and* `buildEyeOcclusion()`, so it removed the eye shader **and the four
   occlusion/lacrimal meshes**, and every number ever attributed to it is a sum over two
   subsystems. Confirmed by execution, not by reading: `window.sugata.subsystems()` on
   `?bare&freeze&seed=1` reported `eyeOcclusion 4 → 0` under `?eyes=0`. Fixed in
   `alive.js#applyEyeShading`; the sheet now has its own control, `?eyeocc=0`.

   Re-measured with the two switched **independently**, four states from one page load of
   `?bare&freeze&seed=1` at 900×1200 CSS (canvas 1800×2400) — same frame, same process, same GPU
   state — through `measure.mjs` against `regions.lighting-portrait.json`:

   | state | G2 luma ratio | G2 saturation ratio |
   |---|---:|---:|
   | shipped — material attached, sheet on | **0.9203** PASS | **1.3355** |
   | `?eyeocc=0` — sheet off only | 0.9449 PASS | 1.2585 |
   | `?eyes=0` — material off only | 0.8815 FAIL | 0.7479 |
   | `?eyes=0&eyeocc=0` — what `?eyes=0` used to render | 0.9086 FAIL | 0.7059 |

   The two contributions have **opposite signs on the luma half**: the material costs 0.0388 and
   the sheet hands 0.0246 back, so the compound control reported 0.0117 for a shader worth 0.0388.
   With the sheet held constant the shader's contribution is **positive on both halves** — luma
   0.8815 → 0.9203, saturation 0.7479 → **1.3355** — and at this motion state the shader is the
   only reason the chroma half is inside its band at all. The recorded −0.062 was a sum, and a sum
   whose two terms partly cancel.

   ### ✅ THAT TABLE WAS CHALLENGED FOR REVERSING SIGN UNDER `?capture`. IT SURVIVES; `?capture` DOES NOT.

   **The challenge was correct about the symptom.** Re-run 2026-08-08 at build `c70195c`, one
   un-watched vite, one browser, sixteen plates, the four states above taken under four recipes:

   | recipe | shipped | `?eyeocc=0` | `?eyes=0` | both off | **shader's luma contribution** |
   |---|---:|---:|---:|---:|---:|
   | free-running, dpr 2 — *the table above* | 0.9203 | 0.9449 | 0.8815 | 0.9086 | **+0.0388** |
   | free-running, dpr 1 | 0.9200 | 0.9444 | 0.8786 | 0.9056 | **+0.0414** |
   | `?capture`, 1 step, dpr 1 | 0.7836 | 0.7844 | 0.8431 | 0.8441 | **−0.0595** |
   | `?capture`, 1 step, dpr 2 | 0.7841 | 0.7850 | 0.8343 | 0.8353 | **−0.0502** |

   The table above **reproduces to four decimal places** on a free-running load and **reverses
   sign** under `?capture`. Device pixel ratio is worth 0.0003 and is not the cause.

   **The cause is a defect, and it is not in the eye.** `?freeze` is **inert under `?capture`**:
   `alive.js`'s rAF path guards `advanceSimulation` with `if ( frozen === false )` and
   `window.__SUGATA_STEP__` — the clock `capture.mjs` drives — does not. Proven three ways:

   - `?bare&freeze&capture&seed=1` and `?bare&capture&seed=1` are **byte-identical** at 1, 4 and
     30 steps, and both report head gaze yaw `0.8348870263049992` at step 1.
   - `?capture` is **only a clock**: six steps at 60 fps is byte-identical to free-running
     `?freeze&preroll=0.1`, and two steps to `?freeze&preroll=0.0333`. Nothing about the render
     path differs.
   - And the figure moves fast enough to matter to an 11×6 px rect. Under `?capture` at 30 fps:

     | steps | head gaze yaw | G1 linear | G2 luma |
     |---|---|---|---|
     | 1 | 0.83° | 1.5976 | 0.7836 |
     | 2 | 2.65° | 1.5074 | 0.3142 |
     | 4 | 7.18° | 1.2106 | **0.2046** |
     | 30 | −19.22° | **1.0657** | 0.9856 |
     | free-running `?freeze` | 0.00° | 1.5962 | **0.9200** |

   **So the conclusion stands and is now recipe-attributed: with the sheet held constant the eye
   shader is worth +0.0388 to +0.0414 of G2 luma and +0.59 of saturation, on a genuinely frozen
   plate.** The `?capture` reading is not a second opinion about the shader; it is a measurement
   of a different, moving figure. The withdrawn sentence stays withdrawn.

   Two things this settles that were open:

   - **G2's "seed lottery" is a property of the capture recipe.** Free-running, seeds 1 / 42 /
     4242 / 20260807 produce **one byte-identical PNG** (sha256 `a61bedad…`) reading 0.9200 at all
     four. Under `?capture` stepped one frame they read **0.7836 / 0.9189 / 0.9292 / 0.4390**. Both
     observations recorded in this file were right, about different pages.
   - **G1 was being measured on a face turning away.** At four capture steps it reads 1.2106 and at
     thirty 1.0657 — under the reference band, and under G1's new two-sided floor.

   Filed as a diff request against `packages/testbed/src/alive.js`. `measure.mjs`'s
   `canonicalPageKey` no longer strips `capture` from a plate's identity, because it is the flag
   that decides whether another flag works. LEARNINGS §1.19a.
3. **And the gate was only ever measuring half its own spec sentence.** The look spec says the
   sclera "measures the same luminance as the surrounding cheek and is *more* saturated than skin
   (0.275 vs 0.215)". Only the luma clause was gated. Measured: sclera saturation **0.0917**
   against cheek **0.2200** — a ratio of **0.417** against a reference **1.284** recomputed from
   the spec's own hexes, i.e. out by **3.1×** on the half nothing was looking at. `measure.mjs`
   now gates both halves, with the chroma half proven red by a grey sclera that matches the
   reference luma to a code value.

Diff request filed to the eye agent. Everything below this paragraph is the record as it stood and
the refraction evidence, which is unaffected — it is measured on geometry, not on this gate.

Refraction is proved by execution: **−0.593 px/deg**
of refraction-only pupil displacement over a ±15° camera sweep against a **−0.481 px/deg** Snell
prediction for the fitted 3.328 mm chamber, and **1.198×** corneal magnification of the pupil chord
— neither producible by a flat disc. Shader-side pupil dilation spans 3.62 / 4.99 / 6.56 mm.

Every geometric constant is fitted from the mesh at load, so the material is per-figure: sclera band
radius 14.72–15.08 mm, corneal anterior radius **7.62 (g000) → 7.17 (g100) mm monotone**, iris plane
depth 12.68–13.12 mm at an RMS of 0.36–0.40 mm about the plane, iris radius 6.30–6.41 mm, corneal
apex to iris plane 3.14–3.51 mm. The iris and pupil radii come from `brown_eye.png` at 0.1135 and
0.0250 uv, measured on 360-sample annuli.

⚠️ **Superseding note on the anterior chamber.** The spike's 2.291 mm is apex-to-apex between the
two SHELLS; the number the refraction actually crosses is corneal apex to the **fitted iris plane**,
**3.328 mm** on g050. Different quantities, both correct — quote the one the formula uses.

⚠️ **G2 does not isolate the eye shader under this rig** — still true, and now for a sharper reason
than "the numbers moved". Two findings from the toggle audit, both by execution:

1. **`?freeze` with no `?preroll` makes `?seed` inert.** With freeze on and no pre-roll,
   `advanceSimulation` is never called, so no motion layer ever writes a morph and the seed cannot
   act. Measured 2026-08-08: `?bare&freeze&seed=1`, `seed=42` and `seed=20260807` at 900×1200 CSS
   came back **byte-identical — 0 differing samples of 17,280,000**. The four-seed G2 spread
   recorded above (0.8127 / 0.9627 / 0.9736 / 0.4384, attributed to `alive.html?bare&freeze`)
   cannot have come from that recipe; it must have carried a pre-roll or capture stepping. The
   spread is real, the recipe printed beside it is not.
   ✅ **CONFIRMED AND THE OPEN HALF IS CLOSED: it was capture stepping.** Re-measured the same day
   over all four nominated seeds — free-running `?bare&freeze` gives **one** PNG, sha256
   `a61bedad…`, G2 0.9200 at every seed; `?bare&freeze&capture` stepped one frame at 30 fps gives
   **0.7836 / 0.9189 / 0.9292 / 0.4390**. `?freeze` is inert under `?capture` because
   `__SUGATA_STEP__` calls `advanceSimulation` unguarded, and `?freeze&capture` is byte-identical
   to `?capture` at 1, 4 and 30 steps. This paragraph's inference was right and its "must have"
   is now a measurement.
   ⚠️ **SUPERSEDED as a statement about the page, 2026-08-08.** The inertness was fixed in
   `c9fa59c` and the capture frame epoch pinned in `4aafd91`; the same four seeds on the same
   recipe now return **one PNG and G2 0.9182 at every one**. The reasoning above stands as the
   derivation; the four values do not reproduce and must not be quoted.
2. **Once the stack does run, G2 stops seeing the eye at all.** With `?preroll=6`, all four eye
   states measure the **same** G2 at seed 1 (1.0033) and at seed 42 (0.7879) — the toggles change
   nothing, because the rect is no longer on the sclera. Only seed 4242 separates them
   (0.6406 shipped against 0.7536 with `?eyes=0`). So at 2 of 3 pre-rolled seeds the gate is
   *insensitive to the subsystem it is supposed to be measuring*, which is a stronger statement of
   the "the rect is a lottery" finding recorded further down.

The attributable evidence for 3.3 remains the refraction sweep and the difference between two
plates from **one page load**, never the gate. `alive-toggles.selftest.mjs` now holds the toggles
themselves to the contract that makes such a difference mean anything.

### The integration itself, and the two defects it exposed

`alive.html` — the page every judge captures — carried the raw GLB materials and an inline rig until
this round. It now builds `LightingRig`, `SkinMaterial` and `EyeMaterial` + `EyeOcclusion` per bake,
disposes them on a gender swap, drives `Pupil` into `EyeMaterial.pupilScaleUniform`, and hands the
eye shader the rig's own key direction. The controls are `?skin=0`, `?eyes=0`, `?eyeocc=0`,
`?cards=0`, `?shadows=0` and `?msaa=0` — **one subsystem each, and that is now gated rather than
assumed**. `window.sugata.subsystems()` counts what is live off the scene graph, and
`packages/testbed/src/alive-toggles.selftest.mjs` loads the page once per toggle and fails if any
of them moves a second subsystem. It exists because `?eyes=0` moved two for two review rounds.

It stays on the **forward** path: `markAsSkin` is deliberately not called, because a material
carrying `mrtNode` cannot be forward-rendered, and turning on the deferred G-buffer would change
the render path every Phase 2 motion number was measured against for no channel anyone consumes yet.

Two defects only integration could find:

1. **`EyeOcclusion` placed its sheets from the head bone's CURRENT transform, not its bind
   transform.** Invisible on `eye.html`, which never poses the figure. On `alive.html`, which
   applies `relaxed-standing` first, both sheets landed **29.3 mm** to the character's left of
   their own eyes — head-local x **+0.0582** and **+0.0004** against a bind-correct **±0.0289** —
   putting one on the temple as a visible grey quad. Fixed by reading
   `skeleton.boneInverses[headIndex]`. LEARNINGS §1.16.
2. **A still-plate gate on an animating page needs its motion state pinned.** At `?preroll=6` the
   head sits at **35.8°** of gaze yaw and the committed region file samples the backdrop; G1 reads
   1.83 there against 1.58 at rest. LEARNINGS §1.17.

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

⚠️ **"EVERY MILLIMETRE OF THAT RESIDUE IS `gaze.head`" IS TRUE OF A STATISTIC NOBODY MEASURES, AND
FALSE OF THE ONE A JUDGE DOES.** Corrected 2026-08-08. The finding above is computed on a
**projected-VERTEX mean**; `travel.mjs`, and therefore every judge, computes the centroid of a
**thresholded SILHOUETTE**. `sway.selftest.mjs`'s own comment claimed the two were laid side by
side. The bands matched; the statistic never did — on the same 420 s trace at seed 4242 they read
**3.4521 (vertex) and 1.0257 (silhouette)** against the judge's rendered **1.0596**. The silhouette
form lands within 3.2% of the render; the vertex form is out by 3.4×.

On the statistic a judge measures, removing `gaze.head` moves head/pelvis by **at most 0.013**
across the judge's two seeds — while moving the vertex statistic 3.85–4.46×, which is why it looked
like the whole residue. And `Sway` ALONE, with no gaze layer in the stack at all, scores
**1.045–1.175**, i.e. HIGHER than the full stack's 0.9918–1.0257.

🚩 **So the "≤ 1.0 target" was never a property of this statistic.** It is the BONE-MARKER ceiling
from the HEAD PARKED work, borrowed onto a band ratio it does not describe. All twelve seeds of
Sway alone exceed 1.00 on it and always did, and the band ratio has a geometric floor above 1 for
any righted body — hip band centroid 864 mm, head band 1506 mm, pivot 67 mm; the unrighted rigid
lever predicts 1.805 and measures 1.697–1.905. **Nothing in the layer needs changing.** If a judge
still reports the head leading the hip by eye, the next step is the two-alternative staircase
LEARNINGS §1.14a designs, not another coefficient.

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

~~⚠️ **Nothing has looked at these eyes.**~~ **Something has, now.** `material/EyeMaterial.js`
(punch-list 3.3) ships and is on `alive.html`. The eye agent looked at an eyes-only crop and a
portrait: iris fibres, a dark round pupil, a legible limbal ring, sclera veins, two crisp
rectangular catchlights, lid-margin contact shading and a lower-lid tearline; against the shipped
GLB baseline the sclera goes from glaring white to a warm mid-grey. **That was the builder looking
at its own work (§1.9 / Part 4) — no blind judge has seen it yet.** Two things to point one at: the
lacrimal tearline reads slightly bright and hard along the lower lid at an eyes-only crop and is
gated by nothing, and no source in `research/` gives a value for it.

Note on which anterior-chamber number to quote: the spike's **2.291 mm** is apex-to-apex between the
two SHELLS; the depth a refracted ray actually crosses is corneal apex to the **fitted iris plane**,
**3.328 mm** on g050. Different quantities, both correct.

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

  🚩 **STOP. This is the sentence the whole project's visibility floor was taken from, and it is
  inside the superseded block.** `sway.selftest.mjs` calls it "the one empirical datum this project
  owns on the subject" and cites these three lines by number. Three things are wrong with using it:
  it sits below a `superseded` marker and everything else around it has been retracted; **its two
  halves disagree by 1.85×** (4.5 mm at the framing constant `idle-motion.selftest.mjs` prints,
  0.6574 px/mm, is **2.958 px**, not 1.6); and "indistinguishable" is one agent looking at two
  stills it did not keep, which bounds a threshold from one side and does not locate it. **Do not
  cite 1.6 px.** LEARNINGS §1.14a has the audit, the 0.48–10.6 px bracket that replaces it, and the
  staircase that would actually measure it.
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
   ✅ **The 2.11 blocker on this is CLEARED** (2026-08-08): all four motion layers are frame-rate
   invariant and gated both ways, so a 60 Hz measurement and a 30 fps capture are now of the same
   trajectory. Take the capture with `--postural-seeds` and check the manifest's
   `source.packagesDigest` matches across the clips before handing them to a judge.
2. **A blind visual judge on the integrated `alive.html`** — it is the first time the page has
   carried real shading, and three things want naming explicitly: the violet rim/kicker cast and
   the blue eyelashes, whether the full-body figure floats for want of a floor shadow, and the
   lacrimal tearline.
3. **Phase 3, what remains:** `3.2b` separable screen-space SSS (the highest-value remaining skin
   work — pre-integration provably cannot redden this cheek), `3.5`/`3.6` hair, `3.7` fabric,
   `3.9` contact shadows, `3.10` bent normals, `3.13` the grade.
4. Open Phase 0 items: `0.4`/`0.5` (Anny morph pair + vertex-order diff), `0.9` (hair perf spike),
   `0.11` (faceunit visual check at gender extremes).

### Known open leads, recorded so they are not rediscovered

- **The rim/kicker chroma reads as a violet cast on the integrated page.** `LightingRig`'s portrait
  preset deepens the rim to `#4a7dff` at 27.46 radiance and the kicker to `#7a5bff` at 21.71,
  chasing the look spec's "much higher chroma than the skin". On a bald, bare-skinned figure
  against a near-black card that lands as a magenta wash on the crown, the shoulders and the whole
  shadow-side silhouette. The lighting agent reached only chroma *parity* (band saturation 0.174
  against skin at 0.181) and believes it is an ASSET limit rather than a rig limit: the spec
  measured that property on near-black hair (luma 0.067) and a dark suit, where chroma survives,
  and this figure is high-albedo skin under ACES, which desaturates at the top of the curve.
  **Re-check after 3.5 (hair) and 3.7 (fabric) exist; do not tune it now.**

  ✅ **The blue-eyelash half of this lead is CLOSED** (commit `62dc6db`), and one sentence of the
  original was wrong in a way that matters. It said the cards "carry a white
  `MeshStandardMaterial` with `alphaTest 0.5`". The `baseColorFactor` is `[1,1,1,1]`, which is why
  the sentence survived — but the material carries a **base-colour texture**, and re-measured
  2026-08-08 straight out of `figure_g050.glb` at the GLB's own `alphaCutoff` 0.5, the opaque
  texels average sRGB **(0.0327, 0.0118, 0.0039)** — **0.0025 linear**, near-black. `eyebrow001`
  is **(0.0547, 0.0277, 0.0240)**. That inverts the physics the fix brief was built from: with a
  white albedo a strong diffuse would *dilute* the Fresnel term, and it is precisely because
  there is **no diffuse to dilute** that the pixel was 100% the rim's own colour. The fix is
  `specularIntensity 0` plus alpha to coverage at cutoff **0.1** (not 0.5 — that binary cut threw
  away 15,368 lash and 20,262 brow texels). See LEARNINGS §1.11e.
- 🎯 **Gate `G7` now looks at the lash cards, and it is the only gate in the repo that asserts
  anything about colour outside four small patches.** Re-measured 2026-08-08 on
  `alive.html?bare&freeze` at 900×1200: **0.0056%** of the card band shipped against **0.7571%**
  with `?cards=0`, a **135×** separation on identical rects. G1–G6 were all green through three
  rounds on the plate whose worst feature was those cards.
- **`G3` cannot certify a skin shader — but the "it passes on the stock material" wording is now
  stale on this page.** Re-measured 2026-08-08 on `alive.html?bare&freeze` at 900×1200, G3 **FAILS
  both ways**: saturation rise **−0.0744** with the skin material and **−0.0720** with `?skin=0`.
  The original 0.2384-passes-on-stock figure was taken on `lighting.html` under a different rig and
  should not be quoted for `alive.html`. What survives unchanged is the conclusion: G3 is a
  property of the whole picture, `measure.mjs` warns about it on every run, and a material must be
  attributed with an off/on difference image instead.
- **`G6` on `alive.html` no longer measures the backdrop — it measures the eyelashes.** The recorded
  figure was whole-image p0.1 = 0.0250, over the central-face `frame` region 0.0120. Re-measured
  2026-08-08 the whole-image p0.1 reads **0.00001** (code 0), and with `?cards=0` it goes back to
  **0.02496**. The card fix put enough genuinely black lash and brow pixels in the frame to own the
  bottom 0.1% of the histogram. Both the old and the new number are honest; neither is about a
  grade lift, which is what G6 exists to detect. It belongs to 3.13 and it needs a `frame` region
  before it means anything on this page.
- ~~**No transmission and no roughness map on the skin.**~~ ⚠️ **BOTH SHIPPED IN `dc078ad` AND
  BOTH MEASURE LIVE TODAY.** The region map is fetched on `alive.html` (confirmed in the network
  log, not inferred) and its A/B moves 6.53% of pixels on the T-zone, lids, nose and lip.
  Transmission is live. What is true is that transmission is **STARVED, not absent**: it is worth
  0.0008 of ear luma under the shipped rig, because the only lights behind the subject are a blue
  rim and a 0.5 kicker. Given a warm back light the same term produces the spec's exact signature —
  red rises, green and blue do not move: ear S 0.648 → 0.722, hue 20.4° → 14.2°, with G going
  44.23 → 44.23 and B 27.19 → 27.36 while R goes 77.23 → 98.41.
- 🎯 **AND THE EAR'S REAL PROBLEM IS THE OPPOSITE OF THE ONE RECORDED.** The framing above — that
  the glowing ear needs more transmitted light — is backwards. Measured at 4K on `alive.html` with
  every toggle at its default: **ear luma 0.7072 against a lit cheek of 0.7935, i.e. 0.891×. The
  reference's ear is 0.344 against a cheek of 0.765, i.e. 0.450×. Ours is 2.06× too BRIGHT.**
  Transmission can only add light. The gap is a missing SHADOW.
  Part of it is now shipped: `material/SkinOcclusion.js` bakes hemisphere visibility and applies it
  CHROMATICALLY through Jimenez's multi-bounce fit, so a crease darkens *and saturates* rather than
  greying. It lands on the right anatomy (lip seam, nostril, alar crease, ear-to-skull gap, eye
  sockets) and moves the lit cheek by 0.0002. It is honest and small: the ear goes 0.7072 → 0.6953
  luma, S 0.2646 → 0.2740. **It does not reach #755052 and is not claimed to.**
  ⚠️ **The rest is probably not a skin item at all.** The visible lateral surface of a bald head's
  pinna facing a strong key is geometrically OPEN — hemisphere visibility there is ~1, correctly —
  while the reference character's ear sits in fringe and ponytail shadow. The look spec says so
  itself: asymmetry and shading are "delegated entirely to hair, fringe and lighting", and this
  figure is bald. Comparing a fully key-lit bald ear against a hair-shadowed reference ear is the
  same class of error as measuring a `?msaa=0` plate — two different scenes.
  ⚠️ **And the saturation gap is arithmetically unreachable by occlusion alone.** HSV S =
  (max−min)/max is invariant under a scalar, so no amount of grey darkening moves S 0.2646 toward
  0.414. Only the chromatic term moves it, and only in proportion to how occluded the surface is.
- ⚠️ **A thickness-driven thin-tissue albedo tint was built, calibrated and then KILLED**, and the
  reason identifies a defect class rather than one bug. The baked thickness is a SHORTEST PATH and
  is therefore discontinuous: a cheek vertex whose ray cone catches the oral cavity reads ~6 mm and
  its neighbour reads >100 mm. Driven into albedo it renders as blotches on the chin, nose and
  perioral ring at a **12/255 single-pixel neighbour step** — a seam, not a field. It ships at
  depth 0, which is bit-identical to a build without it.
  🚩 **This is also the identification of the "grey blotches from a region-map lip tint" regression
  that was reported and could not be reproduced.** `SKIN_DEFAULTS.lipTint` is `[1, 1, 1]`, so
  `mix( vec3(1), lipTint, mask )` is exactly `vec3(1)` at every texel and the lip tint cannot
  change a pixel. The blotches ARE real, for a different cause: any ALBEDO term driven by the raw
  thickness channel produces them. A smoothed or median-filtered thickness channel is what would
  make that route possible, and whoever does it must re-run the neighbour-step measurement —
  that statistic is what distinguishes a field from a decal.
- **The curvature map is a per-vertex quantity at ~7 mm vertex spacing.** Folds finer than that —
  the true nasolabial, the eyelid crease — are not in the map because they are not in the asset.
  That bounds how much any curvature-driven technique can ever deliver here.
- **`CORNEA_SCENE_SPECULAR = 0.05` is a mitigation, not physics**, and it is documented as one. At
  the cornea's physical reflectance the portrait key panel reflects as a hard-edged slab over most
  of the iris at an sRGB luma of ~0.36 against skin at ~0.80 — a corneal reflection *darker* than
  the skin reads as a plastic overlay. The rig has no HDR headroom: the panel radiance was chosen
  so the skin exposes correctly. Either raise the panel radiance and pull exposure back, or add a
  small high-intensity eye light; then set the constant back to 1. Belongs to 3.8's next round.
- **`EXPOSURE_CALIBRATION = 0.85` is calibrated against THIS asset's albedo** — MakeHuman's diffuse
  texture, not the look spec's `#E3BCA8`. It is not a free knob: 1.5 stops of underexposure takes a
  correctly-authored 1.47:1 design to a measured 2.037 and fails G1 outright, because ACES has far
  more gradient down there. Anyone touching 3.13's grade or the tone curve must re-run G1, and
  anyone changing the albedo must **re-measure** it rather than re-word it (LEARNINGS §1.11c). The
  four-row sweep needed to do it is in the constant's own doc comment.
- **The floor shadow does not read at full-body framing** and it was not fixable within 3.8. The
  key sits at 18° elevation so its cosine at the floor is 0.31 and it is 5 m away; the floor is
  dominated by the rim and the hemisphere term, neither of which casts. Sweeping the key's
  elevation 18 → 30 → 42° moved the floor near the feet from 0.3045 to 0.3251 encoded, i.e.
  nothing. Self-shadowing on the figure DOES work — the difference image shows clean shadow in the
  eye sockets, nostril, lip line, neck-jaw crease, clavicle hollow, inside the arm and between the
  legs. **Ask a judge specifically whether the full-body figure floats.**
- **A per-pixel difference tool belongs in `tools/critic`.** It is the only instrument that
  attributes a change to a MATERIAL rather than to a scene, and it caught the 0.00%-changed skin
  result that six subjective looks and five of the six objective gates then existing all missed.
  (G7 is the sixth's replacement in that sentence and it exists for the same reason.) Every remaining
  Phase 3 item needs exactly that.
- **`travel.mjs` reports only whole-clip statistics**, so the defect that started the lower-body
  round — the body being invisible inside the fifteen seconds a viewer watches — is not expressible
  in it, and its headline statistic is an SD while the project's own floor is a peak-to-peak.
  Wanted: `--highpass <seconds>` and `--window <seconds>` (median and 10th-percentile peak-to-peak
  inside a sliding window), both in the `--json`. Reference numbers to check an implementation
  against are in the legibility table above.
- ~~🎯 **`gaze.head`'s residue is a ROLL contribution** — yaw and pitch do not move the head joint.
  Two fixes worth considering: reduce the frontal-plane roll component, or add a vestibulo-collic
  stabilisation term.~~ **DISPROVEN AND CLOSED by commit `1df749b`, and it sat here as a live lead
  for two rounds after it was fixed.**

  It was never roll. Head world roll measures **0.661° SD**, worth 1.2 mm over a 108 mm neck, and
  the observed slide was **7.4×** that. The mechanism is **yaw acting through a lever nobody had
  measured**: the head joint sits **47.0 mm in FRONT of `neck_01`**, so yawing the neck about the
  room's vertical carried the skull through an arc of that radius — **9.22 mm SD** of lateral head
  displacement, which was the whole of the residue. `neckShare = 0.5`, argued as "the smoothest
  curve two joints can make", was silently setting it.

  Fixed by rotating the neck's share about the **cervical column**, measured at bind from the rig's
  own two joints, which puts the head joint on the axis where a rotation cannot translate it.
  Re-measured 2026-08-08 by running `node packages/core/src/motion/Gaze.selftest.mjs` (112 checks):

  ```
  unattended 300 s, column    head lateral 0.16 mm SD = 0.11 px,  head yaw 21.04° SD
  unattended 300 s, vertical  head lateral 8.52 mm SD = 5.70 px,  head yaw 21.04° SD
  ```

  The head turns exactly as far as it did; it stopped sliding. Gaze.selftest gained a gate that
  measures a **distance** rather than an angle — all 88 of its previous checks were on orientation,
  which is why a head describing a 47 mm arc passed every one. See LEARNINGS §1.18.

  ⚠️ The 60 Hz caveat that sat under this lead is also spent: `Gaze` was converted to
  `PoissonSchedule` in commit `6bf619b`. Its only remaining `poissonEventOccurs` call is at
  `Gaze.js:863`, inside the `if (this.frameCoupledArrivals)` known-bad branch the invariance gate
  rejects.
- **The medio-lateral ankle share.** `Sway.js` was implementing the SIDE-BY-SIDE row of Winter et
  al. 1996 on a figure standing at **18.6° of included foot angle**. Winter's own abstract gives the
  intermediate stance both mechanisms — "in the M/L direction the two strategies reinforce" — so
  `MEDIO_LATERAL_ANKLE_SHARE = 0.18` now routes a derived (not tuned) fraction of the lateral signal
  through the ankle. Measured cost: the ankle band's 15 s travel **1.09 → 0.98 px** and the knee
  band **7.75 → 7.52 px**, against a hip band **11.01 → 11.47 px** — i.e. it moves the lower-body
  number very slightly the WRONG way, and was shipped anyway for correctness. Measured benefit
  beyond correctness: it turns the unrighted-layer correlation SIGN rejection from a **6/12 coin
  toss** into a **12/12** gate. The whole change is one constant; set it to 0 to revert, and note
  that doing so puts that rejection back to a coin toss. Third time Winter 1996 has answered a
  question it was not asked in this project (§1.7d records the first two).
- **`BodyIdle`'s clavicle left-right correlation fails at seed 101** (0.275 against a 0.25 ceiling)
  on the NOISE DRIFT alone, with events disabled. Proven pre-existing: the drift is bit-identical
  before and after the dt fix (worst quaternion component difference **0** on four seeds). Likely
  §1.4 — the clavicle's noise lattice is the slowest in the layer, so a 60 s window contains few
  independent cycles and the sample correlation has a large standard error. Fixing it means deriving
  the band from the number of independent cycles in the window. **Not widened to suit.**
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
- **The fore-and-aft composite shortfall** — **8.77 mm** against Bates' Q1 of 10.34, a shortfall of
  **1.57 mm**. Analysed above; closing it requires contradicting Duarte. Asserted as a known state
  in both selftests. ⚠️ This entry read **8.22 mm / 2.12 mm** for a round *after* the numbers had
  moved — the dt fix re-rolled the realisation and the table 400 lines above this line already said
  so. Re-measured 2026-08-08 by running `node packages/core/src/motion/sway.selftest.mjs`
  (194 gates), whose COMPOSITE section prints `AP median / range 8.77  5.72-15.15` over its twelve
  seeds and `AP shortfall vs Bates Q1 (mm) 1.57`. **A number that appears in two places in one file
  will be updated in one of them.**
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
- ~~Full-body lighting is a scaled portrait rig; rim and kicker stop reading at body scale.~~
  **CLOSED with a residue** — see the 3.8 section above for the measured band widths and the
  residue (no azimuth makes a body-framing rim as wide as a portrait one).

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

### Shadows, and the four-light figure reproduced

Measured 2026-08-07 on the **real 74k-triangle skinned figure** at 1920×1080, WebGPU, 3 repeats ×
120 samples, variant order alternated, one render per frame, p95 headline.

| variant | Δ over ambient only |
|---|---|
| 4 area lights, 0 shadows | **3.608 ms** — independently reproduces the fitted 3.604 ms above, on entirely different geometry |
| + 1 shadow caster (the key) | **+2.624 ms** |
| + 4 shadow casters | **+9.114 ms** |

The shadow cost is the extra **geometry** pass, not the map's fill: halving the map 2048 → 1024
moved the key-shadow delta 2.62 → 2.74 ms, i.e. not at all within the ±1 ms run-to-run p95 noise.
**Four casters would be 12.7 ms of a 16.6 ms frame, so `LightingRig` pairs exactly one.**

⚠️ The 2.62 ms per shadow pass is a **single-source** number with no independent reproduction, and
it is higher than a 74k-triangle depth-only pass ought to cost on an M5 Max — it may be a three.js
WebGPU shadow-path inefficiency worth a spike rather than a hardware fact.

`SkinMaterial` costs **+0.301 ms** at 1920×1080 (1.8% of a 16.6 ms frame), of which ~0.20 ms is the
second specular lobe — the clearcoat is one extra LTC evaluation per rect-area light, and there are
four. The LUT and curvature fetches do not separate from noise.

**Budget left:** with 4 RectAreaLights (3.604 ms), one shadow pass (2.62 ms), 69 morphs (0.219 ms)
and the skin material (0.301 ms), roughly **9.8 ms of the 16.6 ms frame remains** for eyes, hair,
AO and the grade.

## Integration round, 2026-08-08 — everything is on the page a judge captures

Six agents worked concurrently on disjoint files and every one of them measured on **its own**
page. This section records what the integrated `alive.html` measures, because that is the only
number that certifies anything, and several per-page figures did not survive integration.

**Every plate here**: `node tools/critic/capture.mjs --url "/alive.html?bare&freeze" --seconds
0.034 --width W --height H --seed 1 --keep-frames`, then `measure.mjs` with the matching region
file. `?freeze` makes capture.mjs warn that every frame is identical — that is the point of a
freeze plate, not a fault.

### The seven gates on the integrated page

At the look spec's own **3840 px** reference width, portrait, default configuration:

| Gate | Value | | Note |
|---|---|---|---|
| G1 face key:shadow | **1.5954** | PASS | inside the 1.43–1.64 reference band |
| G2 sclera : cheek | **0.7872** | FAIL | the rect is a lottery — see below |
| G3 terminator | **+0.0474** | PASS | the lighting agent's warm fill; not attributable to a material |
| G4 flat-skin σ | **1.6877** | PASS | **closed this round**, 8.4× attribution against `?skin=0` (0.2013) |
| G5 clipping | 2e-06 | PASS | numerically green, and still ~60× under the reference's 0.017–0.036% |
| G6 black point | **1e-05** | FAIL | measuring the eyelash cards, not a grade lift — see below |
| G7 card band chroma | 0.000665 | PASS | held through the rim colour change |

⚠️ **G4 must be measured at 3840 px.** At 900 px the same page and material reads **2.2135** and
fails. High-pass amplitude is scale-dependent with no sound rescaling law; `measure.mjs` warns about
this itself. Both numbers are of the same render.

### G6 is measuring the eyelashes, and the backdrop constant is no longer what moves it

`BACKDROP_EMISSIVE` went **0x11151f → 0x050709** this round, and it is a real improvement **at body
framing only**. Measured on the integrated page, `?backdrop=` sweeping everything else fixed:

| | portrait p0.1 | body p0.1 |
|---|---|---|
| 0x11151f | 1e-05 | 0.04876 |
| 0x050709 (ships) | 1e-05 | **0.02186** |

Body halves, 2.2× toward the 0.004–0.016 band, and is still 37% over the ceiling. **Portrait does
not move at all**, because since the card fix (3.16) the genuinely black lash and brow pixels own
the bottom 0.1% of the histogram. G6 on this page needs a `frame` region before it means anything —
`?cards=0` returns it to 0.02496 and proves the attribution.

The ground plane costs G6 almost nothing: 0.02129 with `?ground=none` against 0.02186 with it.

⚠️ The 3840 px portrait figure of **0.01652** for body at 0x050709 recorded during the fan-out does
**not** reproduce here (0.02186). It was measured on `post.html` without a ground plane and before
the lighting rig changed. Prefer the integrated number.

### 🎯 The figure no longer floats, and it is attributed by toggle

`render/GroundContact.js` is mounted on `alive.html`. The floor darkens toward a sole:

```
                     floor +2 px    +120 px     drop
ground contact ON      0.2022       0.2218    +0.0195
?ground=0 (term off)   0.2313       0.2305    −0.0009      ← the judge's "floating"
```

A shadow map could never have done it: 60% of the light on the floor at the feet comes from the two
RectAreaLights, which cannot cast at all (three.js #14161).

### G2 is red, and BOTH candidate rects are lotteries — the gate was not bent

The eye agent filed a diff request to move `regions.lighting-portrait.json`'s sclera rect from
x 0.4033 to x 0.4656, which takes G2 from 0.7836 to 0.9483 at seed 1. **It was rejected**, on two
measurements taken at integration:

1. **The proposed rect lands on bare cheek skin, outside the eye entirely.** Rendered as a 10×
   magnified crop with both rects drawn and looked at: the shipped rect sits on the sclera; the
   proposed one sits ~56 px outboard on the cheek. Applying it would make G2 compare cheek against
   cheek and pass trivially.
2. **Neither rect is stable across seeds**, so the shift only re-rolls the lottery:

```
seed        shipped rect        shifted 6 px onto clean sclera
1           0.7836  FAIL        0.9483  PASS
42          0.9189  FAIL        0.8331  FAIL
4242        0.9292  PASS        0.8568  FAIL
20260807    0.4390  FAIL        0.8346  FAIL
```

The shipped rect does have a genuine defect — it overlaps the dark limbal ring, which is why 6 px
right moves it 0.78 → 0.95 — but that is not the reason G2 is red. **G2 is red because a fixed rect
cannot gate an eye that moves** (LEARNINGS §1.17). The fix is a landmark-relative rect or a
reported distribution over a seed set, not a nudge. Left red on purpose.

### 3.12 and 3.13 are reachable, measured, and not default

`?aa=msaa|off|traa|taau`, `?grade=1`, `?sharp=`, `?specaa=0`, `?ground=0`, `?backdrop=` all live on
`alive.html`. Portrait, 900 px, so comparable to each other and **not** to the 3840 px table above:

| config | G1 | G4 | G6 | G7 |
|---|---|---|---|---|
| default (MSAA) | 1.5976 | 2.2135 | 1e-05 | 0.000561 |
| `?grade=1` | 1.6382 | 2.4175 | **0.00393** | 0.000729 |
| `?aa=taau&grade=1` | 1.6410 | **1.842 PASS** | 0.00309 | **0.000224** |
| `?aa=traa` | 1.5973 | 4.2333 | 1e-05 | 0.000112 |
| `?specaa=0` | 1.5990 | 2.1712 | 1e-05 | 0.000561 |

⚠️ **BOTH SENTENCES THAT USED TO FOLLOW THIS TABLE WERE WRONG, AND THE TABLE ITSELF IS NOT
ENTITLED TO A VERDICT.** They said TAAU 0.66 + RCAS was "the only configuration that puts G4
mid-band", and that it could not be the default because the held-morph velocity defect "has no
dial that fixes it". Superseded 2026-08-08 — see the integration section at the end of this file:

- The table is at **900 px** and G4's band is stated at **3840 px**, three lines after this file
  says so itself. At the reference width the shipped MSAA default **already passed** G4 (1.7469).
  "The only configuration that passes" is false at the width the gate is defined at.
- The blocker **is fixed**, and not by a dial: `render/MorphVelocity.js` supplies the previous-frame
  morphed position. Held `jawOpen` 0.8, converged to frame 150: **15.96× the jitter floor
  unpatched, 1.60× with the fix.**
- **TAAU 0.66 + grade + RCAS 1.2 is now the default on `alive.html`.** `?aa=msaa&grade=0` is the A
  side.

`?aa=traa` reads G4 4.2333 because a temporal filter on frame 1 has no history — a single freeze
plate is the worst case for TRAA and should not be read as a defect. **Measured since:** on the
same static scene TRAA reads G4 4.2351 at frame 1 and 2.8352 at frame 300, 49% worse unconverged,
while MSAA is byte-identical at both. Anyone gating a temporal mode on a one-frame plate is
measuring the absence of history.

### The catchlight is on the page, and it is one highlight

Blob-detected above 0.93 × box max inside the iris, 900 px portrait:

```
shipped (EyeMaterial)   1 blob   peak 1.273× cheek
?eyes=0 (GLB eye)       2 blobs  peak 1.278× and 1.249× cheek
```

One dominant catchlight against the shipped asset's two, attributed by toggle. The spec's *size*
clause (2–4% of iris diameter) needs a 2160 px plate to resolve — at 900 px the iris is ~40 px and
the blob is 1 px.

⚠️ **This pair was captured with the OLD compound `?eyes=0`, so its B plate had no occlusion sheet
either.** Whether that matters is not obvious and is not asserted here: the sheet's ramp is squeezed
against the lid margin, but `EyeOcclusion.js` records the upper margin at 3.2 mm off the eye axis —
**inside** a 6.35 mm iris — so the sheet does cover iris the blob detector looks at. **Re-run the
blob count against the isolated `?eyes=0` before this pair is quoted again.** The claim is not
withdrawn, it is unverified under the corrected control.

### Two integration defects found and fixed, both silent

Both are in `alive.js` and both are recorded as LEARNINGS §1.24:

1. **The `?capture` hook drew the scene itself**, calling `stage.renderer.render()` rather than
   `stage.draw()`. On the deferred path the pipeline is what binds the MRT and runs the composite,
   so the grade and the temporal resolve were being thrown away — `?grade=1` produced a plate
   **byte-identical to no grade across all seven gates**, and `?aa=traa` was indistinguishable from
   `?msaa=0`. Nothing threw. Every measured number in this section was taken **after** the fix.
2. **`ground.update()` lived in a `stage.onFrame` callback**, which `?capture` stops calling. A
   contact shadow that stops following the feet on exactly the plates a judge measures. Per-frame
   figure work now has one named home, `trackFigure()`, that both frame paths call.

### Housekeeping

- `npm run build:pages` (`vite.pages.config.js`) now builds all **seven** testbed entries. It was
  documented as "make a temp config", rediscovered every round, and had already fallen a page
  behind. `npm run build` still builds only `index.html` — that is vite's default and is unchanged.
- `tools/critic/capture.mjs`'s declared postural table was re-measured after Sway's event shapes
  changed; `sway.selftest.mjs` is 208/208 again. This is punch-list 2.12's CLIP CONTENT gate doing
  exactly its job.
- `tools/critic/travel.mjs` gained the `foot` band (0.925–0.98) so a capture can confirm the offline
  foot-articulation prediction of 0.09–0.44 px.

---

## Integration round, 2026-08-08 (second) — the page wears the round, and `?freeze` finally freezes

Six agents worked disjoint files; this section is what integrating them made true. Every number
below was re-measured on the merged tree, not carried over from an agent's report.

### 🚩 `?freeze` was inert under `?capture`, and three agents found it independently

`alive.js`'s rAF path guarded `advanceSimulation` with `if ( frozen === false )`. The `?capture`
hook did not. So `?freeze&capture` was a contradiction the page resolved silently in favour of
motion, and **every "frozen plate" ever taken through `capture.mjs` was a plate of a figure walked
forward one simulation step per screenshot.** Proven three ways before the fix: `?freeze&capture`
was byte-identical to `?capture` at 1/4/30 steps; `?capture` stepped N×1/60 was byte-identical to
free-running `?preroll=N/60`, so it is only a clock; and one step at 30 fps already puts the head
at 0.83° of gaze yaw.

What it cost, all on one seed and one framing, varying only the step count:

| | 1 step | 5 | 15 | 30 | 60 | frozen |
|---|---|---|---|---|---|---|
| G1 | 1.5976 | 1.1948 | 1.3740 | 1.0657 | 1.1110 | **1.5991** |

A 1.5× spread across a reference band 0.21 wide. It is also the whole of punch-list 3.3's supposed
red — G2 reads 0.7836 captured and 0.9200 frozen — and the whole of G2's "seed lottery": free
running, four seeds come back as **one byte-identical PNG**. On the MSAA forward path, where a
static scene must be bit-identical, a 300-step "frozen" capture read forehead temporalRms
**3.6400/255**; it now reads **0.0000** and frames 1 and 300 are the same bytes.

### The page's default is now the best-measured configuration, not the historical one

`alive.html` boots into **TAAU 0.66 + Grade + grade-RCAS 1.2**. `?aa=msaa&grade=0` is the A side
and is the forward path every Phase 2 motion number was measured on.

⚠️ **SUPERSEDED 2026-08-08 (fourth pass) — the shipped row below is a set of pre-fix ranges and is
retracted as a current result.** Punch-list 3.20 pinned the capture frame epoch and the same recipe
now returns one PNG: G1 1.6630, G2 0.9197, G4 1.6262, G5 0.000002, G6 0.00001, G7 0.00069. Read
PUNCHLIST's seven-gate block. The `?aa=msaa&grade=0` row below still reproduces exactly, including
its sha256, and is the reason the harness can be trusted.

Re-measured after integration at 3840×5120 — G4's own reference width — converged to frame 60 on a
genuinely frozen page, both rows in one run so `packagesDigest` cannot differ.
**The shipped row is superseded — pre-fix ranges, retracted above.**

| configuration | G1 | G2 | G4 | G5 | G6 | G7 |
|---|---:|---:|---:|---:|---:|---:|
| `?aa=msaa&grade=0` | 1.6180 | 0.9221 | 1.7469 | 2e-06 | 0.00001 | 0.00074 |
| **shipped**, 14 loads | 1.6633–1.6638 | 0.9194–0.9198 | 1.6227–1.6362 | 1e-06–2e-06 | 0.00001 | 0.000721–0.000767 |

G2 is MARGINAL on both rows: 0.9221 clears the 0.92 floor by 0.0021 and 0.9198 misses it by 0.0002,
against a measured load-to-load spread of 0.0004.

🚩 **THE SHIPPED ROW WAS `1.6636 | 0.9201 | 1.6315 | 2e-06 | 0.00001 | 0.00077` AND WAS CALLED SIX
OF SEVEN. It is five of seven and the row is a range.** Re-measured at HEAD `1985425` over 14 loads
(10 captured, 4 free-running): every draw fails G2, the maximum observed is 0.9198, and 0.9201
never recurs. The MSAA row is byte-identical across loads and reproduces to five decimals, which is
what separates a harness fault from a render one. MARGINAL: both rows sit within 0.0021 of the 0.92
floor against a 0.0004 load-to-load spread, so neither verdict is a statement about the eye
shader — it is a statement about an 11×6 px rect. See the third-pass section below.

G4 is better centred on the shipped row, but **26% of that is film grain** — `?grain=0` takes it to
1.1951–1.1960, below the 1.5 floor. The decider is edges: single-pixel silhouette jumps
go **67.9% → 17.9%** at 900 px, and the eyelash/brow cards **44.5% → 30.8%** — which reverses
3.12's long-standing claim that losing alpha-to-coverage would cost card anti-aliasing.

At **body** framing the grade takes G6 from 0.01652 (3% over the ceiling) to **0.0126, inside the
band**. G6 is now red at portrait framing only, and is UNDECIDED there rather than failed.

### Everything the round built is on the page, one toggle each

`?morphvel=off|hold|exact` (3.12's rejection proof), `?cavity=0` (the baked hemisphere-visibility
term), `?grade=0`, `?aa=msaa`, `?gsharp=none`. `alive-toggles.selftest.mjs` went **16 checks (14
green) → 24 green**, and it earned the increase: it caught two real integration defects that no
other gate saw — `multisampleSamples` going dark on the shipped plate, and `?skin=0` reporting the
cavity term as collateral. Its new rows were then proved red three structurally different ways (an
inert toggle, a genuine collateral confound, and abusing the not-applicable exemption to retire a
check).

**The floor fix, the fill fix, the cavity term and the transmission term needed no wiring** — they
are defaults inside `LightingRig.js`, `GroundContact.js` and `SkinMaterial.js`, so they were on
`alive.html` the moment those files landed. The toggles exist so they can be *attributed* there,
which they could not be before: every attribution for the cavity term came off `skin.html`.

### LEARNINGS §1.24 re-verified on the merged tree, because it has bitten twice

Both frame paths, same recipe, pixel-differenced:

- **The grade is in the graph on each path independently** — 95.6% of pixels move against
  `?grade=0`, worst 231/255. The byte-identical failure mode is ruled out on both.
- **On the forward path the two paths are BYTE-IDENTICAL** (0.000% of pixels differ), which
  calibrates the instrument.
- On the temporal path they differ where they must and nowhere else: **2.37/255 mean on edges
  against 0.105/255 on flat pixels** with the grade off (jitter phase), and a uniform 1.07/255 with
  it on (grain, which is keyed on a frame seed the two paths clock differently). **No
  region-shaped divergence** — the row and column profiles are flat.
- The contact occlusion is present on both: under-sole delta −0.0191 (rAF) against −0.0200
  (capture).

### What integration did NOT close

- **G6 at portrait framing.** Unchanged and deliberately not closed by authoring a `frame` region —
  see the standing note at the top of PUNCHLIST.
- **The rim floods the portrait backdrop.** The lighting work fixed the body preset's 36.6:1
  environment spill to 2.10:1; the portrait preset keeps its 2.6-height standoff at **49.94:1**. It
  does not show on `alive.html` because that page's backdrop is a near-black emissive card, which
  is masking rather than a fix, and it is plainly visible as blue-violet wash on the silhouette.
- **`voice/Prosody.js` is reachable from no page**, so `npm run build:pages` does not compile it and
  the `?worker&url` AudioWorklet fix is not covered by any build in the repo. Verified by hand
  under the real `vite.config.js` — one self-contained 5.27 kB worklet, no imports, no `data:` URLs
  — but a hand check is not a gate. See LEARNINGS Part 2, "vite / the build".
- **Every clip-based motion number in this file predates the deferred default.** They are not
  invalidated, but they are no longer same-build comparisons.

---

## Fourth pass, 2026-08-08 — 3.20 landed, so every range became a value again

HEAD `2ec7db9`. Plates taken from the live tree with `packagesDigest` recorded per plate rather than
from a frozen snapshot, because the bytes turned out to carry the claim better than the snapshot
did — see the digest note below.

### 🎯 The shipped default is reproducible from its own identity

`alive.html?bare&freeze&seed=1&capture` at 3840×5120 dpr 1, 60 steps at 60 fps, TAAU 0.66 + grade +
RCAS 1.2, MSAA off. **Three loads → one PNG, sha256 `257caca2782adde9`.** The three loads span
*three* `packagesDigest` values (`88e231cb22a6f25c` ×2, `3b9036e830386551`) because other agents
were saving under `packages/` throughout — and the bytes are identical anyway, which measures the
thing the digest can only assert: the churn was selftest files, not shipped code.

The A side, `?aa=msaa&grade=0`, returns **`b3609ee0652db4c5`** over two loads at two further
digests, and that is byte-for-byte the plate PUNCHLIST recorded for this recipe at HEAD `1985425`.
**Two builds, one picture.** That is the control that lets the rest of this section attribute
anything: the forward path did not move between those builds, so whatever moved on the default
belongs to the temporal-plus-grade path.

### The seven gates, as values

| gate | shipped default ×3 | A side ×2 | was (14 pre-fix draws) |
|---|---:|---:|---|
| G1 | **1.6630** | 1.6180 | 1.6634–1.6637 — the value is BELOW the whole old range |
| G2 | **0.9197** | 0.9221 | 0.9194–0.9198 — inside |
| G4 | **1.6262** | 1.7469 | 1.6227–1.6362 — inside |
| G5 | **0.000002** | 0.000002 | 1e-06–2e-06 |
| G6 | **0.00001** | 0.00001 | 0.00001 |
| G7 | **0.00069** | 0.000742 | 0.000736–0.000767 — BELOW the whole old range |

**Five of seven on the default, six of seven on the A side, and G2 is the only gate that separates
them.** MARGINAL: G2 misses the floor by 0.0003 on one side and clears it by 0.0021 on the other,
on a page whose own width moves it by 0.0028.

🚩 **Two of the four ranges do not contain their own successor**, which is the finding rather than a
curiosity: the pre-fix draws sampled whatever grain phase and Halton jitter index a boot happened to
reach, and the pin chose the phase at step index 0 rather than a typical one. **Retiring a range is
a re-measurement, never a narrowing.** LEARNINGS §1.25m.

### Body framing was pending for two rounds and is now measured

900×1200, `regions.lighting-body.json`, `?bare&freeze&seed=1&capture&frame=body`, 60 steps. Two
loads → one PNG (`8b3fb2ae2118`). G1 **1.5869** (carried over as 1.5822 — Δ0.0047, still in band),
G6 **0.0126**, which reproduces the carried-over value exactly. `?grade=0` reads G6 **0.01652**, so
3.13's claim that the grade moves body-framing p0.1 from 0.01652 into the band at 0.0126 reproduces
exactly as well. **Body-framing G4 is not reportable at 900 px** — the band is stated at 3840 and
high-pass σ has no sound rescaling law — and nothing should quote it until a 3840-wide body region
file exists.

### Two attributions, both clean, on one byte-reproducible baseline

At 3840×5120: `?grain=0` moves **G4 alone**, 1.6262 → **1.1944**, so the grain is 0.4318 of 1.6262
(**26.6%**) and without it the default fails G4's floor. `?cards=0` moves **G6 and G7 alone**,
0.00001 → 0.00393 and 0.00069 → **0.008164** (11.8×), leaving G1, G2, G4 and G5 identical to four
decimals. Two toggles, two disjoint effects — which is what an attribution looks like when the
plate underneath it is deterministic.

And a third, measured to put a number on §1.25k rather than to attribute anything: at 900×1200 on
the shipped default, `?cards=0` changes **1.0672%** of the frame at a whole-frame mean |Δ| of
**0.9405/255**, while `?exposure=1.1` — one renderer property, the smallest confound anyone would
plant — changes **92.9958%** at **4.5718/255**. **87× the area and 4.9× the magnitude.** A second
load of the baseline changes 0.0000%.

### G6 is UNDECIDED and this round measured why, twice

`?cards=0` reads **0.00393 at 3840×5120 and 0.00393 at 900×1200** — the same number at both widths,
because it is the backdrop card's own emissive level, a rig parameter. The shipped reading moves
**0.00001 → 0.00309** across the same two widths. So on a `?bare` plate G6 counts how many
genuinely-zero alpha-tested lash texels the render resolves, and neither number is about a
black-point lift.

### The G2 seed lottery is over, and `measure.mjs` had been printing a retracted claim

Four seeds — 1, 42, 4242, 20260807 — on `?bare&freeze&capture` at 900×1200, one step at 30 fps:
**one PNG, sha256 `9a1292b4c887…`, G2 0.9182 at every one.** The recorded spread of
0.4390–0.9292 is not reachable.

🚩 **`measure.mjs` was printing *"?freeze is INERT under ?capture"* at the top of every report**, as
current fact, four commits after it stopped being true — the first thing a judge reads. Fixed, along
with the seed record it was built on and two more comments that rested on it. **And the mechanism
that was supposed to catch this could not**: the reproduction check only fires on a plate matching
the recorded recipe at a recorded seed, and the recorded values were unreachable, so no plate
anybody took could be comparable. *A staleness check keyed to a configuration goes quiet when the
configuration goes away.*

While re-taking the record, that same check was caught **crying wolf**: a 60-step plate of the same
page, size and seed reads 0.9169 against the 1-step record's 0.9182 and the tool reported *"the
render has moved out from under the record"*. Nothing had moved — the step count differs, and on a
temporal resolve that is a different picture. The step count is now part of the comparability test,
read from the frame file name, with its own sentence rather than a false alarm. Proven by execution
both ways on real plates: silent on the 60-step plate, silent on the four recorded seeds, and red at
Δ0.0006 — the smallest catchable drift — when the record is nudged.

### `docs/measured-claims.selftest.mjs` gained a fifth rule, because the fourth went obsolete

DRAWS could only ask "is this range the extremes of the recorded draws?". With the plate
reproducible there are no ranges left to police, and the mutation that replaces hand-narrowing a
range is **hand-narrowing a value** — invisible to BAND (still in band), to MARGIN (nowhere near an
edge) and to DRAWS (not a range). **PLATES** holds every current single value to a named,
sha-stamped plate recorded in PUNCHLIST's ```plates block. Proven red by nudging G4 1.6262 → 1.6300
(0.23%) and, in the other direction, by moving the plate record and leaving the prose.

The rule prints what it cannot reach: G1 and G2 are **skipped as ambiguous**, because `?grain=0`'s
G1 is 0.006% from the default's and the A side's G2 is 0.26% from it, and a parsed claim does not
carry the plate it came from.

🚩 **And writing it found that the headline seven-gate table was invisible to this gate.**
`tableClaims` was written against 3.12's shape, where gate ids are column headings. The table 8.1 is
quoted from is transposed — one row per gate — so `gateColumns.length < 3` skipped the whole thing.
Row-labelled tables are now parsed too, and only cells that are a bare measurement count: the first
version of that path invented four claims, including a G2 of "2026–8" read out of a date.

### MARGIN's floor is retained rather than re-measured, and that is the honest choice

After the epoch pin the load-to-load spread is **zero on every gate**. Setting MARGIN's floor to the
measured zero would make the rule inert — a gate going green by going blind. The pre-3.20 numbers
are retained as a floor, justified by measurement rather than by caution: G2 moves 0.0013 between 1
capture step and 60, 0.0028 between 900 px and 3840 px, and 0.0024 between the default and its A
side, against a retained floor of 0.0004.

### Every gate in the repo, re-run

All 29 `*.selftest.mjs` exited 0, plus `tools/critic/selftest.mjs` 235/235 and `verify_glb.mjs` PASS
on 5 figures. `npm run build` and `npm run build:pages` green (**eight** entries, not seven).
Six counts in LEARNINGS Part 3 had drifted: `Grade` 44 → **56**, `GroundContact` 36 → **47**,
`LightingRig` 46 → **63**, `alive-toggles` 24 → **109**, `travel` 126 → **138**, and
`alive-capture-determinism` **49** did not exist.

⚠️ **And the run demonstrated its own caveat.** The script prints the tree state at both ends: clean
at 21:25:04Z, **DIRTY at 21:36:50Z**, with `GroundContact.selftest.mjs` (+105 lines) and
`LightingRig.selftest.mjs` (+504) modified under it by another agent. Re-run four minutes later:
`GroundContact` 47/47 both times, `LightingRig` **63/63 then 82/82**. One of those counts is already
history and nothing in the run could say which.

### Diff requests filed against files this pass does not own

1. **`tools/critic/selftest.mjs`** — its **zombie guard** (section 4a-bis, rule 5) forbids the
   *previous* generation of superseded G2 seed values, `0.8127 / 0.9627 / 0.9736 / 0.4384`. The
   record has moved again: `0.7836 / 0.9189 / 0.9292 / 0.4390` are now superseded too and are the
   ones a reader is most likely to re-paste, because they were current until today. Add them to the
   `superseded` array. Its line-695 comment quoting them as the current re-measurement should read
   `0.9182` ×4 at build `2ec7db9`.
2. **`tools/run-selftests.sh`** — does not exist and LEARNINGS Part 3 has asked for it for three
   rounds. The full twenty-line script is in Part 3 ready to paste. Its one non-obvious line is the
   explicit call to `tools/critic/selftest.mjs`, which **does not match `*.selftest.mjs`** and is
   silently skipped by any glob that assumes it does.
3. **`tools/critic/capture.mjs`** — the third-pass request is now partly overtaken: the shipped
   default IS reproducible, so `verifyReproducibility` will no longer report a spurious difference
   on it. What remains worth doing is printing `simulation.frameCount` and `fps` in the run summary
   beside the digest, because the step count is now known to be part of a plate's identity and
   `measure.mjs` reads it out of the manifest to decide comparability.
4. **`packages/core/src/render/LightingRig.selftest.mjs`** — its environment-spill clause argues
   that summing only the panels is "the conservative direction". That holds only if a shadow caster
   shares its panel's colour, which the shipped code does (`new SpotLight( new Color(
   placement.colour ), 1 )`) and nothing asserts: the string `shadowCaster.color` appears **zero**
   times in the selftest. One check that every caster's colour equals its panel's would make the
   conservative argument sound instead of lucky. LEARNINGS §1.25l.
5. **`packages/core/src/render/Grade.selftest.mjs`** — `SEQUENCE_FRAMES = [ 9, 10, 11, 12, 13, 14,
   20 ]` contains exactly one frame at or above 16, and a pairwise check needs two, so a grain that
   freezes at frame 16 is invisible and the file scores 56/56. Make the top of the set a consecutive
   pair, or assert a property of the whole sequence. LEARNINGS §1.25j.

## Third pass, 2026-08-08 — the plate is a draw, and 8.1 is five of seven

⚠️ **SUPERSEDED IN ITS NUMBERS BY THE FOURTH PASS BELOW, AND CORRECT IN ITS DIAGNOSIS.** Every range
in this section is pre-3.20 and is retracted as a current result; the root cause it identifies —
`?capture` pins simulation time and not render state — is exactly what `4aafd91` fixed, and the
diff request it filed was actioned. Kept in full because it is the derivation the fix was built on.

HEAD `1985425`, `packagesDigest 78bdabba19b059e0`. All plates from a `git archive HEAD` snapshot
with `assets/figures` copied in and served by a watcher-off vite, because the live tree moved
twice mid-run — one attempt died on a mid-save `Grade.js:260` — and a moving tree is not a build.
Four working-tree loads at digest `e2a3dfc5744bab2b` are reported separately and land in the same
ranges.

### The defect: PUNCHLIST 8.1's headline

8.1 stated, for `alive.html?bare&freeze&seed=1` at 3840×5120 through `?capture`, 60 frames,
TAAU 0.66 + grade + RCAS 1.2: *"G1 1.6636 PASS · G2 0.9201 PASS · G3 PASS · G4 1.6315 PASS ·
G5 0.0002% PASS · G6 0.00001 FAIL · G7 0.0773% PASS"* — six of seven. **It is five of seven.**
Reproduced at that width and that recipe:

| statistic | 10 captured loads | 4 free-running loads | 8.1 claimed | verdict |
|---|---|---|---|---|
| G1 | 1.6634–1.6637 | 1.6633–1.6638 | 1.6636 | inside the observed range |
| **G2** | **0.9194–0.9198** | **0.9195–0.9196** | **0.9201 PASS** | **FAIL, 14 of 14 draws; 0.9201 never observed** |
| G4 | 1.6227–1.6362 | 1.6230–1.6298 | 1.6315 | inside |
| G5 | 0.000001–0.000002 | 0.000002 | 0.0002% | top of the range |
| G6 | 0.00001 | 0.00001 | 0.00001 FAIL | agrees |
| G7 | 0.000736–0.000767 | 0.000721–0.000742 | 0.0773% | **above every draw** |

`measure.mjs --human` on one of them: `FAIL G2 … luma half: 0.9197 outside 0.92–1.04
(sclera 0.7221 vs cheek 0.7851)`, footer `FAIL: 5 passed, 2 failed, 0 skipped`.

**The control row is what makes this a finding rather than a difference of setup.** On the same
runs, `?aa=msaa&grade=0` returns G1 **1.6180**, G2 **0.9221**, G4 **1.7469**, G6 **0.00001**,
G7 **0.000742** — PUNCHLIST's own recorded control values, to five decimals, every time.

### Root cause: `?capture` pins simulation time and does not pin render state

Six consecutive loads of the shipped default, one build, one seed, one recipe, 60 steps each:
**five distinct PNGs** (`84904758`, `533b083c`, `89060afd`, `533b083c`, `1a11ed86`, `61b86af7`).
Free-running, four loads, four distinct PNGs. Two of them differ on **56.4% of pixels**, mean
|Δ| 1.8/255, worst 118/255, spread over the whole frame including the backdrop.

Attributed by toggle, in one run:

| configuration | loads | distinct plates |
|---|---:|---:|
| shipped (TAAU 0.66 + grade) | 6 | **5** |
| `?grade=0` (TAAU, no grade) | 2 | 1 |
| `?aa=msaa` (grade, no TAAU) | 2 | 1 |
| `?aa=msaa&grade=0` | 4 | 1 |
| `?grain=0` (TAAU + grade, grain off) | 4 | **3** |
| `?aa=msaa&grain=0` | 3 | 1 |

And by probe, reading `renderer._nodes.nodeFrame.frameId` before the first accepted capture step:
**15 / 16 / 17 / 18** on four loads of the shipped default, **18 / 21 / 21 / 22** on `?aa=msaa`.
That counter is the number of frames the page rendered during boot, and it is wall-clock
dependent. `Grade.js` keys the grain phase to it —
`uniform(0).onFrameUpdate( frame => frame.frameId % 4096 )` — and three's `TRAANode` advances its
32-entry Halton `_jitterIndex` once per render from construction. **One unpinned counter, two
consumers**: killing the grain leaves the TAAU path stochastic, which is the second consumer
showing through, and killing TAAU leaves the graded MSAA path deterministic only because its 2
loads happened to draw the same phase.

Diff request filed (see below). The fix is to reset the counter — or to derive the grain phase and
the jitter index from the capture step index — when `takeOverFrameLoop` runs.

### ✅ `?freeze` under `?capture` is fixed, and the standing warning is retracted

Both docs still carried *"`?freeze` IS INERT UNDER `?capture`"* as a standing constraint. It was
true before `c9fa59c`. Proven false at HEAD on the byte-reproducible forward path, where a
comparison is exact rather than statistical:

| recipe | steps | sha256 |
|---|---:|---|
| `?bare&freeze&seed=1&capture&aa=msaa&grade=0` | 1 | `afd763f45354…` |
| same | 60 | `afd763f45354…` |
| same | 300 | `afd763f45354…` |
| `?bare&seed=1&capture&aa=msaa&grade=0` (no freeze) | 1 | `81677f580441…` |
| same | 60 | `e2ba8638d792…` |

And free-running at 3840×5120, 90 rAF frames, `?bare&freeze&seed=1&aa=msaa&grade=0` returns
`b3609ee0652d…` — **the same bytes as the captured 60-frame plate at the same size**. Two frame
paths, one picture.

### Two numbers that changed meaning

- **26% of the shipped default's G4 is film grain.** `?grain=0` takes σ from 1.6227–1.6362 to
  **1.1951–1.1960**, below the 1.5 floor; on `?aa=msaa` it reads 2.2546 → 1.9771. G4 is a
  high-pass statistic and additive noise is high-pass, so "TAAU + grade centres G4" is a claim
  about the grade as much as about `SkinMaterial` — and the grain half is the stochastic half.
- **`?aa=msaa` with the grade on reads G6 0.000280**, not 0.00001, on the same regions. Still
  below the 0.004 floor and still UNDECIDED for the reasons in PUNCHLIST 3.13, but it is a 28×
  move and nothing had recorded it.

### The gate: `docs/measured-claims.selftest.mjs`

A doc gate, in the family of `docs/eye-optics-claims.selftest.mjs`, because the defect lived
entirely in prose that no code assertion could reach. It parses every gate claim in PUNCHLIST.md
and PROGRESS.md — inline (`G2 0.9201 PASS`), in markdown tables headed by gate ids, and in the
recorded raw-draw lists — and adjudicates each against `TARGETS` **imported from
`tools/critic/measure.mjs`**, not re-typed. Four rules: BAND (the stated verdict must match the
tool's band), COUNT (an "N of seven" headline must equal the PASS count in its own roster),
MARGIN (a value closer to a band edge than the measured load-to-load spread must carry the literal
token `MARGINAL`, naming the gate), and DRAWS (quoted ranges must be the min and max of the raw
draws the doc records). **56 checks**, `node docs/measured-claims.selftest.mjs`.

Proved red **nine ways**, and the table of which rule catches which is printed on every run: the
original defect, the other band edge, the ceiling rather than the floor, a marginal FAIL rather
than a marginal PASS, a verdict that contradicts the band, a band that moved while the doc did
not, a percent-versus-fraction unit slip, a count that drifts from its own roster, and — a
different syntactic vehicle — the same marginal value hiding in a markdown table cell. Then the
original 8.1 paragraph is spliced back into the **real** PUNCHLIST text and the whole adjudication
re-run over it, because a fixture can be shaped to the parser that reads it and a real file cannot.

🚩 **And four evasions it does NOT catch are printed too, as a measurement rather than a wish**: a
claim written as prose with no gate id and a lowercase verdict; a value written before its gate id;
and abuse of either exemption — prefixing a live claim with a retraction word, or wrapping it in
backticks. Two are parser reach and two are inherent to having exemptions at all. The mitigation is
a coverage floor: if a rewrite hides claims from the parser the live-claim count collapses, and the
count is itself gated at 80% of today's.

Its honest limit, stated in the file: it cannot re-render, so a number that is inside its band,
not marginal, and simply wrong for the build is invisible to every rule. Provenance and
`packagesDigest` are the only defence against that.

### Diff requests filed against files this pass does not own

1. **`packages/testbed/src/alive.js`** — in `takeOverFrameLoop`/the `?capture` hook, pin the
   renderer's frame counter when the capture takes the loop over (e.g. zero
   `renderer._nodes.nodeFrame.frameId` and `TRAANode._jitterIndex` at takeover, or drive both from
   the capture step index). Without it no still plate on the shipped default is reproducible, and
   `capture.mjs`'s reproducibility check cannot mean what it says.
   ✅ **LANDED.** `4aafd91` + `eaae0e3` + `29a1f1c`, gate 49/49, verified independently at
   `2ec7db9` — see the fourth pass above. As this section was written, `alive.js`,
   `render/TRAAPost.js` and a new
   `alive-capture-determinism.selftest.mjs` sat uncommitted in the working tree under the label
   **punch-list 3.20 — the capture epoch**, naming the same three counters and adding a
   reproducibility/oracle/liveness gate. That agent read `frameId` as 2392 / 1216 / 1961 at
   900×1200 (rAF ticks during the GLB load); this pass read 15 / 16 / 17 / 18 at the first accepted
   step. Same defect from two instruments, found independently — which is the third time this
   round that a defect surfaced twice before it surfaced once.
   **Every range in this pass is therefore stamped to the PRE-3.20 build and must be re-measured
   once it lands, not narrowed by hand.**
2. ✅ **ACTIONED 2026-08-08 (fourth pass).** **`tools/critic/measure.mjs`** — the G2 warning still said *"`?freeze` is INERT under
   `?capture`"* and quotes the pre-fix seed spread 0.7836 / 0.9189 / 0.9292 / 0.4390 as current.
   Both are stale at HEAD; the warning should instead say that a graded or temporally-resolved
   plate is a draw and ask for a load count.
3. **`tools/critic/capture.mjs`** — `verifyReproducibility` compares a second run of the same
   recipe. On the shipped default that will now report a real difference on ~56% of pixels every
   time. It should either pin the frame counter (1) or state which configurations it can speak for.

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

---

## Fifth pass — integration of a six-agent fan-out (2026-08-08)

Six agents, disjoint file ownership, reconciled against `git status` in both directions: **every
changed file was claimed exactly once and every claimed change was present.** No collisions, no
fabrications. Thirty-two files.

### Diff requests ACTIONED at integration

| request | from | what landed |
|---|---|---|
| `alive.js` fingerprint blind to `toneMappingExposure` | gate-hardening | **Both halves.** The named field is in the `pipeline` row, AND `window.sugata.renderState()` now walks all **116** readable properties of the renderer and the scene, deny-by-default. Kept as a SEPARATE entry point rather than folded into `shadingState()`, because `?shadows=0`, `?aa=off` and `?scale=1` legitimately move render state and would have read as collateral inside an exact entity-set comparison — two questions, two objects |
| `vite.pages.config.js` missing the two new pages | wardrobe, fabric | `src/wardrobe.html` and `src/fabric.html` added; `build:pages` now emits **TEN** entries |
| `tools/run-selftests.sh` does not exist | re-measurement | Written, and asked for across four rounds. `npm run selftests` |
| zombie guard one generation behind | re-measurement | `0.7836 / 0.9189 / 0.9292 / 0.4390` added to the forbidden list beside the 2026-08-07 generation |
| `capture.mjs` should surface the step count | re-measurement | Printed beside the digest, with the reason (1 step reads G2 0.9560, 60 steps 0.9547) |
| `measure.mjs`'s G2 MARGINAL warning is stale literals | gate-residue | **Rebuilt as a computed rule** and proved in both directions — LEARNINGS §1.25o |
| card albedo floor + backdrop, for G6 | gate-residue | Landed and **re-measured rather than quoted**, as that request asked. G6 0.0042 |
| `LightingRig.selftest.mjs` fill comment 1.90 | gate-residue | → 2.20 |
| `regions.lighting-portrait.json` radial-asymmetry caveat | gate-residue | Recorded on the `faceKey` note, rects unchanged |
| `package.json` wardrobe script | wardrobe | Plus `verify:glb` and `selftests` |

**Superseded rather than applied:** re-measurement's requests against `Grade.selftest.mjs`
(`SEQUENCE_FRAMES` has one frame at or above 16, so a freeze at 16 is invisible) and
`LightingRig.selftest.mjs` (nothing asserts a caster shares its panel's colour). Both were fixed
independently and better by gate-hardening in the same round — Grade now renders **600 frames** and
computes its own coverage, and LightingRig carries an explicit PREMISE equality. Applying the
narrower requests on top would have added checks that could no longer fail.

### What integration BROKE, and what it found

- 🚩 **A rejection proof had gone vacuous.** `docs/measured-claims.selftest.mjs`'s second PLATES
  proof asserted the plate's G4 differed from a hard-coded `1.6262`, which any re-measured plate
  satisfies **without the mutation having been applied**. It could no longer fail. Both proofs are
  now derived from the recorded plate and assert that the mutation REACHED its target. LEARNINGS
  §1.25n.
- ✅ **`measure.mjs`'s rebuilt stale-warning caught a real drift** — the sclera re-solve moved the
  G2 seed record 0.9182 → 0.9560 and the tool said so, in the exact words it was built to say. The
  record is re-measured; that is the check working, not failing.
- ⚠️ **The head of this file still carried a retracted headline** ("five distinct PNGs … FIVE of
  seven") while a "fourth pass" section 1,400 lines below said the opposite. Both are now one
  statement. A correction filed in a report is not a correction made.
