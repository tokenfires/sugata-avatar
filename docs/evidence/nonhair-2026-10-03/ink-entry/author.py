import datetime, hashlib, html, json, os, pathlib, sys
root=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); packet=root/'docs/evidence/nonhair-2026-10-03/ink-entry'
start=datetime.datetime.now(datetime.timezone.utc)
assert datetime.datetime(2026,10,4,0,55,tzinfo=datetime.timezone.utc)<=start<datetime.datetime(2026,10,4,1,15,tzinfo=datetime.timezone.utc)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
baseline=json.loads((root/'docs/evidence/nonhair-2026-10-03/skin-kitchen/AUTHOR-FINAL.json').read_text())['sources']
assert len(baseline)==380
for p,expected in baseline.items(): assert sha(root/p)==expected,p
original=root/'packages/testbed/src/showcase.html'; guide=root/'looks/INK-DENIM.md'
assert sha(original)=='6e2b676c1353a9462c5a0c4f6ba59d3cff4a3202070cf064204ac2bcf55533fb'
assert sha(guide)=='bc65e1c00ab929268e2ec8ffe4618d7e671caf1a2b69fcf00e5c9c40e4243fe6'
route=root/'packages/testbed/src/showcase-ink-entry-review.html'; assert not route.exists()
old=original.read_text(); source=json.loads((root/'docs/evidence/nonhair-2026-10-03/ink-entry-value/ROOT-OPTIONS.json').read_text())
query=source['relativeUrl'].split('?',1)[1]; href='?'+query
css='.ink-entry{margin:-12px 0 24px;padding:14px;border:1px solid var(--line);border-radius:3px;background:var(--panel)}.ink-entry .field-label{display:block;margin:0 0 10px}.ink-entry a{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:45px;text-decoration:none}.ink-entry p{font-size:11px;color:var(--muted);margin:10px 0 0}.ink-entry p:last-child{color:var(--dim)}\n'
block='<section class="ink-entry" aria-label="Optional colour recipe"><span class="field-label">Colour recipe</span><a class="secondary" id="try-ink-denim" href="'+html.escape(href,quote=True)+'" aria-describedby="ink-entry-description ink-entry-reset">Try Ink and denim<span aria-hidden="true">→</span></a><p id="ink-entry-description">Navy tee, denim and warm brown shoes, with untinted Brown hair.</p><p id="ink-entry-reset">Neutral Studio · Full look. Replaces your current look in a fresh preview.</p></section>\n'
needle='<fieldset disabled id="hair-cut-controls"'
assert old.count(needle)==1 and old.count('</style>')==1
candidate=old.replace('</style>',css+'</style>').replace(needle,block+needle)
assert candidate.replace(css,'').replace(block,'')==old
for name,data in [('showcase.original.html.source',original.read_bytes()),('INK-DENIM.original.md.source',guide.read_bytes()),('showcase.candidate.html.source',candidate.encode())]: (packet/name).write_bytes(data)
route.write_text(candidate)
oldsteps='1. Open the [Wardrobe study](http://127.0.0.1:5173/src/showcase.html) with the local review server running.\n2. Choose **Open settings (JSON) ↑** and select [ink-denim.json](ink-denim.json). It restores **Studio → Neutral → Full look**.'
newsteps='1. Open [Ink and denim in Wardrobe]('+source['url']+') with the local review server running, or choose **Try Ink and denim** beneath the two starting looks. This opens the complete recipe in a fresh preview.\n2. Wait for the look to finish loading. It restores **Studio → Neutral → Full look**. Choose **Save settings (JSON)** for a portable copy; the original [ink-denim.json](ink-denim.json) also remains available through **Open settings (JSON) ↑**.'
assert guide.read_text().count(oldsteps)==1
(packet/'INK-DENIM.candidate.md.source').write_text(guide.read_text().replace(oldsteps,newsteps))
files={str(p.relative_to(root)):sha(p) for p in [route,packet/'showcase.original.html.source',packet/'INK-DENIM.original.md.source',packet/'showcase.candidate.html.source',packet/'INK-DENIM.candidate.md.source',packet/'PLAN.md',packet/'ISOLATION.md',pathlib.Path(__file__)]}
result={'scope':'Isolated HTML/guide candidate author; existing product and380 sources unchanged','command':'python3 docs/evidence/nonhair-2026-10-03/ink-entry/author.py','pid':os.getpid(),'interpreter':sys.executable,'started':start.isoformat(),'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'route':str(route.relative_to(root)),'href':href,'acceptedSources':baseline,'files':files}
(packet/'AUTHOR.json').write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps({k:v for k,v in result.items() if k!='acceptedSources'},indent=2))
