# Nose tip width: CPU admission result

The isolated operator passes its CPU admission at the authored diagnostic endpoints **−1, 0 and +1**. It is not a product option, an approved appearance range, or a native/rendering result. No accepted asset was written; the candidate buffers existed only in memory.

[The sealed result](cpu-v1/report.json) has SHA-256 `6a939c1f762e65e36d2f41679139be1af2309420534bf28de849c0c4a7ff9987`. [The seal](cpu-v1/seal.json) records completion. Its source map binds the exact four inputs, existing identity arithmetic and geometry predicate, local operator, tests, independent verifier, and normal policy. The source/dependency inventory and remaining qualification plan are in [PLAN.md](PLAN.md).

## API and ownership

```js
import { createTipWidthOperator } from './TipWidthCandidate.mjs';

const operator = await createTipWidthOperator({
  bodyBytes, mapBytes, catalogueBytes, noseBytes,
});
const { positions, normals, bytes, receipt } = operator.candidate(-1);
```

This Node-only, evidence-local function accepts exactly the pinned source bytes and only the three diagnostic values. It copies inputs into private pristine storage. Every call starts from that storage; caller mutation, prior output mutation, call ordering and repeated calls cannot accumulate shape changes. Zero returns exact original bytes and copied original arrays, bypassing arithmetic.

The in-memory `bytes` output exists to prove the complete nonselected-byte contract. A later reviewed native adapter should apply the exact approved `positions` and `normals` arrays to a freshly owned `Figure.load` geometry before Avatar initialization, preserving original loader/network bytes. No loader replacement, asset export, live mesh mutation or public API is provided here.

Only actual changed body POSITION/NORMAL float slots can differ. The whole-file byte gate and independent accessor test preserve JSON, every other attribute, all 89 morphs, other meshes/proxies, skin/joints, indices, masks, materials and embedded images. Global position extrema are unchanged. The actual body has **no TANGENT attribute**; a synthetic present-tangent case is explicitly rejected instead of retaining stale tangent directions. Writable accessor aliases and unsupported layout are rejected.

Normals use the approved [shortest-arc policy](NORMAL-POLICY.md): transport pristine authored normals between complete area-weighted geometric normal directions at source-index welds. The rotation preserves authored length and angular offset before the final Float32 rounding; the stored result includes that quantization. Conflicting weld positions/normals, degeneracy, nonfinite data and nonpositive normal-direction dot products fail. No unrelated normal is recomputed. An affected neighborhood can contain normals whose exact bytes remain unchanged.

## Observed discrete results

| Quantity | Decrease −1 | Increase +1 |
| --- | ---: | ---: |
| Changed positions | 64 | 42 |
| Maximum authored displacement | 2.4083190301474695 mm | 1.5297058696576575 mm |
| Changed normal vectors | 112 | 83 |
| Complete normal neighborhood source vertices | 114 | 83 |
| Faces incident to changed positions | 184 | 126 |
| Faces in complete normal stars | 276 | 214 |
| Minimum affected final face area | 7.533281823270919 × 10⁻⁷ m² | 8.629711289183377 × 10⁻⁷ m² |
| Minimum original/final face cosine | 0.936562891918401 | 0.9616780915677617 |
| Maximum geometric-normal rotation | 14.342215801949864° | 8.286047828797681° |
| Nonselected bytes | Exact | Exact |

Both the existing numerical intersection predicate and an independent exact-rational verifier pass their affected-face/body checks. Adjacent faces are not blanket-excluded. The numerical predicate and its shared-simplex distance classification use the existing 10⁻⁹ m tolerance; that is neither exact incidence nor a clearance margin. Separately, the independent verifier establishes no intersection beyond the exact shared source-index point or edge using rational arithmetic on the supplied Float32 coordinates, plane-section intervals and projected coplanar clipping. It checks the union of 184 affected faces against the complete body at each of the three cases: 1,430 / 1,402 / 1,404 exact-AABB candidate pairs for −1 / 0 / +1. All exact reference-facing dot products are positive.

The prior independent Python normal inventory agrees on complete neighborhood counts and maximum geometric-normal rotations, with double-arithmetic differences below 5 × 10⁻¹⁴ degrees. This small arithmetic comparison is not an appearance tolerance.

## Executed controls and reproduction

Fourteen focused JavaScript groups passed, including hand-solvable tilted-plane transport with an authored offset, complete-star ownership, UV splits/hard-edge refusal, nonfinite/degenerate/opposite inputs, clean and folded shared simplices, nonadjacent crossings, exact source admission, zero identity, immutable fresh calls, tangent/alias refusal, and complete nonselected-accessor comparison. The separate Python verifier passed eight analytical collision controls before checking actual endpoints.

From the repository root, the focused tests are:

```sh
node docs/evidence/nonhair-2026-09-26/face-primitive-next/TipWidthCandidate.selftest.mjs
```

To reproduce the sealed experiment, provide a **fresh** output directory; the driver refuses an existing one:

```sh
node docs/evidence/nonhair-2026-09-26/face-primitive-next/prove-tip-width.mjs docs/evidence/nonhair-2026-09-26/face-primitive-next/cpu-repeat
```

## Remaining boundary

These are discrete rest-geometry checks, not a continuous interval or positive-clearance certificate. They do not establish native expression/viseme shape, actual lid/mouth/proxy separation, fixed groom clearance, curvature/cavity-map appearance, or the visual merit of either endpoint. Zero fitted-source dependency overlap remains a narrowly defined input-invariance result. It does not substitute for actual native mesh/transform ownership and rendered checks.

The [independent source review](CODE-CRITIQUE.md) cleared this fixed CPU operator. Its separate complete-star Rodrigues calculation reproduces the endpoint Float32 normals exactly, and its independent byte-mask check reproduces the 1,324 / 944 changed bytes. A separately reviewed fresh-owner native adapter is still required for the endpoints, exact zero control, blink/jaw/expression/speech cases and ordinary portrait/clothed views. Accepted g050 assets, public configuration and the larger representative starter-build goal remain unchanged.
