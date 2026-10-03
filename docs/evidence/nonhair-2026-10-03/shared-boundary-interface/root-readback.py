"""Independent formal boundary/coefficient and graph readback; no surface evaluation."""
from pathlib import Path
import json,hashlib,datetime,os,collections,math
p=Path('docs/evidence/nonhair-2026-10-03/shared-boundary-interface');start=datetime.datetime.now(datetime.timezone.utc).isoformat();h=lambda q:hashlib.sha256(q.read_bytes()).hexdigest();x=json.loads((p/'interface.json').read_text());old=Path(x['positionSource']['path']);n=json.loads(old.read_text())
assert h(old)==x['positionSource']['sha256']=='ee2808f9c4c2a04d6582beee454786dde2c3303e91430a9f259d1158a4982936'
expected={}
for panel in n['panels'].values():
 for row in panel['nodes']:
  for node in row:expected[node['id']]=node['P']
assert x['nodes']==expected and len(expected)==50
assert x['coordinateFrame']==n['coordinateFrame'] and x['attachment']==n['attachment']
assert len(x['edges'])==89
for e in x['edges'].values():
 assert len(set(e['endpoints']))==2 and all(k in expected for k in e['endpoints']);assert e['localParameter']==[0,1]
 for k in ['M0','M1']:assert len(e[k])==3 and all(math.isfinite(v)for v in e[k])
def endpoint(ref,i):
 e=x['edges'][ref['id']];assert ref['orientation']in [-1,1];return e['endpoints'][i if ref['orientation']==1 else 1-i]
def cancel(terms):
 # Linear polynomial coefficients in the remaining boundary parameter; node symbols abstract vectors.
 d={}
 for symbol,coeff in terms:
  before=d.get(symbol,[0,0]);d[symbol]=[a+b for a,b in zip(before,coeff)]
 return {key:value for key,value in d.items()if value!=[0,0]}
refs=collections.defaultdict(list);reductions=[]
for side,panel in x['panels'].items():
 assert len(panel['patches'])==20
 for q in panel['patches']:
  c=q['corners'];ep={'south':[c['P00'],c['P10']],'north':[c['P01'],c['P11']],'west':[c['P00'],c['P01']],'east':[c['P10'],c['P11']]}
  for name,ends in ep.items():
   assert [endpoint(q[name],0),endpoint(q[name],1)]==ends;refs[q[name]['id']].append({'patch':q['id'],'edge':name,'orientation':q[name]['orientation']})
  # At v=0/1 the actual west/east endpoint symbols cancel the actual bilinear-corner symbols.
  # At u=0/1 the actual south/north endpoint symbols cancel those corner symbols.
  boundaryCases=[('south',[(endpoint(q['west'],0),[1,-1]),(endpoint(q['east'],0),[0,1]),(c['P00'],[-1,1]),(c['P10'],[0,-1])]),('north',[(endpoint(q['west'],1),[1,-1]),(endpoint(q['east'],1),[0,1]),(c['P01'],[-1,1]),(c['P11'],[0,-1])]),('west',[(endpoint(q['south'],0),[1,-1]),(endpoint(q['north'],0),[0,1]),(c['P00'],[-1,1]),(c['P01'],[0,-1])]),('east',[(endpoint(q['south'],1),[1,-1]),(endpoint(q['north'],1),[0,1]),(c['P10'],[-1,1]),(c['P11'],[0,-1])])]
  for name,terms in boundaryCases:
   assert cancel(terms)=={};reductions.append({'patch':q['id'],'boundary':name,'remainingCanonicalCurve':q[name]['id'],'allCornerPolynomialCoefficientsCancel':True})
assert len(reductions)==160 and set(refs)==set(x['edges']) and all(len(r)in [1,2]for r in refs.values())
assert sum(len(r)==2 for r in refs.values())==71 and sum(len(r)==1 for r in refs.values())==18
for r in refs.values():
 if len(r)==2:assert r[0]['orientation']==r[1]['orientation']==1
backId='edge:back-1|part-4';assert x['edges'][backId]['policy']=='new common entire back trace';assert x['edges'][backId]['endpoints']==['part-4','back-1'];assert len(refs[backId])==2
assert abs(x['edges'][backId]['M0'][0]+.018)<1e-14 and x['edges'][backId]['M1'][0]==0
for eid,e in x['edges'].items():
 if e['policy']=='new common entire back trace'and eid!=backId:assert e['M0'][0]==e['M1'][0]==0
r={'pid':os.getpid(),'command':'python3 docs/evidence/nonhair-2026-10-03/shared-boundary-interface/root-readback.py','started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSHA256':h(Path(__file__)),'interfaceSHA256':h(p/'interface.json'),'positionSourceSHA256':h(old),'all50PositionsUnchanged':True,'canonicalEdges':89,'patches':40,'formalBoundaryReductions':reductions,'sharedEdges':71,'outerEdges':18,'firstBackSharedReferences':refs[backId],'firstBackM0':x['edges'][backId]['M0'],'firstBackM1':x['edges'][backId]['M1'],'status':'formal source C0 boundary/endpoint/parameter identity and position/frame provenance passed','limits':['No surface/mesh/regularity/C1/normal/clearance/native/appearance evaluation.','Exact symbolic cancellation plus one canonical function per edge is not bit-exact floating-point/GPU proof.','Actual rigid attachment matrix operands remain future observations.']}
(p/'ROOT-READBACK.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({key:r[key]for key in ['pid','started','finished','sourceSHA256','interfaceSHA256','all50PositionsUnchanged','canonicalEdges','patches','sharedEdges','outerEdges','status']}))
