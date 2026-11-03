# Browser connection diagnosis — October31

**Latest controlled reopen/load test:** Robert requested testing his Safari first-load timing observation before moving chats. One fresh IAB tab loaded and reported its first render in507ms; DOM confirmed the reference image complete, renderer ready and no page error. Follow-up HTTP assets returned200 in23–36ms. The original retained handle still failed in the same turn. [Exact comparison and warm-load limits](BROWSER-DEBUG-REPORT.md#roberts-delayed-load-reopen-hypothesis--fresh-tab-succeeds-old-handle-still-fails). Current handle `emberLoadingReview`; next is one same-handle read on the next message. Four screenshots used, two remain; no more connection screenshots needed. Timer/avatar work remain PAUSED.

**Latest post-idle result: unchanged failure.** At 20:58:06.947Z on October31, the same `emberReattachedReview.getAXState()` returned the same error, 1h21m21.584s after the failed pre-idle check. No refresh/rebind/reset or extra browser operation. [Comparison and limits](BROWSER-DEBUG-REPORT.md#post-idle-check--unchanged-failure). Idle did not restore access; an exact timeout cannot be inferred from two failed states. Timer/avatar work remain PAUSED.

**Latest pre-idle check: fresh-tab continuity failed.** At 19:36:45.363Z on October31, `emberReattachedReview.getAXState()` failed on the first next turn, before Robert's planned hour away. [Evidence and idle-test limits](BROWSER-DEBUG-REPORT.md#pre-idle-test--failed-before-the-planned-hour-away). No further browser operation followed. Leave connection state untouched, timer/avatar work paused, and await Robert's return. The planned hour cannot explain a failure already present; shorter timeout versus turn-boundary fault remains unresolved.

**Latest: fresh tab works after Robert's panel reattachment.** The old handle still failed, but logs showed that tab had been closed. Current inventory yielded a new tab; binding it through the same selected browser restored both DOM and normal CUA accessibility reads, plus handoff. Retained handle is `emberReattachedReview`; next is one ordinary-turn live read. [Exact result and long-session uncertainty](BROWSER-DEBUG-REPORT.md#latest-result-after-robert-reopened-the-panel). No tool reset, new chat, screenshot or avatar edit. Timer/avatar work remain PAUSED. Conversation length is not established as the cause.

**Latest human pause and deeper diagnosis:** Robert paused the timer and authorized connection debugging. [Focused debug report](BROWSER-DEBUG-REPORT.md) and `browser-deep-diagnostic.json` supersede the unresolved-cause summary below: app logs now identify a session-route/registration guard failure before operational page binding. The exact failing registry condition is still unproved. Supported app-panel opening returned queued; one follow-up read still failed. Await the requested normal sidebar/browser-panel reattachment, then one page-state check. No reset, new capture, avatar edit or app patch. Timer PAUSED; no automatic avatar resume.

## First continuation after app update — failed again

Robert explicitly resumed work and reported resuming the timer. The first `emberAfterUpdate.getAXState()` on that next turn failed with `browser.user is unavailable`. One inventory read still identifies the in-app browser as ID2, MCP Apps as ID1 and Chrome as ID3. The IAB identity is unchanged from the successful post-update turn; no numeric-route switch explains this recurrence. No fresh binding, reset, screenshot, native fallback or candidate change followed. Exact record: `post-update-cross-turn-failure.json`.

The update/restart restored within-turn access but did not establish cross-turn continuity. The repeated boundary suggests a browser-control session/lifecycle issue; its underlying cause remains unproved. Stop unchanged retries until a distinct repair direction or changed connection state. One isolated ocular correction and Robert's complete feature targets remain pending. Candidate JS hash is unchanged; three v001 screenshots exist, three remain under the cap. No live owned fitting/native/render job was found; the retained Vite process is PID989. Existing unrelated processes were left alone.

Timer readback is now **ACTIVE**, ten-minute cadence, matching Robert's explicit resume. Keep it active and quiet on this unchanged blocker; do not spend each heartbeat repeating the same failed check. No additional avatar permission is needed once a supported review path works.

## After Robert's app update and restart — live control restored, persistence pending

Robert reported applying the update and restarting, then explicitly requested a connection check. The current IAB inventory contains one restored tab at the older `ember-facebuilder.html` URL (current browser2/tab1; these IDs are observations, not permanent routing identities). The appearance URL was therefore initially absent, rather than returning the previous `browser.user` failure. Root bound the observed tab through symbolic `iab`, read its actual accessibility tree, navigated that same tab to `http://127.0.0.1:5173/ember-appearance-v001.html`, and read the current rendered frame report. Clicking the read-only report produced the expected accessibility focus. Screenshot and `markHandoff()` both succeeded. No tool-session reset, native fallback, permission change or server restart was used.

The retained CUA handle is `emberAfterUpdate`. Reuse it for one live page-state read on the next normal turn; cross-turn persistence is still unverified. This is evidence of current control after the update, not proof that the update fixed the underlying cause. Do not repeat resets if the same failure returns.

`after-app-update.jpg` is the third appearance-v001 screenshot (SHA256 `41223f872d9d869b7304071e6e43e9fa7a76ca483161dcbfa9e46f5fe4954cdb`), leaving at most three of six. It shows the unchanged front/reference-smile/warm frame, draw1, headYaw0 and both smile weights0.3409697180754864. Candidate JS remains `fc486085da779ae74f2e33f501349b678a97551c59187a99a583829c18984af0`. No avatar edit, appearance acceptance or additional candidate review occurred. Reuse the existing baseline for the planned single ocular correction after continuity is checked.

Read-only automation-file inspection after restart found the ten-minute timer **PAUSED**. Its cause was not established. Root left that setting unchanged; no timer update or reactivation was performed during this connection check. Earlier ACTIVE statements are historical with respect to the current timer setting.

## Historical cross-turn failure before the app update

**Cross-turn verification FAILED on the next heartbeat.** The existing handle and a fresh symbolic `iab`+URL binding both returned `browser.user is unavailable`. Current inventory still maps ID1 to Chrome and ID3 to the in-app browser, unchanged since the successful repair. The numeric mismatch was real, but correcting it was insufficient to explain or resolve the recurring problem. The prior success only established within-turn access. Do not describe the connection as stable or the root cause as fully diagnosed. No further reset/retry or candidate work followed; exact record: `browser-cross-turn-failure.json`.

Status: a concrete stale-browser-identity mismatch was found and corrected through supported APIs. Live input, accessibility reads, screenshot and handoff now work. Cross-turn persistence still needs the next normal continuation; do not promise a permanent product-level fix from one session.

## Observed failure and cause boundary

Before resetting the tool session, a handle obtained with numeric browser ID1 could list the Ember tab, but `tabs.get(5)` failed with `browser.user is unavailable` before a tab binding existed. The candidate itself was not executing a failing command. The local HTTP route continued to return200.

Robert explicitly requested diagnosis and stable reconnection, authorizing this bounded repair beyond prior quiet recovery polling. Root read the supplied browser-troubleshooting guidance, tested the selected documented API, and performed exactly one `cua_repl.js_reset`. This resets tool variables/handles, not the user's tab, browser permissions, app, Vite process or avatar files.

After reset, old numeric browser1/tab5 was not found. `cua.listTabs({browser:'iab'})` resolved the actual in-app browser as **ID3** and listed the same provider tab. `cua.listBrowsers()` confirmed **ID1 is Chrome**, ID2 MCP Apps, ID3 the in-app browser. Reusing the persisted numeric ID1 was therefore wrong in the current inventory. The prior cached handle/metadata and current native registration disagreed. That mismatch explains the observed routing failure; the event that changed registration/order is not established. No claim that every historical outage has the identical cause.

Working bind: `cua.getTab({url:'http://127.0.0.1:5173/ember-appearance-v001.html'}, {browser:'iab'})`. It returned the live page immediately. A click in the visible read-only report was verified by AX focus changing to that text area. Screenshot succeeded, `markHandoff()` succeeded, and a later full AX read still worked. No avatar controls, source, pose, lighting, geometry or material were changed by this connection test. No app restart/reinstall, settings expansion, browser source patch, private transport, CDP bypass or native ChatGPT fallback was used.

## Durable routing rule

- Use the documented symbolic browser identity `iab` and the observed page URL to recover this review surface after a tool reset or stale binding. Resolve the current numeric ID from that inventory; do not preserve ID1 as an invariant in receipts/prompts.
- Reuse the valid browser/tab binding within the session. Missing/stale tabs are not permission to switch browser families.
- Verify actual AX/DOM access before a capture; successful tab listing alone is insufficient.
- If binding fails again with the correct symbolic route, collect the exact failure and current inventory once. Do not loop resets, fall back to denied native app control or alter security settings. Cross-turn verification is still outstanding.

## Preserved evidence and next work

`front-reference-recovery.jpg` is the actual reference-smile view at draw6, warm light, headYaw0, both smile weights0.3409697180754864. Root inspected it. Together with `connection-check.jpg`, there are now **two** appearance-v001 screenshots, leaving at most **four** under that version's original six-capture budget. This connection witness improves the prior head/neutral-expression limitation; it does not accept likeness/finish or qualify the renderer. Reuse it as the baseline for the nominated ocular correction.

Candidate JS remains SHA256 `fc486085da779ae74f2e33f501349b678a97551c59187a99a583829c18984af0`. Oral defects and all human feature corrections remain recorded. The active next avatar task is the single isolated ocular-material correction from `HUMAN-CORRECTIONS.md`, with independent/root review. No additional human go-ahead is required by this repair; Robert already supplied direction and asked to restore continuation.
