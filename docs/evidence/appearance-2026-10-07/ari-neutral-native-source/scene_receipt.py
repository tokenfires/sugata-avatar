"""Capture complete saved native owner state without destructive evaluation/baking."""
from array import array
import hashlib
import json
import bpy

def buffer_hash(collection, attribute, width, typecode="f"):
    values = array(typecode, [0]) * (len(collection) * width)
    collection.foreach_get(attribute, values)
    return hashlib.sha256(values.tobytes()).hexdigest()

def matrix(value):
    return [list(row) for row in value]

def value(item):
    if item is None or isinstance(item, (str, bool, int, float)):
        return item
    if isinstance(item, bpy.types.ID):
        return {"id_name": item.name, "id_type": type(item).__name__}
    return [value(part) for part in item]

def capture_scene():
    bpy.context.view_layer.update()
    objects = []
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        item = {"name": obj.name, "type": obj.type, "parent": obj.parent.name if obj.parent else None,
                "matrix_world": matrix(obj.matrix_world), "matrix_parent_inverse": matrix(obj.matrix_parent_inverse),
                "source_role": obj.get("sugata_source_role"), "source_file": obj.get("sugata_source_file"),
                "modifiers": [{"name": m.name, "type": m.type, "show_viewport": m.show_viewport,
                               "show_render": m.show_render, "object": getattr(m, "object", None).name
                               if getattr(m, "object", None) else None} for m in obj.modifiers],
                "materials": [s.material.name if s.material else None for s in obj.material_slots]}
        for modifier, info in zip(obj.modifiers, item["modifiers"]):
            info["settings"] = {key: value(getattr(modifier, key)) for key in
                                ["vertex_group", "invert_vertex_group", "levels", "render_levels", "use_vertex_groups",
                                 "use_bone_envelopes", "use_deform_preserve_volume", "use_multi_modifier"] if hasattr(modifier, key)}
        if obj.type == "MESH":
            mesh = obj.data
            influences = [(v.index, [(g.group, g.weight) for g in v.groups]) for v in mesh.vertices]
            item["mesh"] = {"vertices": len(mesh.vertices), "edges": len(mesh.edges), "polygons": len(mesh.polygons),
                            "coordinates_sha256": buffer_hash(mesh.vertices, "co", 3),
                            "loop_indices_sha256": buffer_hash(mesh.loops, "vertex_index", 1, "i"),
                            "polygon_smoothing": [p.use_smooth for p in mesh.polygons],
                            "normals_responsibility": "Native geometry/topology and polygon smoothing; no custom normal edit/bake",
                            "vertex_group_names": [g.name for g in obj.vertex_groups],
                            "influences_sha256": hashlib.sha256(json.dumps(influences, separators=(",", ":")).encode()).hexdigest(),
                            "uvs": [{"name": layer.name, "sha256": buffer_hash(layer.data, "uv", 2)} for layer in mesh.uv_layers],
                            "shape_keys": [{"name": key.name, "vertices": len(key.data), "value": key.value,
                                            "relative_key": key.relative_key.name,
                                            "coordinates_sha256": buffer_hash(key.data, "co", 3)}
                                           for key in mesh.shape_keys.key_blocks] if mesh.shape_keys else []}
        if obj.type == "ARMATURE":
            item["rig"] = {"pose_position": obj.data.pose_position,
                           "bones": [{"name": bone.name, "parent": bone.parent.name if bone.parent else None,
                                      "matrix_local": matrix(bone.matrix_local), "head_local": list(bone.head_local),
                                      "tail_local": list(bone.tail_local), "use_deform": bone.use_deform,
                                      "pose_matrix_basis": matrix(obj.pose.bones[bone.name].matrix_basis)}
                                     for bone in obj.data.bones]}
        objects.append(item)
    owned_materials = {s.material.name: s.material for obj in bpy.data.objects for s in obj.material_slots if s.material}
    materials = []
    owned_images = {}
    for mat in sorted(owned_materials.values(), key=lambda m: m.name):
        nodes = [{"name": n.name, "type": n.type, "image": n.image.name if n.type == "TEX_IMAGE" and n.image else None,
                  "input_defaults": {s.identifier: value(s.default_value) for s in n.inputs if hasattr(s, "default_value")},
                  "settings": {key: value(getattr(n, key)) for key in ["interpolation", "extension", "projection"] if hasattr(n, key)}}
                 for n in mat.node_tree.nodes] if mat.use_nodes and mat.node_tree else []
        links = [{"from_node": link.from_node.name, "from_socket": link.from_socket.identifier,
                  "to_node": link.to_node.name, "to_socket": link.to_socket.identifier} for link in mat.node_tree.links] if mat.node_tree else []
        materials.append({"name": mat.name, "users": mat.users, "use_nodes": mat.use_nodes, "nodes": nodes, "links": links,
                          "modes": {key: value(getattr(mat, key)) for key in
                                    ["blend_method", "surface_render_method", "use_backface_culling", "alpha_threshold"] if hasattr(mat, key)}})
        if mat.use_nodes and mat.node_tree:
            for node in mat.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image:
                    owned_images[node.image.name] = node.image
    images = [{"name": i.name, "filepath": i.filepath, "size": list(i.size), "colorspace": i.colorspace_settings.name,
               "packed_files": len(i.packed_files), "packed_sha256": hashlib.sha256(i.packed_file.data).hexdigest()
               if i.packed_file else None} for i in sorted(owned_images.values(), key=lambda i: i.name)]
    return {"objects": objects, "materials": materials, "images": images,
            "scene_names": sorted(s.name for s in bpy.data.scenes)}
