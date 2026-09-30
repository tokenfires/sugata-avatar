# Native WebGPU probe for full-influence storage

Proceed only after the preceding nine-case CPU result is independently reviewed. This is an isolated compute and static geometry-render candidate. Accepted assets, ordinary avatar materials, motion/history, body controls and production rendering remain unchanged.

## Fixed inputs and comparisons

Use the same nine shaped-position/rest/pose inputs and complete eight-slot float32 weights from the frozen CPU packet. Upload positions and matrices as float32. Expand the stored uint8 joint indices to uint32 for WGSL storage access; this does not establish the same bandwidth as an eventual vertex-attribute implementation. Use explicit vec4 position/output buffers to avoid vec3 storage stride ambiguity. The compute shader must multiply and add all eight weighted transforms itself; do not upload the CPU skinned output as its answer.

Collect every actual GPU output position for all 14,517 vertices in all nine cases. Compare to both the eight-slot CPU result and actual native full skin under the unchanged strict below0.342mm maximum-distance bar. Keep identity and neutral controls. After the nine cases, run the restored accepted-four and stale-neutral-bind controls through the same GPU kernel; each must fail against a passing clean parent. Preserve inputs, actual readbacks and every residual, without tuning precision, thresholds, poses or weights after execution.

The candidate shader is a reusable isolated probe, not a production eight-weight implementation. It uses a WebGPURenderer on the actual hardware backend, records adapter identity, and refuses a fallback renderer. Root serializes this browser job, uses a temporary service, and closes both after collection. Record errors, source bindings and cleanup.

## Actual candidate images

For neutral and full-target coupled cases, capture full-body and fixed waist-detail pairs: actual full-native positions versus the actual computed eight-weight GPU buffer (eight images total). Use accepted body topology, identical cameras/lights and a plain material. The candidate material's position node reads the compute output directly. For both arms, compute geometric vertex normals from their respective observed surface positions; this is a deliberately shared static inspection method, **not** qualification of skinned normals/tangents, animation or the avatar's skin material. Use the same full-native witness target for each pair. No displacement amplification or visual acceptance from numerical thresholds.

Root and the independent critic inspect actual originals. Any visible mismatch requires a concrete example and two alternatives before changing the method. If values pass but images reveal a problem, preserve both results. A passing result establishes this finite GPU position path and inspected static geometry only; broader identities, dynamic rebinding, normal/tangent and velocity integration, performance and complete avatar appearance remain open.
