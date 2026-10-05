"""One separately admitted CPU author. No candidate work occurs at import."""
import array,datetime,hashlib,json,math,os,pathlib,sys,traceback
from fractions import Fraction as Q
import audit
import surface

ROOT=pathlib.Path('/Users/robault/GitHub/sugata-avatar')
SOURCE=pathlib.Path(__file__).resolve().parent
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()

def encoded(x):
    if isinstance(x,Q):return {'n':str(x.numerator),'d':str(x.denominator)}
    if isinstance(x,dict):return {str(k):encoded(v) for k,v in x.items()}
    if isinstance(x,(tuple,list)):return [encoded(v) for v in x]
    if isinstance(x,set):return [encoded(v) for v in sorted(x)]
    return x

def pin(p):
    raw=p.read_bytes();return {'path':str(p),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}

def verify(row):
    p=pathlib.Path(row['path']);p=p if p.is_absolute() else ROOT/p
    actual=pin(p)
    if any(actual[k]!=row[k] for k in ('bytes','sha256')):raise ValueError({'inputPin':row,'actual':actual})
    return p

def admission(out):
    a=json.loads((out/'ROOT-RUN-ADMISSION.json').read_text())
    if a['maximumInvocations']!=1 or a['wallLimitSeconds']!=600 or a['decision']!='A sole CPU construction':raise ValueError('execution scope absent')
    if now()>=a['executeBeforeUTC']:raise ValueError('execution admission expired')
    for name,key in [('SOURCE-INPUTS.json','sourceManifestSHA256'),('INPUTS.json','inputManifestSHA256')]:
        if pin(SOURCE/name)['sha256']!=a[key]:raise ValueError('admission manifest mismatch')
    for row in json.loads((SOURCE/'SOURCE-INPUTS.json').read_text())['sources']:verify(row)
    for row in json.loads((SOURCE/'INPUTS.json').read_text())['inputs']:verify(row)
    return a

def main(out):
    out=out.resolve()
    if not out.is_relative_to(ROOT/'docs/evidence') or out==SOURCE:raise ValueError('isolated execution output required')
    admitted=admission(out)
    job={'pid':os.getpid(),'started':now(),'sourceDirectory':str(SOURCE),'outputDirectory':str(out),'phase':'admitted','admission':admitted}
    # The runner owns RUN.json exclusively; a direct second author cannot own JOB.json.
    with (out/'JOB.json').open('x') as f:json.dump(job,f,indent=2)
    state={'phase':'admitted','status':'running'};gridArrays=None;gridWritten=0;recordWritten=0
    def save(name,data):
        p=out/name;tmp=out/(name+'.writing')
        tmp.write_text(json.dumps(encoded(data),indent=2,allow_nan=False)+'\n');os.replace(tmp,p)
    def phase(name,data=None):
        job['phase']=name;job['updated']=now();save('JOB.json',job)
        state.update(phase=name,utc=job['updated'])
        if data is not None:state['witness']=data
        save('PARTIAL.json',state)
        print(json.dumps({'utc':job['updated'],'phase':name}),flush=True)
    def gridprogress(name,data,values,winners,visits):
        nonlocal gridArrays,gridWritten
        if values is not None:gridArrays=(values,winners,visits)
        phase(name,data);m=data['completedNodes']
        if gridArrays is not None:
            for filename,a in zip(('GRID-VALUES.bin','GRID-WINNERS.bin','GRID-VISITS.bin'),gridArrays):
                mode='xb' if gridWritten==0 and not (out/filename).exists() else 'ab'
                with (out/filename).open(mode) as f:f.write(a[gridWritten:m].tobytes())
            gridWritten=m
        save('GRID.json',dict(data,byteOrder=sys.byteorder,dtypes=['float64','uint32','uint32'],savedPrefix=gridWritten))
    def progress(name,data,*records):
        nonlocal recordWritten
        phase(name,data)
        if name=='ray-operands':save('RAY-OPERANDS.json',data)
        if records:
            rs=records[0]
            with (out/'FRAGMENT-CERTIFICATES.jsonl').open('a') as f:
                for row in rs[recordWritten:]:f.write(json.dumps(encoded(row),separators=(',',':'),allow_nan=False)+'\n')
            recordWritten=len(rs)
    status='refused';report={}
    try:
        phase('load-bound-original-data')
        ledger=json.loads((ROOT/'docs/evidence/appearance-2026-10-04/original-surface-ledger/LEDGER.json').read_text())
        part=json.loads((ROOT/'docs/evidence/appearance-2026-10-04/sweater-coverage-owned/PARTITION.json').read_text())
        artist=json.loads((ROOT/'docs/evidence/appearance-2026-10-04/source-envelope-contract/ARTIST.json').read_text())
        phase('all-required-fragment-kernels')
        fragments,primitives,meta=surface.fragments_and_primitives(ledger,part,artist)
        save('FRAGMENTS.json',fragments);save('PRIMITIVES.json',primitives);save('SOURCE-DOMAIN.json',meta)
        phase('complete-scalar-grid',{'requiredPolygons':len(fragments),'primitives':len(primitives)})
        values,grid=surface.grid_field(primitives,artist,gridprogress)
        phase('shared-tetrahedral-extraction')
        raw=surface.extract(values,grid,artist,progress);save('EXTRACTED.json',raw)
        phase('closed-extraction-topology')
        rawtop,_=audit.topology(raw,True,2,artist);save('EXTRACTED-TOPOLOGY.json',rawtop)
        phase('four-procedural-cuts')
        physical=surface.cut_surface(raw,part['planes'],artist);save('PHYSICAL.json',physical)
        phase('physical-topology')
        top,_=audit.topology(physical,False,-2,artist);save('PHYSICAL-TOPOLOGY.json',top)
        loops=audit.opening_loops(physical,top['boundaryEdges'],artist);save('OPENINGS.json',loops)
        phase('temporary-caps')
        capped=surface.caps(physical,loops,artist);save('TEST-SOLID.json',capped);audit.projected_caps(capped)
        captop,capPoints=audit.topology(capped,True,2,artist);save('TEST-TOPOLOGY.json',captop)
        phase('complete-test-solid-self-intersections')
        _,_,_,selfcheck=audit.self_intersections(capped,capPoints,progress);save('SELF-INTERSECTIONS.json',selfcheck)
        phase('all-required-continuous-clearance-and-enclosure')
        records,summary=audit.full_fragments(fragments,physical,capped,capPoints,artist,progress)
        # Finish the incremental certificate stream, including fewer than100 final rows.
        progress('fragments-complete',summary,records);save('COVERAGE.json',summary)
        phase('export-physical-surface-only')
        with (out/'sweater.obj').open('x') as f:
            f.write('# Fixed source-envelope physical mesh; no temporary caps; metres\n')
            for p in physical['vertices']:f.write('v '+' '.join(format(x,'.17g') for x in p)+'\n')
            for face in physical['faces']:f.write('f '+' '.join(str(i+1) for i in face)+'\n')
        status='complete';report={'scope':'Initial original-source artist mesh; no runtime/fit/motion/appearance acceptance','sourceDomain':meta,'rawTopology':rawtop,'physicalTopology':top,'cappedTopology':captop,'coverage':summary,'maximumInvocations':1}
    except BaseException as e:
        report={'exception':repr(e),'operands':e.args,'traceback':traceback.format_exc(),'failedPhase':job['phase']}
        save('REFUSAL.json',report);traceback.print_exc()
    finally:
        state.update(status=status,ended=now());save('PARTIAL.json',state)
        job.update(status=status,ended=state['ended']);save('JOB.json',job)
        save('REPORT.json',dict(status=status,job=job,report=report))
        print(json.dumps({'status':status,'ended':state['ended'],'phase':job['phase']},allow_nan=False),flush=True)
    return 0 if status=='complete' else 1

if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('author.py requires one isolated output directory')
    raise SystemExit(main(pathlib.Path(sys.argv[1])))
