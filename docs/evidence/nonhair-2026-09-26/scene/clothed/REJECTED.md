# Rejected capture instrument — not scene evidence

These eight images and their report are retained for diagnosis only. Although attachment and
browser-error checks passed, the new clothed extension had two faults:

- Copying showcase options also copied its explicit `lighting: studio`, overriding native kitchen
  lighting. The report shows exposure 0.85 and an inappropriate blue rim/floor.
- The existing frozen bald plate skips `Avatar.advanceFrame`. Newly attached dynamic cards therefore
  never rebuilt: solver steps 0, invalid history, unavailable native card frame. The images omit
  the intended complete groom.

The corrected extension removes only the copied lighting override and calls `advanceFrame(0)`
on frozen clothed steps, retaining the simulation clock and the old bald diagnostic behavior.
The driver now requires a completed native card rebuild/history, native kitchen exposure, an
actual environment bake, and a held simulation clock before saving a review plate.
No accepted hair asset, material, solver or runtime was changed. Use the subsequent
`clothed-clean` run for scene review if its readiness checks pass.
