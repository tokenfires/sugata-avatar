# Root clarification before implementation

The original PLAN.json is retained unchanged. Its synthetic_programme item asking for a consistent polygon whose full region-label union strictly exceeds a nondegenerate fan triangle subset is removed from the proposed acceptance programme. No source or trial has been authored or run.

Witness: PLAN.json, synthetic_programme item beginning “Mixed support and a facet”. In this exact local model, each original barycentric coordinate is affine on the facet plane and nonnegative over the convex polygon. If a source coordinate is zero at all three noncollinear vertices of a positive-area fan triangle, it is identically zero on that plane. Thus a label absent from that complete triangle union cannot occur elsewhere through the same consistent source coordinate. This does not permit dropping the contract’s explicit full-polygon transport: every fan must still copy the computed whole-facet set.

A, selected clarification: use realizable mixed-support geometry, independently recompute every whole-facet union, and assert each fan explicitly copies that union. This tests the actual local API while avoiding an impossible geometric witness. B: add a separate arbitrary combinatorial-label transport helper and fixture. That can demonstrate conservative copying on inconsistent input labels, but expands the API and does not qualify a realizable local cell. It is deferred.

All original resource bounds, fixed deadlines, source-review gate, single alarm-bounded invocation and failure/no-retry policy remain. Fresh independent worth must read this clarification before permitting source authoring. No whole-grid, real source, collector or constructor admission.
