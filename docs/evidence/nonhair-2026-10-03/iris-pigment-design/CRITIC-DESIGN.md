# Isolated iris pigment design review

**Conditional worth-doing: yes, one fixed Original/Blue static preview.** This can decide whether the new pigment transform produces a visibly useful colour choice while preserving the existing eye presentation. It cannot establish a supported Avatar setting, physical pigment model, continuous-motion quality or a default. Construction/native admission still requires a separate literal plan and complete source preflight.

## Visible purpose

Actually re-viewed `captures/skin-finish-2026-10-03-v1/original-front.png` at its 1440×1000 original: the right visible iris around x707–744,y600–620 is dark and readable; the other eye around x574–608,y600–620 is partly hair-occluded. The same packet's previously inspected original oblique supplies an angular context. These are useful existing view compositions for a colour comparison, not evidence that brown eyes are defective or that Blue will improve identity/personality.

## Concrete source issue and two alternatives

`packages/core/src/material/EyeMaterial.js:609,910–913,1035–1041` captures the current mesh material, reads its `map`, and builds `colorNode` from the sampled map. The built globe material never assigns that source texture to its own plain `map` field. Thus constructing another `EyeMaterial({figure})` after Avatar attaches its shader does **not** establish access to the original composite texture. A donor made that way would be an invalid comparison.

**A:** synchronously expose the exact original source material on the existing globe only during donor construction, restoring the actual Avatar material in `try/finally` before any draw. This avoids a new constructor input but introduces a temporary scene binding and stricter construction-failure restoration duties.

**B (root selected; supported here):** explicitly add `previewSourceGlobeMaterial` to the isolated copy, using `options.previewSourceGlobeMaterial ?? this.globeMesh.material`. Pass identity-exact `Avatar.eyes.originalGlobeMaterial`, retain existing array/single handling, and require the sampled map identity/UUID equals that original source map. This adds one declared source-only constructor change but avoids temporary mesh ownership changes. It is a preview argument, not a core API or saved field.

## Finite transform and ownership conditions

The selected Blue is exactly `#527b97`, converted by installed Three to linear RGB and normalized by its positive Rec.709 luma. Replace only the annular iris sample's chromaticity with `sampleLinearLuma * blueNormalized`; preserve the original sample on the pupil side using the declared `1-step(irisRadial,pupilEdge)` selector. Equality belongs to the original pupil. This preserves input linear luma mathematically, not perceived brightness, spectral pigment, or every original colour detail. The hard pupil boundary and existing outer iris-mask blend remain declared artistic limitations; an undesirable ring or spill is a refusal witness, not permission to retune.

Keep the original refracted/pupil-remapped UVs (966–989), caustic, limbal, sclera, diffuse normal and roughness equations unchanged. Changing the iris contribution necessarily changes the existing fractional iris-mask transition; do not promise unchanged pixels throughout that transition. The original sclera branch and actual cornea must retain their owners.

`Avatar.js:1514–1519,2945–2950` keeps the pupil sink and post-skeleton frame update on `Avatar.eyes`. A never-attached donor will not automatically receive either. For this fixed pose, copy the actual original pupil/key-direction values and update donor frames after current world matrices/morphs; record exact owner/frame/value equality before each view. Do not add a second pupil sink or replace `Avatar.eyes`.

`EyeMaterial.js:668,692–726` makes donor `attached=false`; detach then does nothing, and disposal releases its newly built globe/cornea/catchlight resources without disposing the borrowed map. Restore the actual Avatar globe **before** donor disposal, then dispose the Avatar independently even on failure. Original mode uses the actual unmodified globe, not an asserted mix-zero reconstruction. Pin the copy's exact diff and resolved measurement/catchlight dependencies; allow only the declared source argument, chromaticity uniform, iris transform and necessary import relocation.

Stop the design gate here. Recommend one separate bounded four-original preview plan only if these explicit ownership/source conditions are implemented and reviewed. No palette search, schema/control promotion, extra shader tuning or native experiment was performed by the critic.

Recorded 2026-10-03T16:37:09.857322+00:00. Source readback: EyeMaterial.js `a64b29c812a7110cfdf8cf1045023628605af0906b607f49cd337a53ba79aa25`; Avatar.js `fdbe49aec99f9c718bde269b5e434cda07af1504ea8df386a634714cea112b18`.
