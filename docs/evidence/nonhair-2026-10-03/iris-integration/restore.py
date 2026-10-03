from pathlib import Path
import datetime,json,hashlib,os
r=Path('docs/evidence/nonhair-2026-10-03/iris-integration');start=datetime.datetime.now(datetime.timezone.utc).isoformat();sh=lambda b:hashlib.sha256(b).hexdigest()
before=json.loads((r/'BEFORE.json').read_text());candidate=json.loads((r/'ROOT-SOURCE.json').read_text());snap=json.loads((r/'CANDIDATE-SNAPSHOT.json').read_text())
for p,h in candidate['sources'].items():assert sh(Path(p).read_bytes())==h,p
for p,h in snap['outputs'].items():assert sh(Path(p).read_bytes())==h,p
restored={}
for p,h in before['sources'].items():
 b=(r/'before'/p).read_bytes();assert sh(b)==h;Path(p).write_bytes(b);assert sh(Path(p).read_bytes())==h;restored[p]=h
removed={}
for p in ['packages/core/src/material/EyeColourOptions.js','packages/testbed/src/showcase-eye-colours.selftest.mjs']:
 f=Path(p);assert sh(f.read_bytes())==candidate['sources'][p];removed[p]=candidate['sources'][p];f.unlink();assert not f.exists()
# Preserve every candidate source byte, with .source suffix preventing generic selftest discovery.
renamed={};outputs={}
for p,h in snap['outputs'].items():
 f=Path(p)
 if '/candidate-source/' in p:
  q=Path(p+'.source');assert not q.exists();f.rename(q);assert sh(q.read_bytes())==h;renamed[p]={'path':str(q),'sha256':h};outputs[str(q)]=h
 else:outputs[p]=h
snap['outputs']=outputs;snap['archiveSuffixAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();snap['status']='REFUSED/unqualified candidate; exact bytes isolated with source suffix, accepted production restored';(r/'CANDIDATE-SNAPSHOT.json').write_text(json.dumps(snap,indent=2)+'\n')
receipt={'pid':os.getpid(),'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':'python3 '+str(r/'restore.py'),'readerSHA256':sh(Path(__file__).read_bytes()),'restored':restored,'removedOnlyOwnedCandidateFiles':removed,'candidateSourceRenames':renamed,'nativeReruns':0,'status':'accepted production restored exactly after sole failed native; candidate/actual images retained and isolated'};(r/'RESTORATION.json').write_text(json.dumps(receipt,indent=2)+'\n');print({'pid':receipt['pid'],'restored':len(restored),'removed':len(removed),'preservedCandidateSources':len(renamed)})
