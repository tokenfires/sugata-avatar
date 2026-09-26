# Alternate cached diffuse: measured, not selected

The cached `young_caucasian_female2` diffuse is **not selected for a native trial or product change**. At the exact existing geometry samples it darkens both knees and shins in every linear RGB channel and raises their red-channel shares. Its smaller knee-versus-shin red-share gap is therefore not evidence that it corrects the rendered red knees: the shins become more red-weighted too. Root accepted this bounded stop decision. The current assets and micro-normal default remain unchanged.

Both original, unedited atlas PNGs were visually inspected. The alternate appears smoother across broad torso and leg areas, while retaining dark knee patches. It also changes facial and other body detail; it is a whole-texture alternative, not a knee-only repair. An unshaded atlas cannot predict how those changes affect the face, neck transition, hands, visible legs or existing coloured lighting. No native rendering or asset edit was performed for this comparison.

`inventory.py` verified the two previously extracted PNGs against their exact ZIP entries in `tools/figure-pipeline/.cache/makehuman_system_assets_cc0.zip`. The receipt retains the associated `.mhmat` text, its explicit September 2020 CC0 header and exact diffuse pointer. No `.mhmat` shader or material settings were imported. Current PNG SHA-256 is `b2a6ac8cd4f9febdb447368e29c76cd68410bb66e46d9dcfa2d5f75126eea8fc`; alternate is `8d1fb3ceedf142fad32a3504eca1feb4539aecca6de66acde1514b9a61fc7ba0`. Alternate `.mhmat` SHA is `8934dd8d8f3beccc1b212c12116a88b3a88d6265e0a5c8fe42eb62e3fb281ab6`. Both are opaque 2048 × 2048, 8-bit RGB PNGs.

`compare-albedo.mjs` reuses the qualified v2 geometry protocol and all 208 exact selected triangles/UV centroids/areas. Sampling the current PNG reproduces every original sample and summary exactly. The alternate is then sampled with the same top-left glTF orientation, repeat wrapping, half-texel-centered level-zero bilinear filtering, sRGB decode-before-filter convention and rest-area weights. The original bone-relative approximate knee/shin definitions and limits are retained, with no new anatomical segmentation or threshold.

| Region | Current linear red share | Alternate linear red share | Current encoded mean RGB | Alternate encoded mean RGB |
| --- | ---: | ---: | --- | --- |
| Left knee | 0.59873 | 0.60336 | 0.69848 / 0.45669 / 0.38511 | 0.67143 / 0.43134 / 0.36962 |
| Left mid-shin | 0.54510 | 0.56097 | 0.74181 / 0.54086 / 0.45125 | 0.71646 / 0.50399 / 0.42556 |
| Right knee | 0.58400 | 0.59109 | 0.71298 / 0.47960 / 0.40556 | 0.69100 / 0.45540 / 0.39015 |
| Right mid-shin | 0.54650 | 0.55823 | 0.74650 / 0.54241 / 0.45371 | 0.72633 / 0.51387 / 0.43383 |

“Red share” is linear R / (R+G+B), not a perceptual redness score. Encoded means are the sRGB encoding of area-weighted linear means. Knee-minus-shin red share changes from 0.05363 to 0.04239 on the left and 0.03749 to 0.03285 on the right. Both images still have darker and more red-weighted knees than their corresponding shins under this sampling model. Some sampled mid-shin surfaces may be covered by socks; this is not a visible-pixel region measurement.

Across the entire stored atlas, 99.957% of pixels differ, with mean absolute RGB difference 4.722 code values and maximum 110. Those counts include padding and hidden surfaces and are **not** a face/body quality score. They reinforce that selecting the alternate would be a broad change. Face and whole-body native comparisons would be mandatory if it were reconsidered; a leg-only metric could not accept it.

No capture controller was written for the alternate. A future body-map experiment would also need to address actual ownership: `Avatar.js:3020–3024` passes the loaded body map into `createSkinMaterial`, and `SkinMaterial.js:1125` captures that texture in the colour-node graph. Merely replacing `material.map` after startup may leave that node sampling the old texture. The successful micro-normal A–B–A clock/geometry protocol is reusable, but it does not itself qualify a texture replacement or its decoding/disposal path.

- [Inventory and full material provenance](inventory-v1.json), SHA `157b32a1a0a3622f18bc6acac6928474221c17745c53e7f864e4e48db6839e1c`
- [Exact matched sampling comparison](comparison-v1.json), SHA `e38c0cb0290ee035dd85542db5798cc9082e3152371ca3e0f856fc91b453b4da`
- [Reproducible inventory source](inventory.py) and [comparison source](compare-albedo.mjs)

The two original PNGs remain in `captures/skin-albedo-inventory-2026-09-26/`; the ZIP remains in its existing cache. No large duplicate textures are added to this packet and no input files are removed.
