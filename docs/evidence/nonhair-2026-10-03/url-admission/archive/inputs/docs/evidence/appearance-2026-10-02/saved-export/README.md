# Direct saved-look JSON download — locally integrated

**A supported saved recipe can now be downloaded without opening it or replacing the active preview.** The row action uses the existing strict saved-look reader, refuses a stale/removed entry, serializes its saved configuration and supplies a sanitized named filename. Actions fit a two-column grid. Unsupported recipes remain stored with Open/Download disabled. No collection envelope, renderer, asset, schema or accepted recipe changes.

[Declared bounded plan](PLAN.md), [actual visual review](review.html), and independent [critique](CRITIQUE.md). The existing V2 colour-recipe originals establish the former three-action UI; the new native packet supplies four-action layout and direct-file behavior, rather than an exact matched avatar image comparison.

## Exact native receipt

Entry `a145900`, branch `codex/bob-appearance-2026-09-29`; source hashes:

- `packages/testbed/src/showcase.js`: `4b7fc2ed318fbd39a6b9de263a59674ec950f97683b998a2385ed5ba693d2c5c`.
- `packages/testbed/src/showcase.html`: `51eef6cfaa595accb4ace95143eeb9954568fa1f839fc55b5b48e946f9ef5348`.
- Observer `tools/critic/saved-look-export-ui.mjs`: `24d14488e1747816b1115ba9d5532af4d36194719f69d8b043df5beb239bb213`.

Critic preflight caught and root independently verified two issues before the single native run: the accessible name must contain visible “Download JSON”, and cleanup errors must force a failed receipt/nonzero exit. Both were corrected before source binding. These are source/observer corrections, not failed native arms.

```sh
node tools/critic/saved-look-export-ui.mjs
```

PID **37757**, root exec session **18892**, command chunk `4e3767`; UTC `2026-10-03T02:49:20.842Z`–`02:49:30.119Z`, exit **0**, collected. Output `captures/saved-look-export-2026-10-02-v1`. Report SHA256 `686cf9e902b8ba9e82074d3c05fceb9868f4faf44ce080f3a7d684404f1e462e`. No native job remains; browser closes. User browser/storage is untouched: fixtures and downloads belong to the isolated probe browser/output.

Three actual downloaded files:

| Recipe | Suggested filename | Bytes | SHA256 |
| --- | --- | ---: | --- |
| Rose teal | `sugata-Rose teal.json` | 596 | `f7f0a8a185420c01de71f12a1ad8ae1fa7f2e524f64f748ba73f5f15b392f0e2` |
| Original | `sugata-Original.json` | 431 | `47d10564ca032ea512266fc8c6db7e6d9fced0f33fe543d77c2e61fae5a78c17` |
| Unicode/path-character name | `sugata-日常 - -soft-- -rose- - -- -.json` | 596 | same exact Rose teal recipe hash |

Rose teal retains its `.35` teal tint `#239c88`, rose Top `#b78383` and Shoes `#623c28`; Original has no invented colour overrides. Before reopening, active owner/configuration/URL and the exact stored envelope remain unchanged with Sage violet still active. A silently changed Rose record and removed Original record cause errors and zero extra downloads; the disabled unsupported control produces none. The downloaded Rose file subsequently passes actual hidden-file-input selection/navigation and restores the expected current configuration. UI geometry checks retain ≥44px high, ≥140px wide two-column mobile buttons, no horizontal overflow and Open→Rename→Download→Remove keyboard order. Accessible label and described colour recipe are checked in DOM, without a screen-reader speech claim.

Zero errors, 12 recorded warnings, two explicit retirement receipts each `disposed:true, leaked:[]`. This does not certify every navigation's disposal. Root separately rehashed all **380** current source pins, all **four** original images and all **three** actual JSON files, recomputed expected tint/garment/Original values and reopened configuration, and directly inspected desktop/mobile viewport plus complete-list images. Complete-list originals show all unavailable-row actions; viewport images alone crop parts of the list.

```sh
npm run build:pages > docs/evidence/appearance-2026-10-02/saved-export/build-pages.log 2>&1
git diff --check
```

Page build passes, 216 transformed modules, with the existing >500kB chunk warning. Syntax and whitespace checks pass. No native rerun, push, publication or asset promotion occurs. The frozen local packet inventory is in `archive-manifest.json`; raw capture files are ignored local evidence, not an off-machine backup.

The completed [independent postflight](CRITIQUE.md) approves the slice with no demonstrated remaining actionable defect. Root read the complete handoff and separately confirmed all three files pass the actual data importer, Future is rejected, PNG dimensions distinguish complete-list regions from viewport metadata, and the 12-warning multiset equals prior V2. No post-download pixel-equality, arbitrary orbit/attention-state or motion claim follows. Frozen packet: **13 files, 1,049,703 bytes**, manifest SHA256 `ee145d365c1fb7f8ba0d04a220f290c368c618cacb66a66a02a3a019a23108fa`. All 100 files in the three earlier packet manifests remain intact. Review HTML returns HTTP 200; its app browser tab is queued for this chat's next foreground display.

## Limits and next action

This validates direct export on the sampled current body/wardrobe recipes and native Chromium workflow, not every browser/file system, assistive technology or settings combination. It does not produce appearance thumbnails, preserve orbit/motion time, add body fits or improve the experimental haircut. The source validates unsupported settings before export; obsolete/future configurations keep their stored envelope but receive no new portability claim.

Alternative A selected: direct row export preserves the preview and names the recipe, with a fourth action and extra row height. B retains Open then global export, a smaller interface that interrupts the current preview. Wider character, expression, wardrobe, representative-build and performance scope remains preserved. Next hair work starts from the broader front backing/hairline/part/visible-guide decision in `../root-coverage/METHOD-DECISION.md`, with a new bounded design contract; no automatic UV/topology/runtime release follows.
