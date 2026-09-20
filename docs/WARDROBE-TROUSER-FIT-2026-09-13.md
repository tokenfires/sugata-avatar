# Casual trouser fit — September 13, 2026

The g050 casual jeans now fall over the existing shoes without the former white sock patches in the qualified front, oblique and rear views. The lower leg is eased around the socks, and only the cuff portions meeting the shoe rise to form the opening. This is one authored fit correction for `female_casualsuit01` with `shoes01`, not a general cloth simulation or a completed wardrobe.

The correction is installed locally and verified in the built Wardrobe page. The preview on port5197 was refreshed and HTTP/hash-verified at13:08PDT. [Compare the saved views](../captures/wardrobe-trouser-fit-2026-09-13/review.html).

## Evidence and design choice

Fresh matched captures use the actual Showcase Avatar, all natural motion layers, the g050 body, bra/briefs foundations, existing shoes and bob02. Cameras and all non-trouser geometry, rig, face cards, hair and clock match exactly between the original and final candidate. Draw-only camera inspection leaves the physical state exact. Eight final views cover rest and four seconds of natural motion; the corresponding original views remain available.

The original white regions cut across the denim at the front and rear ankles. The final views show continuous denim reaching the shoes. A small glimpse of sock through an open cuff is possible; that is distinct from the reproduced patches through the trouser surface. The independent critic found no new visual blocker for this bounded correction.

| Actual skinned geometry | Rest, original → final | Four seconds, original → final |
| --- | ---: | ---: |
| Trouser / combined shoes and socks intersections | 406 → 0 | 406 → 0 |
| Outer garment / drawn body | 435 → 435 | 425 → 425 |
| Outer garment / drawn bra | 26 → 26 | 29 → 29 |
| Outer garment / drawn briefs | 0 → 0 | 0 → 0 |
| Nonadjacent outer self-contact | 96 → 96 | 98 → 98 |

The unchanged rows retain exactly the same triangle-pair identities, not just counts. Self-contact excludes source position-weld neighbors and includes pre-existing garment layering. These numbers do not represent distinct visible holes. Zero triangle crossings alone does not prove containment, nearest-surface clearance or an unrestricted motion envelope.

Authored rest shoe intersections decrease from409 to0; original rest body and self-contact identities remain. An independent projected-footprint algorithm checks11,430 overlap vertices and confirms at least1.99999869mm vertical separation after Float32 rounding. This is a **2mm vertical gap over shared XZ footprints**, not2mm Euclidean surface clearance: a separately measured cuff point is only1.071mm from the shoe.

## Preserved data and rejected alternatives

Only205 positions change, all originally below0.35m, with maximum combined displacement23.634mm. The largest local upward cuff correction is23.345mm. Source smoothing groups are preserved across duplicate UV vertices; no new normal seam is introduced. Neighbor normals incident to the changed area are recalculated, including a few vertices above0.35m. Upper positions, UVs, indices, skinning, images, materials, body, shoes and all foundations remain exact. No new runtime work or GPU buffer is added.

The critic proves issues and offers two alternatives:

- The initial raised hem cleared the socks but made an unintended cropped silhouette and conspicuous sock band. Prefer the accepted length-preserving radial ease plus local shoe fit; an intentionally cropped design would instead need coordinated hosiery and footwear.
- Recomputing normals independently at UV seams introduced11 new discontinuities, up to18.3degrees. The accepted correction reconstructs the original smoothing groups. Transforming original normals with a deformation Jacobian is a separate alternative.
- Radial ease alone removed sock intersections but left107 shoe-upper intersections. Fit the local opening above the shoe, as accepted here, or redesign/split the footwear and hosiery assets.
- An initial cuff-only lift overtook the row above and introduced one self-crossing. The accepted correction propagates lift up longitudinal edges while retaining at least half their original vertical spacing. A broader authored cuff deformation is an alternative. Independent face checks find no degenerate changed triangles or rotations beyond90degrees; this is not a general fold proof.

All failed probes and candidates remain local evidence. None of their intermediate assets is installed.

## Foundation-mask compatibility

The frozen foundation calibration still contains its original selections and original environment hashes. `wardrobe_under_masks.mjs` additionally accepts this exact, explicitly reviewed casual successor. Unknown assets remain rejected.

The independent critic excludes all397 source triangles incident to a moved vertex. The remaining3,839 triangles have exact original positions, topology, weights, skin transforms and morph contract. Those unchanged triangles alone pass all23,310 recorded footprint checks:3,669 bra plus4,101 vest triangle IDs, each in authored coordinates and the historical actual0/4s poses. Maximum uncovered residue is3.22e-20m², below the existing1e-14 threshold. The casual calibration adds no brief or boxer-brief removals. All four foundation output hashes remain exact.

This preserves the earlier calibration's expanded footprint, center-relative depth slab and two-pose boundaries. It does not resolve its existing foundation-only skinning sliver or prove all-view occlusion.

## Reproduction

```sh
node tools/figure-pipeline/casual_trouser_fit.mjs --output /tmp/casual-fitted.glb
node tools/figure-pipeline/casual_trouser_fit.selftest.mjs
node tools/figure-pipeline/wardrobe_under_masks.selftest.mjs
```

The original asset is preserved in `tools/figure-pipeline/fixtures/casual-g050-original.glb` under Git LFS. The tool accepts only the reviewed original garment and shoe hashes, recreates the exact reviewed output, and refuses existing output files. It is an offline recipe for this one fit. The seven focused test groups cover reproduction, unrelated-byte preservation, seam continuity, original/final shoe crossings, exact mask-environment acceptance, invalid inputs and output ownership.

- Original: `109dad33eb225ff7954501f6b1d0fcf9a17f4ea3d0271f7cef374dcbfa295160`
- Installed: `44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783`
- Reference shoes: `28e15257130da9eabf790b5dda55e96c985b3504e5905fa9b230195b2f27fde4`

Neckline/body crossings, skirt layering, the combined one-mesh outfits, current shoes/socks, broader body fits and the overall AAA target remain unfinished. Current wardrobe examples remain two stand-in outfits on one body study; the corrected jeans are not new representative starter builds.

## Final integration checks and evidence

The final built-page run passes19 browser groups, including real garment-byte hashes, outfit switching, settings export, mobile layout, reduced-motion controls and retirement. The image-export run passes13 groups, preserving current canvas pixels and physical/camera state. Both runs have no browser errors. Existing wardrobe50, AvatarWardrobe13groups, foundation-mask8groups, Showcase preset4groups and catalogue92 assertions pass. All18 pages build; existing large-chunk warnings remain. The independent portable-tool review adds6 passing groups.

The source/asset snapshots, rejected attempts, actual paired geometry, original images and independent proofs are saved in `captures/wardrobe-trouser-fit-2026-09-13`:184files /172,092,489bytes, all reread and hash-verified. Its tracked manifest SHA-256 is`f39cb9b1066f69789482da38192a4ad6fb0ddf2f36d1f6d734ee0fb4b28c6126`. The [evidence ledger](evidence/wardrobe-trouser-fit-2026-09-13.json) records sources, checks and preview verification. The raw capture archive is local; the recipe, original LFS fixture and evidence ledger are tracked.
