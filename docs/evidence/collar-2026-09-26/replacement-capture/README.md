# New collar capture adapter — engineering preflight

This adapter prepares a **new current-runtime qualification**. It does not recover the missing
historical mild-pose inputs or claim equivalence with the old frozen coverage replay. The
historical scripts, installed accepted garment, core, foundation masks and hair remain unchanged.
The engineering checks and both native smoke slices pass. Version 2 adds separately native-worn
bra and vest families. Its larger capture was deliberately stopped with **8 of 16 cases complete**
after a provisional fixed-support vest-crossing witness. One interrupted ninth case and seven
unstarted cases remain explicit; no full qualification or asset promotion is claimed.

The new files are `tools/figure-pipeline/collar_replacement_manifest.mjs`,
`collar_replacement_capture.mjs` and `collar_replacement_manifest.selftest.mjs`. The capture
imports the existing `collar_capture_browser.mjs` setup, native step, physical-state, shader
and CPU-skinned snapshot helpers. It routes verified bytes through the actual Showcase wardrobe
loader and verifies the actual returned GLB response hash. It does not edit mesh buffers after
loading, invoke a fitting recipe, or export a garment.

## Manifest contract

The current version-2 manifest must name its qualification, explicitly set `historicalReplay:false`,
use seed `20260807`, include both current bobs, both sequences and the explicit foundation list
`["foundation_bra","foundation_vest"]`, and pin the exported `PROFILES` and `CAMERA` objects
without modification. Original version-1 manifest/smoke files are retained with their own frozen
adapter source; they do not claim the later vest scope. The manifest supplies repository-relative entries:

```json
{
  "assetPath": "assets/wardrobe/female_casualsuit01/g050.glb",
  "sha256": "44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783",
  "role": "accepted-installed"
}
```

The accepted installed role and `frozen-interior` role are mandatory; the latter must match
`d81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a`.
Its retained path is `captures/collar-stress-2026-09-22/gpu-v1/assets/collar-interior.glb`.
One optional `trial` entry must have distinct exact bytes. A trial entry does not itself prove
support, displacement, topology, weights, masks or fit eligibility; those are separate gates.

`collectSourceHashes()` pins current core/testbed source, assets, package/Three metadata and
the imported/new capture instruments. `verifyCaptureInputs()` rejects incomplete manifests,
wrong mandatory identities, escaped paths, changed asset bytes and source/instrument/asset
inventory drift. The full source map is checked before and after each run and at completion.
The manifest itself is also hash-bound. Source text is copied into a capture; assets are only
read and routed. A reviewed manifest must be created after concurrent source edits settle.

```sh
node tools/figure-pipeline/collar_replacement_manifest.selftest.mjs
node tools/figure-pipeline/collar_replacement_capture.mjs MANIFEST.json FRESH_PREFLIGHT --preflight
# Only after the parent grants the serial GPU slot:
node tools/figure-pipeline/collar_replacement_capture.mjs MANIFEST.json FRESH_SMOKE --smoke
node tools/figure-pipeline/collar_replacement_capture.mjs MANIFEST.json FRESH_VEST_SMOKE --smoke-vest
node tools/figure-pipeline/collar_replacement_capture.mjs MANIFEST.json FRESH_CAPTURE --capture
```

All modes refuse an existing output directory. Preflight opens no server/browser. Capture
records available disk and requires at least 4 GiB free as a conservative run guard, not a
measurement of expected output size. Both paths preserve the installed accepted SHA.

## Exact new sequence

- Expressive: 1,080 continuous native updates at 60Hz, with happy, angry and fearful commands
  at steps 0, 360 and 720. The existing `feel(label,1)`, PAD vector and six-second synthetic
  `say` gesture schedule are reused. Two actual bilateral returned gestures are required.
  Peaks come from each returned schedule, never from assumed historical peak numbers.
- Mild: 360 native updates at 60Hz. One second of untouched neutral idle precedes actual
  **Look toward me** at step 60, using the existing neutral attention action. Actual **Release**
  is clicked at step 240; native stepping continues to 360. Before/after action phases and
  unchanged neutral affect targets are recorded. Automatic release is not assumed.
- Both use the existing stress portrait camera: 25-degree yaw, focus lowered by 0.03m, camera
  0.04m above that target and horizontal radius multiplied by 1.25. The 1280x1050 viewport,
  DPR1 and ordinary ecru casual outfit are explicit. Bra and vest use separate native runs.
  Before helper clock setup/warmup, the normal foundation preference and dress APIs select the
  requested foundation. The exact worn set, actual foundation loader hash, full vertex count and
  complete source triangle indices are checked; a vest pose is never reconstructed from bra data.
- Ordinary PNGs are sampled every three steps: **20Hz image review**, not 60Hz video. Geometry
  snapshots occur every 30 steps plus each actual gesture peak ±2 and applicable 98/99/270/720
  anchors. The mild sequence has 15 snapshots; expressive count depends on actual peak overlap.
- Commands are issued after rendering their named step and before its snapshot. Thus the
  step-720 geometry still represents the just-rendered previous phase while telemetry records
  the new command. The following native update applies it; the report states this boundary.

Snapshots retain `{time,rig,meshes:[{id,positions,fullIndices,drawnIndices}],telemetry}` from
the existing helper, including full body indices, actual selected foundation and outer garment. An
optional coincident interior and explicit capture/asset/source identity are added. Each gzip
and decoded JSON receive hashes. These are CPU-skinned world geometry at discrete rendered
poses, **not GPU vertex readback or continuous collision proof**. No missing intermediate
contact may be inferred from clear sampled poses.

The gate records actual configurations, native seed, source hashes, GLB loader receipts, actual
gesture schedules, attention phases, renderer epochs, physical state, compiled shader hashes
and disposal. Compared assets must preserve the accepted control's physical/affect/attention
states and commands at all saved steps. Any browser, late disposal, byte, source, cadence or
paired-state invariant failure leaves the report incomplete and stops the run. Garment comparisons
are grouped by hair, sequence and foundation. Separately, bra-versus-vest comparisons record actual
body/outer bones, morphs, clocks, renderer epoch and numerical posed coordinates without requiring
foundation geometry, visibility or drawn masks to match. Different physical poses remain distinct
actual families rather than being transferred or silently normalized.

## Original CPU status and boundary

Five focused CPU groups pass in [cpu-check-v2.txt](cpu-check-v2.txt): the actual native identity
schema, manifest/identity/timing rejection, optional trial identity, regular/anchor/dense
schedule coverage and actual baseline byte verification with source/byte drift rejection.
Before any GPU use, root caught a schema mistake in the draft: the runtime reports bake
`figure_g050`, not the asset suffix `g050`. The shared expected constant now matches the ten
retained native framing observations, bound by the [schema witness](identity-schema-witness.json).
The initial four-group CPU log is retained and superseded; no failing browser run is implied.

The accepted and frozen assets remain unchanged. CPU tests alone do not establish browser
behavior. The parent owns the named protocol and grants GPU execution separately.

## Named manifest and first native smoke

[Manifest v1](manifest-v1.json) binds `collar-replacement-2026-09-26-v1`, the named protocol
document's digest, 354 current source/asset/instrument hashes, installed accepted bytes and
retained frozen-interior bytes. Its SHA-256 is
`9571c3d6854316181cafa5fc8d292d1c681d02c924d6bee812194d09472666aa`.
[CPU preflight](preflight-v1/report.json) succeeds and records about 2.83 TB available before
capture. No trial entry exists.

The separately authorized [native smoke report](smoke-v1-report.json.gz) runs only
`accepted-installed / bob02 / mild`, using the complete prescribed six-second mild sequence.
The [compression receipt](smoke-v1-report-receipt.json) binds encoded and decoded bytes;
the original JSON and complete raw smoke directory remain locally retained.
The actual loader response matches `44eb…`; setup reports native `figure_g050` and WebGPU.
The run saves 121 ordinary images and all 15 planned geometry snapshots. At step 60 the actual
attention state moves idle → attending. At step 240 the actual Release moves attending →
releasing. Neither UI action advances the simulation clock or changes the zero affect target.
The 360-step sequence finishes with no page, console, request or HTTP errors; selected sources
stay exact. Every reported renderer memory counter is zero after disposal and no Avatar handles
remain. `qualificationCaptureComplete:false` distinguishes the smoke from the originally planned
eight-run bra comparison, subsequently extended to sixteen genuine bra/vest runs.

The author inspected the ordinary step-0 PNG: the complete casual garment and collar are in
view, and the accepted baseline's visible gray/opening defects remain. This is a capture-path
check, not an improved fit or appearance verdict. Full comparison and independent critique are
still required. The current snapshot workload contains the actual worn bra only. Posed vest
coverage is explicitly outstanding; the preferred follow-up is a separately native-worn vest
run with loader receipts and exact matched body/outer/rig/clock comparisons, not a guessed rigid
reconstruction or an in-place foundation mutation hidden inside the bra trace.

## Version 2 foundation adapter

[Manifest v2](manifest-v2.json) preserves qualification ID `collar-replacement-2026-09-26-v1`
and adds both explicit native foundation families. Its SHA-256 is
`cc3ba48bc129d3ece111bba0dab841c242602a34d3412c1ae4b6819984ab26eb`.
It pins 355 source/asset/instrument files, including the CPU GLB reader used to verify actual
foundation topology. [Six CPU groups](cpu-check-v3.txt) pass, including mask-independent pose
comparison controls and actual source/asset drift rejection. [CPU preflight](preflight-v2/report.json)
passes with about 2.83 TB free. No trial asset exists.

Raw version-2 frames, discrete posed snapshots, reports and frozen sources live under
`captures/collar-replacement-2026-09-26/`. Compact summaries and selected witnesses belong here;
the original `smoke-v1/` is retained in place. These local archives are required downstream inputs
and must not be removed merely because compact receipts exist.

The [vest smoke receipt](smoke-vest-v2-receipt.json) binds the complete successful run at
`captures/collar-replacement-2026-09-26/smoke-vest-v2/`: accepted installed garment, bob02, mild,
native vest. Dressing happens before setup at clock zero, and the actual outfit contains vest,
briefs, casual outer and shoes, with no bra. The selected response matches
`4804bd9e11c7aafacc19ca9fa3ded25fbbd2c4d72c25a17d566087ee09ba6152`.
All 15 snapshots match the actual vest source's 15,455 vertices and 28,832 complete triangles;
the final drawn subset contains 1,411 triangles. All 121 PNG hashes, 15 compressed and decoded
snapshot hashes, shader and frozen-source hashes were independently reread. Look at step 60
enters attending; explicit Release at 240 enters releasing; step 360 is idle with no gaze hold.
There are no browser errors, all renderer memory counters reach zero, no handles leak, and all
355 pinned source files remain exact. This is `qualificationCaptureComplete:false`.

The ordinary [step-0 image](vest-smoke-frame-0000.png) was inspected: the collar remains fully visible and still has conspicuous
jagged opening defects with the vest. That observation is evidence of remaining quality work,
not a reason to adjust the capture protocol or claim the vest fit passes.

The sixteen-run archive was launched with this exact command (its final outcome is partial):

```sh
node tools/figure-pipeline/collar_replacement_capture.mjs \
  docs/evidence/collar-2026-09-26/replacement-capture/manifest-v2.json \
  captures/collar-replacement-2026-09-26/capture-v2 --capture
```

`verify-capture.mjs ARCHIVE FRESH_RECEIPT.json` independently rereads every frozen source, PNG,
shader artifact, compressed snapshot and decoded snapshot against recorded hashes. It also
recomputes actual body/outer pose digests from saved geometry and checks selected native foundation
topology and loader identity. The [vest smoke archive verification](archive-verification-smoke-vest-v2.json)
passes for 394 artifact/source files and 15 decoded snapshots. Archive integrity remains separate
from numerical clearance/coverage and ordinary visual acceptance.

Four selected ordinary [comparison witnesses](witnesses/manifest.json) preserve exact PNG bytes
from bob02 expressive step 96, two steps before the actual returned happy peak. They cover both
garment identities and both real foundations. In this narrow inspected view, the frozen interior
reduces some gray side exposure; a small bra-side wedge and the vest's irregular opening remain.
This is an author observation about four images, not an independent appearance pass or a whole-
sequence result. Neither garment is promoted by these capture or archive checks.

## Intentional partial seal

[Stop receipt](stop-v2.json) and [independent partial archive verification](partial-v2-receipt.json)
bind the final raw report without rewriting it. The parent requested early termination following
a provisional fixed-support vest-crossing witness; geometric adjudication belongs to the separate
coverage evidence. By the time the stop message was handled, the ninth case had already entered
the loop. The owned capture controller was paused, only its owned Chromium process was terminated,
and the controller resumed through its existing catch/finally path. The expected target-closed
failure is preserved, with exit code 1 and `completed:false`, `qualificationCaptureComplete:false`.
Both owned processes exited and the serial GPU slot was released. No files were deleted.

- **Complete:** all eight bob02 cases: expressive and mild, bra and vest, accepted and frozen
  interior. These contain 1,928 ordinary images and 324 numerical snapshots. All completed-case
  browser error arrays are empty, disposal counters are zero, and no handles leak.
- **Interrupted:** bob01 expressive/bra/accepted through saved step 120: 41 images, 41 recorded
  states and ten numerical snapshots. All bytes remain, but this case is excluded from acceptance
  inputs and has no successful disposal receipt.
- **Not started:** the other seven bob01 cases. This is not a 16/16 result or a bob01 qualification.

The independent verifier reread 2,568 artifact/source files and all 334 decoded snapshots
(324 complete plus ten interrupted), checked selected native foundation topology, and recomputed
body/outer pose digests from saved geometry. Four complete accepted-versus-interior pairs have
identical native states and commands. All four complete bra-versus-vest comparisons have identical
sampled body/outer bones, morphs, clocks, renderer frames, rig and world positions. Foundation
geometry and masks remain different actual inputs. No continuous collision proof follows.

After shutdown, all 355 selected live source/asset hashes still matched manifest v2. The parent
was notified before subsequent testbed work was allowed. Later provenance checks must use the
257 frozen source files and manifest/archive hashes, not assume the evolving checkout still
matches. The original launch command intentionally refuses a drifted checkout.

The partial seal is reproducibly verified without opening a browser:

```sh
node docs/evidence/collar-2026-09-26/replacement-capture/verify-capture.mjs \
  captures/collar-replacement-2026-09-26/capture-v2 FRESH_RECEIPT.json --partial
```

Numerical clearance/coverage, ordinary visual assessment, any feasible collar correction and the
full remaining matrix stay separate decisions. No fitting candidate was produced or promoted.
