# Iris preview critic preflight

## Literal design admission

GO for the literal design only, recorded 2026-10-03T16:46:48.187757+00:00 before the 16:49 cutoff. Fully read PLAN.md and candidate.json. This is one isolated fixed #527b97 transform and four actual Original/Blue front/oblique views. No native/source execution is admitted until full final source review; launch cutoff remains 17:09 and original-image review cutoff 17:19.

The new chromaticity transform explicitly targets the refracted/pupil-remapped annulus before caustic, retains the pupil side at equality, and acknowledges changed fractional iris-mask transitions and nonphysical/perceptual limits. Actual Original is the unmodified Avatar globe. The borrowed raw material argument addresses EyeMaterial.js:609,910–913's missing plain-map forwarding; never-attached donor, original cornea/pupil owner and fixed-pose frame synchronization address 615–628,668,692–726,1183–1240 and Avatar.js:1514–1519,2945–2950.

Already actually viewed current original-front.png (skin-finish packet): visible dark iris around x707–744,y600–620 gives a useful comparison context, with the other eye partly hair-occluded. It establishes no defect or predicted Blue preference. Explicit first-failure/no-retune gates make this a bounded customization question.

Alternatives remain: A this separately declared isolated pigment preview, useful if it produces a readable choice while pupils/whites/limbus/cornea remain acceptable; B retain authored brown eyes/current controls, simpler ownership but no new iris customization. A is worth this one comparison; neither implies shipping an API, default, saved field or physical iris model.

Full source review pending: copied-source exact diff/import identities; raw borrowed map identity; actual attached recipe/frame/uniform/optical ownership; UI selection and snapshots; restoration and independent donor/Avatar/page/browser cleanup on every error; bounded whole observation and final pins/errors/status. No implementation or source adjustment selected by the critic.

Literal input hashes:

- `PLAN.md`: `0fa8eccd8e3983c35d0c7e3fc7bbf1256ea430ca60fe74866cf01713b7b6e89b`
- `candidate.json`: `e6609f09008e80fabac3c1e583062754c0b4d7676fa00d2e24277d6ae8c86b84`

## Initial full source review — native admission withheld pending narrow fixes

Recorded 2026-10-03T16:59:40.230442+00:00. Fully read preview.mjs, preview.html, tools/critic/iris-pigment.mjs, COPY-DIFF.patch, COPY-RECIPE.json, source-check.mjs/SOURCE-CHECK.json and admitted plan/candidate. A separate read-only textual reversal confirms the four copied differences exactly recover the pinned current EyeMaterial. The annulus selector and luma transform implement the literal design, and both relative helpers resolve to their existing source. This does not execute a constructor or shader.

Two concrete blockers were sent before execution:

1. **Catchlight resource identity.** EyeCatchlight.js:215–248 returns `{texture,node,dispose}`, not a texture/EventDispatcher. Initial preview.mjs:38–42 calls `donor.catchlight.addEventListener`, and line76 records `donor.catchlight.uuid`; those fields do not exist. **A:** observe `donor.catchlight.texture` event/UUID while keeping wrapper.dispose as owner (recommended; no pigment/optic change). **B:** construct with no unused catchlight, which saves resources but changes the donor construction/invariant and must be separately declared. A is the narrow source correction.

2. **Setup and partial-construction retirement.** Initial preview.mjs:94–98 groups restore and donor disposal in one try, so a restoration failure skips donor cleanup, and retains no initialization-failure retirement receipt. A constructor throw after catchlight/globe creation also leaves `donor` unassigned. **A:** independently attempt restore, donor and Avatar cleanup; retain the actual setup-failure receipt; give the isolated constructor a declared failure-only catch for its already-created own resources, preserving original borrowed materials/textures (recommended). **B:** explicitly narrow the lifecycle claim to returned donors and refuse any constructor/setup failure with browser closure; this loses partial-resource evidence and does not fulfill the present always-dispose contract.

The observer's success path checks four declared UI choices, exact actual recipe, measured frames/optics/uniforms, borrowed-map identity, mesh bindings and original cornea; cross-state comparison omits only the declared active globe and camera/view/arm. Screenshots retain ordinary temporal limits. Whole setup/observation is bounded to 17:18:40; restore/retire/page/browser actions have independent cleanup bounds; final errors, source/input pins and deadline prevent an earlier observation from surviving cleanup failure. Pending corrections must be source-reviewed and pinned before sole launch and 17:09. No native experiment admitted yet.

Reviewed initial source hashes:

- `preview.mjs`: `8943b196c6908922e8a94f40a0388a68918996d18b58e9f123a11a82d2ba7b09`
- `PreviewEyeMaterial.mjs`: `4cfd8e3e7b0a191040be5eb17e766a2112e7ba4791669878c7becf98c3137339`
- `COPY-DIFF.patch`: `f7e1a73d69e81ce8577359ba1a40e2fbb4b46af0b7b2e9b19e1bc42aa6108862`
- `COPY-RECIPE.json`: `cd7116c434a5c2baf56732f912a7d92df1728d3a8695cc0087e278b466c21c00`
- `tools/critic/iris-pigment.mjs`: `f35f0bbac3f31e60e07fa9ee0e4ea4fb08dce5e884f1d1ef44c75961d22a7ee3`

## Final corrected-source admission

**GO for the sole fixed four-image native trial**, recorded 2026-10-03T17:07:41.676717+00:00 before the 17:09 source/launch cutoff. Fully read the final preview.mjs, complete observer, nine-difference copy patch/recipe and amended plan. Independent read-only reverse-nine reconstruction exactly matches current original EyeMaterial; no constructor/GPU executed.

The actual catchlight.texture now provides events/UUID; wrapper.dispose remains owner. The isolated-copy failure ledger starts before catchlight construction, records the returned wrapper and immediate globe/cornea allocations, and independently attempts all recorded resource disposals on failure through constructor completion. Its receipt is preserved on the thrown error. The explicitly declared untouched-helper pre-return allocation limit is honest, not a guarantee of every internal allocation.

Setup cleanup now independently restores the original globe, attempts donor disposal, and always attempts Avatar retirement; initialization receipt is retained and consumed if the protocol is absent. Successful retirement is cached. The observer retains initial errors and cannot turn an initialization, resource, cleanup, pin or deadline failure into acceptance. These changes resolve the two initial blockers without changing the selected chromaticity, pupil mask or successful optical equations.

All earlier appearance/temporal/default/API/schema limitations remain. The native result and all four actual originals still require independent review by 17:19. One first failure closes the trial without repair/rerun. No live job or further source change is authorized by the critic beyond root's already declared sole trial.

Final reviewed hashes:

- `PLAN.md`: `73c36c2239fdd8b020c9169e6953780749f4572f6e58a7ce77d59cb1b0b66083`
- `candidate.json`: `e6609f09008e80fabac3c1e583062754c0b4d7676fa00d2e24277d6ae8c86b84`
- `preview.html`: `13f1b1ec17c29fd1188c7d68e29d0771141978aacd228dfe2c089129a19b9f66`
- `preview.mjs`: `41884551e21595a6615229bc43a4a706d4e452ae6e995ff66c5bb8cf76c8ca2b`
- `PreviewEyeMaterial.mjs`: `798983d0b7ac6bb008226e460abfc083a6f01b24074f86c1d11e80ec3a43c7d1`
- `COPY-DIFF.patch`: `fc252ada810854563b5942d0a40f73715dcb9613dfa174a4c1053636e0e2c16c`
- `COPY-RECIPE.json`: `6dbe2474077fc26bf69912c4a4756d86d3ad82c6dca7abe473e6d32628e4da02`
- `source-check.mjs`: `70c931e6318c15fecd680299fa9666c67a474c79c27f672fa12c2cca3cecef80`
- `SOURCE-CHECK.json`: `eafb2b10bc5820ed1c9529795f41631077175058e355ad6e9cd404524f8b394a`
- `tools/critic/iris-pigment.mjs`: `35502e6f7d5f89d7687d335a61e2b21f65508bdb74e31263305390a24af9725c`
