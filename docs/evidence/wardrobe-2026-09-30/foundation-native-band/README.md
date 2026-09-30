# Native band prototype — September 30

## Decision

**Keep experimental.** One band-only native construction removes the visible grey foundation islands at the casual neckline in the captured front and both oblique views. Its exposed top edge remains stepped and its lower hem remains sawtoothed. The source geometry and finite coverage/binding evidence support the new cut, but the exposed finish does not meet the appearance goal. No asset or product default was replaced.

This is a deliberate band variant using the existing anatomical floor/ceiling, without shoulder straps. The [construction plan](PLAN.md) changed that predicate once and reused the existing refinement, offset, relaxation and rolled hem. No cutoff or offset sweep occurred. The next useful change is a continuous boundary representation, with a separate contract; repeatedly increasing refinement or nudging the current teeth is not the chosen path.

## What was established

- Fresh native source body: 13,380 retained vertices, exact zero positional difference from the accepted g050 body through the existing 14,517-entry export map. All six body mask/target fields are exact; all full weights and 53 rest bones agree with the pinned native control.
- Band: 7,047 native / 7,070 exported vertices and 13,218 triangles. One connected annulus, two valid boundary loops (484 and 392 vertices), zero invalid vertex links, nonmanifold edges or orientation errors.
- Independent unchanged source coverage: all 110 required chest rays and all 3,780 supplementary fan samples pass. The supplementary set includes duplicates and is not continuous coverage proof.
- Actual loader-normalized four-weight positions against full native: maximum **0.123488117 mm** for the band and **0.184982428 mm** for the rebuilt control across identity, elbow and coupled poses, below the unchanged strict 0.342 mm finite bar. Full native data retained up to six influences. No all-motion claim follows.
- Exact native/export position, UV and custom mask correspondence. Maximum corner-normal component differences are separately recorded (band approximately 0.000061721); normal-path qualification is not included in the position pass.
- Full accepted-body source-rest audit: all 13,218 band triangles have positive distance, outside centroids and five agreeing nonambiguous parity rays. No intersections, inside centroids or negative vertex samples. Closest full triangle distance is **0.282839653 mm**, at band triangle 12979/body triangle 20664. This is a different measure from the author's 0.802 mm nearest-refined-skin vertex standoff and supplies no moving margin.

Read the [independent numerical critique](COMPARISON-CRITIQUE.md), [summary](summary.json), [clearance protocol](CLEARANCE-PLAN.md) and [visual protocol](CAPTURE-PLAN.md).

## Actual appearance

The [shipped front](../../../../captures/foundation-native-band-visual-2026-09-30-v1/shipped-casual-portrait-0.png) has grey islands at both sides of the casual neckline. They are absent in the [band front](../../../../captures/foundation-native-band-visual-2026-09-30-v1/band-casual-portrait-0.png), [left oblique](../../../../captures/foundation-native-band-visual-2026-09-30-v1/band-casual-portrait--45.png) and [right oblique](../../../../captures/foundation-native-band-visual-2026-09-30-v1/band-casual-portrait-45.png). The body, shirt, hair, rig, lights and matching cameras are held. All band triangles are hidden by the existing casual under-mask; this is an admitted cut/mask result, not evidence that a larger original foundation now fits under the shirt.

The [exposed band front](../../../../captures/foundation-native-band-visual-2026-09-30-v1/band-foundation-torso-0.png), [oblique](../../../../captures/foundation-native-band-visual-2026-09-30-v1/band-foundation-torso--45.png) and [back](../../../../captures/foundation-native-band-visual-2026-09-30-v1/band-foundation-torso-180.png) retain visible step/teeth patterns. Root rejects this exposed finish. These patterns also appear on the original foundation; reuse of its pipeline did not make them a finished new design. The body views retain complete-character context; portrait obliques have limited face/hair framing and are evaluated for the visible neckline only.

The set contains 23 actual images and 23 clean owner disposals. Root inspected all ten band originals and actual shipped/control comparisons; the critic inspected all 23 originals. No exact-image, temporal convergence, moving appearance or broader body-range acceptance is claimed.

## Why the rebuilt control differs from the shipped bra

The rebuild exactly matches every attribute of the pinned original authoring fixture `69fb5b0ae4efd9e99650d31e3e28676cebc8bd881f2a4adea39ef050d31455a8`, including positions, normals, UVs, four weights and inherited masks. Its oriented triangle multiset is also exact; ordering differs.

The accepted shipped bra has later calibrated under-mask additions from `wardrobe_under_masks.mjs`. Using the actual any-hidden-corner removal rule, the rebuild draws 3,996 casual faces versus 327 shipped, preserving all 327 and adding 3,669. It is a construction control, not a matched dressed-mask control. The **shipped original remains the visual baseline**. The new band retains its own native inherited masks; no old calibration is reapplied to a different mesh.

## Observer corrections retained

Comparator V1 incorrectly conjugated native bone matrices; the established exporter convention is left multiplication by the coordinate basis. Its identity errors are observer failures, not a garment defect. [V2](COMPARISON-V2.md) corrected that convention and added rest-frame admission. [V3](COMPARISON-V3.md) then corrected the runtime face-retention observer and reproduced the loader's float32 normalized weight storage. All three packets and original sources remain frozen. Geometry, native data, poses, thresholds and targets did not change between them. Only V3 establishes the reviewed finite runtime correspondence.

## Exact commands and recovery

- Inputs: `node tools/critic/foundation-native-band-inputs.mjs` — PID 96721, finished 20:36:07.911 UTC.
- Native: `tmp/wardrobe-sep30/blender-isolated.sh --background --python-exit-code 1 --python tools/critic/foundation-native-band.py > tmp/foundation-band-sep30/native-v1.log 2>&1` — PID 6809 / exec 57848, 20:42:11.380964–20:42:19.867061 UTC.
- Comparator versions: `node tools/critic/foundation-native-band-compare.mjs > tmp/foundation-band-sep30/comparison-vN.log 2>&1` — V1 PID 14160; V2 PID 17158; V3 PID 26247 / exec 49982, finished 20:54:06.612 UTC. The versioned raw roots each preserve the exact executed source.
- Clearance: `node tools/critic/foundation-native-band-clearance.mjs > tmp/foundation-band-sep30/clearance-v1.log 2>&1` — PID 26664 / exec 68463, 20:54:17.660–21:01:37.404 UTC.
- Visuals: `node tools/critic/foundation-native-band-capture.mjs > tmp/foundation-band-sep30/visual-v1.log 2>&1` — PID 32317 / exec 82241, 20:58:03.173–21:00:09.366 UTC.

Every job exited. Probe browser/port-5301 server closed. Root verified and detached the owned read-only Blender disk14 at 20:43:03.986870 UTC; receipt is archived. Keep the main review service PID 2323 / port 5173. No model, subscription, reset credit or product asset changed. Latest account check: ordinary use allowed, 42% weekly usage, all 62,500 granted credits intact.

### Frozen reports

| Observation | Report SHA256 |
| --- | --- |
| foundation-native-band-2026-09-30-v1 | `4c0af966683e9890b861c6374e50ed1c7d2bc347907d23a2dd3c3ff3c812837f` |
| foundation-native-band-comparison-2026-09-30-v1 | `3a3eb9d2a49ec56aac4bdccfe1343525d21cc95b5ceb693076b8e7faf85dfe0f` |
| foundation-native-band-comparison-2026-09-30-v2 | `b2c5697f9b0dd7cdc71de20caec418dcfb9656a473875f2f6f75f3a57a3cc7a4` |
| foundation-native-band-comparison-2026-09-30-v3 | `ac55da64915afcf30b7121d21c94d9508f10f9b1b2f944667c72b23bf602beba` |
| foundation-native-band-clearance-2026-09-30-v1 | `b3eb77fd0172b3d8a25650be736b5bd3a91b385c54deddff114d379e84853290` |
| foundation-native-band-visual-2026-09-30-v1 | `27cd46ba87bb183b65dbb2dfa0d3983409b556599b6e2a67ed2f2df193aeb9f4` |

Band GLB SHA256: `c82805f09177627376a9b6ec821c754c020ef1b2cc7a074e6960523e8f5641bd`. Rebuilt control: `af908bb0155fcdd1140a5d66855ba293d9e413e8923807bd2994205f0910f3bb`. Numerical critique: `eecfcdb4ba1eaa447451555c7bc40e9b44a34b8872aeef37692ca03de9b9df3c`.

The [archive manifest](archive-manifest.json) records **599 files / 578,031,022 bytes**, SHA256 `681ace97c737d65f6196409f26b3350c4d1b5b179819dfe727d57eea03812655`. Original failures, executed sources, native weights/corners/poses, blend, GLBs, current runtime/asset bindings, images and logs are retained read-only under the ignored capture roots. This is a local archive, not an off-machine backup.

Independent [static appearance and rest-clearance critique](VISUAL-CRITIQUE.md) is complete, SHA256 `47781de688f930981be6fa29346e0c4f427266696b181f53c7d85bf6ac9719ea`. The critic inspected all 23 originals and independently reconstructed the closest full-body witness. Root chooses alternative A: a separately declared intersection of the padded refined patch with the unchanged anatomical planes before normals/offset. Original prototype remains unpromoted and frozen.
