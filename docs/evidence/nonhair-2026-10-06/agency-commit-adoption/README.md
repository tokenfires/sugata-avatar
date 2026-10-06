# Commit-time wardrobe bookkeeping adopted

When an older outfit load finished after a newer user pin, the avatar correctly kept the newer outfit, but Agency could overwrite the saved request and falsely record the older suggestion as honoured. The consideration overlap also marked the still-worn shoes as an outgoing outfit.

The adopted fix records Agency pin, request, honour and history at the real Wardrobe application, through the optional synchronous `onApplied` callback. An obsolete completion returns without rewriting those values. The pin captures the caller's requested IDs before asynchronous loading. Genuine earlier commits keep their honour and history.

[The baseline witnesses](../agency-completion-probe/ROOT-ACTUAL-CLOSE.json) and [selected before/after values](../agency-commit-candidate/ROOT-BEFORE-AFTER.json) distinguish corrected bookkeeping from actual outfit behavior. This was not a visual outfit-switch defect.

One separately admitted CPU run passed 13 new meaningful race/callback cases, 12 unchanged catalogue checks and 28 unchanged serial assertions. Root independently parsed 39 state/raw-store snapshots and 27 settlements; the critic used its own saved-data checks and reviewed the complete raw output. Stderr contains 25 known rig bone-fallback warnings and one expected corrupt-store warning. The Node child was reaped with complete captured streams.

[Critic result](../agency-commit-candidate/ACTUAL-V2-RESULT.md), [root qualification](../agency-commit-candidate/ROOT-ACTUAL-CLOSE.json) and [exact adoption receipt](ADOPTION-RECEIPT.json) provide source, jobs, hashes, outputs and limits. Production Wardrobe, WardrobeAgency and the new regression match the reviewed canonical files byte for byte. Five complete reversible import projections, including the dynamic Manifest import, connect them to the executed files. Existing serial/catalogue assertions, assets and dependencies were retained. The production regression is discovered by the existing selftest runner; the isolated evidence files are not. No redundant Node, build or global-runner replay was performed.

The callback runs once synchronously for a successful application and never for an obsolete, invalid, failed or disposed application. Its return value is ignored. A synchronous callback throw rejects after the outfit has been applied, with no rollback. Existing one-argument dressing remains supported.

Qualification is MemoryStore/injected-clock CPU policy with real GLTF rigs and bitmap stubs. General reentry, mode-switch cancellation, multiple agencies, custom wardrobe doubles, personal storage, browser delivery, appearance, fit, motion and performance remain unqualified. The wider character roadmap and 17 scoped/10 broad checklist remain unchanged.

The candidate and actual proof are frozen in [their manifest](../agency-commit-candidate/FROZEN.json). After adoption, historical old Wardrobe/Agency input pins resolve the original snapshots in [ORIGINAL-SOURCES](../agency-commit-candidate/ORIGINAL-SOURCES.json), as recorded in the adoption receipt. Frozen records retain their original bytes and time-scoped claims. The first rejected source protocol remains closed.
