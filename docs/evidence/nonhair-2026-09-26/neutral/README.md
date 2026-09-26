# Portrait expression release — September 26, 2026

Portrait now has **Ease to neutral** below its four expression choices. It clears the selected
choice and pushes a zero affect target through the existing public `Avatar.feel` path. The
emotion and mood continue on their existing clocks. Camera, lighting, current attention and
pause state are preserved. A short status describes gradual release; when paused, it asks the
viewer to resume motion. It does not describe the result as a fresh neutral baseline.

The production change is limited to `packages/testbed/src/portrait.js` and `portrait.html` on
top of framing commit `99fb8d065c4a6915bf624a60012cc90f5748fa27`. All four existing expression
targets and the responsive framing remain unchanged. No core, cue, asset or hair changes are
part of this slice. The page only exposes PAD-vector choices; this action is not a new contract
for clearing externally injected named emotion triggers.

Two alternatives were considered: the small review release (selected), or a new isolated
comparison of moderate expression-owned eye-opening attenuation for Determined. The latter
remains an unperformed expressive study; this UI change does not resolve determination or the
historical Curious/Determined readability limit.

## Native check

The [focused driver](probe.mjs) uses the actual Portrait page, real WebGPU rendering and native
keyboard/click events. Run it only with an available serial GPU slot:

```sh
node docs/evidence/nonhair-2026-09-26/neutral/probe.mjs <new-output-directory>
```

The [first native run](native-v1/report.json) passes five groups across two fresh pages:

- Desktop Warm, followed by neutral attention: Tab/Enter activates the new action. Only the
  affect target and button selection change immediately. PAD, emotion, mood, clock, camera,
  framing, lighting and the exact owned attention hold are unchanged before a motion step.
- Samples after 0.5 and 2.5 seconds demonstrate the existing gradual release. Warm pleasure
  decreases from 0.711333 to 0.571016 and 0.237602. The smile prescription remains at its 0.35
  cap at 0.5 seconds and falls to 0.166321 at 2.5 seconds; neither sample is asserted neutral.
- At 390px with reduced motion, keyboard Space selects Determined while paused. After explicit
  resume and a 2.5-second hold, pause and Space on **Ease to neutral** set a zero target without
  advancing PAD or motion time. Three requested 0.5-second manual steps remain frozen.
- Explicit resume advances release. After 2.5 seconds, Determined arousal decreases from
  0.408332 to 0.135843 and dominance from 0.858330 to 0.283980. Camera and lighting remain exact.
  The mobile page has no horizontal overflow, and the new button measures 343.2 by 46.5px.
- Both Avatar retirements report no leaked handles. Recorded page, console, failed-request and
  HTTP error lists are empty. Selected source/asset/helper hashes are stable across the run.

Six original canvas PNGs and six matching full-page UI PNGs have hashes in the report. The
author inspected the desktop Warm UI, the later desktop canvas and the paused mobile UI:
the full-width release sits directly below expression choices, its keyboard focus is clear,
and the paused note is readable without horizontal clipping. The ordinary face retains
residual expression as expected. These stills qualify visible controls and selected state
transitions, not continuous perception, emotion recognition or general rendering quality.
Independent source/render critique is requested separately before integration.

`node --check` passes for the page and driver. `git diff --check` passes for the two-page change.
`npm run build:pages` succeeds, retaining the existing warning about chunks larger than 500kB.
