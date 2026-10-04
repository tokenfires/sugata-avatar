import datetime,hashlib,json,os,subprocess,sys
from pathlib import Path
p=Path(__file__).resolve().parent;repo=p.parents[3];worth=p.parent/'rowan-portrait-worth'
started=datetime.datetime.now(datetime.timezone.utc)
assert started<datetime.datetime.fromisoformat('2026-10-04T06:23:00+00:00')
sha=lambda b:hashlib.sha256(b).hexdigest()
assert len(sys.argv)==2 and sha((p/'CRITIC-SOURCE.md').read_bytes())==sys.argv[1]
critic_pins=json.loads((p/'CRITIC-SOURCE-PINS.json').read_text())
assert len(critic_pins['pins'])==15
for row in critic_pins['pins']:
 b=(repo/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
d=json.loads((worth/'ROOT-CLOSE.json').read_text())
for row in d['externalPins']:
 b=(repo/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
f=json.loads((worth/'FROZEN.json').read_text())
for row in f['pins']:
 b=(worth/row['file']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['file']
expected={'identity':{'gender':1,'mode':'nearest'},'quality':'balanced','frame':'portrait','framedHeightMetres':.55,'seed':20260807,'autoStart':False,'scene':'studio','lighting':'neutral','background':'studio','hair':'bob01','hairColour':'#2f251f','wardrobe':False}
assert json.loads((p/'ROWAN.json').read_text())==expected
assert subprocess.run(['git','diff','--name-only','HEAD','--','packages','assets','looks'],cwd=repo,capture_output=True,text=True,check=True).stdout==''
rows=[]
for file in sorted(p.iterdir()):
 assert file.is_file();b=file.read_bytes();rows.append({'file':file.name,'bytes':len(b),'sha256':sha(b)})
ended=datetime.datetime.now(datetime.timezone.utc)
assert ended<datetime.datetime.fromisoformat('2026-10-04T06:23:00+00:00')
r={'command':'python3 '+Path(__file__).resolve().relative_to(repo).as_posix()+' '+sys.argv[1],'pid':os.getpid(),'started':started.isoformat(),'ended':ended.isoformat(),'criticSHA256':sys.argv[1],'criticInputPins':critic_pins['pins'],'inputPins':d['externalPins'],'worthPayloadCount':len(f['pins']),'packetPins':rows,'recipe':expected,'passed':True,'scope':'Root fully reads complete source handoff and independently verifies current input/source/recipe pins before first open; metadata/hash only, no import/render/topology or appearance proof.'}
with (p/'ROOT-PREFLIGHT.json').open('x') as out:json.dump(r,out,indent=2);out.write('\n')
print(json.dumps({'pid':r['pid'],'started':r['started'],'ended':r['ended'],'inputPins':len(r['inputPins']),'packetPins':len(rows),'worthPayloadCount':len(f['pins']),'passed':True,'metadataSHA256':sha((p/'ROOT-PREFLIGHT.json').read_bytes())}))
