# Custom wardrobe colours — combined with hair recipes

## Decision

The independent [material](MATERIAL-CRITIQUE.md) and [combined UI](UI-CRITIQUE.md) reviews support the bounded colour feature. The reviewed implementation is saved in isolated commit `2cb8d0e`, ported from `428232c` onto main `73b37b1`. Root accepts its static material mapping/detail and creation-time recipe workflow. Integrated locally as `fc48fb5` after evidence checkpoint `770f6d6`; all377 captured source/asset bindings match the main checkout. The UI review completes the pending condition in the earlier material review.

**Exact-image reproducibility remains failed.** Five of eight comparisons differ, with a maximum of 53 channel codes. The old September 26 holds and today's tint failures remain preserved. No renderer cause, tolerance, first-frame repair, fit improvement or AAA acceptance is inferred.

## Available behavior

Top, Bottom and Shoes can override Ecru or Charcoal independently. Original preserves the authored materials and refuses overrides. Drafts apply explicitly; wardrobe Apply carries the currently applied hair recipe and hair Apply carries the currently applied clothing recipe. Outfit changes retain logical parts. Base palette selection clears clothing overrides, while Hair Original clears only hair base/tint. JSON and browser-local named looks reconstruct both recipes. The UI explains that applying a recipe restarts motion and orbit.

This is an immutable creation-time wardrobe recipe plus attached material identity contract. Arbitrary edits inside an attached shader node graph are outside the observation contract; no supported UI path performs those edits.

## Native evidence

Root inspected the eight feature base/custom originals and all four final UI originals. The critic inspected all sixteen material originals and all four final UI originals, and independently checked recorded hashes and comparisons.

- [Material report](../../../../captures/wardrobe-colours-day-2026-09-30-v1/report.json): four main-base controls plus twelve feature base/custom/returned-base views, Casual/Elegant at yaw 0/145. Fixed body/worn positions, masks/indices, rig, physical hair, camera and lights match exactly within each corresponding group. All sixteen owners retire with no recorded leaked handles. Fabric trim, stripes, denim shading, leather and base-owned socks remain visible in the reviewed images.
- [UI v2 report](../../../../captures/wardrobe-colours-day-ui-2026-09-30-v2/report.json): fourteen checkpoints, ten named check groups and ten ready/retired owners. It exercises separate drafts/Apply, palette reset, Original, outfit/room navigation, real JSON file download/reopening, named looks, mobile layout and invalid-input refusal. No recorded page/console/HTTP errors; warnings remain retained. The four screenshots support the observed desktop and mobile controls.
- [Six focused existing checks](../../../../captures/custom-colours-integration-cpu-2026-09-30-v1/report.json) pass for colour validation, material recipes, presets, settings, collection and colour state. Historical September 26 test logs included with the original implementation are distinct from today's checks.

The first [UI packet](../../../../captures/wardrobe-colours-day-ui-2026-09-30-v1/report.json) passed interaction observations but its desktop images visibly lacked hair. It used capture mode and only the startup drawing history. Preserve it as incomplete-avatar imagery. V2 applies the material packet's recorded 98 zero-time steps plus final draw before ready observations. Hair is visible in V2. This instrument correction supports the final screenshots without establishing the underlying startup cause or normal live startup behavior.

## Decision log

1. Reuse the idle, tracked-clean hair-colours worktree; preserve the original custom-colours checkout and evidence. Resolve five source conflicts to retain both features and strict URLs/settings.
2. Declare the new controls/material scope before native work. Retain strict-image failures as a separate unresolved property; do not search capture epochs or tune a tolerance.
3. Complete all sixteen predeclared material views despite the failed exact-image property. Accept only their bounded mapping/detail observation.
4. Preserve UI v1's visible missing hair; choose the critic's alternative A, applying the already declared material drawing protocol for complete-avatar UI v2. Alternative B was to retain v1 for controls and rely only on separate material images, leaving no complete combined desktop plate.
5. Accept the reviewed creation-time recipe/identity contract. The alternative is shader-specific integrity tracking if external node mutation detection becomes a real requirement.
6. Integrate after both independent reviews. The alternative is holding all controls pending a separately designed renderer reproducibility study; no current evidence attributes those residuals to a colour-code defect.

## Recovery and pins

Exact commands are `node tools/critic/wardrobe-colours-day-capture.mjs` and `node tools/critic/wardrobe-colours-day-ui.mjs`. The second tool now defaults to V2; the exact V1 controller is archived in its raw root. Existing output directories deliberately refuse overwrite.

| Job | PID / root session | Finished UTC |
| --- | --- | --- |
| Material | 20984 / 40439 | 16:29:07.624 |
| UI v1 | 21819 / 90190 | 16:33:49.449 |
| UI v2 | 22294 / 49361 | 16:37:32.709 |

All three exited and their temporary browsers/servers closed. Main review Vite remains separately owned. [summary.json](summary.json) records report/source/critic hashes; [archive-manifest.json](archive-manifest.json) freezes 607 local files / 62,852,852 bytes, including both source inventories, failures, original images and state. These raw files remain local under ignored `captures/`; the manifest is not a remote backup. Feature sources still matched the native inventory immediately before committing. Accepted asset bytes remain unchanged.

This slice does not qualify all colours, Charcoal's source-denim branch in fresh native images, geometric fit, motion, first-frame startup, full keyboard accessibility, OS colour pickers or arbitrary shader mutation detection. The current wardrobe native run entered its colours by hex fields; the colour-picker handler has older/source evidence only. Review the gallery separately after local integration, then select a new concrete roadmap improvement instead of retuning the closed hair or neckline studies.

## Review gallery

[Today's review](../../hair-2026-09-30/review.html) now shows both clothing examples alongside editable hair tint. Native gallery PID35114/session22406 finished16:47:21.031UTC, with all seven images loaded and no horizontal overflow at1440/390width or recorded page/HTTP errors. Root inspected both actual desktop/mobile originals. The [separate gallery manifest](gallery-archive-manifest.json) preserves its exact HTML/source, report and screenshots without changing the frozen feature packet.
