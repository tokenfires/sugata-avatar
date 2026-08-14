// compose.mjs — lays plates side by side so the comparison is one image and not two clicks.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { decodePng } from '../png.mjs';

let TBL = null;
function crc32(buf) {
  if (!TBL) { TBL = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TBL[n] = c; } }
  let c = -1; for (const b of buf) c = TBL[(c ^ b) & 0xff] ^ (c >>> 8); return c ^ -1;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
};
function writePng(path, w, h, rgb) {
  const raw = Buffer.alloc(h * (w * 3 + 1));
  let p = 0;
  for (let j = 0; j < h; j++) { raw[p++] = 0; rgb.copy(raw, p, j * w * 3, (j + 1) * w * 3); p += w * 3; }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]));
}

const [dst, ...srcs] = process.argv.slice(2);
const imgs = srcs.map((s) => decodePng(fs.readFileSync(s)));
const GAP = 12;
const W = imgs.reduce((a, i) => a + i.width, 0) + GAP * (imgs.length - 1);
const H = Math.max(...imgs.map((i) => i.height));
const out = Buffer.alloc(W * H * 3, 0);
let xOff = 0;
for (const img of imgs) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const k = (y * img.width + x) * 4;
      const o = (y * W + xOff + x) * 3;
      out[o] = Math.round(img.pixels[k] * 255);
      out[o + 1] = Math.round(img.pixels[k + 1] * 255);
      out[o + 2] = Math.round(img.pixels[k + 2] * 255);
    }
  }
  xOff += img.width + GAP;
}
writePng(dst, W, H, out);
console.log(`${dst} ${W}x${H}`);
