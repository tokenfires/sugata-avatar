"""One source-only garment authorship attempt. No native or runtime imports."""
from collections import defaultdict, deque
from pathlib import Path
import datetime, hashlib, json, math, os, sys, traceback

ROOT = Path.cwd()
PACKET = ROOT / 'docs/evidence/nonhair-2026-10-03/relaxed-top-source'
SOURCE = ROOT / 'docs/evidence/nonhair-2026-10-03/capsule-source/inputs/male_casualsuit02/male_casualsuit02.obj'
OUTPUT = PACKET / 'artifacts-v1'
ROOM, MAX_MOVE = 0.18, 0.35
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()

def require(value, message):
    if not value:
        raise ValueError(message)

def witness(stage, **operands):
    report['stage'] = stage
    report['gateWitness'] = operands

def add(a, b): return tuple(x+y for x,y in zip(a,b))
def sub(a, b): return tuple(x-y for x,y in zip(a,b))
def mul(a, s): return tuple(x*s for x in a)
def dot(a, b): return sum(x*y for x,y in zip(a,b))
def length(a): return math.sqrt(dot(a,a))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def smooth(t): return t*t*(3-2*t)
def mean(points): return tuple(sum(p[i] for p in points)/len(points) for i in range(3))

def parse_obj(path):
    positions, uvs, faces = [], [], []
    for line_no, line in enumerate(path.read_text().splitlines(),1):
        words = line.split()
        if not words or words[0].startswith('#'): continue
        if words[0] in ('v','vt','f'):witness('parse OBJ',file=str(path.relative_to(ROOT)),line=line_no,record=line)
        if words[0] == 'v':
            require(len(words)==4, f'Unsupported vertex at line {line_no}')
            p=tuple(map(float,words[1:])); require(all(map(math.isfinite,p)),f'Nonfinite vertex {line_no}')
            positions.append(p)
        elif words[0] == 'vt':
            require(len(words) in (3,4),f'Unsupported UV at {line_no}')
            uv=tuple(map(float,words[1:])); require(all(map(math.isfinite,uv)),f'Nonfinite UV {line_no}')
            uvs.append(uv)
        elif words[0] == 'f':
            require(len(words)==5,f'Not a quad at {line_no}')
            corners=[]
            for w in words[1:]:
                fields=w.split('/');require(len(fields)==2 and all(fields),f'Unsupported corner {line_no}: {w}')
                v,t=map(int,fields);require(v>0 and t>0,f'Nonpositive corner {line_no}')
                corners.append((v-1,t-1))
            require(len({v for v,t in corners})==4,f'Repeated corner {line_no}')
            faces.append(dict(line=line_no,corners=corners))
    require(positions and uvs and faces,'Empty source mesh')
    seen=set(); used=set()
    for f in faces:
        witness('source face authority',file=str(path.relative_to(ROOT)),face=f,totalVertices=len(positions),totalUVs=len(uvs))
        require(all(v<len(positions) and t<len(uvs) for v,t in f['corners']),f'Out of range face {f["line"]}')
        key=tuple(sorted(v for v,t in f['corners']));require(key not in seen,f'Repeated face {f["line"]}')
        seen.add(key);used.update(key)
    witness('source vertex usage',file=str(path.relative_to(ROOT)),unusedVertices=sorted(set(range(len(positions)))-used))
    require(used==set(range(len(positions))),'Unused source vertex')
    return positions,uvs,faces

def distances(adj, seeds):
    result={v:0 for v in seeds};queue=deque(seeds)
    while queue:
        v=queue.popleft()
        for w in sorted(adj[v]):
            if w not in result: result[w]=result[v]+1;queue.append(w)
    require(len(result)==len(adj),'Disconnected distance domain')
    return result

def write_obj(path, name, positions, uvs, faces):
    lines=['# Source-only authorship; no native fit, material or appearance qualification.',
           f'o {name}', 'g helper-tights']
    lines += ['v '+' '.join(format(x,'.17g') for x in p) for p in positions]
    lines += ['vt '+' '.join(format(x,'.17g') for x in uv) for uv in uvs]
    lines += ['f '+' '.join(f'{v+1}/{t+1}' for v,t in f['corners']) for f in faces]
    path.write_text('\n'.join(lines)+'\n')

def verify_saved(path, positions, uvs, faces):
    p,t,f=parse_obj(path)
    witness('saved counts',file=path.name,actual=[len(p),len(t),len(f)],expected=[len(positions),len(uvs),len(faces)])
    require(len(p)==len(positions) and len(t)==len(uvs) and len(f)==len(faces),'Saved record counts differ')
    errors=[max(abs(x-y) for x,y in zip(a,b)) for a,b in zip(p,positions)];worst=max(range(len(errors)),key=errors.__getitem__)
    witness('saved XYZ',file=path.name,index=worst,actual=p[worst],expected=positions[worst],error=errors[worst],strictBound=1e-12)
    require(errors[worst]<1e-12,'Saved XYZ differ')
    for i,(a,b) in enumerate(zip(t,uvs)):
        witness('saved UV',file=path.name,index=i,actual=a,expected=b);require(a==b,'Saved UV differs')
    for i,(a,b) in enumerate(zip(f,faces)):
        witness('saved corners',file=path.name,index=i,actual=a['corners'],expected=b['corners']);require(a['corners']==b['corners'],'Saved UV/corner association differs')

require(now()<'2026-10-03T22:27:00','Launch cutoff expired; no output directory created')
require(not OUTPUT.exists(),'Existing output refused')
require(not (PACKET/'run-v1.json').exists(),'Existing report refused')
report=dict(pid=os.getpid(),started=now(),scriptSha256=sha(Path(__file__)),planSha256=sha(PACKET/'PLAN.md'),
            inputsSha256=sha(PACKET/'INPUTS.json'),ok=False,scope='Top-only source geometry; no native/fit/appearance qualification')
OUTPUT.mkdir()
try:
    pins=json.loads((PACKET/'INPUTS.json').read_text())
    for name,expected in pins.items():
        actual=sha(ROOT/name);witness('initial pins',file=name,expected=expected,actual=actual);require(actual==expected,f'Input changed: {name}')
    p,uv,faces=parse_obj(SOURCE)
    witness('control counts',vertices=len(p),faces=len(faces),expectedVertices=2136,expectedFaces=2060)
    require(len(p)==2136 and len(faces)==2060,'Control source counts differ')
    adj={v:set() for v in range(len(p))}
    for f in faces:
        ids=[v for v,t in f['corners']]
        for a,b in zip(ids,ids[1:]+ids[:1]):adj[a].add(b);adj[b].add(a)
    components=[];remaining=set(adj)
    while remaining:
        seed=min(remaining);members=set();queue=[seed]
        while queue:
            v=queue.pop()
            if v in members:continue
            members.add(v);queue.extend(sorted(adj[v]-members))
        remaining-=members
        components.append(dict(vertices=sorted(members),maxY=max(p[v][1] for v in members)))
    report['components']=[dict(vertices=len(c['vertices']),maxY=c['maxY']) for c in components]
    require(len(components)>=2,'Combined source does not separate into top and excluded components')
    ranked=sorted(components,key=lambda c:c['maxY'],reverse=True)
    witness('component selection',components=report['components'],highestGap=ranked[0]['maxY']-ranked[1]['maxY'],minimumGap=.50)
    require(ranked[0]['maxY']-ranked[1]['maxY']>=.50,'Highest-Y top ownership is ambiguous')
    members=set(ranked[0]['vertices']);selected=[i for i,f in enumerate(faces) if f['corners'][0][0] in members]
    edges=defaultdict(list);links={v:defaultdict(list) for v in members}
    for fid in selected:
        ids=[v for v,t in faces[fid]['corners']]
        require(set(ids)<=members,'Cross-component face')
        for k,v in enumerate(ids):
            a,b=ids[(k-1)%4],ids[(k+1)%4];links[v][a].append(b);links[v][b].append(a)
        for a,b in zip(ids,ids[1:]+ids[:1]):edges[tuple(sorted((a,b)))].append((a,b,fid))
    boundary=defaultdict(set)
    for (a,b),rows in edges.items():
        witness('edge manifold/winding',edge=[a,b],directedRows=rows)
        require(len(rows) in (1,2),f'Nonmanifold edge {a}/{b}')
        if len(rows)==2:require(rows[0][:2]==tuple(reversed(rows[1][:2])),f'Inconsistent winding {a}/{b}')
        else:boundary[a].add(b);boundary[b].add(a)
    require(all(len(ns)==2 for ns in boundary.values()),'Boundary branch or endpoint')
    for v,link in links.items():
        degree=[len(ns) for ns in link.values()]
        expected=sorted([1,1]+[2]*(len(degree)-2)) if v in boundary else [2]*len(degree)
        witness('vertex link',sourceVertex=v,links=dict(link),actualDegrees=sorted(degree),expectedDegrees=expected)
        require(sorted(degree)==expected,f'Nonmanifold vertex link {v}')
        visited=set();q=[next(iter(link))]
        while q:
            x=q.pop()
            if x not in visited:visited.add(x);q.extend(link[x])
        require(visited==set(link),f'Disconnected vertex link {v}')
    loops=[];unused=set(boundary)
    while unused:
        seed=min(unused);cycle=[seed];previous=None;v=seed
        while True:
            options=sorted(boundary[v]-({previous} if previous is not None else set()))
            w=options[0]
            if w==seed:break
            require(w not in cycle,'Boundary repeats before closure')
            cycle.append(w);previous,v=v,w
        unused-=set(cycle);loops.append(dict(vertices=cycle,centroid=mean([p[v] for v in cycle])))
    euler=len(members)-len(edges)+len(selected)
    report['structural']=dict(vertices=len(members),faces=len(selected),edges=len(edges),boundaryLoops=len(loops),euler=euler)
    report['loopCandidates']=[dict(**l,minimum=tuple(min(p[v][i] for v in l['vertices']) for i in range(3)),maximum=tuple(max(p[v][i] for v in l['vertices']) for i in range(3))) for l in loops]
    witness('four-cycle topology',structural=report['structural'],loops=report['loopCandidates'])
    require(len(loops)==4 and euler==-2,'Top does not satisfy four-loop genus-zero contract')
    xmin,xmax=min(p[v][0] for v in members),max(p[v][0] for v in members)
    ymin,ymax=min(p[v][1] for v in members),max(p[v][1] for v in members)
    center,H,Y=(xmin+xmax)/2,(xmax-xmin)/2,ymax-ymin
    witness('spatial roles',lateralCenter=center,halfSpanX=H,spanY=Y,loops=report['loopCandidates'],thresholds=dict(minHalfSpan=2,minYSpan=3,cuffCentroid=.70,cuffSignedExtent=.40,cuffYDifference=.20,centralCentroid=.20,centralExtent=.60,neckHemGap=.25,cuffBelowNeck=.10))
    require(H>2 and Y>3,'Source axis/spatial domain is ambiguous')
    by_x=sorted(loops,key=lambda l:l['centroid'][0]);left,right=by_x[0],by_x[-1]
    require(center-left['centroid'][0]>.70*H and right['centroid'][0]-center>.70*H,'Cuff lateral roles ambiguous')
    require(all(p[v][0]-center<-.40*H for v in left['vertices']) and all(p[v][0]-center>.40*H for v in right['vertices']),'Cuff signed-half roles ambiguous')
    require(abs(left['centroid'][1]-right['centroid'][1])<.20*Y,'Cuff vertical roles ambiguous')
    central=by_x[1:-1]
    require(all(abs(l['centroid'][0]-center)<.20*H and all(abs(p[v][0]-center)<.60*H for v in l['vertices']) for l in central),'Central loop roles ambiguous')
    hem,neck=sorted(central,key=lambda l:l['centroid'][1])
    require(neck['centroid'][1]-hem['centroid'][1]>.25*Y,'Neck/hem vertical roles ambiguous')
    require(all(neck['centroid'][1]-l['centroid'][1]>.10*Y for l in (left,right)),'Cuffs are not below neck')
    roles=dict(neck=neck,leftCuff=left,rightCuff=right,hem=hem)
    top_adj={v:adj[v] for v in members};anchors=set(neck['vertices']+left['vertices']+right['vertices'])
    dA=distances(top_adj,anchors);dH=distances(top_adj,set(hem['vertices']))
    sums={v:(0.,0.,0.) for v in members};original_triangles=[]
    for fid in selected:
        ids=[v for v,t in faces[fid]['corners']]
        for ix in ((0,1,2),(0,2,3)):
            tri=tuple(ids[k] for k in ix);a,b,c=(p[v] for v in tri);n=cross(sub(b,a),sub(c,a))
            witness('source triangle',sourceFace=fid,sourceVertices=tri,sourceXYZ=[p[v] for v in tri],areaVector=n,areaLength=length(n),minimumAreaLength=1e-10)
            require(length(n)>1e-10,f'Collapsed source triangle {fid}/{ix}')
            original_triangles.append((fid,tri,n))
            for v in tri:sums[v]=add(sums[v],n)
    authored={};fields={}
    for v in sorted(members):
        witness('normal field',sourceVertex=v,original=p[v],normalSum=sums[v],normalLength=length(sums[v]),minimumLength=1e-10)
        require(length(sums[v])>1e-10,f'Zero/cancelling vertex normal {v}')
        normal=mul(sums[v],1/length(sums[v]));fade=smooth(min(dA[v]/4,1));hem_fade=1-smooth(min(dH[v]/3,1))
        q=add(p[v],mul(normal,ROOM*fade));q=(q[0],q[1]+(hem['centroid'][1]-q[1])*hem_fade,q[2])
        if v in anchors:q=p[v]
        witness('authored vertex',sourceVertex=v,original=p[v],authored=q,normal=normal,anchorDistance=dA[v],hemDistance=dH[v],roomFade=fade,hemFade=hem_fade,displacement=length(sub(q,p[v])),maximumDisplacement=MAX_MOVE)
        require(all(map(math.isfinite,q)),f'Nonfinite authored point {v}')
        require(length(sub(q,p[v]))<=MAX_MOVE,f'Displacement bound exceeded at {v}')
        authored[v]=q;fields[v]=dict(normal=normal,anchorDistance=dA[v],hemDistance=dH[v],roomFade=fade,hemFade=hem_fade)
    require(any(length(sub(authored[v],p[v]))>1e-10 for v in members-anchors),'No actual shape edit')
    require(all(authored[v]==p[v] for v in anchors),'Anchor changed')
    require(all(abs(authored[v][1]-hem['centroid'][1])<1e-12 for v in hem['vertices']),'Hem not straight')
    aliases=defaultdict(list)
    for v in members:aliases[p[v]].append(v)
    for ids in aliases.values():
        witness('coordinate aliases',sourceIds=ids,original=p[ids[0]],authored=[authored[v] for v in ids],tolerance=1e-10)
        require(all(length(sub(authored[v],authored[ids[0]]))<=1e-10 for v in ids),'Exact XYZ aliases separated')
    for fid,tri,original_n in original_triangles:
        a,b,c=(authored[v] for v in tri);n=cross(sub(b,a),sub(c,a))
        witness('triangle orientation',sourceFace=fid,sourceVertices=tri,originalXYZ=[p[v] for v in tri],authoredXYZ=[authored[v] for v in tri],originalAreaVector=original_n,authoredAreaVector=n,authoredAreaLength=length(n),orientationDot=dot(n,original_n),minimumAreaLength=1e-10)
        require(length(n)>1e-10 and dot(n,original_n)>0,f'Authored triangle collapsed/inverted {fid}/{tri}')
    vertex_ids=sorted(members);texture_ids=sorted({t for fid in selected for v,t in faces[fid]['corners']})
    vm={v:i for i,v in enumerate(vertex_ids)};tm={t:i for i,t in enumerate(texture_ids)}
    out_faces=[dict(corners=[(vm[v],tm[t]) for v,t in faces[fid]['corners']]) for fid in selected]
    out_uv=[uv[t] for t in texture_ids];control=[p[v] for v in vertex_ids];changed=[authored[v] for v in vertex_ids]
    write_obj(OUTPUT/'control-top.obj','control_top',control,out_uv,out_faces)
    write_obj(OUTPUT/'sugata_relaxed_knit_01.obj','sugata_relaxed_knit_01',changed,out_uv,out_faces)
    verify_saved(OUTPUT/'control-top.obj',control,out_uv,out_faces);verify_saved(OUTPUT/'sugata_relaxed_knit_01.obj',changed,out_uv,out_faces)
    ledger=dict(axis='Original unscaled OBJ; X lateral/Y up/Z front-back. Native registration and physical units unqualified.',
                parameters=dict(room=ROOM,maxMove=MAX_MOVE,anchorFadeEdges=4,hemFadeEdges=3),
                originalVertexIdsZeroBased=vertex_ids,originalTextureIdsZeroBased=texture_ids,
                faceRows=[dict(sourceFaceId=fid,sourceLine=faces[fid]['line'],sourceCorners=faces[fid]['corners'],newCorners=out_faces[k]['corners']) for k,fid in enumerate(selected)],
                boundaryRoles=roles,lateralCenter=center,halfSpanX=H,spanY=Y,anchors=sorted(anchors),
                vertexRows=[dict(sourceId=v,newId=vm[v],original=p[v],authored=authored[v],displacement=length(sub(authored[v],p[v])),**fields[v]) for v in vertex_ids],
                limits='No native matching/registration, material, mask, global self-intersection, body/foundation contact/coverage, render or appearance qualification.')
    (OUTPUT/'ownership.json').write_text(json.dumps(ledger,indent=2)+'\n')
    for name,expected in pins.items():
        actual=sha(ROOT/name);witness('final pins',file=name,expected=expected,actual=actual);require(actual==expected,f'Final input changed: {name}')
    witness('whole deadline',observed=now(),deadline='2026-10-03T22:34:00')
    require(now()<'2026-10-03T22:34:00','Whole source attempt deadline exceeded')
    report.update(ok=True,sourceVertexIds=vertex_ids,sourceFaceIds=selected,
                  changedVertices=sum(authored[v]!=p[v] for v in members),anchors=len(anchors),
                  maxDisplacement=max(length(sub(authored[v],p[v])) for v in members),
                  exactAliasGroups=sum(len(ids)>1 for ids in aliases.values()),
                  outputs={q.name:dict(bytes=q.stat().st_size,sha256=sha(q)) for q in sorted(OUTPUT.iterdir())})
except Exception as exc:
    report.update(failure=str(exc),traceback=traceback.format_exc())
finally:
    report['emittedFiles']={q.name:dict(bytes=q.stat().st_size,sha256=sha(q),status='source-geometry-only' if report['ok'] else 'unqualified-partial') for q in sorted(OUTPUT.iterdir()) if q.is_file()}
    report['finished']=now()
    (PACKET/'run-v1.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('sourceVertexIds','sourceFaceIds','traceback')}))
sys.exit(0 if report['ok'] else 1)
