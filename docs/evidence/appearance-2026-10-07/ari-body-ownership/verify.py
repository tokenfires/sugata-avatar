"""Read-only text/artifact observer; never imports runtime or decodes assets."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import subprocess
import tomllib
from urllib.request import urlopen

packet = Path(__file__).resolve().parent
base = packet.parents[3]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


started = datetime.now(timezone.utc).isoformat()
plan = json.loads((packet / 'PLAN.json').read_text())
traced = json.loads((packet / 'TRACED-INPUTS.json').read_text())
source_checks = []
for row in plan['inputs'] + traced['inputs']:
    path = base / row['path']
    if row['path'] == 'docs/WORK-WINDOW-2026-10-07.md':
        path = packet / 'WORK-WINDOW.before.md'
    source_checks.append({**row, 'matches': path.stat().st_size == row['bytes'] and digest(path) == row['sha256']})
assert all(row['matches'] for row in source_checks)

lead = json.loads((packet / 'CONTROL-LEADS.json').read_text())
catalogue = json.loads((base / lead['source']['path']).read_text())
assert digest(base / lead['source']['path']) == lead['source']['sha256']
assert lead['source']['library'] == catalogue['library']
assert len(lead['declared_only_sliders']) == 8
assert len({s['id'] for s in lead['declared_only_sliders']}) == 8
for slider in lead['declared_only_sliders']:
    assert slider == next(s for s in catalogue['sliders'] if s['id'] == slider['id'])
    assert slider['exposed'] and slider['range'] == 'bipolar'
assert len(lead['declared_only_regions']) == 5
for region in lead['declared_only_regions']:
    assert region == next(r for r in catalogue['regions'] if r['id'] == region['id'])
assert lead['map_metadata'] == json.loads((base / 'assets/identity/figure-vertex-map.json').read_text())
assert lead['no_values_selected'] is True and lead['no_binary_read_or_apply'] is True

preserved = []
for name in ['larger-frame-character', 'ari-bomber-drawing']:
    folder = packet.parent / name
    manifest = json.loads((folder / 'MANIFEST.json').read_text())
    for row in manifest['payloads']:
        path = folder / row['path']
        assert digest(path) == row['sha256'] and path.stat().st_size == row['bytes']
        assert path.stat().st_mode & 0o222 == 0
    preserved.append({'packet': name, 'payloads': len(manifest['payloads']), 'manifest_sha256': digest(folder / 'MANIFEST.json')})

board = base / 'docs/ARTIST-WARDROBE.html'
new_link = b'<a href="/@fs/Users/robault/GitHub/sugata-avatar/docs/evidence/appearance-2026-10-07/ari-body-ownership/BODY-SOURCE-CONTRACT.md">Body source decision</a>'
assert board.read_bytes().count(new_link) == 1
assert board.read_bytes().replace(new_link, b'') == (packet / 'BOARD.before.html').read_bytes()
assert board.read_bytes() == (packet / 'BOARD.delivered.html').read_bytes()

links = []
for path in packet.glob('*.md'):
    origin = base / 'docs' if path.name == 'WORK-WINDOW.before.md' else path.parent
    for target in re.findall(r'\]\(([^)]+)\)', path.read_text()):
        if '://' in target or target.startswith('#'):
            continue
        destination = (origin / target.split('#')[0]).resolve()
        assert destination.exists(), (path.name, target)
        links.append({'from': path.name, 'target': target})

automation = tomllib.loads(Path('/Users/robault/.codex/automations/advance-sugata-avatar-visual-quality/automation.toml').read_text())
assert automation['status'] == 'ACTIVE'
assert automation['target_thread_id'] == '01a116ed-8765-73f3-b541-d46f1e63c1b7'
assert automation['rrule'] == 'FREQ=MINUTELY;INTERVAL=10'
http = []
for path in [board, packet / 'BODY-SOURCE-CONTRACT.md', packet / 'CONTROL-LEADS.json']:
    url = 'http://127.0.0.1:5173/@fs' + str(path)
    with urlopen(url, timeout=5) as response:
        assert response.status == 200
        response.read()
        http.append({'url': url, 'status': response.status})

changed = subprocess.check_output(['git', 'diff', '--name-only'], cwd=base, text=True).splitlines()
assert set(changed) <= {'docs/ARTIST-WARDROBE.html', 'docs/WORK-WINDOW-2026-10-07.md'}
report = {
    'started_at': started, 'completed_at': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(),
    'command': 'python3 docs/evidence/appearance-2026-10-07/ari-body-ownership/verify.py',
    'observer_sha256': digest(Path(__file__)), 'source_checks': source_checks,
    'control_sliders': 8, 'control_regions': 5, 'map_metadata_exact': True,
    'preserved': preserved, 'board_single_link_reversal': True, 'local_links': links, 'http': http,
    'changed_tracked_paths': changed, 'automation': {k: automation[k] for k in ['id', 'status', 'rrule', 'target_thread_id']},
    'qualification': 'Text source/artifact association only; no runtime, binary, geometry, fit or appearance qualification.'
}
(packet / 'VERIFICATION.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'passed': True, 'pid': os.getpid(), 'source_pins': len(source_checks), 'preserved_payloads': sum(p['payloads'] for p in preserved), 'local_links': len(links), 'output_sha256': digest(packet / 'VERIFICATION.json')}, indent=2))
