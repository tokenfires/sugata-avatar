# Authored bob geometry and one nape correction

September 29 overnight work, continued September 30 UTC. **The candidate remains isolated and unqualified for default use.** No accepted GLB or production module changed.

## What improved

The outward hook at the lower rear is caused by one authored card, number 281. A short downward/inward nape guide removes that extension in four held views. Dark and pale diagnostic colours, and the original studio lighting, retain that local improvement. The larger crossed rear patch remains.

| Baseline | Isolated candidate |
| --- | --- |
| ![Baseline rear oblique](../../../../captures/hair-colour-2026-09-29/attribution-v1/casual-rear-oblique-medium-brown.png) | ![Candidate rear oblique](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/neutral/casual-rear-oblique-medium-brown.png) |

The controlled colour comparison made this attribution possible. It is an inspection aid; these images do not establish a finished colour palette or hairstyle.

## Evidence and decision

1. Compared authored centres and both ribbon edges, transformed with the captured head matrix, against GPU readback. Maximum centre difference is **0.000449 mm**, maximum vertex difference **0.001679 mm**. No vertex differs by 0.01 mm. The large fixed-pose defect is already authored, rather than a large reset deformation. A zero-time capture alone would not establish that: reset takes one solver step.
2. Projected the actual card paths. Three cards reach the hook region; hiding them removes it. Hiding **card281 alone** removes the same outward extension. This hides 32 triangles, leaves the solver unchanged, and changes occlusion; it is an attribution control, not a removal candidate.
3. Card281's original position components exactly match the original fixture. Its path travels about 68 mm sideways from a low nape root. The final three rings rise by only 0.917 mm, so correcting that tiny upward turn would leave most of the extension.
4. Chose one topology-preserving curve experiment over deletion. The new guide preserves the root ring, card width, UVs, weights, indices, cap and other cards. It changes 32 positions and 32 normals. Its arc is 32.865 mm, versus 107.020 mm originally. This changes most of the card beyond its root; it is not a small endpoint adjustment.
5. All other cards' live vertices remain bit-identical. The selected card's 32 rest triangles have zero body intersections in an unbounded spatial query; moved vertices have a minimum signed clearance of 10.975 mm. These checks do not establish moving clearance or full-groom contact quality.

Candidate SHA-256: `dc6d17fbd6b98facd81e420ee24b46e28c2514243e065446e30ab2ef6de27427`.

The independent critic measured a larger root-to-ring1 frame rotation, 4.16° → 51.61°. No corresponding visible failure has been established in the held views. Keep the exact candidate while examining that transition during bounded motion; do not change it merely to improve the angle statistic. If a crease appears, a gradual proximal frame transition is the alternative to retaining this recipe. See [the independent review](CRITIQUE.md) for examples, alternatives and tradeoffs.

## Larger rear problem

![Authored layer identities](../../../../captures/hair-colour-2026-09-29/layers-v1/casual-rear-oblique-medium-brown.png)

The calibrated group colours identify **red root cards and gray cap** exposed between longer sections. Cyan identifies the separate hook's body layer. The palette passes through the production hair lighting and grade, preserving geometry and alpha. The group names come from calibrated authored card order; GLB metadata itself does not name these groups.

Two remaining structural alternatives are to redirect identified neighboring long cards over the exposed region, or reauthor its short cards into coherent downward paths while preserving inner coverage. Either needs explicit correspondence and a bounded prediction. Earlier generic curtains produced broad panels and repeated comb-like ends; that is a recorded rejection to avoid repeating. Their old raw images are absent here, so the current layer captures are the fresh evidence.

## Controls and limits

- 23 new native Apple WebGPU images: attribution, removal, layer identity, candidate views, colour repeats and original-light confirmation.
- Each capture owns the same zero-time render clock: 96 settling draws plus setup/capture, frame and grain 98. Camera, lights and other settings are recorded. Candidate routing is counted and must load exactly once.
- Candidate dark repeats: back differs at 25 pixels by at most 2/255; rear oblique is byte-identical. Large persistent shape changes exceed these residuals.
- No moving sequence, all-pose clearance, performance qualification or default promotion is claimed. The wider messy patch and face-framing asymmetry remain open.
- Captured source snapshots identify the exact harness used. Later comment/layout-guard hardening does not retroactively change those snapshots.

## Recovery

- [Machine-readable summary](summary.json) records source-report hashes, all image hashes, clocks, interventions and numerical checks.
- [Archive manifest](archive-manifest.json): 205 local files / 84,318,478 bytes. Raw files are ignored and local, not remotely backed up.
- Main capture harness: `tools/critic/hair-colour-diagnostic.mjs`. New options: `--geometry=on`, `--colours=...`, `--hide-cards=...`, `--hide-caps=on`, `--identity=layers`, `--candidate=captures/.../candidate.glb`; opposite rear view is `rear-left`.
- Recipe: `tools/critic/bob-nape-candidate.mjs`; it refuses to overwrite an existing candidate. Original accepted asset is read-only input.
- Exact commands and job ownership are in [the overnight checkpoint](../../../OVERNIGHT-2026-09-29.md). Per-run report/source snapshots preserve the executed configuration. The archived `nape-guide-v1/summarize-evidence.py` rebuilds this numerical summary and manifest.

Next: keep v1 stable; finish critic disposition, then choose a separately evidenced rear-layer experiment. Motion review is necessary before considering this nape asset for promotion.
