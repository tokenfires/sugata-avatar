"""One prospective static expression study. Fixed six values; full restoration; no save."""
from pathlib import Path
import sys,json,hashlib,datetime,ast,importlib.util,math,io
sys.dont_write_bytecode=True
import numpy as np
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
P=Path(__file__).resolve().parent
E=json.loads((P/'EXEC-PLAN.json').read_text());K=json.loads((P/'CONTRACT.json').read_text())
REPORT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'checks':[],'outputs':[],'candidate_promotion':False}
def require(v,label):
    if not v:raise RuntimeError(label)
    REPORT['checks'].append(label)
def write(name,value):
    b=(json.dumps(value,indent=2,allow_nan=False)+'\n').encode();require(len(b)<=K['max_json_bytes'],'8MiB JSON cap '+name)
    with (P/name).open('xb') as f:f.write(b)
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
def archive(name,arrays):
    require(len(arrays)==18 and all(np.isfinite(a).all() for a in arrays.values()),'Exactly18 finite evaluated buffers')
    payload=io.BytesIO();np.savez_compressed(payload,**arrays);b=payload.getvalue();require(len(b)<=K['max_archive_bytes'],'16MiB compressed geometry cap')
    q=P/'work'/name
    with q.open('xb') as f:f.write(b)
    q.chmod(0o444);return {'path':str(q),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def mixed_check(expectations,predictions=None):
    rows={}
    for name,expected in expectations.items():
        obj=bpy.data.objects[name];require(obj.data.shape_keys.use_relative and obj.data.shape_keys.reference_key.name=='Basis','Literal relative/reference '+name)
        a=C.mixed(obj);require(C.digest(a)==expected,'Exact prospective native mixed '+name)
        if predictions is not None:require(np.array_equal(a,predictions[name]),'Actual mixed equals prospective array '+name)
        rows[name]={'shape':list(a.shape),'sha256':C.digest(a)}
    return rows
def variant_geometry_check(base,old,new,arrays):
    require(set(base)==set(new) and set(old)==set(arrays) and len(arrays)==18,'Same6owners/18 evaluated identities')
    varied={n+'_world' for n in K['world_delta_norm_limits']};rows={}
    for member,a in arrays.items():
        b=old[member];require(a.shape==b.shape and a.dtype==b.dtype and np.isfinite(a).all(),'Exact variant geometry shape/dtype/finite '+member)
        if member not in varied:require(np.array_equal(a,b),'Invariant15 evaluated buffers '+member)
        else:
            name=member[:-6];delta=a.astype(np.float64)-b.astype(np.float64);norm=np.linalg.norm(delta,axis=1)
            require(np.isfinite(norm).all() and float(norm.max())<=K['world_delta_norm_limits'][name],'Prospective native-unit world-delta envelope '+name)
            require(C.digest(a)!=C.digest(b),'Non-null actual target world '+name)
            rows[name]={'changed_points':int(np.count_nonzero(np.any(delta!=0,axis=1))),'max_delta_norm':float(norm.max()),'limit':K['world_delta_norm_limits'][name]}
    for name,row in new.items():
        if name not in K['world_delta_norm_limits']:require(row==base[name],'Frozen auxiliary geometry '+name)
        else:
            require(set(row)==set(base[name]),'Exact target geometry fields')
            require({k:v for k,v in row.items() if k not in {'world_sha256','min','max'}}=={k:v for k,v in base[name].items() if k not in {'world_sha256','min','max'}},'Exact target topology/counts '+name)
    return rows
try:
    require(bpy.app.background and not bpy.app.online_access,'Offline background CPU')
    for row in E['pins']:
        b=Path(row['path']).read_bytes();require(len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],'Physical pin '+row['path'])
    require(Path(E['source']['path']).stat().st_mode&0o222==0,'Immutable native source')
    BASE_EXPECTED=json.loads(Path(E['baseline_state']).read_text());VARIANT_EXPECTED=json.loads((P/'EXPECTED-VARIANT.json').read_text());EXPECTED=BASE_EXPECTED
    I=json.loads(Path(E['image_whitelist']).read_text());old_names={o['name'] for o in EXPECTED['scene']['objects']};expected_original=EXPECTED['original_materials'];expected_mats=set(expected_original)|{'AriPaletteSkin'}
    C=load('sugata_expression_lib',E['lib']);helper=load('sugata_expression_receipt',E['scene_helper'])
    nodes=ast.parse(Path(E['observer_source']).read_text()).body;selected=[n for n in nodes if isinstance(n,ast.FunctionDef) and n.name in K['observer_functions']]
    require(len(selected)==8 and {n.name for n in selected}==set(K['observer_functions']),'Exactly8 frozen observer AST functions')
    exec(compile(ast.Module(body=selected,type_ignores=[]),E['observer_source'],'exec'),globals());C.scalar_rna=scalar_rna
    require(bpy.ops.wm.open_mainfile(filepath=E['source']['path'])=={'FINISHED'} and Path(bpy.data.filepath).resolve()==Path(E['source']['path']).resolve(),'Fresh exact native open')
    cold=state();write('COLD-OBSERVED.json',cold);require(cold==BASE_EXPECTED,'Complete literal baseline')
    meshes=sorted(o.name for o in bpy.data.objects if o.type=='MESH');geometry,arrays=C.evaluated(meshes,K['max_vertices'],K['max_triangles']);require(geometry==K['baseline_geometry'],'All18 baseline evaluated signatures exact')
    require(not (P/'work').exists(),'Exclusive geometry output');(P/'work').mkdir();REPORT['baseline_archive']=archive('cold-geometry.npz',arrays)
    REPORT['baseline_mixed']=mixed_check(K['baseline_mixed_sha256']);require(state()==BASE_EXPECTED,'Baseline after evaluated flags restored')
    predictions={}
    with np.load(E['prediction_archive'],allow_pickle=False) as stored:
        require(set(stored.files)=={r['member'] for r in K['predictions'].values()},'Exactly3 prospective derived members')
        for name,row in K['predictions'].items():
            require(row['shape'][0]<=25000 and row['shape'][1]==3,'Bounded prediction before load');a=stored[row['member']]
            require(a.dtype==np.dtype('float32') and list(a.shape)==row['shape'] and np.isfinite(a).all() and C.digest(a)==row['sha256'],'Exact prospective array '+name);predictions[name]=a
    require(len(K['targets'])==6 and K['represented_value']==0.20000000298023224 and len(K['allowed_state_paths'])==13,'Fixed six represented values/13 leaf copies')
    owned=[]
    for target in K['targets']:
        obj=bpy.data.objects[target['owner']];keys=obj.data.shape_keys;key=keys.key_blocks[target['index']]
        require(key.name==target['key'] and key.value==target['baseline']==0.0 and not key.mute and not key.vertex_group and key.relative_key.name=='Basis' and key.slider_min<=target['value']<=key.slider_max,'Actual owned zero key/type/mode/range')
        owned.append((target,key))
    for target,key in owned:key.value=target['value'];require(key.value==target['value'],'Exact represented one-shot key value')
    bpy.context.view_layer.update();REPORT['variant_mixed']=mixed_check({n:r['sha256'] for n,r in K['predictions'].items()},predictions)
    variant=state();write('VARIANT-OBSERVED.json',variant);require(variant==VARIANT_EXPECTED,'Entire prospective13-leaf variant state')
    variant_geometry,variant_arrays=C.evaluated(meshes,K['max_vertices'],K['max_triangles']);REPORT['geometry_delta']=variant_geometry_check(geometry,arrays,variant_geometry,variant_arrays);REPORT['variant_archive']=archive('variant-geometry.npz',variant_arrays)
    require(state()==VARIANT_EXPECTED,'Variant evaluation flags restored')
    nodes=ast.parse(Path(E['renderer']).read_text()).body;selected=[n for n in nodes if isinstance(n,ast.FunctionDef) and n.name in K['renderer_functions']]
    require(len(selected)==5 and {n.name for n in selected}==set(K['renderer_functions']),'Exactly5 frozen renderer AST functions');exec(compile(ast.Module(body=selected,type_ignores=[]),E['renderer'],'exec'),globals())
    points,heads,counts,saved=render_domain();require(counts==K['domains'],'Full frozen render domain counts');require(evaluated_route()==json.loads(Path(E['evaluated_route']).read_text()),'Actual evaluated skin route exact');restore(saved);require(state()==VARIANT_EXPECTED,'Variant after render-domain flags restored')
    write('COLD.json',{'state':cold,'geometry':geometry,'domains':counts,'fresh_process_open':True,'dynamic_pixel_equality':False});write('VARIANT.json',{'state':variant,'geometry':variant_geometry,'domains':counts,'delta':REPORT['geometry_delta']})
    REPORT['shared_look']=K['look'];scene=bpy.context.scene;oldworld=scene.world;oldcamera=scene.camera;camera,diag,world=settings(scene,K['lighting_center']);require(len(diag)==4 and not set(diag)&old_names,'Exclusive4 diagnostic owners');points,heads,counts2,saved=render_domain();require(counts2==counts,'Exact domains after settings')
    lighting={'world_rna':scalar_rna(world),'background':{'color':list(world.node_tree.nodes['Background'].inputs['Color'].default_value),'strength':world.node_tree.nodes['Background'].inputs['Strength'].default_value},'objects':{n:{'rna':scalar_rna(bpy.data.objects[n]),'matrix_world':[list(r) for r in bpy.data.objects[n].matrix_world],'data':scalar_rna(bpy.data.objects[n].data)} for n in diag},'look':REPORT['shared_look'],'cpu':{'device':scene.cycles.device,'samples':scene.cycles.samples,'threads':scene.render.threads,'seed':scene.cycles.seed,'denoiser':scene.cycles.denoiser}}
    write('LIGHTING.json',lighting);require(lighting==json.loads(Path(E['baseline_lighting']).read_text()),'Entire matched0.5 control lighting/settings')
    for framing,view in K['views']:
        f=K['frames'][framing];scene.render.resolution_x,scene.render.resolution_y=f['resolution'];camera.data.ortho_scale=f['scale'];target=Vector(f['center']);direction=(0,-1,0) if view=='front' else (1,0,0);camera.location=target+Vector(direction)*5;orient(camera,target);bpy.context.view_layer.update();domain=points if framing=='body' else heads;projected=[world_to_camera_view(scene,camera,Vector(q)) for q in domain]
        require(all(.04<=q.x<=.96 and .04<=q.y<=.96 and q.z>0 for q in projected),'Every fixed-frame source point '+framing+view)
        png=P/('smile-'+framing+'-'+view+'.png');require(not png.exists(),'First exclusive original');scene.render.filepath=str(png);require(bpy.ops.render.render(write_still=True)=={'FINISHED'} and png.is_file(),'First original complete');png.chmod(0o444)
        REPORT['outputs'].append({'framing':framing,'view':view,'path':str(png),'bytes':png.stat().st_size,'sha256':hashlib.sha256(png.read_bytes()).hexdigest(),'resolution':f['resolution'],'camera':list(camera.location),'target':f['center'],'scale':f['scale'],'point_count':len(domain),'projection':{'minx':min(q.x for q in projected),'maxx':max(q.x for q in projected),'miny':min(q.y for q in projected),'maxy':max(q.y for q in projected)}})
    restore(saved)
    for name in diag:
        obj=bpy.data.objects[name];data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
        if isinstance(data,bpy.types.Camera):bpy.data.cameras.remove(data)
        else:bpy.data.lights.remove(data)
    scene.world=oldworld;scene.camera=oldcamera;bpy.data.worlds.remove(world);clean_variant=state();write('VARIANT-CLEANUP.json',clean_variant);require(clean_variant==VARIANT_EXPECTED,'Complete variant after renderer cleanup')
    for target,key in owned:
        require(bpy.data.objects[target['owner']].data.shape_keys.key_blocks[target['key']]==key and key.value==target['value'],'Same owned key before restoration');key.value=target['baseline'];require(key.value==0.0,'Exact zero key restoration')
    bpy.context.view_layer.update();clean=state();write('CLEANUP-OBSERVED.json',clean);require(clean==BASE_EXPECTED,'Complete baseline restoration')
    after,after_arrays=C.evaluated(meshes,K['max_vertices'],K['max_triangles']);require(after==geometry and all(np.array_equal(after_arrays[n],a) for n,a in arrays.items()),'All18 restored evaluated buffers exact');require(state()==BASE_EXPECTED,'Restored evaluated flags/full baseline')
    write('CLEANUP.json',{'state':clean,'geometry':after});write('RNA-DESCRIPTORS.json',{'classes':REPORT['rna_descriptor_classes'],'scope':'Visited typed/capped required fields only'})
    for row in E['pins']:
        b=Path(row['path']).read_bytes();require(len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],'Post physical pin '+row['path'])
    require(Path(E['source']['path']).stat().st_mode&0o222==0,'Post immutable native source')
    REPORT.update({'passed':True,'geometry':geometry,'variant_geometry':variant_geometry,'domains':counts,'restored':True,'saved':False,'represented_value':K['represented_value'],'dynamic_pixel_equality':False,'limits':'Isolated static artist comparison only; encoded sources not decoded pixels; no contact/emotion/identity/auxiliary/allmotion/runtime/AAA acceptance'})
except Exception as ex:REPORT['exception']=repr(ex)
finally:
    REPORT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();write('RESULT.json',REPORT);print('SUGATA_RESTRAINED_SMILE '+json.dumps({k:v for k,v in REPORT.items() if k not in ('checks','rna_descriptor_classes')}),flush=True)
if not REPORT['passed']:raise SystemExit(1)
