// Post-processing pass over the TTF buffer produced by fonteditor-core.
//
// fonteditor-core's OS/2 writer (lib/ttf/table/OS2.js, line ~169) hard-codes
// `ttf['OS/2'].version = 0x4` during its size-computation pass, overriding
// whatever we set on the TTFObject. We patch the output bytes after the
// write to bring the field to icomoon's value (3), then recompute the OS/2
// table checksum and the global `head.checkSumAdjustment` so the font
// remains structurally valid.
//
// References: OpenType spec — Font File Format / Tables / head / OS/2.

/**
 * Force `OS/2.version` to a target value (e.g., 3 to match icomoon) and
 * recompute affected checksums. Returns the same ArrayBuffer (mutated).
 */
export function forceOs2Version(buffer: ArrayBuffer, version: number): ArrayBuffer {
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  if (u8.length < 12) return buffer;

  const numTables = dv.getUint16(4, false);
  let os2Off = -1;
  let os2Len = -1;
  let os2DirRecOff = -1;
  let headOff = -1;

  for (let i = 0; i < numTables; i++) {
    const recOff = 12 + i * 16;
    const tag = String.fromCharCode(u8[recOff], u8[recOff + 1], u8[recOff + 2], u8[recOff + 3]);
    const tableOff = dv.getUint32(recOff + 8, false);
    const tableLen = dv.getUint32(recOff + 12, false);
    if (tag === 'OS/2') {
      os2Off = tableOff;
      os2Len = tableLen;
      os2DirRecOff = recOff;
    } else if (tag === 'head') {
      headOff = tableOff;
    }
  }

  if (os2Off === -1 || headOff === -1) return buffer;

  // Patch version (uint16 at offset 0 of OS/2 table).
  dv.setUint16(os2Off, version, false);

  // Recompute OS/2 checksum: sum of 32-bit big-endian words, treating any
  // trailing bytes as if zero-padded to the next 4-byte boundary.
  dv.setUint32(os2DirRecOff + 4, sumAsUint32(u8, os2Off, os2Len), false);

  // Recompute head.checkSumAdjustment.
  //  - Zero out checkSumAdjustment first (head + 8) so it doesn't pollute
  //    the running sum.
  dv.setUint32(headOff + 8, 0, false);
  //  - Sum the *entire* file as uint32 big-endian words.
  const fileSum = sumAsUint32(u8, 0, u8.length);
  //  - Adjustment = 0xB1B0AFBA - fileSum (mod 2^32).
  const adjustment = ((0xb1b0afba - fileSum) >>> 0);
  dv.setUint32(headOff + 8, adjustment, false);

  return buffer;
}

/**
 * Sum bytes as big-endian 32-bit words, mod 2^32. Trailing bytes that don't
 * fill a complete 4-byte word are treated as zero-padded to the right.
 */
function sumAsUint32(u8: Uint8Array, offset: number, length: number): number {
  let sum = 0;
  const end = offset + length;
  for (let i = offset; i < end; i += 4) {
    const b0 = i < end ? u8[i] : 0;
    const b1 = i + 1 < end ? u8[i + 1] : 0;
    const b2 = i + 2 < end ? u8[i + 2] : 0;
    const b3 = i + 3 < end ? u8[i + 3] : 0;
    const word = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    sum = (sum + word) >>> 0;
  }
  return sum;
}
