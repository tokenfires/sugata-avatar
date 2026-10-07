// Sole fixed CPU render from original vector source; no browser/native/GPU or raster edit.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const sharp = require('/Users/robault/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const dir = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(dir, 'trouser-first.png');
const handle = await fs.open(output, 'wx');
const started = new Date().toISOString();
try {
  const input = await fs.readFile(path.join(dir, 'trouser.svg'));
  const { data, info } = await sharp(input, { density: 72 }).resize(1800, 1500, { fit: 'fill' }).png().toBuffer({ resolveWithObject: true });
  if (info.width !== 1800 || info.height !== 1500 || info.format !== 'png') throw Error('Unexpected fixed render shape');
  await handle.writeFile(data);
  await fs.writeFile(path.join(dir, 'RENDER.json'), JSON.stringify({started_utc:started,finished_utc:new Date().toISOString(),pid:process.pid,source_sha256:crypto.createHash('sha256').update(input).digest('hex'),output:path.basename(output),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),info,sharp_versions:sharp.versions,qualification:'First whole CPU vector image only; no browser/native/GPU/body/fit/runtime qualification'},null,2)+'\n', {flag:'wx'});
  process.stdout.write(JSON.stringify({output,bytes:data.length,info})+'\n');
} catch (error) {
  await fs.writeFile(path.join(dir, 'RENDER-FAILURE.json'), JSON.stringify({started_utc:started,failed_utc:new Date().toISOString(),pid:process.pid,error:String(error),stack:error.stack,limit:'Sole attempt failed; original/partial output retained, no retry admitted'},null,2)+'\n', {flag:'wx'});
  throw error;
} finally {
  await handle.close();
}
