# Saved-look numeric mutation counterexamples

One unchanged-module, memory-only Node run confirms eight counterexamples. Both independent reviewers inspect the actual raw output; root checks raw number signs and target presence with a separate Python observer. No personal collection was read or changed.

| Action | Observed result for both inputs |
| --- | --- |
| Save another look | Existing overflow becomes null; negative zero becomes zero. |
| Remove another look | The remaining entry changes the same way. |
| Remove the affected entry, then Undo | Removal return and restored settings lose the original number meaning. |
| Remove using an old selected entry after a numeric change | The changed target is removed instead of being rejected as stale. |

[Actual raw output](TEST-STDOUT.txt), [process receipt](TEST-PROCESS.json), [critic findings and alternatives](RESULT.json), [root decision](ROOT-CLOSE.json), [original source recovery](ORIGINAL-SOURCES.json). The sole job exited0 and was collected; it is closed to replay. Current accepted code remains unchanged. A separately reviewed conservative guard, typed comparator and exact raw Undo candidate is next. This does not establish loss of normal supported looks, human data, browser behavior or complete lexical preservation.
