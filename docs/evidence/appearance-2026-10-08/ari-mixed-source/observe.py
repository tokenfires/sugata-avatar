"""Unchanged exact18-input baseline reconstruction. No authored setters/eval/render/save."""
from pathlib import Path
import sys,json,hashlib,datetime,ast,importlib.util,math,io
sys.dont_write_bytecode=True
import numpy as np
import bpy
P=Path(__file__).resolve().parent
E=json.loads((P/'EXEC-PLAN.json').read_text())
K=json.loads((P/'CONTRACT.json').read_text())
REPORT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'checks':[],'application_admitted':False}
def require(v,label):
    if not v:raise RuntimeError(label)
    REPORT['checks'].append(label)
def write(name,value):
    b=(json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
    require(len(b)<=K['max_json_bytes'],'Prospective8MiB JSON cap '+name)
    with (P/name).open('xb') as f:f.write(b)
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
def pin(row):
    b=Path(row['path']).read_bytes()
    require(len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],'Physical pin '+row['path'])
def array_check(a,owner,name):
    sig=source_keys[owner][name]
    require(sig['vertices']<=K['max_vertices'] and a.shape==(sig['vertices'],3) and a.dtype==np.dtype('float32'),'Literal bounded Float32 shape '+owner+' '+name)
    require(np.isfinite(a).all() and C.digest(a)==sig['coordinates_sha256'],'Finite prior raw fingerprint '+owner+' '+name)
def record(a,owner,name):
    return {'owner':owner,'key_name':name,'shape':list(a.shape),'dtype':str(a.dtype),'sha256':C.digest(a)}
try:
    require(bpy.app.background and not bpy.app.online_access,'Offline background readonly source')
    for row in E['pins']:pin(row)
    require(Path(E['source']['path']).stat().st_mode&0o222==0,'Immutable native source')
    EXPECTED=json.loads(Path(E['baseline_state']).read_text());I=json.loads(Path(E['image_whitelist']).read_text())
    old_names={o['name'] for o in EXPECTED['scene']['objects']}
    expected_original=EXPECTED['original_materials'];expected_mats=set(expected_original)|{'AriPaletteSkin'}
    C=load('sugata_readonly_mixed_lib',E['lib']);helper=load('sugata_readonly_mixed_receipt',E['scene_helper'])
    parsed=ast.parse(Path(E['observer_source']).read_text())
    selected=[n for n in parsed.body if isinstance(n,ast.FunctionDef) and n.name in K['observer_functions']]
    require(len(selected)==7 and {n.name for n in selected}==set(K['observer_functions']),'Exactly seven frozen readonly AST observers')
    exec(compile(ast.Module(body=selected,type_ignores=[]),E['observer_source'],'exec'),globals());C.scalar_rna=scalar_rna
    require(bpy.ops.wm.open_mainfile(filepath=E['source']['path'])=={'FINISHED'} and Path(bpy.data.filepath).resolve()==Path(E['source']['path']).resolve(),'Fresh exact immutable native open')
    before=state();write('BEFORE.json',before);require(before==EXPECTED,'Complete literal baseline before acquisition')
    source_keys={n:{x['name']:x for x in rows} for n,rows in K['source_keys'].items()}
    require(K['acquire_count']==18 and len(K['acquire'])==18 and K['existing_count']==9 and len(K['existing_arrays'])==9,'Fixed18 acquisition and9 existing identities')
    inputs={};existing_scalars=0
    with np.load(E['support_archive'],allow_pickle=False) as stored:
        require(set(stored.files)==set(K['existing_arrays']),'Literal prior9-array archive members')
        for key,row in K['existing_arrays'].items():
            require(existing_scalars+row['shape'][0]*3<=K['existing_scalars'],'Existing scalar budget before array load')
            a=stored[key];array_check(a,row['owner'],row['key_name'])
            require(record(a,row['owner'],row['key_name'])==row,'Full prior named array identity')
            identity=(row['owner'],row['key_name']);require(identity not in inputs,'No duplicate prior identity')
            inputs[identity]=a;existing_scalars+=a.size
    require(existing_scalars==175788,'Exact existing scalar count')
    arrays={};records={};acquired_scalars=0
    for index,row in enumerate(K['acquire']):
        name=row['owner'];sig=row['key_record'];obj=bpy.data.objects[name]
        identity=(name,sig['name']);require(identity not in inputs and index<18,'Exact logical acquisition membership')
        require(sig==source_keys[name][sig['name']],'Literal acquisition raw signature')
        key=obj.data.shape_keys.key_blocks[sig['name']]
        require(len(key.data)==len(obj.data.vertices)==sig['vertices']<=K['max_vertices'],'Bounded source vertex count before getter')
        require(acquired_scalars+len(key.data)*3<=K['acquire_scalars'],'Prospective acquisition scalar cap')
        a=C.bulk(key.data,'co',3,np.float32);array_check(a,name,sig['name']);acquired_scalars+=a.size
        inputs[identity]=a;identifier='raw'+str(index);arrays[identifier]=a;records[identifier]=record(a,name,sig['name'])
    require(len(arrays)==18 and acquired_scalars==1034532 and len(inputs)==27 and sum(a.size for a in inputs.values())==1210320,'Exact18new/27logical source input closure')
    compiled=[];derived_scalars=0
    for index,owner in enumerate(K['terms']):
        name=owner['owner'];obj=bpy.data.objects[name];keys=obj.data.shape_keys
        require(keys.use_relative and keys.reference_key.name==owner['basis']=='Basis','Exact unchanged relative/reference mode '+name)
        meta=before['metadata'][name];raw=K['source_keys'][name]
        require([m['name'] for m in meta]==[r['name'] for r in raw] and before['metadata']==C.meta(),'Exact current metadata/native source order')
        actual_terms=[(i,m) for i,m in enumerate(meta) if i and ((not m['mute'] and m['value']) or m['name'] in ('mouthSmileLeft','mouthSmileRight'))]
        require(len(actual_terms)==len(owner['original_order_terms']),'Exact known active/prospective term count '+name)
        a=inputs[(name,'Basis')].astype(np.float64);used=[]
        for (i,m),term in zip(actual_terms,owner['original_order_terms']):
            require(i==term['index'] and m==term['metadata'] and source_keys[name][m['name']]==term['key_record'] and source_keys[name][m['relative']]==term['relative_record'],'Exact term coefficient/order/relative/source identity '+name+' '+m['name'])
            require(m['relative']=='Basis' and not m['vertex_group'],'Exact unmasked Basis-relative term')
            if not m['mute'] and m['value']:
                a+=(inputs[(name,m['name'])].astype(np.float64)-inputs[(name,m['relative'])].astype(np.float64))*m['value']
                require(np.isfinite(a).all(),'Finite unchanged Float64 accumulation');used.append(i)
        require(np.isfinite(a).all(),'Finite unchanged compiler before final cast');out=a.astype(np.float32)
        require(np.isfinite(out).all() and C.digest(out)==K['expected_mixed_sha256'][name],'Exact known baseline compiler SHA '+name)
        actual=C.mixed(obj)
        require(np.array_equal(actual,out) and C.digest(actual)==C.digest(out),'Exact actual readonly C.mixed agreement '+name)
        require(len(arrays)<K['output_count'] and acquired_scalars+derived_scalars+out.size<=K['output_scalars'],'Derived archive budget before retention')
        identifier='compiled'+str(index);arrays[identifier]=out;records[identifier]=record(out,name,'UNCHANGED_MIXED_DERIVED');derived_scalars+=out.size
        compiled.append({'owner':name,'active_native_indices':used,'output':identifier,'sha256':C.digest(out),'actual_mixed_sha256':C.digest(actual)})
    require(len(arrays)==21 and acquired_scalars+derived_scalars==1093128,'Exact21 archived arrays/1093128 scalars')
    payload=io.BytesIO();np.savez_compressed(payload,**arrays);packed=payload.getvalue()
    require(len(packed)<=K['max_npz_bytes'],'Prospective8MiB compressed archive cap')
    work=P/'work';require(not work.exists(),'Exclusive output archive');work.mkdir()
    with (work/'coordinates.npz').open('xb') as f:f.write(packed)
    (work/'coordinates.npz').chmod(0o444)
    write('COMPILATION.json',{'arrays':records,'compiled':compiled,'acquired_scalars':acquired_scalars,'existing_scalars':existing_scalars,'derived_scalars':derived_scalars,'logical_input_count':len(inputs),'logical_input_scalars':sum(a.size for a in inputs.values()),'expression_admitted':False,'limits':'Unchanged native-local source compilation only; no helper/appearance/evaluated/expression/semantic qualification'})
    after=state();write('AFTER.json',after);require(after==before==EXPECTED,'Complete unchanged source after compilation')
    for row in E['pins']:pin(row)
    require(Path(E['source']['path']).stat().st_mode&0o222==0,'Post immutable native source')
    REPORT.update({'passed':True,'source_preserved':True,'compiled':compiled,'raw_array_count':18,'derived_array_count':3,'coordinate_scalars':1093128,'archive':{'path':str(work/'coordinates.npz'),'bytes':len(packed),'sha256':hashlib.sha256(packed).hexdigest()},'saved':False,'rendered':False,'evaluated':False,'application_admitted':False})
except Exception as ex:REPORT['exception']=repr(ex)
finally:
    REPORT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();write('RESULT.json',REPORT)
    print('SUGATA_UNCHANGED_MIXED '+json.dumps({k:v for k,v in REPORT.items() if k not in ('checks','rna_descriptor_classes')}),flush=True)
if not REPORT['passed']:raise SystemExit(1)
