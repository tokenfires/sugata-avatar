# Ember ocular correction v002 — partial improvement retained

October 31, 2026 (America/Los_Angeles); captured November 1 UTC. Robert explicitly adopted fresh-tab recovery, offered to close stale tabs manually, asked that the workflow be remembered/documented, and resumed Ember construction in this chat. This is one completed ocular slice toward the full character, not accepted likeness or finished eyes.

## Result and decision

Root and the independent critic inspected the actual v001 front reference smile, portrait2 and both new captures. **Retain v002 as a partial ocular correction:** broad rose sclera is replaced with off-white/light-gray sclera, while the irises still read predominantly dark with inadequate olive/amber detail. The visible outer iris/sclera boundary remains clear. Internal pupil/iris separation and fine limbal contrast are not visually qualified because the iris is too dark. There is no new visible skin/shape regression; source preservation independently confirms these inputs were unchanged.

- [Front reference smile, warm light](front-reference.jpg): matched 512-square canvas, fitted camera and smile weight `0.3409697180754864` against the saved [v001 witness](../ember-2026-10-31-appearance-v001/front-reference-recovery.jpg). Different browser viewport/layout; the new capture clips about 26 pixels at the top of the canvas, above the eye comparison. No retake was made.
- [Angled reference smile, neutral light](angle-neutral.jpg): smile weight `0.261196718093633`. Confirms dark iris appearance in a second condition; not a matched before/after plate.
- Live review: `http://127.0.0.1:5173/ember-appearance-v002.html`. Left at front/reference/warm, draw5, after restoring those display settings. No new screenshot during restoration.

## Exact isolated change

New files `packages/testbed/src/ember-appearance-v002.js` and `packages/testbed/ember-appearance-v002.html` preserve v001. `scleraChroma:0` disables the broad rose gain and keeps source texture detail; sclera brightness remains `1.1`. The existing masked hazel composition now uses `L*(1+0.8*(1-clamp(L,0,1)))`: monotone on [0,1], zero-preserving, with maximum gain 1.8. The original pupil/iris mask remains unchanged. This can affect the iris-side dark rim, so source math does not prove unchanged limbal contrast.

No geometry, camera, expression, lighting, skin, shared material module, source texture or default avatar was edited. No new identity solve, native build or oral diagnostic. Hair remains missing; Robert's cheek/chin/dimple/lid/brow/lash/lip/ear directions remain queued. Known mouth intersections remain unqualified and visible in the page's warning.

## Evidence and validation

Independent critic performed the prior worth decision, actual source-diff/syntax review and actual-image review. Root independently checked the same witnesses and agrees with the partial-retention decision. One candidate and two screenshots completed the bounded slice; no colour/exposure sweep or second candidate. Browser returned a completed first render in the navigation/read interval `2026-11-01T00:12:13.733Z–00:12:14.019Z`, with no reported rendering error. Saved AX reports record the actual states.

`node --check` and `git diff --check` passed. Both new source hashes match the independently reviewed source. All 10 inputs recorded by the v001 preflight rehash unchanged, including the original JS/HTML, frozen GLB, fit, source modules, portraits and lockfile. `preservation.json` records checks and final output hashes. Captures are the browser's original JPEG bytes, named `.jpg` after confirming format; no image alterations or extra captures occurred.

## Recovery and continuing work

[Adopted browser workflow](../../BROWSER-WORKFLOW.md) is saved separately and in Robert-requested persistent memory. The first fresh tab found `ERR_CONNECTION_REFUSED`: the local listener and launch service were absent. Root restored the existing `com.tokenfires.sugata-review` launch service with its unchanged configuration; loopback HTTP200 and the live page then succeeded. The browser tool disallowed its own data-URL network-error page, so that page was left untouched and the restored HTTP URL was opened directly. A failed initial declaration did not retain its binding; root bound the already-created successful tab rather than opening another for that instrumentation error. No permission change, private transport or native fallback occurred.

The original chat was idle before work. The existing ten-minute automation is actually **PAUSED** on readback despite its historical prompt saying ACTIVE; this slice did not change its schedule, destination or status. No new automation was created. No owned native/fitting job is live. Keep the review service running.

## One bounded next step

Preserve this off-white sclera improvement. Inspect the frozen eye texture and the existing UV/refraction mapping once to determine whether the intended iris annulus samples black pupil texels or correctly samples a very dark iris input. Read existing source/GLB only; no new gain sweep or global face fitting. Bound the attribution inspection to one source report, at most 60 seconds CPU, 512 MiB additional memory and 20 MiB outputs; stop if that budget cannot resolve the cause. Do not run a native renderer.

If the mapping/pupil footprint is wrong, correct that isolated relationship with an exact witness, preserving the source detail; this needs geometry/UV correspondence evidence. If sampling is correct, author one isolated lighter hazel iris input; this gives direct pigment control but needs its own texture and motion/refraction review. Neither cause is established by these two screenshots. A fresh visual budget belongs to that separately justified slice. Then continue the compact human-directed feature pass while preserving the consumed global-fitting contract and full character roadmap.
