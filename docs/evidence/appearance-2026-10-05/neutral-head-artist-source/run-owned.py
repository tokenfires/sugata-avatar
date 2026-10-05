"""One supervised builder/check run, externally pinned and capped at 120s total."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

BASE=Path(__file__).resolve().parent
PYTHON='/opt/homebrew/opt/python@3.14/bin/python3.14'


def main():
    began=time.monotonic();report=dict(started_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),pid=os.getpid(),jobs=[],decision='B',error=None)
    # The exclusive outer record is acquired even if an inner pin/admission refuses.
    with (BASE/'OUTER.json').open('x') as outer:
        try:
            admission=json.loads((BASE/'CPU-ADMISSION.json').read_text())
            now=datetime.datetime.now(datetime.timezone.utc)
            if now>=datetime.datetime.fromisoformat(admission['nomination_stop_utc'].replace('Z','+00:00')):
                raise ValueError('CPU admission cutoff expired')
            if admission['decision']!='A one unchanged supervised CPU attempt only':raise ValueError('wrong admission')
            report['admission_sha256']=hashlib.sha256((BASE/'CPU-ADMISSION.json').read_bytes()).hexdigest()
            for row in admission['bindings']:
                b=(BASE/row['path']).read_bytes()
                if len(b)!=row['bytes'] or hashlib.sha256(b).hexdigest()!=row['sha256']:raise ValueError(('changed inert input',row['path']))
            if (BASE/'output').exists():raise ValueError('output already exists; no replay')
            for script in ['build.py','check-owned.py']:
                remaining=120-(time.monotonic()-began)
                if remaining<=0:raise TimeoutError('shared 120 second cap')
                job=dict(script=script,argv=[PYTHON,'-B',str(BASE/script)],started_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
                report['jobs'].append(job)
                with (BASE/(script+'.stdout.txt')).open('xb') as out,(BASE/(script+'.stderr.txt')).open('xb') as err:
                    child=subprocess.Popen(job['argv'],stdout=out,stderr=err,cwd=BASE)
                    job['pid']=child.pid
                    try:job['exit_code']=child.wait(timeout=remaining)
                    except subprocess.TimeoutExpired:
                        child.kill();job['exit_code']=child.wait();job['timeout']=True
                        raise TimeoutError(('job timed out and reaped',script))
                    finally:job['collected_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
                if job['exit_code']!=0:raise ValueError(('first inner refusal',script,job['exit_code']))
            report['decision']='A CPU collected; no native/appearance admission'
        except Exception as error:report['error']=dict(type=type(error).__name__,witness=str(error))
        finally:
            report['elapsed_seconds']=time.monotonic()-began
            report['collected_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
            json.dump(report,outer,indent=2);outer.write('\n');outer.flush();os.fsync(outer.fileno())
    print(json.dumps(report))
    return 0 if report['decision'].startswith('A') else 2


if __name__=='__main__':
    raise SystemExit(main())
