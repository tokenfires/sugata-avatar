# Hair attachment/contact documentation is worthwhile

**A: one short API paragraph beside the existing hair availability paragraph is worth doing.** The question resolves from current source and the retained Rowan reports; no new empirical experiment is needed. This is worth admission only, not a docs edit or new runtime/API/asset approval. Stop the source investigation now, before06:48UTC October4.

`docs/API.md:377–382` explains requested style, loadedStyle/bake, detached unsupported bakes and unavailableReason. Its hair section358–405 also describes quality/fallback and AAA limits, but neither that section nor the narrow whole-file contact/calibration search explains `hair.bodyContact` or `hair.bodyContactUnavailableReason`. The report overview548–551 likewise describes hair attachment without this independent contact path. A consumer can therefore know that a groom attached without knowing which returned fields answer the separate contact question.

**A:** add the concise source-backed distinction beside attachment availability, using the existing report fields. It helps developers interpret a real supported endpoint without an extra warning flow or feature. **B:** keep the current API text and rely on source/evidence readers. B avoids added prose but leaves an actual report distinction unexplained at the point where the consumer chooses a groom/identity. I prefer A; this is a small useful documentation result, not a remedy for Rowan's artistic failure.

## Actual source/state witnesses and draft review

Current `Avatar.js:2647–2663` reports requested/loaded style, bake, attached and groom unavailableReason. **Current contact field lines are2682–2683**, rather than the earlier approximate PLAN anchor2678–2680: bodyContact comes from the live dynamics contactReport or null, while bodyContactUnavailableReason is a separate stored reason. `HairDynamics.js:1528–1533` returns null when there are no contact hooks; a non-null report describes that current path, not an all-motion appearance pass.

`Avatar.js:3631–3648` attempts bob01 calibration lookup only for g025/g050 within the dynamics construction path, and proceeds to a contact factory only if selection.enabled. `HairBodyContactCalibration.js:98–115` can decline for missing records/Web Crypto, invalid driving-head/rigid transform or source geometry/skeleton/hash mismatch. Eligible bake alone therefore does not mean enabled contact. The helper's explicit comment94–96 says calibration selection does not itself certify dynamic appearance or activate contact. No calibration data/asset was parsed or executed in this review.

The complete Rowan FRONT-STATE/RETIRED-STATE were read in the prior appearance gate; I re-read their actual creation/front hair field dictionaries and recipe/state metadata here. Both contain `attached:true`, `loadedStyle:'bob01'`, `bake:'figure_g100'`, `unavailableReason:null`, `bodyContact:null`, and `bodyContactUnavailableReason:'No body-contact calibration for bob01 on figure_g100.'` The state.failure is null, one front completed and manual retirement is disposedtrue/leaked[]/errornull. The independently viewed original and prior CRITIC-RESULT record a separate artistic refusal. The fields establish successful attachment without that calibration; they do **not** establish why fringe obscures an eye or why the neck band appears.

Root's concrete draft is substantively accurate: separate attachment from contact, name both fields, say g025/g050 can refuse validation, cite the g100 returned report and deny a fit/motion guarantee. One small wording refinement would make its opening **“Groom attachment and the body-contact path are reported separately”** and its eligibility sentence **“For bob01's dynamic contact path, calibration is currently attempted only for…”**. `Avatar.js:3506,3583–3607` permits a null/no-solver path before selection, so documentation should not promise a lookup for every attached eligible bake or a populated unavailable reason in every possible null-report case.

**A:** use the path wording plus conditional attempt/validation sentence; it is precise and still short. **B:** retain the root draft's calibration wording, with the explicit refusal/no-guarantee sentence doing the qualification. B is understandable, but less clear about a null report when contact was never attempted. A is preferred as a wording clarification, not a new technical blocker. Do not expand to a catalogue table, bob02 calibration claim, serialized option, guaranteed enabled g025/g050, physical cure or new runtime test.

## Exact inputs and read scope

At the FS-only shasum readback, exit0/chunk `c41969`, followed by clock observation06:44:31UTC (PID/full command start/end not recorded), exact input SHA256 values were:

- PLAN: `b83009e1bbf4355525518c277b6e256d475dfffe805174f6b78e9a5f16604261`;
- docs/API.md: `71117d8e564ca92a0c7897e81f36b9de55eee5725c7f6473f169ea17556b5353`;
- Avatar.js: `fdbe49aec99f9c718bde269b5e434cda07af1504ea8df386a634714cea112b18`;
- HairBodyContactCalibration.js: `0709c3d888613c7a1208cbe3f98d3adfe8d2936754f9aaca0bc66d686dd985cc`;
- HairDynamics.js: `bacd260ab768277b4efa9345c990e58a133c3c97f6b683ecf1674cc3588de1bc`;
- Rowan FRONT-STATE: `0750ac1a398ead10f45752c941d35c3147c08bc2cd7a7c20f2c640257bc94a99`;
- Rowan RETIRED-STATE: `9f2a2f2145e78b53a872c1193f8b61f80c6c8edb77b5935d4234dbe58c4bbec3`;
- prior CRITIC-RESULT: `3c774a4883578862a88540ecc555374094091c58462fac419d8092c0448d9df5`.

Read PLAN in full, current API hair/report sections and narrow whole-file search, actual Avatar field/attachment/dynamics/contact lookup contexts, the complete calibration helper and HairDynamics contactReport context; inspected only saved report data in an inline JSON FS read. No helper/module import, tests, asset parser, tuning, native/browser/GPU, new image or production/docs mutation occurred. This new note is the only critic output; no live owned job remains. The next action, if separately admitted, is a bounded paragraph edit and source/link review, not another portrait or contact experiment.
