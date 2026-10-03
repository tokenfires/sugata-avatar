// PNG decode/encode with zero dependencies.
//
// Intent: the critic harness has to be trustworthy above all else — a measurement tool that
// pulls in a supply chain is a measurement tool nobody audits. Node already ships the only
// hard part (zlib), so the rest is chunk framing, five scanline filters, and sample unpacking.
//
// Scope, deliberately narrow to what a browser canvas and a screenshot tool actually emit:
//   - bit depths 1/2/4/8/16
//   - colour types 0 (grey), 2 (RGB), 3 (palette), 4 (grey+alpha), 6 (RGBA)
//   - non-interlaced only. Adam7 is rejected loudly rather than silently mis-decoded.
//
// Decoded pixels come back as normalised float RGBA in [0,1] so that 16-bit sources keep their
// precision. That matters: gate G6 measures the black point down at code value ~1 of 255, which
// is the quantisation floor of an 8-bit image.

import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const COLOR_TYPE_GREY = 0;
const COLOR_TYPE_RGB = 2;
const COLOR_TYPE_PALETTE = 3;
const COLOR_TYPE_GREY_ALPHA = 4;
const COLOR_TYPE_RGBA = 6;

const SAMPLES_PER_PIXEL = {
  [COLOR_TYPE_GREY]: 1,
  [COLOR_TYPE_RGB]: 3,
  [COLOR_TYPE_PALETTE]: 1,
  [COLOR_TYPE_GREY_ALPHA]: 2,
  [COLOR_TYPE_RGBA]: 4,
};

// Ancillary chunks that can carry provenance (author, software, source filename, comments).
// The blind A/B harness strips these so a critic cannot read the answer out of the file.
const PROVENANCE_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt', 'tIME', 'eXIf']);

const crcTable = buildCrcTable();

// --- public API ---------------------------------------------------------------------------

// Returns { width, height, colorType, bitDepth, pixels } where pixels is a Float32Array of
// length width*height*4, laid out RGBA, each sample normalised to [0,1] in the file's own
// encoding (i.e. still sRGB-encoded — linearisation is the caller's job, see color.mjs).
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Not a PNG file (signature mismatch).');
  }

  const chunks = readChunks(buffer);
  const header = chunks.find((chunk) => chunk.type === 'IHDR');
  if (!header) throw new Error('PNG has no IHDR chunk.');

  const width = header.data.readUInt32BE(0);
  const height = header.data.readUInt32BE(4);
  const bitDepth = header.data[8];
  const colorType = header.data[9];
  const interlace = header.data[12];

  if (interlace !== 0) {
    throw new Error('Interlaced (Adam7) PNGs are not supported. Re-save without interlacing.');
  }
  const samplesPerPixel = SAMPLES_PER_PIXEL[colorType];
  if (samplesPerPixel === undefined) {
    throw new Error(`Unsupported PNG colour type ${colorType}.`);
  }

  const compressed = Buffer.concat(
    chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)
  );
  if (compressed.length === 0) throw new Error('PNG has no IDAT data.');

  const raw = zlib.inflateSync(compressed);
  const scanlines = unfilterScanlines(raw, width, height, bitDepth, samplesPerPixel);

  const paletteChunk = chunks.find((chunk) => chunk.type === 'PLTE');
  const palette = paletteChunk ? paletteChunk.data : null;
  if (colorType === COLOR_TYPE_PALETTE && !palette) {
    throw new Error('Palette PNG has no PLTE chunk.');
  }

  const pixels = expandToRgba({
    scanlines,
    width,
    height,
    bitDepth,
    colorType,
    samplesPerPixel,
    palette,
  });

  return { width, height, colorType, bitDepth, pixels };
}

// Encodes 8-bit RGBA. Used by the self-test to build synthetic images with known statistics,
// and by anything else that needs to write a PNG without adding a dependency.
export function encodePng(width, height, rgbaBytes) {
  const expected = width * height * 4;
  if (rgbaBytes.length !== expected) {
    throw new Error(`Expected ${expected} RGBA bytes, got ${rgbaBytes.length}.`);
  }

  // One filter byte per scanline; filter 0 (None) keeps the encoder honest and readable.
  const rawStride = width * 4;
  const raw = Buffer.alloc(height * (rawStride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (rawStride + 1)] = 0;
    Buffer.from(rgbaBytes.buffer, rgbaBytes.byteOffset + y * rawStride, rawStride).copy(
      raw,
      y * (rawStride + 1) + 1
    );
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = COLOR_TYPE_RGBA;
  header[10] = 0; // compression: deflate
  header[11] = 0; // filter method: adaptive
  header[12] = 0; // interlace: none

  return Buffer.concat([
    PNG_SIGNATURE,
    buildChunk('IHDR', header),
    buildChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    buildChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Splits a PNG into its chunks without decoding pixels. CRCs are verified so a truncated or
// half-written screenshot fails here instead of producing plausible-looking wrong numbers.
export function readChunks(buffer) {
  const chunks = [];
  let offset = 8;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const storedCrc = buffer.readUInt32BE(offset + 8 + length);

    const actualCrc = crc32(buffer.subarray(offset + 4, offset + 8 + length));
    if (actualCrc !== storedCrc) {
      throw new Error(`PNG chunk ${type} failed its CRC check — the file is corrupt or truncated.`);
    }

    chunks.push({ type, data });
    offset += 12 + length;
    if (type === 'IEND') break;
  }

  return chunks;
}

// Rewrites a PNG with provenance-bearing ancillary chunks removed. Pixel data is untouched,
// so this is lossless: no re-encode, no chance of changing what the critic measures.
export function stripProvenanceChunks(buffer) {
  const chunks = readChunks(buffer);
  const kept = chunks.filter((chunk) => !PROVENANCE_CHUNKS.has(chunk.type));
  const removed = chunks.length - kept.length;

  const rebuilt = Buffer.concat([
    PNG_SIGNATURE,
    ...kept.map((chunk) => buildChunk(chunk.type, chunk.data)),
  ]);

  return { buffer: rebuilt, removedChunkCount: removed };
}

// --- helpers ------------------------------------------------------------------------------

function buildChunk(type, data) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 'ascii');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

// Undoes the five PNG scanline filters in place, returning the filtered-out raw bytes with the
// per-scanline filter bytes removed.
function unfilterScanlines(raw, width, height, bitDepth, samplesPerPixel) {
  const bitsPerPixel = bitDepth * samplesPerPixel;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const pixelStep = Math.max(1, Math.ceil(bitsPerPixel / 8));

  const expected = height * (stride + 1);
  if (raw.length < expected) {
    throw new Error(`PNG pixel data is short: expected ${expected} bytes, got ${raw.length}.`);
  }

  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y += 1) {
    const filterType = raw[y * (stride + 1)];
    const sourceStart = y * (stride + 1) + 1;
    const rowStart = y * stride;
    const priorStart = rowStart - stride;

    for (let x = 0; x < stride; x += 1) {
      const rawByte = raw[sourceStart + x];
      const left = x >= pixelStep ? out[rowStart + x - pixelStep] : 0;
      const up = y > 0 ? out[priorStart + x] : 0;
      const upLeft = y > 0 && x >= pixelStep ? out[priorStart + x - pixelStep] : 0;

      let value;
      if (filterType === 0) value = rawByte;
      else if (filterType === 1) value = rawByte + left;
      else if (filterType === 2) value = rawByte + up;
      else if (filterType === 3) value = rawByte + ((left + up) >> 1);
      else if (filterType === 4) value = rawByte + paethPredictor(left, up, upLeft);
      else throw new Error(`Unknown PNG filter type ${filterType} on scanline ${y}.`);

      out[rowStart + x] = value & 0xff;
    }
  }

  return { bytes: out, stride };
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const distLeft = Math.abs(estimate - left);
  const distUp = Math.abs(estimate - up);
  const distUpLeft = Math.abs(estimate - upLeft);

  if (distLeft <= distUp && distLeft <= distUpLeft) return left;
  if (distUp <= distUpLeft) return up;
  return upLeft;
}

// Widens whatever the file stored — sub-byte greys, palette indices, 16-bit samples — into a
// uniform normalised RGBA float buffer.
function expandToRgba({ scanlines, width, height, bitDepth, colorType, samplesPerPixel, palette }) {
  const pixels = new Float32Array(width * height * 4);
  const maxValue = (1 << bitDepth) - 1;

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * scanlines.stride;
    const readSample = makeSampleReader(scanlines.bytes, rowStart, bitDepth);

    for (let x = 0; x < width; x += 1) {
      const base = (y * width + x) * 4;
      const first = x * samplesPerPixel;

      if (colorType === COLOR_TYPE_GREY) {
        const grey = readSample(first) / maxValue;
        pixels[base] = grey;
        pixels[base + 1] = grey;
        pixels[base + 2] = grey;
        pixels[base + 3] = 1;
      } else if (colorType === COLOR_TYPE_GREY_ALPHA) {
        const grey = readSample(first) / maxValue;
        pixels[base] = grey;
        pixels[base + 1] = grey;
        pixels[base + 2] = grey;
        pixels[base + 3] = readSample(first + 1) / maxValue;
      } else if (colorType === COLOR_TYPE_RGB) {
        pixels[base] = readSample(first) / maxValue;
        pixels[base + 1] = readSample(first + 1) / maxValue;
        pixels[base + 2] = readSample(first + 2) / maxValue;
        pixels[base + 3] = 1;
      } else if (colorType === COLOR_TYPE_RGBA) {
        pixels[base] = readSample(first) / maxValue;
        pixels[base + 1] = readSample(first + 1) / maxValue;
        pixels[base + 2] = readSample(first + 2) / maxValue;
        pixels[base + 3] = readSample(first + 3) / maxValue;
      } else {
        const index = readSample(first) * 3;
        pixels[base] = palette[index] / 255;
        pixels[base + 1] = palette[index + 1] / 255;
        pixels[base + 2] = palette[index + 2] / 255;
        pixels[base + 3] = 1;
      }
    }
  }

  return pixels;
}

// Returns a reader for one scanline that hides the difference between packed sub-byte samples,
// plain bytes, and big-endian 16-bit words.
function makeSampleReader(bytes, rowStart, bitDepth) {
  if (bitDepth === 8) {
    return (sampleIndex) => bytes[rowStart + sampleIndex];
  }
  if (bitDepth === 16) {
    return (sampleIndex) => bytes.readUInt16BE(rowStart + sampleIndex * 2);
  }

  const samplesPerByte = 8 / bitDepth;
  const mask = (1 << bitDepth) - 1;
  return (sampleIndex) => {
    const byte = bytes[rowStart + Math.floor(sampleIndex / samplesPerByte)];
    const shift = 8 - bitDepth * ((sampleIndex % samplesPerByte) + 1);
    return (byte >> shift) & mask;
  };
}

function buildCrcTable() {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
