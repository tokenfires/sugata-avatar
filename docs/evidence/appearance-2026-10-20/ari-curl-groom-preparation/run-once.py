"""Single first invocation with bounded observer, failure ownership and root recovery.
Original curl source is separate; this copies only bounded process ownership mechanics.
"""
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

BASE=Path(__file__).resolve().parent
RUN=BASE/'RUN-STATUS.json'
NODE='/Users/robault/.brv-cli/bin/node'
LIMIT={'main_seconds':50,'total_seconds':60,'rss_bytes':512*1024*1024,
       'output_bytes':24*1024*1024,'file_bytes':16*1024*1024,'log_bytes':256*1024}
ALLOWED={'STATUS.json','CHECKS.json','mesh.json','curves.json','groom.obj','materials.mtl','first-packet.png'}
START=time.monotonic()

class Abort(BaseException):
    def __init__(self,kind):self.kind=kind

def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def elapsed():return time.monotonic()-START
def remaining():return LIMIT['total_seconds']-elapsed()
def guard():
    if elapsed()>=LIMIT['main_seconds']:raise Abort('main-deadline')
def on_signal(sig,frame):raise Abort('signal-'+str(sig))
def sha(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        while True:
            guard();b=f.read(1024*1024)
            if not b:break
            h.update(b)
    return h.hexdigest()
def write_status(record):
    # One write attempt; root owns a fallback receipt if even local status IO fails.
    RUN.write_text(json.dumps(record,indent=2)+'\n')
def output_inventory():
    files=list((BASE/'output').glob('*')) if (BASE/'output').exists() else []
    if any(not p.is_file() or p.name not in ALLOWED or p.stat().st_size>LIMIT['file_bytes'] for p in files):raise Abort('output-file-limit')
    rows=[{'name':p.name,'bytes':p.stat().st_size} for p in files]
    if sum(p['bytes'] for p in rows)>LIMIT['output_bytes']:raise Abort('output-total-limit')
    for name in ['stdout.log','stderr.log']:
        p=BASE/name
        if p.exists() and p.stat().st_size>LIMIT['log_bytes']:raise Abort('log-limit')
    return rows

def main():
    child=None;owned_fuse=False;reaped=False;result=31;state='wrapper-error';peak=0
    events=[];source_lock_sha=None;files=[];status_written=False;child_identity=None
    for sig in [signal.SIGALRM,signal.SIGTERM,signal.SIGINT,signal.SIGHUP]:signal.signal(sig,on_signal)
    signal.setitimer(signal.ITIMER_REAL,max(.01,LIMIT['main_seconds']-elapsed()))
    try:
        # No child before exclusive invocation ownership; a preexisting fuse is untouched.
        try:
            with RUN.open('x') as f:f.write(json.dumps({'UTC':utc(),'wrapperPID':os.getpid(),'state':'preflight'})+'\n')
        except FileExistsError:raise Abort('preexisting-invocation-fuse')
        owned_fuse=True
        lockpath=BASE/'SOURCE-LOCK.json';source_lock_sha=sha(lockpath)
        lock=json.loads(lockpath.read_text())
        for item in lock['runtimeInputs']:
            p=Path(item['path']);guard()
            if p.stat().st_size!=item['bytes'] or str(p.resolve())!=item['resolved'] or sha(p)!=item['sha256']:raise Abort('input-identity')
        if (BASE/'output').exists():raise Abort('preexisting-output')
        with (BASE/'stdout.log').open('xb') as out,(BASE/'stderr.log').open('xb') as err:
            guard()
            child=subprocess.Popen([NODE,'--max-old-space-size=256',str(BASE/'build.mjs')],cwd=BASE,
                stdin=subprocess.DEVNULL,stdout=out,stderr=err,start_new_session=True,
                env={'PATH':'/usr/bin:/bin','LANG':'en_US.UTF-8'})
            child_identity={'pid':child.pid,'processGroup':child.pid,'expectedExecutable':NODE,
                'expectedArgument':str(BASE/'build.mjs'),'bornUTC':utc(),'parentWrapperPID':os.getpid()}
            write_status({'UTC':utc(),'state':'running','wrapperPID':os.getpid(),'childIdentity':child_identity,'sourceLockSHA256':source_lock_sha,'limits':LIMIT})
            while child.poll() is None:
                guard()
                try:ps=subprocess.run(['/bin/ps','-o','rss=','-p',str(child.pid)+','+str(os.getpid())],capture_output=True,text=True,timeout=min(1,max(.01,LIMIT['main_seconds']-elapsed())))
                except subprocess.TimeoutExpired:raise Abort('resource-observer-timeout')
                if ps.returncode==0 and ps.stdout.strip():
                    rss=sum(int(line.strip()) for line in ps.stdout.splitlines() if line.strip())*1024
                    peak=max(peak,rss)
                    if rss>LIMIT['rss_bytes']:raise Abort('rss-limit')
                elif child.poll() is None:raise Abort('resource-observer-failure')
                files=output_inventory();time.sleep(min(.2,max(.001,LIMIT['main_seconds']-elapsed())))
            child.wait(timeout=min(1,max(.01,LIMIT['main_seconds']-elapsed())))
            reaped=True;result=child.returncode
            state='collected-unqualified' if result==0 else 'child-refused' if result==20 else 'child-error'
        files=output_inventory();guard()
        peak=max(peak,resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss+resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        if peak>LIMIT['rss_bytes']:raise Abort('rss-post-exit-limit')
    except Abort as error:
        events.append({'stage':'main','reason':error.kind})
        state='interrupted' if error.kind.startswith('signal-') and error.kind!='signal-'+str(signal.SIGALRM) else 'refused'
        result=1 if error.kind=='preexisting-invocation-fuse' else 21 if error.kind in ['input-identity','preexisting-output'] else 40 if state=='interrupted' else 22
    except BaseException as error:
        events.append({'stage':'main','exception':type(error).__name__,'message':str(error)[:1500]})
        state='wrapper-error';result=31
    finally:
        # Retain a wrapper-wide remaining deadline during bounded teardown and final status.
        # The root's yielded tool session supervises this owner independently; no universal kernel/IO guarantee.
        try:
            signal.setitimer(signal.ITIMER_REAL,max(.01,remaining()))
            if child is not None and not reaped:
                for sig,seconds in [(signal.SIGTERM,1),(signal.SIGKILL,2)]:
                    if child.poll() is None:
                        try:os.killpg(child.pid,sig);events.append({'stage':'cleanup','signal':int(sig)})
                        except ProcessLookupError:events.append({'stage':'cleanup','signal':int(sig),'groupAlreadyGone':True})
                        except OSError as error:events.append({'stage':'cleanup','signal':int(sig),'error':str(error)[:500]})
                    try:
                        child.wait(timeout=min(seconds,max(.01,remaining())));reaped=True;break
                    except subprocess.TimeoutExpired:events.append({'stage':'cleanup','waitTimeoutSeconds':seconds})
                    except (OSError,ChildProcessError) as error:events.append({'stage':'cleanup','waitError':str(error)[:500]})
            if child is not None and not reaped:
                state='unreaped-root-action-required';result=41
        except BaseException as error:
            events.append({'stage':'cleanup','exception':type(error).__name__,'message':getattr(error,'kind',str(error))[:500]})
            state='cleanup-incomplete-root-action-required';result=41
        finally:
            # Even failed teardown reaches a final receipt attempt; never infer reaped from an attempted kill.
            record={'UTC':utc(),'wrapperPID':os.getpid(),'state':state,'exit':result,'limits':LIMIT,
                'elapsedSeconds':elapsed(),'peakCombinedRSSBytes':peak,'childIdentity':child_identity,
                'childExit':child.returncode if child is not None else None,'reaped':reaped if child is not None else True,
                'events':events,'files':files,'sourceLockSHA256':source_lock_sha,
                'limitsNote':'Partial/output images always unqualified. Root must collect actual tool session, verify exact output and whole-view first image with critic. Unknown cleanup/status is failure, not success.'}
            try:
                if owned_fuse:write_status(record);status_written=True
            except BaseException as error:
                result=42;record['exit']=42;record['state']='final-status-failure-root-action-required'
                record['statusException']=type(error).__name__+':'+getattr(error,'kind',str(error))[:500]
            finally:
                signal.setitimer(signal.ITIMER_REAL,0)
                # Tiny tool-visible fallback if the durable receipt write failed or fuse was refused.
                record['statusWritten']=status_written
                try:print(json.dumps(record),flush=True)
                except BaseException:result=42
    return result

if __name__=='__main__':sys.exit(main())
