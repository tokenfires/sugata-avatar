# Independent actual launcher failure and next loader worth: yes

Reviewed at 2026-10-08T02:20:46.990095+00:00. The first native source launcher failed before human/geometry construction. Native38925/wrapper38924 ran02:14:21.108876–02:14:23.263645UTC and exited2/no timeout. Actual source.log reports missing required --gender/--output. The unchanged builder's terminal main() at2715 runs during spec.loader.exec_module(builder); main2572 starts with parse_arguments2573 before clear_startup_scene2581/create_figure2583. No complete constructor, SOURCE-RESULT or .blend was produced, and no cold readback is admitted. This is a proved import/CLI entrypoint problem, not a body/rig/expression capability failure.

I missed the unconditional terminal builder call in the earlier import preflight. I had reviewed the whole creator/receipt and selected builder functions, but did not validate the imported module's complete top-level entry behavior. That made the admission incomplete; preserve the original SOURCE-PREFLIGHT and first failed logs rather than rewrite their history. This review corrects that omission using actual log and literal AST/source witnesses. I did not run native, import builder, create anything or inspect asset contents.

A fresh narrowly owned AST function-module loader is worth doing. A: parse the exact pinned original module, require its exact final Expr(Call(Name(main), no args/no keywords)), remove only that terminal expression, retain every other AST node/location and compile under the original filename/module context. Verify exact AST equivalence against original-minus-tail before any module execution, preserve original builder bytes/functions/import behavior otherwise, and use this owned loader in a separately preflighted driver. This changes the actual failing import behavior without changing accepted project tool source; cost is a small explicit adapter with initialization/filename/global-state ownership. B: change original builder to a conventional if __name__ == '__main__' guard; normal CLI behavior remains, but tool bytes/source pins change and need a separate project-source/CLI equivalence contract. Prefer A for this isolated source acquisition, with a literal loader/instrument preflight.

The adapter must not filter other top-level statements, stub functions, change argv to let old main run, call shipping main(), bypass fullowners, or retune body/geometry. It must preserve actual __file__/compile filename/import context and all callable source definitions. No new constructor attempt is admitted by this worth alone. A fresh changed-loader contract may nominate one first actual constructor after its complete source/preflight/root gate; it is not an unchanged replay of the failed launcher. Its job/result names must preserve prior failure evidence. Actual failure stops; cold readback only follows complete save success under separate preflight.

Input1620-file byte bundle and prior complete owner assertions remain useful. Source-only failure does not require another data inventory, material facade or body/rig trial. Do not label the failed process a successful source snapshot or a partial-body result. Normal startup/path setup before import may have run; zero human construction does not mean zero native/owned-directory operations. All source/default/frozen/runtime assets remain outside loader edits, and full AAA/Ari ambitions stay open.

Exact reviewed current identities:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/LAUNCH-FAILURE.json | 1843 | 75aa8f419713200a8b90cd65b4195356bd2b07175932e8756fc03506822ff817 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/SOURCE-JOB.json | 503 | 3bdc4b0bbbce44b84cf3214a03f4f8a22f172ca871a0e9d7ded9ec470a25238e |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/source.log | 1504 | 425dde8932540e9ec248d2af3a9cf7392c7eae995803f6d664ab1fcb30d154a3 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/SOURCE-PREFLIGHT.md | 5641 | 3055d041e846713bc0b9436d3dc4c002f2d251302f9a19dffc525a0295f674ed |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/FIRST-EXECUTION-WORTH.md | 3868 | 23427349996f22a40788346275aa560bb18fe65ac2609a3a3431c5b065deab28 |
| tools/figure-pipeline/build_figure.py | 130865 | 270e87d563ab0212835ec2c63b4d6364a1031397979152b0af14bccdc7753065 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/create_source.py | 11434 | 4c0f4dd7317219721a35796cfec9003f70d80a382223ef1f44918b4be7fca67e |

No same-attempt rerun or cold/native/export/render follows this review. Preserve failure/preflight bytes; proceed only to the concrete loader-source correction and separate admission.
