// crop.mjs — nearest-neighbour crop+zoom, so a strand is looked at as pixels and not as a
// resampled impression of pixels. 4x is the magnification the hud.txt asks a human for.
import fs from 'node:fs';
import { decodePng } from '../png.mjs';
import zlib from 'node:zlib';

const [src, dst, X, Y, W, H, Z] = process.argv.slice(2);
const x = +X, y = +Y, w = +W, h = +H, z = +(Z ?? 4);
const img = decodePng(fs.readFileSync(src));
const ow = w * z, oh = h * z;
const raw = Buffer.alloc(oh * (ow * 3 + 1));
let p = 0;
for (let j = 0; j < oh; j++) {
  raw[p++] = 0;
  for (let i = 0; i < ow; i++) {
    const sx = x + Math.floor(i / z), sy = y + Math.floor(j / z);
    const k = (sy * img.width + sx) * 4;
    raw[p++] = Math.round(img.pixels[k] * 255);
    raw[p++] = Math.round(img.pixels[k + 1] * 255);
    raw[p++] = Math.round(img.pixels[k + 2] * 255);
  }
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
};
let TBL = null;
function crc32(buf) {
  if (!TBL) { TBL = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TBL[n] = c; } }
  let c = -1; for (const b of buf) c = TBL[(c ^ b) & 0xff] ^ (c >>> 8); return c ^ -1;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(ow, 0); ihdr.writeUInt32BE(oh, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
fs.writeFileSync(dst, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log(`${dst} ${ow}x${oh} from ${src} @ ${x},${y} ${w}x${h} z${z}`);
