"""One bounded first-body-crossing search; no fit clearance or full census."""
import collections, hashlib, json, math, pathlib, time
from fractions import Fraction as F
import numpy as np
P=pathlib.Path(__file__).resolve().parent
START=time.monotonic();C=json.loads((P/'EXEC.json').read_text())
EPS=1e-9;EXACT_EPS=F(1,1000000000)
def tick():
    if time.monotonic()-START>110:raise TimeoutError('worker110second bound')
def save(name,data):
    with (P/name).open('x') as f:json.dump(data,f,indent=2,allow_nan=False);f.write('\n')
def raw(a):return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()
def need(ok,stage,detail):
    if not ok:save('REFUSAL.json',{'stage':stage,'detail':detail});raise RuntimeError(stage)
def det3(m):
    return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0])
def certify(source,target,k):
    s=[[F(float(x)) for x in p] for p in source];t=[[F(float(x)) for x in p] for p in target]
    a=s[k];b=s[(k+1)%3]
    m=[[b[z]-a[z],-(t[1][z]-t[0][z]),-(t[2][z]-t[0][z])] for z in range(3)]
    rhs=[t[0][z]-a[z] for z in range(3)];den=det3(m)
    if den==0:return {'qualified':False,'reason':'exact zero determinant'}
    coefficients=[]
    for col in range(3):
        replaced=[row[:] for row in m]
        for z in range(3):replaced[z][col]=rhs[z]
        coefficients.append(det3(replaced)/den)
    f,u,v=coefficients;bary=[1-u-v,u,v]
    qualified=all(EXACT_EPS<x<1-EXACT_EPS for x in [f]+bary)
    point=[a[z]+f*(b[z]-a[z]) for z in range(3)]
    other=[sum(bary[q]*t[q][z] for q in range(3)) for z in range(3)]
    assert point==other
    return {'qualified':qualified,'determinant':str(den),'coefficients':[str(x) for x in coefficients],'target_barycentrics':[str(x) for x in bary],'point':[str(x) for x in point],'numeric_point':[float(x) for x in point],'epsilon':str(EXACT_EPS),'point_identities_exact':True}

def classify(a,b):
    na=np.cross(a[1]-a[0],a[2]-a[0]);nb=np.cross(b[1]-b[0],b[2]-b[0]);na/=np.linalg.norm(na);nb/=np.linalg.norm(nb)
    da=(b-a[0])@na;db=(a-b[0])@nb
    cop=bool(np.all(np.abs(da)<=1e-8) and np.all(np.abs(db)<=1e-8))
    hits=[];guards=[];systems=[]
    for reverse,(s,t) in enumerate(((a,b),(b,a))):
        for k in range(3):
            tick();edge=s[(k+1)%3]-s[k];e1=t[1]-t[0];e2=t[2]-t[0]
            m=np.column_stack((edge,-e1,-e2));rhs=t[0]-s[k]
            determinant=float(np.linalg.det(m));condition=float(np.linalg.cond(m))
            record={'reverse':reverse,'edge_corner':k,'determinant':determinant if math.isfinite(determinant) else None,'condition':condition if math.isfinite(condition) else None}
            if not math.isfinite(determinant) or not math.isfinite(condition) or abs(determinant)<=1e-12 or condition>1e8:
                record['class']='numerical_or_parallel_UNKNOWN';guards.append(record);systems.append(record);continue
            try:coeff=np.linalg.solve(m,rhs)
            except np.linalg.LinAlgError:
                record['class']='solve_UNKNOWN';guards.append(record);systems.append(record);continue
            f,u,v=map(float,coeff);bary=np.array([1-u-v,u,v]);p=s[k]+f*edge;other=bary@t
            residual=float(np.max(np.abs(m@coeff-rhs)));point_residual=float(np.max(np.abs(p-other)))
            if not np.isfinite(coeff).all() or not np.isfinite(p).all() or not np.isfinite(other).all() or not math.isfinite(residual) or not math.isfinite(point_residual) or max(residual,point_residual)>1e-8:
                record['class']='coefficient_or_residual_UNKNOWN';guards.append(record);systems.append(record);continue
            closed=bool(-EPS<=f<=1+EPS and np.all(bary>=-EPS) and np.all(bary<=1+EPS))
            strict=bool(EPS<f<1-EPS and np.all(bary>EPS) and np.all(bary<1-EPS))
            record.update(segment_fraction=f,target_barycentrics=bary.tolist(),point=p.tolist(),target_point=other.tolist(),linear_residual=residual,point_residual=point_residual,closed_hit=closed,strict_candidate=strict)
            record['class']='strict_candidate' if strict else 'boundary_UNKNOWN' if closed else 'no_hit_this_system'
            systems.append(record)
            if closed:hits.append(record)
    proof=None;failed=[]
    if not cop:
        for hit in hits:
            if hit['strict_candidate']:
                s,t=(a,b) if hit['reverse']==0 else (b,a)
                certificate=certify(s,t,hit['edge_corner'])
                if certificate['qualified']:proof={'numeric':hit,'exact':certificate};break
                failed.append({'numeric':hit,'exact':certificate})
    label='strict_transverse_CERTIFIED' if proof else 'coplanar_potential_UNKNOWN' if cop else 'certificate_UNKNOWN' if failed else 'boundary_UNKNOWN' if hits else 'numerical_or_parallel_UNKNOWN' if guards else 'no_qualified_hit'
    return label,{'systems':systems,'coplanar_potential':cop,'signed_plane_distances':[da.tolist(),db.tolist()],'hits':hits,'guards':guards,'failed_certificates':failed,'proof':proof}

def main():
    for row in C['pins']:
        b=pathlib.Path(row['path']).read_bytes();need(len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],'input-pin',row)
    with np.load(C['body'],allow_pickle=False) as z:bodyworld=z['Human_world'];bt=z['Human_triangles']
    with np.load(C['mesh'],allow_pickle=False) as z:world=z['world32'];tri=z['triangles'];roles=z['face_role'];panels=z['panel'];sides=z['side']
    expected=C['members'];arrays={'body_world':bodyworld,'body_triangles':bt,'mesh_world':world,'mesh_triangles':tri,'face_role':roles,'panel':panels,'side':sides}
    source={}
    need(str(pathlib.Path(np.__file__).resolve())==C['numpy_entry'] and np.__version__=='2.4.6' and __import__('sys').version.split()[0]=='3.14.7' and str(pathlib.Path(__import__('sys').executable).resolve())==C['python'],'runtime-identity',{})
    source['runtime']={'python':__import__('sys').version,'numpy':np.__version__,'numpy_entry':np.__file__}
    for name,a in arrays.items():
        row=expected[name];receipt={'dtype':str(a.dtype),'shape':list(a.shape),'raw_sha256':raw(a)}
        need(receipt==row,'raw-member',{'name':name,'observed':receipt,'expected':row});need(bool(np.isfinite(a).all()),'finite-member',{'name':name})
        source[name]=receipt
    need(int(bt.min())>=0 and int(bt.max())<len(bodyworld),'body-index-range',{})
    need(int(tri.min())>=0 and int(tri.max())<len(world),'mesh-index-range',{})
    frame=json.loads(pathlib.Path(C['frame']).read_text());need(frame['body_object']['name']=='Human' and frame['body_object']['matrix_world']==np.eye(4).tolist(),'identity-frame',{})
    body=bodyworld.astype(np.float64);cloth=world.astype(np.float64);a=cloth[tri];b=body[bt]
    source['minimum_doubleareas']={}
    for name,points in [('body',b),('cloth',a)]:
        area=np.linalg.norm(np.cross(points[:,1]-points[:,0],points[:,2]-points[:,0]),axis=1)
        bad=np.flatnonzero(area<=2e-12);need(not len(bad),'source-area',{'name':name,'first':bad[:1].tolist()})
        source['minimum_doubleareas'][name]=float(area.min())
    source['decoded_members']={'body':['Human_world','Human_triangles'],'mesh':['world32','triangles','face_role','panel','side']}
    source['authoritative_precision']='F32 source coordinates, exactly promoted to F64; exact dyadic positive-witness certificate'
    save('SOURCE.json',source)
    owner=json.loads(pathlib.Path(C['owners']).read_text())['vertices']
    lo,hi=b.min(axis=1),b.max(axis=1);counts=collections.Counter();first={};prefix=hashlib.sha256();reached=0;rowcount=0;found=None;stop='full_scan_no_certificate_UNKNOWN';last=None;candidate_bytes=0
    journal=(P/'CANDIDATES.jsonl').open('x')
    try:
        for i,points in enumerate(a):
            tick();rowcount=i+1
            candidates=np.flatnonzero(np.all((hi>=points.min(axis=0)-1e-8)&(lo<=points.max(axis=0)+1e-8),axis=1))
            for j0 in candidates:
                tick();j=int(j0)
                if reached>=100000:stop='pair_cap_UNKNOWN';raise TimeoutError(stop)
                reached+=1;last=[i,j];prefix.update(np.array([i,j],dtype='<i4').tobytes())
                label,detail=classify(points,b[j]);counts[label]+=1
                witness={'cloth_triangle_id':i,'body_triangle_id':j,'cloth_vertex_ids':tri[i].tolist(),'body_vertex_ids':bt[j].tolist(),'cloth_vertex_owners':[owner[int(k)] for k in tri[i]],'cloth_role':int(roles[i]),'cloth_panel':int(panels[i]),'cloth_side':int(sides[i]),'cloth_points':points.tolist(),'body_points':b[j].tolist(),'classification':label,'predicate':detail}
                if detail['proof'] or detail['failed_certificates']:
                    line=json.dumps(witness,allow_nan=False)+'\n';size=len(line.encode('utf8'))
                    if candidate_bytes+size>8*1024*1024:
                        save('LAST-CANDIDATE.json',witness);stop='candidate_archive_cap_UNKNOWN';raise TimeoutError(stop)
                    journal.write(line);journal.flush();candidate_bytes+=size
                if label!='no_qualified_hit' and label not in first:first[label]=witness
                if detail['proof']:
                    tick();found=witness;stop='first_certified_transverse_crossing';save('WITNESS.json',witness)
                    with (P/'witness.obj').open('x') as f:
                        f.write('# Actual source triangle pair; marker point rounded for OBJ; exact certificate in WITNESS.json. Not depth/occupancy/appearance.\n')
                        for p in list(points)+list(b[j])+[np.array(detail['proof']['exact']['numeric_point'])]:f.write('v '+' '.join(format(float(x),'.17g') for x in p)+'\n')
                        f.write('g cloth\nf 1 2 3\ng body\nf 4 5 6\ng crossing_marker\np 7\n')
                    break
            if found:break
            tick()
    except TimeoutError as e:
        if stop not in ('pair_cap_UNKNOWN','candidate_archive_cap_UNKNOWN'):stop='worker_time_UNKNOWN'
    finally:journal.close()
    report={'status':'REFUSED_TRANSVERSE' if found else 'UNKNOWN','scope':'First full-source-body certified negative witness only; no full contact census or fit pass','search_stop':stop,'source':source,'cloth_face_domain':len(tri),'body_face_domain':len(bt),'all_roles_eligible':True,'no_body_domain_exclusion':True,'rows_started':rowcount,'bbox_pairs_reached':reached,'pairs_classified':sum(counts.values()),'candidate_journal_bytes':candidate_bytes,'last_encountered_pair':last,'ordered_prefix_sha256':prefix.hexdigest(),'pair_class_counts':dict(counts),'first_nonmiss_witnesses':first,'certified_crossing':found,'untested_remainder':'After witness or cap not examined; an encountered pair interrupted before classification may lack a complete predicate; no-hit/full scan still leaves clearance/occupancy/self/fullsurface/pose/appearance UNKNOWN','unadmitted_intent_targets':'UNUSED','elapsed_seconds':time.monotonic()-START}
    report['post_pins']=all(len((v:=pathlib.Path(r['path']).read_bytes()))==r['bytes'] and hashlib.sha256(v).hexdigest()==r['sha256'] for r in C['pins'])
    need(report['post_pins'],'post-pin',{})
    report['search_clock_seconds']=time.monotonic()-START
    if not found and report['search_clock_seconds']>110:report['search_stop']='worker_time_UNKNOWN'
    save('OBSERVED.json',report);save('RESULT.json',report)
    print(json.dumps({'status':report['status'],'stop':stop,'rows_started':rowcount,'bbox_pairs_reached':reached,'pair':last}))

if __name__=='__main__':main()
