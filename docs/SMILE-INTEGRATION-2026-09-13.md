# Optional smile in native attention — September 13, 2026

Portrait and Wardrobe studies now offer **Look with a smile** beside the existing **Look toward me** and **Release**. This is a restrained, explicit expression choice on the experimental attention action. It is not a new affect estimate or an automatic interpretation of the agent's intent.

The quiet comparison gives a modest polite lift. Selected actual speech peaks retain the open vowel, closed lips, labiodental and rounded-vowel differences. A strong happy expression leaves less room for an extra smile. Combining the cue with sadness softens the downturned mouth and can read as guarded or mixed. This does not establish emotion recognition, continuous speech quality, general warmth or AAA finish.

## Use and ownership

```js
const action = new AttentionAction(avatar);
action.lookAtCamera(camera); // existing neutral default
action.lookAtCamera(camera, { expression: 'soft-smile' });
action.cancel(); // existing short owned return
```

`AttentionAction` owns its control, pose and smile layers from construction. The smile has an independent envelope so repeated neutral/smile requests begin from the current value, including during a return. Invalid options, unsupported views and known unsupported smile composition preserve the old action and its resources. Constructor failure rolls back only newly registered instances.

The optional layer runs after existing expression, viseme and facial-idle contributors. It adds the same amount to `mouthSmileLeft` and `mouthSmileRight`, with an authored peak of 0.18. It reads the current accumulated prefix and limits only its own addition to the remaining 0.35 corner budget. It never subtracts an existing expression; a pre-existing total above 0.35 remains above 0.35 with no new addition. Missing smile targets, a changed own weight or a later declared smile writer decline this optional contribution. The neutral action remains available without smile targets.

The old gaze ownership releases immediately on explicit Release or a newer gaze command. The old pose and smile return over the existing 0.3 seconds. Here, speech supersession means explicit gaze cues such as `markTurnEnd` or `markFilledPause`. Ordinary `Avatar.say`, viseme activity and `setConversationState('speaking')` do **not** invalidate the hold. Supplied speech timing can therefore run concurrently with attention. The misleading VisemeLayer comment about ExpressionLayer reading `shared.speaking` is corrected; runtime expression behavior is unchanged.

A proved pre-existing timing-layer freeze would also freeze the new smile: disabling `attentionControl` prevented both natural and manual release from advancing. The fix retires its owner on a disabled frame and rejects new starts while it is disabled. Re-enabling does not resurrect the old action. Reset, bind, helper removal, disposal and immediate cancel also relinquish the cue. The stack owns the physical return on its next commit.

## Recorded evidence

Local gallery: [`captures/smile-integration-2026-09-13/gallery/review.html`](../captures/smile-integration-2026-09-13/gallery/review.html). In the dev preview, open `/@fs/Users/robault/GitHub/sugata-avatar/captures/smile-integration-2026-09-13/gallery/review.html`. Local captures are ignored evidence, not an off-machine backup.

| Check | Result and limit |
| --- | --- |
| Existing root attention gate | Nine ownership groups pass. |
| New root optional-smile gate | Twelve groups pass, including repeat continuity, invalid requests, budget/viseme composition, retirement and the disabled-control regression. |
| Independent source critic | Eleven broader groups plus focused disabled-layer controls pass on the final core source. The saved red proves the freeze before the fix; two alternatives are retained. Includes 240 exact default control/head/spine frames and 270 fresh-envelope frames. CPU evidence is not visual acceptance. |
| Reproduce selected study | Two fresh actual Showcase g050/bob02 runs, 270 steps/4.5 seconds each, fifteen PNGs and states per arm. Thirty matched saved states preserve every old actual morph, physical, gaze, affect, pose and camera field exactly. One diagnostic cue value at step204 becomes zero instead of 1.199e-16. Eighty-two source/helper/artifact hashes verified. |
| Actual speech and mixed expression | Six fresh runs: neutral, joy and sad, each with neutral/optional attention. 270 steps and ten PNG/state samples per run. Four sampled peaks explicitly verify `speaking=true`, exclusive native viseme ownership, committed weights and actual body morph weights: aa=0.6, PP=0.9, FF=0.9, U=0.6. These are silent animations from a supplied timeline; no TTS/audio synchronization claim. |
| Paired speech controls | Thirty pairs match in recorded clocks, non-smile action fields, eye output/shared gaze, affect, every OVR contribution/commit, all bones, non-corner body weights and physical hair/head/camera. Added smile matches its budget. 142 source/helper/artifact hashes verified. |
| Real controls and PNG export | Fifteen focused UI groups pass across chin-bob Wardrobe studies, long-bob Portrait with reduced motion, and a fresh live Wardrobe page. Repeats, local range errors, release, pause, narrow layout and settings are checked. Real live PNG encoding freezes action/point/corners/hair/clock, disables both look buttons, then resumes the prior motion. Three clean native retirements. |

The smile target names do not imply that all non-mouth geometry stays fixed. The g050 GLB also carries small authored smile deltas on brows and lashes. At 0.18, the maximum local displacement per individual smile channel is about 0.0673 mm on the brow and 0.0441 mm on the lashes; both channels combine, so these are not bilateral totals or posed screen measurements. Cornea, eye globe, teeth and tongue have no smile targets. Paired speech controls exclude affected card weights/positions and retain their actual recorded values. Their skeleton matrices still match. See `smile-geometry.json` and its sparse-accessor reader.

The root views the integrated quiet pair, four corrected speech peaks, joy/sad PP pairs and the actual long-bob UI through retained resized JPEG viewing copies. An independent critic inspects thirteen separately retained sampled images and supports the optional direction. Original PNGs remain authoritative. Neither set of still reviews establishes continuous perception or population-level expression recognition.

## Corrections retained with the evidence

- The first new CPU fixture reused a layer name; the unique-name contract rejected it. Renaming that fixture made the check meaningful; product code was unchanged for this correction.
- The first strict study comparison rejected a numerical-zero diagnostic difference at step204. Actual recorded morph and physical fields remain exact; only the cue diagnostic uses a 1e-12 comparison tolerance.
- `speech-v1` is incomplete and is not speech qualification. It used the unsupported label `sadness` instead of `sad`. Earlier saved moments fell after the capped 200 ms viseme windows and have `speaking=false`. The corrected `speech-v2` captures asserted peaks at 0.8, 1.3, 1.8 and 2.3 seconds. All five first-run Avatar retirements were clean.
- The first paired speech comparator incorrectly required unaffected brow/lash position hashes. The actual GLB proves those smile deltas exist. The corrected comparison states the affected geometry explicitly. The first GLB reader rejected sparse accessors; the retained corrected reader applies their overrides.
- The first UI probe inadvertently returned the whole Portrait Avatar graph to Playwright and failed serialization after seven Showcase groups. The corrected probe stores that object in the page without returning it. Both first-run owners retired cleanly. Product code was unchanged for this correction.

## Remaining direction

Preserve this optional authored action and return effort to visible character and clothing finish: coherent necklines, skin/face detail, remaining hair strips, and attractive representative complete identities/outfits. The current character remains a g050 study; this work does not qualify other bodies or broad cameras. The original Stellar Blade / AAA ambition and humanlike intent-matched performance remain in [PRODUCT-ROADMAP.md](PRODUCT-ROADMAP.md).

For each actionable critique, retain a proved example and two alternatives. Do not infer that an explicit smile should automatically change PAD or that speech samples establish complete conversation quality. The source and visual critic reports, rejected controls, capture helpers and hashes remain with the local archive.

## Checkpoint and retrieval

The local archive has **416 files / 102,529,385 bytes**, copied and reread with SHA-256 verification. The tracked [ledger](evidence/smile-integration-2026-09-13.json), [manifest](evidence/smile-integration-2026-09-13.manifest.json) and [preview record](evidence/smile-integration-2026-09-13.preview.json) retain the current source and evidence boundary. Manifest SHA-256: `7793da3c186f5841c9da67fb5f1c3af98a9da6d3f450a58e8a8edbb9174a5a4b`.

The gallery checks all 45 paired selectable moments and its 390 px layout. Catalogue 92 assertions, four preset groups and the all-page build pass; the build retains its existing large-chunk warning. Captured pre-UI source is frozen separately and matches its original capture hashes. Later page controls and the comment-only speech clarification are recorded by the final ledger. The runtime was not modified to satisfy failed capture assumptions.
