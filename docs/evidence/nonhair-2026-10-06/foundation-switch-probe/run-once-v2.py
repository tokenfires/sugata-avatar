# Inert until a separate root gate admits this one-run V2 supervisor.
from pathlib import Path
import subprocess, selectors, os, signal, time, json, hashlib, datetime
leaf=Path(__file__).resolve().parent
assert (leaf/'ROOT-SOURCE-GATE.json').is_file(), 'Root admission required'
gate=json.loads((leaf/'ROOT-SOURCE-GATE.json').read_text())
for row in gate['execution_inputs']:
    raw=Path(row['path']).read_bytes()
    assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'],row['path']
assert not any((leaf/n).exists() for n in ['STDOUT.txt','STDERR.txt','JOB.json']), 'Exclusive first outputs'
argv=['/Users/robault/.brv-cli/bin/node','--max-old-space-size=512',str(leaf/'probe-v2.mjs')]
started=datetime.datetime.now(datetime.timezone.utc).isoformat(); tick=time.monotonic()
child=None; selector=None; returncode=None; reaped=False; reason=None; errors=[]
outputs={'stdout':bytearray(),'stderr':bytearray()}; observed={'stdout':0,'stderr':0}
eof={'stdout':False,'stderr':False}; pipes_closed={}; cap=65536

def error(phase, exc):
    errors.append({'phase':phase,'type':type(exc).__name__,'message':str(exc)})

try:
    child=subprocess.Popen(argv,cwd=leaf.parents[3],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    selector=selectors.DefaultSelector()
    selector.register(child.stdout,selectors.EVENT_READ,'stdout')
    selector.register(child.stderr,selectors.EVENT_READ,'stderr')
    while selector.get_map():
        if time.monotonic()-tick > 20:
            reason='20-second child budget'; break
        capped=False
        for key,_ in selector.select(0.1):
            data=os.read(key.fileobj.fileno(),8192)
            if not data:
                eof[key.data]=True; selector.unregister(key.fileobj); continue
            observed[key.data]+=len(data)
            buffer=outputs[key.data]; remaining=cap-len(buffer); buffer.extend(data[:remaining])
            if len(data)>remaining:
                reason=f'{key.data} 65536-byte cap'; capped=True; break
        if capped: break
except BaseException as exc:
    reason=reason or 'supervision error'; error('spawn-select-read',exc)
finally:
    if child is not None:
        # EOF can precede observable process exit. Give that clean path one bounded wait.
        if reason is None and all(eof.values()):
            try: returncode=child.wait(timeout=2); reaped=True
            except BaseException as exc:
                reason='clean-EOF retirement wait failed'; error('wait-clean-EOF-child',exc)
        if not reaped:
            live=True
            try: live=child.poll() is None
            except BaseException as exc: error('poll-before-retirement',exc)
            if live:
                reason=reason or 'pipes ended before child exit'
                try: os.killpg(child.pid,signal.SIGKILL)
                except BaseException as exc:
                    error('kill-owned-process-group',exc)
                    try: child.kill()
                    except BaseException as fallback: error('kill-owned-child-fallback',fallback)
            try:
                returncode=child.wait(timeout=2); reaped=True
            except BaseException as exc: error('wait-owned-child',exc)
        for name,pipe in [('stdout',child.stdout),('stderr',child.stderr)]:
            try: pipe.close(); pipes_closed[name]=pipe.closed
            except BaseException as exc: pipes_closed[name]=False; error(f'close-{name}',exc)
    if selector is not None:
        try: selector.close()
        except BaseException as exc: error('close-selector',exc)
ended=datetime.datetime.now(datetime.timezone.utc).isoformat()
written={}
for key,name in [('stdout','STDOUT.txt'),('stderr','STDERR.txt')]:
    try:
        with (leaf/name).open('xb') as stream: stream.write(outputs[key])
        written[key]=True
    except BaseException as exc: written[key]=False; error(f'write-{key}',exc)
job={'started_utc':started,'collected_utc':ended,'supervisor_pid':os.getpid(),'child_pid':None if child is None else child.pid,'argv':argv,'cwd':str(leaf.parents[3]),'returncode':returncode,'elapsed_monotonic_seconds':time.monotonic()-tick,'stop_reason':reason,'collected':reaped,'errors':errors,'pipes_closed':pipes_closed,'outputs':{key:{'bytes':len(b),'observed_read_bytes':observed[key],'eof':eof[key],'written':written[key],'sha256':hashlib.sha256(b).hexdigest()} for key,b in outputs.items()},'limits':'One owned CPU child;20s supervision plus at most two2s retirement waits,512MiB V8 heap not totalRSS. Errors may leave child unreaped; captured prefixes and EOF scope reported honestly. Single group kill and only-on-error direct owned-child fallback are cleanup, not a second trial. No renderer/pixels/fit/globalOS/GPU retirement or complete startup performance claim.'}
try:
    with (leaf/'JOB.json').open('x') as stream: json.dump(job,stream,indent=2);stream.write('\n')
except BaseException as exc:
    error('write-job',exc)
print(json.dumps(job,indent=2))
