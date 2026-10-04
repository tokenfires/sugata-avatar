from pathlib import Path
import datetime, hashlib, json, os, subprocess

root = Path('/Users/robault/GitHub/sugata-avatar')
packet = root / 'docs/evidence/nonhair-2026-10-04/portrait-outfit'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
closure = json.loads((packet / 'CANDIDATE-CLOSED.json').read_text())
assert closure['tabId'] == '14' and closure['knownClosure'] and closure['viewportReset']
decision = json.loads((packet / 'ROOT-FINAL.json').read_text())
assert decision['decision'].startswith('B before08:24')
critic = (root / decision['critic']['path']).read_bytes()
assert len(critic) == decision['critic']['bytes']
assert hashlib.sha256(critic).hexdigest() == decision['critic']['sha256']
pairs = [('portrait.html', 'original-portrait.html.source'),
         ('portrait.js', 'original-portrait.js.source'),
         ('portrait-outfit-candidate.html', 'candidate-portrait.html.source'),
         ('portrait-outfit-candidate.js', 'candidate-portrait.js.source'),
         ('portrait-outfit.mjs', 'portrait-outfit.mjs.source')]
for name, snapshot in pairs:
    assert (root / 'packages/testbed/src' / name).read_bytes() == (packet / snapshot).read_bytes()
owned = pairs[2:]
pins = []
for name, snapshot in owned:
    relative = 'packages/testbed/src/' + name
    probe = subprocess.run(['git', 'ls-files', '--error-unmatch', relative], cwd=root,
                           text=True, capture_output=True)
    assert probe.returncode == 1 and not probe.stdout, (relative, probe)
    payload = (root / relative).read_bytes()
    pins.append({'path': relative, 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest(),
                 'retainedSnapshot': str((packet / snapshot).relative_to(root))})
for name, _ in owned:
    (root / 'packages/testbed/src' / name).unlink()
for name, snapshot in pairs[:2]:
    assert (root / 'packages/testbed/src' / name).read_bytes() == (packet / snapshot).read_bytes()
result = {'pid': os.getpid(), 'started': started,
          'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'removedOnlyOwnedUntrackedExactSnapshots': pins,
          'acceptedOriginalsExact': True, 'knownTabClosed': '14', 'privateLifetimeUnexposed': True,
          'command': 'python3 docs/evidence/nonhair-2026-10-04/portrait-outfit/archive-candidate.py'}
(packet / 'ARCHIVE.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
