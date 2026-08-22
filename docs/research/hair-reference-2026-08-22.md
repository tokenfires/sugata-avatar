# The reference groom, re-measured on four masks and two domains

**Round:** 2026-08-22. **Pinned revision for every read:** `5bba1bb`.
**Tool:** `tools/critic/hair-reference.mjs` (new this round; uses `tools/critic/png.mjs`,
`tools/critic/color.mjs` and `tools/critic/lightpath-probe.mjs`, so "luma" means what the gates
mean by it).

**Every table below is produced by one command.**

```
node tools/critic/hair-reference.mjs --reference <scratch> --ours captures/hair-r27-pedestal
```

where `<scratch>` holds `overview_character.reference.png` and `post_ms7_08.reference.png`,
converted from the official-site JPEGs with `sips -s format png`.

⚠️ **The reference plates are copyrighted by SHIFT UP / Sony Interactive Entertainment.** Internal
comparison reference only. Both were fetched to the session scratchpad, nothing was written into
the repository, and the tool takes their directory as an argument rather than embedding a path.
Fetched this session: `stellar-blade.com/resources/front/images/overview_character.jpg`
(HTTP 200, 1,684,311 bytes, `sips` reports 3200x1841, `profile: sRGB IEC61966-2.1`) and
`.../post_ms7/08.jpg` (HTTP 200, 5,513,405 bytes, 3840x2160, same profile). Both match the
Appendix's description of the assets hair.md's measurements were taken on.

---

## 0. The headline, corrected

The round placed §2.1's reference **fringe rect** beside §9.2's **whole-groom mask** and read
*"our shipped hair's median pixel is 3.43x brighter than the reference's, at a third of the
reference's dynamic range."* Re-measured with both sides on the same population:

| statement | figure | mask | domain |
|---|---:|---|---|
| what the round said | 3.43x | ours whole-groom ÷ reference **fringe rect** | encoded |
| **ours / reference, same population** | **1.03x** | both whole-hair, `captures/hair-r27-pedestal` | encoded |
| the same on §9.2's own published p50 | 0.83x [D] | 0.1825 ÷ 0.2195 | encoded |

| statement | figure | domain |
|---|---:|---|
| what the round said, dynamic range | 0.33x (1.648 ÷ 4.936) | encoded |
| **ours / reference, same population** | **0.58x** (1.716 ÷ 2.965) | encoded |
| the same in "as-if-ours" radiance | **0.38x** (1.977 ÷ 5.167) | radiance, §3 |

> 🎯 **The 3.43x is an artefact of mask choice and it does not survive. The dynamic-range
> shortfall is real, and it is about half rather than a third — in encoded luma. In radiance it is
> about a third after all, and the two numbers are not interchangeable.** §5 has the verdict split
> by cause.

---

## 1. The method reproduces three published tables before it is trusted anywhere

Four controls, all exact, before a single new number is quoted. Two of them are on a plate the
tool was not built against.

| control | published | measured here | verdict |
|---|---|---|---|
| §2.1 fringe rect `[1480,540]-[1700,610]`, n | 15,400 | 15,400 | ✅ |
| §2.1 fringe p05 / p50 / p95 / p99 | 0.0216 / 0.0532 / 0.2626 / 0.4886 | 0.0216 / 0.0532 / 0.2626 / 0.4886 | ✅ exact |
| §2.2 crown `[1400,380]-[1660,440]` p50 / p95 / p99 | 0.3564 / 0.7228 / 0.8609 | 0.3564 / 0.7228 / 0.8609 | ✅ exact |
| §2.2 second band `[1400,290]-[1660,350]` p95 / p99 | 0.4102 / 0.4995 | 0.4102 / 0.4995 | ✅ exact |
| §0.3 ponytail bands on `post_ms7/08`, three p50 hexes | `#ab512f` / `#27403c` / `#2e3629` | identical | ✅ exact |

🚩 **§0.3's "p50 hex" is the MEDIAN-LUMA PIXEL, not the per-channel median, and the difference is
big enough to look like a decode bug.** Per-channel medians on the same three rects give
`#ac5036`, `#383b35`, `#2c3726` — the middle one is 17 code values out on red. Recorded in the
tool because "the p50 of a colour" has two meanings and this round spent a measurement finding out
which one hair.md uses.

---

## 2. The reference on four masks — ENCODED luma

The domain of §2.1, §2.2 and §9.2, and of the look spec (`color.mjs`'s header records the
verification). Rec.709 coefficients on the sRGB-encoded triple straight out of the file.

| mask | n | p05 | p25 | p50 | p75 | p95 | p99 | mean | p95/p50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fringe rect §2.1 | 15,400 | 0.0216 | 0.0372 | 0.0532 | 0.0834 | 0.2626 | 0.4886 | 0.0829 | **4.936** |
| fringe rect, hair only | 6,600 | 0.0210 | 0.0345 | 0.0490 | 0.0751 | 0.1747 | 0.2562 | 0.0647 | **3.565** |
| crown band §2.2 | 15,600 | 0.0396 | 0.2365 | 0.3564 | 0.5222 | 0.7228 | 0.8609 | 0.3750 | 2.028 |
| second band §2.2 | 15,600 | 0.0718 | 0.2211 | 0.2965 | 0.3421 | 0.4102 | 0.4995 | 0.2756 | 1.384 |
| **whole-hair, eroded 3 px** | 168,968 | 0.0221 | 0.0635 | **0.2195** | 0.3452 | 0.6508 | 0.7892 | 0.2440 | **2.965** |
| whole-hair, eroded 25 px | 130,699 | 0.0245 | 0.0743 | 0.2496 | 0.3735 | 0.6633 | 0.7990 | 0.2645 | 2.658 |

### 2.1 🔴 §2.1's fringe rect is not all hair, and its bright tail is SKIN

Of the 771 pixels in the fringe rect's top 5%, **616 lie in x ∈ [1520,1560], 141 in
x ∈ [1660,1680] and 14 in x ∈ [1640,1660]**, and **769 of the 771 lie below y = 570** — two
patches of lit forehead skin showing through the fringe tips, plainly visible in a 4x crop. §2.1's own p99 hex
`#96757e` (R 150, G 117, B 126) is that skin.

> **So the 4.936 that anchors the round's dynamic-range claim is a skin-to-hair ratio.** The same
> rect's top 30 rows — 2 of those 771 pixels — read **3.565**. That is the reference fringe's own
> dynamic range and it is 28% lower.

### 2.2 How the whole-hair mask was built, and what it is not

A hand-drawn 19-vertex polygon over the contiguous hair cap, vertices in the tool, eroded before
use. It is a polygon and not a colour rule **because a colour rule provably fails on this frame**:
the reference's lit crown is blue-dominant (a pixel at (1530,410) reads R 78, G 82, B 111 — the R
lobe wearing the teal practicals' colour, §0.3's finding) while its shadowed fringe is
red-dominant (§2.1a's four reads). The brightest hair in the frame is the same hue as the
background behind it, so no single chroma threshold separates them.

- **Includes:** the lit crown, both sheen bands, the shadowed fringe, the fringe tips.
- **Excludes:** the side falls and ponytail over the background, the wisps over the cheeks, the
  blue hair ornament at the left temple, and the antialiased silhouette transition.
- **It is the groom's INTERIOR** — which is the population our own solid-hair mask is too, and
  that is the point.

Both erosions are printed as a sensitivity check on the boundary. From 3 px to 25 px the mask
loses 38,269 px and p50 moves 0.2195 → 0.2496 (+13.7%) while p95/p50 moves 2.965 → 2.658 (−10.4%).
The 25 px core is visibly pure hair; it also clips the darkest fringe tips, which is why it reads
brighter. **Quote the 3 px row and carry the 25 px row as the bound.**

---

## 3. The domain question, and the honest limit on it

Three columns, three different quantities, all off the same pixels:

| mask | encoded p95/p50 | display-linear p95/p50 | "as-if-ours" radiance p95/p50 |
|---|---:|---:|---:|
| fringe rect §2.1 | 4.936 | 13.375 | 5.073 |
| fringe rect, hair only | 3.565 | 6.728 | 3.280 |
| crown band §2.2 | 2.028 | 4.587 | 3.595 |
| second band §2.2 | 1.384 | 1.950 | 1.558 |
| whole-hair (−3 px) | 2.965 | 9.474 | **5.167** |
| whole-hair (−25 px) | 2.658 | 7.759 | 4.654 |

**The transfer chain, stated.** Encoded → display-linear is the sRGB EOTF (IEC 61966-2-1) undone,
per channel, then Rec.709. Display-linear → "as-if-ours" radiance is
`lightpath-probe.mjs`'s `inverseAces` at exposure 1 — the analytic inverse of the same
`RRTAndODTFit` three r185 applies, the one `HairMaterial.selftest.mjs` round-trips to machine
precision between its two clamps. Pixels at either clamp carry no information to invert and are
dropped from the radiance column only: 60 / 14 / 563 / 286 / 2,859 / 1,970 px respectively.

### 3.1 🔴 What "as-if-ours radiance" is, and what it is not

**It is not SHIFT UP's radiance and this tool cannot recover it.** The reference is a JPEG of a
shipped game frame: it has already been through their tone curve, their grade and JPEG
quantisation, none of which we have. Running OUR ACES inverse over it answers a different
question — *"what would OUR renderer have to emit to land on these codes?"* — which is a
defensible quantity, because it is exactly the target a shader author on this pipeline aims at.
It is **not** the same quantity as §9.4's rows, which are our own pre-tone-map radiance.

`HairMaterial.selftest.mjs` already flags this exact step as the one place in the project that
needs the assumption ("*a plate whose transfer nobody here knows; converting it with OUR ACES
assumes the two agree*"). This round does not remove the assumption; it isolates it to one column
and prints the other two beside it.

### 3.2 The closest defensible statement about §9.4

§9.4's green rows are our own radiance p95/p50: shipped **1.872**, key on the camera axis
**4.291**, narrow β_R **6.030**, both **8.015**, against a gate floor of 4.0.

> **The reference groom's whole-hair p95/p50, carried into our radiance domain, is 4.65–5.17.**
> That sits between §9.4's "key on the camera axis" row (4.291) and its "narrow β_R" row (6.030),
> and it is nowhere near 8.015. Read at face value it says the **gate floor of 4.0 is about where
> the reference actually lives, and stacking both fixes overshoots it.**
>
> ⚠️ **This is a same-ballpark statement, not an equality.** The two numbers ran through two
> different tone curves and only one of them is ours. Do not write "the reference is 5.17 and we
> are 1.977, so we are 2.6x short" into a gate. Write: *both fixes are not needed; either one
> alone lands in the reference's neighbourhood* — and note that §9.4 already measured that each
> clears the gate alone.

**4.936 and 8.015 still cannot be strictly compared, and now there are two reasons rather than
one.** 4.936 is encoded, 8.015 is radiance — and 4.936 is also a fringe rect whose bright tail is
skin. The nearest same-domain pairing that means anything is **5.167 (reference whole-hair,
as-if-ours radiance) against 1.977 (ours, shipped, same statistic, our own radiance)**, with the
curve caveat above attached to it.

---

## 4. Our plate on the matched mask

**Plates:** `captures/hair-r27-pedestal/trapg-s*.png` — the graded scatter sweep, 720x900,
`toneMappingExposure` 4. **This is the only graded scatter sweep in `captures/` on this machine**
(`grep -l 'hairscatter=4' captures/*/manifest.json` returns that directory alone). No plates were
rendered this round.

**Mask:** `hair-pedestal.report.mjs`'s, operation for operation — `buildGroomMask` on the
`?shadows=0` pair, eroded 2 px, then restricted to pixels that are invertible on `floor.png` and
whose floor radiance is below `HAIR_SHADED_MAX = 1.5e-2`. **264,514 px → 235,564 px.**

🚩 That third filter is not cosmetic. Dropping it — keeping every eroded-groom pixel — moves the
scatter-0 arm's p95 from **0.2854 to 0.5668** and would have doubled the apparent dynamic range,
because a groom-mask pixel whose no-lobe, no-pedestal value is bright is a pixel where something
*behind* the groom resolved. Counting those measures the background's range and calls it hair's.

| arm | p05 | p25 | p50 | p75 | p95 | p99 | mean | p95/p50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| scatter 0.00 | 0.0042 | 0.0149 | 0.1031 | 0.1888 | 0.2854 | 0.3363 | 0.1146 | 2.768 |
| scatter 0.25 | 0.0307 | 0.0579 | 0.1377 | 0.2197 | 0.3130 | 0.3612 | 0.1483 | 2.273 |
| **scatter 1.00 (shipped)** | 0.1101 | 0.1660 | **0.2255** | 0.3003 | 0.3869 | 0.4274 | 0.2350 | **1.716** |
| scatter 4.00 | 0.3191 | 0.4174 | 0.4697 | 0.5275 | 0.5833 | 0.6206 | 0.4629 | 1.242 |

*(encoded luma, 235,564 px; the 0.125, 0.50 and 2.00 arms are in the tool's output.)*

⚠️ **These are NOT §9.2's plates and they do not reproduce §9.2's levels.** §9.2 read 255,850 px
and p50 0.0644 / 0.1825 / 0.4306 for scatter 0 / 1 / 4; this capture reads 235,564 px and 0.1031 /
0.2255 / 0.4697. The **ratios** track (p95/p50 3.000 → 2.768, 1.648 → 1.716, 1.223 → 1.242) and the
levels do not. `hair-r27-pedestal` postdates §9.2's table — it carries the `#1A0E0C` albedo and the
lock tilt — and hair.md §9.6 already records that **cross-session plates are not comparable on this
build**. Both are quoted below, each labelled with its capture.

---

## 5. The verdict

`ours / reference`, same statistic, same domain, encoded luma. Every cell is arithmetic on the two
tables above.

| our arm | ÷ fringe rect §2.1 | ÷ fringe, hair only | ÷ crown band | ÷ whole-hair (−3 px) | ÷ whole-hair (−25 px) |
|---|---:|---:|---:|---:|---:|
| scatter 0.00, p50 | 1.94x | 2.10x | 0.29x | 0.47x | 0.41x |
| scatter 0.00, p95/p50 | 0.56x | 0.78x | 1.36x | 0.93x | 1.04x |
| **scatter 1.00, p50** | **4.24x** | 4.60x | 0.63x | **1.03x** | 0.90x |
| **scatter 1.00, p95/p50** | 0.35x | 0.48x | 0.85x | **0.58x** | 0.65x |
| scatter 4.00, p50 | 8.83x | 9.58x | 1.32x | 2.14x | 1.88x |
| scatter 4.00, p95/p50 | 0.25x | 0.35x | 0.61x | 0.42x | 0.47x |

### 5.1 Is "3.43x" real?

**No. It is an artefact of mask choice, almost entirely.** [M/D]

- Against the reference **fringe rect**, this capture reads **4.24x** — the same shape of number
  the round quoted, and higher, because this capture is a brighter build than §9.2's.
- Against the reference **whole-hair mask** — the matched population — it reads **1.03x**
  (0.90x on the conservative core). On §9.2's own published p50 the matched figure is **0.83x** [D]
  (0.1825 ÷ 0.2195).
- The gap between 4.24x and 1.03x is entirely the denominator: the reference's fringe p50 is
  0.0532 and its whole-hair p50 is 0.2195, a factor of **4.13**. A fringe is a shadowed region.

> **Corrected figure: our shipped groom's median pixel sits at 1.03x the reference groom's, in
> encoded luma, both on whole-hair interior masks, ours from `captures/hair-r27-pedestal`
> (235,564 px) and the reference's from a 168,968 px polygon on `overview_character.jpg`. On
> §9.2's older capture the same comparison is 0.83x. Our median level is not the defect.**

### 5.2 Is the dynamic-range shortfall real?

**Yes, and it is the finding that survives — but it is smaller than quoted and its size depends
on the domain.** [M]

| pairing | ours | reference | ratio |
|---|---:|---:|---:|
| the round's claim | 1.648 | 4.936 | 0.33x |
| matched mask, encoded | 1.716 | 2.965 | **0.58x** |
| matched mask, encoded, conservative core | 1.716 | 2.658 | 0.65x |
| matched mask, radiance (§3.1's caveat) | 1.977 | 5.167 | **0.38x** |

Three separate corrections pull in two directions and they are worth separating:

1. **Mask** — the reference fringe's 4.936 → whole-hair 2.965. Makes the gap *smaller*.
2. **Skin** — even as a fringe number, 4.936 → 3.565 once the skin patches come out. Makes it
   smaller again.
3. **Domain** — encoded 2.965 → as-if-ours radiance 5.167 on the same pixels, a factor of 1.74.
   Makes it *larger*. This is why §0.1's rule is a rule: the same measurement is 2.965 or 5.167
   depending only on which domain you name, and neither is wrong.

> **Corrected figure: our shipped groom reaches 0.58x the reference groom's p95/p50 in encoded
> luma, and 0.38x in radiance, on matched whole-hair masks. Say which.**

### 5.3 What did not change

§9.2's actual argument is untouched by any of this. The gate's dial and the picture's contrast are
still anti-correlated on this capture — scatter 0 → 4 walks p50 from 0.1031 to 0.4697 while
p95/p50 falls 2.768 → 1.242 — and the reference's own whole-hair p95/p50 of 2.965 sits **above**
every arm of the sweep including scatter 0.00's 2.768. **There is no setting of slide 39's scalar
that reaches the reference's dynamic range, which is exactly what §9.2 concluded.**

---

## 6. Marker key and what is absent

- **[M]** every table in §2, §3, §4 and §5 — measured this session by
  `node tools/critic/hair-reference.mjs --reference <scratch> --ours captures/hair-r27-pedestal`.
- **[M]** the fringe rect's skin contamination — the top-5% pixel census in §2.1.
- **[V]** the four published controls in §1, verified against hair.md §2.1/§2.2/§0.3 at `5bba1bb`.
- **[D]** every "ours / reference" cell, and the 0.83x that pairs §9.2's published p50 with this
  round's reference measurement.
- **[I]** §3.2's placement of the reference between §9.4's rows. The tone curves differ and the
  step is flagged wherever it is used.
- **[X] §9.2's own plates are not in `captures/`.** Only `hair-r27-pedestal` carries a graded
  scatter sweep, and it postdates §9.2's table. §9.2's levels could not be reproduced and are
  quoted as published rather than re-measured.
- **[X] SHIFT UP's transfer function.** Not recoverable from a shipped JPEG. Every radiance figure
  for the reference is "as-if-ours" and is labelled so at every use.
