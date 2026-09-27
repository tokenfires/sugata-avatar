# Stopped at Robert's explicit end-of-day request

No further analysis, tests, browser/GPU jobs or source edits are authorized by this checkpoint. Resume only after a new request.

## Process state

The sole retained CPU analysis session, **8937**, had already exited with code 0 before the stop message. It wrote all four planned cases, including candidate D594. No owned browser/GPU job was launched. No owned live process remains, and no commit was started.

An initial invocation did not retain its execution session/output. Root's final checkpoint inventory found both `native-retained-v1/` and `native-retained-v2/` populated: their analysis gzip and summary files are byte-identical. The earlier description of v1 as empty was stale. A subsequent worker read-only `ps` inventory found no running instance before the logged successor began. Preserve both attempts without inferring execution ordering or independent replication from equal outputs. The logged successor is `run-v2.log` and `native-retained-v2/`; these are offline analysis attempt names, not new native captures.

## Preserved files and state

- `PLAN.md`: bounded region/predicate/scope design.
- `exact_triangles.py` and `exact_triangles_test.py`: independent rational closed-triangle predicate; nine analytic tests completed successfully before analysis.
- `analyze.py` and `analyze_test.py`: source/snapshot/selection/mask admission and offline analysis; four focused tests completed successfully before analysis.
- `run-v2.log`: completed analysis process output.
- `native-retained-v2/analysis.json.gz`: complete lossless numerical output, including exact rational intersection witnesses, source selections and bindings.
- `native-retained-v2/summary.json`: compact counts and hash bindings.

Analysis gzip SHA-256: `65e934a1c1435e47bcc32dbca665955b36558bcad1b1a4834204ba0e706e24fe`.
Decoded JSON SHA-256: `217f733dc94829a8e9f8a90a99597831442e541c84b58785a5950bd60d6336fa`.

`completed:true` inside the analysis means that its bounded offline enumeration and final input rehash finished. **It is not an independent approval, fit qualification, task completion, or candidate promotion.** Review/documentation remains unfinished.

## Bound native inputs

- Native accepted A: `captures/hand-attribution-2026-09-26/primary-v4/`, step 592 only; report SHA `bb12301ca0fd0db5097ad8fe6221498228612c2fcd314dac4377ca686d22a74e`, manifest SHA `fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d`.
- Fixed candidate D: `captures/hand-candidate-2026-09-26/candidate-dense-v2/`, steps 592–594; report SHA `17ab2f601b2e921ac47ae23739805be870de0c21526aa6a52daf36bb5442730f`, manifest SHA `17e1d1e9e5d71987cb1a66eb1dc3b5b8ce8653d7d006b073389bc1d19b5de871`.
- Prior failed-corridor selection: `hand-candidate/native-geometry-dense-v2/analysis.json`, SHA `5629a2cce7a42803e991706bfe735664806c8dc0324b63edc15ffbcd504ca25a`.
- Five unchanged installed assets: body, bra, briefs, casual outfit and shoes. Exact hashes, original loader bindings, full topology and drawn masks are recorded in the output. Neither source assets nor candidate family were modified.

The retained baseline has no geometry at 593/594; those comparisons are candidate-only. No pose reconstruction or new native capture was performed.

## Provisional observations, not reviewed conclusions

The fixed union of failed body faces contains 25 left/31 right triangles. At each candidate step 592–594, it intersects the casual outfit in 35 left/39 right exact transverse interior triangle pairs; all those query and target triangles are drawn. The query region has no non-shared-simplex full-body self-crossing at those three samples. Exact indexed shared vertices/edges are classified separately; coincident vertices with distinct IDs and cross-mesh IDs are not silently merged.

At matched A592, the same region has 44 left/49 right casual-outfit crossings plus 16 bra crossings on each side (bra targets masked), and 9 left/11 right full-body crossing pairs with a masked participant. Every candidate residual-region pair at 592 also occurs in A592; 25 left/26 right prior cross-mesh pairs are absent in D. Counts are not severity or clearance scores.

The broader explicit arm-influence garment selector contains 771 left/780 right faces. It also finds crossings outside the residual region, including changed pair membership at matched 592 (left 96/right 62 candidate-only pairs). This is why the residual-region result must not be advertised as complete sleeve improvement or fit approval. That selector includes any positive stored upperarm/lowerarm influence, including small/mixed influences, and is not an anatomical completeness claim.

These observations came from the completed output and one read-only compact extraction before the stop request. They still require exact witness review and careful final interpretation. No intersection count proves depth, containment, visibility, all-motion correctness or garment fit. The candidate's wider, less contracted angry upper-arm silhouette remains a visual/emotional tradeoff regardless of geometry.

## Pending review and next bounded step (not started)

The independent critic's initial source pass found no critical predicate or broad-phase blocker, but requested two items:

1. Label residual-body vs full-body pair counts as **directed query–target pairs**; pairs may be counted in both orders if both faces are selected. Do not call them unique contacts.
2. `meshes_of()` validates the set of mesh IDs but does not explicitly reject duplicate mesh records before dictionary assignment. Exact pinned inputs limit the current run, but a future successor should add the length/unique-ID admission and a focused negative control. **No source changes were made after this review request or after the stop.**

On explicit resumption: review the retained witnesses and masks, address that narrow admission gap without overwriting the existing source-bound output, then produce the concise reviewed RESULT/receipt. Any later re-analysis should use a fresh successor output with its exact new source hashes. There is no need for a GPU run merely to inspect these retained exact snapshots.
