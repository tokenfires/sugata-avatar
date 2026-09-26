# Smallest next proof for wardrobe coupling (10.9)

The next useful slice is an **isolated arithmetic comparison for one original `female_casualsuit01`**, using g050 and two detail sliders at weights 0, 0.25 and 1. It can establish whether JS reproduces native MPFB refitting. It cannot complete 10.9, start 9.4, or qualify fit, motion, a body family, foundations or the installed corrected garment.

**Native execution is currently blocked.** `/opt/homebrew/bin/blender --version` exits 126: its Homebrew 5.2.1 wrapper points to the missing `/Applications/Blender.app/Contents/MacOS/Blender`. The documented user Blender/MPFB directory is absent; Spotlight finds no Blender app. These are scoped observations, not proof that no executable exists anywhere. No installation, native build, browser or GPU job was run.

## Inputs that really remain

[inventory-v1.json](inventory-v1.json) binds 28 repository inputs, both cached archives, 22 archive members and the exact retained neutral macro recipe. Its SHA-256 is `a5efb4f0882a47fa3276b4b059427a85d008fad28c4177030a17c358387e99f0`.

| Input | Current evidence | Use / limit |
| --- | --- | --- |
| Cached MPFB | `tools/figure-pipeline/.cache/mpfb-2.0.17.zip`, hash `4f0a879d…9a87`; native `BUILD_INFO="20260722"` | Contains native services, 19,158-vertex `data/3dobjs/base.obj` and every one of the eight retained g050 macro targets. This is data/source availability, not an enabled installation. |
| Cached clothes | `makehuman_system_assets_cc0.zip`, hash `b542127a…0107`; casual mhclo `8a17e4ed…3fa4` and OBJ | 2,197 rules / original OBJ vertices. All 1,879 barycentric source vertices are helpers; six separate body vertices determine scale, giving 1,885 total dependencies / 22,620 bytes as float32 positions. |
| Detail targets | Current `torso.bin` and `legs.bin` | The shoulder-distance and upper-leg-height positive target slices match the cached target records **byte for byte** after the existing float32 metre packing. They include 1,044 and 2,167 helper records respectively. |
| Body correspondence | Current `figure-vertex-map.bin` | 14,517 glTF positions map onto exactly indices 0–13,379. Current figure and wardrobe-body POSITION accessor bytes are identical. The map contains no helpers. |
| Historical native answers | `fixtures/body100.delta.i32.gz` and sidecar; `macro-stacks.json` | Native displacement fields and exact neutral stack remain. A displacement field is not the missing absolute helper baseline. No full `neutral.f64` was found within the recorded search scope. |
| Original / accepted casual GLBs | Original `109dad…5160`; installed `44eb…c783` | Both provenance roles matter. Installed geometry includes the reviewed trouser correction. Source OBJ 2,197 vertices versus glTF 2,377 positions requires an explicit split-vertex mapping, which was not found. Never substitute a fresh raw refit for accepted corrected positions. |

The old `tools/identity-pipeline/probe.py` also uses `Path(__file__)` at line 13 without importing `Path`. It is a useful source reference, not a runnable recipe as-is. It was left unchanged. Its fixture builder writes production assets, so do not run `build_from_blender.mjs` for this isolated proof.

## First: independent cached-data consistency check, still proposed

The necessary data exist for this bounded CPU check. It has **not** been executed here.

1. Read the pinned cached `data/3dobjs/base.obj` in original vertex order. Reproduce the source import/axis/scale operations from `ObjectService.load_wavefront_file` and `load_base_mesh`; apply the exact eight files and weights in `inventory.sourceData.neutralRetainedRecipe`. Preserve recorded scale `0.10000000149011612`, source float32 storage boundaries and native accumulation order. Do not round the six ethnicity-derived weights to 0.165.
2. Reproduce `HumanService.create_human` grounding: `ObjectService.get_lowest_point` considers only body indices below 13,380; the applied translation is `abs(lowest_point)`. Reproduce the pipeline's subsequent gender assignment and macro reapplication. Do not ground on the helper minimum, fit a free translation, rescale to the observed body, or replace helper positions with nearest skin.
3. Convert Blender `(x,y,z)` to glTF `(x,z,-y)` and compare against **every** current mapped body position, including seam duplicates. Keep exact source/target/order/transform records, RMS/max/per-axis residuals and worst IDs; use the existing identity comparison bar of strictly less than 0.001 mm as a proposed data gate. A failure remains a failure to explain, not an invitation to tune alignment.
4. A passing 13,380-body-vertex comparison supports the recipe and current correspondence. It **does not independently validate the 5,778 omitted helper coordinates**. Save reconstructed helper coordinates explicitly as derived data; native all-19,158-coordinate output is still required below.

This check can be authored/run CPU-only if separately authorized. No new reconstruction script or baseline was manufactured by this inventory.

## Then: one native garment oracle and one JS consumer

After a usable Blender/MPFB environment is separately made available, add a new evidence-local Python oracle and JS comparator. They must write only a fresh evidence directory, not `assets/` or existing fixtures. Use the cached, pinned service version or record a successor toolchain and new control; a version string alone cannot establish source parity.

**Native oracle.** Make three fresh humans with the same g050 macro recipe. In each, apply both `torso/measure-shoulder-dist-incr` and `legs/upperlegs-height-incr` at one of `[0, 0.25, 1]` using `TargetService.load_target`. Load the original casual suit through `HumanService.add_mhclo_asset(..., asset_type="Clothes", material_type="GAMEENGINE")`; call the actual `ClothesService.fit_clothes_to_human`. No rig, animation, foundation reconstruction or export is needed for this arithmetic experiment. Dump the evaluated full 19,158-vertex body (helper masks disabled only for the dump and restored), actual scale values, mhclo parsed values, original garment vertex order/topology and 2,197 fitted coordinates before export. Record object transforms and shape-key order/weights, actual loaded service/asset hashes, Blender build hash and raw/lossless decoded output hashes. Hash inputs again at completion.

**JS comparison in two stages.** First feed JS the *native* evaluated body to isolate the mhclo parser/refit calculation. Then seed JS with the native neutral full body and apply the existing `IdentityCatalogue.resolve(values)` / `IdentityTargets.useBasemeshSpace().apply(..., {axis: AXIS_BLENDER})` for the same detail stack. The values use the catalogue IDs `torso/measure-shoulder-dist-decr-incr` and `legs/upperlegs-height-decr-incr`; verify the resolved files/weights against the native case. Compare all 19,158 body deltas to native below 0.001 mm, then the refitted garment below **0.1 mm maximum Euclidean vertex error**. Report all three cases and worst vertex witnesses; no averages-only pass. The zero-target case must pass before interpreting reshaped cases.

The pinned cached semantics are explicit:

- `Mhclo.load` converts raw offset `(dx,dy,dz)` to Blender `(dx,-dz,dy)`.
- `x_size=abs(V[5399].x-V[11998].x)/1.3980`; `y_size=abs(V[791].z-V[881].z)/2.2048`; `z_size=abs(V[962].y-V[5320].y)/1.8461`.
- `ClothesService.fit_clothes_to_human` evaluates `w0*V[a] + w1*V[b] + w2*V[c] + (offset.x*x_size, offset.y*z_size, offset.z*y_size)` on the shape-key mix. It does not simply read the unevaluated base mesh.
- Preserve signed, unnormalized weights: the actual minimum is −0.11017 and sums range from 0.99999 to 1.00001. Do not clamp/renormalize. Fail closed on malformed/nonfinite/out-of-range data; pin all six scale references and require finite nonzero denominators. Do not silently reproduce native out-of-range skipping as a successful row.

Before accepting the comparator, independently corrupt a helper index, omit helper target deltas, reverse the offset axis sign, and inject a garment difference above 0.1 mm; require failures. Preserve failure geometry. These checks distinguish an arithmetic match from a test comparing JS with itself.

Future command interface, **not implemented or run**:

```sh
"$BLENDER" --background --python-exit-code 1 --python <evidence-local-native-oracle.py> -- --out <fresh-oracle-directory>
node <evidence-local-js-comparator.mjs> --oracle <sealed-oracle-directory> --out <fresh-comparison-directory>
```

## What comes after that proof

A native arithmetic pass still leaves the original-OBJ-to-glTF split mapping, the installed trouser corrective's identity-dependent behavior, skeleton refit (10.7), helper packaging, complete garment/foundation interactions and 10.9's actual signed point-to-triangle fit measurements. The current open 10.9 thresholds remain covered skin outside cloth ≤26.37% and worst depth ≤9.19 mm; none was evaluated or relaxed here. Body-only correspondence cannot establish any of those claims. Keep the current accepted asset/defaults unchanged and 9.4 held.
