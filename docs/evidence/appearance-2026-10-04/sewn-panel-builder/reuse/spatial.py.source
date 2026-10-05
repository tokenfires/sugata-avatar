"""Fixed BVHs. Triangle predicates and acceptance bounds use exact rational operands."""
import math
import exact as E

def triangle_tree(triangles):
    boxes=[E.bbox(t) for t in triangles];nodes=[]
    def make(ids):
        lo=tuple(min(boxes[j][0][i] for j in ids) for i in range(3))
        hi=tuple(max(boxes[j][1][i] for j in ids) for i in range(3))
        k=len(nodes);node={'id':k,'box':(lo,hi)};nodes.append(node)
        if len(ids)<=8:node['ids']=ids
        else:
            axis=max(range(3),key=lambda i:hi[i]-lo[i])
            ids=sorted(ids,key=lambda j:((boxes[j][0][axis]+boxes[j][1][axis])/2,j))
            m=len(ids)//2;node['children']=(make(ids[:m]),make(ids[m:]))
        return k
    if not triangles:raise ValueError('empty triangle tree')
    make(list(range(len(triangles))))
    return nodes,boxes

def overlap_ids(nodes,box):
    stack=[0]
    while stack:
        node=nodes[stack.pop()]
        if not E.boxes_overlap(box,node['box']):continue
        if 'ids' in node:yield from node['ids']
        else:stack.extend(reversed(node['children']))

def clearance_certificate(source,triangles,nodes,boxes,gate):
    """Exact threshold certificate; intentionally does not claim a global minimum."""
    box=E.bbox(source);stack=[0];pruned=[];pairs=[];worst=None
    while stack:
        node=nodes[stack.pop()];d=E.box_distance2(box,node['box'])
        if d>=gate:
            pruned.append(node['id']);continue
        if 'ids' not in node:stack.extend(reversed(node['children']));continue
        for j in node['ids']:
            bb=E.box_distance2(box,boxes[j])
            if bb>=gate:pairs.append((j,'AABB',bb));continue
            actual,witness=E.triangle_distance2(source,triangles[j])
            pairs.append((j,'triangle',actual,witness))
            if worst is None or actual<worst[0]:worst=(actual,j,witness)
            if actual<gate:return False,{'prunedNodes':pruned,'pairs':pairs,'failure':worst}
    return True,{'prunedNodes':pruned,'pairs':pairs,'minimumEvaluatedPair':worst,'kind':'threshold certificate only'}

def parity(p,d,triangles,nodes,boxes):
    stack=[0];hits=[];visited=0
    while stack:
        node=nodes[stack.pop()];visited+=1
        if not E.ray_box(p,d,node['box']):continue
        if 'ids' not in node:stack.extend(reversed(node['children']));continue
        for j in node['ids']:
            if not E.ray_box(p,d,boxes[j]):continue
            hit=E.ray_hit(p,d,triangles[j])
            if hit is not None:hits.append((j,hit))
    return len(hits)%2,{'hits':hits,'nodesVisited':visited}

def primitive_tree(primitives):
    nodes=[]
    def make(ids):
        lo=tuple(min(primitives[j]['centerBox'][0][k] for j in ids) for k in range(3))
        hi=tuple(max(primitives[j]['centerBox'][1][k] for j in ids) for k in range(3))
        node={'box':(lo,hi),'radius':max(primitives[j]['radius'] for j in ids)}
        i=len(nodes);nodes.append(node)
        if len(ids)<=8:node['ids']=ids
        else:
            axis=max(range(3),key=lambda k:hi[k]-lo[k])
            ids=sorted(ids,key=lambda j:(primitives[j]['split'][axis],primitives[j]['key']))
            m=len(ids)//2;node['children']=(make(ids[:m]),make(ids[m:]))
        return i
    if not primitives:raise ValueError('empty primitive set')
    make(list(range(len(primitives))))
    return nodes

def signed_value(q,p):
    if p['kind']=='ball':return math.sqrt(sum((q[i]-p['center'][i])**2 for i in range(3)))-p['radius']
    a,b=p['a'],p['b'];v=[b[i]-a[i] for i in range(3)]
    length=sum(x*x for x in v)
    if length<=0:raise ValueError('zero capsule')
    t=max(0.0,min(1.0,sum((q[i]-a[i])*v[i] for i in range(3))/length))
    return math.sqrt(sum((q[i]-(a[i]+t*v[i]))**2 for i in range(3)))-p['radius']

def primitive_value(q,primitives,nodes):
    best=math.inf;winner=None;visits=0;stack=[(0,-math.inf)]
    def bound(node):
        return math.sqrt(sum(max(0.0,node['box'][0][i]-q[i],q[i]-node['box'][1][i])**2 for i in range(3)))-node['radius']-1e-12
    while stack:
        i,lower=stack.pop()
        if lower>best+1e-12:continue
        node=nodes[i];visits+=1
        if 'ids' in node:
            for j in node['ids']:
                value=signed_value(q,primitives[j])
                if value<best or (value==best and (winner is None or primitives[j]['key']<primitives[winner]['key'])):
                    best,winner=value,j
        else:
            children=[(j,bound(nodes[j])) for j in node['children']]
            stack.extend(sorted(children,key=lambda v:(v[1],v[0]),reverse=True))
    if winner is None or not math.isfinite(best):raise ValueError('nonfinite/missing field value')
    return best,winner,visits
