"""Separate original/coverage/output checker; inert until explicit admission.

Does not import the producer or invoke the oracle. It independently owns the
original byte spans, source references, effective alias refusal and complete
instance/field/output coverage. Oracle numeric headlines alone do not pass it.
"""
from pathlib import Path
import hashlib
import json
import math
import struct
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = ROOT / 'assets/figures/figure_g100.glb'
SHA = 'c2a21d403636a81aff77969c0089c91379172c8764aabb14d1cb7de47c685811'
JSON_CAP = 64*1024*1024
TOTAL_CAP = 256*1024*1024


def require(ok, witness):
    if not ok:
        raise ValueError(witness)


def digest(b):
    return hashlib.sha256(b).hexdigest()


def load(p):
    b = p.read_bytes(); require(len(b) <= JSON_CAP, str(p)+' JSON cap')
    return json.loads(b, parse_constant=lambda c: (_ for _ in ()).throw(ValueError('nonfinite JSON '+c)))


def scalar_equal(a, b):
    if a != b:
        return False
    if a == 0 and type(a) is float and type(b) is float:
        return math.copysign(1., a) == math.copysign(1., b)
    return True


def tuple_equal(a, b):
    return len(a) == len(b) and all(scalar_equal(x, y) for x, y in zip(a, b))


def main():
    require(len(sys.argv) == 2, 'one fixed output argument')
    out = Path(sys.argv[1]).resolve(); require(out == HERE/'output', 'isolated output path')
    original = SOURCE.read_bytes(); require(len(original) == 11567784 and digest(original) == SHA, 'original pin')
    require(struct.unpack_from('<III', original) == (0x46546c67, 2, len(original)), 'original header')
    parts = []; offset = 12
    while offset < len(original):
        require(offset+8 <= len(original), 'chunk header range')
        n, tag = struct.unpack_from('<II', original, offset)
        require(n % 4 == 0 and offset+8+n <= len(original), 'chunk extent')
        parts.append({'type': tag, 'offset': offset+8, 'bytes': n, 'sha256': digest(original[offset+8:offset+8+n])})
        offset += 8+n
    require(offset == len(original) and len(parts) >= 2 and parts[0]['type'] == 0x4e4f534a and parts[1]['type'] == 0x004e4942, 'complete chunks')
    jc, bc = parts[:2]
    json_bytes = original[jc['offset']:jc['offset']+jc['bytes']]
    doc = json.loads(json_bytes.decode('utf8'))
    require((out/'source.glb').read_bytes() == original, 'whole original editable GLB')
    require((out/'source.json').read_bytes() == json_bytes, 'literal original JSON chunk')
    manifest = load(out/'manifest.json')
    expected_files = {'source.glb', 'source.json', 'accessors.json', 'ownership.json', 'world.json'}
    require(set(manifest['files']) == expected_files, 'producer file coverage')
    subtotal = 0
    for name, pin in manifest['files'].items():
        b = (out/name).read_bytes(); subtotal += len(b)
        require(len(b) == pin['bytes'] and digest(b) == pin['sha256'], 'exact output manifest '+name)
    require(subtotal == manifest['bytesBeforeManifest'], 'output byte accounting')
    require(set(p.name for p in out.iterdir()) == expected_files | {'manifest.json', 'oracle.json'}, 'no extra/partial output file')
    require(all(p.is_file() for p in out.iterdir()), 'output files only')
    before = sum(p.stat().st_size for p in out.iterdir()); require(before <= TOTAL_CAP, 'aggregate cap')
    packet, owner, world, oracle = (load(out/n) for n in ('accessors.json', 'ownership.json', 'world.json', 'oracle.json'))
    definitions = ['buffers','bufferViews','accessors','scenes','nodes','meshes','skins','materials','images','textures','samplers','animations','cameras']
    require(set(owner['allDefinitions']) == set(definitions), 'all definition families')
    for name in definitions:
        require(owner['allDefinitions'][name] == doc.get(name, []), 'complete original '+name)
    require(owner['chunks'] == parts and owner['original']['sha256'] == SHA and owner['original']['bytes'] == len(original), 'original provenance')
    accessors, views, nodes, meshes, skins = (doc.get(n, []) for n in ('accessors','bufferViews','nodes','meshes','skins'))
    require(len(packet) == len(accessors) == manifest['allOriginalAccessorCount'] == oracle['accessorCount'], 'all accessor count')
    formats = {5120: ('b',1), 5121: ('B',1), 5122: ('h',2), 5123: ('H',2), 5125: ('I',4), 5126: ('f',4)}
    shapes = {'SCALAR':(1,1),'VEC2':(2,1),'VEC3':(3,1),'VEC4':(4,1),'MAT2':(2,2),'MAT3':(3,3),'MAT4':(4,4)}
    bin_start = bc['offset']; scalar_count = 0; storages = []
    def reads(vi, off, count, stride, components, fmt, width):
        v = views[vi]
        require(off >= 0 and off+(count-1)*stride+max(components)+width <= v['byteLength'], 'independent storage extent')
        require(v['buffer'] == 0 and v.get('byteOffset', 0)+v['byteLength'] <= doc['buffers'][0]['byteLength'], 'independent buffer span')
        start = bin_start + v.get('byteOffset', 0)+off
        return [[struct.unpack_from('<'+fmt, original, start+k*stride+c)[0] for c in components] for k in range(count)]
    for ai, a in enumerate(accessors):
        p = packet[ai]; fmt, width = formats[a['componentType']]; rows, cols = shapes[a['type']]
        count, size = a['count'], rows*cols; column = (rows*width+3)//4*4 if cols > 1 else rows*width
        offsets = [c//rows*column+c%rows*width for c in range(size)]
        vi = a.get('bufferView'); off = a.get('byteOffset', 0); stride = views[vi].get('byteStride', column*cols) if vi is not None else column*cols
        raw = reads(vi, off, count, stride, offsets, fmt, width) if vi is not None else [[0]*size for _ in range(count)]
        if 'sparse' in a:
            s=a['sparse']; it=s['indices']; val=s['values']; ifmt, iw=formats[it['componentType']]
            ids=[x[0] for x in reads(it['bufferView'],it.get('byteOffset',0),s['count'],iw,[0],ifmt,iw)]
            values=reads(val['bufferView'],val.get('byteOffset',0),s['count'],column*cols,offsets,fmt,width)
            require(all(0 <= i < count for i in ids) and all(x<y for x,y in zip(ids,ids[1:])), 'independent sparse identity')
            for i, v in zip(ids, values):
                raw[i]=v
            require(p['sparse'] == {'indices':ids,'values':values,'source':s}, 'sparse source coverage')
        else:
            require(p['sparse'] is None, 'no invented sparse data')
        backing = f'allocated-accessor:{ai}' if vi is None or 'sparse' in a else f'bufferView:{vi}'
        storage={'backing':backing,'view':vi,'offset':off,'stride':stride,'componentOffsets':offsets,'componentBytes':width}
        storages.append(storage)
        require(p['storage'] == storage and p['source'] == a and p['index'] == ai and p['count'] == count and p['itemSize'] == size and p['componentType'] == a['componentType'] and p['normalized'] == a.get('normalized',False), 'full accessor provenance')
        require(len(p['raw']) == len(p['decoded']) == count and all(tuple_equal(x,y) for x,y in zip(p['raw'],raw)), 'every original raw component')
        def norm(v):
            if not a.get('normalized',False): return v
            return max(v/127.,-1.) if a['componentType']==5120 else v/255. if a['componentType']==5121 else max(v/32767.,-1.) if a['componentType']==5122 else v/65535.
        require(all(tuple_equal(x,[norm(v) for v in y]) for x,y in zip(p['decoded'],raw)), 'every decoded component')
        scalar_count += count*size
    require(scalar_count == owner['scalarCount'] == oracle['checkedRawScalars'] == oracle['checkedDecodedScalars'] and scalar_count <= 16000000, 'independent scalar coverage')
    references=[set() for _ in accessors]
    def ref(ai, witness):
        require(type(ai) is int and 0 <= ai < len(accessors), 'original accessor reference'); references[ai].add(witness)
    primitive_expect=[]; weight_owners={}; mesh_flags=[set() for _ in meshes]
    for n in nodes:
        if 'mesh' in n:
            mesh_flags[n['mesh']].add('skin' in n)
    for mi, mesh in enumerate(meshes):
        require(len(mesh_flags[mi])<=1, 'independent mixed class refusal')
        for pi, p in enumerate(mesh['primitives']):
            loc=f'meshes[{mi}].primitives[{pi}]'; attrs=p['attributes']
            for semantic, ai in attrs.items(): ref(ai,loc+'.'+semantic)
            if 'indices' in p: ref(p['indices'],loc+'.indices')
            for ti,t in enumerate(p.get('targets', [])):
                for semantic,ai in t.items(): ref(ai,loc+f'.targets[{ti}].'+semantic)
            mode=p.get('mode',4); skinned=mesh_flags[mi]=={True}
            require(not skinned or mode in (4,5,6), 'independent skinned mode refusal')
            kind='SkinnedMesh' if skinned else 'Mesh' if mode in (4,5,6) else {0:'Points',1:'LineSegments',2:'LineLoop',3:'Line'}[mode]
            ids=[v[0] for v in packet[p['indices']]['raw']] if 'indices' in p else list(range(accessors[attrs['POSITION']]['count']))
            primitive_expect.append({'mesh':mi,'primitive':pi,'source':p,'indices':ids,'class':kind,'positionCount':accessors[attrs['POSITION']]['count'],'targetCount':len(p.get('targets',[]))})
            if skinned:
                weight_owners.setdefault(attrs['WEIGHTS_0'],[]).append([mi,pi])
    for si,s in enumerate(skins):
        if 'inverseBindMatrices' in s: ref(s['inverseBindMatrices'],f'skins[{si}].inverseBindMatrices')
    for ai,anim in enumerate(doc.get('animations', [])):
        for si,s in enumerate(anim.get('samplers', [])):
            ref(s['input'],f'animations[{ai}].samplers[{si}].input'); ref(s['output'],f'animations[{ai}].samplers[{si}].output')
    require(owner['primitives'] == primitive_expect, 'complete primitive/indices/class/material provenance')
    require(len(owner['accessorReferences']) == len(references) and all(set(a)==b and len(a)==len(b) for a,b in zip(owner['accessorReferences'],references)), 'complete source reference sites')
    require(owner['weightCreationOwners'] == {str(k):v for k,v in weight_owners.items()}, 'weight creation provenance')
    # Independent interval sweep, rather than the producer's byte-set method.
    def spans(ai):
        s=storages[ai]; result=[]
        for k in range(accessors[ai]['count']):
            for c in s['componentOffsets']:
                lo=s['offset']+k*s['stride']+c; result.append((lo,lo+s['componentBytes']))
        return sorted(result)
    def overlap(a,b):
        i=j=0
        while i<len(a) and j<len(b):
            if max(a[i][0],b[j][0]) < min(a[i][1],b[j][1]): return True
            if a[i][1]<=b[j][0]: i+=1
            else: j+=1
        return False
    for wa, uses in weight_owners.items():
        require(len(uses)==1, 'independent repeated weight creation refusal')
        mi,pi=uses[0]; require(references[wa]=={f'meshes[{mi}].primitives[{pi}].WEIGHTS_0'}, 'independent cross-semantic refusal')
        if storages[wa]['backing'].startswith('bufferView:'):
            writes=spans(wa)
            for ai,s in enumerate(storages):
                if ai!=wa and s['backing']==storages[wa]['backing']:
                    require(not overlap(writes,spans(ai)), 'independent mutable component overlap refusal')
            for image in doc.get('images', []): require(image.get('bufferView')!=storages[wa]['view'], 'independent image alias refusal')
    require(len(owner['images'])==len(doc.get('images',[])), 'all image records')
    for ii,image in enumerate(doc.get('images',[])):
        v=views[image['bufferView']]; start=v.get('byteOffset',0); length=v['byteLength']
        require(owner['images'][ii]=={'index':ii,'source':image,'bufferView':image['bufferView'],'BINOffset':start,'GLBOffset':bin_start+start,'bytes':length,'sha256':digest(original[bin_start+start:bin_start+start+length]),'interpretation':'raw embedded bytes hashed only, no pixel decode'}, 'original image byte/texture provenance')
    material_uses=[]
    for mi,m in enumerate(doc.get('materials',[])):
        pbr=m.get('pbrMetallicRoughness',{})
        for role,info in [('baseColor',pbr.get('baseColorTexture')),('metallicRoughness',pbr.get('metallicRoughnessTexture')),('normal',m.get('normalTexture')),('occlusion',m.get('occlusionTexture')),('emissive',m.get('emissiveTexture'))]:
            if info is not None:
                material_uses.append({'material':mi,'role':role,'texture':info['index'],'texCoord':info.get('texCoord',0),'colorInterpretation':'sRGB' if role in ('baseColor','emissive') else 'linear-data','source':info})
    require(owner['materialTextureUses']==material_uses, 'all material texture/UV/color ownership')
    sampler_policies=[]
    for ti,t in enumerate(doc.get('textures',[])):
        sid=t.get('sampler'); s=doc.get('samplers',[])[sid] if sid is not None else {}
        sampler_policies.append({'texture':ti,'originalSampler':sid,'installedLoaderDefaults':{
            'magFilter':s.get('magFilter',9729),'minFilter':s.get('minFilter',9987),
            'wrapS':s.get('wrapS',10497),'wrapT':s.get('wrapT',10497),'flipY':False},
            'scope':'selected installed loader defaults, no image decode/upload'})
    require(owner['textureSamplerPolicies']==sampler_policies, 'original sampler/default policy ownership')
    require(owner['absentMaterialPolicy']=={'installedClass':'MeshStandardMaterial','color':[1.,1.,1.],
        'emissive':[0.,0.,0.],'metalness':1.,'roughness':1.,'transparent':False,'depthTest':True,
        'side':'FrontSide','witness':'installed GLTFLoader.createDefaultMaterial; no render qualification'}, 'explicit absent material ownership')
    selected=doc['scene']; require(owner['selectedScene']==selected, 'default scene selection')
    parents=[None]*len(nodes)
    for ni,n in enumerate(nodes):
        for child in n.get('children',[]): require(parents[child] is None,'parent uniqueness'); parents[child]=ni
    require(owner['parents']==parents, 'all original parents')
    scene_nodes=[]
    for scene in doc.get('scenes',[]):
        stack=list(scene.get('nodes',[])); members=set()
        while stack:
            ni=stack.pop(); require(ni not in members,'scene forest'); members.add(ni); stack.extend(nodes[ni].get('children',[]))
        scene_nodes.append(sorted(members))
    require(owner['sceneNodes']==scene_nodes, 'full selected/inactive scene ownership')
    expected_instances=[]; point_count=0; effective_count=0
    for ni,n in enumerate(nodes):
        if 'mesh' not in n: continue
        for pi,p in enumerate(meshes[n['mesh']]['primitives']):
            count=accessors[p['attributes']['POSITION']]['count']; point_count+=count
            expected_instances.append((ni,n['mesh'],pi,count))
            if 'skin' in n: effective_count+=4*count
    require(len(world['instances'])==len(expected_instances)==manifest['allOriginalInstanceCount']==len(oracle['instances']), 'all instance count')
    require(len(world['localMatrices'])==len(world['worldMatrices'])==oracle['nodeMatrices']==len(nodes), 'all node matrices')
    require(len(world['inverseBinds'])==len(skins), 'all inverse bind sets')
    for si,s in enumerate(skins): require(len(world['inverseBinds'][si])==len(s['joints']), 'full ordered palette')
    for record, result, (ni,mi,pi,count) in zip(world['instances'],oracle['instances'],expected_instances):
        require((record['node'],record['mesh'],record['primitive'])==(result['node'],result['mesh'],result['primitive'])==(ni,mi,pi), 'original instance order/identity')
        require(result['points']==len(record['points'])==len(record['idealShaderPoints'])==count, 'full point/diagnostic coverage')
        p=meshes[mi]['primitives'][pi]; nt=len(p.get('targets',[]))
        require(record['selectedMorphWeights']==[0.]*nt and record['sourceDefaultMorphWeights']==nodes[ni].get('weights',meshes[mi].get('weights',[0.]*nt)), 'stored versus selected morph state')
        require(record['sceneMembership']==[s for s,ns in enumerate(scene_nodes) if ni in ns], 'all instance scene ownership')
        for name in ('points','idealShaderPoints'):
            require(all(len(v)==3 and all(math.isfinite(x) for x in v) for v in record[name]), 'finite complete position fields')
        maximum={'value':0.,'vertex':None,'axis':None}
        for vi,(a,b) in enumerate(zip(record['points'],record['idealShaderPoints'])):
            for axis in range(3):
                error=abs(a[axis]-b[axis])
                if error>maximum['value']: maximum={'value':error,'vertex':vi,'axis':axis}
        require(record['maxCpuIdealShaderDifference']==maximum, 'unfiltered ideal shader residual/witness')
        require(record['bounds']=={'min':[min(v[c] for v in record['points']) for c in range(3)],'max':[max(v[c] for v in record['points']) for c in range(3)]}, 'full all-point bounds')
        if 'skin' in nodes[ni]:
            wa=p['attributes']['WEIGHTS_0']; weights=packet[wa]['decoded']
            require(len(record['effectiveWeights'])==len(record['weightSums'])==count, 'all typed weight rows')
            zeros=[i for i,w in enumerate(weights) if not any(w)]
            changed=[i for i,(a,b) in enumerate(zip(weights,record['effectiveWeights'])) if not tuple_equal(a,b)]
            require(record['zeroRows']==zeros and record['changedRows']==changed, 'all source zero/changed rows')
            maximum_weight={'value':0.,'vertex':None,'component':None}
            for vi,(a,b) in enumerate(zip(weights,record['effectiveWeights'])):
                require(len(b)==4 and all(math.isfinite(x) and x>=0 for x in b), 'finite effective weights')
                for c,(x,y) in enumerate(zip(a,b)):
                    error=abs(x-y)
                    if error>maximum_weight['value']: maximum_weight={'value':error,'vertex':vi,'component':c,'source':x,'effective':y}
            require(record['maxSourceEffectiveWeightDifference']==maximum_weight, 'source/effective weight residual/witness')
        else:
            require(record['effectiveWeights']==record['weightSums']==record['zeroRows']==record['changedRows']==[], 'unskinned no invented weights')
        require(result['maxAbsoluteError']<=1e-9 and math.isfinite(result['maxAbsoluteError']), 'every instance CPU criterion')
    require(point_count==world['totalPoints']==oracle['checkedPoints'] and point_count<=4000000, 'all point coverage')
    require(oracle['checkedIdealShaderLedgerPoints']==point_count, 'all independent ideal shader source-ledger points')
    require(effective_count==oracle['checkedEffectiveWeightComponents'], 'independent typed weight coverage')
    require(oracle['tolerance']==world['matrixPositionCpuCriterion']==1e-9 and oracle['warnings']==[], 'fixed threshold/no warning')
    for maximum in ('maxMatrix','maxPosition','maxIdealShaderLedgerError'):
        require(math.isfinite(oracle[maximum]['value']) and oracle[maximum]['value']<=1e-9, 'global fixed CPU criterion')
    report={'verdict':'A independent original/decoded/reference/owner/alias/packet coverage only',
            'source':{'bytes':len(original),'sha256':digest(original)},'accessors':len(accessors),'scalars':scalar_count,
            'instances':len(expected_instances),'points':point_count,'imagesHashedOnly':len(owner['images']),
            'allSourceFamilies':definitions,'outputBytesBeforeCheck':before,
            'limits':'No whole-asset conformity, actual image decode/native/GPU/anatomy/rig/motion/appearance or adoption qualification'}
    b=(json.dumps(report,allow_nan=False,separators=(',',':'))+'\n').encode()
    require(len(b)<=JSON_CAP and before+len(b)<=TOTAL_CAP, 'final output cap')
    with (out/'check.json').open('xb') as f: f.write(b)
    print(json.dumps({'checker':'complete original and output coverage','points':point_count,'scalars':scalar_count,'bytes':before+len(b)}))


if __name__ == '__main__':
    main()
