> **Clarified by Robert, 2026-11-01:** "approved eyes" means the eyeballs only (iris and sclera). Eyelids, lid shape, lashes, brows and the rest of the face are **not** approved and still have open corrections; see `docs/EMBER-AVATAR-NEXT.md`.

# Ember unresolved hair layout — bounded sampling check

Robert's macOS inquiry is concluded; explicit continuation and the ten-minute timer remain ACTIVE. Permissions and background items are left as he set them. This separately scoped responsibility follows the consumed [v002 failure](../ember-2026-10-31-hair-v002/README.md). It does not reopen either compiler or the first-guide diagnostic.

## Question and exact coverage

Can one predetermined allocation rule meet the unchanged 0.350 mm sampled tolerance within 40 intervals on the unresolved guide curves? [Contract](contract.json) names **39 guides / 117 ribbons**, beginning with `crown-sweep-02` and ending with `nape-04`. `crown-sweep-01` is excluded before anchor resolution or curve construction. Its existing report is read as prior-method evidence only; no new-method result for that guide can be claimed.

Resolve the same allowed scalp root and the same eleven inner-guide portions from the frozen body, then use the unchanged controls, endpoint fractions and centripetal curve. Only the allocation probes change: seven fixed eighth-grid positions instead of three. Bisect the greatest-error interval, with earliest-interval tie handling, until its score meets the unchanged threshold or the 40-interval ceiling is reached. Assess eight fixed odd-sixteenth positions afterward. Report allocation and held-out errors separately; **both must pass**. There is no post-validation refinement, alternate method, parameter sweep or control edit.

Numerical sampling failures are collected across the single pass. Invalid source, anchor correspondence, nonfinite values or resource ceilings stop it. This is sampled centre-curve evidence, not a continuous bound, proof that a failing curve needs more segments, ribbon-surface result, root-motion/clearance test or appearance judgment. No mesh, native renderer or browser is involved.

## Source review and finite workload

The isolated sources are `tools/ember-hair/layout-check.mjs` and `layout-check-run.py`. [Preflight](preflight.json) binds 42 inputs with SHA-256 `3aa456cbecdaab6ec4398a8e20d68d6cf5db16e60420418748d3d9026349b9e8`. All original references, protected appearance, guide sources, v001/v002 and consumed diagnostic sources/evidence remain unchanged. The checker imports only Three math and the GLB reader; neither compiler nor the consumed diagnostic is imported or invoked.

Limits: 10 CPU seconds, 15 wall seconds, 512 MiB observed RSS, 2 MiB total artifacts, 1.5 MiB per report and 256 KiB log. Sample guards are 1,536 evaluations per ribbon and 180,000 overall. Static uncached-request bound is 1,057 per ribbon / 123,669 overall, including eight held-out probes per selected interval. The original geometry budgets and all construction protections remain fixed and untested here.

[Root source verification](root-source-verification.json) records the exact selection, reused anchor equations, eleven inner portions, disjoint probes, pass semantics and finite workload. Syntax checks import or execute no candidate code. Independent exact-source review and a separate root admission are required before the one check can run. Source review is not appearance acceptance, and even all 117 passing ribbons would leave the new-method first-guide gap.

The preferred bounded report can reveal whether allocation improves the unresolved layout before another build. Directly preparing v003 would avoid this report but risk another successive single-lock failure; it is not selected. No v003, candidate build, texture edit, source search or new image is admitted by this contract.

The complete animated Ember milestone and remaining hair/face/expression/body/outfit/motion roadmap remain intact. Approved eyes, retained brows and face are fixed. The review service is retained; this source-only responsibility does not require a browser operation.
