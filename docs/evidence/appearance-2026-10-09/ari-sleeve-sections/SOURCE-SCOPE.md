# Pre-execution source scope clarification

The POLICY phrase `positiveprojectedarea` means positive area magnitude: the frozen contour predicate requires `abs(signed_area)>1e-12`, records signed winding and leaves canonical cycle order unchanged. Positive signed winding is not claimed. Choosing an oriented garment winding remains a later original-template responsibility.

The new query qualifies only the sixteen declared meridian-ray associations. It does not prove global all-angle star-shapedness. Source contour simplicity and finite sampled hits are separately recorded; no extra angles, source/plane/radius changes or ray search follow.

Only run_query.py through the root admission is admitted. Its full physical-pin guard runs before Popen, including the frozen helper source. The child executes only the six pinned AST definitions before its own repeat guard; direct unwrapped worker execution is not admitted. No early-failure universal complete receipt is promised.

This clarifies existing predicate/ordering/phase scope before any query, with no solver, threshold, station, contour order, source reference or sampling change. Alternative: reverse/orient source cycles to positive signed area, which adds an ordering duty and is not selected. The fixed16 sampled association remains useful for original source registration; actual garment shape/contact/coverage and unsampled geometry still need independent authoring/verification.
