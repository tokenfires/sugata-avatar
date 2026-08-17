# IK and spring bones — verified research

Researched and measured 2026-08-16, for punch-list **6.5** (IK), **6.6** (spring bones), **6.7**
(collider pruning) and **6.8** (soft-tissue jiggle). Companion to `body-motion-numbers.md`, which
owns the postural literature and contains **no** IK or spring-bone material, and to
`hair-motion.md` §7, which already read the three-vrm source once and which this document
**corrects in one place** (§3.3).

Every three.js claim is checked against the **installed** source in `node_modules/three` at
**r185** (`three@0.185.1`, from its own `package.json`). Every three-vrm and VRM-spec claim is
checked against raw source or raw schema fetched this session by `curl`, never through a
summariser — LEARNINGS §1.25s. Every number that is not a quotation was produced by running
something, and the script that produced it is named.

Confidence markers, same scheme as `hair-motion.md`:

- **[V]** Verified against a primary artefact, quoted with the file and line it came from
- **[M]** Measured **in this session**, with the script named
- **[D]** Derived here from [V]/[M] facts, with the derivation shown
- **[I]** Inference, explicitly flagged
- **[U]** **UNVERIFIED** — repeated from a secondary source whose primary could not be reached
- **[✗]** Negative finding — looked for, not there

Scripts written for this document were run from `tmp/ik-survey/`: `measure-leg.mjs`, `twobone.mjs`,
`springbone.mjs`, `drag.mjs`, `accumulator.mjs`. ⚠️ **`/tmp/` is gitignored (`.gitignore:8`), so
they are not in version control and a fresh clone will not have them.** They are named below so a
reader knows a table came from a program rather than from arithmetic in a comment — every formula
they implement is stated in full in the section that quotes their output, so each table is
re-derivable without them. Nothing in the repo imports them and none is a gate.

---

## 0. The seven findings that decide 6.5–6.8

### 🎯 0.1 `CCDIKSolver` cannot be used as a `MotionStack` layer without a snapshot-and-restore wrapper, and `ozz`'s two-bone job can be, because it emits **correction quaternions** instead of writing bones. [V/D]

`CCDIKSolver.updateOne` writes `link.quaternion.multiply( _quaternion )` in place
(`CCDIKSolver.js:198`) and calls `link.updateMatrixWorld( true )` (`:231`). `MotionStack.commit()`
writes `bone.quaternion = rest × delta` (`MotionStack.js:727`) and owns every declared channel
absolutely — "once a channel is declared by any layer, nothing outside the stack may write it,
ever" (`MotionStack.js:23-24`). The two are incompatible as written. §1.6 gives the wrapper.

`ozz-animation`'s `IKTwoBoneJob` writes to `start_joint_correction` and `mid_joint_correction`,
two output quaternions, and never touches the skeleton (`ik_two_bone_job.cc:301-330`). That is
already the `Layer.contribution.boneRotations` shape. §1 states its maths in full so it can be
reimplemented rather than vendored.

### 🚩 0.2 Punch-list 6.5's "`CCDIKSolver.blendFactor`" names a property that does not exist. [V]

There is no `blendFactor` on `CCDIKSolver`. There is `ik.blendFactor` per chain
(`CCDIKSolver.js:106`) and a `globalBlendFactor` argument to `update()` (`:83`). The distinction
matters because the per-chain value **wins** over the argument, so a caller that passes a global
blend and also has a chain with its own `blendFactor` gets the chain's. §1.5.

### 🚩 0.3 Punch-list 6.5's "⚠️ `iteration` defaults to 1" is right, and the repo's stated *reason* for saying so is now stale. [V]

`const iteration = ik.iteration !== undefined ? ik.iteration : 1;` — `CCDIKSolver.js:122`.
`affect-and-animation.md:577,885` records this as *"`iteration` default is 1 in code, docs claim 5
— trust the code."* In r185 the JSDoc reads `@property {number} [iteration=1]`
(`CCDIKSolver.js:577`) and the standalone HTML doc page no longer exists in the repository
(`docs/examples/en/animation/CCDIKSolver.html` returns 404 at both `r170` and `r185`). **The
docs/code disagreement was fixed upstream.** The default is still 1; the warning about the docs
should be retired so nobody spends a round confirming a contradiction that is gone.

### 🎯 0.4 On this rig a knee bend without a pelvis drop becomes visible at **8.93°** of flexion, and fear's posture is nowhere near that small. [M]

`figure_g050.glb`, femur **394.71 mm**, tibia **407.33 mm** (§2.1). Flexing the knee by θ with the
hip fixed lifts the ankle by `(L₁+L₂) − √(L₁²+L₂²+2L₁L₂cos θ)`. At the repo's own framing constant
of **0.6574 px/mm** (LEARNINGS §1.10a) that lift crosses the repo's own **1.6 px**
indistinguishability floor at **8.9306°**. At 20° it is **12.18 mm = 8.01 px**, five times the
floor. §2.2.

### 🚩 0.5 The VRM spring-bone update is **unconditionally stable**, and its frame-rate problem is therefore about *look*, not about blowing up. [M/D]

Swept stiffness over five decades at 60 Hz, `tmp/ik-survey/drag.mjs`: at `S = 100000`
(`S·Δt/L = 23,810`) the joint angle **never exceeds its initial value** and never NaNs. The length
projection renormalises onto the sphere of radius `L` every step, and adding `k·û` to any vector
then renormalising approaches `û` asymptotically without crossing it. Nothing in three-vrm needs
substepping for *stability*. §3.5.

### 🎯 0.6 Punch-list 6.6's starting `drag 0.05` is the value that makes the frame-rate defect **worst**, by 2.8×. [M]

Measured 30-vs-120 Hz divergence of the same released joint, `tmp/ik-survey/drag.mjs`: **19.90°**
at `drag 0.05 / stiffness 0.75` against **7.19°** at `drag 0.4 / stiffness 1.0`. Velocity half-life
is `ln(0.5)/ln(1−drag)` **frames**, so at `drag 0.05` the wall-clock ring-down spans **450 ms at
30 Hz and 113 ms at 120 Hz** — a 338 ms spread against 34 ms for `drag 0.4`. The soft-tissue
parameters are exactly the ones that need the fixed timestep most. §3.6, §6.2.

### 🚩 0.7 Punch-list 6.7's "VRoid ships 460–1362 checks/frame, past VRChat's 'Poor' tier" is **arithmetically wrong at the low end**, and the range itself is [U]. [V/U]

VRChat's own table, fetched this session: PC **PhysBones Collision Check Count** maximum per rank
is Excellent **32**, Good **128**, Medium **256**, Poor **512**. **460 is inside Poor**, not past
it. Only the top of the quoted range exceeds 512, by **2.66×**. And no primary artefact for
"460–1362" could be reached — it appears in `affect-and-animation.md:718-721` without a file, a
`.vrm`, or a URL. §4.

---

## 1. The analytic two-bone IK solve

### 1.1 The statement of the problem

Three joints `A` (hip), `B` (knee), `C` (ankle). Two rigid segments of lengths

    L₁ = |B − A|      L₂ = |C − B|

A target point `T`. Two rotations are wanted: a correction at `B` about a **given** hinge axis
`n̂`, and a correction at `A` that swings the whole chain so `C` lands on `T` while the chain plane
contains a **given** pole vector `p̂`. `n̂` and `p̂` are inputs, not derivable from `A`, `B`, `C`
and `T` — see §1.4.

Let `d = |T − A|`.

### 1.2 The solve, in two applications of the law of cosines [V from `ozz_ik2.cc:181-190`]

ozz states it in a comment verbatim: *"Computes expected angle at mid_ss joint, using law of cosine
(generalized Pythagorean). c^2 = a^2 + b^2 - 2ab cosC; cosC = (a^2 + b^2 - c^2) / 2ab"*.

**Knee interior angle** `β`, the angle `∠ABC`:

    cos β = ( L₁² + L₂² − d² ) / ( 2 L₁ L₂ )
    β = acos( clamp( cos β, −1, +1 ) )

`β = π` is the straight leg; knee *flexion* is `π − β`.

**Hip swing correction** `α`, the angle at `A` between the segment `A→B` and the line `A→T`:

    cos α = ( L₁² + d² − L₂² ) / ( 2 L₁ d )
    α = acos( clamp( cos α, −1, +1 ) )

Both are *target* angles. The correction actually applied is the **difference** between the target
and the pose's current angle, so the solve composes onto whatever the animation already did rather
than replacing it. ozz computes both the corrected and the initial mid angle in one SIMD register
and subtracts (`ik_two_bone_job.cc:186-213`), and signs the initial angle by testing which side of
`n̂` the current `B→C` vector sits on:

```cpp
const SimdFloat4 bent_side_ref = Cross3(_setup.start_mid_ms, _job.mid_axis);
const SimdInt4 bent_side_flip = SplatX(
    CmpLt(Dot3(bent_side_ref, _setup.mid_end_ms), simd_float4::zero()));
```

That sign test is not optional. Without it a leg that is already bent the wrong way is "corrected"
to the same numerical angle on the wrong side and stays inverted.

**Hip rotation, assembled** (`ik_two_bone_job.cc:241-298`), in this order:

1. `end_to_target_rot` — the minimal rotation taking the post-knee-correction `A→C` onto `A→T`.
2. `rotate_plane` — a rotation **about the `A→T` axis** aligning the chain's plane normal with the
   reference plane normal `T̂ × p̂`. Its sign flips on `dot( jointPlaneNormal, p̂ )`.
3. an optional `twist_angle` about the same axis.

Final: `start_rot = twist ∘ rotate_plane ∘ end_to_target_rot`.

🎯 **The knee correction is computed first and fed into the hip solve.** The hip's
`end_to_target_rot` is built from `start_mid + midRotApplied(mid_end)`, not from the original
pose. Reversing the two produces a chain that reaches the target with the wrong knee angle.

### 1.3 The four degenerate cases, named and measured [M — `tmp/ik-survey/twobone.mjs`]

Run on `figure_g050`'s own segment lengths. The `acos(unclamped)` column is what an unguarded
implementation returns:

```
L1 = 394.71 mm  L2 = 407.33 mm
reach L1+L2 = 802.04 mm   inner |L1-L2| = 12.62 mm

  d (mm)      branch          cosKnee_raw    cosHip_raw     acos(unclamped knee)   knee (deg)   hip (deg)
  900.000     beyond reach      -1.518531      1.125835                      NaN      180.000       0.000
  802.038     beyond reach      -1.000000      1.000000                      NaN      180.000       0.000
  800.000     interior          -0.989846      0.997378                  171.828      171.828       4.150
  400.000     interior           0.502910      0.474640                   59.807       59.807      61.664
   12.624     too close          1.000000     -1.000000                    0.000        0.000     180.000
   10.000     too close          1.000185     -1.269920                      NaN        0.000     180.000
    0.000     too close          1.000496       Infinity                      NaN        0.000     180.000
```

**(a) Target beyond reach — `d > L₁ + L₂`.** `cos β < −1`, `acos` returns `NaN`, and one NaN
quaternion poisons every descendant matrix for the rest of the run. Note `d = 802.038 mm`, one
micron past the true reach of `802.0380 mm`: `cos β` is already exactly `−1.000000` and the
unclamped `acos` is already NaN. **The failure is not at "obviously too far", it is at the
boundary**, which is where a foot IK target sits every time the leg is straight.

**(b) Target too close — `d < |L₁ − L₂|`.** On this rig that radius is **12.62 mm**, a sphere of
about a fingertip around the hip joint. `cos β > +1`, `acos` NaN again. It cannot arise from foot
planting on a standing figure, and it *can* arise from an arm IK target parked at the shoulder or
from a target initialised to the origin before the first frame.

**(c) Zero-length segment.** `L₁ = 0` or `L₂ = 0` divides by zero in both cosines. ozz's answer is
structural rather than a guard: it inverts the joint matrices up front, and *"If matrices aren't
invertible, they'll be all 0 (ozz::math implementation), which will result in identity correction
quaternions"* (`ik_two_bone_job.cc:60-62`). **Degenerate input yields the identity correction, not
a NaN.** That is the behaviour to copy — a limb that cannot be solved should contribute nothing,
which in `MotionStack` terms is an identity delta that `accumulate()` skips at
`MotionStack.js:683`.

Note also `d = 0` exactly: `cos α = Infinity`, because `d` is the denominator. It needs its own
branch, not just a clamp.

**(d) The pole / knee-direction ambiguity.** The three points `A`, `B`, `T` with `d` fixed
determine `β` uniquely, and leave the whole chain free to rotate about the `A→T` axis. That one
remaining degree of freedom is the knee direction, and **no amount of algebra removes it — it must
be supplied.** ozz supplies it twice over: `mid_axis` (the hinge normal, `Validate()` fails if it
is not normalised, `ik_two_bone_job.h:57,78`) and `pole_vector` (`:85`, default `+Y`). The
`foot_ik` sample states the choice that keeps a solve looking like the animation it corrects:

> *"Pole vector is given by original knee forward vector, such that the result remains close to
> original animation."* — `guillaumeblanc.github.io/ozz-animation/samples/foot_ik/`

🚩 **Do not read the pole from the current pose every frame.** At full extension the knee's
"forward" direction is undefined to within numerical noise, so a per-frame read makes the pole
jitter, which rotates the whole chain plane, which snaps the knee sideways. Read it once from the
**rest pose**, which for this project is `figure/RestPose.js`'s normalised identity rig where the
axis is authorable and stable.

### 1.4 The conditioning problem at full extension, quantified [M]

The reason knee IK jitters in every engine, in one table (`tmp/ik-survey/twobone.mjs`):

```
  reach -    100 mm : knee flexion   57.8427 deg   d(flex)/d(d) =    0.2955 deg/mm
  reach -     10 mm : knee flexion   18.1166 deg   d(flex)/d(d) =    0.9077 deg/mm
  reach -      1 mm : knee flexion    5.7236 deg   d(flex)/d(d) =    2.8617 deg/mm
  reach -    0.1 mm : knee flexion    1.8098 deg   d(flex)/d(d) =    9.0266 deg/mm
  reach -   0.01 mm : knee flexion    0.5723 deg   d(flex)/d(d) =   27.9334 deg/mm
  reach -  0.001 mm : knee flexion    0.1810 deg   d(flex)/d(d) =   74.9633 deg/mm
```

Flexion goes as `√(reach − d)`, so the derivative diverges at full extension. **One micron of
target noise is 0.18° of knee angle**, and at a 400 mm shank that is 1.3 mm of patella travel —
which the repo's own 0.6574 px/mm converts to 0.83 px of visible knee wobble from a target error
far below any sane tolerance.

**The published answer is a soften band, not a tolerance.** ozz's `SoftenTarget`
(`ik_two_bone_job.cc:108-176`) reparameterises the last `soften` fraction of the chain length so
the target asymptotes to full reach instead of hitting it:

    da    = chainLen · clamp( soften, 0, 1 )
    ds    = chainLen − da
    alpha = ( |A→T| − da ) / ds
    ratio = 3⁴ / (alpha + 3)⁴                     // ozz stores 1−ratio; see the comment
    |A→T|' = da + ds − ds · ratio

with the comment *"Approximate an exponential function with : 1-(3^4)/(alpha+3)^4. The derivative
must be 1 for x = 0, and y must never exceeds 1."* The default is `soften = 1.f`
(`ik_two_bone_job.h:96`), which places the band's start at the full chain length — i.e. the
softening only shapes the region *beyond* reach, turning the hard clamp of §1.3(a) into a smooth
asymptote. A leg that should visibly never lock wants `soften` below 1; the value is a look
decision and there is no published number for it. **[✗]**

`reached` is returned as *"start_target_len is not beyond `da`, and is beyond `|L₁−L₂|`"* —
`(comp_mask & 0x5) == 0x4`, `ik_two_bone_job.cc:175`. Both degenerate radii are reported through
one boolean, which is the right shape for a gate.

### 1.5 What `CCDIKSolver` actually does, and its five traps [V]

Read in full at `node_modules/three/examples/jsm/animation/CCDIKSolver.js`. It is 595 lines, 260
of which are the helper.

The loop (`:135-239`): for each iteration, for each link from the effector outward, decompose the
link's world matrix, take the effector and target directions in link-inverse space, `acos` their
dot, build a quaternion about their cross product, post-multiply it onto the link, apply the
optional limits, then `link.updateMatrixWorld( true )`.

**Trap 1 — the target is a BONE, not a point.** `const target = bones[ ik.target ]` (`:115`), and
`ik.target` is an index into `mesh.skeleton.bones`. To IK to an arbitrary world position you must
put a bone in the skeleton at that position. The MMD rigs this was written for ship exactly such
bones; `figure_g050` does not. **[V]**

**Trap 2 — `_valid()` warns and continues.** It checks that each link is the parent of the
previous (`:293-297`) and only `console.warn`s. A mis-ordered `links` array produces a silently
wrong solve.

**Trap 3 — `updateMatrixWorld( true )` per link per iteration.** The `true` forces the whole
subtree. For a chain of `n` links at `i` iterations that is `n·i` forced subtree updates per
chain per frame, and for a leg the subtree includes the foot and toes.

**Trap 4 — the Euler limits are applied component-wise to a quaternion-derived Euler.**

```js
link.rotation.setFromVector3( _vector.setFromEuler( link.rotation ).max( rotationMin ) );
```

`:221` and `:227`. `link.rotation` is the Euler view of a quaternion just built from an axis-angle;
clamping its three components independently is not a rotation constraint and is gimbal-sensitive.
The source's own `// TODO: re-consider the limitation specification` (`:200`) is about the sibling
`limitation` path, which force-projects the quaternion onto a single axis.

**Trap 5 — `_initialQuaternions` is sized once, in the constructor** (`:60-71`), from the `iks`
array passed in. Pushing a chain onto `solver.iks` afterwards leaves
`this._initialQuaternions[ chainIndex ]` undefined and `updateOne` throws the moment
`blendFactor < 1`. Also `this.iks.indexOf( ik )` (`:108`) is a linear scan per chain per frame.

**How the blend actually works** (`:124-133`, `:241-255`): if `chainBlend < 1`, the link
quaternions are **snapshotted before** the solve and `slerp`ed toward the solved values after.
The snapshot is whatever is in `bone.quaternion` at call time, so the animated pose must already
have been written. That is the ordering `MotionStack` would have to guarantee.

`minAngle` / `maxAngle` clamp the per-step rotation magnitude (`:182-192`); `angle < 1e-5` skips
the link entirely with the comment *"skip if changing angle is too small to prevent vibration of
bone"* (`:180`) — a hard-coded deadzone of 0.00057°.

⚠️ The JSDoc for `maxAngle` reads *"Minimum rotation angle in a step in radians"*
(`CCDIKSolver.js:579`) — a copy-paste from `minAngle` one line up. Trust the code.

### 1.6 The wrapper `MotionStack` needs, stated so 6.5 does not rediscover it [D]

`MotionStack` composes `final = rest × δ₁ × δ₂ × …` and commits once (`MotionStack.js:16-19,727`).
An IK layer must therefore return **deltas from rest**, not absolute quaternions. For a solver that
writes bones in place, that is:

1. Read `stack.restRotationOf( boneName )` for every bone in the chain (`MotionStack.js:537`).
2. Save each bone's current `quaternion`.
3. Write the *composed* pose so far into the bones — the solver reads `matrixWorld`, so it needs
   the frame's accumulated pose, not rest.
4. Run the solver.
5. `δ = rest⁻¹ × solved` per bone.
6. Restore the saved quaternions.
7. Return the `δ`s in `contribution.boneRotations`.

Steps 2, 3 and 6 exist only because the solver mutates. An `ozz`-shaped solve skips all of them —
it consumes three model-space matrices and a target and emits two correction quaternions.
**That is the argument for reimplementing rather than vendoring.**

And the ordering trap that will bite regardless: `createMotionTarget` **snapshots** the scene graph
at call time with no invalidate (`MotionStack.js:754-777`), so any bone the IK layer wants must
exist at bind time. A target bone added later is invisible to the stack.

---

## 2. Pelvis drop and foot re-plant

### 2.1 This rig's leg, measured [M — `tmp/ik-survey/measure-leg.mjs`]

Read straight off `assets/figures/figure_g050.glb`'s glTF node table. Bone length is the magnitude
of a child's local translation, which is pose-invariant, so no pose evaluation is involved:

| bone | parent | local translation (m) | \|t\| (mm) |
|---|---|---|---:|
| `pelvis` | `Root` | [0, −0.013217, 0.874449] | 874.55 |
| `thigh_l` | `pelvis` | [0.101472, −0.003829, −0.010990] | 102.14 |
| `calf_l` | `thigh_l` | [0, 0.394707, 0] | **394.71** |
| `foot_l` | `calf_l` | [0, 0.407331, 0] | **407.33** |
| `ball_l` | `foot_l` | [0, 0.131569, 0] | 131.57 |

Right side identical to six decimal places except the sign of `x`. So:

    L₁ (hip→knee)  = 394.71 mm
    L₂ (knee→ankle)= 407.33 mm
    reach          = 802.04 mm
    |L₁ − L₂|      =  12.62 mm
    hip half-width = 101.47 mm

⚠️ The raw node table is Z-up (`pelvis.translation.z = 0.874`) — Blender's frame before the glTF
root conversion. Lengths are unaffected; anything reading axes off this table is not.

### 2.2 What "on stilts" costs, in pixels [M — `tmp/ik-survey/twobone.mjs`]

Flex the knee by θ with the hip held. The ankle rises by
`(L₁+L₂) − √(L₁² + L₂² + 2L₁L₂ cos θ)`. Converted at the repo's own framing constant, **0.6574
px/mm** (LEARNINGS §1.10a, *"1200 px over a 1825.4 mm frame"*), against the repo's own **1.6 px**
indistinguishability floor (LEARNINGS §1.10a, *"1.6 px is 2.43 mm"*):

| knee flexion | hip→ankle (mm) | ankle lift (mm) | lift (px) | verdict |
|---:|---:|---:|---:|---|
| 1° | 802.01 | 0.031 | 0.020 | below floor |
| 2° | 801.92 | 0.122 | 0.080 | below floor |
| 5° | 801.27 | 0.763 | 0.502 | below floor |
| **8.9306°** | 799.60 | **2.4338** | **1.6000** | **crossover** |
| 10° | 798.99 | 3.051 | 2.006 | VISIBLE |
| 15° | 795.18 | 6.860 | 4.510 | VISIBLE |
| 20° | 789.86 | 12.182 | 8.008 | VISIBLE |
| 30° | 774.72 | 27.322 | 17.961 | VISIBLE |

🎯 **Below 8.93° of flexion the naive version is inside the project's own indistinguishability
floor.** That is worth knowing precisely because it bounds how much of 6.5 the knee actually needs:
if an emotion's knee bend is 5°, a pelvis drop is not what makes it read. Above 8.93° it is a
measurable defect, and at 20° it is 8 px — five times the floor, and roughly the width of an eyelid
at this framing.

### 2.3 What the re-plant actually requires — the published order [V]

`ozz-animation`'s `foot_ik` sample is MIT-licensed and states the runtime steps in order
(`guillaumeblanc.github.io/ozz-animation/samples/foot_ik/`, fetched this session):

> 1. Updates base animation and skeleton joints model-space matrices.
> 2. Estimates character height on the floor, evaluted at its root position.
> 3. For each leg, raycasts a vector going down from the ankle position.
> 4. Comptutes ankle target position (C), so that the foot is in contact with the floor.
> 5. **Offsets the character down, so that the lowest ankle (lowest from its original position)
>    reaches its targetted position. The other leg(s) will be ik-ed.**
> 6. Applies two bone IK to each leg, so the ankles reache their targetted position.
> 7. Applies aim IK to each ankle, so the foot is correctly aligned to the floor.

Five things follow, and each is a place the naive version goes wrong.

**(a) The pelvis offset is decided by the *lowest* foot, and it is a translation.** Not an average,
not per-leg. The lower foot defines how far the body must come down; the other leg absorbs the
difference by bending. Splitting the drop between the two legs makes both feet float by half.

**(b) The pelvis drop happens BEFORE the IK, not after.** Step 5 precedes step 6. Drop first, then
solve each leg to the *already-correct* ankle target. Solving first and dropping after changes `d`
for both legs and invalidates both solves.

**(c) The foot's orientation is a second solve.** Step 7 is aim IK on the ankle using the floor
normal. A two-bone solve positions the ankle and says nothing about which way the sole points; a
figure whose ankle is in the right place with the foot at its animated angle is still not planted.

**(d) The ankle target is not the ray hit.** *"Because of floor slope … ankle position cannot be
simply be offseted by foot offset."* The heel-to-sole offset has to be rotated into the surface
frame first.

**(e) The sample says out loud what it is not.** *"It's not a complete foot planting
implementation"* — it lacks blend in/out when a foot is not meant to be planted, and detection of
unreachable targets. Both are 6.5's problem too.

### 2.4 🎯 Where `Sway` has already done two thirds of this, and where it has not

`motion/Sway.js` is 3,244 lines and it **already owns the pelvis, the legs, the feet and the
footprint clamp**. Read before touching the leg chain:

- **The pelvis already translates.** The inverted pendulum is written as *"the pelvis rotates by the
  lean … the pelvis translates so the rotation pivots about the ankles … each foot counter-rotates
  by the same lean, so the soles stay flat"* (`Sway.js:54-57`). A second writer of the pelvis
  offset is a conflict `MotionStack` will report but not resolve.
- **The base of support is measured off the mesh.** *"the foot is 232 mm long, running 183 mm
  forward of the ankle joint and 50 mm behind it"*, and *"the stance ankle sits 77.7 mm from the
  midline and the OUTER BORDER of that foot sits 147.7 mm from it"* (`Sway.js:389-417`). A foot
  re-plant that moves a foot must respect that footprint.
- **`PIVOT_HEIGHT_FRACTION_OF_ANKLE = 1.0` exists precisely to avoid needing foot IK**
  (`Sway.js:496-522`), and it names its own residual: *"the two ankles are 181 mm apart, so a
  frontal-plane lean of θ moves each of them 181 mm × (1 − cos θ) horizontally. At the largest lean
  this layer produces that is 0.29 mm, and no choice of pivot height removes it — **only foot IK
  would**."*

🚩 **0.29 mm is 0.19 px.** So the residual `Sway` names as the thing only foot IK can fix is
**eight times below** the project's own visibility floor. Foot IK is not justified by `Sway`'s
residual. It is justified by §2.2's knee bend and by nothing else in the current tree — which is a
useful scoping fact, because it says 6.5's leg IK is driven by 6.2's `kneeActivation` and by
future locomotion, not by the idle.

### 2.5 🚩 And the amplitude 6.5 would actuate has no source [V/✗]

`ExpressionMap.js:316` prescribes `fearful: { approach: −1.46, kneeActivation: 1.77 }`.
`PostureLayer.js` derives every full-scale angle by one rule the gate re-runs — *"each channel's
full scale is the smallest non-zero magnitude Coulson lists in the column that codes it"*
(`PostureLayer.js:51-53`) — and `CHANNEL_TO_COULSON_COLUMN` maps only `approach`, `armSpread` and
`headTiltUp` (`:130-134`).

**Coulson Table 1 has six columns and none of them is a knee.** Transcribed at
`PostureLayer.js:113-121`: abdomen twist, chest bend, head bend, shoulder ad/abduct, shoulder
swing, elbow. `grep -in knee docs/research/body-motion-numbers.md` returns **nothing**.

So the loading `1.77` is a relative weight with no full scale to weight, and the derivation rule
the affect half is gated on **does not extend to this channel**. 6.5 can build the mechanism —
the solve, the pelvis offset, the re-plant — and it will still not know how many degrees to bend
the knee. That is a research gap, not an implementation gap, and it should be filed as one rather
than absorbed as a tuning constant. §6.1.

---

## 3. The VRM spring bone

All line numbers are `pixiv/three-vrm@dev`, `packages/three-vrm-springbone/src/`, fetched
2026-08-16 by `curl` from `raw.githubusercontent.com`. Raw TypeScript, not a docs page.

### 3.1 The update, complete [V — `VRMSpringBoneJoint.ts:231-277`]

```ts
public update(delta: number): void {
  if (delta <= 0) return;
  this._calcWorldSpaceBoneLength();
  const worldSpaceBoneAxis = _v3B.copy(this._boneAxis)
    .transformDirection(this._initialLocalMatrix)
    .transformDirection(this._parentMatrixWorld);
  _nextTail
    .copy(this._currentTail)
    .add(_v3A.subVectors(this._currentTail, this._prevTail).multiplyScalar(1 - this.settings.dragForce))
    .applyMatrix4(this._getMatrixCenterToWorld())
    .addScaledVector(worldSpaceBoneAxis, this.settings.stiffness * delta)
    .addScaledVector(this.settings.gravityDir, this.settings.gravityPower * delta);
  _worldSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
  _nextTail.sub(_worldSpacePosition).normalize().multiplyScalar(this._worldSpaceBoneLength).add(_worldSpacePosition);
  this._collision(_nextTail);
  this._prevTail.copy(this._currentTail);
  this._currentTail.copy(_nextTail).applyMatrix4(this._getMatrixWorldToCenter());
  const worldSpaceInitialMatrixInv = _matA
    .multiplyMatrices(this._parentMatrixWorld, this._initialLocalMatrix).invert();
  this.bone.quaternion
    .setFromUnitVectors(this._boneAxis, _v3A.copy(_nextTail).applyMatrix4(worldSpaceInitialMatrixInv).normalize())
    .premultiply(this._initialLocalRotation);
  this.bone.updateMatrix();
  this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld, this.bone.matrix);
}
```

As a recipe, precise enough to reimplement:

1. **Guard.** `delta <= 0` returns immediately. A paused frame is a no-op, not a zero-force step.
2. **Bone length is recomputed every frame** from the live world matrices (`_calcWorldSpaceBoneLength`,
   `:307-318`), so a scaled rig is handled without a reinitialise.
3. **Rest axis to world.** `_boneAxis` is the normalised initial local child position, carried
   through the initial local matrix and then the parent's live world matrix. So the restoring
   direction tracks the *parent*, which is what makes a chain follow a turning head.
4. **Three additive terms**, in center space for inertia, world space for the rest:
   `inertia = (currentTail − prevTail)·(1 − dragForce)`, then `+ axis·stiffness·Δt`, then
   `+ gravityDir·gravityPower·Δt`.
5. **Hard length projection** onto the sphere of radius `boneLength` about the bone's world origin.
6. **Colliders**, sequentially, each followed by its own re-projection (§3.4).
7. **State roll**: `prevTail ← currentTail`, `currentTail ← nextTail` mapped back into center space.
8. **Rebuild the rotation** with `setFromUnitVectors( boneAxis, tailInInitialSpace )`, premultiplied
   by the initial local rotation, then update `matrix` and `matrixWorld` by hand.
   `bone.matrixAutoUpdate` was set `false` in the constructor (`:166`).

**`center`.** `_currentTail` and `_prevTail` are stored in **center space** and the inertia is
therefore evaluated there; only that term. Gravity and stiffness are applied after
`applyMatrix4(_getMatrixCenterToWorld())`, i.e. in world. The spec agrees and says so explicitly:
*"External forces (gravity) are calculated in World Space regardless of the `center`."* — VRM 1.0
spec, "Considering center space". The center node's inverse is cached through a proxy on
`userData.inverseCacheProxy` (`:107-123`) so it is not inverted per joint per frame.

**Chain order.** `VRMSpringBoneManager._sortJoints` does a real dependency sort — each joint
depends on its parent *and on every collider it references* (`VRMSpringBoneJoint.ts:82-97`), and
the manager topologically inserts (`VRMSpringBoneManager.ts:183-228`) and warns once on a cycle.
It also computes the lowest common ancestor of all dependencies and updates that subtree's world
matrices before any joint runs (`:128-130`). The spec leaves inter-chain order **undefined**:
*"The execution order between `a-b-c-d` and `x-y-z` is undefined."*

### 3.2 The defaults, and a discrepancy between the reference implementation and the spec [V]

**three-vrm constructor** (`VRMSpringBoneJoint.ts:170-176`):

```ts
hitRadius:    settings.hitRadius    ?? 0.0,
stiffness:    settings.stiffness    ?? 1.0,
gravityPower: settings.gravityPower ?? 0.0,
gravityDir:   settings.gravityDir?.clone() ?? new THREE.Vector3(0.0, -1.0, 0.0),
dragForce:    settings.dragForce    ?? 0.4,
```

**VRM 1.0 glTF schema** (`VRMC_springBone-1.0/schema/VRMC_springBone.joint.schema.json`, fetched
this session):

| field | schema `default` | schema range | three-vrm `??` |
|---|---:|---|---:|
| `hitRadius` | 0.0 | ≥ 0 | 0.0 |
| `stiffness` | **1.0** | ≥ 0 (no upper bound) | 1.0 |
| `gravityPower` | 0.0 | ≥ 0 | 0.0 |
| `gravityDir` | [0, −1, 0] | 3 numbers | [0, −1, 0] |
| `dragForce` | **0.5** | [0, 1] | **0.4** |

🚩 **`dragForce` disagrees, and three-vrm never applies the schema default.** The loader passes
`prevSchemaJoint.dragForce` straight through (`VRMSpringBoneLoaderPlugin.ts:245-248` for VRM 1.0,
`:361-364` for VRM 0.x), so an omitted field arrives as `undefined` and the constructor's `?? 0.4`
fires. **A VRM 1.0 file that omits `dragForce` behaves at 0.4 in three-vrm and at 0.5 per the
schema.** `affect-and-animation.md:886` records exactly this and is **correct**.

🚩 **`hair-motion.md` §7.1 is wrong on the adjacent point.** It states *"The VRM 1.0 specification
gives ranges but 'no default values' for these"*. The prose table in the spec README indeed lists
no defaults — but the normative JSON schema does, for all five. The correction is: the README's
table omits them, the schema carries them, and no implementation applies them.

⚠️ The spec README's JSON **example** shows `hitRadius 0.1 / stiffness 0.5 / gravityPower 1.0 /
dragForce 0.5`. Those are illustrative values in a code block, not defaults, and they differ from
the schema on three of four. Do not cite the example.

⚠️ `VRMSpringBoneLoaderPlugin.ts:364` reads `schemaBoneGroup.stiffiness` — with the typo. That is
not a bug: VRM **0.x** really spells the field `stiffiness`. The VRM 1.0 path one screen up spells
it correctly.

**The 7 cm rule is VRM 0.0's, not 1.0's** (`VRMSpringBoneJoint.ts:191-197`):

```ts
} else {
  // vrm0 requires a 7cm fixed bone length for the final node in a chain
  this._initialLocalChildPosition.copy(this.bone.position).normalize().multiplyScalar(0.07);
}
```

It fires whenever `child` is null. In the VRM 1.0 import path the last schema joint of a chain is
consumed as a **tail only** — the loader pairs `prevSchemaJoint` with the next
(`VRMSpringBoneLoaderPlugin.ts:234-263`), so `N` schema joints yield `N−1` simulated joints and
every one of them has a real child. The 7 cm fallback is for hand-built chains and VRM 0.x.

### 3.3 🚩 What `stiffness` actually means, and why it is not scale-invariant [D/M]

`affect-and-animation.md:697-699` says: *"The stiffness term is a constant-magnitude pull, not
Hookean. It adds `boneAxis * stiffness * dt` regardless of displacement. There is no `k·x`."*

The first sentence is true of the **linear** term. The second is false of the **system**, because
of the length projection that follows it. Derivation:

A tail at angle `θ` from the rest axis sits at `L·(sin θ, cos θ)`. Adding `S·Δt·û` and
renormalising to `L` gives

    θ' = atan2( L sin θ, L cos θ + S·Δt )

Differentiate at `ε = S·Δt/L → 0`:

    dθ'/dε = ( 1/(1+tan²θ) )·( −sin θ / cos²θ ) = −sin θ

so

    Δθ = −( S·Δt / L )·sin θ        i.e.        dθ/dt = −( S / L )·sin θ

🎯 **That is a pendulum restoring law, linear in `θ` for small `θ`.** The angular relaxation rate
is `S/L` per second. Measured against the algebra (`tmp/ik-survey/springbone.mjs`, one step from
rest at 60 Hz):

| L (mm) | S | θ₀ | predicted Δθ (deg) | measured Δθ (deg) | ratio |
|---:|---:|---:|---:|---:|---:|
| 70 | 1.0 | 30° | −6.820926 | −5.636650 | 0.826 |
| 70 | 1.0 | 5° | −1.188966 | −0.960932 | 0.808 |
| 250 | 1.0 | 30° | −1.909859 | −1.805015 | 0.945 |
| 250 | 0.5 | 30° | −0.954930 | −0.928055 | 0.972 |
| 500 | 1.0 | 30° | −0.954930 | −0.928055 | 0.972 |

The linearisation is good to `O(ε)` and the last two rows are **identical**, confirming that the
dimensionless group is exactly `ε = S·Δt/L`. Consequences, and they are the practical ones:

- **`stiffness` is in metres of tip pull per second.** It is a *linear* quantity.
- **Angular stiffness is `S/L`, so a longer bone is softer at the same `stiffness` value.**
  At `S = 1.0`: 14.286 rad/s at `L = 70 mm`, 6.667 at 150 mm, 4.000 at 250 mm, 2.500 at 400 mm.
  Time constants 70 / 150 / 250 / 400 ms respectively — the time constant in milliseconds is
  numerically the bone length in millimetres, at `S = 1`.
- **Therefore a per-joint stiffness copied down a chain of unequal segments does not produce a
  uniform material.** This is a mechanism-level reason for the depth-distribution curves 6.6 asks
  for, independent of the Dynamic Bone UX argument.

### 3.4 Colliders [V]

`_collision` (`VRMSpringBoneJoint.ts:284-301`):

```ts
for (const cg of colliderGroups) for (const collider of cg.colliders) {
  const dist = collider.shape.calculateCollision(collider.colliderMatrix, tail, hitRadius, _v3A);
  if (dist < 0.0) {
    tail.addScaledVector(_v3A, -dist);
    tail.sub(_worldSpacePosition);
    tail.multiplyScalar(this._worldSpaceBoneLength / tail.length()).add(_worldSpacePosition);
  }
}
```

**Sphere** (`VRMSpringBoneColliderShapeSphere.ts:34-53`): `distance = |p − c| − r_joint − r_sphere`,
direction `(p − c)/|p − c|`. With `inside: true` the sign inverts and the direction negates — a
containment volume rather than an obstacle.

**Capsule** (`VRMSpringBoneColliderShapeCapsule.ts:41-78`): point-to-segment, three branches on
`dot = (tail−head)·(tailPoint−head)` — before the head, past the tail, or on the shaft. Then the
same radius subtraction. Roughly fifteen flops plus one `sqrt`. **That is the unit a "collision
check" costs**, and it is small; §4 is about how many of them, not how expensive each is.

🚩 **Two structural properties to carry into 6.7, both visible in the loop above.**

**(a) Colliders are resolved sequentially with a length re-projection after each.** The second
collider's push can put the tail back inside the first, and nothing revisits it. There is no
iteration and no simultaneous solve. `hair-motion.md` §8.1 already records having hit this in the
DFTL path; it is the same defect and it is in the reference implementation too.

**(b) The push is followed by re-projection onto the length sphere, which slides the tail *along*
the collider rather than off it.** Push-then-project is not push-to-contact: the final point is at
`boneLength` from the parent and generally **not** at `r_joint + r_collider` from the collider, so
a small residual penetration is normal and expected. A gate that asserts zero penetration will be
red on correct behaviour.

**Extended colliders.** `VRMSpringBoneLoaderPlugin.ts:65` — `useExtendedColliders` defaults
**true**, adding `inside` spheres/capsules and a plane shape from
`VRMC_springBone_extended_collider`.

### 3.5 The timestep — punch-list 6.6 is right, and right for a narrower reason than it says [V/M]

**The claim in 6.6 is verified.** `VRMSpringBoneManager.update( delta )` (`:125-143`) calls
`springBone.update( delta )` and that is the whole timestep story: no accumulator, no substepping,
no clamp. `delta` enters only the stiffness and gravity terms; the inertia term
`(currentTail − prevTail)·(1 − dragForce)` has no `delta` in it at all.

**Measured** (`tmp/ik-survey/springbone.mjs`) — one joint, no colliders, no center, library
defaults `stiffness 1.0 / dragForce 0.4`, `L = 70 mm`, released from 28.6°, compared at shared
instants:

```
   t (s)     30 Hz (deg)   60 Hz (deg)   120 Hz (deg)   |120-30| (deg)
  0.0333      19.50110      16.23401      12.69978       6.80132
  0.0667       9.59567       4.77766       2.40663       7.18903
  0.1000       2.55527      -0.43163      -0.15541       2.71069
  0.1667      -2.23757      -0.89560      -0.08192       2.15565
  0.3333       0.13379       0.01774       0.00000       0.13378
```

Worst disagreement **7.1890°**, which at that 70 mm joint is 8.78 mm of tip travel and at a 250 mm
ponytail joint is **31.37 mm**. The mechanism, stated exactly: retained velocity decays as
`(1 − drag)ⁿ` in **frames**, so the half-life is `ln(0.5)/ln(1−drag)` frames — **rate-independent
in frames, and therefore inversely proportional to rate in seconds**:

| drag | half-life (frames) | 30 Hz | 60 Hz | 120 Hz | 144 Hz |
|---:|---:|---:|---:|---:|---:|
| 0.05 | 13.5134 | 450.45 ms | 225.22 ms | 112.61 ms | 93.84 ms |
| 0.40 | 1.3569 | 45.23 ms | 22.62 ms | 11.31 ms | 9.42 ms |
| 0.50 | 1.0000 | 33.33 ms | 16.67 ms | 8.33 ms | 6.94 ms |

🚩 **BUT: it is not a stability problem, and calling it one will send 6.6 after the wrong fix.**
Swept `stiffness` from 1 to 100,000 at 60 Hz with `drag 0.4`, `tmp/ik-survey/drag.mjs`:

```
 stiffness    S*dt/L    max |theta| over 5 s (deg)    final |theta| (deg)   NaN?
         1      0.238                   28.647890            0.00000000   false
       100     23.810                   28.647890            0.00000000   false
     10000   2380.952                   28.647890            0.00000000   false
    100000  23809.524                   28.647890            0.00000000   false
```

**`max |θ|` is exactly the release angle in every row.** The update never overshoots past the rest
axis at any stiffness or any timestep, because adding `k·û` to a vector and renormalising
approaches `û` asymptotically and cannot cross it. The length projection makes the integrator
**unconditionally bounded**. So substepping buys *rate-invariant behaviour*, and buys **nothing**
in stability — which is presumably why three-vrm has shipped without it for years without visible
explosions.

🚩 **The one genuine singularity is a joint folded exactly onto `−û`.** There `sin θ = 0` and the
restoring force is zero. Measured, `L = 70 mm`, released at `θ = π − 10⁻¹²`:

| stiffness | `S·Δt` | θ after 0.2 s |
|---:|---:|---:|
| 1 | 16.667 mm | **180.0000°** |
| 3 | 50.000 mm | 179.9857° |
| **4.2** | **70.000 mm** | **0.0180°** |
| 5 | 83.333 mm | 0.0000° |

The threshold is exactly `S·Δt = L`: below it the joint **sits at 180° forever**, above it the
added vector overshoots the origin and it snaps through in one step. A chain initialised inverted,
or driven there by a collider, sticks. Detect and nudge.

### 3.6 What a fixed 60 Hz accumulator buys, and the trap in writing its gate [M]

Same simulation, driven with whole 1/60 s substeps and a real-time accumulator
(`tmp/ik-survey/springbone.mjs` §5):

```
   t (s)     30 Hz (deg)   60 Hz (deg)   120 Hz (deg)   |120-30| (deg)
  0.0333      16.23401      16.23401      16.23401       0.00000
  0.0667       4.77766       4.77766       4.77766       0.00000
  0.1000      -0.43163      -0.43163      -0.43163       0.00000
  0.3333       0.01774       0.01774       0.01774       0.00000
```

**Exactly zero, at every sampled instant, to the last bit.** 7.1890° → 0.

🚩 **And that exactness is a property of the rates chosen, not of the fix.** 30, 60 and 120 all
divide the 60 Hz substep, so the accumulator is empty at every instant they share. A rate that does
not divide it keeps a remainder — and the remainder is decided at the `>=` by floating point.
Instrumented (`tmp/ik-survey/accumulator.mjs`), at `t = 1/12 s`, an instant 144 Hz and 60 Hz share:

```
 60 Hz at t = 1/12 s: substeps run = 5, accumulator remainder = 0.0000e+0
144 Hz at t = 1/12 s: substeps run = 4, accumulator remainder = 1.6667e-2
...
  t=0.083333  ran=0  total=4  remainder=1.666667e-2  remainder-SUB = -3.469e-18
```

**The 144 Hz accumulator is 3.469 × 10⁻¹⁸ short of the substep — one ULP — so the substep does not
fire, and the trace is a whole substep behind: 3.322° of joint angle from a 3 × 10⁻¹⁸ difference.**

For 6.6's mandatory frame-rate invariance clause, three requirements fall out:

1. **Compare at instants where both accumulators are empty**, or state a tolerance sized to one
   substep of motion. Bit-equality at arbitrary instants is not achievable and asserting it makes
   the gate flaky rather than strict.
2. **Compare `[30, 60, 120]`** — the rates `sway.selftest.mjs` already uses
   (`INVARIANCE_RATES`, `sway.selftest.mjs:453`) — because they divide 60 and the clause can then
   be exact. Adding 144 to the matrix changes what the clause can claim.
3. **Put an epsilon on the accumulator comparison**, or count substeps in integers. `acc >= dt` at
   an exact boundary is a coin toss.

The red proof is already written in this repo's idiom: `Sway` exposes `frameCoupledArrivals: true`
to reintroduce its own defect (`sway.selftest.mjs:6736-6742`) and `HairDynamics` exposes
`?hairstep=perframe` for the same purpose (`HairDynamics.js:33-35`). 6.6's equivalent is a
`perFrameStep: true` option that calls `update( dt )` once per frame with the raw delta.

### 3.7 What three-vrm costs, and what it does not [V/D]

`hair-motion.md` §7.4 measured a VRM-faithful spring chain over the 294 × 17 hair groom at
**0.144 ms median / 0.158 ms p95** on the main thread, against **0.01361 ms** for the DFTL compute
path, and concluded spring bones are the wrong tool for hair and *"remain the right answer for the
things 6.6 actually names — a ponytail, a scarf tail, breast/soft-tissue jiggle (6.8) — where the
count is tens of joints"*. Nothing found this session contradicts that and §3.3 adds a reason to
agree: at tens of joints the per-joint `updateMatrix` + `matrixWorld` multiply is the cost, and it
does not vectorise.

⚠️ `affect-and-animation.md:712-716` quotes three-vrm PR #1539 timings (658 → 145.7 µs, 1.0 ms →
415.2 µs, 3.2 ms → 200.1 µs). **Not re-verified this session [U]** — the PR was not fetched.

---

## 4. Collider budgets

### 4.1 VRChat's published table, from the primary [V]

`creators.vrchat.com/avatars/avatar-performance-ranking-system/`, fetched 2026-08-16, table
"Avatar Performance Ranks - Value Maximums per Rank", **PC** column:

| stat | Excellent | Good | Medium | Poor |
|---|---:|---:|---:|---:|
| PhysBones Components | 4 | 8 | 16 | 32 |
| **PhysBones Affected Transforms** | **16** | **64** | **128** | **256** |
| **PhysBones Colliders** | **4** | **8** | **16** | **32** |
| **PhysBones Collision Check Count** | **32** | **128** | **256** | **512** |
| Bones (whole rig) | 75 | 150 | 256 | 400 |
| Triangles | 32,000 | 70,000 | 70,000 | 70,000 |

Quest column, same stats: PhysBones Components 0/4/6/8, Affected Transforms 0/16/32/64, Colliders
0/4/8/16, Collision Check Count 0/16/32/64.

**These are maximums per rank, and "Poor" is not the bottom** — above Poor is **Very Poor**, which
the page describes as *"unbounded"*. Exceeding 512 checks does not put an avatar "past Poor" by a
factor; it puts it in the unbounded tier.

**The metric's exact definition, verbatim from the same page:**

> *"PhysBones Collision Check Count — The sum of how many PhysBone transforms each collider can
> affect. This can count transforms twice or more, because a single transform can be affected by
> multiple colliders."*

🚩 It is a count of **affectable pairs**, not of executed narrow-phase tests. It is `Σ_colliders
(transforms that collider is wired to)`, which equals `joints × colliders` only when every chain
references every collider. `affect-and-animation.md:718` states the metric as *"joints × colliders
— multiplicative"*, which is the worst case rather than the definition.

### 4.2 🚩 Where punch-list 6.7's number goes wrong [V/U]

6.7 reads: *"Collider pruning — VRoid ships 460–1362 checks/frame, past VRChat's 'Poor' tier."*

- **460 is not past Poor.** Poor's maximum is 512. 460 ranks **Poor** — the tier itself, and below
  its ceiling. Only 1,362 exceeds it, by **2.66×**, into Very Poor.
- **"checks/frame" is the wrong unit.** The VRChat statistic is a static wiring count, not a
  per-frame execution count.
- **The 460–1,362 range is [U].** Its only appearance in this repo is
  `affect-and-animation.md:718-721`, with no `.vrm` file, no measurement method and no URL. It is
  also not reproducible from the accompanying figures in that same paragraph: *"~35–90 spring-driven
  transforms … colliders 22–28"* gives 35 × 22 = 770 to 90 × 28 = 2,520, which brackets neither end.
  **No primary artefact for it could be reached this session.** Either measure it off actual `.vrm`
  files or drop the number; as written it is the exact shape LEARNINGS §1.25s warns about — a
  well-formed figure, right units, right magnitude, that re-aims a gate.

### 4.3 What practitioners are told to do, from the primary [V]

`creators.vrchat.com/avatars/avatar-dynamics/physbones/`, fetched 2026-08-16, two sentences that
between them decide 6.7's design:

> *"Setting Limits allows you to limit the amount that a PhysBone chain can move. This is useful for
> situations such as avoiding hair clipping into your head when used on an avatar, and is **far**
> more performant than a collider!"*

> *"Don't overuse Polar limits, as they have a non-zero performance cost. Using a huge amount
> (handwaving: more than 64) will probably cause some issues. If your Max Pitch and Max Yaw values
> are similar or the same, an Angle limit will suffice and costs less performance-wise."*

🎯 **A cone limit is the cheap substitute for a collider**, from the platform whose budget the
punch-list quotes. VRM has no equivalent — `VRMSpringBoneJointSettings` has five fields and none of
them is an angular limit — so this is an **extension** to the VRM algorithm, in the same category
as the fixed timestep and the depth curves 6.6 already asks for. For the cases 6.6 names (a
ponytail that must not enter the skull, a scarf that must not enter the chest) a cone about the
rest axis replaces the collider entirely and costs one dot product.

**The count itself.** The **"handwaving: more than 64"** figure is VRChat's own hedge and is the
only published order-of-magnitude in this space that came with its own uncertainty attached; take
it as such. VRChat also limits **global** avatar colliders to four, and its stated reason is
parallelism accounting rather than raw cost — **[U]**, that reasoning was surfaced through a
search summary and its primary was not read.

### 4.4 What this project's own budget says [D]

`hair-motion.md` §8.1 and `HairDynamics.js` ship **one sphere and one capsule** for the whole
groom, at 0.01361 ms. Punch-list 8.3 records **1080p full body at 12.329 ms p50 of a 16.6 ms
budget**, and the page default at **21.465 ms — 1.3× over**. The relevant fact for 6.7 is therefore
not the VRChat ceiling but the local one: on a frame that is already over budget, the correct
collider count for a ponytail is the smallest that stops the visible interpenetration, and the
first thing to try is a cone limit that needs none.

---

## 5. Contradictions with the existing punch-list text, collected

This is the section the round asked for on purpose. Each item names what the punch-list says, what
the primary artefact says, and how confident the correction is.

| # | Punch-list text | What the primary says | Status |
|---|---|---|---|
| 1 | **6.5** *"`CCDIKSolver.blendFactor` to blend against an animated pose"* | No such property. `ik.blendFactor` per chain (`CCDIKSolver.js:106`), or `update( globalBlendFactor )` (`:83`). The per-chain value wins. | **[V] wrong name** |
| 2 | **6.5** *"⚠️ `iteration` defaults to 1"* | Correct (`:122`). But the repo's stated reason — *"docs claim 5"* (`affect-and-animation.md:577,885`) — is stale: r185's JSDoc says `[iteration=1]` (`:577`) and the HTML doc page is gone (404 at r170 and r185). | **[V] correct, rationale stale** |
| 3 | **6.5** *"analytic two-bone per limb"* — no degenerate cases named | Four of them, all producing `NaN` or `Infinity` unguarded, with this rig's radii measured: reach **802.04 mm**, inner **12.62 mm**. §1.3. | **[M] gap** |
| 4 | **6.6** *"Start `stiffness 0.75 / drag 0.05 / gravity 0`"* | That is the **Bust** row of `affect-and-animation.md:738` — soft-tissue parameters, which is **6.8**'s item, not the general spring-bone default. The Hair row in the same table says `drag 0.4`, and three-vrm's own default is 0.4. | **[V] mis-scoped** |
| 5 | **6.6** *"three-vrm has none, so it's framerate-dependent by construction"* | Verified exactly (`VRMSpringBoneManager.ts:125-143`), and measured at **7.19°** worst 30-vs-120 divergence. But the defect is **behavioural, not numerical**: the update is unconditionally bounded at any stiffness (§3.5). Substepping buys invariance, not stability. | **[M] right, for a narrower reason** |
| 6 | **6.6** *"Support `center`"* | Right, and under-specified. `center` applies to the **inertia term only**; gravity and stiffness stay in world space, per both the spec and the implementation (§3.1). Implementing it as a wholesale space change is wrong. | **[V] under-specified** |
| 7 | **6.7** *"VRoid ships 460–1362 checks/frame, past VRChat's 'Poor' tier"* | Poor's maximum is **512**, so 460 is *inside* Poor. Only 1,362 exceeds it (2.66×), into the unbounded Very Poor tier. The metric is a static wiring count, not per-frame checks. The 460–1,362 range has no reachable primary and does not reproduce from the figures quoted beside it. | **[V] arithmetic wrong; [U] source** |
| 8 | **6.8** *"Hair drag 0.4 (over-damped drape) vs tissue 0.05 (fast ring)"* | The contrast is right and the table it comes from is **[U]** — `affect-and-animation.md:736-742` cites no `.vrm` file. And `drag 0.05` is the value that makes the frame-rate defect **2.8× worse** (19.90° vs 7.19°) with a **338 ms** wall-clock ring-down spread across 30–120 Hz against 34 ms. §3.6. | **[U] source; [M] new consequence** |
| 9 | **6.2(a) / 6.5** *"`kneeActivation` … doing it right is 6.5's analytic two-bone solve plus a pelvis offset plus a foot re-plant"* | The **mechanism** is right and complete (§2.3). The **amplitude has no source**: Coulson Table 1 has no knee column (`PostureLayer.js:113-121` — six columns, none of them a knee), and `body-motion-numbers.md` contains the string "knee" zero times. The derivation rule the affect half is gated on does not extend to this channel. | **[V] research gap, not an implementation gap** |
| 10 | `hair-motion.md` **§7.1** *"The VRM 1.0 specification gives ranges but 'no default values' for these"* | The prose table has none; the normative **JSON schema has all five**, and `dragForce`'s is **0.5** against three-vrm's 0.4. No implementation applies the schema default. | **[V] wrong** |
| 11 | `affect-and-animation.md` **§7** *"There is no `k·x`"* | There is, in the angular coordinate: the length projection turns the constant linear pull into `dθ/dt = −(S/L)·sin θ`, verified numerically to `O(S·Δt/L)`. Consequence: **stiffness is not scale-invariant** — angular stiffness is `S/L`. §3.3. | **[D/M] wrong** |
| 12 | `Sway.js:517-520` *"no choice of pivot height removes it — only foot IK would"* (0.29 mm) | True, and **0.29 mm is 0.19 px** at the repo's own 0.6574 px/mm — eight times below its own 1.6 px floor. `Sway`'s residual does not justify foot IK; §2.2's knee bend does. | **[D] scoping correction, not an error** |

---

## 6. Recommendations, and the two things that are still missing

### 6.1 Two gaps that are research, not implementation [✗]

**(a) The knee amplitude.** §2.5. `kneeActivation 1.77` is a loading with no full scale. Coulson has
no knee column. Before 6.5 actuates it somebody must find a source or state the derivation as a
modelling decision the way `PostureLayer` states its own — the punch-list's own 6.2(c) precedent
for `bored` is the right shape: name the second literature, name the bridge, and say that bridging
is a decision rather than a transcription.

**(b) VRoid's real collider counts.** §4.2. Either measure them off `.vrm` files or drop the range.

### 6.2 Starting parameters, with their provenance marked

For the things 6.6 actually names — a ponytail, a scarf, soft tissue:

| parameter | value | provenance |
|---|---:|---|
| substep | 1/60 s, accumulator, cap 2–4 | 6.6's own decision; `HairDynamics.js` already does exactly this at 1/120 with `MAX_SUBSTEPS_PER_FRAME = 4` |
| `stiffness` | 1.0 | **[V]** three-vrm constructor default and VRM 1.0 schema default agree |
| `dragForce` | 0.4 | **[V]** three-vrm constructor. ⚠️ VRM 1.0 schema says 0.5 and nothing applies it |
| `gravityPower` | 0.0 | **[V]** both agree |
| `gravityDir` | (0, −1, 0) | **[V]** both agree |
| `hitRadius` | 0.0 | **[V]** both agree |
| soft tissue `stiffness 0.75 / drag 0.05` | — | **[U]** `affect-and-animation.md:738`, no primary. Keep the marker until a `.vrm` is measured |

🎯 **State stiffness per joint as an angular rate, not as VRM's linear value.** `S = k·L` where `k`
is the wanted rad/s and `L` the joint's own length (§3.3). Then one authored number produces the
same material along a chain of unequal segments, which is what 6.6's depth-distribution curves are
for and which VRM's own parameterisation actively fights.

### 6.3 Build order

1. **Two-bone solve, `ozz` shape.** Inputs: three model-space matrices, a target, `mid_axis`,
   `pole_vector`, `soften`, `weight`. Outputs: two correction quaternions. No skeleton writes. That
   drops straight into `Layer.contribution.boneRotations` with no wrapper (§1.6). Gate the four
   degenerate branches of §1.3 individually — each one is a red proof that costs three lines.
2. **Pelvis drop, in `Sway`'s order and not beside it.** §2.3(a)/(b): lowest foot decides the drop,
   drop happens before the solve. `Sway` already writes the pelvis offset; a second writer needs a
   conversation, not a new channel.
3. **Spring bones with the fixed accumulator and the epsilon on its comparison** (§3.6), and the
   invariance clause at `[30, 60, 120]` with a `perFrameStep: true` red proof.
4. **Cone limits before colliders** (§4.3).

### 6.4 What was looked for and is not there [✗]

- No standalone HTML documentation page for `CCDIKSolver` in three.js at r170 or r185 (404 both).
- No angular limit of any kind in `VRMSpringBoneJointSettings` — five fields, none of them a limit.
- No knee degree of freedom in Coulson (2004) Table 1 as transcribed in this repo.
- No published number for a two-bone `soften` ratio.
- No young-adult knee-flexion-by-emotion figure anywhere in `docs/research/`.

---

## Sources

| artefact | where | used in |
|---|---|---|
| `CCDIKSolver.js` | `node_modules/three/examples/jsm/animation/` @ `three@0.185.1` | §0.1–0.3, §1.5 |
| `CCDIKSolver.js` @ `dev` | `raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/animation/` | §0.3 |
| `ik_two_bone_job.cc`, `.h` | `raw.githubusercontent.com/guillaumeblanc/ozz-animation/master/` | §1.2–1.4 |
| ozz `foot_ik` sample page | `guillaumeblanc.github.io/ozz-animation/samples/foot_ik/` | §2.3 |
| `VRMSpringBoneJoint.ts` | `raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm-springbone/src/` | §3.1–3.5 |
| `VRMSpringBoneManager.ts` | same | §3.1, §3.5 |
| `VRMSpringBoneLoaderPlugin.ts` | same | §3.2 |
| `VRMSpringBoneColliderShapeSphere.ts`, `…Capsule.ts` | same | §3.4 |
| `VRMC_springBone-1.0/README.md` | `raw.githubusercontent.com/vrm-c/vrm-specification/master/specification/` | §3.1–3.2 |
| `VRMC_springBone.joint.schema.json` | same, `…/schema/` | §3.2 |
| VRChat Avatar Performance Ranking System | `creators.vrchat.com/avatars/avatar-performance-ranking-system/` | §4.1–4.2 |
| VRChat PhysBones | `creators.vrchat.com/avatars/avatar-dynamics/physbones/` | §4.3 |
| `assets/figures/figure_g050.glb` | this repo | §2.1–2.2 |
| `MotionStack.js`, `Sway.js`, `PostureLayer.js`, `ExpressionMap.js`, `HairDynamics.js`, `sway.selftest.mjs` | this repo | throughout |
| `docs/LEARNINGS.md` §1.10a, §1.13, §1.25s | this repo | §0.4, §2.2, §3.6 |
