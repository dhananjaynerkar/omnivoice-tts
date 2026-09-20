import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal PNG generator in pure Node.js using zlib
function createSpeakerPNG(size) {
  const width = size;
  const height = size;
  // RGBA buffer: (width * 4 + 1 filter byte) * height
  const rowBytes = width * 4;
  const rawData = Buffer.alloc((rowBytes + 1) * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowBytes + 1);
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background rounded circle (Electric Blue: #0284c7)
      if (dist <= radius) {
        // Speaker body coordinates
        const nx = (x - cx) / radius; // -1 to 1
        const ny = (y - cy) / radius; // -1 to 1

        let isSpeaker = false;
        // Speaker cone
        if (nx >= -0.5 && nx <= -0.15 && Math.abs(ny) <= 0.22) {
          isSpeaker = true;
        } else if (nx > -0.15 && nx <= 0.25 && Math.abs(ny) <= (nx + 0.15) * 0.9 + 0.22) {
          isSpeaker = true;
        }

        // Sound waves
        const waveDist = Math.sqrt((nx - 0.1) * (nx - 0.1) + ny * ny);
        if (nx > 0.2 && Math.abs(ny) <= 0.5) {
          if ((waveDist >= 0.45 && waveDist <= 0.55) || (waveDist >= 0.7 && waveDist <= 0.82)) {
            isSpeaker = true;
          }
        }

        if (isSpeaker) {
          // White symbol
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          // Blue background (#0284c7)
          rawData[pxOffset] = 2;
          rawData[pxOffset + 1] = 132;
          rawData[pxOffset + 2] = 199;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression: Deflate
  ihdr[11] = 0; // Filter: Adaptive
  ihdr[12] = 0; // Interlace: None
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT Chunk
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const assetsDir = path.resolve(__dirname, '../extension/assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

[16, 32, 48, 128].forEach((size) => {
  const png = createSpeakerPNG(size);
  fs.writeFileSync(path.join(assetsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png`);
});
