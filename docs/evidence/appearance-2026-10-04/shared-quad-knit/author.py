"""One wholly declared metric shared-index net; no fit or old mesh execution."""
from collections import defaultdict, Counter
from datetime import datetime, timezone
from pathlib import Path
import hashlib,json,math,os,sys
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
def utc(): return datetime.now(timezone.utc).isoformat()

def save(name, value):
    (HERE/name).write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')

def sub(a,b): return [a[i]-b[i] for i in range(3)]

def dot(a,b): return math.fsum(a[i]*b[i] for i in range(3))

def mean(ps): return [math.fsum(p[i] for p in ps)/len(ps) for i in range(3)]

def edge(a,b): return tuple(sorted((a,b)))

class Refusal(Exception):
    def __init__(self,label,witness):
        super().__init__(label); self.witness=witness

def require(ok,label,witness):
    if not ok: raise Refusal(label,witness)

def incidence(faces):
    es=defaultdict(list)
    for fi,f in enumerate(faces):
        for i,a in enumerate(f):
            b=f[(i+1)%4];es[edge(a,b)].append((fi,a,b))
    return dict(es)

def connected(graph,start):
    seen={start};todo=[start]
    while todo:
        for n in graph[todo.pop()]:
            if n not in seen: seen.add(n);todo.append(n)
    return seen

def validate(points,faces,roles,expected,c,label):
    require(bool(faces),label+' empty faces',{})
    require(all(len(f)==4 and len(set(f))==4 for f in faces),label+' quad uniqueness',{})
    require(all(math.isfinite(v) for p in points for v in p),label+' finite coordinates',{})
    es=incidence(faces);used={v for f in faces for v in f};graph=defaultdict(set)
    boundary=defaultdict(set);links=defaultdict(lambda:defaultdict(set))
    for e,rows in es.items():
        require(len(rows)<=2,label+' edge manifold',{'edge':e,'rows':rows})
        if len(rows)==2: require(rows[0][1:]==rows[1][1:][::-1],label+' orientation',{'edge':e,'rows':rows})
        else:
            require(e in roles,label+' unnamed boundary',{'edge':e})
            boundary[e[0]].add(e[1]);boundary[e[1]].add(e[0])
        graph[e[0]].add(e[1]);graph[e[1]].add(e[0])
    require(connected(graph,min(used))==used,label+' connected',{'vertices':len(used)})
    require(all(len(ns)==2 for ns in boundary.values()),label+' simple boundary degree',{'bad':[(v,list(ns)) for v,ns in boundary.items() if len(ns)!=2]})
    minarea=math.inf
    for fi,f in enumerate(faces):
        for i,v in enumerate(f):
            a,b=f[(i-1)%4],f[(i+1)%4];links[v][a].add(b);links[v][b].add(a)
        for tri in [(f[0],f[1],f[2]),(f[0],f[2],f[3])]:
            a,b,z=[points[v] for v in tri];u=sub(b,a);v=sub(z,a)
            cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            area=math.hypot(*cross)/2;minarea=min(minarea,area)
            require(area>c['minimumTriangleArea'],label+' collapsed triangle',{'face':fi,'triangle':tri,'points':[a,b,z],'area':area})
    for v,link in links.items():
        degrees=sorted(len(ns) for ns in link.values())
        require(connected(link,min(link))==set(link),label+' vertex link connected',{'vertex':v,'link':{k:sorted(ns) for k,ns in link.items()}})
        ok=(degrees.count(1)==2 and all(x in (1,2) for x in degrees)) if v in boundary else all(x==2 for x in degrees)
        require(ok,label+' vertex link manifold',{'vertex':v,'degrees':degrees})
    cycles=[];pending=set(boundary)
    while pending:
        start=min(pending);walk=[start];prior=None;current=start
        while True:
            choices=sorted(boundary[current]-({prior} if prior is not None else set()))
            nxt=choices[0]
            if nxt==start: break
            require(nxt not in walk,label+' boundary revisits',{'walk':walk,'next':nxt})
            walk.append(nxt);prior,current=current,nxt
        pending-=set(walk)
        names={roles[edge(a,walk[(i+1)%len(walk)])] for i,a in enumerate(walk)}
        require(len(names)==1,label+' mixed boundary roles',{'walk':walk,'roles':sorted(names)})
        cycles.append({'role':next(iter(names)),'vertices':walk})
    require(sorted(x['role'] for x in cycles)==sorted(expected),label+' four role cycles',{'cycles':cycles})
    euler=len(used)-len(es)+len(faces);target=2 if not expected else c['requiredEuler']
    require(euler==target,label+' Euler',{'V':len(used),'E':len(es),'F':len(faces),'Euler':euler,'target':target})
    return {'V':len(used),'E':len(es),'F':len(faces),'Euler':euler,'cycles':cycles,'minimumTriangleArea':minarea,'edgeAndVertexManifold':True,'connectedOrientable':True}

def smooth(points,faces,roles):
    es=incidence(faces);fps=[mean([points[v] for v in f]) for f in faces]
    vfs=defaultdict(list);ves=defaultdict(list);boundary=set()
    for fi,f in enumerate(faces):
        for v in f:vfs[v].append(fi)
    for e,rows in es.items():
        for v in e:ves[v].append(e)
        if len(rows)==1:boundary.update(e)
    out=[]
    for v,p in enumerate(points):
        if v in boundary:out.append(p[:]);continue
        n=len(vfs[v]);f=mean([fps[i] for i in vfs[v]]);r=mean([mean([points[a],points[b]]) for a,b in ves[v]])
        out.append([(f[k]+2*r[k]+(n-3)*p[k])/n for k in range(3)])
    eids={}
    for e,rows in es.items():
        eids[e]=len(out);out.append(mean([points[e[0]],points[e[1]]]+([fps[x[0]] for x in rows] if len(rows)==2 else [])))
    fids=[]
    for p in fps:fids.append(len(out));out.append(p)
    children=[]
    for fi,f in enumerate(faces):
        for i,v in enumerate(f):children.append([v,eids[edge(v,f[(i+1)%4])],fids[fi],eids[edge(f[(i-1)%4],v)]])
    newroles={}
    for (a,b),name in roles.items():
        newroles[edge(a,eids[edge(a,b)])]=name;newroles[edge(eids[edge(a,b)],b)]=name
    return out,children,newroles

def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def unit(v):
    length=math.hypot(*v);require(length>1e-12,'degenerate authored frame',{'vector':v,'length':length})
    return [x/length for x in v]
def volume(points,faces,roles):
    triples=[]
    for f in faces:
        for tri in [(f[0],f[1],f[2]),(f[0],f[2],f[3])]:
            a,b,c=[points[v] for v in tri];triples.append(dot(a,cross(b,c))/6)
    es=incidence(faces);caprecords=[]
    for role in sorted(set(roles.values())):
        ids=sorted({v for e,r in roles.items() if r==role for v in e});centre=mean([points[v] for v in ids])
        for e,r in roles.items():
            if r!=role:continue
            _,a,b=es[e][0];term=dot(points[b],cross(points[a],centre))/6;triples.append(term);caprecords.append({'role':role,'edge':[a,b],'centre':centre,'term':term})
    return math.fsum(triples),caprecords

def run():
    c=json.loads((HERE/'ARTIST.json').read_text());raw={'started':utc(),'pid':os.getpid(),'artist':c};job={'started':raw['started'],'pid':os.getpid(),'maximumInvocations':1}
    try:
        require(datetime.now(timezone.utc)<datetime.fromisoformat(c['authorGateUTC'].replace('Z','+00:00')),'author cutoff',{'utc':utc()})
        for name,pin in json.loads((HERE/'INPUTS.json').read_text())['files'].items():
            b=(ROOT/name).read_bytes();require(len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],'input changed',{'path':name})
        points=[];faces=[];frames=[];N=c['torsoAngularCount']
        for y,w,d,z in c['torsoRowsYWidthDepthCenterZ']:
            for j in range(N):
                theta=2*math.pi*j/N;points.append([w*math.cos(theta),y,z+d*math.sin(theta)])
        omit={tuple(x) for x in c['omittedTorsoQuadRowColumns']}
        for r in range(len(c['torsoRowsYWidthDepthCenterZ'])-1):
            for j in range(N):
                if (r,j) not in omit:faces.append([N*r+j,N*(r+1)+j,N*(r+1)+(j+1)%N,N*r+(j+1)%N])
        loops={'hem':list(range(N)),'neck':list(range(6*N,7*N))};ns=c['sleeveAngularCount']
        for sign,role in [(-1,'negative-X-cuff'),(1,'positive-X-cuff')]:
            prior=c['sharedRootOldIDs'][role][:];C0=mean([points[v] for v in prior]);cs=[[sign*v[0],v[1],v[2]] for v in c['positiveSleeveCentres']];ds=[sub(cs[1],C0),sub(cs[2],cs[0]),sub(cs[2],cs[1])]
            for ri,(C,dv,radii) in enumerate(zip(cs,ds,c['sleeveRadiiUV'])):
                d=unit(dv);U=unit([-d[1]*d[0],1-d[1]*d[1],-d[1]*d[2]]);V=unit(cross(U,d));ring=[]
                frames.append({'role':role,'ring':ri,'C0':C0,'centre':C,'dInput':dv,'d':d,'U':U,'V':V,'radiiUV':radii})
                for j in range(ns):
                    theta=2*math.pi*j/ns;ring.append(len(points));points.append([C[k]+radii[0]*math.cos(theta)*U[k]+radii[1]*math.sin(theta)*V[k] for k in range(3)])
                for j in range(ns):faces.append([prior[j],ring[j],ring[(j+1)%ns],prior[(j+1)%ns]])
                prior=ring
            loops[role]=prior
        used=sorted({v for f in faces for v in f});unused=sorted(set(range(len(points)))-set(used));raw.update({'uncompactedPoints':points,'uncompactedFaces':faces,'frames':frames,'declaredLoops':loops,'usedOldIDs':used,'unusedOldIDs':unused})
        require(unused==c['removeUnusedOldIDs'],'unexpected unused source points',{'actual':unused,'expected':c['removeUnusedOldIDs']})
        renumber={v:i for i,v in enumerate(used)};ps=[points[v] for v in used];fs=[[renumber[v] for v in f] for f in faces];roles={}
        for role,loop in loops.items():
            for i,a in enumerate(loop):
                e=edge(renumber[a],renumber[loop[(i+1)%len(loop)]]);require(e not in roles,'duplicate declared boundary',{'edge':e});roles[e]=role
        raw.update({'points':ps,'faces':fs,'boundaryRoles':[[a,b,r] for (a,b),r in sorted(roles.items())]})
        checks={}
        for stage in ['raw','smooth']:
            if stage=='smooth':ps,fs,roles=smooth(ps,fs,roles)
            raw[stage+'Points']=ps;raw[stage+'Faces']=fs;raw[stage+'Roles']=[[a,b,r] for (a,b),r in sorted(roles.items())]
            check=validate(ps,fs,roles,c['roles'],c,stage);check['boundaryEdges']=sum(len(rows)==1 for rows in incidence(fs).values());expected=c['expectedRaw' if stage=='raw' else 'expectedSmooth']
            require(all(check[k]==v for k,v in expected.items()),stage+' fixed counts',{'check':check,'expected':expected})
            signed,caps=volume(ps,fs,roles);check['signedCappedVolume']=signed;raw[stage+'CheckOnlyCaps']=caps
            require(signed>0,stage+' global outward orientation',{'signedCappedVolume':signed});checks[stage]=check;raw[stage+'Check']=check
        raw['completed']=utc();save('RAW.json',raw)
        mesh={'units':c['units'],'vertices':ps,'quads':fs,'boundaryRoles':raw['smoothRoles'],'artist':c,'checks':checks,'limits':'Artist source only; no fit, material, skin, coverage/contact or motion qualification'};save('mesh.json',mesh)
        obj=['# Fresh wholly indexed A-rest artist surface; metre units; wearable unqualified']+['v '+' '.join(format(v,'.17g') for v in p) for p in ps]+['f '+' '.join(str(v+1) for v in f) for f in fs];(HERE/'sweater.obj').write_text('\n'.join(obj)+'\n')
        job.update({'status':'A artist topology only; appearance pending','completed':utc(),'checks':checks,'outputs':{}})
        for name in ['RAW.json','mesh.json','sweater.obj']:
            b=(HERE/name).read_bytes();job['outputs'][name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
        save('AUTHOR-JOB.json',job);print(json.dumps(job));return 0
    except Refusal as e:
        raw.update({'refused':str(e),'witness':e.witness,'completed':utc()});save('RAW.json',raw);job.update({'status':'B first refusal; no retry','refused':str(e),'witness':e.witness,'completed':utc()});save('AUTHOR-JOB.json',job);print(json.dumps(job));return 1

if __name__=='__main__':sys.exit(run())
