from pathlib import Path
from html.parser import HTMLParser
import json,hashlib,datetime,os,re,struct
p=Path('docs/evidence/nonhair-2026-10-03/editor-focus-value');start=datetime.datetime.now(datetime.timezone.utc).isoformat();h=lambda q:hashlib.sha256(Path(q).read_bytes()).hexdigest();edit=json.loads((p/'EDIT.json').read_text());before=(p/'BEFORE.html.source').read_text();current=Path('packages/testbed/src/showcase.html').read_text();copy=before
assert h(p/'BEFORE.html.source')==edit['beforeSHA256']
for change in edit['changes']:assert copy.count(change['before'])==1;copy=copy.replace(change['before'],change['after'],1)
assert copy==current and h('packages/testbed/src/showcase.html')==edit['afterSHA256']
class Audit(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.described=[]
 def handle_starttag(self,t,a):
  d=dict(a)
  if 'id'in d:self.ids.append(d['id'])
  if 'aria-describedby'in d:self.described.append((t,d))
a=Audit();a.feed(before);b=Audit();b.feed(current);assert len(b.ids)==len(set(b.ids));assert len(b.ids)-len(a.ids)==5;assert len(b.described)-len(a.described)==9
matrix=json.loads((p/'ID-MATRIX.json').read_text())
new=[d for t,d in b.described if d.get('aria-describedby','').startswith(('top-colour-applied','bottom-colour-applied','shoes-colour-applied'))];assert len(new)==9
for part,m in matrix.items():
 for typ in ['checkbox','text','color']:
  assert len([d for d in new if d['type']==typ and d['aria-describedby'].split()==m[typ]])==1
pins=json.loads((p/'SOURCE-PINS.json').read_text());pins['packages/testbed/src/showcase.html']=edit['afterSHA256']
for q,v in pins.items():assert h(q)==v
for name in ['PLAN.md','PROPOSED-CONTRACT.md','ID-MATRIX.json','CRITIC-VALUE.md','CRITIC-CONTRACT.md','EDIT.json','ROOT-SOURCE-WITNESS.json','CDP-REFERENCE.json','OBSERVER-CORRECTIONS.json']:pins[str(p/name)]=h(p/name)
pins['tools/critic/clothing-descriptions.mjs']=h('tools/critic/clothing-descriptions.mjs')
images={}
for q,v in [('docs/evidence/nonhair-2026-10-03/mobile-toolbar/archive/capture/mobile-body.png','35762fafc996857da75b97fe6ad86e21c294ef0f97b9d939ada7156e515dd3b6'),('docs/evidence/nonhair-2026-10-03/hair-cut/archive/capture/desktop-long-bob.png','82f8b02ff93380de2f88023b7f4c39da1411e213c47b8e845244cc4bb21567e5'),('docs/evidence/nonhair-2026-10-03/hair-cut/archive/capture/mobile-chin-bob.png','8aa09475e8127b0318addb6ef8d86ce1e46edfa898d82cbfabfbf91d191078bd')]:
 assert h(q)==v;images[q]={'sha256':v,'size':struct.unpack('>II',Path(q).read_bytes()[16:24])};pins[q]=v
out=dict(pid=os.getpid(),started=start,finished=datetime.datetime.now(datetime.timezone.utc).isoformat(),command='python3 '+str(p/'root-source-readback.py'),readerSHA256=h(__file__),pins=pins,insertions={'newIDs':5,'newDescriptions':9},imagesViewedUnedited=images,decision='only semantic source admission; no native/AX/speech/compliance/appearance pass',limits='existing Reset ring confirms focus witness; both cut originals show collapsed editor and do not witness expanded descriptions')
(p/'ROOT-SOURCE.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:out[k]for k in ['pid','started','finished','insertions','decision']}));print('pins',len(pins),'source',out['readerSHA256'])
