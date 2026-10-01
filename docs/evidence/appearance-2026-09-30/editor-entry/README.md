# Open the editor a review link promises

The day review's hair/clothing edit links previously landed on closed sections. The candidate opens the requested editor and puts keyboard focus on its summary, so Tab moves into the controls. Ordinary URLs retain the collapsed layout. The applied look and an unsaved clothing draft survive navigation between these two sections.

The native baseline and candidate are independently accepted. Candidate `e763a29` was integrated locally as `8f4630d`; all 378 recorded source/asset bindings exactly match the integrated checkout. No asset, material, rendering or settings-schema change. Read the [independent critique](CRITIQUE.md), SHA256 `5ada40f9a9a589d91cceca01b5c7d98e4876e02c31fc16674873edcb1625ae2b`.

## Actual observations

| Case | Baseline | Candidate |
| --- | --- | --- |
| Desktop clothing link | Closed Mix colours section; fields hidden | Open section, focused summary, Top checkbox on screen |
| Desktop hair link | Closed Hair colour section; fields hidden | Open section, focused summary, shade selector on screen |
| Mobile clothing link | Closed summary followed by unrelated controls | Open section with all three part controls and actions in view |
| Mobile hair link | Closed summary followed by unrelated controls | Open shade selector and hair Apply in view |
| Ordinary URL | No new baseline run needed for this feature's source contract | Both sections remain closed, focus on body |

All four candidate linked entries explicitly assert Tab focus on the first control. Shift+Tab is exercised and the screenshots show summary focus; no separate focus assertion is stored for that return. The four complete configurations equal their respective baseline packets. Candidate desktop navigation also covers unknown and malformed fragments, both supported fragments, manual collapse, and browser Back. The unsaved Top `#123456` draft remains; applied settings, camera, frame count, motion clock and Avatar identity do not change on the four fragment-only transitions. Back additionally confirms the same owner, draft and settings.

Root inspected the four linked candidate screenshots. Focus outlines, labels and first controls are visible, with no recorded horizontal overflow at 1440×1000 or 390×844. The mobile plates show the controls, not a simultaneous avatar comparison. Existing unfinished hair and neckline remain in the desktop views.

## Scope

The change handles initial entry after ready and later **idle/ready** fragment changes. Busy-operation deferral, back/forward cache restoration and a complete keyboard audit are not qualified. The observer uses the actual CTA framing queries with capture mode and the previously declared frame-99/zero-motion preparation; this does not qualify first-frame rendering or normal startup appearance. There is no new exact-pixel, hair, fit or motion claim.

The original defect had two alternatives: A, direct editor entry, or B, explaining the extra manual step in the review text. A was selected. The critic's source review retained idle-only handling; deferred intent would require queuing the latest supported fragment and a separately bounded async-state review.

## Commands, identities and evidence

Baseline:

```sh
node tools/critic/showcase-section-entry.mjs captures/showcase-section-entry-baseline-2026-09-30-v1 > tmp/showcase-section-entry-sep30/baseline-v1.log 2>&1
```

PID 17072 / exec 83475, 23:55:27.455–23:55:41.358 UTC, exit 0. Four fresh owners and four original PNGs. Report SHA256 `28203e251fed515fa4155bbec90397bce9deb1f0dcdfc5e6288e4a3109f997f6`.

Candidate:

```sh
node tools/critic/showcase-section-entry.mjs captures/showcase-section-entry-candidate-2026-09-30-v1 /Users/robault/.codex/worktrees/sugata-hair-colours/sugata-avatar verify > tmp/showcase-section-entry-sep30/candidate-v1.log 2>&1
```

PID 17837 / exec 83248, 23:59:55.030–00:00:09.447 UTC, exit 0. Five fresh owners and five original PNGs. Report SHA256 `5097ca050a23697152db08959c933c0c2b6e76a0f6428390fe8be802fb343cb3`.

Both browsers closed and all nine owners report disposed without leaks. Page/console/HTTP error records are empty; warnings are retained. Source inventories and actual loaded GLB digests are recorded. The [local archive](archive-manifest.json) preserves 23 files / 3,724,461 bytes, manifest SHA256 `541935562a40bb291780d62153774a1e553b2eb7f3fa58d3dc3c0d567bd3206a`. Original instrument versions are included. The archive is local preservation, not an off-machine backup.

No work job remains. The candidate probe server closed; the existing main review server remains. See the [declared plan](PLAN.md).
