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

## The A/B protocol — a different instrument from the absolute gate, and it must not be confused with it

The four requirements above are for **absolute** judging: one plate, "is this good". Most rounds
here are not that. Most rounds are **A/B** — two arms differing in one named thing — and an A/B
scored with an absolute brief produces the §4 failure in miniature, because it asks a judge for a
tier verdict when the only answerable question is *what differs*.

🎯 **In an A/B, DO NOT ASK FOR A TIER VERDICT AT ALL.** "Same-tier" is refused for the published
reference implementation of Frostbite's hair system; asking it of two arms that differ in one
constant is asking a question whose answer carries no information about the constant. Ask what
changed, where, and which side is better on each axis. That is a question a judge can answer, and
it is the half of the instrument the control proved works.

### 1. 🚩 NEVER NAME THE HYPOTHESIS IN THE PROMPT

A judge told what to look for will find it. This is not a hypothetical failure mode here: §4's
control judge produced a detailed, confident, physically specific account of *"the alpha
dithering… a regular diagonal cross-hatch checkerboard"* on a renderer with **no dither and no
alpha texture anywhere**. It was primed by a brief that discussed coverage, and it obliged.

So: **free description FIRST, ratings SECOND.** A rating scale handed over early tells the judge
which pixels matter and the free description is then worthless. Two passes, in that order, in one
prompt is fine — the ordering is what matters.

And the round's own vocabulary stays out of the prompt entirely. If a round is chasing "the
highlight desaturates as it lightens", the judge is **not** asked about desaturation. It describes
the highlight; the round's author maps that description onto the hypothesis afterwards, in the open,
where the mapping can be argued with. **Mapping after is honest; asking directly is leading.**

### 2. 🔴 EVERY A/B CARRIES DECOY AXES, AND THEY ARE THE POINT

Rate the arms on axes covering regions that are **provably bit-identical between them**, mixed in
with the real ones and not distinguishable by the judge.

This is cheap because the arms are usually a one-token change: R26's blind judge independently
confirmed *"skin, eyes, lips, brows, shoulder and background are bit-identical"* while 38% of the
frame moved. So skin texture, eye catchlight, lip edge and background gradient are all free decoys
on almost any hair round.

**Compute the bit-identical set; never assume it.** `plate-diff.mjs` gives you the changed mask.
State in the round note which axes were decoys and what the pixel difference on each actually was.

**Reading the result:**

| decoys | real axes | what it means |
|---|---|---|
| flat | move | a clean read — this is the result you are looking for |
| move | move | **HALO.** Deflate the real axes by the decoy movement, or discard the judge entirely |
| flat | flat | an honest null. Often the correct and most useful answer |
| move | flat | the judge is anti-correlated with reality; discard it and check the harness |

⚠️ A judge that moves the decoys has not lied and is not a bad judge — it has told you the size of
its own noise floor, which is information no single-arm verdict can give you. Report the number.

### 3. THE OWNER'S WORDS ARE THE ACCEPTANCE CRITERION, AND THEY ARE NOT A JUDGING PROMPT

When a round exists because the owner said something specific — *"wet and muddy and blocky, kind of
low res compared to the face and body"* — those words are what the round has to move, and they
are **the last thing** that may appear in a judge's prompt.

The chain is: judge describes freely → author maps the description onto the owner's words in the
round note, showing the mapping → owner looks at the plates. Blind judges are **describers** and
the pixel statistics are the **attribution layer**; neither is the acceptance criterion. §4's rule
holds throughout and is the reason for the whole arrangement: **a judge's DESCRIPTION is reliable,
its ATTRIBUTION TO MECHANISM is not.**

---

## What does NOT change

- **The blind stays absolute.** No source code, no documentation, no git history, no commit
  messages. A judge that learns which arm is ours is spent.
- **The answer key lives outside the judged tree.** A judge here is a subagent with a shell, and
  "one level above the images" is one `ls ..` from being no blind at all.
  ✅ **`blind_ab.mjs` used to get this wrong and no longer does** (2026-08-22). The key now goes to
  a key root that is a *sibling* of the image root, and `assertKeyOutsideJudgedTree` refuses any
  `--key-root` that is an ancestor of the images — so the old layout is unreachable rather than
  merely unused, and a future caller cannot reintroduce it with one flag.
  `control-frostbitten/control-blind.mjs` always did this correctly and is still the worked example.
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
