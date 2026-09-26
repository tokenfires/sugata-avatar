// These review rooms have separate native lighting recipes. An explicit lighting
// option overrides a scene's exposure, so Kitchen must retain the scene default.
export const REVIEW_SCENES = Object.freeze(['studio', 'kitchen']);

export function reviewSceneSelection(params) {
    if (params.getAll('scene').length > 1) throw new Error('Duplicate scene selection.');
    const scene = params.get('scene') ?? 'studio';
    if (!REVIEW_SCENES.includes(scene)) throw new Error('Choose Studio or Kitchen.');
    return scene;
}

export function optionsForReviewScene(scene, light = 'studio') {
    if (!REVIEW_SCENES.includes(scene)) throw new Error('Unsupported review scene.');
    if (!['studio', 'warm'].includes(light)) throw new Error('Unsupported review light.');
    if (scene === 'kitchen') {
        if (light !== 'studio') throw new Error('Kitchen uses its own room lighting.');
        return {scene};
    }
    return {scene, lighting: light};
}
