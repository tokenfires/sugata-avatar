"""One CPU-only ownership trial of parsed functions, never the full controller."""
from pathlib import Path
import ast
import datetime
import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import time

BASE = Path(__file__).resolve().parent
CONTROLLER_SHA = '0705d7452fdfb0e3403dea99505b825a65312ca93247a679ad4a3b809efe7b59'
events = []
cases = []
fixtures = []
failure = None


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


try:
    assert not (BASE / 'CPU-RESULT.json').exists(), 'no duplicate CPU trial'
    admission = json.loads((BASE / 'CPU-ADMISSION.json').read_text())
    assert admission['controller_sha256'] == CONTROLLER_SHA == sha(BASE / 'probe.py')
    assert admission['test_sha256'] == sha(Path(__file__))
    assert datetime.datetime.now(datetime.UTC) < datetime.datetime.fromisoformat('2026-10-05T10:42:00+00:00')
    names = {'require', 'group_members', 'stop_child', 'cleanup_all',
             'owned_images', 'image_devices', 'expected_layout'}
    parsed = ast.parse((BASE / 'probe.py').read_text())
    selected = [node for node in parsed.body if isinstance(node, ast.FunctionDef) and node.name in names]
    assert len(selected) == len(names) and all(not node.decorator_list for node in selected)
    scope = {'os': os, 'signal': signal, 'subprocess': subprocess, 'time': time, 're': re,
             'event': lambda kind, **value: events.append({'kind':kind, **value})}
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(BASE / 'probe.py'), 'exec'), scope)
    for case in ['exited_leader_with_descendant', 'live_leader', 'completed_leader']:
        marker = BASE / (case + '.pid.txt')
        assert not marker.exists()
        if case == 'exited_leader_with_descendant':
            payload = "import pathlib,subprocess,sys,os; p=subprocess.Popen([sys.executable,'-B','-c','import time; time.sleep(12)']); pathlib.Path(sys.argv[1]).write_text(str(p.pid)+'\\n'); os._exit(0)"
            argv = [sys.executable, '-B', '-c', payload, str(marker)]
        elif case == 'live_leader':
            argv = [sys.executable, '-B', '-c', 'import time; time.sleep(12)']
        else:
            argv = [sys.executable, '-B', '-c', 'pass']
        child = subprocess.Popen(argv, start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        fixture = {'child':child, 'marker':marker, 'case':case}
        fixtures.append(fixture)
        if case != 'live_leader':
            child.wait(timeout=3)
        before = scope['group_members'](child.pid)
        if marker.exists():
            assert int(marker.read_text()) in before, 'actual descendant not observed'
        scope['stop_child'](child)
        after = scope['group_members'](child.pid)
        assert child.poll() is not None and not after
        cases.append({'case':case, 'passed':True, 'leader_pid':child.pid,
                      'descendant_pid':int(marker.read_text()) if marker.exists() else None,
                      'actual_group_before':before, 'actual_group_after':after,
                      'leader_exit':child.returncode})
    called = []

    def child_fault():
        called.append('child')
        raise RuntimeError('deliberate CPU-only cleanup fault')

    errors = []
    scope['cleanup_all']([('child', child_fault), ('image', lambda: called.append('image')),
                         ('record', lambda: called.append('record'))], errors)
    assert called == ['child', 'image', 'record'] and len(errors) == 1
    cases.append({'case':'independent_cleanup_after_fault', 'passed':True,
                  'actual_callbacks':called, 'actual_errors':errors,
                  'scope':'Dispatcher only; no mount/detach operation.'})
    image = {'image-path':'/owned/cpu-fixture.dmg', 'owner-uid':os.getuid(), 'writeable':False,
             'system-entities':[{'dev-entry':'/dev/disk90001'},
                                {'dev-entry':'/dev/disk90001s1', 'mount-point':'/owned/cpu-mount'}]}
    data = {'images':[image, {'image-path':'/unrelated/fixture.dmg'}]}
    matched = scope['owned_images'](data, '/owned/cpu-fixture.dmg')
    assert matched == [image] and scope['expected_layout'](matched, '/owned/cpu-mount')
    cases.append({'case':'literal_image_correspondence', 'passed':True,
                  'scope':'Synthetic classification data only; no real mounted device.'})
    extra = json.loads(json.dumps(image))
    extra['system-entities'].append({'dev-entry':'/dev/disk90001s2', 'mount-point':'/unexpected/cpu-mount'})
    assert not scope['expected_layout']([extra], '/owned/cpu-mount')
    assert scope['image_devices']([extra]) == ['/dev/disk90001']
    cases.append({'case':'extra_volume_refused_with_retained_owned_device', 'passed':True,
                  'scope':'Synthetic classification data only; no real detach behavior proved.'})
except BaseException as exc:
    failure = type(exc).__name__ + ': ' + str(exc)
finally:
    cleanup_failures = []
    for fixture in fixtures:
        child = fixture['child']
        try:
            if child.poll() is None:
                child.kill()
                child.wait(timeout=2)
            marker = fixture['marker']
            if marker.exists():
                pid = int(marker.read_text())
                observed = subprocess.run(['/bin/ps', '-o', 'pid=,pgid=', '-p', str(pid)],
                                          capture_output=True, timeout=3)
                rows = [tuple(map(int, line.split())) for line in observed.stdout.splitlines()]
                if rows:
                    assert rows == [(pid, child.pid)], 'fixture identity ambiguous'
                    os.kill(pid, signal.SIGTERM)
                    # The controlled descendant exits naturally within12s if signalling refuses.
                    raise RuntimeError('fixture descendant required final recovery; CPU trial not qualified')
        except BaseException as exc:
            cleanup_failures.append({'case':fixture['case'], 'leader_pid':child.pid,
                                     'reason':type(exc).__name__ + ': ' + str(exc)})
    passed = failure is None and not cleanup_failures and len(cases) == 6
    result = {'closed_utc':datetime.datetime.now(datetime.UTC).isoformat(), 'passed':passed,
              'controller_sha256':CONTROLLER_SHA, 'test_sha256':sha(Path(__file__)),
              'failure':failure, 'cleanup_failures':cleanup_failures, 'cases':cases,
              'actual_process_observations':events,
              'scope':'Parsed source functions and newly owned CPU fixtures only. No full controller, package GET, mount, version, artist file or native GPU/browser action.'}
    (BASE / 'CPU-RESULT.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))

raise SystemExit(0 if passed else 1)
