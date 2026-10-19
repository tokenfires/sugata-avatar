"""One admitted CPU child, capped pipes and bounded retirement; no geometry here."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import time

P = Path(__file__).resolve().parent
now = lambda: datetime.datetime.now(datetime.timezone.utc)
sha = lambda b: hashlib.sha256(b).hexdigest()


def save(name, value):
    raw = (json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
    if len(raw) > 65536:
        raise ValueError('collector metadata cap')
    with (P/name).open('xb') as stream:
        stream.write(raw)


def final_evidence(collected, names, errors, root=None):
    """Inspect finalized child output only; keep independent size duties separate."""
    root = P if root is None else root
    result = None
    result_state = 'withheld_uncollected'
    if collected:
        try:
            with (root/'RESULT.json').open('rb') as stream:
                raw = stream.read(8126465)
            if len(raw) > 8126464:
                raise ValueError('result inspection cap')
            result = {'bytes':len(raw), 'sha256':sha(raw)}
            result_state = 'finalized_read'
        except BaseException as error:
            result_state = 'inspection_error'
            errors.append({'phase':'result_inspection','type':type(error).__name__,
                           'message':str(error)[:1024]})
    sizes = {}; total = 0; complete = True
    for name in names:
        if name == 'RESULT.json' and not collected:
            sizes[name] = {'state':'withheld_uncollected'}
            complete = False
            continue
        try:
            size = (root/name).stat().st_size
            if size < 0:
                raise ValueError('negative output size')
            sizes[name] = {'state':'observed','bytes':size}; total += size
        except FileNotFoundError:
            sizes[name] = {'state':'absent'}
        except BaseException as error:
            complete = False; sizes[name] = {'state':'stat_error'}
            errors.append({'phase':'stat_'+name,'type':type(error).__name__,
                           'message':str(error)[:1024]})
    return {'result':result,'result_state':result_state,'sizes':sizes,
            'observed_bytes':total,'sizes_complete':complete}


def persist_job(job):
    """Always attempt the receipt; return persistence failure literally."""
    try:
        save('JOB.json',job)
    except BaseException as error:
        job['errors'].append({'phase':'write_JOB','type':type(error).__name__,
                              'message':str(error)[:1024]})
        job['receipt_written'] = False
        return False
    job['receipt_written'] = True  # Terminal status; disk write succeeded first.
    return True


def main():
    config_raw = (P/'CONFIG.json').read_bytes(); config = json.loads(config_raw)
    admission = json.loads((P/'ADMISSION.json').read_bytes())
    if admission['execution_admitted'] is not True or admission['config_sha256'] != sha(config_raw):
        raise ValueError('fresh root admission required')
    for name in ('SOURCE-PREFLIGHT.md','SOURCE-PREFLIGHT-RECEIPT.json'):
        row = admission['source_review'][name]
        raw = (P/name).read_bytes()
        if len(raw) != row['bytes'] or sha(raw) != row['sha256']:
            raise ValueError('independent source review binding: '+name)
    if not admission['scoped_jobs_absent'] or not 0 <= (now()-datetime.datetime.fromisoformat(admission['utc'])).total_seconds() <= 180:
        raise ValueError('stale or occupied admission')
    if str(Path(sys.executable).resolve()) != config['python']:
        raise ValueError('collector interpreter')
    for row in config['pins']:
        raw = Path(row['path']).read_bytes()
        if len(raw) != row['bytes'] or sha(raw) != row['sha256']:
            raise ValueError('input pin: ' + row['path'])
    if any((P/name).exists() for name in config['first_outputs']):
        raise ValueError('exclusive first outputs')
    if now() >= datetime.datetime.fromisoformat(config['launch_before']):
        raise ValueError('launch cutoff')
    child = None; selector = None; tick = time.monotonic(); started = now()
    collected = False; code = None; reason = None; errors = []
    buffers = {'stdout':bytearray(), 'stderr':bytearray()}
    observed = {'stdout':0, 'stderr':0}; eof = {'stdout':False, 'stderr':False}; closed = {}
    def interrupted(signum, frame):
        raise InterruptedError('collector signal %s' % signum)
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, interrupted)
    try:
        child = subprocess.Popen([config['python'],str(P/'worker.py')],cwd=P,
                                 stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        spawn_return = now()
        save('JOB-start.json',{'collector_pid':os.getpid(),'child_pid':child.pid,'pgid':child.pid,
                              'started_utc':started.isoformat(),'spawn_return_utc':spawn_return.isoformat()})
        if spawn_return >= datetime.datetime.fromisoformat(config['launch_before']):
            reason = 'spawn-return cutoff'
        selector = selectors.DefaultSelector()
        selector.register(child.stdout,selectors.EVENT_READ,'stdout')
        selector.register(child.stderr,selectors.EVENT_READ,'stderr')
        while selector.get_map() and reason is None:
            if time.monotonic()-tick > 120:
                reason = '120-second parent wall cap'; break
            if now() >= datetime.datetime.fromisoformat(config['finish_before']):
                reason = 'absolute finish cutoff'; break
            for key,_ in selector.select(0.1):
                data = os.read(key.fileobj.fileno(),8192)
                if not data:
                    eof[key.data] = True; selector.unregister(key.fileobj); continue
                observed[key.data] += len(data)
                room = 65536-len(buffers[key.data]); buffers[key.data].extend(data[:room])
                if len(data) > room:
                    reason = key.data+' pipe cap'; break
    except BaseException as error:
        reason = reason or 'collector interruption/error'
        errors.append({'phase':'collect','type':type(error).__name__,'message':str(error)})
    finally:
        if child is not None:
            if reason is None and all(eof.values()):
                try:
                    code = child.wait(timeout=2); collected = True
                except BaseException as error:
                    reason = 'clean EOF wait failed'
                    errors.append({'phase':'wait_clean','type':type(error).__name__,'message':str(error)})
            if not collected:
                try:
                    alive = child.poll() is None
                except BaseException as error:
                    alive = True; errors.append({'phase':'poll','type':type(error).__name__,'message':str(error)})
                if alive:
                    try:
                        os.killpg(child.pid,signal.SIGKILL)
                    except BaseException as error:
                        errors.append({'phase':'kill_group','type':type(error).__name__,'message':str(error)})
                        try:
                            child.kill()
                        except BaseException as fallback:
                            errors.append({'phase':'kill_child','type':type(fallback).__name__,'message':str(fallback)})
                try:
                    code = child.wait(timeout=2); collected = True
                except BaseException as error:
                    errors.append({'phase':'wait_owned','type':type(error).__name__,'message':str(error)})
            for key,pipe in [('stdout',child.stdout),('stderr',child.stderr)]:
                try:
                    pipe.close(); closed[key] = pipe.closed
                except BaseException as error:
                    closed[key] = False; errors.append({'phase':'close_'+key,'type':type(error).__name__,'message':str(error)})
        if selector is not None:
            try:
                selector.close()
            except BaseException as error:
                errors.append({'phase':'selector_close','type':type(error).__name__,'message':str(error)})
    streams = {}
    for key,name in [('stdout','STDOUT.txt'),('stderr','STDERR.txt')]:
        written = False
        try:
            with (P/name).open('xb') as stream:
                stream.write(buffers[key]); written = True
        except BaseException as error:
            errors.append({'phase':'write_'+key,'type':type(error).__name__,'message':str(error)})
        streams[key] = {'bytes':len(buffers[key]),'observed_read_bytes':observed[key],
                        'sha256':sha(buffers[key]),'eof':eof[key],'closed':closed.get(key,False),'written':written}
    evidence = final_evidence(collected, config['first_outputs'], errors)
    if not evidence['sizes_complete']:
        reason = reason or 'incomplete final size evidence'
    if evidence['observed_bytes']+65536 > 8388608:
        reason = reason or 'aggregate output cap'
    job = {'collector_pid':os.getpid(),'child_pid':None if child is None else child.pid,
           'started_utc':started.isoformat(),'collected_utc':now().isoformat(),
           'elapsed_seconds':time.monotonic()-tick,'returncode':code,'collected':collected,
           'reason':reason,'errors':errors,'streams':streams,
           'result':evidence['result'],'result_state':evidence['result_state'],
           'output_bytes_before_JOB':evidence['observed_bytes'],
           'output_sizes_complete':evidence['sizes_complete'],'output_sizes':evidence['sizes'],
           'scope':'One CPU child;120s collection plus at most two2s retirement waits. Prefixes/EOF/retirement reported literally; no unconditional OS/GPU or hard instantaneous RSS guarantee.'}
    written = persist_job(job)
    print(json.dumps(job))
    return 0 if written and code == 0 and collected and reason is None and not errors and all(eof.values()) else 1


if __name__ == '__main__':
    sys.exit(main())
