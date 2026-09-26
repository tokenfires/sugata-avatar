# Hand-motion review packaging

Prepared while native attribution is running. **No gallery output or visual acceptance exists yet.** These new files are outside the native capture's pinned sources; neither the capture runtime nor accepted product/assets changed.

After the root controller supplies a completed sealed views directory, run from repository root:

```sh
node docs/evidence/nonhair-2026-09-26/hand-clearance/package-hand-review.mjs SEALED_VIEWS_DIR captures/hand-attribution-2026-09-26/review-v1
```

The output directory must be fresh. The generator verifies the views report/manifest seals, its matching completed sealed primary report, A/B/C completion and clean teardown, all frozen views source hashes, exact state/geometry gzip and decoded hashes, pose/owner parity receipts, original A reproduction receipts, every PNG hash and dimensions, and the fixed close-view set before creating any output. It refuses nonexistent, incomplete, unsealed or mismatched inputs. Later file-copy failures leave an incomplete directory without a completed receipt; preserve that directory and use a fresh successor path.

The self-contained output contains `index.html`, `review.mjs`, `review.css`, `review-manifest.json`, `receipt.json` and the 750 expected PNG copies. Keep the bulky output under ignored `captures`; do not force-track its images. The receipt binds generator/template/output/image hashes and the capture/primary report hashes. Copy its compact JSON into this evidence directory after success, then add a durable landing link here if desired.

Existing Vite can serve the expected output at:

`http://127.0.0.1:5173/@fs/Users/robault/GitHub/sugata-avatar/captures/hand-attribution-2026-09-26/review-v1/index.html`

## What the review shows

- A — Native.
- B — Suppress inward-posture delta only.
- C — Suppress gesture arm delta only.

These labels identify disposable diagnostic controls, not proposed fixes. Brief notes state that native owner updates and schedules/bookkeeping remain active. The common slider and frame buttons display one recorded full-body step across all three arms. Playback holds each sample for its actual next-step interval divided by 60; extra irregular samples are never treated as uniform 15 fps. All three images decode before they commit, and buffering pauses the timeline. Step, simulation time, sequence phase and sample count remain visible. Backgrounding pauses playback.

Initial/angry step 455/angry step 637 bilateral hand-and-hip views use a separate fixed-time selector. Its label explicitly states that close views do not track the full-body player. All six close images commit together. On narrow screens both comparison strips scroll horizontally, preserving uncropped images.

The scope calls geometry-selected intersections contact witnesses, not penetration severity or clearance approval. Pose/owner parity against primary is a prerequisite; it is not independent causal or perceptual acceptance. One character/outfit and this discrete trace do not establish continuous coverage or general behavior. Hair remains unchanged and outside this review.

## Focused checks before publishing the link

CPU preparation checks cover JavaScript syntax, required HTML IDs and fail-closed nonexistent/unsealed/incomplete inputs without creating output. Actual positive packaging awaits the sealed path. No browser was launched by this worker.

Root's later browser check should load all three full-body controls, exercise play/pause and an irregular one-step interval, scrub to 637 and verify all `data-step` values agree, switch both fixed close times, confirm all six close `data-step` values agree independently of playback, and inspect desktop/mobile plates for whole-image framing and readable labels. Check retry behavior on a deliberately unavailable image and that backgrounding pauses. Generator verification does not replace these browser or visual checks.
