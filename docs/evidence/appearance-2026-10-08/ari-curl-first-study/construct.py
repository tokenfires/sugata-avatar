"""One original grouped-coil candidate; actual source/ownership/contact guards first."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json,datetime,math,time
import numpy as np
import bpy
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
import importlib.util,hashlib
HERE=Path(__file__).resolve().parent;WORK=HERE/'work';EXEC=json.loads((HERE/'EXEC-PLAN.json').read_text())
REPORT={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'success':False,'checks':[]}
def check(ok,label):
 if not ok:raise RuntimeError(label)
 REPORT['checks'].append(label)
def write(name,data):
 with (HERE/name).open('x') as f:json.dump(data,f,indent=2);f.write('\n')
def material(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');check(n is not None,'ActualPrincipledBSDF')
 n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=.45;n.inputs['Metallic'].default_value=0
 return m
def parent(o,rig):
 o.parent=rig;o.parent_type='BONE';o.parent_bone='head';o.matrix_world=Matrix.Identity(4);bpy.context.view_layer.update()
 check(np.max(np.abs(np.asarray(o.matrix_world)-np.eye(4)))<=1e-6,'Worldidentity afterexplicit boneparent '+o.name)
try:
 check(bpy.app.background and not bpy.app.online_access,'Offlinebackground')
 for row in EXEC['pins']:
  raw=Path(row['path']).read_bytes();check(len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'],'Bootstrap physicalpin '+row['path'])
 _spec=importlib.util.spec_from_file_location('sugata_original_curl_lib',HERE/'curl_lib.py');C=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(C)
 WARM=json.loads(Path(EXEC['warm']).read_text())
 check(not WORK.exists(),'Exclusivenew work');WORK.mkdir();source=WORK/'ari-original-curls.blend';check(not source.exists(),'Newcandidate')
 check(bpy.ops.wm.open_mainfile(filepath=EXEC['source']['path'])=={'FINISHED'},'Exactsourcecoldopen');C.pin(EXEC['source'])
 receipt=C.module('sugata_curl_base_receipt',EXEC['scene_helper']);before=receipt.capture_scene();check(before==WARM['scene'],'Completeoriginal signature')
 names={o['name'] for o in before['objects']};extras=C.original_extras(names);check(C.meta()==WARM['full_native_key_metadata'],'All252source semantics')
 body=bpy.data.objects['Human'];rig=bpy.data.objects['Human.rig'];mixed=C.mixed(body);check(C.digest(mixed)==WARM['body_new_mixed_coordinate_sha256'],'Exactsource mixedhash')
 check(np.max(np.abs(np.asarray(body.matrix_world)-np.eye(4)))<=1e-12,'Sourceworldidentity')
 check(all(np.max(np.abs(np.asarray(b.matrix_basis)-np.eye(4)))<=1e-12 for b in rig.pose.bones),'All53unposed')
 groups={g.name:g.index for g in body.vertex_groups};check(all(n in groups for n in ['scalp','body','ears','head']),'Actualnominee groups')
 weights=[{g.group:g.weight for g in v.groups} for v in body.data.vertices]
 body.data.calc_loop_triangles();patch=[];excluded=[]
 membership=np.asarray([[w.get(groups[n],0) for n in ['body','scalp','head','ears']] for w in weights],dtype=np.float32)
 check(np.isfinite(membership).all() and np.all((membership>=0)&(membership<=1)),'Finite bounded sourceparticipation beforeclassification')
 eligible=[all(w.get(groups[n],0)>0 for n in ['scalp','body','head']) and w.get(groups['ears'],0)==0 for w in weights]
 np.savez_compressed(WORK/'source-membership.npz',body_scalp_head_ears=membership,mixed_body=mixed)
 for tri in body.data.loop_triangles:
  ids=list(tri.vertices)
  if not all(eligible[i] for i in ids):
   excluded.append({'triangle':tri.index,'polygon':tri.polygon_index,'vertices':ids,'reasons':{str(i):[n+'_notpositive' for n in ['body','scalp','head'] if weights[i].get(groups[n],0)<=0]+(['ears_positive'] if weights[i].get(groups['ears'],0)>0 else []) for i in ids if not eligible[i]},'participation_rows':ids});continue
  pts=mixed[ids].astype(np.float64);normal=np.cross(pts[1]-pts[0],pts[2]-pts[0]);size=np.linalg.norm(normal)
  check(np.isfinite(size) and size>1e-12,'Finite nondegenerate scalp triangle')
  patch.append({'triangle':tri.index,'polygon':tri.polygon_index,'vertices':ids,'coordinates':pts.tolist(),'normal':(normal/size).tolist(),'area':float(size/2),'weights':[{n:weights[i].get(groups[n],0) for n in ['body','scalp','head','ears']} for i in ids]})
 check(0<len(patch)<=8000,'Bounded actualscalp ledger');check(not any(weights[i].get(groups['ears'],0)>0 for t in patch for i in t['vertices']),'Explicitear exclusions')
 edge_rows={tuple(sorted(e.vertices)):e.index for e in body.data.edges};edge_count={};edge_triangles={}
 for t in patch:
  ids=t['vertices']
  for a,b in [(ids[0],ids[1]),(ids[1],ids[2]),(ids[2],ids[0])]:
   key=tuple(sorted((a,b)));edge_count[key]=edge_count.get(key,0)+1;edge_triangles.setdefault(key,[]).append(t['triangle'])
 boundaries=[{'vertices':list(e),'source_edge':edge_rows.get(e),'kind':'source_edge' if e in edge_rows else 'source_triangulation_diagonal','patch_triangles':edge_triangles[e]} for e,count in sorted(edge_count.items()) if count==1]
 write('PATCH-DOMAIN.json',{'source_sha256':EXEC['source']['sha256'],'patch':patch,'excluded_triangles':excluded,'boundary_edges':boundaries,'participation_array':'work/source-membership.npz','participation_columns':['body','scalp','head','ears'],'limits':'Source-semantic nominatedpatch, not visual hairline approval'})
 visible=[n for n in names if bpy.data.objects[n].type=='MESH' and not bpy.data.objects[n].hide_render]
 skin_record,skin=C.evaluated(visible,250000,500000);check(receipt.capture_scene()==before and C.original_extras(names)==extras,'Originaleval restores')
 pts=[];triangles=[]
 for n in sorted(visible):
  a=skin[n+'_world'];ts=skin[n+'_triangles'];off=len(pts);pts.extend(a.tolist());triangles.extend((ts+off).tolist())
 np.savez_compressed(WORK/'source-skin-geometry.npz',**skin)
 REPORT['skin_owner_order']=sorted(visible);REPORT['skin_geometry']=skin_record
 surface=BVHTree.FromPolygons(pts,triangles,all_triangles=True,epsilon=0.0);check(surface is not None,'Fullvisible skin/anatomyBVH')
 rng=np.random.default_rng(20261008);areas=np.array([t['area'] for t in patch]);cumulative=np.cumsum(areas);clumps=[];controls=[];radii=[]
 for j in range(400):
  index=int(np.searchsorted(cumulative,(j+.5)/400*cumulative[-1]));t=patch[index];u,v=rng.random(2);su=math.sqrt(u);bary=np.array([1-su,su*(1-v),su*v]);root=bary@np.asarray(t['coordinates']);normal=np.asarray(t['normal'])
  near,norm,face,dist=surface.find_nearest(Vector(root))
  if near is None or norm is None or dist is None or not math.isfinite(dist) or not all(math.isfinite(v) for v in near) or dist>1e-5:
   REPORT['refusal_witness']={'stage':'unlifted_root_association','clump':j,'source_triangle':t['triangle'],'vertices':t['vertices'],'barycentric':bary.tolist(),'root':root.tolist(),'nearest':repr(near),'normal':repr(norm),'skin_triangle':face,'distance':repr(dist)};check(False,'Root surface association refused')
  axis=np.array([1.,0.,0.]) if abs(normal[2])>.8 else np.array([0.,0.,1.]);tangent=np.cross(normal,axis);tangent/=np.linalg.norm(tangent);bitangent=np.cross(normal,tangent)
  radius=float(rng.uniform(.004,.006));height=float(rng.uniform(.015,.028));phase=float(rng.uniform(0,2*math.pi));strands=[]
  for k in range(5):
   draw={'phase':phase+2*math.pi*k/5+float(rng.uniform(-.12,.12)),'coil_scale':float(rng.uniform(.94,1.06)),'height_scale':float(rng.uniform(.96,1.04))};strands.append(draw);p=[];rr=[]
   for z in range(41):
    a=z/40;angle=draw['phase']+4*math.pi*a;envelope=1-math.exp(-6*a);pt=root+normal*(.001+height*draw['height_scale']*a)+radius*draw['coil_scale']*envelope*(math.cos(angle)*tangent+math.sin(angle)*bitangent)
    p.append([*pt,1.]);rr.append(1-.85*a)
   controls.append(p);radii.append(rr)
  clumps.append({'clump':j,'patch_index':index,'native_triangle':t['triangle'],'vertices':t['vertices'],'barycentric':bary.tolist(),'root':root.tolist(),'normal':normal.tolist(),'coil_radius':radius,'height':height,'strands':strands})
 controls=np.asarray(controls,dtype=np.float32);radii=np.asarray(radii,dtype=np.float32)
 check(controls.shape==(2000,41,4) and radii.shape==(2000,41) and np.isfinite(controls).all() and np.isfinite(radii).all(),'Finitefrozen recipe arrays')
 write('PATCH-ROOTS.json',{'source_sha256':EXEC['source']['sha256'],'groups':groups,'rule':'all positivebody/scalp/head andzeroears pertrianglevertex; no head+neck permission','native_source_topology':next(o['mesh'] for o in before['objects'] if o['name']=='Human'),'patch':patch,'excluded_triangle_ids':[x['triangle'] for x in excluded],'boundary_edges':boundaries,'clumps':clumps,'unlifted_root_surface_tolerance':1e-5,'limits':'Actualsource-semantic scalpnominee, not visual hairline/wholepose qualification'})
 np.savez_compressed(WORK/'declared-controls.npz',controls=controls,radii=radii)
 # The exact ledger and alldraws/arrays are exclusivefrozen outputs before the first Curve mutation.
 c=bpy.data.curves.new('AriOriginalCurlPaths','CURVE');c.dimensions='3D';c.bevel_mode='ROUND';c.bevel_depth=.00020;c.bevel_resolution=1;c.resolution_u=1;c.use_fill_caps=True;c.fill_mode='FULL';c.use_radius=True;c.use_path=False
 for i in range(2000):
  s=c.splines.new('POLY');s.points.add(40);s.use_cyclic_u=False;s.resolution_u=1
  for a,p,r in zip(s.points,controls[i],radii[i]):a.co=p;a.radius=float(r);a.tilt=0.0
 groom=bpy.data.objects.new('AriOriginalCurls',c);bpy.context.scene.collection.objects.link(groom);parent(groom,rig)
 rgb=[.055,.032,.021];linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb];c.materials.append(material('AriOriginalCurlBrown',linear));groom['sugata_source_role']='original-curl-study';groom['sugata_source_file']=str(WORK/'declared-controls.npz')
 pv=[];pf=[]
 for t in patch:
  off=len(pv);pv.extend((np.asarray(t['coordinates'])+np.asarray(t['normal'])*.0006).tolist());pf.append([off,off+1,off+2])
 md=bpy.data.meshes.new('AriScalpAuditData');md.from_pydata(pv,[],pf);md.update();overlay=bpy.data.objects.new('AriScalpAudit',md);bpy.context.scene.collection.objects.link(overlay);parent(overlay,rig);md.materials.append(material('AriScalpAuditGreen',[.08,.6,.12]));overlay.hide_render=True;overlay.hide_viewport=True;overlay['sugata_source_role']='scalp-domain-audit';overlay['sugata_source_file']=str(HERE/'PATCH-ROOTS.json')
 new_names={groom.name,overlay.name};new_extras=C.original_extras(new_names)
 cr,ca=C.curve_record(groom);check(cr['total_controls']==82000,'Actual82000controls')
 for i in range(2000):check(np.array_equal(ca[str(i)+'_co'],controls[i]) and np.array_equal(ca[str(i)+'_radius'],radii[i]),'Exactauthored Float32points/radii')
 g_record,ga=C.evaluated([groom.name],1500000,3000000);world=ga[groom.name+'_world'];edges=ga[groom.name+'_edges'];check(len(edges)<=4000000,'Contactedgebudget')
 REPORT.update({'curve':cr,'scene':receipt.capture_scene(),'new_owner_extras':new_extras,'render_geometry':g_record,'source_original_sha256':EXEC['source']['sha256']})
 np.savez_compressed(WORK/'actual-curve-arrays.npz',**ca);np.savez_compressed(WORK/'actual-render-geometry.npz',**ga)
 minimum=float('inf');calls=0
 for index,point in enumerate(world):
  near,normal,face,distance=surface.find_nearest(Vector(point))
  if near is None or normal is None or distance is None or not math.isfinite(distance) or not all(math.isfinite(v) for v in list(near)+list(normal)) or not math.isfinite(normal.length) or abs(normal.length-1)>1e-5:
   REPORT['refusal_witness']={'stage':'unobservable_vertex_contact','groom_vertex':index,'point':point.tolist(),'nearest':repr(near),'normal':repr(normal),'distance':repr(distance),'skin_triangle':face};check(False,'Finite observable contact sample required')
  clearance=float((Vector(point)-near).dot(normal))
  if not math.isfinite(clearance):
   REPORT['refusal_witness']={'stage':'nonfinite_oriented_clearance','groom_vertex':index,'point':point.tolist(),'clearance':repr(clearance)};check(False,'Finite oriented clearance required')
  minimum=min(minimum,clearance);calls+=1
  if clearance<=1e-6:
   REPORT['refusal_witness']={'groom_vertex':index,'point':point.tolist(),'closest_skin_point':list(near),'normal':list(normal),'skin_triangle':face,'oriented_clearance':clearance};C.require(False,'Nonpositive staticoriented vertexsample')
 check(calls==len(world) and minimum>1e-6,'Every static evaluatedtube vertexsample positive')
 # Every evaluated tubeedge gets one finite segment ray test against allvisible skin/anatomy.
 hits=[];edge_rays=0;degenerate_edges=0
 for ids in edges:
  a=Vector(world[ids[0]]);b=Vector(world[ids[1]]);delta=b-a;length=delta.length
  if not math.isfinite(length) or not all(math.isfinite(v) for v in delta):
   REPORT['refusal_witness']={'stage':'nonfinite_edge_segment','edge':ids.tolist(),'start':list(a),'end':list(b),'length':repr(length),'delta':repr(delta)};check(False,'Finite edge segment before raynormalization')
  if length<=1e-12:degenerate_edges+=1;continue
  edge_rays+=1
  loc,normal,face,distance=surface.ray_cast(a,delta/length,length)
  if loc is not None:
   if normal is None or distance is None or not math.isfinite(distance) or not all(math.isfinite(v) for v in list(loc)+list(normal)):
    REPORT['refusal_witness']={'stage':'unobservable_edge_contact','edge':ids.tolist(),'hit':repr(loc),'normal':repr(normal),'distance':repr(distance)};check(False,'Finite edge-contact required')
   if distance<=length+1e-8:
    witness={'stage':'tube_edge_skin_hit','edge':ids.tolist(),'start':list(a),'end':list(b),'hit':list(loc),'normal':list(normal),'skin_triangle':face,'distance':distance};hits.append(witness);REPORT['refusal_witness']=witness;break
 check(not hits,'No actualtubeedge/skintriangle hit')
 check(C.original_only(receipt.capture_scene(),before)==before and C.original_extras(names)==extras and C.meta()==WARM['full_native_key_metadata'],'Exactoriginal owners/extras/semantics aftergroom')
 check({o.name for o in bpy.data.objects}==names|{groom.name,overlay.name},'Exactadditive objectset')
 REPORT.update({'patch_triangles':len(patch),'clumps':400,'curve':cr,'scene':receipt.capture_scene(),'original_extras':extras,'new_owner_extras':new_extras,'original_names':sorted(names),'new_names':[groom.name,overlay.name],'render_geometry':g_record,'skin_geometry':skin_record,'contact':{'oriented_vertex_samples':calls,'minimum_oriented_clearance':minimum,'tube_edges':len(edges),'edge_rays':edge_rays,'degenerate_edges_skipped':degenerate_edges,'edge_hits':hits,'limits':'Complete declared static tubevertices+edge rays only; nearestoriented distance notsolid/wholemotion clearance; no face-containment/coplanar/selfhair proof'},'source_original_sha256':EXEC['source']['sha256']})
 check(bpy.ops.wm.save_as_mainfile(filepath=str(source),check_existing=False,copy=True,relative_remap=False)=={'FINISHED'},'Exclusivecandidate save')
 for row in EXEC['pins']:C.pin(row)
 check(C.original_only(receipt.capture_scene(),before)==before and C.original_extras(names)==extras and C.meta()==WARM['full_native_key_metadata'] and C.digest(C.mixed(body))==WARM['body_new_mixed_coordinate_sha256'],'Postsave originals/extras/all252semantics/mixed exact')
 check(receipt.capture_scene()==REPORT['scene'] and C.original_extras(new_names)==new_extras,'Postsave completeadditive owners/extras exact')
 check(C.curve_record(groom)[0]==cr,'Postsave completeCurveexact')
 source.chmod(0o444);REPORT.update({'success':True,'source':str(source),'source_bytes':source.stat().st_size,'source_sha256':__import__('hashlib').sha256(source.read_bytes()).hexdigest()})
except Exception as e:REPORT['exception']=repr(e)
finally:
 REPORT['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();REPORT['limits']='One complete-original-preservation nativeartist candidate only; no cold/render/API generality, scalp appearance/fullcontact/motion/export/runtime/AAA acceptance; isolatedpartialfailure/no rollback'
 write('RESULT.json',REPORT);print('SUGATA_ORIGINAL_CURL '+json.dumps({k:v for k,v in REPORT.items() if k not in ['curve','scene','original_extras','checks']}),flush=True)
if not REPORT['success']:raise SystemExit(1)
