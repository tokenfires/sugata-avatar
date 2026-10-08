"""Bounded mmap summaries of retained raw audits; omit only six flat pixel arrays."""
from pathlib import Path
import json,re,mmap,hashlib,time,datetime
P=Path(__file__).resolve().parent;deadline=time.monotonic()+90;CHUNK=8*1024*1024
records=[]
for name in ['BEFORE.json','WARM.json']:
 f=P/name;size=f.stat().st_size;assert size<1200*1024*1024
 with f.open('rb') as source,mmap.mmap(source.fileno(),0,access=mmap.ACCESS_READ) as mm:
  sha=hashlib.sha256()
  for off in range(0,size,CHUNK):
   assert time.monotonic()<deadline;sha.update(mm[off:min(off+CHUNK,size)])
  output=[];cursor=0;arrays=[]
  for match in re.finditer(rb'(?m)^([ \t]*)"pixels": \[\n',mm):
   assert time.monotonic()<deadline;prefix=match.group(1);body_start=match.end();end=mm.find(b'\n'+prefix+b']',body_start);assert end>=body_start;close_end=mm.find(b'\n',end+1);assert close_end!=-1;closing=mm[end:close_end];assert closing.strip() in [b'],',b']'];bodysha=hashlib.sha256();values=0
   for off in range(body_start,end,CHUNK):
    assert time.monotonic()<deadline;part=mm[off:min(off+CHUNK,end)];bodysha.update(part);values+=part.count(b'\n')
   if end>body_start:values+=1
   desc={'retained_raw_pixel_array':True,'scalar_values':values,'canonical_text_sha256':bodysha.hexdigest(),'scope':'Text identity/count only; no new pixel evaluation or float32 hash claim'};arrays.append(desc);output.append(mm[cursor:match.start()]);output.append(prefix+b'"pixels": '+json.dumps(desc,separators=(',',':')).encode()+(b',' if closing.rstrip().endswith(b',') else b'')+b'\n');cursor=close_end+1
  assert len(arrays)==6;output.append(mm[cursor:]);compact=b''.join(output);assert len(compact)<=20*1024*1024;parsed=json.loads(compact)
  assert len(parsed['images'])==6
  for row in parsed['images'].values():assert row['rna']['pixels']['retained_raw_pixel_array']
  dst=P/(name[:-5]+'-SUMMARY.json')
  with dst.open('xb') as out:out.write(compact)
  dst.chmod(0o444);f.chmod(0o444);records.append({'raw_path':str(f.resolve()),'raw_bytes':size,'raw_sha256':sha.hexdigest(),'summary_path':str(dst.resolve()),'summary_bytes':len(compact),'summary_sha256':hashlib.sha256(compact).hexdigest(),'pixel_arrays':arrays,'raw_preserved_readonly':True})
receipt={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'deadline_seconds':90,'records':records,'max_summary_bytes':20*1024*1024,'no_raw_rewrite':True,'no_native_or_palette_retry':True}
with (P/'SUMMARY-RECEIPT.json').open('x') as out:json.dump(receipt,out,indent=2);out.write('\n')
print(json.dumps({'records':[{k:x[k] for k in ['raw_bytes','raw_sha256','summary_bytes','summary_sha256']} for x in records],'only6pixelarrays_replaced_per_record':True,'no_raw_rewrite':True},indent=2))
