"""One Node actor; observe concrete descendants and bound process lifetime."""
from pathlib import Path
import os, sys, json, hashlib, datetime, time, subprocess, signal, shutil

root=Path.cwd(); packet=root/'docs/evidence/nonhair-2026-10-03/top-control-owned'
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
started=utc(); assert started < '2026-10-03T23:13:00+00:00', 'sole supervisor launch cutoff'
assert not (packet/'supervisor-v1.json').exists() and not (root/'captures/top-control-owned-2026-10-03-v1').exists()
names=('PLAN.md','capture.mjs','view.js','view.html','supervise.py','CRITIC-SOURCE.md','ROOT-PREFLIGHT.json')
pins={n:sha(packet/n) for n in names}
report=dict(pid=os.getpid(),started=started,command='python3 docs/evidence/nonhair-2026-10-03/top-control-owned/supervise.py',
    interpreter=sys.executable,version=sys.version,inputs=pins,owned={},observations=[],status='starting',limits='Concrete observed child ancestry/start identities; group membership recorded separately. No global absence/unobserved-descendant guarantee. Forced termination cannot establish JS disposal.')
out=packet/'supervisor-v1.json'
save=lambda:out.write_text(json.dumps(report,indent=2)+'\n')
save(); child=None; known={}; groups=set(); forced=False; failure=None

def table():
    result=subprocess.run(['ps','-ax','-o','pid=,ppid=,pgid=,lstart=,command='],check=True,capture_output=True,text=True,timeout=3)
    rows={}
    for line in result.stdout.splitlines():
        parts=line.strip().split(None,8)
        if len(parts)!=9:continue
        pid,ppid,pgid=map(int,parts[:3]);rows[pid]=dict(pid=pid,ppid=ppid,pgid=pgid,start=' '.join(parts[3:8]),command=parts[8])
    return rows

def same(row, saved):
    # PPID may change after parent exit; PID/start/command/group must match.
    return all(row[k]==saved[k] for k in ('pid','start','command','pgid'))

def observe():
    rows=table(); owned={child.pid} if child and child.pid in rows else set()
    owned.update(pid for pid,r in known.items() if pid in rows and same(rows[pid],r))
    while True:
        more={pid for pid,r in rows.items() if r['ppid'] in owned}
        if more<=owned:break
        owned.update(more)
    assert 1023 not in owned and os.getpid() not in owned, 'preserved review/supervisor cannot be descendants'
    new=[]
    for pid in sorted(owned):
        row=rows[pid]
        if pid in known:assert same(row,known[pid]),'owned PID/start/command/PGID identity changed'
        else:
            known[pid]={**row,'firstObservedUTC':utc()};new.append(pid)
        if row['pgid']==pid:groups.add(pid)
    report['owned']={str(k):v for k,v in known.items()}
    if new:report['observations'].append(dict(utc=utc(),newIdentities=new,liveOwned=sorted(owned),ownedLeaderGroups=sorted(groups)))
    save();return rows,owned

def stop_owned():
    # Freeze the spawning actor first, then reconcile and stop returned descendants.
    rows,owned=observe()
    if child.pid in owned and same(rows[child.pid],known[child.pid]):os.kill(child.pid,signal.SIGSTOP)
    stable=set()
    for _ in range(8):
        rows,owned=observe()
        for pid in owned:
            if pid in rows and same(rows[pid],known[pid]):
                try:os.kill(pid,signal.SIGSTOP)
                except ProcessLookupError:pass
        if owned==stable:break
        stable=set(owned);time.sleep(.05)
    report['forcedStoppedIdentities']=sorted(owned);save()
    for pid in sorted(owned,key=lambda p:p==child.pid):
        rows=table()
        if pid in rows and same(rows[pid],known[pid]):
            try:os.kill(pid,signal.SIGKILL)
            except ProcessLookupError:pass
    child.wait(timeout=8)

try:
    node=shutil.which('node');assert node,'existing Node required'
    with (packet/'job-v1.log').open('x') as log:
        child=subprocess.Popen([node,str(packet/'capture.mjs')],cwd=root,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        report.update(childPID=child.pid,node=node,status='running',childCommand=[node,str(packet/'capture.mjs')]);save()
        deadline=time.monotonic()+120
        while child.poll() is None:
            observe()
            if time.monotonic()>=deadline:
                forced=True;report['status']='forced-failure';save();stop_owned();break
            time.sleep(.5)
        report['exitCode']=child.wait(timeout=8)
    rows,live=observe()
    survivors=[r for pid,r in rows.items() if pid in known and same(r,known[pid])]
    group_rows=[r for r in rows.values() if r['pgid'] in groups]
    report.update(survivors=survivors,observedGroupRemainders=group_rows,forced=forced)
    assert not forced and report['exitCode']==0,'source/browser actor failed or forced'
    assert not survivors and not group_rows,'observed owned identity/group persists'
    assert any('chrom' in r['command'].lower() for pid,r in known.items() if pid!=child.pid),'actual Chromium descendant ownership must be observed'
    raw=root/'captures/top-control-owned-2026-10-03-v1';native=json.loads((raw/'report.json').read_text())
    assert native['pid']==child.pid and native['status']=='observed' and native['finalPinsUnchanged']
    assert native['cleanup']['pageIsClosed'] and not native['cleanup']['browserIsConnected']
    report['nativeReportSha256']=sha(raw/'report.json');report['status']='observed'
except BaseException as e:
    failure=e;report['failure']=repr(e);report['status']='failed'
finally:
    if child:
        try:
            rows,live=observe()
            # Detached recorded descendants still belong to this job after actor exit.
            if child.poll() is None or live:
                forced=True;stop_owned()
        except BaseException as e:
            forced=True;report['shutdownFailure']=repr(e);failure=failure or e;report['status']='failed'
        finally:
            # Direct Popen ownership survives failed ps/identity observation.
            if child.poll() is None:
                forced=True
                try:child.kill();child.wait(timeout=8);report['directActorFallback']='killed and reaped'
                except BaseException as e:report['directActorFallbackFailure']=repr(e)
    try:
        if child:
            rows,live=observe();report['finalLiveRecordedIdentities']=sorted(live);report['finalObservedGroupMembers']=[r for r in rows.values() if r['pgid'] in groups]
        for n,h in pins.items():assert sha(packet/n)==h,'source/admission pin changed '+n
        assert not forced and not report.get('finalLiveRecordedIdentities') and not report.get('finalObservedGroupMembers'),'forced or unresolved final ownership is failure'
        report['pinsUnchanged']=True
    except BaseException as e:report['finalFailure']=repr(e);failure=failure or e;report['status']='failed'
    report['forced']=forced;report['finished']=utc();save()
    print(json.dumps({'pid':report['pid'],'childPID':report.get('childPID'),'started':started,'finished':report['finished'],'status':report['status'],'exitCode':report.get('exitCode'),'forced':forced,'ownedIdentities':len(known),'reportSha256':sha(out)}))
if failure:raise failure
