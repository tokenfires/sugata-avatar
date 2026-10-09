"""Read saved palette; qualify source-owned state; first three fixed views. No save."""
from pathlib import Path
import sys,json,hashlib,datetime,ast,importlib.util,copy,math
sys.dont_write_bytecode=True
import numpy as np
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
P=Path(__file__).resolve().parent
E=json.loads((P/'EXEC-PLAN.json').read_text());K=json.loads(Path(E['contract']).read_text())
REPORT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'candidate_promotion':False,'outputs':[],'checks':[]}
def require(v,label):
 if not v:raise RuntimeError(label)
 REPORT['checks'].append(label)
def write(name,v):
 b=(json.dumps(v,indent=2)+'\n').encode();require(len(b)<=8*1024*1024,'8MiB serialized output cap '+name)
 with (P/name).open('xb') as f:f.write(b)
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def safe_value(v):
 if isinstance(v,(str,bool,int,float)) or v is None:
  if isinstance(v,str):require(len(v)<=4096,'4096 char scalar cap')
  if isinstance(v,float):require(math.isfinite(v),'Finite scalar')
  return v
 require(len(v)<=128,'128 scalar-array cap');return [safe_value(x) for x in v]
def scalar_rna(owner):
 require(not isinstance(owner,bpy.types.Image),'Generic Image RNA forbidden')
 require(len(owner.bl_rna.properties)<=256,'256 RNA property cap');out={}
 for prop in owner.bl_rna.properties:
  if prop.identifier=='rna_type' or prop.is_readonly or prop.type not in {'BOOLEAN','INT','FLOAT','STRING','ENUM'}:continue
  require(not prop.is_array or prop.array_length<=128,'RNA array cap before getter')
  out[prop.identifier]=safe_value(getattr(owner,prop.identifier))
 return out
def material(m):
 require(m.animation_data is None and m.node_tree is not None and m.node_tree.animation_data is None,'Unanimated material/tree')
 require(len(m.node_tree.nodes)<=32 and len(m.node_tree.links)<=64,'Material node/link caps')
 for n in m.node_tree.nodes:
  require(n.parent is None and n.type in {'TEX_IMAGE','OUTPUT_MATERIAL','BSDF_PRINCIPLED','MIX_RGB'} and len(n.inputs)<=128,'Known bare nodes/input cap')
  if n.type=='TEX_IMAGE':require(n.image is not None and n.image.name in I,'Only whitelisted source texture pointers')
  for s in n.inputs:
   if hasattr(s,'default_value'):safe_value(s.default_value)
 return {'record':C.material_record(m),'custom':dict(m.items()),'tree_rna':scalar_rna(m.node_tree),'tree_custom':dict(m.node_tree.items()),'nodes_custom':{n.name:dict(n.items()) for n in m.node_tree.nodes},'image_pointers':{n.name:n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE'},'users':m.users,'fake_user':m.use_fake_user}
def image_records():
 out={};require(len(I)<=16 and all(len(v)<=32 and 'pixels' not in v for v in I.values()),'Prospective explicit image whitelist/no pixels')
 for name,fields in I.items():
  im=bpy.data.images[name];require(len(im.packed_files)==1 and im.packed_file is not None,'One packed image')
  require(im.packed_file.size<=32*1024*1024,'32MiB packed-byte cap before data getter')
  out[name]={'rna':{f:safe_value(getattr(im,f)) for f in fields},'custom':dict(im.items()),'users':im.users,'packed_sha256':hashlib.sha256(im.packed_file.data).hexdigest()}
 return out
def native_route():
 b=bpy.data.objects['Human'];idx=C.bulk(b.data.polygons,'material_index',1,np.int32)
 return {'slot_link':b.material_slots[0].link,'data_materials':[m.name if m else None for m in b.data.materials],'polygon_count':len(idx),'polygon_indices_sha256':C.digest(idx),'all_zero':bool(np.all(idx==0))}
def evaluated_route():
 dg=bpy.context.evaluated_depsgraph_get();ev=bpy.data.objects['Human'].evaluated_get(dg);mesh=ev.to_mesh(preserve_all_data_layers=True,depsgraph=dg)
 try:
  require(len(mesh.polygons)<=100000,'Evaluated polygon route cap');idx=C.bulk(mesh.polygons,'material_index',1,np.int32)
  return {'data_materials':[m.name if m else None for m in mesh.materials],'polygon_count':len(idx),'polygon_indices_sha256':C.digest(idx),'all_zero':bool(np.all(idx==0))}
 finally:ev.to_mesh_clear()
def state():
 require(len(bpy.data.objects)<=64 and len(bpy.data.materials)<=64 and len(bpy.data.images)<=16,'Global counts before name iteration')
 require({o.name for o in bpy.data.objects}==old_names and len(bpy.data.objects)==7,'Original seven only')
 require({m.name for m in bpy.data.materials}==expected_mats,'NEW exact material namespace excluding only archived Material')
 require(len(bpy.data.images)<=16,'Global image budget')
 for o in bpy.data.objects:
  require(len(o.material_slots)<=16 and len(o.modifiers)<=16,'Object slot/modifier caps')
  if o.type=='MESH':
   require(len(o.data.vertices)<=25000 and len(o.data.polygons)<=50000 and len(o.data.uv_layers)<=16,'Native geometry caps before scene observer')
   require(not o.data.shape_keys or len(o.data.shape_keys.key_blocks)<=300,'300 keyblocks cap')
 mats={n:material(bpy.data.materials[n]) for n in expected_original}
 for row in mats.values():row['record']['links']=sorted(row['record']['links'])
 owned=material(bpy.data.materials['AriPaletteSkin']);owned['record']['links']=sorted(owned['record']['links'])
 images=image_records() # packed-byte caps and pointer ownership precede helper packed-data getters
 return {'scene':helper.capture_scene(),'original_materials':mats,'owned':owned,'images':images,'metadata':C.meta(),'extras':C.original_extras(old_names),'native_route':native_route(),'mixed_sha256':C.digest(C.mixed(bpy.data.objects['Human']))}
def preserved(actual):
 require(actual==EXPECTED,'Complete NEW source-owned state equality')
try:
 require(bpy.app.background and not bpy.app.online_access,'Offline background CPU')
 for r in E['pins']:
  b=Path(r['path']).read_bytes();require(len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],'Physical pin '+r['path'])
 require(Path(E['source']['path']).stat().st_mode&0o222==0,'Immutable input')
 C=load('sugata_palette_view_lib',E['lib']);C.scalar_rna=scalar_rna
 helper=load('sugata_palette_view_receipt',E['scene_helper'])
 W=json.loads(Path(E['warm']).read_text());B=json.loads(Path(E['before']).read_text());I=json.loads((P/'IMAGE-WHITELIST.json').read_text())
 require(B['all_original_materials']['Material']['users']==0 and not B['all_original_materials']['Material']['fake_user'],'Only exact archived unused Material exception')
 archived=json.loads((P/'ARCHIVED-UNUSED-MATERIAL.json').read_text());require(archived==B['all_original_materials']['Material'],'Full original unused record retained')
 old_names={o['name'] for o in W['scene']['objects']};expected_original=copy.deepcopy(W['original_materials']);expected_original.pop('Material');expected_mats=set(expected_original)|{'AriPaletteSkin'}
 for r in expected_original.values():r['record']['links']=sorted(r['record']['links'])
 owned=copy.deepcopy(W['owned']);owned['record']['links']=sorted(owned['record']['links']);imgs=copy.deepcopy(W['images'])
 for name,row in imgs.items():
  require(set(row['rna'])-{'pixels'}==set(I[name]),'Exact prospective known metadata whitelist');row['rna'].pop('pixels')
 route=copy.deepcopy(B['native_route']);route['data_materials']=['AriPaletteSkin']
 EXPECTED={'scene':W['scene'],'original_materials':expected_original,'owned':owned,'images':imgs,'metadata':W['metadata'],'extras':W['extras'],'native_route':route,'mixed_sha256':E['mixed_sha256']}
 require(bpy.ops.wm.open_mainfile(filepath=E['source']['path'])=={'FINISHED'} and Path(bpy.data.filepath).resolve()==Path(E['source']['path']).resolve(),'Fresh process exact candidate open')
 cold=state();write('COLD-OBSERVED.json',cold);preserved(cold)
 meshes=sorted(o.name for o in bpy.data.objects if o.type=='MESH');geometry,arrays=C.evaluated(meshes,500000,1000000);require(geometry==W['geometry'],'All eighteen evaluated geometry signatures exact')
 work=P/'work';require(not work.exists(),'Exclusive geometry archive');work.mkdir();np.savez_compressed(work/'cold-geometry.npz',**arrays);(work/'cold-geometry.npz').chmod(0o444)
 nodes=ast.parse(Path(E['renderer']).read_text()).body;names={'render_domain','restore','bbox','orient','settings'};selected=[n for n in nodes if isinstance(n,ast.FunctionDef) and n.name in names];require({n.name for n in selected}==names,'Exact frozen five renderer functions');exec(compile(ast.Module(body=selected,type_ignores=[]),E['renderer'],'exec'),globals())
 points,heads,counts,saved=render_domain();require(counts==W['domains'],'Full original render domains');require(evaluated_route()==json.loads(Path(E['evaluated_route']).read_text()),'Actual evaluated skin indices/material route');restore(saved);preserved(state());write('COLD.json',{'state':cold,'geometry':geometry,'domains':counts,'fresh_process_open':True,'dynamic_pixel_equality':False})
 REPORT['shared_look']=K['look'];scene=bpy.context.scene;oldworld=scene.world;oldcamera=scene.camera;camera,diag,world=settings(scene,K['lighting_center']);require(len(diag)==4 and not set(diag)&old_names,'Exclusive diagnostic owners');points,heads,counts2,saved=render_domain();require(counts2==counts,'Render domains after settings exact')
 lighting={'world_rna':scalar_rna(world),'background':{'color':list(world.node_tree.nodes['Background'].inputs['Color'].default_value),'strength':world.node_tree.nodes['Background'].inputs['Strength'].default_value},'objects':{n:{'rna':scalar_rna(bpy.data.objects[n]),'matrix_world':[list(r) for r in bpy.data.objects[n].matrix_world],'data':scalar_rna(bpy.data.objects[n].data)} for n in diag},'look':REPORT['shared_look'],'cpu':{'device':scene.cycles.device,'samples':scene.cycles.samples,'threads':scene.render.threads,'seed':scene.cycles.seed,'denoiser':scene.cycles.denoiser}};write('LIGHTING.json',lighting)
 for framing,view in K['views']:
  f=K['frames'][framing];scene.render.resolution_x,scene.render.resolution_y=f['resolution'];camera.data.ortho_scale=f['scale'];target=Vector(f['center']);direction=(0,-1,0) if view=='front' else (1,0,0);camera.location=target+Vector(direction)*5;orient(camera,target);bpy.context.view_layer.update();domain=points if framing=='body' else heads;projected=[world_to_camera_view(scene,camera,Vector(p)) for p in domain];require(all(.04<=p.x<=.96 and .04<=p.y<=.96 and p.z>0 for p in projected),'Every source point framed '+framing+view);png=P/('palette-'+framing+'-'+view+'.png');require(not png.exists(),'First exclusive original');scene.render.filepath=str(png);require(bpy.ops.render.render(write_still=True)=={'FINISHED'} and png.is_file(),'First original complete');png.chmod(0o444);REPORT['outputs'].append({'framing':framing,'view':view,'path':str(png),'bytes':png.stat().st_size,'sha256':hashlib.sha256(png.read_bytes()).hexdigest(),'resolution':f['resolution'],'camera':list(camera.location),'target':f['center'],'scale':f['scale'],'point_count':len(domain),'projection':{'minx':min(p.x for p in projected),'maxx':max(p.x for p in projected),'miny':min(p.y for p in projected),'maxy':max(p.y for p in projected)}})
 restore(saved)
 for n in diag:
  o=bpy.data.objects[n];d=o.data;bpy.data.objects.remove(o,do_unlink=True)
  if isinstance(d,bpy.types.Camera):bpy.data.cameras.remove(d)
  else:bpy.data.lights.remove(d)
 scene.world=oldworld;scene.camera=oldcamera;bpy.data.worlds.remove(world);clean=state();write('CLEANUP-OBSERVED.json',clean);preserved(clean);after,after_arrays=C.evaluated(meshes,500000,1000000);require(after==geometry,'Post-render all evaluated geometry exact');write('CLEANUP.json',{'state':clean,'geometry':after})
 for r in E['pins']:
  b=Path(r['path']).read_bytes();require(len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],'Post physical pin '+r['path'])
 require(Path(E['source']['path']).stat().st_mode&0o222==0,'Post immutable input')
 REPORT.update({'passed':True,'geometry':geometry,'domains':counts,'source_sha256':E['source']['sha256'],'fresh_process_open':True,'saved':False,'dynamic_pixel_equality':False})
except Exception as ex:REPORT['exception']=repr(ex)
finally:
 REPORT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();REPORT['limits']='NEW source-owned preservation only; original failed fullnamespace promise held. Packed source+metadata, not dynamic pixel equality. One immutable fixed palette/first views; no save, calibrated complexion, identity, fine skin, hair, motion, export, runtime or AAA acceptance.';write('RESULT.json',REPORT);print('SUGATA_PALETTE_FIRST_VIEWS '+json.dumps({k:v for k,v in REPORT.items() if k!='checks'}),flush=True)
if not REPORT['passed']:raise SystemExit(1)
