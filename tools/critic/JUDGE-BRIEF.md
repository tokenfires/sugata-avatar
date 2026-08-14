# The judge brief — and the four things a verdict must carry

**Every blind critic in this project is given this contract.** It is here rather than inside one
workflow script so the next round cannot quietly drop it.

---

## Why this exists — the control that broke the old brief

On 2026-08-14 the frostbitten control (`tools/critic/control-frostbitten/`) put the published
reference implementation of Frostbite's hair system in front of the same judges as our own groom, at
identical framing, blind. **All three said "not same-tier."** So did all three shown ours.

Two failures fell out of that, and both are failures of the BRIEF, not of the judges:

**1. 🚩 The bar was never shown, so it could not be met.** A judge was asked whether something was
*"same-tier with current AAA character hair"* and never required to point at what that tier looks
like. An implicit standard cannot be met, argued with, or falsified — and eleven rounds were pushed
against one that a known-good asset also fails.

**2. ⚠️ A judge's DESCRIPTION is evidence; its ATTRIBUTION TO MECHANISM is not.** One control judge
reported *"the alpha dithering… a regular diagonal cross-hatch checkerboard… the transparency
solution showing through as texture"* — about a renderer whose coverage is analytic, with no dither
and no alpha texture anywhere. A real observation with a confabulated cause welded onto it. Had that
judge been required to produce the crop, it would have caught itself.

The instrument's DIAGNOSTIC half works — judges refused to say "blunt slabs" or "card edges" about a
renderer that has neither, while saying both about ours. It is the VERDICT half that needed fixing.

---

## The four requirements

Add these to any judging prompt. They are not stylistic; a verdict missing them is discarded.

**1. EVERY CLAIM CARRIES A CROP.** Pixel coordinates, the crop cut and saved to a file, and the claim
it supports. Prose without a crop is not evidence. Crop with **nearest-neighbour** — a strand has to
be looked at as pixels, not as a resampled impression of pixels. `control-frostbitten/crop.mjs` does
this.

**2. EVERY "REAL HAIR DOES X" OR "AAA DOES Y" CLAIM REQUIRES A SEARCH AND A CITATION.** Name the
game, paper or reference image, give the URL, say what it shows. **A claim without support is
dropped or explicitly demoted to an impression** — which is a legitimate thing for a judge to
report, as long as it is labelled as one.

**3. THE TOP COMPLAINT MUST NAME WHERE THE STANDARD IS MET.** A specific shipped game, film, paper
figure or reference image that does the thing said to be missing, and what is different about it.
This is the direct repair for failure 1 above: it forces the bar to be a real artefact rather than a
feeling, and it makes the gate falsifiable.

**4. A MECHANISM, NOT A WISH.** For each complaint: what change would fix it, and why that change
addresses that cause. *"Add more detail"* is not a mechanism.

**And a fifth that is really a permission:** a judge may report that it sees **no difference**. A
null result reported honestly is worth more than a manufactured one, and several rounds here have
been A/B tests where "these look the same" was the correct and most useful answer.

---

## What does NOT change

- **The blind stays absolute.** No source code, no documentation, no git history, no commit
  messages. A judge that learns which arm is ours is spent.
- **The answer key lives outside the judged tree**, not one level above it the way `blind_ab.mjs`
  writes it. A judge here is a subagent with a shell, and "above the images" is one `ls ..` from
  being no blind at all. See `control-frostbitten/control-blind.mjs`.
- **Harshness is still wanted.** The most useful reviews this project has had were its harshest. The
  requirements above make harshness *cheaper to act on*; they are not a request to soften it.
- **The completion gate is unchanged and is the owner's decision:** same-tier, not better.
  `docs/PROGRESS.md` holds it. What changed is that a judge now has to show the tier.

---

## Pushing back on a judge

Judges are reachable after they report. **A vague or unsupported verdict gets a follow-up rather
than being taken at face value** — ask for the crop, the citation, or the exemplar. This is the
owner's own framing: constructive criticism, where the critic carries some of the cost of being
useful rather than leaving all of it downstream.

Treat a refusal to supply evidence as information about the claim.
