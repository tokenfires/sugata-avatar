"""One finite exact SVG registry publication; no rendering or geometry construction."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import xml.etree.ElementTree as ET

leaf = Path(__file__).resolve().parent
raw = (leaf / "skirt.svg").read_bytes()
if len(raw) > 65536:
    raise ValueError("SVG exceeds 64KiB")
xml = raw.decode("utf-8")
if any(token in xml.lower() for token in ["<!", "<script", "<image", "<use", "<foreignobject", "href=", "url("]):
    raise ValueError("Unexpected resource or executable markup")
root = ET.fromstring(xml)
if root.tag != "{http://www.w3.org/2000/svg}svg" or root.attrib.get("viewBox") != "0 0 1440 1040":
    raise ValueError("Unexpected SVG frame")
elements = list(root.iter())
if len(elements) > 250:
    raise ValueError("Element budget exceeded")
ids = [element.attrib.get("id") for element in elements]
if any(identity is None for identity in ids) or len(set(ids)) != len(ids):
    raise ValueError("Every element needs one unique ID")
if any(key.lower().startswith("on") for element in elements for key in element.attrib):
    raise ValueError("Executable event attribute")
required = ["front", "rear", "left-profile", "inside-waist", "closure", "hem-and-layering"]
views = [element.attrib["data-view"] for element in elements if "data-view" in element.attrib]
if views != required:
    raise ValueError("Required ordered six-area source is incomplete")
records = []

def visit(element, ancestors, inherited_view, inherited_feature):
    attributes = dict(element.attrib)
    identity = attributes["id"]
    view = attributes.get("data-view", inherited_view)
    feature = attributes.get("data-feature", inherited_feature)
    records.append({
        "id": identity, "tag": element.tag, "attributes": attributes,
        "text": element.text, "tail": element.tail,
        "parent": ancestors[-1] if ancestors else None,
        "ancestors": ancestors, "children": [child.attrib["id"] for child in element],
        "view": view, "feature": feature, "document_order": len(records),
    })
    for child in element:
        visit(child, ancestors + [identity], view, feature)

visit(root, [], None, None)
payload = {
    "format": "sugata-original-technical-design", "version": 1,
    "design": "Mara plum midi 01", "source": "skirt.svg",
    "source_bytes": len(raw), "source_sha256": hashlib.sha256(raw).hexdigest(),
    "source_xml": xml, "frame": {"width": 1440, "height": 1040, "units": "unitless"},
    "orientation": "Independent front/rear/wearer-left profile and three construction-intent insets; not registered projections. Profile front is page-left. Inside rear facing is unfolded inward.",
    "palette": {"plum": "#64334f", "band": "#633047", "shade": "#4b293d", "highlight": "#85556d", "facing": "#b798aa", "ivory": "#e8e0d6", "caramel": "#aa7855"},
    "views": required, "nodes": records,
    "features": {feature: [record["id"] for record in records if record["feature"] == feature]
                 for feature in dict.fromkeys(record["feature"] for record in records)},
    "original_choices": ["Smooth waistband and clean front", "Two rear darts and centre-back seam", "Wearer-left concealed zip and waistband hook", "Inside facing and lower attachment", "Continuous turned hem", "Ivory tee overlap and shorter caramel cardigan"],
    "style_scope": "Full literal CSS, attributes and ancestry retained; no computed style evaluation.",
    "limits": "Unitless independently authored artist schematics. No traced maker pattern, sewing dimensions, measured body, physical cloth/fit, 3D surfaces, rig/morph/motion, runtime or AAA proof.",
}
encoded = (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
if len(encoded) > 524288:
    raise ValueError("JSON exceeds 512KiB")
with (leaf / "design.json").open("xb") as handle:
    handle.write(encoded)
receipt = {
    "utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "pid": os.getpid(),
    "command": "python3 docs/evidence/appearance-2026-10-06/mara-midi-technical-design/publish-registry.py",
    "svg_bytes": len(raw), "svg_sha256": hashlib.sha256(raw).hexdigest(),
    "json_bytes": len(encoded), "json_sha256": hashlib.sha256(encoded).hexdigest(),
    "elements": len(records), "required_views": views,
    "decision_scope": "Finite exact source registry only; no rendered appearance or physical acceptance.",
}
with (leaf / "SOURCE-RECEIPT.json").open("x") as handle:
    json.dump(receipt, handle, indent=2)
    handle.write("\n")
print(json.dumps(receipt))
