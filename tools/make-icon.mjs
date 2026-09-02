// Generates pack/pack_icon.png (128x128) — a pixel-art star.
// Hand-builds a minimal PNG with zlib so we need zero image dependencies.

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// 16x16 pixel art, scaled up 8x to 128x128.
// . = grass green background, W = white body, Y = yellow beak,
// R = red wattle/comb, B = black eye, O = orange legs
const ART = [
  "................",
  ".......YY.......",
  ".......YY.......",
  "......YYYY......",
  "..YYYYYYYYYYYY..",
  "...YYYYYYYYYY...",
  "....YYYYYYYY....",
  ".....YYYYYY.....",
  "....YYYYYYYY....",
  "...YYYY..YYYY...",
  "..YYY......YYY..",
  ".YY..........YY.",
  "................",
  "................",
  "................",
  "................",
];

const COLORS = {
  ".": [40, 60, 120],
  W: [245, 245, 240],
  Y: [250, 215, 90],
  R: [215, 60, 50],
  B: [30, 30, 30],
  O: [230, 150, 40],
};

const SCALE = 8;
const SIZE = 16 * SCALE;

// Build raw image data: each row starts with a filter byte (0), then RGB pixels
const raw = [];
for (let y = 0; y < SIZE; y++) {
  raw.push(0);
  for (let x = 0; x < SIZE; x++) {
    const ch = ART[Math.floor(y / SCALE)][Math.floor(x / SCALE)];
    raw.push(...COLORS[ch]);
  }
}

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

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); // width
ihdr.writeUInt32BE(SIZE, 4); // height
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: RGB

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(Buffer.from(raw))),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("pack/pack_icon.png", png);
console.log("✅ Wrote pack/pack_icon.png");
