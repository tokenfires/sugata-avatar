"""Independent exact substitution of one stored positive witness. No search replay."""
import hashlib,json,pathlib,math,time
from fractions import Fraction as F
import numpy as np
P=pathlib.Path(__file__).resolve().parent;START=time.monotonic();C=json.loads((P/'EXEC.json').read_text())
result=json.loads((P/'RESULT.json').read_text());W=json.loads((P/'WITNESS.json').read_text());assert result['status']=='REFUSED_TRANSVERSE' and W==result['certified_crossing']
for row in C['pins']:
    b=pathlib.Path(row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
with np.load(C['mesh'],allow_pickle=False) as z:mw=z['world32'];mt=z['triangles'];role=z['face_role'];panel=z['face_panel']
with np.load(C['body'],allow_pickle=False) as z:bw=z['Human_world'];bt=z['Human_triangles']
for name,a in {'body_world':bw,'body_triangles':bt,'mesh_world':mw,'mesh_triangles':mt,'face_role':role,'face_panel':panel}.items():
    row=C['members'][name];assert str(a.dtype)==row['dtype'] and list(a.shape)==row['shape'] and hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()==row['raw_sha256']
i,j=W['cloth_triangle_id'],W['body_triangle_id'];a=mw[mt[i]].astype(np.float64);b=bw[bt[j]].astype(np.float64)
assert mt[i].tolist()==W['cloth_vertex_ids'] and bt[j].tolist()==W['body_vertex_ids'] and a.tolist()==W['cloth_points'] and b.tolist()==W['body_points']
assert int(role[i])==W['cloth_role'] and int(panel[i])==W['cloth_panel']
owners=json.loads(pathlib.Path(C['owners']).read_text())['vertices'];assert [owners[int(k)] for k in mt[i]]==W['cloth_vertex_owners']
proof=W['predicate']['proof'];num=proof['numeric'];exact=proof['exact'];s,t=(a,b) if num['reverse']==0 else (b,a);k=num['edge_corner']
sf=[[F(float(x)) for x in p] for p in s];tf=[[F(float(x)) for x in p] for p in t]
f,u,v=map(F,exact['coefficients']);bary=list(map(F,exact['target_barycentrics']));p=list(map(F,exact['point']))
assert bary==[1-u-v,u,v] and sum(bary)==1
assert all(F(1,1000000000)<x<1-F(1,1000000000) for x in [f]+bary)
edge=[sf[(k+1)%3][z]-sf[k][z] for z in range(3)]
e1=[tf[1][z]-tf[0][z] for z in range(3)];e2=[tf[2][z]-tf[0][z] for z in range(3)]
normal=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]]
triple=sum(edge[z]*normal[z] for z in range(3));assert triple!=0 and triple==F(exact['determinant'])
assert p==[sf[k][z]+f*edge[z] for z in range(3)]==[sum(bary[q]*tf[q][z] for q in range(3)) for z in range(3)]
assert [float(x) for x in p]==exact['numeric_point']
approx=np.array(num['point']);target=np.array(num['target_point']);marker=np.array(exact['numeric_point'])
assert np.max(np.abs(approx-marker))<=1e-8 and np.max(np.abs(approx-target))<=1e-8
assert math.isfinite(num['condition']) and num['condition']<=1e8 and abs(num['determinant'])>1e-12
assert max(num['linear_residual'],num['point_residual'])<=1e-8 and not W['predicate']['coplanar_potential']
sourceedge=s[(k+1)%3]-s[k];n=np.cross(t[1]-t[0],t[2]-t[0]);n/=np.linalg.norm(n)
dist=[float((q-t[0])@n) for q in (s[k],s[(k+1)%3])];assert dist[0]*dist[1]<0
# Prefix identity only: recompute AABB encountered order, not intersection search.
body=bw.astype(np.float64)[bt];lo,hi=body.min(axis=1),body.max(axis=1);digest=hashlib.sha256();encountered=0
for row in range(i+1):
    points=mw[mt[row]].astype(np.float64)
    candidates=np.flatnonzero(np.all((hi>=points.min(axis=0)-1e-8)&(lo<=points.max(axis=0)+1e-8),axis=1))
    for col0 in candidates:
        col=int(col0)
        if row==i and col>j:break
        digest.update(np.array([row,col],dtype='<i4').tobytes());encountered+=1
assert encountered==result['bbox_pairs_reached'] and digest.hexdigest()==result['ordered_prefix_sha256'] and result['last_encountered_pair']==[i,j]
rows=[json.loads(line) for line in (P/'CANDIDATES.jsonl').read_text().splitlines()];assert rows and rows[-1]==W
ov=[];faces=[];marker_index=None
for line in (P/'witness.obj').read_text().splitlines():
    if line.startswith('v '):ov.append([float(x) for x in line.split()[1:]])
    if line.startswith('f '):faces.append([int(x) for x in line.split()[1:]])
    if line.startswith('p '):marker_index=int(line.split()[1])
assert np.array_equal(np.array(ov[:3]),a) and np.array_equal(np.array(ov[3:6]),b) and ov[6]==exact['numeric_point'] and faces==[[1,2,3],[4,5,6]] and marker_index==7
assert time.monotonic()-START<60
report={'independent_exact_substitution':True,'proper_intersection_of_fixed_F32_triangles':True,'exact_nonzero_edge_plane_triple':str(triple),'all_exact_point_barycentric_segment_equalities':True,'source_raw_six_members_exact':True,'role_panel_owner_and_OBJ_exact':True,'deterministic_bbox_prefix_verified':encountered,'prefix_verification_is_not_contact_search_replay':True,'opposite_numeric_edge_plane_distances':dist,'floating_marker_component_delta':float(np.max(np.abs(approx-marker))),'all_pins':len(C['pins']),'body_clearance_occupancy_self_coverage_appearance_motion':'UNKNOWN','elapsed_seconds':time.monotonic()-START}
with (P/'ROOT-RESULT.json').open('x') as out:json.dump(report,out,indent=2);out.write('\n')
print(json.dumps(report))
