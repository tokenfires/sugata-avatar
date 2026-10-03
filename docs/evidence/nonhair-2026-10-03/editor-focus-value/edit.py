from pathlib import Path
import datetime,hashlib,json,os
p=Path('docs/evidence/nonhair-2026-10-03/editor-focus-value');q=Path('packages/testbed/src/showcase.html');start=datetime.datetime.now(datetime.timezone.utc).isoformat();old=q.read_text();h=lambda x:hashlib.sha256(x).hexdigest()
assert h(old.encode())=='6e2b676c1353a9462c5a0c4f6ba59d3cff4a3202070cf064204ac2bcf55533fb'
assert h((p/'CRITIC-CONTRACT.md').read_bytes())=='337918170c77a3b56877227c35d4ecf6249ae4f5d482a06dbee7695739b1575b'
m=json.loads((p/'ID-MATRIX.json').read_text());changes=[('<p data-colour-guidance>','<p id="clothing-colour-guidance" data-colour-guidance>'),('<p>The picker starts with a proposed grey,','<p id="clothing-picker-help">The picker starts with a proposed grey,')]
new=old
for part in m:
 startrow=new.index(f'<div class="colour-part" data-colour-part="{part}">');end=new.index('</div>',startrow);row=new[startrow:end];replacement=row.replace('<small>Applied:',f'<small id="{m[part]["appliedId"]}">Applied:')
 for kind in ['checkbox','text','color']:
  replacement=replacement.replace(f'<input type="{kind}"',f'<input type="{kind}" aria-describedby="{" ".join(m[part][kind])}"',1)
 changes.append((row,replacement))
for a,b in changes:assert new.count(a)==1,a;new=new.replace(a,b,1)
(p/'BEFORE.html.source').write_text(old);q.write_text(new)
assert sum(b.count('aria-describedby=')-a.count('aria-describedby=')for a,b in changes)==9
r=dict(pid=os.getpid(),started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),command='python3 '+str(p/'edit.py'),sourceSHA256=h(Path(__file__).read_bytes()),beforeSHA256=h(old.encode()),afterSHA256=h(new.encode()),changes=[{'before':a,'after':b}for a,b in changes],attributes=14,scope='only HTML attribute insertions; no text/CSS/JS/runtime change')
(p/'EDIT.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k]for k in ['pid','started','finished','beforeSHA256','afterSHA256','attributes']}))
