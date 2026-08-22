# The judging prompt for the r31 separation — one arm per judge

Built against `tools/critic/JUDGE-BRIEF.md`. This is an **A/B (three-arm) round**, so per §"The
A/B protocol" it asks for DESCRIPTION and never for a tier verdict, and it does not name the
round's hypothesis, its vocabulary, or the owner's words anywhere.

Each judge is handed **one** directory from `captures/hair-r31-separation/blind/<setId>/`
containing `portrait.png` and `three-quarter.png`, and is not told the other arms exist. The key
is at `captures/hair-r31-separation/blind-KEY.json`, a sibling of the judged tree.

---

## Prompt to give each judge (verbatim)

> You are given two PNGs of a rendered character: `portrait.png` and `three-quarter.png`. Look
> at them with an image reader. You have a shell; you may crop, magnify and measure, but the
> only inputs are these two files.
>
> **Pass 1 — free description, before you read Pass 2.** Describe what you see, in your own
> words, region by region: the top of the head, the sides, the lower edge of the hair, the
> boundary between the hair and the background, the boundary between the hair and the skin, the
> skin itself, the eyes, the shoulders, and the backdrop. Say what each region looks like as a
> picture — not what you think produced it. Where something looks wrong to you, say where it is
> in pixel coordinates and what is wrong with it.
>
> **Pass 2 — ratings.** Now rate each of the following 0–10, where 10 is "as good as it gets"
> and 0 is "unusable", and give one sentence of reason for each:
>
> 1. the lower edge of the hair
> 2. the outer boundary of the hair against the backdrop
> 3. the shoulders
> 4. the top of the head
> 5. the backdrop
> 6. the skin of the upper chest
> 7. the transition where hair meets skin
> 8. the eyes
>
> **Evidence rules — a claim that breaks these is dropped.**
> - **Every claim carries a crop.** Give pixel coordinates, cut the crop to a file with
>   nearest-neighbour magnification, and say which claim it supports. Prose without a crop is
>   not evidence.
> - **Every "real hair does X" or "shipped work does Y" claim needs a search and a citation** —
>   name the game, paper or reference image, give the URL, say what it shows. An unsupported
>   claim is dropped, or you may explicitly demote it to an impression, which is a legitimate
>   thing to report as long as it is labelled.
> - **Your single biggest complaint must name where the standard is met** — a specific shipped
>   game, film, paper figure or reference image that does the thing you say is missing, and what
>   is different about it.
> - **For each complaint, give a mechanism, not a wish**: what change would fix it, and why that
>   change addresses that cause. "Add more detail" is not a mechanism.
> - **"I see nothing wrong here" is a legitimate and valuable answer** for any region or rating.
>   Do not manufacture a complaint to fill a line.

---

## The decoy axes, and what they actually measured

Per §2 of the brief the decoys are **computed, never assumed**. Measured between arm B and the
arm-C companion (identical camera, identical everything but the groom), whole-plate change is
33.77% of pixels:

| rating axis | region | changed px | mean abs delta (0–255) | role |
|---|---|---|---|---|
| 5. backdrop | corners 140x140, all four | **0.00%** | **0.0000** | decoy |
| 6. skin of the upper chest | x300–420, y780–880 | **0.00%** | **0.0000** | decoy |
| 3. shoulders | x520–620, y700–800 (right) | 0.67% | 0.0173 | decoy |
| 3. shoulders | x120–220, y700–800 (left) | 23.33% | 5.8204 | **real** — hair shadow lands here |
| 8. eyes | inside x300–420, y330–470 | — | — | decoy on the mesh, contaminated by hair in front of it |
| 1./2./4./7. hair axes | x150–280, y250–600 | 81.79% | 28.6103 | real |
| whole frame | — | 33.77% | 21.5315 | — |

Read it off the brief's table: decoys flat + real axes moving is the clean read; decoys moving
means HALO and the real axes get deflated by the decoy movement or the judge is discarded.

⚠️ Axis 3 is deliberately **split** — the right shoulder is a decoy and the left is not, because
the hair shadow falls left. A judge that rates "shoulders" as one thing cannot be scored on it;
ask the follow-up rather than taking the number.

⚠️ Arm A is **not** on the same backdrop as arms B and C — its corners measure RGB(2,3,4) and its
lower corners are skin, against RGB(20,22,26) on all four corners of B and C. Axis 5 is therefore
NOT a decoy for a judge holding arm A, and A-vs-B is confounded by backdrop and framing. Only
B-vs-C is a clean pair.

## Pushing back

Judges are reachable after they report. A vague or unsupported verdict gets a follow-up asking
for the crop, the citation or the exemplar, not a discard. Treat a refusal to supply evidence as
information about the claim.
