#!/usr/bin/env node
//
// scene-gates.selftest.mjs — the discovery hook for `tools/critic/scene-gates.mjs --selftest`.
//
// ## 🚩 WHY THIS IS A WRAPPER AND NOT THE SELFTEST ITSELF
//
// `tools/run-selftests.sh` finds gates with `find . -name "*.selftest.mjs"`, and its own header
// records what happens to a gate the glob misses: *"a runner that misses a gate is worse than no
// runner"* — `tools/critic/selftest.mjs` had to be named explicitly for exactly this reason. The
// scene gates' own validation lives inside `scene-gates.mjs --selftest`, in the shape
// `scene-probe.mjs` established, so that the clause and the arithmetic that validates it sit on the
// same screen. Neither file is worth splitting; what was missing was a NAME the runner can see.
//
// ⚠️ **AND IT SPAWNS RATHER THAN IMPORTS, WHICH IS THE POINT.** Importing would mean exporting
// `selftest()` from `scene-gates.mjs`, i.e. EDITING the file whose header carries measured tables —
// and `docs/CHECKPOINT.md` §14's sharpest lesson is that *"a table is only as fresh as the last
// write to the file it describes."* Those tables were re-measured against the final file and the
// file has not been touched since. A wrapper that runs it as a child process adds a gate to the
// runner and writes nothing.
//
// Exit code is the child's, so a red clause is a red gate.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const child = spawnSync(process.execPath, [path.join(HERE, 'scene-gates.mjs'), '--selftest'], {
  encoding: 'utf8',
});

process.stdout.write(child.stdout ?? '');
process.stderr.write(child.stderr ?? '');
process.exit(child.status ?? 1);
