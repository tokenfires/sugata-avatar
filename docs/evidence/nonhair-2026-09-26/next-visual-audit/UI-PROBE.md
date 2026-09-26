# Focused native chooser probe — prepared only

`ui-probe.mjs` is a new isolated test instrument. It has not launched a browser or modified the frozen reference controller, candidate UI, product files or assets. Syntax checking and the post-integration CPU preflight now pass. Root integrated the module/CSS and six unchanged reference PNGs; no native UI run has been launched by this worker.

Expected production paths are `packages/testbed/src/showcase-palette-references.mjs`, its `.css`, and `src/palette-references/{casual,elegant}-{ecru,charcoal,original}.png`. The instrument binds the completed capture's report/seal and checks each production PNG is **byte-identical** to its qualified native download, including actual decoded dimensions. It refuses partial reference sets and fresh-output collisions.

The sealed reference input is `captures/wardrobe-palette-references-2026-09-26/native-v1` (report SHA-256 `da9d4e0e30c7464ceed62dd72e644d43ac44f586ebed70c6111e6c29f930b0da`). `ui-manifest-v3.json` is SHA-256 `e16d33023e3bec88897adb0505320c2f4955411ec451ea042a77a8f7b65ee524`; `ui-preflight-v3` verifies 1,582 bound files and all six installed image hashes/dimensions. The controller is SHA-256 `939a2ae572d3bcee185f68c6e3e4e3fe5e682a3238a80e3618a729591348edc7`. Independent source review precedes root’s native launch.

Reproduction (manifest/preflight outputs must be fresh; those v3 paths already exist):

```sh
node docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-probe.mjs \
  --write-manifest captures/wardrobe-palette-references-2026-09-26/native-v1 \
  docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-manifest-v3.json
node docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-probe.mjs \
  --preflight docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-manifest-v3.json \
  docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-preflight-v3
node docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-probe.mjs \
  --run docs/evidence/nonhair-2026-09-26/next-visual-audit/ui-manifest-v3.json \
  captures/wardrobe-palette-references-2026-09-26/ui-native-v2
```

Only `--run` launches the watcher-disabled Vite server and serial original native Showcase pages. Root owns the GPU slot. The manifest binds all core/testbed/assets, Three/Vite source and package metadata plus this controller. Actual loaded native assets and reference image responses are hash-checked. Vite's JavaScript `?import`/`?url` modules are correctly distinguished from actual PNG bytes.

Eight focused groups cover:

1. Desktop Enter/Space disclosure open/close while a real attention action is active: exact owner, clock, camera, attention and configuration preserved; exactly three canonical `data-style` controls and six separate reference controls.
2. All six images load with the captured hashes/dimensions, descriptive alternatives and contained layout. A real outfit change keeps bob02 but updates the reference group to the elegant starting-look reference. Selecting the already active reference palette is a no-op.
3. Reference selection preserves the actual mixed outfit, cut and Kitchen/portrait settings.
4. Reference selection separately preserves Studio/Warm settings.
5. One exported JSON object restores exactly on a 390 × 844, reduced-motion mobile page. Reference images remain uncropped, the page has no horizontal overflow, and actual keyboard focus has a visible outline inside the viewport.
6. One deliberately invalid **data URI** is decoded by a real thumbnail image element. The image's native error handler must expose its local fallback, preserve the live owner and controls, and permit actual canonical palette navigation. No source image or network route is corrupted; unexpected console/page/request errors still fail.
7. One named saved look reopens that same supported configuration after another palette. This is one roundtrip, not the 72-combination matrix.
8. The original page's actual navigation cleanup is observed after its own pagehide handler. Unexpected persisted owners stop admission rather than earning invented disposal. Final retirement uses an explicitly labelled synthetic nonpersisted pagehide handler fixture. All eight unique ready-owner IDs must match eight unique retirement IDs in exact order: seven non-synthetic navigation receipts and one final synthetic fixture. Missing/duplicate receipts fail. Disposed flags, no leaked handles and all native memory counters at zero are required. Source/PNG bindings stay exact and all browser error lists remain empty.

The sequence needs eight native owners total (initial plus seven actual navigations), with 64 public zero-delta settling draws per loaded page. No parallel renderer is introduced. Four ordinary UI screenshots are retained: desktop casual, desktop mixed elegant, mobile comparison and mobile thumbnail fallback. Their interpretation needs independent visual review; numeric `object-fit: contain` and source dimensions alone do not establish good composition.

Warnings are retained raw and separately from errors. Reports preserve each actual ready configuration, native report, active attention snapshot, image dimensions/layout, injected failure, navigation retirement and screenshots. Failure writes a partial report and best-effort actual screenshot, retires the remaining page and closes context/browser/server. Source copies are retained and reread; no warning is suppressed and no failed partial run is sealed as acceptance.

This adds no product controller, storage schema, asset recipe, renderer override, hair change or new fit claim. Production build validation remains root-owned and separate from this dev-server integration probe.

The unlaunched v1 controller, manifest and preflight remain preserved. Independent review found that validating only present retirement records did not prove receipt completeness; v2 adds the exact eight-owner bijection and actual-versus-synthetic distinction before acceptance. It adds no renderer workload.

Root’s first native UI attempt is preserved as rejected/partial after two groups. See [RESPONSE-REPAIR.md](RESPONSE-REPAIR.md) for the source-proved body-readback defect, strict304/redirect-chain correction, CPU controls and exact lifecycle limits. The corrected v3 source is ready for review and a fresh run; no product behavior was changed.
