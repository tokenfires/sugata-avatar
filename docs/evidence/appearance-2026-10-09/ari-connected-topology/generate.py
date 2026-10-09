"""One original combinatorial blueprint. No physical coordinates or source decoding."""
from pathlib import Path
from collections import defaultdict, Counter
import json, hashlib, datetime, os, time

HERE = Path(__file__).resolve().parent
START = time.monotonic()
DEADLINE = datetime.datetime.fromisoformat('2026-10-09T10:55:00+00:00')

def require(value, message):
    if not value: raise RuntimeError(message)

def utc(): return datetime.datetime.now(datetime.timezone.utc)

def write(name, value):
    with (HERE/name).open('x') as f: json.dump(value, f, indent=2); f.write('\n')

def pins():
    for r in json.loads((HERE/'EXEC.json').read_text()):
        b=Path(r['path']).read_bytes()
        require(len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'], 'Input changed: '+r['path'])

def edge_map(faces):
    e=defaultdict(list)
    for fi,t in enumerate(faces):
        require(len(set(t))==3, 'Repeated triangle vertex')
        for a,b in zip(t,t[1:]+t[:1]): e[tuple(sorted((a,b)))].append((a,b,fi))
    for inc in e.values():
        require(len(inc) in [1,2], 'Edge valence')
        if len(inc)==2: require(inc[0][:2]==inc[1][:2][::-1], 'Opposite edge orientation')
    return e

def cycles(edges):
    outgoing={};incoming={}
    for a,b in edges:
        require(a not in outgoing and b not in incoming, 'Unique boundary incidence')
        outgoing[a]=b;incoming[b]=a
    require(set(outgoing)==set(incoming), 'Boundary closes')
    remaining=set(outgoing); out=[]
    while remaining:
        start=min(remaining); path=[]; x=start
        while x in remaining:
            remaining.remove(x);path.append(x);x=outgoing[x]
        require(x==start,'Boundary cycle disjoint')
        out.append(path)
    return out

def audit(vertices, faces, closed):
    require({v for t in faces for v in t}==set(range(len(vertices))), 'All vertices used')
    require(len({tuple(sorted(t)) for t in faces})==len(faces), 'Unique triangles')
    e=edge_map(faces); boundaries=cycles([x[0][:2] for x in e.values() if len(x)==1])
    require(not closed or not boundaries, 'Closed shell')
    adjacency=[set() for _ in faces]
    for inc in e.values():
        if len(inc)==2:
            a,b=inc[0][2],inc[1][2];adjacency[a].add(b);adjacency[b].add(a)
    reached={0}; todo=[0]
    while todo:
        for b in adjacency[todo.pop()]-reached: reached.add(b);todo.append(b)
    require(len(reached)==len(faces),'Connected surface')
    boundary_vertices={v for loop in boundaries for v in loop}
    links=[[] for _ in vertices]
    for t in faces:
        for j,v in enumerate(t): links[v].append(tuple(sorted((t[(j+1)%3],t[(j+2)%3]))))
    for v,link in enumerate(links):
        require(len(link)==len(set(link)), 'Unique link edges')
        g=defaultdict(set)
        for a,b in link:g[a].add(b);g[b].add(a)
        degrees=Counter(map(len,g.values()))
        if v in boundary_vertices:
            require(degrees[1]==2 and set(degrees)<= {1,2},'Boundary vertex link is a path')
        else: require(set(degrees)=={2},'Interior vertex link is a cycle')
        seen={next(iter(g))};todo=list(seen)
        while todo:
            for q in g[todo.pop()]-seen:seen.add(q);todo.append(q)
        require(seen==set(g),'Vertex link connected')
    return {'vertices':len(vertices),'triangles':len(faces),'edges':len(e),
            'euler':len(vertices)-len(e)+len(faces),'boundary_lengths':sorted(map(len,boundaries)),
            'connected_faces':len(reached),'vertex_links_checked':len(vertices)}, boundaries

def main():
    pins(); require(utc()<DEADLINE,'Window expired')
    for name in ['TOPOLOGY.json','RESULT.json']: require(not (HERE/name).exists(),'One generation only')
    vertices=[]; lookup={}; faces=[]; owners=[]
    def vertex(symbol):
        if symbol not in lookup:lookup[symbol]=len(vertices);vertices.append(list(symbol))
        return lookup[symbol]
    def quad(a,b,c,d,owner):faces.extend([[a,b,c],[a,c,d]]);owners.extend([owner,owner])
    for y in range(12):
        for x in range(24):
            if 6<=y<10 and (4<=x<8 or 16<=x<20):continue
            a,b,c,d=[vertex(('torso',xx,yy)) for xx,yy in [(x,y),(x+1,y),(x+1,y+1),(x,y+1)]]
            quad(a,b,c,d,'outer-torso')
    torso_faces=len(faces); initial=edge_map(faces)
    loops=cycles([inc[0][:2] for inc in initial.values() if len(inc)==1])
    perimeter=next(loop for loop in loops if len(loop)==72)
    holes=sorted([loop for loop in loops if len(loop)==16],key=lambda loop:min(vertices[v][1] for v in loop))
    require(len(holes)==2 and len(loops)==3,'Fixed torso perimeter/two holes')
    attachments=[]; wrist_loops=[]
    for side,hole in zip(['left','right'],holes):
        rings=[hole]
        for k in range(1,4):rings.append([vertex(('sleeve',side,k,j)) for j in range(16)])
        start=len(faces)
        for previous,current in zip(rings,rings[1:]):
            for j in range(16):
                n=(j+1)%16
                quad(previous[n],previous[j],current[j],current[n],'outer-sleeve-'+side)
        wrist_loops.append(rings[-1])
        attachments.append({'side':side,'outer_shared_ring':hole,'all_outer_rings':rings,'face_range':[start,len(faces)]})
    outer_count=len(vertices); outer_faces=len(faces)
    report, outer_boundaries=audit(vertices,faces,False)
    require(report=={'vertices':403,'triangles':704,'edges':1108,'euler':-1,'boundary_lengths':[16,16,72],'connected_faces':704,'vertex_links_checked':403},'Fixed outer counts')
    # Every declared shared edge must meet one torso and one sleeve triangle, with no cap.
    outer_edges=edge_map(faces)
    for a in attachments:
        hole=a['outer_shared_ring']
        a['shared_edge_faces']=[]
        for v,w in zip(hole,hole[1:]+hole[:1]):
            inc=outer_edges[tuple(sorted((v,w)))]; fs=[r[2] for r in inc]
            require(Counter(owners[f] for f in fs)==Counter(['outer-torso','outer-sleeve-'+a['side']]),'Shared torso/sleeve interface')
            a['shared_edge_faces'].append({'edge':[v,w],'triangles':fs})
        a['inner_shared_ring']=[v+outer_count for v in hole]
    external=[]
    for loop in outer_boundaries:
        for a,b in zip(loop,loop[1:]+loop[:1]):
            if len(loop)==72:
                x,y=vertices[a][1:];xx,yy=vertices[b][1:]
                role='hem' if y==yy==0 else 'neckline' if y==yy==12 else 'front-left' if x==xx==0 else 'front-right' if x==xx==24 else None
                require(role is not None,'Named perimeter edge')
            else:
                role='wrist-'+next(side for side,ring in zip(['left','right'],wrist_loops) if a in ring)
            external.append({'outer_edge':[a,b],'inner_edge':[b+outer_count,a+outer_count],'role':role})
    require(Counter(e['role'] for e in external)==Counter({'hem':24,'neckline':24,'front-left':12,'front-right':12,'wrist-left':16,'wrist-right':16}),'Exact boundary roles')
    vertices.extend([['inner']+symbol for symbol in vertices[:outer_count]])
    faces.extend([[v+outer_count for v in t[::-1]] for t in faces[:outer_faces]])
    owners.extend([r.replace('outer-','lining-',1) for r in owners[:outer_faces]])
    for e in external:
        a,b=e['outer_edge'];quad(b,a,a+outer_count,b+outer_count,'rim-'+e['role'])
    final, empty=audit(vertices,faces,True)
    require(final=={'vertices':806,'triangles':1616,'edges':2424,'euler':-2,'boundary_lengths':[],'connected_faces':1616,'vertex_links_checked':806},'Fixed closed material-boundary counts')
    require(time.monotonic()-START<30 and utc()<DEADLINE,'Final budget')
    pins()
    topology={'schema':'ari-original-connected-incidence-v1','coordinate_domain':'SYMBOLIC ONLY; no world positions or physical pattern',
      'vertex_symbols':vertices,'triangles':faces,'triangle_owners':owners,'outer_vertex_count':outer_count,'outer_triangle_count':outer_faces,
      'torso_triangle_count':torso_faces,'armhole_attachments':attachments,'external_boundary_edges':external,
      'qualification':'Combinatorial ownership only; embedding/lining separation/fit/appearance UNKNOWN; collar/pockets/facings/guard/trim absent'}
    write('TOPOLOGY.json',topology)
    b=(HERE/'TOPOLOGY.json').read_bytes()
    write('RESULT.json',{'utc':utc().isoformat(),'pid':os.getpid(),'elapsed_seconds':time.monotonic()-START,
      'outer':report,'closed_material_boundary':final,'shared_edges':32,'proximal_caps':0,
      'boundary_role_counts':dict(Counter(e['role'] for e in external)),
      'topology_bytes':len(b),'topology_sha256':hashlib.sha256(b).hexdigest(),'decision':'PASS incidence only; no 3D or fit admitted'})
    print('PASS original connected incidence; 806 symbolic vertices / 1616 triangles; no physical positions')

if __name__=='__main__':main()
