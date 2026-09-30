// Supported g050 wardrobe studies with authored colourways on the existing fitted garments.
import { resolveHairColour, resolveHairTint, sameHairTint, mixedHairColour, hairColourLinear } from '../../core/src/material/HairColourOptions.js';
import { WARDROBE_STYLES } from '../../core/src/wardrobe/WardrobeStyleOptions.js';
import { REVIEW_SCENES, reviewSceneSelection, optionsForReviewScene } from './viewer-scenes.mjs';
import { coloursFromSelection, colourSelectionFromParams } from './showcase-colours.mjs';
import { resolveWardrobeColours } from '../../core/src/wardrobe/WardrobeStyleOptions.js';
export const SHOWCASE_PRESETS = Object.freeze([
    Object.freeze({ id: 'casual', number: '01', name: 'Everyday', hair: 'bob02', outfit: 'casual',
        description: 'A tonal tee, dark denim, and the chin-length bob.' }),
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
const choices = { style: WARDROBE_STYLES, preset: ['casual', 'elegant'], outfit: ['casual', 'elegant'], frame: ['body', 'portrait'], light: ['studio', 'warm', 'neutral'] };
export function resolveShowcaseSelection(params) {
    for (const [key, values] of Object.entries(choices)) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} selection.`);
        if (params.has(key) && !values.includes(params.get(key))) throw new Error(`Unknown ${key} selection.`);
    }
    for (const key of ['gender', 'bake', 'hair', 'foundation']) if (params.has(key))
        throw new Error('This lookbook supports its two authored g050 clothing studies only.');
    if (params.getAll('hairColour').length > 1) throw new Error('Duplicate hair colour selection.');
    const hairColour = resolveHairColour(params.has('hairColour') ? params.get('hairColour') : undefined);
    for (const key of ['hairTintColour', 'hairTintAmount']) if (params.getAll(key).length > 1) throw new Error('Duplicate hair tint selection.');
    const hasTint = params.has('hairTintColour') || params.has('hairTintAmount');
    if (hasTint && (!params.has('hairTintColour') || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(params.get('hairTintAmount') ?? '')))
        throw new Error('Hair tint needs a colour and an amount from 0 to 1.');
    const hairTint = resolveHairTint(hasTint ? {colour: params.get('hairTintColour'), amount: Number(params.get('hairTintAmount'))} : undefined, hairColour);
    const preset = SHOWCASE_PRESETS.find(p => p.id === (params.get('preset') ?? 'casual'));
    const selection = { preset: preset.id, style: params.get('style') ?? 'ecru', outfit: params.get('outfit') ?? preset.outfit,
        frame: params.get('frame') ?? 'body', light: params.get('light') ?? 'studio', scene: reviewSceneSelection(params),
        ...(hairColour === null ? {} : { hairColour }), ...(hairTint === null ? {} : { hairTint }) };
    optionsForReviewScene(selection.scene, selection.light);
    return colourSelectionFromParams(params, selection);
}
export function optionsForShowcase(selection) {
    const preset = SHOWCASE_PRESETS.find(p => p.id === selection.preset);
    if (!preset || !SHOWCASE_OUTFITS[selection.outfit] || !choices.frame.includes(selection.frame) || !choices.light.includes(selection.light) || !choices.style.includes(selection.style))
        throw new Error('Unsupported showcase selection.');
    const colours = coloursFromSelection(selection);
    const hairColour = resolveHairColour(selection.hairColour);
    const hairTint = resolveHairTint(selection.hairTint, hairColour);
    return { identity: { gender: .5, mode: 'nearest' }, hair: preset.hair, ...(hairColour === null ? {} : { hairColour }),
        ...(hairTint === null ? {} : { hairTint }), frame: selection.frame,
        quality: 'balanced', ...optionsForReviewScene(selection.scene ?? 'studio', selection.light), seed: SHOWCASE_SEED,
        pose: 'relaxed-standing', wardrobe: { ...(selection.style === 'original' ? {} : {style: selection.style}), ...(colours ? {colours: {...colours}} : {}), outfit: [...SHOWCASE_OUTFITS[selection.outfit].garments], foundation: { ...SHOWCASE_FOUNDATION } } };
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
    const hairColour = report.hair.colour;
    if (hairColour && (!hairColour.matchesAttached || hairColour.requested !== hairColour.applied ||
        !sameHairTint(hairColour.requestedTint, hairColour.appliedTint)))
        throw new Error('The attached hair colour does not match this saved look.');
    const appliedHairColour = resolveHairColour(hairColour?.applied ?? undefined);
    const appliedHairTint = resolveHairTint(hairColour?.appliedTint ?? undefined, appliedHairColour);
    if (appliedHairTint !== null && hairColour.resolved !== mixedHairColour(appliedHairColour, appliedHairTint))
        throw new Error('The attached hair tint does not match this saved look.');
    if (appliedHairTint !== null && (!Array.isArray(hairColour.linear) || hairColour.linear.length !== 3 ||
        hairColourLinear(hairColour.resolved).some((value, index) => value !== hairColour.linear[index])))
        throw new Error('The attached hair tint colour is different from the saved recipe.');
    const appearance = report.wardrobe.appearance;
    if (!appearance?.attached || !choices.style.includes(appearance.style))
        throw new Error('The selected clothing colours are not attached.');
    const colours = resolveWardrobeColours(appearance.colours, appearance.style);
    const outfit = outfitFromReport(report), foundation = report.wardrobe.foundation;
    if (!foundation || !['foundation_bra','foundation_vest'].includes(foundation.TORSO) ||
        !['foundation_briefs','foundation_boxer_brief'].includes(foundation.HIPS)) throw new Error('The attached foundation is incomplete.');
    const actual = [...SHOWCASE_OUTFITS[outfit].garments, foundation.TORSO, foundation.HIPS];
    if (report.wardrobe.state.worn.length !== actual.length || actual.some(id => !report.wardrobe.state.worn.includes(id)))
        throw new Error('The attached garments do not match the supported outfit.');
    if (!choices.frame.includes(report.framing?.mode) || !choices.light.includes(report.scene?.lighting?.look) ||
        !REVIEW_SCENES.includes(report.scene.id) || report.quality?.requested !== 'balanced' || !Number.isFinite(report.motion?.seed))
        throw new Error('The current view is outside this lookbook’s supported configuration.');
    return { identity: { gender: report.identity.gender, mode: 'nearest' }, hair: report.hair.style,
        ...(appliedHairColour === null ? {} : { hairColour: appliedHairColour }),
        ...(appliedHairTint === null ? {} : { hairTint: appliedHairTint }),
        frame: report.framing.mode, quality: report.quality.requested,
        ...optionsForReviewScene(report.scene.id, report.scene.lighting.look), seed: report.motion.seed, pose: 'relaxed-standing',
        wardrobe: { ...(appearance.style === 'original' ? {} : {style: appearance.style}), ...(colours ? {colours: {...colours}} : {}), outfit: [...SHOWCASE_OUTFITS[outfit].garments], foundation: { TORSO: foundation.TORSO, HIPS: foundation.HIPS } } };
}
