> **Clarified by Robert, 2026-11-01:** "approved eyes" means the eyeballs only (iris and sclera). Eyelids, lid shape, lashes, brows and the rest of the face are **not** approved and still have open corrections; see `docs/EMBER-AVATAR-NEXT.md`.

# Ember hair v002 — sampler integration source reviewed

October 31 local / November 1 UTC. ACTIVE under Robert's resume. This is the separately scoped source preparation and review following the consumed [first-guide sampler check](../ember-2026-10-31-hair-sampler-check/README.md). **No compilation, curve diagnostic, new mesh, browser operation or image occurred.** The live retained character remains [local-feature-v001](http://127.0.0.1:5173/ember-local-feature-v001.html).

## Concrete change

`tools/ember-hair/compile-v002.mjs` and `run-v002.py` are isolated copies of the preserved v001 compiler/watchdog. The new `sample-adaptive-v002.mjs` carries the tested deterministic selector: initialize at control knots, split the interval with greatest quarter/mid/three-quarter chord deviation, break ties by earliest interval, and validate seven fixed interior samples. It stops at the unchanged 40-interval ceiling or a failed 0.350 mm sampled tolerance; validation never triggers further refinement. These are sampled conditions, not continuous error bounds.

Each ribbon records its own ordered parameters and interval count. Original curve parameter `q` drives position, tangent, roll and inner coverage. Normalized `t=q/endFraction` drives width, root blending, camber and atlas-v. Indexing uses that ribbon's actual count and vertex base. A sampling failure now names its guide/ribbon and preserves the original cause. The curve controls and endpoint fractions are unchanged. Discrete frame transport still needs the later construction checks; source agreement cannot establish the resulting surface or appearance.

The v002 HTML/viewer/component differ only in hair paths and version labels. Face, approved eyes, retained brows, skin, cameras, expression weights, lighting, material and atlas remain exact. Root-row anchors, scalp/ear allowlist, eleven inner guide portions, frame and face-orientation checks, full-surface/triangle-crossing clearance, and morph-aware browser attachment are preserved. All v001 artifacts and all 27 inputs from the consumed diagnostic rehash unchanged.

## Exact review and workload

[Preflight](preflight.json) SHA-256: `0ad041c25474a06e96d6ef21e2a51048a984b8555ee998f59b9f56a4397e9d5d`, binding 26 current inputs. Its atlas evidence is reused from the frozen v001 preflight after texture hashes matched; no atlas probe was replayed. Four JavaScript files and the watchdog passed syntax parsing without importing or executing the candidate. [Root verification](root-source-verification.json) confirms byte-identical protected constructor blocks and path/label-only viewer changes.

Independent `local_feature_critic` verified the actual source, manifest, unchanged v001 inputs and [workload arithmetic](source-workload.json), and found no blocking source issue. Root independently agrees. [Source review](source-review.json) records **source-ready, `admitSingleBuild:false`**. No further diagnostic or source revision is needed before a separate build-admission decision.

Maximum source-derived geometry is 14,760 vertices and 19,200 triangles, within the unchanged 24,000/32,000 ceilings. The selector has a 1,024-evaluation guard per ribbon; the conservative uncached request bound is 725. Geometry evaluation adds at most 14,760 point calls. The existing 10 CPU-second / 15 wall-second / 512 MiB observed-RSS, 2 million collision-pair and 10 MiB output limits remain fixed. These bounds make the workload finite; they do not promise that every guide or clearance check will succeed within it. Parent sampling can miss a short-lived RSS peak; the worker also checks its observed RSS.

## Next responsibility

Root may make and record the **separate admission of one supervised v002 compilation** against this exact manifest, after checking chat/job ownership, unchanged inputs and supported review availability. The completed source review is sufficient; do not repeat the first-guide diagnostic or manufacture another source loop. The launcher remains blocked until `admitSingleBuild:true` is explicitly recorded. This source-only slice has not made that decision or run the launcher.

One failure stops and preserves its concrete guide/check witness; no automatic retry, threshold relaxation, control edits or larger budget. Only a completed structural build can proceed to the original four fixed witnesses: front reference-smile close-up, angled full hair, rear coverage and head-turn attachment. No old baseline recapture or extra camera fit. Root and critic must inspect actual images before any hairstyle/finish judgment.

Preferred next choice is that single bounded compilation, which exercises the reviewed sampling integration while preserving the intended curve. Changing the lower wave controls instead would alter the hairstyle before visible evidence supports it and is not selected. Other guides, ribbon surfaces, root motion and clearance remain untested. Hair has never rendered; likeness, finish and expression meaning remain unaccepted, and known mouth/speech clearance remains unqualified.

Ownership was checked against chat `01a194ba-ffd1-7841-b0cd-2d40e0ac1924` (idle). Only the retained Vite service appeared in the declared job census. No owned build/render/check job remains. The earlier review page and server were left untouched. Preserve the complete animated Ember milestone, cozy outfit/bare feet and full AAA, representation, wardrobe, coupled-fit, motion, performance, VTuber and Mii roadmap.
