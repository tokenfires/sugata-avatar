# Day evidence preservation

**All recorded bytes are preserved.** The read-only audit independently confirms 28 day archive manifests covering 7,286 distinct files / 2,963,590,568 bytes. Eight accepted asset/builder pins and all six local bob reference copies match their recorded hashes. This verifies local evidence integrity, not appearance or an off-machine backup.

The first combined audit failed only its new permission condition: 3,826 older raw files were still writable. Their bytes matched. Root selected the critic's alternative A: remove write bits from that exact bound list, with byte checks before and after and an old/new-mode receipt. Alternative B would retain their modes and describe a logical/hash freeze only.

All 3,826 files changed from `0644` to `0444`; no content changed. The operation refused symlinks, hard-linked files, paths outside `captures/`, hash drift and a changed manifest set. Its complete reversible mode plan was saved before any change. The second audit passes both byte and permission conditions. Its manifest paths/hashes and counts match the original 28-manifest set exactly in a separate comparison receipt.

Write-bit removal resists accidental edits. Writable directories still permit replacement, and users can change modes; this is not immutable storage. The accepted source assets, original source references and unrelated worktrees were not made read-only by this operation.

The [independent critique](CRITIQUE.md), SHA256 `07f7d9e816c83d4ecc0cdc722c954a8b4159f7833987367f3d489d818f1a44c7`, independently rehashes every file and confirms the exact mode-change set. The preservation packet archive contains 68 files / 4,965,011 bytes, manifest SHA256 `26c5d16247831b9e8c927371c186de62253eeb885378c5fea49c69eae0424e1a`.

## Commands and receipts

| Run | Exact command | PID / exec | UTC interval | Report SHA256 |
| --- | --- | --- | --- | --- |
| Initial audit | `python3 tools/critic/day-preservation-2026-09-30.py > tmp/day-preservation-2026-09-30-v1.log 2>&1` | 19162 / 74719 | 00:08:12.437945–00:08:14.972402 | `be9d30796168357c1374684ffb0b5b0860e6c31724d0ef0a01db89b6398438d9` |
| Mode-only protection | `python3 tools/critic/day-freeze-permissions-2026-09-30.py > tmp/day-freeze-permissions-2026-09-30-v1.log 2>&1` | 19742 / synchronous | 00:12:04.028712–00:12:05.094805 | `43254a338dcd62d7618f959e973fdf83ae8718f69a7d8465ccb25350c0dfe58d` |
| Post-operation audit | `python3 tools/critic/day-preservation-2026-09-30.py captures/day-preservation-2026-09-30-v2 > tmp/day-preservation-2026-09-30-v2.log 2>&1` | 19782 / 29070 | 00:12:15.783441–00:12:17.279581 | `ac21a913a61bff01f4620cc2981ee5cfc78ca342d03c289ad8a0e7ab60c30d08` |

These UTC times are October 1, equivalent to September 30 at 17:08–17:12 Pacific. The initial audit exits 1; both later operations exit 0. All jobs are collected and closed.

The second checker changes only output-root selection and a destination guard; its success predicates and asset pins are unchanged. Its broad manifest discovery is supplemented by `captures/day-preservation-2026-09-30-v2/comparison.json`, which prevents silently omitting an earlier manifest. A future reusable alternative is a frozen explicit expected-manifest input.

The [archive manifest](archive-manifest.json) preserves both observations, the mode plan/result, input-manifest copies, original checker versions and logs. This preservation packet's own manifest was added only after both audits, keeping their input set fixed. It is not included in their 28-manifest count.

## Recovery

No further mode change is needed. To recover a particular file's original permissions if deliberately required later, consult its `oldMode` in the operation report; do not apply a broad recursive chmod. Keep frozen raw evidence unchanged and make any future experiment a new output directory.

The final service/process/automation shutdown remains separate and must occur at the declared 18:00 Pacific checkpoint. This packet does not claim that shutdown has happened. See the [declared plan](PLAN.md).
