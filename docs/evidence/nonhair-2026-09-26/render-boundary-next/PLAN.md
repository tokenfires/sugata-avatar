# Render-boundary readback proposal

This is a new diagnostic of the recorded unchanged-product image disagreement. It does not
resume the stopped startup-hold trial, tune a tolerance, change an asset or qualify a feature.
The original two fresh casual/Ecru/Kitchen front controls remain the configuration: normal
Showcase initialization, balanced WebGPU, seed 20260807, 1100×1000 DPR1, 64 original zero-time
steps and the original Save image draw at the declared node epoch. No startup hold or extra
settling is applied. The complete existing native state/history and original PNG receipts remain.

After the original Save image has completed, read already-written render targets without
another scene draw, node update, output-graph replacement or material assignment. Bind source
and exact texture identities/formats/dimensions before reading. Observe the following actual
boundaries, if present under the fixed configuration; a missing required boundary is a failure:

1. Scene G-buffer output, diffuseColor, normal and velocity.
2. TAAU resolve and post-copy history-colour textures (the latter contains the same-frame
   resolve, not the prior history input). The fixed balanced path has no temporal sharpen.
3. Bloom's final mip composite in horizontal target 0 and first vertical blur. Its input
   is exactly the already observed TAAU resolve texture; this alias is asserted and recorded,
   not presented as an independent composition target.
4. Grade's encoded pre-RCAS RTT target and encoded post-RCAS sharpen output. The actual
   balanced grade uses sharpness 1.2. These existing targets precede final grain/clamp/output;
   their selection does not insert a new graph node or change the image.
5. The original final exported PNG. No new screenshot/draw substitutes for this output.

Use the installed renderer's readRenderTargetPixelsAsync, serially. Its WebGPU implementation
copies exact GPU texels into a mapped buffer and retains 256-byte row padding except after the
last row. Retain every returned byte and format/stride metadata; compare the packed logical
texel bytes separately, excluding only those explicitly identified padding bytes. Preserve
Float16 bits, signed zero, NaNs and infinities instead of converting or normalizing them.
Only the known uncompressed colour formats are admitted; depth/MSAA/cubemap/mipmap data is
outside this first instrument. Verify native render/motion counters and target descriptors are
unchanged before/after the entire readback; any failure is retained and cannot be called neutral.
Readback adds GPU copies and waits, so it is not a performance benchmark or proof of equivalence
to an uninstrumented owner lifetime. It occurs after the qualified image draw to minimize that
intervention. Each owner is then retired through its original page handler.

The instrument first needs hand-solvable padding/type/format fixtures, independent source
review, source freeze and root's serialized browser slot. Collect both controls even when their
images differ, retaining the failed image gate separately from the diagnostic's collection
status. Do not rerun to obtain equality. Report the earliest differing observed boundary and
all equal observed boundaries; that localizes disagreement, not a mechanism or root cause.
Equal sampled textures also cannot rule out unobserved earlier differences that the pipeline
removed. If this pair happens to match, record that limited result and stop; do not search for
an intermittent disagreement. No model, dependency, default, texture or hair change is involved.

Prefreeze scope correction: sssMask is omitted from this first readback. The installed helper
allocates its exact short final row, while the fixed scene pass has floor(657×0.66)=433
pixels across. An R8 read therefore has a byte size not divisible by four, and that mapped
range has not been admitted by this instrument. This is a source-level API concern, not
an executed GPU failure or an inferred cause of the PNG mismatch. No custom copier or
resized render is introduced. The other four scene attachments have four/eight bytes per
texel. The generic byte-packing unit fixtures still cover R8 layout arithmetic, separately
from native GPU readback legality.

Native-v1 was rejected before any target copy because the target inventory incorrectly
required GTAO on the balanced tier. Avatar.QUALITY_TIERS.balanced.occlusion is false, and
Avatar.build creates that owner only for an occlusion-enabled tier. The corrected instrument
requires actual tier balanced, its occlusion setting false, and stage.ambientOcclusion null.
It does not change the tier or conditionally skip a missing expected target. All other
readbacks, original image/state/history gates and the two-control protocol remain. The
12-file lossless rejected packet is retained under rejected-native-v1, receipt
cf697d4952250af944f7e85f0dec1bae774ef91c1503326faacbee50101f8190.

Native-v2 was rejected before any target copy because the inventory still assumed a
separate pre-bloom RTT. The actual balanced graph aliases bloom.inputNode directly to
temporal.node and its resolve texture. This second assumption error is preserved in the
12-file rejected-native-v2 packet, receipt
ddb71037da37603250ea5c7db864963c6142e341fa78666848d08b1ff7ab5f7d.
Before another launch, both root and critic constructed the actual exported balanced
QUALITY_TIERS, GBuffer, createTemporalResolve and Grade.compose in Node. The revised
fixture uses that complete real node graph and checks every selected target and alias;
only native GPU storage and readback are mocked. The selected ten targets include the
actual two Grade RCAS boundaries rather than a hypothetical pre-bloom render target.
The observer requires this exact fixed graph and rejects an extra composeOutput, temporal
sharpen, foreign bloom input or changed grade sharpness. Neither rejected run provides a
render-boundary comparison, and their original PNGs remain unqualified single controls.
