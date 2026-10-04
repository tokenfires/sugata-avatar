import datetime, hashlib, json, os, pathlib
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
folder=pathlib.Path(__file__).resolve().parent
files=[]
for p in sorted(folder.iterdir()):
 assert p.is_file() and not p.is_symlink()
 data=p.read_bytes();files.append(dict(file=p.name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
repo=pathlib.Path('/Users/robault/GitHub/sugata-avatar')
documents=[]
for file in ['docs/WARDROBE-SEPARATES-CONTRACT-2026-10-03.md','docs/PRODUCT-ROADMAP.md']:
 data=(repo/file).read_bytes();documents.append(dict(file=file,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/separates-feasibility/freeze.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),files=files,documents=documents,scope='Evidence folder frozen; current authoring/roadmap documents pinned but left editable')
target=folder/'PRESERVATION.json'
with target.open('x') as h:json.dump(out,h,indent=2);h.write('\n')
for p in folder.iterdir():p.chmod(0o444)
print(json.dumps(dict(pid=out['pid'],started=started,ended=out['ended'],files=len(files),bytes=sum(x['bytes'] for x in files),manifestSha256=hashlib.sha256(target.read_bytes()).hexdigest(),documents=documents)))
