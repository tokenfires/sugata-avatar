"""Read only declared GLB/JSON ownership; never decode BIN values or import assets."""
from pathlib import Path
import base64, datetime, hashlib, json, os, struct, sys, time

ROOT = Path("/Users/robault/GitHub/sugata-avatar")
LEAF = ROOT / "docs/evidence/appearance-2026-10-05/foot-source-map"
PLAN = LEAF / "PLAN.json"
START = datetime.datetime.now(datetime.timezone.utc).isoformat()
CLOCK = time.monotonic()
RECEIPT = {"pid": os.getpid(), "started_utc": START, "scope": "Container/JSON declarations only; no BIN values, world/skin arithmetic or model import"}
OPERANDS = {}

def unique_object(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError("duplicate JSON key: " + key)
        out[key] = value
    return out

def load_json(data):
    return json.loads(data, object_pairs_hook=unique_object,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError("nonfinite JSON constant: " + value)))

def ref(index, items, label):
    if type(index) is not int or not 0 <= index < len(items):
        raise ValueError("invalid declaration reference: " + label)
    return items[index]

def write_new(name, value):
    path = LEAF / name
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2, allow_nan=False)
        stream.write("\n")

def declarations(label, binding):
    data = (ROOT / binding["path"]).read_bytes()
    if len(data) != binding["bytes"] or hashlib.sha256(data).hexdigest() != binding["sha256"]:
        raise ValueError("input identity changed: " + label)
    if len(data) < 20:
        raise ValueError("short GLB")
    magic, version, length = struct.unpack_from("<III", data)
    if (magic, version, length) != (0x46546C67, 2, len(data)):
        raise ValueError("unsupported GLB header")
    chunks = []
    offset = 12
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError("incomplete chunk header")
        size, kind = struct.unpack_from("<II", data, offset)
        start, end = offset + 8, offset + 8 + size
        if size % 4 or end > len(data):
            raise ValueError("unaligned or truncated chunk")
        chunks.append({"type": kind, "bytes": size, "data_start": start, "data_end": end})
        offset = end
    if not chunks or chunks[0]["type"] != 0x4E4F534A:
        raise ValueError("first chunk is not JSON")
    if sum(c["type"] == 0x4E4F534A for c in chunks) != 1:
        raise ValueError("ambiguous JSON chunks")
    bins = [c for c in chunks if c["type"] == 0x004E4942]
    if len(bins) > 1 or (bins and chunks[1] != bins[0]):
        raise ValueError("invalid BIN order")
    raw = data[chunks[0]["data_start"]:chunks[0]["data_end"]]
    document = load_json(raw.decode("utf-8"))
    asset = document.get("asset", {})
    if asset.get("version") != "2.0" or asset.get("minVersion", "2.0") != "2.0":
        raise ValueError("unsupported asset version")
    # Preserve the complete JSON chunk losslessly, including padding, before route qualification.
    write_new(label + ".declarations.json", {
        "input": binding, "header": {"magic": magic, "version": version, "length": length},
        "chunks": chunks, "json_chunk_sha256": hashlib.sha256(raw).hexdigest(),
        "json_chunk_base64": base64.b64encode(raw).decode("ascii"), "gltf": document
    })
    OPERANDS[label] = {"input": binding, "chunks": chunks, "asset": asset}
    nodes, meshes = document.get("nodes", []), document.get("meshes", [])
    skins, accessors = document.get("skins", []), document.get("accessors", [])
    views, buffers = document.get("bufferViews", []), document.get("buffers", [])
    parent = {}
    for i, node in enumerate(nodes):
        for child in node.get("children", []):
            ref(child, nodes, "child")
            if child in parent:
                raise ValueError("multiple node parents")
            parent[child] = i
    ancestry = {}
    for i in range(len(nodes)):
        chain, seen, cursor = [], set(), i
        while True:
            if cursor in seen:
                raise ValueError("node hierarchy cycle")
            seen.add(cursor)
            chain.append(cursor)
            if cursor not in parent:
                break
            cursor = parent[cursor]
        ancestry[i] = list(reversed(chain))
    scenes = document.get("scenes", [])
    scene_id = document.get("scene")
    if scene_id is None:
        raise ValueError("missing default scene; selection ambiguous")
    scene = ref(scene_id, scenes, "default scene")
    reachable, stack = set(), list(scene.get("nodes", []))
    for root_node in stack:
        ref(root_node, nodes, "scene root")
        if root_node in parent:
            raise ValueError("scene root has parent")
    while stack:
        node_id = stack.pop()
        if node_id in reachable:
            continue
        reachable.add(node_id)
        stack.extend(nodes[node_id].get("children", []))

    def accessor(index):
        item = ref(index, accessors, "accessor")
        result = {"id": index, "declaration": item}
        if "bufferView" in item:
            view = ref(item["bufferView"], views, "bufferView")
            buffer = ref(view["buffer"], buffers, "buffer")
            result.update({"bufferView_id": item["bufferView"], "bufferView": view,
                           "buffer_id": view["buffer"], "buffer": buffer,
                           "embedded_BIN_declared": view["buffer"] == 0 and "uri" not in buffer and bool(bins)})
        return result

    owners = []
    for node_id in sorted(reachable):
        node = nodes[node_id]
        if "mesh" not in node:
            continue
        mesh_id = node["mesh"]
        mesh = ref(mesh_id, meshes, "mesh")
        entry = {"node_id": node_id, "node": node, "ancestry": ancestry[node_id],
                 "ancestry_nodes": [{"id": n, "node": nodes[n]} for n in ancestry[node_id]],
                 "mesh_id": mesh_id, "mesh": mesh, "skin": None, "primitives": []}
        if "skin" in node:
            skin_id = node["skin"]
            skin = ref(skin_id, skins, "skin")
            if "skeleton" in skin:
                ref(skin["skeleton"], nodes, "skin skeleton")
            joints = skin.get("joints", [])
            if not joints or len(set(joints)) != len(joints):
                raise ValueError("missing or duplicate skin joints")
            ordered = [{"joint_order": k, "node_id": n, "node": ref(n, nodes, "skin joint"),
                        "ancestry": ancestry[n]} for k, n in enumerate(joints)]
            inverse = accessor(skin["inverseBindMatrices"]) if "inverseBindMatrices" in skin else None
            if inverse:
                a = inverse["declaration"]
                if a.get("type") != "MAT4" or a.get("componentType") != 5126 or a.get("count", 0) < len(joints):
                    raise ValueError("invalid inverse-bind descriptor")
            entry["skin"] = {"id": skin_id, "declaration": skin, "ordered_joints": ordered,
                             "inverse_bind_descriptor": inverse}
        for primitive_id, primitive in enumerate(mesh.get("primitives", [])):
            attributes = {name: accessor(index) for name, index in primitive.get("attributes", {}).items()}
            if "POSITION" not in attributes:
                raise ValueError("missing POSITION route")
            if entry["skin"] is not None and not {"JOINTS_0", "WEIGHTS_0"} <= set(attributes):
                raise ValueError("missing skin-attribute route")
            entry["primitives"].append({"id": primitive_id, "attributes": attributes,
                                        "indices": accessor(primitive["indices"]) if "indices" in primitive else None,
                                        "declaration": primitive})
        owners.append(entry)
    if not owners or not any(o["skin"] is not None for o in owners):
        raise ValueError("no declared skinned mesh owner in default scene")
    name_leads = [{"id": i, "name": n.get("name", "")} for i, n in enumerate(nodes)
                  if any(term in n.get("name", "").lower() for term in ("foot", "toe", "ankle"))]
    result = {"label": label, "input": binding, "default_scene_id": scene_id,
              "default_scene": scene, "reachable_node_ids": sorted(reachable),
              "owners": owners, "foot_name_leads_only": name_leads,
              "counts": {"nodes": len(nodes), "meshes": len(meshes), "skins": len(skins),
                         "accessors": len(accessors), "default_scene_mesh_owners": len(owners)},
              "limits": "Literal declarations only. BIN values, world transforms, anatomical foot partitions, bind/weight/position equality, geometry/fit and source reuse unqualified."}
    OPERANDS[label] = result
    write_new(label + ".routes.json", result)
    return result

try:
    plan = load_json(PLAN.read_text())
    if datetime.datetime.fromisoformat(START) >= datetime.datetime.fromisoformat(plan["research_stop_utc"].replace("Z", "+00:00")):
        raise ValueError("research deadline already reached")
    for binding in plan["bindings"]:
        path = Path(binding["path"])
        path = path if path.is_absolute() else ROOT / path
        data = path.read_bytes()
        if len(data) != binding["bytes"] or hashlib.sha256(data).hexdigest() != binding["sha256"]:
            raise ValueError("bound input changed: " + binding["path"])
    manifest = load_json((ROOT / "assets/wardrobe/manifest.json").read_text())
    matching = [g for g in manifest["garments"] if g.get("id") == "shoes01"]
    if len(matching) != 1 or matching[0].get("fragments", {}).get("g050") != "shoes01/g050.glb":
        raise ValueError("ambiguous manifest source route")
    write_new("manifest-route.json", {"note": manifest["note"], "figureCoverage": manifest["figureCoverage"],
                                     "shoe": matching[0], "scope": "g050 plumbing reference only"})
    by_path = {b["path"]: b for b in plan["bindings"]}
    body = declarations("body", by_path["assets/wardrobe/body/g050.glb"])
    shoe = declarations("shoes01", by_path["assets/wardrobe/shoes01/g050.glb"])
    summary = {"decision": "Declared metadata routes recorded; no physical/source equivalence qualification",
               "body_counts": body["counts"], "shoe_counts": shoe["counts"],
               "body_foot_name_leads": body["foot_name_leads_only"],
               "shoe_foot_name_leads": shoe["foot_name_leads_only"],
               "limits": "No claim that names identify anatomical foot surfaces or that local transforms/joint routes equal physical bind/world/fit. No new ankle-boot source."}
    write_new("SUMMARY.json", summary)
    RECEIPT.update({"status": "metadata observer completed", "finished_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "elapsed_seconds": time.monotonic() - CLOCK, "outputs": sorted(p.name for p in LEAF.glob("*.routes.json"))})
    write_new("OBSERVER.json", RECEIPT)
    print(json.dumps({"receipt": RECEIPT, "summary": summary}, indent=2))
except Exception as error:
    RECEIPT.update({"status": "B first metadata refusal", "exception": type(error).__name__,
                    "message": str(error), "finished_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "elapsed_seconds": time.monotonic() - CLOCK, "partial_operands": OPERANDS})
    write_new("OBSERVER-REFUSAL.json", RECEIPT)
    print(json.dumps({"status": RECEIPT["status"], "message": str(error)}, indent=2), file=sys.stderr)
    raise
