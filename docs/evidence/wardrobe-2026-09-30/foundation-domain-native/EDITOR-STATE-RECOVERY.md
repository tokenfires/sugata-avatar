# Native V1 editor-state admission

V1 PID34274 / exec71566 ran22:01:35.550429–22:01:45.598175UTC and stopped before domain emission. The newly declared unsupported-attribute guard found three previously unlisted Blender fields: `.uv_select_vert` BOOLEAN/CORNER, `.uv_select_edge` BOOLEAN/CORNER and `.uv_select_face` BOOLEAN/FACE. Full schema, native surface/groups and earlier cut receipts are preserved. No domain-cut candidate exists from V1.

Root selects alternative A: admit only these exact names/types/domains, archive their actual boolean arrays before reconstruction, and record the resulting editor selection state after rebuilding. UV editor selections may reset on the new isolated mesh. Rendering data—positions, full groups, UV coordinates, masks, materials and smooth flags—retains its original preservation checks. Every other unsupported attribute still stops the build.

Alternative B propagates selection booleans through corner/face lineage, choosing explicit ownership for newly created cut edges and corners. That would preserve more editable scene state but adds a selection policy unrelated to the intended render/fit change. No such propagation is chosen.

The mounted Blender glTF exporter's `primitive_extract.py` lines177–219 defaults generic attribute retention to names starting with `_` or `KHR_`; these dot-prefixed selection fields are excluded by that default. The hook can be overridden by export extensions, so actual emitted glTF attributes must still be inspected. The subsequent shell offset/clamp/relax/roll functions do not read UV editor selection. Original function source and exporter source are retained. This is a source-data contract clarification, not proof of a completed export or permission to drop arbitrary custom data.

V2 changes the output root and this explicit editor-state recording/admission. It does not change domain geometry, heights, source weights, UV interpolation, masks, offset, relaxation, final qualification gates or the frozen visual baseline. V1 remains failed and preserved.
