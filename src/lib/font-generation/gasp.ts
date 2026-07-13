// gasp (Grid-fitting And Scan-conversion Procedure) table.
// Format reference:
//   https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6gasp.html
//
// fonteditor-core's lib/ttf/table/gasp.js writes `ttf.gasp` verbatim as raw
// bytes, so we hand-build the binary representation here. The writer only
// emits the table when `font.write({ type: 'ttf', hinting: true })` is used
// (see ttfwriter.js prepareDump — hinting branch).

const GASP_GRIDFIT = 0x0001;
const GASP_DOGRAY = 0x0002;
const GASP_SYMMETRIC_GRIDFIT = 0x0004;
const GASP_SYMMETRIC_SMOOTHING = 0x0008;

export interface GaspRange {
  rangeMaxPPEM: number;
  rangeGaspBehavior: number;
}

// Icomoon-style single range: aggressive smoothing + gridfit at *all* sizes.
// Matches src/components/fonts/icomoon.ttf byte-for-byte (gasp table = 8 bytes).
const DEFAULT_GASP_RANGES: GaspRange[] = [
  {
    rangeMaxPPEM: 0xffff,
    rangeGaspBehavior:
      GASP_DOGRAY | GASP_GRIDFIT | GASP_SYMMETRIC_GRIDFIT | GASP_SYMMETRIC_SMOOTHING,
  },
];

/**
 * Serialize a gasp table into raw big-endian bytes.
 *
 * Layout (per spec):
 *   uint16 version       (0 or 1; we write 1 — supports symmetric flags)
 *   uint16 numRanges
 *   numRanges × {
 *     uint16 rangeMaxPPEM
 *     uint16 rangeGaspBehavior
 *   }
 *
 * Total = 4 + 4 × N bytes.
 */
export function encodeGaspTable(ranges: GaspRange[] = DEFAULT_GASP_RANGES): Uint8Array {
  const bytes = new Uint8Array(4 + ranges.length * 4);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 1, false); // version = 1
  view.setUint16(2, ranges.length, false); // numRanges
  let offset = 4;
  for (const r of ranges) {
    view.setUint16(offset, r.rangeMaxPPEM, false);
    view.setUint16(offset + 2, r.rangeGaspBehavior, false);
    offset += 4;
  }
  return bytes;
}
