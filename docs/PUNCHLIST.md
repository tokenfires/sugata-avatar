# Sugata 姿 — punch list

Every item is a fan-out unit with its own acceptance gate. `[ ]` open · `[~]` in progress ·
`[x]` done and gate passed · `[!]` blocked.

Gates marked **CRITIC** must pass a harsh blind-comparison agent. Gates marked **MEASURED** must
pass `tools/critic/measure.mjs` objectively before any subjective judgment is solicited.

Reference constants live in [`research/`](research/). **Do not invent numbers that are already
measured there.**

**`measure.mjs` runs SEVEN gates, not six.** The look spec's checklist lists six; G7 (card-band
cool-chroma outliers) was added after all six read green on a plate whose worst feature was
unmissable. G2 also gained its second half — the spec sentence has a luma clause *and* a chroma
clause and only the first was ever gated.

🚩 **A MEASURED result is only about the page, framing, seed, RECIPE and build it was taken on.**
Every report carries a `provenance` line and stamps `measuredOn` into every gate, because a G4 sigma
measured on `skin.html` was quoted here as certifying `alive.html`, which reads 1.4764 against
1.9495 at the same width. Quote gate numbers **with** that line or not at all.

✅ **`?freeze` UNDER `?capture` IS FIXED, AND THE WARNING THAT USED TO STAND HERE IS RETRACTED.**
This block used to read *"`?freeze` IS INERT UNDER `?capture`"*. Proven by execution at HEAD
`1985425`, on the byte-reproducible forward path so the comparison is exact:
`alive.html?bare&freeze&seed=1&capture&aa=msaa&grade=0` at 900×1200 stepped **1, 60 and 300**
frames returns **one sha256, `afd763f45354…`, all three times**, and the same recipe free-running
(no `?capture`, 90 rAF frames) returns **the identical bytes** at 3840×5120 (`b3609ee0652d…`,
equal to the captured 60-frame plate). Without `?freeze`, 1 step and 60 steps differ
(`81677f58…` vs `e2ba8638…`), so the clock is still running when it should be. Historical: the
seed spread *"0.7836 / 0.9189 / 0.9292 / 0.4390"* belongs to the pre-fix recipe and is not
reachable today.

✅ **AND THE DEFECT THAT REPLACED IT IS FIXED TOO. THE SHIPPED DEFAULT IS NOW REPRODUCIBLE, AND
EVERY RANGE IN THIS FILE HAS BEEN RE-MEASURED BACK INTO A VALUE.** ⚠️ **This heading used to read
"reproducible FROM ITS OWN IDENTITY", which is the overclaim the next block withdraws.**
This block used to say that on the shipped default the plate is a draw: six loads of
`alive.html?bare&freeze&seed=1&capture` at 3840×5120 returned **five distinct PNGs**, two of them
differing on 56.4% of pixels, because `?capture` pinned simulation time and left the renderer's own
frame counter — the grade's grain phase and TRAA's Halton `_jitterIndex` — riding on a count of how
many frames the machine fitted into loading a GLB. **Punch-list 3.20 landed in `4aafd91`
(+ `eaae0e3`, `29a1f1c`) and closed it at source.**

🚩 **AND "REPRODUCIBLE" IS A TOLERANCE, NOT A sha256. THE PARAGRAPH THAT STOOD HERE SAID OTHERWISE
AND IS WITHDRAWN.** It used to read *"Proven at HEAD `2ec7db9` by execution, three loads, one
recipe … one PNG, sha256 `257caca2782adde9`, all three times"*, with the A side *"`b3609ee0652db4c5`
over two loads … byte-for-byte the plate this file recorded at HEAD `1985425`"*. Three agreeing
loads is an observation of one run. It was written down as a guarantee, and the standing constraint
below turned that guarantee into the identity every gate value in this file is held against.

**Re-measured 2026-08-08 at HEAD `f7042a0` with `tools/critic/capture.mjs --plate`** — which steps
to the plate frame, screenshots only that frame, reloads the page N times and differences the
decoded pixels — on this tool's own frozen vite, so every load inside a run is of one build.
Same recipe as the fence below: 3840×5120 dpr 1, 60 steps at 60 fps, seed 1.

| configuration | runs | loads | distinct sha256 | pairs bit-identical | worst residue |
|---|---:|---:|---|---:|---|
| shipped default | 7 | 103 | 1 … 12, run by run | **671 / 1053** | 164 px of 19,660,800 (0.00083%) at Δ2/255 |
| `?grain=0` | 4 | 43 | 1 … 7 | **211 / 283** | 75 px (0.00038%) at Δ3/255 |
| `?aa=msaa&grade=0` | 4 | 45 | **1, every run** | **290 / 290** | **none — Δ0 on 0 px** |

⚠️ **The pair counts are exact and comparable; the residue MAGNITUDES come from two definitions.**
The first four runs differenced every pair, the last three difference one representative per
distinct digest against the modal plate, because all-pairs at thirty loads is 870 decodes of a
19.6 MP PNG and was measured taking longer than the capture. The column is the maximum over both,
so it is an upper bound on the vs-mode statistic and the true statistic for the all-pairs runs.

**So the shipped default reproduces to Δ2 of 255 on under 0.001% of pixels, and that is the whole
guarantee.** Every residue measured is inside `capture.mjs`'s reproducibility tolerance (Δ6 on 0.1%
of pixels) by 3× in code value and 120× in area, which is why nothing downstream moved — see the
gate note below. It is a long way outside a single digest.

🎯 **THE THING THAT MAKES A SHA UNUSABLE AS THE IDENTITY IS NOT THE RESIDUE'S SIZE, IT IS THAT THE
RESIDUE COMES AND GOES.** Two runs of thirty loads, the same recipe, the same build, an hour apart:
one returned **twelve** distinct digests with 171 of 435 pairs matching, the other returned **one**
digest across all thirty. A run can look like a proof of byte identity and the next run of the same
thing does not. Two runs taken deliberately *concurrently* were the worst (1 of 45 and 3 of 45),
which says machine load moves the magnitude — but the quiet 30-load run that came back dirty says
load is not the whole of it, and nothing here attributes the mechanism. **What is settled is that
no number of agreeing loads establishes byte identity for this plate.**

✅ **THE SHAS THIS FILE ALREADY RECORDED SURVIVE — AS MODES.** `d3c9946f73e5eaa1` is the modal
digest of the default over all 103 loads and was 19 of 30 in the dirty run; `b457a3e675e5c766` and
`75e81b1868e5191c` are the modes for `?grain=0` and the A side. The digests in the fence were
right. The word *identity* around them was not, so the fence now carries `bitident=` and `worst=`
beside every one of them and `measured-claims.selftest.mjs`'s **REPRO** rule holds the prose to it.

⚠️ **THE ATTRIBUTION THAT USED TO GO WITH THIS IS ALSO WITHDRAWN, IN BOTH DIRECTIONS.** A fan-out
agent measured the residue at 900×1200 and attributed it to needing *both* the temporal resolve and
the grain, on the strength of `?grain=0` coming back clean three times. At 3840 `?grain=0` is
**dirty in three of its four runs and clean in the fourth** — the same run-to-run coin flip the
default shows — so the grain does not discriminate. What DOES discriminate is the temporal resolve:
`?aa=msaa&grade=0` is the only configuration with a residue of zero in **every** run, 45 loads
including both deliberately concurrent ones. The forward MSAA path is byte-deterministic here; the
TAAU path is not. ⚠️ That also narrows `capture.mjs`'s own header, which attributes the residue to
the hair cards' alpha-to-coverage resolve: that was measured at 350×600 on the MSAA-era default,
and alpha-to-coverage is exactly what the clean A side still has.

🚩 **RETIRING A RANGE IS A RE-MEASUREMENT AND TWO OF THE FOUR RANGES DO NOT CONTAIN THEIR OWN
SUCCESSOR.** G1 was `1.6634–1.6637` and is **1.6630**; G7 was `0.000736–0.000767` and is
**0.00069**. Both land *below* the whole pre-fix range. There is nothing wrong with either number:
the pre-fix draws sampled whatever grain phase and jitter index a boot happened to reach, which is
not a sample of anything, and the pin chose the phase at step index 0 rather than a typical one.
**A collapsed distribution is not summarised by the value that replaces it.** LEARNINGS §1.25m.

⚠️ **THE LOAD-TO-LOAD SPREAD IS NOW ZERO, AND THAT DOES NOT MAKE A BARE VERDICT ENTITLED.**
`docs/measured-claims.selftest.mjs` keeps its MARGIN rule at the pre-3.20 numbers as a **retained
floor**, not because they are still the spread but because the *recipe* sensitivities measured
today are all larger than them. Measured at `2ec7db9`, one page, one seed, G2: **0.0013** between 1
capture step and 60, **0.0028** between 900 px and 3840 px, **0.0024** between the shipped default
and its A side. A statistic that moves more than that when you change the anti-aliasing mode is not
delivering a verdict about the eye.

The historical draws, kept because the retained floor is arithmetic over them and
`measured-claims.selftest.mjs` re-derives it from this block rather than trusting a constant.
⚠️ **PRE-3.20. NOT REACHABLE AT HEAD. Do not quote a range from it as a current result.** Recipe:
`alive.html?bare&freeze&seed=1` at 3840×5120 dpr 1 on the then-shipped default, portrait regions;
loads 1–4 on the working tree at digest `e2a3dfc5744bab2b`, 5–10 at HEAD `1985425` digest
`78bdabba19b059e0`, 11–14 free-running at `1985425`.

```rawdraws recipe=shipped-default-3840x5120-PRE-3.20 loads=14
G1 1.6637 1.6637 1.6634 1.6637 1.6634 1.6637 1.6635 1.6637 1.6634 1.6637 1.6637 1.6638 1.6636 1.6633
G2 0.9197 0.9196 0.9196 0.9196 0.9198 0.9197 0.9194 0.9197 0.9196 0.9196 0.9195 0.9195 0.9196 0.9196
G4 1.6294 1.6362 1.6270 1.6362 1.6270 1.6294 1.6227 1.6294 1.6270 1.6362 1.6230 1.6275 1.6289 1.6298
G5 0.000001 0.000002 0.000002 0.000002 0.000002 0.000001 0.000002 0.000001 0.000002 0.000002 0.000002 0.000002 0.000002 0.000002
G6 0.00001 0.00001 0.00001 0.00001 0.00001 0.00001 0.00001 0.00001 0.00001 0.00001 0.00001 0.00001 0.00001 0.00001
G7 0.000736 0.000767 0.000745 0.000767 0.000764 0.000736 0.000745 0.000736 0.000745 0.000767 0.000742 0.000721 0.000736 0.000739
```

And the plate every current number in this file is read off. One line per configuration, each a
value rather than a range because each configuration's gate readings are stable across the loads
stated — which is a *different* statement from the bytes being stable, and the two are now recorded
separately. `measured-claims.selftest.mjs` holds the prose to these.

**Reading a plate line.** `loads=N runs=R` is N page loads spread over R separate invocations of
`capture.mjs --plate`; loads are only comparable within a run, so the pair count is the sum of each
run's own N(N−1)/2. `bitident=K/P` counts bit-identical PAIRS, K of P compared. `worst=` is the worst code
delta of 255 and `px=` the worst differing-pixel count of 19,660,800, both against the modal plate.
`sha=` is the MODE, not a guarantee. A line with no `runs=` is one run; a line with no `bitident=`
was taken once and its reproducibility is therefore **unmeasured**, which the four carried-over
rows below say by carrying `loads=1`.

⚠️ **Only the three 3840 portrait rows were re-measured for reproducibility.** `cards0`, the two
900×1200 rows and `bodydflt` carry the gate values recorded at `2ec7db9` and were taken once each;
`seedrec`'s old `loads=4` meant four *seeds*, not four loads of one recipe, and is written `seeds=4`
now so the field stops meaning two things. None of those four has a measured residue and none of
them should be quoted as byte-reproducible until it does.

```plates build=HEAD-f7042a0 page=/alive.html?bare&freeze&seed=1&capture steps=60 fps=60 dpr=1
default   3840x5120 portrait loads=103 runs=7 sha=d3c9946f73e5eaa1 bitident=671/1053 worst=2 px=164 G1 1.5378 G2 0.9544 G4 1.6346 G5 0.000002 G6 0.0042 G7 0.000601
msaa      3840x5120 portrait loads=45 runs=4 sha=75e81b1868e5191c bitident=290/290 worst=0 px=0 G1 1.4989 G2 0.9576 G4 1.7721 G5 0.000002 G6 0.00195 G7 0.00061
grain0    3840x5120 portrait loads=43 runs=4 sha=b457a3e675e5c766 bitident=211/283 worst=3 px=75 G1 1.5377 G2 0.9544 G4 1.2140 G5 0.000002 G6 0.0042 G7 0.000582
cards0    3840x5120 portrait loads=1 sha=3e56f7f71e34 G1 1.5378 G2 0.9544 G4 1.6346 G5 0.000002 G6 0.0042 G7 0.007878
default   900x1200  portrait loads=1 sha=63a1737211da G1 1.5331 G2 0.9547 G4 1.4745 G5 0.000000 G6 0.0042 G7 0.000336
seedrec   900x1200  portrait loads=1 seeds=4 sha=6cc1427e2354 G1 1.5301 G2 0.9560 G4 1.5683 G5 0.000000 G6 0.0042 G7 0.000729
bodydflt  900x1200  body     loads=1 sha=cf2a968f9432 G1 1.5869 G4 1.3315 G5 0.000000 G6 0.01597
```

🎯 **AND THE GATE VALUES ARE UNAFFECTED, WHICH IS THE OTHER HALF OF THE FINDING.** All three loads
of the run that produced the seven-gate table below read G1 1.5378 / G2 0.9544 / G3 / G4 1.6346 /
G5 0.000002 / G6 0.0042 / G7 0.000601, identical to the last digit. A Δ2 excursion on 164 pixels of
19.7 million cannot move a regional mean, a high-pass σ or a 0.1st percentile at four decimals.
**Seven of seven stands; the byte claim that used to sit under it does not.** Those are separable
claims and this file had merged them.

🎯 **TWO ATTRIBUTIONS THAT CHANGED SHAPE, NOT JUST VALUE, AND BOTH SAY THE CARD FLOOR LANDED.**

- **`?cards=0` and the shipped default now read the SAME G6, 0.0042.** Before the floor they read
  0.00393 against 0.00001 — a 300× swing across the same two widths, because a wider render
  resolved more genuinely-zero lash texels into the bottom 0.1% of the histogram. They agree now
  because the tail is the backdrop in both, which is what "the cards are no longer the darkest
  thing in frame" means as a measurement rather than as a claim.
- **`?grain=0` moves G4 alone**, 1.6346 → 1.2140: **25.7% of the high-pass sigma is film grain**,
  and without it the default falls below the 1.5 floor. It moves G1 by 0.0001 and G2, G5, G6 not
  at all — the cleanest single-flag attribution in this file.
- **`?cards=0` still moves G7 alone**, 0.000601 → 0.007878, a **13.1×** separation. (It was
  recorded as 135× at `c70195c` and 11.8× at `2ec7db9`; 135× was a property of a plate nobody can
  take today, and each restatement has been on a different render. Quote it with its build.)

---

## 🎯 THE MEASURED STATE OF THE SEVEN GATES, 2026-08-08, HEAD `2ec7db9`

Portrait regions (`regions.lighting-portrait.json`) at 3840×5120, dpr 1,
`alive.html?bare&freeze&seed=1&capture`, **60 steps at 60 fps**, on **the shipped default** —
TAAU 0.66 + grade + RCAS 1.2, **MSAA OFF** — which is what a judge loads. Every row is a **value**
because 3.20 landed and the three loads agreed to the last digit on all seven gates — and the three
loads span the whole of this round's integration, including the wardrobe landing between the first
and the third, which is what says `?wear` costs the judge's plate nothing. ⚠️ **The sentence here
used to say that the three loads return one PNG, and that is withdrawn**: the
plate's modal digest is `d3c9946f73e5eaa1`, its residue is Δ2 on 164 px of 19.7 million, and it is
gate STABILITY rather than byte identity that entitles a single value. See the plate block at the
top of this file. ⚠️ **Every historical number measured under MSAA is a different configuration,
not a disagreeing one** — the A-side column is beside it for exactly that reason.

The default's toggle state is not asserted from prose: `alive-toggles.selftest.mjs` (**151/151** at
`af0e68d`; this line read **144/144** for a round and 109/109 before that — quote it with a build)
holds `temporalResolve` live and `multisampleSamples` at zero on the baseline plate, holds
`?aa=msaa` to swapping the one for the other, and now holds all **116** readable properties of the
renderer and the scene deny-by-default.

| gate | shipped default ×3 | A side `?aa=msaa&grade=0` | verdict |
|---|---|---|---|
| G1 face key:shadow | **1.5378** linear | **1.4989** | PASS both — INSIDE the 1.43–1.64 reference band, not merely under the 2.00 ceiling |
| G2 sclera:cheek luma | **0.9544** | **0.9576** | PASS both, and **no longer MARGINAL**: 0.0344 clear of the 0.92 floor, 10.8× the largest amount the recipe alone can move it (0.0032, the AA mode) |
| G3 terminator | saturation rises, hue reddens | same | PASS both |
| G4 high-pass σ | **1.6346** /255 | **1.7721** | PASS both, inside 1.5–2.1 at **3840** px — the band's own width |
| G5 clipping | **0.000002** | **0.000002** | PASS both |
| G6 black point | **0.0042** | **0.00195** | **PASS on the default, FAIL on the A side** — and the A side fails because it has no grade to lift with. See below |
| G7 card band | **0.000601** | **0.00061** | PASS both |

## 🎯 **SEVEN OF SEVEN ON THE SHIPPED DEFAULT.** Six of seven on the A side.

That is the first clean sweep this file has recorded, and three separate things had to land in one
round for it: G1's fill was re-solved against the transform the page actually ships, G2's
`SCLERA_BRIGHTNESS` was re-solved against a plate that HAS the occlusion sheet over the eye, and
G6's cause turned out to be a zero-albedo hair card rather than a black point at all.

⚠️ **THE SIGN OF THE A SIDE HAS FLIPPED ON G6 AND IT IS NOT A REGRESSION.** The A side is
`?aa=msaa&grade=0`, and the grade is what LIFTS the black point — so with the card floor in place
the graded default lands at 0.0042 and the ungraded A side at 0.00195, below the floor. Measured,
not inferred: `?grade=0` on the shipped path reads literal **0.00000** before the card floor and
the grade is the only thing between the two. G6 is now a statement about the shipped *pipeline*,
which is the configuration a judge captures.

⚠️ **Every value above is new this round and none of the previous generation is reachable.** The
five-of-seven table that stood here — G1 1.6630, G2 0.9197, G4 1.6262, G6 0.00001, G7 0.00069 —
was measured on a build with `fill.irradiance` 1.90, `SCLERA_BRIGHTNESS` 1.26 and hair cards at
literally zero albedo. Do not quote it as a disagreeing result; it is a different render. LEARNINGS
§1.25m's warning about collapsed distributions applies again one generation on: **a superseded
value is not a bound on its successor.** G1 fell 0.1252 and G2 rose 0.0347, both far outside
anything the old spreads would have predicted.

⚠️ **Superseded tables, listed so nobody re-quotes one.** The `c70195c` table (G1 1.6265 /
G2 0.9372 / G7 0.0739%) does not reproduce under either configuration — `c70195c` predates
`c9fa59c`, which made TAAU + grade the default. **Do not quote 0.9372.** The `1985425` ranges are
superseded by the values above. The `1.5547` an earlier revision carried at body framing could not
be reproduced from any configuration and stays withdrawn.

### 🎯 Body framing IS re-measured this round, and it was pending for two

`regions.lighting-body.json` at 900×1200 dpr 1, `?bare&freeze&seed=1&capture&frame=body`, 60 steps
at 60 fps. Two loads of the default return one PNG (`8b3fb2ae2118`). G2 and G7 SKIP — the body
region file draws no sclera and no card band, which is a property of the file and not a result.

| plate | G1 | G4 | G6 |
|---|---:|---:|---:|
| shipped default | **1.5869** | 1.3315 | **0.01597** |

⚠️ **The `?grade=0` and `?aa=msaa&grade=0` body rows are WITHDRAWN rather than carried.** They read
1.5601 / 0.5390 / 0.01652 and 1.5466 / 1.5481 / 0.01652 on a build with the old fill, the old
sclera, zero-albedo cards and `BACKDROP_EMISSIVE` at `0x050709`. Two of those four changes move a
body plate. Re-measure them; do not narrow them.

On the shipped-default row the black point and the key:shadow ratio are both inside their bands and
the high-pass sigma is not — and the sigma is the one that is not entitled to a verdict at this
width, for the reason spelled out in (c) below. Highlight clipping measured zero pixels above 0.99,
which is the good end of a one-sided band and carries no information.

**Three things this settles.** (a) G1 **1.5869** reproduces EXACTLY across this round's two
constants — the body preset's fill override is absolute, so re-solving portrait's fill from 1.90 to
2.20 left the body plate byte-identical. (b) Body G6 moved **0.0126 → 0.01597** with the backdrop,
and **0.01597 clears the 0.016 ceiling by 0.00003 — 0.2% of the band.** That is not a comfortable
number and it is recorded as an uncomfortable one: see the G6 block below. (c) **G4 at 900 px is
not a result.** The band is stated at 3840 px, high-pass σ is scale-dependent with no sound
rescaling law, and the FAIL is the width rather than the skin — the same build's portrait row
passes at 3840. Do not report body-framing G4 until a 3840-wide body region file exists.

**BOTH OF THE OLD PORTRAIT REDS ARE NOW GREEN, and the two were fixed by opposite kinds of work.**

- ✅ **G2 was not an eye-shader result and not a configuration result either — it was a STALE
  CONSTANT.** `SCLERA_BRIGHTNESS` 1.26 was solved on a plate with no occlusion sheet over the eye,
  and `EyeOcclusion.js`'s sheet then took a quarter of it back: `?eyeocc=0` alone moved the old
  reading 0.9189 → 0.9444, worth 0.0255 of ratio, while `?grade=0` moved it 0.0001. Re-solved to
  **1.47**, an equal-margin point between two clauses that pull opposite ways — brightening the
  sclera raises its luma AND desaturates it through ACES, so luma wants ~1.65 and chroma wants
  ~1.41. ⚠️ **Anyone re-solving either clause alone will push the other out.**
- ✅ **G6 WAS NEVER A BLACK POINT.** The eyelash and eyebrow cards rendered at **literally
  RGB(0,0,0)**: an ungraded shipped plate carried **1,431 pure-black pixels, 100% of them in the
  brow and lash row band**, and `?grade=0&cards=0` carried none at all with a minimum of 0.003922.
  A zero-albedo, zero-specular surface cannot be raised by any light, ambient term, ground bounce
  or grade — which is why three rounds of looking at `LightingRig`, `Grade` and `GroundContact`
  found nothing. Proven by toggle before it was fixed: `?grain=0` read 0.00225 against a shipped
  0.00225 (the grain crushes nothing) and `?grade=0` read 0.00001 (the grade LIFTS). The cards now
  carry an albedo floor at the look spec's own published hair base colour `#150F17`, and the
  backdrop moved `0x050709 → 0x070a0e` because with the cards floored the backdrop became the tail
  and was sitting at exactly 1/255 — one output code value below where the gate starts counting.
  ⚠️ **The window is one code value wide** and the body clears its ceiling by 0.00003; the durable
  answer is still the one below, which is to state G6 against a plate that HAS an environment.

🚩 **And the fix is NOT the `frame` region this file has been asking for.** `measure.mjs` has
supported a `frame` region all along and none was ever authored — but drawing one would not help,
because the problem is §1.7b, not scope. The spec's 0.004–0.016 is measured on **four whole game
frames** (frontal portrait, 3/4 close-up, cutscene close-up, neon action): lit environments in
compressed JPEGs, where the darkest 0.1% is deep scene shadow and a true zero cannot occur. A
`?bare` plate is a character on a flat backdrop card with near-black alpha-tested hair in front of
it, and its darkest 0.1% is a lash texel at literally 0. **Two populations, one gate — the same
category error the sway work made with Quijoux and Duarte.** A rect on the backdrop would measure
the backdrop card's own level, which is a rig parameter.
**What would close it:** state G6 against a plate that HAS an environment — the `?backdrop=` path,
or the eventual scene — and until then read a red G6 on `?bare` as undecided. See 3.13.

⚠️ **G4 is the one to read twice.** At 900 px the same plate measures **2.1849 — FAIL**; at the
band's own 3840 px it measures 1.7469 and passes. High-pass amplitude is scale-dependent and there
is no sound rescaling law, so every G4 number in this file taken at 900 px was never comparable to
the target. Attribution holds at either width: `?skin=0` takes 900 px σ from 2.1849 to **0.4406**,
a 4.96× contribution from `SkinMaterial`.

🚩 **AND A QUARTER OF THE SHIPPED DEFAULT'S G4 IS FILM GRAIN, WHICH IS NOT A SKIN SHADER.**
Re-measured at `2ec7db9`, 3840×5120, same recipe, `?grain=0` against the default: σ goes
**1.6262 → 1.1944**, i.e. the grain contributes **0.4318 of 1.6262, 26.6%**, and without it the
shipped default reads **FAIL** against G4's 1.5 floor. G4 is a high-pass statistic and additive
noise is high-pass by construction, so this is expected — but it means "the shipped default centres
G4 in its band" is a statement about the grade as much as about `SkinMaterial`. What has changed
since the superseded pre-fix reading (1.6227–1.6362 → 1.1951–1.1960) is only that both sides are values.

🎯 **AND `?grain=0` IS A CLEAN ATTRIBUTION, WHICH IS WORTH SAYING BECAUSE `?cards=0` IS TOO.**
Same recipe at 3840×5120, each toggle against the same byte-reproducible baseline:
`?grain=0` moves **G4 alone** (1.6262 → 1.1944) and leaves G1 within 0.0001, G2, G6 and G7 within
their printed precision; `?cards=0` moves **G6 (0.00001 → 0.00393) and G7 (0.00069 → 0.008164, a
11.8× separation) alone**, leaving G1, G2, G4 and G5 identical to four decimals. Two toggles, two
disjoint effects, no overlap — which is what an attribution is supposed to look like and what
`alive-toggles.selftest.mjs`, **151/151** at `af0e68d`, enforces this for every flag on the page.

⚠️ **These plates were taken during a live fan-out and the digest churned under them.** Three loads
of the default span three `packagesDigest` values and return the same modal digest; two loads of
the A side span two more and land on the digest recorded at `1985425`. That is the honest form of
the old snapshot discipline: rather than freezing the tree, the digest is recorded per plate. What
churned was other agents' selftest files under `packages/` — `GroundContact.selftest.mjs` and
`LightingRig.selftest.mjs` were both modified mid-run — none of which `alive.js` imports, which is
why the render did not move. 🚩 **The sentence that used to close this paragraph said the *bytes*
are what carries the claim, and that is withdrawn**: the bytes carry a residue of their own that
has nothing to do with the digest, so a matching sha is evidence of an unchanged build and never
proof of one. `--plate`'s manifest records `servedByOwnFrozenServer` for exactly this reason.

---

## Phase 0 — Foundation

- [x] **0.1** Vite + three.js r185 scaffold; `WebGPURenderer` with WebGL2 fallback detection; DPR
      and resize handling. Gate: renders a lit sphere at 60 fps, reports backend in the UI.
- [x] **0.2** Blender 4.2+ with MPFB2 + `faceunits01` installed headlessly. Gate:
      `blender --background --python` prints the 52 ARKit target names.
- [x] **0.3** Figure pipeline: gender sweep → ARKit faceunits + OVR visemes → bake → GLB.
      Gate: GLB loads in three.js with all 52 morphs addressable **by name**.
- [ ] **0.4** Anny gender morph pair extraction (`gender_masc`, `gender_fem` deltas about the
      androgynous midpoint). Gate: linear blend reproduces Anny's own output to < 0.01 mm.
- [ ] **0.5** ⚠️ Diff Anny vs MPFB2 vertex ordering before assuming faceunit transfer.
- [x] **0.6** `tools/critic/measure.mjs` — headless capture + the objective gates. **Seven now:**
      G7 (card-band cool chroma) was added when G1–G6 were all green on a plate whose worst feature
      was unmissable, and G2 gained its chroma half when it turned out to be gating one clause of a
      two-clause spec sentence. G1 gained its FLOOR and G2 its hue-SIDE clause on 2026-08-08, when
      both turned out to be one-sided: `< 2.00` passed 1.344 linear against a 1.43–1.64 reference
      band, and `min(hue, 360−hue)` passed a magenta sclera beside an orange cheek.
      `node tools/critic/selftest.mjs` — **258 checks**, re-run 2026-08-08 at `f7042a0` (was 125,
      then 208, then 235). The 23 added are `capture.mjs --plate`'s: which digest IS a plate when
      thirty loads return twelve of them, and why bit-identical PAIRS is not "loads that match the
      plate". ⚠️ It does **not** match `*.selftest.mjs`; a glob that assumes it does skips the
      most-quoted gate in the project.
      🎯 **And the gates now have a gate of their own on the DOCUMENTS side.**
      `node docs/measured-claims.selftest.mjs` — **60 checks**, and **six rules now, not five**:
      PLATES was added 2026-08-08 when 3.20 made the plate reproducible, because DRAWS can only
      police a range and there are no ranges left; **REPRO** was added the same day when PLATES
      turned out to rest on an overclaim — the fence's sha256 is a MODE, the plate has a measured
      residue, and nothing held the prose to that. It re-adjudicates every gate claim in
      this file and PROGRESS against `TARGETS` imported from `measure.mjs`, and refuses a bare
      verdict inside a band edge's own measured noise. It exists because 8.1's headline read
      `six of seven … G2 0.9201 PASS` for a round while every selftest under `packages/` was green
      and right to be: the render was not the defect and the tool was not the defect, so nothing in
      the repo could reach it. Its blind spots are printed on every run rather than implied.
- [x] **0.7** Blind A/B harness: shuffles ours vs reference, strips provenance, collects a verdict.
- [x] **0.8** SPIKE: morph-target cost. 52 + 15 visemes + 2 gender on 13.7k verts. Sets the budget.
- [ ] **0.9** SPIKE: hair perf — frostbitten-hair demo on this Mac, built-in profiler, sweep strands.
- [x] **0.10** SPIKE: RectAreaLight cost curve. Where does the portrait rig start hurting?
- [ ] **0.11** SPIKE: visual check of autogenerated faceunits at gender/age extremes.

## Phase 1 — Body and identity

- [x] **1.1** `figure/Figure.js` — GLB load, morph registry, named accessors.
- [x] **1.2** `figure/Identity.js` — continuous `{gender, age, build, height}`; discrete baked GLB
      selection + clamped live morph. Gate: **CRITIC** — androgynous midpoint reads as a real body,
      not a blend artifact.
- [x] **1.3** `figure/ExpressionBank.js` — ARKit 52 + visemes + custom `mouthTighten` (ARKit lacks
      AU23, one of anger's most discriminative units).
- [x] **1.4** Region segmentation: brow / eye / mid-face / mouth-jaw blend independently.
- [x] **1.5** Skeleton normalisation (VRM-style identity-rest rig) so procedural motion is
      model-independent.

## Phase 2 — Ocular + idle ← highest perceptual return per unit effort

- [x] **2.1** `motion/Blink.js` — closing 50–100 ms, opening 150–300 ms, downphase ≈2× upphase,
      **full closure**, Poisson at 10.5–32.5/min, co-occurring with saccades > 30°.
      Gate: **CRITIC** vs Live2D's 0.1/0.15 (which is backwards).
      Arrival timing was frame-coupled until 2.11a; the numbers this item's gates were measured
      against pre-date that fix.
- [x] **2.2** `motion/Gaze.js` saccades — main sequence (10° ≈ 300°/s, 30° ≈ 500°/s), 5–10° typical
      at 30–40 ms, ≥150 ms intersaccadic, exponential fixations, microsaccades 1–2/s at 30 arcmin.
      Skip drift and tremor.
- [x] **2.3** VOR counter-rotation (7–15 ms, gain 1.0); head recruitment at 15–20°;
      **head leads eye by ~100 ms on predicted targets**.
- [x] **2.4** Conversational gaze policy — BEAT's THEME away 70% / RHEME toward 73%; mutual-break at
      turn boundaries; aversion during filled pauses.
- [x] **2.5** `motion/Breath.js` — 15–16 brpm resting, ribcage ~2–3 mm AP, belly ~5 mm, I:E ≈ 1:1.7,
      arousal scales rate +4…+9 brpm and amplitude. Gate: **MEASURED** — displacement in range.
- [x] **2.6** Postural sway — dominant mode 0.25–0.33 Hz, 95% power < 1.3 Hz, nothing above 2 Hz;
      RMS 3–5 mm ML / 5–7 mm AP; AP 1.5–2× ML.
- [x] **2.7** Idle micro-motion on co-prime cycles (Perlin 1 Hz shoulder / 2 Hz elbow / 4 Hz wrist).
      Fingers do **not** continue the ladder to 8 Hz — see `motion/HandIdle.js`. The mass rationale
      describes a segment settling under inertia and a resting finger is held by tone, and 8 Hz
      would put the tail inside the 8–12 Hz physiological tremor band. Finger amplitude is a
      **fraction of measured resting flexion**, not an angle: the shipped BodyIdle finger idle was
      authored at 0.45° of peak knuckle deviation and measured **0.48 px** of fingertip travel at
      full-body framing over 7 minutes. HandIdle measures 5.69 px.
      ⚠️ **That 5.69 px was measured at 60 Hz before 2.11 converted `HandIdle`, so it describes a
      realisation no 30 fps capture renders. STILL NOT RE-MEASURED.** 2.11 closed 2026-08-08 and
      `idle-motion.selftest.mjs` now proves the layer dt-invariant to 4.6e-9°, which means the
      re-measurement is finally *possible* and *meaningful* — it has not been done. Until it is,
      quote 0.48 px (the pre-HandIdle state, which a judge called "the hands never move") and treat
      5.69 px as pending.
      ⚠️ And both figures are stated against a **1.6 px floor that was never measured** — see
      LEARNINGS §1.14a. The honest comparison is against the 0.48–10.6 px bracket.
      🎯 **THE FREE FOOT, 2026-08-08 — root cause found and removed, magnitude still short.** The
      articulation was QUADRATIC in the load transfer: `resolvePlantedRotation` multiplied two
      readings of the SAME quantity — the released yaw was `unloadFractionOf(foot) × twist(chain)`,
      and the chain twist is already the contrapposto evaluated at this frame's blend. Measured:
      |stanceBlend| median 0.336, realised free-foot yaw median 0.255° against a full-transfer
      2.391°, and **0.336² × 2.391 = 0.270** — the square IS the whole shortfall. `writeToeLift`
      forty lines below already said in its own comment that two readings of one quantity must be
      combined by max, not multiplied; nothing had applied that to the yaw.
      Fixed with a SATURATING release whose crossover is derived, not tuned: Quijoux's 3.0 mm quiet
      standing lateral COP RMS × the hip share (1 − 0.18) ÷ this rig's measured contrapposto COM
      response = a breakaway blend of 0.0711/0.0735. Below that, which foot is free is a question
      the balance noise is answering.
      Result, seed 1, per-vertex 15 s median: **HORIZONTAL 0.272 → 1.013 px (3.73×)**. The PEAK is
      unchanged (2.43°/2.16° of released yaw), so no authored amplitude moved — only the duty
      cycle. Worst-seed band centroid 0.088 → 0.490 px, so the quiet-seed collapse is gone.
      ⚠️ **HONEST LIMIT: this is 1.0–2.6× the 0.48 px a judge called "the hands never move" and
      0.05–0.12× the 10.6 px a judge counted as an event.** The free foot is no longer dead and is
      not yet legible, and the mechanism is at its geometric ceiling — 2.4° of chain yaw about an
      ankle 130 mm behind the toe is 5.4 mm, full stop. The next lever is a foot that is
      REPOSITIONED, which the planting gate forbids by design; Bates' >50%-bodyweight fidgets at
      0.26/min are exactly those events. That is a Phase 6 behaviour with IK, not a Sway constant,
      and it should be a new punch-list item rather than another round of tuning this one.
      ⚠️ **The gated channel is now the HORIZONTAL, not the resultant** — the horizontal is the only
      one `travel.mjs` reports. On the resultant the same fix would have shown 1.467× instead of
      3.727×.
      🚩 **AND THE PIXEL HALF IS UNVERIFIED.** The effect ON PIXELS has not been measured; the
      offline silhouette surrogate predicts the judge's 0.253 px pooled band goes to ~0.37 and the
      0.657 px free foot to ~0.92, and those are PREDICTIONS. Worse, `travel.mjs`'s `foot` and
      `ankle` bands are currently measuring the FLOOR rather than the legs on any plate where the
      lit ground plane clears the automatic cut — see the integration note in PROGRESS. Re-capture
      and re-measure before quoting a pixel figure for this item.
- [x] **2.8** Pupil dilation from arousal, exaggerated past physiology.
- [x] **2.9** Weight shifts ~1–1.5/min idle; **driven by discourse boundaries, not a timer**.
      Resolved by re-rooting the shift on centre of mass rather than head displacement — a
      sustained COP offset IS a COM offset, so the transfer coefficient is decided by static
      equilibrium rather than tuned. Measured 1.575 lateral events/min (fidget + shift, both are
      weight transfers) and a head response of 1.653× the centre of mass, against the 0.20 that
      was assumed. See `figure/BodyMass.js` and the `Sway.js` header.
      ⚠️ **That 1.575/min is the pooled fidget-plus-shift rate. The SUSTAINED transfer — the body
      settling onto one leg and staying — is Duarte's ML shift alone at 0.30/min**, and a 420 s
      clip therefore carries ~2.1 expected arrivals against a lognormal magnitude draw. Measured
      over the twelve seeds `sway.selftest.mjs` gates on, only **8 of 12** contain a sustained
      transfer in 420 s and the median wait for the first one is **341 s** (worst 968 s). Nothing
      was wrong with the layer; the observation window was sized against the wrong one of its two
      processes. See 2.12 for the gate that resulted.
      ⚠️ **Re-derived 2026-08-09 on the changed trunk layer, EVERY ROW, because one row failed and
      drift does not respect row boundaries (§1.25p).** This note said "7 of 12 … 354 s". Seed
      99999989 crossed from empty to holding — its first sustained transfer moved from a declared
      781.3 s to a measured **233.03 s**, inside the clip, 2 holds filling 10.3% of it at a peak of
      +9.18 px right — and is DELETED from `POSTURAL_EMPTY_SEEDS` rather than re-timed, because
      declaring it empty makes `capture.mjs` refuse a clip that does contain the behaviour a judge
      is asked about. Seed 7 moved 187.6 s. The judgement seeds are now 4242 @ 18.77 s / −40.02 px,
      42 @ 296.70 / +35.72, 20260807 @ 231.97 / −21.90, printed at two decimals because the gate
      tolerance is 0.100 s and one decimal leaves 0.05 of margin — which is exactly how an onset of
      232.2 survived while the true value was 232.1.
- [~] **2.10** Gate: **CRITIC** blind emote comparison vs Live2D/VTuber reference clips, silent idle.
      🚩 **Capture the body clips with `--postural-seeds`** — seeds **4242, 42, 20260807** at
      **420 s** — and never with a single unchecked seed.
      ⚠️ **BEFORE CAPTURING ANYTHING FOR THIS ITEM, read the `full` column of `travel.mjs`'s band
      table.** On a body plate with the lit ground plane in shot the `ankle` and `foot` bands fill
      100.0% and 99.5% and report the frame centre, because the floor now clears the automatic cut.
      The column and its `!` flag were added at integration 2026-08-08 precisely so this stops being
      silent; a flagged band is not a measurement of a body part. Seed 1, which every earlier capture and
      judgement in this repo was pinned to, contains **no sustained weight transfer at all** in
      420 s; its first one opens at 483.0 s. See 2.12.
- [x] **2.12** The seed is a gate parameter, and it is now gated. `tools/critic/capture.mjs`
      declares which seeds it will hand a judge and what is measured to be in each;
      `sway.selftest.mjs`'s **CLIP CONTENT** section re-measures every one of those numbers on the
      shipped layer at 30 Hz and fails if a nomination has stopped being true. `--seed` takes a
      list (one clip per seed, into `<out>/seed-<n>/`), the manifest carries a `posturalContent`
      block, and `--require-weight-shift` exits 1 rather than handing a judge a clip that cannot
      contain the behaviour. The tool's own vite server now runs with the **file watcher off**, so
      a concurrent agent's edit can no longer kill a long capture (LEARNINGS §1.12).
      Gate: 12 new assertions in CLIP CONTENT, proven red by nominating seed 1 — 5 of them go red,
      headed by `nominated seeds containing a transfer 3.000, target = 4.000`. Confirmed against
      the arbiter: two 60 s captures of `alive.html?bare&frame=body` on one pinned threshold score
      a hip-band lateral SD of **2.39 px at seed 1** and **14.76 px at seed 4242**.
- [x] **2.11** Convert the remaining frame-coupled layers from `Signals.poissonEventOccurs` to
      `Signals.PoissonSchedule`, each on its own forked stream, with a frame-rate invariance gate
      on each. **All four are converted.** `Gaze` in `6bf619b`, `FacialIdle` and `HandIdle` since.
      Verified by grep and by execution 2026-08-08 — every surviving `poissonEventOccurs` call in
      `packages/core/src/motion/` is inside an `if (this.frameCoupledArrivals)` known-bad branch
      (`Gaze.js:863`, `FacialIdle.js:895`, `HandIdle.js:465`, `BodyIdle.js:516`, `Sway.js:1364-65`),
      and the one surviving `-= deltaSeconds` is `Blink.js:748`, inside
      `advanceTheOldFrameQuantisedWay`.
      Gate results, re-run: `FacialIdle.selftest.mjs` **27/27** — event counts identical
      39/18/19/5 at 30 / 60 / 120 Hz, the coupled reintroduction rejected at **2.1e8×** the
      tolerance, and it records as a gate that a RATE gate would NOT have caught it (σ 1.279).
      `idle-motion.selftest.mjs` **106/106** — worst finger divergence **4.6e-9°** against a
      1e-6 tolerance, 44/44/44 re-settles, rejection at **1.1e7×**.
      ⚠️ **THREE WAS THE WRONG COUNT AND SO WERE THE LINE NUMBERS.** This item read "the three
      remaining frame-coupled layers — `Gaze.js:1100`, `FacialIdle.js:836`, `HandIdle.js:437`".
      `Gaze` was already converted when that was written; `Gaze.js:1100` is `firePolicyTransitions`
      and holds no arrival call at all; and `Blink` was a fourth layer coupling by a different
      mechanism entirely (2.11a). Four layers, two mechanisms, and the list named neither
      correctly. **Audit for the SYMPTOM — same seed, two frame rates, one trajectory — not for
      whichever mechanism this month's instance uses.** LEARNINGS §1.13a.
- [x] **2.11a** `motion/Blink.js` was the fourth frame-coupled layer, and it coupled by the second
      mechanism, which is why the 2.11 audit walked past it: its draw rate is FLAT (measured
      2.3 / 2.3 / 2.3 per second at 30 / 60 / 120 Hz) because it drew one interval per blink.
      It counted that interval down against dt and re-armed with `= interval`, discarding the
      overshoot, so every interval was rounded UP to the next whole frame — a mean of dt/2 each,
      a predicted 12.50 ms of drift per blink between 30 and 120 Hz, measured **12.70 ms**
      (seed 1) and **12.59 ms** (seed 20260807). Over 600 s at seed 1 that is **2.6167 s** of
      accumulated drift and a worst rendered-closure disagreement at shared instants of
      **1.000000** — one frame rate has the eye fully shut where the other has it fully open.
      Fixed with a `PoissonSchedule` on a forked `arrival` stream, the frame cut at each arrival
      and at the end of each blink, and the closure snap moved out of the timeline into the
      sample. Now: onset spread **1.279e-12 s**, blink counts and every sampled shape identical
      at all three rates, rendered closure identical to **3.158e-11** away from the licensed
      snap frames (0.43% of frames). Gate: `ocular.selftest.mjs` (b3), 64 checks, proven red by
      `frameQuantisedArrivals: true` on 3/3 seeds at 1.15e6x the tolerance — and it records, as
      gates, that neither a draw-count audit nor a rate gate would have caught it.

## Phase 3 — Rendering

- [x] **3.1** `render/Stage.js` — `RenderPipeline` (not the deprecated `PostProcessing`), MRT
      `{output, diffuseColor, normal, velocity, sssMask}`. Channel contract in `render/GBuffer.js`;
      every channel verified by GPU readback on `packages/testbed/src/stage.html`, 8 of 9 checks
      green (the ninth is the morph-velocity defect recorded under 3.12). Deferred path is
      **opt-in** — `create({pipeline:true})` — so every existing forward-path consumer keeps the
      behaviour its gates were measured against.
      **DONE.** Gate: GPU readback on `stage.html`, 8/9 — and the ninth is not this item's, it is
      three r185's missing `positionPrevious` on morph targets (3.12). ⚠️ There is **no node
      selftest** for `Stage.js` or `GBuffer.js`; the readback page is the only gate and it needs a
      browser, so nothing in a script covers this item. Recorded as a known hole rather than left
      to be assumed covered.
- [~] **3.2** `material/SkinMaterial.js` — pre-integrated (Penner) SSS via `PhysicalLightingModel`
      override, **baked** curvature map, dual-lobe specular, tiled micro-normal.
      Gate: **MEASURED** — terminator saturation *rises* and shifts red; high-pass σ 1.5–2.1/255.
      **Half green, half red, and the red half is not a tuning job.**
      *Half 1 (high-pass σ) GREEN* — 1.9495/255 at 3840×2160 on `skin.html`, dead centre of the
      band, against a stock-material control of 0.2244. Re-measured on the integrated `alive.html`
      at 900 px: **1.6357 with the skin material against 0.4347 without**, a 3.76× attribution.
      *Half 2 (terminator reddening) RED, and not closable by this technique.* At the look spec's
      own 1.0–1.5 mm scatter distance the pre-integration changes **0.00% of skin pixels** by more
      than one code value, because this head's median mean curvature is **0.00455/mm** (r 220 mm)
      and 1.25 × 0.00455 is a ring curvature of 0.006, where the table is Lambert to four decimals.
      The plumbing is provably live: the change rises monotonically to 13.64% of pixels at 50 mm.
      The default is left at the physical value rather than dialled to 12–25 mm to force a
      subjective win. Delivered: `material/SkinMaterial.js`, `PreintegratedSkinLut.js`,
      `SkinCurvature.js`, `SkinMicroNormal.js`, `tools/lut-bake`, `packages/testbed/src/skin.html`.
      Budget +0.301 ms at 1080p, of which ~0.20 ms is the second specular lobe.
      **STATUS 2026-08-08: BUILT, HALF GREEN, AND STAYS `[~]`.** Half 1's gate is now measured at
      the reference width on the page a judge captures rather than on `skin.html`: **G4 = 1.7469
      /255 at 3840 px on `alive.html?bare&freeze`, PASS**, attributed by `?skin=0` at 900 px
      (2.1849 → **0.4406**, 4.96×). Half 2's gate is G3, and G3 reads **PASS on this plate — which
      is exactly why it does not close the item**: `measure.mjs` warns in its own output that G3
      passes identically on three's stock `MeshPhysicalNodeMaterial` under any rig satisfying G1,
      so it cannot certify a skin shader. The terminator half is closed by 3.2b or not at all.
      Supporting gates green: `tools/lut-bake/lut-bake.selftest.mjs` **32/32**.
      ⚠️ `material/SkinOcclusion.js` and `material/SkinRegions.js` have since landed under this
      item's umbrella; `SkinRegions.selftest.mjs` is **29/29** and `SkinOcclusion.js` has **no
      selftest at all**. See 3.18.
- [ ] **3.2b** `material/SeparableSkinSSS.js` — Jimenez separable screen-space SSS over the
      G-buffer's `sssMask` channel, which `SkinMaterial` already writes and nothing else does.
      **This, not pre-integration, is what reddens a cheek terminator**: it blurs irradiance, so
      its reach is set by the scatter distance rather than by the curvature, and ~12 mm across a
      soft terminator is the red band the reference measures. Gate: **MEASURED** — the off/on
      difference at the terminator regions, **not G3**, which passes on the stock material too.
- [~] **3.3** `material/EyeMaterial.js` — cornea refraction (IOR 1.333–1.4) into a flat iris plane,
      shader-side pupil dilation, view-dependent limbal ring, **dual-normal sclera/iris blend**
      (specular snaps flat inside the iris). Gate: **MEASURED** — sclera at ~0.98× cheek luma.
      ✅ **The asset blocker is cleared.** The figures now build with MakeHuman's high-poly eye
      proxy — two nested shells per eye, the outer one split onto its own transmissive material
      (`KHR_materials_transmission`, IOR 1.3333). The corneal dome clause the spike called *not
      shader-fixable* now passes: the front 15° cap sits **0.688 mm proud** of a sphere fitted to
      the sclera (RMS 0.202 mm), against −0.015 mm on the old globe. `verify_glb.mjs` asserts the
      dome, the anterior chamber and the cornea material on every figure.
      ✅ **THE MEASURED GATE IS GREEN, ON THE RECIPE THE REGION FILE WAS AUTHORED AGAINST.**
      Re-measured 2026-08-08 at build `c70195c` on `alive.html?bare&freeze&seed=1`, **free-running,
      no `?capture`**, against the committed portrait regions: **G2 PASS on all four clauses** —
      luma **0.9372**, saturation **1.29×** (band 1.205–1.362), sclera more saturated than cheek,
      and sclera and cheek on the same side of red. At 900 px the same recipe reads **0.9200 PASS**.
      🎯 **AND THE "SEED LOTTERY" BELONGS TO THE CAPTURE RECIPE, NOT TO `?freeze`.** Free-running,
      seeds 1 / 42 / 4242 / 20260807 produce **one byte-identical PNG** (sha256 `a61bedad…`) and
      G2 reads 0.9200 at all four. `__SUGATA_STEP__` advances the simulation whether or not
      `?freeze` is set, so a *captured* frozen plate is one frame into motion with the head at
      0.83° of yaw and the 11×6 px rect walking toward the iris — and it is there that the same
      four seeds read **0.7836 / 0.9189 / 0.9292 / 0.4390**, and that stepping two, four and thirty
      frames reads 0.3142 / 0.2046 / 0.9856. Every red G2 number this item has carried was taken
      that way. LEARNINGS §1.19a.
      **Still `[~]`, and the two reasons are honest ones.** (a) The gate is 11×6 px on a 40 px eye
      and is therefore fragile by construction — it is green on the still it is entitled to speak
      for and says nothing about the eye in motion, which is what a judge watches. (b) No visual
      judge has looked at the eye since the corneal asset landed.
      🚩 **The withdrawn claim stays withdrawn, and now for a measured reason rather than a
      procedural one.** "The eye shader makes G2 worse" came from `?eyes=0`, which removed the
      occlusion sheet as well as the shader. Isolated on one page load of `?bare&freeze&seed=1` at
      900×1200 CSS dpr 2 — shipped 0.9203 / 1.3355, `?eyeocc=0` 0.9449 / 1.2585, `?eyes=0` 0.8815 /
      0.7479, both off 0.9086 / 0.7059. The shader is worth **+0.0388 luma and +0.5876 saturation**;
      the sheet hands 0.0246 of luma back, which is why the compound control reported 0.0117 for a
      shader worth 0.0388. Reproduced at dpr 1 to within 0.003. Gated by
      `packages/testbed/src/alive-toggles.selftest.mjs`, **109/109** at `2ec7db9` — it was 16/16
      when this line was written and 24/24 a round later, and both of those versions checked a
      census of nine hand-written counters against a page that reads thirty-seven URL keys.
      Supporting gates green: `EyeMaterial.selftest.mjs` **132/132**,
      `docs/eye-optics-claims.selftest.mjs` **43/43**,
      `tools/figure-pipeline/cornea_geometry.selftest.mjs` **40/40**.
      *(Historical, kept because the refraction evidence below rests on it: sclera:cheek 0.9361 on
      `eye.html` and 0.9641 on `alive.html` were the numbers this was marked green on.)* Refraction is
      proved by execution, not by inspection: **−0.593 px/deg** of refraction-only pupil
      displacement over a ±15° camera sweep against a **−0.481 px/deg** Snell prediction for the
      fitted 3.328 mm anterior chamber, and **1.198×** corneal magnification of the pupil chord —
      neither producible by a flat disc. All five remaining geometry-contract clauses are absorbed
      in the shader rather than in the asset; every constant is fitted from the mesh at load, so
      the material is per-figure. Gate: `node packages/core/src/material/EyeMaterial.selftest.mjs`,
      **132 checks** (documented as 99, then 131; re-run 2026-08-08).
      ⚠️ **G2 does not isolate this shader, and that is a property of the gate rather than of the
      shader.** With the sheet held fixed, `?eyes=0` moves G2 luma by 0.0388 and saturation by
      0.588 — a real, signed, reproducible difference — but both states can sit inside the luma
      band, so a PASS/FAIL verdict does not attribute anything. **The attributable evidence is the
      refraction sweep and the DIFFERENCE between two plates from one page load, never the
      verdict.**
- [x] **3.4** Eye occlusion sheet + lacrimal geometry + per-eye catchlight cubemap.
      Delivered in `material/EyeOcclusion.js` and `material/EyeCatchlight.js`. The palpebral
      aperture is **measured from the figure's own eyelash mesh** as a radius per 30° sector, at
      the 20th percentile rather than the minimum — one stray lash taken as the lid margin pulled
      the aperture inside the visible sclera and cost G2 0.28 of ratio (0.9157 → 0.6322). The
      catchlight cubemap is generated at runtime; no asset ships.
      **DONE, and it now has its own control and its own measured contribution.** Gate: `?eyeocc=0`
      on `alive.html?bare&freeze&seed=1` at 900×1200 dpr 2 — hiding the four occlusion/lacrimal
      meshes moves the sclera rect from encoded luma **0.7240 → 0.7433** and saturation **0.2527 →
      0.2381**, i.e. the sheet is doing what it is for: darkening and warming the sclera under the
      lid. Held against the toggle contract by `alive-toggles.selftest.mjs`, **151/151** at `af0e68d`
      (109/109 at `2ec7db9`, 16/16 when the file was written).
      🚩 **The toggle is new and it is the whole point of this line.** Until 2026-08-08 `?eyes=0`
      switched this subsystem AND `EyeMaterial` together, so this item had **no control of its
      own** and every number attributed to 3.3 was a sum including this one. LEARNINGS §1.19.
- [ ] **3.5** `material/HairMaterial.js` — Karis closed-form BSDF, cards default. Near-black albedo
      (`#150F17`) with ~10:1 spec-to-albedo contrast, broad soft dual bands, root AO 0.35–0.5.
- [ ] **3.6** Hair OIT — weighted-blended on WebGL2, tile-binned on WebGPU.
- [ ] **3.7** `material/FabricMaterial.js` — latex/PVC clearcoat, satin, sheen for shearling.
- [x] **3.8** `render/LightingRig.js` — 3–4 RectAreaLights (key/fill/rim/kicker); **the key alone**
      paired with a co-located shadow-casting **SpotLight** carrying a measured 0.45 of its
      irradiance. Gate: **MEASURED** — face key:shadow < 2:1.
      Two corrections to this item's original wording, both measured. (a) *"each paired"* is not
      affordable: one shadow caster costs **2.62 ms** at 1920×1080 on the real figure and four cost
      **9.11 ms**, which with the four panels' 3.61 ms would be 12.7 ms of a 16.6 ms frame. (b)
      *"directional"* had to become *spot*: a `DirectionalLight` has no distance falloff, so
      splitting a light between a panel and a directional changes the pair's falloff — measured,
      turning shadows OFF made the backdrop *darker*, which no shadow can do.
      **Gate green at both framings — and as of 2026-08-08 that means something it did not mean
      before, because G1 is now TWO-SIDED.** Re-measured at build `c70195c` on
      `alive.html?bare&freeze&seed=1`, free-running:

      | plate | G1 linear | side |
      |---|---|---|
      | portrait, 3840×5120 | **1.6265** | inside the 1.43–1.64 reference band |
      | portrait, 900×1200 | **1.5962** | inside the band |
      | portrait + `?grade=1` | **1.6622** | above the band, under the ceiling — PASS |
      | **full body**, 900×1200, `regions.lighting-body.json` | **1.5547** | **inside the band** |

      🎯 **The full-body reading is the news.** This item recorded **1.2104 / 1.2161** and called
      the flatness "a trade recorded rather than hidden" — prose, because the one-sided gate could
      not hold it. It now measures **1.5547**, inside the band, and the two-sided gate holds it
      there. Under the old `< 2.00` form, 1.21 and 1.55 were the same verdict.
      Known-bad proven both ways: the conventional 4:1 portrait rig scores **3.1497** (TOO
      CONTRASTY) and a constructed 1.344 — flatter than the reference band and the exact number the
      one-sided gate used to pass — now scores **TOO FLAT**, as does a dead-flat 1.000, which is
      what this page's old inline rig actually measured. Gate: `LightingRig.selftest.mjs`
      **63/63 at `2ec7db9`, then 82/82 four minutes later while its author was mid-save** — quote
      neither without the tree state (was 38/38, then 46/46; exit 0 throughout, and the "exits 0 on
      FAIL" report was a mid-save artefact and is retracted) — and `tools/critic/selftest.mjs`
      **235/235**.
      🚩 **AND ITS ENVIRONMENT-SPILL CLAUSE HAS AN UNASSERTED PREMISE.** It sums only the
      `RectAreaLight` panels and argues that adding the shadow casters would lower blue:red, "the
      conservative direction". That is true only because a caster copies its panel's colour
      (`new SpotLight( new Color( placement.colour ), 1 )`), which nothing checks: the string
      `shadowCaster.color` appeared **zero times** in the selftest.
      ✅ **RESOLVED — REQ-006 in [`OPEN-REQUESTS.md`](OPEN-REQUESTS.md)**, and it appears five times
      at `af0e68d` as an explicit PREMISE equality. ⚠️ **And the request was right and
      insufficient**: `8771061` then found that PREMISE is an equality on COLOUR and CONSERVATISM is
      a test of a SIGN, while the sentence they defend is entirely a claim about MAGNITUDE. Two more
      clauses, MAGNITUDE and REACH, proved red six ways — and the *third* instance of the same shape
      is live in the clause that replaced them (REQ-030). LEARNINGS §1.25l, §1.25q.
      Lights are authored as **irradiance at the focus**, not as `intensity`: three's
      `RectAreaLight.intensity` is a radiance, so four typed intensities express a ratio only for
      the exact panel geometry they were typed against — this rig's fill panel subtends **2.485×**
      the key's solid angle. Budget: 3.61 ms for the four panels + 2.62 ms for the one shadow pass.
- [~] **3.9** Screen-space contact shadows (`SSSNode`) for eyelid crease, nostril, lip corner.
      **NOT what shipped, and the substitute is better argued than the original.**
      🚩 **`material/SkinOcclusion.js` is UNTRACKED as of this writing** — `git status` reports it
      `??`, so it exists in the working tree and not in any commit, and a `git checkout` would lose
      it. LEARNINGS §1.25f. It answers the same defect — cavities rendering at open-cheek
      brightness — with a **baked per-vertex hemisphere-visibility** term applied chromatically,
      rather than with a screen-space trace. Its header carries the measurement that motivates it:
      the spec's ear sample is `#755052` at **0.450× cheek luma**, and ours measured
      **0.891× cheek** (`#daaba0`, luma 0.7072, S 0.2646) on `alive.html?bare&freeze&frame=face` at
      3840×2160 — too bright for want of a shadow, not too dim for want of a glow. It also
      *disproves* the obvious first diagnosis by toggle: `?trans=0/1/8` on `skin.html?frame=face`
      moves the ear by **0.0008 of luma**, so the transmission term is starved by a blue rim rather
      than broken.
      🔴 **NOT DONE, and the reason is that it has no gate.** There is **no `SkinOcclusion.selftest.mjs`**
      and no MEASURED plate result: the 0.891× is a diagnosis, not an after-measurement. Until the
      same ear patch is re-measured on and off and reported against the reference's 0.450×, this is
      built-and-ungated. `SSSNode` itself remains untouched, and whether it is still wanted for the
      eyelid crease at portrait framing is an open question, not a closed one.
- [ ] **3.10** GTAO → **bent normals + specular occlusion** (Frostbite form). Hand-rolled — three.js
      has neither, and un-occluded ambient specular is why WebGL characters look like plastic.
      The G-buffer's `normal` attachment is **signed view-space xyz with perceptual roughness in w**,
      which is what `GTAONode` consumes directly — it calls `.normalize()` on what it samples, so
      repacking to RGB8 via `packNormalToRGB` would confine the direction to the positive octant
      and yield plausible-looking wrong AO. Do not repack it.
- [x] **3.11** ⚠️ Normal-map variance → roughness (Toksvig/LEAN). three.js's specular AA is
      *geometric only*, so micro-detail and hair **will** shimmer without this.
      Gate: verify with a **moving** camera, not a still.
      **DELIVERED** in `render/Toksvig.js` (Kaplanyan screen-space normal variance → roughness in
      alpha space, plus the classic Toksvig form; selftest 9/9, one check PROVEN RED against the
      naive perceptual-space form at Δ0.2261), wired into `material/SkinMaterial.js`'s region-map
      roughness and live on `alive.html` with `?specaa=0` as the A side.
      Gate: **MEASURED with a moving camera** (6 °/s orbit, 900×1200): forehead high-frequency
      temporal RMS **1.800 → 1.410/255** and cheek **3.337 → 2.590/255**, both −22%. It removes the
      crawl and not the detail — G4 measured 1.6877 with it and 1.6969 without, at 3840 px on
      `alive.html?bare&freeze`.
      🚩 It must take `normalView` (the **shading** normal), not `normalViewGeometry`. three's own
      specular AA takes the latter — `getGeometryRoughness.js` differentiates the interpolated
      *vertex* normal — which is exactly why the micro-normal at 48 repeats had no defence.
      🚩 And MSAA is not a substitute: with and without it the same statistic reads **1.408/255**,
      identical to three decimals. MSAA does nothing whatever for shading aliasing.
      **DONE, re-verified 2026-08-08.** Gate: `render/Toksvig.selftest.mjs` **9/9**, one check
      proven red against the naive perceptual-space form at Δ0.2261, plus the moving-camera
      measurement above. ⚠️ The item's own G4 evidence (1.6877 with, 1.6969 without) was taken at
      3840 px on `alive.html?bare&freeze` and is the one G4 number in this file that was already at
      the band's reference width — quote it in preference to any 900 px figure.
- [x] **3.12** TRAA + TAAU at `resolutionScale ≈ 0.66` — the lever that buys the expensive skin shader.
      🎯 **CLOSED, AND IT IS THE DEFAULT ON `alive.html`.** `?aa=taau` at 0.66 plus `?grade=1` plus
      the grade's RCAS at `TEMPORAL_RECOVERY_SHARPNESS` = 1.2 is what the page now boots into;
      `?aa=msaa&grade=0` is the A side and is the forward path every Phase 2 motion number was
      measured on. `render/TRAAPost.js` and `render/MorphVelocity.js` are both committed, with
      `TRAAPost.selftest.mjs` at **11/11** and `MorphVelocity.selftest.mjs` at **16/16**.
      🚩 **THE BLOCKER WAS FIXED AT SOURCE, NOT WORKED AROUND.** `render/MorphVelocity.js` supplies
      the previous-frame morphed position before three's `setupPosition` runs, so a held morph
      finally reports zero velocity. `jawOpen` HELD at 0.8 with the camera still, converged to
      frame 150 — a frame where every honest motion vector is zero, so every code value is an
      artefact — goes from **15.96× the jitter floor to 1.60×**. `?morphvel=off` is three r185
      unpatched and is the rejection proof, live on `alive.html`.
      🚩 **"TURNING TRAA ON TURNS THE CARD ANTI-ALIASING OFF" WAS WRONG, AND IT GOES THE OTHER WAY.**
      The claim was structural and plausible — alpha to coverage does need MSAA — but it was never
      measured. Share of card-band silhouette transitions that jump in a single pixel, on
      `?bare&freeze` converged to frame 300 at 900×1200, grade on in every row: **no AA 68.7%,
      MSAA + alpha-to-coverage 44.5%, TRAA 35.5%, TAAU 27.1%.** The temporal resolve antialiases
      the lash and brow cards BETTER than alpha to coverage did. G7 is unchanged across all of them
      (0.00057–0.00070 at 3840 px). Ruling a mechanism plausible is not measuring its effect.
      ⚠️ **Morph targets write no velocity, and it is worse than writing none.** three r185's
      `Morph.js` has no `positionPrevious` path (`Skinning.js` does, at :166 and :233), so the
      previous-frame position is reconstructed from un-morphed geometry. A morph held at a
      **constant** weight reports a **constant non-zero** motion vector — measured 35.5 px/frame at
      1280×720, byte-identical to the reading when the same morph is actually swept. This rig has
      no jaw bone and no eye bones, so the face is 100% morph-driven: a talking, blinking face
      hands TRAA/TAAU a bogus motion vector across the whole head. Do not assume TRAA
      "just works" on the avatar.
      🚩 **Only the previous-weights path remains — masking by velocity was tried and measured to
      make it WORSE.** Lowering `TRAANode.maxVelocityLength` is the only face mask reachable
      without touching a material, and with `jawOpen` held at 0.8 the jaw's temporalRms goes
      **4.734** (vconf 128) → **6.151** (48) → **7.823** (24) → 6.021 (12), because a rejected
      history exposes the camera jitter directly. The silhouette gain is unchanged throughout.
      ⚠️ Now measured on the REAL FACE rather than on a test sphere. `jawOpen` held at a constant
      0.8 with the camera still — a frame where every honest motion vector is zero — gives
      temporalRms **4.711/255** under TRAA and **4.387** under TAAU against MSAA's **0.000**, i.e.
      18.3× and 29.8× the no-morph controls of 0.258 and 0.147. Under an *animated* morph both
      temporal modes BEAT MSAA (12.315 and 11.234 against 13.420), so the defect is specific to
      **held** expressions — which is most of the time for a face between blinks.
      ⚠️ **THE NUMBERS IN THE PARAGRAPHS ABOVE WERE TAKEN AT 900 px AGAINST A BAND STATED AT
      3840 px, AND THE VERDICT THEY CARRIED IS NOT ENTITLED.** "TAAU 0.66 + RCAS is the only
      configuration that puts G4 mid-band" is false at the reference width: the shipped MSAA
      default already passed there. The decision below was re-taken at 3840×5120, converged to
      frame 60 with a zero simulation step, all rows in ONE run so `packagesDigest` cannot differ.
      **The `18.3× / 29.8×` figures above are the right order of magnitude but were measured on a
      page whose `__SUGATA_STEP__` advanced only the simulation, so an unknown number of renders
      happened per step — see the `?freeze` correction in §1.25.**
      **MEASURED AT THE REFERENCE WIDTH, and re-measured after integration on the shipped tree
      (3840×5120, `?bare&freeze&seed=1`, 60 rendered frames of a genuinely frozen page):**

      🎯 **RE-MEASURED AT HEAD `2ec7db9`, AFTER 3.20. BOTH ROWS ARE VALUES AND BOTH ARE
      BYTE-REPRODUCIBLE** — 3 loads of the shipped row (`257caca2782adde9`) and 2 of the A side
      (`b3609ee0652db4c5`), across five different `packagesDigest`s. 3840×5120 dpr 1,
      `?bare&freeze&seed=1&capture`, 60 steps at 60 fps, portrait regions.

      | configuration                        |     G1 |     G2 |     G4 |      G6 |      G7 |
      |--------------------------------------|-------:|-------:|-------:|--------:|--------:|
      | `?aa=msaa&grade=0` (the old default)  | 1.6180 | 0.9221 | 1.7469 | 0.00001 | 0.000742 |
      | shipped: TAAU 0.66 + grade + RCAS 1.2 | 1.6630 | 0.9197 | 1.6262 | 0.00001 | 0.00069  |

      G2 is MARGINAL on both rows: 0.9221 clears the 0.92 floor by 0.0021 and 0.9197 misses it by
      0.0003, and the same page measured at 900 px instead of 3840 moves G2 by 0.0028 — more than
      either margin. The verdict is decided by the anti-aliasing mode and the width, not by the eye.
      🚩 **THE SHIPPED ROW USED TO READ `1.6636 | 0.9201 | 1.6315 | 0.00001 | 0.00077` AND CALL
      ITSELF SIX OF SEVEN. IT IS FIVE OF SEVEN.** That row was a single draw from a stochastic
      plate; 0.9201 did not recur in 14 draws at `1985425` and does not recur now. The A-side row
      has reproduced its four values across three builds and now its sha256 as well, which is what
      says the harness is sound and the shipped row was not.
      MARGINAL: G2 on both rows is within 0.0021 of the 0.92 floor against a load-to-load spread
      of 0.0004, so the PASS on the MSAA row is as unentitled as the FAIL on the shipped row.
      G6 is UNDECIDED rather than a defect (see 3.13). G4 is better centred in its 1.5–2.1 band —
      though see the top of this file: **26% of the shipped row's G4 is film grain**, and with
      `?grain=0` it drops to 1.1951–1.1960 and fails. What decides it is EDGES, which is what
      anti-aliasing is for: at 900×1200 the share of silhouette transitions that jump in a single
      pixel goes **67.9% → 17.9%**, a 3.8× improvement.
      **What it costs that MSAA does not:** a 0.1176/255 per-pixel temporal residual on flat skin
      with a still camera, against MSAA's exact 0.0000 — a forward frame of a static scene being
      bit-identical. That is well inside the 1.41/255 the project already accepts from 3.11.
      GPU timestamp index at 1920×1080 free-running: 7.31 ms → 21.36 ms, both holding 120 fps on
      this machine. Treat the ratio as real and the absolute values as unproven — the timestamp
      sums render passes the GPU pipelines, so it is an index rather than wall time.
      ⚠️ **TAAU's still-camera boil depends on a feature nobody connected it to.** It reads
      2.60/255 on `post.html` and 0.1176/255 on `alive.html`, and the difference is **3.11's
      Toksvig filter** — a 22× suppression. If 3.11 is ever weakened, or a future material bypasses
      the filtered roughness, the boil returns and **no current gate measures it.**
      ⚠️ **The deferred path is not the path Phase 2's PIXEL measurements were taken on.**
      `travel.mjs`, `heatmap.mjs` and every clip-based motion number in PROGRESS predate this
      default. They are not invalidated, but they are no longer same-build comparisons: anything
      A/B'd across this commit must be re-run on one side, or pinned with `?aa=msaa&grade=0` on
      both.
- [~] **3.13** `render/Grade.js` — AgX/ACES, **no black lift**, bloom wide and low-threshold,
      luminance-only grain σ 1–2/255, CA off.
      🚩 **"Bloom wide and low-threshold" is correct for UE and WRONG for three, and the difference
      is a gate failure.** UE's bloom is energy-conserving; three's `BloomNode` ADDS a blurred
      copy. At the spec's own intensity of 0.30, threshold 0 lifts whole-image p0.1 luma from
      **0.02496 to 0.08630** and the backdrop from 0.0250 to 0.1066 — a **4.3× black lift**, which
      the same spec forbids in bold. Threshold **0.8** keeps the intensity and returns the black
      point to 0.02496 exactly. `Grade.js` ships 0.8 and carries the sweep.
      🚩 **Flat grain CRUSHES the blacks — the same constraint violated in the other direction, and
      invisible by eye.** σ 1.5/255 has a 5.2/255 half-width, so against a backdrop near 3/255 it
      clips a tail to zero: p0.1 went **0.00869 → 0.00057**. A `4L(1−L)` midtone envelope fixes it
      (0.00842) and is also the physics — grain is a fluctuation in developed silver density, and
      an unexposed region has no grains to fluctuate.
      🎯 **IT IS NOW THE DEFAULT ON `alive.html`** — `?grade=0` is the A side. RCAS defaults to
      `TEMPORAL_RECOVERY_SHARPNESS` = 1.2 there and to `null` in the constructor, and the split is
      the point: a forward MSAA'd frame has nothing to recover and a temporal resolve does.
      **AND IT MOVES G6 AT BODY FRAMING INTO THE BAND.** Re-measured after integration at 900×1200
      on `?bare&frame=body&freeze&seed=1`: p0.1 luma **0.01652 → 0.0126**, inside 0.004–0.016 where
      the ungraded plate was 3% over the ceiling. Portrait is the opposite failure and unchanged.
      Gate: **MEASURED** — < 0.5% clipped, p0.1 luma 0.004–0.016.
      ⚠️ **"Built and uncommitted as of 2026-08-08" IS STALE — it is committed**, at build
      `c70195c` with a clean tree.
      ⚠️ **The RCAS-before-tone-mapping number this file and `Grade.js` both used to carry DOES NOT
      REPRODUCE.** "The brown iris measures luma 0.1237 / saturation 0.2997 unsharpened and
      0.4159 / 0.1268 with RCAS before tone mapping — a brown iris rendering grey" re-measures, on
      the same page and the same rect converged to frame 120, as 0.1169/0.4086 with no sharpen and
      0.1164/0.4032 with RCAS 0.4 before tone mapping: **a 1.3% difference, not 2.4×.** The pass IS
      in the graph (it moves G4 by 1.26×), so this is not "the pass was inert". Likely taken before
      LEARNINGS §1.24 was fixed — that is a hypothesis and is labelled as one. What survives is the
      architectural argument for running an LDR operator after the transfer.
      **MEASURED on a page, 2026-08-08, `alive.html?bare&freeze&seed=1&grade=1` at 900×1200,
      free-running:** G5 **0.0003% clipped, PASS**; G6 **0.00312 — under the 0.004 floor, FAIL**;
      G1 1.6622 (above the reference band, under the ceiling, PASS). The ungraded control on the
      identical recipe reads G6 **0.00001**, so the grade moves the black point by **312×** and
      still lands short — because on this page G6 is not measuring the grade at all.
      **Stays `[~]` for that reason, and it is an INSTRUMENT problem, not a grade one.** With
      `?cards=0` the ungraded plate reads **0.00393**, i.e. inside a rounding error of the graded
      figure: the darkest 0.1% of this frame is genuinely-black eyelash and eyebrow pixels, and
      they own the bottom of the histogram whatever the grade does. ⚠️ **AND THE `frame` REGION THIS
      LINE USED TO ASK FOR IS NOT THE FIX** — see the standing note at the top of this file.
      `measure.mjs` has supported one all along; drawing a rect on the backdrop would measure the
      backdrop card's own level, which is a rig parameter. G6 on a `?bare` plate is §1.7b: the
      spec's band was measured on four whole game frames where a true zero cannot occur, and this
      plate's darkest 0.1% is a lash texel at literally 0. Read it as UNDECIDED, not as a defect.
      🚩 **`Grade.selftest.mjs` WAS a CPU mirror plus a regex over the module text, and a verifier
      proved the pair decorative with one edit** — `level.mul( level.oneMinus() ).mul( 4 ).mul( 0 )
      .add( 1 )`, arithmetically the constant 1 with every token a regex looks for still present —
      on which the file reported 28/28 green. **FIXED, TWICE.** The three regex-over-source checks are
      DELETED, eight rendered checks R0–R7 now read pixels off the shipped GPU node, and **nine
      rebuilt defects are rendered alongside with a printed table of which named check each one
      trips** — three are caught by exactly one check, which is what makes those three
      load-bearing. The `.mul(0).add(1)` sabotage is the `flat` row and trips five. Then a temporal
      section landed and it is **56/56** at `2ec7db9`.
      🚩 **AND THE TEMPORAL SECTION READS SEVEN FRAMES, `SEQUENCE_FRAMES = [ 9, 10, 11, 12, 13, 14,
      20 ]`.** Exactly one of them is at or above 16 and a pairwise distinctness check needs two, so
      **a grain that freezes at frame 16 is invisible and the file still scored 56/56.**
      ✅ **RESOLVED — REQ-007 in [`OPEN-REQUESTS.md`](OPEN-REQUESTS.md), and superseded rather than
      applied.** The request asked for a consecutive pair at the top of the set; what landed instead
      is an L1–L3 block that renders **600 frames**, samples 96 of them and computes its own
      coverage, plus a `CONSECUTIVE_PAIR` guard that refuses to run if the constants drift apart.
      Applying the narrower request on top would have added a check that could no longer fail.
      LEARNINGS §1.25j.
      One honest limit, stated in the file rather than hidden: the rendered checks have an 8-bit
      resolution floor and cannot see a crush confined below ~0.5/255, which is where the `sqrt`
      envelope's crush lives; R5 catches `sqrt` by its SHAPE instead, with 1.33× of margin.
      LEARNINGS §1.25b.
      ⚠️ **G6's whole-image reading on `alive.html` changed meaning under 3.13's feet.** It used to
      measure the backdrop (p0.1 = 0.0250). Re-measured 2026-08-08 it reads **0.00001** — the card
      fix put genuinely black lash and brow pixels in frame and they now own the bottom 0.1% of the
      histogram. With `?cards=0` it returns to 0.02496. Neither number is about a grade lift, and
      neither is fixed by a `frame` region — see the standing note at the top of this file.
- [ ] **3.14** Bokeh DOF, f/2.8–5.6 @ 50 mm equiv; portrait FOV 24–40°.
- [ ] **3.15** Gate: **CRITIC** blind side-by-side vs AAA reference stills. Same-tier.
- [x] **3.16** 🎯 **Card shading — the eyelash and eyebrow meshes, and gate G7 that exists because
      of them.** They were the only meshes `applyShading` skipped, so they kept MakeHuman's
      roughness-0.5 slab and rendered as saturated royal-blue spikes at portrait framing while
      G1–G6 all read green for three rounds. Fixed by `specularIntensity 0` (a card's shading
      normal is its plane normal, which is a lie about a fibre bundle — punch-list 3.5 is what puts
      an *anisotropic* lobe back) and alpha to coverage at cutoff **0.1** rather than the glTF
      default 0.5, which was discarding 15,368 lash and 20,262 brow texels.
      Gate: **MEASURED** — G7, a per-pixel cool-chroma outlier count over four hand-drawn rects on
      the lash lines and brows, < 0.10% of the band.
      ⚠️ **THE SEPARATION IS SMALLER THAN THIS LINE HAS BEEN CLAIMING, AND IT IS RECIPE-DEPENDENT.**
      "0.0056% shipped against 0.7571% with `?cards=0`, a **135×** separation" was measured on
      `alive.html?bare&freeze` at 900×1200 on an older build and does not reproduce. Re-measured at
      `2ec7db9` on `?bare&freeze&seed=1&capture`, 60 steps, both plates byte-reproducible:
      **3840×5120 — 0.00069 shipped against 0.008164, an 11.8× separation.**
      **900×1200 — 0.000336 against 0.002131, 6.3×.** The gate still passes with an order of
      magnitude of headroom and the toggle still attributes cleanly (it moves G6 and G7 and nothing
      else to four decimals), but 135× was a property of a plate nobody can take today. Commit
      `62dc6db`.
      ⚠️ **AND RE-MEASURED AGAIN AT INTEGRATION, on the third render in three rounds:
      3840×5120 — 0.000601 shipped against 0.007878, a 13.1× separation.** The point is not the
      drift; it is that this one number has now been quoted at 135×, 11.8× and 13.1× on three
      different builds, and each restatement was correct when it was written. **Quote a separation
      with the build and the width or do not quote it.**
      🎯 **AND THE OTHER HALF OF THE TOGGLE FINALLY MEANS SOMETHING ELSE.** `?cards=0` used to move
      G6 as well as G7, because the cards were the darkest thing in frame; now `?cards=0` and the
      shipped default read the SAME G6, 0.0042. The toggle moves G7 **alone**, which is what it was
      always supposed to do and could not while the cards were at zero albedo.
      ⚠️ The card texture is **near-black, not white** — measured out of `figure_g050.glb`,
      `eyelashes01`'s opaque texels average sRGB (0.0327, 0.0118, 0.0039) = 0.0025 linear. The
      `baseColorFactor` is `[1,1,1,1]`, which is what made "white MeshStandardMaterial" survive in
      PROGRESS for a round; it inverts the mechanism, because it is the ABSENCE of diffuse that
      made the pixel 100% Fresnel. LEARNINGS §1.11e.
- [~] **3.17** `render/GroundContact.js` — the figure stops hovering. A judge measured the last
      skin pixel at a sole at luma **0.4789** against a backdrop at **0.0735** falling to 0.0721
      fifty-seven pixels below: no floor, no contact shadow, nothing. The shadow map provably
      cannot fix it (3.8's own residue: sweeping the key 18 → 42° of elevation moved the floor
      0.3045 → 0.3251 encoded, i.e. nothing).
      ⚠️ **"Built and uncommitted as of 2026-08-08" IS STALE — it is committed**, at build
      `c70195c` with a clean tree, and `GroundContact.selftest.mjs` passes **47/47** at `2ec7db9`
      (recorded here as 14/14, then 31/31, then 36/36 — read the tree state, not the number).
      **Stays `[~]`**: no MEASURED plate result on `alive.html` yet, and the
      defect it answers was reported by eye, so a judge has to say the hovering has stopped.
      🚩 **When that judge captures the plate, it must go through `ground.update()` on BOTH frame
      paths.** LEARNINGS §1.24 records this exact module's contact shadow silently freezing under
      `?capture`, because it lived in a `stage.onFrame` callback that the capture path never fires.
      It now lives in `trackFigure()`, which both paths call — verify that before believing a
      captured plate of it.
- [~] **3.18** `material/SkinRegions.js` — the baked thickness and facial-region maps 3.2 shipped
      without, which are the missing input for both the reference's glowing ear (`#755052` at
      saturation 0.41, needs transmission) and the T-zone / cheek / lip roughness split
      (0.32–0.40 / 0.42–0.50 / 0.18–0.28, of which one value — 0.46 — currently ships).
      ⚠️ **"Built and uncommitted as of 2026-08-08" IS STALE — it is committed**, at build
      `c70195c` with a clean tree, and **"no gate" is stale too**:
      `material/SkinRegions.selftest.mjs` passes **29/29**. **Stays `[~]`** for the reason that
      actually remains: no MEASURED plate result attributes either of the two effects this item
      exists for. Specifically —
      (a) the **ear**: the reference is `#755052` at **0.450× cheek luma**, ours measured
      **0.891× cheek** before this landed, and nobody has re-measured the same patch since. That
      measurement belongs to 3.9's `SkinOcclusion.js` as much as to this item and should be taken
      once, on and off, at `?frame=face` 3840×2160.
      (b) the **roughness split**: 0.32–0.40 T-zone / 0.42–0.50 cheek / 0.18–0.28 lip, of which one
      value shipped. Nothing measures whether the map is reaching the shader.
      🚩 And when the map is loaded, check `flipY`: LEARNINGS Part 2 records a baked thickness map
      loaded through `TextureLoader` (default `flipY = true`) sampling vertically mirrored against
      a `GLTFLoader` albedo, which made a whole transmission term inert — 3.32–7.47 mm at `v`
      against 42.26–60.00 mm at `1 − v`.
- [x] **3.20** 🎯 **The capture epoch — a still plate is reproducible from its own identity.**
      `?capture` pinned `nodeFrame.time` and `deltaTime` and left three renderer-side counters
      running on rAF: `nodeFrame.frameId` (which seeds the grade's grain), the temporal resolve's
      `_jitterIndex`, and its history render target. rAF starts inside `stage.create()` while
      `boot()` is still awaiting a GLB, so their value at the first captured step was **a count of
      how many frames the machine fitted into loading a figure** — measured 2392 / 1216 / 1961 over
      three loads at one instrumentation point and 15 / 16 / 17 / 18 at another.
      Landed in `4aafd91` (+ `eaae0e3`, `29a1f1c`). A fix that stopped at `frameId` would have made
      the A-side plate reproducible and left the shipped default exactly as broken; the attribution
      table in that commit is what says so.
      Gate: `packages/testbed/src/alive-capture-determinism.selftest.mjs`, **49/49**, four kinds of
      check (R reproducibility as a pixel tolerance, O the counters read what N steps require, L the
      grain still advances on the forward path, H the history target is 1 px at takeover), proved
      red four ways at source and six ways from a URL via `?clockdefect=`.
      🚩 **Two things that gate learned the hard way and that generalise.** Its first version scored
      the R rejections GREEN on live defects, because two loads of the real defect diverge only if
      they booted at different epochs and against a warm vite they boot identically — every R pair
      is now taken across an undelayed load and one whose GLB is held back 400 ms. And deleting the
      history reset alone leaves every pixel check green at 2 and 24 steps, because a temporal
      resolve converges to the same fixed point from any history.
      **Verified independently 2026-08-08 at `2ec7db9`:** three loads of
      `?bare&freeze&seed=1&capture` at 3840×5120, 60 steps, across three different
      `packagesDigest`s → one digest. 🚩 **That line used to read "→ one PNG, `257caca2782adde9`"
      and the digest is unreachable today**; re-measured at `f7042a0` over 103 loads the plate is
      reproducible to Δ2/255 on 164 px of 19.7 million and its mode is `d3c9946f73e5eaa1`. 3.20 is
      not in question — the pre-3.20 failure was 56.4% of pixels, four orders of magnitude larger —
      but the epoch pin bought a tolerance and not a hash. See the block at the top of this file.
- [ ] **3.21** Re-measure all fourteen `?statedefect=` switches on **`alive.html` at the objective
      recipe** — `?bare&freeze&seed=1&capture`, 3840×5120, 60 steps at 60 fps, dpr 1 — and put that
      column beside the existing `lighting.html` one in `packages/testbed/src/light-defects.js`'s
      table, each column labelled with its page, framing and step count.
      🚩 **Converted here from ledger REQ-034, and the conversion is the point: this is a
      MEASUREMENT CAMPAIGN, not a diff.** Twenty-eight plates at 19.66 Mpx (a defect and a baseline
      per switch), a per-switch difference over each pair, and a table rebuilt from the result. The
      ledger is for changes an integrator can apply and adjudicate with a regex; work whose cost is
      GPU hours belongs on a list that can sequence it. Same disposition and same reasoning as
      REQ-024 → 9.21.
      **Why it is worth the hours.** R8 wired the switches onto `alive.html` and spot-measured three
      of them at 900×1200 portrait: `statedefect=decay` moves **29.21%** of samples at worst Δ16/255
      there, against **96.11% / Δ70** on `lighting.html` at body framing and **41.64% / Δ8** as an
      earlier verifier reported on `alive.html`. Three numbers, three recipes, one mechanism. A
      defect's pixel footprint is a property of the plate (LEARNINGS §1.20), so none of the three is
      wrong and none of them answers the question a judge asks. One table, one recipe per column.
      Gate: **MEASURED** — every row of the new column carries the page, the framing and the step
      count that produced it, and the module's header stops saying the figures are not transferable
      while offering only one page's worth of them.

## Phase 4 — Speech

- [x] **4.1** `voice/Visemes.js` + `Coarticulation.js` + `VisemeSchedule.js` + `VisemeLayer.js` —
      viseme timeline `{viseme, startTime, duration}[]` scheduled against `AudioContext.currentTime`.
      Canned timeline, no TTS. Gate: `packages/core/src/voice/visemes.selftest.mjs`, 59 checks, and
      the `packages/testbed/src/voice.html` browsercheck, which drives the real figure's real morph
      targets. The figure carries all 15 OVR and all 22 Microsoft shapes as named targets (read out
      of the GLB, not asserted against a list), and the fifteen OVR shapes are fifteen genuinely
      different shapes in vertex space — closest pair `viseme_SS`/`viseme_nn` at 0.3009 mm RMS apart
      over 105 pairs.
- [x] **4.2** Coarticulation envelope — anticipation min(60 ms, 2d/3), attack min(25 ms, d/2),
      release min(60 ms, d/2), max 200 ms, PP/FF peak 0.9 vs 0.6. Reproduced exactly at three time
      scalings chosen to straddle every `min()` branch point (50/90/120/200 ms); worst deviation
      6.9e-18 s. ⚠️ Those three are TIME SCALINGS, not measured speaking rates — `docs/research/`
      carries no speaking-rate or phoneme-duration figure, and one has to be measured before any
      claim of the form "three real speaking rates" can be made.
- [ ] **4.3** `voice/Speech.js` — HeadTTS (Kokoro-82M ONNX in-browser) returning words, times,
      visemes, phonemes. Fallback: Azure 60 fps ARKit blendshapes. **The one Phase 4 item still
      open**; it needs a TTS engine, which nothing else here does.
- [x] **4.4** ⚠️ **Schedule visemes AHEAD of audio.** 40 ms, DERIVED as the midpoint of
      ITU-R BT.1359-1's asymmetric undetectable window — (125 − 45)/2 — which leaves 85 ms of margin
      to each edge rather than being picked. Gate: the LEAD section, 5 checks, including "the mouth
      at t equals the un-led mouth at t + lead" over 1201 instants.
- [x] **4.5** `voice/Prosody.js` — `AudioWorkletNode` (not `AnalyserNode`), RMS + F0 mean/SD,
      clarity-gated, normalised per voice. Gate: `prosody.selftest.mjs`, 26 checks, plus execution
      in a real browser `OfflineAudioContext` (220 Hz sawtooth detected at 219.94 Hz, −0.48 cents,
      179/179 frames voiced). ⚠️ **pitchy is NOT vendored and never was** — `ls node_modules` and
      `package.json` both return nothing for it, and the only dependency this repo has is
      `three@^0.185.1`. The McLeod Pitch Method is implemented in-repo at `voice/Pitch.js` per the
      standing build-rather-than-depend preference; accuracy is under 1 cent across 80–380 Hz.
      Decimating 4× to 12 kHz first is a MEASUREMENT, not a preference: full-rate NSDF over a window
      long enough for a 70 Hz floor costs 13.25% of one core on the audio thread, the shipped path
      1.06%.

## Phase 5 — Affect

🎯 **5.1, 5.2, 5.4 and 5.5 are DONE**, and the affect half of **6.2** landed with them. Gate for all
five: `packages/core/src/affect/affect.selftest.mjs`, **114 checks** (measured at R10; this line
said 112, and the commit that added the posture section said 114 in its own message), every constant re-derived
in-process rather than compared to a literal, and **18 rejection proofs** — all **13** declared
defect modes across `AffectState`, `ExpressionMap` and `PostureLayer`, plus four structural
known-bads that are configurations rather than flags. Browsercheck:
`packages/testbed/src/affect.html`, which drives the real figure rather than a fixture.

🚩 **AND A BLOCKER THAT LIVED THROUGH THE WHOLE OF PHASE 5 BECAUSE NOTHING MEASURED A BONE BELOW THE
NECK.** `ExpressionMap.body()` computed a BAP prescription every frame from 5.4 onward and the only
readers in the tree were a HUD string and a `readout()` object.
**Measured by the R9 verifier** on eight portrait plates at `alive.html?bare&affect=<preset>&seed=1`,
900×1200 dpr 1, 90 steps at 30 fps, **shipped defaults (aa=taau + grade + RCAS, MSAA OFF)**,
differenced against neutral at Δ>2/255: the face band changed **18.28–43.97%** of its pixels and the
**torso band (rows 800–1200) changed 0.00% for joy, anger, fear, sadness and surprise** and 1.99%
for disgust and bored.
**Reproduced independently at the mechanism level** through a real `MotionStack` over
`figure_g050.glb`: `ExpressionLayer` declares **0 bone channels**, and across all seven non-neutral
presets **0 of 20 body bones** moved by more than 0.000000 mm against neutral, while the
prescriptions read anger `approach 0.947 / armSpread −0.807 / illustrative 0.425`, fear
`approach −0.705 / kneeActivation 0.855`, joy `armSpread 0.565 / headTiltUp 1.000`.
R5 asks for the full range of emotion as a full-body avatar and the avatar emoted from the eyebrows
up. `affect/PostureLayer.js` is the actuator; `?affectbody=0` is the A side that keeps the claim
attributable.

- [x] **5.1** `affect/AffectState.js` — PAD + asymmetric smoothing (attack 150–250 ms, decay
      1.5–3 s) + slow mood layer (10 min change, 20 min return).
      ✅ MEASURED. Attack **0.200 s** and decay **2.25 s**, both midpoints of research §8.3's bands
      and both MEASURED OFF THE TRAJECTORY at 0.200000 s and 2.250000 s — the declared constant, not
      merely a value inside the band. Mood reaches full scale at **300.000 s** and returns at
      **600.000 s**, which is ALMA's 600 s change and 1200 s return over a half-span. 30/60/120 Hz
      agree to **6.693e-14**, proved red by three structurally different couplings. Decay/attack
      asymmetry **11.25×**; fast:slow separation **298:1** at one second, which is what entitles a
      wardrobe or an identity note to read mood and forbids it reading `pad`.
- [x] **5.2** `affect/ReflexAffect.js` — Tier 1, < 1 ms. VADER (MIT) for valence; arousal from
      prosody (loudness dominates, +365% for anger).
      ✅ MEASURED. Median **0.00187 ms**, **p99 0.01417 ms** over 20,000 calls on a 16-word
      utterance. Agrees with the 35B on the SIGN of pleasure for all three utterances the LM Studio
      doc measured, and reproduces its sadness-below-anger dominance ordering. Loudness dominates
      arousal by **9.60×**, which is the GeMAPS table's own ratio re-derived in the gate.
      ✅ **THE LICENCE IS RESOLVED.** NRC-VAD and Warriner are both excluded and ABSENT from the
      tree; VADER's rule layer is implemented from its published description and its lexicon FILE is
      not vendored; the shipped **217-entry** word list is AUTHORED IN THIS REPOSITORY and no
      accuracy claim is made for it anywhere. `ReflexAffect.loadLexicon()` swaps a real file in.
      See `affect/SeedLexicon.js`.
- [ ] **5.3** `affect/AppraisalAffect.js` — Tier 2 LM Studio client. ⚠️ Read
      `research/lm-studio-integration.md` first: schema output arrives in `reasoning_content`,
      thinking cannot be disabled, degenerate vectors must be rejected semantically.
      ⚠️ It also removes an open question 5.2 could not close: dominance is STICKY between
      utterances at tier 1, because an utterance with sentiment and no stance is no evidence either
      way. Tier 2 returns all three axes every turn.
- [x] **5.4** `affect/ExpressionMap.js` — **WASABI threshold-and-saturate** RBF over PAD, never
      proximity-blend. Arellano piecewise AU activation functions. ALMA OCC→PAD anchors.
      ✅ MEASURED. Dominance weight **0.50**, PHI **0.645**, DELTA **0.35**, all three DERIVED
      against ALMA's own 24 OCC vectors rather than picked — 0.50 is the smallest weight whose
      feasible PHI window is at least 0.10 wide and 0.645 is that window's midpoint; DELTA is half
      the measured minimum anchor separation and the gate re-derives it from the geometry. At most
      **2** emotions active and at most **1** saturated over a 41³ grid. Proximity blending is
      proved red at 32 simultaneous emotions.
      🚩 **research §1's WASABI angry anchor was DEGENERATE, not merely wrong.** At the transcribed
      (80,80,100) it sits **0.0000** from one of happy's four, so anger and joy fire together at
      equal weight at every point in the cube. Shipped at (−80,80,100). LEARNINGS §1.25u.
      ⚠️ Four of Arellano's AU activation functions are functions of DOMINANCE, in the same paper
      the "dominance never goes to the face" constraint comes from. The constraint won; those four
      AUs are supplied from the discrete emotion LABEL instead. If a reviewer prefers the other
      resolution it turns on `EMOTION_AU_SETS` and the `emotion` half of `AU_MORPHS`.
- [x] **5.5** ⚠️ **Reserve the mouth for lipsync.** Emotion → brow/eye/cheek; mouth gets only an
      additive AU12/AU15 corner offset over the viseme.
      ✅ MEASURED on the real figure with a live viseme underneath: `viseme_aa`
      **0.600000000 → 0.600000000**, difference **0.00e+0**, while the corner offset arrives capped.
      Enforcement is the DECLARATION rather than a runtime check — the layer declares 4 of ARKit's
      23 mouth shapes, 0 of 4 jaw shapes and 0 of 15 visemes, and writing any other one THROWS.
      Confirmed live in a browser across a second of speech: visemes to 0.60, smile held at exactly
      **0.3500** on all 25 samples.
- [ ] **5.6** `ear/Mic.js` — capture, VAD, listening posture, backchannel nods, gaze shift.
- [ ] **5.7** Gate: **CRITIC** — full emotional range legible blind; disgust exempt from the body
      gate (no posture reaches 50% recognition; it is face-only).
      🚩 **THIS GATE WAS UNREACHABLE UNTIL 2026-08-09 AND THE REASON WAS NOT THE FACE.** A critic
      asked whether the full range reads would have been shown seven plates whose BODIES were
      bit-identical for five of them. `affect/PostureLayer.js` closed that; see 6.2 for the measured
      per-preset displacements and for the four channels still outstanding. **Capture the critic
      plates at `?frame=body`** — a portrait crop cannot show a 14° trunk lean or a 334 mm hand
      span, and every affect plate this project has captured so far was a portrait.
      ⚠️ **EXPECT THIS TO PUSH BACK, AND THE TWO CAUSES ARE ALREADY MEASURED.** The four portrait
      plates in `captures/affect-phase5/` are measurably distinct — joy vs anger changes **19.87%**
      of the face-band pixels, closest emotion pair 0.2553 RMS over 19 committed influences — and
      they read UNDER-DRIVEN: joy reads *pleasant*, anger reads *displeased*. Neither cause is the
      mapping. (a) `MAX_CORNER_OFFSET` 0.35 delivers **6.54 mm of `mouthSmileLeft`'s 18.68 mm**
      authored travel; `MAX_CORNER_OFFSET_SILENT` and `VisemeLayer`'s published `shared.speaking`
      landed this round so a caller can raise the cap when nothing is speaking, and nothing yet
      ramps between them.
      🚩 **THE RAMP IS THIS ITEM'S WORK, converted here from ledger REQ-034's neighbour REQ-032, and
      the reason it is not a one-line diff is a MISSING CONSTANT.** `ExpressionLayer` clamps
      unconditionally to `MAX_CORNER_OFFSET`; reading `context.shared.speaking` and ramping between
      0.35 and 1.0 is four lines. The ramp TIME is not four lines: `MAX_CORNER_OFFSET_SILENT` is 1.0
      against 0.35, so a hard switch pops the smile **12.14 mm** the instant speech starts, and the
      only quantity anywhere near it is a viseme onset at ~40–80 ms — a range, from a different
      mechanism, that nobody has measured against this face. Rule 1 of every fan-out prompt is that
      a number is not invented; putting an unmeasured time constant on the mouth would be inventing
      one, in the most visible place on the figure. So the ramp lands with the critic plates this
      item already asks for, and the constant comes off them. (b) The ARKit brow shapes on
      `figure_g050` travel only **6.95 mm**
      (`browDown`) and 5.20 mm (`browInnerUp`) at weight 1, against 18.68 mm for the smile and
      38.74 mm for `jawOpen`. (b) is LEARNINGS §1.11c and belongs to the figure pipeline.
      ⚠️ Also expect a note on the eyes: Arellano's AU43 is 1.0 below arousal −0.6, so `bored`
      renders with the lids fully closed. That is the published function implemented verbatim, not
      a bug; if it wants a cap, the cap belongs to whoever owns lid aperture.
      ⚠️ Seven AUs from Arellano's table are unreachable, every one because of a constraint rather
      than an oversight: AU10 is both pure dominance and a mouth shape; AU25 and AU26 are pure
      arousal and are computed and returned in `speechOwned` precisely so it is visible they were
      computed and deliberately not written; AU23 has no ARKit shape at all. The visible
      consequence is that a surprised face cannot drop its jaw and an angry one cannot tighten its
      lips.

## Phase 6 — Body motion

- [ ] **6.1** `motion/MotionStack.js` — layered blend. Bone masking by **filtering `clip.tracks`**
      (three.js normalises per-bone; the `_propertyBindings` hack will break).
- [ ] **6.2** `motion/Posture.js` — BAP loadings: anger forward-lean +1.96 / fear backward +1.46 /
      joy broad symmetric arms + head up / sadness arms drawn in. **This is where dominance
      becomes visible.**
      🎯 **THE AFFECT HALF IS BUILT AND GATED — `packages/core/src/affect/PostureLayer.js`**, at
      `MOTION_ORDER.POSTURE`, driving three of `body()`'s nine channels. Full scales are DERIVED
      from Coulson Table 1 by one rule the gate re-runs — the smallest non-zero magnitude in the
      column that codes the channel — giving **approach 20° (chest bend), armSpread 50° (shoulder
      ad/abduct), headTiltUp 20° (head bend)**, scaled by the BAP loading and again by the
      activation weight. Signs are **measured on the rig at bind**, not transcribed, because
      research §3 records three sign problems in the published paper and Coulson's own shoulder
      convention contradicts his verbal summary. Measured on `figure_g050` in `relaxed-standing`,
      per preset, worst world displacement of 20 body bones against neutral:
      **anger 139.6 mm** (trunk +14.20°, head 133.7 mm forward, arms clamped to vertical),
      **joy 175.3 mm** (arms +21.20°, head +15.00°, hand span +333.9 mm),
      **surprise 148.6 mm**, **sadness 99.0 mm**, **disgust 86.3 mm**, **fear 34.7 mm**
      (trunk −3.53°, head 34.4 mm back), **bored 0.0 mm**.
      🎯 Anger and fear are identical in pleasure and arousal and opposite in dominance, and their
      trunks now go opposite ways — the axis the face may not carry, visible in the body and
      nowhere else.
      ⚠️ **WHAT IS STILL 6.2's, AND WHY EACH ONE WAS LEFT.**
      (a) `kneeActivation` — fear's largest loading at 1.77. A knee bend that does not also lower
      the pelvis is a figure on stilts; doing it right is **6.5**'s analytic two-bone solve plus a
      pelvis offset plus a foot re-plant.
      (b) The **whole-body** half of `approach`. What ships is the trunk hinging at the lumbar,
      which is a joint rotation Coulson gives in degrees. BAP's "forward whole-body movement" is
      also a centre-of-pressure travel, and `Sway` already owns the pelvis, the legs, the feet and
      the footprint clamp that keeps them standable — a second ankle pendulum in `affect/` would be
      a duplicate model that cannot see the first one's clamp. Filed against `Sway` as a request.
      (c) `bored` has **no** BAP row, so its body is neutral by construction. Dael reports no factor
      for boredom. The evidence a row would be derived from is Wallbott's expansiveness scale, where
      boredom sits at **1.00**, the floor, tied with disgust and below sadness's 1.06 — but that is
      a second literature on a different scale and bridging them is a modelling decision, not a
      transcription.
      (d) `sadness` gets only `armSpread`, which saturates the measured adduction budget at ~10°.
      Three independent sources say sadness drops the HEAD — Coulson Table 1 (head bend 25/50, and
      his summary calls it "the only emotion with forward head bend"), and Melzer's head-drop odds
      ratio of **7.60**, the strongest single marker in that study. BAP simply has no head factor
      for sadness above its reporting threshold. A `headTiltUp` row for `sad` is the best-supported
      extension available and it is a derivation rather than a transcription, so it is 6.2's call.
      ⚠️ The `disgust` preset carries a third of annoyance's forward lean, because its PAD point
      co-activates `annoyed` at 0.38. That is the map being honest about where disgust sits in PAD;
      5.7 exempts disgust from the body gate for the reason research §3 gives — no disgust posture
      reaches 50% recognition from any viewpoint.
- [ ] **6.3** `motion/Gesture.js` — BEAT rules. **Stroke onset 0–200 ms BEFORE the stressed
      syllable, never after**; ~380 ms stroke; preparation starts 400–600 ms early. 9–26/min.
- [ ] **6.4** Expressivity: spend the budget on **Spatial Extent and Temporal Extent** — the other
      four GRETA parameters don't read (43.1% discrimination).
- [ ] **6.5** IK — analytic two-bone per limb + constrained CCD/FABRIK spine + look-at.
      `CCDIKSolver.blendFactor` to blend against an animated pose. ⚠️ `iteration` defaults to 1.
- [ ] **6.6** `physics/SpringBones.js` — VRM algorithm **plus a fixed 60 Hz timestep** (three-vrm
      has none, so it's framerate-dependent by construction) **plus depth-distribution curves**.
      Start `stiffness 0.75 / drag 0.05 / gravity 0`. Support `center`.
- [ ] **6.7** Collider pruning — VRoid ships 460–1362 checks/frame, past VRChat's "Poor" tier.
- [ ] **6.8** Soft-tissue jiggle. Hair drag 0.4 (over-damped drape) vs tissue 0.05 (fast ring).

## Phase 7 — Runtime API and testbed

- [ ] **7.1** `Avatar.js` — `create({canvas, identity, quality})`, `say()`, `feel()`, `listen()`.
- [ ] **7.2** Quality tiers auto-selected from measured frame budget.
- [ ] **7.3** Testbed wired to LM Studio for live conversation.
- [ ] **7.4** Identity configuration UI — the AI dials its own body.
- [ ] **7.5** README + embedding example. Gate: an agent embeds it in one call.

## Phase 8 — Blind critic loops

- [ ] **8.1** Loop: render vs AAA reference until same-tier, **all seven** measured gates green.
      **FIVE OF SEVEN GREEN as of 2026-08-08 at HEAD `2ec7db9`** — `alive.html?bare&freeze&seed=1&capture`
      at 3840×5120 dpr 1, portrait regions, **60 steps at 60 fps**, TAAU 0.66 + grade + RCAS 1.2,
      **MSAA off**. **Three loads, three different `packagesDigest`s, ONE PNG** (`257caca2782adde9`),
      so these are values and not draws:
      G1 **1.6630** PASS · G2 **0.9197 FAIL** · G3 PASS · G4 **1.6262** PASS ·
      G5 **0.000002** PASS · G6 **0.00001 FAIL** · G7 **0.00069** PASS.
      ⚠️ **G2 is MARGINAL, and the red is still not a rendering finding on its own** — and now for a
      better reason than before. It misses the 0.92 floor by 0.0003 while the A side clears it by
      0.0021, and the same page at 900 px instead of 3840 moves it by 0.0028: **more than either
      margin, on a difference that has nothing to do with the eye.** The load-to-load spread is now
      exactly zero and the disagreement survived it, so another load cannot settle this. **What
      would settle it:** widen the sclera rect, or restate G2 on a plate whose sclera the rect
      cannot leave.
      🚩 **THIS LINE USED TO READ "SIX OF SEVEN GREEN … G2 0.9201 PASS" AND IT IS THE HEADLINE THE
      WHOLE PHASE IS QUOTED BY.** `0.9201` is 0.0001 above the floor, it was a single draw from a
      then-stochastic plate, it did not recur in 14 draws at `1985425`, and now that the plate is
      deterministic the recipe it names returns 0.9197. MARGINAL is the required word,
      `docs/measured-claims.selftest.mjs` is the gate, and its **PLATES** rule now holds every
      number in this roster to a named sha256 rather than to a range.
      **The A side is what a claim of soundness rests on, and it got stronger this round.**
      `?aa=msaa&grade=0` reads G1 **1.6180** · G2 **0.9221** · G4 **1.7469** · G5 **0.000002** ·
      G6 **0.00001** · G7 **0.000742** — **six of seven** — over two loads at two more digests, and
      its plate is byte-for-byte the one recorded at HEAD `1985425`. Two builds, one picture: the
      forward path did not move, so the default's numbers moving is about the temporal-plus-grade
      path and nothing else.
      🎯 **Body framing IS re-measured this round** — see the body table at the top of this file.
      G6 **0.0126** reproduces exactly; G1 reads **1.5869** against the 1.5822 carried over, Δ0.0047,
      still inside the band. Body-framing **G4 is not reportable at 900 px** and nothing should quote
      it until a 3840-wide body region file exists.
      **G6 stays UNDECIDED, not failed**: `?cards=0` reads **0.00393 at both 3840 and 900 px** — the
      backdrop card's own level, a rig parameter — while the shipped reading moves 0.00001 → 0.00309
      across the same two widths. The gate is counting lash texels, and a `frame` region does not
      close it.
      ⚠️ Historical, kept so the pattern is visible: an earlier revision of this line read
      G1 1.5783, G2 0.8127 FAIL, G3 −0.0744 FAIL, G4 1.6468, G6 0.00001 FAIL, measured at 900 px
      through a `?capture` that then ignored `?freeze`. Three of those four reds were artefacts of
      how the plate was taken. **That is the same failure as the 0.9201 one with the sign flipped** —
      a recipe defect reported as a render verdict — and it is why the recipe, the width, the step
      count, the load count and the margin all have to travel with the number.
      🚩 Seven green measured gates is the entry condition for a blind comparison, not a pass of one.
- [ ] **8.2** Loop: emote vs Live2D/VTuber until decisive win. Body clips come from
      `capture.mjs --postural-seeds`; a verdict taken on one draw is a verdict about the draw.
- [ ] **8.3** 60 fps at target resolution on this hardware, verified with a profiler.
- [ ] **8.4** Cross-browser: Chrome/Safari WebGPU, Firefox WebGL2 tier.

---

## Phase 9 — Wardrobe

Clothing is not decoration on this system, it is half of how an identity presents. The brief asks
for the level of current VTuber/Live2D work (R2), where outfit variants are definitional, and for
an avatar that represents the AI's own identity (R8). A figure that can be male, female or anywhere
between, and is permanently naked, satisfies neither.

**WE AUTHOR OUR OWN GARMENTS.** Direct VTuber/Booth imports read cartoon-like against a photoreal
figure, and the Fab licence forbids the use outright — §6(b)(iii) names "modeling tools that allow
works to be exported" almost verbatim, §4(c) requires end users be restricted from extracting
Content, and every listing sampled from the reference seller carries `isAiForbidden: true`. Both
Fab price tiers grant identical rights, so there is no tier that buys this. Reference imagery
informs parameters; no third-party asset is ever bundled. Same posture as
`research/stellar-blade-look-spec.md` takes with the face.

Full measurements, sources and the evidence behind every number below live in
[`research/wardrobe-system.md`](research/wardrobe-system.md).

### The plumbing

- [x] **9.1** `wardrobe/GarmentManifest.js` + `assets/wardrobe/manifest.json` — per garment: `id`,
      `layer`, `hideMask`, `alphaMode`, `clo` (ASHRAE 55 Table 5.2.2.2B), `fabric` (the taxonomy
      key), `formality` (authored 1–5), `palette`. 🚩 **`z_depth` from the mhclo is INERT and must
      not be trusted** — an exhaustive grep of MPFB finds four write sites and no consumer, and the
      shipped values put shoes (5) *under* suits (50). Layer order is ours to define.
      Gate: **MEASURED** — a selftest asserts every entry validates, that `layer` is a total order,
      and that two garments claiming the same layer are rejected rather than silently
      interpenetrating. Proven red by two suits at z_depth 50, which MPFB attaches today without a
      warning.
- [x] **9.2** `tools/figure-pipeline/build_figure.py` gains `--garment` and
      `--hide-mask-attribute`. Body hiding moves from a baked MASK modifier to a per-vertex
      `_HIDE_*` attribute, because `delete_verts` permanently removes geometry and an avatar whose
      torso has been deleted cannot undress.
      🚩 **`export_attributes` defaults OFF in Blender's glTF exporter and the build reports
      success without it** — the attribute vanishes silently. 🚩 **The exporter upper-cases the
      name**: authored `_hide_x`, exported `_HIDE_X`. Match case-insensitively.
      Gate: **MEASURED** — the runtime index rebuild reproduces the baked triangle count exactly.
      Proven: 17,012 = 17,012 for suit+shoes, 21,380 = 21,380 for suit alone, at **0.1609 ms**
      median over 30 runs.
- [x] **9.3** `wardrobe/Wardrobe.js` — `dress(garmentIds)` / `undress()`. Loads garment fragments on
      demand, rebuilds the body index buffer from the union of hide masks, adds and removes garment
      `SkinnedMesh`es against the figure's existing skeleton.
      Gate: **MEASURED** — dress → undress → dress returns the body to **26,756 triangles** with no
      drift, and the dress step stays under **1 ms** against the 0.1609 ms measured for the rebuild
      alone. **AND the decency invariant of 9.8 holds at every intermediate state**, not only at
      the endpoints — a half-applied outfit is a state a user will see.
- [ ] **9.4** Per-figure garment bakes. 🚩 **One garment fragment CANNOT serve all five figures.**
      ✅ **9.8's garments are EXEMPT from this blocker, which is why 9.8 shipped first.** A shell cut
      from the basemesh AT an identity has no fitting step and therefore nothing to drift; re-running
      `build_figure.py --foundation --gender <g>` produces a correctly fitted set. This item is about
      mhclo garments only.
      `female_casualsuit01` drifts **mean 95.145 mm / max 143.066 mm** between g000 and g100 — 90%
      of the body's own 105.614 mm — because `fit_clothes_to_human` re-solves every vertex
      barycentrically against the current basemesh. Cross-fitting g000's suit onto the g100 body
      puts **390 of 462 covered skin vertices (84.4%) outside the cloth, median 42.14 mm proud.**
      Textures are shared across the five; only positions differ.
      Gate: **MEASURED** — for all five figures, covered skin outside the cloth at rest no worse
      than the g050 baseline of **26.37%**, worst depth no worse than **9.19 mm**.
- [x] **9.5** `tools/figure-pipeline/verify_glb.mjs` gains a garment clause. It currently **FAILS a
      clothed figure by construction** — `OPAQUE_MATERIAL_PARTS` is a five-regex whitelist and a
      garment matches nothing, so `suit_g050` reports 1 problem and `layered_g050` reports 3 while
      every eye, lip-seal and morph assertion stays green. The clause must read `alphaMode` from
      the manifest per garment, not from a regex: a wool coat is OPAQUE, a mesh panel is MASK.
      Gate: **MEASURED** — passes a clothed figure; proven red by a manifest declaring OPAQUE for a
      cutout garment.

### ✅ 9.1, 9.2, 9.3 and 9.5 are DONE, and what the gates actually measured

`node packages/core/src/wardrobe/wardrobe.selftest.mjs` — **45 assertions** (re-derived 2026-08-09;
this line said 35 and it was already 45 before that round began — the file grew when the winding and
UV-seam-twin reds landed and the count in prose did not move with it);
`node tools/figure-pipeline/verify_glb.mjs` — **PASS, 14 files** (five figures, the wardrobe body,
and **eight** fragments — the four CC0 garments plus 9.8's four foundation garments, picked up with
no change to the tool because `wardrobeTargets` globs `assets/wardrobe/*/`), where a clothed figure
used to fail by construction.

- **The runtime rebuild equals the baked build EXACTLY, and not only in count.** 17,012 = 17,012
  for suit + shoes, 21,380 = 21,380 for the suit alone, 26,756 undressed — and identical as a
  **multiset of triangle centroids at 1 µm**, so a mask flagging the wrong vertices in the right
  quantity cannot pass. 🚩 The selftest SEARCHES for such a corruption, finds one, and shows the
  count clause green on it while the centroid clause is red. That is "a triangle count is a
  decorative gate" demonstrated rather than argued.
- **Dress step: 0.1663 ms median** over 30 runs in node (min 0.0826, max 0.2346), against research
  §2.4's 0.1609 ms for the rebuild alone; **0.20 ms** in the browser, where Chrome clamps
  `performance.now` to 100 µs and the node figure is therefore the finer one. Well under the 1 ms
  the gate asks for.
- **A dressed figure draws FEWER triangles than a naked one** — 17,012 body + 8,800 garment =
  25,812 against 26,756 nude — exactly as research §1.1 predicted, because `delete_verts` removes
  more body than the garment adds. Four draw calls.
- **9.8's hook is real today.** `#resolveOutfit` is the single funnel and `dress`, `undress`,
  `putOn` and `takeOff` all pass through it; `undress()` is already "return to the floor". Proven
  with a stand-in floor since 9.8's garments do not exist. Intermediate states are covered
  structurally rather than by timing: `dress()` awaits every fragment BEFORE mutating anything and
  then applies the whole outfit in one synchronous block, so no frame can observe a half-applied
  outfit.
- 🎯 **WIRED ONTO `alive.html`, the page every judge captures**, as `?wear=female_casualsuit01,
  shoes01,fedora01` and `window.sugata.wardrobe`. Opt-in by construction: with no `?wear` the
  module is never imported and no manifest is fetched, and the shipped default's sha256 is
  unchanged across three loads spanning the wardrobe landing. **Both frame paths were checked, per
  LEARNINGS §1.24** — on the forward MSAA path a dressed frozen plate is **byte-identical**
  (`9e315115…`) taken through rAF and through 60 × `__SUGATA_STEP__`, and the capture epoch pin
  holds with garments on: `frameId` 60 exactly, `time` 1.0000000000000013, `jitterIndex` 29.

⚠️ **9.1's rule as BUILT is "two garments may not share a layer AND a body slot"**, not the
unqualified "may not share a layer" the item asks for — the unqualified form makes a shirt and
trousers illegal while a one-piece suit has no honest answer to a BASE_TOP/BASE_BOTTOM split. The
rejection the gate asks for still happens on the garments it asks about: two suits at one layer are
refused, naming all four colliding slots.

⚠️ **`assets/wardrobe/body/g050.glb` is deliberately a SEPARATE artefact from
`assets/figures/figure_g050.glb` this round.** Merging them is the right end state, but the
`_HIDE_*` attributes cost 174,708 bytes and — the reason it waits — change that file's sha256,
which several committed gates are measured against. That merge belongs in the same round as the
re-measurement. The nude control still emits sha256 `b56115d0cb52…`, byte-identical to the
committed figure, after every `build_figure.py` edit.

🚩 **THE COLD PATH IS BAD AND 9.6 IS THE FIX.** Fetching three fragments took ~18 s over the dev
server: **18.9 MB, of which 18.6 MB is PNG**, and the fedora fragment alone is 7,638,760 bytes —
bigger than the shoes, for a hat. Textures at 81–87% of the payload is research §3.4's headline
measured on our own artefacts. KTX2/Basis is not optional for a wardrobe of any size.
- [ ] **9.6** KTX2/Basis for every garment texture via `KHR_texture_basisu` + `KTX2Loader`.
      🚩 **The phase's binding constraint, and the only major unmeasured number in the research.**
      Textures are **81% of a one-garment GLB and 87% of a three-garment one**; the CC0 set carries
      **122 MB of PNG**, and a 4096² RGBA8 normal is **≈85 MB of VRAM with mips** — arithmetic, not
      measurement, because no transcoder was on the machine and the agent declined to guess.
      Gate: **MEASURED** — real transcode ratio and VRAM residency, a ten-garment catalogue held
      under a stated budget, and a measurement of whether 2048² is distinguishable from 4096² at
      portrait framing before we pay for the larger one.
- [ ] **9.7** 🚩 Recover the discarded AO. Every CC0 garment mhmat declares `aomapTexture`
      (0.7–2.2 MB, 2048²) and **none of it reaches the GLB** — `NodeWrapperGameEngine` wires only
      diffuse → Base Color, diffuse alpha → Alpha, normal → Normal Map. There is no occlusion node
      in MPFB's game-engine material at all. Item 3.10 exists because un-occluded ambient specular
      is the plastic look, and we are discarding hand-baked AO for free.
      Gate: **MEASURED** — `occlusionTexture` present on every garment material in the built GLB,
      and a rendered on/off difference measured **in the folds**, not asserted.

### What the avatar wears

- [x] **9.8** 🎯 **The foundation layer, and it is a correctness requirement rather than a style
      choice.** The mix-and-match screen (9.12) lets a user remove a top; `undress()` exists;
      outfit changes pass through intermediate states. In every one of those the avatar must be
      decent. **There is no reference for this anywhere in the 638 supplied images — we author
      blind**, which makes it the one garment in the phase with no target to measure against.
      Author a bra, briefs, a boxer brief and a vest, at `layer: FOUNDATION` below every other
      layer, with no hide mask of their own so nothing can remove them.
      ⚠️ Keep them plain and unremarkable. This is the layer where "AAA quality" means *unnoticed*.
      Gate: **MEASURED** — an exhaustive sweep asserts that for every reachable wardrobe state,
      including every intermediate frame of a change and the empty set, the union of covered skin
      regions includes the foundation regions. A body with no garments at all must still render
      the foundation layer. Proven red by removing one foundation piece from the manifest.

      ✅ **MEASURED.** `node packages/core/src/wardrobe/decency.selftest.mjs` — **25 assertions**
      (it read 20 until R9; the five it gained are all about the SAMPLER rather than about cloth).
      48 reachable states swept exhaustively (4 foundation preferences × 16 outer subsets; 16 more
      refused by the conflict rule), plus the empty set, plus `takeOff` of every worn garment in
      turn, plus **165 samples taken at every point the event loop can yield during 6 outfit
      changes** — and an assertion that no change contributed ZERO of them.
      Coverage is a **RAY CAST** from each of 186 `_DECENCY_*` body vertices into the geometry
      actually drawn at `drawRange`, not from the build's own region sets.
      🚩 **The sampler was hooked to the fragment LOADER and the one transition this gate exists for
      was sampled zero times.** A change whose fragments are all cached loads nothing, so the strip
      back to the floor contributed no samples while the gate's own message counted it as covered.
      Hooked to the YIELD instead, all six changes are observed (53/53/26/26/4/3), and a burst of 8
      is measured to have saturated — doubling it observes a cached change no more times.
      🚩 **The garments are NOT mhclo assets.** `build_figure.py --foundation` cuts each one from
      the figure's own skin as a conformal shell at 3 mm, tapered to 0.8 mm at the hem, relaxed and
      reprojected — 0.48–4.20 mm clearance, **0 vertices through the body**, and **ZERO texture
      bytes** across four fragments. ⚠️ Only g050 is built; the shell has no fitting step, so
      another identity is one re-run of the build command.
      Proven red **six ways in three mechanisms**. *Bookkeeping — the wrong garments are worn:* a
      piece removed from the manifest, and the floor emptied. *Geometry — the right garments are
      worn and the skin is still visible:* a garment **TRIMMED AT THE GUSSET** (manifest, floor and
      worn set all identical — only the ray cast sees it), and an outer garment that occludes the
      foundation but no longer hides the skin. *Coverage — the measurement is correct and is looking
      at nothing:* the mid-change sampler hooked to the fragment loader, and the same sampler woken
      only on macrotasks. Each of the last two leaves **2 of 6** changes unobserved — a different
      cause and the same silent zero — and that third mechanism is the one this item did not have.
      🚩 **A mechanism this item did not anticipate, recorded so a later reader does not read it as
      a violation of "nothing can remove them".** A foundation garment that hides nothing still has
      to be WEARABLE UNDER something, and a conformal shell 3 mm off skin pokes through
      `female_casualsuit01` everywhere the skin would — 9.4's own 26.37% / 9.19 mm baseline. The
      resolution is `_UNDER_<id>` attributes, a rename of the body's own `_hide_<id>`, which stop
      part of a foundation garment being **DRAWN** without ever removing it from `worn`: the vest
      goes 25,024 → 4,476 drawn triangles under the casual suit, **82.1% occluded, still worn**,
      and `occlusionOf()` names the occluder. ⚠️ That invariant is structural today — an `_under_`
      attribute cannot exist without the matching `_hide_` — and anything that ever writes one by
      another route breaks it silently.
      ⚠️ **Authored blind and no judge has seen it.** Every fraction in `FOUNDATION_GARMENTS` is a
      design decision with no reference behind it, and this project has measured nine rounds of the
      builder not reliably perceiving its own visual coherence. Point a harsh critic at
      `packages/testbed/src/wardrobe.html` and ask whether the layer goes **unnoticed**, which is
      the actual standard.
      ⚠️ **A triangle trade was made deliberately and is reversible in one character.**
      `FOUNDATION_HEM_REFINEMENTS = 2` puts bra + briefs at 14,028 triangles always resident on a
      26,756-triangle body — a 52% add in the nude state, collapsing to near zero under any opaque
      outer garment (briefs measure 0 of 4,960 drawn under the casual suit). At refinement 1 they
      are 4,504 and 2,440 and the hems step visibly at the scale of a base-mesh quad.
- [ ] **9.9** The shipping capsule — **14 authored blocks yielding 22 wearable garments and 1,368
      outfits** across two rails, chosen from 638 reference renders for combinability rather than
      for individual appeal. Six pieces are shared because they read at both ends of the identity
      axis, which is what lets ten slots per rail buy three lower-body options instead of one.
      *Shared:* straight jeans · tee sheet (5) · ribbed roll-neck · zip hoodie · Chelsea boots ·
      sneaker sheet (5). *Men's:* tan chinos · sand work shirt · camel wool overcoat · worsted
      trousers. *Women's:* white cotton shirt · high-waist wide-leg trousers · knit midi dress ·
      belted trench.
      Build order, argued in the research: crew tee as a one-day pipeline smoke test → **jeans as
      the real first garment** (five-pocket construction is the honest test: yoke, fly, welt
      pockets, belt loops, topstitch following seams, instanced hardware, and three orthographic
      views so any failure is a pipeline failure rather than a reference failure) → zip hoodie, to
      author the zip once and pay for the trench, puffer and every zipped piece after → roll-neck →
      sneakers earlier than instinct suggests → camel overcoat last, because the lapel roll decides
      whether tailoring is affordable at all.
      🚩 Two fabric families are missing from the capsule and both are cheap to add: **technical
      nylon**, the only family with real specular sheen and stiff rustle, and **leather as a
      garment** rather than as footwear. One puffer and one café racer take coverage from ten
      families to twelve.
      Gate: **MEASURED** per garment via 9.4's fit thresholds, plus **CRITIC** on the capsule as a
      wardrobe: a judge picks three outfits at random from the free-mix rail and none may read as
      an error.
- [ ] **9.10** 🎯 **Cultural and religious everyday dress.** The 638 reference images contain
      **nothing outside a Western wardrobe** — no hijab, sari, kurta, abaya, hanbok, or anything
      else. For a system whose entire premise is an AI choosing how to represent itself, a wardrobe
      that can only represent one culture is a limitation of the product, not of the art budget.
      This needs a deliberate sourcing pass and, for garments whose correct drape and wearing are
      not obvious from a photograph, real reference on how they are actually worn — a sari's pleat
      and pallu are a wrapping procedure, not a shape.
      ⚠️ Several of these are religious articles. Get the construction right or leave the garment
      out; a badly-made hijab is worse than none.
      🚩 This item also carries the technique the Western capsule never exercises: **wrapped and
      draped garments have no fixed pattern**, so they are a simulation problem rather than a
      panel-sewing one, and they will not come out of 9.17's pipeline.
      Gate: **MEASURED** per 9.4, plus **CRITIC** — and the critic for this item must be briefed
      to judge whether the garment is *correctly worn*, not merely whether it renders.

### Choosing what to wear

- [ ] **9.11** `wardrobe/Dresser.js` — `{PAD, temperature, formality, timeOfDay} → outfit`.
      The seasonal half is derived and cited: **Schiavon & Lee (2013) Equation 3**, adopted into
      ASHRAE 55 Fig 5.2.2.2 from **6,333 field observations**, gives target clo from the 06:00
      outdoor temperature; Table 5.2.2.2B gives additive per-garment clo. Colour brightness and
      saturation from Valdez & Mehrabian (1994), 🚩 **with the arousal-brightness coefficient
      FLIPPED POSITIVE** — Wilms & Oberfeld (2018) measured brightness *raising* arousal at
      ηp² = 0.459 against V&M's −0.31, and hue's effect on valence failed significance at p = .051.
      🚩 **The dominance equation has never been replicated and must be marked authored**, as must
      silhouette, the formality ladder and time of day. No literature supports those, and an
      authored rule set that says so is worth more than a fabricated citation.
      🚩 **Gate selection on the MOOD layer (10 min change / 20 min return), never on the affect
      layer (attack 150–250 ms)**, or the avatar changes clothes mid-sentence.
      Gate: **MEASURED** — a selftest reproduces Equation 3's published breakpoints (t=−5 → 1.000,
      t=5 → 0.636 from both branches, t=26 → 0.462), asserts every catalogue ensemble sums to
      within tolerance of its target clo across −20…+40 °C, and proves the hysteresis with a PAD
      trace that would otherwise change outfit more than once a minute.
- [ ] **9.12** 🎯 The wardrobe screen — select a complete outfit, **or mix and match individual
      pieces into one the user makes themselves**. Per-layer rails, a live preview on the actual
      figure at the actual identity setting, colourway swatches, and save/name an outfit.
      Not a debug panel: this is a surface a person uses for enjoyment, and changing an avatar's
      clothes is one of the reliably pleasurable things in games, VTubing and dress-up alike.
      ⚠️ Preview on the user's own figure, never on a stand-in — the whole point of an identity
      axis is that the same garment reads differently along it.
      Gate: **CRITIC** — a judge who has not seen the code assembles an outfit from parts, saves
      it, reloads and gets it back, and reports whether the screen is pleasant to use. Plus
      **MEASURED**: every reachable combination of the manifest renders without interpenetration
      above the 9.4 threshold, swept exhaustively rather than sampled.
- [x] **9.13** 🎯 **Agency, and its limits.** The AI wears what it chooses — dressing itself daily
      the way a person does — **when the user allows it**. Three modes, and the user owns the
      switch: `agent` (the AI picks, per 9.11), `pinned` (the user fixes an outfit and it does not
      change, for consistency over time), `ask` (the AI proposes and the user confirms).
      Default is `pinned` on first run: an avatar that changes its own appearance before the user
      has asked it to is a surprise, and the first impression of an identity should be the user's
      choice. The AI may always *express a preference* even when pinned — that costs nothing and
      is the difference between a puppet and a someone.
      Persist across sessions: continuity of appearance is continuity of identity, and an agent
      that wakes up in different clothes every session reads as a different agent.
      Gate: **MEASURED** — a selftest proves `pinned` survives a reload, a PAD swing, a season
      change and a restart; that `agent` mode never changes outfit more than once per mood period;
      and that no mode can violate 9.8. Proven red by a Dresser call that ignores the pin.

      ✅ **MEASURED.** `node packages/core/src/wardrobe/agency.selftest.mjs` — **28 assertions**.
      `pinned` is the first-run default and survives **32 PAD-corner × season steps**, a reload, and
      a restart rebuilt from **6,646 serialised bytes**; `agent` changed **6 times in 60 simulated
      minutes** against a ceiling of 6, with no two changes closer than one mood period; the RETURN
      period is separately proven; no mode can strip the floor, including a dresser that asks for
      nothing, because `dress()` unions the floor into every outfit. `expressPreference()` works in
      every mode and unheard preferences are kept.
      Proven red **twice, two mechanisms**: a `Dresser` call straight to `wardrobe.dress`
      (`pinHolds()` goes false), and a stored pin that disagrees with what is worn.
      ⚠️ 9.11's `Dresser` does not exist, so both the gate and the browsercheck use stand-ins that
      are labelled as stand-ins wherever they appear. What is measured is the AGENCY — who may
      change the outfit and when — not the choice. The seam is one method, `choose( context )`, and
      the hysteresis and the mood-layer guard live on this side of it; **9.11 should not
      reimplement either.**
      ⚠️ The preference log is capped at **64 entries** in `localStorage`. That is a quota decision,
      not a design one. If "what the AI wanted and did not get" is meant to be durable memory rather
      than a UI affordance, it belongs in the memory layer and not in this key.

### Making it look real

- [ ] **9.14** Cloth secondary motion on hems, skirts and coat tails, over 6.6's `SpringBones`.
      🚩 Scope it from the measurement: pose is NOT the problem for fitted garments — a 120°
      shoulder raise plus a 40° spine twist moves the suit's poke-through by **1.10 percentage
      points** and its worst depth by **−0.016 mm**. The knee is: hips 70° / knees −90° takes worst
      depth **9.190 → 14.988 mm**. Spend the budget on knees, hems and loose panels.
      Gate: **MEASURED** — worst posed poke-through over a defined pose set no worse than the rest
      pose, plus **CRITIC** on a walk/turn clip.
- [ ] **9.15** Extend gate **G7** (card-band cool-chroma outliers) to garment cutout cards. Item
      3.16 records lash and brow cards rendering as saturated royal-blue spikes for three rounds
      while G1–G6 read green, fixed by `specularIntensity 0` and alpha-to-coverage at cutoff **0.1**
      rather than the glTF default 0.5, which was discarding 15,368 lash and 20,262 brow texels.
      Any garment with an alpha cutout inherits that bug.
      Gate: **MEASURED** — G7 over the garment's cutout regions, < 0.10% of the band, proven red
      against the un-shaded material.
- [ ] **9.16** SPIKE: procedural fabric — weave normal + roughness + sheen/anisotropy generated
      from `{weave, endsPerInch, picksPerInch, yarnTex, gsm}` rather than sampled. Isolated
      prototype first, per the standing preference for proving unfamiliar domains outside the app.
      Half is already de-risked: a probe generated plain / 2-1 twill / 3-1 twill / 4-1 satin height
      fields from thread count alone, and the structure tensor's **coherence separates plain from
      twill by 1.9–2.6×** (0.2887 against 0.5560 / 0.5989 / 0.7429), ordering the twills by float
      length correctly.
      🚩 **AND THE OBVIOUS GATE IS THE WRONG ONE — proven, not predicted.** "Measure the twill
      diagonal with a structure tensor" reports **−90.00° on all three twills** against predicted
      32.91° / 30.96° / 45.00°, because a whole-patch tensor is dominated by the axis-aligned yarn
      ridges and the float diagonal is a lower-amplitude, longer-wavelength modulation on top. A
      naive autocorrelation pitch was also out by 2–10× because the repeat is `over + under` yarns,
      not one.
      Gate: **MEASURED** — twill angle recovered by an **FFT peak at the weave-repeat frequency**
      (or a band-passed tensor), matching `atan((picks × advance) / ends)` within a stated
      tolerance; **proven red against a plain weave, which has no diagonal to find, and against the
      whole-patch tensor above, which returns −90° on a correct twill.** Plus the anisotropic
      highlight running along the twill line on a rendered plate.

      ✅ **THE SPIKE IS BUILT AND THE GATE IS GREEN** — `node tools/spikes/fabric-weave.mjs --gate`,
      plus `packages/testbed/src/fabric.html` for the rendered half. Twill angle recovered to
      **0.0000–0.0001°** on a periodic patch and **0.018–0.197°** through an incommensurate
      Hann-windowed one, against a stated ±1.0°. Plain weave refused at uniqueness **exactly
      1.000000**; the whole-patch tensor returns the warp axis on the same fields in the same pass,
      reproducing the −90.00° above by measurement rather than by quotation. The rendered basis is
      proved end to end by a six-point rotation sweep, worst **0.09°**.

      🚩 **AND THE GATE THIS ITEM SPECIFIES IS INCOMPLETE — found by building it.** An FFT peak is
      structurally blind to whether the diagonal came from an interlacing at all: `painted-diagonal`
      (axis-aligned yarn ridges plus a cosine at exactly the right wave vector, no weave underneath)
      **passes it cleanly at 32.91°**. A second, independent instrument is required — fold the patch
      onto one repeat and measure its SHAPE (harmonic fraction 0.048 painted, 0.345 real, 1.040 for
      an ideal 3/1 square wave). **And the angle must be SIGNED**, because an S-twill has an
      identical |angle|, coherence, yarn diameter and GSM to its Z-twill twin.

      🚩 **The satin's predicted 45.00° is the formula applied OFF ITS DOMAIN** and the gate is
      right to refuse it: a 4/1 move-2 satin has two generators mod 5, so two diagonals, and the
      stronger is at −14.04°. That is what satin IS. Also corrected: **coherence tracks warp-face
      fraction, not float length** — see research §4.4, re-derived with sett held fixed.

      ⚠️ Three limits for 9.11 and 9.19 to inherit: it generates NEW cloth and cannot generate
      OWNED cloth (the gate's own 0.0001° precision is the evidence — a perfect lattice returns a
      delta function where real cloth returns a smeared peak); thread count describes the surface
      for **four** of the nine named families, not nine; and generated thickness is **24–48% too
      thin** against the F&T 1/2018 control set with the correction varying 1.47× across weaves
      whose real thicknesses span 1.15×. That last is reported and deliberately **not gated**.
- [ ] **9.17** SPIKE: pattern-to-garment. **Start from GarmentCode/`pygarment` (MIT), not from
      scratch** — the only complete open headless pipeline, it already emits GLB and a UV texture,
      and hm08 support is three files its config anticipates: `<name>.obj`, a 26-measurement
      `<name>.yaml`, and a segmentation JSON, which hm08's 172 named groups make scriptable.
      🚩 **Two traps to plan for, not discover:** its Warp fork is under the **NVIDIA Source Code
      License, not Apache-2.0**, and it targets Warp's **deprecated `warp.sim`**, whose successor
      is Apache-2.0 **Newton**. 🚩 Design for the published **72% simulation success rate** — one
      garment in four fails — not for the 30 s/garment average.
      Timebox it and report an honest negative if it does not land.
      Gate: **MEASURED** — one drafted garment reaches the CC0 baseline fit (covered skin outside
      the cloth ≤ **26.37%**, worst depth ≤ **9.19 mm**, same signed point-to-triangle tool), and
      the bake stays inside a stated budget against the measured **0.86 s/garment** marginal cost
      of the mhclo path and the **0.65–3.58 s** for a Blender drape at our mesh density.
- [ ] **9.18** Hardware library — ~15 parametric models (zips, buckles, buttons, rivets, eyelets,
      snaps, webbing keepers, cord locks, D-rings). 🚩 **The bounded art task the phase cannot
      avoid.** There is no academic work on procedural garment hardware, and GarmentCode states in
      its own paper that *"the simplified definition of a panel does not allow specification of
      internal loops"* — which blocks eyelets and buttonholes **at the pattern level** — and that
      it cannot model *"elements sewn on top of a fabric piece, such as pockets and flounces."*
      **Placement is derivable from pattern edges; only the models are hand-made, and only once.**
      This is the difference between the face's *unbounded* scan requirement and clothing's
      *bounded* one, and it is why this phase is tractable where photoreal skin was not.
      Gate: **CRITIC** — a judge cannot tell a placed zip from an authored one at portrait framing.
- [ ] **9.19** SPIKE: contact-driven wear, with an honest chance of a negative result.
      🚩 **The one genuinely open problem in the phase.** AO and curvature are *geometry*-driven and
      every bake we can run derives from them; wear is *use*-driven — knees, seat, cuffs, collar
      folds, pocket mouths. The generic weathering canon exists (Dorsey & Hanrahan 1996; γ-ton
      tracing 2005; Bellini et al. 2016) and **has never been applied to garments in a published
      venue**. This is what separates a generated jacket from a bought one.
      Gate: **CRITIC** — blind, generated-with-wear against generated-without, and the judge must
      pick the worn one as more real. **Report a negative if it does not land; do not tune.**
- [ ] **9.20** Third-party import path. The library **CONSUMES** a garment the user legally
      acquired and **NEVER BUNDLES** one. No licensed asset in the repo, in the npm package, or in
      any example. Honour VRM's machine-readable licence block programmatically and **default to
      most-restrictive** on VRM 0.x (where every field is optional), on any unmapped 0.x↔1.0 value,
      and on a missing block. Note in the code that no Consortium text imposes an enforcement duty
      on applications — enforcing is a policy choice we are making, and saying so is honest.
      Gate: **MEASURED** — a repo scan asserts no third-party garment binary is tracked, and the
      importer refuses an asset whose licence metadata forbids the use.
- [ ] **9.21** 🚩 **Merge the wardrobe body into the shipped figure, ON THE SAME PASS PHASE 10
      REBUILDS IT.** There are two `g050` bodies in the tree — `assets/figures/figure_g050.glb` and
      `assets/wardrobe/body/g050.glb` — the same geometry differing only by the per-vertex `_HIDE_*`
      and `_DECENCY_*` attributes, and `alive.js` swaps between them on `?wear`.
      Measured cost of merging: +58,068 bytes per garment as FLOAT32 (body 11,742,100 against the
      nude 11,567,392), which is 14.5 KB each as `UNSIGNED_BYTE` — a hide flag is a boolean.
      Measured benefit of keeping them split: **none.** The runtime index rebuild already equals the
      baked build exactly, 17,012 = 17,012 and 21,380 = 21,380, identical as a 1 µm centroid
      multiset. The split exists only because adding attributes changes the shipped figure's sha256
      and every gate measured against it.
      ⚠️ **This arrived as `docs/OPEN-REQUESTS.md` REQ-024 and was REJECTED AS A REQUEST AND
      CONVERTED HERE**, on the entry's own advice: it is asset work with a gate-re-measurement cost,
      not a diff, and the ledger has no way to express a sequencing dependency. The dependency is
      the whole point. `307db6c` measured that garments do NOT survive identity — two body sliders
      drift `female_casualsuit01` **106.887 mm** — and the JS refit needs **22.6 KB of helper
      vertices per garment** shipped, because the exporter deletes 1,879 of the 1,885 basemesh
      indices the fit rule reads. **10.9 will rebuild the figure for that.** Doing it twice
      re-measures every sha256-bearing gate twice.
      Gate: **MEASURED** — one body in the tree; `verify_glb.mjs` green on the merged artefact; and
      every gate that names a figure sha256 re-measured **in the same commit**, with the old numbers
      replaced rather than carried.

⚠️ **One item deliberately absent.** There is no "match the reference seller's quality" gate here,
because that is 8.1's job and 8.1 is a blind CRITIC comparison. A subjective quality bar inside the
wardrobe phase could be declared passed by whoever built it. This phase delivers measurable
plumbing and measurable material parameters; a judge decides whether it looks like clothing.

### Known gaps in the reference, recorded so they are not rediscovered

The 638 supplied renders cover no: foundation layer (9.8 authors blind), socks or hosiery, bags,
belts as separate items, eyewear, headwear, scarves or gloves, jewellery, sleepwear, swimwear, a
coherent activewear set, open footwear, women's shoes beyond one block-heel boot, cardigans,
matched formalwear, adaptive or maternity cuts, or **any non-Western dress** (9.10).
Women's footwear is the thinnest slot on either rail by a wide margin.

## Phase 10 — Identity sculpting

The brief's R8 asks for an avatar that is "male, female, or a combination of the two — the AI's
identity." Phase 1 delivered the first half and named the second: `Identity.js` accepts
`{age, build, height}`, stores them, and does nothing with them — `NOT_YET_BAKED` says so in code.
This phase is the second half, and it is larger than three axes: **1,258 targets are already
installed, and `targets/target.json` groups them into 203 slider categories — 195 bidirectional and
8 unipolar — across 21 regions.** (Corrected 2026-08-09 with research §2.2; the eight are the seven
`head-<shape>` categories and `chin-triangle`, which carry no `opposites` block and run 0 → +1.
Held to the shipped `assets/identity/catalogue.json` by `tools/identity-pipeline/identityassets.selftest.mjs`.)

Measurements, sources and the evidence behind every number below live in
[`research/identity-sculpting.md`](research/identity-sculpting.md).

### The architecture

- [x] **10.1** `figure/IdentityTargets.js` — CPU application of MPFB detail and macro targets to the
      position buffer, once, at identity-change time. 🎯 **Identity morphs never animate, so they
      are not GPU morph targets and cost NOTHING per frame.** A target is a pure additive
      per-vertex offset with no solver: applying the `.target` files in JS reproduces MPFB's own
      output to **1.09e-4 mm** on an identity whose own magnitude is 23.218 mm, and to
      **1.15e-4 mm** on one of 187.267 mm.
      Gate: **MEASURED** — for a stated identity, the JS result matches a headless MPFB build of
      the same identity to < 0.001 mm on all 19,158 vertices, and the per-frame morph cost is
      unchanged against Phase 0.8's measured **0.219 ms for 69 targets**. Apply cost must stay
      under the measured **2.0598 ms for all 203 sliders at once**, once, off the frame path.

      ✅ **MEASURED.** `node packages/core/src/figure/identitytargets.selftest.mjs` — **47 checks**.
      Against headless Blender 5.2.0 LTS + MPFB 20260722, on all 19,158 vertices, four identities:
      **1.151e-4 mm** (56.223 mm face reshape), **1.370e-4** (14.056 mm), **1.193e-4** (187.267 mm
      body reshape), **1.442e-4** (24.142 mm mixed-sign) — a 7× margin on the 0.001 mm gate, and the
      same vertex SET moves, not merely the same worst error. All **266** exposed widgets apply in
      **1.0028 ms** median, once, inside the declared 2.0598 ms.
      🎯 **Per-frame cost is ZERO and is shown so two ways**: structurally, because no per-frame
      entry point exists to call; and on a loaded figure, where a 187 mm reshape leaves the GPU
      morph target count (89) and every influence **bit-identical**.
      Proven red **nine ways**, including a 0.0005 mm single-vertex injection that sits INSIDE the
      declared band, an off-by-one vertex map, a truncated CSR inverse, and a per-frame method
      merely appearing on the class.
      ✅ **research §1.4's flagged assumption is now MEASURED and TRUE**: 14,517 glTF positions
      resolve onto basemesh indices 0..13,379 with 0 unmatched, 0 ambiguous, worst agreement
      2.4e-7 m, validated on all five bakes at 0.00 mm split-copy spread. Map ships as
      `assets/identity/figure-vertex-map.{json,bin}`; re-solve with
      `node tools/identity-pipeline/build_from_blender.mjs --dumps <dir>` if the figures are rebaked.
      ⚠️ **10.81 MB of new committed asset** (`assets/identity/targets/*.bin`, 675,663 packed
      records; torso alone 3.52 MB). It loads per region, so a product pays for what it edits — but
      the browsercheck deliberately loads all twenty and that is 10.8 MB on first paint.
- [x] **10.2** `figure/IdentityCatalogue.js` + `assets/identity/catalogue.json` — the 203 slider
      categories read out of MPFB's `target.json`, with region, label, sidedness and the two target
      filenames per direction. 🚩 **`macrodetails` is NOT a 348-slider tier**; it is the
      interpolation corpus for eight macro parameters declared in `macro.json`, and exposing it as
      sliders would be exposing `universal-female-young-maxmuscle-minweight` as a dial.
      Gate: **MEASURED** — the catalogue accounts for all 1,258 installed files exactly
      (530 detail + 348 macro + 216 breast-macro + 102 expression + 62 asym), and a selftest fails
      if any file is unclassified. Region counts must match research §2.2 to the unit.

      ✅ **MEASURED.** `node packages/core/src/figure/identitycatalogue.selftest.mjs` — **72 checks**.
      **203** categories / **66** sided / **269** widgets / **530** raw files / **21** regions,
      matching research §2.2 region-by-region; all **1,258** installed files classified with
      **0 unclassified**; **200** sliders and **266** widgets exposed after excluding the 3 genital
      categories. The JS macro-stack solver reproduces MPFB's own
      `TargetService.calculate_target_stack_from_macro_info_dict` **exactly** — same files, same
      order, **0.000e+0** weight error — at the shipped default (8 targets) and off-midpoint (77).
      Proven red eight ways across all four classes.
      ⚠️ **Two research numbers measured FALSE and are corrected in the doc**: there are **20**
      `measure-*` categories, not 26 (the 26 is GarmentCode's input-vector size, so **9.12 must
      derive or default six of them**), and **195** categories are bidirectional with **8 unipolar**
      — the seven `head-<shape>` categories and `chin-triangle` have no `opposites` block and run
      0 → +1, so a UI that draws every category as a −1…+1 dial applies seven head shapes backwards.

      🚩 **THAT CORRECTION LANDED IN ONE FILE AND THREE LIVE COPIES SURVIVED IT** — this line 1618
      above, `assets/identity/catalogue.json`'s `census.notes.detail` (**shipped**), and the literal
      in `build_identity_assets.mjs` that writes it. A fourth sat in the gitignored `dist-pages/`
      bundle. Every gate on this data was green and correctly so: **the data was never wrong.** What
      was wrong was English beside the data, restating it, derived from nothing.
      🎯 **Fixed at the model rather than the three symptoms.** `censusNotes()` now templates every
      number in those five sentences out of the finished catalogue, so a generated artefact no
      longer hand-types a restatement of its own contents; the shipped `catalogue.json` rebuilds
      with all 20 region `.bin` files **byte-identical** and one line changed.
      Gate: **MEASURED** — `node tools/identity-pipeline/identityassets.selftest.mjs`, **28 checks**
      in three rules. ARITHMETIC recounts the 530 detail files four independent ways
      (66×4 + 129×2 + 8×1) so 195/8 is evidence before it is an oracle; DERIVED rebuilds the shipped
      notes from the shipped file; SWEEP holds `N bidirectional`=**195**, `N unipolar`=**8**,
      `N sided`=**66** across every text file in the repo (**219** of them at this commit; the gate
      counts them itself and fails a sweep of fewer than 100), matching on whitespace- *and*
      continuation-marker-collapsed text because §2.2's own "8 unipolar" wraps behind a `>`.
      Retractions stay legal through a `QUOTATIONS` allowlist that is asserted **present** per file.
      If ARITHMETIC fails, SWEEP **refuses to run** rather than holding prose to a count the
      catalogue could not close — a broken oracle fails correct prose as readily as it passes stale.
      Proven red **ten ways**, and live: both original sentences reintroduced verbatim were caught
      with correct line numbers, and so were four fresh breaks in untouched files — a `sided` drift
      in `IdentityCatalogue.js`, a `unipolar` drift in `identity.html`, a claim wrapped across a
      blockquote marker, and the builder hardcoding the literal back into `censusNotes()`. **That
      last one blinds DERIVED** — its oracle moves with the literal — **and SWEEP caught it at both
      sites**, which is the two rules covering each other rather than agreeing with each other.
      ⚠️ The per-slider `axis` tag (`size|position|volume|shape`) is a **regex over names**, not a
      measurement. 10.10 and 10.11 depend on that grouping and it should be validated before it is
      trusted.
      ⚠️ The left/right split is plumbed — `resolve()` takes `{ left, right }` per sided slider,
      which is how **10.12** reaches author-declared asymmetry through the 66 sided categories
      rather than through the 62 `asym` files — but it records nothing and forbids nothing. The
      declaration and its gate are 10.12's.
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

      🚩 **SIZE THIS OFF THE SHIPPED MESH, NOT OFF THE NUMBERS ABOVE.** Re-measured on the export
      that actually renders (`base.001`, 14,517 positions) with
      `node tools/identity-pipeline/measure_expression_cost.mjs`: peak travel IS invariant to
      identity to **0.000000 mm** across eight identities, so the superposition finding holds — but
      the closure costs are **larger**, and one row **flips sign**. Against eyeBlinkLeft's own
      12.600 mm vertical travel on this mesh: `eye-height2-incr` **−1.827 mm (−14.5%)** against the
      −1.543 / −10.0% tabled above; `eye-scale-incr` −1.017 (−8.1%); `eye-scale-decr` +1.009
      (+8.0%); `eye-trans-out` **+0.000** (the rigid-motion class is real and not empty);
      `head-scale-horiz-incr` **−0.186 (−1.5%)** against +0.016 / +0.1% — **eleven times the
      magnitude and the opposite sign**, which contradicts the "rigid-region targets cost exactly
      zero" conclusion for the skull case.
      And two cases the research never measured are worse than anything in it: a composed face
      identity costs **mouthPucker −2.293 mm of 6.100 mm (−37.6%)** — four times its eyeBlink cost,
      and §1.2a only ever measured mouth faceunits against eye sliders, so **this item needs a mouth
      row** — and the eyes region hard over costs eyeBlinkLeft **−8.721 mm of 12.600 (−69.2%): the
      eye does not close.** Exact linearity is CONFIRMED (ratio 3.996 between weight 1.00 and 0.25),
      so the corrective is still one scalar per pair; there are just more pairs and they are bigger.
      ⚠️ The mesh-vs-instrument attribution on the sign flip is NOT settled — the shipped-mesh
      instrument requires a non-zero morph delta in its weakly-driven band and §1.2a's stated rule
      does not say. Settle it here before trusting either table.
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

      🚩 **THE SOLVER EXISTS AND IS EXACT; THE CORPUS DOES NOT SHIP, AND THAT IS THIS ITEM'S REAL
      PROBLEM.** 10.2's `IdentityCatalogue.macroTargetStack()` already reproduces MPFB's own macro
      solver at **0.000e+0** weight error on both fixtures, so the eight macro parameters plus three
      ethnicity weights are solvable today. But the 564 files behind them hold **5,323,086**
      moved-vertex records = **85.2 MB** packed, against 10.81 MB for all 530 detail targets.
      Lazily fetching only the ~50–124 active files is still tens of MB per macro change.
      **This item needs a different representation — a delta basis, or keeping the five bakes as
      anchors — not a loader.**
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
      The 26 `measure-*` categories are a **measurements panel in centimetres**, not −1 → +1 dials.
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

## Standing constraints

- **Animate early.** Every timing constraint agrees. Never analyse output audio reactively.
- **A motion clip is judged on a seed SET, and only on seeds measured to contain the behaviour.**
  A pinned seed buys reproducibility, not representativeness — `capture.mjs --postural-seeds`, or
  `--require-weight-shift` on whatever set you pick. One draw is one draw. **And this now applies
  to still plates on EVERY recipe, not just the capture one** — see the next two bullets.
- **`?freeze` HOLDS UNDER `?capture`.** Retracted 2026-08-08: this bullet used to read *"`?freeze`
  IS INERT UNDER `?capture`"*, which was true before `c9fa59c` and is not true now. Proven at HEAD
  `1985425` on the byte-reproducible forward path — `?bare&freeze&seed=1&capture&aa=msaa&grade=0`
  at 1, 60 and 300 steps returns one sha256, and free-running returns the same bytes; drop
  `?freeze` and 1 step differs from 60. LEARNINGS §1.19a needs the same correction.
- **✅ A STILL PLATE ON THE SHIPPED DEFAULT IS A VALUE AGAIN — AND ITS STEP COUNT IS PART OF ITS
  IDENTITY.** This bullet used to read *"a still plate on the shipped default is a draw"*, and it
  was right until 3.20. Since then the GATE VALUES agree to the last digit across every load
  measured. **What replaces the warning is narrower and still bites: a temporal
  resolve at N steps is not the picture at M steps.** Measured, one page, one seed, 900×1200:
  G2 0.9182 at 1 step and 0.9169 at 60. State the step count with the width, the seed and the
  digest, or the plate is not identified. `measure.mjs` now reads it out of the frame file name.
- **🚩 A PLATE'S sha256 IS A MODE, NOT AN IDENTITY, AND THE NEXT BULLET USED TO SAY OTHERWISE.**
  The sentence retired here is *"three loads … one PNG, all three times"*. Measured over 103 loads
  at 3840×5120 the shipped default returns its modal digest most of the time and a Δ≤2 variant the
  rest, and whether a given run of thirty is clean or dirty is a coin flip on the same build. **A
  plate quoted with a sha and no residue is quoting a draw.** Take one with
  `capture.mjs --plate --plate-loads N` — it prints the ```plates row, `bitident=` and all — and
  never with a clip's last frame, because `--verify-frames` is an opening window that does not
  reach the frame you are about to hash.
- **🚩 NO BARE VERDICT INSIDE THE NOISE. `MARGINAL` IS A REQUIRED WORD.** A gate value closer to a
  band edge than that gate's **retained fragility floor** does not license a PASS or a FAIL on its
  own, in either direction. Floor: G1 0.0005, G2 0.0004, G4 0.0135, G5 0.000001, G6 0.000000,
  G7 0.000046. ⚠️ **Those were the load-to-load spread and the spread of the GATE VALUES is now
  ZERO** (the bytes are not — that is a separate statement, see the plate block) — they are
  retained because the *recipe* sensitivities measured at `2ec7db9` are larger: G2 moves 0.0013
  between 1 capture step and 60, 0.0028 between 900 px and 3840 px, and 0.0024 between the shipped
  default and its A side. Setting the floor to the measured zero would make the rule inert, which
  is a gate going green by going blind. Write the literal token `MARGINAL` within 400 characters of
  the claim, and say what would settle it. `G2 0.9201 PASS` — one ten-thousandth inside the floor —
  is how a whole phase came to be reported as six of seven when it is five.
  Enforced by `node docs/measured-claims.selftest.mjs`, **six rules**.
- **🚩 A CURRENT NUMBER BELONGS TO A NAMED PLATE, AND THE PLATE BELONGS TO A MEASURED TOLERANCE.**
  Every gate value quoted for the shipped default is held by the **PLATES** rule against the
  ```plates block at the top of this file. Re-measure and update both, or the gate goes red;
  hand-narrowing a value is the mutation that replaced hand-narrowing a range. ⚠️ **This bullet
  used to call the sha256 the identity, and the sha is a mode.** **REPRO** now requires every
  multi-load row to carry `bitident=`, `worst=` and `px=`, holds that record to its own arithmetic,
  and refuses a byte-identity claim written next to a plate the fence records as not being one.
- **State the WIDTH beside any G4 number.** High-pass σ is scale-dependent with no sound rescaling
  law; the band is stated at 3840 px and the same plate reads 1.7469 there and 2.1849 at 900.
- **A toggle is only an attribution if it moves ONE subsystem.** `?eyes=0` moved two for two review
  rounds and every number attributed to it was a sum. `window.sugata.subsystems()` counts what is
  live and `alive-toggles.selftest.mjs` holds each flag to the contract. Check the DEFAULT of a
  flag before attributing anything to it — a "no antialiasing" blocker was a `?msaa=0` plate whose
  numbers matched the docs to four decimals *because* it was the same toggle state.
- **Two clips are comparable only if `capture.json`'s `source.packagesDigest` matches.** In a
  fan-out it usually does not: six back-to-back captures produced three distinct digests, and two
  of those builds differed by Δ209 of 255 code values on 0.39% of pixels at the same seed. Check
  before any A/B.
- **There is NO measured visibility threshold for this project's framing.** The 1.6 px figure comes
  from a block PROGRESS itself marks superseded and its two halves disagree by 1.85×. What is
  owned is a **bracket**, 0.48–10.6 px peak-to-peak at full-body framing, from two blind-judge
  observations. Cite the bracket; do not cite 1.6 px as if it were data. LEARNINGS §1.14a says what
  would measure it.
- **Dominance never goes to the face.** Posture, gaze policy, gesture amplitude only.
- **Never proximity-blend emotions.** Threshold and saturate, 1–2 active maximum.
- **The mouth belongs to lipsync.**
- **Do not add facial asymmetry, blemish noise, pore detail, or white sclera** — all four are wrong
  for this target, per measurement.
- **No black lift** in the grade, despite "cinematic" instinct.
- **MPFB2 is build-time only.** Its code is GPLv3; only its CC0 assets ship.
- Reference imagery is copyright SHIFT UP / SIE. Gitignored. Never committed, never shipped.
