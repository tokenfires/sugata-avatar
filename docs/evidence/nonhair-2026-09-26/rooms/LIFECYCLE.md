# Retained-page navigation restoration: reproduced and corrected

The [baseline](lifecycle-baseline/report.json) reproduces the handler defect on actual native
Portrait and Wardrobe pages. Their Room handlers disable controls and display Preparing room/scene,
but the old persisted pageshow path leaves that UI disabled. The same Avatar remains alive.

This is a **controlled handler fixture, not actual browser back-forward-cache admission**. The
real Room click requests Kitchen; an HTTP 204 response retains the current document. The probe
then dispatches explicit `PageTransitionEvent` pagehide/pageshow events with `persisted:true`.
Each intercepted 204 navigation produces one recorded `net::ERR_ABORTED` request event in Chromium,
kept separately as fixture transport evidence. It does not produce an error page. Unexpected page,
console, request and HTTP errors are empty. Earlier ordinary navigation evidence had actual
`persisted:false` events and does not establish the browser's persisted path.

## Baseline and focused regression

| Case | Baseline | Fixed |
| --- | --- | --- |
| Portrait captured, unpaused | Seven controls disabled; Preparing room remains | Controls ready; Live portrait; zero page animation loops |
| Portrait live, reduced-motion paused | Seven controls disabled; Preparing room remains | Controls ready; paused state retained; one page animation loop |
| Wardrobe captured, unpaused | Fourteen controls disabled; Preparing the scene remains | Controls ready; Live view; zero page animation loops |
| Wardrobe live, reduced-motion paused | Fourteen controls disabled; Preparing the scene remains | Controls ready; paused state retained; one page animation loop |
| Portrait live, running | Added focused regression | Controls ready; same owner/view; clock preserved during atomic hide/show and subsequently advances with one loop |

The root's fix is tested by [lifecycle-fixed](lifecycle-fixed/report.json). Exact original Avatar
reference, document identifier, identity, camera and paused state survive the controlled restore.
Renderer memory counters are unchanged across restore in all nine baseline/fixed cases; the
owner is not disposed. Existing attention is canceled cleanly. Captured pages retain no animation
loop, and live pages retain exactly one after two valid hide/show cycles. The counter wraps native
requestAnimationFrame/cancelAnimationFrame without changing scheduling and counts the page's
named `animate` callback separately from probe callbacks.

The regression also holds a real native File's `text()` promise during actual `showcase.openLook`.
Synthetic persisted restore preserves this **non-navigation busy state**: settings controls stay
disabled, status remains Reading settings, and configuration export still rejects as busy. Resolving
the file to unsupported `{}` finishes with the ordinary Settings not opened message, retains the
current look and re-enables controls. The restore does not erase an unrelated async operation.

One subsequent **ordinary, un-intercepted** Portrait → Kitchen navigation verifies the changed
source's normal path: new owner/document, fresh clock zero, retained identity/bob02, native absolute
exposure 2.04 and hidden Light controls. Its actual old pagehide is recorded independently; the
nonpersisted old owner retires cleanly. This browser check uses the Vite source path, not the built
production bundle. The root's separate build result remains a separate claim.

All final manual retirements report disposed owners, zero renderer memory counters, no leaked
handles and no pending page animation callback. Both probe browser/server pairs are closed and
the GPU slot was released.

## Evidence integrity and limits

[Independent verification](lifecycle-verification.json) rereads sixteen frozen source/input files
per run and all eighteen before/restored PNG hashes. Selected sources were stable within each run.
The baseline's original helper is preserved in its source snapshot; the current helper adds the
running, non-navigation-busy and ordinary-forward regression cases. The author inspected the actual
Portrait restored baseline/fixed UI images: the same portrait remains while disabled controls and
stale attention/status labels become usable and current.

No claim is made about actual BFcache eligibility, eviction, every browser, every retained async
operation or pixel-identical rendering. No asset, hair or production-source change was made by the
probe author. The parent owns the production fix and independent critic disposition.

```sh
node docs/evidence/nonhair-2026-09-26/rooms/lifecycle-probe.mjs FRESH_OUTPUT fixed
```
