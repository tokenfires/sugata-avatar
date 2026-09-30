# Independent critique — rejected front flow and support constructions

## Disposition

**Reject both candidates. Stop this guide/support generation line without a handle, offset, width or fallback sweep.** The free Cartesian cubic introduces extensive body penetration. The shared ellipsoid reduces that penetration but still fails, and adds a conspicuous crown arch and angular side fans. Neither candidate warrants motion qualification or promotion.

The apparent forehead opening in the first candidate is an observation, not a demonstrated styling gain: some of the relocated hair is inside the head, and the held-pose renderer has not materially displaced it back outside. Preserve the qualified side/lower leads and these two failures. The next useful step is a bounded review of support, full ribbon width and available transition space before choosing another authoring construction.

This review directly inspected all nine original PNGs: control, free cubic and analytic support in front, front-right and front-left views. It also re-inspected R2 and R3. The critic performed source reads, hash/control comparisons and a small read-only geometry calculation; no native capture, asset construction or body-audit job was launched.

## Pinned evidence and controls

| Asset | SHA-256 | Source-rest result for the same 158 front cards |
| --- | --- | --- |
| [Side-v3 control](/Users/robault/GitHub/sugata-avatar/captures/bob-side-envelope-v3/candidate.glb) | `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9` | 0 triangle/body pairs; 0 negative vertices; minimum signed vertex clearance 3.513635647 mm, card 57. |
| [Free cubic](/Users/robault/GitHub/sugata-avatar/captures/bob-front-flow-v1/candidate-report.json) | `8503966620ed993eea2e2dbb2a60bea6265c84256e1848e6e72c0cfde8dde412` | 896 pairs across 27 cards; 168 negative vertices; minimum −26.794815351 mm, card 7/ring 5/side 0. |
| [Analytic support](/Users/robault/GitHub/sugata-avatar/captures/bob-front-support-v1/candidate-report.json) | `488f5ea56c7afdebf83b6c65330f86e24109f798c81468e14ee0f5b78e847cc0` | 42 pairs across root cards 4, 7, 44, 46, 57 and 63; 5 negative vertices; minimum −6.717103057 mm, card 46/ring 1/side 0. |

The fresh [focused audit](/Users/robault/GitHub/sugata-avatar/captures/bob-front-prototype-audit-v1/summary.json) checks the clear control against both failed constructions. These contacts are introduced defects, rather than inherited front contacts. The audit checks all 5,056 triangles of the selected 158 cards against the body; it does not audit garments or every hair card.

The [free-cubic capture](/Users/robault/GitHub/sugata-avatar/captures/bob-front-flow-v1/neutral/report.json) and [support capture](/Users/robault/GitHub/sugata-avatar/captures/bob-front-support-v1/neutral/report.json) are complete, each with three actual 900×868 images and empty recorded errors. I independently verified both GLB hashes, each run's 19 declared tools/packages source snapshots, image and geometry hashes, the focused audit's source hash, and equal non-hair fixed state, material, lighting, camera, owned clock and image dimensions against the frozen control. Empty recorded errors refers to the harness's collected errors, not an uncollected console-error guarantee.

The [audit source](/Users/robault/GitHub/sugata-avatar/tools/critic/audit-bob-front-prototypes.mjs:23) compares every exported live vertex to its corresponding authored/rest vertex in the same exported coordinate frame. Maximum differences are 0.000570403 mm for the cubic and 0.000656018 mm for support. The runtime has therefore not meaningfully corrected the penetrating source curves. Protected-card live differences relative to control are at most 0.000119442 mm for the cubic and exactly zero for support. Authored isolation does not grant future dynamic isolation.

Both authoring reports preserve the 338 protected side/posterior cards, cap, root records and declared lower suffixes. They change 156 front cards and skip 159 and 352. Preserving those bytes is useful control evidence, but does not validate the newly constructed prefix.

## Actual appearance

Coordinates below locate regions in the original images. They do not establish individual-card alpha ownership.

| View and original evidence | Observation |
| --- | --- |
| [Front control](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/control/casual-front-medium-brown.png), [cubic](/Users/robault/GitHub/sugata-avatar/captures/bob-front-flow-v1/neutral/casual-front-medium-brown.png), [support](/Users/robault/GitHub/sugata-avatar/captures/bob-front-support-v1/neutral/casual-front-medium-brown.png) | The cubic removes most eyebrow-length tabs and exposes the forehead, while retaining an interrupted crown around x365–510/y65–135. The support version introduces a clearly elevated, open arch around x360–480/y40–90, with crossing diagonal sheets below around x330–560/y100–280. The clean root-to-length flow required by the brief is absent. |
| [Front-right control](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/control/casual-front-right-medium-brown.png), [cubic](/Users/robault/GitHub/sugata-avatar/captures/bob-front-flow-v1/neutral/casual-front-right-medium-brown.png), [support](/Users/robault/GitHub/sugata-avatar/captures/bob-front-support-v1/neutral/casual-front-right-medium-brown.png) | The cubic reduces the old forehead band but leaves black upper divisions around x165–355/y85–140. Support adds multiple angular open spans around x195–355/y60–135 and a large changed fan below. Long cheek framing remains visible; that does not compensate for the new crown interruption. |
| [Front-left control](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/control/casual-front-left-medium-brown.png), [cubic](/Users/robault/GitHub/sugata-avatar/captures/bob-front-flow-v1/neutral/casual-front-left-medium-brown.png), [support](/Users/robault/GitHub/sugata-avatar/captures/bob-front-support-v1/neutral/casual-front-left-medium-brown.png) | The cubic removes the short forehead ledge while leaving crown steps and long facial ribbons. Support produces a pronounced angular fan across roughly x310–780/y90–415, plus an elevated flap around x515–655/y40–105. This is a new rendered failure, not merely a numerical join-angle concern. |

[R2](/Users/robault/GitHub/sugata-avatar/reference/bob-appearance-2026-09-29/02-medium-face-framing.jpg) shows continuous front curves and open face framing; [R3](/Users/robault/GitHub/sugata-avatar/reference/bob-appearance-2026-09-29/03-medium-side-volume.jpg) shows shorter swept layers within a smooth overall volume. Neither supports exposed polygonal arches, abrupt fans or treating disappearance into the head as a cleaner sweep. The photographs do not specify a required part side, forehead exposure amount or numerical bend target.

## Mechanism: distinguish the support surface, ribbon width and boundary

### Free cubic: no anatomical support constraint

[The Cartesian construction](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-front-flow.mjs:31) interpolates the lateral root-to-temple paths in XYZ, then constructs the ribbons. It imposes no head-support constraint on the interior of that curve. The measured −26.795 mm card-7 edge and 896 pairs are concrete counterexamples to using those free curves as a safe front surface. The photographs alone would not reveal all of this hidden penetration.

This rejects the implemented free-space construction, not every possible use of cubic curves. Its reduced visible tabs must not be used as evidence that the replacement has maintained legitimate hair coverage.

### Shared ellipsoid: a conservative body bound is not the desired hair envelope

[Support lines 31–39](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-front-support.mjs:31) fit one ellipsoid enclosing 3,276 body vertices above authored Y=1.50. Its radii are 86.179, 192.821 and 129.529 mm, with a global horizontal scale of 1.031778. The guide radius then adds 2 mm plus each card's maximum original half-width. It is a containment construction, not a local fit to the scalp or existing groom.

Read-only measurements from the pinned GLBs make the local mismatch explicit:

| Card | Original root radius about the support axis | Bare ellipsoid radius at that same height/direction | Added maximum half-width | Resulting root offset required by the recipe |
| --- | --- | --- | --- | --- |
| 7 | 21.567664 mm | 48.365412 mm | 18.030849 mm | −46.828598 mm, including the additional 2 mm radius |
| 46 | 16.132825 mm | 62.402239 mm | 17.915616 mm | −66.185030 mm, including the additional 2 mm radius |

The original root centres are already outside the actual body by about 5.972 and 6.000 mm. Large negative offsets are needed to return the oversized support construction to those fixed roots. [Lines 49–55](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-front-support.mjs:49) fade those offsets over the first 30% of the guide. This produces a rapid transition between the original anchor and the large shell; it is materially different from a gentle root lift.

These source facts are consistent with the actual excessive arches and fans, but no isolated ablation has assigned every visible polygon to the global ellipsoid, width allowance, side assignment or endpoint blend separately. A smaller global radius or another fade-amplitude sweep would hide the underlying constraint problem rather than establish a suitable support representation.

### Full ribbon: a clear centre is insufficient

At support card 46/ring 1, the measured centre is **+4.040569 mm** outside the body, but its two edges are **−6.717103 mm and +17.706002 mm**. At ring 2, the centre is **+6.562420 mm**, with edges **−5.220392 mm and +19.277287 mm**. These are direct signed-distance queries on the pinned source geometry, not a visible-clipping claim.

[The frame construction](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-front-support.mjs:84) projects and transports a width axis along the new tangents, while retaining the original root ring. Original width magnitude plus a centre support radius does not guarantee that the actual ribbon edges or intervening triangles clear the head, particularly through the root-offset transition. A replacement must reason about the ribbon and its fixed attachment frame together.

### Fixed short prefix: continuous endpoint tangent does not ensure a usable discrete join

Cards 145 and 204 have `end=2` and `fixedSuffixFrom=2`. Their root rings and rings 2–16 are fixed, leaving **only ring 1 movable**. The support formula removes both endpoint offsets at t=0.5, sending this sole ring toward the full inflated shell before immediately returning to the fixed suffix.

- Card 145/ring 1 moves 18.060922 mm; the discrete join is 63.212617°.
- Card 204/ring 1 moves 20.600731 mm; the discrete join is 65.336920°. Its original root-to-ring-2 chord is only about 12.4 mm.
- At card 204, the sole moved centre is 34.749702 mm outside the body, while the fixed root and ring-2 centres are about 15.092 and 15.700 mm outside. This local outward excursion is unnecessary for mere body clearance: the original front cards are already clear.

[The fixed-prefix rule](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-front-support.mjs:63), [write exclusion](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-front-support.mjs:95) and [discrete join measurement](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-front-support.mjs:124) reproduce the constraint. The exported live locator puts card 204/ring 1 near front-left (431.7,345.5), within the broad fan region, and front (149.0,351.7). Projection is a locator, not proof of alpha ownership. The visible fan independently fails the appearance criterion; the angle alone would not establish that failure.

This is a coupled surface/boundary problem. More samples could represent a smooth outward hump more finely, but would not by itself remove an oversized hump or establish that the unchanged short transition can support the intended sweep.

## Two concrete next alternatives

The actionable finding is that this front representation cannot simultaneously maintain the intended visible flow, full-ribbon clearance and the imposed fixed-root/short-prefix boundary. The witnesses above identify three interacting constraints, without proving that the original attachment positions themselves must move.

### A — recommended: local mesh-supported ribbon feasibility diagnostic

Keep both failed assets frozen. Before another whole-front GLB, use **cards 7, 46, 145 and 204** as a small read-only constraint packet. Include exact original root edges and width axes, original clear paths, requested swept endpoints, fixed suffix rings/tangents, remaining free-ring counts and the actual body triangles near each path. The calculation below already supplies the initial numerical witnesses.

For one subsequent feasibility experiment, fit a smooth local support patch to the actual crown/temple mesh and constrain the **full ribbon**, not just centre samples. Retain the same endpoint/side assignment initially so the construction question remains interpretable. Preserve exact root edges and fixed suffixes in the first solve; measure root-frame transition, edge/triangle clearance and the actual exported join. Produce a clear feasible/infeasible result before constructing or rendering a 156-card asset. A continuous surface is a guide; all exported straight triangle chords still need the independent intersection oracle.

The discriminator is explicit:

- If card 46 can carry its intended direction while both edges remain outside and the original root frame remains usable, the shell/root-offset construction was needlessly restrictive there. If only its centre can clear, the width-frame representation remains unresolved.
- If card 204 can follow a coherent local field with its one movable ring and fixed suffix, preserve that boundary. If satisfying the desired field forces another sharp excursion, report insufficient transition space. Do not silently lower the boundary or substitute a fallback card.
- Compare the solution with the already-clear original card. Merely returning the original path is a useful feasibility control, not evidence that the front style was improved.

**Tradeoff:** this is small and keeps attribution. It can reveal incompatible constraints before another broad failure. It may conclude that the existing boundary permits no useful change, and it does not itself deliver a finished front or establish visibility/coverage. Avoid fitting independently to per-face normals or pushing each vertex to its nearest surface; those would reintroduce the earlier zigzag mechanism.

### B — broader alternative: jointly design front attachment frames and transition space

Use the source front inventory to design a shared part/root field and upper transition layout together, rather than extending the old short root/fringe strips into long swept paths while retaining every old attachment frame and one-ring join. Declare a revised front contract first: the 338 protected side/posterior cards, cap and long face endpoints remain protected, while any changed root position/orientation or expanded upper suffix boundary is enumerated explicitly. Preserve scalp attachment and the existing part intention; do not infer a new part side from the references.

Start with a geometric layout of the crown/root-46 region and the short-prefix 145/204 boundaries. Show their proposed attachment frames and joining space against the actual body and neighbouring protected coverage before producing the full candidate. If the required region overlaps protected geometry, stop and report the overlap instead of claiming front-only isolation.

**Tradeoff:** this gives the authoring system enough freedom to coordinate roots, ribbon orientation, layer coverage and joining paths. It expands the experiment beyond the current byte-preserved roots/prefixes and needs fresh attachment, appearance, complete rest and motion qualification. The current evidence does not prove that root relocation is necessary, so jumping directly to this larger rewrite would discard useful constraints prematurely.

**Choice:** A's bounded constraint packet and full-ribbon feasibility check should precede B. Do not generate a third whole-front candidate from another analytic handle/offset choice. These alternatives address both the introduced contact and the visible arch/fan; neither permits accepting the apparently open forehead while the hair remains inside the head.

## Reproducible read-only witness calculation

Executed from the repository root. This reads frozen GLBs and performs a few nearest-surface queries; it writes no file, constructs no candidate and runs no native job. The support radius is evaluated about the fixed axis `(x=0,z=cz)` at each original root, exactly as in the source. Widths are original full edge vectors; reported half-width is the maximum across all 17 rings. Distances are in millimetres.

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import {readGlb, readPrimitive} from './tools/lut-bake/glb.mjs';
import {SurfaceGrid} from './tools/figure-pipeline/hair_geometry.mjs';
const base = readPrimitive(readGlb('captures/bob-side-envelope-v3/candidate.glb'), 'hair_bob02');
const cand = readPrimitive(readGlb('captures/bob-front-support-v1/candidate.glb'), 'hair_bob02');
const body = readPrimitive(readGlb('assets/figures/figure_g050.glb'), 'base.001');
const report = JSON.parse(fs.readFileSync('captures/bob-front-support-v1/candidate-report.json'));
const s = report.parameters.support;
const grid = new SurfaceGrid(body.positions, body.normals, body.indices);
const edge = (p,c,r,j) => Array.from(p.positions.slice(
  (652+c*34+r*2+j)*3, (652+c*34+r*2+j)*3+3));
const ctr = (p,c,r) => edge(p,c,r,0).map((x,k)=>(x+edge(p,c,r,1)[k])/2);
const norm = a => Math.hypot(...a);
const sub = (a,b) => a.map((x,k)=>x-b[k]);
for (const c of [7,46,145,204]) {
  const root = ctr(base,c,0), a = Math.atan2(root[2]-s.cz,root[0]);
  const half = Math.max(...Array.from({length:17},(_,r)=>
    norm(sub(edge(base,c,r,1),edge(base,c,r,0)))/2));
  const radius = Math.sqrt(1-((root[1]-s.cy)/s.ry)**2) /
    Math.sqrt((Math.cos(a)/s.rx)**2+(Math.sin(a)/s.rz)**2);
  console.log({card:c, rootRadialMm:Math.hypot(root[0],root[2]-s.cz)*1000,
    shellRadialMm:radius*1000, maxHalfWidthMm:half*1000,
    rootNearestBodySignedMm:grid.nearest(root).signed*1000});
  for (const r of c<78 ? [1,2,3] : [0,1,2,3]) {
    const b=ctr(base,c,r), p=ctr(cand,c,r);
    console.log({card:c, ring:r, baselineCentre:b, candidateCentre:p,
      deltaMm:norm(sub(p,b))*1000, signedCentreMm:grid.nearest(p).signed*1000,
      edgeSignedMm:[0,1].map(j=>grid.nearest(edge(cand,c,r,j)).signed*1000)});
  }
}
JS
```

The signed centre/edge queries provide the local mechanism witness. They are not a substitute for the separate full triangle oracle, and they do not prove visibility of a contact through the body or other hair layers.

## Completed four-witness constraint inventory

The recommended read-only packet is now saved as [inventory-front-constraints.mjs](/Users/robault/GitHub/sugata-avatar/tools/critic/inventory-front-constraints.mjs) and [report.json](/Users/robault/GitHub/sugata-avatar/captures/bob-front-constraints-v1/report.json), report SHA-256 `4a48e9a0f804eda92c7d4795e6b025e12eab884caadc269273f88f95e5cb5946`. Command: `node tools/critic/inventory-front-constraints.mjs`. The writer refuses an existing output directory. Input asset/report/source pins are checked before and after calculation, and nine source/input-report snapshots are preserved and verified in the output's `source` tree. It creates evidence only. **No feasibility solver or new candidate was run.**

For each of cards 7, 46, 145 and 204, the report includes the original root edge/frame and normal records; all 17 baseline, cubic and support rings; centre and edge signed-distance witnesses; the requested endpoint and side assignment; free-ring count; the fixed suffix and its tangent; discrete turns; and body-ray/support comparisons at every original and failed-support centre. The rejected prototypes' endpoints are recorded as requests to investigate, not accepted design requirements.

Body rays use authored GLB metres: origin `[0, sampleY, support.cz]`, direction `[cos(theta), 0, sin(theta)]`, where `theta = atan2(sampleZ - support.cz, sampleX)`. The direction is unit length. The existing double-sided triangle-ray routine considers every body triangle and retains strictly positive distances. All raw triangle hits remain in the report; a separate distance list removes repeated near-coincident hits within 1e-8 metres of the last retained distance. The farthest hit is a directional sample, not a global support surface or proof of a star-shaped head. The report also retains the origin's nearest signed distance, so an outside origin is not implicitly treated as an interior ray origin.

| Original root sample | Actual forward mesh intersections | Bare shell comparison and interpretation |
| --- | --- | --- |
| Card 7 | No hit; origin nearest signed distance +3.033663 mm | Ellipsoid still requests radius 48.365412 mm before width and extra radius. Missing mesh intersection is reported as null, not zero body radius or a clearance guarantee. |
| Card 46 | No hit; origin nearest signed distance +4.250929 mm | Ellipsoid still requests radius 62.402239 mm before width and extra radius. This concretely illustrates the need to distinguish an enclosing analytic surface from local mesh support. |
| Card 145 | One distinct hit at 74.825595 mm; origin signed distance −53.940657 mm | Bare shell radius 85.751559 mm exceeds that directional hit by 10.925964 mm; the recipe then adds 20.489053 mm from width and extra radius. Only one ring is movable over an original 14.956315 mm root-to-join chord. |
| Card 204 | One distinct hit at 75.304829 mm; origin signed distance −53.801747 mm | Bare shell radius 86.374429 mm exceeds that hit by 11.069600 mm, before another 24.874207 mm from width and extra radius. Only one ring is movable over a 12.415771 mm root-to-join chord. |

The failed card-46/ring-1 width axis is already nearly orthogonal to its finite-difference centre tangent: dot product approximately −7.26e-7, while its edge still penetrates by 6.717 mm. Another simple width-to-tangent projection is therefore not supported as a sufficient repair. The full ribbon's relationship to the body and the fixed root frame is the relevant constraint.

This packet completes the measurement portion of alternative A. It leaves A's proposed local mesh-supported feasibility experiment and alternative B's revised attachment/boundary layout **unproved**. Preserve the two failures and the current leads while deciding which constraints to retain; the packet does not authorize another whole-front generator or a new parameter sweep.

## Limits

- Static held pose only; no moving qualification is inherited from the side-v3 input or separate lower-fallback lead.
- All quoted source-rest contacts are geometric. No individual penetrating triangle is claimed visibly clipped without an occlusion/alpha witness.
- The high arch and angular fans are directly visible. Assigning each pixel to a specific card or splitting their cause among shell size, offsets, frames and endpoint assignment would need a further controlled attribution.
- The photographic target remains coherent, rooted flow with smooth body and face framing. The brief is not revised to accommodate either failed construction.
