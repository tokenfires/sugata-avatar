# Native helper and original-garment arithmetic

## Result — independently accepted

The missing native oracle now exists. Using Blender5.2.2LTS (`d13f752e3b9c`) and the unchanged cached MPFB2.0.17, three fresh g050 humans reproduce the declared joint shoulder-distance/upper-leg-height cases at0,0.25and1. Each retains all19,158 evaluated body/helper vertices and all2,197 original casual-garment vertices. The comparisons use the original strict limits; no alignment or tolerance was fitted.

| Joint weight | JS fit with native body: max garment error | SDK detail delta: max body error | Native-neutral + SDK detail + JS fit: max garment error |
| --- | ---: | ---: | ---: |
| 0 | 0 mm | 0 mm | 0 mm |
| 0.25 | 0 mm | 0.000037338 mm | 0.000119442 mm |
| 1 | 0 mm | 0.000044743 mm | 0.000059605 mm |

All2,197 native-input garment vertices are exactly equal in all three cases. The SDK-delta path has the small nonzero residuals above and must not be called exact. Body deltas are below0.001mm; garment errors are below0.1mm. The recorded worst-coordinate witnesses and every resulting coordinate array remain in the raw reports.

The old cached absolute baseline also passes its first independent native comparison: max0.000835604mm across19,158 vertices, and0.000834632mm across the5,778 helpers. The worst helper is original vertex14088. None of these absolute coordinates is exact. This closes the specific missing native helper oracle; it does not broaden the observed identity or target cases.

## Why this is independent

The original MPFB service constructs each human and loads both targets. It attaches the original garment through `HumanService.add_mhclo_asset` and invokes the unmodified `ClothesService.fit_clothes_to_human`. A read-only trace records its actual from-mix input and three scale values after scale calculation. Those full inputs exactly match a separate evaluated-mesh read with only masks temporarily disabled and restored. Evaluated body topology remains exact; garment attachment/refitting leaves the evaluated body unchanged. Object transforms, raw and normalized macro stacks, shape-key order/weights, native parsed mhclo rules and original garment polygons are retained.

JS first consumes the actual native body, checking its parser, offsets, signed weights and scales against the native model. It then independently starts from the observed neutral body, applies current `IdentityCatalogue`/`IdentityTargets`, and refits the resulting body. No native shaped answer is substituted for this second path. Both paths retain all vertices and strict maximum Euclidean gates.

The negative controls compare with independent native full-weight garment coordinates:

| Deliberate corruption | Maximum error | Clean parent passes |
| --- | ---: | --- |
| Rule0 helper17090 replaced by17384 | 3.530136 mm | Yes |
| Reverse offset's Blender Y sign | 30.558500 mm | Yes |
| Omit helper detail deltas | 106.886572 mm | Yes |
| Inject0.2mm into one garment coordinate | 0.200000 mm | Yes |

Each trips the unchanged0.1mm garment bar. Corrupted coordinate artifacts are preserved. A sensitivity result is interpretable only when its clean parent passes; this condition was added after source critique before the comparison ran.

## Provenance and decisions

1. The original September26 tool-availability blocker changed after the overnight hair trace recovered a cached runtime. Reuse that discovery in a separately cloned profile; do not repeat the completed CPU reconstruction or source-to-export map as substitutes for native evidence.
2. Source critique found unbound metadata and late imports. Choose full installed-addon/archive correspondence plus a final loaded-module census; the alternative selective dependency list would require ongoing completeness maintenance. All2,384 original MPFB archive members match the pinned ZIP; initial/final loaded-module sets each contain526 entries. Garment data and declared target members are pinned separately. Actual loaded source, target/asset data and confirmed metadata are copied into the native packet.
3. V1 stopped before any case because its macro-stack assertion compared native `[file,weight]` pairs with equivalent named objects. Preserve its source, full failure and process log. V2 normalizes the comparison representation and retains the original pairs; values and order remain exact. This was an instrument-schema repair, not a native arithmetic adjustment.
4. Existing source/target/kernel inputs relevant to this oracle match September26 pins. The changed historical inputs are roadmap text, the unrelated probe's `Path` import repair, and wardrobe runtime colour metadata. Their old/current hashes are recorded in preflight; the old proof inventory is unchanged.
5. The temporary runtime was detached only after verifying the recorded image/device/mount and no Blender process. The isolated profile remains for recovery. Main Vite service was preserved.

## Commands and recovery

```sh
tmp/wardrobe-sep30/blender-isolated.sh --background --python-exit-code 1 --python tools/critic/wardrobe-native-oracle.py
node tools/critic/compare-wardrobe-native.mjs
```

The wrapper currently cannot run because its owned temporary runtime is intentionally detached. A future run must deliberately remount the pinned cached image and choose fresh output directories. Both instruments refuse existing output directories.

| Job | PID / root session | Finished UTC |
| --- | --- | --- |
| Native V1, schema failure | 55087 / 97611 | 17:00:19.434555 |
| Native V2, complete | 56774 / 5160 | 17:01:27.207716 |
| JS comparison V1 | 58235 / synchronous command | 17:02:16.575 |
| Verified runtime detach | completed / exit0 | 17:03:31.986328 |

Raw roots: `captures/wardrobe-native-oracle-2026-09-30-v1`, `captures/wardrobe-native-oracle-2026-09-30-v2`, `captures/wardrobe-native-comparison-2026-09-30-v1`. All jobs exited. Native V2 includes startup and detach receipts, exact runtime/image pin, complete source bindings, copied loaded sources and data, and original process logs. The [independent critique](CRITIQUE.md) reproduces the arithmetic and all four negative controls in Python. The [manifest](archive-manifest.json) freezes 590 local files / 29,309,306 bytes; [summary](summary.json) records report and critic hashes. The manifest is a recovery index for local ignored evidence, not a remote backup.

## What remains

This is original unrigged garment arithmetic on one neutral macro recipe and two detail targets. It creates no production GLB or appearance candidate. It does not establish corrected-trouser transfer, skeleton refitting, foundations, exported shading/weights, signed body/garment clearance, motion, wider-gender support or representative builds. The original0.001/0.1mm arithmetic gates do not replace10.9's separate fit criteria. The current accepted assets/defaults remain unchanged, and9.4/10.9 are not marked complete.

The three cases retain identical native scale measurements. Source arithmetic covers scale recalculation, but this run does not independently qualify a target that changes the three native scale distances.
