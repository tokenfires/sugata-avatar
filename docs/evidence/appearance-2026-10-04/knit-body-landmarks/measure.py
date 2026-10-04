"""One fixed body-only comparison from frozen saved JSON. No asset decoder/runtime import."""
from pathlib import Path
import datetime, hashlib, json, math, os, sys, traceback

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
STOP = datetime.datetime.fromisoformat('2026-10-04T18:40:00+00:00')
PARTIAL = 'docs/evidence/appearance-2026-10-04/knit-registration-repaired/PARTIAL-DATA.json'
PREVIOUS = 'docs/evidence/appearance-2026-10-04/knit-registration-inputs/'
MESH = 'docs/evidence/appearance-2026-10-04/whole-knit-serving/mesh.json'
ROLES = ['neck', 'hem', 'negative-X-cuff', 'positive-X-cuff']

def now():
    return datetime.datetime.now(datetime.timezone.utc)

def pin(path):
    b=path.read_bytes()
    return {'bytes':len(b), 'sha256':hashlib.sha256(b).hexdigest()}

def safe(value):
    if isinstance(value,float) and not math.isfinite(value): return {'nonfinite':repr(value)}
    if isinstance(value,dict): return {k:safe(v) for k,v in value.items()}
    if isinstance(value,list): return [safe(v) for v in value]
    return value

def encoded(value):
    return json.dumps(safe(value),indent=2,allow_nan=False)+'\n'

def worksheet(d):
    lines=['# Body-only registration worksheet', '', 'Status: **'+d['status']+'**. '+d.get('reason',''), '',
           'Initial source-scene skeletal origins only. Artist choices define the references and limits. This is not a fitted garment or a worn/avatar appearance result.', '',
           '## Source owner', '', 'Selection: first eligible primitive in saved default-scene traversal; all candidates retained in worksheet.json.', '',
           '`'+json.dumps(d.get('selectedOwner'))+'`', '', '## Declared landmarks', '',
           '| Role | Source mean (artist units) | Literal joint / node | Origin (m) | Artist offset (m) | Target (m) |',
           '| --- | --- | --- | --- | --- | --- |']
    for role in ROLES:
        v=d.get('landmarks',{}).get(role,{})
        cells=[role,v.get('sourceMean'),str(v.get('jointName'))+' / '+str(v.get('nodeIndex')),v.get('originMeters'),v.get('offsetMeters'),v.get('targetMeters')]
        lines.append('| '+' | '.join(json.dumps(x) if isinstance(x,list) else str(x) for x in cells)+' |')
    lines+=['', '## Fixed comparison', '', 'Identity rotation. Neck/hem Y spans set one uniform scale; translation anchors the neck.', '',
            'Metres per artist unit: `'+str(d.get('transform',{}).get('scale'))+'`.', '',
            'Translation (m): `'+json.dumps(d.get('transform',{}).get('translationMeters'))+'`.', '',
            '| Held-out role | Mapped mean (m) | Residual (mm) | Limit (mm) | Pass |',
            '| --- | --- | --- | --- | --- |']
    for role,v in d.get('residuals',{}).items():
        lines.append('| '+role+' | '+json.dumps(v['mappedMeanMeters'])+' | '+format(v['distanceMeters']*1000,'.6f')+' | '+str(v['limitMeters']*1000)+' | '+str(v['withinLimit'])+' |')
    lines+=['', 'Missing or ambiguous inputs and any failed limit close this fixed proposal. No alternative scale/offset/rotation or retry is applied.', '',
            'Exact vertex IDs, raw source rows, matching joint ordinals, matrices, operands and gates are retained in [worksheet.json](worksheet.json).', '',
            'Open: upper bra/briefs and foundation-frame agreement, body-contact surfaces, all-layer coverage, skin/morph/restPose/stage, relaxed worn geometry, physical cloth, material finish and motion.', '']
    return '\n'.join(lines)

def main():
    report={'pid':os.getpid(),'startedAt':now().isoformat(),'status':'running','authorityChecks':[],'error':None}
    d={'schema':'body-only-landmark-compatibility/1','status':'incomplete','reason':'','gates':[], 'landmarks':{},'residuals':{},'jointMatches':{}}
    code=1
    def require(ok,message):
        d['gates'].append({'message':message,'ok':bool(ok)})
        if not ok: raise ValueError(message)
    try:
        require(now()<STOP,'deadline before inputs')
        files=json.loads((HERE/'SOURCE-PINS.json').read_text())['files']
        for name,expected in files.items():
            actual=pin(ROOT/name); report['authorityChecks'].append({'path':name,'expected':expected,'actual':actual})
            require(actual==expected,'changed authority '+name)
        c=json.loads((HERE/'CONVENTION.json').read_text())
        old=json.loads((ROOT/(PREVIOUS+'ARTIST-CONVENTION.json')).read_text())
        changed=[k for k in old if c[k]!=old[k]]
        require(set(c)==set(old) and changed==['bodyAuthority','referenceFoundation','decision'],'convention delta')
        b=json.loads((ROOT/PARTIAL).read_text())['assets'][0]
        raw=b['document']; nodes=raw['nodes']; order=[]; parents={}
        def visit(i,parent=None):
            require(isinstance(i,int) and 0<=i<len(nodes) and i not in parents,'declared scene tree')
            parents[i]=parent; order.append(i)
            for child in nodes[i].get('children',[]): visit(child,i)
        scene=raw.get('scene',0)
        for i in raw['scenes'][scene]['nodes']: visit(i)
        d['sceneIndex']=scene; d['sceneTraversal']=order; d['parentMap']=parents
        require(scene==b['sceneIndex'] and order==b['sceneTraversal'] and {str(k):v for k,v in parents.items()}==b['parentMap'],'saved hierarchy correspondence')
        world=b['initialSceneGlobalMatrices']
        require(set(world)=={str(i) for i in order},'saved matrix membership')
        require(all(len(m)==4 and all(len(row)==4 and all(isinstance(x,(int,float)) and math.isfinite(x) for x in row) for row in m) for m in world.values()),'finite 4x4 matrices')
        candidates=[]; d['candidates']=candidates
        for ni in order:
            n=nodes[ni]
            if 'mesh' not in n: continue
            mi=n['mesh']; primitives=raw['meshes'][mi]['primitives']
            if 'skin' not in n: continue
            eligible=[pi for pi,v in enumerate(primitives) if v.get('targets')]
            if eligible: require(len(primitives)==1,'scoped single-primitive source owner')
            for pi in eligible: candidates.append([ni,mi,pi])
        require(candidates==b['bodyOwnerCandidates'] and len(candidates)>0,'complete ordered candidate correspondence')
        ni,mi,pi=candidates[0]; si=nodes[ni]['skin']; skin=raw['skins'][si]; joints=skin['joints']
        d['selectedOwner']={'nodeIndex':ni,'meshIndex':mi,'primitiveIndex':pi,'skinIndex':si,'nodeName':nodes[ni].get('name'),'selection':'first eligible saved-scene primitive, no live runtime object claim'}
        d['selectedSkinDescriptor']=skin
        require(len(joints)==len(set(joints)) and all(j in parents for j in joints),'selected skin joint membership')
        saved=json.loads((ROOT/(PREVIOUS+'SOURCE-LANDMARKS.json')).read_text())
        mesh=json.loads((ROOT/MESH).read_text())
        for role in ROLES:
            name=c['targetLandmarks'][role]['exactRigNodeName']
            matches=[j for j in joints if nodes[j].get('name')==name]
            d['jointMatches'][name]=matches
            d['landmarks'][role]={'jointName':name,'matchingNodeIndices':matches,'vertexIds':c['sourceLandmarks'][role]['vertexIds'],'offsetMeters':c['targetLandmarks'][role]['offsetMeters']}
        require(all(len(v)==1 for v in d['jointMatches'].values()),'unique literal joints in selected skin')
        for role in ROLES:
            v=d['landmarks'][role]; ids=v['vertexIds']; prev=saved['landmarks'][role]
            require(len(ids)>0 and len(ids)==len(set(ids)) and all(isinstance(i,int) and 0<=i<len(mesh['positions']) for i in ids),'source vertex ID membership '+role)
            rows=[mesh['positions'][i] for i in ids]; v['sourcePositionRows']=rows
            require(all(len(row)==3 and all(math.isfinite(x) for x in row) for row in rows),'finite source rows '+role)
            mean=[sum(row[k] for row in rows)/len(rows) for k in range(3)]; v['sourceMean']=mean
            require(ids==prev['vertexIds'] and rows==prev['sourcePositionRows'] and mean==prev['meanArtistUnits'] and v['jointName']==prev['targetJointName'] and v['offsetMeters']==prev['artistOffsetMeters'],'unchanged source landmarks '+role)
            j=v['matchingNodeIndices'][0]; m=world[str(j)]
            v.update({'nodeIndex':j,'node':nodes[j],'parentIndex':parents[j],'initialSceneGlobalMatrix':m,'originMeters':[m[k][3] for k in range(3)]})
            require(len(v['offsetMeters'])==3 and all(math.isfinite(x) for x in v['offsetMeters']),'finite artist offset '+role)
            v['targetMeters']=[v['originMeters'][k]+v['offsetMeters'][k] for k in range(3)]
        neck=d['landmarks']['neck']; hem=d['landmarks']['hem']
        denom=neck['sourceMean'][1]-hem['sourceMean'][1]
        d['transform']={'sourceYSpan':denom,'targetYSpan':neck['targetMeters'][1]-hem['targetMeters'][1],'rotation':'identity'}
        require(denom!=0,'nonzero source Y span')
        scale=d['transform']['targetYSpan']/denom; d['transform']['scale']=scale
        require(math.isfinite(scale) and c['transformConvention']['uniformScaleRangeMetersPerArtistUnit'][0]<=scale<=c['transformConvention']['uniformScaleRangeMetersPerArtistUnit'][1],'declared uniform scale range')
        translation=[neck['targetMeters'][k]-scale*neck['sourceMean'][k] for k in range(3)]; d['transform']['translationMeters']=translation
        for role in ROLES[1:]:
            v=d['landmarks'][role]; mapped=[scale*v['sourceMean'][k]+translation[k] for k in range(3)]
            delta=[mapped[k]-v['targetMeters'][k] for k in range(3)]
            residual=math.sqrt(math.fsum(x*x for x in delta)); limit=c['transformConvention']['residualLimitMeters'][role]
            d['residuals'][role]={'mappedMeanMeters':mapped,'targetMeters':v['targetMeters'],'deltaMeters':delta,'distanceMeters':residual,'limitMeters':limit,'withinLimit':residual<=limit}
        require(all(math.isfinite(v['distanceMeters']) for v in d['residuals'].values()),'finite residuals')
        failed=[role for role,v in d['residuals'].items() if not v['withinLimit']]
        d['status']='incompatible' if failed else 'compatible source seed'
        d['reason']='Held-out limits fail: '+', '.join(failed) if failed else 'All declared source-origin comparisons pass; fit and appearance remain open.'
        require(not failed,'fixed held-out residual limits')
        code=0
    except Exception:
        report['error']=traceback.format_exc()
        if d['status']=='incomplete': d['reason']=str(sys.exc_info()[1])
    finally:
        if now()>=STOP:
            d['status']='deadline refusal'; d['reason']='Final observation after sole-execution cutoff.'; code=1
        report['status']=d['status']; report['exitCode']=code; report['outputs']={}
        for name,content in [('worksheet.json',encoded(d)),('WORKSHEET.md',worksheet(d))]:
            try:
                (HERE/name).write_text(content); report['outputs'][name]=pin(HERE/name)
            except Exception:
                report['outputs'][name]={'writeError':traceback.format_exc()}; code=1
        report['endedAt']=now().isoformat(); report['exitCode']=code
        try: (HERE/'JOB.json').write_text(encoded(report))
        except Exception:
            report['jobWriteError']=traceback.format_exc(); code=1; report['exitCode']=code
        try: print(json.dumps(safe(report),allow_nan=False))
        except Exception:
            try: print(encoded(report),file=sys.stderr)
            except Exception: pass
            code=1
    return code

if __name__=='__main__':
    raise SystemExit(main())
