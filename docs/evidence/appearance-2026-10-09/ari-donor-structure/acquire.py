"""Acquire exactly two published TEXT sources; never execute or import them."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import signal
import urllib.request

ROOT = Path(__file__).resolve().parent
NOMINEE = ROOT.parent / 'ari-whole-garment-nomination' / 'NOMINATION.json'
STOP = dt.datetime.fromisoformat('2026-10-09T23:42:00+00:00')
CAP = 2 * 1024 * 1024

def utc():
    return dt.datetime.now(dt.timezone.utc)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirect refused; no alternate asset URL admitted')

def timeout(signum, frame):
    raise TimeoutError('60s process cap')

record = {'pid': os.getpid(), 'start': utc().isoformat(), 'requests': [],
          'scope': 'two published text sources, different donor, no import',
          'nomination_sha256': hashlib.sha256(NOMINEE.read_bytes()).hexdigest()}
signal.signal(signal.SIGALRM, timeout)
signal.alarm(60)
try:
    source = json.loads(NOMINEE.read_text())['asset_links_as_published']
    opener = urllib.request.build_opener(NoRedirect())
    for kind in ('mhclo', 'obj'):
        if utc() >= STOP:
            raise TimeoutError('Absolute acquisition stop')
        url = source[kind]
        event = {'kind': kind, 'url': url, 'start': utc().isoformat()}
        record['requests'].append(event)
        with opener.open(urllib.request.Request(url, headers={'User-Agent': 'Sugata-source-audit/1.0'}), timeout=20) as response:
            event.update(status=response.status, final_url=response.geturl(), headers=dict(response.headers))
            if response.status != 200:
                raise ValueError('Non-200 asset response')
            body = response.read(CAP + 1)
        event.update(end=utc().isoformat(), bytes=len(body), sha256=hashlib.sha256(body).hexdigest())
        if len(body) > CAP or utc() >= STOP:
            raise ValueError('Byte/time cap exceeded')
        text = body.decode('utf-8-sig')
        if '\x00' in text or '<html' in text.lower() or '<!doctype html' in text.lower():
            raise ValueError('Not an admitted text asset')
        if kind == 'mhclo':
            lines = text.splitlines()
            if not any(line.strip() == 'verts 0' or line.strip() == 'verts' for line in lines):
                raise ValueError('Body-reference verts section missing')
            obj_names = [line.split(maxsplit=1)[1].strip() for line in lines if line.startswith('obj_file ')]
            if obj_names != ['sr_tight_top_01.obj']:
                raise ValueError('Referenced OBJ does not match published nominee')
        elif not any(line.startswith('v ') for line in text.splitlines()) or not any(line.startswith('f ') for line in text.splitlines()):
            raise ValueError('OBJ vertex/face declarations missing')
        path = ROOT / ('source.' + kind)
        with path.open('xb') as output:
            output.write(body)
        event['saved'] = path.name
        os.chmod(path, 0o444)
    record['outcome'] = 'ACQUIRED_TEXT_ONLY'
except BaseException as exc:
    record.update(outcome='STOPPED', error=type(exc).__name__ + ': ' + str(exc))
finally:
    signal.alarm(0)
    record['end'] = utc().isoformat()
    with (ROOT / 'ACQUISITION.json').open('x') as output:
        json.dump(record, output, indent=2)
        output.write('\n')
print(json.dumps({'outcome': record['outcome'], 'requests': len(record['requests']), 'pid': record['pid']}))
if record['outcome'] != 'ACQUIRED_TEXT_ONLY':
    raise SystemExit(1)
