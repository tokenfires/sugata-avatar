# Complete-influence CPU source and suitability review

**B — close this exact packet unrun. Do not create execution/admission/claim artifacts or spend the sole consumer attempt.** I read all three inert sources. Their selected-input incompatibility and retained allocation lower bound are independently established from frozen metadata, without importing them or decoding the GLB payload.

**S1: the reader cannot accept the fixed source.** full-influence.mjs:46 requires both no sparse accessor and an explicit bufferView. Line60 validates every accessor before returning the source; packet.mjs:114 calls it before parseAsync at:120. The manifest-bound saved GLB-DOCUMENT contains293 accessors,202 sparse, all202 without a base bufferView. Accessor17 alone is FLOAT/VEC3,count53512 with one sparse replacement and no base. If earlier guards pass, it necessarily refuses ACCESSOR_LAYOUT; an earlier refusal cannot produce successful full-source consumption either. This is a supported-format mismatch, not evidence that the GLB is corrupt, its skin visibly fails, or Three violates glTF.

Preferred alternative: close this packed-only packet now, preserving the correct refusal rule and the complete-influence duty. Alternative: a genuinely separate future sparse-accessor ownership contract could address the actual format, but would require new worth, layout/zero-base/index and memory evidence; no decoder repair, omission of morphs or successor is admitted here.

**S2: required retained owned buffers exceed the unchanged cap.** The six saved primitive POSITION counts sum to73,848 vertices; paired influence attributes give509,440 slots. OwnedBudget:8–21 retains every backing in a Set and never releases its cumulative reservation. Table allocation at full-influence.mjs:121 costs14bytes per slot. packet.mjs:113/:117 require two distinct input copies; :140–155 plus positions():167 retain actual/reference Float64 xyz arrays for both states. The lower bound is:

- Input copies:53,702,760 bytes.
- U16/F32/F64 influence tables:7,132,160 bytes.
- Two-state actual/reference positions:7,089,408 bytes.

Total67,924,328 exceeds67,108,864 by815,464bytes before metadata, UTF8 output, probes, streaming scratch or other allocations. This is conditional static accounting if S1 were separately addressed, not observed RAM or a target run.

Preferred alternative: withhold this packet while preserving64MiB. Alternative: a future independently reviewed lifetime/streaming/alias contract might fit unchanged bounds, but cannot silently decrement the counter, discard required evidence or raise the limit. It is not a current repair nomination.

The three sources total32,705bytes; that cap passes but cannot overcome S1/S2. The exact512 flag concerns V8 old space, not a hard whole-heap or RSS ceiling. No memory measurement, actual position/guard/refusal packet or semantic/GPU pass exists.

All32 preparation rows plus the preparation itself match; original source/GLB hashes and0444 mode remain exact. Saved FIXED joints/meshes/witness match the old actual record. Six execution artifacts are absent. Only this pair is written; no target/helper/Three import, current GLB header/JSON/BIN/accessor decode, browser/GPU/network or source edit. Earlier worth/contract A remains historical authorship permission only. All22scoped/10broad goals and closures remain. Pending edits: false.
