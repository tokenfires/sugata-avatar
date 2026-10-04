"""Guarded removal of the closed owned untracked route; frozen source retained."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, subprocess

p = Path(__file__).resolve().parent
repo = Path(__file__).resolve().parents[4]
start = datetime.now(timezone.utc).isoformat()
route = repo / 'packages/testbed/src/portrait-neutral-candidate.html'
archive = p.parent / 'portrait-neutral-ui/candidate-portrait-source.txt'
original = repo / 'packages/testbed/src/portrait.html'
sha = lambda b: hashlib.sha256(b).hexdigest()
expected = '0e8c682ded5282e4dc68710b19edf637b694e986dc3a7d342107c378c528348c'
assert sha(route.read_bytes()) == expected
assert route.read_bytes() == archive.read_bytes()
assert sha(original.read_bytes()) == 'a61e72ef3d0b65d03f2a7699dd984c556591980d8be13e1998704c61e9478764'
tracked = subprocess.run(['git', 'ls-files', '--', str(route.relative_to(repo))], cwd=repo,
                         capture_output=True, text=True, check=True)
assert tracked.stdout == '', 'Do not remove a tracked route'
closed = json.loads((p / 'CLOSED.json').read_text())
assert closed['tabId'] == '13' and closed['viewportReset'] is True
route.unlink()
assert not route.exists() and sha(archive.read_bytes()) == expected
result = {'pid': os.getpid(), 'started': start, 'finished': datetime.now(timezone.utc).isoformat(),
          'removedOnly': str(route.relative_to(repo)), 'routeWasUntracked': True,
          'archive': str(archive.relative_to(repo)), 'archiveBytes': archive.stat().st_size,
          'archiveSHA256': expected, 'acceptedOriginalUnchanged': True,
          'scope': 'Closed owned route cleanup; no product adoption, source repair or deletion of frozen evidence.'}
(p / 'CANDIDATE-ARCHIVE.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
