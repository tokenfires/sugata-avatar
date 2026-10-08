"""Single bounded read-only namespace witness; no generic RNA/pixels/edit/save/render."""
from pathlib import Path
import json,hashlib,datetime,stat
import bpy
P=Path(__file__).resolve().parent;E=json.loads((P/'EXEC-PLAN.json').read_text());MAX_BYTES=2*1024*1024
R={'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'witness_complete':False,'classification':'UNKNOWN','candidate_qualification':False,'source_mutations':False}
class Unsupported(Exception):pass
def check(ok,label):
 if not ok:raise Unsupported(label)
def text(value):
 check(isinstance(value,str) and len(value)<=512,'Unsupported field string length/type');return value
def pin(row):
 h=hashlib.sha256();f=Path(row['path'])
 with f.open('rb') as source:
  while True:
   chunk=source.read(8*1024*1024)
   if not chunk:break
   h.update(chunk)
 check(f.stat().st_size==row['bytes'] and h.hexdigest()==row['sha256'],'Input identity changed '+row['path'])
def emit(name,value):
 b=(json.dumps(value,indent=2)+'\n').encode();check(len(b)<=MAX_BYTES,'Serialized output exceeds2MiB')
 with (P/name).open('xb') as out:out.write(b)
try:
 check(bpy.app.background and not bpy.app.online_access,'Offline background required')
 for row in E['pins']:pin(row)
 check(stat.S_IMODE(Path(E['saved']['path']).stat().st_mode)==0o444,'Saved input is notreadonly')
 warm=json.loads(Path(E['warm']).read_text());expected=set(warm['original_materials'])|{warm['owned']['record']['name']};check(len(expected)<=64 and all(len(x)<=512 for x in expected),'Expected namespace bound')
 check(bpy.ops.wm.open_mainfile(filepath=E['saved']['path'])=={'FINISHED'},'Saved input open unsupported');bpy.context.view_layer.update()
 counts={'materials':len(bpy.data.materials),'objects':len(bpy.data.objects)};R['observed_counts']=counts;check(counts['materials']<=64 and counts['objects']<=64,'Namespace count bound before iteration')
 # First emit the actual set difference without asserting namespace membership.
 actual_names=sorted(text(m.name) for m in bpy.data.materials);difference={'expected':sorted(expected),'observed':actual_names,'missing':sorted(expected-set(actual_names)),'unexpected':sorted(set(actual_names)-expected)};emit('NAMESPACE.json',difference);R['difference']=difference
 owners={n:[] for n in actual_names};objects=[]
 for obj in bpy.data.objects:
  name=text(obj.name);check(len(obj.material_slots)<=16,'Slot count bound '+name);slots=[]
  for i,slot in enumerate(obj.material_slots):
   mn=text(slot.material.name) if slot.material else None;link=text(slot.link);slots.append({'index':i,'material':mn,'link':link})
   if mn is not None:check(mn in owners,'Unlisted slot material');owners[mn].append({'object':name,'index':i,'link':link})
  objects.append({'name':name,'type':text(obj.type),'slots':slots})
 materials=[]
 for mat in bpy.data.materials:
  name=text(mat.name);check(isinstance(mat.users,int) and mat.users>=0,'Unsupported material user count');row={'name':name,'users':mat.users,'fake_user':bool(mat.use_fake_user),'use_nodes':bool(mat.use_nodes),'owners':owners[name]}
  nt=mat.node_tree
  if nt is not None:
   check(len(nt.nodes)<=32 and len(nt.links)<=64,'Node/link count bound '+name);row['nodes']=[{'name':text(n.name),'type':text(n.type)} for n in nt.nodes];row['links']=[{'from_node':text(l.from_node.name),'from_socket':text(l.from_socket.identifier),'to_node':text(l.to_node.name),'to_socket':text(l.to_socket.identifier)} for l in nt.links]
  materials.append(row)
 actual_records={'materials':sorted(materials,key=lambda x:x['name']),'objects':sorted(objects,key=lambda x:x['name']),'difference':difference};emit('ACTUAL.json',actual_records)
 missing_prior={n:{'users':warm['original_materials'][n]['users'],'fake_user':warm['original_materials'][n]['fake_user']} for n in difference['missing'] if n in warm['original_materials']};R.update({'classification':'Recorded material-name set difference' if difference['missing'] or difference['unexpected'] else 'No material-name difference in this bounded read','missing_presave_roles':missing_prior,'original_body_present':'Human.body' in actual_names,'clone_present':warm['owned']['record']['name'] in actual_names,'limits':'Actual loaded names/roles/users only; no serialization/addon/orphan mechanism proof, fullsource/cold/geometry/materialstate/artist/render/runtime qualification. No shader/slot/retention/save/pixels/geometry edit or lookup.'})
 for row in E['pins']:pin(row)
 check(stat.S_IMODE(Path(E['saved']['path']).stat().st_mode)==0o444,'Readonly source mode changed');R['witness_complete']=True
except Exception as ex:R.update({'exception':repr(ex),'witness_complete':False,'classification':'UNKNOWN'})
finally:
 R['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();emit('RESULT.json',R);print('SUGATA_NAMESPACE '+json.dumps(R),flush=True)
if not R['witness_complete']:raise SystemExit(1)
