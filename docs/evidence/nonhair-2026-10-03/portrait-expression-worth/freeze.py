import datetime,hashlib,json,os,pathlib
folder=pathlib.Path(__file__).resolve().parent;started=datetime.datetime.now(datetime.timezone.utc).isoformat();files=[]
for p in sorted(folder.iterdir()):
 assert p.is_file() and not p.is_symlink();d=p.read_bytes();files.append(dict(file=p.name,bytes=len(d),sha256=hashlib.sha256(d).hexdigest()))
out=dict(command='python3 docs/evidence/nonhair-2026-10-03/portrait-expression-worth/freeze.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),files=files)
target=folder/'PRESERVATION.json'
with target.open('x') as h:json.dump(out,h,indent=2);h.write('\n')
for p in folder.iterdir():p.chmod(0o444)
print(json.dumps(dict(pid=out['pid'],started=started,ended=out['ended'],files=len(files),bytes=sum(x['bytes'] for x in files),manifestSha256=hashlib.sha256(target.read_bytes()).hexdigest())))
