# Current neckline: visible foundation attribution

The two stepped grey regions at the accepted shirt's neckline are visible retained bra. This static diagnosis is supported by actual diffuse-tag images and matching posed surface picks. A two-sided outer material leaves them visible. No garment or product behavior changed.

![Accepted shirt and grey neckline patches](../../../../captures/neckline-attribution-2026-09-30-v2/ordinary.png)
![Only the bra tagged magenta](../../../../captures/neckline-attribution-2026-09-30-v2/bra-magenta.png)

## What the five views establish

The [plan](PLAN.md) specified ordinary, bra-magenta, cloth-double, body-green and ordinary-repeat fresh pages. All five used the same actual accepted garment bytes, camera, lights, zero-time pose, recorded physical state and final clock. All completed on Apple metal-3 WebGPU, without recorded page/console/HTTP errors; all five disposals report no leaks. Root and the [independent critic](CRITIQUE.md) inspected the original images.

The predeclared windows retain all 90 pixel-centre samples. Forty-six hit bra first (34 left and 12 right), 24 cloth and 20 body. All 46 remain bra-first with DoubleSide or CPU-only restoration of the full body index. Two distinct witnesses matter:

| Pixel centre | Ordinary → bra-magenta RGB | Actual posed ray order | Meaning |
| --- | --- | --- | --- |
| (206.5, 708.5) | [137,114,104] → [231,12,201] | bra 8881, cloth 1509, body 2401 | Visible bra lies ahead of nearby cloth. The 1.563 mm ray-depth difference is not penetration depth. |
| (516.5, 726.5) | [179,161,146] → [233,132,207] | bra 12280, body 15651 | Foundation is exposed through the neckline; the added DoubleSide cloth 645 is far behind the body. |

All 90 RGB triples match their DoubleSide and ordinary-repeat counterparts exactly. The whole repeat canvas still differs at 410 of 781,200 pixels, at most six channel codes. This is not exact full-image equality. Boundary filtering also matters: a cloth-first sample at (198.5,696.5) changes with the bra tag. Six-hit CPU rays exclude GPU hair, raster coverage, shadows and temporal reconstruction. Missing later hits are not complete miss proofs. Only 14 ordinary bra-first rays have a later cloth hit; this is not evidence for 46 triangle crossings.

## Decision

Close attribution without more tag or clock trials. Next specify one continuous outer-neckline construction around the actual body/foundations, with enough declared support to cover the exposed regions. Assess front and both obliques. This is a new contract; it cannot inherit the closed September 26 fixed-support bra/vest result or silently relax its gates. The alternative is an independently authored lower-cut foundation variant, at the cost of new foundation coverage/fit and configuration work. Extending the old back-face lining alone is unsupported by these images.

Accepted asset `44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783`, body, foundations, hair, masks and all old candidates remain unchanged. There is no candidate or appearance-repair acceptance in this packet.

## Recovery and exact evidence

Commands, from the repository root:

```sh
node tools/figure-pipeline/neckline_attribution_capture.mjs
node tools/figure-pipeline/neckline_attribution_capture.mjs captures/neckline-attribution-2026-09-30-v2
node tools/figure-pipeline/neckline_attribution_analyze.mjs captures/neckline-attribution-2026-09-30-v2
```

- V1 PID 5039 / exec 84788: 15:50:58.132–15:51:10.395 UTC. Failed on an evaluated bare `three/tsl` import after the ordinary capture. Original source, image and error preserved. The instrument repair moved the import into the Vite-loaded helper.
- V2 PID 5217 / exec 80312: 15:52:00.821–15:52:26.001 UTC, exit 0. Temporary browser/server closed. [Report](../../../../captures/neckline-attribution-2026-09-30-v2/report.json) SHA256 `185e179b319535d14ec559db8f31408f201c72861b4c4e009713163787081fcd`.
- [Analysis](../../../../captures/neckline-attribution-2026-09-30-analysis-v1/report.json) SHA256 `8847a3ae6011dbe9649fbca4c6b951707ed635db4de415ef9c1c8c0b05b310ae`. No threshold fitting or omitted sample.
- [Summary](summary.json) includes source hashes, exact witness rows, group statistics and asset pins. [Archive manifest](archive-manifest.json) binds 571 files / 40,238,553 bytes across failed capture, final capture and analysis. It is a local integrity inventory, not an off-machine backup.

No job from this packet remains live. Preserve the existing port-5173 review service.
