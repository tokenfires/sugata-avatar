import assert from 'node:assert/strict';
import {reviewSceneSelection, optionsForReviewScene} from './viewer-scenes.mjs';

assert.equal(reviewSceneSelection(new URLSearchParams()), 'studio');
for (const scene of ['studio', 'kitchen']) assert.equal(reviewSceneSelection(new URLSearchParams({scene})), scene);
console.log('PASS review scene selection');

for (const query of ['scene=unknown', 'scene=', 'scene=studio&scene=kitchen', 'scene=kitchen&scene=kitchen'])
    assert.throws(() => reviewSceneSelection(new URLSearchParams(query)));
console.log('PASS ambiguous and unsupported rooms rejected');

for (const light of ['studio', 'warm']) assert.deepEqual(optionsForReviewScene('studio', light), {scene:'studio', lighting:light});
assert.deepEqual(optionsForReviewScene('kitchen'), {scene:'kitchen'});
assert.equal(Object.hasOwn(optionsForReviewScene('kitchen'), 'lighting'), false);
console.log('PASS studio look preserved and room lighting not overridden');

assert.throws(() => optionsForReviewScene('kitchen', 'warm'), /own room lighting/);
assert.throws(() => optionsForReviewScene('studio', 'unknown'));
assert.throws(() => optionsForReviewScene('unknown'));
console.log('PASS unsupported lighting combinations rejected');
