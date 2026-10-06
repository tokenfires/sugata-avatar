# Saved-look numeric data and removal Undo

The accepted saved-look module now refuses an Add or Remove that would change nonfinite or negative-zero values in remaining, unavailable entries. Removing an unsafe target is allowed when the remaining entries can be preserved. A stale selected item with a changed numeric value is rejected, and Undo restores the exact validated stored text from before that removal.

The isolated candidate and the accepted import each passed nineteen memory-test groups, including all 96 supported settings. Original assertions remain intact. The new tests cover numeric refusal/preservation, detached returned data, stale selections, exact raw Undo, storage/read/quota/interleaving errors, the raw size boundary and modified array/Date snapshots.

[Exact adoption result](RESULT.json) · [Root verification and recovery](ROOT-CLOSE.json) · [Actual accepted-path output](TEST-STDOUT.txt) · [Process and command](TEST-PROCESS.json) · [Pre-fix original sources](../saved-collection-number-probe/ORIGINAL-SOURCES.json) · [Qualified candidate](../saved-collection-number-candidate/README.md)

Only two accepted source files changed: the qualified module bytes and its tests with one import redirect. The application caller remains unchanged. No personal browser storage was touched by testing. Validation used injected memory storage; this is data-logic qualification and does not add browser or appearance credit.

Multiple unsafe entries may conservatively block Add/Remove until a separately owned recovery mechanism exists. The fix does not universally preserve arbitrary number spelling/precision or duplicate keys, and does not make cross-tab writes atomic. The rejected backup download workflow remains closed.
