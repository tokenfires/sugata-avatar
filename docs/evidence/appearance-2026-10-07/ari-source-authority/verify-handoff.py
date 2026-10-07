"""Text/presentation readback only; never rehashes or decodes a GLB."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import subprocess

packet = Path(__file__).resolve().parent
base = packet.parents[3]
plan = json.loads((packet / 'PLAN.json').read_text())
checked = []
for row in plan['inputs']:
    content = subprocess.check_output(['git', 'show', '87306e0:' + row['path']], cwd=base) if row['path'] == 'docs/WORK-WINDOW-2026-10-07.md' else (base / row['path']).read_bytes()
    assert len(content) == row['bytes'] and hashlib.sha256(content).hexdigest() == row['sha256']
    checked.append(row['path'])
presentation = json.loads((packet / 'PRESENTATION.json').read_text())
board = (base / presentation['board_path']).read_bytes()
before = subprocess.check_output(['git', 'show', '87306e0:' + presentation['board_path']], cwd=base)
assert board.replace(presentation['new_link'].encode(), presentation['old_link'].encode()) == before
assert hashlib.sha256(board).hexdigest() == presentation['after_sha256']
links = []
for path in packet.glob('*.md'):
    for target in re.findall(r'\]\(([^)]+)\)', path.read_text()):
        if '://' not in target and not target.startswith('#'):
            assert (path.parent / target.split('#')[0]).resolve().exists(), (path.name, target)
            links.append({'from': path.name, 'target': target})
changed = subprocess.check_output(['git', 'diff', '--name-only'], cwd=base, text=True).splitlines()
assert set(changed) <= {'docs/ARTIST-WARDROBE.html', 'docs/WORK-WINDOW-2026-10-07.md'}
result = {'time': datetime.now(timezone.utc).isoformat(), 'pid': os.getpid(), 'command': 'python3 docs/evidence/appearance-2026-10-07/ari-source-authority/verify-handoff.py', 'observer_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'plan_text_inputs': checked, 'board_only_link_replacement': True, 'links': links, 'changed_tracked_paths': changed, 'scope': 'Text/presentation checks only. Current GLBs and raw proof arrays were not read or decoded.'}
(packet / 'STATIC-CHECK.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'passed': True, 'pid': os.getpid(), 'input_pins': len(checked), 'local_links': len(links), 'report_sha256': hashlib.sha256((packet / 'STATIC-CHECK.json').read_bytes()).hexdigest()}, indent=2))
