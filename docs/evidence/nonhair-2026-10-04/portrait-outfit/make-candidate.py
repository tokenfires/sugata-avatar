from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os

repo = Path(__file__).resolve().parents[4]
p = Path(__file__).resolve().parent
start = datetime.now(timezone.utc).isoformat()
html_path = repo / 'packages/testbed/src/portrait.html'
js_path = repo / 'packages/testbed/src/portrait.js'
html = html_path.read_text(); js = js_path.read_text()
assert hashlib.sha256(html_path.read_bytes()).hexdigest() == 'a61e72ef3d0b65d03f2a7699dd984c556591980d8be13e1998704c61e9478764'
assert hashlib.sha256(js_path.read_bytes()).hexdigest() == 'd62d9d190d9fd00a0309821ea6432ce999d0514a96b6bf7f94497e638adbf5c0'

def replace_once(text, old, new):
    assert text.count(old) == 1, old
    return text.replace(old, new, 1)

html = replace_once(html, '            <fieldset id="scene-controls" disabled>', '''            <fieldset id="outfit-controls" disabled>
                <legend>Outfit</legend>
                <div class="choices">
                    <button class="choice" data-outfit="none" aria-pressed="true">No outfit</button>
                    <button class="choice" data-outfit="ink" aria-pressed="false">Ink outfit</button>
                </div>
                <p class="note" id="outfit-note">Ink adds a navy tee. Changing outfits starts a fresh view.</p>
            </fieldset>
            <fieldset id="scene-controls" disabled>''')
html = replace_once(html, 'src="./portrait.js"', 'src="./portrait-outfit-candidate.js"')
js = replace_once(js, "import { portraitSelection, validatePortraitHair } from './portrait-selection.mjs';",
    "import { portraitSelection, validatePortraitHair } from './portrait-selection.mjs';\nimport { portraitOutfitSelection, portraitOutfitOptions, portraitOutfitUrl } from './portrait-outfit.mjs';")
js = replace_once(js, "    const scene = reviewSceneSelection( params );", "    const scene = reviewSceneSelection( params );\n    const outfit = portraitOutfitSelection( params, selection.bake );")
js = replace_once(js, "    avatar = await Avatar.create( { canvas, identity: { gender: selection.gender }, hair,", '''    for ( const button of document.querySelectorAll( '[data-outfit]' ) )
        button.setAttribute( 'aria-pressed', String( button.dataset.outfit === outfit ) );
    document.querySelector( '[data-outfit="ink"]' ).disabled = selection.bake !== 'g050';
    if ( selection.bake !== 'g050' ) document.getElementById( 'outfit-note' ).textContent =
        'Clothes are not available for this body study.';
    avatar = await Avatar.create( { canvas, identity: { gender: selection.gender }, hair,
        ...portraitOutfitOptions( outfit, selection.bake ),''')
js = replace_once(js, "    document.getElementById( 'loading' ).hidden = true;\n    for ( const el", "    if ( outfit === 'ink' && report.wardrobe?.attached !== true ) throw new Error( 'The Ink outfit did not attach.' );\n    document.getElementById( 'loading' ).hidden = true;\n    for ( const el")
js = replace_once(js, '    window.avatar = avatar;', '''    for ( const button of document.querySelectorAll( '[data-outfit]' ) )
        button.addEventListener( 'click', () => {
            if ( button.dataset.outfit === outfit ) return;
            const url = portraitOutfitUrl( location.href, button.dataset.outfit, selection.bake );
            attention.cancel( { immediate: true } );
            changingRoom = true;
            for ( const el of document.querySelectorAll( 'fieldset, #pause, #reset-view' ) ) el.disabled = true;
            status.textContent = 'Preparing outfit…';
            location.assign( url.href );
        } );
    window.avatar = avatar;''')
js = js.replace('changingRoom', 'changingView')
out_html = repo / 'packages/testbed/src/portrait-outfit-candidate.html'
out_js = repo / 'packages/testbed/src/portrait-outfit-candidate.js'
assert not out_html.exists() and not out_js.exists()
out_html.write_text(html); out_js.write_text(js)
snapshots = {'original-portrait.html.source': html_path.read_bytes(), 'original-portrait.js.source': js_path.read_bytes(),
             'candidate-portrait.html.source': out_html.read_bytes(), 'candidate-portrait.js.source': out_js.read_bytes(),
             'portrait-outfit.mjs.source': (repo / 'packages/testbed/src/portrait-outfit.mjs').read_bytes()}
rows = []
for name, data in snapshots.items():
    assert not (p / name).exists(); (p / name).write_bytes(data)
    rows.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
r = {'pid': os.getpid(), 'started': start, 'finished': datetime.now(timezone.utc).isoformat(),
     'scope': 'Isolated cloned candidate only; accepted original HTML/JS untouched', 'snapshots': rows}
(p / 'CANDIDATE-SOURCE.json').write_text(json.dumps(r, indent=2) + '\n')
print(json.dumps(r, indent=2))
