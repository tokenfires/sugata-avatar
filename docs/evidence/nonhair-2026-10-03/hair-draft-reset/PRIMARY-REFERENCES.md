# Current primary UI references

Read via web tool 2026-10-03T23:30UTC.

[W3C APG Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) documents action-button names and Enter/Space activation. Here use native button with visible specific name; test real keyboard activation. This is implementation guidance, not screen-reader or accessibility compliance qualification.

[WHATWG HTML disabled controls](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#enabling-and-disabling-form-controls:-the-disabled-attribute) is current Living Standard (page last-updated 3 October2026). Root source shows existing showcase enableControls disables the enclosing fieldset during loading/saving/failure. New button belongs inside that fieldset; native disabled semantics are a reference, not a runtime busy-state test.

Real local design comparator: clothing Apply/Reset row in showcase.html and showcase-colour-controls.mjs plus hair-cut/archive/capture/desktop-before.png. Historical pixels have hair disclosure collapsed. New actual expanded editor images are required before layout acceptance. No new internet design download or paid research job needed for this small consistency choice.

Follow-up actual WHATWG section lines409–418 read23:39UTC: button descendants of disabled fieldsets (excluding first legend) inherit disabled state; queued user clicks are prevented. Programmatic values can still change, so Reset explicitly guards matches(":disabled") too.

Postfailure source context, current web read23:44UTC: [Playwright frame implementation](https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright-core/src/server/frames.ts)263–275 publishes same-document navigation too; [Page API](https://playwright.dev/docs/api/class-page#page-event-framenavigated) documents the event. Currentmain is contextual source, not a match to local version or causal identification of this run. No event-level data were recorded, so threeevents remain unattributed. No browser/observer replay or repair.
