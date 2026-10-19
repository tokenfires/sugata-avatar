"""Read only the consumed build's saved outputs; never import/evaluate build.mjs."""
from pathlib import Path
import json, hashlib, math, struct, datetime, os
from collections import defaultdict, deque

leaf = Path(__file__).resolve().parent
read = lambda n: json.loads((leaf/n).read_text())
sha = lambda q: hashlib.sha256(q.read_bytes()).hexdigest()
sub = lambda a,b: [x-y for x,y in zip(a,b)]
cross = lambda a,b: [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
dot = lambda a,b: sum(x*y for x,y in zip(a,b))
norm = lambda a: math.sqrt(dot(a,a))

def topology(vertices, faces, closed):
    edges = defaultdict(list)
    areas = []
    adjacency = [set() for _ in faces]
    links = [defaultdict(set) for _ in vertices]
    for fi, face in enumerate(faces):
        v = face['v']
        assert len(v)==3 and len(set(v))==3 and all(type(i) is int and 0<=i<len(vertices) for i in v)
        a,b,c = (vertices[i] for i in v)
        area = norm(cross(sub(b,a),sub(c,a)))/2
        assert area>1e-10
        areas.append(area)
        for k in range(3):
            x,y,z = v[k],v[(k+1)%3],v[(k+2)%3]
            edges[tuple(sorted((x,y)))].append((fi,x,y))
            links[x][y].add(z); links[x][z].add(y)
    for es in edges.values():
        assert len(es) in ([2] if closed else [1,2])
        if len(es)==2:
            assert es[0][1:]==tuple(reversed(es[1][1:]))
            a,b = es[0][0],es[1][0]; adjacency[a].add(b);adjacency[b].add(a)
    seen={0}; queue=deque([0])
    while queue:
        for n in adjacency[queue.popleft()]-seen: seen.add(n);queue.append(n)
    assert len(seen)==len(faces)
    if closed:
        for link in links:
            assert len(link)>=3 and all(len(x)==2 for x in link.values())
            start=next(iter(link));seen={start};queue=deque([start])
            while queue:
                for n in link[queue.popleft()]-seen:seen.add(n);queue.append(n)
            assert len(seen)==len(link)
    return edges,areas,adjacency

admission=read('CPU-ADMISSION.json')
for row in admission['inputs']:
    q=Path(row['path']);assert len(q.read_bytes())==row['bytes'] and sha(q)==row['sha256'],str(q)
result=read('BUILD-RESULT.json'); tool=read('TOOL-CPU.json')
assert tool['result']['exit_code']==0 and not tool['result'].get('session_id')
assert json.loads(tool['result']['output'])==result
assert tool['launch']['argv']==admission['argv']
assert result['designSha256']==sha(leaf/'design.json')
for row in result['outputs']:
    q=Path(row['path']);assert len(q.read_bytes())==row['bytes'] and sha(q)==row['sha256']
model=read('out/model.json'); design=read('design.json')
assert model['designSha256']==result['designSha256'] and model['counts']==result['counts']
assert model['materials']==design['materials']
parts=model['parts'];assert [p['id']for p in parts]==['continuous_body_and_sleeves','patch_posX','patch_negX']
stats=[]; float32_max_error=0
for part in parts:
    vv,ff=part['vertices'],part['faces']
    assert all(len(v)==3 and all(type(x)in[int,float] and math.isfinite(x)for x in v)for v in vv)
    assert all(f['material']in model['materials']for f in ff)
    ee,aa,adj=topology(vv,ff,True)
    volume=sum(dot(vv[f['v'][0]],cross(vv[f['v'][1]],vv[f['v'][2]]))/6 for f in ff)
    assert volume>0 and abs(volume-part['materialVolume'])<1e-7
    f32=[[struct.unpack('f',struct.pack('f',x))[0]for x in v]for v in vv]
    float32_max_error=max(float32_max_error,max(abs(x-y)for a,b in zip(vv,f32)for x,y in zip(a,b)))
    for f in ff:
        a,b,c=[f32[i]for i in f['v']];assert norm(cross(sub(b,a),sub(c,a)))/2>1e-10
    stats.append({'id':part['id'],'vertices':len(vv),'triangles':len(ff),'edges':len(ee),'euler':len(vv)-len(ee)+len(ff),'min_area':min(aa),'volume':volume})
assert sum(s['vertices']for s in stats)==2288 and sum(s['triangles']for s in stats)==4572

main=parts[0];n=1114;f=2064;outside=main['faces'][:f]
ee,_,adj=topology(main['vertices'][:n],outside,False)
boundary={es[0][1]:es[0][2]for es in ee.values()if len(es)==1}
pending=set(boundary);loops=[]
while pending:
    start=next(iter(pending));v=start;loop=[]
    while True:
        assert v in pending;pending.remove(v);loop.append(v);v=boundary[v]
        if v==start:break
    loops.append(loop)
assert sorted(map(len,loops))==[20,20,126]
assert sorted(sorted(x)for x in loops)==sorted(sorted(x)for x in main['openSurfaceBoundaryLoops'])
normal_sums=[[0.,0.,0.]for _ in range(n)]
for face in outside:
    a,b,c=[main['vertices'][i]for i in face['v']];nn=cross(sub(b,a),sub(c,a))
    for i in face['v']:normal_sums[i]=[x+y for x,y in zip(normal_sums[i],nn)]
offset_error=0
for i,s in enumerate(normal_sums):
    length=norm(s);assert length>1e-12
    predicted=[x-0.6*y/length for x,y in zip(main['vertices'][i],s)]
    offset_error=max(offset_error,norm(sub(predicted,main['vertices'][i+n])))
assert offset_error<1e-10
body_faces=2*(15*48-2*4*6)
for interface in main['interfaces']:
    ring=interface['sharedBodyRing'];assert len(set(ring))==20
    for a,b in zip(ring,ring[1:]+ring[:1]):
        es=ee[tuple(sorted((a,b)))];assert len(es)==2
        assert sum(x[0]<body_faces for x in es)==1
    cuff=set(interface['terminalCuffRing']);assert len(cuff)==20 and any(cuff==set(loop)for loop in loops)
band={i for i,x in enumerate(outside)if x['material']=='band'};start=next(iter(band));seen={start};queue=deque([start])
while queue:
    for x in (adj[queue.popleft()]&band)-seen:seen.add(x);queue.append(x)
assert seen==band

contacts=[]
for part in parts[1:]:
    assert len(part['vertices'])==30 and len(part['attachmentWitnesses'])==9
    vv=part['vertices'];errors=[]
    for i in range(15):assert norm(sub(sub(vv[i],vv[i+15]),[0,0,0.45]))<1e-10
    expected={i+15 for i in range(15)if i<5 or i%5 in [0,4]}
    actual=set()
    for w in part['attachmentWitnesses']:
        assert w['pocketLayer']=='inner' and w['pocketIndexSpace']=='this part.vertices, zero-based'
        assert w['bodyPart']==main['id'] and w['bodyIndexSpace']=='named body part.vertices, zero-based outer layer'
        assert type(w['pocketVertex'])is int and 15<=w['pocketVertex']<30
        assert type(w['bodyVertex'])is int and 0<=w['bodyVertex']<1114
        actual.add(w['pocketVertex'])
        distance=norm(sub(vv[w['pocketVertex']],main['vertices'][w['bodyVertex']]))
        assert abs(distance-w['distance'])<1e-10 and distance<1e-10
        errors.append(distance)
    assert actual==expected
    mouth=vv[27]
    candidates=[v for v in main['vertices'][:n]if abs(v[0]-mouth[0])<1e-12 and abs(v[1]-mouth[1])<1e-12]
    assert candidates
    base=max(candidates,key=lambda v:v[2]); gap=mouth[2]-base[2]
    assert abs(gap-2)<1e-10 and abs(gap-part['topMouthCenterGapZ'])<1e-10
    assert all(v[0]>0 for v in vv) if part['id']=='patch_posX' else all(v[0]<0 for v in vv)
    contacts.append({'id':part['id'],'verified_inner_contacts':len(errors),'max_recomputed_distance':max(errors),'top_mouth_center_gap_z':gap})

obj=(leaf/'out/model.obj').read_text().splitlines(); vv=[];ff=[];groups=[];material=None;group=None
for line in obj:
    words=line.split()
    if not words or words[0]=='#':continue
    op=words[0]
    if op=='mtllib':assert words==['mtllib','model.mtl']
    elif op=='o':group=words[1];groups.append(group)
    elif op=='v':assert len(words)==4;vv.append([float(x)for x in words[1:]])
    elif op=='usemtl':material=words[1]
    elif op=='f':assert len(words)==4;ff.append((group,material,[int(x)-1 for x in words[1:]]))
    else:raise AssertionError(op)
assert groups==[p['id']for p in parts]
expected_v=[v for p in parts for v in p['vertices']];assert len(vv)==len(expected_v)
obj_error=max(abs(a-b)for x,y in zip(vv,expected_v)for a,b in zip(x,y));assert obj_error<=5.01e-9
expected_f=[];offset=0
for p in parts:
    expected_f.extend((p['id'],f['material'],[i+offset for i in f['v']])for f in p['faces']);offset+=len(p['vertices'])
assert ff==expected_f
mtl={};name=None
for line in (leaf/'out/model.mtl').read_text().splitlines():
    w=line.split()
    if not w:continue
    if w[0]=='newmtl':name=w[1];assert name not in mtl;mtl[name]={}
    else:mtl[name][w[0]]=w[1:]
assert set(mtl)==set(model['materials'])
for name,h in model['materials'].items():
    rgb=[int(h[i:i+2],16)/255 for i in [1,3,5]]
    assert max(abs(a-float(b))for a,b in zip(rgb,mtl[name]['Kd']))<=5.01e-9
    assert mtl[name]['d']==['1'] and mtl[name]['illum']==['2']

summary={'schema':'root-full-saved-cardigan-CPU-audit-v1','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'decision':'A finite saved model/topology/interface/export data only; actual rendered appearance unqualified','reverified_admission_pins':len(admission['inputs']),'sole_tool_chunk':'350d68','exit_code':0,'actual_builder_pid':result['pid'],'part_checks':stats,'outside_boundary_loop_lengths':sorted(map(len,loops)),'shared_sleeve_rings':2,'normal_offset_max_error':offset_error,'continuous_outer_band':True,'corrected_actual_contact_checks':contacts,'OBJ_vertices':len(vv),'OBJ_triangles':len(ff),'OBJ_max_rounding_error':obj_error,'MTL_roles':list(mtl),'predictedFloat32_max_position_error':float32_max_error,'all_predictedFloat32_triangles_nondegenerate':True,'limits':'No generator replay/import, geometry modification, selfintersection/collisionfree/sewnunion/fit/cloth/motion/runtime/AAA or appearance proof. Actual independent data critic/root gate still required before separateGPU.'}
with (leaf/'ROOT-CPU.json').open('x')as out:out.write(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
