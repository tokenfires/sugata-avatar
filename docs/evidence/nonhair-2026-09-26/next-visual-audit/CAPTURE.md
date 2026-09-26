# Palette reference capture — prepared, not yet run

Root owns the serial native launch. `capture-palettes.mjs` has separate CPU-only `--write-manifest` / `--preflight` modes; only `--capture` imports the native browser launcher. Candidate UI remains isolated under `candidate/`. No product source, assets or dependencies have been edited by this slice.

The current preflight is **v3**: manifest `capture-manifest-v3.json`, SHA-256 `5a30308709c8211e9c079bcfee398fb66e15dec2ed518844bc8593581e4da538`, with 1,577 source/asset/dependency files. Syntax checks and the CPU source/accepted-asset preflight pass. This does not prove native capture readiness or visual quality.

After independent source review and root GPU authorization:

```sh
node docs/evidence/nonhair-2026-09-26/next-visual-audit/capture-palettes.mjs \
  --capture docs/evidence/nonhair-2026-09-26/next-visual-audit/capture-manifest-v3.json \
  captures/wardrobe-palette-references-2026-09-26/native-v1
```

The output must be fresh. If any bound source changes before launch, do not edit the old manifest: make a new named manifest and CPU preflight, then obtain source-review clearance for any controller changes.

The original `/src/showcase.html?capture` startup runs intact, at 1100 × 1000 / DPR1. Each of the two authored presets retains its accepted groom, with Ecru / Charcoal / Original compared only within that preset. Each reference uses 64 public zero-delta steps and native ready checks. The controller clicks the real Save image button and saves its PNG download verbatim: no raster conversion, cropping, material override, render-clock replacement, camera changes or native update wrapper.

Full finite CPU-skinned body/worn vertices, complete source topology, exact drawn subsets, rig, morphs and camera are compared exactly across styles and before/after export. This is CPU geometry at the native current pose, not GPU vertex readback. Full numerical states live in content-addressed gzip files: identical states share one archive; a differing state is saved before rejecting its comparison. Fully covered foundations remain represented with full geometry and an explicitly empty native drawn subset. Their range start/count/index count explains the empty mask; no mesh is silently omitted.

Each case records exact attached configuration/native report, loaded response hashes, PNG dimensions/hash, and page-owned cleanup. All core/testbed/Three/Vite source bytes are frozen, while actual loaded asset/served response bytes are retained once by content hash. Source and response archives are reread before sealing. The original page's nonpersisted pagehide handler is invoked for retirement; this is labelled a handler fixture, not actual browser-history/bfcache evidence. The capture closes every owned context, browser and Vite server, including failure paths. A failed partial capture remains evidence, never an accepted six-image set.

Raw startup console warnings are retained separately from errors. Page errors, console errors, failed requests, HTTP failures, asset/source drift and cleanup failures reject completion. Browser version remains required. Only the exact known CDP “Command line not returned because --enable-automation not set” refusal is recorded as unavailable corroboration. Pinned MotionProbe launch flags are source declarations, not an actual process observation; this image capture makes no performance claim.

Unlaunched v1 and v2 controller bytes, manifests and preflights are preserved. V1 had an unnecessarily mandatory command-line metadata call. V2 corrected that but incorrectly required nonempty drawn indices for a retained fully masked foundation. V3 explicitly models native draw ranges while retaining complete geometry and exact masks. Neither superseded preflight is native evidence.

After a completed seal, independently view all six unchanged PNGs and their matched state receipts before copying selected files into testbed static imports. Root then integrates the small module/CSS and runs the focused interactions in `README.md` / `candidate/INTEGRATION.md`.
