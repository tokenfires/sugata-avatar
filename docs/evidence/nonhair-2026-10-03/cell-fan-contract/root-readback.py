"""Independent actual symbolic definitions/face/link audit. No coordinates or evaluator."""
from pathlib import Path
import json,hashlib,datetime,os,collections
p=Path('docs/evidence/nonhair-2026-10-03/cell-fan-contract');start=datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
authorReceipt=json.loads((p/'AUTHOR-RECEIPT.json').read_text());assert sha(p/'author.py')==authorReceipt['authorSHA256']=='9c042becbab1312a2589fedb349a49f771194b736c55f109121cb67bcc219fe8'
assert sha(p/'topology.json')==authorReceipt['topologySHA256']=='c057cc38b0e6cca4eb6d1d955f31b4b5263daf01260bfb65a21c218e93b4eeeb'
for name,h in authorReceipt['pins'].items():assert sha(Path(name))==h,name
x=json.loads((p/'topology.json').read_text());s=json.loads(Path(x['sourceInterface']['path']).read_text());assert x['sourceInterface']['sha256']==sha(Path(x['sourceInterface']['path']));assert x['N']==10
V=x['vertices'];F=x['faces'];keys={v['key']:i for i,v in enumerate(V)};assert len(V)==len(keys)==8091 and len(F)==16000
counts=collections.Counter();allowed=set()
for eid,e in s['edges'].items():
 expected=[]
 for k in range(11):
  if k in[0,10]:node=e['endpoints'][0 if k==0 else 1];key='node:'+node;rule={'kind':'canonicalNode','node':node}
  else:key=eid+':'+str(k);rule={'kind':'canonicalCurve','edge':eid,'t':[k,10]}
  assert key in keys and V[keys[key]]['evaluation']==rule;expected.append(keys[key]);allowed.add(key)
 assert x['canonicalEdgeCache'][eid]==expected
assert set(x['canonicalEdgeCache'])==set(s['edges'])and len(allowed)==851
ordinal=0;centres=[];cornerWitness=[]
for side,panel in s['panels'].items():
 for sourcePatch in panel['patches']:
  q=x['patches'][ordinal];assert q['id']==sourcePatch['id']and q['side']==side and q['orientation']==panel['futureOrientationSign'];ordinal+=1
  assert len(q['grid'])==11 and all(len(row)==11 for row in q['grid'])and len(q['centres'])==10 and all(len(row)==10 for row in q['centres'])
  for j in range(11):
   for i in range(11):
    index=q['grid'][j][i];boundary=[]
    for condition,name,k in[(j==0,'south',i),(j==10,'north',i),(i==0,'west',j),(i==10,'east',j)]:
     if condition:
      ref=sourcePatch[name];boundary.append(x['canonicalEdgeCache'][ref['id']][k if ref['orientation']==1 else 10-k])
    if boundary:assert all(t==index for t in boundary)
    else:key=q['id']+':'+str(j)+':'+str(i);assert index==keys[key]and V[index]['evaluation']=={'kind':'CoonsPatch','patch':q['id'],'u':[i,10],'v':[j,10]};allowed.add(key)
  for j in range(10):
   for i in range(10):
    m=q['centres'][j][i];key='centre:'+q['id']+':'+str(j)+':'+str(i);assert m==keys[key]and V[m]['evaluation']=={'kind':'CoonsCellCentre','patch':q['id'],'cell':[j,i],'u':[2*i+1,20],'v':[2*j+1,20]};allowed.add(key);centres.append(m)
    corners=[q['grid'][j][i],q['grid'][j][i+1],q['grid'][j+1][i+1],q['grid'][j+1][i]];expected=[]
    for k in range(4):
     left,right=corners[k],corners[(k+1)%4];expected.append([left,right,m]if q['orientation']==1 else[left,m,right])
    offset=(ordinal-1)*400+j*40+i*4;assert F[offset:offset+4]==expected
    if q['id']in['minusX:0:3','plusX:0:3']and j==0 and i==9:cornerWitness.append({'patch':q['id'],'centre':m,'centreKey':key,'firstFace':offset,'faces':expected})
assert ordinal==40 and len(allowed)==8091 and set(keys)==allowed and len(set(centres))==4000
for v in V:counts[v['evaluation']['kind']]+=1
assert counts=={'canonicalNode':50,'canonicalCurve':801,'CoonsPatch':3240,'CoonsCellCentre':4000}
edgeUse=collections.defaultdict(list);link=collections.defaultdict(list);complexAdj=collections.defaultdict(set);faceKeys=set();centreIncidence=collections.Counter();centreSet=set(centres)
for f in F:
 assert len(f)==3 and len(set(f))==3 and all(type(v)is int and 0<=v<8091 for v in f);key=tuple(sorted(f));assert key not in faceKeys;faceKeys.add(key);owned=centreSet.intersection(f);assert len(owned)==1;centreIncidence[next(iter(owned))]+=1
 for j in range(3):
  v,w=f[j],f[(j+1)%3];edgeUse[tuple(sorted([v,w]))].append((v,w));complexAdj[v].add(w);complexAdj[w].add(v);link[v].append(tuple(sorted([f[(j+1)%3],f[(j+2)%3]])))
assert set(centreIncidence)==centreSet and set(centreIncidence.values())=={4}
boundaryAdj=collections.defaultdict(set)
for e,use in edgeUse.items():
 assert len(use)==1 or(len(use)==2 and use[0]==use[1][::-1])
 if len(use)==1:boundaryAdj[e[0]].add(e[1]);boundaryAdj[e[1]].add(e[0])
def component(adj,seed):
 known={seed};frontier=[seed]
 while frontier:
  for v in adj[frontier.pop()]:
   if v not in known:known.add(v);frontier.append(v)
 return known
assert len(edgeUse)==24090 and 8091-24090+16000==1 and len(component(complexAdj,0))==8091
assert len(boundaryAdj)==180 and all(len(v)==2 for v in boundaryAdj.values())and len(component(boundaryAdj,next(iter(boundaryAdj))))==180
summary=collections.Counter()
for v,elist in link.items():
 assert len(elist)==len(set(elist));adj=collections.defaultdict(set)
 for a,b in elist:adj[a].add(b);adj[b].add(a)
 assert len(component(adj,next(iter(adj))))==len(adj);degree=collections.Counter(map(len,adj.values()))
 if v in boundaryAdj:assert degree[1]==2 and set(degree)<={1,2};summary['boundaryPaths']+=1
 else:assert set(degree)=={2};summary['interiorCycles']+=1
assert summary=={'boundaryPaths':180,'interiorCycles':7911}and cornerWitness[0]['centre']!=cornerWitness[1]['centre']
r={'pid':os.getpid(),'command':'python3 docs/evidence/nonhair-2026-10-03/cell-fan-contract/root-readback.py','started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSHA256':sha(Path(__file__)),'topologySHA256':sha(p/'topology.json'),'pinsUnchanged':len(authorReceipt['pins']),'allDefinitionsCachesGridCentresAnd16000FacesExact':True,'definitionKinds':dict(counts),'edges':len(edgeUse),'links':dict(summary),'cornerWitness':cornerWitness,'status':'complete symbolic oriented disk/cell-owned fan and evaluator declarations qualified; no geometry/appearance','limits':['No numeric positions/curves/Coons/evaluator/area/normal/body/contact/attachment/native evaluation.','Logical manifold cannot establish regular or nonintersecting embedded geometry, moving fit or rendered quality.']}
(p/'ROOT-READBACK.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
