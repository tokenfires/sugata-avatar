# Independent source/test preflight

**Decision: source and observer are ready; the sole recorded actual-function CPU command is worth executing.** Reviewed October 7 at 17:43 UTC, before the 17:51:35 UTC edit/test cutoff. I read the complete changed function, complete observer, preserved original function/table and guard plan/worth/preflight. I independently verified full-builder reversal to `3b35264`, literal table identity, source/observer hashes and syntax. I did not execute the test, import the builder/Blender or run any native/API/acquisition work.

The current `attach_face_parts:532–543` resolves all five declared sources first, applies the eye-proxy override, collects every `None` result in table order, and raises SystemExit with exact type/subdirectory/filename entries before attachments. `:546–552` then attaches resolved entries in the original order with unchanged `asset_type`, `material_type`, basemesh identity and return tuple layout. The explicit opt-out returns empty before any resolution. There is no exception swallowing. Attachment API exceptions may still occur after earlier successful attachments; transaction/rollback behavior is correctly not promised.

Replacing only the exact new function segment with the preserved original reproduces every original builder byte and SHA-256. The FACE_PART_ASSETS and EYE_ASSET_FILENAME literal values match their preserved dependency record. No other builder function, successful API argument, macro/body/rig/export/default asset or source dependency changes in this patch.

The observer parses text and literal constants, compiles only the actual function AST and injects resolver/attachment spies. It imports standard Python modules only; the source module and bpy are never imported. It verifies:

- Both all-present high/low-eye paths, exact lookup/attachment order and tuples; function-owned stdout and successful results match the old function.
- Every declared missing source, grouped misses, all misses and low-eye absence: complete ordered missing text, all five lookups and zero attachment.
- Explicit opt-out with no lookup/attachment, last-lookup RuntimeError with zero attachment, and a mid-attachment RuntimeError with the same original attachment prefix and exception.
- Eight negative controls executing the preserved old function: it returns an incomplete source list without refusing the same missing-input cases.

The finite source gives 13 planned cases. These test actual policy branches rather than merely counting metadata. RuntimeError injection and source inspection support exception propagation here; installed MPFB behavior is not exercised. The report records hashes, arguments, events, results and limitations. It refuses an existing output and preserves a failed record for ordinary observer/assertion failures; no retry or overwrite is admitted.

No actionable source/observer correction was found. Root should independently read this result and the exact planned command in GUARD-PREFLIGHT before executing it once. Only that injected CPU test is admitted by this preflight; actual results must be reviewed afterward. A failure must be collected and the guard held. No native launch, source-authority retry, arithmetic, geometry, target apply or recipe/acquisition release follows. The full character/fit/motion/runtime roadmap remains open; delivery cutoff is 18:03:35 UTC.

## Exact preflight identities

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| current `build_figure.py` | 130865 | `270e87d563ab0212835ec2c63b4d6364a1031397979152b0af14bccdc7753065` |
| `face_sources.selftest.py` | 9706 | `e7310ef132b1dde3b3066c76980744e907001b2bc674108602137a0d8869607d` |
| preserved function | 1333 | `b787889e331c4ddf2b848932a38ca7e13ffcbfcb719661bf2fa321746291f98f` |
| `FACE-SOURCES.before.json` | 1725 | `8e73ddb30fa7d3219fa02807cda58d713c0d4358106d5a69302800b9fba1fe57` |
| `GUARD-PREFLIGHT.json` | 1026 | `c5a4ded79a33db6f0f3d65a06988c801ab49c3134aa6a5c7ccc2892c89f20d82` |
| `GUARD-PLAN.json` | 3494 | `42aa3edbabd8e67e9536fcba8f5f84f23258466a1453abeab955c4351f635fb4` |
| `GUARD-WORTH.md` | 4046 | `0c31ef21e2bc399e85317c2de8c79a912cbda15d279090b74747111afe28bc3e` |

Original whole-builder identity: 130427 bytes, SHA-256 `8470ba8b949058d7127cdb22458ed83d1c611042e2f366f1371da698056559f2`. New function segment SHA-256 `2ae80de97eedb47f833257def28113a892e726bba3a3d4c81a4570dd7e02df55`. Count/identity checks are source qualification only; no passing test result is yet claimed.
