# Independent motion-capture source review

## Scope and disposition

Reviewed [PLAN.md](PLAN.md), [foundation-domain-motion.mjs](../../../../tools/critic/foundation-domain-motion.mjs), and the actual imported [snapshot/physical helper](../../../../tools/figure-pipeline/collar_capture_browser.mjs). No capture, native work, or product modification was performed by the critic.

The main six-owner observation is a useful bounded next step for the frozen candidate. It preserves the two exact foundation assets, ordinary native motion, the fixed seed, and the prior preparation sequence. The rear-view preparation mismatch identified below was corrected before launch. I found no remaining material source blocker to this declared observation. This is source clearance, not a result from execution.

Final reviewed driver SHA256: `faeb2670bcb7d445fc55446a337585ef318daa18fcd915d4c9c337483653aea1`.

## Main sequence and ownership

- The candidate URL alone is substituted; every received GLB body is checked against its expected hash. The source assets are pinned again at completion. Separate fresh owners cover each arm and each outfit.
- `autoStart:false`, stopping the renderer animation, and explicit frame/time/delta assignment establish one caller-owned sequence. `Avatar.step` updates and renders the actual subject, then waits for GPU completion and paint. The capture checks initial frame 99, seed 20260807, and recorded clocks at every retained image.
- The sequence has 720 updates at 60 Hz, 61 images at 5 Hz, and four complete CPU-skinned geometry observations at steps 0/240/480/720. This is not 720 sampled collision states or continuous playback evidence. The recorded pose/hair states are compared at those 61 retained image steps; complete non-foundation mesh snapshots are compared at the four geometry steps.
- Main matched snapshots exclude only the intentionally changed foundation bra. Rig, body, other worn geometry, full/drawn topology, and time remain in the four-state comparison. Setup also records and compares camera/projection, actual lights, identity, hair style, motion seed and enabled layers.
- Actual selected worn meshes are checked rather than inferred from an outfit string. The foundation owner explicitly undresses the outer clothes. Successful owners require empty recorded errors and clean disposal; the failure path retains its own disposal result.

## Full and drawn surfaces

`collar_capture_browser.mjs:75–82` obtains world positions with the live mesh's `getVertexPosition`, after updating matrices and skeletons. Full body topology comes from `wardrobe.fullIndex`; each garment's full topology comes from its preserved fragment index. Drawn topology is separately sliced from the active geometry index and `drawRange`.

This matches `Wardrobe.js:443` and `1008`, which preserve those original indices before mask rebuilding. The future full-body audit can therefore use complete surfaces even when the casual band has zero drawn triangles. These are CPU-skinned predictions from the actual owner, correctly labelled as such. They do not include a GPU-position readback or a garment self-intersection certificate.

One common audit may be reused across outfits only after proving equality of the actual full body and band arrays at the relevant sample. Matching times or bone names alone would be insufficient. The plan states this condition explicitly.

## Actionable rear-pose mismatch and alternatives

The reviewed initial driver at line 70 calls `a.step(0)` 98 times after changing the camera. The plan describes this as advancing only zero-time draw frames. Those operations are different: `Avatar.js:2012` calls `update`, and `MotionStack.js:258–280` increments its frame and evaluates every active layer even when `dt` is zero. A 12-second clock equality by itself does not prove unchanged terminal physical state. This is a source-level observer gap, not evidence that the uncaptured rear image already contains a visible error.

1. **Recommended A: perform renderer-owned `stage.draw()` calls without `Avatar.step/update`, and compare physical state, rig/morphs, and the full body/band snapshots before and after, excluding the intended camera change.** This makes the extra image a genuine alternate view of the terminal physical pose. It adds a small explicit state receipt and leaves temporal image convergence unclaimed.
2. **B: retain the zero-time updates, archive before/after full physical/mesh state, and label the result a separate post-zero-update observation.** This preserves the current preparation mechanism but gives up a same-terminal-pose claim if any state differs. The extra image remains useful with that narrower interpretation.

No change to candidate geometry, material, motion seed, or the 720-update sequence is needed for this correction.

**Prelaunch resolution verified:** the current driver at lines 70–83 selects A. It performs 99 renderer draws, with no simulation update, and saves compressed full before/after snapshots, physical state, and morph arrays before its assertions. It then requires exact full geometry/rig and morph equality, plus physical equality with only camera/projection/view fields excluded. The actual receipt is retained if the equality fails. This closes the identified source gap; successful execution remains required.

## Prepared four-pose clearance observer

Also reviewed [foundation-domain-motion-clearance.mjs](../../../../tools/critic/foundation-domain-motion-clearance.mjs), SHA256 `4c51d0d96fe563d43504c352017432287dc2b9b12d672974afa82bafc6be46aa`. It refuses an incomplete or differently hashed capture report, verifies compressed and decoded geometry payloads, and binds the exact candidate asset.

At each of the four declared steps it requires full candidate indices and body indices equal their source assets, then compares body/band arrays, rig, and time exactly across the three candidate outfits before sharing an audit. Drawn masks are deliberately outside that equality and the audit. Source-position welding defines body seam correspondence; the posed body must remain closed, oriented, connected, and have exactly zero separation of those source-welded copies before containment is used. It processes all 15,401 candidate triangles and preserves per-state partial output. Its `audited` status is distinct from `allFourStatesExterior`, so downstream reporting must read the latter rather than equate completed execution with clearance.

No new observer blocker was found in this source review. Actual completion, topology admission, correspondence, and fit results remain unobserved.

## Interpretation limits retained

The declared camera is an upper-body fit/neckline view. Complete hair, feet, and all-view appearance are expressly excluded and must remain so after viewing the actual images. Hair style is fixed as bob02 while its ordinary solver remains active; this is not frozen hair geometry. The source explicitly chooses medium-brown hair and Original wardrobe material.

The four later clearance observations cannot establish moving chest-target coverage. The plan keeps static chest rays separate and requires a new transported-target contract before claiming measured moving coverage. Actual foundation and dressed images can supply bounded visual evidence; casual-only imagery cannot expose the hidden band. Rest clearance, finite native/export skin agreement, image observations, and any later sampled moving fit result must remain separate receipts.
