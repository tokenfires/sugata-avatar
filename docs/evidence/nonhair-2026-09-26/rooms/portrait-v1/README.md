# Portrait native room chooser — focused gate

The [report](report.json) passes eight focused groups across four fresh browser contexts:
bob02 and bob01 at desktop 1440×1000 and mobile 390×844. Mobile explicitly requests reduced
motion and starts paused. The test uses the normal Portrait buttons and the native Avatar path;
it never sets a lighting override or changes a production source, asset or hair material.

The helper is [portrait-probe.mjs](../portrait-probe.mjs). It pins 310 selected files: its own
instrument, Portrait and shared viewer files, core, assets and package metadata. Active parallel
Wardrobe page files are excluded. All selected source hashes stayed exact throughout this gate,
and all sixteen saved PNG hashes were independently reread afterward.

## Observed behavior

- Each case navigates **Studio → Kitchen → Studio** through real Enter/Space activation. URL
  hair, bake and capture values survive. Native absolute exposure reads **0.85 → 2.04 → 0.85**.
  Kitchen is the pressed Room button and hides Light; returning Studio restores the fieldset.
- Before leaving Studio, the test applies Warm, advances real motion, and starts attention.
  Kitchen and the returned Studio begin at clock zero, with zero target/PAD, no selected expression,
  idle attention and exactly matching initial body bones/morphs and identity/hair.
- Eight activations of an already selected room preserve the document identifier, simulation
  clock, affect target and camera. They do not reload.
- Focused Kitchen scenarios exercise desktop bob02/Warm and reduced-motion mobile bob01/Determined.
  Mood input, gradual Ease to neutral, Look and explicit Release, Pause/Resume, actual pointer orbit
  and Reset view all work after the new page loads. Native exposure remains unchanged.
- A duplicated scene URL shows the explicit error before Avatar creation, hides loading and reports
  Portrait unavailable. Four ordinary navigation cases record zero page, console, request and HTTP
  errors. This is a focused gate rather than a broad scene/API suite.

## Rendering and lifecycle evidence

Eight neutral scene views each save both a canvas PNG and a full UI PNG. Before each view, the test
allows four animation-frame projection updates plus **64 zero-delta native draws**; native motion
time remains zero. The measured neutral head/crown support stays inside the canvas in both rooms.
The limiting mobile gutter is 16 CSS pixels for both bobs; no horizontal page overflow is observed.
Long lower hair tails remain outside the head-region fit's stated scope.

After the production pagehide handler, a separate observer records the actual retirement into
sessionStorage. All eight observed navigations report `persisted:false`, disposed owners, zero
renderer counters and no leaked handles. Each of the four final pages also has an actual manual
retirement with the same clean result. No bfcache retention occurred in this run; the instrument
would record a persisted owner rather than invent its disposal. Browser and probe server are closed.

The author inspected six actual canvas renders and two full UI images, including both hair presets
on mobile and both rooms. Neutral heads are visible within the viewport. Kitchen shows its warm
room background and stronger directional face lighting; the Room selection is visible and Light
is absent. Reduced-motion mobile correctly shows Resume motion and disabled attention controls
until resumed. Existing hair-card artifacts remain visible and were not part of this change.
Independent visual critique is recorded separately by the critic.

Reproduce into a new directory while holding the serial GPU slot:

```sh
node docs/evidence/nonhair-2026-09-26/rooms/portrait-probe.mjs FRESH_OUTPUT
```
