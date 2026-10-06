// One separately admitted candidate gate: exact preflight, new regressions, original integrations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const leaf = path.dirname(fileURLToPath(import.meta.url));
const gate = JSON.parse(fs.readFileSync(path.join(leaf, 'ROOT-SOURCE-GATE.json'), 'utf8'));
for (const row of gate.execution_inputs) {
    const bytes = fs.readFileSync(row.path);
    if (bytes.length !== row.bytes || createHash('sha256').update(bytes).digest('hex') !== row.sha256)
        throw new Error(`Candidate input changed: ${row.path}`);
}
console.log(JSON.stringify({candidateStarted: new Date().toISOString(),pid:process.pid,node:process.version}));
await import('./completion-regression.mjs');
await import('./catalogue-gate.mjs');
// Existing original gate's process.exit ends this one owned Node child after all its assertions.
await import('./agency-serial-gate.mjs');
