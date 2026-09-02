// Makes the 2x TNT block texture out of Mojang's own TNT texture.
//
//   npm run textures
//
// Vanilla's tnt_side.png is a red crate with a pale label band across the
// middle reading "TNT" in dark blue. We rub out those letters and paint "2x"
// in the same ink, so the block still looks like TNT at a glance — which is
// the point: you should be able to tell it's TNT, and that it's the double one.
//
// The originals in tools/vanilla-textures/ are never modified.
// The PNG reading and writing is lifted from leo-mod-01, so this project needs
// no image libraries either.

import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const SOURCE = "tools/vanilla-textures/tnt_side.png";
const OUTPUT = "resource_pack/textures/blocks/tnt_2x_side.png";

// The label band and its lettering, measured from the vanilla texture.
const INK = [0x37, 0x36, 0x56]; // the blue the letters are drawn in
const INK_SHADOW = [0x1b, 0x1a, 0x3c]; // the darker blue under them
const BAND_TOP = 5;
const BAND_BOTTOM = 10;

// "2x", drawn to sit on the same rows the vanilla letters use. A dot is the
// label's own colour showing through; a hash is ink. Change these to change
// what the block says.
const GLYPHS = ["###....", "..#.#.#", ".#...#.", "###.#.#"];
// ─────────────────────────────────────────────────────────── PNG reading ────
function decodePng(buffer) {
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!SIGNATURE.every((byte, i) => buffer[i] === byte)) {
    throw new Error("not a PNG file");
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette = null;
  let paletteAlpha = null;
  const dataChunks = [];

  for (let pos = 8; pos < buffer.length; ) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    const body = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
    } else if (type === "PLTE") {
      palette = body;
    } else if (type === "tRNS") {
      paletteAlpha = body;
    } else if (type === "IDAT") {
      dataChunks.push(body);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length; // length + type + body + crc
  }

  // Mojang's textures are a mix: some are full RGBA, others are palettes as
  // narrow as 4 bits per pixel (the pig). Handle the lot, except 16-bit
  // samples, which Minecraft textures never use.
  const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = CHANNELS[colorType];
  if (channels === undefined)
    throw new Error(`bad PNG colour type ${colorType}`);
  if (bitDepth === 16) throw new Error("16-bit PNGs are not supported");
  if (colorType === 3 && !palette) throw new Error("palette PNG has no PLTE");

  // Undo the per-scanline filters (PNG spec §9). Each row starts with a filter
  // byte, then the row's bytes, each predicted from its neighbours. Filters
  // work on whole bytes, and the "pixel" step is rounded up to at least one.
  const step = Math.max(1, Math.ceil((bitDepth * channels) / 8));
  const stride = Math.ceil((width * channels * bitDepth) / 8);
  const raw = inflateSync(Buffer.concat(dataChunks));
  const rows = Buffer.alloc(stride * height);

  for (let y = 0, read = 0; y < height; y++) {
    const filter = raw[read++];
    const row = raw.subarray(read, read + stride);
    read += stride;

    const current = rows.subarray(y * stride, (y + 1) * stride);
    const previous = y > 0 ? rows.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const left = x >= step ? current[x - step] : 0;
      const above = previous ? previous[x] : 0;
      const aboveLeft = previous && x >= step ? previous[x - step] : 0;

      let value = row[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += above;
      else if (filter === 3) value += (left + above) >> 1;
      else if (filter === 4) {
        // Paeth: pick whichever neighbour the gradient predicts best
        const estimate = left + above - aboveLeft;
        const dLeft = Math.abs(estimate - left);
        const dAbove = Math.abs(estimate - above);
        const dAboveLeft = Math.abs(estimate - aboveLeft);
        value +=
          dLeft <= dAbove && dLeft <= dAboveLeft
            ? left
            : dAbove <= dAboveLeft
              ? above
              : aboveLeft;
      } else if (filter !== 0) {
        throw new Error(`unknown PNG filter ${filter}`);
      }
      current[x] = value & 0xff;
    }
  }

  // Expand whatever we just unfiltered into plain RGBA.
  const pixels = Buffer.alloc(width * height * 4);
  const perByte = 8 / bitDepth; // samples packed into each byte, when < 8 bits
  const mask = (1 << bitDepth) - 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const to = (y * width + x) * 4;

      if (colorType === 3) {
        let index;
        if (bitDepth === 8) {
          index = rows[y * stride + x];
        } else {
          const byte = rows[y * stride + Math.floor(x / perByte)];
          const shift = 8 - bitDepth * ((x % perByte) + 1);
          index = (byte >> shift) & mask;
        }
        pixels[to] = palette[index * 3];
        pixels[to + 1] = palette[index * 3 + 1];
        pixels[to + 2] = palette[index * 3 + 2];
        pixels[to + 3] = paletteAlpha?.[index] ?? 255;
      } else {
        const from = y * stride + x * channels;
        if (colorType === 0) {
          pixels[to] = rows[from];
          pixels[to + 1] = rows[from];
          pixels[to + 2] = rows[from];
          pixels[to + 3] = 255;
        } else if (colorType === 4) {
          pixels[to] = rows[from];
          pixels[to + 1] = rows[from];
          pixels[to + 2] = rows[from];
          pixels[to + 3] = rows[from + 1];
        } else {
          pixels[to] = rows[from];
          pixels[to + 1] = rows[from + 1];
          pixels[to + 2] = rows[from + 2];
          pixels[to + 3] = colorType === 6 ? rows[from + 3] : 255;
        }
      }
    }
  }

  return { width, height, pixels };
}

// ─────────────────────────────────────────────────────────── PNG writing ────
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function encodePng({ width, height, pixels }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ────────────────────────────────────────────────────────────── drawing ────
const image = decodePng(readFileSync(SOURCE));
const { width, pixels } = image;
const at = (x, y) => (y * width + x) * 4;
const isInk = (i) =>
  [INK, INK_SHADOW].some(
    (c) =>
      pixels[i] === c[0] && pixels[i + 1] === c[1] && pixels[i + 2] === c[2],
  );

// Rub out the vanilla lettering. Each erased pixel takes the colour of the
// nearest plain label pixel in its own row, so the band keeps its shading
// instead of turning into a flat grey stripe.
let erased = 0;
for (let y = BAND_TOP; y <= BAND_BOTTOM; y++) {
  const plain = [];
  for (let x = 0; x < width; x++) if (!isInk(at(x, y))) plain.push(x);
  if (plain.length === 0) continue;

  for (let x = 0; x < width; x++) {
    const i = at(x, y);
    if (!isInk(i)) continue;
    const nearest = plain.reduce((a, b) =>
      Math.abs(b - x) < Math.abs(a - x) ? b : a,
    );
    const from = at(nearest, y);
    pixels[i] = pixels[from];
    pixels[i + 1] = pixels[from + 1];
    pixels[i + 2] = pixels[from + 2];
    erased++;
  }
}

// Paint the new label, centred on the band.
const glyphWidth = Math.max(...GLYPHS.map((row) => row.length));
const left = Math.floor((width - glyphWidth) / 2);
const top = BAND_TOP + 1;
let painted = 0;
GLYPHS.forEach((row, dy) => {
  [...row].forEach((cell, dx) => {
    if (cell !== "#") return;
    const i = at(left + dx, top + dy);
    // The bottom row of the label sits in shadow in the original, so ink there
    // uses the darker blue and the letters don't look pasted on.
    const ink = dy === GLYPHS.length - 1 ? INK_SHADOW : INK;
    [pixels[i], pixels[i + 1], pixels[i + 2]] = ink;
    painted++;
  });
});

writeFileSync(OUTPUT, encodePng(image));
console.log(
  `✅ ${OUTPUT} — erased ${erased}px of "TNT", painted ${painted}px of "2x"`,
);
