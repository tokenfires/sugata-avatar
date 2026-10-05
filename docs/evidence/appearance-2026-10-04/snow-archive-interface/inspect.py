"""One owned Snow source-package fetch and nonexecuting bounded ZIP observation."""
import datetime, hashlib, json, os, pathlib, stat, subprocess, sys, time, urllib.parse, urllib.request, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[4]
E = pathlib.Path(__file__).resolve().parent
PLAN = json.loads((E / 'PLAN.json').read_text())
B = PLAN['bounds']
OWN = ROOT / 'assets/vendor/snow-v42'
PART = OWN / 'snow_v42.zip.part'
ZIP = OWN / 'snow_v42.zip'

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def binding(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return {'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': h.hexdigest()}

def save(name, obj):
    with (E / name).open('x') as f:
        f.write(json.dumps(obj, indent=2) + '\n')

def deadline():
    assert datetime.datetime.now(datetime.timezone.utc) < datetime.datetime.fromisoformat(PLAN['stop_utc']), 'slice stop'

class Redirects(urllib.request.HTTPRedirectHandler):
    def __init__(self, events):
        self.events = events
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        u = urllib.parse.urlsplit(newurl)
        allowed = (u.scheme == B['scheme'] and u.hostname in B['redirect_hosts']
                   and u.port in (None, 443) and not u.username and not u.password
                   and len(self.events) < B['redirects'])
        self.events.append({'utc': now(), 'http_status': code, 'host': u.hostname,
                            'scheme': u.scheme, 'path': u.path, 'allowed': allowed})
        if not allowed:
            raise RuntimeError('unadmitted redirect authority or count')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def download():
    started = time.monotonic()
    ledger = {'started_utc': now(), 'pid': os.getpid(), 'url': B['url'], 'redirects': []}
    try:
        deadline()
        opener = urllib.request.build_opener(Redirects(ledger['redirects']))
        req = urllib.request.Request(B['url'], headers={'User-Agent': 'Sugata-source-inspection/1.0', 'Accept': 'application/zip'})
        with opener.open(req, timeout=15) as response:
            ledger.update({'http_status': response.status, 'final_url': response.geturl(),
                           'headers': {k: response.headers.get(k) for k in
                                       ['Content-Type', 'Content-Length', 'ETag', 'Last-Modified', 'Content-Encoding']}})
            assert response.status == 200, 'HTTP status'
            assert response.headers.get('Content-Encoding') in (None, 'identity'), 'content encoding'
            length = response.headers.get('Content-Length')
            if length is not None:
                assert 0 < int(length) <= B['compressed_bytes_max'], 'declared compressed limit'
            size = 0
            with PART.open('xb') as f:
                while chunk := response.read(65536):
                    deadline()
                    assert time.monotonic() - started < B['download_seconds'], 'fetch time'
                    size += len(chunk)
                    assert size <= B['compressed_bytes_max'], 'actual compressed limit'
                    f.write(chunk)
                f.flush()
                os.fsync(f.fileno())
            if length is not None:
                assert size == int(length), 'incomplete response'
            assert size > 0, 'empty response'
        ledger['decision'] = 'complete exact response; ZIP not yet inspected'
    except Exception as err:
        ledger['decision'] = 'refused; no retry'
        ledger['error'] = type(err).__name__ + ': ' + str(err)[:500]
    ledger.update({'completed_utc': now(), 'elapsed_seconds': time.monotonic() - started})
    if PART.exists():
        ledger['partial_or_complete'] = binding(PART)
    save('DOWNLOAD.json', ledger)
    return 0 if ledger['decision'].startswith('complete') else 1

def observe():
    started = time.monotonic()
    out = {'started_utc': now(), 'pid': os.getpid(), 'archive': binding(ZIP),
           'scope': 'ZIP central-directory and bounded source text/12-byte signatures only; no extraction or Blender decoding',
           'entries': [], 'texts': [], 'blend_headers': []}
    try:
        deadline()
        with zipfile.ZipFile(ZIP) as z:
            infos = z.infolist()
            assert 0 < len(infos) <= B['zip_entries_max'], 'entry count'
            assert sum(i.file_size for i in infos) <= B['total_declared_uncompressed_max'], 'declared total'
            seen = set()
            for i in infos:
                name = pathlib.PurePosixPath(i.filename)
                mode = i.external_attr >> 16
                assert i.filename not in seen, 'duplicate names'
                seen.add(i.filename)
                assert not name.is_absolute() and '..' not in name.parts and '\\' not in i.filename and '\x00' not in i.filename, 'entry path'
                assert not (i.flag_bits & 1), 'encrypted entry'
                assert not stat.S_ISLNK(mode), 'symlink entry'
                assert i.file_size <= B['single_entry_declared_max'], 'declared single entry'
                out['entries'].append({'name': i.filename, 'compressed_bytes': i.compress_size,
                                       'declared_bytes': i.file_size, 'crc32': f'{i.CRC:08x}',
                                       'compression_method': i.compress_type, 'external_mode': mode,
                                       'directory': i.is_dir()})
            # Explicit central-directory scope, not testzip or full decompression/CRC verification.
            candidates = [i for i in infos if not i.is_dir() and
                          (pathlib.PurePosixPath(i.filename).suffix.lower() in ('.txt', '.md') or
                           pathlib.PurePosixPath(i.filename).name.lower().startswith(('license', 'readme', 'copying', 'credits')))]
            assert len(candidates) <= B['text_entries_max'], 'text entry count'
            total = 0
            for i in candidates:
                deadline()
                assert i.file_size <= B['text_bytes_each_max'], 'text declared limit'
                with z.open(i) as f:
                    data = f.read(B['text_bytes_each_max'] + 1)
                total += len(data)
                assert len(data) == i.file_size and len(data) <= B['text_bytes_each_max'] and total <= B['text_bytes_total_max'], 'text bytes'
                text = data.decode('utf-8')
                out['texts'].append({'name': i.filename, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'utf8': text,
                                     'whole_entry_read': True})
            blends = [i for i in infos if not i.is_dir() and pathlib.PurePosixPath(i.filename).suffix.lower() == '.blend']
            assert len(blends) <= B['blend_headers_max'], 'blend count'
            for i in blends:
                deadline()
                with z.open(i) as f:
                    data = f.read(B['blend_bytes_each_max'])
                out['blend_headers'].append({'name': i.filename, 'prefix_hex': data.hex(),
                                             'literal_BLENDER': data.startswith(b'BLENDER'),
                                             'whole_entry_read': False})
        out['decision'] = 'bounded inventory complete; no geometry/material/rig/runtime/editability qualification'
    except Exception as err:
        out['decision'] = 'refused bounded inspection; no retry or fallback'
        out['error'] = type(err).__name__ + ': ' + str(err)[:500]
    out.update({'completed_utc': now(), 'elapsed_seconds': time.monotonic() - started})
    save('INVENTORY.json', out)
    return 0 if out['decision'].startswith('bounded inventory complete') else 1

def main():
    deadline()
    for r in PLAN['inputs']:
        assert binding(ROOT / r['path']) == r, 'input drift'
    admission = json.loads((E / 'ADMISSION.json').read_text())
    assert admission['admit'] is True and admission['program'] == binding(pathlib.Path(__file__)), 'no exact admission'
    assert not OWN.exists(), 'source directory already exists'
    OWN.mkdir(parents=True)
    run = {'started_utc': now(), 'wrapper_pid': os.getpid(), 'command': [sys.executable, '-B', str(pathlib.Path(__file__).resolve()), '--download'], 'timeout_seconds': B['download_seconds']}
    start = time.monotonic()
    child = subprocess.Popen(run['command'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    run['child_pid'] = child.pid
    try:
        stdout, stderr = child.communicate(timeout=B['download_seconds'])
        run['returncode'] = child.returncode
        run['timed_out'] = False
    except subprocess.TimeoutExpired:
        child.kill()
        stdout, stderr = child.communicate()
        run['returncode'] = child.returncode
        run['timed_out'] = True
    run.update({'completed_utc': now(), 'elapsed_seconds': time.monotonic() - start,
                'stdout': stdout.decode('utf-8', 'replace'), 'stderr': stderr.decode('utf-8', 'replace')})
    if PART.exists():
        run['retained_response'] = binding(PART)
        PART.chmod(0o444)
    complete = run['returncode'] == 0 and not run['timed_out']
    if complete:
        PART.rename(ZIP)
        run['retained_response'] = binding(ZIP)
    save('RUN.json', run)
    if not complete:
        return 1
    return observe()

if __name__ == '__main__':
    sys.exit(download() if sys.argv[1:] == ['--download'] else main())

