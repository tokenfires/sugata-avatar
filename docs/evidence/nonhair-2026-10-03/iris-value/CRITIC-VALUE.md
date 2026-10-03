# Iris-colour existing-input review

Decision: **defer the chooser under this gate**. No supported iris-pigment input exists in the inspected implementation. This is a source/interface finding, not an eye appearance defect. No construction or native comparison is admitted.

## Actual witnesses and mismatch

- `packages/core/src/material/EyeMaterial.js:575–658`: the constructor accepts optic, sclera and catchlight controls. The driven uniforms at 615–628 cover pupil scale, sclera brightness/chroma, limbal ring, catchlight, caustic and key-light direction. None supplies iris pigment. `scleraChroma` changes the whites and cannot honestly serve as an eye-colour control.
- `EyeMaterial.js:910–915,966–989,1035–1041`: the globe reads the original material's composited map, applies the refracted/pupil-remapped iris UV, then calculates `irisSample.rgb * (1 + caustic)`. The sclera and iris are combined with the existing mask/ring into `material.colorNode`. The header's `brown_eye.png` description identifies authored texture colour; it is not a selectable pigment option. Changing the material's plain colour is not the declared iris-only responsibility.
- `packages/core/src/Avatar.js:3260–3288`: `new EyeMaterial({ figure: this.figure })` attaches this material and forwards the existing pupil sink. No iris option is forwarded. The lighting update at 5034–5059 owns the caustic direction, not pigment.
- `packages/testbed/src/showcase-settings.mjs:9–16,19–51`, current `showcase-presets.mjs` and `showcase.html`: supported reconstruction covers hair, clothing, frame, scene and light; no eye-colour field/chooser exists. Extra settings keys are explicitly rejected. A new field therefore needs an explicit API/settings contract rather than only a button.

Previously actually inspected native originals `captures/skin-finish-2026-10-03-v1/original-front.png` and `original-oblique.png` show visible dark irises/corneal highlights (front eye region approximately x580–750,y590–620 in the 1440×1000 original). They establish eye visibility only, with no matched pigment alternative, defect or personality evidence. No new image or render was obtained in this review.

## Two alternatives and tradeoffs

**A — preserve the existing authored brown eyes now (recommended).** Keep current pupil, gaze, blink, sclera and cornea owners and saved recipes intact. This avoids disguising an optic/light control as pigment, while leaving eye-colour customization unavailable.

**B — separately declare a new optional iris-pigment API before a chooser.** A future responsibility must explicitly preserve exact original/default output, pupil/remapped texture detail, sclera, limbus, caustic, cornea and gaze/blink ownership; then qualify settings roundtrip, restoration/lifecycle and actual front/oblique appearance. This could enable meaningful customization but is new shader/API/schema work, not the existing-input task. No transform, palette, parameter value or implementation is selected here.

Stop at this concrete absence finding. Preserve the full character/representation ambitions; do not start an owner inventory, shader rewrite or experiment from this note.

Recorded 2026-10-03T16:27:05.723527+00:00. Current source readback hashes:

- `packages/core/src/material/EyeMaterial.js`: `a64b29c812a7110cfdf8cf1045023628605af0906b607f49cd337a53ba79aa25`
- `packages/core/src/Avatar.js`: `fdbe49aec99f9c718bde269b5e434cda07af1504ea8df386a634714cea112b18`
- `packages/testbed/src/showcase-settings.mjs`: `5beb01f56121f272218a58350455a79bfe4c455c2e27ae1900f1e47bc34a8cad`
- `packages/testbed/src/showcase-presets.mjs`: `07e8773e74c0fb6b0a61427445759a83b68a7b0e5df44ad5a743181fb8f86941`
- `packages/testbed/src/showcase.html`: `6e2b676c1353a9462c5a0c4f6ba59d3cff4a3202070cf064204ac2bcf55533fb`
