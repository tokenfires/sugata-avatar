// Preserve raw evidence in place; create lossless compact copies and explicit hash mapping.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';

const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
const [sourceArg,destinationArg]=process.argv.slice(2);
assert.ok(sourceArg&&destinationArg,'Usage: node compress-evidence.mjs RAW_DIRECTORY FRESH_COMPACT_DIRECTORY');
const source=path.resolve(sourceArg),destination=path.resolve(destinationArg);
assert.ok(!fs.existsSync(destination),'Refuse existing compact destination');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),relative=file=>path.relative(ROOT,file);
const entries=fs.readdirSync(source,{withFileTypes:true});assert.ok(entries.every(e=>e.isFile()),'This evidence bundle must contain files only');
fs.mkdirSync(destination,{recursive:true});
const manifest={version:1,meaning:'Lossless copies only; raw source evidence remains in place. Decode gzip copies to recover exact original bytes except sourceWasGzip entries, whose encoded copy already is the original file.',
    sourceDirectory:relative(source),compressor:{file:relative(fileURLToPath(import.meta.url)),sha256:sha(fs.readFileSync(fileURLToPath(import.meta.url)))},files:[]};
for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
    const sourceFile=path.join(source,entry.name),raw=fs.readFileSync(sourceFile),sourceWasGzip=entry.name.endsWith('.gz');
    const decoded=sourceWasGzip?gunzipSync(raw):raw,encoded=sourceWasGzip?raw:gzipSync(raw,{level:9});
    const file=path.join(destination,entry.name+(sourceWasGzip?'':'.gz'));
    assert.deepEqual(gunzipSync(encoded),decoded,'Lossless roundtrip mismatch');
    fs.writeFileSync(file,encoded,{flag:'wx'});assert.equal(sha(fs.readFileSync(sourceFile)),sha(raw),'Raw source changed');
    manifest.files.push({sourceFile:relative(sourceFile),sourceSha256:sha(raw),sourceBytes:raw.length,sourceWasGzip,
        file:relative(file),encoding:'gzip',sha256:sha(encoded),bytes:encoded.length,decodedSHA256:sha(decoded),decodedBytes:decoded.length});
}
manifest.totalSourceBytes=manifest.files.reduce((n,f)=>n+f.sourceBytes,0);manifest.totalEncodedBytes=manifest.files.reduce((n,f)=>n+f.bytes,0);
fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({files:manifest.files.length,totalSourceBytes:manifest.totalSourceBytes,totalEncodedBytes:manifest.totalEncodedBytes,manifest:relative(path.join(destination,'manifest.json'))}));
