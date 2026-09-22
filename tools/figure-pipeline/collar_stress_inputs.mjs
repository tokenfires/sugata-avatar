// Recover the frozen comparison inputs from tracked recipes, never from an ignored archive.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {transformCasualCollarFit, CASUAL_COLLAR_FIT} from './casual_collar_fit.mjs';
import {transformCasualTrouserFit} from './casual_trouser_fit.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function prepareStressAssets(directory) {
    const previous = transformCasualTrouserFit();
    const candidate = transformCasualCollarFit();
    const entries = [
        ['previous', 'accepted.glb', previous.bytes, CASUAL_COLLAR_FIT.sourceSHA256],
        ['candidate', 'collar-interior.glb', candidate.bytes, CASUAL_COLLAR_FIT.outputSHA256],
        ['geometry', 'collar-geometry.glb', candidate.geometryBytes, CASUAL_COLLAR_FIT.geometrySHA256]
    ];
    fs.mkdirSync(path.join(directory, 'assets')); // Refuse reuse, including partial captures.
    return Object.fromEntries(entries.map(([key, name, bytes, expected]) => {
        assert.equal(sha256(bytes), expected, `${key}: frozen input changed`);
        const file = `assets/${name}`;
        fs.writeFileSync(path.join(directory, file), bytes, {flag: 'wx'});
        return [key, {file, sha256: expected}];
    }));
}

export function readStressAsset(directory, entry, expected) {
    assert.ok(entry && typeof entry.file === 'string', 'Missing captured asset');
    assert.equal(entry.sha256, expected, 'Unexpected captured asset identity');
    const file = path.resolve(directory, entry.file);
    assert.ok(file.startsWith(path.resolve(directory) + path.sep), 'Asset must belong to its capture');
    const bytes = fs.readFileSync(file);
    assert.equal(sha256(bytes), expected, `Captured asset changed: ${entry.file}`);
    return file;
}
