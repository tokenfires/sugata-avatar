# Portrait expression inventory — September 13, 2026

The current Portrait controls work, but their expressive clarity is uneven. Warm has the clearest coordinated smile, cheek and head change. At ease is subtle. Curious and Determined mainly read as alert faces in these saved views. This is a bounded visual judgment shared by the primary agent and independent critic, not a human recognition study or a claim that the controls are identical.

This inventory follows the product direction recorded from Rob's discussion with Ember in [PRODUCT-ROADMAP.md](PRODUCT-ROADMAP.md). AAA character quality, complete wardrobes, representative starter builds and nuanced agent intent remain the Phase 1 goal. No coy/teasing control was found in the inspected current controls/API, so the reported sour reading has not been attributed to a particular implementation.

## See the actual controls

The local [interactive comparison](../captures/expression-inventory-2026-09-13/portrait/review.html) shows all five starts at four sample times, with optional hidden labels. Open the HTML in a browser, or use the running local preview's `/@fs/Users/robault/GitHub/sugata-avatar/captures/expression-inventory-2026-09-13/portrait/review.html` route. The gallery is a saved local review artifact, not an additional built testbed destination. Its raw captures are intentionally local and ignored by Git.

- Five fresh, seeded current Avatars: untouched neutral, then actual Portrait clicks for At ease, Warm, Curious and Determined.
- Twenty original PNGs: start, 0.25 s, 1 s and 2.5 s at a fixed 60 Hz motion step. All 14 natural motion layers remain enabled.
- Each sample records actual target/PAD state, expression prescription, committed mesh morphs, selected bones, camera and physical hair/face state. All five browser runs completed without runtime errors and disposed with zero storage attributes, participants or leaked handles.
- One character with bob02, one upper-torso view. The time buttons select saved stills; they are not a continuous motion recording or full-body gesture qualification.

The original control inventory is on revision `de08785`. Source snapshots/hashes and the exact scripts are preserved. The independent critic inspected all 20 images and independently verified the recorded state evolution, enabled layers, source hashes and cleanup results.

## What the review established

| Control | Actual behavior and visible reading |
| --- | --- |
| Neutral start | Zero affect target/prescription; natural idle still contributes facial and body motion. |
| At ease | Small positive mood and slight mouth/cheek softening. Its subtlety is reasonable for the label. |
| Warm | Sustained happy activation with a smile, cheek engagement and a raised head; the clearest coordinated difference here. |
| Curious | Wider visible eye and a slight smile; suggests attention or interest. |
| Determined | Wider eye with less smile; reads more like alert/wary attention than clear resolve in this crop. |

At 2.5 s, Curious versus Determined has committed `eyeWideRight` 0.637038 versus 0.494181 and `mouthSmileRight` 0.143825 versus 0.032992. Their recorded bones match at 1 s and 2.5 s, but not throughout the transition: Determined briefly crosses categorical happy/annoyed activation at 0.25 s. This categorical label is not proof of perceived annoyance. Continuous eye/mouth output remains even when categorical activation returns to zero.

Hair hides much of one eye/brow in the later samples. A shared natural blink also affects the 0.25 s comparison. The unseen lower body and unsampled motion cannot be inferred from these plates. Initial physical states match, but the five initial PNGs vary by 1–398 pixels, up to three 8-bit code values; this inventory does not claim pixel-exact rendering between runs or use pixel difference as a measure of emotional meaning.

## Small shipped correction

Portrait previously highlighted At ease before applying its target. The initial page is neutral; clicking its already-selected button changed the target. The page now starts with no pressed expression. All four button labels and their actual target values are preserved.

The critic offered two alternatives: apply At ease during boot, or represent the existing neutral baseline honestly. The latter was chosen to keep the captured baseline and current starting behavior.

The final real-browser verification checks neutral state/selection, all four actual click targets and exclusive selections, and the gallery's 20 image loads, sample controls, hidden labels and mobile width. Three groups pass without runtime errors; the Avatar disposes cleanly. The serialized initial physical state matches the original inventory exactly. This HTML correction is not a shader or motion change.

Two initial verification attempts are retained. The first compared live negative zero against JSON-normalized zero. The second imposed an unnecessary cross-run PNG-byte equality assertion; 314 of 608,600 pixels differed by at most three code values while serialized physical state matched. The final check qualifies the UI semantics and saves its image without claiming pixel equivalence. No production renderer was changed to satisfy these probes.

The testbed catalogue now records the four verified controls and their remaining expressive limitation. The final source passes all 92 catalogue assertions and the all-page build. The refreshed preview at port 5197 serves the corrected HTML, updated catalogue and complete gallery; HTTP-served sample bytes match the archived PNG. Final logs and preview checks are in [expression-inventory-2026-09-13.json](evidence/expression-inventory-2026-09-13.json).

## Other source findings, still open

The legacy Affect diagnostic advances its existing state three seconds for a purported settled preset. Actual joy → neutral leaves PAD approximately (0.242237, 0.163158, 0.136799) and a 0.169566 smile-corner prescription. This is expected slow release/mood behavior, not a broken integrator. The source claim of a canonical settled plate is inaccurate for inherited state; this sequence has CPU evidence only, not rendered visual proof in this inventory. Two alternatives are a deliberately reset canonical sample or a honestly labeled timed transition. The current milestone does not alter that diagnostic or the decay constants.

Named `Avatar.feel` triggers persist until cleared. A later neutral PAD vector does not itself clear them. That documented low-level behavior needs an explicit replacement/clearing contract in any future intent sequence; it is not evidence that normal Portrait clicks create a stuck sneer. No named coy/teasing primitive exists in the inspected Portrait, shared preset table or named affect API.

## Next bounded design step

The critic recommends a clearer face comparison of neutral, Curious and Determined with both eyes/brows visible and a fixed head/gaze reference. If hair is hidden, label it as a face diagnostic and keep this natural presentation alongside it. Alternative: a continuous natural sequence with more unobstructed moments and a wider body view. Either resolves the current presentation limitation before tuning amplitudes.

If weak determination remains, compare one explicitly authored onset/hold/release action combining gaze fixation, a small head-settling cue and restrained sustained posture. The alternative is qualifying the current label as an alert/focused demonstration. The authored route advances the intended capability, but must avoid reading as hostility and earn its own visual review. Do not globally retune PAD, guess coyness from a research label or reduce the original goal to the current controls.

Full independent reviews and both alternatives per critique are in the local archive's `sourceAudit/REVIEW.md` and `visualReview/REVIEW.md`.

## Evidence archive

`captures/expression-inventory-2026-09-13/`: 105 files / 16,545,935 bytes, all re-read and SHA-256 verified after copying. The tracked inventory is [expression-inventory-2026-09-13.manifest.json](evidence/expression-inventory-2026-09-13.manifest.json), SHA-256 `f3f797b3d83638e105a9a1f0121758e2982dff78b10769fc7faabbc424eb0c19`. It retains the original 20 PNGs, comparison HTML, source snapshots, both critic audits, failed and successful verification attempts, screenshots and tools. The archive includes production source only for the small Portrait/catalogue correction; no new expressive action ships in this milestone.
