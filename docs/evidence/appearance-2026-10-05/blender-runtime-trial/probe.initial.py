"""One owned, reversible official-package/version trial. No artist file load."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import platform
import plistlib
import re
import shutil
import signal
import subprocess
import time
import urllib.request

ROOT = Path('/Users/robault/GitHub/sugata-avatar')
EVIDENCE = ROOT / 'docs/evidence/appearance-2026-10-05/blender-runtime-trial'
PLAN_HASH = '04276fe1b1837aff179d52f05cfd1b654cb491110bc1832c9ff84810f2acc3b0'
events = []
active_child = None
owned_store = False
passed = False
failure = None
cleanup_ok = True
started = time.monotonic()
store = ROOT / 'assets/vendor/tooling/blender-runtime-20261005T1004Z'
mountpoint = store / 'mount'
package = store / 'blender-5.2.2-macos-arm64.dmg'
partial = store / (package.name + '.partial')
plan = {}


def utc():
    return datetime.datetime.now(datetime.UTC).isoformat()


def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for data in iter(lambda: f.read(1024 * 1024), b''):
            h.update(data)
    return h.hexdigest()


def write(name, value):
    (EVIDENCE / name).write_text(json.dumps(value, indent=2) + '\n')


def event(kind, **data):
    events.append({'utc': utc(), 'kind': kind, **data})
    write('JOBS.json', {'wrapper_pid': os.getpid(), 'events': events})


def remaining():
    deadline = datetime.datetime.fromisoformat(plan['stop_utc'].replace('Z', '+00:00'))
    return min(480 - (time.monotonic() - started),
               (deadline - datetime.datetime.now(datetime.UTC)).total_seconds())


def require(ok, reason):
    if not ok:
        raise RuntimeError(reason)


def interrupted(signum, _frame):
    raise TimeoutError('owned controller interrupted or wall deadline: ' + str(signum))


def stop_child(child):
    if child.poll() is None:
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            child.wait(timeout=2)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait(timeout=2)


def run(label, argv, seconds, env=None, cleanup=False):
    global active_child
    timeout = seconds if cleanup else min(seconds, remaining())
    require(timeout > 0, 'work deadline before ' + label)
    stdout = EVIDENCE / (label + '.stdout.txt')
    stderr = EVIDENCE / (label + '.stderr.txt')
    with stdout.open('xb') as out, stderr.open('xb') as err:
        child = subprocess.Popen(argv, cwd=store, env=env, stdout=out,
                                 stderr=err, start_new_session=True)
        active_child = child
        event('child_start', label=label, argv=argv, pid=child.pid,
              group=child.pid, timeout_seconds=timeout)
        try:
            child.wait(timeout=timeout)
        finally:
            stop_child(child)
            event('child_collected', label=label, pid=child.pid,
                  exit_code=child.returncode, alive=child.poll() is None)
            active_child = None
    require(child.returncode == 0, label + ' exit ' + str(child.returncode))
    return stdout.read_bytes(), stderr.read_bytes()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


try:
    require(digest(EVIDENCE / 'PLAN.json') == PLAN_HASH, 'PLAN changed')
    plan = json.loads((EVIDENCE / 'PLAN.json').read_text())
    admission = json.loads((EVIDENCE / 'ADMISSION.json').read_text())
    require(admission['plan_sha256'] == PLAN_HASH and
            admission['controller_sha256'] == digest(Path(__file__)),
            'source admission hash mismatch')
    require(admission['decision'] == 'A one exact reviewed controller invocation',
            'no controller admission')
    for row in plan['input_bindings']:
        p = ROOT / row['path']
        require(p.stat().st_size == row['bytes'] and digest(p) == row['sha256'],
                'input drift ' + row['path'])
    cutoff = datetime.datetime.fromisoformat(plan['source_review_cutoff_utc'].replace('Z', '+00:00'))
    require(datetime.datetime.now(datetime.UTC) < cutoff, 'source admission expired')
    require(platform.machine() == 'arm64', 'host architecture changed')
    require(shutil.disk_usage(ROOT).free > plan['package']['bytes'] * 10,
            'insufficient bounded working disk')
    require(store.parent.resolve() == store.parent.absolute(), 'store parent symlink')
    require(not store.exists(), 'owned store already exists; no duplicate invocation')
    store.mkdir(parents=True, exist_ok=False)
    owned_store = True
    mountpoint.mkdir()
    event('owned_store_created', store=str(store), mountpoint=str(mountpoint),
          source_sha256=digest(Path(__file__)), plan_sha256=PLAN_HASH)
    signal.signal(signal.SIGALRM, interrupted)
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.setitimer(signal.ITIMER_REAL, min(180, remaining()))
    expected = plan['package']
    req = urllib.request.Request(expected['url'], headers={'User-Agent': 'Sugata-runtime-probe/1.0', 'Accept': 'application/octet-stream'})
    event('package_get_start', url=expected['url'], maximum_bytes=750 * 1024 * 1024,
          deadline_seconds=min(180, remaining()))
    response = urllib.request.build_opener(NoRedirect()).open(req, timeout=20)
    count = 0
    h = hashlib.sha256()
    try:
        require(response.status == 200 and response.geturl() == expected['url'],
                'unexpected package status or redirect')
        require(response.headers.get('Content-Length') == str(expected['bytes']),
                'package content length differs from literal index')
        event('package_response', status=response.status, url=response.geturl(),
              headers=dict(response.headers.items()))
        with partial.open('xb') as f:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                count += len(chunk)
                require(count <= expected['bytes'] and count <= 750 * 1024 * 1024,
                        'package byte cap exceeded')
                f.write(chunk)
                h.update(chunk)
        event('package_complete', bytes=count, sha256=h.hexdigest())
        require(count == expected['bytes'] and h.hexdigest() == expected['sha256'],
                'publisher byte/hash mismatch')
        partial.rename(package)
        package.chmod(0o444)
    finally:
        response.close()
        signal.setitimer(signal.ITIMER_REAL, max(0.001, remaining()))
    run('image-verify', ['/usr/bin/hdiutil', 'verify', str(package)], 45)
    attach_out, _ = run('image-attach', ['/usr/bin/hdiutil', 'attach', str(package),
        '-readonly', '-verify', '-noautoopen', '-mountpoint', str(mountpoint), '-plist'], 45)
    entities = plistlib.loads(attach_out).get('system-entities', [])
    require(sum(e.get('mount-point') == str(mountpoint) for e in entities) == 1 and
            os.path.ismount(mountpoint), 'literal owned mount missing or ambiguous')
    require(bool(os.statvfs(mountpoint).f_flag & os.ST_RDONLY), 'mount is not read-only')
    event('owned_mount', entities=entities, readonly=True)
    app = mountpoint / 'Blender.app'
    require(app.is_dir() and not app.is_symlink(), 'expected owned application absent')
    info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
    event('bundle_identity', fields={k: info.get(k) for k in ['CFBundleName',
          'CFBundleIdentifier', 'CFBundleExecutable', 'CFBundleVersion',
          'CFBundleShortVersionString', 'LSMinimumSystemVersion']})
    require(info.get('CFBundleExecutable') == 'Blender' and
            isinstance(info.get('CFBundleIdentifier'), str), 'bundle executable/identity duty')
    binary = app / 'Contents/MacOS/Blender'
    require(binary.is_file() and os.access(binary, os.X_OK), 'owned executable absent')
    minimum = info.get('LSMinimumSystemVersion')
    require(isinstance(minimum, str) and re.fullmatch(r'\d+(?:\.\d+){0,2}', minimum),
            'missing or ambiguous host minimum')
    require(tuple(map(int, platform.mac_ver()[0].split('.'))) >= tuple(map(int, minimum.split('.'))),
            'host below actual mounted package minimum')
    arch, _ = run('architecture', ['/usr/bin/lipo', '-archs', str(binary)], 15)
    require('arm64' in arch.decode().split(), 'owned binary lacks arm64')
    run('signature-verify', ['/usr/bin/codesign', '--verify', '--deep', '--strict', '--verbose=2', str(app)], 45)
    display_out, display_err = run('signature-identity', ['/usr/bin/codesign', '--display', '--verbose=4', str(app)], 15)
    identity = (display_out + display_err).decode(errors='replace')
    require(('Identifier=' + info['CFBundleIdentifier']) in identity and
            'Authority=Developer ID Application:' in identity and
            re.search(r'^TeamIdentifier=[A-Z0-9]+$', identity, re.M),
            'signed identity/Developer ID duty')
    run('gatekeeper', ['/usr/sbin/spctl', '--assess', '--type', 'execute', '--verbose=4', str(app)], 45)
    env = dict(os.environ)
    removed = []
    for key in list(env):
        if key.startswith(('BLENDER_', 'PYTHON', 'DYLD_')) or key == 'OCIO':
            removed.append(key)
            env.pop(key)
    overrides = {}
    for key, folder in [('BLENDER_USER_RESOURCES', 'resources'),
                        ('BLENDER_USER_CONFIG', 'config'), ('BLENDER_USER_SCRIPTS', 'scripts'),
                        ('BLENDER_USER_EXTENSIONS', 'extensions'), ('BLENDER_USER_DATAFILES', 'datafiles'),
                        ('TMPDIR', 'temp')]:
        d = store / folder
        d.mkdir()
        env[key] = str(d)
        overrides[key] = str(d)
    env['PYTHONNOUSERSITE'] = '1'
    overrides['PYTHONNOUSERSITE'] = '1'
    event('version_environment', removed_names=sorted(removed), overrides=overrides,
          home_and_path_preserved=True, executable_sha256=digest(binary))
    out, err = run('version', [str(binary), '--background', '--disable-autoexec',
                  '--factory-startup', '--offline-mode', '--version'], 15, env=env)
    require(re.search(r'^Blender 5\.2\.2(?:\s|$)', out.decode(errors='replace'), re.M),
            'direct version identity mismatch')
    require(not re.search(r'unknown (?:argument|option)', (out + err).decode(errors='replace'), re.I),
            'version command rejected an option')
    passed = True
except BaseException as exc:
    failure = type(exc).__name__ + ': ' + str(exc)
    event('refusal', reason=failure)
finally:
    signal.setitimer(signal.ITIMER_REAL, 0)
    if active_child is not None:
        stop_child(active_child)
    if owned_store and os.path.ismount(mountpoint):
        try:
            run('image-detach', ['/usr/bin/hdiutil', 'detach', str(mountpoint)], 20, cleanup=True)
            require(not os.path.ismount(mountpoint), 'owned mount remains after detach')
        except BaseException as exc:
            cleanup_ok = False
            event('cleanup_refusal', reason=type(exc).__name__ + ': ' + str(exc),
                  owned_mountpoint=str(mountpoint))
    artifacts = []
    for p in sorted(EVIDENCE.iterdir()):
        if p.is_file() and p.name not in ('OUTCOME.json', 'JOBS.json'):
            artifacts.append({'path':str(p.relative_to(ROOT)), 'bytes':p.stat().st_size,
                              'sha256':digest(p)})
    package_status = {'path':str(package), 'exists':package.exists(),
                      'bytes':package.stat().st_size if package.exists() else None}
    partial_status = {'path':str(partial), 'exists':partial.exists(),
                      'bytes':partial.stat().st_size if partial.exists() else None}
    event('controller_closed', passed=passed, cleanup_ok=cleanup_ok,
          mounted=owned_store and os.path.ismount(mountpoint),
          elapsed_seconds=time.monotonic() - started)
    write('OUTCOME.json', {'closed_utc':utc(), 'decision':'A verified package/version only' if passed and cleanup_ok else 'B stopped',
          'passed':passed, 'cleanup_ok':cleanup_ok, 'failure':failure,
          'package':package_status, 'partial':partial_status, 'artifacts':artifacts,
          'scope':'Original tool bytes retained outside Git. No permanent installation, artist file load, render or appearance qualification.'})
    print(json.dumps({'decision':'A' if passed and cleanup_ok else 'B', 'failure':failure,
                      'cleanup_ok':cleanup_ok, 'package':package_status, 'partial':partial_status}))

raise SystemExit(0 if passed and cleanup_ok else 1)
