"""Preserve original coordinates on transported retained points; no shape authoring."""
from array import array
import hashlib
import math
import bpy

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def semantics(key):
    meta = {"value": key.value, "relative": key.relative_key.name,
            "slider_min": key.slider_min, "slider_max": key.slider_max,
            "mute": key.mute, "interpolation": key.interpolation,
            "vertex_group": key.vertex_group}
    require(all(math.isfinite(meta[name]) for name in ("value", "slider_min", "slider_max")),
            "Nonfinite source/output shape semantics")
    return meta

def snapshot(key_data):
    require(key_data.use_relative and key_data.animation_data is None,
            "Animated/driven/absolute body keys are outside this reconstruction")
    return {key.name: semantics(key) for key in key_data.key_blocks}

def restore(body, originals, metadata, point_ids):
    """Write all source coordinates/semantics into the isolated cropped owner."""
    blocks = body.data.shape_keys.key_blocks
    require(list(originals) == [key.name for key in blocks], "Reconstruction key set/order changed")
    require(len(point_ids) == len(set(point_ids)), "Reconstruction point provenance ambiguous")
    records = []
    basis = blocks["Basis"]
    for key in blocks:
        original = originals[key.name]["coords"]
        require(all(0 <= i < len(original) // 3 for i in point_ids), "Reconstruction source point out of range")
        expected = array("f", (original[3 * i + axis] for i in point_ids for axis in range(3)))
        current = array("f", [0]) * len(expected)
        key.data.foreach_get("co", current)
        require(all(math.isfinite(v) for v in expected) and all(math.isfinite(v) for v in current),
                "Nonfinite reconstruction coordinates")
        errors = [math.dist(current[i:i + 3], expected[i:i + 3]) for i in range(0, len(expected), 3)]
        require(all(math.isfinite(e) for e in errors), "Nonfinite reconstruction error")
        key.data.foreach_set("co", expected)
        meta = metadata[key.name]
        require(meta["relative"] == "Basis", "Unsupported relative shape graph")
        # Expand first so valid source ranges cannot be clamped by current defaults.
        key.slider_min = min(key.slider_min, meta["slider_min"])
        key.slider_max = max(key.slider_max, meta["slider_max"])
        key.slider_min, key.slider_max = meta["slider_min"], meta["slider_max"]
        key.relative_key = basis
        key.mute, key.interpolation, key.vertex_group = meta["mute"], meta["interpolation"], meta["vertex_group"]
        key.value = meta["value"]
        actual = array("f", [0]) * len(expected)
        key.data.foreach_get("co", actual)
        require(actual.tobytes() == expected.tobytes(), "Source coordinate write not exact")
        require(semantics(key) == meta, "Source semantics not preserved")
        records.append({"name": key.name, "intermediate_sha256": hashlib.sha256(current.tobytes()).hexdigest(),
                        "source_subset_sha256": hashlib.sha256(expected.tobytes()).hexdigest(),
                        "restored_sha256": hashlib.sha256(actual.tobytes()).hexdigest(),
                        "intermediate_max_error_m": max(errors),
                        "intermediate_vertices_over_epsilon": sum(e > 1e-6 for e in errors),
                        "source_semantics": meta, "restored_semantics": semantics(key)})
    body.data.update()
    bpy.context.view_layer.update()
    return records

def remove_new_unused_meshes(original_mesh_pointers):
    """Only vendor-created zero-user meshes in this isolated process are removed."""
    removed = []
    for mesh in list(bpy.data.meshes):
        if mesh.as_pointer() not in original_mesh_pointers and mesh.users == 0:
            removed.append({"name": mesh.name, "vertices": len(mesh.vertices), "users": mesh.users})
            bpy.data.meshes.remove(mesh)
    return removed
