/**
 * violet.selftest.mjs — puts `violet.mjs`'s operator validations in front of the suite runner.
 *
 * ## Why this file exists, and why it is four lines of code and forty of comment
 *
 * `tools/critic/violet.mjs` has carried its own `--selftest` since it was written: 25 validations
 * against synthetic shapes whose answers are arithmetic, no browser, under a second. Six other
 * tools in this directory — `band-power`, `hair-pedestal`, `hair-transmittance`, `heatmap`,
 * `lock-coherence`, `travel` — each have a `*.selftest.mjs` companion and are therefore picked up
 * by `run-selftests.sh`'s glob. `violet.mjs` did not, for no recorded reason, so **nothing ran its
 * validations unless a human remembered to.**
 *
 * 🚩 THAT GAP HAS A MEASURED COST, and it is not hypothetical.
 *
 * This tool's statistics are what REQ-060 and REQ-078 are argued from, and between them those two
 * requests have now spent three rounds on operators that do not track the defect:
 *
 *   1. **circular variance of band hue** — inverts on a real render, because an 8 px band on a
 *      figure is about four fifths skin.
 *   2. **`band.sideSeparation`** — has a TWO-SIDED ZERO. It reads ~0 when both back lights carry
 *      one hue AND when the outline has gone warm entirely, so it cannot tell the defect from the
 *      fix. Measured across seven rig configurations on 2026-08-17 it correlates with the DEFECT at
 *      **Pearson r = +0.9510**. REQ-060 set out to raise it; raising it raises the violet.
 *   3. **`subject.coolShare` read on its headline arc** — 222,400 subject pixels against 58,949 in
 *      the band, so it is three quarters interior skin; and the [150,300) arc has a boundary
 *      artefact that reported a 3.4x improvement for a rig change that moved nothing visible,
 *      because the rim rotated into magenta at 300–330° and stopped being counted.
 *
 * Every one of those was caught by a human looking at plates, never by a run. The validations that
 * WOULD have caught the third — §BAND COOL's magenta clauses — now exist, and this file is what
 * makes them run whether or not anybody wants them to. That is the same argument `run-selftests.sh`
 * makes for `docs/RED-GATES.md`: the information was never missing, what was missing was a step
 * that fails when it goes unread.
 *
 * ⚠️ WHAT THIS DOES NOT DO. It runs the SYNTHETIC validations only. It captures nothing, opens no
 * browser, and measures no render — `--shoot` needs vite and a GPU and belongs in a critic round,
 * not in a gate that has to pass on any machine. So a green here means *the operator is arithmetically
 * sound on shapes whose answers are known*. It does NOT mean the operator tracks the defect on a
 * real figure, and clause 1 above is exactly a statistic that passed its synthetic checks and
 * inverted on a render. Read `docs/OPEN-REQUESTS.md` REQ-078 before trusting any number from here.
 */

import { runValidations } from './violet.mjs';

const failed = runValidations();

if ( failed > 0 ) process.exitCode = 1;
