"""One source-preserving editable artist atlas and three first original CPU views."""
from pathlib import Path
import sys,json,hashlib,datetime,math,ast,importlib.util
sys.dont_write_bytecode=True
import numpy as np
import bpy
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
P=Path(__file__).resolve().parent;WORK=P/'work';E=json.loads((P/'EXEC-PLAN.json').read_text());REPORT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'outputs':[],'checks':[]}
def require(ok,label):
 if not ok:raise RuntimeError(label)
 REPORT['checks'].append(label)
def physical(r):
 b=Path(r['path']).read_bytes();require(len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],'Physicalpin '+r['path'])
def load(name,file):
 s=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def extra(names):
 return {n:{'parent_type':bpy.data.objects[n].parent_type,'parent_bone':bpy.data.objects[n].parent_bone,'matrix_basis':[list(r) for r in bpy.data.objects[n].matrix_basis],'matrix_local':[list(r) for r in bpy.data.objects[n].matrix_local],'hide_render':bpy.data.objects[n].hide_render,'hide_viewport':bpy.data.objects[n].hide_viewport,'hide_get':bpy.data.objects[n].hide_get(),'selected':bpy.data.objects[n].select_get()} for n in sorted(names)}
def meta():
 return {o.name:[{'name':k.name,'relative':k.relative_key.name,'value':k.value,'min':k.slider_min,'max':k.slider_max,'mute':k.mute,'vertex_group':k.vertex_group,'interpolation':k.interpolation} for k in o.data.shape_keys.key_blocks] for o in bpy.data.objects if o.type=='MESH' and o.data.shape_keys}
def old_only(s,b):
 return {k:[x for x in s[k] if x['name'] in {y['name'] for y in b[k]}] for k in ['objects','materials','images']}|{'scene_names':s['scene_names']}
def material(name,rgb):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');require(n is not None,'ActualPrincipled material');n.inputs['Base Color'].default_value=rgb;n.inputs['Roughness'].default_value=.8;n.inputs['Metallic'].default_value=0;return m

def mesh(name,verts,faces,color):
 require(verts and faces and np.isfinite(np.asarray(verts)).all(),'Finiteowned atlas mesh')
 d=bpy.data.meshes.new(name+'Data');d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.parent=bpy.data.objects['Human.rig'];o.parent_type='BONE';o.parent_bone='head';o.matrix_world=Matrix.Identity(4);bpy.context.view_layer.update();require(np.max(np.abs(np.asarray(o.matrix_world)-np.eye(4)))<=1e-6,'Ownedatlas worldidentity');d.materials.append(material(name+'Material',color));o['sugata_source_role']='artist-root-flow-atlas';o['sugata_source_file']=str(P/'PARTITION.json');return o

def glyphs(guides,radius):
 verts=[];faces=[]
 for g in guides:
  start=np.asarray(g['start']);end=np.asarray(g['end']);direction=end-start;length=np.linalg.norm(direction);require(length>1e-8,'Guidepositive length');D=direction/length;axis=np.array([1.,0,0]) if abs(D[2])>.8 else np.array([0.,0,1]);u=np.cross(D,axis);u/=np.linalg.norm(u);v=np.cross(D,u)
  off=len(verts)
  for center,rad in [(start,radius),(end-D*radius*4,radius),(end-D*radius*4,radius*2.5)]:
   for a in range(4):verts.append((center+rad*(math.cos(a*math.pi/2)*u+math.sin(a*math.pi/2)*v)).tolist())
  verts.append(end.tolist())
  for a in range(4):b=(a+1)%4;faces.extend([[off+a,off+b,off+4+b,off+4+a],[off+8+a,off+8+b,off+12]])
  faces.append([off+3,off+2,off+1,off])
 return verts,faces
try:
 require(bpy.app.background and not bpy.app.online_access,'OfflineCPU atlas')
 for r in E['pins']:physical(r)
 A=json.loads((P/'PARTITION.json').read_text());W=json.loads(Path(E['warm']).read_text());require(not WORK.exists(),'Exclusivework');WORK.mkdir()
 helper=load('sugata_atlas_scene',E['scene_helper']);require(bpy.ops.wm.open_mainfile(filepath=E['source']['path'])=={'FINISHED'},'Exactsourceopen');before=helper.capture_scene();require(before==W['scene'] and meta()==W['full_native_key_metadata'],'Completeoldsource/252semantics');old_names={o['name'] for o in before['objects']};old_extra=extra(old_names)
 created=[]
 for zone,rows in A['zones'].items():
  verts=[];faces=[]
  for row in rows:
   offset=len(verts);verts.extend((np.asarray(row['coordinates'])+np.asarray(row['normal'])*A['overlay_offset_m']).tolist());faces.append([offset,offset+1,offset+2])
  created.append(mesh('AriAtlas_'+zone,verts,faces,A['materials'][zone]).name)
 verts,faces=glyphs(A['guides'],A['guide_radius_m']);created.append(mesh('AriAtlas_flow',verts,faces,A['materials']['flow']).name)
 warm=helper.capture_scene();all_names=old_names|set(created);extras=extra(all_names)
 require(set(o.name for o in bpy.data.objects)==all_names,'Exactadditiveatlas objects');require(old_only(warm,before)==before and extra(old_names)==old_extra and meta()==W['full_native_key_metadata'],'Oldsource unchanged afteratlas')
 # Preserve every actual evaluated atlas point through the inherited MESH portrait observer.
 code=ast.parse(Path(E['renderer']).read_text());wanted={'render_domain','restore','bbox','orient','settings'};nodes=[n for n in code.body if isinstance(n,ast.FunctionDef) and n.name in wanted];require({n.name for n in nodes}==wanted,'Exactinherited observer functions');exec(compile(ast.Module(body=nodes,type_ignores=[]),E['renderer'],'exec'),globals())
 body,heads,counts,saved=render_domain();restore(saved);require(helper.capture_scene()==warm and extra(all_names)==extras,'Renderobserver restores allowners')
 require(sum(c['render_vertices'] for c in counts.values())<=250000,'Declaredrender vertexbudget');require(all(n in counts for n in created),'Everyatlas ownerinframing')
 lo,hi=bbox(heads);center=(lo+hi)/2;scale=float(max(hi-lo)*1.12);frame={'center':list(center),'scale':scale,'resolution':[768,768],'min':list(lo),'max':list(hi)}
 snapshot={'scene':warm,'extras':extras,'metadata':meta(),'created':created,'frame':frame,'domains':counts}
 with (P/'WARM.json').open('x') as f:json.dump(snapshot,f,indent=2);f.write('\n')
 target=WORK/'ari-root-flow-atlas.blend';require(not target.exists(),'Newatlaspath');require(bpy.ops.wm.save_as_mainfile(filepath=str(target),check_existing=False,copy=True,relative_remap=False)=={'FINISHED'},'Ownedatlas save');require(helper.capture_scene()==warm and extra(all_names)==extras and meta()==snapshot['metadata'],'Postsaveallowners/keysemantics')
 source_hash=hashlib.sha256(target.read_bytes()).hexdigest();target.chmod(0o444);require(bpy.ops.wm.open_mainfile(filepath=str(target))=={'FINISHED'},'Freshatlasfile open');require(hashlib.sha256(target.read_bytes()).hexdigest()==source_hash,'Exactsavedatlasbytes');require(helper.capture_scene()==warm and extra(all_names)==extras and meta()==snapshot['metadata'],'Coldcompleteatlas/oldsource records')
 body,heads,counts2,saved=render_domain();restore(saved);lo2,hi2=bbox(heads);require(counts2==counts and np.array_equal(lo2,lo) and np.array_equal(hi2,hi),'Coldrenderdomain equality')
 scene=bpy.context.scene;oldworld=scene.world;oldcamera=scene.camera;camera,diagnostics,world=settings(scene,center);require(len(diagnostics)==4 and not set(diagnostics)&all_names,'Owneddiagnostics');scene.render.resolution_x=768;scene.render.resolution_y=768;camera.data.ortho_scale=scale
 body,heads,counts3,saved=render_domain()
 for view,direction in [('front',(0,-1,0)),('profile',(1,0,0)),('rear',(0,1,0))]:
  camera.location=Vector(center)+Vector(direction)*5;orient(camera,Vector(center));bpy.context.view_layer.update();projected=[world_to_camera_view(scene,camera,Vector(p)) for p in heads];require(all(.04<=p.x<=.96 and .04<=p.y<=.96 and p.z>0 for p in projected),'Allpoint atlas framing '+view)
  targetpng=P/('atlas-'+view+'.png');require(not targetpng.exists(),'Exclusiveatlas original');scene.render.filepath=str(targetpng);require(bpy.ops.render.render(write_still=True)=={'FINISHED'} and targetpng.is_file(),'OriginalCPU render '+view);targetpng.chmod(0o444);REPORT['outputs'].append({'view':view,'path':str(targetpng),'bytes':targetpng.stat().st_size,'sha256':hashlib.sha256(targetpng.read_bytes()).hexdigest(),'resolution':[768,768],'camera':list(camera.location),'center':list(center),'scale':scale,'projection':{'minx':min(p.x for p in projected),'maxx':max(p.x for p in projected),'miny':min(p.y for p in projected),'maxy':max(p.y for p in projected)}})
 restore(saved)
 for name in diagnostics:
  o=bpy.data.objects[name];d=o.data;bpy.data.objects.remove(o,do_unlink=True)
  if isinstance(d,bpy.types.Camera):bpy.data.cameras.remove(d)
  else:bpy.data.lights.remove(d)
 scene.world=oldworld;scene.camera=oldcamera;bpy.data.worlds.remove(world)
 require(helper.capture_scene()==warm and extra(all_names)==extras and meta()==snapshot['metadata'],'Normalpath diagnosticcleanup restores source+atlas');require(len(REPORT['outputs'])==3,'Completefirst atlas originals')
 for r in E['pins']:physical(r)
 REPORT.update({'passed':True,'source':str(target),'source_bytes':target.stat().st_size,'source_sha256':source_hash,'cold_exact':True,'old_source_exact':True,'zones':{k:len(v) for k,v in A['zones'].items()},'excluded':len(A['excluded']),'guides':len(A['guides']),'frame':frame,'domains':counts})
except Exception as ex:REPORT['exception']=repr(ex)
finally:
 REPORT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();REPORT['limits']='Artistatlas only, no curls/hairline/physicalclearance/bodyidentity/material/motion/consumer/AAA approval. Partialfailure isolated, normalcleanup only/no rollback; no retake.'
 with (P/'RESULT.json').open('x') as f:json.dump(REPORT,f,indent=2);f.write('\n')
 print('SUGATA_ROOT_FLOW_ATLAS '+json.dumps({k:v for k,v in REPORT.items() if k!='checks'}),flush=True)
if not REPORT['passed']:raise SystemExit(1)
