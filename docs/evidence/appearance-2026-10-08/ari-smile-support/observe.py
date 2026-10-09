"""Exactly two raw support names, readonly source observer. No setters/evaluation/render/save."""
from pathlib import Path
import sys,json,hashlib,datetime,ast,importlib.util,math,io
sys.dont_write_bytecode=True
import numpy as np
import bpy
P=Path(__file__).resolve().parent
E=json.loads((P/'EXEC-PLAN.json').read_text())
K=json.loads((P/'CONTRACT.json').read_text())
REPORT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'checks':[],'expression_application_admitted':False}
def require(v,label):
    if not v:raise RuntimeError(label)
    REPORT['checks'].append(label)
def write(name,value):
    b=(json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
    require(len(b)<=K['max_json_bytes'],'Prospective 8MiB serialized cap '+name)
    with (P/name).open('xb') as f:f.write(b)
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
def bounded_name(value):
    require(isinstance(value,str) and len(value)<=512,'Bounded literal name')
    return value
def animation_context(label,pointer):
    require(len(contexts)<K['max_contexts'],'Prospective 21 ID contexts')
    ad=pointer.animation_data
    row={'label':bounded_name(label),'id_name':bounded_name(pointer.name),'id_type':type(pointer).__name__,'animation_data_present':ad is not None}
    if ad is not None:
        require(len(ad.drivers)<=K['max_drivers'] and len(ad.nla_tracks)<=K['max_nla'],'Prospective animation count caps')
        row.update({'action_name':bounded_name(ad.action.name) if ad.action else None,'driver_count':len(ad.drivers),'nla_track_count':len(ad.nla_tracks),'dependency_resolution':'UNKNOWN; any present animation context holds application'})
    else:row['dependency_resolution']='No animation_data on this literal ID; not universal dependency absence'
    contexts.append(row)
def coordinate_array(owner,key):
    global total_scalars
    identity=(owner.name,key.name)
    if identity in array_ids:return array_ids[identity]
    require(len(arrays)<K['max_arrays'],'Prospective12 array cap')
    require(len(key.data)==len(owner.data.vertices)<=25000,'Actual key and mesh point count')
    require(total_scalars+len(key.data)*3<=K['max_scalars'],'Prospective900000 scalar cap')
    total_scalars+=len(key.data)*3
    a=C.bulk(key.data,'co',3,np.float32)
    require(np.isfinite(a).all(),'Actual finite Float32 key coordinates')
    sig=source_keys[owner.name][key.name]
    require(C.digest(a)==sig['coordinates_sha256'],'Exact prior key-coordinate fingerprint '+owner.name+' '+key.name)
    identifier='a'+str(len(arrays));arrays[identifier]=a;array_ids[identity]=identifier
    array_records[identifier]={'owner':owner.name,'key_name':key.name,'shape':list(a.shape),'dtype':str(a.dtype),'sha256':C.digest(a)}
    return identifier
try:
    require(bpy.app.background and not bpy.app.online_access,'Offline background readonly source')
    for pin in E['pins']:
        b=Path(pin['path']).read_bytes();require(len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],'Physical pin '+pin['path'])
    require(Path(E['source']['path']).stat().st_mode&0o222==0,'Immutable native source')
    EXPECTED=json.loads(Path(E['baseline_state']).read_text())
    I=json.loads(Path(E['image_whitelist']).read_text())
    old_names={o['name'] for o in EXPECTED['scene']['objects']}
    expected_original=EXPECTED['original_materials'];expected_mats=set(expected_original)|{'AriPaletteSkin'}
    C=load('sugata_readonly_support_lib',E['lib'])
    helper=load('sugata_readonly_support_receipt',E['scene_helper'])
    parsed=ast.parse(Path(E['observer_source']).read_text())
    selected=[n for n in parsed.body if isinstance(n,ast.FunctionDef) and n.name in K['observer_functions']]
    require(len(selected)==7 and {n.name for n in selected}==set(K['observer_functions']),'Exactly seven frozen readonly AST observers')
    exec(compile(ast.Module(body=selected,type_ignores=[]),E['observer_source'],'exec'),globals())
    C.scalar_rna=scalar_rna
    require(bpy.ops.wm.open_mainfile(filepath=E['source']['path'])=={'FINISHED'} and Path(bpy.data.filepath).resolve()==Path(E['source']['path']).resolve(),'Fresh process exact readonly native open')
    before=state();write('BEFORE.json',before);require(before==EXPECTED,'Complete literal source baseline before query')
    source_keys={o['name']:{k['name']:k for k in o['mesh']['shape_keys']} for o in EXPECTED['scene']['objects'] if o['type']=='MESH'}
    require(sorted(source_keys)==K['owners'] and len(bpy.data.objects)==7,'Literal six source mesh owners and seven originals')
    arrays={};array_ids={};array_records={};total_scalars=0;contexts=[];owners=[];present=[]
    for name in sorted(old_names):
        obj=bpy.data.objects[name];animation_context(name+'/object',obj);animation_context(name+'/data',obj.data)
        if obj.type=='MESH' and obj.data.shape_keys is not None:animation_context(name+'/shape_keys',obj.data.shape_keys)
    for name in K['owners']:
        obj=bpy.data.objects[name];keys=obj.data.shape_keys
        require(keys is not None and len(keys.key_blocks)<=300,'Prospective literal key owner cap')
        row={'owner':name,'vertex_count':len(obj.data.vertices),'use_relative':keys.use_relative,'reference_key':bounded_name(keys.reference_key.name) if keys.reference_key else None,'candidates':[]}
        owner_present=False
        for name_key in K['keys']:
            key=keys.key_blocks.get(name_key)
            if key is None:
                row['candidates'].append({'name':name_key,'present':False,'auxiliary_duty':'UNKNOWN; name absence does not establish zero effect or fixed-helper safety'});continue
            owner_present=True
            relative=key.relative_key
            require(relative is not None and relative.name==source_keys[name][name_key]['relative_key'],'Actual prior relative identity')
            key_id=coordinate_array(obj,key);relative_id=coordinate_array(obj,relative)
            a=arrays[key_id];base=arrays[relative_id];delta=a.astype(np.float64)-base.astype(np.float64)
            require(np.isfinite(delta).all(),'Finite actual relative delta')
            changed=np.flatnonzero(np.any(delta!=0.0,axis=1));magnitudes=np.linalg.norm(delta,axis=1)
            require(np.isfinite(magnitudes).all(),'Finite actual delta magnitudes')
            meta=next(m for m in EXPECTED['metadata'][name] if m['name']==name_key)
            reverse=[m['name'] for m in EXPECTED['metadata'][name] if m['relative']==name_key and m['name']!=name_key]
            candidate={'name':name_key,'present':True,'key_array':key_id,'relative_array':relative_id,'metadata':meta,'reverse_relative_keys':reverse,'changed_indices':changed.tolist(),'changed_count':int(len(changed)),'max_delta_length':float(magnitudes.max()),'all_vertex_rms_delta_length':float(np.sqrt(np.mean(magnitudes**2))),'changed_relative_bounds':{'min':base[changed].min(axis=0).tolist(),'max':base[changed].max(axis=0).tolist()} if len(changed) else None,'changed_key_bounds':{'min':a[changed].min(axis=0).tolist(),'max':a[changed].max(axis=0).tolist()} if len(changed) else None,'changed_delta_bounds':{'min':delta[changed].min(axis=0).tolist(),'max':delta[changed].max(axis=0).tolist()} if len(changed) else None,'anatomical_domain':'UNKNOWN; literal local point-index support only','dependency_resolution':'HOLD: masks/relative/reverse/animation/auxiliary responsibility require separately owned application contract'}
            row['candidates'].append(candidate)
        if owner_present:present.append(name)
        owners.append(row)
    require(present==K['present_owners'],'Exactly three recorded present owners; no new name census')
    payload=io.BytesIO();np.savez_compressed(payload,**arrays);packed=payload.getvalue()
    require(len(packed)<=K['max_npz_bytes'],'Prospective4MiB compressed archive cap')
    work=P/'work';require(not work.exists(),'Exclusive raw-coordinate archive');work.mkdir()
    with (work/'coordinates.npz').open('xb') as f:f.write(packed)
    (work/'coordinates.npz').chmod(0o444)
    ledger={'owners':owners,'animation_contexts':contexts,'arrays':array_records,'coordinate_scalars':total_scalars,'delta_rule':K['delta'],'support_rule':K['support'],'application_admitted':False,'appearance_qualified':False,'limits':'No evaluated geometry, anatomical correspondence, resolved drivers/auxiliary duties, emotion, clearance or motion proof'}
    write('SUPPORT.json',ledger)
    after=state();write('AFTER.json',after);require(after==before==EXPECTED,'Complete literal source preservation after query')
    for pin in E['pins']:
        b=Path(pin['path']).read_bytes();require(len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],'Post physical pin '+pin['path'])
    require(Path(E['source']['path']).stat().st_mode&0o222==0,'Post immutable native source')
    REPORT.update({'passed':True,'present_owners':present,'raw_array_count':len(arrays),'coordinate_scalars':total_scalars,'source_preserved':True,'archive':{'path':str(work/'coordinates.npz'),'bytes':len(packed),'sha256':hashlib.sha256(packed).hexdigest()},'support_rows':[{'owner':r['owner'],'name':c['name'],'changed_count':c.get('changed_count'),'max_delta_length':c.get('max_delta_length')} for r in owners for c in r['candidates']],'application_status':'HELD; raw local support and presence records do not resolve auxiliary/anatomical/physical/semantic responsibilities','saved':False,'rendered':False,'evaluated':False})
except Exception as ex:REPORT['exception']=repr(ex)
finally:
    REPORT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    write('RESULT.json',REPORT)
    print('SUGATA_READONLY_SMILE_SUPPORT '+json.dumps({k:v for k,v in REPORT.items() if k!='checks'}),flush=True)
if not REPORT['passed']:raise SystemExit(1)
