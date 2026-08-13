# Hair motion — verified research

Researched and measured 2026-08-13. Companion to `hair.md`, which owns the shading and explicitly
defers motion (`hair.md` §6.5: *"Hair motion is punch-list 6.8's problem"*). Every three.js claim
below is checked against the **installed** source in `node_modules/three` at **r185**
(`three@0.185.1`, from its own `package.json`), and every equation is read off the primary PDF page
or the primary source file, named where it is used.

Confidence markers, same scheme as `hair.md`:

- **[V]** Verified against a primary artefact, quoted with the page or file it came from
- **[M]** Measured **in this session**, with the tool and the artefact named
- **[D]** Derived here from two [V]/[M] facts, with the derivation shown
- **[I]** Inference, explicitly flagged
- **[✗]** Negative finding — looked for, not there

Nothing here is copied out of `PUNCHLIST.md`, `PROGRESS.md` or a code comment and presented as a
result. Where a prior round's number is discussed it is labelled as that round's number and either
re-derived or marked unreproduced.

---

## 0. The four findings that decide this

### 🎯 0.1 The groom is **294 cards of 17 rings**, so the thing to be simulated is **4,998 particles** — 155× fewer than the strand groom the literature is about. [M]

Measured off `assets/hair/bob01/g050.glb` at 2026-08-13 04:36Z, by parsing the GLB's JSON chunk and
running a union-find over the index buffer:

| quantity | value |
|---|---:|
| mesh count | 1 (`hair_bob01`) |
| vertices | **10,648** |
| triangles | **10,536** (31,608 indices) |
| connected components | **296** |
| components of exactly 34 vertices | **294** — the cards |
| components of 326 vertices | 2 — the scalp cap shells |

294 × 34 = 9,996; + 2 × 326 = 10,648, which closes exactly against the POSITION accessor. A card is
17 rings × 2 edge vertices, because `hair_cards.py`'s `GUIDE_SEGMENTS = 16`.

⚠️ **This artefact changed under this session.** The first measurement taken here, against the
bake whose files were stamped 2026-08-12 19:26–19:27, read **8,296 vertices, 294 components of
26** — `GUIDE_SEGMENTS` was 12. The bake now on disk is stamped 21:12–21:22. A concurrent
agent raised it to 16 and rebuilt the bake mid-round, and filed REQ-067/REQ-068 saying so. Both
numbers above are this session's own; the 13-ring set survives in this document only where it is
labelled as the earlier groom. **The rule that caught it was re-reading the artefact rather than
the note.**

⚠️ **The round brief's "254 cards" does not reproduce either.** `hair_cards.py`'s `HAIR_LAYERS`
reads 104 + 58 + 56 + 48 + 28 = **294**, and 294 components of card size is what the file contains.

Every card in this groom is a **ribbon built around a guide curve** — `ribbon_of` takes the guide
and emits `point ± across · half` per ring. So the "guide curves" that a hair simulator wants to
simulate are not a thing that has to be authored: **they already exist, one per card, and the card
is a pure function of one.** §5 is about what that buys.

### 🎯 0.2 GPU DFTL for this groom costs **0.01361 ms median / 0.01398 ms p95** — 0.082% of a 16.6 ms frame. The hair's own arithmetic is **0.00431 ms**. [M]

`tools/spikes/hair-motion.html`, measured 2026-08-13, Chromium 149 headless via Playwright 1.61.1,
WebGPU adapter `apple / metal-3`, `compatibilityMode false`, three r185, GPU timestamps on the
**COMPUTE** pool, 3 repeats × 200 sampled frames after 60 warmup with 8 whole simulation frames per
tick, **n = 597** samples per variant. Raw JSON: `tools/spikes/results/hair-motion.json`, with an
independent repeat in `hair-motion.run2.json` that agrees to 0.5%.

The 0.00431 ms is the difference between the shipped groom and a **one-chain** groom submitted
identically. It is the answer to "can this hair move": the simulation is free and the question is
entirely about how the work is submitted and whether it looks right.

⚠️ **Take this measurement on an idle machine.** A run taken while `tools/run-selftests.sh` was
executing in another process reported the same variant at **0.0057 ms median with a 0.0289 ms
p95** — the median halved while the p95 quintupled. Concurrent GPU work does not add time here, it
changes the clock state the samples come from. That run is not in `results/`.

### 🎯 0.3 The whole cost is **`renderer.compute()` call overhead, at 31–54 µs per call**, and handing three.js an array collapses it. [M/V]

`Renderer.compute()` opens one WebGPU compute pass per invocation — `Renderer.js:2765`
`backend.beginCompute( computeNodes )`, then a loop over the list, then `finishCompute` at
`Renderer.js:2807`. Passing an **array** of compute nodes runs every dispatch inside a single pass.

| dispatches / frame | a pass each | ms / pass | one pass | ratio |
|---:|---:|---:|---:|---:|
| 2 | 0.07133 ms | 0.03567 | 0.00842 ms | 8.5× |
| 3 | **0.13096 ms** | 0.04365 | **0.01361 ms** | **9.6×** |
| 5 | 0.24996 ms | 0.04999 | 0.02386 ms | 10.5× |
| 9 | 0.48689 ms | 0.05410 | 0.02417 ms | 20.1× |

Per-pass cost in the left column runs **30.8–54.1 µs** and barely moves with the work inside the
pass. Inside one pass, an extra dispatch costs **≈2.3–5.1 µs** — an order less [D].
⚠️ **The 9-dispatch one-pass cell is the one unstable measurement in this spike**: p95 0.04487 ms
against a 0.02417 ms median, and the repeat run read 0.03128 ms. Read that ratio as **15.6–20.1×**
rather than as a value; every other cell agrees between runs to under 2%.

> **A build agent who writes one `renderer.compute()` per kernel per substep pays ten times the
> price of the simulation, and the profiler will show it as "hair physics".** State the submission
> shape beside the algorithm, every time.

This is not a three.js quirk to work around — it is WebGPU's pass model, and it is safe to
exploit: hazards between dispatches **inside** a pass are tracked by the implementation, so a
sequential solver still sees the previous dispatch's writes. `rendering-stack.md`'s "architectural
verdict" section cites 31.7 µs Safari/Metal/M2 and 58.7 µs Chrome/D3D12 from arXiv 2604.02344 for
exactly this quantity; ⚠️ **that paper was not re-fetched or re-verified in this session**, but
30.8 µs measured here on Chrome/Metal is the same order and the same story.

### 🎯 0.4 The honest cheap option **also fits**, and it is closer than the framing assumed. [M/V]

A VRM-faithful spring chain over the same 294 × 17 groom, in JavaScript, with the fixed 60 Hz
timestep punch-list 6.6 asks for: **0.144 ms median / 0.158 ms p95** per frame. The same DFTL
solver in JavaScript: **0.314 ms / 0.324 ms**. Both fit in 16.6 ms; both are **main-thread** time,
which is the scarce resource, and both are 11–23× the GPU figure.

And the premise that a spring chain does not preserve strand length is **wrong for VRM
specifically** [V]: `VRMSpringBoneJoint.ts` ends its update with

> `_nextTail.sub( _worldSpacePosition ).normalize().multiplyScalar( this._worldSpaceBoneLength ).add( _worldSpacePosition );`

which is a hard distance projection onto the sphere of radius `boneLength` about the joint — the
same operation FTL performs, applied once per joint. §4 says where VRM actually falls down, and it
is not length.

---

## 1. Position Based Dynamics — the substrate

Read off Müller, Heidelberger, Hennix & Ratcliff, *Position Based Dynamics*, VRIPHYS 2006 /
JVCIR 2007, PDF at `matthias-research.github.io/pages/publications/posBasedDyn.pdf`, pages 3–6.

### 1.1 The loop (§3.1, page 3) [V]

Seventeen lines, quoted in structure:

```
(5)  forall vertices i do  v_i ← v_i + Δt · w_i · f_ext(x_i)
(6)  dampVelocities( v_1 … v_N )
(7)  forall vertices i do  p_i ← x_i + Δt · v_i
(8)  forall vertices i do  generateCollisionConstraints( x_i → p_i )
(9)  loop solverIterations times
(10)     projectConstraints( C_1 … C_{M+Mcoll}, p_1 … p_N )
(13)  v_i ← ( p_i − x_i ) / Δt
(14)  x_i ← p_i
(16)  velocityUpdate( v_1 … v_N )
```

The paper's own framing of why this is stable: *"The scheme is unconditionally stable. This is
because the integration steps (13) and (14) do not extrapolate blindly into the future… The only
possible source for instabilities is the solver itself."* (page 3)

### 1.2 Constraint projection (§3.3, page 4) [V]

For a constraint `C` over points `p_1 … p_n` with inverse masses `w_i`:

```
Δp_i = − s · w_i · ∇_{p_i} C( p_1 … p_n )          (eq 9)
s    = C( p_1 … p_n ) / Σ_j w_j | ∇_{p_j} C |²     (eq 8)
```

and for the distance constraint `C(p_1,p_2) = |p_1 − p_2| − d`, eqs 10–11 give the familiar
mass-weighted split.

### 1.3 🚩 Stiffness depends on iteration count, and the paper says so (§3.3, page 5) [V]

> *"The remaining error for a single distance constraint after `n_s` solver iterations is
> `Δp(1−k)^{n_s}`. To get a linear relationship we multiply the corrections not by `k` directly but
> by `k' = 1 − (1−k)^{1/n_s}`… However, the resulting material stiffness is still dependent on the
> time step of the simulation. Real time environments typically use fixed time steps in which case
> this dependency is not problematic."*

That last sentence is the licence this project needs: punch-list 6.6's **fixed 60 Hz timestep** is
what makes a plain-PBD stiffness constant meaningful at all.

---

## 2. XPBD — what it fixes, and why we are not using it

Macklin, Müller & Chentanez, *XPBD: Position-Based Simulation of Compliant Constrained Dynamics*,
MiG 2016, PDF at `matthias-research.github.io/pages/publications/XPBD.pdf`, pages 1–4.

### 2.1 The problem, in the authors' words (§1, page 1) [V]

> *"constraints become arbitrarily stiff as the iteration count increases, or as the time step
> decreases. This coupling of parameters is particularly problematic when creating scenes with a
> variety of material types… This often requires methods that can provide accurate force estimates.
> Iteration count dependence is also a problem even in the case of a single asset."*

### 2.2 The fix (§4.1, eq 18 and eq 17, page 3) [V]

```
Δλ_j = ( −C_j(x_i) − α̃_j λ_ij ) / ( ∇C_j M⁻¹ ∇C_jᵀ + α̃_j )      (eq 18)
Δx   = M⁻¹ ∇C(x_i)ᵀ Δλ                                            (eq 17)
```

with `α̃ = α / Δt²` (page 3), `α` the compliance — the inverse of stiffness, in real units. When
`α = 0`, eq 18 *"corresponds exactly to the scaling factor `s_j` in the original PBD algorithm"*
(page 4). One extra scalar per constraint is stored; XPBD *"is identical to the original PBD
algorithm with the addition of lines 4, 7, and 9"* (Algorithm 1, page 2).

Damping is separate (§5, eqs 19–26) and folds into the same multiplier: `γ_j = α̃_j β̃_j / Δt`.

### 2.3 🚩 Why this file recommends **not** using XPBD here [D]

XPBD buys iteration-count-independent stiffness. **DFTL has no iteration count** — §3 — and this
project has a fixed timestep by decision. Both of XPBD's two coupled parameters are already pinned,
so the compliance formulation buys a stored Lagrange multiplier per constraint, an extra buffer,
and nothing that shows on screen. It becomes relevant the day hair and cloth need to be *authored
against each other* with shared material constants — which is punch-list 9.14's territory, not
6.6's.

---

## 3. Follow-The-Leader and DFTL — the algorithm this project should run

Müller, Kim & Chentanez, *Fast Simulation of Inextensible Hair and Fur*, VRIPHYS 2012, pp. 39–44,
PDF at `matthias-research.github.io/pages/publications/FTLHairFur.pdf`. All six pages read.

### 3.1 Static FTL (§3.1, page 2) [V]

> *"Particle 2 has to be on a sphere with radius `l₀` around particle 1. A natural choice for its
> position is to choose the point on the sphere that is closest to the original position `x₂`, i.e.
> to move it in the direction of particle 1… Once the new position of particle 2 is determined, the
> algorithm continues with particle 3 preforming the same steps as before with particle 2 taking
> the role of particle 1."*

One forward pass. **Zero stretch, exactly, with no iteration count** — that is the property PBD
buys with `n_s` iterations and never quite reaches.

### 3.2 The catch, and DFTL's fix (§3.2–3.3, pages 3–4) [V]

FTL moves particle `i` and *not* `i−1` (eqs 5–6), which the paper identifies as physically
equivalent to *"a system with masses `m, sm, s²m, … sⁿ⁻¹m` with `s → 0`"* — an infinite mass ratio
down the chain. The behaviour that produces is Figure 3: the chain swings from the root and the
tail carries no momentum at all.

The contribution is one line, eq 9 (page 4):

```
v_i ← ( p_i − x_i ) / Δt  +  s_damping · ( −d_{i+1} / Δt )
```

where `d_i` is the FTL correction applied to particle `i`. The authors are unusually blunt about
how hard-won it is: *"we would like to emphasize that this contribution is non-trivial… The
solution presented here is the only one we found."*

`s_damping ∈ [0,1]`. At 1 the uneven masses are fully compensated *"but with the introduction of
numerical damping"*; Figure 4 shows the pair 1.0 and **0.9**, with the caption *"For `s_damping`
smaller but close to 1, damping is reduced while the artifact of the uneven masses is still hardly
noticeable."* **0.9 is the paper's own worked value** and is what the spike uses.

### 3.3 The rest of the method [V]

- **Curly hair (§3.4)** is a *rendering-only* subdivision: a separate chain of vertices offset
  along transported particle normals, spiral with decreasing frequency. The simulation is unchanged.
  Directly relevant to §5 — it is the same trick as driving a card from a guide.
- **Hair–hair interaction (§3.5)** is Petrovic et al.'s grid: trilinear splat of density and
  velocity, then `v ← (1−s_friction)·v + s_friction·v_grid` (eq 10) and
  `v ← v + s_repulsion · ∇ρ/|∇ρ| / Δt` (eq 11).
- **Collision (§3.6)**: *"For the simulations shown in Figure 1 we used a simplified collision
  volume composed of 8 ellipsoids."*

### 3.4 The paper's own costs — and how far above this project they are [V]

All on an **NVIDIA GeForce GTX 480**, CUDA, including rendering:

| scene | strands | particles | rate |
|---|---:|---:|---:|
| short hair, 8-ellipsoid collision | 47k | **776k** | 25 fps |
| long hair | 47k | **1.9M** | 8 fps |
| curly | 2k | 38k | 80 fps |
| fur (Figure 7) | 100k | 446k | — |

Comparison experiment (§4, page 5), 30 particles, `Δt = 0.01 s`, `m = 0.01 kg`, `l₀ = 0.02 m`,
`g = −10 m/s²`: equal-time is 2 PBD iterations or 2 symplectic-Euler substeps, and Euler's maximum
stable stiffness is **`k = 100 N/m`**. Matching DFTL's behaviour instead needed **25 PBD
iterations**, or Euler at **`k = 3000 N/m` with 20 substeps**.

> **That is the argument for DFTL in one number: one pass equals twenty-five PBD iterations of
> visual behaviour on this problem.**

Our groom is **4,998 particles** (§0.1) — **0.64%** of that paper's short-hair scene, on hardware
fourteen years newer.

---

## 4. TressFX 4.1 — read off the source, and it is not what the blogs say

`TressFXSimulation.hlsl` and `TressFXSimulation.cpp`, fetched this session from
`GPUOpen-Effects/TressFX@master`. 1,143 and 111 lines respectively.

### 4.1 🚩 TressFX 4.1 is **Verlet plus Gauss-Seidel distance constraints**, not PBD [V/✗]

The integrator, lines 440–446:

```hlsl
float3 Integrate( float3 curPosition, float3 oldPosition, float3 initialPos, float dampingCoeff )
{
    float3 force = g_GravityMagnitude * float3( 0, -1.0f, 0 );
    float decay = exp( -dampingCoeff * g_TimeStep * 60.0f );
    return curPosition + decay * (curPosition - oldPosition) + force * g_TimeStep * g_TimeStep;
}
```

Position Verlet, with an **exponential decay in the timestep** — `exp(−c·Δt·60)` — which is how it
gets framerate-independent damping. There is no velocity array and no PBD velocity update anywhere
in the file. Secondary sources routinely describe TressFX as "PBD"; **the shader is not.** [✗]

### 4.2 Six dispatches per frame, in a fixed order [V]

`TressFXSimulation.cpp` lines 86–105, in order: `IntegrationAndGlobalShapeConstraints` (per
vertex) → `CalculateStrandLevelData` (per strand) → `VelocityShockPropagation` (per vertex) →
`LocalShapeConstraints` (per strand, iterated) → `LengthConstriantsWindAndCollision` (per vertex)
→ `UpdateFollowHairVertices` (per vertex). `THREAD_GROUP_SIZE 64` (line 195).

⚠️ **Six dispatches at this project's measured 30.8 µs-a-pass floor would be 0.18 ms of pure
submission if each were its own `renderer.compute()` call** [D from §0.3] — more than ten times the
whole solver. Anyone porting TressFX's dispatch structure to three.js must submit it as one array.

### 4.3 The global shape constraint — the thing that keeps a bob a bob [V]

Lines 651–662:

```hlsl
if ( (float)localVertexIndex < globalShapeMatchingEffectiveRange * (float)numVerticesInTheStrand )
{
    float factor = stiffnessForGlobalShapeMatching;
    float3 del = factor * (initialPos - sharedPos[indexForSharedMem]).xyz;
    sharedPos[indexForSharedMem].xyz += del;
}
```

`initialPos` is the rest position **after bone skinning** (line 623). So the constraint is "pull
the root end of every strand back toward where the skinned rest groom says it should be", with two
knobs: stiffness and how far down the strand it reaches. No defaults ship in the shader —
`g_Shape.z` and `g_Shape.w` come from the application [✗].

### 4.4 The local shape constraint, and its own warning [V]

Lines 783–785:

```hlsl
float stiffnessForLocalShapeMatching = GetLocalStiffness(strandType);
//1.0 for stiffness makes things unstable sometimes.
stiffnessForLocalShapeMatching = 0.5f*min(stiffnessForLocalShapeMatching, 0.95f);
```

The constraint itself (lines 790–825) rotates the bind-pose bond `i → i+1` by the quaternion that
takes the bind-pose bond `i−1 → i` to the current one, and splits the correction symmetrically
between `i` and `i+1`. This is bending/twisting resistance, and it is the piece DFTL does not have.

### 4.5 🎯 `UpdateFollowHairVertices` — the guide-to-follower bridge, in six lines [V]

Lines 986–995:

```hlsl
for ( uint i = 0; i < g_NumFollowHairsPerGuideHair; i++ )
{
    int globalFollowVertexIndex = globalVertexIndex + numVerticesInTheStrand * (i + 1);
    int globalFollowStrandIndex = globalStrandIndex + i + 1;
    float factor = g_TipSeparationFactor*((float)localVertexIndex / (float)numVerticesInTheStrand) + 1.0f;
    float3 followPos = sharedPos[indexForSharedMem].xyz + factor*g_FollowHairRootOffset[globalFollowStrandIndex].xyz;
    g_HairVertexPositions[globalFollowVertexIndex].xyz = followPos;
    g_HairVertexTangents[globalFollowVertexIndex] = sharedTangent[indexForSharedMem];
}
```

A follower is **the guide plus a constant root offset, scaled by a factor that ramps from 1 at the
root to `1 + tipSeparation` at the tip**, and it inherits the guide's tangent verbatim. That is the
entire binding. §5 is what happens when you apply it to a ribbon instead of a strand.

### 4.6 Other pieces worth having read [V]

- **Wind**: `force = -cross( cross(v, w), v )` on vertices `2 … n−2`, four winds blended by
  `a = (globalStrandIndex % 20) / 20` (lines 900–911). The double cross projects the wind onto the
  plane normal to the segment, so wind slides along a strand instead of stretching it.
- **Length constraints**: red/black pairs in `groupshared` with
  `GroupMemoryBarrierWithGroupSync()` between halves, `g_SimInts.x` iterations (lines 918–937).
  This is the barrier structure that **one-thread-per-strand removes entirely** — see §6.2.
- **Velocity shock propagation**: `pos = (1−c)·pos + c·(rotate(vspQuat, pos) + vspTrans)`, skipped
  for `localVertexIndex < 2` (lines 746–758). It is how fast root motion reaches the tip in one
  frame instead of propagating down the chain over several.
- **Velocity clamp**: `g_ClampPositionDelta` rewrites the *previous* position when a vertex moves
  too far in one step (lines 957–963) — history rewriting as a stability device, cheaper than a
  substep.
- **Collision**: capsules, behind `TRESSFX_COLLISION_CAPSULES`, default `friction = 0.4f`
  (lines 462 and 832). TressFX 4.0's README lists *"Signed distance field (SDF) collision, including compute
  shaders to generate the SDF from a dynamic mesh"* as the headline collision path.

---

## 5. The card problem — and why this groom is in an unusually good position

### 5.1 The standard bridge, from three independent sources [V]

- **TressFX**: guides are simulated; followers are a root offset plus a tip-separation ramp off the
  guide, tangent copied (§4.5).
- **DFTL §3.4**: curly hair is *rendered* from a subdivided, offset chain transported along the
  simulated chain's frames. The simulation never sees the render vertices.
- **Unreal Engine**: the groom pipeline's six strand stages are *"Simulation, Interpolation,
  Voxelization, Primary Visibility, Lighting, and Composition"*, and *"The guides' motions are
  simulated based on the scene environment and groom component motion, and the guides' motions are
  transferred onto the rendering strands"* — `dev.epicgames.com`, *Groom Scalability and
  Performance* and *Hair Rendering and Simulation*, fetched this session. **Interpolation is a
  named, separately-costed stage**, and it *"can be skipped when binding is set to Rigid"*.
  ⚠️ Neither page gives a guide count or a millisecond figure [✗].

The shape is the same in all three: **simulate few, deform many, and make the deformation a pure
function of the simulated frame.**

### 5.2 🎯 Here, the guide and the card are the same object [M/D]

`hair_cards.py:1152 ribbon_of` builds a card as, per ring:

```python
tangent = normalize( guide[i+1] - guide[i-1] )
outward = normalize( tangent_component( point - frame.head_centre, tangent ) )
across  = normalize( tangent.cross( outward ) )
across  = across·cos(twist·s) + outward·sin(twist·s)
half    = layer.half_width · width_scale · (1 - (1 - TIP_WIDTH_FRACTION)·s)
ring    = ( point - across·half, point + across·half )
```

Everything on the right-hand side is either the guide's own geometry, a per-card constant (`twist`,
`width_scale`), or a per-layer constant. **So a card is a pure function of its guide plus four
scalars**, and the deformation stage is not an interpolation scheme to be designed — it is this
function, re-evaluated. The spike's `skinKernel` in `tools/spikes/hair-dftl.js` is that function
transcribed to TSL (with `ribbon_of`'s one-sided tangent at the two ends), and it costs a few
microseconds as one more dispatch inside the pass [M, §0.3].

The consequences for the generator are correspondingly small — §8.3.

⚠️ **One thing the re-evaluation must not get wrong.** `ribbon_of`'s frame uses *outward from the
head centre*, and its own docstring says why: *"Past the first few segments a scalp normal is
meaningless… a frame that keeps referring to it flips as the curve passes the ear."* A runtime
rebuild that substitutes any other reference direction will rotate every card the moment the solver
starts, and it will look like the groom exploded rather than like a frame bug.

### 5.3 What a card cannot do that a strand can [I]

A ribbon has a width, and DFTL simulates a centreline. Three consequences, none measured here:

1. **No per-card twist dynamics.** The card's roll about its own tangent stays the authored
   constant. Real hair clumps rotate as they swing.
2. **Card–card interpenetration is invisible to the solver.** §3.5's density grid operates on
   particles; two cards whose centrelines are 3 mm apart and whose half-widths are 16 mm overlap
   completely and the solver is content. This is the strongest argument for keeping the global
   shape constraint reasonably stiff: it is what stops the layers sliding through each other.
3. **The silhouette layer is the one that will read wrong first.** `hair.md` §6.2 budgets 40–60%
   of cards to flyaways; a flyaway is exactly where a rigid-width ribbon reads as a ribbon.

---

## 6. three r185's compute path, verified against the installed source

### 6.1 What exists [V]

| thing | where | note |
|---|---|---|
| `instancedArray( count, type )` | `src/nodes/accessors/Arrays.js:47` | wraps a `StorageInstancedBufferAttribute` in a `StorageBufferNode` |
| `attributeArray( count, type )` | same file, line 15 | non-instanced sibling |
| `Fn(…)().compute( count, workgroupSize )` | `src/nodes/gpgpu/ComputeNode.js:291` | default workgroup size **`[64]`**, line 251 |
| `renderer.compute( nodes, dispatchSize )` | `src/renderers/common/Renderer.js:2718` | accepts a node **or an array** |
| `renderer.computeAsync` | `Renderer.js:2830` | awaits `init()` first |
| `TimestampQuery.COMPUTE` | `src/constants.js:1672` | a **separate pool** from `RENDER`. ⚠️ §6.1 read this as :1671 and it is :1672 at r185 — re-grepped 2026-08-13 |
| compute-pass timestamps | `WebGPUBackend.js:1577` | `initTimestampQuery( TimestampQuery.COMPUTE, … )` |
| `renderer.getArrayBufferAsync( attribute )` | `Renderer.js:1951` | GPU→CPU readback |
| `Loop`, `If`, `Break` | `src/nodes/utils/LoopNode.js:331/349` | dynamic-bound loops with `type: 'uint'` |

A complete worked example ships in-tree at `examples/webgpu_compute_cloth.html` (r185 tag, fetched
this session): `instancedArray(...).setPBO(true)`, two kernels, `renderer.compute()` twice per
frame, and a `positionNode` that reads the simulated buffer in the vertex stage.
`rendering-stack.md` §4's description of it as *"a complete in-core GPU verlet spring solver in
TSL… directly transferable to hair strand simulation"* is **confirmed** [V] — with the caveat that
its solver is a Jacobi pass over springs, which is the wrong shape for a strand (§6.2).

### 6.2 🎯 One thread per strand removes every barrier [D/M]

FTL is sequential along a chain, and 17 is short. TressFX needs `groupshared` memory and two
`GroupMemoryBarrierWithGroupSync()` per length-constraint iteration precisely because it splits a
strand across threads. Give one invocation the whole chain and the barriers, the shared memory and
the red/black ordering all disappear; the correction vector `d_{i+1}` that DFTL eq 9 needs is just
a second loop over the same thread's own data.

The spike does exactly this — `compute( chainCount )` for the solver, `compute( particleCount )`
for the rebuild — and measures **0.01361 ms** for the pair at the shipped size. The cost of the
low occupancy this implies (294 threads is ~5 workgroups of 64) is real and it is *already in that
number*.

### 6.3 🚩 Three r185 behaviours that will cost a build agent an afternoon [V/M]

**(a) `StorageBufferNode.toReadOnly()` mutates the node, it does not return a view.**
`StorageBufferNode.js:267` is `return this.setAccess( NodeAccess.READ_ONLY )`, and `setAccess`
assigns `this.access`. Calling it to make a material's read of a simulated buffer explicit makes
the *compute kernel that fills it* fail to compile, with
`cannot store into a read-only type 'ref<storage, vec3<f32>, read>'`. Measured this session: it did
exactly that. Bind the same node in both stages and let three emit the per-stage qualifier.

**(b) itemSize-3 storage attributes are silently padded to vec4, in place.**
`WebGPUAttributeUtils.js:113`: *"WGSL does not support packed vec3 data in storage buffers, pad to
vec4"*, and lines 143–146 rewrite `bufferAttribute.itemSize` and `.array` on the attribute itself.
Anything that reads a `vec3` storage buffer back with `getArrayBufferAsync` must stride by
`attribute.itemSize` **as it is now**, not by the 3 it was constructed with. Reading at stride 3
does not produce obvious garbage — it produces a nearly-correct first strand and a slow drift
after it. In this session it reported a 379.12 mm segment-length error and 88.0 mm of skull
penetration, both entirely artefacts of the reader.

**(c) The COMPUTE timestamp pool is 2,048 queries deep and only a resolve returns them.**
`WebGPUTimestampQueryPool` is constructed with `maxQueries = 2048` (`WebGPUBackend.js:2262`) and
warns once when exhausted. A long unmeasured loop with `trackTimestamp: true` will trip it. Also:
`_resolveQueries` returns *"the total duration of the last frame"* in the pending set
(`WebGPUTimestampQueryPool.js:226`), which is why `spike-harness.js` renders nothing while a
resolve is outstanding — and why that guard now covers the compute pool too.

---

## 7. VRM spring bones — the honest cheap baseline, read off its source

`VRMSpringBoneJoint.ts` and `VRMSpringBoneManager.ts` from `pixiv/three-vrm@dev`, fetched this
session.

### 7.1 The update, verbatim in structure (`VRMSpringBoneJoint.ts:243–259`) [V]

```ts
_nextTail
  .copy( this._currentTail )
  .add( _v3A.subVectors( this._currentTail, this._prevTail ).multiplyScalar( 1 - this.settings.dragForce ) )
  .applyMatrix4( this._getMatrixCenterToWorld() )
  .addScaledVector( worldSpaceBoneAxis, this.settings.stiffness * delta )
  .addScaledVector( this.settings.gravityDir, this.settings.gravityPower * delta );

// normalize bone length
_nextTail.sub( _worldSpacePosition ).normalize().multiplyScalar( this._worldSpaceBoneLength ).add( _worldSpacePosition );

this._collision( _nextTail );
```

Three forces — inertia, stiffness toward the rest bone axis, gravity — then a **hard length
projection**, then colliders, then the joint's quaternion is rebuilt with `setFromUnitVectors`.
Library defaults, from the constructor (lines 170–175): `hitRadius 0.0`, `stiffness 1.0`,
`gravityPower 0.0`, `gravityDir (0,−1,0)`, **`dragForce 0.4`**. The VRM 1.0 specification gives
ranges but *"no default values"* for these; the 7 cm terminal-joint length is a **VRM 0.0** rule
(`VRMSpringBoneJoint.ts:194`, with the spec link in the comment).

### 7.2 🚩 Punch-list 6.6's claim about the timestep is correct [V]

`VRMSpringBoneManager.update( delta )` (line 125) calls `springBone.update( delta )` (line 137) and
that is the entire timestep story — no accumulator, no substepping, no clamp. And `delta` enters
the update **linearly and only on the stiffness and gravity terms**: the inertia term
`(currentTail − prevTail) · (1 − dragForce)` has no `delta` in it at all. So at 30 fps the same
`dragForce` produces half the damping per second that it does at 60 fps, and the two look
different. Framerate-dependent by construction, exactly as 6.6 says.

### 7.3 What the browser ecosystem actually ships, and it is thinner than expected [V]

`wiggle@0.0.17` (npm, fetched this session) is the library the three.js community reaches for. Its
`step()` is:

```js
goalPosition.copy( this.oldBoneWorldPosition )
  .lerp( this.targetHelper.position, Math.min( this.options.velocity * dt, 0.99999 ) );
```

A first-order exponential lag toward the parent's transported position. **No inertia, no gravity,
no collision, and no distance constraint** — length is preserved by construction instead: the goal
position is used only to build a quaternion, and then `this.target.position.set( 0, 0, 0 )` puts
the bone back on its parent's origin (line 124, with a commented-out `maxStretch` clamp beside it
that never shipped). It runs 1 or 2 fixed substeps of `0.0085 * 100` per update (lines 76–85) and
calls `updateMatrixWorld` per bone per substep, which is where its cost lives.

⚠️ Searches for shipped **WebGPU** hair simulation in a browser turned up demos of particles,
cloth and galaxies, and no strand or card hair solver [✗]. The nearest published thing is three's
own compute-cloth example (§6.1). **This project would be doing something the browser ecosystem
has not published, which is a reason to spike it and not a reason to avoid it.**

### 7.4 Why spring bones are still the wrong choice here, given the measurement [D]

Not length — §0.4 disposes of that. The three real reasons:

1. **0.144 ms of main thread against 0.014 ms of GPU** [M], and they are not the same budget. The
   CPU figure competes with affect, IK, morph updates and the render submit, all on one thread;
   the GPU figure competes with the render, which `hair.md` §7 quotes at 12.995 ms p50 of 16.6 ms
   (⚠️ **that figure was not re-measured here**). Ten times cheaper *and* on the less contended
   side is the whole argument.
2. **It is a hierarchy walk.** VRM updates matrices per joint per frame; the cost scales with
   `Object3D` traversal, not with arithmetic, and it does not vectorise.
   294 chains × 16 joints is 4,704 joints of `updateMatrix` + `matrixWorld` multiply.
3. **The groom would have to become a bone hierarchy.** 4,704 bones in a GLB, weighted per card,
   against a solver that reads a flat position buffer the generator can emit as an attribute.
   That is a much larger change to `hair_cards.py` than §8.3 asks for.

**Spring bones remain the right answer for the things 6.6 actually names** — a ponytail, a scarf
tail, breast/soft-tissue jiggle (6.8) — where the count is tens of joints, the asset is already a
bone chain, and the CPU cost is genuinely negligible.

---

## 8. The recommendation

### 8.1 Run **DFTL on guide curves in one WebGPU compute pass**, with a TressFX global shape constraint. [D from §0.2, §0.3, §3, §4.3]

Measured cost at the shipped groom size: **0.01361 ms median, 0.01398 ms p95** — 0.082% and 0.084%
of a 16.6 ms frame. Correct to **0.00002 mm** of segment-length error over 600 frames, read back
off the buffer (§9.2).

The step, in the order the spike runs it:

1. Root ← skinned rest position (the head bone's matrix × the authored root).
2. Per interior particle: `p ← x + Δt·v + Δt²·g` (PBD eq 1).
3. Global shape constraint: `p += k_global · (restWorld − p)` over the first `range` of the chain.
4. Colliders: skull sphere, shoulder capsule.
5. FTL projection onto the sphere of radius `l₀` about the predecessor; keep `d`.
6. `v ← (p − x)/Δt`, then a second loop for `v_i += −s_damping · d_{i+1} / Δt` (DFTL eq 9).
7. Rebuild the card ribbon from the centreline (§5.2).

**Two substeps at 60 Hz**, i.e. `Δt = 1/120`, because that is where the spike measured and it is
1.6× the cost of one substep (0.00842 → 0.01361 ms) for meaningfully better shock response. Eight
substeps is still 0.024–0.031 ms if a future asset needs it — the one variant this spike could not
pin, see §0.3.

Starting parameters, each with its source:
- `s_damping = 0.9` — the FTL paper's Figure 4 value (§3.2) [V]
- `k_global = 0.30`, `range = 1.0` — **chosen here, not sourced.** TressFX ships no defaults (§4.3)
  [✗]. These are the spike's values and the ones its screenshots show; tune against the critic.
- `g = −9.81 m/s²`
- collision friction: not implemented; TressFX's default is `0.4f` (§4.6) [V]

### 8.2 What integration costs

| item | where | note |
|---|---|---|
| `physics/HairDynamics.js` | new, ~250 lines | the two kernels plus buffer setup; `tools/spikes/hair-dftl.js` is a working draft of exactly this |
| one array-shaped `renderer.compute()` per frame | the `alive.html` loop | 🚩 **must be an array** — §0.3 |
| `HairMaterial.positionNode` | `packages/core/src/material/HairMaterial.js` | reads the rebuilt vertex buffer by `vertexIndex`; **not this agent's file** — filed as a request in this round's report |
| tangent | same | the rebuild kernel already has the simulated tangent; today `hair.md` §6.1 requires it baked. This *replaces* a baked attribute rather than adding a pass |
| head transform | `alive.js` | one `Matrix4` uniform per frame, from the `head` bone's world matrix |
| colliders | new | one sphere + one capsule, derived from the rig; TressFX's SDF path is not warranted at 4,998 particles |

The piece with real risk is **none of the above**: it is that the groom currently rides the head
rigidly at 100% weight (`hair_cards.py:1442 weight_to_head`, and the `HAIR_BONE` comment above it
at line 454 already anticipates this: *"When a sim exists the tail's weights are where it
attaches."*). The armature modifier and the solver must not both
move the same vertices. Either the hair mesh stops being skinned and becomes solver-driven
entirely, or the solver works in head-local space and skinning stays. **The spike does the former**
and it is the simpler contract.

### 8.3 What the groom generator has to emit — and it is less than expected [D from §5.2]

Nothing in `hair_cards.py`'s *growth* changes. What changes is that the guide, which the generator
already computes and then throws away, has to survive into the GLB:

1. **The centreline** — 17 points per card, and specifically the **post-clumping** curve
   `ribbon_of` is actually handed, i.e. after `draw_into_lock` has blended it toward its lock, not
   `grow_to_cut`'s raw return. Only the ribbon is exported today. 🎯 The curve is already
   **uniformly resampled along its own arc** (`hair_cards.resample`, and `hair_cards.py:773–775`
   states the property: *"both curves carry GUIDE_SEGMENTS + 1 points and both are resampled
   uniformly by `grow_to_cut`, so index i is the same fraction along either one"*), which is what
   makes one rest length per chain exact rather than approximate.
2. **Per-ring half-width** — one float per ring. Currently baked into the ribbon's vertex positions
   (`ribbon_of`: `half = layer.half_width · width_scale · (1 − (1−TIP_WIDTH_FRACTION)·s)`).
3. **Per-card twist** — one float. Currently baked in the same place.
4. **A card→guide index and a ring index per vertex** — so the vertex shader or the rebuild kernel
   knows which of the two edge vertices it is. If the generator keeps emitting vertices in
   ring-major order with the two edges adjacent, this is derivable from `vertexIndex` and costs
   nothing.
5. **A `pinned` flag or a root-vertex count** — which rings are kinematic.

Sizes, for a 294-card groom: centreline 4,998 × vec3 = 60.0 kB, half-widths 4,998 floats = 20.0 kB,
twists 294 floats = 1.2 kB [D]. Against the GLB's current 2.77 MB, immaterial.

The natural container is glTF `extras` on the mesh plus a small sidecar, following the same rule
the manifest already applies to `flow` and `depth`: *"nothing in glTF's material model has a socket
for them and packing them into an unused one would be a lie the next reader has to discover."*

### 8.4 What NOT to do

- ❌ **Do not build XPBD.** §2.3 — it solves two problems this project has already pinned.
- ❌ **Do not simulate a separate, sparser guide set and bind cards to it.** That is the right
  answer when cards outnumber guides by 10–50×; here they are 1:1 and a binding layer would add
  authoring, a weighting scheme, and interpolation artefacts to buy back 0.0043 ms.
- ❌ **Do not put each kernel in its own `renderer.compute()` call.** §0.3.
- ❌ **Do not port TressFX's `groupshared` length-constraint solver.** §6.2 — its barriers exist to
  solve a problem this chain length does not have.
- ⚠️ **Do not assume the shading survives.** `HairMaterial` reads a baked tangent (`hair.md` §6.1);
  a moving groom must feed it a computed one, and `hair.md` §8 already flags *"Alpha-hash seed
  stability under skinning"* as unprobed. A moving groom makes that question live.

---

## 9. What the spike actually proved, and how

`tools/spikes/hair-motion.html`, `hair-dftl.js`, `hair-groom.js`. Results and a full-page
screenshot in `tools/spikes/results/hair-motion{,.run2,.breakftl}.{json,png}`. The measurement protocol
is `tools/spikes/README.md` §"What the numbers mean" — GPU timestamps, `setAnimationLoop`-driven,
no rendering while a resolve is outstanding, three alternating-order repeats.

### 9.1 The groom the spike simulates is a stand-in, and here is exactly how [M]

`assets/hair/bob01/*.glb` is gitignored build output, so `hair-groom.js` regrows the guides from
`hair_cards.py`'s own constants — `HAIR_LAYERS` (all five, with their card counts, standoffs,
lengths, half-widths, gravities and jitters), `GUIDE_SEGMENTS 16`, `GRAVITY_PER_SEGMENT 0.41`,
`GRAVITY_POWER 1.60`, `CARD_TWIST 0.35`, `TIP_WIDTH_FRACTION 0.62` — over an analytic skull sphere
instead of the basemesh. **Card count, ring count and widths are the shipped ones. The curves are
not**, and R14's two newest growth stages are not modelled at all: `grow_to_cut` corrects a card's
length until its tip lands on the style's cut plane, and `layer.length` is now only the generator's
first guess at the arc. This is the same stand-in move `morph-cost.html` makes with a 164×82
sphere for hm08's head region.

🎯 One thing the R14 rebuild made *exactly* right that was previously an approximation:
`hair_cards.resample` now spaces a guide's rings uniformly along its own arc, so the rest segment
length really is constant along a chain — which is the assumption `hair-dftl.js` stores one float
per chain on.

> ⚠️ **THAT PARAGRAPH IS WRONG AND §10.1 IS THE MEASUREMENT THAT SAYS SO.** `resample` does return a
> uniform curve; `draw_into_lock` then blends it toward its lock and pushes the result off the body
> three times, and `clamp_cards_off_the_body` moves ribbon corners after that. Measured off the
> shipped GLB, the within-card segment spread is a **median of 38.91%**. The runtime solver stores
> one rest length **per segment**.

### 9.2 The correctness check, and its red proof [M]

600 frames of a fixed head shake (±0.85 rad yaw at 0.6 Hz, ±0.18 rad pitch at 1.7 Hz, ±0.12 rad
roll at 2.9 Hz, plus translation), then `getArrayBufferAsync` on the position buffer:

| check | green | red (`?breakFtl=1`) |
|---|---:|---:|
| worst segment-length error | **0.00002 mm** PASS | **21.48883 mm** FAIL |
| worst tip lag behind the rigid pose | 229.14 mm PASS | 39.84 mm PASS |
| deepest skull penetration | 0.000 mm PASS | 0.000 mm PASS |
| non-finite components | 0 PASS | 0 PASS |

`?breakFtl=1` sets one uniform that replaces the projected position with the unprojected one and
zeroes the correction vector. Everything else — prediction, gravity, global shape constraint,
colliders, the DFTL velocity term — still runs. **One row goes red and three stay green**, which is
what makes the length row a measurement of inextensibility rather than of the solver being alive.
Restoring is a query-string change; the source is byte-identical between the two runs.

The 229.14 mm figure is the worst tip's distance from where the head transform alone would have put
it — i.e. how much lag the simulation is producing. The smallest is 0.28 mm, which is a root-layer
card that the global shape constraint is holding, as intended.

### 9.3 What was not measured, stated so nobody reads its absence as a claim [✗]

- **The real hair material.** The spike's cards are untextured `MeshBasicNodeMaterial`. Nothing
  here says what `HairMaterial` + `HairOIT` cost on a moving groom, and the render column in the
  results is a 512×512 toy.
- **The real groom's curves** — §9.1. The stand-in also predates nothing: it was re-transcribed
  against R14's constants after the bake changed under this session (§0.1), and re-measured.
- **Interaction with the rig.** The head is a uniform `Matrix4`, not a skinned bone.
- **Anything but Chromium on Apple Metal.** Compute-pass overhead is exactly the quantity that
  differs most between browsers (§0.3), and it is 93% of the ungrouped cost.
- **Sustained thermal behaviour**, DPR > 1, and the WebGL2 fallback tier — which has **no compute
  shaders at all** (`rendering-stack.md` §2: *"WebGL2 is OpenGL ES 3.0. **No compute shaders, no SSBOs,
  no image load/store**"*), so the fallback tier needs the CPU spring chain or nothing. That is a real
  consequence of this recommendation and §8 does not address it.
- **Local shape (bend) constraints, hair–hair repulsion, wind, SDF collision.** The spike has one
  sphere and one capsule.
- **Whether "messy" gets better.** The owner's complaint and the critic's report are about
  shading and card ends. Motion is orthogonal to both, and this document should not be read as
  addressing either.

---

## 10. What building it found — corrections and additions from the runtime integration

`packages/core/src/motion/HairDynamics.js` and its gate `HairDynamics.selftest.mjs` landed against
this document. Everything below was measured **2026-08-13** on the shipped
`assets/hair/bob01/g050.glb` (the 21:12 bake, 10,648 vertices, 294 cards of 17 rings), through
`packages/testbed/src/hair.html?motion=1&capture`, headless Chromium via Playwright, WebGPU. The
recommendation in §8.1 survived; four of its details did not.

### 10.1 ✗ The guide curves are NOT uniformly resampled, so one rest length per chain is wrong [M]

Ring midpoints per card, off the GLB's POSITION accessor:

| within-card segment spread `(max−min)/max` | median | p90 | max |
|---|---:|---:|---:|
| 294 cards | **38.91%** | **72.49%** | **100.00%** |

Individual segments inside one card run from **0.000 mm to 95.375 mm**. Card arcs run **76.8 mm to
491.8 mm, median 187.1 mm**. §9.1's claim is corrected above; the cause is `draw_into_lock`'s blend
and its `CLUMP_CLEARANCE_PASSES` push-outs, which run *after* `grow_to_cut`'s `resample`.

A chain-level rest length would pull every card toward a straight, evenly-spaced curve on the first
frame. One float per particle is 20 kB and exact.

### 10.2 🎯 §8.3 is not needed: the generator does not have to change at all [M/D]

§8.3 asks `hair_cards.py` to export the centreline, the per-ring half-width, the per-card twist, a
card→guide index and a pinned flag. None of it is required. The card is a ribbon symmetric about its
guide, so with the two edge vertices of ring `k` adjacent in the buffer,

```
centre[k] = ½( v[2k] + v[2k+1] )        offset[k] = ½( v[2k+1] − v[2k] )
```

recovers the guide and the half-width **vector** — the twist included, because the twist is already
the direction of `offset`. The layout that makes this true is asserted rather than assumed: 296
connected components, 294 of exactly 34 vertices as contiguous runs starting at vertex 652, and
`{2k, 2k+1}` a triangle edge for every ring of every card. `deriveCardGroom` throws by name if a
future bake reorders its vertices.

**And the rebuild does not re-derive `ribbon_of`'s frame either**, which is what §5.2 warns about. It
transports the authored offset by the **minimal rotation from the head-carried rest tangent to the
current tangent** (two Householder reflections, no trigonometry). That rotation is exactly the
identity when the chain has not moved, so the rebuilt groom is the authored groom at rest — measured
at **0.000132 mm worst over 4,998 particles after 300 frames with the head still**, which is the
property that makes the `?motion=1` A/B toggle a control rather than an approximation.

### 10.3 🚩 §8.2's step order lets FTL undo the collision, and the spike's own table shows it [V/M]

§8.1 orders the step colliders (4) then FTL (5). FTL then projects the particle back onto the sphere
about its predecessor, which can put it straight back inside. The spike's correctness table (§9.2)
reports **0.000 mm of skull penetration in the green run AND in the `?breakFtl=1` red run** — a
statistic over a mask that never contained an event.

Both constraints can be satisfied **exactly**. Two overlapping spheres meet in a circle, and every
point of it is at `l₀` from the predecessor and at `R` from the collider centre. With `D = |C − A|`,

```
a = ( D² + l₀² − R² ) / 2D        r = √( l₀² − a² )        circle centre = A + â·a
```

and projecting the offending point onto that circle costs one normalize. Measured: **0.000 mm of
penetration with the collider on over a mask of 25 live contacts, 6.4–17.8 mm with
`?hairdefect=nocollide`, and 0.000107 mm of segment error either way.**

Two collider bugs found on the way, both of which produce plausible-looking numbers:

- **A collider left at a fixed world point.** The skull must ride the head matrix. Before it did,
  every variant — including `?hairdefect=kinematic`, where nothing moves relative to the rigid pose
  — reported a constant **9.709 mm** of penetration.
- **Two colliders resolved in sequence.** The second pushes the particle back inside the first and
  they trade it back and forth. Only the deepest violation is resolved per substep.
- ⚠️ And the collider must be **fitted**, not typed. The head BONE's origin is 61 mm below the
  cranium's centre, and the largest sphere centred there that clears the rest groom is **49.7 mm** —
  a marble the hair can never reach. A least-squares sphere through the 294 card roots reads centre
  (0.0044, 1.5761, 0.0382) and **radius 97.3 mm**; the largest radius about that centre no rest
  particle violates is **76.1 mm**. The 21 mm gap is the bob's own tips hanging beside the cheek,
  which is the measurement that says **one sphere cannot be a skull for this style** — §3.3's eight
  ellipsoids are what that costs.

### 10.4 ✗ `k_global = 0.30` with `range = 1.0` is invisible on this groom, and the pair is the wrong parameterisation [M]

§8.1's starting parameters, applied to the shipped groom under a ±0.85 rad / 0.6 Hz head shake, move
the worst tip **3.2 mm**. Nothing at portrait framing can see that. TressFX's other knob does not
help: `globalShapeMatchingEffectiveRange` switches the constraint off at a ring boundary, which is a
kink on a 17-ring card, and taking the hold to zero at all costs the style — with the hold ramped to
zero over the whole chain the groom carried **86 mm of permanent sag** and the settled plate was a
head with the bob hanging off the back of it. DFTL has no bending stiffness (§4.4), so the global
constraint is the only thing holding a style.

What shipped is a **root stiffness and a tip stiffness**, linearly interpolated, with the tip value
swept:

| tip | peak worst-tip lag | peak mean-tip lag | settled mean | 0.25 s quiescence |
|---|---:|---:|---:|---:|
| 0.10 | 15.8 mm | 3.8 mm | 1.05 mm | 0.0011 mm |
| 0.05 | 26.7 mm | 11.5 mm | 2.06 mm | 0.0023 mm |
| **0.03** | **56.6 mm** | **20.1 mm** | **3.38 mm** | **0.0283 mm** |
| 0.02 | 69.1 mm | 24.7 mm | 4.97 mm | 0.0856 mm |
| 0.01 | 97.4 mm | 32.0 mm | 9.15 mm | 0.9636 mm |

Root 0.30 / tip 0.03. ⚠️ The table was taken at a uniform tip stiffness, before §10.6's per-card
scaling was added; the shipped numbers are in the gate's own output.

### 10.5 🎯 Gravity has to be applied as a DIFFERENCE, or the rest pose is not the equilibrium [D/M]

The authored groom already hangs under gravity — `hair_cards.py:1123` bends every guide by
`GRAVITY_PER_SEGMENT · layer.gravity · s^GRAVITY_POWER` (0.41 and 1.60 at :398–399). Adding the full
9.81 m/s² on top of it leaves the global shape constraint as the only thing balancing it, so the
groom settles at a permanent offset of about `g·h²/k`: measured, **10.5 mm of tip sag at a tip
stiffness of 0.30 and 68 mm at 0.01**, with no setting that has both a soft tip and the authored
silhouette.

Gravity is therefore resolved into the head's rest frame once and subtracted back out through the
head's current orientation: `g_effective = g_world − R_head · R_rest⁻¹ · g_world`. Head upright, it
is exactly zero; head tilted 30°, it is the difference between two 9.81 m/s² vectors 30° apart,
which is the force that actually makes hair fall sideways when you tip your head.
`?hairdefect=fullgravity` is the red proof and reads **32.9 mm of sag with the head still** against
0.000132 mm.

### 10.6 🚩 One stiffness for the whole groom makes the mass slide as ONE PIECE [I/M]

Seen, not measured first. With a single tip stiffness every card lags by nearly the same amount,
because every card is held to its own rest by the same spring against the same rotation — so the
groom slides as a cap and exposes the scalp shells at the crown. That is the blind critic's static
complaint (*"nothing separates into a strand group"*) made louder by motion.

The tip stiffness is now scaled per card by `median arc / this card's arc`, clamped to [0.3, 3]: a
longer card is a heavier one and lags further, and the groom already carries a **6.4x** spread of
arc length (§10.1). Deliberately not a random jitter — a per-card random number is state a capture
has to reproduce and a seed somebody has to own, and length is the physically right variable.

⚠️ **It helps the statistics and it does not fix the picture.** Peak worst-tip lag went 48.7 → 62.6
mm and mean 14.7 → 15.7 mm at the same instant, and the side-view plate looks the same: the bulk of
a bob is mid-length, so most cards get a scale near 1. The honest conclusion is that **differential
lag has to come from the groom** — per-lock mass and clumping — **or from a bend constraint**, and
neither is in this round.

### 10.7 The substeps need a head pose each, or "fixed timestep" is not frame-rate invariance [M]

The root is kinematic, so the head's path IS the simulation's input. A page that sets one head
matrix per frame gives both 60 Hz substeps the same pose while a 120 Hz frame gets its own, and the
two rates trace different root paths through the same motion. Measured to t = 2.0 s of the shake,
60 Hz against 120 Hz: **4.20 mm mean / 31.10 mm worst** over the 294 tips, on a signal of 18.5 mm —
23% of it.

⚠️ And the fix cannot be one uniform rewritten between dispatches, because §0.3's rule puts every
substep in a single `renderer.compute( array )` and a uniform is uploaded once per submission. Each
substep is a distinct compute node with its own head matrix, filled by decompose–slerp–recompose
between last frame's pose and this one. After that: **0.68–0.75 mm mean / 2.3–4.6 mm worst**, a 6.7x
improvement, against **23.0–25.2 mm mean** for `?hairstep=perframe`.

### 10.8 What it costs here, and what the clock was doing [M]

`?gputime=1`, COMPUTE pool, 120 sampled frames after 60 warm-up, headless Chromium/Metal, one
array-shaped `renderer.compute()` a frame carrying two DFTL substeps plus the card rebuild:

| | p50 | p95 | share of 16.6 ms |
|---|---:|---:|---:|
| whole solver, per frame | **0.0227–0.0242 ms** | **0.0320–0.0518 ms** | 0.19–0.31% |
| dispatch arithmetic alone, amortised over 64 copies in one pass | 0.0177–0.0193 ms | — | — |

The difference between the two rows is the pass opening, and it is the same story §0.3 tells at
30.8–54.1 µs on its own hardware.

⚠️ **Two clock warnings, both measured.** In headless Chromium the pool resolves to the nanosecond
(GCD of 120 samples = 0.000001 ms); in the Chrome behind the browser pane, **every sample was an
exact multiple of 0.065536 ms** — one or two ticks, nothing between — so a per-frame cost quoted
there is quoting the clock. And `WebGPUTimestampQueryPool._resolveQueries` sums durations into
`framesDuration[frame]` keyed by `${name}:f${frame}` (r185, :203–222), so thirty-two
`renderer.compute()` calls in one frame collide on that key and the resolve reports ONE of them:
32 passes read the same 0.06554 ms as 1. Amortisation has to be `n` copies of the dispatches inside
**one** pass, not `n` passes.

### 10.9 🎯 The solver does not have to unskin the groom, and §8.2's dilemma dissolves [V]

§8.2 says the armature and the solver must not both move the same vertices, and offers two
contracts: unskin the groom, or solve in head-local space. r185 settles it —
`NodeMaterial.setupPosition` runs `skinning( object )` and **then overwrites** `positionLocal` with
`positionNode` (`NodeMaterial.js:776`, `:804`). A card vertex takes the solver's answer and never
sees the skin matrix; a scalp-cap vertex — head, not hair — keeps its skinning untouched, chosen by
one `select` on `vertexIndex` rather than by a third dispatch. The rebuild emits mesh-local
positions directly (one `worldToObject` multiply in compute, which runs once per vertex per FRAME
rather than once per vertex per PASS).

### 10.10 The one WGSL trap that cost an hour [V]

`from` and `to` are **reserved keywords in WGSL**, and `Fn(...).setLayout({ inputs: [...] })` passes
a parameter name straight through to the generated signature. Naming them that way compiles to
`'from' is a reserved keyword`, which surfaces as a pipeline validation error a hundred frames deep
in the console — the kernel silently writes nothing, every buffer reads back zeros, and the groom
renders as its scalp caps alone. A CPU mirror of the same arithmetic would have scored it green.

---

## Appendix — primary artefacts used, and where each number came from

| artefact | how obtained | what was taken |
|---|---|---|
| `FTLHairFur.pdf` (Müller, Kim, Chentanez, VRIPHYS 2012) | fetched from `matthias-research.github.io`, all 6 pages read as images | §3 entire — eqs 1–11, `s_damping` 0.9, the GTX 480 costs |
| `posBasedDyn.pdf` (Müller et al., 2006/2007) | same site, pages 3–6 | §1 — the 17-line loop, eqs 5–11, the `k'` correction |
| `XPBD.pdf` (Macklin, Müller, Chentanez, MiG 2016) | same site, pages 1–4 | §2 — eqs 17–18, `α̃ = α/Δt²`, the iteration-count argument |
| `TressFXSimulation.hlsl`, `.cpp` | `raw.githubusercontent.com/GPUOpen-Effects/TressFX/master` | §4 entire, with line numbers |
| `VRMSpringBoneJoint.ts`, `VRMSpringBoneManager.ts` | `raw.githubusercontent.com/pixiv/three-vrm/dev` | §7.1–7.2 |
| `wiggle@0.0.17` | `npm pack`, `src/index.js` read | §7.3 |
| `examples/webgpu_compute_cloth.html` @ r185 | `raw.githubusercontent.com/mrdoob/three.js/r185` | §6.1 |
| `node_modules/three` @ 0.185.1 | installed tree | §6 entire, every line number |
| `assets/hair/bob01/g050.glb` | this repository | §0.1 — GLB JSON chunk parsed, union-find over the index buffer |
| `tools/figure-pipeline/hair_cards.py` | this repository | §5.2, §8.3, §9.1 |
| `tools/spikes/results/hair-motion{,.run2,.breakftl}.json` | produced by this session's runs | every millisecond in this file |
| Unreal groom docs | `dev.epicgames.com`, two pages | §5.1 only; no numbers were available [✗] |

⚠️ **§10 was added in a later session and its artefacts are its own.** Everything in it came from
`assets/hair/bob01/g050.glb` read directly, from `packages/testbed/src/hair.html?motion=1&capture`
driven through headless Chromium, from `node_modules/three` @ 0.185.1, and from
`tools/figure-pipeline/hair_cards.py`. `packages/core/src/motion/HairDynamics.selftest.mjs` prints
every number in §10.1–10.8 on a clean run; nothing there is copied from §0–§9.
