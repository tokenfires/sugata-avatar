# Comparator V2 — fixed bone-frame conversion

V1 PID 14160 ran 20:46:51.922–20:46:54.578 UTC. It recorded complete structural and coverage results, but its posed-skin comparison is invalid: the observer used `C * boneMatrix * C^-1`. The already qualified export bridge (`tools/critic/compare-skeleton-export.mjs`, line 100) establishes `C * boneMatrix` because the exported joint still maps its native bone-local frame into the new world basis. An extra right-hand basis transform does not describe this exporter.

The mismatch is explicit in V1: rest joint components differ by 1.412181666, and even identity skin differs by up to 331.089 mm on the rebuilt control. Those are observer failures, not foundation defects or consequences of four-weight truncation. The complete V1 report, original source and residuals are preserved read-only.

V2 changes only this established conversion and adds a prerequisite on actual rest joint origin/unit-basis witnesses under the prior strict 0.1 mm bar before any posed comparison. It uses a fresh output root, `captures/foundation-native-band-comparison-2026-09-30-v2`, with the same native data, GLBs, poses, topology, masks, coverage targets, and strict 0.342 mm skin bar. No native rerun or candidate change follows.

The original construction control matches shipped position, normal, UV and four-weight rows exactly, while index ordering and two foundation under-mask arrays differ. Preserve those differences and compare oriented triangles/mask values explicitly before interpreting the rebuilt control as a product equivalent.
