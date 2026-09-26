# Dense capture counter correction

The first native dense run was rejected at step585 because the controller interpreted `physical.steps` as one count per native frame. The observed value1171 was correct; the controller's expected586 was wrong. No dense geometry had been appended. This changes an instrument assertion, with no candidate, runtime, asset, solver, timing, or tolerance change.

`tools/figure-pipeline/collar_capture_browser.mjs:11–15` returns `HairDynamics.readCentrelines().steps`, namely the solver's submitted fixed substeps. The pinned `HairDynamics.js` sets `SUBSTEP_SECONDS=1/120` (line99), starts the accumulator/count at0 and owes a reset step (946–948), consumes whole fixed steps with a maximum4 per frame (1250–1266), and increments `stepsTaken` by the substep count (1343). `readCentrelines` returns that count (1419). Avatar forwards the native delta to its existing solver (2930,3691). The capture helper performs the initial `step(0)` and zero-delta render convergence; its native runtime then calls `helper.step(avatar,1/60)` for each positive step. No convergence draw advances this physical counter.

Therefore this exact capture starts at1 and adds2 per positive native update: `physical.steps === 1 + 2*step`. The executed CPU proof reproduces the pinned accumulator arithmetic through all721 steps: initial1, then2, with remainder exactly0 on every update. All109 sealed own-primary physical samples satisfy the formula and exact native clock. This is a source-derived counter interpretation checked against evidence, not a regression fitted to a failing value.

The original failure remains unchanged at `captures/hand-candidate-2026-09-26/candidate-dense-v1`. This folder preserves its exact report as gzip and its exact controller source; `receipt.json` binds those bytes, the original manifest and both state archives, the proof script, and all relevant pinned source paths. The proof revalidated all1587 frozen failed-run source files, all586 partial states against the corresponding sealed primary states, the separately saved failure state, zero browser errors, and clean real retirement with zero renderer memory and no lost ownership. The failure physical record matches step585's clock and renderer frame. It is a rejected partial run, with zero retained dense geometry samples and no seal.

The unlaunched preflight-v2/controller and native-v1/controller remain intact. The corrected controller also extracts its existing structural admissions into shared functions and executes them on **all109** compressed-and-decoded-hash-bound primary geometry fixtures during preflight: complete snapshot telemetry, clock, rig identities/finite matrices, mesh identities/finite positions, full topology, drawn masks, solver totals, and exact counter deltas. The same functions run on new native observations. All existing full-state, overlap geometry/physical, asset, camera, source and teardown parity requirements remain. The four actual window camera samples remain the exact camera reference; step0's numerically settling camera is not substituted.

The renderer formula remains `1000257+step`. Preflight checks the retained setup frame and the frozen primary controller's every-frame assertion. The primary does not retain raw per-frame renderer readbacks, so those are source-and-completed-run evidence, not109 independently retained renderer observations. The rejected run additionally retains a direct renderer readback at585.

Reproduce the forensic proof from the repository root with a fresh output directory:

```sh
node docs/evidence/nonhair-2026-09-26/hand-candidate/dense-counter-proof.mjs /tmp/sugata-dense-counter-proof-fresh
```

Receipt SHA256: `7a9b2d44663ba17f8a26e9920e5f996f91a6af6eafcc91b7bdd2bf32a448d248`. Proof script SHA256: `7c2e93a8ce121cf232d91226bde1ab400e126501c3dc0a083138cc8e91f03fad`.

The corrected native run requires a fresh manifest/output and independent review before root launches it. A successful future run would add21 discrete observations at585–605; it would not prove continuous clearance or promote the candidate.
