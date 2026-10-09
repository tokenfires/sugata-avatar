"""Independent saved-receipt/source-buffer/PNG verification; no producer/bpy."""
from pathlib import Path
import json,hashlib,struct,zlib,datetime,subprocess
import numpy as np
P=Path(__file__).resolve().parent
h=lambda b:hashlib.sha256(b).hexdigest()
raw=lambda a:h(a.tobytes(order='C'))
C=json.loads((P/'EXEC.json').read_text());R=json.loads((P/'NATIVE-RESULT.json').read_text());J=json.loads((P/'JOB.json').read_text());A=json.loads((P/'ADMISSION.json').read_text())
for x in C['pins']:
 b=Path(x['path']).read_bytes();assert len(b)==x['bytes'] and h(b)==x['sha256'],x['path']
assert A['execution_admitted'] and A['exec_sha256']==h((P/'EXEC.json').read_bytes()) and A['pins']==C['pins']
assert J['admission_sha256']==h((P/'ADMISSION.json').read_bytes()) and not J['fresh_launch_census']['matches']
assert J['returncode']==0 and J['native_passed'] and not J['timed_out'] and not J['interrupted'] and all(J[k] for k in ['launch_before_gate','within_wall_cap','finished_before_gate'])
assert R['passed'] and R['fit']=='REFUSED_TRANSVERSE' and R['same_process_cold_reopen'] and R['post_pins'] and len(R['outputs'])==3
arrays={}
for archive,names in [(C['body'],['Human_world','Human_triangles']),(C['mesh'],['world32','triangles','face_role'])]:
 with np.load(archive,allow_pickle=False) as z:
  for name in names:
   a=z[name];x=C['members'][name];assert a.dtype.name==x['dtype'] and list(a.shape)==x['shape'] and raw(a)==x['raw_sha256'];arrays[name]=a
for name,(v,t,slots,smooth,mats) in {'SourceBody':(arrays['Human_world'],arrays['Human_triangles'],np.zeros(len(arrays['Human_triangles']),np.int32),np.ones(len(arrays['Human_triangles']),bool),['BodyGray']),'RejectedMainPanels':(arrays['world32'],arrays['triangles'],arrays['face_role'].astype(np.int32),arrays['face_role']!=2,['OuterRust','LiningPale','PlainRim'])}.items():
 x=R['geometry_baseline'][name];assert x=={'vertices':len(v),'triangles':len(t),'world_sha':raw(v),'triangle_sha':raw(t),'slots_sha':raw(slots),'smooth_sha':raw(smooth),'materials':mats}
assert R['display_baseline']['studio']==R['studio']
assert R['studio']['sha256']==h(Path(C['studio']).read_bytes()) and Path(R['studio']['path']).resolve()==Path(C['studio']).resolve()
assert R['display_baseline']['world'] is None and R['display_baseline']['lights']==0 and R['display_baseline']['fit_status']=='REFUSED_TRANSVERSE'
assert R['display_baseline']['render']['engine']=='BLENDER_WORKBENCH'
images=[]
for x,name in zip(R['outputs'],['front.png','oblique.png','rear.png']):
 assert x['file']==name;b=(P/name).read_bytes();assert len(b)==x['bytes'] and h(b)==x['sha256'] and b[:8]==b'\x89PNG\r\n\x1a\n'
 pos=8;chunks=[]
 while pos<len(b):
  length=struct.unpack('>I',b[pos:pos+4])[0];kind=b[pos+4:pos+8];payload=b[pos+8:pos+8+length];crc=struct.unpack('>I',b[pos+8+length:pos+12+length])[0];assert zlib.crc32(kind+payload)&0xffffffff==crc;chunks.append((kind,payload));pos+=12+length
 assert pos==len(b) and chunks[0][0]==b'IHDR' and chunks[-1][0]==b'IEND';width,height,depth,color,compression,filtermethod,interlace=struct.unpack('>IIBBBBB',chunks[0][1]);assert (width,height,depth,color,compression,filtermethod,interlace)==(512,768,8,6,0,0,0)
 scan=zlib.decompress(b''.join(payload for kind,payload in chunks if kind==b'IDAT'));assert len(scan)==768*(512*4+1)
 f=x['frame'];assert len(f['labels'])==2 and f['source_min'][0]>=.05999 and f['source_min'][1]>=.05999 and f['source_min'][2]>0 and f['source_max'][0]<=.94001 and f['source_max'][1]<=.80001
 for label in f['labels']:assert label['min'][0]>=.01 and label['max'][0]<=.99 and label['min'][1]>f['source_max'][1]+.005 and label['max'][1]<=.99 and label['vertices']>0
 images.append({'file':name,'bytes':len(b),'sha256':h(b),'png_chunks_crc_and_rgba_scan_domain':True})
b=(P/'editable.blend').read_bytes();assert len(b)==R['editable']['bytes'] and h(b)==R['editable']['sha256']
for pid in [J['wrapper_pid'],J['child_pid']]:assert subprocess.run(['ps','-p',str(pid),'-o','args='],capture_output=True).returncode!=0
result={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'pins':len(C['pins']),'source_members':5,'native_geometry_raw_receipts_match_sources':True,'PNG':images,'editable_bytes_match':True,'owned_jobs_absent':True,'limits':'Saved native readbacks/persistence assertions are programme+result attributed; verifier independently checks their source bindings/PNG bytes/CRC/domain, not a new native reopen. Root/critic actual images separately qualify readability only; fit remains refused.'}
with (P/'ROOT-NATIVE-CHECK.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result))
