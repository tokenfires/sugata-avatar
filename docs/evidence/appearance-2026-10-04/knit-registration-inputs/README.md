# Sweater registration worksheet — symbolic draft

This editable proposal makes the scale/frame/landmark responsibilities explicit. It is **not a completed numeric body worksheet**: the proposed source reader is B/unrun, and no source body/bra joint origins or transformed garment have been observed.

[Artist convention](ARTIST-CONVENTION.json) owns exact source vertex IDs, target joint names, offsets, uniform scale/translation formulas and mismatch limits. [Source landmark rows](SOURCE-LANDMARKS.json) retains each original row and its arithmetic mean. These source observations, artist choices and missing target values are distinct.

| Source boundary | Unique vertex IDs | Mean in artist units | Proposed literal rig joint | Authored offset in metres |
| --- | --- | --- | --- | --- |
| neck | 16 | [0.0, 0.75, 0.0] | neck_01 | [0, 0.02, 0] |
| hem | 48 | [0.0, 0.0, 0.0] | pelvis | [0, -0.05, 0] |
| negative-X-cuff | 16 | [-0.75, 0.6, 0.0] | hand_r | [0, 0, 0] |
| positive-X-cuff | 16 | [0.75, 0.6, 0.0] | hand_l | [0, 0, 0] |

The neck and hem define a proposed uniform vertical scale; translation anchors the neck. Hem depth and both cuff references are held out, with50mm artist residual limits. Range0.25–2metres per artist unit is an authored proposal limit. These choices do not prescribe tailored dimensions or body contact. Full IDs and formulas remain editable in JSON; no mapping arithmetic or warp ran.

Exact bundled g050 body and the Ink-selected upper bra are pinned in [authority inputs](AUTHORITY-PINS.json). Figure loads the body through GLTFLoader; Avatar subsequently applies its chosen rest pose. Proposed authority is the initial asset scene-global frame, before Avatar stage/restPose/motion. Its actual payload transforms and numeric joint origins remain unobserved. The accepted Ink image's lowered arms and the draft's T-rest arms establish no pose equivalence. Briefs, all-layer exposure/coverage and garment surface correspondences stay open.

The current [Khronos glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) supplies metre units, coordinate axes and node TRS/global-transform conventions. The sole live targeted response returned200 with a first-part-only warning and omitted the requested skinning relation. [Exact response](SPEC-READ.json) retains that limit. It establishes no model-specific orientation, bind compatibility or moving fit.

[Worth](WORTH.md), [source B](SOURCE.md), [root verification](ROOT-SOURCE.json), [receipt](RECEIPT.md) and [checkpoint](CHECKPOINT.md). The useful3D preview remains [unchanged](../whole-knit-serving/README.md). A separate repair-worth question may assess the two actual recording gaps; this packet admits no correction, decoder or native execution.
