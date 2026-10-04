from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, re

started = datetime.now(timezone.utc).isoformat()
p = Path(__file__).resolve().parent
sha = lambda data: hashlib.sha256(data).hexdigest()
note = (p/'SOURCE.md').read_bytes()
assert sha(note) == '88a21a410dba68217588445fadc132569aa6cc00eeabba735dbafca13c8a48bf'
rows = re.findall(r'^- ([^,\n]+), ([0-9]+) bytes: ([a-f0-9]{64})$', note.decode(), re.M)
assert len(rows) == 7
pins = []
for name, size, expected in rows:
    data = (p/name).read_bytes()
    assert len(data) == int(size) and sha(data) == expected, name
    pins.append(dict(path=name, bytes=len(data), sha256=expected))
assert sha((p/'PROMPT.txt').read_bytes()) == '8487dd03912b19d0e155efea1ee7de9a97815db0efbbf19384831cb35718dd09'
job = json.loads((p/'REFERENCE-JOB.json').read_text())
assert [x['id'] for x in job['tabsAfter']] == ['1']
result = dict(pid=os.getpid(), startedAt=started, endedAt=datetime.now(timezone.utc).isoformat(), decision='GO for one built-in concept generation only', sourceNoteSha256=sha(note), inputs=pins, scriptSha256=sha(Path(__file__).read_bytes()), rootWitness='Root actually viewed Ink body/portrait and both unchanged native COS whole/close images: matte fine wool, ribbing, relaxed shoulders and long leg folds. Full critic notes/source/limits independently read. Uniqlo contributes no actual image. Artist choices and matching-panel obligations are explicit.', limits='Concept only: no 3D source, fit, runtime, perceived gender or AAA acceptance; no further references or regeneration; hard close10:15UTC.')
(p/'ROOT-ADMISSION.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(dict(pid=result['pid'], startedAt=started, endedAt=result['endedAt'], decision='GO', pins=len(pins), resultSha256=sha((p/'ROOT-ADMISSION.json').read_bytes()))))
