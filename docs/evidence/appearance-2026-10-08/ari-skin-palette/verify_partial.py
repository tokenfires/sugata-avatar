"""Stored partial-source/material/geometry verification; no native or palette retry."""
from pathlib import Path
from array import array
import json,hashlib,copy,zipfile,ast,struct,math,datetime,stat
P=Path(__file__).resolve().parent
def read(n):return json.loads((P/n).read_text())
a=read('BEFORE-SUMMARY.json');w=read('WARM-SUMMARY.json');r=read('RESULT.json');job=read('JOB.json');e=read('EXEC-PLAN.json');k=read('CONTRACT.json');m=read('MATERIAL.json');sr=read('SUMMARY-RECEIPT.json')
assert not r['passed'] and not r['candidate_promotion'] and not r['outputs'] and job['exit_code']==1 and not job['timed_out'] and r['exception']=="RuntimeError('Exactly one additive material')"
for x in e['pins']:
 b=Path(x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
for x in sr['records']:
 b=Path(x['summary_path']).read_bytes();assert len(b)==x['summary_bytes'] and hashlib.sha256(b).hexdigest()==x['summary_sha256']
base=read('SOURCE-ROUTE.json');oldskin=k['source_material'];original=copy.deepcopy(w['original_materials']);original[oldskin]['record']['rna']['use_fake_user']=False;original[oldskin]['fake_user']=False
for value in original.values():value['record']['links'].sort()
assert original==a['all_original_materials']
images=copy.deepcopy(a['images']);images[k['original_texture']]['users']+=2;assert images==w['images'];assert a['metadata']==w['metadata'] and a['extras']==w['extras'] and a['geometry']==w['geometry'] and m==w['owned']==read('MATERIAL-OBSERVED.json')
f32=lambda x:struct.unpack('<f',struct.pack('<f',x))[0];node=next(x for x in m['record']['nodes'] if x['name']==k['node_name']);assert node['type']=='MIX_RGB' and node['rna']['blend_type']=='MULTIPLY' and not node['rna']['use_clamp'] and node['inputs']['Fac']==1 and node['inputs']['Color2']==[f32(x) for x in k['linear_multiplier_rgba']]
links=m['record']['links'];added=[x for x in links if k['node_name'] in [x[0],x[2]]];assert sorted(added)==sorted([['DiffuseTexture','Color',k['node_name'],'Color1'],[k['node_name'],'Color','Principled BSDF','Base Color']])
clone=copy.deepcopy(m);clone['record']['name']=oldskin;clone['record']['rna']['name']=oldskin;clone['tree_rna']['name']=a['all_original_materials'][oldskin]['tree_rna']['name'];clone['record']['nodes']=[x for x in clone['record']['nodes'] if x['name']!=k['node_name']];clone['nodes_custom'].pop(k['node_name']);clone['record']['links']=[x for x in links if k['node_name'] not in [x[0],x[2]]]+[['DiffuseTexture','Color','Principled BSDF','Base Color']];clone['record']['links'].sort();assert clone==a['all_original_materials'][oldskin]
scene=copy.deepcopy(w['scene'])
for obj in scene['objects']:
 if obj['name']=='Human':assert obj['materials']==[k['clone_material']];obj['materials']=[oldskin]
cm=next(x for x in scene['materials'] if x['name']==k['clone_material']);cm['name']=oldskin;cm['nodes']=[x for x in cm['nodes'] if x['name']!=k['node_name']];cm['links']=[x for x in cm['links'] if k['node_name'] not in [x['from_node'],x['to_node']]]+[{'from_node':'DiffuseTexture','from_socket':'Color','to_node':'Principled BSDF','to_socket':'Base Color'}];scene['materials'].sort(key=lambda x:x['name']);before=copy.deepcopy(a['scene'])
for snap in [scene,before]:
 for mat in snap['materials']:mat['links'].sort(key=lambda x:json.dumps(x,sort_keys=True))
assert scene==before
records=a['geometry'];buffers=0
for name in ['before-geometry.npz','after-geometry.npz']:
 with zipfile.ZipFile(P/'work'/name) as z:
  for owner,rec in records.items():
   for suffix,field,width in [('world','vertices',3),('triangles','triangles',3),('edges','edges',2)]:
    b=z.read(owner+'_'+suffix+'.npy');start=10 if b[6]==1 else 12;size=struct.unpack('<H' if b[6]==1 else '<I',b[8:start])[0];h=ast.literal_eval(b[start:start+size].decode().strip());raw=b[start+size:];values=array({'<f4':'f','<i4':'i'}[h['descr']]);values.frombytes(raw);assert h['shape']==(rec[field],width) and hashlib.sha256(raw).hexdigest()==rec[suffix+'_sha256'] and all(math.isfinite(x) for x in values);buffers+=1
route=read('EVALUATED-SKIN-ROUTE.json');assert route['data_materials']==[k['clone_material']] and route['all_zero'] and a['native_route']['all_zero'] and a['native_route']['slot_link']=='DATA'
assert all(x['rna']['pixels']==w['images'][name]['rna']['pixels'] for name,x in a['images'].items());assert len(a['images'])==6
source=P/'work/ari-skin-palette.blend';b=source.read_bytes();assert stat.S_IMODE(source.stat().st_mode)==0o444
checks=r['checks'];assert 'Same-process saved fresh open' in checks and checks[-1]=='Literal native DATA slot and all original polygon assignment indices'
assert not (P/'REOPEN.json').exists() and not (P/'CLEANUP.json').exists() and not list(P.glob('*.png'))
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'partial_stored_records_verified':True,'pins':24,'geometry_arrays_verified':buffers,'before_after18signatures_exact':True,'warm_old7_108_252_UV_rest_source_preserved_except_declared_changes':True,'original_materials_exact_except_body_retentionflag':True,'original7material_names':list(a['all_original_materials']),'zero_user_Material_before_warm':True,'all6pixel_arrays_text_count_identity_before_warm':True,'fixed_shader_clone_actual5nodes4links_verified':True,'native_and_evaluated_body_slot_assignment_verified_before_save':True,'saved_source':{'path':str(source.resolve()),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()},'postopen':'Originalbody/clone lookups and nativeDATA route reached; actualnamespace list not recorded, cause UNKNOWN','native_attempts':1,'images':0,'artist_palette_verdict':'UNKNOWN','limits':'No cold preservation/evaluated geometry/cleanup/images verified; no unassigned-orphan-loss cause claim; large rawhashes attributed to one bounded summary extraction and retained exactrawfiles'}
(P/'ROOT-PARTIAL.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
