# Visual work window — 2026-09-08

The user authorized autonomous visual progress through **01:46 UTC September 9 / 6:46 PM Pacific**.
Heartbeat `advance-sugata-avatar-visual-quality` runs every 15 minutes in this task. At the deadline,
finish the checkpoint and pause it. Do not start further work beyond that window without new steering.

Working repository: `/Users/robault/GitHub/sugata-avatar`, branch `codex/local-restart`.
Read [restart context](RESTART-2026-09-08.md) for architecture and recovery boundaries. The user's
original ambition in [BRIEF.md](BRIEF.md) remains intact. The old iCloud checkout is untouched;
its recovery archive is partial. Missing later shader/tool history must be reconciled before
resuming R35–R38 material research. R36 and R38's proposed repairs remain refuted.

## Installed result

The bob now drops alongside the face and ends near the jaw. Its final SHA-256 is
`d20d65452ae2761a78a3598f7d7bbbb7541bc047f9d63c6b422948ebd686d461`.
The portable output's entire binary payload exactly matches the motion-tested candidate;
only provenance metadata differs. The original asset is a tracked Git LFS fixture, so the
complete transformation is reproducible without Blender or ignored captures.

The three calibrated post-export stages are:

1. `hair_fall.mjs`: release 170 long front/side cards below the temple while preserving heights,
   roots, caps and crown. The original had 855 face crossing pairs at rest across 16 cards;
   twelve guides crossed the head midline. Clear corners did not imply clear triangle interiors.
2. `hair_hem.mjs`: lift 510 lower vertices on 52 forward cards, at most 17.934 mm, into a varied
   jaw-length hem. Upper positions, x/z, widths, topology and skin/material data stay fixed.
3. `hair_tail_release.mjs`: move 96 terminal vertices on twelve observed cards, at most 3.5 mm
   horizontally outward, through a smooth ramp on rings 13–16. This clears held head tilts and
   upward nods without changing heights, roots, upper rings or the other 484 cards.

Build original→fall→hem→tail in that order. Earlier stages reject later deformed outputs.
All three default tests derive their inputs from `tools/figure-pipeline/fixtures/bob02-g050-original.glb`.
See [pipeline instructions](../tools/figure-pipeline/README.md) and tracked evidence for
[fall](evidence/hair-fall-2026-09-08.json), [hem](evidence/hair-hem-2026-09-08.json), and
[final tail release](evidence/hair-tail-release-2026-09-08.json).

## Motion and clearance

The final twelve-card release passes **98 full-triangle face checks** on actual WebGPU output:

| Sequence | Poses | Face crossing pairs | Minimum sampled face vertex clearance |
|---|---:|---:|---:|
| Natural expressions over 12 seconds | 13 | 0 in every pose | 2.584 mm |
| Yaw shake over 8 seconds | 17 | 0 in every pose | 3.622 mm |
| Held nod | 17 | 0 in every pose | 2.409 mm |
| Opposite held nod | 17 | 0 in every pose | 0.920 mm |
| Held sideways tilt | 17 | 0 in every pose | 0.926 mm |
| Opposite sideways tilt | 17 | 0 in every pose | 0.783 mm |

Both actual collider fits, spring settings and the whole-groom compliance reference are unchanged.
Targeted arc lengths change by −0.492 to +1.379 mm; derived per-card compliance changes by less
than 1.674%. Motion is therefore measured rather than called identical: peak mean tip lag is
11.799 mm in natural motion (11.793 mm before) and 3.023 mm in yaw shake (3.021 mm before).
All matched head transforms are exact. Ten matched static views retain the silhouette, hem,
crown coverage and fringe without an observed new gap. The nine final portable test groups
passed independently, including source/body stamps, real tangents, protected attributes,
collider fits, idempotence and output-path guards.

The full triangle-prism gate includes boundary contact at tolerance 1e-9 m and ignores alpha.
It uses an explicit face box in inverse-head coordinates. Finite poses do not certify every
animation, wholly embedded triangles, or positive clearance everywhere. There are still
165 crossing pairs outside the face box in the larger head region at rest, and at most 231
in these motions. Moved normal/tangent frames are recomputed while neighboring authored frames
remain; this is not a full normal rebake. Calibration applies only to bob02/g050.

The first eleven-card tail experiment was not installed: upward nod exposed 18 pairs on card 352,
which the previous hem also reproduced. Its corners cleared while a long triangle interior
crossed the cheek. The final version adds only that card under the same 3.5 mm rule.
Raw controls, geometry, scripts, reports and renders are preserved in
`captures/hair-tail-release-2026-09-08/`, `captures/hair-tail-release-v2-2026-09-08/`, and
`captures/hair-axes-2026-09-08/`.

`HairDynamics.readVertices()` is opt-in GPU readback with no per-frame cost until invoked.
`portrait-clearance.mjs` captures same-frame rebuilt hair and renderer-equivalent morphed/skinned
body data; it suppresses Vite HMR and fails on clock drift. `portrait-surface.mjs` refuses missing
frames, bad cadence/metadata, singular transforms and empty comparisons. Its seven regression
checks include two independently reproduced false passes. The underlying surface test passes
12 analytic groups including 1,000 seeded independent-reference comparisons.
The first nod capture was invalidated by a hot reload and is explicitly discarded. Earlier pilot
signed-distance results with recomputed body normals are superseded by the renderer-normal controls.

## Renderer repairs

**Orbit blackout:** cleared zero bent normals in the half-resolution GTAO target became NaNs,
then bloom spread them across the canvas. The shader now selects the surface normal before
normalizing a degenerate sample. Five corrected angles are finite and visible; an old-code
control reproduces 2,520 invalid composite pixels and an entirely invalid bloom target.
The new orbit regression passes 12 checks and existing GTAO tests 27/27. See the
[orbit ledger](evidence/orbit-regression-2026-09-08.json), commit `93de53a`.

**Area-light skin transmission:** the old term treated panel radiance as a point light.
At fixed focus irradiance, halving panel dimensions incorrectly multiplied transmitted light
by 3.938. A backside identity-LTC integral now accounts for the panel's extent and cosine/1π once.
Corrected ratios are 0.991–0.993, while transmission-off raw scene buffers are byte-identical.
The actual-WebGPU regression passes 22/22; existing skin checks pass 14/14 in each rendering mode.
Twenty matched images confirm the conspicuous orange/violet eye and mouth glow is gone.
Punctual lighting, thickness, strength, cavity and studio parameters remain fixed. See
[repair proof](evidence/skin-area-transmission-2026-09-08.json) and
[matched views](evidence/skin-area-visual-2026-09-08.json), commit `9ae4cf1`.
A GPU cost ABBA probe was inconclusive because same-configuration drift exceeded the difference;
no incremental cost claim is justified. The legacy skin checks' sole resource error was an
identified missing favicon; the focused regression and matched portraits have no browser errors.

**Hair GPU lifetime:** repeated public `Avatar.setIdentity` rebuilds on one renderer retained
8 storage buffers / 980,096 bytes and 5 compute pipelines per retired solver. The new idempotent
cleanup holds that total constant across three rebuilds instead of growing to32 buffers / 3,920,384
bytes / 20 pipelines. Active, unpublished losing and failed-setup solvers are retired. Pending reads
reject disposal, including independently reproduced nested-await races; pre-init disposal and
renderer shutdown are safe. The 21 focused checks, Avatar 137/137 and physics quick 24/24 pass
on the final d20 asset. Matched readback vertices are bit-identical between cleanup/control arms.
See [resource ledger](evidence/hair-disposal-2026-09-09.json) and local
`captures/hair-disposal-2026-09-09/`. This depends on Three r185's private attribute manager and
must be revalidated on upgrade. The process-wide HairVelocity prototype patch still has no uninstall.

## Closed visual experiments

The broad crown/back patchwork remains visible. These controlled experiments did not produce
an accepted improvement and should not be repeated without a distinct mechanism/prediction:

- Flip 3,609 internal diagonals: patches moved but remained coarse; this demonstrates triangulation
  sensitivity, not a unique derivative/UV/depth cause or a reversal of R38.
- Coherent ribbon frames within 2 mm: direction jumps fell 586→400; five matched views remained patchy.
- Split 205 wide cards into three: 906 chains versus 496; p90 direction jump fell 71.36°→20.17°.
  Ten views did not justify 410 extra chains. Motion and cost were not measured.
- Constrained shell projection, max 8 mm: median realized layer spread 6.763→5.739mm without a
  clear benefit in ten views. This does not refute a fully collapsed shell. R23 already refuted
  simply halving the standoff ladder.
- Fully neutral lights at fixed emitted linear luminance removed the colored cast but retained
  patchwork and exposed the transmission bug. Neutralization itself was not installed.

See [facet experiments](evidence/hair-facets-2026-09-08.json),
[envelope experiment](evidence/hair-envelope-2026-09-08.json),
[neutral-light control](evidence/neutral-light-2026-09-08.json), and
[transmission isolation](evidence/neutral-transmission-control-2026-09-08.json).
The early high-preset comparison was scale 0.66, not full resolution. Later explicit scale 1
sharpened detail but retained patches; pre-fix blank orbit views are not visual-quality evidence.

## Final panel-integration diagnostic

The documented hair area-light approximation evaluates the fibre response only at panel center,
then multiplies by exact solid angle. A distinct final experiment sampled nine cells instead.
On 24 actual crown/back triangle directions, a converged independent area reference puts the
isolated response's aggregate relative L1 error at key 57.06%→1.54%, fill 101.15%→6.36%.
The nominal panels are rotated relative to a fixed back view at a common mathematical focus;
they do not replay the frozen studio lights in the rear render. This CPU result excludes the
full per-pixel atlas, visibility and compositing path. Its prediction
for adjacent-triangle contrast is mixed: key contrast increases slightly, fill contrast decreases.

Ten actual WebGPU images hold pose, lighting and assets fixed and route only the accumulation.
They retain the broad crown/rear facets; pale temple highlights soften but the front also becomes
flatter. Independent visual review rejects this as a standalone patchwork repair. The installed
HairMaterial is unchanged. Exact cell weighting improves this numerical approximation but is not
an exact integral or proof of better final appearance. Cost was not benchmarked. See the
[tracked diagnostic](evidence/hair-panel-quadrature-2026-09-09.json) and local
`captures/hair-panel-quadrature-2026-09-09/`, `captures/hair-panel-integration-2026-09-08/cpu/`.
The initial existing HairMaterial test hit a sandbox launch failure after 58 CPU checks. An elevated
retry completed **76/80**, reproducing the same four already-declared visual failures: specular to
albedo contrast, improvement over a plain card, internal dynamic range and clipped-highlight share.
The raw log is preserved with its red exit. This alive/bob01 gate does not certify bob02 geometry,
and its negative hair-on/off timing difference supports no incremental performance claim.
No threshold was changed and no new per-sample CPU/GPU mirror validation is claimed.

## Final integration and restart

All 17 pages build with the installed d20 asset and final cleanup sources. The production portrait
renders three fixed-step poses over 2 seconds with no browser/network errors. This is a smoke check,
not an FPS benchmark. Actual Chrome works after the user's TCC approval and its refreshed portrait
has no console errors. Local evidence: `captures/final-production-2026-09-09/`.
The broader gate suite was not rerun; existing red-gate declarations remain unchanged.

Development: `http://127.0.0.1:5197/src/portrait.html?hair=bob02`, exec session 26208.
Production: port 5198, exec session 23873, output `/tmp/sugata-final-build`.
Check existing ports before restarting. Keep the development portrait available to the user.
Raw captures are local ignored artifacts (about 1.8 GB), not part of a new clone. Tracked JSON
ledgers retain findings, source/asset/report hashes and limitations. No work has been pushed.

Integration checkpoint: final geometry is committed as `aea660f`, GPU cleanup as `fd3fd92`.
Both passed independent review. The [final production ledger](evidence/final-integration-2026-09-09.json)
binds the exact installed asset to the 17-page build and three clear production poses.
The end-of-window automation pause remains pending. Continue only within the
stated deadline; do not reopen a rejected experiment just to fill the remaining window.
