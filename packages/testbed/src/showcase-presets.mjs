// Supported wardrobe studies. These presets choose existing assets; they do not sculpt or recolour them.
export const SHOWCASE_PRESETS = Object.freeze([
    Object.freeze({ id: 'casual', number: '01', name: 'Everyday', hair: 'bob02', outfit: 'casual',
        description: 'A blue tee, worn denim, and the chin-length bob.' }),
    Object.freeze({ id: 'elegant', number: '02', name: 'After hours', hair: 'bob01', outfit: 'elegant',
        description: 'A striped blouse, a dark skirt, and the long bob.' })
]);
export const SHOWCASE_OUTFITS = Object.freeze({
    casual: Object.freeze({ label: 'Tee + denim', garments: Object.freeze(['female_casualsuit01', 'shoes01']) }),
    elegant: Object.freeze({ label: 'Blouse + skirt', garments: Object.freeze(['female_elegantsuit01', 'shoes01']) })
});
// Compared in actual fixed-pose studio renders before selection. Visible fit issues remain documented.
export const SHOWCASE_FOUNDATION = Object.freeze({ TORSO: 'foundation_bra', HIPS: 'foundation_briefs' });
export const SHOWCASE_SEED = 20260807;
const choices = { preset: ['casual', 'elegant'], outfit: ['casual', 'elegant'], frame: ['body', 'portrait'], light: ['studio', 'warm'] };
export function resolveShowcaseSelection(params) {
    for (const [key, values] of Object.entries(choices)) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} selection.`);
        if (params.has(key) && !values.includes(params.get(key))) throw new Error(`Unknown ${key} selection.`);
    }
    for (const key of ['gender', 'bake', 'hair', 'foundation']) if (params.has(key))
        throw new Error('This lookbook supports its two authored g050 clothing studies only.');
    const preset = SHOWCASE_PRESETS.find(p => p.id === (params.get('preset') ?? 'casual'));
    return { preset: preset.id, outfit: params.get('outfit') ?? preset.outfit,
        frame: params.get('frame') ?? 'body', light: params.get('light') ?? 'studio' };
}
export function optionsForShowcase(selection) {
    const preset = SHOWCASE_PRESETS.find(p => p.id === selection.preset);
    if (!preset || !SHOWCASE_OUTFITS[selection.outfit] || !choices.frame.includes(selection.frame) || !choices.light.includes(selection.light))
        throw new Error('Unsupported showcase selection.');
    return { identity: { gender: .5, mode: 'nearest' }, hair: preset.hair, frame: selection.frame,
        quality: 'balanced', scene: 'studio', lighting: selection.light, seed: SHOWCASE_SEED,
        pose: 'relaxed-standing', wardrobe: { outfit: [...SHOWCASE_OUTFITS[selection.outfit].garments], foundation: { ...SHOWCASE_FOUNDATION } } };
}
export function outfitFromReport(report) {
    const worn = report.wardrobe?.state?.worn;
    if (!Array.isArray(worn)) throw new Error('The outfit has not attached yet.');
    const outer = Object.entries(SHOWCASE_OUTFITS).filter(([,o]) => o.garments.every(id => worn.includes(id)));
    if (outer.length !== 1) throw new Error('The attached outfit is not a supported clothing study.');
    return outer[0][0];
}
/** Export what is attached, not an earlier request or a preset that the user subsequently changed. */
export function configurationFromReport(report) {
    if (report.disposal?.disposed || report.identity?.bake !== 'figure_g050' || report.identity.gender !== .5 ||
        !report.wardrobe?.attached || report.wardrobe.pendingCandidates !== 0 || !report.hair?.attached ||
        report.hair.loadedStyle !== report.hair.style || !['bob01', 'bob02'].includes(report.hair.style))
        throw new Error('Wait for the supported look to finish loading before saving it.');
    const outfit = outfitFromReport(report), foundation = report.wardrobe.foundation;
    if (!foundation || !['foundation_bra','foundation_vest'].includes(foundation.TORSO) ||
        !['foundation_briefs','foundation_boxer_brief'].includes(foundation.HIPS)) throw new Error('The attached foundation is incomplete.');
    const actual = [...SHOWCASE_OUTFITS[outfit].garments, foundation.TORSO, foundation.HIPS];
    if (report.wardrobe.state.worn.length !== actual.length || actual.some(id => !report.wardrobe.state.worn.includes(id)))
        throw new Error('The attached garments do not match the supported outfit.');
    if (!choices.frame.includes(report.framing?.mode) || !choices.light.includes(report.scene?.lighting?.look) ||
        report.scene.id !== 'studio' || report.quality?.requested !== 'balanced' || !Number.isFinite(report.motion?.seed))
        throw new Error('The current view is outside this lookbook’s supported configuration.');
    return { identity: { gender: report.identity.gender, mode: 'nearest' }, hair: report.hair.style,
        frame: report.framing.mode, quality: report.quality.requested, scene: report.scene.id,
        lighting: report.scene.lighting.look, seed: report.motion.seed, pose: 'relaxed-standing',
        wardrobe: { outfit: [...SHOWCASE_OUTFITS[outfit].garments], foundation: { TORSO: foundation.TORSO, HIPS: foundation.HIPS } } };
}
