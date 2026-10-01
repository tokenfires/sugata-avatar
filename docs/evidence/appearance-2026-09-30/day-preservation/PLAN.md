# Preserve the completed day evidence

The final checkpoint needs recoverable evidence, accepted assets and references. This is a local preservation check, separate from appearance qualification and the later process/automation shutdown.

## First read-only observation

`python3 tools/critic/day-preservation-2026-09-30.py > tmp/day-preservation-2026-09-30-v1.log 2>&1`

PID 19162 / exec 74719 ran 00:08:12.437945–00:08:14.972402 UTC on October 1 (17:08 Pacific on September 30). All **28** day archive manifests, **7,286** distinct file rows and **2,963,590,568** bytes match their hashes. Eight accepted asset/builder pins and six reference-copy pins match. No corrupt or changed bytes were found.

The new combined byte-and-permission check reports **failed** because **3,826** of those archived raw files retain a write bit. Earlier “frozen” describes their retained bytes; those files did not all have operating-system write protection. Preserve this first result unchanged: report SHA256 `be9d30796168357c1374684ffb0b5b0860e6c31724d0ef0a01db89b6398438d9`.

## Alternatives

- **A, proposed:** after independent review, remove write bits only from the exact 3,826 matching files under `captures/`. Record each original/new mode and hash. Preserve execute bits and every byte. Re-run the same byte/permission conditions to a new output root, keeping the original failed result. This gives stronger accidental-write protection without changing any asset or evidence conclusion. It is reversible through the recorded modes and is not protection against a user who can change permissions.
- **B:** retain their existing permissions and describe these as logically frozen, hash-verified snapshots. This avoids a filesystem metadata change but permits accidental overwrites more easily.

No live job owns these completed files. The proposed operation must refuse symlinks, paths outside `captures/`, source/hash drift or a changed manifest set. It does not change accepted source assets, repository files, source references or unrelated worktrees. No files are removed or overwritten.

The second audit may change only its output-destination argument; the checks and expected asset pins stay the same. The first instrument, report, copied manifest receipts and logs remain archived. Do not add this preservation packet's own archive manifest until both audits finish, so the selected 28-manifest input set stays fixed.

## Decision and completion

The independent critic supports A and independently verified every original hash before mutation. Root selected A; the exact mode operation and the post-operation audit both completed. The critic independently confirmed the post-state too. The separate V1-to-V2 manifest comparison selects the critic’s minimal alternative A for fixed membership; alternative B would make the expected inventory an explicit reusable checker input. See [completed results](README.md). No new appearance or final automation-pause claim follows.
