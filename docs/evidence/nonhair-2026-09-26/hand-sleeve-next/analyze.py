"""Read-only, source-bound sampled sleeve intersection diagnostic; outputs fresh files only."""
import sys,os,json,hashlib,gzip,struct,math,platform,time
from pathlib import Path
from bisect import bisect_right
from collections import Counter
from exact_triangles import intersection,shared_only,certificate,exact
HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[3]
ANALYSIS='docs/evidence/nonhair-2026-09-26/hand-candidate/native-geometry-dense-v2/analysis.json'
PINS={ANALYSIS:'5629a2cce7a42803e991706bfe735664806c8dc0324b63edc15ffbcd504ca25a',
'captures/hand-candidate-2026-09-26/candidate-dense-v2/report.json':'17ab2f601b2e921ac47ae23739805be870de0c21526aa6a52daf36bb5442730f',
'captures/hand-candidate-2026-09-26/candidate-dense-v2/manifest.json':'17e1d1e9e5d71987cb1a66eb1dc3b5b8ce8653d7d006b073389bc1d19b5de871',
'captures/hand-attribution-2026-09-26/primary-v4/report.json':'bb12301ca0fd0db5097ad8fe6221498228612c2fcd314dac4377ca686d22a74e',
'captures/hand-attribution-2026-09-26/primary-v4/manifest.json':'fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d'}
ASSETS={k:f'assets/wardrobe/{"body" if k=="body" else k}/g050.glb' for k in ['body','foundation_bra','foundation_briefs','female_casualsuit01','shoes01']}
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):return (ROOT/p).read_bytes()
def load(p):return json.loads(read(p))
def fail(condition,message):
    if not condition:raise ValueError(message)
def accessor(j,binbuf,index):
    a=j['accessors'][index];fail('sparse' not in a and not a.get('normalized'), 'Unsupported accessor')
    v=j['bufferViews'][a['bufferView']];fail(v.get('buffer',0)==0,'External buffer')
    fmts={5121:('B',1),5123:('H',2),5125:('I',4),5126:('f',4)};fmt,size=fmts[a['componentType']]
    lanes={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];stride=v.get('byteStride',lanes*size)
    start=v.get('byteOffset',0)+a.get('byteOffset',0)
    fail(start+(a['count']-1)*stride+lanes*size<=v.get('byteOffset',0)+v['byteLength']<=len(binbuf),'Accessor bounds')
    return [list(struct.unpack_from('<'+fmt*lanes,binbuf,start+i*stride)) for i in range(a['count'])]
def glb(data,vertices):
    magic,version,length=struct.unpack_from('<III',data);fail((magic,version,length)==(0x46546c67,2,len(data)),'GLB header')
    chunks={};offset=12
    while offset<len(data):
        size,kind=struct.unpack_from('<II',data,offset);offset+=8;chunks[kind]=data[offset:offset+size];offset+=size
    fail(offset==len(data),'GLB chunks');j=json.loads(chunks[0x4e4f534a]);buf=chunks[0x004e4942]
    found=[]
    for mi,m in enumerate(j['meshes']):
        for p in m['primitives']:
            if j['accessors'][p['attributes']['POSITION']]['count']==vertices:found.append((mi,p))
    fail(len(found)==1,'Unique source mesh by native vertex count');mi,p=found[0]
    fail(p.get('mode',4)==4 and not p.get('extensions'),'Triangle source primitive')
    nodes=[n for n in j['nodes'] if n.get('mesh')==mi];fail(len(nodes)==1 and 'skin' in nodes[0],'Unique native skinned mesh')
    names=[j['nodes'][n]['name'] for n in j['skins'][nodes[0]['skin']]['joints']]
    fail(len(set(names))==len(names),'Unique joint names')
    out={k:accessor(j,buf,v) for k,v in p['attributes'].items() if k in ['POSITION','JOINTS_0','WEIGHTS_0']}
    out['indices']=[v[0] for v in accessor(j,buf,p['indices'])];out['jointNames']=names
    fail(all(len(w)==4 and all(math.isfinite(x) and x>=0 for x in w) for w in out['WEIGHTS_0']),'Stored weights')
    fail(all(len(ids)==4 and all(0<=i<len(names) for i in ids) for ids in out['JOINTS_0']),'Joint IDs')
    return out

def arm_selection(source,side):
    names={f'upperarm_{side}',f'lowerarm_{side}'}
    fail(names.issubset(source['jointNames']),'Required ipsilateral arm source joints')
    weights=[sum(w for j,w in zip(ids,ws) if source['jointNames'][j] in names) for ids,ws in zip(source['JOINTS_0'],source['WEIGHTS_0'])]
    faces=[f for f in range(len(source['indices'])//3) if any(weights[i]>0 for i in source['indices'][f*3:f*3+3])]
    return faces,weights

def meshes_of(s,sources):
    fail({m['id'] for m in s['meshes']}==set(sources),'Exact five native mesh IDs');out={}
    for m in s['meshes']:
        mid=m['id'];source=sources[mid];p=m['positions'];inds=m['fullIndices']
        fail(len(p)==3*len(source['POSITION']) and all(isinstance(x,(int,float)) and math.isfinite(x) for x in p),'Finite source-sized positions')
        fail(inds==source['indices'],'Exact full source topology')
        full=[tuple(inds[i:i+3]) for i in range(0,len(inds),3)]
        fail(len(set(full))==len(full),'Unique oriented source triangles')
        drawn=m['drawnIndices'];fail(len(drawn)%3==0,'Drawn triangle count')
        drawn=[tuple(drawn[i:i+3]) for i in range(0,len(drawn),3)]
        fail(len(set(drawn))==len(drawn) and set(drawn)<=set(full),'Exact oriented drawn membership')
        ds=set(drawn);ts=[]
        for f,ids in enumerate(full):
            points=tuple(tuple(p[i*3:i*3+3]) for i in ids)
            fail(len(set(ids))==3,'Degenerate indexed triangle')
            # Exact nondegeneracy once, including broad-phase-excluded targets.
            exact(points)
            ts.append({'mesh':mid,'face':f,'ids':ids,'points':points,'drawn':ids in ds,'min':tuple(min(q[k] for q in points) for k in range(3)),'max':tuple(max(q[k] for q in points) for k in range(3))})
        out[mid]=ts
    return out

def overlap(a,b):return all(a['min'][k]<=b['max'][k] and b['min'][k]<=a['max'][k] for k in range(3))
class Index:
    def __init__(self,targets):self.targets=sorted(targets,key=lambda t:t['min'][0]);self.keys=[t['min'][0] for t in self.targets]
    def query(self,q):return [t for t in self.targets[:bisect_right(self.keys,q['max'][0])] if overlap(q,t)]
def view(t):return {k:t[k] for k in ['mesh','face','ids','points','drawn']}
def compare(queries,targets):
    index=Index(targets);counts=Counter();findings=[];shared=[]
    for a in queries:
        for b in index.query(a):
            counts['aabbPairs']+=1
            if a['mesh']==b['mesh'] and a['face']==b['face']:counts['identicalSelfFaces']+=1;continue
            h=intersection(a['points'],b['points']);counts['exactTests']+=1
            if h is None:counts['disjointAfterAABB']+=1;continue
            if shared_only(h,a,b):counts['expectedSharedSimplex']+=1;shared.append([a['face'],b['face']]);continue
            counts[h['kind']]+=1;counts['bothDrawn' if a['drawn'] and b['drawn'] else 'oneOrBothMasked']+=1
            findings.append({'query':view(a),'target':view(b),'intersection':certificate(h,a['points'],b['points'])})
    return {'queryCount':len(queries),'targetCount':len(targets),'counts':dict(counts),'expectedSharedSimplexPairs':shared,'findings':findings}

def main():
    fail(len(sys.argv)==2,'Usage: python3 analyze.py fresh-output-directory');out=Path(sys.argv[1]).resolve();fail(not out.exists(),'Fresh output required')
    bindings={};decodedbindings=[]
    def bind(p,expected=None):
        b=read(p);h=sha(b);fail(expected is None or h==expected,'Hash mismatch: '+p);bindings[p]=h;return b
    for p,h in PINS.items():bind(p,h)
    prior=json.loads(read(ANALYSIS));selected={side:sorted(set(f for row in prior['corridors'] if row['step'] in [592,593,594] for f in row['sides'][side]['allWornDistal']['certificate']['failedFaceIds'])) for side in ['l','r']}
    cases=[];reports={}
    for arm,dir,steps in [('A','captures/hand-attribution-2026-09-26/primary-v4',[592]),('D','captures/hand-candidate-2026-09-26/candidate-dense-v2',[592,593,594])]:
        r=load(dir+'/report.json');mf=load(dir+'/manifest.json');seal=json.loads(bind(dir+'/seal.json'))
        fail(r['completed'] and r['manifestSHA256']==bindings[dir+'/manifest.json']==seal['manifestSHA256'],'Completed bound capture')
        fail(bindings[dir+'/report.json']==seal['reportSHA256'],'Sealed report');fail(r['sourceHashes']==mf['sourceHashes'],'Source manifest identity')
        run=next(x for x in r['runs'] if x['arm']==arm) if arm=='A' else r
        fail(run['completed'] and run['errors']==[],'Native run status')
        fail(all(next(x for x in run['loadedAssets'] if x['file']==path)['sha256']==r['sourceHashes'][path] for path in ASSETS.values()),'Actual loaded asset bytes')
        reports[arm]=r
        for step in steps:
            ent=next(x for x in run['geometry'] if x['step']==step);p=dir+'/'+ent['file'];raw=bind(p,ent['sha256']);dec=gzip.decompress(raw);fail(sha(dec)==ent['decodedSHA256'],'Decoded geometry hash')
            s=json.loads(dec);fail(s['time']==ent['time'] and s['capture']['step']==step and s['capture']['manifestSHA256']==r['manifestSHA256'],'Native snapshot identity/clock')
            if arm=='A':fail(s['capture']['arm']=='A' and s['capture']['mode']=='primary','Baseline A capture')
            else:fail(s['capture']['candidate']=='D' and s['capture']['kind']==r['kind'],'Fixed candidate capture')
            decodedbindings.append({'file':p,'sha256':ent['sha256'],'decodedSHA256':ent['decodedSHA256']})
            cases.append((arm,step,s,p))
    first=cases[0][2];sources={}
    for mid,path in ASSETS.items():
        fail(reports['A']['sourceHashes'][path]==reports['D']['sourceHashes'][path],'Same accepted asset both runs')
        b=bind(path,reports['D']['sourceHashes'][path]);sources[mid]=glb(b,len(next(m for m in first['meshes'] if m['id']==mid)['positions'])//3)
    for p in ['exact_triangles.py','exact_triangles_test.py','analyze.py','analyze_test.py']:
        bind(str((HERE/p).relative_to(ROOT)))
    selection={'bodyFailedCorridorUnion':selected,'garmentRule':'any triangle vertex with strictly positive stored upperarm_SIDE or lowerarm_SIDE summed weight; no epsilon; unclipped full triangle','garment':{}}
    for side in ['l','r']:
        ids,weights=arm_selection(sources['female_casualsuit01'],side);vertices=sorted(set(v for f in ids for v in sources['female_casualsuit01']['indices'][f*3:f*3+3]))
        selection['garment'][side]={'faceIds':ids,'vertices':[{'id':i,'armWeight':weights[i],'joints':sources['female_casualsuit01']['JOINTS_0'][i],'weights':sources['female_casualsuit01']['WEIGHTS_0'][i]} for i in vertices],'jointNames':sources['female_casualsuit01']['jointNames'],'count':len(ids)}
    result={'version':1,'completed':False,'python':platform.python_version(),'predicate':'Independent exact rational closed-triangle intersection at stored binary64 coordinates; no epsilon','scope':'Four retained samples only; no native rerun, containment, clearance depth, severity, continuous proof or promotion. Candidate wider/less-contracted angry arms remain a visual tradeoff. A/D matched only at592.','bindings':bindings,'decodedBindings':decodedbindings,'selection':selection,'cases':[]}
    out.mkdir(parents=True)
    for arm,step,s,p in cases:
        print('Analyzing',arm,step,flush=True);meshes=meshes_of(s,sources);worn=[t for mid,ts in meshes.items() if mid!='body' for t in ts]
        entry={'arm':arm,'step':step,'time':s['time'],'snapshot':p,'meshes':{mid:{'full':len(ts),'drawn':sum(t['drawn'] for t in ts)} for mid,ts in meshes.items()},'sides':{}}
        for side in ['l','r']:
            q=[meshes['body'][f] for f in selected[side]];g=[meshes['female_casualsuit01'][f] for f in selection['garment'][side]['faceIds']]
            entry['sides'][side]={'residualBodyVsAllWorn':compare(q,worn),'residualBodyVsFullBody':compare(q,meshes['body']),'armInfluencedGarmentVsFullBody':compare(g,meshes['body'])}
            print(arm,step,side,{k:v['counts'] for k,v in entry['sides'][side].items()},flush=True)
        result['cases'].append(entry)
    for p,h in bindings.items():fail(sha(read(p))==h,'Input changed during analysis: '+p)
    result['completed']=True
    encoded=(json.dumps(result,indent=2)+'\n').encode();(out/'analysis.json.gz').write_bytes(gzip.compress(encoded,mtime=0))
    summary={'completed':True,'analysis':{'file':'analysis.json.gz','sha256':sha((out/'analysis.json.gz').read_bytes()),'decodedSHA256':sha(encoded)},'bindings':bindings,'cases':[{'arm':c['arm'],'step':c['step'],'sides':{s:{k:{'queryCount':v['queryCount'],'targetCount':v['targetCount'],'counts':v['counts']} for k,v in d.items()} for s,d in c['sides'].items()}} for c in result['cases']]}
    (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary['analysis']))
if __name__=='__main__':main()
