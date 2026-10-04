"""One unitless flat-piece authorship job. No folding, body or mesh operations."""
from pathlib import Path
from collections import defaultdict
import datetime, hashlib, json, math, os, sys, traceback
from xml.sax.saxutils import escape

P = Path(__file__).resolve().parent
DEADLINE = datetime.datetime(2026, 10, 4, 14, 35, tzinfo=datetime.timezone.utc)

class Refusal(Exception):
    pass

class Union:
    def __init__(self, names):
        self.parent = {x: x for x in names}
    def root(self, x):
        while self.parent[x] != x:
            x = self.parent[x]
        return x
    def join(self, a, b):
        a, b = self.root(a), self.root(b)
        if a != b:
            self.parent[max(a, b)] = min(a, b)

def quad_length(width, control_depth):
    b = 2 * control_depth
    return .5 * math.hypot(width, b) + width * width / (2 * b) * math.asinh(b / width)

def point(e, t, vertices):
    a, b = vertices[e['from']], vertices[e['to']]
    if e['kind'] == 'line':
        return [(1-t)*a[k]+t*b[k] for k in range(2)]
    c = e['control']
    return [(1-t)**2*a[k]+2*(1-t)*t*c[k]+t*t*b[k] for k in range(2)]

def author(job):
    def check(ok, name, **witness):
        job['checks'].append({'check': name, 'okay': bool(ok), 'witness': witness})
        if not ok:
            raise Refusal(name)
    now = datetime.datetime.now(datetime.timezone.utc)
    check(now < DEADLINE, 'within deadline', actual=now.isoformat(), deadline=DEADLINE.isoformat())
    bindings = json.loads((P/'INPUTS.json').read_text())['pins']
    for filename, binding in bindings.items():
        data = Path(filename).read_bytes()
        check(hashlib.sha256(data).hexdigest() == binding['sha256'], 'input hash', file=filename)
    job['inputs'] = bindings
    for filename in ('pattern.json', 'pattern.svg'):
        check(not (P/filename).exists(), 'no prior candidate overwrite', file=filename)
    check(0 < 20 < 60 < 200 < 536 < 600 and 60 < 200,
          'simple monotone neck cuts inside body bounds', neck_depths=[60,20], underarm=200, hem=600)

    lf, lb = quad_length(120,120), quad_length(120,40)
    body = [[-200,40],[-60,0],[60,0],[200,40],[200,200],[200,600],[-200,600],[-200,200]]
    sleeve = [[-160,0],[0,0],[160,0],[80,400],[-80,400]]
    band = [[0,0],[lf+lb,0],[lf+lb,26],[lf,26],[0,26]]
    definitions = [('F','Front',1,body),('B','Back',-1,body),
                   ('L','Left sleeve',-1,sleeve),('R','Right sleeve',1,sleeve),('N','Neck band',1,band)]
    body_roles = ['shoulder left','neck','shoulder right','armhole right',
                  'body side right','hem free','body side left','armhole left']
    sleeve_roles = ['front attachment','back attachment','underarm back','cuff free','underarm front']
    band_roles = ['neck free','band end right','back neck attachment','front neck attachment','band end left']
    body_names = ['outer shoulder left','neck left','neck right','outer shoulder right',
                  'underarm right','hem right','hem left','underarm left']
    sleeve_names = ['front underarm','shoulder join','back underarm','back cuff','front cuff']
    band_names = ['free left','free right','neck left at band right end','neck right','neck left at band left end']
    vertices, semantics, edges, pieces = {}, {}, {}, []
    for pid, title, orientation, coords in definitions:
        names = body_names if pid in ('F','B') else sleeve_names if pid in ('L','R') else band_names
        roles = body_roles if pid in ('F','B') else sleeve_roles if pid in ('L','R') else band_roles
        nodes = [f'{pid}:v{i}' for i in range(len(coords))]
        for n, xy, meaning in zip(nodes, coords, names):
            vertices[n] = list(xy); semantics[n] = meaning
        edge_ids = []
        for i, node in enumerate(nodes):
            end = nodes[(i+1)%len(nodes)]; eid = f'{pid}{i+1:02d}'
            a,b = (node,end) if orientation == 1 else (end,node)
            e = {'id':eid,'piece':pid,'role':roles[i],'canonical_from':node,'canonical_to':end,
                 'from':a,'to':b,'kind':'line','control':None}
            if pid in ('F','B') and i == 1:
                depth = 120 if pid == 'F' else 40
                e.update(kind='quadratic', control=[0,depth], lengthAU=quad_length(120,depth))
            else:
                e['lengthAU'] = math.dist(vertices[a],vertices[b])
            edges[eid]=e; edge_ids.append(eid)
        sampled=[]
        for eid in edge_ids:
            e=dict(edges[eid]); e['from']=e['canonical_from']; e['to']=e['canonical_to']
            sampled.extend(point(e,j/128,vertices) for j in range(128))
        area=.5*sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(sampled,sampled[1:]+sampled[:1]))
        check(all(math.isfinite(x) for xy in coords for x in xy) and area>0,
              'finite positive canonical piece', piece=pid, sampledAreaAU2=area)
        pieces.append({'id':pid,'title':title,'orientation':orientation,'vertices':nodes,
                       'edges':edge_ids,'sampledCanonicalAreaAU2':area,
                       'integratedTrimIntent': 'hem' if pid in ('F','B') else 'cuff' if pid in ('L','R') else 'neck band'})

    pairs=[('F01','B01','shoulder left'),('F03','B03','shoulder right'),
           ('F07','B07','body side left'),('F05','B05','body side right'),
           ('F08','L01','left sleeve front'),('B08','L02','left sleeve back'),
           ('F04','R01','right sleeve front'),('B04','R02','right sleeve back'),
           ('L03','L05','left sleeve underarm'),('R03','R05','right sleeve underarm'),
           ('N02','N05','band ends'),('F02','N04','front neck'),('B02','N03','back neck')]
    free={'F06':'hem','B06':'hem','L04':'left cuff','R04':'right cuff','N01':'neck'}
    used=[]; seams=[]; vu=Union(vertices); gu=Union(f'{eid}:{end}'for eid in edges for end in ('start','end'))
    face_adj=defaultdict(list)
    for i,(first,second,role) in enumerate(pairs):
        a,b=edges[first],edges[second]; sid=f'S{i+1:02d}'; delta=abs(a['lengthAU']-b['lengthAU'])
        check(first not in used and second not in used and first!=second, 'unique paired edges', seam=sid, edges=[first,second])
        check(delta<=1e-9, 'equal authored seam length', seam=sid, lengthsAU=[a['lengthAU'],b['lengthAU']], deltaAU=delta, limitAU=1e-9)
        used.extend([first,second]); a['seam']=sid; b['seam']=sid
        endpoint_pairs=[[a['from'],b['to']],[a['to'],b['from']]]
        for u,v in endpoint_pairs:vu.join(u,v)
        gu.join(first+':start',second+':end'); gu.join(first+':end',second+':start')
        face_adj[a['piece']].append(b['piece']); face_adj[b['piece']].append(a['piece'])
        seams.append({'id':sid,'role':role,'edges':[first,second],'reverseBoundaryDirection':True,
                      'endpointPairs':endpoint_pairs,'lengthsAU':[a['lengthAU'],b['lengthAU']],
                      'lengthDeltaAU':delta,'correspondence':'reversed normalized arclength intent, no 3D coincidence or physical stretch claim'})
    check(set(used).isdisjoint(free) and set(used)|set(free)==set(edges) and len(used)==26,
          'complete exclusive edge responsibility', paired=len(used), free=free, total=len(edges))
    seen=set(); pending=['F']
    while pending:
        n=pending.pop()
        if n not in seen:seen.add(n);pending.extend(face_adj[n])
    check(seen==set(x['id']for x in pieces), 'connected abstract patches', reached=sorted(seen))

    free_adj=defaultdict(list)
    for eid,name in free.items():
        e=edges[eid]; a,b=vu.root(e['from']),vu.root(e['to'])
        free_adj[a].append((b,eid));free_adj[b].append((a,eid)); e['freeOpening']=name
    check(all(len(v)==2 for v in free_adj.values()),'free boundary degree two', degrees={k:len(v)for k,v in free_adj.items()})
    loops=[]; visited=set()
    for initial in sorted(free_adj):
        if initial in visited:continue
        stack=[initial]; loop_nodes=set(); loop_edges=set()
        while stack:
            n=stack.pop()
            if n in loop_nodes:continue
            loop_nodes.add(n)
            for other,eid in free_adj[n]:loop_edges.add(eid);stack.append(other)
        visited|=loop_nodes; names={free[eid]for eid in loop_edges}
        check(len(names)==1,'single owned free-loop role',edges=sorted(loop_edges),names=sorted(names))
        loops.append({'name':next(iter(names)),'vertices':sorted(loop_nodes),'edges':sorted(loop_edges)})
    check(len(loops)==4 and {x['name']for x in loops}=={'neck','left cuff','right cuff','hem'},'four named opening loops',loops=loops)

    links=defaultdict(lambda:defaultdict(list))
    for piece in pieces:
        for node in piece['vertices']:
            incident=[eid for eid in piece['edges']if node in (edges[eid]['from'],edges[eid]['to'])]
            check(len(incident)==2,'two incident edges per source corner',node=node,edges=incident)
            germs=[gu.root(eid+(':start'if edges[eid]['from']==node else ':end'))for eid in incident]
            graph=links[vu.root(node)];a,b=germs;graph[a].append(b);graph[b].append(a)
    link_reports=[]
    for v,graph in sorted(links.items()):
        reached=set();stack=[next(iter(graph))]
        while stack:
            n=stack.pop()
            if n not in reached:reached.add(n);stack.extend(graph[n])
        degrees=[len(x)for x in graph.values()];boundary=v in free_adj
        okay=len(reached)==len(graph) and all(d in (1,2)for d in degrees) and degrees.count(1)==(2 if boundary else 0)
        check(okay,'abstract manifold corner link',vertex=v,boundary=boundary,degrees=degrees,connected=len(reached)==len(graph))
        link_reports.append({'vertex':v,'boundary':boundary,'germDegrees':degrees,'kind':'path'if boundary else'cycle'})
    counts={'V':len({vu.root(v)for v in vertices}),'E':len(edges)-len(seams),'F':len(pieces)}
    counts['Euler']=counts['V']-counts['E']+counts['F']
    check(counts=={'V':11,'E':18,'F':5,'Euler':-2},'declared abstract quotient counts',counts=counts)
    equivalences=defaultdict(list)
    for node in vertices:equivalences[vu.root(node)].append(node)
    result={'units':'unitless art units AU, newly authored proportions; no physical dimensions',
            'qualification':'editable 2D artist draft and abstract oriented seam quotient only; no manufacture/folding/fit/3D surface/Avatar acceptance',
            'vertices':vertices,'vertexSemantics':semantics,'edges':edges,'pieces':pieces,'seams':seams,
            'freeLoops':loops,'cornerEquivalences':dict(equivalences),'cornerLinks':link_reports,'quotientCounts':counts,
            'shapeChoices':{'bodyWidthAU':400,'bodyHeightAU':600,'shoulderDropAU':40,'armholeLengthPerBodyFaceAU':160,
                            'sleeveLengthAU':400,'sleeveCapWidthAU':320,'cuffWidthAU':160,'neckControlDepthAU':{'front':120,'back':40},
                            'hemAndCuffTrimIntentAU':64,'neckBandHeightAU':26},
            'limits':'No metric inference from the image, pattern/source inheritance, cloth/stretch simulation, 3D embedding, body/foundation/masks/weights/skinning or motion.'}
    svg=render_svg(result)
    check(datetime.datetime.now(datetime.timezone.utc)<DEADLINE,'before output deadline')
    for name,content in [('pattern.json',json.dumps(result,indent=2)+'\n'),('pattern.svg',svg)]:
        path=P/name;path.write_text(content);data=path.read_bytes()
        job['outputs'].append({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    job['counts']=counts;job['openingLoops']=loops

def render_svg(data):
    vertices,edges=data['vertices'],data['edges'];groups=[]
    layouts={'F':(215,175,.55),'B':(535,175,.55),'L':(810,175,.55),'R':(1090,175,.55),'N':(740,510,1)}
    def command(e, canonical=False):
        a=vertices[e['canonical_from']if canonical else e['from']];b=vertices[e['canonical_to']if canonical else e['to']]
        mid=('Q '+ ' '.join(map(str,e['control']))+' ')if e['kind']=='quadratic'else'L '
        return f'M {a[0]} {a[1]} {mid}{b[0]} {b[1]}'
    for piece in data['pieces']:
        pid=piece['id'];tx,ty,scale=layouts[pid];segments=[]
        for eid in piece['edges']:
            e=edges[eid];b=vertices[e['canonical_to']]
            if not segments:segments.append('M '+' '.join(map(str,vertices[e['canonical_from']])))
            segments.append(('Q '+' '.join(map(str,e['control']))+' 'if e['kind']=='quadratic'else'L ')+' '.join(map(str,b)))
        segments.append('Z');g=[f'<g transform="translate({tx} {ty}) scale({scale})"><path d="'+ ' '.join(segments)+'" fill="#d8e5ee" stroke="#566873" stroke-width="2"/>']
        if pid in ('F','B'):g.append('<rect x="-200" y="536" width="400" height="64" fill="#b8ccdc"/><path d="M -200 536 L 200 536" stroke="#839aaa" stroke-dasharray="5 4"/>')
        if pid in ('L','R'):g.append('<path d="M -92.8 336 L 92.8 336 L 80 400 L -80 400 Z" fill="#b8ccdc" stroke="#839aaa" stroke-dasharray="5 4"/>')
        for eid in piece['edges']:
            e=edges[eid];free='freeOpening'in e;color='#276eb5'if free else'#a25941'
            g.append(f'<path d="{command(e)}" fill="none" stroke="{color}" stroke-width="3" marker-end="url(#arrow)"/>')
            ce=dict(e);ce['from']=e['canonical_from'];ce['to']=e['canonical_to'];m=point(ce,.5,vertices);a=vertices[ce['from']];b=vertices[ce['to']];dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy);off=26 if scale<1 else 14
            x=m[0]+off*dy/length;y=m[1]-off*dx/length
            label=eid+('/free'if free else'/'+e['seam'])
            g.append(f'<text x="{x}" y="{y}" text-anchor="middle" dominant-baseline="middle" font-size="{22 if scale<1 else 14}" fill="{color}">{escape(label)}</text>')
        g.append('</g>');groups.extend(g)
        title=piece['title']+' '+pid+(' (+)'if piece['orientation']==1 else' (−)')
        groups.append(f'<text x="{tx if pid!= "N" else tx+150}" y="{148 if pid!="N" else 480}" text-anchor="middle" font-size="17" font-weight="600">{escape(title)}</text>')
    legends=[]
    for i,s in enumerate(data['seams']):
        col=i//5;row=i%5;x=[25,445,870][col];y=602+row*19
        text=s['id']+' '+s['edges'][0]+' ↔ '+s['edges'][1]+' · '+s['role']
        legends.append(f'<text x="{x}" y="{y}" font-size="14">{escape(text)}</text>')
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><title>Editable five-piece artist draft</title><desc>Unitless flat outlines and reversed seam pairings; no sewing, folding, body fit or garment acceptance.</desc><style>text{font-family:Arial,sans-serif;fill:#263945}svg{background:#faf8f2}a{fill:#276eb5}</style><defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 Z" fill="#566873"/></marker></defs><rect width="1280" height="720" fill="#faf8f2"/><text x="25" y="38" font-size="27" font-weight="600">Editable artist draft · five complete flat pieces</text><text x="25" y="67" font-size="17">New unitless art coordinates. No sewing, folding, body fit or accepted garment.</text><text x="25" y="94" font-size="15">Arrows follow each patch orientation; red edges pair in reverse. Blue edges own the four intended openings.</text>'+''.join(groups)+'<text x="25" y="558" font-size="15">Rib shading is integrated cuff/hem material intent. Neck band is a separate declared piece.</text><text x="25" y="582" font-size="15" font-weight="600">Thirteen complete pairing responsibilities · neck / left cuff / right cuff / hem stay free</text>'+''.join(legends)+'<text x="25" y="708" font-size="14">Abstract joined-patch graph only: V11 E18 F5 Euler−2. Physical shape, stretch, manufacture and fit remain unqualified.</text></svg>\n'

def main():
    if (P/'AUTHOR-JOB.json').exists():
        print('Prior owned authoring receipt exists; no overwrite or replay.')
        return 2
    job={'pid':os.getpid(),'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
         'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'checks':[],'outputs':[],'scope':'one 2D artist authoring job, no 3D/folding/body operations'}
    exitcode=0
    try:author(job)
    except Exception as error:
        exitcode=1;job['failure']={'type':type(error).__name__,'message':str(error),'traceback':traceback.format_exc()}
    finally:
        job['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();job['exitCode']=exitcode
        (P/'AUTHOR-JOB.json').write_text(json.dumps(job,indent=2)+'\n')
        print(json.dumps({'pid':job['pid'],'startedAt':job['startedAt'],'endedAt':job['endedAt'],'exitCode':exitcode,'outputs':job['outputs'],'failure':job.get('failure')}))
    return exitcode

if __name__=='__main__':
    sys.exit(main())
