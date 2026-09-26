# Independent review: Wardrobe room chooser and saved looks

Reviewer: `/root/critic`, 2026-09-26. CPU/source/image review only; no additional browser or GPU run.

## Verdict

**Integrate the room chooser and supported settings changes with the reviewed lifecycle correction.** The forward room/settings behavior, visible result, and conditional persisted-history recovery are acceptable. This accepts access to the existing Studio/Kitchen scenes and faithful supported settings restoration; it does not qualify hair, garment fit, motion, or another body.

## Verification

I reviewed `showcase.js`, `showcase.html`, scene selection, preset/options reconstruction, settings validation, and their CPU tests. I reran the four preset groups and four settings groups, including 72 supported scene/light × cut × outfit × palette × frame roundtrips. The shared scene helper's four groups also passed.

I independently verified all 17 source hashes, all seven screenshot hashes, and all three downloaded JSON hashes in `wardrobe-v1/report.json` before the lifecycle correction. Its eight native browser groups passed with no reported errors. The actual chooser restores Kitchen mixed and Original looks and a legacy Studio Warm file; invalid explicit Kitchen lighting preserves the current Avatar, complete attached configuration, and URL.

Kitchen exports omit `lighting` and therefore restore the native room exposure (2.4 relative, 2.04 actual), while Studio retains its explicit supported light. The exact reconstructed-options comparison rejects contradictory Kitchen lighting instead of silently changing the saved configuration. Changing rooms retains the cut, attached outfit, palette, and starting frame; clearing the Studio light override is intentional and necessary. The UI hides unsupported Kitchen light controls and discloses the new starting pose/expression.

## Visible review

I inspected all seven retained screenshots: Warm Studio, mixed Kitchen portrait, invalid-settings error, Original Kitchen mobile portrait, both mobile full looks, and the second cut's elegant Kitchen desktop full look. The selected room is legible; the invalid-file error gives an actionable reason; the Original fabric remains recognizable. Mobile rows fit the width, the head region remains present, and the full-look views contain the figure. Kitchen's face/eye lighting and warm room remain readable. Existing hair-card, neckline, skirt, and socks limitations are unchanged evidence limits.

The mobile control page is long, but no horizontal clipping was visible. A later sticky desktop viewport or earlier placement of the room row could improve comparison while editing; each needs layout testing. These are usability improvements rather than a blocker in the observed paths.

## Lifecycle finding and resolved follow-up

The existing Wardrobe navigation paths leave `busy` set during a full-page navigation. A persisted document return currently restarts animation without clearing navigation's disabled controls. As with Portrait, the current forward tests do not establish native back-forward-cache behavior. The correction must track **navigation pending** separately from generic asynchronous work: a restore may clear the former, but must not clear an outfit load, settings read, or image save still in progress. Preserve the owned Avatar and its view state; capture pages must not acquire a live RAF loop.

This finding extends an existing Wardrobe navigation limitation to the new room route. It should be fixed narrowly and verified before integration, without claiming a native cache restoration was observed when the test uses controlled persisted events.

**Final correction review:** the current source marks only settings/palette/room navigation with `navigationPending`. Persisted restoration clears that flag and its busy state, refreshes the existing controls/status, preserves the owned Avatar, and cancels before scheduling a single live RAF. It leaves generic asynchronous work untouched and schedules no live loop for capture pages.

The shared red/green evidence in `../rooms/lifecycle-baseline/` and `../rooms/lifecycle-fixed/` demonstrates the missing recovery and its correction using actual Room handlers plus an HTTP 204 retained document and explicitly synthetic persisted events. I independently verified both sets' frozen sources and PNGs, the fixed sources against current files, and matching recorded owner/camera/pause/control state. Both Wardrobe capture and live-paused fixtures recover their fourteen navigation-disabled controls. Two cycles preserve zero capture RAFs or exactly one live RAF. Restored UI plates are usable and show the correct pause/status text.

A real pending `openLook` call whose native File's `text()` completion is deliberately withheld remains busy through restoration: configuration export still rejects it and the Reading settings status persists. Completing that same read with unsupported `{}` reports the error, retains the current look, and re-enables controls normally. This directly checks the important distinction between navigation and asynchronous work. The report has no unexpected errors; expected HTTP 204 navigation aborts are recorded separately. Native back-forward-cache admission remains unqualified, but the identified handler defect is resolved.

Signed: independent critic agent `/root/critic`.
