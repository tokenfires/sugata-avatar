# Independent changed-loader worth and guarded source preflight: pass

Reviewed at 2026-10-08T02:27:20.779458+00:00. One guarded first human constructor/save is worth doing under the fresh GUARDED-EXEC-PLAN, after root full handoff/pin verification. This changes the actual preconstructor import failure, rather than replaying the unchanged failed launcher. Original builder/failed creator/prior preflight/logs remain exact. All10 current pins match; no native/module execution, asset decode, constructor or capture ran on critic.

Actual failed source is terminal builder main()2715. The pinned992-byte function_module requires the exact original SHA, parses under that original filename, validates its final Expr/Call/Name(main)/zeroargs/zerokeywords, and removes only tree.body.pop(). It executes the remaining module under the original __file__/compile filename in a deliberately owned ModuleType. Static AST record and my literal source inspection confirm the single tail-call delta; original function bodies/nodes/locations remain untouched. The original builder's only other top-level expression call is sys.path.insert; it stays intact. Its actual context-name reads are __file__ at90/348/355, so preserved filename owns relative tool paths. It does not read __name__/__package__/__spec__; new owned module namespace is explicit, not claimed identical import metadata. No CLI main()/argv workaround/shipping bake/export path executes on this loader route.

A: this exact owned function-module adapter fixes the proven import side effect while preserving original tool bytes/functions, with a small explicit loader identity/initialization contract (chosen). B: put an if __name__ entry guard in original builder; conventional importable tool with same CLI intent, but changes accepted source bytes/pins and needs a separate project-source equivalence gate. The adapter is appropriate for this isolated source acquisition; neither option is a body/rig capability workaround.

I independently reversed the guarded-driver changes to the original failed creator and obtained exact text equality: only loader invocation, execution-plan name and unique .blend/result filenames differ. Thus source/data/body/lifecycle/445auxiliary-expression/19158helper/sevenowner/sixweighted-armature/image packing/receipt/save assertions retain the complete prior semantic review. Current driver verifies all execution/source/input hashes, exact89 expression paths and canonical skin before construction; redirects four private data/cache/config paths and refuses external roots. It neither stubs a function nor bypasses a full-owner guard. The corrected receipt still owns material links/defaults/modes/settings, raw geometry/shape/influence/UV hashes and rest/pose bone state. Actual runtime may fail; no success is inferred from AST equality.

Python filesystem auditing confines writes to owned packet/existinglogdir; startup/logging and nativeC writes remain explicit instrumentation limits. Existing source inputs are readonly originals with new working ownership for generated caches. Native data/asset reads, image load and complete neutral geometry creation are admitted only in this controlled root process, not on critic. No Ari10targets, helper bake, cornea/wardrobe/hair, exported derivatives, render or appearance acceptance is included. Old45-minute lategate/STOP and failedlauncher1/humanconstructor0 remain preserved.

Fresh180-second root timeout and03:15 collection close apply only to this corrected-loader allocation. Root must preserve separate job/log and new guarded result/.blend output names, verify their absence and all current pins before launch, and stop on actual errors with no same-constructor tuning/retry. Cold readback requires another exact preflight only if the complete save succeeds; no reader is admitted now. No source/model/install/preferences/subscription/push/publish changes are authorized by this pass.

No further actionable source correction remains for this exact changed-loader attempt. Earlier skipped-auxiliary and incomplete-material-signature findings/two alternatives remain in preserved SOURCE-PREFLIGHT; their repairs are unchanged. My missed terminal-entry review is expressly acknowledged in LAUNCH-FAILURE-REVIEW and no historical acceptance is rewritten.

Exact independently verified current identities (whole loader/plan, complete driver change-equivalence and original terminal AST/context inspected; source semantic review reused):

| File | Bytes | SHA256 |
| --- | ---: | --- |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/GUARDED-EXEC-PLAN.json | 4069 | 46f19b83db320b28da7c391c986d2dda0f986f4b1586760857304f9347945c4c |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/scene_receipt.py | 6017 | 82b10908efaf576d6cd6763fc7a6d557604eb45c9f7e4652359c4da69b5c9f21 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/SOURCE-PINS.json | 3105 | 290f6c086c83dbc7d068abca6630a335a66146149e44b07852084b59fa6b3ffd |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/SOURCE-ADDITIONAL.json | 919 | 5e0b566bcbd64901bb56c87284f96125cd0d6c4a228149eef4d1d0e828f2075e |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/INPUTS.json | 760639 | b15f76537b65e86c6f453cae3a36c1e9e25dce28243bfed2cd1cc1e88eae8da9 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/EXPRESSION-PATHS.json | 15293 | 853b323487e621d3edb4d8fd6e3bf375ee21b7b7abe8ba7142dba825e6587d17 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/EXPRESSION-REQUESTS.json | 2140 | 4a0a092d517f2e291c7287b24c30385d5422de4bf07953d5d8fa8b5c094f2036 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/SKIN-WITNESS.json | 1842 | 186cec1bb663c79cc5717e2d6acfe2108d6346ded71fe0adabfb3753463265d5 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/create_source_guarded.py | 11552 | 5f06b1a1aab20c3671a7f244c205fcf1aef93902aca13c7debceb00ff0fd080f |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/function_module.py | 992 | ad25e48b56faf74e12001dd994963f3b2bf5afb09db7f36cca90550778858d82 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/LAUNCH-FAILURE.json | 1843 | 75aa8f419713200a8b90cd65b4195356bd2b07175932e8756fc03506822ff817 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/LOADER-STATIC.json | 328 | 0f012f13c3f3eb115daecefe57a7b02fa477e503d1732dbc5e970f496a2ccde3 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/LAUNCH-FAILURE-REVIEW.md | 4751 | 428e4ab23458f415b7064a213a1273d0ae687717df9f0dbc6369914f1b9bfc09 |
| tools/figure-pipeline/build_figure.py | 130865 | 270e87d563ab0212835ec2c63b4d6364a1031397979152b0af14bccdc7753065 |

Preserve this handoff after root full read. This admits the root-owned corrected first human constructor/save only; the complete native result remains unobserved and full project goals remain open.
