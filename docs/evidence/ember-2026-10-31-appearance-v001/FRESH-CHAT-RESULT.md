# Fresh-chat browser comparison — same-handle next-turn failure reproduced

October 31, 2026. Connection diagnostics only. Ember construction and the ten-minute `advance-sugata-avatar-visual-quality` timer remain **PAUSED**. The timer's local status file was read back as `PAUSED`; no automation setting was changed.

## First turn

- Fresh chat/session: `01a193d1-c8bb-7e81-9b99-8e5a0f65e99d`.
- Supported CUA inventory resolved symbolic `iab` to browser ID `2`, “ChatGPT in-app browser”, with no tabs in this chat. Historical numeric IDs and handles were not reused.
- At **2026-10-31T21:16:39.640Z**, began one supported `cua.createBrowserTab('iab', appearanceUrl, {visible:true})` call. It opened `http://127.0.0.1:5173/ember-appearance-v001.html` and returned a live accessibility tree.
- Current tab ID: `1`; provider ID: `browser-use:6664cd0b-0321-40d9-93a5-14a5a86a48a6`; title: “Ember — skin and hazel eyes study”. These are observations, not permanent routing constants.
- Retained top-level CUA handle: **`emberFreshReview`** in the existing persistent `mcp__cua_repl` session. This handle was preserved unchanged for the next-message test below.
- A harmless click on accessibility element `26`, the read-only **Visible frame report**, succeeded. The subsequent `emberFreshReview.getAXState()` completed at **2026-10-31T21:16:44.142Z** and confirmed focus on that field. No text was entered.
- Observed page state: front reference 2 selected; Reference smile; warm light (`neutralLight:false`); `view:front`, `frame:reference`, `draws:1`, `headYaw:0`; frozen candidate hash `bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef`. Pose, lighting and avatar settings were not changed. This verifies live page access and input focus, not visual qualification.
- `emberFreshReview.markHandoff()` succeeded at **2026-10-31T21:16:44.143Z**, preserving the tab for the next turn. A subsequent supported `cua.listTabs({browser:'iab'})` confirmed the identity above.
- Errors: **none** in this initial browser test. No screenshot was taken.

## Next-message comparison — failed

Robert sent **“Check again.”** The first browser operation on that message was the unchanged handle's:

```javascript
await emberFreshReview.getAXState();
```

- Call began **2026-10-31T21:17:40.565Z** and failed at **2026-10-31T21:17:40.723Z**.
- Exact returned error: **`Error: browser.user is unavailable.`**
- No refresh, rebind, reset, navigation, inventory query or other browser operation preceded this retained-handle read on the second message.
- Exactly one supported `cua.getState()` inventory followed, begun at **2026-10-31T21:17:42.746Z**. It still listed browser ID `2`, type `iab`, session `01a193d1-c8bb-7e81-9b99-8e5a0f65e99d`, and tab ID `1` with the same provider ID `browser-use:6664cd0b-0321-40d9-93a5-14a5a86a48a6`, title and appearance URL as the successful first turn. Inventory returned without a reported inventory error.
- The tab remained listed under the same identity; this does not show a closed or replaced tab. Inventory availability is not proof of live page control.
- **Stopped after that one inventory.** No recovery, additional page read, re-mark, screenshot or alternate control path was attempted.

## Interpretation and preservation

The failure **is not specific to the previous chat**: this fresh chat reproduced the same pattern of successful live access/input focus in one turn followed by `browser.user is unavailable` on the next message, while the same browser/tab/provider identity remained listed. Moving to a fresh chat did not establish lasting control in this comparison.

This result does not identify the exact session-routing or registration defect, prove which app component causes it, or establish a timeout threshold. The first successful read and failed next-message read were about 56 seconds apart; elapsed time and the turn boundary are not isolated variables. The old 81-minute comparison failed both before and after idle and likewise established no timeout threshold. Further recovery or construction is outside this completed diagnostic's scope.

Existing reports, reference images, avatar assets and the running server were left in place. Candidate JS still hashes to `fc486085da779ae74f2e33f501349b678a97551c59187a99a583829c18984af0`. The preservation check found all 26 pre-existing files in the diagnostic manifest unchanged, including the prior evidence files, candidate JS/HTML and frozen candidate GLB. No recovery loop, restart, permission change, private transport, native-app fallback, avatar edit, new automation or development resume was performed. Ember and the ten-minute timer remain **PAUSED**; the local timer status was rechecked after the failed comparison. Browser testing is stopped pending further human steering.

---

## Additional fresh-chat comparison after MacBook restart — first turn successful; next message pending

**2026-10-31, 21:44 UTC.** This is a separate run in chat `01a193eb-3cc7-75c2-bf83-e68f83443490`, following Robert's latest `FRESH-CHAT-PROMPT.md`. The earlier result above is preserved as historical evidence. The latest handoff says Robert resumed Ember in the original chat and the recovery timer is ACTIVE; this diagnostic did not independently inspect or change the timer. Successful control here does not authorize avatar edits in this chat.

- Initial supported `cua.getState()` inventory showed symbolic `iab` as browser ID `2`, “ChatGPT in-app browser”, associated with this chat and containing no tabs. No old numeric identity or JavaScript handle was reused.
- One `cua.createBrowserTab('iab', appearanceUrl, {visible:true})` began at **2026-10-31T21:44:26.626Z** and completed at **21:44:27.193Z**, returning the live accessibility tree for `http://127.0.0.1:5173/ember-appearance-v001.html`.
- Current tab ID `1`; provider ID `browser-use:a2bdf906-362c-476b-b412-3722c791c2a9`; title “Ember — skin and hazel eyes study”. IDs are observations, not routing constants.
- Retained top-level CUA handle: **`emberFreshPostRestart`** in the existing persistent `mcp__cua_repl` session. Supporting timestamps and tab identity are retained in `emberFreshPostRestartLog`.
- A harmless click on AX element `26`, the read-only **Visible frame report**, began at **21:44:29.696Z**. The following `emberFreshPostRestart.getAXState()` completed at **21:44:30.254Z** and confirmed focus on that field. No text was entered.
- Observed settings remained Front reference 2, Reference smile, warm light (`neutralLight:false`), `view:front`, `frame:reference`, `draws:1`, `headYaw:0`. The visible frozen candidate hash was `bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef`.
- `emberFreshPostRestart.markHandoff()` succeeded at **21:44:30.255Z**. A subsequent supported `cua.listTabs({browser:'iab'})` confirmed the tab/provider identity above.
- Errors: **none** in the initial live-read/focus/handoff test. No screenshot, reload, reset, rebind, server restart, avatar edit, automation change or alternate control path was used.

This establishes working page read and harmless focus within this first turn only. It does not establish continuity across messages or resolve the earlier failure. The next browser operation on Robert's next message must be **`await emberFreshPostRestart.getAXState();`** using this unchanged handle, before any refresh, rebind, reset or inventory query. Record its UTC timestamps and exact result. If it fails, take exactly one current inventory to distinguish tab replacement/closure from a session failure, then stop.

Only this report was edited by this diagnostic. Source-file checks confirmed candidate JS SHA-256 `fc486085da779ae74f2e33f501349b678a97551c59187a99a583829c18984af0`, HTML `9f4cbf3fb9bc4b704b60d4aa3704cc8e3dd92cb5213d038c9e016b0c02647052`, and frozen GLB `bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef`. Existing reports, assets and the running server were preserved.


## Additional post-restart comparison — next-message failure reproduced; diagnostic complete

Robert sent **“Check again.”** in the same fresh chat `01a193eb-3cc7-75c2-bf83-e68f83443490`.

- The first browser operation was **`await emberFreshPostRestart.getAXState();`**, using the exact top-level handle retained above. No refresh, rebind, reset, navigation or inventory preceded it.
- The read began **2026-10-31T23:28:47.440Z** and failed at **2026-10-31T23:28:47.638Z**. Exact error: **`Error: browser.user is unavailable.`**
- Exactly one supported `cua.getState()` followed, beginning **2026-10-31T23:28:50.225Z** and completing **2026-10-31T23:28:50.361Z** without an inventory error. It still listed browser ID `2`, type `iab`, this same chat/session ID, tab ID `1`, provider ID `browser-use:a2bdf906-362c-476b-b412-3722c791c2a9`, the same title “Ember — skin and hazel eyes study”, and the same local appearance URL.
- The same tab/provider identity remained listed. This does not support a closed/replaced-tab explanation for this observation; inventory availability does not establish live page control.
- **Stopped after that single inventory.** No further browser read, recovery attempt, re-mark, screenshot, alternate transport or native-app fallback was performed.

This additional fresh chat again reproduced successful within-turn live read/focus/handoff followed by failure on the next user message. A fresh chat after the MacBook restart did not establish continuity in this run. The interval from the last successful read's completion to the next read's start was **1 hour, 44 minutes, 17.186 seconds**. Elapsed time and the turn boundary were not isolated, so this establishes neither an exact timeout nor the underlying routing/registration cause. It provides no basis to blame conversation length alone.

The candidate JS, HTML and frozen GLB hashes were rechecked and exactly match the first-turn values above. Only this report was appended; earlier report bytes were preserved. Avatar assets/settings, the running server and automation settings were left unchanged. Timer status was not queried in this diagnostic. The two-message comparison is complete; no avatar development or further recovery is authorized by this result.


## Explicitly requested repeat check — 2026-10-31T23:29:41Z

Robert requested “Check again for me...” after the completed comparison. The first browser operation again used the unchanged `emberFreshPostRestart.getAXState()` handle, with no preceding refresh, rebind, reset or inventory. It began at **2026-10-31T23:29:41.504Z** and failed at **23:29:41.669Z** with the exact error **`Error: browser.user is unavailable.`**

One supported inventory followed at **23:29:44.236Z–23:29:44.339Z**, returning without an inventory error. It again listed the same chat `01a193eb-3cc7-75c2-bf83-e68f83443490`, IAB browser `2`, tab `1`, provider `browser-use:a2bdf906-362c-476b-b412-3722c791c2a9`, appearance-page URL and title. Browser operations stopped there. The failure persists; the unchanged inventory does not prove live control, and this repeat does not establish a new cause. Only this report was appended. No avatar, timer, server or permission changes were made.


## Stale-reference hypothesis — fresh tab restores live control at 23:35 UTC

Robert questioned whether the retained browser-control reference becomes invalid between turns, and whether that warrants stopping avatar work. A bounded comparison checked the server and a fresh supported browser reference.

- The local appearance URL returned **HTTP 200 in 0.005037 seconds**. This is an HTTP health observation, not visual qualification.
- One fresh `cua.getTab('1', {browser:'iab'})` began **2026-10-31T23:35:30.874Z** and failed at **23:35:31.116Z** with **`Error: Tab not found in browser 2.`** This differs from the earlier retained-handle error.
- Inventory at **23:35:36.626Z–23:35:36.755Z** showed this same chat and IAB browser `2`, now with **no tabs**. The original tab was therefore absent at this check. It had still been listed during both earlier failures; its later absence cannot retroactively explain those failures.
- The tool's supplied lifecycle documentation says agent-created tabs are temporary and retention marks are turn-scoped. The original tab had been marked in its successful first turn, but was not re-marked during the subsequent failure turns because the diagnostic explicitly stopped after one inventory. Cleanup is consistent with the later disappearance; no closure event was inspected, so its exact cause is unconfirmed.
- With the old tab absent, one `cua.createBrowserTab('iab', appearanceUrl, {visible:true})` began **23:35:49.361Z** and succeeded at **23:35:49.963Z**, returning the full live AX tree and completed frozen-candidate report. Current handle: **`emberLifecycleReview`**. Tab ID `2`; provider ID `browser-use:3458b1ce-68ea-45a0-8038-32975df70b62`; same page title and local appearance URL.
- Clicking only the read-only Visible frame report began **23:35:57.545Z**; the following live AX read confirmed focus at **23:35:58.084Z**. `markHandoff()` succeeded at **23:35:58.085Z**. Settings remained front/reference smile/warm light, `draws:1`, `headYaw:0`, frozen source hash `bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef`.

**Operational conclusion:** a fresh tab restored actual read/input control in this turn. The local server is available, and failure of a retained control handle does not by itself establish that supported visual review is impossible. Reopening this reloadable review page is a demonstrated recovery option; reliability across repeated turns and restoration of nondefault review settings remain untested. The earlier cross-turn failure still exists, and this does not prove that replacing the JavaScript reference alone would repair an existing live tab, since the original tab was already absent when rebinding was tested.

No screenshot, avatar/source edit, server restart, tool reset, permission change, private transport or automation change was performed. Only this result report was appended. This diagnostic result does not execute the queued avatar correction or change the original chat's authorization. Future work should distinguish lost control continuity from the availability of a fresh supported review session.


## Reference lifetime clarification and current-chat log correlation

Robert asked what the retained reference means, whether it is expected to survive messages, and whether this suggests an introduced app/tool bug. The supported CUA API returns a Tab object with a tab identity and control methods; the persistent tool environment retains the JavaScript binding between calls. Its supplied documentation supports reuse across turns, subject to tab lifecycle and environment resets. A surviving variable is distinct from a surviving/usable app-side control session. The observed method error, rather than an undefined-variable error, shows that the binding itself remained available in these checks. “Stale reference” was shorthand, not a demonstrated root cause.

Read-only inspection verified installed ChatGPT **26.1027.30824, build 22943** and the current chat's log `/Users/robault/Library/Logs/com.openai.codex/2026/10/31/codex-desktop-c31f84b4-5cf3-4d47-85d3-7869fc84ceed-8951-t0-i1-212620-0.log`:

- Lines **1265/1267**, at **23:28:50.267Z/.297Z**, record `getInfo` failures: `No ChatGPT browser route is available for browser session 01a193eb-3cc7-75c2-bf83-e68f83443490`.
- Lines **1332/1335**, at **23:29:44.265Z/.292Z**, record the same failure. These timestamps correspond to the inventory calls after the retained-handle failures, not the exact earlier AX-read timestamps. Inventory still returned the listed tab despite those logged backend-info errors.
- Lines **1377–1379** record the original provider tab's actual closure at **23:30:52.042Z**, after both failed reads and inventories. This now confirms when closure occurred; it does not establish who or what initiated it. The first failed read cannot be explained by that later closure.

The evidence supports a suspected app/tool session-routing or lifecycle defect. It does not identify the complete causal chain, assign sole responsibility to one component, or establish a newly introduced regression: no comparable test on a known-good earlier app/tool version has been performed. General official [browser documentation](https://learn.chatgpt.com/docs/browser) describes app-mediated control, but does not document this internal handle failure. Official [troubleshooting guidance](https://learn.chatgpt.com/docs/reference/troubleshooting#feedback-and-logs) identifies the app-log location used here. No further browser operation, setting change or app modification was performed for this clarification.


## Authorized close-and-replace experiment — 2026-10-31T23:55Z

Robert explicitly requested testing a stale connection by closing its tab, then opening a new one as an alternate workflow.

1. The saved `emberLifecycleReview` handle for tab `2` was tested first, without rebinding. `getAXState()` began **23:55:29.312Z** and failed at **23:55:29.473Z** with **`Error: browser.user is unavailable.`**
2. The SAME handle's `close()` began **23:55:32.607Z** and failed at **23:55:32.608Z** with **`Error: browser.user is unavailable.`** A supported tab listing still showed tab `2`, provider `browser-use:3458b1ce-68ea-45a0-8038-32975df70b62`, at the appearance URL. Closing through the failing reference did not work.
3. One new `cua.createBrowserTab('iab', appearanceUrl, {visible:true})` began **23:55:35.628Z** and succeeded at **23:55:36.110Z**, returning the complete live AX tree. New handle: **`emberCloseRecoveryReview`**. New tab `3`, provider `browser-use:06efdffc-b3a8-486f-a20c-d55f88c17339`, same title and appearance URL, in the same IAB browser `2` and chat.
4. A harmless click on the read-only Visible frame report began **23:55:51.241Z**. The subsequent AX read confirmed focus at **23:55:51.506Z**; handoff marking succeeded at **23:55:51.507Z**. Tab listing showed both the old tab `2` and the new tab `3`.
5. To finish the authorized old-tab cleanup, one fresh binding attempt `cua.getTab('2', {browser:'iab'})` began **23:55:56.734Z** and failed at **23:55:56.776Z**, again with **`Error: browser.user is unavailable.`** No new handle was acquired and no second close call was possible through that attempt.
6. A final read through the NEW handle still succeeded at **23:56:07.585Z–23:56:07.606Z**, followed by successful handoff marking. Thus failure to rebind the old tab did not prevent reading the new tab in the same turn.

**Result:** the stale reference could neither read nor close its tab. Opening a replacement restored supported page read and input focus without first closing the old tab. A fresh binding to the old tab also failed while the replacement remained readable. The complete automatic close-then-open workflow is therefore NOT established; opening a replacement is a demonstrated recovery step, with old-tab cleanup unresolved. The old tab remains open after these operations. This distinguishes the two tabs' control behavior without identifying the underlying defect or proving next-turn reliability.

The new tab displayed front/reference smile/warm light, `draws:1`, `headYaw:0`, and the same frozen source hash `bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef`. No screenshot, avatar/source edit, server restart, tool reset, alternate transport, native-app fallback, permission change or automation change was performed. Only this report was appended; prior report bytes were preserved.
