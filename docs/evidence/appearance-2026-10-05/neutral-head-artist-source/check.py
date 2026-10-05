"""Independent complete saved-byte gate; never imports the constructor."""
from collections import Counter, defaultdict
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import time

BASE=Path(__file__).resolve().parent
OUT=BASE/'output'


def main():
    checks=[]; results=[]; started=time.time(); reached=[]
    def require(condition, witness):
        reached.append(witness[0])
        if not condition:raise ValueError(witness)
    def pin(path):
        data=path.read_bytes();return dict(path=path.name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
    decision='B'; failure=None
    try:
        mesh=json.loads((OUT/'mesh.json').read_text());source=json.loads((BASE/'SOURCE.json').read_text())
        require(mesh['schema']=='sugata-original-neutral-head-mesh-v1',('schema',mesh['schema']))
        for row in mesh['source_inputs']:
            require(pin(BASE/row['path'])==row,('source bytes',row['path']))
        require([r['path'] for r in mesh['source_inputs']]==['SOURCE.json','SOURCE-CONTRACT.md','AUTHORING-ADDENDUM.md','CAP-ORIENTATION-ADDENDUM.md'],('source roles',))
        require(mesh['materials']==source['materials'] and mesh['material_order']==list(source['materials']),('complete materials',))
        expected_features=set(['nose_bridge','nose_tip','alar_wings','nostril_recesses','cheeks','chin','brow_ridges','eye_socket_recesses','lip_model','ears','rear','neck'])
        require(set(mesh['feature_owners'])==expected_features and set(mesh['feature_owners'].values())=={'Skin'},('source feature owners',))
        require([p['name'] for p in mesh['parts']]==['Skin','EyeLeft','EyeRight'],('complete parts',))
        expected_files=[]; all_materials=set(); obj_positions=[];obj_normals=[];obj_faces=[]
        for part in mesh['parts']:
            name=part['name'];p=part['positions'];norm=part['normals'];tri=part['triangles'];mats=part['face_materials'];ids=part['ids'];size=len(p)
            require(size==len(norm)==len(ids) and len(ids)==len(set(ids)),('vertex ownership',name))
            require(len(tri)==len(mats) and len(tri)>0,('face count',name))
            require(all(len(v)==3 and all(isinstance(x,(int,float)) and math.isfinite(x) for x in v) for v in p+norm),('finite vectors',name))
            require(all(0.9999<sum(x*x for x in v)<1.0001 for v in norm),('unit positive normals',name))
            require(all(len(t)==3 and len(set(t))==3 and all(type(i) is int and 0<=i<size for i in t) for t in tri),('indices',name))
            require(all(type(m) is int and 0<=m<len(mesh['material_order']) for m in mats),('face materials',name))
            all_materials.update(mats)
            for field,fmt,ext in [('positions','f','f32'),('normals','f','f32'),('triangles','I','u32')]:
                fname=f'{name}-{field}.{ext}';expected_files.append(fname)
                data=(OUT/fname).read_bytes();flat=[v for row in part[field] for v in row]
                require(len(data)==len(flat)*4,('binary size',name,field))
                saved=struct.unpack('<'+fmt*len(flat),data)
                require(list(saved)==flat,('all binary/json values',name,field))
            edges=defaultdict(list);links=[defaultdict(list) for _ in p];neighbors=[set() for _ in p];seen=set();area_min=math.inf;volume=0.;accum=[[0.,0.,0.] for _ in p]
            for index,(a,b,c) in enumerate(tri):
                key=tuple(sorted((a,b,c)))
                require(key not in seen,('duplicate triangle',name,index));seen.add(key)
                ab=[p[b][k]-p[a][k] for k in range(3)];ac=[p[c][k]-p[a][k] for k in range(3)]
                cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]]
                area=math.sqrt(sum(v*v for v in cross));area_min=min(area_min,area)
                require(math.isfinite(area) and area>1e-12,('double area',name,index,area))
                volume+=sum(p[a][k]*cross[k] for k in range(3))/6
                for vertex in [a,b,c]:
                    for k in range(3):accum[vertex][k]+=cross[k]
                for x,y,z in [(a,b,c),(b,c,a),(c,a,b)]:
                    edges[tuple(sorted((x,y)))].append((x,y,index))
                    neighbors[x].add(y);neighbors[y].add(x)
                    links[x][y].append(z);links[x][z].append(y)
            for edge,owners in edges.items():
                require(len(owners)==2 and owners[0][:2]==owners[1][:2][::-1],('opposed edge pair',name,edge,owners))
            visited={0};stack=[0]
            while stack:
                for v in neighbors[stack.pop()]:
                    if v not in visited:visited.add(v);stack.append(v)
            require(len(visited)==size,('one component/no unreachable',name,len(visited),size))
            for vertex,link in enumerate(links):
                require(bool(link) and all(len(ns)==2 and len(set(ns))==2 for ns in link.values()),('vertex link degree',name,vertex))
                start=next(iter(link));seen_link={start};todo=[start]
                while todo:
                    for v in link[todo.pop()]:
                        if v not in seen_link:seen_link.add(v);todo.append(v)
                require(len(seen_link)==len(link),('single link cycle',name,vertex))
                length=math.sqrt(sum(v*v for v in accum[vertex]))
                require(math.isfinite(length) and length>0,('area normal',name,vertex))
                expected=[struct.unpack('<f',struct.pack('<f',v/length))[0] for v in accum[vertex]]
                require(expected==norm[vertex],('all saved normals',name,vertex))
            require(math.isfinite(volume) and volume>0,('positive signed volume',name,volume))
            require(size-len(edges)+len(tri)==2,('closed genus zero',name,size,len(edges),len(tri)))
            if name=='Skin':
                n=source['grid']['azimuth_steps'];height=source['grid']['height_steps'];patches=source['eyes']['patches']
                expected_ids={f'grid:{j}:{u}' for j in range(height) for u in range(n) if not any(q['j_min']<j<q['j_max'] and q['u_min']<u<q['u_max'] for q in patches)}
                expected_ids.update(['bottom-pole','top-pole'])
                require(set(part['rims'])=={'left','right'},('two skin rim owners',))
                for q in patches:
                    lo,hi,bottom,top=[q[k] for k in ['u_min','u_max','j_min','j_max']]
                    order=([(bottom,u) for u in range(lo,hi+1)]+[(j,hi) for j in range(bottom+1,top+1)]+[(top,u) for u in range(hi-1,lo-1,-1)]+[(j,lo) for j in range(top-1,bottom,-1)])
                    rim=part['rims'][q['name']]
                    require(len(rim['rim'])==40 and len(set(rim['rim']))==40 and len(rim['back'])==40,('complete shared rim',q['name']))
                    require([ids[v] for v in rim['rim']]==rim['source_grid_ids']==[f'grid:{j}:{u}' for j,u in order],('shared boundary identity/order',q['name']))
                    require([ids[v] for v in rim['back']]==[f"cup:{q['name']}:{k}" for k in range(40)] and ids[rim['centre']]==f"cup:{q['name']}:centre",('cup source ids',q['name']))
                    for k in range(40):
                        nxt=(k+1)%40
                        for t in [(rim['rim'][k],rim['rim'][nxt],rim['back'][nxt]),(rim['rim'][k],rim['back'][nxt],rim['back'][k]),(rim['back'][k],rim['back'][nxt],rim['centre'])]:
                            require(tuple(sorted(t)) in seen,('cup face present',q['name'],k,t))
                    expected_ids.update([f"cup:{q['name']}:{k}" for k in range(40)]+[f"cup:{q['name']}:centre"])
                require(set(ids)==expected_ids,('complete skin source IDs',))
            else:
                az=source['eyes']['companion']['azimuth_steps'];pol=source['eyes']['companion']['polar_steps']
                require(set(ids)=={'front-pole','rear-pole'}|{f'eye:{j}:{u}' for j in range(1,pol) for u in range(az)} and part['rims']=={},('complete eye IDs',name))
            results.append(dict(part=name,vertices=size,triangles=len(tri),edges=len(edges),components=1,euler=2,minimum_double_area=area_min,signed_volume=volume))
            offset=len(obj_positions)
            obj_positions+=p;obj_normals+=norm
            obj_faces += [(name,mesh['material_order'][m],[(v+offset,v+offset) for v in t]) for t,m in zip(tri,mats)]
        require(all_materials==set(range(len(mesh['material_order']))),('all six materials reached',all_materials))
        expected_files+=['neutral-head.obj','neutral-head.mtl']
        require([r['path'] for r in mesh['files']]==expected_files,('complete output identity',))
        for row in mesh['files']:require(pin(OUT/row['path'])==row,('all output hashes',row['path']))
        read_p=[];read_n=[];read_f=[];group=None;material=None
        for line in (OUT/'neutral-head.obj').read_text().splitlines():
            fields=line.split();tag=fields[0]
            if tag=='v':read_p.append([struct.unpack('<f',struct.pack('<f',float(v)))[0] for v in fields[1:]])
            elif tag=='vn':read_n.append([struct.unpack('<f',struct.pack('<f',float(v)))[0] for v in fields[1:]])
            elif tag=='g':group=fields[1]
            elif tag=='usemtl':material=fields[1]
            elif tag=='f':read_f.append((group,material,[tuple(int(i)-1 for i in v.split('//')) for v in fields[1:]]))
            elif tag=='mtllib':require(fields==['mtllib','neutral-head.mtl'],('OBJ MTL role',))
            elif tag=='o':require(fields[1] in ['Skin','EyeLeft','EyeRight'],('OBJ object',fields))
            else:raise ValueError(('unsupported OBJ row',line))
        require(read_p==obj_positions and read_n==obj_normals and read_f==obj_faces,('complete OBJ vertices/normals/part/material/faces',))
        actual_mtl={};current=None
        for line in (OUT/'neutral-head.mtl').read_text().splitlines():
            fields=line.split()
            if fields[0]=='newmtl':current=fields[1];require(current not in actual_mtl,('duplicate MTL',current));actual_mtl[current]={}
            else:actual_mtl[current][fields[0]]=[float(v) for v in fields[1:]]
        expected_mtl={}
        for name,m in source['materials'].items():
            c=m['colour'][1:]
            expected_mtl[name]={'Kd':[int(c[k:k+2],16)/255 for k in [0,2,4]],'d':[1.0],'Pr':[m['roughness']]}
        require(actual_mtl==expected_mtl,('complete MTL',))
        decision='A numeric saved-file predicates only'
    except Exception as error:
        failure={'type':type(error).__name__,'witness':str(error)}
    report=dict(started_unix=started,ended_unix=time.time(),pid=os.getpid(),decision=decision,failure=failure,
                parts=results,predicates_reached=dict(Counter(reached)),
                limits='No independent all-coordinate analytic oracle, geometric self-intersection/embedding/skin-eye containment/anatomy/likeness/rig/fit/motion/appearance certificate. Literal evaluator is independently source-reviewed; complete IDs, byte/export/material and actual finite topology predicates checked here.',
                inputs=[pin(p) for p in sorted(OUT.iterdir()) if p.is_file() and p.name!='CHECK.json'])
    with (OUT/'CHECK.json').open('x') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps(report))
    return 0 if decision.startswith('A') else 2


if __name__=='__main__':
    raise SystemExit(main())
