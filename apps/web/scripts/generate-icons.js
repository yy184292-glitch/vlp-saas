#!/usr/bin/env node
/**
 * PWA アイコン生成スクリプト（純Node.js・外部依存なし）
 * 使い方: node scripts/generate-icons.js
 *
 * canvas パッケージが不要な最小実装。
 * テキスト付きアイコンが必要な場合は canvas パッケージを使用してください:
 *   npm install --save-dev canvas
 */

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// CRC32 テーブル生成
function makeCrcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
const CRC_TABLE = makeCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeB = Buffer.from(type, "ascii");
  const lenB = Buffer.alloc(4);
  lenB.writeUInt32BE(data.length);
  const crcIn = Buffer.concat([typeB, data]);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(crcIn));
  return Buffer.concat([lenB, typeB, data, crcB]);
}

/**
 * 指定サイズ・色のソリッドカラー PNG を生成する
 * VLP ロゴ風: 背景 #1a1a1a に中央に明るい正方形アクセント
 */
function generatePNG(size) {
  const bgR = 26, bgG = 26, bgB = 26;       // #1a1a1a
  const acR = 59, acG = 130, acB = 246;     // #3b82f6 (blue accent)
  const acR2 = 96, acG2 = 165, acB2 = 250;  // lighter blue

  // アクセント領域: 中央 60% の正方形
  const pad = Math.floor(size * 0.2);
  const inner = size - pad * 2;

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB

  // Raw pixel data (filter byte per row + RGB per pixel)
  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize);

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const px = y * rowSize + 1 + x * 3;
      const inAccent =
        x >= pad && x < pad + inner && y >= pad && y < pad + inner;

      if (inAccent) {
        // グラデーション風: 上部 acR、下部 acR2
        const t = (y - pad) / inner;
        raw[px]     = Math.round(acR  + (acR2  - acR)  * t);
        raw[px + 1] = Math.round(acG  + (acG2  - acG)  * t);
        raw[px + 2] = Math.round(acB  + (acB2  - acB)  * t);
      } else {
        raw[px]     = bgR;
        raw[px + 1] = bgG;
        raw[px + 2] = bgB;
      }
    }
  }

  const idat = zlib.deflateSync(raw);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", iend),
  ]);
}

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT_DIR = path.join(__dirname, "../public/icons");

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const buf = generatePNG(size);
  const outPath = path.join(OUT_DIR, `icon-${size}x${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`Generated: ${outPath} (${buf.length} bytes)`);
}

console.log("Done! All PWA icons generated.");
