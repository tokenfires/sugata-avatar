"""Read-only independent stored construction verifier; does not import producer."""
import collections, hashlib, json, math, pathlib, time
from fractions import Fraction as F
import numpy as np
P=pathlib.Path(__file__).resolve().parent
START=time.monotonic()
C=json.loads((P/'EXEC.json').read_text());R=json.loads(pathlib.Path(C['recipe']).read_text());A=json.loads(pathlib.Path(C['architecture']).read_text())
O=json.loads((P/'OWNERS.json').read_text());result=json.loads((P/'RESULT.json').read_text())
for row in C['pins']:
    b=pathlib.Path(row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
with np.load(P/'mesh.npz',allow_pickle=False) as z:arrays={k:z[k] for k in z.files}
assert set(arrays)=={'world64','world32','triangles','face_role','face_panel'}
w=arrays['world64'];wf=arrays['world32'];tri=arrays['triangles']
for name,a in arrays.items():
    receipt=result['arrays'][name];assert list(a.shape)==receipt['shape'] and str(a.dtype)==receipt['dtype'] and hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()==receipt['raw_sha256']
assert np.array_equal(w.astype(np.float32),wf) and np.isfinite(w).all()
assert len(w)==11550 and len(tri)==23104 and w.shape==(11550,3)

def pt(layer,name):
    side,key=name.split('.',1)
    if key.endswith('.u0'):return curve(layer,side+'.'+key[:-3],F(0))
    x=np.array(R['layers'][layer]['right_points'][key],np.float64)
    return x if side=='R' else x*np.array([-1.,1.,1.])

def curve(layer,spec,t):
    if isinstance(spec,dict):
        if 'reverse' in spec:return curve(layer,spec['reverse'],1-t)
        if 'concat' in spec:
            n=len(spec['concat']);q=t*n;k=min(q.numerator//q.denominator,n-1)
            return curve(layer,spec['concat'][k],q-k)
        a,b=spec['line'];return pt(layer,a)+float(t)*(pt(layer,b)-pt(layer,a))
    if spec in R['derived_owned_curves_per_layer']:return curve(layer,{'concat':R['derived_owned_curves_per_layer'][spec]['parts']},t)
    data=R['layers'][layer]
    if spec in data['back_cubics']:q=data['back_cubics'][spec];mirror=False
    else:
        side,key=spec.split('.',1);mirror=side=='L'
        if key in data['right_rings']:
            if t==1:t=F(0)
            q=data['right_rings'][key];a=2*math.pi*float(t)
            p=np.array(q['center'])+q['rd']*math.cos(a)*np.array([math.sqrt(.5),0,-math.sqrt(.5)])+q['rf']*math.sin(a)*np.array([0,-1,0])
            return p if not mirror else p*np.array([-1.,1.,1.])
        q=data['right_cubics'][key]
    begin,end=q['from'],q['to']
    if mirror:begin=begin.replace('R.','L.');end=end.replace('R.','L.')
    if t==0:return pt(layer,begin)
    if t==1:return pt(layer,end)
    p0,p3=pt(layer,begin),pt(layer,end);p1,p2=np.array(q['controls'],np.float64)
    if mirror:p1*=np.array([-1.,1.,1.]);p2*=np.array([-1.,1.,1.])
    x=float(t)
    # Independent power-basis Horner evaluation, rather than Bernstein sum.
    return p0+x*((3*p1-3*p0)+x*((3*p0-6*p1+3*p2)+x*(-p0+3*p1-3*p2+p3)))

maxerror=0.;griduses=0
for layer in ('O','I'):
    for q in R['torso_patches_per_layer']+R['sleeve_bands_per_layer']:
        grid=O['patch_grids'][layer+'.'+q['id']]
        assert len(grid)==q['nv']+1 and all(len(row)==q['nu']+1 for row in grid)
        for j,row in enumerate(grid):
            v=F(j,q['nv']);y=float(v)
            for i,idx in enumerate(row):
                u=F(i,q['nu']);x=float(u)
                if 'bottom' in q:
                    expected=curve(layer,q['bottom'],u)+y*(curve(layer,q['top'],u)-curve(layer,q['bottom'],u))
                else:
                    c=[pt(layer,n) for n in q['corners']]
                    expected=((1-x)*curve(layer,q['L'],v)+x*curve(layer,q['R'],v)+(1-y)*curve(layer,q['B'],u)+y*curve(layer,q['T'],u))-((1-y)*(c[0]+x*(c[1]-c[0]))+y*(c[2]+x*(c[3]-c[2])))
                maxerror=max(maxerror,float(np.max(np.abs(expected-w[idx]))));griduses+=1
assert maxerror<=1e-14
for layer in ('O','I'):
    for seam in A['seam_template_per_layer']:
        assert O['edge_indices'][layer+'.'+seam['a']]==O['edge_indices'][layer+'.'+seam['b']][::-1]
    for edge,spec in R['edge_aliases_per_layer'].items():
        ids=O['edge_indices'][layer+'.'+edge];n=R['edge_interval_counts_per_layer'][edge]
        assert len(ids)==n+1
        for k,idx in enumerate(ids):assert np.max(np.abs(curve(layer,spec,F(k,n))-w[idx]))<=1e-14

directed=np.concatenate((tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]),axis=0)
und=np.sort(directed,axis=1);keys,inverse,counts=np.unique(und,axis=0,return_inverse=True,return_counts=True)
assert np.all(counts==2)
sign=np.where(directed[:,0]<directed[:,1],1,-1);assert np.all(np.bincount(inverse,weights=sign)==0)
assert len(w)-len(keys)+len(tri)==-2
link=collections.defaultdict(list)
for a,b,c in tri:
    link[int(a)].append((int(b),int(c)));link[int(b)].append((int(c),int(a)));link[int(c)].append((int(a),int(b)))
for vertex in range(len(w)):
    graph=collections.defaultdict(set)
    for a,b in link[vertex]:graph[a].add(b);graph[b].add(a)
    assert graph and all(len(v)==2 for v in graph.values())
    seen=set();stack=[next(iter(graph))]
    while stack:
        x=stack.pop()
        if x in seen:continue
        seen.add(x);stack.extend(graph[x]-seen)
    assert len(seen)==len(graph)
# Independent union-find for the whole assembly component.
parent=np.arange(len(w))
def find(x):
    while parent[x]!=x:parent[x]=parent[parent[x]];x=int(parent[x])
    return x
for a,b in keys:
    x,y=find(int(a)),find(int(b));parent[max(x,y)]=min(x,y)
assert len({find(v) for v in range(len(w))})==1
areas={}
for label,points in [('F64',w),('F32',wf.astype(np.float64))]:
    a,b,c=points[tri[:,0]],points[tri[:,1]],points[tri[:,2]]
    # Gram determinant squared double-area; algebraically independent of cross-norm.
    e,f=b-a,c-a
    aa=np.einsum('ij,ij->i',e,e);bb=np.einsum('ij,ij->i',f,f);ab=np.einsum('ij,ij->i',e,f)
    d=np.sqrt(np.maximum(0,aa*bb-ab*ab));assert np.all(d>2e-12)
    areas[label]=float(d.min())
objv=[];objt=[];objroles=[];objpanels=[];role=panel=None
for line in (P/'main-panels.obj').read_text().splitlines():
    if line.startswith('v '):objv.append([float(x) for x in line.split()[1:]])
    elif line.startswith('g '):role,panel=[int(x) for x in line[6:].split('_panel')]
    elif line.startswith('f '):objt.append([int(x)-1 for x in line.split()[1:]]);objroles.append(role);objpanels.append(panel)
assert np.array_equal(np.asarray(objv,np.float32),wf) and np.array_equal(np.asarray(objt,np.int32),tri)
assert np.array_equal(np.asarray(objroles),arrays['face_role']) and np.array_equal(np.asarray(objpanels),arrays['face_panel'])
assert time.monotonic()-START<60
report={'independent_verified':True,'grid_uses':griduses,'power_basis_max_component_error':maxerror,'sorted_edge_count':len(keys),'one_component':True,'all_vertex_links_cycles':True,'gram_min_doublearea':areas,'OBJ_F32_coordinates_indices_role_panel_exact':True,'all_array_hashes':True,'all_input_pins':len(C['pins']),'discrete_eligibility_only':True,'physical_fit_coverage_appearance':'UNKNOWN','elapsed_seconds':time.monotonic()-START}
with (P/'ROOT-RESULT.json').open('x') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report))
