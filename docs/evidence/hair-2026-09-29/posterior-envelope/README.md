# A coherent rear field for the medium bob

**A visible static advance, preserved as an experimental asset.** Replacing the crossing posterior paths with a shared smooth directional field produces substantially cleaner downward flow. The improvement remains visible with the original dark material. Accepted hair assets are unchanged; moving qualification is in progress.

| Accepted control | Frozen candidate v3 |
| --- | --- |
| ![Original crossed rear field](../../../../captures/bob-posterior-envelope-v1/control/casual-rear-oblique-medium-brown.png) | ![More coherent posterior flow](../../../../captures/bob-posterior-envelope-v3/neutral/casual-rear-oblique-medium-brown.png) |
| ![Original dark rear field](../../../../captures/bob-posterior-envelope-v3/dark-control/casual-back-exact-default.png) | ![Candidate with the same original dark material](../../../../captures/bob-posterior-envelope-v3/dark-candidate/casual-back-exact-default.png) |

## Why this changed direction

The [source trace](../authoring-trace/README.md) located sharp bends introduced during clearance adjustment. A [two-card intervention](../clump-clearance/README.md) improved those curves numerically but produced little overall visual gain. Root and critic rejected its adoption and stopped the local endpoint/frame loop.

This prototype replaces paths on existing cards across the posterior field. It does not add another curtain over the original disorder. The earlier rigid-curtain failures remain relevant rejection examples: broad panels, repeated slots and comb-like ends must not return.

## Construction and measured recovery

The v1 recipe selects 266 existing cards by their original root position, excluding the fringe. Cubic paths share an elliptical support derived from actual head/ear bounds, with outward body and a small inward terminal return. Original root centres and width magnitudes are preserved within floating-point roundoff; width directions are rebuilt along each path. Rooted runtime ownership and existing topology remain in place.

The clean-looking first prototype failed body clearance. Two explicit, recorded steps recover that failure without hiding it:

| Version | Evidence and decision |
| --- | --- |
| v1: shared posterior paths | Clear appearance gain, but 469 selected triangle/body pairs at rest across 18 original cards. Keep as a failed control. |
| v2: bounded curve-level fit | Evaluate every selected card using vertices and triangle lattice points; lift one cubic control point within a 40 mm bound. Twenty-seven cards fit. Card 47 fails the bound and retains v1 geometry; 30 body pairs remain. Keep as a failed control. |
| v3: exact accepted-card fallback | Restore only original card 47's position/normal bytes. All 8,512 selected triangles have zero rest-body intersection pairs; minimum selected vertex clearance is 3.612 mm. No obvious new diagonal appears in the actual reviewed images. Freeze these bytes for motion qualification. |

Final asset: `captures/bob-posterior-envelope-v3/candidate.glb`.

SHA256: `d477f9079577f1205b706941a789b608a3dbb6974a022a6888251737abb26146`.

The independent [critique](CRITIQUE.md) includes exact image regions, numerical/source witnesses, two alternatives for each actionable issue, and the tradeoffs behind both recovery decisions. The separate earlier nape/distal candidate remains frozen and is not combined into this asset.

## What is controlled

The [static isolation audit](../../../../captures/bob-posterior-envelope-v3/static-isolation.json) verifies 9,010 changed position records and 9,010 changed normal records, all within the 265 declared changed cards. The restored card, other cards and cap retain their authored positions/normals. Both UV sets, joints, weights, triangle topology, rig and material metadata match the accepted source.

Five neutral medium-brown pairs and three original-dark Studio pairs have matching recorded clocks, camera/rig/fixed controls, lights and material. Native images and geometry files are hash checked. All nonselected authored positions are exact. Nonselected live arrays contain a microscopic two-component residual on card 49: each x coordinate differs by 0.0000149012 mm. This is not an observed visible defect; it prevents a claim of bit-exact live isolation.

Root and the critic inspected the actual intact images. The central crossed field, tongue and lateral nape hook are substantially improved. The remaining blunt hem, crown/forward-side irregularities and limited rounded inward return keep this from completing Robert's medium-bob target. Face-opening asymmetry remains unfinished. Short, wavy and tousled variants remain separate.

## Qualification limits and next step

Rest clearance covers the selected hair triangles against the figure body. It excludes garments, hair-hair contact and other groom cards; alpha is not sampled. Geometric pair counts are not visible-clipping counts. No rest or still-image result establishes moving quality.

The frozen candidate is undergoing one matched 12-second ordinary procedural-stack comparison, seed `20260807`, at 60 Hz with per-update selected-hair/posed-body geometry and 20 fps native images. Source, body, rig, clock and shared fitted colliders must be compared. No path, hem or material changes accompany that comparison. See the [live recovery checkpoint](../../../OVERNIGHT-2026-09-29.md) before starting any job.

Reproduction tools are `bob-posterior-envelope.mjs`, `bob-envelope-clearance.mjs`, `bob-envelope-fallback.mjs` and `audit-bob-envelope-static.mjs` under `tools/critic/`. Each writes a new capture-local version and refuses to replace existing evidence. [Summary](summary.json) and [archive manifest](archive-manifest.json) pin the retained reports, sources and images. Nothing was pushed or published.
