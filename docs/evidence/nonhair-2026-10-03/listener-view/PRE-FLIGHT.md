# Independent listener-view preflight

The experiment is worth doing as a current recipe/action viewing-guide decision, not another isolated still gaze preference. Read the full plan/instrument, actual AttentionAction implementation and showcase attention/animation handlers. The initial reviewed instrument SHA256 is `67fdef8864c613cefa7935935482560127ed56521fb19300771f0bc4e5d91836`. No critic browser/native job ran.

Actual input is the accepted chin-length Sage/lavender JSON; opening through the existing input and the pre-registered navigation waiter follows the supported owner reload. Reduced-motion pauses the real page, and the existing Resume button is necessary. The source neutral action is camera-sampled attention, not continuous tracking or guaranteed perceptual eye contact. Ordinary animation clamps delta to .05s; wall-time sample offsets need not equal the attention clock.

## Blocking observer findings before execution

1. Instrument lines22–26/39–41 contain unbounded browser/context/page setup, evaluation, disposal/close and video completion. Fixed120s navigation/ready waits and entry-only checks do not enforce the declared14:45 stop if an await stalls near it. Alternative A: independently bound setup, the whole observation and cleanup/video completion with remaining-deadline checks, retaining partial state on timeout. This honors one finite packet with some scheduling overhead. Alternative B: close the packet unrun; no observational result but no deadline overrun. Choose A before any execution.

2. Line35 checks `report.errors` before the final cleanup; line42 changes status only if the local `error` variable exists. Late console/page errors append to the array without necessarily setting that variable, allowing `observed`/exit0 with errors. Alternative A: after cleanup, require the final error array empty, expected observations complete, resources closed and pins/deadline valid, promoting any failure to exit failure. This gives a reliable receipt. Alternative B: preserve a partial/unqualified observation without success admission. Choose A before execution.

## Manual return needs a direct state witness

AttentionAction cancels into `releasing`, resets its cue time, and fades over .3s; automatic release starts2.6s and retirement occurs3.4s. The instrument records nominal2.2s Release, but screenshot overhead and live animation can move actual times. A pre-click `attending` state does not by itself prove the handler still invoked manual release before expiration.

Alternative A: retain/assert actual post-click `releasing` state and elapsed source clock, with the pre-click state and ordinary timing; allow screenshots to remain observational. This supports the manual entry/return decision without a phase or pixel oracle, though a slow observer may refuse a valid action. Alternative B: if only idle is observed, label manual-vs-automatic return ambiguous and decline that curation claim. Do not repair timing, freeze clocks, search phases or repeat the sequence.

The source has existing action guards and Release ownership; the proposed sequence should compare actual face/eye readability and useful return in the current composition. Source/cue arithmetic is not a human intent or natural-motion pass. Original-image and optional actually reviewed video evidence must decide the viewing guide. Initial source is refused until the blocking corrections are read back. No product, cue, material, asset or parameter change is requested.

## Corrected-source admission

Full corrected source read at14:32:57 UTC, SHA256 `7b79c2ffc72b1c652f5e8416ddf38c1f028961774169a39f57e0f6e6faad74d4`. Admit the sole packet. The entire setup/observation is now bounded to20s before the stop; retirement, each resource close and video-path completion have independent5s bounds. A late cleanup overrun cannot produce accepted status because the final deadline/error gate refuses it. The observation remains ordinary live UI with no private clock, cue or phase modification.

The final error array now forces failed status and exit failure; completed old/new Avatar retirement receipts require disposed/no leaks and exactly one navigation retirement. Actual Release is admitted only with post-click releasing/no-hold state, rather than relying on a pre-click snapshot. This resolves the source findings for the one observational sequence. Preserve partial observations on failure; no repair/retry. Actual originals must still establish readability and guide value.
