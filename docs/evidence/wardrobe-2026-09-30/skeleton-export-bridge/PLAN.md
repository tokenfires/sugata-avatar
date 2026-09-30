# Native skeleton to the actual exported figure

The endpoint and rest-orientation packets qualify finite arithmetic in Blender coordinates. Before attempting runtime updates, establish the exact exported baseline we would update. This slice reads the accepted `figure_g050.glb`, existing vertex-map data and the frozen native neutral case. It does not rewrite them or create a candidate figure.

Predeclare the conversion from Blender coordinates to glTF: `(x,y,z) → (x,z,-y)`. Native absolute bone matrices are left-multiplied by that basis conversion; child-local bone coordinates retain their own basis. This is supported by the actual exported Root node's −90-degree X rotation and the unchanged local pelvis translation. Do not fit an extra translation, scale or bone-specific correction after seeing residuals.

Parse the real GLB's scene hierarchy, all node TRS/matrices, the skin's named 53-joint order and inverse-bind matrices, and the body's POSITION/JOINTS_0/WEIGHTS_0 accessors. Require its observed single primitive and four influences; refuse unsupported sparse accessors or extra joint streams. Preserve the parsed records. Require identity mesh and armature-container transforms and zero default body morph weights. Compose the exported raw quaternion values exactly as the local loader does; do not normalize them. Reproduce weight normalization by reciprocal L1 multiplication followed by float32 storage. Use the existing 14,517-entry vertex map to compare exported body positions to the corresponding native body positions after the same conversion. Require zero grounding offset from the pinned map.

Comparison gates, fixed before execution:

1. All 53 actual exported joint-world matrices versus converted native matrices: origin, tail and three one-metre basis witnesses must remain strictly below **0.1 mm** maximum distance. Record component and axis residuals separately.
2. All 14,517 mapped exported body positions versus converted native: strict **below 0.001 mm** maximum distance.
3. Apply the actual exported inverse binds and four weights to the exported body at rest using the actual exported joint matrices. Record both raw weights and L1-normalized weights (matching the loader's normalization convention after confirming local source). Require strict **below 0.342 mm** maximum displacement from the original body in each case. This is an exported rest-pose arithmetic control, not the posed skin/runtime gate.
4. Substitute the converted native matrices with the same exported inverse binds and repeat the rest-position control. Also substitute the independent endpoint/orientation prediction so the whole arithmetic chain is compared to actual exported binds.

Negative controls: use the wrong global axis mapping, and shift all joint-world translations by 5 mm while leaving the actual inverse binds and body unchanged. Require nonzero mutations and failing results against passing clean parents. Preserve the full changed matrices and per-vertex/witness results.

Independent critique must use actual GLB/native data. No new native/GPU job is required. A pass establishes this one accepted neutral asset's coordinate and bind relationship. It does not qualify body variation, posed skin, animation-layer rebinding, face parts, garment/foundation binding, rendering, or the full PUNCHLIST 10.7 gate. Source/asset hashes, exact command and recovery state will be retained; all prior frozen packets remain intact.
