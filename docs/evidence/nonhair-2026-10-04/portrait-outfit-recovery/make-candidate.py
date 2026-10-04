from pathlib import Path
import datetime, difflib, hashlib, json, os

root = Path('/Users/robault/GitHub/sugata-avatar')
prior = root / 'docs/evidence/nonhair-2026-10-04/portrait-outfit'
packet = root / 'docs/evidence/nonhair-2026-10-04/portrait-outfit-recovery'
source = root / 'packages/testbed/src'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
manifest = json.loads((prior / 'FROZEN-MANIFEST.json').read_text())
for entry in manifest['files']:
    data = (prior / entry['file']).read_bytes()
    assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256']
for name in ['portrait.html', 'portrait.js']:
    assert (source / name).read_bytes() == (prior / ('original-' + name + '.source')).read_bytes()
for name in ['portrait-outfit-recovery-candidate.html', 'portrait-outfit-recovery-candidate.js', 'portrait-outfit.mjs']:
    assert not (source / name).exists(), name

def replace_once(text, old, new):
    assert text.count(old) == 1, old
    return text.replace(old, new, 1)

helper = (prior / 'portrait-outfit.mjs.source').read_text()
helper = replace_once(helper, 'function validateOutfit(outfit, bake) {',
    "export class PortraitOutfitUnavailableError extends Error {\n"
    "    constructor() {\n"
    "        super('The Ink outfit is unavailable for this body study.');\n"
    "        this.name = 'PortraitOutfitUnavailableError';\n"
    "    }\n"
    "}\n\nfunction validateOutfit(outfit, bake) {")
helper = replace_once(helper,
    "throw new Error('The Ink outfit is unavailable for this body study. Choose No outfit.');",
    'throw new PortraitOutfitUnavailableError();')
html = (prior / 'candidate-portrait.html.source').read_text()
html = replace_once(html, './portrait-outfit-candidate.js', './portrait-outfit-recovery-candidate.js')
html = replace_once(html, '        [hidden] { display:none !important; }',
    '        #error a { display:block; min-height:44px; margin-top:8px; color:var(--ink); }\n'
    '        [hidden] { display:none !important; }')
js = (prior / 'candidate-portrait.js.source').read_text()
js = replace_once(js, 'import { portraitOutfitSelection, portraitOutfitOptions, portraitOutfitUrl }',
    'import { PortraitOutfitUnavailableError, portraitOutfitSelection, portraitOutfitOptions, portraitOutfitUrl }')
js = replace_once(js, 'let failed = false;', 'let failed = false;\nlet outfitRecoveryHref = null;')
js = replace_once(js, '    const outfit = portraitOutfitSelection( params, selection.bake );\n', '')
js = replace_once(js, "    document.getElementById( 'light-controls' ).hidden = scene === 'kitchen';",
    "    document.getElementById( 'light-controls' ).hidden = scene === 'kitchen';\n"
    "    outfitRecoveryHref = portraitOutfitUrl( location.href, 'none', selection.bake ).href;\n"
    "    const outfit = portraitOutfitSelection( params, selection.bake );")
js = replace_once(js, '} catch ( error ) { showFailure( error ); }',
    "} catch ( error ) {\n"
    "    showFailure( error );\n"
    "    if ( error instanceof PortraitOutfitUnavailableError && outfitRecoveryHref !== null ) {\n"
    "        for ( const button of document.querySelectorAll( '[data-outfit]' ) )\n"
    "            button.setAttribute( 'aria-pressed', 'false' );\n"
    "        document.querySelector( '.caption' ).hidden = true;\n"
    "        const link = document.createElement( 'a' );\n"
    "        link.id = 'continue-without-outfit';\n"
    "        link.className = 'text-button';\n"
    "        link.href = outfitRecoveryHref;\n"
    "        link.textContent = 'Continue without an outfit';\n"
    "        document.getElementById( 'error' ).append( '\\n', link );\n"
    "    }\n"
    "}")
test = (prior / 'outfit-check.mjs').read_text()
test = replace_once(test, 'import { portraitOutfitSelection,', 'import { PortraitOutfitUnavailableError, portraitOutfitSelection,')
test += "\nfor (const bake of ['g000', 'g025', 'g075', 'g100'])\n"
test += "    assert.throws(() => portraitOutfitSelection(new URLSearchParams('outfit=ink'), bake), PortraitOutfitUnavailableError);\n"
test += "for (const query of ['outfit=', 'outfit=wrong', 'outfit=none&outfit=ink']) {\n"
test += "    let error; try { portraitOutfitSelection(new URLSearchParams(query), 'g100'); } catch (value) { error=value; }\n"
test += "    assert(error instanceof Error); assert(!(error instanceof PortraitOutfitUnavailableError));\n}\n"
test += "const refused = new URL('http://localhost/src/portrait.html?hair=bob01&bake=g100&scene=studio&outfit=ink&outfit=ink&extra=keep#view');\n"
test += "const bare = portraitOutfitUrl(refused.href, 'none', 'g100');\n"
test += "assert.equal(bare.searchParams.has('outfit'), false);\n"
test += "for (const key of ['hair', 'bake', 'scene', 'extra']) assert.equal(bare.searchParams.get(key), refused.searchParams.get(key));\n"
test += "assert.equal(bare.hash, refused.hash);\n"
test += "console.log('Typed unavailable-only recovery and matching bare destination checks passed.');\n"

payloads = {'original-portrait.html.source': (source/'portrait.html').read_text(),
            'original-portrait.js.source': (source/'portrait.js').read_text(),
            'candidate-portrait.html.source': html, 'candidate-portrait.js.source': js,
            'portrait-outfit.mjs.source': helper, 'outfit-check.mjs': test}
for name, data in payloads.items():
    assert not (packet/name).exists(), name
    (packet/name).write_text(data)
for name, data in [('portrait-outfit-recovery-candidate.html', html),
                   ('portrait-outfit-recovery-candidate.js', js), ('portrait-outfit.mjs', helper)]:
    (source/name).write_text(data)
for kind in ['html','js']:
    baseline=(prior/('candidate-portrait.'+kind+'.source')).read_text()
    final=html if kind=='html' else js
    (packet/(kind+'-from-rejected.patch')).write_text(''.join(difflib.unified_diff(
        baseline.splitlines(True), final.splitlines(True), fromfile='rejected/portrait.'+kind,tofile='recovery/portrait.'+kind)))
    original=(source/('portrait.'+kind)).read_text()
    (packet/(kind+'-from-original.patch')).write_text(''.join(difflib.unified_diff(
        original.splitlines(True), final.splitlines(True),fromfile='accepted/portrait.'+kind,tofile='recovery/portrait.'+kind)))
pins=[]
for name in payloads:
    data=(packet/name).read_bytes();pins.append({'path':str((packet/name).relative_to(root)),
        'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
result={'pid':os.getpid(),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'command':'python3 docs/evidence/nonhair-2026-10-04/portrait-outfit-recovery/make-candidate.py',
        'frozenPriorPayloadsVerified':len(manifest['files']),'snapshots':pins,'acceptedOriginalsExact':True}
(packet/'CANDIDATE-SOURCE.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
