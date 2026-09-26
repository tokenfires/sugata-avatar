# Native wardrobe oracle recovery

**No adequate retained oracle was found within the bounded search.** The required packet is native evaluated positions for all 19,158 body/helper vertices and the original 2,197 garment vertices, with both `torso/measure-shoulder-dist-incr` and `legs/upperlegs-height-incr` at joint weights 0, 0.25, 1. Historical measurements, current CPU reconstruction, and an exported neutral garment do not supply that packet.

[inventory-v1.json](inventory-v1.json), SHA256 `52c422b66f3da51ee452378810d99e9de459396913b2bc917bd614f9e0868d4f`, binds the source/fixture files, exact path checks, search commands and returned filenames. No archive was reopened or inventoried again, no geometry was reconstructed, and no native application, browser, GPU, installation or asset write occurred.

## Where the old measurements lead

`docs/PUNCHLIST.md` 10.7/10.9 derive from `docs/research/identity-sculpting.md` §1.3/1.4. The latter records Blender 5.2.0 LTS `fbe6228777e7`, MPFB build 20260722, a g050 base, and the paired shoulder-distance/upper-leg-height targets at 1 and 0.25. Its garment drift and refit timings are prose results. The source explicitly places the original probes and modified build script outside the repository at **`…/scratchpad/identity/`**; the wardrobe study similarly says `…/scratchpad/wardrobe/`. Neither supplies a resolvable prefix or output filename. No prefix was guessed and no home-directory search was made.

The actual retained probe is `tools/identity-pipeline/probe.py`; the initial `tools/spikes/identity-inventory` lead was a guessed path, absent from the current/ignored tool filenames and available Git path history. The real probe takes caller-provided `--out DIR` and writes `<label>.f64`, `<label>_basis.f64`, and a JSON sidecar. It deliberately disables modifiers for the evaluated dump so all 19,158 vertices remain. It dumps no garment. The existing missing `Path` import was left unchanged; the probe was not run or repaired.

`build_from_blender.mjs` takes another caller-provided `--dumps <dir>`. Its comments explicitly say that neutral positions need not be committed. Its actual fixture writer subtracts `neutral.f64`, rounds the difference to int32 nanometres, and writes four compressed displacement fields. Therefore the absence of retained absolute positions is explained by the retention format, not evidence that the historical native runs did not occur.

## What remains, and what it can establish

| Retained item | Actual scope |
|---|---|
| `face100`, `face025`, `body100`, `mixed` fixtures | All four decode to 57,474 int32 components: 19,158 displacement vectors. Sidecars retain target stacks, native version labels, scale and identity recipe. They are native-derived deltas, not absolute helper coordinates. |
| `body100` specifically | Seven targets at 1, including the two requested ones plus five others. It has neither the isolated two-target cases nor a quarter-weight body counterpart. Subtracting modeled target contributions would manufacture a derived answer, not recover an independent native oracle. |
| `macro-stacks.json` | Native-computed neutral and non-neutral macro target recipes, without vertex positions. |
| `figure-vertex-map.{json,bin}` and current g050 body | Correspondence to 13,380 skin vertices; no exported helper baseline for the remaining 5,778. |
| Original casual GLB and today's source-map proof | Exported neutral garment geometry/correspondence. They do not supply the pre-export native refit arrays at all three weights or validate all helper positions. |
| Today's `proof-v1` body/refit arrays | Explicitly derived CPU data. Their native-oracle limitation remains unchanged. |

## A useful retained environment, but no saved native result

The repository still has `tmp/hair-sep24/blender-profile`. Its five relevant MPFB service/parser files, base OBJ, and original casual mhclo/OBJ **match the already recorded archive-member hashes**. This is an existing unpacked profile and source-data availability; it is not a new installation or positional oracle.

The associated install log records Blender 5.2.2 LTS `d13f752e3b9c` with MPFB 20260722, a later toolchain than the original study. Its exactly documented executable, `tmp/hair-sep24/blender-volume/Blender.app/Contents/MacOS/Blender`, is absent. The profile's user cache is empty. Its only discovered `.blend` is `config/userpref.blend`; the five nonempty MPFB logs contain initialization/material messages, no coordinate dumps. Nothing from that later profile was executed.

## Search boundary and remaining requirement

The receipt records repository-wide filename discovery for `.f64`, `.blend`, and `.blend1` (excluding dependencies and Git internals), targeted current/ignored tool paths and Git history, and identity/wardrobe/refit capture-path discovery excluding frozen source duplicates. The only returned native-format filename was the profile's preferences file. The exact original system targets/user-data paths under `/Users/robault/Library/Application Support/Blender/5.2/extensions/` are absent. The two ellipsized scratchpad paths remain **unresolved**, not claimed deleted or globally nonexistent.

This bounded recovery is exhausted without an adequate oracle. The next independent comparison still requires either a concrete historical archive path containing the native arrays and provenance, or a fresh evidence-only native run on a made-available Blender/MPFB toolchain. That run must bind the actual loaded source/assets, exact macro/target order and weights, transforms, all 19,158 evaluated body/helper positions, and 2,197 original garment-order outputs for 0, 0.25, 1. A successor Blender version needs an explicit new control. No helper substitute, threshold change, 10.9 completion or 9.4 authorization follows from this audit.
