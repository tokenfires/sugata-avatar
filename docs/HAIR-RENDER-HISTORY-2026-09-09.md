# Hair render history — audit, 2026-09-09

**September 13 update:** the owned runtime integration is now implemented; see [current qualification and limits](HAIR-RENDER-HISTORY-2026-09-13.md). The prototype evidence below remains historical.

**Historical audit status: proposal only at the time of this record.** Six CPU witnesses pass; no GPU history test or implementation has run. Production `HairVelocity` still uses its documented `hold` approximation. The only source edit associated with this record corrects the header's stale **REQ-073** reference to **REQ-077** in `docs/OPEN-REQUESTS.md`; it changes no executable code.

The later [exact-card qualification](HAIR-CARD-HISTORY-2026-09-09.md) records passing numerical,
appearance and lifecycle gates, plus a real live-export blocker. It supersedes the no-GPU status
above; the strict V3 prototype remains unshipped.

Current `Avatar.update()` advances motion and then calls `Stage.draw()`; `step()` adds GPU/compositor waits. The stage's automatic loop reaches the same draw boundary. The lookbook's PNG action also calls `Stage.draw()` directly, without updating physics. HairDynamics may run zero to four fixed substeps, contacts after each, then one final ribbon rebuild; zero substeps skip rebuilding. These are distinct simulation and rendering boundaries.

## Six CPU witnesses

| Witness | Result | Evidence type |
| --- | --- | --- |
| Two rebuilds before a render, displayed position 0 → updates 1, 3 | Copying before every rebuild reports 2; displacement from the displayed state is 3. | Arithmetic scheduling example |
| Render position 3 again without rebuilding | The old rebuild snapshot reports 3 again; deformation should be 0. | Arithmetic scheduling example; relevant to draw-only and zero-substep calls |
| Two render IDs inside one NodeFrame ID | Installed `PassNode` executes once; the next frame ID executes again. Counting `Stage.draw()` calls alone cannot establish fresh scene execution. | Actual Three r185 `NodeFrame.updateBeforeNode()` with a counted PassNode update |
| Two object updates in one NodeFrame ID | Installed `VelocityNode` holds previous object x=1 but previous camera x=0; the prior object draw used pair (1,1). | Actual r185 update/updateAfter methods; not an observed normal-Avatar double-render defect |
| Copy deferred until an asynchronous completion continuation | Frame 1 can be submitted, simulation become 2, then the continuation copy 2. | Scheduling counterexample; no GPU timing claim |
| Card storage and cap fallback | bob01 has 16,864 card vertices / 8,432 particles; one padded vec3 history array would be 269,824 bytes. Outside the card range, retaining `positionPrevious` preserves prior skinning; selecting `positionLocal` does not. | Count/arithmetic check plus actual GLB POSITION accessor count 17,516, including 652 cap vertices |

The unconditional copy at the top of the rebuild suggested by REQ-077 is insufficient for this contract. Its cap fallback also needs correction when implemented. The header's particle-count-sized buffer suggestion remains a proposal, not implemented allocation.

## Proposed boundary

The velocity for rendered frame f uses the perspective-divided difference between `P_f V_f M_f p_f` and `P_previous V_previous M_previous p_previous`. Card position and object/view/projection matrices must belong to the same accepted beauty frame. The solver's per-substep velocity cannot reconstruct previously rendered card edges, whose width, transported twist and contact corrections also matter.

A Stage-owned beauty observation should distinguish the actual main scene pass and successful beauty submission from shadow work and cached outer draws. Previous history remains unchanged throughout the passes of that image. Submit history copies in GPU queue order **before yielding to another update**; waiting for a GPU-done promise before enqueueing the copy is unsafe. A failed submission, reset or retired owner cannot publish normal history.

| Candidate | Useful scope | Boundary that must be explicit |
| --- | --- | --- |
| Guarded one-buffer snapshot after beauty | Small first prototype on the current single-Stage, single-camera beauty path. Copy current final cards only when that beauty consumed the current scene version. | A cached scene/resolve must not cause current, unrendered solver positions to be promoted. Reject/invalidate an ambiguous version; do not silently claim exactness. |
| Two buffers: pending scene snapshot + committed beauty snapshot | Handles the existing public debug/beauty view switches and cached scene consumption. Tag candidate cards and matrices to the scene target version; commit that candidate when beauty successfully consumes it. | Example: debug renders p1, physics advances to p2, beauty consumes cached p1. Committing p2 would describe an image never shown. This design remains untested on GPU. |

Neither candidate should advance history on shadows, physics substeps or an outer draw that only reuses an already committed image. A new draw-only beauty frame records unchanged card positions, so its deformation becomes zero while camera/object motion remains represented.

Three's matrix history has different boundaries: camera history advances by its internal animation frame ID; object history uses object updateAfter, including compilation paths. For a full exact-card claim, matching previous/current matrices need the same beauty ownership as the card snapshots. The existing material MRT override is a possible public seam; preserve other MRT/OIT fields. Keep TAAU's unjittered projection object and hooks stable. Merely exposing a `positionPreviousNode` does not prove those lifecycles agree.

## Small next implementation slice

Start in a scratch, opt-in g050 Avatar using today's main beauty camera, normal `update/step`, and the real PNG-style draw-only call. Borrow final card positions read-only; leave solve/contact/rebuild math unchanged. Add source/write/reset generation observation, one committed history buffer and a fresh-scene guard. Keep `hold` as the unchanged default. First prove the snapshot and projection numerics on those actual calls before implementing the second pending buffer or widening the API contract.

Seed only initialized post-reset rebuilt cards. Detach render observation before `disposeHair()` deletes borrowed solver storage; preserve pending-load generation guards. Caps retain their existing skinning path and are not certified exact by a card-only buffer. Raw custom compute orchestration and unusual multi-camera/multi-pass uses remain outside this first slice rather than becoming prerequisites for it.

Decisive follow-on gates are: last-beauty GPU readback under 0/1/2/4 substeps and repeated draw-only calls; a known moving-lock velocity oracle that rejects `hold`; a copy-before-rebuild control that rejects the two scheduling examples; current camera/rigid-transform/projection cases; shadow and cached-view commit counts; reset/swap/retirement cleanup; unchanged physical arrays. Decode the RG16F velocity attachment correctly. Moving visual quality and cost must pass separately; existing static HairVelocity checks alone cannot prove exact moving history.

Camera-facing followers remain a separate follow-on: their previous billboard expansion needs previous camera/object transforms and previous edge/tangent/width data. Using today's billboard orientation with old guide centers is insufficient. This record does not add follower implementation or clearance requirements to the first card-history probe.

## Evidence ledger

The ignored archive is `captures/hair-render-history-2026-09-09/`. It retains the exact passing scratch script, result/log, original longer proposal and audited source snapshots. Four witnesses are scheduling/arithmetic examples; two execute installed Three methods. No production rendering defect beyond the already documented hold limitation is claimed from these CPU cases.

- Manifest: `manifest.json`, 16 payloads, SHA256 `8e0c1af9173250ac02d3fc3a5bb66d3b701f7adf54bfdcf2f52306c32042560f`.
- Original HairVelocity SHA256: `6751eb82a974a31cf842fd4f08c08233993ca474cf226bf76d6728f945793231`.
- After the sole request-reference comment change: `867d2cbec525d130c4542b6cf9b7fbc25c2a71b035af02a9e0645318d7372bd3`.
- Audited g050 bob01 GLB: `db3565bb7272dcc82a2892ce042886f23c1a09aed66ea563a9e33cfa7ee1b72b`.

`audit.json` carries the complete source hash list. `audit.mjs` is the original scratch script with absolute import/output paths; its ordinary rerun recreates the six checks but not the separately appended source attestation. The original proposal is retained verbatim; the next slice above narrows it to current application calls. No GPU performance or history-correctness result is implied.
