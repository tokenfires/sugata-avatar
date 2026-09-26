# Knee colour attribution — CPU diffuse sample

The shipped skin image already contains a darker, more red-weighted front-knee region than
the mid-shin in this bounded measurement. That establishes a baked colour contribution; it does
not determine how much of the rendered knee colour comes from the image, lighting, material or
postprocess. No image, asset or material was changed.

`sample-albedo.mjs` reads the accepted wardrobe body and its exact embedded 2048 × 2048 diffuse.
Native rest `calf_l/r` and `foot_l/r` landmarks define a knee-to-ankle axis. It samples front-facing
triangle centroids in two declared bands: −0.12…0.12 of the lower-leg length around the knee, and
0.35…0.65 for the mid-shin. The radius bound and exported normal constraint are in the report.
These are approximate bone-relative front-surface regions, not artist-verified anatomical masks.
All triangle IDs, centroid UVs/positions, mean normal vectors and individual samples are retained.
Per-vertex seam-split UVs, positions and normals are reconstructible from those IDs and the bound GLB.

The sampler uses glTF's top-left image origin (`GLTFLoader.flipY = false`), repeat wrapping and
linear-light bilinear sampling of level zero. It decodes sRGB before filtering and weights each
centroid sample by its rest triangle area. It does not simulate native texture mip selection,
shading, motion, visibility or postprocessing. The mid-shin may be covered by socks in a rendered
outfit; this is an underlying skin-image comparison, not a visible-pixel measurement.

| Region | Triangles | Area m² | Encoded mean R / G / B | Linear red / (R+G+B) |
| --- | ---: | ---: | --- | ---: |
| Left front knee | 64 | 0.01132976 | 0.69848 / 0.45669 / 0.38511 | 0.59873 |
| Left mid-shin | 40 | 0.01174067 | 0.74181 / 0.54086 / 0.45125 | 0.54510 |
| Right front knee | 64 | 0.01132976 | 0.71298 / 0.47960 / 0.40556 | 0.58400 |
| Right mid-shin | 40 | 0.01174067 | 0.74650 / 0.54241 / 0.45371 | 0.54650 |

Encoded means are the sRGB encoding of the area-weighted linear mean, not an average of encoded
pixels. “Red-weighted” describes the stated channel ratio only; it is not a perceptual redness
score. Exact report SHA-256: `edc36c6f034c90edf89ebae9b840ec8d6be46a42502617e215fab705488b9ff0`.
The v2 report additionally binds the actual Three package/module entry; its numerical packet is
exactly equal to v1, whose source is preserved. Four focused CPU groups check UV orientation/repeat, linear interpolation, sRGB decoding, area
weighting and rejected invalid input. Independent scalar replay and the corrected v2 receipt are accepted in `ALBEDO-CRITIQUE.md`.

The next useful material check remains the plan's matched, isolated native micro-normal A/B.
Turning off the micro-normal cannot erase baked diffuse variation, but its effect on perceived
grain and coloured lighting remains unmeasured. A diffuse correction would be a different,
separately reviewed candidate; there is no justification for replacing or globally smoothing the
accepted skin. Jaw colour is omitted because this leg protocol does not define its boundary.
