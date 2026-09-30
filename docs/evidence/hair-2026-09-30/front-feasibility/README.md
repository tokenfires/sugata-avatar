# Front-ribbon reachability — September 30

## Decision

The first renewed-work slice establishes useful geometric limits. It produces **no new hair asset and no appearance improvement**. The next formulation must consider the full upper path and both edges; another global support-shell or handle sweep is unsupported.

Four original cards and four declared long-card observations all clear the pinned head at source rest: zero triangle/body crossings and zero negative sampled vertices. This does not make the derived ribbons good styling. One observation nearly collapses a segment; another removes the join bend by moving it upward. The [independent critique](CRITIQUE.md) records evidence and two alternatives for each actionable finding.

## Why this question

The [previous front attempts](../../hair-2026-09-29/front-support/README.md) introduced body penetration, inflated arches and angular fans. Root re-inspected R2, the actual front control and the actual supported-front render before this slice. The [appearance brief](../../../research/bob-appearance-brief-2026-09-29.md) still calls for continuous rooted flow, a smooth medium-bob volume and complementary face framing. The photographs do not require the prior prototypes' temple endpoints, side assignments or a zero-degree discrete join.

The frozen four-card inventory leaves only ring 1 movable for long cards 145 and 204. An endpoint-only solver could return their already-clear original geometry and falsely appear to answer the styling question. This experiment instead states its diagnostic constraints before computing two observations. It is not a search, optimizer or new whole-front construction.

## Short-card necessary bound

Any curve's arc length must be at least its endpoint distance.

| Card | Original arc | Requested endpoint distance | Minimum arc growth |
| --- | ---: | ---: | ---: |
| 7 | 88.288 mm | 194.207 mm | 2.200× |
| 46 | 77.204 mm | 185.179 mm | 2.399× |

These old experimental temple endpoints cannot be reached while preserving the original short-card lengths, even before accounting for the head. Length preservation was **not** a constraint in the rejected generators; the result exposes a design choice, not a retrospective violation. Card 7's first tangent also points toward positive X, while the old heuristic assigns a negative-X temple endpoint.

Keep the original short cards for now. Their endpoints and coverage role need a deliberate decision before extending them into long face-framing strips. No short-card route was constructed here.

## Two declared long-card observations

For fixed root centre `c0`, fixed join `c2` and unit outgoing suffix tangent `t`, an exact incoming centreline tangent requires `c1 = c2 − λt`, with `λ > 0`. Let `d = c2 − c0` and `L` be the original two-span prefix arc. For these cards, `L > d·t`; imposing `|d − λt| + λ ≤ L` gives:

`λ ≤ (L² − |d|²) / [2(L − d·t)]`.

The derivation's squaring condition `λ ≤ L` is satisfied by the no-growth observations. This characterizes the centreline length inequality only. Width, body geometry, visible coverage and motion remain separate questions.

- **Preserve prefix arc:** choose the upper bound for λ.
- **Preserve final span:** choose the original ring-1-to-ring-2 distance for λ and explicitly allow the resulting prefix growth.

For each observation, translate both original ring-1 edges together, retaining their width vector. All other position records stay exact. This preserves the root edge positions, **not the original outgoing root direction**. No new normal field, Float32 GLB or native render is generated.

| Card / observation | Final prefix span | Prefix arc | Bend at ring 1 | Centre join at ring 2 | Edge joins at ring 2 | Smallest adjacent triangle area |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 145 / original | 7.197 mm | 15.130 mm | 17.424° | 9.311° | 11.254° / 10.236° | 106.184 mm² |
| 145 / preserve arc | 4.067 mm | 15.130 mm | 19.648° | ≈0° | 13.657° / 18.147° | 54.839 mm² |
| 145 / preserve final span | 7.197 mm | 15.381 mm | 27.035° | ≈0° | 5.443° / 7.132° | 107.357 mm² |
| 204 / original | 6.048 mm | 12.428 mm | 5.143° | 27.989° | 15.586° / 43.821° | 110.018 mm² |
| 204 / preserve arc | **0.115 mm** | 12.428 mm | 27.072° | ≈0° | **57.855° / 110.502°** | **1.016 mm²** |
| 204 / preserve final span | 6.048 mm | 13.579 mm | **48.082°** | ≈0° | 11.271° / 15.291° | 120.647 mm² |

The centreline can join exactly while the ribbon edges do not. For card 204, preserving arc leaves only 1.90% of the original final span. Preserving that span avoids the near-collapse but increases the ring-1 bend from 5.143° to 48.082°. This is evidence against treating either single-ring observation as a smooth-flow solution. It is not proof that every one-ring design is infeasible.

## Full-ribbon body observation

Each of the eight cases uses all 32 original card triangles against every triangle in `assets/figures/figure_g050.glb`, with unbounded spatial regions and 1e−9 m intersection tolerance. All have zero crossings and zero negative vertices. Minimum signed vertex distances are 3.606771 mm for card 7, 4.902106 mm for card 46, 3.748078 mm for all card-145 cases and 3.667536 mm for all card-204 cases. The long-card minima occur on preserved geometry; unchanged minima are not evidence that the moving ring has unchanged clearance.

The report retains all vertices, widths, tangent dot products, spans, centre and edge turns, every triangle's area, crossing observations and Float32 round-trip deltas. Diagnostic positions use JavaScript double precision; a future exported asset requires its own checks. No continuous positive-clearance claim follows from a zero crossing count and sampled positive distances. Signed distances use interpolated body normals, not watertight parity.

## Decision log and next bounded step

1. **Do not repeat the global shell construction.** Its clear-centre/penetrating-edge witness and actual elevated arches remain preserved failures.
2. **Do not count an unchanged baseline as progress.** The two declared observations have specific, measurable differences.
3. **Keep short-card endpoints provisional.** Original scale versus a 2.2–2.4× minimum extension is an authoring decision; the photographs do not settle it.
4. **Do not choose a zero-angle metric as the styling goal.** Card 204 shows a near-collapse or a displaced bend despite clearing the head.
5. **Next: define whole-prefix flow under the existing anchors.** Assess both turns, spacing, triangle quality and both edge paths together, retaining the present one-ring cases as controls. Declare the objective before a numerical solve. Do not silently release additional rings, change width orientation or generate all 158 front cards.

An alternative is a small upper-front layout study that inventories additional transition space and explicitly enumerates the suffix records it would release. It offers more freedom but changes the protected boundary and adds qualification work. Root initially favored this layout inventory; the independent critic correctly noted that the observed tradeoffs depend on an imposed zero join. The recorded decision is to retain existing anchors for the next objective formulation, and consider a larger boundary only after a concrete conflict is shown. This is a formulation decision; no geometry was changed, reverted or swept. Neither alternative establishes that boundary expansion or root relocation is necessary.

Any later appearance candidate needs actual native images, independent critique, full rest checks, motion checks including shared card 58, and preserved accepted assets. This numerical slice earns none of those gates.

## Recovery

- Command: `node tools/critic/probe-front-reachability.mjs`.
- Native/GPU jobs: none started. Node PID 29827 completed at `2026-09-30T13:45:40.435Z`; no continuing solver process.
- Source: [probe-front-reachability.mjs](../../../../tools/critic/probe-front-reachability.mjs), SHA-256 `40f47b6092345218509ceca34b088854113df500dc31d66f035399d0f53b39f0`.
- [Raw report](../../../../captures/bob-front-reachability-v1/report.json), SHA-256 `ae4ad28fac664cff456639589eb822593618dbef7c526c96ccf70e1e0e9cf2ae`.
- Side control: `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`.
- Figure: `b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14`.
- Input constraint report: `4a48e9a0f804eda92c7d4795e6b025e12eab884caadc269273f88f95e5cb5946`.

The writer refuses an existing output directory and verifies source/input hashes before and after observation. Reproduction must use a fresh output path. The [archive manifest](archive-manifest.json) preserves six files / 435,351 bytes: the raw report and five source snapshots. The [compact summary](summary.json) retains the numerical conclusions. The ignored captures are local evidence, not an off-machine backup.
