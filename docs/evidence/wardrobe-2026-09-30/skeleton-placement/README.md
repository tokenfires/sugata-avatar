# Skeleton endpoint arithmetic — three native body cases

The declared [plan](PLAN.md) passes its bounded endpoint comparison. All 106 native bone ends match between fresh creation and actual existing-rig refit at each of the three coupled target weights. Independent JS means from native helper positions reproduce all endpoints exactly after float32 storage. Means from the native neutral body plus SDK deltas differ by at most **0.000060075 mm**, below the unchanged strict **0.1 mm** bar.

This closes a prerequisite for body identity. PUNCHLIST 10.7 remains open: these three cases do not establish the whole body range, runtime orientation/rest matrices, inverse binds, skinning, moving appearance, or clothing/foundation fit. No product source or accepted asset changed.

## Native controls

Blender 5.2.2 LTS, build `d13f752e3b9c`, with the pinned MPFB 2.0.17 profile. The parent [native garment packet](../native-refit/README.md) supplies the source pins and exact expected full body/helper coordinates. Each of six fresh humans reproduces its corresponding parent's 19,158 unrigged positions exactly.

For each weight 0, 0.25 and 1:

- **Refit:** neutral human → game_engine rig → apply shoulder-distance and upper-leg-height detail targets → actual `RigService.refit_existing_armature`.
- **Fresh:** apply those targets before native rig creation.

The native packet retains full unrigged body arrays, native identity-pose skin arrays, all 53 bones' endpoints/parents/edit rolls/rest matrices/pose bases, actual joint memberships, source strategy endpoints and both raw/upgraded rig tables. Body and armature transforms and every pose basis are admitted as identity; bone names and identified rig type must match. All 69 referenced CUBE groups are nonempty and match the pinned inclusive metadata ranges in native accumulation order. The MEAN indices are checked. Strategy resolution with `use_default=False` must succeed; implicit default-position fallback is excluded.

## Measured results

Distances below are maximum Euclidean error in millimetres over all 106 ends unless marked full body. Residuals and worst endpoints are retained per comparison in the raw gzip files.

| Comparison | Weight 0 | Weight 0.25 | Weight 1 |
|---|---:|---:|---:|
| Native existing refit vs fresh | 0 | 0 | 0 |
| Native-input means, before float32 | 0.000060074 | 0.000060074 | 0.000060074 |
| Native-input means, float32 | 0 | 0 | 0 |
| SDK-input means, before float32 | 0.000060074 | 0.000059676 | 0.000059727 |
| SDK-input means, float32 | 0 | 0.000059605 | 0.000059605 |
| SDK full-body positions vs native, 19,158 points | 0 | 0.000037337 | 0.000044742 |

Native endpoint, rest-matrix and edit-roll observations are exactly equal between the two native paths at all three weights. Matrix/roll equality does not qualify a JS orientation implementation. Native identity-pose skin residual is at most 0.000242574 mm; it is separately labelled and excluded from the endpoint pass. No JS skin operation was evaluated.

### Deliberate errors

All four mutate the passing full-weight SDK calculation, change at least one endpoint, and fail the 0.1 mm endpoint bar. Each raw result records the clean parent's pass and the mutation size.

| Error | Maximum mm | Witness |
|---|---:|---|
| Left upper-arm head uses right shoulder group | 389.832731 | upperarm_l.head |
| Omit helper target deltas at indices ≥ 13380 | 106.885466 | calf_l.head |
| Apply a different axis convention | 2351.732802 | head.tail |
| Inject 0.2 mm into one endpoint | 0.200000 | Root.head |

## Decisions and limits

1. **Resolve fallback explicitly.** Critic source example: `Rig.get_best_location_from_strategy` can return `default_position` after failed resolution. Chosen: require valid actual groups/indices and non-default resolution. Alternative: an observer counting fallback calls, which adds execution instrumentation. Both were considered before native execution.
2. **Direct rest-local comparison.** Chosen: admit identity transforms and pose bases, preserving coordinates in Blender Z-up metres. Alternative: transform all observations into a shared world frame, useful for broader fixtures but unnecessary here.
3. **Dispatch admission.** Critic example: a count of 53 bones alone does not establish the intended rig. Chosen: exact name-set and `identify_rig == game_engine` assertions. Alternative: observe the path dispatched by native refit, with more observer machinery.
4. **Keep skin observations separate.** The native skin residual and identical native matrices are useful controls for a later bind/skin stage. They do not close that stage or supply a visual qualification.

See [summary](summary.json) and the independent critique for exact validation and any remaining findings. The prior failed/frozen packets and their bounds remain intact.

## Commands, ownership and recovery

From `/Users/robault/GitHub/sugata-avatar`:

```sh
tmp/wardrobe-sep30/blender-isolated.sh --background --python-exit-code 1 --python tools/critic/skeleton-native-oracle.py > tmp/skeleton-sep30/native-oracle-v1.log 2>&1
node tools/critic/compare-skeleton-native.mjs
```

Both refuse an existing output root. The native wrapper currently requires deliberately remounting the cached runtime. Never overwrite the previous receipts or raw output roots.

- Native PID 90346, exec session 79279: 17:23:19.887528–17:23:35.785360 UTC, exit 0. Six cases.
- JS PID 91760: 17:24:11.093–17:24:12.130 UTC, exit 0. Three comparisons.
- Native report SHA256: `0802b23b4bdbee05fbc232f9851aeeb7cc4a67fe14227bb16b645c06cac61472`.
- JS report SHA256: `b7096610aac66ab73830d1ca1ff09232cb0ec92cd6caa0380750bd2531ef4a0a`.
- Raw roots: `captures/skeleton-native-oracle-2026-09-30-v1` and `captures/skeleton-native-comparison-2026-09-30-v1`.

The restricted signature check could not access certificate authority data and failed. Normal macOS verification then passed; the exact cached DMG hash, executable hash and signature are preserved in the new preflight receipt. Root verified the owned image/device/mount and absence of its Blender process, then detached `/dev/disk12` at 17:24:16.275738 UTC. Receipt and log are copied into the native packet. The dedicated profile remains; the main Vite review service remains. No native or comparison job is running.

The archive preserves source snapshots and raw coordinates; the parent source inputs and MPFB distribution archive remain bound dependencies. It is a local recovery archive, not a remote backup.
