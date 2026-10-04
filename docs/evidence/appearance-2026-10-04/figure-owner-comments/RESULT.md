# A: retain the three comment corrections

Full COMMENT-DIFF and current comments accurately describe the observed source and existing selection code. Constructor lines 79–80 now state first-eligible SkinnedMesh traversal ownership and limit the seven-sibling example to wardrobe g050. In the preserved partial data, nodes 53–59 are all morphed skin-0 mesh primitives with parent 60, Human.rig. The first-eligible behavior follows Figure.js:342–344 and 369–372; this does not assert uniqueness. Line 368 correctly allows auxiliary anatomy to be skinned. Line 350 removes an unsupported fixed mesh count while retaining the existing culling rationale.

Independent literal reversal of exactly these three comment replacements restores the 15,766-byte original snapshot SHA256 5884d1ef68bb904271bcb2029bc1e50938381eded5ddfc187b431bcaf18cd3da. All five INPUTS bindings match; saved sibling/skin/morph witnesses were checked directly. No executable JavaScript, asset or selection predicate changed.

Alternative A retains these narrowly supported comments: small useful maintenance removes a false plain-child assumption next to the loader. B retains only the research note and restores the old comments: less source maintenance, but leaves misleading ownership guidance. Select A. There is no new actionable wording defect requiring correction.

This qualifies comments only. It establishes neither other-bake structure nor loaded/rendered behavior, source-to-runtime index correspondence, body contact, skin evaluation, fit, motion or appearance. The strict reader refusal remains B/closed. Its historical Figure hash is preserved by SOURCE-FIGURE.js; later current-byte hashes must use the corrected file. No mapping/owner experiment or new execution is admitted. No runtime test is needed for this exact comment-only diff, and none was run.

Exact examined bindings:

- `docs/evidence/appearance-2026-10-04/figure-owner-comments/PLAN.md`: 1173 bytes; SHA256 `83e9e9d9ad7795be48d20348446d62be1472b0ceb1f331ad7b026a56754fd84b`.
- `docs/evidence/appearance-2026-10-04/figure-owner-comments/INPUTS.json`: 1060 bytes; SHA256 `8684cfc202d9837404e978be3020062454b2502e9ce1f5f8bf953c81e21132ce`.
- `docs/evidence/appearance-2026-10-04/figure-owner-comments/COMMENT-DIFF.patch`: 1376 bytes; SHA256 `3a6931bbac99396dab122d73c2f003a4e278cbbf0675ad08082cabdfc1fc35e3`.
- `docs/evidence/appearance-2026-10-04/figure-owner-comments/ROOT-COMMENTS.json`: 628 bytes; SHA256 `e0b15169a80f905dd9834fd0ee2a978c74a6fa3f795ea641316dba7f6e7edfed`.
- `packages/core/src/figure/Figure.js`: 15821 bytes; SHA256 `4e3390925f20a497e6a5cf5ee863a0f372a3dc1f9a1ff3f4f280101a5220b90e`.
- `docs/evidence/appearance-2026-10-04/knit-registration-repaired/SOURCE-FIGURE.js`: 15766 bytes; SHA256 `5884d1ef68bb904271bcb2029bc1e50938381eded5ddfc187b431bcaf18cd3da`.
- `docs/evidence/appearance-2026-10-04/knit-registration-repaired/PARTIAL-DATA.json`: 6051441 bytes; SHA256 `2934a0bf92f505d0b8b27452cd90e30a959382b0214fd10ac1b761606f0d74c8`.
- `docs/evidence/appearance-2026-10-04/knit-registration-repaired/RESULT.md`: 5861 bytes; SHA256 `0d88c4986a9428fe2d761f5896ffd1b3930217270609b68ccdc8c74cf176e810`.
