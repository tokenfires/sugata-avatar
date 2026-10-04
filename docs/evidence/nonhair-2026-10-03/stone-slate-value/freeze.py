import datetime, hashlib, json, os, pathlib
folder = pathlib.Path(__file__).resolve().parent
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
rows = []
for path in sorted(folder.iterdir()):
    assert path.is_file() and not path.is_symlink()
    data = path.read_bytes()
    rows.append(dict(file=path.name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
manifest = dict(command='python3 docs/evidence/nonhair-2026-10-03/stone-slate-value/freeze.py', pid=os.getpid(), started=started, ended=datetime.datetime.now(datetime.timezone.utc).isoformat(), files=rows, scope='Only this closed evidence directory')
out = folder / 'PRESERVATION.json'
with out.open('x') as handle: json.dump(manifest, handle, indent=2); handle.write('\n')
for path in folder.iterdir(): path.chmod(0o444)
print(json.dumps(dict(pid=manifest['pid'], started=started, ended=manifest['ended'], files=len(rows), bytes=sum(row['bytes'] for row in rows), manifestSha256=hashlib.sha256(out.read_bytes()).hexdigest())))
