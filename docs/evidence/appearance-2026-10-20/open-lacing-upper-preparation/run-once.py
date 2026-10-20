"""Root-owned single invocation, resource guard and child collection. Inert until admitted."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import resource
import signal
import subprocess
import sys
import time

BASE = Path(__file__).resolve().parent
LOCK = BASE / 'SOURCE-LOCK.json'
RUN = BASE / 'RUN-STATUS.json'
NODE = '/Users/robault/.brv-cli/bin/node'
LIMIT = {'wall_seconds': 60, 'rss_bytes': 512*1024*1024,
         'output_bytes': 16*1024*1024, 'file_bytes': 8*1024*1024,
         'log_bytes': 256*1024}
ALLOWED = {'STATUS.json','CHECKS.json','mesh.json','boot.obj','materials.mtl','first-packet.png'}

def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):
    with Path(p).open('rb') as f: return hashlib.file_digest(f,'sha256').hexdigest()
def save(state, **values):
    RUN.write_text(json.dumps({'UTC': now(), 'wrapperPID': os.getpid(), 'state':state,
                              'limits':LIMIT, **values},indent=2)+'\n')

def main():
    start=time.monotonic()
    # Exclusive receipt is an invocation fuse: do not delete it to retry.
    with RUN.open('x') as f: f.write(json.dumps({'state':'preflight','UTC':now()})+'\n')
    lock=json.loads(LOCK.read_text())
    for item in lock['runtimeInputs']:
        p=Path(item['path'])
        if p.stat().st_size!=item['bytes'] or sha(p)!=item['sha256']:
            save('input-refused',input=str(p));return 21
    if (BASE/'output').exists():save('output-refused');return 21
    stdout=BASE/'stdout.log';stderr=BASE/'stderr.log'
    peak=0;reason=None;child=None
    try:
        with stdout.open('xb') as out,stderr.open('xb') as err:
            child=subprocess.Popen([NODE,'--max-old-space-size=256',str(BASE/'build.mjs')],cwd=BASE,
                                   stdin=subprocess.DEVNULL,stdout=out,stderr=err,start_new_session=True,
                                   env={'PATH':'/usr/bin:/bin','LANG':'en_US.UTF-8'})
            save('running',childPID=child.pid,startedUTC=now(),sourceLockSHA256=sha(LOCK))
            while child.poll() is None:
                if time.monotonic()-start>LIMIT['wall_seconds']:reason='wall-limit';break
                ps=subprocess.run(['/bin/ps','-o','rss=','-p',str(child.pid)+','+str(os.getpid())],capture_output=True,text=True)
                if ps.returncode==0 and ps.stdout.strip():
                    rss=sum(int(line.strip()) for line in ps.stdout.splitlines() if line.strip())*1024;peak=max(peak,rss)
                    if rss>LIMIT['rss_bytes']:reason='rss-limit';break
                elif child.poll() is None:reason='resource-observer-failure';break
                files=list((BASE/'output').glob('*')) if (BASE/'output').exists() else []
                if any(not p.is_file() or p.name not in ALLOWED or p.stat().st_size>LIMIT['file_bytes'] for p in files):reason='output-file-limit';break
                if sum(p.stat().st_size for p in files)>LIMIT['output_bytes']:reason='output-total-limit';break
                if stdout.stat().st_size>LIMIT['log_bytes'] or stderr.stat().st_size>LIMIT['log_bytes']:reason='log-limit';break
                time.sleep(.2)
            if reason:
                try:os.killpg(child.pid,signal.SIGTERM)
                except ProcessLookupError:pass
                try:child.wait(timeout=2)
                except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait(timeout=2)
            else:child.wait(timeout=2)
        elapsed=time.monotonic()-start
        # On Darwin ru_maxrss is bytes; the ps samples areKiB. No portability claim.
        peak=max(peak,resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss+resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        if not reason and peak>LIMIT['rss_bytes']:reason='rss-post-exit-limit'
        if not reason and elapsed>LIMIT['wall_seconds']:reason='wall-post-exit-limit'
        files=list((BASE/'output').glob('*')) if (BASE/'output').exists() else []
        if not reason and (any(not p.is_file() or p.name not in ALLOWED or p.stat().st_size>LIMIT['file_bytes'] for p in files) or sum(p.stat().st_size for p in files)>LIMIT['output_bytes']):reason='output-post-exit-limit'
        if not reason and (stdout.stat().st_size>LIMIT['log_bytes'] or stderr.stat().st_size>LIMIT['log_bytes']):reason='log-post-exit-limit'
        save('resource-refused' if reason else 'collected',childPID=child.pid,childExit=child.returncode,
             elapsedSeconds=elapsed,peakRSSBytes=peak,reason=reason,reaped=child.poll() is not None,
             files=[{'name':p.name,'bytes':p.stat().st_size,'sha256':sha(p)} for p in files],
             sourceLockSHA256=sha(LOCK),limitsNote='Collected output is unqualified until root and critic see the fixed actual image. Partial files retained after failure, no retry.')
        return 22 if reason else child.returncode
    except BaseException as error:
        if child and child.poll() is None:
            os.killpg(child.pid,signal.SIGKILL);child.wait(timeout=2)
        save('wrapper-error',message=str(error),childPID=child.pid if child else None,reaped=not child or child.poll() is not None)
        return 31

if __name__=='__main__':sys.exit(main())
