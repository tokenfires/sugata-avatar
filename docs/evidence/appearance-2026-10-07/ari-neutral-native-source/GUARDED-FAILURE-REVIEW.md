# Independent guarded failure: actual cached logging scope mismatch

Reviewed at 2026-10-08T02:49:35.674118+00:00. The corrected loader reached body creation/count guard, then skin setup: native75612/wrapper75611,02:28:20.197907–02:28:23.843918UTC, exit1/no timeout. Structured traceback is builder.apply_skin2008→HumanService786→LogService.warn94/_log_message66→creator.audit53. It rejected /Users/robault/Library/Application Support/Blender/5.2/mpfb/logs/separated.services.humanservice.txt. Stored report success=false contains no scene. Body/count passage is implied by code/trace order, not a persisted full body/rig/appearance result. No whole scene/.blend/cold result was produced.

Source error: creator allowed Location.get_log_dir, but cached Logger.path came from LogService18–25's distinct _MPFBHOME/_LOGDIR. Logger52 initializes channel paths;66/68 append to self.path/_COMBINED. Earlier preflight did not prove that cached paths matched Location; preserve that observer admission and failure rather than rewrite history. This is logging write-scope failure, not body/skin capability or a material defect. No body/rig parameter tuning is justified.

A: qualify exact already-loaded _LOGDIR/_COMBINED/channel paths and allow that logging-only exception. Keeps normal locations but continues original diagnostic writes and requires channel/factory coverage; never permit the5.2/mpfb parent/config/data broadly. B: validate cached parent/basenames, rehome every existing Logger.path plus _LOGDIR/_COMBINED to new owned work/logs before audit; future constructors use changed _LOGDIR. More process-local field mutation, but diagnostics become owned. Root selected B; the directly inspected public live-dict getter200–204/369–379, constructor47–55 and append57–69 support it under exact source preflight.

I independently read failed report/job/log/code. A first JSONloads attempt encountered concatenated native suffix text; raw_decode recovered the complete marker object equal to stored report, followed only by Blender version/OBJ timing output. That is a log-reader correction, not another native failure. No archive/numeric asset/native operation or rerun occurred on critic.

One first CLI launcher failed beforehuman; this guarded humanconstructor1 failed at logging. Both stay distinct and preserved. A fresh changed-logger contract may nominate one complete source attempt with all owner assertions/unique outputs intact; no unchanged retry, partial-source acceptance or cold readback follows this report.

Exact reviewed identities:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/GUARDED-FAILURE.json | 1256 | e330d8b2dcdeec335b1f689aecb84c563ae17d41512fce71c640ac05aa697728 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/GUARDED-JOB.json | 511 | 1e4c55f9cfc71232e625e0b8ceabb213e1e70394e512917fc22ca09ef571b21c |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/GUARDED-SOURCE-RESULT.json | 19116 | 4f0b7b49d6606483c54b365a4fcc3b51312b723c2df4f997519215b2d9c1fb3e |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/guarded.log | 19227 | 2da07decefb96e6ba57835282b6a1fc39989185c3f2778974f9bff10bd6af918 |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/GUARDED-PREFLIGHT.md | 6935 | f4e16bfb203f8e52d36861a0643a89017ba707eada7030b7d9d510e25c18798d |
| docs/evidence/appearance-2026-10-07/ari-neutral-native-source/create_source_guarded.py | 11552 | 5f06b1a1aab20c3671a7f244c205fcf1aef93902aca13c7debceb00ff0fd080f |
| MPFB/services/logservice.py | 16584 | 98bd5ca5e3f5772e5d45c1923dfffea08ce6309444b4ccc16edafe6b1f425d3b |

Preserve this report and all earlier source/failure bytes after root full read. Full project goals stay open.
