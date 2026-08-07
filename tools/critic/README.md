# tools/critic — the objective critic harness

Two tools that between them stop "does this look right?" from being purely a matter of taste.

- **`measure.mjs`** — reads a PNG and a region spec, returns the six objective gates from
  [`docs/research/stellar-blade-look-spec.md`](../../docs/research/stellar-blade-look-spec.md) §6
  with a PASS/FAIL each.
- **`blind_ab.mjs`** — shuffles our render against a reference, strips provenance, and hides the
  mapping until after a verdict is recorded, so a critic agent genuinely cannot tell which is ours.

No dependencies. The PNG codec is ours (`png.mjs`, ~250 lines over `node:zlib`), which is a
smaller cost than a supply chain sitting underneath the numbers that steer the project's art
direction. Node 18+.

---

## Quick start

```bash
node tools/critic/selftest.mjs                       # prove the tool measures what it claims
node tools/critic/measure.mjs shot.png regions.json  # JSON on stdout
node tools/critic/measure.mjs shot.png regions.json --human
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

## The six gates

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

### G2 — sclera ÷ cheek luma ≈ 0.98 ± 0.06 · *encoded*

> §2 · *"The sclera is NOT white. A white eyeball instantly breaks the look."*

Regions: `sclera`, `cheek`.

The reference sclera measures the same luminance as the cheek beside it (0.483 vs 0.492) and is
*more* saturated than skin, pink-tinted. That comes from heavy lid AO plus sclera SSS — per §5,
achieve it that way, **not** by darkening the sclera albedo, or it goes grey under every other
light. The gate reports both saturations so you can check that too.

**Judged encoded**: it is a perceptual "reads as the same brightness" match, and 0.98 is the
encoded figure the spec measured.

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

## Trusting the numbers: `selftest.mjs`

A measurement tool nobody tested is worse than no tool — it produces confident numbers that
quietly steer the whole project wrong. `node tools/critic/selftest.mjs` runs **79 checks** against
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

---

## Files

| file | what it is |
|---|---|
| `measure.mjs` | the six gates, plus the CLI |
| `blind_ab.mjs` | blind A/B pairing and reveal |
| `color.mjs` | sRGB transfer functions, both lumas, HSV — read the header comment |
| `png.mjs` | dependency-free PNG decode/encode and chunk surgery |
| `selftest.mjs` | 79 checks; run it after touching anything here |
| `regions.example.json` | documented region spec template |

## Known limits

- **Non-interlaced PNG only.** Adam7 is refused, not supported.
- **G4 is not comparable across resolutions.** Capture at 3840 wide for a gate run.
- **G6 works at the 8-bit quantisation floor.** The 0.004 band edge is code value 1.
- **The gates are necessary, not sufficient.** Six numbers cannot tell you the face reads as the
  right character. That is what `blind_ab.mjs` and a human are for. Passing all six is the price
  of entry to the subjective comparison, not a substitute for it.
- Gate constants live in the `TARGETS` block in `measure.mjs`. They are measurements of the
  reference, not preferences — **if a target has to move, the spec moves first and this file
  follows it.**
