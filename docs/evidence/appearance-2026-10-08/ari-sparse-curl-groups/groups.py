"""One isolated original sparse Curve candidate; complete static witnesses and images."""
from pathlib import Path
import sys,json,hashlib,datetime,math,ast,importlib.util
sys.dont_write_bytecode=True
import numpy as np
import bpy
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
P=Path(__file__).resolve().parent;WORK=P/'work';E=json.loads((P/'EXEC-PLAN.json').read_text());REPORT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'outputs':[],'checks':[]}
def require(ok,label):
 if not ok:raise RuntimeError(label)
 REPORT['checks'].append(label)
def load(name,file):
 s=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def write(name,value):
 with (P/name).open('x') as f:json.dump(value,f,indent=2);f.write('\n')
def buffer(name,arrays):
 path=WORK/name;np.savez_compressed(path,**arrays);path.chmod(0o444)
 return {'path':str(path),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
def original():
 return C.original_only(helper.capture_scene(),before)==before and C.original_extras(old_names)==old_extra and C.meta()==W['full_native_key_metadata'] and C.digest(C.mixed(bpy.data.objects['Human']))==W['body_new_mixed_coordinate_sha256']
try:
 require(bpy.app.background and not bpy.app.online_access,'OfflineCPU oneoriginal')
 for r in E['pins']:
  data=Path(r['path']).read_bytes();require(len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256'],'Localstdlib pin before code load '+r['path'])
 C=load('sugata_sparse_lib',P/'group_lib.py')
 R=json.loads((P/'RECIPE.json').read_text());A=json.loads(Path(E['partition']).read_text());W=json.loads(Path(E['warm']).read_text());require(not WORK.exists(),'Exclusivework');WORK.mkdir()
 helper=load('sugata_sparse_scene',E['scene_helper']);require(bpy.ops.wm.open_mainfile(filepath=E['source']['path'])=={'FINISHED'},'Exactv2open');before=helper.capture_scene();require(before==W['scene'] and C.meta()==W['full_native_key_metadata'],'Old7/108/252exact');old_names={x['name'] for x in before['objects']};old_extra=C.original_extras(old_names);require(original(),'Initialoldmixed/extras')
 body=bpy.data.objects['Human'];raw=C.mixed(body);matrix=np.asarray(body.matrix_world);world=(np.column_stack((raw,np.ones(len(raw))))@matrix.T)[:,:3];rows={x['triangle']:x for zone in A['zones'].values() for x in zone};ledger=[];controls=[];radii=[]
 for gi,g in enumerate(R['groups']):
  row=rows[g['source_triangle']];require(row['vertices']==g['source_vertices'] and row['zone']==g['zone'],'ExactguidesourceIDs');coords=world[row['vertices']];require(np.max(np.abs(coords-np.asarray(row['coordinates'])))<=R['root_tol_m'],'Actualmixedroottriangle')
  N=np.asarray(g['normal']);D=np.asarray(g['direction']);B=np.cross(N,D);B/=np.linalg.norm(B);require(abs(np.dot(N,D))<1e-6 and abs(np.linalg.norm(N)-1)<1e-6 and abs(np.linalg.norm(D)-1)<1e-6,'Unitorthogonalauthoredbasis');par=R['parameters'][g['zone']]
  for si,bary in enumerate(R['barycentric']):
   root=np.asarray(bary)@coords;scale=R['filament_scales'][si];L=par['length_m']*scale;lift=par['lift_m']*scale;c=par['curl_m']*scale;pts=[];rad=[]
   for k in range(65):
    t=k/64;theta=2*math.pi*R['turns']*t;envelope=math.sin(math.pi*t/2);v=root+D*L*t+N*(R['base_offset_m']+lift*math.sin(.8*math.pi*t)+c*(1-math.cos(theta))*envelope)+B*c*math.sin(theta)*envelope;pts.append([*v,1]);rad.append(1-(1-R['taper_tip'])*t)
   co=np.asarray(pts,dtype=np.float32);ra=np.asarray(rad,dtype=np.float32);controls.append(co);radii.append(ra);ledger.append({'group':gi,'strand':si,'zone':g['zone'],'triangle':g['source_triangle'],'vertices':row['vertices'],'barycentric':bary,'root':root.tolist(),'normal':N.tolist(),'direction':D.tolist(),'bitangent':B.tolist(),'controls':co.tolist(),'radii':ra.tolist()})
 require(len(ledger)==27 and all(np.isfinite(x).all() for x in controls+radii),'Finite27x65declared');write('PATHS.json',ledger)
 d=bpy.data.curves.new('AriSparseOriginalGroupsData','CURVE');d.dimensions='3D';d.bevel_mode='ROUND';d.bevel_depth=R['bevel_depth_m'];d.bevel_resolution=R['bevel_resolution'];d.resolution_u=1;d.use_fill_caps=True;d.fill_mode='FULL';d.use_radius=True;d.use_path=False
 for co,ra in zip(controls,radii):
  s=d.splines.new('POLY');s.points.add(64);s.use_cyclic_u=False;s.resolution_u=1
  for p,v,r in zip(s.points,co,ra):p.co=v;p.radius=float(r);p.tilt=0
 o=bpy.data.objects.new('AriSparseOriginalGroups',d);bpy.context.scene.collection.objects.link(o);o.parent=bpy.data.objects['Human.rig'];o.parent_type='BONE';o.parent_bone='head';o.matrix_world=Matrix.Identity(4);bpy.context.view_layer.update();require(np.max(np.abs(np.asarray(o.matrix_world)-np.eye(4)))<=1e-6,'Ownedworldidentitytol')
 m=bpy.data.materials.new('AriSparseDarkBrown');m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');require(n is not None,'ActualPrincipled');n.inputs['Base Color'].default_value=R['material_rgba'];n.inputs['Roughness'].default_value=R['roughness'];n.inputs['Metallic'].default_value=0;d.materials.append(m)
 cr,ca=C.curve_record(o)
 for i in range(27):require(np.array_equal(ca[str(i)+'_co'],controls[i]) and np.array_equal(ca[str(i)+'_radius'],radii[i]),'Exactactualcontrols/radii '+str(i))
 all_names=old_names|{o.name};require(set(x.name for x in bpy.data.objects)==all_names and original(),'OnlyadditiveCurve/oldpreservation');curve_name=o.name
 records,arrays=C.evaluated(['Human',curve_name],R['bounds']['all_vertices'],R['bounds']['all_triangles']);gr=records[curve_name];require(gr['vertices']<=R['bounds']['curve_vertices'] and gr['triangles']<=R['bounds']['curve_triangles'] and gr['edges']<=R['bounds']['edges'],'ProspectiveCurvebudget')
 REPORT['buffers']=[buffer('actual-curve.npz',ca),buffer('actual-static-geometry.npz',arrays)];write('GEOMETRY.json',records);write('CURVE.json',cr)
 # Artist envelope refusal evaluates entire tube triangles, conservatively via triangle AABBs.
 verts=arrays[curve_name+'_world'];tri=arrays[curve_name+'_triangles'];tv=verts[tri];tlo=tv.min(axis=1);thi=tv.max(axis=1);env={'triangles':len(tri),'ear_tests':0,'forehead_triangle_tests':len(tri),'first_refusal':None}
 for side,box in R['ear_intent_boxes'].items():
  overlaps=np.flatnonzero(np.all(thi>=np.asarray(box['min']),axis=1)&np.all(tlo<=np.asarray(box['max']),axis=1));env['ear_tests']+=len(tri)
  if len(overlaps):
   i=int(overlaps[0]);env['first_refusal']={'kind':'conservativeearboxoverlap','side':side,'triangle':i,'indices':tri[i].tolist(),'coordinates':tv[i].tolist()};break
 gate=R['forehead_gate'];ids=np.flatnonzero((tlo[:,1]<gate['front_y'])&(tlo[:,2]<gate['min_z']))
 if len(ids) and env['first_refusal'] is None:env['first_refusal']={'kind':'conservativeforeheadtriangleAABB','triangle':int(ids[0]),'indices':tri[ids[0]].tolist(),'coordinates':tv[ids[0]].tolist()}
 write('ENVELOPE.json',env);require(env['first_refusal'] is None,'Staticartist envelope')
 # Exact evaluated Human surface, finite segment BVH observations; no solid occupancy claim.
 hv=arrays['Human_world'];ht=arrays['Human_triangles'];bvh=BVHTree.FromPolygons([Vector(p) for p in hv],[list(map(int,t)) for t in ht],all_triangles=True,epsilon=0.0);require(bvh is not None,'ActualHumanBVH')
 edges=arrays[curve_name+'_edges'];contact={'surface':'Human renderequivalent triangles only','vertices':len(verts),'edges':len(edges),'ray_tests':0,'degenerate_edges':0,'minimum_unsigned_distance_m':None,'nearest_witness':None,'first_hit':None,'limits':'BVH finite segment hits only; coplanar/endpoint precision unsupported, no formal transverse predicate or solidoccupancy, otheranatomy/selfcontact/motion held.'}
 for i,p in enumerate(verts):
  loc,normal,face,dist=bvh.find_nearest(Vector(p));require(loc is not None and all(math.isfinite(x) for x in [dist,*loc,*normal]) and isinstance(face,int) and 0<=face<len(ht),'Finitecomplete nearest')
  if contact['minimum_unsigned_distance_m'] is None or dist<contact['minimum_unsigned_distance_m']:contact['minimum_unsigned_distance_m']=dist;contact['nearest_witness']={'vertex':i,'point':p.tolist(),'closest':list(loc),'triangle':int(face),'indices':ht[face].tolist(),'triangle_coordinates':hv[ht[face]].tolist(),'distance_m':dist}
 for i,e in enumerate(edges):
  a=Vector(verts[e[0]]);delta=Vector(verts[e[1]])-a;length=delta.length;require(math.isfinite(length),'Finiteedge')
  if length<=1e-10:contact['degenerate_edges']+=1;continue
  loc,norm,face,dist=bvh.ray_cast(a,delta/length,length);contact['ray_tests']+=1
  if loc is not None:
   require(math.isfinite(dist) and -1e-7<=dist<=length+1e-7 and all(math.isfinite(x) for x in [*loc,*norm]) and isinstance(face,int) and 0<=face<len(ht),'Finitebounded completehit');contact['first_hit']={'edge':i,'indices':e.tolist(),'start':list(a),'end':list(a+delta),'length_m':length,'hit':list(loc),'distance_m':dist,'triangle':int(face),'triangle_indices':ht[face].tolist(),'triangle_coordinates':hv[ht[face]].tolist(),'label':'OBSERVED_BVH_SEGMENT_HIT, not certified propercrossing/penetration'};break
 write('CONTACT.json',contact);require(contact['first_hit'] is None,'Noobserved staticedge hit');require(original() and C.curve_record(o)[0]==cr,'Postcontact original/Curveexact')
 # Every evaluated CURVE point joins the unchanged mesh portrait observer.
 exec(compile((P/'render_helpers.py').read_text(),str(P/'render_helpers.py'),'exec'),globals());bodypts,heads,counts,saved=render_domain();restore(saved);require(curve_name in counts and counts[curve_name]['render_vertices']==gr['vertices'],'CompleteCurveframe domain');require(original() and C.curve_record(o)[0]==cr,'Framingobserver restore')
 lo,hi=bbox(heads);center=(lo+hi)/2;scale=float(max(hi-lo)*1.12);frame={'center':list(center),'scale':scale,'resolution':[768,768],'min':list(lo),'max':list(hi)};warm=helper.capture_scene();extras=C.original_extras(all_names);write('WARM.json',{'scene':warm,'extras':extras,'metadata':C.meta(),'curve':cr,'frame':frame,'domains':counts})
 target=WORK/'ari-sparse-curl-groups.blend';require(bpy.ops.wm.save_as_mainfile(filepath=str(target),check_existing=False,copy=True,relative_remap=False)=={'FINISHED'},'Ownedcandidatesave');require(original() and helper.capture_scene()==warm and C.original_extras(all_names)==extras and C.curve_record(o)[0]==cr,'Postsavefullrecords');target.chmod(0o444);filehash=hashlib.sha256(target.read_bytes()).hexdigest();require(bpy.ops.wm.open_mainfile(filepath=str(target))=={'FINISHED'},'Sameprocessfreshsavedopen');o=bpy.data.objects[curve_name];require(original() and helper.capture_scene()==warm and C.original_extras(all_names)==extras and C.curve_record(o)[0]==cr,'Freshopencompleteold+Curve');coldrecords,coldarrays=C.evaluated(['Human',curve_name],R['bounds']['all_vertices'],R['bounds']['all_triangles']);require(coldrecords==records,'Freshopen evaluatedgeometryexact');write('REOPEN.json',{'old_scene':helper.capture_scene(),'extras':C.original_extras(all_names),'metadata':C.meta(),'curve':C.curve_record(o)[0],'evaluated':coldrecords,'same_process':True})
 scene=bpy.context.scene;oldworld=scene.world;oldcamera=scene.camera;camera,diag,worlddiag=settings(scene,center);require(len(diag)==4 and not set(diag)&all_names,'Exclusive4diagnostics');scene.render.resolution_x=768;scene.render.resolution_y=768;camera.data.ortho_scale=scale
 _,heads,counts2,saved=render_domain();require(counts2==counts,'Exactrenderframe counts')
 for view,direction in [('front',(0,-1,0)),('profile',(1,0,0)),('rear',(0,1,0))]:
  camera.location=Vector(center)+Vector(direction)*5;orient(camera,Vector(center));bpy.context.view_layer.update();projected=[world_to_camera_view(scene,camera,Vector(p)) for p in heads];require(all(.04<=p.x<=.96 and .04<=p.y<=.96 and p.z>0 for p in projected),'Allpointframing '+view);png=P/('groups-'+view+'.png');require(not png.exists(),'Exclusivefirstoriginal');scene.render.filepath=str(png);require(bpy.ops.render.render(write_still=True)=={'FINISHED'} and png.is_file(),'Firstoriginal '+view);png.chmod(0o444);REPORT['outputs'].append({'view':view,'path':str(png),'bytes':png.stat().st_size,'sha256':hashlib.sha256(png.read_bytes()).hexdigest(),'resolution':[768,768],'projection':{'minx':min(p.x for p in projected),'maxx':max(p.x for p in projected),'miny':min(p.y for p in projected),'maxy':max(p.y for p in projected)}})
 restore(saved)
 for name in diag:
  obj=bpy.data.objects[name];data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
  if isinstance(data,bpy.types.Camera):bpy.data.cameras.remove(data)
  else:bpy.data.lights.remove(data)
 scene.world=oldworld;scene.camera=oldcamera;bpy.data.worlds.remove(worlddiag);require(original() and helper.capture_scene()==warm and C.original_extras(all_names)==extras and C.curve_record(o)[0]==cr,'Normalcleanupcompleteold+Curve');write('CLEANUP.json',{'scene':helper.capture_scene(),'extras':C.original_extras(all_names),'metadata':C.meta(),'curve':C.curve_record(o)[0]})
 for r in E['pins']:C.pin(r)
 REPORT.update({'passed':True,'source':str(target),'source_bytes':target.stat().st_size,'source_sha256':filehash,'frame':frame,'domains':counts,'geometry':records,'same_process_reopen':True,'old_source_exact':True,'static_contact':contact,'envelope':env})
except Exception as ex:REPORT['exception']=repr(ex)
finally:
 REPORT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();REPORT['limits']='SparseoriginalCurve only, no densegroom/physicaloccupancy/clearance/selfcontact/allanatomy/motion/export/runtime/AAA approval. Partialfailure preserved; normalpathcleanup only, no rollback orretake.';write('RESULT.json',REPORT);print('SUGATA_SPARSE_GROUPS '+json.dumps({k:v for k,v in REPORT.items() if k!='checks'}),flush=True)
if not REPORT['passed']:raise SystemExit(1)
