# Independent worth: required-face source guard

**Decision: worth the narrow two-phase source guard and meaningful actual-function tests.** Immediate verdict sent before editing. Completed October 7 before the 17:37:35 UTC worth cutoff. I read the whole exact `attach_face_parts`, `describe_result` and `main` functions from the pinned builder via static AST source ranges. The original 130427-byte builder SHA-256 matches `8470ba8b949058d7127cdb22458ed83d1c611042e2f366f1371da698056559f2`; GUARD-PLAN SHA-256 matches `42aa3edbabd8e67e9536fcba8f5f84f23258466a1453abeab955c4351f635fb4`. No table dependency fields, installed asset, Blender/module API, geometry, source trial or native acquisition were inspected/executed here.

## Actual omission witness

`attach_face_parts:531–535` resolves one declared source and, when the resolver returns `None`, prints MISSING then continues. Earlier sources may already have attached at `:536–539`; the function returns only whatever succeeded. Thus a required face owner can be silently absent from later ownership. This is a concrete permitted code path, not evidence that any installed source is presently missing or that a shipped output is partial.

`main:2575` calls this function before expressions and rig binding, then reaches export at `:2681`. The complete `describe_result:2506–2553` validates body expression keys and skinning of included hierarchy meshes, but has no required-face-source completeness comparison. An omitted owner cannot appear in its included-mesh skinning check. The default builder therefore has no later completeness guard for this path.

Two alternatives and tradeoffs:

- **Resolve all declared required face sources before any face attachment; abort with their complete exact missing list; then attach in unchanged order.** This makes the default omission impossible at the function boundary and produces one useful diagnostic rather than repeated partial attempts. It changes a broken-input run from partial output to early failure, while preserving successful paths and explicit opt-out. This is the recommended narrow fix.
- **Keep this function and add a separate complete-source manifest/preflight.** A full authoring manifest is still necessary for Ari, but it would cost more and leave this default print-and-continue behavior reachable whenever that separate gate is skipped. It cannot substitute for the local guard. Failing only at the first missing item inside the old loop would also leave earlier attachments already made and would not give the complete missing list.

## Scope and meaningful verification

Edit only `attach_face_parts`. Preserve the explicit `--no-face-parts` empty result with no resolution/attachment, eye-proxy override, successful ordered `(object, source path, alpha mode)` tuples and unchanged attachment API arguments. Resolve every expected source first; a `None` result must prevent all attachments. Original resolver/attachment exceptions should remain exceptions rather than being swallowed. This is not a transaction/rollback guarantee for an attachment API that itself raises later.

After worth, read only its exact table dependencies. An AST-extracted actual-function test with injected resolver/attachment services can verify each declared missing item, grouped misses, all-present/high-low-eye paths, explicit opt-out and propagated exceptions without importing the builder or Blender. Check the successful call order and returned tuples as well as zero attachment before missing/lookup failure. These tests qualify Python control flow, not installed MPFB/Blender behavior, geometry or source lineage.

The native acquisition remains stopped, the Ari recipe remains wholly held, and accepted GLBs/defaults plus all other builder functions stay preserved. No source/anatomy/rig/fit/render/runtime or checklist completion follows. Hold for edited source/test preflight; edit/test cutoff is 17:51:35 UTC and delivery cutoff 18:03:35 UTC. No native launch, broader rescue or proof inventory is admitted by this worth.
