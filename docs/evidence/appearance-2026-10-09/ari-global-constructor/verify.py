"""Independent read-only verification; never writes a candidate or runs build.py."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import math
import time
import datetime
import numpy as np

HERE=Path(__file__).resolve().parent
START=time.monotonic()


def clock():
    if time.monotonic()-START>120:raise TimeoutError('root verification 120s limit')


def digest(a):return hashlib.sha256(a.tobytes(order='C')).hexdigest()


def expected_outer(topo,ledger,par,sections,distal):
    """Reference equations in memory only, using alternate source interpolation and least squares."""
    rows={}
    for text,name in par['source_row_names'].items():
        records=sections[name]['ordered_source_triangle_edges'];ids=list(range(len(records)))
        points=[r['point'] for r in records]
        area=math.fsum(points[k][0]*points[(k+1)%len(points)][1]-points[k][1]*points[(k+1)%len(points)][0] for k in ids)
        if area<0:ids=list(reversed(ids))
        anchor=min(ids,key=lambda i:(points[i][1],abs(points[i][0]),points[i][0],i));k=ids.index(anchor);ids=ids[k:]+ids[:k]
        xyz=[np.asarray(points[i],np.float64) for i in ids]
        lengths=[math.dist(xyz[k],xyz[(k+1)%len(xyz)]) for k in range(len(xyz))]
        circumference=math.fsum(lengths);sample=[];cy=sections[name]['plane_origin'][1]
        for x in range(25):
            wanted=(.04+.92*x/24)*circumference;acc=0
            for j,length in enumerate(lengths):
                if wanted<acc+length:
                    point=xyz[j]+((wanted-acc)/length)*(xyz[(j+1)%len(xyz)]-xyz[j]);break
                acc+=length
            sample.append(point+np.array([.10*point[0],.10*(point[1]-cy),0]))
        rows[int(text)]=sample
    hole={}
    for short,side in [('l','left'),('r','right')]:
        anchors={a['role']:np.asarray(a['source_point']) for a in par['source_anchors'] if a['side']==short}
        center=sum(anchors.values())/4;up=anchors['crown']-anchors['underarm'];up/=math.hypot(*up)
        front=anchors['front']-anchors['rear'];front=front-math.fsum(front*up)*up;front/=math.hypot(*front)
        a=max(abs(math.fsum((p-center)*front)) for p in anchors.values());b=max(abs(math.fsum((p-center)*up)) for p in anchors.values())
        for j in range(16):
            theta=2*math.pi*j/16 if short=='l' else math.pi-2*math.pi*j/16
            p=center+a*math.cos(theta)*front+b*math.sin(theta)*up
            hole[side,j]=p+np.array([.10*p[0],.10*(p[1]-center[1]),0])
    result=np.zeros((403,3));free=[];symbols=topo['vertex_symbols']
    for r in ledger['owners'][:403]:
        i,o=r['id'],r['owner'];rule=o['rule']
        if rule=='torso-source-arc':result[i]=rows[o['row']][o['column']]
        elif rule=='shared-hole-ellipse':result[i]=hole[o['side'],o['phase']]
        elif rule=='front-edge-knot-interpolation':
            _,x,y=r['symbol'];lo=max(n for n in rows if n<y);hi=min(n for n in rows if n>y)
            result[i]=((hi-y)*rows[lo][x]+(y-lo)*rows[hi][x])/(hi-lo)
        elif rule=='distal-source-ring':
            side='l' if o['side']=='left' else 'r';j=o['phase'];q=(-j)%16 if side=='l' else (8+j)%16
            s=distal[('elbow-' if o['ring']==1 else 'cuff-')+side];p=np.asarray(s['samples'][q]['primary_association']['point'])
            result[i]=p+.15*(p-np.asarray(s['origin']))
            if o['ring']==2:result[i]-=.040*np.asarray(s['normal'])
        else:assert rule=='uniform-harmonic-torso';free.append(i)
    byxy={tuple(s[1:]):i for i,s in enumerate(symbols[:403]) if s[0]=='torso'};index={v:i for i,v in enumerate(free)}
    mat=np.zeros((len(free),len(free)));rhs=np.zeros((len(free),3))
    for i,k in index.items():
        _,x,y=symbols[i];adj=[j for (xx,yy),j in byxy.items() if abs(xx-x)+abs(yy-y)==1]
        mat[k,k]=len(adj)
        for j in adj:
            if j in index:mat[k,index[j]]=-1
            else:rhs[k]+=result[j]
    solution,residual,rank,singular=np.linalg.lstsq(mat,rhs,rcond=None);assert rank==167
    result[free]=solution;clock()
    return result,mat,rhs


def solve_contacts(world,tri,body,bt,self_mode):
    """Batched 3x3 linear solves rather than the worker's six MT divisions."""
    xyz=world.astype(np.float64);a=xyz[tri];b=a if self_mode else body[bt]
    lo,hi=b.min(axis=1),b.max(axis=1);counts=Counter();categories=Counter();pairdigest=hashlib.sha256();reached=0
    for i,source in enumerate(a):
        clock();ids=np.flatnonzero(np.all((hi>=source.min(axis=0)-1e-8)&(lo<=source.max(axis=0)+1e-8),axis=1))
        if self_mode:ids=ids[ids>i]
        for offset in range(0,len(ids),512):
            js=ids[offset:offset+512];left=np.broadcast_to(source,(len(js),3,3));right=b[js]
            strict=np.zeros(len(js),bool);boundary=np.zeros(len(js),bool)
            shared=[sorted(set(tri[i])&set(tri[j])) if self_mode else [] for j in js]
            for common in shared:categories['common-edge' if len(common)==2 else 'common-vertex' if len(common)==1 else 'nonincident' if self_mode else 'fullbody']+=1
            for first,target in ((left,right),(right,left)):
                e1=target[:,1]-target[:,0];e2=target[:,2]-target[:,0]
                for corner in range(3):
                    direction=first[:,(corner+1)%3]-first[:,corner]
                    matrix=np.stack((direction,-e1,-e2),axis=2);det=np.linalg.det(matrix);ok=np.abs(det)>1e-12
                    sol=np.zeros((len(js),3));sol[ok]=np.linalg.solve(matrix[ok],(target[ok,0]-first[ok,corner])[...,None])[...,0]
                    f,u,v=sol.T;bary=np.column_stack((1-u-v,u,v));hits=ok&(f>=-1e-9)&(f<=1+1e-9)&np.all((bary>=-1e-9)&(bary<=1+1e-9),axis=1)
                    interior=hits&(f>1e-9)&(f<1-1e-9)&np.all((bary>1e-9)&(bary<1-1e-9),axis=1)
                    expected=np.zeros(len(js),bool)
                    if self_mode:
                        points=first[:,corner]+f[:,None]*direction
                        for k in np.flatnonzero(hits):
                            common=shared[k]
                            if len(common)==1:expected[k]=np.linalg.norm(points[k]-world[common[0]])<=1e-8
                            elif len(common)==2:
                                aa,bb=world[common].astype(np.float64);dd=bb-aa;fraction=float(np.dot(points[k]-aa,dd)/np.dot(dd,dd))
                                expected[k]=-1e-9<=fraction<=1+1e-9 and np.linalg.norm(points[k]-(aa+fraction*dd))<=1e-8
                    strict|=interior&~expected;boundary|=hits&~interior&~expected
            na=np.cross(left[:,1]-left[:,0],left[:,2]-left[:,0]);nb=np.cross(right[:,1]-right[:,0],right[:,2]-right[:,0])
            na/=np.linalg.norm(na,axis=1)[:,None];nb/=np.linalg.norm(nb,axis=1)[:,None]
            cop=np.all(np.abs(np.einsum('ijk,ik->ij',right-left[:,0,None],na))<=1e-8,axis=1)&np.all(np.abs(np.einsum('ijk,ik->ij',left-right[:,0,None],nb))<=1e-8,axis=1)
            labels=np.full(len(js),'miss_or_expected_topological_touch',dtype=object);labels[cop]='coplanar_ambiguous';labels[boundary]='boundary_ambiguous';labels[strict]='strict_transverse';counts.update(labels)
            pairs=np.column_stack((np.full(len(js),i),js)).astype('<i4');pairdigest.update(pairs.tobytes());reached+=len(js)
    clock();return {'counts':dict(counts),'topology_categories':dict(categories),'bbox_pairs_reached':reached,'ordered_pair_sha256':pairdigest.hexdigest()}


def verify_coverage(stored,world,tri,owners,body,bt,paths,sections,distal):
    with np.load(paths['fields.npz'],allow_pickle=False) as archive:left=archive['l_arm_faces'];right=archive['r_arm_faces']
    assert digest(left)=='9aaae1564484cc20abdd7660ddaa7036bdca85fcb36a14ef078b59a3a7882c80'
    assert digest(right)=='d4d1a6d94598a52602c4d10563943ea7820544e841def693a8407c74236a93e6'
    p=body[bt];arm_ids=set(left.tolist()+right.tolist());nonarm=np.array([i not in arm_ids for i in range(len(bt))])
    hem=sections['hem']['plane_origin'][2];neck=sections['neckline']['plane_origin'][2];cy=.009862011298537254
    torso=nonarm&np.all((p[:,:,2]>=hem)&(p[:,:,2]<=neck),axis=1);front=torso&np.all((p[:,:,1]<cy)&(np.abs(np.arctan2(p[:,:,0],cy-p[:,:,1]))<.18),axis=1)
    domains={'required-torso':np.flatnonzero(torso&~front),'exposed-front':np.flatnonzero(front),'exposed-lower':np.flatnonzero(nonarm&np.all(p[:,:,2]<hem-1e-8,axis=1))}
    for side,long,ids in [('l','left',left),('r','right',right)]:
        s=distal['cuff-'+side];normal=np.asarray(s['normal']);project=np.einsum('ijk,k->ij',p[ids]-np.asarray(s['origin']),normal)
        domains['required-'+long]=ids[np.max(project,axis=1)<=-1e-8];domains['exposed-hand-'+long]=ids[np.min(project,axis=1)>=1e-8]
    for name,ids in domains.items():assert np.array_equal(ids.astype(np.int32),stored[name.replace('-','_')]),name
    required=set(int(i) for name,ids in domains.items() if name.startswith('required') for i in ids);exposed=set(int(i) for name,ids in domains.items() if name.startswith('exposed') for i in ids);assert not required&exposed
    role_for={int(i):name for name,ids in domains.items() for i in ids};targets=world.astype(np.float64)[tri[:704]]
    e1=targets[:,1]-targets[:,0];e2=targets[:,2]-targets[:,0];normals=np.cross(e1,e2);unit=normals/np.linalg.norm(normals,axis=1)[:,None]
    # Dominant-axis 2D barycentrics plus plane/ray distance, independent of MT edge divisions.
    omitted=np.argmax(np.abs(normals),axis=1);axes=np.array([[1,2],[0,2],[0,1]])[omitted];rows=np.arange(704)
    aa,bb=axes.T;x1,y1=e1[rows,aa],e1[rows,bb];x2,y2=e2[rows,aa],e2[rows,bb];det2=x1*y2-y1*x2
    counts=Counter();records=[]
    for face in sorted(role_for):
        clock();origin=p[face].mean(axis=0);direction=np.cross(p[face,1]-p[face,0],p[face,2]-p[face,0]);direction/=np.linalg.norm(direction)
        denominator=normals@direction;safe=np.abs(denominator)>1e-12;distance=np.zeros(704);distance[safe]=np.einsum('ij,ij->i',normals,targets[:,0]-origin)[safe]/denominator[safe]
        intersection=origin+distance[:,None]*direction;delta=intersection-targets[:,0];xx,yy=delta[rows,aa],delta[rows,bb]
        u=(xx*y2-yy*x2)/det2;v=(x1*yy-y1*xx)/det2;bary=np.column_stack((1-u-v,u,v))
        hit=safe&(distance>1e-8)&(distance<=1)&np.all((bary>=-1e-9)&(bary<=1+1e-9),axis=1);interior=hit&np.all((bary>1e-9)&(bary<1-1e-9),axis=1)
        ray_end=origin+direction;box=np.all((targets.max(axis=1)>=np.minimum(origin,ray_end)-1e-8)&(targets.min(axis=1)<=np.maximum(origin,ray_end)+1e-8),axis=1)
        cop=~safe&box&(np.abs(np.einsum('ij,ij->i',origin-targets[:,0],unit))<=1e-8)
        remaining=np.flatnonzero(hit);remaining=remaining[np.argsort(distance[remaining],kind='stable')];groups=[]
        while len(remaining):
            group=remaining[np.abs(distance[remaining]-distance[remaining[0]])<=1e-8];resolved=bool(interior[group[0]]) if len(group)==1 else True
            if len(group)>1:
                for k,i in enumerate(group):
                    for j in group[k+1:]:
                        common=sorted(set(tri[i])&set(tri[j]));resolved&=len(common)==2 and np.linalg.norm(intersection[i]-intersection[j])<=1e-8
                        if len(common)==2:
                            a,b=world[common].astype(np.float64);d=b-a
                            for point in (intersection[i],intersection[j]):
                                f=float(np.dot(point-a,d)/np.dot(d,d));resolved&=-1e-9<=f<=1+1e-9 and np.linalg.norm(point-a-f*d)<=1e-8
            groups.append((group,resolved));remaining=remaining[len(group):]
        role=role_for[face]
        if role.startswith('exposed'):label='REFUSED_EXPOSURE_SAMPLE' if any(resolved for _,resolved in groups) else 'UNKNOWN' if groups or cop.any() else 'PASS_SAMPLE'
        elif not groups:label='UNKNOWN' if cop.any() else 'REFUSED_SAMPLE'
        else:
            group,resolved=groups[0];want='outer-torso' if role=='required-torso' else 'outer-sleeve-'+role.removeprefix('required-')
            if cop.any() or not resolved:label='UNKNOWN'
            elif all(owners[int(j)]==want for j in group):label='PASS_SAMPLE'
            elif all(owners[int(j)]!=want for j in group):label='REFUSED_SAMPLE'
            else:label='UNKNOWN'
        counts[label]+=1;records.append([face,label])
    clock();return {'counts':dict(counts),'samples_reached':len(records),'selected_samples':len(records),
                    'ordered_status_sha256':hashlib.sha256(json.dumps(records,separators=(',',':')).encode()).hexdigest(),
                    'independent_domain_counts':{k:len(v) for k,v in domains.items()}}


def main():
    result=json.loads((HERE/'RESULT.json').read_text());completion=json.loads((HERE/'COMPLETE.json').read_text())
    assert completion['within_total_wall_gate'] and not completion['timeout_or_interrupt']
    pins=json.loads((HERE/'INPUTS.json').read_text());paths={Path(r['path']).name:Path(r['path']) for r in pins}
    for r in pins:
        data=Path(r['path']).read_bytes();assert len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256']
    report={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'input_pins':len(pins),'world_arrays_written':0,'method':'Read-only independent metadata/reference equations and alternative contact linear solves'}
    if result['completion']=='FIRST_REFUSAL':
        assert result.get('first_refusal');report['first_refusal']=result['first_refusal'];report['scope']='Exact preserved refusal; source/geometry independence requires root witness inspection before closure'
        if result['first_refusal'].get('witness',{}):
            witness=result['first_refusal']['witness']
            if 'world_points' in witness:
                points=np.asarray(witness['world_points']);norm=float(np.linalg.norm(np.cross(points[1]-points[0],points[2]-points[0])))
                report['independent_witness_twice_area']=norm
    else:
        blob=(HERE/'geometry.npz').read_bytes();assert len(blob)==result['archive']['bytes'] and hashlib.sha256(blob).hexdigest()==result['archive']['sha256']
        with np.load(HERE/'geometry.npz',allow_pickle=False) as archive:stored={k:archive[k] for k in archive.files}
        topo=json.loads(paths['TOPOLOGY.json'].read_text());ledger=json.loads(paths['OWNERSHIP.json'].read_text());par=json.loads(paths['PARAMETERS.json'].read_text())
        sections={s['name']:s for s in json.loads(paths['SECTION-MANIFEST.json'].read_text())['sections']};distal={s['name']:s for s in json.loads(paths['DISTAL-MANIFEST.json'].read_text())['sections']}
        outer,mat,rhs=expected_outer(topo,ledger,par,sections,distal);assert np.max(np.abs(outer-stored['world64'][:403]))<=1e-12
        assert np.array_equal(mat,stored['harmonic_matrix']) and np.max(np.abs(rhs-stored['harmonic_rhs']))<=1e-12
        tri=stored['triangles'];assert tri.dtype==np.int32 and tri.tolist()==topo['triangles']
        cross=np.cross(outer[tri[:704,1]]-outer[tri[:704,0]],outer[tri[:704,2]]-outer[tri[:704,0]])
        normals=np.array([cross[np.flatnonzero(np.any(tri[:704]==i,axis=1))].sum(axis=0) for i in range(403)]);normals/=np.linalg.norm(normals,axis=1)[:,None]
        assert np.max(np.abs(normals-stored['outer_normals']))<=1e-12
        assert np.max(np.abs(outer-.002*normals-stored['world64'][403:]))<=1e-12
        world=stored['world'];assert world.dtype==np.float32 and np.array_equal(world,stored['world64'].astype(np.float32))
        with np.load(paths['after-geometry.npz'],allow_pickle=False) as archive:body=archive['Human_world'];bt=archive['Human_triangles']
        assert digest(body)=='22022ad54de179f76350c0213e4c3ed017c76e3673ae77974976c58aee32c11c' and digest(bt)=='d0ff552960bba88368a96a0ac207ca15ec0b8b3c857c1d47db440cb0874cb8f4'
        report['mapping_max_delta']=float(np.max(np.abs(outer-stored['world64'][:403])));report['world_cast_exact']=True
        for key,self_mode in [('body_contact',False),('self_contact',True)]:
            observed=result.get(key)
            if observed and observed['complete']:
                independent=solve_contacts(world,tri,body.astype(np.float64),bt,self_mode)
                for name in independent:assert independent[name]==observed[name],(key,name,independent[name],observed[name])
                report[key]=independent
            else:report[key]='INCOMPLETE: no complete-count qualification'
        if result.get('coverage',{}).get('complete'):
            independent=verify_coverage(stored,world,tri,topo['triangle_owners'],body.astype(np.float64),bt,paths,sections,distal)
            for name in ('counts','samples_reached','selected_samples','ordered_status_sha256'):assert independent[name]==result['coverage'][name],(name,independent[name],result['coverage'][name])
            assert independent['independent_domain_counts']==result['coverage_domains']['counts'];report['coverage']=independent
        else:report['coverage']='INCOMPLETE: no complete-count qualification'
        report['geometry']='Frozen mapping/lining/cast independently reconstructed; fit/appearance unqualified'
    report['elapsed']=time.monotonic()-START;clock()
    with (HERE/'ROOT-VERIFY.json').open('x') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps({'verification':'PASS_WITH_STATED_SCOPE','elapsed':report['elapsed']}))


if __name__=='__main__':main()
