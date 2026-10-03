from pathlib import Path
import datetime,os,json,hashlib
r=Path('docs/evidence/nonhair-2026-10-03/iris-integration'); changes=[]; pending={}
def edit(p,old,new):
 f=Path(p);s=pending.get(p,f.read_text());assert s.count(old)==1,(p,s.count(old),old[:80]);pending[p]=s.replace(old,new);changes.append({'file':p,'old':old,'new':new})
p='packages/core/src/material/EyeColourOptions.js'
Path(p).write_text('''import { Color } from 'three';

/** Creation-only named pigment; Original keeps the authored iris sample path. */
export function resolveEyeColour(value) {
    if (value === undefined || value === null || value === 'original') return null;
    if (value === 'blue') return value;
    throw new TypeError('Avatar eyeColour must be original or blue.');
}

/** Fixed optional Blue, normalized in linear RGB; not a rendered colour guarantee. */
export function eyeChromaticity(value) {
    if (resolveEyeColour(value) === null) return null;
    const rgb = new Color('#527b97').toArray();
    const luma = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    return rgb.map(channel => channel / luma);
}
''')
p='packages/core/src/material/EyeMaterial.js'
edit(p,"import { fitSphere } from '../../../../tools/figure-pipeline/cornea_geometry.mjs';","import { fitSphere } from '../../../../tools/figure-pipeline/cornea_geometry.mjs';\nimport { resolveEyeColour, eyeChromaticity } from './EyeColourOptions.js';")
edit(p,'    constructor( options = {} ) {\n\n        const meshes',"    constructor( options = {} ) {\n\n        const eyeColour = resolveEyeColour( options.eyeColour );\n        const meshes")
edit(p,'        this.pupilScaleUniform = uniform( 1 );',"        this.eyeColour = eyeColour;\n        const pigment = eyeChromaticity( eyeColour );\n        this.irisChromaticityUniform = pigment === null ? null : uniform( new Vector3( ...pigment ) );\n        this.pupilScaleUniform = uniform( 1 );")
edit(p,'    /** Every measured number, for a report or a HUD. Millimetres, because that is the scale. */',"""    /** Observe the actual attached owner and the pigment node value, never only the request. */
    colour() {

        const attached = this.attached && this.globeMesh.material === this.globeMaterial &&
            this.corneaMesh.material === this.corneaMaterial;
        const chromaticity = this.irisChromaticityUniform?.value?.toArray() ?? null;
        const expected = eyeChromaticity( this.eyeColour );
        const matches = expected === null ? this.irisChromaticityUniform === null :
            Array.isArray( chromaticity ) && chromaticity.length === 3 &&
            expected.every( ( value, i ) => value === chromaticity[ i ] );
        return { applied: this.eyeColour, attached, chromaticity, matchesAttached: attached && matches };

    }

    /** Every measured number, for a report or a HUD. Millimetres, because that is the scale. */""")
edit(p,'        const iris = irisSample.rgb.mul( float( 1 ).add( caustic ) );',"""        // Original retains the exact authored sample expression. Blue changes only the annulus
        // before the existing caustic; the pupil side/equality retains its original sample.
        let irisRgb = irisSample.rgb;
        if ( this.irisChromaticityUniform !== null ) {

            const sampleLuma = irisSample.rgb.dot( vec3( 0.2126, 0.7152, 0.0722 ) );
            const pigment = sampleLuma.mul( this.irisChromaticityUniform );
            const annulus = float( 1 ).sub( step( irisRadial, pupilEdge ) );
            irisRgb = mix( irisSample.rgb, pigment, annulus );

        }
        const iris = irisRgb.mul( float( 1 ).add( caustic ) );""")
edit(p,'     * @param {number} [options.corneaIor=1.3333]',"     * @param {'original'|'blue'} [options.eyeColour] - creation-only optional iris pigment.\n     * @param {number} [options.corneaIor=1.3333]")
p='packages/core/src/Avatar.js'
edit(p,"import { EyeMaterial } from './material/EyeMaterial.js';","import { EyeMaterial } from './material/EyeMaterial.js';\nimport { resolveEyeColour } from './material/EyeColourOptions.js';")
edit(p,'        const hairColour = resolveHairColour( options.hairColour );','        const eyeColour = resolveEyeColour( options.eyeColour );\n        const hairColour = resolveHairColour( options.hairColour );')
edit(p,'            hairStyle,\n            hairColour,','            hairStyle,\n            eyeColour,\n            hairColour,')
edit(p,'        this.hairColour = session.hairColour ?? null;','        this.eyeColour = session.eyeColour ?? null;\n        this.hairColour = session.hairColour ?? null;')
edit(p,'            subsystems: this.censusOfShading(),',"""            eyes: {
                requested: this.eyeColour,
                ...( this.eyes?.colour() ?? { applied: null, attached: false, chromaticity: null, matchesAttached: false } ),
                matchesRequest: this.eyes !== null && this.eyes.eyeColour === this.eyeColour
            },
            subsystems: this.censusOfShading(),""")
edit(p,'            eyes = new EyeMaterial( { figure: this.figure } );','            eyes = new EyeMaterial( { figure: this.figure, eyeColour: this.eyeColour } );')
edit(p,"            console.warn( `Avatar: eye material not applied — ${ error.message }` );", "            if ( this.eyeColour !== null ) throw error;\n            console.warn( `Avatar: eye material not applied — ${ error.message }` );")
p='packages/testbed/src/showcase-presets.mjs'
edit(p,"import { WARDROBE_STYLES }", "import { resolveEyeColour, eyeChromaticity } from '../../core/src/material/EyeColourOptions.js';\nimport { WARDROBE_STYLES }")
edit(p,"    if (params.getAll('hairColour').length > 1)","    if (params.getAll('eyeColour').length > 1) throw new Error('Duplicate eye colour selection.');\n    const eyeColour = resolveEyeColour(params.has('eyeColour') ? params.get('eyeColour') : undefined);\n    if (params.getAll('hairColour').length > 1)")
edit(p,"        ...(hairColour === null ? {} : { hairColour }), ...(hairTint === null ? {} : { hairTint }) };","        ...(eyeColour === null ? {} : { eyeColour }),\n        ...(hairColour === null ? {} : { hairColour }), ...(hairTint === null ? {} : { hairTint }) };")
edit(p,'    const hairColour = resolveHairColour(selection.hairColour);','    const eyeColour = resolveEyeColour(selection.eyeColour);\n    const hairColour = resolveHairColour(selection.hairColour);')
edit(p,"return { identity: { gender: .5, mode: 'nearest' }, hair: preset.hair,", "return { identity: { gender: .5, mode: 'nearest' }, ...(eyeColour === null ? {} : { eyeColour }), hair: preset.hair,")
edit(p,'    const hairColour = report.hair.colour;',"""    const eyes = report.eyes;
    const appliedEyeColour = resolveEyeColour(eyes?.applied);
    const requestedEyeColour = resolveEyeColour(eyes?.requested);
    // Legacy Original/raw-GLB fallback is supported; an optional pigment needs a live owner.
    if (requestedEyeColour !== appliedEyeColour || (appliedEyeColour !== null || eyes?.attached) &&
        (!eyes.attached || !eyes.matchesAttached || !eyes.matchesRequest ||
            JSON.stringify(eyes.chromaticity) !== JSON.stringify(eyeChromaticity(appliedEyeColour))))
        throw new Error('The attached eye colour does not match this saved look.');
    const hairColour = report.hair.colour;""")
edit(p,"    return { identity: { gender: report.identity.gender, mode: 'nearest' }, hair: report.hair.style,", "    return { identity: { gender: report.identity.gender, mode: 'nearest' },\n        ...(appliedEyeColour === null ? {} : { eyeColour: appliedEyeColour }), hair: report.hair.style,")
p='packages/testbed/src/showcase-settings.mjs'
edit(p,"import { SHOWCASE_PRESETS", "import { resolveEyeColour } from '../../core/src/material/EyeColourOptions.js';\nimport { SHOWCASE_PRESETS")
edit(p,'    const hairColour = resolveHairColour(configuration.hairColour);','    const eyeColour = resolveEyeColour(configuration.eyeColour);\n    const hairColour = resolveHairColour(configuration.hairColour);')
edit(p,'    const selection = selectionWithColours({ ...(hairColour', '    const selection = selectionWithColours({ ...(eyeColour === null ? {} : { eyeColour }), ...(hairColour')
edit(p,'    if (Object.hasOwn(normalized.wardrobe,',"    if (eyeColour === null) delete normalized.eyeColour;\n    if (Object.hasOwn(normalized.wardrobe,")
edit(p,"    // Discard unrelated/debug overrides", "    const eyeColour = resolveEyeColour(canonical.eyeColour);\n    if (eyeColour === null) delete canonical.eyeColour; else canonical.eyeColour = eyeColour;\n    // Discard unrelated/debug overrides")
p='packages/testbed/src/showcase.html'
edit(p,'<fieldset disabled id="framing-controls">', '''<details class="hair-colours" id="eye-colours"><summary>Eye colour</summary>
<fieldset disabled id="eye-colour-controls"><legend class="field-label">Choose eye colour</legend>
<label for="eye-shade">Colour</label><select id="eye-shade" aria-describedby="eye-colour-help"><option value="original">Original</option><option value="blue">Blue</option></select>
<p id="eye-colour-help">Apply opens a fresh preview with your current clothes and colours.</p>
<button class="secondary" id="apply-eye-colour" type="button">Apply eye colour</button><p id="eye-colour-status" role="status" aria-live="polite">Preparing eye colour…</p>
</fieldset></details>
<fieldset disabled id="framing-controls">''')
edit(p,'restore its clothes, colours, cut, framing and scene.', 'restore its clothes, hair and eye colours, cut, framing and scene.')
edit(p,'with the same clothes, colours, cut, framing, scene and studio light.', 'with the same clothes, hair and eye colours, cut, framing, scene and studio light.')
p='packages/testbed/src/showcase.js'
edit(p,"import { sameHairTint }", "import { resolveEyeColour } from '../../core/src/material/EyeColourOptions.js';\nimport { sameHairTint }")
edit(p,"['#mix-colours', '#hair-colours']", "['#mix-colours', '#hair-colours', '#eye-colours']")
edit(p,'const colourControls = mountColourControls',"""document.getElementById('apply-eye-colour').addEventListener('click', () => {
    if (busy || savingImage || failed || !avatar || avatar.disposed) return;
    const eyeColour = resolveEyeColour(document.getElementById('eye-shade').value);
    if (eyeColour === (selected.eyeColour ?? null)) return;
    const nextSelection = {...selected};
    if (eyeColour === null) delete nextSelection.eyeColour; else nextSelection.eyeColour = eyeColour;
    optionsForShowcase(nextSelection);
    const next = showcaseSettingsUrl(nextSelection, location.href);
    releaseAttention({immediate: true}); busy = true; enableControls();
    setStatus('Preparing eye colour…'); navigationPending = true; location.assign(next.href);
});
const colourControls = mountColourControls""")
edit(p,' · ${hairColourLabel(look.hairColour, look.hairTint)} · '," · ${hairColourLabel(look.hairColour, look.hairTint)}${look.eyeColour === 'blue' ? ' · Blue eyes' : ''} · ")
edit(p,"    tintToUrl(url, selected.hairTint);", "    if (selected.eyeColour) url.searchParams.set('eyeColour', selected.eyeColour); else url.searchParams.delete('eyeColour');\n    tintToUrl(url, selected.hairTint);")
edit(p,'        tintToUrl(next, selected.hairTint);',"        if (selected.eyeColour) next.searchParams.set('eyeColour', selected.eyeColour);\n        tintToUrl(next, selected.hairTint);")
edit(p,"    const report = avatar.report(); selected.outfit", "    const report = avatar.report();\n    document.getElementById('eye-colour-status').textContent = `Applied: ${report.eyes.applied === 'blue' ? 'Blue' : 'Original'}`;\n    selected.outfit")
edit(p,'    hairColours.load(selected.hairColour, selected.hairTint);',"    hairColours.load(selected.hairColour, selected.hairTint);\n    document.getElementById('eye-shade').value = selected.eyeColour ?? 'original';")
for p,s in pending.items(): Path(p).write_text(s)
(r/'EDIT-RECIPE.json').write_text(json.dumps({'pid':os.getpid(),'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'changes':changes,'newFiles':['packages/core/src/material/EyeColourOptions.js']},indent=2)+'\n')
print('edited',len(changes),'declared replacements')
