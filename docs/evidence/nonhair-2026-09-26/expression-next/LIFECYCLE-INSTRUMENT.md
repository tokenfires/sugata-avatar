# Native speech witness instrumentation correction

The first native lifecycle run stopped at its speech gate. It incorrectly used `Figure.getMorph`, which returns the direct-path intended `figure.weights` cache. Native MotionStack's `createMotionTarget` commits directly to each carrying mesh's influence array; that cache is not the native speech readback. This was a study-instrument error, not evidence of absent mouth motion.

The exact v1 helper is retained under `captures/expression-isolation-2026-09-26/lifecycle-v1/source-freeze/`, with a receipt binding it to the failed report. Helper SHA256: `d188b6cca2a9f9454a88aa2abc82ec34ab74578a252381f9b39716fa8f818aa6`. Failed report SHA256: `6df2450c924770dfbd266aa2e91a8f71648fa6ce287529c1e1aa19320604e9c5`.

V2 saves speech diagnostics before each gate and separately checks finished outcome, speaking frames, native committed peaks, and equality with **every actual carrying mesh** on all 60 sampled native steps. The thresholds were retained. It observed aa=.6, PP=.9, 24 speaking frames, and `say` outcome `finished`, while both intended-cache peaks remained zero. All ten lifecycle groups ran successfully, with no browser errors and clean disposal/all renderer memory zero.

V2 is **not a sealed passing qualification**: a crossed coordination message allowed the parent-owned capture-runtime instrumentation repair during the run, and the source-hash gate correctly rejected it. Its `completed` remains false. The only changed source was `capture-runtime.mjs`; report SHA256 is `65ff39837dfc71eea176ff65dc7007e42c623bd1e5e7404b506afc66c7e841f2`. The parent is running v3 against stable sources. Do not replace the failed receipts or retrospectively mark v2 accepted.

No production runtime, speech behavior, or morph threshold changed. The parent separately corrected the appearance-capture OVR readback to native committed values with live mesh verification. The lifecycle sequence remains separate from the six matched appearance clips.

## Stable native acceptance

The coordinator's `lifecycle-v3` passes all ten native groups, with 313 start/end source and
asset hashes exact, no browser errors, no remaining study layers, actual Avatar disposal and
zero renderer memory counters. Its report SHA is
`0ce3a157e3de7cca1a6d7f6b6b07d6c21ea003436e67198d592f454c20254c52`.
The coordinator independently rehashed all 313 current inputs. The lossless reports and hashes
are retained in `native-evidence/`; v1 and source-drift v2 remain rejected.

The appearance capture uses the same actual committed/body-mesh OVR readback, with intended
direct weights clearly separate. Avatar advances its public clock after stack evaluation, so
pre-step speech sample time is recorded explicitly and normalized envelope key capture uses
`ceil((keyTime - leadSeconds) * 60) + 1`. This aligns the observation with the native scheduler;
it changes no runtime timing or speech behavior.
