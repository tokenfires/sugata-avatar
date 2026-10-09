# Independent sleeve source-result review

Retain the original editable module geometry and source associations. **Refuse physical fit: 104 strict transverse triangle pairs are recorded.** Conditional YES to the prospectively allowed first diagnostic views and isolated editable file, subject to a separate complete native preflight. This review does not admit that job or qualify garment appearance.

The sole build ran wrapper4164/child4174, 2026-10-09 09:29:26.305659–09:29:27.010031UTC, exit0/no timeout. BUILD-JOB and the89-byte log agree with RESULT: geometry_qualified=true and fit=REFUSED_TRANSVERSE. No native sleeve image or saved sleeve .blend exists in this source result.

## Stored evidence checked

I decoded only the new geometry.npz, with allow_pickle=False. Its eight finite arrays match every recorded raw hash: per side320×3 Float32 vertices,640×3 Int32 triangles,640×3×2 Float32 face-corner UVs and640 Int32 material IDs. Indices are in range; independently counted960 edges per side each have two opposite incidences. Material counts are outer192/lining256/cuff64/rims128. These checks establish the stored topology/data correspondence, not an embedded, nonintersecting physical shell.

For the first crossing, archive left triangle12 is exactly[6,7,39] and its three points equal the stored witness. Interpolating its first edge at0.9244923544778801 reproduces the recorded point with zero residual. Applying the stored body barycentrics[0.27156358270455094,0.2781095397327413,0.45032687756270773] to the recorded body triangle20585 points reproduces it within2.7755575615628914e-17. The barycentrics sum to0.9999999999999999 and are strictly positive. Body source IDs are[8137,10588,10590]. This is a concrete interior-edge/interior-triangle witness at[0.1648483753936457,-0.045895197773631644,1.20333707503707]. I did not re-decode the old body archive or rerun the contact solver.

RESULT records all1280 garment triangles reached against26756 body triangles,61294 padded-box candidate pairs,104 strict/0 boundary/0 coplanar exclusive pair classes. build.py87–117 explicitly owns those classes and prioritizes strict over boundary over coplanar per pair. Therefore104 is a triangle-pair count, not104 distinct physical contact locations or penetration depths. Root's independent Hermite/source-section, union-find/volume and full3×3 linear-system contact verification is recorded in ROOT-RESULT; I inspected that receipt but did not rerun it. Its maximum section conversion error5.9501695570673974e-8 and positive signed volume do not prove clearance or occupancy.

All22 current EXEC-BUILD input sizes/hashes independently match. The corrected exclusive NPZ write and final shared-budget check remain bound to the executed source; no shape, phase, nominal ease or tolerance was changed after preflight. SOURCE-RECEIPT accurately distinguishes geometry qualification, refused fit and untested native UV behavior.

## Actionable decision and alternatives

**The transverse refusal is decisive for fit.** The witness above and the full recorded pair census prevent fitted-sleeve promotion. A: retain exact geometry as a labelled diagnostic and inspect its course, cuff region and visible openings; this can inform a genuinely new connected torso/armhole design but cannot cure the crossings. B: stop at this source receipt and nominate that independent connected-garment contract directly; it avoids another native job but leaves this original module's visible shape unobserved. Neither route permits ease/phase/offset/threshold rescue of this fixed recipe.

**The useful remaining question is visual authoring, not another contact inventory.** The original bomber drawing and retained proximal/distal source charts motivated full sleeves and cuff regions; the new module has explicit lining and rim topology, but its silhouette, junction course, cuff-band language and interior visibility have no actual pixel witness yet. A, preferred: one fresh factory CPU job renders the exact modules against the unchanged archived gray body, saves only a new isolated editable file and cold-reopens that file to verify complete geometry/UV/material persistence. Every PNG must visibly carry “DIAGNOSTIC / FIT REFUSED: 104 PAIRS”; editable-file Text/object metadata and README must preserve the same status. This yields a concrete shape decision at the cost of new native API, framing and persistence responsibilities. B: retain source geometry without native presentation and move to an independently authored whole-garment specification; cheaper, with less evidence about whether this module language merits reuse.

Conditional next worth is **YES** for A within the existing10:15UTC close, one first attempt/no variants, only after the separate native programme is reviewed. Stop on the first source/geometry/UV/ownership/persistence/frame failure. If those pass, actual first images may retain or reject the module's authoring direction while fit remains refused. The banner must be verified in the original PNGs and must not obscure the garment; declared interior topology does not guarantee visible interior evidence. No original .blend may be opened/saved, no source body may change, and no native result is implied here.

Full connected torso/opening/armhole/collar/hem/facings/guard/pockets/full interior, physical occupancy, coverage, self-contact, rig/morph/motion, export/runtime and wider AAA qualification remain open. Source pass and diagnostic pixels cannot transfer to those duties.

## Exact reviewed bindings

Paths are relative to this directory; all digests are SHA256.

| File | Bytes | Digest |
|---|---:|---|
| RESULT.json |277887|0f5e75e8fc6d90acd95971002123aecdcce48fe9ecdeb1e2a14815910a28bce6|
| ROOT-RESULT.json |1171|e579f64adde58e111a9675047ea7264f640795817255ec2c1c739d4d11e98a91|
| BUILD-JOB.json |613|b0f0f0533de7d6adefcd573e9b60fe94e63404fd2105598c281e71cd73e55fea|
| build.log |89|6257b99ff7e22f8fd36c6e7079bd1b6e4c10baa622c5fc485d0d8c92ebece14e|
| geometry.npz |17726|c44c3fe6d7f2cc1db6bbf5d9c4d74dae4cc493c2ead0b91388117b17a5f0cf7d|
| SOURCE-RECEIPT.md |2982|f78b53e5103620b796548563bd653a5e2ebc0850037b451f9a02fe47a0e49270|
| BUILD-PREFLIGHT.md |6462|196c833295fbab4df7c60c1caa01dc7a09be77f6c8069f8c311e2bb3985338b3|
| build.py |14003|6ab75c4acb4e58ca108a3d6a74c82ac4f96a07f39dd44cc5cb08166b2d3f01dc|
| run_build.py |2121|036363e6ba04b052246598299a3c0dd796854eaf92cb3540e2d9f5196a3e11fc|
| CONTRACT.json |1415|e867a176171bac6818ebfc349e7a76230de8d0c89c56977a00a0921961979448|
| EXEC-BUILD.json |5496|b09463ca90bbafcf4f5ecf531dcb2a391acc3ac553b6b8a1ddd32ad62214d1a2|

