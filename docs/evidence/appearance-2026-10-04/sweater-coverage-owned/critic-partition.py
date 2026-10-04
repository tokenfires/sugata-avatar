"""Independent saved-fragment verification. No producer import or clipping rerun."""
from pathlib import Path
from decimal import Decimal, localcontext
import json, hashlib, math, datetime, os, sys, traceback
P=Path(__file__).resolve().parent;R=P.parents[3]
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def read(n):return json.loads((P/n).read_text())
def pin(q):
    b=q.read_bytes();return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def subtract(a,b):return [x-y for x,y in zip(a,b)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dot(a,b):return math.fsum(x*y for x,y in zip(a,b))
def world(poly,points):return [[dot(b,[v[k] for v in points]) for k in range(3)] for b in poly]
def area_vector(vertices):
    if len(vertices)<3:return [0.,0.,0.]
    center=[math.fsum(v[k] for v in vertices)/len(vertices) for k in range(3)]
    terms=[cross(subtract(v,center),subtract(vertices[(j+1)%len(vertices)],center)) for j,v in enumerate(vertices)]
    return [.5*math.fsum(v[k] for v in terms) for k in range(3)]
def distance(plane,point):return dot(plane['normal'],subtract(point,plane['origin']))
job={'pid':os.getpid(),'started':now(),'command':sys.argv,'maximumInvocations':1,
     'method':'Saved barycentric linear inequalities plus 3D centroid-fan area-vector conservation; no clip rerun/import or root checker',
     'currentOwner':None,'currentTriangle':None}
try:
    policy=read('POLICY.json');part=read('PARTITION.json')
    sourcePins=read('SOURCE-INPUTS.json')['sources'];inputPins=read('INPUTS.json')['inputs']
    for q in sourcePins+inputPins:assert pin(R/q['path'])=={k:q[k] for k in ['bytes','sha256']},q['path']
    ledger=json.loads((R/policy['ledger']['path']).read_text());obs=json.loads((R/policy['observations']['path']).read_text())
    assert part['policy']==policy and part['ledgerPin']==pin(R/policy['ledger']['path']) and part['status']=='complete'
    assert part['triangleCount']==71512 and len(part['owners'])==len(ledger['owners'])==9
    planes=part['planes'];assert [p['name'] for p in planes]==policy['planeOrder']
    assert planes[:2]==[{'name':'neck','normal':[0.,-1.,0.],'origin':[0.,policy['neckY'],0.]},{'name':'hem','normal':[0.,1.,0.],'origin':[0.,policy['hemY'],0.]}]
    bones={b['name']:b['world'][12:15] for b in obs['sources'][0]['meshes'][0]['bones']}
    for side,p in zip(['l','r'],planes[2:]):
        h=bones['hand_'+side];a=bones['lowerarm_'+side];v=subtract(h,a);length=math.sqrt(dot(v,v));unit=[x/length for x in v]
        assert p['hand']==h and p['elbow']==a and p['name']=='cuff_'+side
        assert max(abs(x-y) for x,y in zip(p['outward'],unit))<=1e-15
        assert max(abs(x+y) for x,y in zip(p['normal'],unit))<=1e-15
        assert max(abs(x-(h[k]-.015*unit[k])) for k,x in enumerate(p['origin']))<=1e-15
    run=read('RUN.json');child=read('JOB.json')
    assert run['child']==child['pid'] and run['childExit']==0 and not run.get('timeout') and not run.get('error')
    assert child['status']=='complete' and child['policy']==pin(P/'POLICY.json')
    assert json.loads((P/'stdout.txt').read_text())==child and (P/'stderr.txt').read_bytes()==b''
    assert datetime.datetime.fromisoformat(run['returned'])<datetime.datetime.fromisoformat('2026-10-04T23:25:00+00:00')
    for n,m in run['outputs'].items():assert pin(P/n)==m,n
    partial=read('PARTIAL.json');assert partial['owners']==part['owners'] and partial['planes']==planes and partial['policy']==policy
    eps=64*math.ulp(1.0)
    totals={'triangles':0,'fragments':0,'cutTriangles':0,'degenerate':0}
    maxArea=0.;maxAreaVector=0.;maxSide=0.;maxSimplex=0.;maxBarySum=0.;maxTrace=0.;canonical={};summaries=[]
    for src,out in zip(ledger['owners'],part['owners']):
        job['currentOwner']=[src['key'],src['name']]
        assert [out[k] for k in ['key','name','uuid']]==[src[k] for k in ['key','name','uuid']]
        assert out['sourceVertices']==len(src['worldPositions']) and out['sourceTriangles']==len(src['triangles'])
        n=out['sourceTriangles'];records={}
        def add(tid,required,exposed,cut=None):
            assert tid not in records and isinstance(tid,int) and 0<=tid<n
            records[tid]=(required,exposed,cut)
        original=[[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]]
        for tid in out['required']:add(tid,original,[])
        for reason,ids in out['exposed'].items():
            assert reason in policy['planeOrder']
            for tid in ids:add(tid,[],[{'reason':reason,'polygon':original}])
        for cut in out['cut']:add(cut['id'],cut['required'],cut['exposed'],cut)
        for tid in out['degenerate']:add(tid,[],[],{'degenerate':True})
        assert set(records)==set(src['triangleIDs'])==set(range(n))
        if src['key']=='bra':assert len(out['required'])==n and not out['cut'] and not out['degenerate'] and not any(out['exposed'].values())
        if src['key']=='body' and src['name']!='Human':assert len(out['exposed']['neck'])==n
        sourceAreas=[];requiredAreas=[];exposedAreas=[]
        for tid,(required,exposed,cut) in records.items():
            job['currentTriangle']=tid;totals['triangles']+=1
            ids=src['triangles'][tid];points=[src['worldPositions'][i] for i in ids]
            parentVector=[v/2 for v in cross(subtract(points[1],points[0]),subtract(points[2],points[0]))]
            parentArea=math.sqrt(dot(parentVector,parentVector));sourceAreas.append(parentArea)
            if cut and cut.get('degenerate'):
                assert parentArea==0.;totals['degenerate']+=1;continue
            assert parentArea>0. and all(math.isfinite(v) for p in points for v in p)
            ds=[[distance(pl,v) for v in points] for pl in planes]
            fragments=([('required',required)] if required else [])+[(e['reason'],e['polygon']) for e in exposed]
            assert fragments
            if not cut:
                if required:assert all(min(values)>=0. for values in ds)
                else:
                    ix=policy['planeOrder'].index(exposed[0]['reason'])
                    assert all(min(values)>=0. for values in ds[:ix]) and max(ds[ix])<=0. and min(ds[ix])<0.
            vectors=[];ras=[];eas=[]
            for reason,poly in fragments:
                totals['fragments']+=1;assert len(poly)>=3
                for b in poly:
                    assert len(b)==3 and all(math.isfinite(x) for x in b)
                    bs=abs(math.fsum(b)-1.);maxBarySum=max(maxBarySum,bs);assert bs<=policy['barycentricError']
                    sx=max(0.,-min(b),max(b)-1.);maxSimplex=max(maxSimplex,sx);assert sx<=policy['barycentricError']
                    signs=[dot(b,d) for d in ds]
                    relevant=list(range(4)) if reason=='required' else list(range(policy['planeOrder'].index(reason)))
                    violation=max((max(0.,-signs[k]) for k in relevant),default=0.)
                    if reason!='required':violation=max(violation,max(0.,signs[policy['planeOrder'].index(reason)]))
                    maxSide=max(maxSide,violation);assert violation<=eps,(src['name'],tid,reason,signs)
                vertices=world(poly,points);av=area_vector(vertices)
                # 3D vector conservation also checks original winding; unrelated
                # simplex shoelace or the producer's triangle-fan area is not reused.
                assert dot(av,parentVector)>0.,(src['name'],tid,reason)
                area=math.sqrt(dot(av,av));vectors.append(av)
                if reason=='required':ras.append(area)
                else:eas.append(area)
                if cut:
                    for b in poly:
                        zeros=[j for j,x in enumerate(b) if x==0.]
                        if len(zeros)!=1:continue
                        for pi,pl in enumerate(planes):
                            if abs(dot(b,ds[pi]))>eps:continue
                            lo,hi=sorted([j for j in range(3) if j!=zeros[0]],key=lambda j:ids[j])
                            if ds[pi][lo]==ds[pi][hi]:continue
                            if min(ds[pi][lo],ds[pi][hi])>0 or max(ds[pi][lo],ds[pi][hi])<0:continue
                            with localcontext() as ctx:
                                ctx.prec=50
                                def exactSigned(pt):return sum(Decimal.from_float(pl['normal'][k])*(Decimal.from_float(pt[k])-Decimal.from_float(pl['origin'][k])) for k in range(3))
                                dl=exactSigned(points[lo]);dh=exactSigned(points[hi]);tt=float(dl/(dl-dh))
                            assert abs(b[hi]-tt)<=policy['barycentricError']
                            key=(src['uuid'],ids[lo],ids[hi],pl['name']);pos=world([b],points)[0]
                            if key in canonical:assert math.dist(canonical[key]['world'],pos)<=policy['sharedEdgeMetres']
                            else:canonical[key]={'edge':[ids[lo],ids[hi]],'plane':pl['name'],'t':b[hi],'world':pos}
            ra=math.fsum(ras);ea=math.fsum(eas);requiredAreas.append(ra);exposedAreas.append(ea)
            er=abs(parentArea-ra-ea);maxArea=max(maxArea,er);assert er<=policy['areaErrorSquareMetres']
            vectorError=max(abs(parentVector[k]-math.fsum(v[k] for v in vectors)) for k in range(3));maxAreaVector=max(maxAreaVector,vectorError);assert vectorError<=policy['areaErrorSquareMetres']
            if cut:
                totals['cutTriangles']+=1;assert cut['areaError']<=policy['areaErrorSquareMetres']
                for trace in cut['traces']:
                    pi=policy['planeOrder'].index(trace['plane']);assert len(trace['polygon'])>=2
                    for b in trace['polygon']:
                        err=abs(dot(b,ds[pi]));maxTrace=max(maxTrace,err);assert err<=policy['tracePlaneMetres']
        for label,actual in [('source',sourceAreas),('required',requiredAreas),('exposed',exposedAreas)]:
            assert abs(math.fsum(actual)-out['areaSquareMetres'][label])<=1e-10
        summaries.append({'key':src['key'],'name':src['name'],'originalIDs':n,'required':len(out['required']),'exposed':sum(map(len,out['exposed'].values())),'cut':len(out['cut']),'degenerate':len(out['degenerate'])})
    assert totals['triangles']==71512 and totals['cutTriangles']==439 and totals['fragments']==71951 and totals['degenerate']==0
    assert len(canonical)==len(part['sharedEdgeWitnesses'])==446
    assigned=set();maxShared=0.
    for witness in part['sharedEdgeWitnesses']:
        matches=[(key,v) for key,v in canonical.items() if v['edge']==witness['edge'] and v['plane']==witness['plane'] and abs(v['t']-witness['t'])<=policy['barycentricError'] and math.dist(v['world'],witness['world'])<=policy['sharedEdgeMetres']]
        assert len(matches)==1 and matches[0][0] not in assigned,witness
        key,v=matches[0];assigned.add(key);maxShared=max(maxShared,math.dist(v['world'],witness['world']))
    assert assigned==set(canonical) and part['maximumSharedEdgeErrorMetres']==0
    files=['PARTITION.json','PARTIAL.json','WORKSHEET.md','POLICY.json','author.py','runner.py','viewer.mjs','index.html','PLAN.md','INPUTS.json','SOURCE-INPUTS.json','SOURCE-RESULT.md','SOURCE-RECEIPT.json','REPAIR.diff','RUN.json','JOB.json','stdout.txt','stderr.txt','critic-partition.py']
    job.update(status='A complete source-fragment coverage intent only; native readability pending',totals=totals,owners=summaries,maximum3DAreaErrorSquareMetres=maxArea,maximum3DAreaVectorErrorSquareMetres=maxAreaVector,maximumLinearSideViolationMetres=maxSide,sideReplayRoundingBoundMetres=eps,maximumBarycentricSumError=maxBarySum,maximumSimplexViolation=maxSimplex,maximumTracePlaneErrorMetres=maxTrace,sharedOriginalEdges=len(canonical),sharedWitnessOriginalOwnerIdentityUniquelyRecovered=True,maximumSharedReplayErrorMetres=maxShared,bindings={n:pin(P/n) for n in files},allSourcePins=sourcePins,allOriginalPins=inputPins)
    code=0
except Exception as ex:
    job.update(status='B first independent saved-data failure',exception=repr(ex),traceback=traceback.format_exc());code=1
job['completed']=now();(P/'CRITIC-DATA.json').write_text(json.dumps(job,indent=2)+'\n');print(json.dumps(job));sys.exit(code)
