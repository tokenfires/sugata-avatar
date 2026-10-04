# Source review: B, unrun

Recording-only closeout after the 17:34 UTC source cutoff; this note supplies no late execution admission. I read the complete reader, authored convention, plan and authority/preflight metadata. I did not decode either GLB, execute/import the reader, evaluate mapping, or start native work.

`read_inputs.py:38–102` accumulates the current asset locally and returns only after every predicate. At line 116, `output.assets` receives it only after return. Thus a refusal at the body-owner gate (88) or literal-joint gate (99) leaves `PARTIAL-DATA.json` (124) with previously completed assets only. The refusal message records neither the body-owner candidates nor the actual joint matches from the failing asset. That falls short of recoverable current-asset operands for this single-read responsibility. A: publish an evolving per-asset record and gate operands before predicates in a separately admitted source contract; this adds recording work without changing source geometry. B: retain the immutable sources and symbolic convention, leave the reader unrun and stop this slice; this preserves evidence but produces no numeric worksheet. Select B here; no correction or replay is admitted.

Separately, line 135 writes `READ-JOB.json` without a catch before stdout at 136. A job-write exception can prevent the recovery receipt from reaching stdout and obscure the earlier refusal. A: independently attempt job persistence and stdout recovery, retaining each write error; more bookkeeping gives a usable failure receipt. B: keep this source unrun rather than assume that final write succeeds. Select B.

The convention correctly declares an artist uniform scale/translation and held-out residual limits; the reader does not apply those formulas or skinning. Scene-global origins, undeformed POSITION arrays and retained IBM values would remain source operands, not Avatar rest-pose, coverage, contact or fit evidence. The partial primary response expressly lacks the requested skin relation; no skin equation is inferred. Upper-bra scope does not close briefs or all-layer coverage. The T-rest/arms-down image mismatch remains unchanged.

Exact bindings (local byte/hash readback only):

- `PLAN.md`: 2658 bytes, SHA256 `37477d960ac97dd7826dba8572db4c27cda73f58d197ca3e0c332e79580429ce`.
- `INPUTS.json`: 1813 bytes, SHA256 `1b4424f9d78f4c8bb17840d336a280ec8428522a55d93a1338427055605b9db9`.
- `WORTH.md`: 5103 bytes, SHA256 `158a4e59e58e732de706962523a78dbb357e178d606a0e559a16f8bf1326fad2`.
- `read_inputs.py`: 8347 bytes, SHA256 `eb2df5ba1700b672495dded2440d664143ffb0ef3ce57b0b209c79c7173691d3`.
- `ARTIST-CONVENTION.json`: 4487 bytes, SHA256 `c12f998040fa9aa33bf6788e3748b2615cde70a742af0453071b08cb25efafca`.
- `AUTHORITY-PINS.json`: 1305 bytes, SHA256 `4630583b7e2a0d3e11cc584b001ae6d17c00055b4cb987d2b8bdf60a6cbcc68c`.
- `SPEC-READ.json`: 5986 bytes, SHA256 `dd93394c98d629f6969c887264cf07380d6d2a96f7e014bf76be4e8fb9618193`.
- `ROOT-SOURCE-PREFLIGHT.json`: 1609 bytes, SHA256 `ebc172f02c2808ccdc816554172bb7a3841df10ded761f4e8733b585197b4ab9`.
