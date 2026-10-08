"""Read-only cold owner/provenance/key-semantic comparison before first image."""
import datetime
import json
import bpy

def capture_provenance(body):
    result = {}
    for key, name, domain in [("points", "sugata_source_point", "POINT"),
                              ("faces", "sugata_source_face", "FACE"),
                              ("corners", "sugata_source_corner", "CORNER")]:
        attr = body.data.attributes.get(name)
        if attr is None or attr.domain != domain or attr.data_type != "INT":
            raise RuntimeError("Cold provenance lost: " + name)
        ids = [item.value for item in attr.data]
        if len(ids) != len(set(ids)):
            raise RuntimeError("Cold provenance ambiguous: " + name)
        result[key] = ids
    return result

def qualify(here, before, warm, semantic_module):
    result = {"observed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "scene": before, "checks": [], "passed": False}
    try:
        body = bpy.data.objects["Human"]
        result["mapping"] = capture_provenance(body)
        result["expanded_key_metadata"] = semantic_module.snapshot(body.data.shape_keys)
        result["checks"] = [
            {"name": "complete_saved_owner_signature", "pass": before == warm["derivative_owner_signature"]},
            {"name": "typed_point_face_corner_mapping", "pass": result["mapping"] == warm["mapping"]},
            {"name": "expanded_key_semantics", "pass": result["expanded_key_metadata"] == warm["extended_key_metadata"]["restored"]},
        ]
        result["passed"] = all(c["pass"] for c in result["checks"])
    except Exception as error:
        result["exception"] = repr(error)
    with (here / "COLD-RESULT.json").open("x") as out:
        json.dump(result, out, indent=2); out.write("\n")
    if not result["passed"]:
        raise RuntimeError("Cold association refused before first image")
    return result
