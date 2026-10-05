"""One externally owned600s invocation; source preparation does not call this module."""
import datetime,hashlib,json,os,pathlib,signal,subprocess,sys
ROOT=pathlib.Path('/Users/robault/GitHub/sugata-avatar')
SOURCE=pathlib.Path(__file__).resolve().parent
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
OWNED=set('JOB.json STDOUT.txt STDERR.txt PARTIAL.json REPORT.json REFUSAL.json METRIC-SCALARS.json METRIC-FRAME.json METRIC-OPERANDS.json EARS-FRONT.json EARS-BACK.json PHYSICAL.json TOPOLOGY-PHYSICAL.json OPENINGS.json SELF-PHYSICAL.json TEST-SOLID.json TOPOLOGY-TEST.json SELF-TEST.json FRAGMENTS.json SOURCE-DOMAIN.json RAY-OPERANDS.json FRAGMENT-CERTIFICATES.jsonl COVERAGE.json sweater.obj'.split())
def owned(p):return p.name in OWNED or (p.name.endswith('.writing') and p.name[:-8] in OWNED)
def pin(p):
    raw=p.read_bytes();return {'path':str(p),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def save(p,x):
    tmp=p.with_name(p.name+'.writing');tmp.write_text(json.dumps(x,indent=2)+'\n');os.replace(tmp,p)
def main(out):
    out=out.resolve()
    if not out.is_relative_to(ROOT/'docs/evidence') or out==SOURCE or not out.is_dir():raise ValueError('isolated preowned trial directory required')
    a=json.loads((out/'ROOT-RUN-ADMISSION.json').read_text())
    if a['decision']!='A sole CPU construction' or a['maximumInvocations']!=1 or a['wallLimitSeconds']!=600:raise ValueError('sole CPU scope absent')
    if datetime.datetime.now(datetime.UTC)>=datetime.datetime.fromisoformat(a['executeBeforeUTC']):raise ValueError('execution admission expired')
    if a['sourceDirectory']!=str(SOURCE) or a['outputDirectory']!=str(out):raise ValueError('source/output scope mismatch')
    for name,key in [('SOURCE-INPUTS.json','sourceManifestSHA256'),('INPUTS.json','inputManifestSHA256')]:
        if pin(SOURCE/name)['sha256']!=a[key]:raise ValueError('admission manifest mismatch')
    for manifest,field in [('SOURCE-INPUTS.json','sources'),('INPUTS.json','inputs')]:
        for row in json.loads((SOURCE/manifest).read_text())[field]:
            p=pathlib.Path(row['path']);p=p if p.is_absolute() else ROOT/p;actual=pin(p)
            if any(actual[k]!=row[k] for k in ('bytes','sha256')):raise ValueError({'stalePin':row,'actual':actual})
    if any((out/n).exists() for n in ('JOB.json','STDOUT.txt','STDERR.txt','REPORT.json','PARTIAL.json','PHYSICAL.json')):raise ValueError('owned trial already attempted')
    run={'runnerPid':os.getpid(),'started':now(),'maximumInvocations':1,'wallLimitSeconds':600,
         'command':[sys.executable,'-B',str(SOURCE/'author.py'),str(out)],'sourceManifest':pin(SOURCE/'SOURCE-INPUTS.json'),'inputs':pin(SOURCE/'INPUTS.json'),'admission':pin(out/'ROOT-RUN-ADMISSION.json'),'status':'launching'}
    with (out/'RUN.json').open('x') as f:json.dump(run,f,indent=2)
    child=None;status='launch-failed'
    try:
        with (out/'STDOUT.txt').open('xb') as stdout,(out/'STDERR.txt').open('xb') as stderr:
            child=subprocess.Popen(run['command'],cwd=ROOT,stdout=stdout,stderr=stderr,start_new_session=True)
            run.update(childPid=child.pid,processGroup=child.pid,status='running',launched=now());save(out/'RUN.json',run)
            try:
                code=child.wait(timeout=600);status='complete' if code==0 else 'refused'
            except subprocess.TimeoutExpired:
                run['timeoutObserved']=now();os.killpg(child.pid,signal.SIGTERM)
                try:code=child.wait(timeout=5)
                except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);code=child.wait(timeout=5)
                status='timeout'
            run['exitCode']=code
    except BaseException as e:
        run['exception']=repr(e)
        if child is not None and child.poll() is None:
            os.killpg(child.pid,signal.SIGTERM)
            try:child.wait(timeout=5)
            except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait(timeout=5)
        status='runner-refused'
    finally:
        run.update(status=status,fullReturn=now(),outputs=[pin(p) for p in sorted(out.iterdir()) if p.is_file() and owned(p)])
        run['unownedFilesAtReturn']=[p.name for p in sorted(out.iterdir()) if p.is_file() and p.name!='RUN.json' and not owned(p)]
        run['inventoryScope']='Only exact produced/partial files bound; unowned journal filenames observed without content claims or mutable return pins'
        save(out/'RUN.json',run)
        print(json.dumps({'status':status,'runnerPid':run['runnerPid'],'childPid':run.get('childPid'),'fullReturn':run['fullReturn'],'outputs':len(run['outputs'])}))
    return 0 if status=='complete' else 1
if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('runner.py requires one isolated trial directory')
    raise SystemExit(main(pathlib.Path(sys.argv[1])))
