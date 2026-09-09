# g050 foundation mask correction — 2026-09-09

The coverage-derived `_UNDER_*` correction removes the visible chest and hip foundation patches
from the measured elegant outfit, while keeping the foundation garments worn and retaining the
visible V opening. It also reduces the casual upper-garment contacts. This is a bounded mask
correction for four g050 foundations under the original elegant and casual clothes. The separate
outer-cloth fit experiment remains rejected; none of its geometry is used here.

Status: **applied locally and verified in the built lookbook and runtime wardrobe**. Only the
four intended g050 foundation GLBs changed among 314 frozen source/asset files. All 18 pages
build, and the emitted copies match the four final asset hashes. The
[evidence ledger](evidence/wardrobe-masks-2026-09-09.json) retains the original study, installed
outputs and final browser qualification.

## Proven authoring defect

`build_figure.py` exports MPFB `Delete.<outer>` vertex groups as body `_HIDE_<outer>` fields in
`write_hide_mask_attributes` (line 837). Foundation generation clones those body fields, renames
them to `_UNDER_*`, and then subdivides the foundation (around line 1337; rename helper around
line 1785). The writer transfers authored coarse labels; it does not measure the actual outer
cloth surface.

`Wardrobe.js` uses a strict `> 0.5` threshold and removes a triangle when any corner is flagged.
It activates the matching field only for a worn, opaque garment on a higher layer. The name,
layer and threshold paths work as written. The defect has two distinct sources:

- Linear subdivision does not preserve the coarse any-corner deletion decision. A coarse
  triangle with masks `[1, 0, 0]` is removed, but a refined child with `[0, 0.5, 0]` stays drawn.
  Of 142 measured bra protrusion vertices, 125 lie over already-hidden body triangles.
- Some original labels are zero despite coverage by the outer cloth. All 142 bra and 100 brief
  witnesses meet the blouse or skirt along the body-normal ray. Seventeen bra witnesses and 92
  brief witnesses lie over body-mask zero regions. Those gaps are separate from subdivision.

The coverage-derived generator addresses both inputs. It does not lower the runtime threshold,
change garment layering, hide an entire foundation or use ray hits alone to approve removals.

## Qualified selection and limits

For each currently drawn foundation triangle, the classifier builds a plane through its centroid
using the nearest body triangle's geometric normal. Its projected footprint is expanded by the
Minkowski sum with a square of **1 mm half-extent**, which contains a full 1 mm disk. It clips
outward-facing outer-cloth triangles to a depth slab from **−4 mm to +30 mm**, projects them into
that chart, and subtracts their union from the expanded footprint. Qualification requires at most
`1e-14 m²` uncovered area.

The slab is measured relative to the centroid plane, **not the varying local foundation depth**.
Independent review measured up to 1.193 mm of authored foundation depth variation within a
chart and retained a synthetic counterexample to a stronger pointwise-depth claim. This is a
local projection contract, not an all-view or unrestricted motion occlusion guarantee.

A vertex gains a flag only if every currently drawn incident triangle qualifies. The final set
intersects authored qualification with actual Avatar geometry at 0 s and 4 s. The calibration
stores every additionally hidden triangle, including adjacent triangles removed by the runtime
any-corner rule. All unqualified triangle IDs remain drawn. This preserves unsupported opening
triangles exactly; the separate rendered opening views provide the visual evidence, rather than
turning that index-set invariant into an all-view claim.

| Outer garment | Foundation | Added vertex flags | Additional triangle records |
| --- | --- | ---: | ---: |
| Elegant | bra | 3,222 | 5,706 |
| Casual | bra | 2,074 | 3,669 |
| Elegant | vest | 3,477 | 6,256 |
| Casual | vest | 2,204 | 4,101 |
| Elegant | briefs | 442 | 785 |
| Casual | briefs | 0 | 0 |
| Elegant | boxer briefs | 1,472 | 2,783 |
| Casual | boxer briefs | 0 | 0 |

The eight pair records contain **23,300 additional triangles**. Replaying every one against both
captured actual poses gives **46,600 successful footprint checks**, zero unqualified collateral
removals and exact expected runtime indices. Counts are per outer/foundation pair; a foundation
may appear under both outer garments.

Only selected existing Float32 `_UNDER_*` fields change. Original fields already above 0.5 stay
unchanged. Positions, normals, UVs, skinning, topology, materials, full indices, body, outer clothes,
shoes and hair remain exact. Foundation-only outfits activate no outer mask and draw their full
original foundation indices.

## Actual Avatar evidence

The capture contains 20 configurations: both outer outfits with all four torso/hip foundation
pairs, each in original and candidate arms, plus four foundation-only configurations. At 0 s and
4 s this produces **40 full geometry/physics states and 48 representative views**. All 40 runtime
mask-index checks and draw-only state restoration checks pass. The 16 matched pose pairs have
identical full geometry, normals, rig, hair centers, velocities and cameras; only foundation draw
indices differ. Every asset response is hash-attested, sources remain frozen, and the capture has
zero network, page or console errors. Original controls have no asset substitution route.

All 20 authored decency configurations pass. All **32 actual clothed states** pass CHEST, GROIN
and SEAT ray checks. The **eight foundation-only states each retain two GROIN ray failures**, IDs
4787 and 4788. These IDs are UV-seam twins at one geometric location, not two separate holes.
They are existing posed normal-ray failures; current evidence does not establish a visible gap.
`floor-proof.json` proves full indices and actual body/foundation positions match the original,
all foundation triangles remain drawn, and no `_UNDER` mask is active. This is an unchanged
posed-ray failure, not an all-40-state pass. The capture report's `passed` field describes
the instrument, not the entire decency result.

Matched elegant upper, lower and oblique views show the chest and hip patches disappear while
the V opening remains visible. Small collar remnants, casual sock exposure and other cloth
layering issues remain. The mask correction does not change shoes01, which combines shoes and
socks without foundation `_UNDER` fields.

Whole-triangle inner/outer crossings decrease as follows. These are intersection-pair counts,
not a signed-clearance or visibility certificate:

| Outer garment | Foundation | Actual 0 s, original → corrected | Actual 4 s, original → corrected |
| --- | --- | ---: | ---: |
| Elegant | bra | 663 → 20 | 678 → 15 |
| Elegant | vest | 688 → 20 | 632 → 18 |
| Elegant | briefs | 185 → 0 | 185 → 0 |
| Elegant | boxer briefs | 145 → 1 | 145 → 1 |
| Casual | bra | 227 → 26 | 192 → 13 |
| Casual | vest | 473 → 86 | 440 → 87 |
| Casual | briefs | 0 → 0 | 0 → 0 |
| Casual | boxer briefs | 0 → 0 | 0 → 0 |

Authored elegant counts change from 588/681/185/145 to 16/14/0/1 for bra/vest/briefs/boxer briefs;
authored casual bra/vest counts change from 262/456 to 18/76. The remaining contacts stay red.
Original outer-cloth/body, outer self-contact and shoe geometry are unchanged. Two poses do not
prove a general motion envelope.

## Reproduction and byte preservation

`tools/figure-pipeline/wardrobe_under_masks.mjs` applies the frozen
`g050-foundation-coverage-v1` selection. Its default inputs are the tracked compressed original
GLB fixture, not mutable installed foundations or ignored captures. It validates the exact g050
body and both outer garment digests on every call, including idempotent calls. Foreign bakes,
unknown garments, altered source/output bytes or changed environments fail closed.

```sh
node tools/figure-pipeline/wardrobe_under_masks.mjs \
  --garment foundation_bra --bake g050 \
  --output /tmp/wardrobe-mask-review/bra.glb \
  --report /tmp/wardrobe-mask-review/bra.json
node tools/figure-pipeline/wardrobe_under_masks.selftest.mjs
```

Use `foundation_vest`, `foundation_briefs` or `foundation_boxer_brief` for the other assets. The
CLI requires explicit new output paths and refuses existing destinations and immutable fixtures,
including nested paths through symlink aliases, before creating directories there. It publishes
outputs exclusively. It never installs an asset automatically.

Eight portable test groups verify all four exact original-to-output hashes, byte-idempotence,
source/environment/bake refusal, complete GLB bytes outside selected mask offsets, every
collateral triangle, output ownership and fixture path protection. Thirteen analytic coverage
cases exercise polygon union, gaps, winding, slab limits, openings, degeneracy and the original
coarse-to-refined semantic defect. Independent review found no actionable defect within the
stated local-chart and adjacency contract.

| Foundation | Original full GLB SHA256 | Final portable full GLB SHA256 |
| --- | --- | --- |
| bra | `69fb5b0ae4efd9e99650d31e3e28676cebc8bd881f2a4adea39ef050d31455a8` | `4a3366377087bbfb2d5779ba4d6f5de09735e1810ae4ea9b6a22e11d3aee0d79` |
| vest | `bdae90afc569b3e6a4e32e55fe15a99feb0815c8cbf139de46e0c68644979b1a` | `4804bd9e11c7aafacc19ca9fa3ded25fbbd2c4d72c25a17d566087ee09ba6152` |
| briefs | `b458f53ea5aa84af081b6a993c9a483374f5167a202a57ff225d5420b46d592a` | `53f81630df24817f89bd7f8b59d58977b180855adc54d7f439f54a23f2757747` |
| boxer briefs | `b0f7d7231e69aa40c2adb1e3324ee8149dc88fcd1b1b22a534e2fe3d81bd3e36` | `4f0a206012250e980ad0f3f4f27101d8af023ce4b52775c986d7a7ee485cdaeb` |

The rendered scratch GLBs used an equivalent reserialized JSON container, 60 bytes shorter than
the original. The final portable outputs patch the original full container directly. Their full
BIN and parsed JSON equal the rendered candidate; all original container bytes and every byte
outside the selected mask offsets stay exact. This packaging distinction is not a new visual
variant. The independent review's JSON equality means parsed JSON, not raw serialization.
Rendered scratch fingerprints are preserved separately:

- bra: `30e6166e1c96aba60aac0e6b939ff72b855a6ed76be87186769b9830495d9021`.
- vest: `8bc8432a556042ea8c03a66c0facb3061838c6526c138dfdce15a838288e3767`.
- briefs: `62f15253e1d6ed5299fa5ba0684d736af16afa9c468c9c69f0af7febf5c0dd9c`.
- boxer briefs: `ae9a93a1f8b28a36bc602f703267329f0e4a314dd82b164cbaee1bf779327900`.

## Evidence locations

- Local immutable archive: `captures/wardrobe-under-masks-2026-09-09/`.
- `candidate-v1/`: rendered scratch candidates and original controls.
- `portable-v1/`: final exact-container outputs and packaging proof.
- `views-v1/`: all 40 snapshots, 48 PNGs and source/response/camera attestation.
- `actual-replay.json`: all additional footprint checks and residual contacts.
- `floor-proof.json`: unchanged foundation-only ray failures and inactive masks.
- `independent-review/`: separate source, adjacency, container and chart-depth review.
- `portable-tool/`: exact frozen tool, calibration and original fixture snapshots.

Historical diagnostic scripts retain their original scratch paths and are archived evidence.
The tracked portable tool is the supported reproducible application path; its default tests do
not import any `/tmp` or capture file. The archive manifest excludes itself and records
**151 files / 221,751,870 bytes**. Its SHA256 is
`2ad4e62733dd77d8783314887fa997dab238c2a1cb3f4acfb948c44e9513f986`.


## Final installed-asset verification

The final files pass 19 built-lookbook groups, 13 development PNG-export groups and eight
production default-wardrobe groups, with zero browser errors. The lookbook loads both bobs,
changes outfits on the same owner, runs the clothed long bob, exercises mobile and reduced-motion
controls, and loads the exact final bra/brief response bytes. PNG downloads preserve camera,
physical state, clock and current canvas pixels, including running/paused and error paths.
The default vest/boxer production check verifies dressing, rebuild and disposal. It records
successful final emitted URLs; their corresponding emitted file bytes were checked separately.
That report does not record response-body hashes for those two assets.

Root reviewed the final front, rear and portrait output. The conspicuous chest/skirt foundation
patches are absent in those views; the V opening remains. Sock patches and residual collar
contacts remain. Interaction captures include deliberately injected error UI and are evidence,
not curated showcase pictures. These checks do not expand the two-pose clothing-fit scope or
claim the full repository suite is green.

`captures/wardrobe-mask-promotion-2026-09-09/` preserves the final assets, 314-file comparison,
build, browser reports, images, export downloads and exact instruments: **46 files / 15,915,257
bytes**, manifest SHA256 `5f9cc1775aaf64e0bc5165362a2ef46c26158023d63f3759994c2777de600741`.
