# Continuous-plane boundary study — closed without a candidate

## Result

The two plane intersections and their interpolation receipts pass. **The declared plane-only boundary contract fails before offset, roll or candidate export.** The unchanged torso dominant-bone rule creates 128 additional boundary vertices within the height band, around the underarms. This is a real domain boundary, not an established bisection or interpolation failure. No rendered cut-band appearance, final skin, coverage or clearance result exists.

Both root and critic previously observed the original whole-face band's stepped/toothed hems. This experiment deliberately changed boundary representation once, preserving the existing anatomical heights and torso selection. It exposed a conflict: a horizontal top loop cannot describe the complete boundary of that retained torso domain. Do not remove the admission or silently include arm vertices to make this recipe pass.

## Actual witnesses

The V3 padded patch has 10,602 vertices. The original torso/height selection retains 6,925, with 878 vertices adjacent to excluded vertices. Of those, 128 lie on neither effective height plane; every excluded neighbour of those 128 is itself within the height interval. See [complete domain witnesses](boundary-diagnosis.json).

Native vertex 25 is at `[-0.1585935354,-0.0593539774,1.2547893524]`, with spine_03 weight `0.4987499118` exceeding upperarm_r `0.4957496226`, so it is retained. Its neighbour 5262 has Z `1.2554998398` and upperarm_r weight `0.5233523846`, so it is excluded by the torso rule. Both heights lie inside `[1.1523144245,1.2695089579]`. This creates an underarm boundary independently of the top/bottom planes.

Each split creates exactly 392 vertices. Lower/upper maximum position interpolation errors are `7.43245656e-9` and `8.07661980e-9` metres. Full weight and corner UV component errors stay below `8.2e-8`, within the predeclared `2e-6` limit. Original vertex positions/weights/masks stay exact. Every crossing has one source edge, per-face UV provenance and an explicit vertex-group index/name table. The effective float32 planes and nominal anatomical formulas are separately recorded.

## Control comparison correction

V1 stopped before a cut on ordered-array control equality, without first saving its complete control. Instrument-only V2 preserves that payload and stops at the same guard. Independent review establishes identical oriented polygon/triangle multisets, exact positions, weights, masks and mapped UVs; 875 polygon rows and 1,750 triangle rows reorder. Real normal differences remain, maximum component `1.1920928955078125e-7`.

[Control recovery](CONTROL-RECOVERY.md) and [independent critique](CONTROL-CRITIQUE.md) record witnesses and alternatives. V3 uses the explicitly revised **geometric/data control**, reports every normal residual without a new tolerance, and retains the frozen exact parent GLB as its intended visual baseline. Original exact normal/shading identity remains failed. The builder's source and construction parameters did not change. This comparison correction does not qualify the subsequent boundary failure.

## Exact jobs and frozen evidence

All commands used the same isolated offline wrapper:

`tmp/wardrobe-sep30/blender-isolated.sh --background --python-exit-code 1 --python tools/critic/foundation-cut-band.py > tmp/foundation-cut-band-sep30/native-vN.log 2>&1`

| Version | PID / exec | UTC start–finish | Report SHA256 |
| --- | --- | --- | --- |
| V1 | 78780 / 29176 | 21:27:44.441682–21:27:49.266087 | `d280ab6d09b9cd69c5880cf8f77936f7faeb39c0448cf10262782f34b54110e9` |
| V2 | 80687 / 50487 | 21:28:54.568326–21:28:59.587057 | `1e6ede5d15bb6e4695fed70b02e6a8d0cc376c6cee5acb1296a7bf8f3a41ce77` |
| V3 | 88444 / 84163 | 21:33:54.056186–21:34:08.672509 | `839835a1d9fae340c2d11e6f0f193cdfcc011a3bc113c39e6342484891afed21` |

All exited 1 at their recorded guards. The raw roots `captures/foundation-cut-band-2026-09-30-v1`, `-v2` and `-v3` preserve each exact executed source, failed report and available native data. V3 includes full pre/post cut patches, interpolation witnesses, rig/body records and the rebuilt control GLB. No cut-band GLB was exported. The prepared unexecuted comparator/clearance/capture scripts with unresolved input pins were removed; none of those jobs started.

The [archive manifest](archive-manifest.json) contains **127 files / 207,863,969 bytes**, SHA256 `ecec9b1d7709ef88b0f8bf9492d41cc74576dca74206c8059b291a70cc5ac2dd`. Root verified all archived input and compressed/decoded artifact hashes. Every raw file is read-only. This is local preservation, not an off-machine backup.

Owned read-only Blender disk14 was verified and detached at **21:36:15.981484 UTC**. No native, CPU or GPU/browser job remains. Keep review Vite PID 2323 / port 5173. Accepted assets and product source/defaults are unchanged. Latest usage check allows ordinary use, 43% weekly used and all 62,500 granted credits intact.

## Next decision

The [independent domain critique](DOMAIN-CRITIQUE.md) is complete, SHA256 `1395f41d4a3f90a006b54a2ea19c86152f5d8ed5385f283455781d50f955a478`. Any continuation must explicitly include the torso/arm boundary in its contour definition or choose a different anatomical rim contract. A new continuous field cut could preserve the existing weight-defined domain while cutting through faces; a deliberately authored anatomical contour would be broader and must establish its own fit. First inspect exact source feasibility and record the tradeoff. No plane/offset/refinement sweep or promotion follows from this closed observation.
