# Browser control between-turn failure — focused diagnosis

**Current operational rule:** Robert explicitly adopted the [fresh-tab workaround](../../BROWSER-WORKFLOW.md), will close stale tabs manually, and resumed Ember construction. [Ocular v002](../ember-2026-10-31-ocular-v002/README.md) has now been rendered/reviewed. Stable cross-turn connection retention is not a prerequisite to progress. Earlier diagnostic stop instructions below are historical; the exact app defect remains unresolved.

## Full MacBook restart — next-message failure; Robert resumes work

Robert explicitly resumed Ember work on his next message. At **2026-10-31T21:35:21.985Z**, the first unchanged `emberAfterMacRestart.getAXState()` returned **`browser.user is unavailable`**. No refresh, rebind, reset, inventory, capture or candidate edit followed. The full restart therefore restored within-turn access but did not establish continuity across messages. Its exact cause remains unresolved; do not infer that conversation length is proved responsible.

Resume authorization is in force and the recovery timer is ACTIVE, with its stale pause instructions replaced through the app API. Visual work is blocked by unavailable control; it is not awaiting another blanket go-ahead. Retain the one nominated ocular correction, all human feature targets and the full avatar roadmap. No new material candidate while rendering cannot be reviewed. Keep unchanged recovery wakes quiet without retries. The previously requested fresh-chat two-message comparison remains the next useful connection diagnostic. Four captures used, two remain; no connection screenshot needed.

## Full MacBook restart — initial live control succeeds; next-turn test pending

Robert reported completing a full MacBook restart and explicitly requested another connection check. At **2026-10-31T21:33:31.702Z**, the existing appearance page was readable through a newly initialized CUA session: observed IAB2/tab1, provider `browser-use:8e36471c-aa2e-4882-85e3-1cf1808e1863`. Binding the observed tab through symbolic `iab` returned the complete live accessibility tree and unchanged frozen candidate report. Clicking the read-only report field succeeded; a subsequent accessibility read confirmed focus there, and `markHandoff()` succeeded. The page returned HTTP200 in15ms and the saved automation status read back **PAUSED**.

Retain top-level handle **`emberAfterMacRestart`** for the first page-state read on the next ordinary user message. Do not refresh, rebind or reset before that comparison. This proves current within-turn read/input access only; the earlier defect occurred between messages, so restart recovery is not yet established as stable. No reload, new tab, screenshot, candidate edit or avatar job was performed. Four appearance captures remain used, two remain available. Ember construction and the timer stay PAUSED.

## Reopened, fully loaded tab — next-turn check failed

On Robert's next message, **2026-10-31T21:08:05.461Z**, the unchanged top-level handle `emberLoadingReview.getAXState()` returned `browser.user is unavailable`. No reload, rebind, reset or additional browser operation was attempted. This is the same tab that reported a completed render and loaded reference image in the previous turn. Therefore waiting for page readiness and reopening did not establish continuity across messages. No new screenshot or avatar edit; four captures used, two remain. Timer/avatar work remain PAUSED. The requested fresh-chat comparison is now the next discriminating test; initial success there must also be followed by a same-handle test on another message.

## Robert's delayed-load/reopen hypothesis — fresh tab succeeds, old handle still fails

Before moving chats, Robert reported that Safari initially showed missing images but loaded them on reopening, and requested a bounded reopen/readiness test. The current IAB inventory still contained the original appearance tab2. Exactly one supported `createBrowserTab('iab', appearanceUrl, {visible:true})` created tab3. Its initial AX result already contained the completed first-render report after **507ms**, at **2026-10-31T21:04:46.460Z**. No additional four-second readiness wait was necessary because the completed render was already reported.

Read-only DOM verification subsequently confirmed `document.readyState=complete`, `body.dataset.ready=true`, no page error, the reference image complete at1024x1024, and the512x512 render canvas. The original `emberReattachedReview` still returned `browser.user is unavailable` in that same turn while the fresh page was readable. The original tab was present in the pre-test inventory, so this comparison is not simply an already-closed old tab.

One follow-up local HTTP pass returned200 for the page(26.4ms), transformed JS(23.2ms), reference PNG(27.1ms,1,213,961bytes) and frozen GLB(35.5ms,11,568,232bytes). These are warm/follow-up observations, not a cold Safari startup measurement. They do not reproduce or disprove Robert's Safari observation. They do show that server delay alone does not explain the simultaneous working fresh page and failed retained control handle in this test.

One temporary test binding declared inside a try block was not retained for the next tool cell. That instrumentation error was corrected by binding the already-created tab3 to a top-level `let`; no second reopen was performed. Current supported CUA handle: **`emberLoadingReview`**. Its page read and handoff succeeded. Next useful check is this same handle on the next ordinary message, before declaring continuity fixed. No app restart, tool reset, setting change or avatar edit.

`reopen-loading-check.jpg` is one viewport witness of the loaded reference page; the canvas is mostly below the viewport, so it is not a new full-avatar appearance plate. Root inspected it. Appearance-v001 now has **four screenshots used, two remaining** under its original six-capture cap. No further screenshots are needed for connection continuity. Keep timer/avatar work PAUSED. Fresh-chat comparison remains available if needed; its prompt should be read together with this newest result.

## Fresh-chat comparison requested — checkpoint preserved

Robert requested a continuation prompt for a fresh-chat test while keeping Ember and the timer paused. [Exact continuation prompt](FRESH-CHAT-PROMPT.md) specifies initial supported page/input verification and a same-handle check on the next user turn. No browser operation was performed in this handoff turn. Timer readback is PAUSED; candidate JS hash remains `fc486085da779ae74f2e33f501349b678a97551c59187a99a583829c18984af0`. The new chat should write `FRESH-CHAT-RESULT.md` without overwriting existing evidence. Initial success alone cannot establish that the old conversation caused the defect.

## Post-idle check — unchanged failure

Robert returned and requested the same connection check. At **2026-10-31T20:58:06.947Z**, the unchanged `emberReattachedReview.getAXState()` again returned `browser.user is unavailable`. The interval since the failed pre-idle check was **1 hour, 21 minutes, 21.584 seconds**. No refresh, rebind, reset, inventory query, navigation or screenshot was performed for this comparison.

The connection failed both before and after idle. Idle did not restore it; this experiment cannot establish a timeout threshold or show that idle caused the failure, because its starting state was already failed. No additional connection repair or avatar work was attempted. Keep the timer/avatar work paused; await further steering.

## Pre-idle test — failed before the planned hour away

Robert requested one check on this next message, then an untouched idle period of about an hour while he takes a break. At **2026-10-31T19:36:45.363Z**, the first `emberReattachedReview.getAXState()` after the successful fresh-tab turn again returned `browser.user is unavailable`. No inventory refresh, new binding, reset, screenshot, navigation or further browser operation followed. This fails cross-turn continuity even for the freshly reopened tab.

The failure predates the planned hour of idle. An hour-long idle period therefore cannot explain this already-observed failure. A shorter timeout and a turn-boundary/session-lifecycle problem remain possibilities; neither is established. There is no healthy pre-idle baseline for a clean timeout experiment. Leave the current handles/browser/server untouched and the timer/avatar work paused while Robert is away; no scheduled probe or new timer. After he returns, one same-handle check can report whether state changed over idle, without claiming it measures an exact timeout.

## Latest result after Robert reopened the panel

Robert confirmed the page visible, then asked whether the long-running session might contribute. The old retained handle still failed. New log evidence shows that its former tab was actually closed and a new tab created; obtaining the current tab from the same selected browser is therefore the correct next operation, rather than repeatedly using the former handle.

The current browser's documented `tabs.list()` returned tab2, provider ID `9b888443-8284-4582-9bc4-603b4521b541`, at the appearance URL. `emberDiagnosticBrowser.tabs.get('2')` followed by its documented DOM snapshot **succeeded**. The regular `cua.getTab('2', {browser:'2'})` accessibility interface also **succeeded**, and `markHandoff()` completed. Current CUA handle: **`emberReattachedReview`**. Direct documented DOM handle: **`emberReopenedTab`**. These numeric IDs are current observations only.

No tool-session reset, application restart, new chat, new screenshot or avatar edit was needed in this slice. This supports stale tab/session association as a contributor; it does not prove that conversation length caused the original failure, nor that the earlier app-registration guard defect is fully understood. Duration/retained tool state and conversation text length are different hypotheses. The smallest next test is one live read through `emberReattachedReview` on the next ordinary turn. Cross-turn stability remains unverified. Timer and avatar work remain PAUSED until Robert resumes them.

October 31, 2026. Robert paused the timer and explicitly requested deeper browser debugging. Avatar construction remains paused. Installed ChatGPT desktop version: **26.1027.30824, build 22943**. This report is local; nothing was sent to support or published.

## What is established

The immediate failure is in the desktop app's browser-session routing/registration path, before the tool can obtain an operational page handle. It is not established that Ember's renderer or the local server caused it. The review URL returns HTTP200 and the supported browser inventory still lists the correct Ember appearance tab.

The visible `browser.user is unavailable` error obscures a more specific logged error: **“No ChatGPT browser route is available for browser session”**, followed by this chat's ID. This occurred on the first continuation after the update and again during this diagnostic. Within the successful preceding turn, real page reads, input focus and screenshot capture worked.

The app log records release/backgrounding of the browser sidebar page and the end of browser-use activity at 18:23:33 UTC. Its next logged `getInfo` attempt at 18:40:58 UTC fails route preparation. The same failure recurs at 19:10:31 UTC. The sidebar ownership messages contain a provisional `client-new-thread` identity while the visible route points to the actual Sugata chat. That mismatch is a useful clue, not a proved complete cause.

Read-only inspection of the installed application's exact error site confirms that `getInfo` calls `prepareSessionRoute`, which rejects when `canServeSession` fails. That guard checks backend registration identity as well as the chat/window route. Consequently the message does **not** distinguish a missing route from an outdated backend registration. No private methods were invoked and no installed application files were modified.

## Bounded checks in this diagnostic

| Check | Result |
| --- | --- |
| Retained page accessibility read | Same `browser.user` error |
| Documented browser tab listing | Correct current Ember tab returned |
| Documented direct `tabs.get` alternative | Same error before a DOM read could occur |
| Local HTTP health check | 200 |
| App's supported open-browser-in-current-chat action | Queued rather than immediately attached |
| One page read after that action | Same error |

No reset loop, new avatar render/capture, material edit, source fitting, native ChatGPT fallback, raw socket/CDP call, permission expansion, app patch or server restart was used. Existing CUA browser handle: `emberDiagnosticBrowser`; existing page handle: `emberAfterUpdate`. The three appearance-v001 screenshots remain the entire used capture count. Frozen candidate JS remains `fc486085da779ae74f2e33f501349b678a97551c59187a99a583829c18984af0`.

## Smallest next recovery test

The supported app action could only queue the page-opening request. Robert was asked to select another chat, return to this chat through the sidebar, and open its Browser panel at `http://127.0.0.1:5173/ember-appearance-v001.html`. This tests whether normal app navigation re-establishes the chat-to-browser attachment. It does not change permissions or discard browsing data.

After Robert confirms the page is visible beside this chat, make one supported page-state read. If successful, test continuity on the next ordinary turn before claiming stability. If the same guard failure remains, preserve this focused reproduction for app support; another blind reset/restart is not justified. A supported external-browser review route is a possible separate alternative, with its own connection verification; it is not tested or selected by this report.

The timer remains PAUSED. Do not resume avatar construction or the timer merely because a connection check succeeds; follow Robert's subsequent steering.

## Evidence and escalation

`browser-deep-diagnostic.json` contains the bounded test results, installed version, selected log events and error-site references. The installed code and full app logs were read locally, not copied into this report. Existing capture and candidate files remain unchanged.

Official [browser documentation](https://learn.chatgpt.com/docs/browser) describes the chat-associated browser panel. Official [troubleshooting guidance](https://learn.chatgpt.com/docs/reference/troubleshooting#feedback-and-logs) documents the local app-log location and feedback flow. Neither establishes this exact failure's cause. If a report is submitted later, review its contents first and obtain explicit sending authorization; none has been sent here.
