# Hairstyle targets — what a bob is, what a men's cut is, measured against the figure

**Reference supplied by the owner 2026-08-17** into `reference/hairstyles/womens bob/` (10 plates)
and `reference/hairstyles/mens hairstyles/` (13 plates, several of them multi-panel).

⚠️ `reference/` is gitignored and has never been committed. **No filename, no absolute path and no
pixel from it appears in this repository** — this file records *parameters extracted by looking*,
which is the same arrangement `docs/research/stellar-blade-look-spec.md` operates under.

🎯 **The owner's own verdict, and it is the brief for this document:** *"The current bob style on the
avatar is still very different than what is in the reference images for a 'bob' hairstyle."* He is
right, it is measurable, and §2 measures it.

---

## 1. The landmark planes on `figure_g050`, so a haircut length can be a NUMBER

Measured tonight by importing the shipped GLB and printing the midline profile in 10 mm bands —
most-forward `y` and half-width per band. Reproduce with `blender --background --python` on any
figure bake; the script is trivial and the numbers below are what it printed.

| landmark | z (m) | how it was identified |
|---|---:|---|
| skull top | **1.6594** | max z of the body mesh |
| eyebrow mesh | 1.5568–1.5672 | the `eyebrow001` object's own extent |
| head bone | 1.5146 | armature |
| `ScalpFrame.hairline_z` | **1.4970** | `low.z + HAIRLINE_LIFT · height`, and note it is 60 mm BELOW the brow — it is the region's own floor, not the forehead hairline |
| teeth | 1.4566–1.5046 | the `teeth_base` object |
| **narrowest neck** | **1.44–1.46** | half-width bottoms out at 49.5–51.1 mm |
| 🎯 **JAW / CHIN plane** | **≈ 1.4350** | **the forward-`y` column jumps −86.9 → −136.9 mm between z 1.430 and 1.440.** A 50 mm step in one 10 mm band is the chin coming off the throat, and it is the sharpest feature in the profile |
| clavicle bones | **1.3425** | armature, left and right identical |
| shoulder | ~1.28 | half-width 260 mm |

And the scalp frame the generator measures everything against, re-derived from the two numbers the
record already carries: `low.z` **1.4866**, `high.z` **1.6594** (which agrees with the mesh's own max
z to four decimals — a free consistency check), `height` **172.8 mm**.

**The conversion every `cut` value below uses:**

```
tip_z  =  hairline_z − cut × height  =  1.4970 − cut × 0.1728
cut    =  ( 1.4970 − tip_z ) / 0.1728
```

---

## 2. 🔴 Our "bob" ends 107 mm below the jaw. That is the whole of the owner's complaint

The shipped groom's own bake report: **extent z 1.3279 → 1.6880**.

| | z (m) | against the jaw at 1.4350 |
|---|---:|---|
| reference bobs (every one of the ten) | ~1.42–1.45 | **at the jaw**, ±15 mm |
| our longest cards | **1.3279** | **107.1 mm BELOW it** |
| our clavicle | 1.3425 | our hair passes the collarbone by **14.6 mm** |

The manifest describes `bob01` as *"roughly to the collarbone"* and that description is accurate.
**A collarbone-length cut is a lob, not a bob.** The generator built exactly what it was told to
build; the target was wrong.

### The corrected numbers, layer by layer

| layer | `cut` now | tip z now | `cut` for a chin-length bob | tip z |
|---|---:|---:|---:|---:|
| `mass` | 0.84 | 1.3518 | **≈ 0.36** | 1.4348 |
| `veil` | 0.84 | 1.3518 | **≈ 0.36** | 1.4348 |
| `surface` | 0.80 | 1.3588 | **≈ 0.34** | 1.4383 |
| `flyaway` | 0.88 | 1.3449 | **≈ 0.39** | 1.4296 |
| `body` | 0.62 | 1.3899 | **≈ 0.27** | 1.4503 |
| `underlayer` | 0.35 | 1.4365 | **≈ 0.18** | 1.4659 |
| `root` | `None` | — | `None` | — |
| `fringe` | 0.02 of `forehead_z` | 1.5697 | unchanged | — |

🎯 **The longest layer goes from 0.84 to 0.36 — less than half.** `underlayer` at 0.35 is *already*
at the jaw today, which is the clearest possible statement of the error: **the layer our generator
treats as the short interior one is the only one that is the right length for the style.**

⚠️ **`length` must follow.** `HAIR_LAYERS.length` is the first guess at the arc a card needs to reach
its cut plane, and `grow_to_cut` corrects it within `CUT_LENGTH_BOUNDS` (0.45–1.80×). Halving a cut
without moving `length` asks the corrector for 0.45× at its floor and it will clamp rather than
reach — silently. Scale each `length` by roughly the same factor and let the corrector do the rest.

---

## 3. What else a bob is, beyond being shorter — the five shape features, in order of how loudly they read

Read off the ten reference plates. All ten share 1–3; 4 and 5 vary.

1. 🎯 **A TAPERED NAPE AND OCCIPITAL VOLUME — the defining feature, and we have neither.** Every side
   and back view shows the same construction: very short and tight at the nape, building upward and
   outward into a rounded mass at the back of the skull, then swinging forward. Our groom hangs as a
   *curtain of constant length from the crown* — same length at the nape as at the temple.
   **This requires a per-root length FIELD over the scalp**, not a per-layer constant.
2. 🎯 **THE FRONT IS LONGER THAN THE BACK, and the mass angles FORWARD toward the chin.** The
   silhouette is a wedge. `cut_height` already has a front-to-back term — `CUT_GRADUATION` against
   `front_to_back` — so this one is a **sign and magnitude question on an existing mechanism**, and
   it is the cheapest of the five. Check which way 0.09 currently points before changing it.
3. **The silhouette is a rounded wedge, widest at ear-to-jaw, narrowing at the crown.** Ours is a
   rectangle — the same width top to bottom. Falls out of 1 and 2 rather than needing its own lever.
4. **The ends turn UNDER.** A rounded bottom edge with a distinct inward curl in the last third, not
   a flat cut. Our `curl` is a constant nudge with a random per-lock direction; this wants a
   *directional* curl that is inward at the tips.
5. **It stands OFF the skull with air under it.** Body at the root, a silhouette wider than the head.
   Our `ATTACH_STRENGTH` / `HUG_REACH` pull hair ONTO the skull; a bob needs the opposite over the
   occiput. ⚠️ That hug is load-bearing — it is what keeps the curve lying on the skull instead of
   bouncing — so this is a per-style *reduction*, not a removal.

⚠️ **The fringe is NOT a defining feature.** The ten plates carry full blunt fringes, curtain bangs,
and none at all, in roughly equal numbers. A bob is defined by its length and its graduation. Do not
tune the fringe trying to fix the bob.

---

## 4. Men's hair — and the reference says the same thing the source sweep said

Thirteen plates. What they have in common is not length; it is **structure**:

> **Short, tapered or faded sides and back; the length concentrated on top; the top styled
> directionally — swept back, up, or forward.**

Every variant in the set is that structure with two dials moved: *how short the sides go* (scissor
taper → skin fade) and *how long and which way the top goes*. Present in the set: side-part /
curtain, short back-and-sides with a textured crop, quiff, pompadour, slick-back with an undercut,
hard-part, faded crop — and, proving the owner's own caveat that men's hair is *"not always"* short,
one full shag and one long curtain-fringe cut.

🎯 **This is the third independent line of evidence for the SAME missing mechanism.** The source
sweep found it in two unrelated codebases — one modelling a separate scalp mesh, one ray-testing a
sphere and its author noting outright that this *replaced "just using a Y-clip value"*. Our hairline
is a `hairline_z` threshold with a good excuse. Now the reference imagery says it a third time:

> **A per-root length field over the scalp is the single mechanism that unlocks men's hair.
> And a bob's tapered nape is that same operator with different parameters.**

A fade and a bob's nape taper are not two features. They are one feature — length as a function of
position on the skull — at two settings. That is worth building properly once.

---

## 5. What this changes about the plan, and the one awkward consequence

1. **`bob01` is wrong and must not simply be edited.** It is the byte-identical reproducibility anchor
   (`sha256 98ca6c23…`) that the entire style-table refactor is verified against, and it is the groom
   every committed measurement in this project was taken on. Editing it retires the control and the
   record in one commit.
   ⏭️ **So: author the corrected cut as a NEW style, measure both, and switch the default once it
   wins.** `bob01` then survives as a control-only entry with its history intact. The cost is one
   extra directory and it buys keeping every number this project has.
2. **The cut field is not optional and it is not a men's-only feature.** §3.1 and §4 are the same
   mechanism. Build it as *length as a function of scalp position*, and both the nape taper and the
   fade fall out of it.
3. **Ship the reference as measurable acceptance criteria, not as taste.** A style is right when its
   tips land in a stated z band against a stated landmark. §2's table is that for the bob. Do the
   same for each men's style before authoring it.
4. ⚠️ **Watch `verify_glb.mjs`'s `cards deep` clause when the groom gets shorter.** Its ceiling of
   p50 18 was fitted on this card count spread over a *longer* groom; the same 496 cards over a
   shorter one are packed denser per square centimetre, and the fringe already had to drop from 44
   cards to 34 for exactly this reason. Expect it to go red, and read it before touching it — that
   red may be correct.

---

## 6. Honest limits of this document

- **Every landmark here is `figure_g050`.** The generator's whole design is that authored constants
  are fractions of `ScalpFrame`, so they travel across the five gender bakes — but the *jaw plane*
  quoted above does not, and a chin-length bob on `g100` needs its own reading. The `cut` fractions
  should travel; the millimetres will not.
- **The z 1.4350 jaw plane is read off a 10 mm-banded profile**, so it carries ±5 mm of quantisation
  before any argument about where a jaw ends. That is well inside the ±15 mm the reference plates
  themselves span, so it does not change any conclusion — but do not quote it to four decimals.
- **Nothing here has been rendered.** These are target numbers derived from a mesh and from
  photographs. The bob is right when a blind judge shown the plate and the reference says it is, not
  when the arithmetic agrees.
