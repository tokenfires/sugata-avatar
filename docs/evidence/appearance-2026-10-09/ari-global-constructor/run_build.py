"""Own exactly one isolated child; enforce exclusive files and the UTC window."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import signal
import subprocess
import time

HERE=Path(__file__).resolve().parent
config=json.loads((HERE/'EXEC.json').read_text())
now=datetime.datetime.now(datetime.timezone.utc)
start_gate=datetime.datetime.fromisoformat(config['start_before'])
stop_gate=datetime.datetime.fromisoformat(config['stop_before'])
assert now<start_gate and now+datetime.timedelta(seconds=360)<stop_gate,'UTC admission gate'
for name in ('JOB.json','COMPLETE.json','build.log','RESULT.json','geometry.npz'):
    assert not (HERE/name).exists(),name
for row in json.loads((HERE/'EXEC-INPUTS.json').read_text()):
    data=Path(row['path']).read_bytes()
    assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],row['path']
rows=subprocess.check_output(['ps','-axo','pid=,args=']).decode(errors='replace').splitlines()
for row in rows:
    s=row.strip().split(None,1)
    if len(s)<2:continue
    pid=int(s[0]);args=s[1]
    if pid==os.getpid():continue
    executable=args.split()[0]
    relevant_executable=(Path(executable).resolve()==Path(config['python']).resolve()
                         or bool(re.fullmatch(r'python(?:\d+(?:\.\d+)*)?',Path(executable).name,re.I))
                         or Path(executable).name.lower()=='blender')
    assert not ('/sugata-avatar/docs/evidence/' in args and relevant_executable),row

def save(name,obj):
    with (HERE/name).open('x') as f:json.dump(obj,f,indent=2);f.write('\n')

env=os.environ.copy()
env.update({'OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','VECLIB_MAXIMUM_THREADS':'1','PYTHONUNBUFFERED':'1'})
cmd=[config['python'],str(HERE/'build.py')]
timeout=False
with (HERE/'build.log').open('xb') as log:
    launch=datetime.datetime.now(datetime.timezone.utc)
    assert launch<start_gate and launch+datetime.timedelta(seconds=360)<stop_gate,'Fresh pre-Popen UTC gate'
    started=time.monotonic();utc=launch.isoformat()
    child=subprocess.Popen(cmd,cwd=HERE,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    returned=datetime.datetime.now(datetime.timezone.utc)
    job={'utc_start':utc,'wrapper_pid':os.getpid(),'child_pid':child.pid,'owned_process_group':child.pid,
         'command':cmd,'cwd':str(HERE),'seconds':360,'worker_threads':1,'utc_Popen_return':returned.isoformat(),
         'launch_within_UTC_gates':returned<start_gate and returned+datetime.timedelta(seconds=360)<stop_gate}
    try:
        save('JOB.json',job)
        assert job['launch_within_UTC_gates'],'Actual launch gate'
        child.wait(timeout=max(.01,min(360-(time.monotonic()-started), (stop_gate-datetime.datetime.now(datetime.timezone.utc)).total_seconds())))
    except BaseException:
        timeout=True
        try:os.killpg(child.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        child.wait()
        raise
    finally:
        if child.poll() is None:
            os.killpg(child.pid,signal.SIGKILL);child.wait()
        elapsed=time.monotonic()-started
        within_wall=elapsed<=360 and datetime.datetime.now(datetime.timezone.utc)<stop_gate
        save('COMPLETE.json',{**job,'utc_end':datetime.datetime.now(datetime.timezone.utc).isoformat(),
                              'elapsed':elapsed,'exit_code':child.returncode,'timeout_or_interrupt':timeout,
                              'within_total_wall_gate':within_wall,
                              'wrapper_exit_code':child.returncode if within_wall and job['launch_within_UTC_gates'] else 5,
                              'shutdown_policy':'Immediateowned-groupSIGKILL on timeout/interrupt; actualcollectiontime retained, neveroverbudgetPASS',
                              'result_present':(HERE/'RESULT.json').exists(),'geometry_present':(HERE/'geometry.npz').exists()})
print(json.dumps({'exit_code':child.returncode,'elapsed':time.monotonic()-started,'timeout':timeout}))
raise SystemExit(child.returncode if within_wall and job['launch_within_UTC_gates'] else 5)
