from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, re

started = datetime.now(timezone.utc).isoformat()
p = Path(__file__).resolve().parent
sha = lambda data: hashlib.sha256(data).hexdigest()
note = (p/'RESULT.md').read_bytes()
assert sha(note) == '9c6cba885bba33eee6539d4cfc36f8b8554f3ec3a56a8c4ae50c81cc0b065745'
rows = re.findall(r'^- ([^\n]+): ([a-f0-9]{64})$', note.decode(), re.M)
assert len(rows) == 9
pins = []
for name, expected in rows:
    data = (p/name).read_bytes()
    assert sha(data) == expected, name
    pins.append(dict(path=name, bytes=len(data), sha256=expected))
out = json.loads((p/'IMAGEGEN-OUTPUT.json').read_text())
assert Path(out['sourcePath']).read_bytes() == (p/'concept-v1.png').read_bytes()
job = json.loads((p/'IMAGEGEN-JOB.json').read_text())
assert job['status'] == 'returned' and job['transparent_background'] is False
assert job['promptSha256'] == sha((p/'PROMPT.txt').read_bytes())
assert job['rootAdmissionSha256'] == sha((p/'ROOT-ADMISSION.json').read_bytes())
assert datetime.now(timezone.utc) < datetime(2026, 10, 4, 10, 15, tzinfo=timezone.utc)
result = dict(pid=os.getpid(), startedAt=started, endedAt=datetime.now(timezone.utc).isoformat(), decision='A: retain as future artist-discussion target only', criticSha256=sha(note), inputs=pins, defaultOriginal='retained byte-identical', scriptSha256=sha(Path(__file__).read_bytes()), rootWitness='Root original-detail inspection supports complete silhouette, readable face, different knit/wider-trouser shapes and coherent panels. Independently accepts critic shallow-angle and illustrative-knit limits; actual images do not define rear/side depth or exact felted material.', alternatives='A retains new discussion reference with explicit future authoring obligations; B declines it for immediate construction and preserves existing targets. A selected only for art-reference scope; no second generation or new trial.', limits='No native avatar/asset/runtime/fit/geometry/gender-recognition/AAA or all-view/motion acceptance. Full roadmap and original references stay open/preserved.')
(p/'ROOT-RESULT.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(dict(pid=result['pid'], startedAt=started, endedAt=result['endedAt'], decision='A artist reference only', pins=len(pins), resultSha256=sha((p/'ROOT-RESULT.json').read_bytes()))))
