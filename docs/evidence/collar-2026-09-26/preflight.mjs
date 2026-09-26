// Read-only fit preflight. Writes this lane's reports only; never solves or exports a GLB.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inspectFitSupport} from '../../../tools/figure-pipeline/collar_fit_support.mjs';
import {transformCasualCollarFit, CASUAL_COLLAR_FIT} from '../../../tools/figure-pipeline/casual_collar_fit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = file => hash(fs.readFileSync(path.join(ROOT, file)));
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file)));
const exists = file => fs.existsSync(path.join(ROOT, file));
const record = (file, expected = null) => ({file, exists: exists(file),
    ...(exists(file) ? {bytes: fs.statSync(path.join(ROOT, file)).size, sha256: sha(file)} : {}),
    ...(expected ? {expectedSHA256: expected, matches: exists(file) && sha(file) === expected} : {})});
const report = {version: 1, createdAt: new Date().toISOString(), scope: 'CPU/read-only preflight for one constrained collar fit. No fit, new geometry export, GPU, browser or Blender work.',
    preflightInstrumentSHA256: hash(fs.readFileSync(fileURLToPath(import.meta.url))), checks: [], blockers: []};
const check = (name, pass, detail) => {report.checks.push({name, pass, detail}); return pass;};

const manifestFile = 'docs/evidence/collar-recovery-2026-09-22.manifest.json';
const manifest = read(manifestFile);
const archiveFailures = [];
let archiveBytes = 0;
for (const expected of manifest.files) {
    const actual = record(expected.file, expected.sha256);
    archiveBytes += expected.bytes;
    if (!actual.matches || actual.bytes !== expected.bytes) archiveFailures.push({...actual, expectedBytes: expected.bytes});
}
report.archive = {manifest: record(manifestFile), files: manifest.files.length, bytes: archiveBytes, failures: archiveFailures};
check('Retained September 22 archive matches its complete manifest', archiveFailures.length === 0, `${manifest.files.length} files, ${archiveBytes} bytes`);
report.historicalArchiveAvailability = [
    'docs/evidence/collar-clearance-paused-2026-09-13.manifest.json',
    'docs/evidence/collar-interior-2026-09-16.manifest.json',
    'docs/evidence/collar-expression-stress-2026-09-16.manifest.json'
].map(file => {
    const manifest = read(file), entries = manifest.files.map(entry => entry.file ?? `${manifest.archive}/${entry.path}`);
    return {manifest: record(file), expectedFiles: entries.length, presentFiles: entries.filter(exists).length,
        searchedRoots: [...new Set(entries.map(entry => entry.split('/').slice(0, 2).join('/')))],
        scope: 'Only exact locations in the retained manifests were inspected. No broad home search or claim of global unrecoverability.'};
});

const capturePath = 'captures/collar-stress-2026-09-22/gpu-v1/report.json';
const capture = read(capturePath), recovery = read('docs/evidence/collar-recovery-2026-09-22.json');
report.capture = record(capturePath, recovery.capture.sha256);
check('Retained capture completed with four runs and 19 snapshots each', capture.completed === true && capture.runs.length === 4 && capture.runs.every(r => r.geometry.length === 19 && r.errors.length === 0), capture.runs.map(r => ({name: r.name, snapshots: r.geometry.length, errors: r.errors})));

report.assets = [
    record('assets/wardrobe/female_casualsuit01/g050.glb', CASUAL_COLLAR_FIT.sourceSHA256),
    ...Object.values(capture.assets).map(asset => record('captures/collar-stress-2026-09-22/gpu-v1/' + asset.file, asset.sha256)),
    ...Object.entries(capture.sourceHashes).filter(([file]) => file.startsWith('assets/wardrobe/')).map(([file, expected]) => record(file, expected)),
    record('tools/figure-pipeline/fixtures/wardrobe-g050-under-masks-v1.json', '13170c7dc4d3561c02b84d9ef38c10260e3e5c3a21670872b9986d44ea523c02')
];
check('Accepted default, frozen collar, foundations, wardrobe assets and calibration retain hashes', report.assets.every(a => a.matches), report.assets);
const reconstruction = transformCasualCollarFit();
check('Tracked collar recipe reproduces the frozen exact geometry and interior asset', hash(reconstruction.bytes) === CASUAL_COLLAR_FIT.outputSHA256 && hash(reconstruction.geometryBytes) === CASUAL_COLLAR_FIT.geometrySHA256, reconstruction.report);

const support = inspectFitSupport(), savedSupport = read('docs/evidence/collar-fit-support-2026-09-22.json');
assert.deepEqual(support.support, savedSupport.support);
fs.writeFileSync(path.join(HERE, 'support.json'), JSON.stringify(support, null, 2) + '\n', {flag: 'wx'});
check('Support exactly reproduces September 22 lists and invariants', true, {movingGroups: support.support.movingGroups.length, movingVertices: support.support.movingVertices.length, incidentTriangles: support.support.incidentTriangles.length,
    incidentOutsideInterior: support.support.incidentOutsideInterior.length, rearGuardDisjoint: true, movingSeamJointsWeightsEqual: true, maximumAdditionalDisplacementMetres: support.support.maximumAdditionalDisplacementMetres});

const witnessedHash = '66a3e540658b7ed11e8662b76dcb1d7f7b9e424ba84aa37f9b402f1df140f4a5';
report.visibleWitness = [record('docs/evidence/collar-stress-2026-09-16-ordinary.png', witnessedHash),
    record('captures/collar-stress-2026-09-22/gpu-v1/bob02-owned/frame-0099.png', witnessedHash),
    record('docs/evidence/collar-stress-2026-09-16-tag.png')];
check('Retained ordinary witness matches reconstructed step 99', report.visibleWitness.slice(0, 2).every(r => r.matches), report.visibleWitness);

const calibration = read('tools/figure-pipeline/fixtures/wardrobe-g050-under-masks-v1.json');
report.requiredUnavailableInputs = [
    {role: 'Historical mild-pose solver snapshots and original frozen solver', file: 'captures/collar-clearance-paused-2026-09-13', stage: 'Before fitting: retain historical mild poses as constraints'},
    {role: 'Historical mild native-motion capture', file: 'captures/collar-window-2026-09-16/lining-motion-v2', stage: 'Before fitting and later motion qualification'},
    {role: 'Exact frozen foundation replay', file: 'captures/tee-neckline-2026-09-13/independent-calibration/replay.mjs', expectedSHA256: '338a3c5d2821c9767605f4c7d9e199c21c370acedd4a194cc6690208f1c9fdb2', stage: '23,310-footprint qualification'},
    ...Object.entries(calibration.proofSha256).map(([file, expectedSHA256]) => ({role: 'Pinned foundation calibration proof', file: 'captures/wardrobe-under-masks-2026-09-09/' + file, expectedSHA256, stage: 'Frozen coverage qualification'})),
    {role: 'Opening report bound by current foundation reviewer', file: 'captures/collar-opening-2026-09-16/gpu-v3/report.json', expectedSHA256: '20df066dbcaedf4660e30bdb2d97bd51ffbd643f0de3536fb47657386fc0c7c2', stage: 'Frozen coverage qualification'}
].map(item => ({...item, exists: exists(item.file)}));
check('Historical mild constraints and full frozen coverage replay are available', report.requiredUnavailableInputs.every(r => r.exists), report.requiredUnavailableInputs);
if (report.requiredUnavailableInputs.some(r => !r.exists)) report.blockers.push({kind: 'Missing required historical inputs', constraint: 'COLLAR-FIT-PLAN-2026-09-16.md requires historical mild poses in the solve and the exact frozen foundation replay for qualification.',
    action: 'Stop before numerical fitting/export. Recover those inputs with their pinned hashes, or explicitly design and document a replacement constraint/replay path before a candidate solve.'});

// These differences are historical provenance, not a claim that current runtime behavior is wrong.
// A future candidate must receive fresh runtime parity/motion evidence on its actual source.
report.currentSourceDrift = Object.entries(capture.sourceHashes).filter(([file]) => file.startsWith('packages/core/src/'))
    .map(([file, expected]) => record(file, expected)).filter(r => !r.matches);
report.status = report.blockers.length ? 'STOPPED_BEFORE_SOLVE_MISSING_REQUIRED_INPUTS' : report.checks.every(c => c.pass) ? 'PREFLIGHT_PASSED' : 'STOPPED_BEFORE_SOLVE_FAILED_INVARIANT';
report.newCandidateExports = 0;
report.nextBoundedAction = 'Recover or explicitly replace historical mild-pose and pinned coverage inputs. Preserve this preflight and exact support. Do not weaken the fit constraints or equate historical snapshots with a new current-runtime qualification.';
fs.writeFileSync(path.join(HERE, 'preflight.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: report.status, checks: report.checks.map(({name, pass}) => ({name, pass})), unavailableInputs: report.requiredUnavailableInputs.filter(r => !r.exists).length, sourceDrift: report.currentSourceDrift.map(r => r.file), newCandidateExports: 0}, null, 2));
