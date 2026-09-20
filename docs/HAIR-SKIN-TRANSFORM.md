# Hair skin transform contract

`createHairSkinTransform(mesh, headBone, headInverseBind)` returns a synchronous updater whose stable scratch matrices describe the exact single-head-bone Three skinning map:

```
H = mesh.matrixWorld * mesh.bindMatrixInverse * headBone.matrixWorld
    * headInverseBind * mesh.bindMatrix
```

Call it after updating the world matrices. Pass its `meshMatrixWorld`, `headBoneMatrixWorld`, and `headBoneInverse` values to `HairDynamics.setHeadMatrix` in that order. The latter two values fold in the inverse bind and bind matrices. The first remains the real mesh world matrix: the solver also inverts it to rebuild object-space ribbon vertices. Borrowed scratch values are overwritten on the next update.

Use `update({ requireRigid: true })` for the body-contact path. It validates the current **full H** each frame, including animated head transforms. Finite affine transforms with proper orthonormal linear columns are supported; scale, shear, reflection, and nonfinite values are rejected. The Gram-matrix tolerance is `1e-5` to admit Float32-authored inverse-bind rounding. Nonidentity bind matrices are permitted when the resulting full H is valid. Identity binds retain the original operands exactly, including the solver's multiplication grouping.

`setHeadMatrix` uses H for rest centres, width directions, the skull centre, interpolated head motion and gravity. Its initial gravity frame uses inverse(H rotation); later frames apply the current H rotation. Thus the unit-rigid requirement covers both the fixed world-space contact radius and the solver's gravity/frame assumptions.

The previous three-argument caller omitted both bind matrices. Three r185 attached binding updates `bindMatrixInverse` from the inverse mesh world matrix. On a real one-bone `SkinnedMesh`, applying a common parent translation `(0.1, 0.2, 0.3)` produced a **0.3741657387 m** old-path vertex error, and a common Y rotation of `0.4` radians produced **0.0803567724 m** error. Folding the bind matrices matches Three's native world vertex to within `1e-12 m` in both cases. The selftest also verifies valid nonidentity bindings, unchanged identity operands, per-frame parent/head scale refusal, shear, reflection, nonfinite and projective refusal.

```sh
node packages/core/src/motion/HairSkinTransform.selftest.mjs
```

Five CPU groups test the map and its gate. They do not establish contact convergence, appearance, or support for multiply weighted hair. Avatar/body-contact integration has separate tests and ownership.
