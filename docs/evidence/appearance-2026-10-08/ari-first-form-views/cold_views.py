"""One cold-persistence gate then twelve shared-frame first native images."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json,hashlib,datetime,importlib.util,math
import numpy as np
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
HERE=Path(__file__).resolve().parent
PLAN=json.loads((HERE/'EXEC-PLAN.json').read_text())
REPORT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'outputs':[],'cold':[],'passed':False}
def require(ok,label):
 if not ok:raise RuntimeError(label)
def load_module(name,file):
 s=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def physical(pin):
 b=Path(pin['path']).read_bytes();require(len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],'Changed source '+pin['path'])
for pin in PLAN['pins']:physical(pin)
require(bpy.app.background and not bpy.app.online_access,'Offline background only')
receipt=load_module('sugata_view_receipt',PLAN['scene_helper'])
WARM=json.loads(Path(PLAN['warm']).read_text());NEUTRAL=json.loads(Path(PLAN['neutral_receipt']).read_text())['scene']
def metadata():
 return {o.name:[{'name':k.name,'relative':k.relative_key.name,'value':k.value,'min':k.slider_min,'max':k.slider_max,'mute':k.mute,'vertex_group':k.vertex_group,'interpolation':k.interpolation} for k in o.data.shape_keys.key_blocks] for o in bpy.data.objects if o.type=='MESH' and o.data.shape_keys}
def coords(points):
 a=np.empty(len(points)*3,dtype=np.float32);points.foreach_get('co',a);require(np.isfinite(a).all(),'Finite native coordinates');return a.reshape(-1,3)
def mixhash():
 keys=bpy.data.objects['Human'].data.shape_keys.key_blocks;b=coords(keys[0].data).astype(np.float64);result=b.copy()
 for k in list(keys)[1:]:
  if not k.mute and k.value:
   require(not k.vertex_group,'No grouped mix');result+=(coords(k.data).astype(np.float64)-coords(k.relative_key.data).astype(np.float64))*k.value
 require(np.isfinite(result).all(),'Finite mixed default');return hashlib.sha256(result.astype(np.float32).tobytes()).hexdigest()
def open_checked(label):
 pin=PLAN['sources'][label];physical(pin);result=bpy.ops.wm.open_mainfile(filepath=pin['path']);require(result=={'FINISHED'},'Cold open finished')
 require(Path(bpy.data.filepath).resolve()==Path(pin['path']).resolve(),'Exact loaded source')
 actual=receipt.capture_scene();expected=WARM['scene'] if label=='ari' else NEUTRAL;require(actual==expected,'Complete cold owner signature:'+label)
 meta=metadata()
 if label=='ari':
  require(meta==WARM['full_native_key_metadata'],'All252 cold semantics')
  require(mixhash()==WARM['body_new_mixed_coordinate_sha256'],'Cold mixed body exact')
 else:
  require(all(k['relative']=='Basis' and not k['mute'] and not k['vertex_group'] and k['interpolation']=='KEY_LINEAR' for values in meta.values() for k in values),'Neutral default semantics')
 REPORT['cold'].append({'label':label,'scene_exact':True,'key_metadata':meta,'mixed_body_hash':mixhash(),'file_sha256':pin['sha256']})
 return actual,meta

def render_domain():
 saved=[]
 for o in bpy.data.objects:
  if o.type=='MESH':
   for m in o.modifiers:
    saved.append((m,m.show_viewport,getattr(m,'levels',None)))
    m.show_viewport=m.show_render
    if m.type=='SUBSURF':m.levels=m.render_levels
 bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();body=[];head=[];counts={}
 for o in bpy.data.objects:
  if o.type!='MESH' or o.hide_render:continue
  ev=o.evaluated_get(dg);mesh=ev.to_mesh(preserve_all_data_layers=True,depsgraph=dg)
  groups={g.index:g.name for g in o.vertex_groups};headids={i for i,n in groups.items() if n in {'head','neck_01'}}
  if o.name=='Human':require({'head','neck_01'}.issubset(set(groups.values())),'Actual head/neck_01 groups exist')
  local=[];nh=0
  for v in mesh.vertices:
   p=ev.matrix_world@v.co;require(all(math.isfinite(x) for x in p),'Finite render-domain point');body.append(tuple(p));local.append(tuple(p))
   # Conservative attachment domain includes all positive head/jaw/neck skin participation,
   # preserving scalp/ears/body head skin instead of using anatomy-only or a bone crop.
   if o.name!='Human' or any(g.group in headids and g.weight>0 for g in v.groups):head.append(tuple(p));nh+=1
  counts[o.name]={'render_vertices':len(mesh.vertices),'head_domain_vertices':nh,'head_group_ids_names':{str(i):groups[i] for i in sorted(headids)}}
  ev.to_mesh_clear()
 require(head and counts['Human']['head_domain_vertices']>0,'Full body head attachment domain retained')
 return body,head,counts,saved

def restore(saved):
 for m,visible,level in saved:
  m.show_viewport=visible
  if level is not None:m.levels=level
 bpy.context.view_layer.update()
def bbox(points):
 a=np.asarray(points);lo=a.min(axis=0);hi=a.max(axis=0);return lo,hi

def orient(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def settings(scene,center):
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.seed=0
 scene.cycles.use_denoising=True;scene.cycles.denoiser='OPENIMAGEDENOISE'
 if hasattr(scene.cycles,'denoising_use_gpu'):scene.cycles.denoising_use_gpu=False
 scene.render.threads_mode='FIXED';scene.render.threads=16;scene.render.resolution_percentage=100
 scene.render.pixel_aspect_x=1;scene.render.pixel_aspect_y=1
 scene.render.use_compositing=False;scene.render.use_sequencer=False
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
 scene.view_settings.view_transform='AgX';scene.view_settings.exposure=0;scene.view_settings.gamma=1
 world=bpy.data.worlds.new('SugataSharedWorld');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.2,.2,.2,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.4;scene.world=world
 names=[]
 for name,pos,energy,size in [('Key',(-3,-4,4),700,4),('Fill',(3,-2,3),450,4),('Rear',(0,4,4),600,4)]:
  d=bpy.data.lights.new('Sugata'+name,'AREA');d.energy=energy;d.shape='DISK';d.size=size;o=bpy.data.objects.new('Sugata'+name,d);scene.collection.objects.link(o);o.location=Vector(pos);orient(o,center);names.append(o.name)
 d=bpy.data.cameras.new('SugataSharedCamera');d.type='ORTHO';d.sensor_fit='VERTICAL';d.clip_start=.01;d.clip_end=100
 c=bpy.data.objects.new('SugataSharedCamera',d);scene.collection.objects.link(c);scene.camera=c;names.append(c.name)
 look={'view_transform':scene.view_settings.view_transform,'look':scene.view_settings.look,'display':scene.display_settings.display_device,'exposure':scene.view_settings.exposure,'gamma':scene.view_settings.gamma,'curve_mapping':scene.view_settings.use_curve_mapping,'compositing':scene.render.use_compositing,'sequencer':scene.render.use_sequencer,'pixel_aspect':[scene.render.pixel_aspect_x,scene.render.pixel_aspect_y]}
 require(not look['curve_mapping'],'No unowned tone curve')
 if 'shared_look' in REPORT:require(look==REPORT['shared_look'],'Identical inherited display/look controls')
 else:REPORT['shared_look']=look
 return c,names,world

try:
 domains={}
 # Both complete cold signatures qualify before any diagnostic object or image.
 for label in ['neutral','ari']:
  before,meta=open_checked(label);points,heads,counts,saved=render_domain();domains[label]={'body':points,'head':heads,'counts':counts};restore(saved)
  require(receipt.capture_scene()==before and metadata()==meta,'Bounds observer restores source state:'+label)
 frames={}
 for framing,res in [('body',(768,1024)),('head',(768,768))]:
  points=domains['neutral'][framing]+domains['ari'][framing];lo,hi=bbox(points);center=(lo+hi)/2;span=hi-lo
  scale=float(max(span[2],max(span[0],span[1])/(res[0]/res[1]))*1.12)
  frames[framing]={'center':center.tolist(),'scale':scale,'resolution':list(res),'union_min':lo.tolist(),'union_max':hi.tolist()}
 REPORT['shared_frames']=frames;REPORT['domains']={label:{'counts':data['counts']} for label,data in domains.items()}
 for label in ['neutral','ari']:
  before,meta=open_checked(label);points,heads,counts,saved=render_domain();scene=bpy.context.scene;oldworld=scene.world;oldcamera=scene.camera;camera,diag,world=settings(scene,frames['body']['center'])
  require(len(diag)==4 and not set(diag)&{o['name'] for o in before['objects']},'Diagnostic object ownership')
  for framing in ['body','head']:
   f=frames[framing];scene.render.resolution_x,scene.render.resolution_y=f['resolution'];camera.data.ortho_scale=f['scale'];target=Vector(f['center'])
   for view,direction in [('front',(0,-1,0)),('profile',(1,0,0)),('rear',(0,1,0))]:
    camera.location=target+Vector(direction)*5;orient(camera,target);bpy.context.view_layer.update()
    domain=points if framing=='body' else heads;projected=[world_to_camera_view(scene,camera,Vector(p)) for p in domain]
    require(all(.04<=p.x<=.96 and .04<=p.y<=.96 and p.z>0 for p in projected),'Shared complete framing:'+label+'/'+framing+'/'+view)
    path=HERE/(label+'-'+framing+'-'+view+'.png');require(not path.exists(),'Exclusive first image')
    scene.render.filepath=str(path);done=bpy.ops.render.render(write_still=True);require(done=={'FINISHED'} and path.is_file(),'First render complete')
    REPORT['outputs'].append({'label':label,'framing':framing,'view':view,'path':str(path),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'camera':list(camera.location),'target':f['center'],'scale':f['scale'],'resolution':f['resolution'],'projected_bounds':{'minx':min(p.x for p in projected),'maxx':max(p.x for p in projected),'miny':min(p.y for p in projected),'maxy':max(p.y for p in projected)}})
  restore(saved);after=receipt.capture_scene();require({o['name'] for o in after['objects']}=={o['name'] for o in before['objects']}|set(diag),'Exact source plus diagnostic object set')
  for name in diag:
   obj=bpy.data.objects[name];data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
   if isinstance(data,bpy.types.Camera):bpy.data.cameras.remove(data)
   else:bpy.data.lights.remove(data)
  scene.world=oldworld;scene.camera=oldcamera;bpy.data.worlds.remove(world)
  require(receipt.capture_scene()==before and metadata()==meta,'Exact source owner/semantic restoration:'+label)
 for pin in PLAN['pins']:physical(pin)
 require(len(REPORT['outputs'])==12,'Complete first image set');REPORT['passed']=True
except Exception as e:
 REPORT['exception']=repr(e)
finally:
 REPORT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();REPORT['failure_cleanup']='Normal successful path removes exact diagnostics/restores modifiers+world/camera; failure ends isolated process with partial originals, no rollback claim'
 REPORT['limits']='Cold saved native defaults/shared source camera first images only; no source save/retune/export/expressionmotion/fit/appearance acceptance before actual image review'
 with (HERE/'RESULT.json').open('x') as out:json.dump(REPORT,out,indent=2);out.write('\n')
 print('SUGATA_SHARED_VIEWS '+json.dumps({k:v for k,v in REPORT.items() if k not in ['cold']}))
if not REPORT['passed']:raise SystemExit(1)
