# tools/critic — the objective critic harness

Five tools that between them stop "does this look right?" from being purely a matter of taste.

- **`measure.mjs`** — reads a PNG and a region spec, returns the seven objective gates from
  [`docs/research/stellar-blade-look-spec.md`](../../docs/research/stellar-blade-look-spec.md) §6
  with a PASS/FAIL each.
- **`blind_ab.mjs`** — shuffles our render against a reference, strips provenance, and hides the
  mapping until after a verdict is recorded, so a critic agent genuinely cannot tell which is ours.
- **`capture.mjs`** — drives a live page one fixed simulation step at a time and assembles the
  frames into an mp4, a gif and a contact sheet. The first two judge a still; this one is the
  only way to judge *motion*, which is where aliveness actually lives.
- **`heatmap.mjs`** — reduces a captured clip to one image: the per-pixel temporal standard
  deviation of the picture, so you can see **where** it moved and **by how much**. Answers the
  question a video cannot, because a reviewer will forgive a motionless thigh for ninety seconds
  and a σ map draws it as a black slab.

`measure.mjs`, `blind_ab.mjs`, `heatmap.mjs` and the codec have no dependencies, and the PNG codec
is ours (`png.mjs`, ~250 lines over `node:zlib`) — a smaller cost than a supply chain sitting
underneath the numbers that steer the project's art direction. `capture.mjs` is the exception and
needs Playwright and ffmpeg; it drives a browser, so there was never a version of it that did not.
Node 18+.

---

## Quick start

```bash
node tools/critic/selftest.mjs                       # prove the tool measures what it claims
node tools/critic/heatmap.selftest.mjs               # ditto, for the heat map
node tools/critic/travel.mjs captures/idle --threshold 0.1979   # how far did the body MOVE, in px
node tools/critic/travel.selftest.mjs                # ditto, for the travel measurement
node tools/critic/measure.mjs shot.png regions.json  # JSON on stdout
node tools/critic/measure.mjs shot.png regions.json --human

# 20 s of video to judge motion; --keep-frames because heatmap.mjs needs the PNG sequence
node tools/critic/capture.mjs --seconds 20 --keep-frames --out captures/idle
node tools/critic/heatmap.mjs captures/idle         # where did it move, and by how much
```

Exit codes are distinct so a calling script can tell a bad render from a broken tool:

| code | meaning |
|---|---|
| 0 | every gate PASS or SKIP |
| 1 | at least one gate FAIL |
| 2 | tool error — bad file, bad region spec, unreadable PNG |

**Input must be a non-interlaced PNG.** 1/2/4/8/16-bit, greyscale, RGB, palette and RGBA are all
handled. Reference assets are JPEGs, so convert first — `sips -s format png in.jpg --out out.png`
on macOS. Convert, do not screenshot: a screenshot goes through the display colour pipeline and
you end up measuring the monitor profile.

---

## ⚠️ The one thing that will silently invalidate everything: luma domain

"Luma" is two different quantities, both computed with the Rec.709 coefficients
(0.2126 R + 0.7152 G + 0.0722 B):

- **encoded luma** — coefficients applied to the sRGB values straight out of the file.
- **linear luma** — sRGB EOTF undone first, then weighted. This is relative luminance: physical
  light.

They are not close. `#E5C3C3` is **0.793 encoded** and **0.596 linear** — a 25% gap, easily enough
to flip a gate.

**The spec's published measurements are ENCODED.** Verified in the self-test: the spec's
`#E5C3C3 → 0.793`, `#C29997 → 0.633`, `#9D7274 → 0.483` and `#150F17 → 0.067` all reproduce to
within 0.001 under encoded luma, and not at all under linear.

So each gate declares its domain in its output (`"lumaDomain"`), and **every measurement reports
both numbers** so the choice can always be re-checked. The reasoning for each choice is in the
`TARGETS` block at the top of `measure.mjs`.

---

## The seven gates

🚩 **Six is the number in the look spec's own checklist. There are seven here, and G2 has two
halves.** G7 was added when G1–G6 were all green on a plate whose single worst feature — eyelash
cards rendering as vivid royal-blue spikes — was unmissable to a human and structurally invisible
to every one of them. G2's chroma half was added when it turned out the gate had been asserting
one clause of a two-clause spec sentence for the whole project. Both are LEARNINGS §1.11: the
answer to "my gate cannot catch this" is a structurally different assertion, not a tuned threshold.

🚩 **Every number here is about ONE PAGE at ONE FRAMING in ONE MOTION STATE**, and the report says
which — see [Provenance](#provenance-which-page-a-number-came-from). A G4 sigma measured on
`skin.html` was once quoted as certifying `alive.html`, which reads 1.4764 against 1.9495 at the
same width.

### G1 — face key:shadow luma ratio < 2:1 · *linear*

> §0.1 · *"Light a Stellar Blade avatar with a conventional three-point ratio and it will read
> wrong no matter how good the shader is. This is the single highest-leverage parameter."*

Regions: `faceKey`, `faceShadow`.

The reference face is deliberately flat-lit. Western photoreal cinematics run 4:1–8:1 on faces;
this runs under 2:1, and form is carried by rim/kicker lights and a warm/cool hue split instead
of by shadow density.

**Judged linear**, because a key:shadow ratio is a ratio of light — the spec's own "4:1–8:1"
comparison is a stop-based, linear figure. A 2.0 threshold read as *encoded* would be 2^2.4 ≈ 5.28
linear, i.e. it would happily pass the exact photoreal lighting the gate exists to reject.

Reference values, recomputed from the spec's published hexes:

| asset | encoded | linear |
|---|---|---|
| 3/4 close-up (`#E5C3C3` → `#C29997`) | 1.25 | **1.634** |
| cutscene (0.577 → 0.489, hexes not published) | 1.18 | ≈1.43 (derived) |

### G2 — sclera vs cheek, luma ≈ 0.98 ± 0.06 **and** chroma ≈ 1.284× · *encoded*

> §2 · *"The sclera is NOT white. It measures the same luminance as the surrounding cheek and is
> more saturated than skin (0.275 vs 0.215), pink-tinted. A white eyeball instantly breaks the
> look."*

Regions: `sclera`, `cheek`.

**Read that spec sentence again — it makes two claims, and for three rounds this gate measured
one.** A grey eyeball at exactly the reference brightness scored green. It comes from heavy lid AO
plus sclera SSS; per §5, achieve it that way, **not** by darkening the sclera albedo, or it goes
grey under every other light — which is precisely the failure the luma half alone cannot see.

The gate now fails if any of three components fails, and names which:

| component | target | why |
|---|---|---|
| luma | 0.98 ± 0.06 | the published encoded ratio, 0.483 / 0.492 |
| chroma, ordinal | sclera S ≥ cheek S | the spec sentence verbatim; invents nothing |
| chroma, band | 1.284× ± 6.1% | ±6.1% is the same RELATIVE tolerance the luma half carries (0.06 on 0.98), applied to the other half of the same sentence rather than invented for it |

**The reference chroma ratio is recomputed at run time from the spec's own hexes**, not
transcribed from its prose: HSV saturation of sclera `#9D7274` is (157−114)/157 = 0.27389 and of
cheek `#96767D` is (150−118)/150 = 0.21333, so 1.2839. The spec's rounded prose (0.275 / 0.215)
gives 1.2791 — they agree to 0.4%, and the selftest asserts the derived figures against the prose
as an external oracle.

Judged on **HSV saturation** because that is the statistic the spec published both numbers in.
Note that G7 deliberately uses **chroma (max−min)** instead, for the opposite reason — see its
section.

**Judged encoded**: it is a perceptual "reads as the same brightness" match, and 0.98 is the
encoded figure the spec measured.

⚠️ **On an animating page this gate is a distribution, not a number.** The sclera rect is 11×6 px
on an eye ~40 px across, and `?freeze` pins the pose but not the ocular or postural layers, whose
state at the first drawn frame comes from the seed. Measured on `alive.html?bare&freeze` at
900×1200, one frame, four seeds, nothing else changed: **0.8127 / 0.9627 / 0.9736 / 0.4384** at
seeds 1 / 42 / 4242 / 20260807 — a 2.2× spread, two of four passing, and at 20260807 the rect has
walked onto the iris. The tool warns about this on every run that has a `sclera` region. **Quote
G2 over a seed set.**

### G3 — terminator gets more saturated AND redder · *encoded*

> §2 · *"Saturation RISES into shadow — 0.15 lit → 0.23–0.26 shadow → 0.41 in transmission — and
> hue shifts red. That is the pre-integrated-skin red-shifted terminator."*

Regions: `litSkin`, `shadowTerminator`.

This is the objective SSS correctness test, and the only gate that catches a *materially* wrong
skin shader rather than a wrong grade or a wrong light. Diffuse-only skin desaturates and goes
grey or blue into shadow; a pre-integrated profile does the opposite.

PASS requires **both**:

1. `saturation(shadow) > saturation(lit)` by at least 0.01;
2. shadow hue is closer to red than lit hue. Measured as distance-to-0°, because skin hue crosses
   below 0° (i.e. wraps past 360°) as transmission takes over — the reference ear is at 356.8° —
   and a plain hue subtraction gets the sign wrong exactly where the signal is strongest.

**Deliberately relational, not absolute.** The spec's absolute band (shadow S 0.23–0.26) is
reported as `shadowSaturationInReferenceBand` but is *not* enforced, because it depends on the key
colour of the shot.

> 🚩 **A caveat found while building this, worth knowing before you trust a G3 result.** The
> spec's headline claim mixes samples from two different lighting setups: the lit S of 0.15 is
> the *cool-key* cheek (`#E5C3C3`), while the shadow S of 0.234 is from the *warm-key* asset.
> Within the warm-key asset alone, lit `#E5BBAB` measures S 0.253 and shadow `#C29997` measures
> S 0.222 — a small *fall*, not a rise. The rise is unambiguous down the deepening chain
> (shadow 0.234 → shoulder shade 0.256 → ear transmission 0.414) and the **hue** shift is
> unambiguous everywhere (16.6° → 2.8° → 356.8°).
>
> Practical consequence: sample `litSkin` and `shadowTerminator` **from the same key**, and treat
> the hue half of this gate as the more reliable half.

### G4 — flat-skin high-pass σ 1.5–2.1 / 255 at 4K · *encoded*

> §0.2 · *"Skin micro-detail is ~3–5× lower amplitude than photoreal. No individual pores resolve
> even at 4K on a face filling half the frame."*

Region: `flatCheek` — exactly one rect, at least 16×16 px.

Photoreal scan skin measures 6–12 at equivalent sampling. The spec calls this "the most
reproducible single Stellar Blade skin parameter". Under-shooting reads as plastic; over-shooting
reads as the wrong game entirely.

Defined precisely, because a high-pass is only reproducible if you say which one: **pixel minus
the mean of its 5×5 neighbourhood**, on encoded Rec.709 luma in 0–255 code values, σ taken over
every pixel in the rect. The neighbourhood is sampled from the *whole image* and clamped at the
borders, so there is no 2 px inset and no edge bias.

> 🚩 **Scale-dependent, and there is no sound rescaling law.** The band was measured at 3840 px
> wide. Measured on the same content downscaled to 1920, σ rises to 2.59 and the gate fails —
> correctly, in the sense that the number is real, but it is not comparable. `measure.mjs` warns
> when the capture width drifts more than 10% from 3840. **Capture at 4K for a gate run.**

### G5 — fewer than 0.5% of pixels above 0.99 luma · *encoded*

> §3 · *"Highlight rolloff is very soft. Essentially nothing hard-clips — even a frame full of
> emissive neon puts 0.001% of pixels at white."*

Region: `frame` (optional; defaults to the whole image).

Reference: 0.017% frontal portrait, 0.036% cutscene, 0.001% neon action. The one asset at 1.30%
was background practicals, not the subject. Counted exactly, not from the histogram.

### G6 — black point p0.1 luma in 0.004–0.016 · *encoded*

> §3 · *"Blacks are NOT lifted. There is no faded/milky-black film grade. Do not add shadow lift
> — the commonest mistake when people try to make a render look cinematic."*

Region: `frame` (optional; defaults to the whole image).

`p0.1` is the 0.1th percentile, i.e. the 0.001 quantile. Reference: 0.0028–0.0163 across four
assets. **Below** the band means crushed blacks; **above** it means lift. Measured to 1/65536 via
a histogram — 0.004 encoded is code value ~1 of 255, so at 8 bits this gate is working right at
the quantisation floor and a 16-bit capture is worth having if you can get one.

⚠️ **On `alive.html` this gate does not currently measure a grade.** With no `frame` region it is a
whole-image percentile, and the darkest 0.1% of that frame is whatever happens to be darkest.
Measured 2026-08-08 at 900×1200: **0.00001** shipped and **0.02496** with `?cards=0` — the eyelash
and eyebrow cards are genuinely black and they own the bottom of the histogram. Neither number is
about shadow lift. Give this gate a `frame` region before reading it.

### G7 — card-band cool-chroma outliers < 0.10% · *encoded*

> §2 · hair base albedo is *"essentially black — luma 0.067"* and its apparent colour is supposed
> to come from an anisotropic lobe along the fibre; the lid crease measures 0.31× cheek; the rim
> *"wins on saturation, not brightness"* and is capped at 1.0–1.5× key-lit skin.

Region: `cardBand` — hand-drawn rects over the lash lines and brows.

**This gate exists because G1–G6 were all green on a plate whose eyelashes were vivid royal-blue
spikes.** Between them those six sample a patch of cheek, a patch of sclera, a patch of terminator
and two whole-image percentiles; they make no assertion about colour anywhere else in the frame,
so a near-black surface reflecting a saturated rim at full Fresnel is invisible to every one of
them by construction. It is deliberately a different KIND of assertion — a per-pixel **outlier
count**, not a mean or a ratio — because a mean over a patch containing both black cards and
bright skin cannot resolve the defect at all.

A pixel is an outlier when all three hold: HSV **value ≤ 0.35**, **chroma ≥ 0.15**, hue in the
**cool arc 180–300°**. Each qualifier was checked against the alternative:

- **value** restricts the count to the cards rather than to rim spill on skin. Derived, not
  chosen: the spec's socket sample `#352327` is 0.354× its own cheek reference. Dropping it costs
  an order of magnitude of separation (38× → 2.9×).
- **chroma (max−min), NOT saturation.** Saturation is chroma/value, so a *dimmer* blue scores
  *higher*. Across a card specular sweep the saturation form went 1.0 → 2.866%, 0.5 → 3.197%,
  0.35 → 3.208%, 0.0 → 0.101% — it **peaks in the middle of a monotonically improving sequence**,
  so a threshold on it would have called the half-fixed render worse than the broken one. The
  chroma form is monotone: 1.879 / 1.279 / 0.925 / 0.589%.
- **cool hue** because warm chroma there is eyeshadow and lid vasculature, baked into albedo on
  purpose. Cool chroma is not in the asset at all.

Known-bad is a URL parameter rather than a committed plate, which is the cheapest form a rejection
proof can take: `?cards=0` restores the shipped GLB card material. Measured 2026-08-08 on
`alive.html?bare&freeze` at 900×1200 — **0.0056%** shipped against **0.7571%**, a **135×**
separation on identical rects.

---

## Provenance: which page a number came from

🚩 **The defect this exists for, stated plainly.** A G4 high-pass sigma of **1.9495/255** was
measured on `packages/testbed/src/skin.html` — a different page, different framing, different rig —
and then recorded in the punch list as certifying `alive.html`, which measures **1.4764** at the
same width. The two plates were never comparable. Nothing in the report said so, so nothing could
catch it.

Every report now carries a provenance block, and every gate carries a `measuredOn` string beside
its number — because gate blocks get copied out of reports one at a time, into punch lists, commit
messages and other agents' briefs, and a number that travels without its page is exactly how this
happens.

```
$ node tools/critic/measure.mjs captures/plate/frames/frame-00001.png regions.lighting-portrait.json --human
/…/frames/frame-00001.png
900×1200, 8-bit
measured on: /alive.html?bare=&freeze=&capture=1&seed=1  900×1200  seed 1  webgpu
regions:     /…/tools/critic/regions.lighting-portrait.json
```

It is found automatically: `capture.mjs` writes `capture.json` beside the frames and `measure.mjs`
walks up from the image to find it, so a plate captured the normal way needs no extra flag. For a
screenshot taken any other way:

```
--page <text>          what page/framing this plate is
--provenance <path>    an explicit capture.json instead of the discovered one
```

With neither, the report stamps `UNKNOWN PAGE` on every gate and warns that none of its numbers may
be quoted as certifying anything. That warning is deliberate friction.

⚠️ `blind_ab.mjs` strips PNG provenance chunks by design, so a blinded plate is anonymous — measure
before you blind, not after.

---

## Region spec

See [`regions.example.json`](regions.example.json), which is documented inline. Shape:

```json
{
  "units": "normalized",
  "imageWidth": 3840,
  "regions": {
    "faceKey": { "note": "why this rect", "rects": [{ "x": 0.428, "y": 0.46, "w": 0.03, "h": 0.03 }] },
    "faceShadow": [{ "x": 0.535, "y": 0.46, "w": 0.03, "h": 0.03 }]
  }
}
```

- **`units`** — `"normalized"` (fractions of width/height, survives a resolution change) or
  `"pixels"` (default).
- **`imageWidth`** — optional, only used to warn on resolution drift.
- Keys beginning with `_` are ignored, at both the top level and inside `regions`. JSON has no
  comments; this is the substitute.
- A region is either a bare array of rects or `{ note, rects }`. Multiple rects are unioned, which
  is how you sample a cheek without catching a nostril.
- Rects outside the image are rejected outright rather than clamped, because a clamped rect
  measures the wrong pixels and still returns a confident number.

**A gate whose regions are missing reports `SKIP`, not `FAIL`**, and skips never count toward the
failure total — so a partial spec is a legitimate thing to hand in while a scene is being built.

Regions may legally overlap but should not: two gates sampling the same pixels means one
measurement is standing in for two independent claims, and a fix that moves one silently moves
the other.

### Where to aim the rects

| region | gate | aim it at |
|---|---|---|
| `faceKey` | G1 | lit mid-cheek, diffuse only — no T-zone specular, no rim light |
| `faceShadow` | G1 | core shadow on the mirrored cheek — not the terminator, not hair shadow |
| `sclera` | G2 | between iris and canthus — clear of catchlight, limbal ring, lash shadow |
| `cheek` | G2 | skin near the eye, under the same light as the sclera |
| `litSkin` | G3 | fully lit skin, **same key** as `shadowTerminator` |
| `shadowTerminator` | G3 | the turning band itself; a backlit ear is the strongest signal |
| `flatCheek` | G4 | flattest, most evenly lit skin in frame — one gradient or stray hair and σ lies |
| `frame` | G5, G6 | optional. Only to exclude a UI overlay or letterbox bar |

Warnings appear in `report.warnings` for things that make a measurement *untrustworthy* rather
than merely failing — a non-composited capture with transparent pixels, or a resolution mismatch.
Read those before blaming the render for a red gate.

---

## blind_ab.mjs — blind A/B

An agent asked to compare "our render" against "the reference" knows which is which, and that
knowledge contaminates the verdict in both directions: flattery and overcorrection. So take the
knowledge away.

```bash
node tools/critic/blind_ab.mjs pair ours.png reference.png --label "phase3 skin"
# -> {"sessionId":"20260807T104233-a1b2c3d4","imagesDir":"/tmp/sugata-blind-ab/2026...", ...}

#   ... critic looks at a.png and b.png and records a verdict naming A or B ...

node tools/critic/blind_ab.mjs reveal 20260807T104233-a1b2c3d4
node tools/critic/blind_ab.mjs list        # ids and labels only, never the mapping
```

What it actually guarantees:

- **Order is random** per pairing, from `crypto.randomInt` — not seeded, so it cannot be
  reconstructed from anything left in a log.
- **The key lives outside the image directory.** Images go to `<root>/<sessionId>/{a,b}.png`; the
  mapping goes to `<root>/<sessionId>.key.json`, one level up. Listing the image directory shows
  two files and nothing else.
- **Provenance chunks are stripped** — `tEXt`, `zTXt`, `iTXt`, `tIME`, `eXIf`. Source filenames,
  authoring software and timestamps all live in those.
- **Blinding is pixel-lossless.** Chunk-level surgery, no re-encode, so the same images can go
  straight on to `measure.mjs` without the blinding step having changed what gets measured.
- **`list` never prints the mapping**, so it is safe to run mid-experiment.

What it cannot do for you:

- 🚩 **Matching dimensions are your job.** Different resolutions are an obvious tell. The tool
  warns when the two differ, but it will not resize them — resampling would change the pixels, and
  G4 in particular does not survive that. Render and crop both to the same size first.
- Framing, crop, aspect and background are equally strong tells. Match them.
- Nothing stops a critic reading the key file early. This is a discipline aid, not a sandbox:
  **record the verdict before revealing.**

Default root is `<tmpdir>/sugata-blind-ab`; override with `--root`.

---

## capture.mjs — deterministic video capture

The other tools in here judge a still frame. **Aliveness is not in a still frame.** Two review
passes in a row stalled on exactly this and one of them said so plainly: *"I have zero perceptual
evidence about whether the motion reads as alive in continuous time. That is the single biggest
gap and no amount of stills closes it."* This tool closes it.

```bash
# needs a dev server; with no --url it starts vite itself
node tools/critic/capture.mjs --url http://localhost:5173/alive.html \
     --seconds 20 --fps 30 --width 1080 --height 1350 --seed 1 --out captures/idle

node tools/critic/capture.mjs --help
```

Four files land in `--out`:

| file | what it is for |
|---|---|
| `capture.mp4` | h264 / yuv420p. Scrub it, step it frame by frame, loop it. |
| `capture.gif` | palettegen + paletteuse. Drops into a comment or a chat window. |
| `contact-sheet.png` | evenly-spaced frames, tiled and time-stamped. **A reviewer that cannot play video can still read this.** |
| `capture.json` | the manifest: seed, backend, adapter, every frame's SHA-256, reproducibility result. |

### It does not record in real time, and that is the point

The page is loaded with `?capture`, which stops its frame loop; this process then becomes the
clock: `step(1/fps)` → screenshot → repeat. Simulation time is completely decoupled from
wall-clock time, which buys three things a screen recording cannot:

- **Exact.** 20.000 s at 30 fps is 600 frames. Not 597, not 611 — regardless of how slow the
  machine is or how long a screenshot takes. Expect roughly 4× real time to capture, and stop
  caring, because the output is identical either way.
- **Immune to rAF throttling**, background tabs and thermal state.
- **Byte-reproducible.** Same seed, same frames.

> 🚩 For the record, since it motivated this tool: rAF was **measured at 120 Hz** in Playwright's
> headless Chromium, not the ~1.5 Hz that made stills the only option for earlier passes. Whatever
> throttled those, it was not this harness. Fixed-step is still the right design — for exactness
> and reproducibility, not to dodge a throttle.

### Reproducibility is measured, never claimed — and the check itself had to be measured

Every run reloads the page and replays its opening frames (`--verify-frames`, default 20; pass
`--verify-frames 600` to replay everything, or `--skip-verify`). The digest line says which:

```
digest    4dea42b8659a3514   (reproducible within tolerance: 30/30 bit-identical, worst residue 0 px at Δ0/255)
```

🚩 **It used to compare SHA-256 digests, and that made it a false-negative generator.** A hash
equality test is a boolean over the last code value of the last pixel, and as the verdict on a GPU
render it reported "NOT byte-reproducible" on **8 of 10 runs of an unchanged clean plate**,
diverging at frames 8, 11, 14, 15, 21, 21, 22 and 24. A flaky check on the observation instrument
poisons everything downstream, so the residue was measured rather than argued about. Six
independent browser processes, `/alive.html?bare&frame=body`, 350×600, seed 1, 30 frames, decoded
and differenced pixel by pixel:

| plate | frames bit-identical | worst frame |
|---|---|---|
| as shipped | 29 of 30 | 44 px of 210,000 (**0.021%**) at **Δ3/255** |
| `?msaa=0` | 29 of 30 | 1 px at Δ1/255 |
| `?cards=0` | **30 of 30** | — |

So the render is deterministic to within the alpha-to-coverage resolve on the two hair cards, and
the digest was reporting that dust as a determinism failure. **Attributed by toggle, not by
argument** — that is what `?cards=0` is for.

The check now differences **decoded pixels** against a tolerance of **Δ6 code values AND 0.1% of
pixels**, both sized from that measurement: 2× and ~4× the observed residue, and 40× / 257× below
a different seed (Δ249 on 25.75% of pixels). The bit-identical frame count survives as a reported
fact — it is the strictest available statement and it is genuinely informative — it just is not
the verdict. `compareFrameSequences` is exported and `selftest.mjs` proves it in both directions on
synthetic plates carrying the measured magnitudes, including that the code-value half alone misses
a wide shallow change and the area half alone misses a deep narrow one.

### ⚠️ Two clips are comparable only if their BUILDS match

The watcher-off vite this tool starts pins the tree for **one run**. Two runs launched minutes
apart in a fan-out are of **different code**, and until now nothing said so. Measured: twelve
captures at seed 1, six before a concurrent agent saved `FacialIdle.js` and `HandIdle.js` and six
after — **within** either group the worst difference is Δ3/255 on 0.021% of pixels; **across** the
groups it is Δ**209**/255 on **0.391%**. A factor of seventy, between two clips that looked like a
repeat of the same capture.

`capture.json` now carries a `source` block — git HEAD plus a content hash of every file under
`packages/` that vite can reach. **Check it before any A/B:**

```
node -e "console.log(require('./captures/a/capture.json').source.packagesDigest)"
```

Six back-to-back runs while this was being written produced **three** distinct digests.

That check is not ceremony. It has caught, in order:

1. a **compositor race** — the screenshot beat presentation and returned the *previous* frame.
   Invisible in the video (idle motion is millimetres) but it made every capture temporally
   wrong, and it inflated the mp4 3× and the gif 10× because consecutive frames no longer
   predicted each other.
2. **three's node clock** reading `performance.now()`, so wall-clock time re-entered through
   the renderer even with the frame loop stopped.
3. a **frozen-skinning bug** where stopping the frame loop also stopped the update that refreshes
   skinning. The figure rendered a still pose while the eyes blinked and the strip chart animated
   — deeply convincing, and it scored *perfectly* reproducible, because a still image always does.

Number 3 is the reason this section exists. **A reproducibility number on its own can be a lie;
look at the contact sheet too.**

> ⚠️ The instrumented page (no `?bare`) prints `stats.frameMs`, a wall-clock number living in the
> pixels — but the failure is **intermittent, not certain**, and the reason is worth knowing.
> `?capture` detaches the rAF loop that assigns `stats`, so the HUD is **frozen** at whatever the
> last pre-load frame saw: constant *within* a run, and different *between* runs only when the load
> happened to land on a different millisecond. Measured twice on `/alive.html?frame=body`, same
> seed, same build digest: one pair came back **Δ0, bit-identical**; the other **Δ41/255 on 64 px
> (0.030%)** — over the code-value tolerance, under the area one, correctly reported as not
> reproducible. Capture with `?bare` regardless: a plate a critic looks at should not have
> instrumentation in it, and a check that fails one time in two is a check people learn to ignore.

### Which page to capture

Both are worth having, and they answer different questions:

| URL | use it for |
|---|---|
| `alive.html` | judging aliveness. The HUD and strip chart are *evidence* — blink counts, breath phase, head yaw — that a bare render cannot give you. |
| `alive.html?bare` | a clean plate: pixels only, no instrumentation. Feed this to `measure.mjs` or `blind_ab.mjs`, and use it when the digest matters. |

Everything else in the URL is preserved, so `?gender=0.75`, `?height=0.18` and `?webgl` all work;
capture only adds `capture=1` plus `--seed` / `--preroll`.

### Backend, stated not assumed

The tool reads the backend back off the renderer and re-requests the adapter, then prints it:

```
backend   webgpu   (apple metal-3)
```

If the page silently falls back to WebGL2 it says so loudly rather than presenting fallback-tier
pixels as a WebGPU capture, and it flags a software rasteriser masquerading as a GPU. Launch flags
are inherited from `tools/spikes/run.mjs`, whose measured findings still hold — `channel:
'chromium'` matters (plain headless is `headless_shell`, which has no GPU), and
`--enable-features=Vulkan` **removes** WebGPU on macOS, so it is deliberately absent.

### Contact sheet

`--sheet-cells` (12) and `--sheet-columns` (4). Cells run in reading order and each is stamped
`f<frame> <time>s`, so a cell can be found in the mp4 by scrubbing to that timestamp. The stamps
are drawn by `capture.mjs` with a small bitmap font over `png.mjs`, because this ffmpeg build has
no `drawtext` (no libfreetype) — an unlabelled sheet makes a reviewer guess which cell is which,
and guessing is what this harness exists to remove.

### Known limits

- **Playwright is not a dependency of this repo.** It is found via `--playwright`,
  `PLAYWRIGHT_MODULE`, a plain import, or npx's cache. `npx playwright install chromium` first.
- **ffmpeg is expected at `/opt/homebrew/bin/ffmpeg`**; override with `FFMPEG=<path>`.
- **GIFs of a 20 s 1080-wide portrait are large** (~25 MB). `--gif-fps` and `--gif-width` are the
  knobs; the mp4 is the artefact to prefer when a player is available.
- **`--out` is not in `.gitignore`.** Add `/captures/` before committing, or write outside the repo.
- **Frames are deleted after encoding** unless `--keep-frames`. 600 PNGs at 1080×1350 is ~600 MB.
  `heatmap.mjs` reads that sequence, so a capture you intend to heat-map must keep it.
- Exit codes match the rest of the harness: `0` fine, `1` every frame identical (the stepping hook
  did nothing, so the capture is not evidence), `2` tool error.
- **`?capture` reaches into two private three.js internals** (`renderer._animation` and
  `renderer._nodes.nodeFrame`) — see `takeOverFrameLoop()` in `packages/testbed/src/alive.js`. If a
  three upgrade renames either, capture falls back to leaving rAF running: correct pictures, no
  bit-exactness, and a console warning saying so. It will never silently return to the frozen pose.

---

## heatmap.mjs — per-pixel temporal-σ heat map

`capture.mjs` gives you motion you can watch. **Watching is not the same as seeing.**
[`docs/LEARNINGS.md`](../../docs/LEARNINGS.md) §1.10 is the reason this tool exists: a **dead lower
body showed as a hard horizontal cut at the hip line, unmissable, in one image** — after no still
had revealed it and no amount of playing the clip had either. A reviewer watching ninety seconds
will forgive a motionless thigh for all ninety of them. That diagnostic had only ever been done by
hand; this is the tool.

```bash
node tools/critic/heatmap.mjs captures/idle-body
node tools/critic/heatmap.mjs captures/idle-body --normalise 8.42 --bands 12 --dead 0.5
node tools/critic/heatmap.mjs captures/idle-body --json captures/idle-body/heatmap.json
node tools/critic/heatmap.mjs --help
```

Point it at a capture directory — it descends into `frames/` automatically — or at any directory of
numbered PNGs. **`capture.mjs` only keeps its frame sequence with `--keep-frames`**, so pass that
at capture time or there will be nothing here to read.

It writes `<capture-dir>/heatmap.png` (override with `--out`) and prints the scale and a per-band
table to stdout.

### What it measures

**The temporal population standard deviation of encoded Rec.709 luma at each pixel, in 8-bit code
values** — so σ = 1.0 means one code value, and the number is directly comparable to G4's
"1.5–2.1 / 255" above. Encoded rather than linear for the reason in the luma-domain section: this
is a perceptual *"did it visibly change?"* question, not a ratio of light. Population σ, not
sample σ, because the clip **is** the population.

Accumulated with **Welford's online update**, one streaming pass, one frame in memory at a time —
so a 2700-frame capture is tractable. That is not fastidiousness: the signal is a variance of order
one code value riding on a mean of order a hundred, and a naive Σx² accumulator ends by subtracting
two nearly-equal large numbers, cancelling away exactly the low bits that are the answer. The
self-test measures the gap — Welford's error on the same data is 3.1e-15 against a float32 Σx²
accumulator's 3.3e-2.

### The band table

The frame is split into horizontal bands — horizontal because the failure this exists to catch is
anatomical and stacked vertically: head, chest, hips, thighs, feet. A hard cut at the hip line
falls on a band boundary and shows up as a step in one column of numbers.

| column | meaning |
|---|---|
| `moving` | fraction of the band that changed at all (σ > 0 exactly) |
| `mean σ` / `p99 σ` / `max σ` | over *moving* pixels only |
| `dead%` | fraction below `--dead` (0.5), over **all** pixels in the band |

Static pixels are left out of the means and kept in the dead fraction, deliberately: a bit-identical
pixel is either the flat backdrop of a `?bare` capture or a limb that never moved, and luminance
alone cannot tell those apart. Averaging them in would drag every band toward zero and make bands
incomparable; dropping them from `dead%` would hide the frozen limb, which is the entire point.

The `--dead` default of **0.5 code values is derived, not tuned**: a pixel that moves by a single
code value on *k* of *N* frames has σ ≈ √(k/N), so σ < 0.5 means it failed to move one quantisation
step in more than a quarter of the clip. It also sits well under G4's flat-skin σ of 1.5–2.1, so
ordinary render grain never reads as motion.

A band at least `--dead-band-fraction` (0.9) dead gets a loud `*** DEAD BANDS:` callout. Not 1.0,
because a dead limb still has a lit edge and a contact shadow that flicker, and demanding literal
totality would let a statue with a twitching hem pass unremarked.

### ⚠️ `--normalise auto` is for looking, a pinned scale is for reading

Auto puts **p99.9 of the moving pixels** at the top of the ramp (the true maximum is printed
alongside). Two consequences worth knowing before you trust a map:

- **Silhouette edges dominate.** An antialiased body edge against a dark backdrop swings nearly the
  full code range as it sweeps, so p99.9 is set by the outline, not by the body. To read *interior*
  motion — a chest rising, a thigh that should be shifting — **pin the scale** with
  `--normalise <σ>` at something the interior actually reaches. The report prints a
  `pin with --normalise <σ>` line for exactly this.
- **Two clips are only comparable on the same scale.** Under auto, a clip with half the motion of
  another renders identically, because each is normalised to its own maximum. Pin both.

The ramp is black → dark red → orange → amber → white, and it is 🚩 **deliberately not a rainbow**:
a rainbow is not monotonic in luminance, so a mid value looks hotter than a high one and the
reader's eye reverses the ordering the data has. These stops rise strictly in encoded luma
(0.000 → 0.176 → 0.383 → 0.725 → 1.000), and `heatmap.selftest.mjs` asserts that rather than
trusting it to stay true if someone edits them.

### Exit codes

| code | meaning |
|---|---|
| 0 | heat map written, the picture moved |
| 1 | the clip is not evidence — σ is 0 everywhere, or `--fail-on-dead-bands` and a band is dead |
| 2 | tool error — no frames, mismatched frame sizes, unreadable PNG |

`--fail-on-dead-bands` is what turns a diagnostic into a gate. Without it a dead band is reported
loudly and still exits 0, because a heat map is usually something you read rather than something
that blocks you.

A frozen clip gets its own banner ahead of the dead-band list, because **a σ map of a frozen clip
is a perfectly plausible-looking black rectangle** and a reader who meets "DEAD BANDS: 1..10" first
will start reasoning about anatomy instead of about the capture. That is §1.3 again — the same
failure that once let `capture.mjs` score perfectly byte-reproducible while rendering a still pose.

### Options

| flag | default | what it does |
|---|---|---|
| `--out <path>` | `<capture-dir>/heatmap.png` | where the heat map goes |
| `--json <path>` | — | the same numbers, machine-readable, for a gate script |
| `--normalise auto\|<σ>` | `auto` | σ at the top of the ramp |
| `--bands <n>` | 10 | horizontal bands |
| `--dead <σ>` | 0.5 | dead-pixel threshold, code values |
| `--dead-band-fraction <f>` | 0.9 | dead% at which a band gets the callout |
| `--stride <n>` | 1 | use every *n*th frame — for a fast first look at a long capture |
| `--fail-on-dead-bands` | off | exit 1 if any band is dead |

The JSON deliberately omits the σ field itself: it is tens of megabytes of Float64 and the renderer
is its only consumer. Everything a gate script needs is in the summary.

Same frames in, byte-identical PNG out — every value is a pure function of the σ field and the
scale, and `png.mjs` encodes with a fixed filter and deflate level.

---

## Trusting the numbers: `selftest.mjs` and `heatmap.selftest.mjs`

A measurement tool nobody tested is worse than no tool — it produces confident numbers that
quietly steer the whole project wrong. `node tools/critic/selftest.mjs` runs **125 checks** against
synthetic images with known properties, using two kinds of oracle:

**External** — images painted with the literal hex swatches published in the spec, where the tool
must reproduce the luma, saturation and ratio values printed alongside them. The tool cannot be
self-consistently wrong about these, because it did not produce them.

**Analytic** — images generated with a known distribution, expected result derived on paper. For
G4: a 5×5 boxcar high-pass of white noise with per-pixel variance *v* has output variance 0.96*v*
(the centre pixel keeps weight 24/25 and the 24 neighbours contribute 1/25 each, giving
(24/25)² + 24/25² = 600/625). So noise is injected at the σ that must come back as 1.80, and does
— measured 1.797.

Every gate is tested in both directions: the reference values PASS, and a constructed wrong render
FAILs. A 4:1 linear key ratio, a white eyeball, a desaturated blue shadow, a perfectly flat cheek,
photoreal-amplitude pores, 0.8% clipping, and both crushed and lifted blacks all fail as they
should.

The PNG codec is cross-checked against **ImageMagick** across eight variants — 8/16-bit RGB and
RGBA, greyscale at 1, 4, 8 and 16 bits, and palette — comparing our decode against ImageMagick's
own raw pixel dump. All eight agree to the code value. Interlaced PNGs are refused with a clear
message rather than half-decoded into plausible nonsense. That section **skips** rather than fails
when ImageMagick is absent; the tool itself must stay runnable on a bare machine.

`node tools/critic/heatmap.selftest.mjs` runs **57 checks** on the same principle, over synthetic
clips built with a known σ. A six-band noise ladder injected at σ 1.5 / 2.5 / 4 / 6 / 9 / 13 comes
back at 1.52 / 2.51 / 4.00 / 5.98 / 8.98 / 12.96; Welford is checked against a two-pass float64 σ to
machine precision, and against a naive float32 Σx² accumulator that is **thirteen orders of
magnitude** worse on the same data (3.3e-2 against 3.1e-15). §1.1 is honoured throughout — the
ramp's monotonicity check is run against
a **rainbow ramp as known-bad input** and correctly reports 102 reversals, and a clip with a
synthetic dead lower half is confirmed to put the cut on exactly the row it was injected at.

---

## Files

| file | what it is |
|---|---|
| `measure.mjs` | the seven gates, the provenance block, plus the CLI |
| `blind_ab.mjs` | blind A/B pairing and reveal |
| `capture.mjs` | fixed-step video capture — mp4, gif, contact sheet, manifest |
| `heatmap.mjs` | per-pixel temporal-σ heat map of a captured clip, plus the band table |
| `travel.mjs` | horizontal centroid of the silhouette per frame — how far the body moved, in pixels |
| `travel.selftest.mjs` | 111 checks: analytic oracles for known translations, plus degenerate inputs |
| `color.mjs` | sRGB transfer functions, both lumas, HSV — read the header comment |
| `png.mjs` | dependency-free PNG decode/encode and chunk surgery |
| `selftest.mjs` | 125 checks over the gates, the provenance stamp, the frame comparison and the codec; run it after touching anything here |
| `heatmap.selftest.mjs` | 57 checks over `heatmap.mjs`; run it after touching that |
| `regions.example.json` | documented region spec template |

## Known limits

- **Non-interlaced PNG only.** Adam7 is refused, not supported.
- **G4 is not comparable across resolutions.** Capture at 3840 wide for a gate run.
- **G6 works at the 8-bit quantisation floor.** The 0.004 band edge is code value 1.
- **`heatmap.mjs` needs the frame sequence**, which `capture.mjs` only keeps with `--keep-frames`;
  and its `--normalise auto` is set by silhouette edges, so **pin the scale to read interior
  motion**. It also cannot distinguish a static backdrop from a frozen limb — luminance alone does
  not carry that difference, which is why the band table reports `moving` and `dead%` separately.
- **The gates are necessary, not sufficient.** Six numbers cannot tell you the face reads as the
  right character. That is what `blind_ab.mjs` and a human are for. Passing all six is the price
  of entry to the subjective comparison, not a substitute for it.
- Gate constants live in the `TARGETS` block in `measure.mjs`. They are measurements of the
  reference, not preferences — **if a target has to move, the spec moves first and this file
  follows it.**
