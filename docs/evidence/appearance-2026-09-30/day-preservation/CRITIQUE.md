# Independent review: day evidence preservation

## Disposition

**Accept the mode-only recovery and V2 verification for the exact declared archive set.** I independently rehashed all 7,286 files, totaling 2,963,590,568 bytes, and checked their current modes. All manifest sizes and SHA-256 values match, and none of those files retains a POSIX write bit. The critic changed no file modes, assets, raw evidence or audit source.

This is local byte preservation and removal of write bits. It does not make the files immutable, provide an off-machine backup, qualify their underlying experiments, or establish the final process/automation shutdown state.

## First gate and concrete recovery

The [V1 report](../../../../captures/day-preservation-2026-09-30-v1/report.json), SHA `be9d30796168357c1374684ffb0b5b0860e6c31724d0ef0a01db89b6398438d9`, correctly remains `status: failed` / `passed: false`. Its new combined bytes-and-mode gate found no byte mismatches but found 3,826 writable raw evidence files. This was a permission failure, not lost or changed evidence.

Before recovery I independently confirmed that exact writable set consisted of 3,826 distinct regular `0644` files under `captures/`, without symlink entries or multiply-linked files. A concrete witness is `captures/bob-front-prefix-objective-v1/report.json`: 194,434 bytes, SHA `a2f52ed1040ee1c18f9a1f3575a39bc61ef0f8ec029316c8870e2012aef75aa5`, then mode `0644`.

Two alternatives were considered:

1. **A, selected:** remove only write bits from the bound file list, preserve bytes and other permission bits, and record before/after modes. This adds accidental-write resistance while leaving evidence content unchanged.
2. **B:** retain permissions and explicitly describe logical/hash preservation only. This avoids filesystem mutation but provides less protection against accidental writes.

The [permission receipt](../../../../captures/day-freeze-permissions-2026-09-30-v1/report.json), SHA `43254a338dcd62d7618f959e973fdf83ae8718f69a7d8465ccb25350c0dfe58d`, records A: PID 19742, October 1 00:12:04.028–05.095 UTC, all 3,826 completed, no errors. Its [saved instrument](../../../../captures/day-freeze-permissions-2026-09-30-v1/instrument.py) binds V1's report hash and the exact 28 manifest path/hash set; rejects noncanonical paths, symlinks, nonregular files, hard links and unexpected starting modes; persists the complete mode plan before mutation; and verifies each size/hash before chmod and hash/mode afterward. Every recorded transition is `0644` to `0444`.

I independently compared the receipt's path set against the union of V1's writable rows: exact equality, no duplicates or additions. Every current mode equals the recorded new mode and `oldMode & ~0222`; every current byte count and digest remains equal to the original manifest. There were no executable files in this changed set, so the run does not constitute an empirical executable-bit case.

## V2 and inventory continuity

The [V2 report](../../../../captures/day-preservation-2026-09-30-v2/report.json), SHA `ac21a913a61bff01f4620cc2981ee5cfc78ca342d03c289ad8a0e7ab60c30d08`, is `verified` with `passed: true`, no mismatches, no writable rows and no errors. PID 19782 ran October 1 00:12:15.783–17.280 UTC. Comparing the saved instruments shows only output-destination parameterization and its direct-`captures/` parent guard were added; the byte/mode success predicate was not weakened.

A preflight concern was that discovery by `rglob` plus a merely nonempty manifest set could let an omitted manifest disappear from a later pass. Two alternatives were recorded:

- **A, selected:** independently compare V2's exact manifest paths/hashes and aggregate file/byte counts to V1. This is the smallest complete admission for this recovery.
- **B:** add a fixed expected-manifest inventory to the reusable checker. This strengthens future standalone use but introduces a larger maintained source contract.

The [comparison receipt](../../../../captures/day-preservation-2026-09-30-v2/comparison.json) implements A. I independently confirmed equal sets of all 28 manifest paths/hashes, all copied and current manifest hashes, 7,286 distinct declared files and 2,963,590,568 bytes. All eight accepted asset/builder pins and all six reference-photo pins also match current bytes. The saved V2 instrument matches its report hash. No scope was silently dropped to obtain the pass.

## Limits

The audited set is the files declared by those 28 bound day manifests, not every file under `captures/` or the entire checkout. The later preservation receipts and this critique require their own archival handling. One inspected raw packet directory remains mode `0755`; a writable parent can permit replacement or deletion even when a child file is `0444`, and an owner can change modes again. Therefore use “verified bytes and removed POSIX write bits,” not “tamper-proof” or “immutable.” V1's failed result and the exact mode-change receipt remain part of the recovery record.
