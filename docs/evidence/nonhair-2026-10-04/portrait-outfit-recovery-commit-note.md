# Frozen patch whitespace receipt

After the source B packet was frozen, the first staged `git diff --cached --check` returned2/chunk203a0a for four raw unified-diff context lines: js-from-original.patch21/91 and js-from-rejected.patch19/56 contain a single context-space prefix on an empty line. They are generated patch data, not candidate/source whitespace. No commit followed that failed check. Frozen raw bytes and manifest remain unchanged.

Subsequent staged check excludes only the four exact generated patch files in portrait-outfit-recovery, while checking every other staged path. Their full original/rejected snapshots and complete patches were already independently read and hash-bound by source/final reviews; no source mutation or native admission follows. This note is outside the frozen packet and preserves the failed check rather than rewriting its witness.
