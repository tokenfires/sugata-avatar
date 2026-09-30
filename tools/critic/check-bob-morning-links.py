"""Check local file targets in the morning packet; no external network requests."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import re,json,hashlib,datetime
root=Path.cwd();out=root/'captures/bob-morning-links-v1';assert not out.exists();out.mkdir()
source=Path(__file__);(out/source.name).write_bytes(source.read_bytes())
files=[Path('docs/MORNING-2026-09-30.md'),Path('docs/OVERNIGHT-2026-09-29.md'),Path('docs/PRODUCT-ROADMAP.md'),Path('docs/research/bob-appearance-brief-2026-09-29.md')]+sorted(Path('docs/evidence/hair-2026-09-29').rglob('*.md'))+[Path('docs/evidence/hair-2026-09-29/review.html')]
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  for k,v in attrs:
   if k in ['href','src']and v:self.links.append(v)
rows=[];external=[];missing=[]
for p in files:
 text=p.read_text()
 if p.suffix=='.html':parser=Links();parser.feed(text);links=parser.links
 else:links=re.findall(r'!?\[[^\]\n]*\]\(([^\)\n]+)\)',re.sub(r'```.*?```','',text,flags=re.S))
 for link in links:
  link=link.strip('<>');url=urlsplit(link)
  if url.scheme and url.scheme not in ['http','https']:external.append(dict(file=str(p),target=link));continue
  if url.netloc and url.netloc not in ['localhost:5173','127.0.0.1:5173']:external.append(dict(file=str(p),target=link));continue
  path=unquote(url.path)
  if not path:continue
  path=re.sub(r':\d+$','',path)
  if path.startswith('/@fs/'):target=Path(path[4:])
  elif path.startswith('/Users/'):target=Path(path)
  elif path.startswith('/src/'):target=root/'packages/testbed'/path[1:]
  elif path=='/':target=root/'packages/testbed/index.html'
  elif path.startswith('/'):target=root/path[1:]
  else:target=(root/p.parent/path).resolve()
  row=dict(file=str(p),target=link,resolved=str(target),exists=target.exists());rows.append(row)
  if not row['exists']:missing.append(row)
report=dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='passed'if not missing else'failed',sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),documentCount=len(files),localTargets=len(rows),externalSkipped=len(external),missing=missing,rows=rows,limits=['Explicit Markdown link destinations and HTML href/src file existence only; external URLs, heading anchors, generated JavaScript URLs and semantic link intent are not qualified.','Native overview images/selectors/motion controls have their separate actual browser evidence.'])
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items()if k!='rows'},indent=2))
raise SystemExit(bool(missing))
