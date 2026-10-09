"""Prospective predictions from immutable stored arrays, before native setters."""
from pathlib import Path
import json,hashlib,copy,datetime,io
import numpy as np
P=Path(__file__).resolve().parent
B=P.parent
def require(v,label):
    if not v:raise RuntimeError(label)
def digest(a):return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()
def write(name,v):
    data=(json.dumps(v,indent=2,allow_nan=False)+'\n').encode();require(len(data)<=8388608,'8MiB JSON')
    with (P/name).open('xb') as f:f.write(data)
for row in json.loads((P/'INPUTS.json').read_text())['pins']:
    data=Path(row['path']).read_bytes();require(len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],'Physical input '+row['path'])
cc=json.loads((B/'ari-mixed-source/CONTRACT.json').read_text())
source=json.loads((B/'ari-roughness-response/COLD-OBSERVED.json').read_text())
support=json.loads((B/'ari-smile-support/SUPPORT.json').read_text());inputs={}
with np.load(B/'ari-smile-support/work/coordinates.npz',allow_pickle=False) as archive:
    require(set(archive.files)==set(cc['existing_arrays']),'Exactly9 old members')
    for member,row in cc['existing_arrays'].items():
        a=archive[member];require(a.dtype==np.dtype('float32') and list(a.shape)==row['shape'] and np.isfinite(a).all() and digest(a)==row['sha256'],'Prior9 exact raw identity')
        inputs[(row['owner'],row['key_name'])]=a
with np.load(B/'ari-mixed-source/work/coordinates.npz',allow_pickle=False) as archive:
    require(set(archive.files)=={'raw'+str(i) for i in range(18)}|{'compiled'+str(i) for i in range(3)},'Exact prior21 members')
    for i,row in enumerate(cc['acquire']):
        a=archive['raw'+str(i)];sig=row['key_record'];require(a.dtype==np.dtype('float32') and a.shape==(sig['vertices'],3) and np.isfinite(a).all() and digest(a)==sig['coordinates_sha256'],'Prior18 exact raw identity')
        inputs[(row['owner'],sig['name'])]=a
require(len(inputs)==27 and sum(a.size for a in inputs.values())==1210320,'Full27 input closure')
nominal=0.2;value=float(np.float32(nominal));require(value==0.20000000298023224,'Literal Float32 nominal0.2')
targets=[];paths=[];expected=copy.deepcopy(source)
objects={o['name']:i for i,o in enumerate(source['scene']['objects'])}
for name in cc['owners']:
    present=next(r for r in support['owners'] if r['owner']==name)
    require(present['use_relative'] and present['reference_key']=='Basis','Known relative/reference')
    for key in ['mouthSmileLeft','mouthSmileRight']:
        index=next(i for i,m in enumerate(source['metadata'][name]) if m['name']==key);m=source['metadata'][name][index]
        require(m['value']==0 and not m['mute'] and not m['vertex_group'] and m['relative']=='Basis' and m['min']<=value<=m['max'],'Exact owned key baseline/mode/slider')
        target={'owner':name,'key':key,'index':index,'baseline':0.0,'value':value};targets.append(target)
        for path in [['metadata',name,index,'value'],['scene','objects',objects[name],'mesh','shape_keys',index,'value']]:
            cur=expected
            for part in path[:-1]:cur=cur[part]
            require(cur[path[-1]]==0,'Literal zero value copy');cur[path[-1]]=value;paths.append(path)
def compile_owner(name,overrides):
    a=inputs[(name,'Basis')].astype(np.float64)
    for m in source['metadata'][name][1:]:
        v=overrides.get((name,m['name']),m['value'])
        if not m['mute'] and v:
            require(not m['vertex_group'],'Unmasked native-order term')
            a+=(inputs[(name,m['name'])].astype(np.float64)-inputs[(name,m['relative'])].astype(np.float64))*v
            require(np.isfinite(a).all(),'Finite Float64 prediction')
    out=a.astype(np.float32);require(np.isfinite(out).all(),'Finite single finalFloat32');return out
predictions={};records={};baseline={};overrides={(r['owner'],r['key']):value for r in targets}
for i,name in enumerate(cc['owners']):
    old=compile_owner(name,{});require(digest(old)==cc['expected_mixed_sha256'][name],'Exact unchanged baseline first')
    new=compile_owner(name,overrides);require(digest(new)!=digest(old),'Non-null prospective mixed '+name)
    member='mixed'+str(i);predictions[member]=new;baseline[name]=digest(old)
    records[name]={'member':member,'shape':list(new.shape),'dtype':'float32','sha256':digest(new),'baseline_sha256':digest(old)}
expected['mixed_sha256']=records['Human']['sha256'];paths.append(['mixed_sha256'])
def diffs(a,b,path=()):
    require(type(a)==type(b),'Same full source types')
    if isinstance(a,dict):
        require(a.keys()==b.keys(),'Same dict keys');return [x for k in a for x in diffs(a[k],b[k],path+(k,))]
    if isinstance(a,list):
        require(len(a)==len(b),'Same source list counts');return [x for i in range(len(a)) for x in diffs(a[i],b[i],path+(i,))]
    return [list(path)] if a!=b else []
require(sorted(map(str,diffs(source,expected)))==sorted(map(str,paths)) and len(paths)==13,'Exactly12 value copies plus predictedHumanmixedSHA')
palette=json.loads((B/'ari-skin-palette/CONTRACT.json').read_text());cold=json.loads((B/'ari-roughness-response/COLD.json').read_text())
k={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nominal':nominal,'represented_value':value,'targets':targets,'allowed_state_paths':paths,'predictions':records,'baseline_mixed_sha256':baseline,'observer_functions':['safe_value','descriptor_refusal','scalar_rna','material','image_records','native_route','state','evaluated_route'],'renderer_functions':['render_domain','restore','bbox','orient','settings'],'frames':palette['frames'],'views':palette['views'],'look':palette['look'],'lighting_center':palette['lighting_center'],'baseline_geometry':cold['geometry'],'domains':cold['domains'],'world_delta_norm_limits':{'Human':0.01,'Human.eyebrow001':0.001,'Human.eyelashes01':0.001},'max_vertices':500000,'max_triangles':1000000,'max_archive_bytes':16777216,'max_json_bytes':8388608,'candidate_promotion':False,'limits':'Artist static choice; native-unit finite envelope, no calibrated distance/contact/anatomy/semantic/auxiliary/allmotion acceptance'}
write('CONTRACT.json',k);write('EXPECTED-VARIANT.json',expected)
packed=io.BytesIO();np.savez_compressed(packed,**predictions);data=packed.getvalue();require(len(data)<=4194304 and sum(a.size for a in predictions.values())==58596,'Bounded3 derived predictions')
folder=P/'predictions';require(not folder.exists(),'Exclusive prospective prediction');folder.mkdir()
with (folder/'mixed.npz').open('xb') as f:f.write(data)
(folder/'mixed.npz').chmod(0o444)
write('PREDICTION-RECEIPT.json',{'utc':k['utc'],'input_count':27,'input_scalars':1210320,'represented_value':value,'allowed_leaf_count':13,'outputs':records,'archive':{'path':str((folder/'mixed.npz').resolve()),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},'native_executed':False,'scope':'Prospective numeric prediction only; no newraw acquisition or source setter'})
print(json.dumps({'utc':k['utc'],'represented_value':value,'outputs':records,'allowed_paths':13,'native_executed':False}))
