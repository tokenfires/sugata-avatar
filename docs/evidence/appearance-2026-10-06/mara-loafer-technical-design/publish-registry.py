"""One finite exact SVG registry publication; no renderer or geometry construction."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import xml.etree.ElementTree as ET

leaf = Path(__file__).resolve().parent
raw = (leaf / 'loafer.svg').read_bytes()
if len(raw) > 65536:
    raise ValueError('SVG exceeds 64KiB')
xml = raw.decode('utf-8')
if any(t in xml for t in ['<!', '<script', '<image', '<use', '<foreignObject', 'href=']):
    raise ValueError('Unexpected resource or executable markup')
root = ET.fromstring(xml)
elements = list(root.iter())
if len(elements) > 250:
    raise ValueError('Element budget exceeded')
ids = [e.attrib.get('id') for e in elements]
if any(i is None for i in ids) or len(set(ids)) != len(ids):
    raise ValueError('Every element needs one unique ID')
required = ['top', 'lateral-profile', 'front', 'rear', 'sole', 'inside']
views = [e.attrib['data-view'] for e in elements if 'data-view' in e.attrib]
if views != required:
    raise ValueError('Required ordered six-view source is incomplete')
records = []

def visit(element, ancestors, inherited_view, inherited_feature):
    attrs = dict(element.attrib)
    identity = attrs['id']
    view = attrs.get('data-view', inherited_view)
    feature = attrs.get('data-feature', inherited_feature)
    records.append({
        'id': identity, 'tag': element.tag, 'attributes': attrs,
        'text': element.text, 'tail': element.tail,
        'parent': ancestors[-1] if ancestors else None,
        'ancestors': ancestors, 'children': [c.attrib['id'] for c in element],
        'view': view, 'feature': feature,
        'document_order': len(records),
    })
    for child in element:
        visit(child, ancestors + [identity], view, feature)

visit(root, [], None, None)
payload = {
    'format': 'sugata-original-technical-design', 'version': 1,
    'design': 'Mara oxblood loafer 01', 'source': 'loafer.svg',
    'source_bytes': len(raw), 'source_sha256': hashlib.sha256(raw).hexdigest(),
    'source_xml': xml, 'frame': {'width': 1440, 'height': 1040, 'units': 'unitless'},
    'handedness': 'One left shoe; toe-up medial-right top/sole/inside, lateral toe-right, front/rear toward viewer. Pair shares roles; right anatomical fit not authored.',
    'palette': {'upper': '#6f2737', 'shade': '#491b29', 'highlight': '#9d5561', 'lining': '#ead3b0', 'footbed': '#d0b38f', 'sole': '#343033', 'midsole': '#66513f'},
    'views': required, 'nodes': records,
    'features': {feature: [a['id'] for a in records if a['feature'] == feature]
                 for feature in dict.fromkeys(a['feature'] for a in records)},
    'style_scope': 'Full literal CSS and attributes/ancestry retained; no computed style evaluation.',
    'limits': 'Independently authored unregistered artist views. No measurement, last, sewing pattern, material mechanics, 3D cavity/fit, motion or runtime proof.',
}
encoded = (json.dumps(payload, indent=2, ensure_ascii=False) + '\n').encode('utf-8')
if len(encoded) > 524288:
    raise ValueError('JSON exceeds 512KiB')
with (leaf / 'design.json').open('xb') as handle:
    handle.write(encoded)
receipt = {
    'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(),
    'command': 'python3 docs/evidence/appearance-2026-10-06/mara-loafer-technical-design/publish-registry.py',
    'svg_bytes': len(raw), 'svg_sha256': hashlib.sha256(raw).hexdigest(),
    'json_bytes': len(encoded), 'json_sha256': hashlib.sha256(encoded).hexdigest(),
    'elements': len(records), 'required_views': views,
    'decision_scope': 'Finite exact source registry only; no rendered appearance or physical acceptance.',
}
with (leaf / 'SOURCE-RECEIPT.json').open('x') as handle:
    json.dump(receipt, handle, indent=2)
    handle.write('\n')
print(json.dumps(receipt))
