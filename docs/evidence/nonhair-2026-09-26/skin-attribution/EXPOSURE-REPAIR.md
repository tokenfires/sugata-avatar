# Rejected first capture: distinguish the three exposure owners

Native v1 is rejected and partial. Its first default arm completed64 indexed zero-delta draws with the required native temporal/grain phases, then the controller incorrectly required `renderer.toneMappingExposure === 2.04`. The actual value was1. No geometry artifact or PNG was reached, and none of the three arms completed. The exact report/controller/runtime/selftest/manifest are retained unchanged under `rejected-native-v1/`; `receipt.json` binds the originals under `captures/skin-micro-attribution-2026-09-26/native-v1/`. Report SHA-256: `be53d2171da16a709f17c8f9e45df40ef3ab6c22633212e2001dff6775c93f10`.

The retained values establish three separate owners:

| Owner | Actual v1 value | Source mechanism |
| --- | ---: | --- |
| `stage.renderer.toneMappingExposure` | 1 | `Stage.js:295` initializes the renderer setting to its default1. |
| `stage.grade.exposure.value` | 1 | `Grade.js:266` initializes the uniform to1; `Grade.js:422` passes it to the tone curve. |
| `avatar.lights.exposure`, reported as `report().scene.lighting.exposure` | 2.04 | `Avatar.js:1396` constructs the rig using calibrated0.85 times the resolved scene multiplier2.4. `Avatar.js:2573` reports that rig value. `LightingRig.js:2282,2639` multiplies authored irradiance by it. |

`LightingRig.js:259` defines0.85; `Scene.js:1096` defines Kitchen's relative2.4. The first correction hypothesis—that2.04 belonged to Grade—was also wrong and was rejected against the actual report. Both renderer and Grade retain1. The lighting number is an irradiance multiplier, not a tone-curve gain. No exposure value, light, calibration or product source has been modified.

The repaired receipt names `rendererToneMappingExposure` and `lightRigExposure` explicitly alongside `grade.exposure`. The controller validates renderer1, Grade1 and reported LightingRig2.04, and separately requires direct actual light-rig readback to equal its report. These are the current native ownership semantics, not an exposure adjustment. All existing material, geometry, history, exact returned-default PNG, source/asset and disposal gates remain unchanged.

The seventh CPU group reads `rejected-native-v1/exposure-owner-fixture.json`, an exact extract from the failed report. It accepts the three observed values and rejects assigning2.04 to either renderer or Grade, or assigning1 to the light-rig report. The earlier native-shaped fixture's renderer value was likewise corrected to1 and now includes the distinct light-rig owner. This is a focused instrument regression, not another native capture.

The v1 cleanup observed disposed=true, no leaked handles, every native memory counter0, no captured WebGPU errors/losses, no browser errors and stable source bytes. That clean retirement does not complete the attribution experiment. Root will run a fresh v2 only after source review; no GPU was launched for this repair.

- Controller `ac80acd9db724213bf2caf093e6da5202872202d3cf8154e387191beb73f51b4`
- Runtime `5123724755f3aa4770b5e7aaaa198686b8dd851fa43e43913bd06301fe9a7903`
- Fixture `938a3dd4097e756547015893e48e3ddf42522b451712c70f953e4390e9e91a2a`
- Manifest v2 `55816a1a111e6a6d9baad3b632d5d7c33bb93692eae2f3541574d8097e1d909e`
- Preflight v2 report `1bdf79c66b1aed9ea24ae6d52161cd45f751935ebcfbd17b1f3269b6f78c9a0e`

`cpu-v2.json` records all seven passing CPU groups; fresh preflight binds1,586 files. The manifest includes the actual failure fixture. Existing v1 source/evidence remains intact.
