# One admitted child only. No target is run merely by reviewing this saved source.
from pathlib import Path
import subprocess, selectors, os, signal, time, json, hashlib, datetime
leaf=Path(__file__).resolve().parent
assert (leaf/'ROOT-SOURCE-GATE.json').is_file(), 'Root admission required'
gate=json.loads((leaf/'ROOT-SOURCE-GATE.json').read_text())
for row in gate['execution_inputs']:
    raw=Path(row['path']).read_bytes()
    assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'],row['path']
assert not any((leaf/n).exists() for n in ['STDOUT.txt','STDERR.txt','JOB.json']), 'Exclusive one-run outputs'
argv=['/Users/robault/.brv-cli/bin/node','--max-old-space-size=512',str(leaf/'probe.mjs')]
started=datetime.datetime.now(datetime.timezone.utc).isoformat(); tick=time.monotonic()
child=subprocess.Popen(argv, cwd=leaf.parents[3], stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
selector=selectors.DefaultSelector()
selector.register(child.stdout, selectors.EVENT_READ, 'stdout')
selector.register(child.stderr, selectors.EVENT_READ, 'stderr')
outputs={'stdout':bytearray(),'stderr':bytearray()}; reason=None; cap=65536
try:
    while selector.get_map():
        if time.monotonic()-tick > 20 and reason is None:
            reason='20-second child budget'; os.killpg(child.pid,signal.SIGKILL)
        for key,_ in selector.select(0.1):
            data=os.read(key.fileobj.fileno(),8192)
            if not data:
                selector.unregister(key.fileobj); key.fileobj.close(); continue
            buffer=outputs[key.data]; remaining=cap-len(buffer)
            buffer.extend(data[:remaining])
            if len(data)>remaining and reason is None:
                reason=f'{key.data} 65536-byte cap'; os.killpg(child.pid,signal.SIGKILL)
    returncode=child.wait(timeout=2)
finally:
    selector.close()
    if child.poll() is None:
        os.killpg(child.pid,signal.SIGKILL); child.wait(timeout=2)
    for pipe in [child.stdout,child.stderr]:
        if not pipe.closed: pipe.close()
ended=datetime.datetime.now(datetime.timezone.utc).isoformat()
for key,name in [('stdout','STDOUT.txt'),('stderr','STDERR.txt')]:
    with (leaf/name).open('xb') as f:f.write(outputs[key])
job={'started_utc':started,'collected_utc':ended,'supervisor_pid':os.getpid(),'child_pid':child.pid,'argv':argv,'cwd':str(leaf.parents[3]),'returncode':returncode,'elapsed_monotonic_seconds':time.monotonic()-tick,'stop_reason':reason,'collected':child.poll() is not None,'outputs':{key:{'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for key,b in outputs.items()},'limits':'One local CPU child,512MiB V8 heap bound not totalRSS. Captured pipes distinct; no renderer/pixels/fit or machine-wide retirement claim.'}
with (leaf/'JOB.json').open('x') as f:json.dump(job,f,indent=2);f.write('\n')
print(json.dumps(job,indent=2))
