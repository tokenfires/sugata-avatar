"""Independent frozen-array topology/adjacency/box readback; no diagnostic rerun."""
from pathlib import Path
from array import array
import zipfile,struct,ast,hashlib,json,math,collections,datetime
P=Path(__file__).resolve().parent;plan=json.loads((P/'EXEC-PLAN.json').read_text());r=json.loads((P/'RESULT.json').read_text());job=json.loads((P/'JOB.json').read_text());old=json.loads(Path(plan['result']).read_text())
def read(z,n):
 b=z.read(n+'.npy');start=10 if b[6]==1 else 12;size=struct.unpack('<H' if start==10 else '<I',b[8:start])[0];h=ast.literal_eval(b[start:start+size].decode().strip());assert not h['fortran_order'];a=array({'<f4':'f','<i4':'i'}[h['descr']]);a.frombytes(b[start+size:]);assert len(a)==math.prod(h['shape']);return a,h['shape'],hashlib.sha256(b[start+size:]).hexdigest()
def pos(a,i):return list(a[3*i:3*i+3])
with zipfile.ZipFile(plan['groom']) as z:g,gs,h=read(z,'AriOriginalCurls_world');assert h==old['render_geometry']['AriOriginalCurls']['world_sha256'];edges,es,h=read(z,'AriOriginalCurls_edges');assert h==old['render_geometry']['AriOriginalCurls']['edges_sha256']
with zipfile.ZipFile(plan['skin']) as z:b,bs,h=read(z,'Human_world');assert h==old['skin_geometry']['Human']['world_sha256'];tri,ts,h=read(z,'Human_triangles');assert h==old['skin_geometry']['Human']['triangles_sha256']
actual=[(i,list(edges[i*2:i*2+2])) for i in range(es[0]) if 1872 in edges[i*2:i*2+2]];assert actual==[(e['edge'],e['vertices']) for e in r['incident_edges']]
parents=list(range(bs[0]))
def find(i):
 while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
 return i
inc=collections.Counter();direction=collections.Counter();used=set();boxes=[]
for k in range(ts[0]):
 ids=list(tri[k*3:k*3+3]);assert len(set(ids))==3 and all(0<=v<bs[0] for v in ids);used.update(ids)
 for i,j in zip(ids,ids[1:]+ids[:1]):
  key=(min(i,j),max(i,j));inc[key]+=1;direction[key]+=1 if i<j else -1;parents[find(i)]=find(j)
 xyz=[pos(b,v) for v in ids];boxes.append(([min(p[d] for p in xyz) for d in range(3)],[max(p[d] for p in xyz) for d in range(3)]))
assert len(inc)==40134 and all(v==2 for v in inc.values()) and all(v==0 for v in direction.values());assert len({find(i) for i in used})==1 and len(used)==13380
box_candidates=0;lengths=[]
for e in r['incident_edges']:
 start,end=[pos(g,v) for v in e['vertices']];assert start==e['start'] and end==e['end'];lengths.append(math.dist(start,end))
 for lo,hi in boxes:
  if all(max(start[d],end[d])+1e-8>=lo[d] and min(start[d],end[d])-1e-8<=hi[d] for d in range(3)):box_candidates+=1
assert box_candidates==0 and r['pairs_tested']==0 and r['proper_hit'] is None and not r['ambiguities'];assert r['completed'] and job['exit_code']==0 and not job['timed_out']
summary=json.loads((P/'query.log').read_text());assert summary=={k:v for k,v in r.items() if k not in ['checks','incident_edges','ambiguities','proper_hit']}
for row in plan['pins']:
 raw=Path(row['path']).read_bytes();assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']
x={'checked_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'independent_vertex_union_topology':{'used_vertices':len(used),'triangles':ts[0],'edges':len(inc),'two_opposite_incidence':True,'one_component':True},'actual_incident_edges':actual,'edge_lengths_m':lengths,'all53512segment_triangle_boxes_independently_rechecked':True,'box_candidates':box_candidates,'MTdivisions_exercised':False,'result_log_job_exact':True,'all22physicalpins_exact':True,'classification_agreement':'No observedproperincidentedgehit; exactonepointoccupancy/closestnormaltruth/groomclearance stillunknown; recipe remainsrefused.'};(P/'ROOT-RESULT.json').write_text(json.dumps(x,indent=2)+'\n');print(json.dumps(x,indent=2))
