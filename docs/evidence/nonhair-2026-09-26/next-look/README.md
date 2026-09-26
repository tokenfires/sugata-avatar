# Named saved looks — bounded review collection

The Wardrobe page now has a collapsed **Saved looks** section. It saves up to 12 named combinations in the current browser profile and site origin. Open uses the existing strict settings-restoration path. Remove offers one Undo while the stored list still exactly matches the result of that removal.

This implements a small part of PUNCHLIST 9.12: naming and reopening the current supported studies. It does not qualify another body, add clothing pieces, complete wardrobe fit, or serialize identity/agency state. No accepted assets, core runtime, Portrait page or hair sources changed.

## Storage and recovery contract

- The separate key is `sugata:showcase:saved-looks:v1`. Each entry contains a plain-text name, opaque ID and strict supported Avatar configuration. Names are limited to 40 Unicode code points and compared using NFC normalization plus lowercase for duplicate refusal. Settings exports remain plain Avatar options without collection metadata.
- Save/Open/Remove/Undo reread storage; mutation rechecks the raw value immediately before writing. Real `storage` events refresh the list, and an intervening list change retires Undo. **LocalStorage read/modify/write is not atomic across simultaneous writers.** This is a conservative latest-read interface, not a conflict-free merge system.
- Unsupported option records stay visible as unavailable and can be removed. Malformed metadata/envelopes, unknown versions and inaccessible storage block collection writes. The UI deliberately displays **Unavailable** and clears untrusted rows on a read failure; it preserves the stored bytes and current Avatar, not a cached rendering of the old list.
- Quota/write failures report failure. There is no in-memory fallback that could misleadingly look persistent. The browser's normal storage guarantees apply; no private-browsing durability or cross-device claim is made.
- The origin/profile owns the collection. `localhost:5173` and `127.0.0.1:5173` are separate origins. Clearing browser data removes the collection. JSON download remains the portable path.
- Saved settings preserve current supported clothes, cut, palette, framing, scene and applicable Studio light. Camera orbit, the motion clock and attention are viewing state and start fresh when Open navigates. Saving/removing collection metadata must keep the current live viewer intact.

## Focused validation

CPU command:

```sh
node packages/testbed/src/showcase-collection.selftest.mjs
```

All five groups pass: all 72 supported settings combinations; names/duplicates/identity/cap; latest-read changes and exact scoped Undo; unsupported versus malformed records; storage-access/quota/interleaved-read failures. This is the existing two cuts, two whole outfits and three palettes on g050, combined with framing/scene/light settings; it is not 72 distinct outfit assets or representative builds.

The all-page production build passed after the final helper change (199 modules, 18 HTML pages, 197 ms; existing large-chunk warning only). No broad test suite was rerun for this bounded change.

The focused native gate is `packages/testbed/src/showcase-collection.gpu.selftest.mjs`. It uses a fresh browser context, actual production page, keyboard naming, native Open/Remove/Undo and a lightweight same-origin second tab for real storage events. Controlled storage-access and pending-file exceptions test recovery without touching the user's browser data. The gate binds its source/assets and built HTML/JS/JSON files before and after execution.

The final production run is [native-v2/report.json](native-v2/report.json). All seven focused groups passed, with no page, console, request or response errors. Its 19 source/asset hashes and 106 built HTML/JS/JSON hashes stayed exact throughout the run. Three ordinary UI screenshots and the downloaded plain-options JSON have individual SHA-256 receipts.

- Keyboard Tab/Enter saved “Quiet morning” from the actual attached mixed blouse/skirt, charcoal, portrait, Warm Studio configuration. A case-insensitive duplicate refused without changing stored bytes, Avatar/renderer ownership, camera, clock or attention report.
- A second “Kitchen afternoon” look used Original colours and full-look framing. Two entries survived reload. Native Open restored the first look's attached configuration, selected starting cut, pressed controls and 0.85 exposure. The existing JSON download contained exactly its plain Avatar options.
- Fresh mobile navigation at 390 × 844 reopened the second look with omitted style/lighting fields, selected Original/Kitchen controls and native 2.04 exposure. Remove/Undo restored its exact configuration while preserving the live owner, camera, clock and attention. A 1440 × 1000 desktop plate and full-page mobile plate show the names, summaries and actions.
- A lightweight second tab changed the same-origin collection through real storage events. The current page refreshed the list, rendered `<b>From tab</b>` literally, hid stale Undo and kept the current Avatar unchanged.
- An unsupported saved configuration stayed visible with Open disabled. Unknown collection version and controlled localStorage accessor failure disabled collection writes while leaving JSON export and the current viewer usable; stored bytes survived. Recovery rebuilt the supported list.
- A synthetic persisted `pageshow` during an actual pending `showcase.openLook` read kept collection controls disabled until the controlled read failure recovered. This checks the earlier lifecycle guard's coexistence with the new collection; it is not a new browser back/forward-cache qualification.

The native gate uses fixed-clock capture pages. Its metadata assertions prove an unchanged clock/attention report at those checked moments, not a new live-motion performance or appearance qualification. The browser storage exception is injected deliberately; no quota exhaustion or browser-private-mode persistence was claimed from the native run (quota refusal is covered by the CPU helper test). Both screenshots show the existing accepted outfit assets and remaining visual-fit limitations unchanged.

The initial [native-v1/report.json](native-v1/report.json) is retained as a rejected **complete-gate** result. Four groups passed, then the test used Playwright `isDisabled()` on the fieldset itself and obtained false even though the stored screenshot showed the correct unavailable/disabled descendant UI. The unchanged product passed v2 using the native `fieldset.disabled` property, the input's `:disabled` match and Playwright `isDisabled()` on the input. The exact v1 instrument is retained at [native-v1/instrument/probe.mjs](native-v1/instrument/probe.mjs); no product source or production build changed between those runs.

Reproduction (use a fresh output directory, and serialize with other GPU work):

```sh
npm run build:pages
node packages/testbed/src/showcase-collection.gpu.selftest.mjs --production --out=/tmp/sugata-saved-looks-fresh
```

Browser, context and temporary preview server all closed after both runs. The persistent review LaunchAgent was untouched. Independent final critique is recorded separately.
