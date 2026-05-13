import { compress, decompress } from 'woff2-encoder';

// WOFF2 header layout (W3C TR/WOFF2). All fields big-endian.
//   0  signature           uint32  "wOF2"
//   4  flavor              uint32  sfnt flavor (0x00010000 = TTF)
//   8  length              uint32
//  12  numTables           uint16
//  14  reserved            uint16
//  16  totalSfntSize       uint32
//  20  totalCompressedSize uint32
//  24  majorVersion        uint16  ← we patch this
//  26  minorVersion        uint16  ← we patch this
//  28  metaOffset / etc.   ...
const WOFF2_MAJOR_VERSION_OFFSET = 24;
const WOFF2_MINOR_VERSION_OFFSET = 26;

export async function compressWoff2(ttfBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const result = await compress(new Uint8Array(ttfBuffer));
  const buffer = result.buffer as ArrayBuffer;

  // `woff2-encoder` writes majorVersion=1, minorVersion=0 into the WOFF2
  // header with no override option. Patch to 0/0 to match
  // src/components/fonts/icomoon.woff2. These bytes live in the fixed-layout
  // WOFF2 header (outside the Brotli payload), so no re-encoding or
  // checksum recomputation is required.
  if (buffer.byteLength >= WOFF2_MINOR_VERSION_OFFSET + 2) {
    const view = new DataView(buffer);
    view.setUint16(WOFF2_MAJOR_VERSION_OFFSET, 0, false);
    view.setUint16(WOFF2_MINOR_VERSION_OFFSET, 0, false);
  }

  return buffer;
}

export async function decompressWoff2(woff2Buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const result = await decompress(new Uint8Array(woff2Buffer));
  return result.buffer as ArrayBuffer;
}

/** Check if buffer starts with WOFF2 magic bytes (wOF2 = 0x774F4632) */
export function isWoff2(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const view = new DataView(buffer);
  return view.getUint32(0) === 0x774F4632;
}
