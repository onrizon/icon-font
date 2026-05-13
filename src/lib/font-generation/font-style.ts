// Icomoon-style vertical-metric preset.
//
// The reference at src/components/fonts/icomoon.ttf uses
//   ascender   = 960   (15/16 of unitsPerEm)
//   descender  = -64   (-1/16)
//   lineGap    = 0
//   typoLineGap = 64   (1/16, = -descender)
//   winAscent  = ascender
//   winDescent = -descender
// at unitsPerEm = 1024. We express the preset as ratios so it stays correct
// if Project.unitsPerEm ever changes from 1024.
//
// This module is the single source of truth for the icomoon vertical-metric
// profile. Both `opentype-generator.ts` (which writes hhea/OS/2/glyf[0]) and
// `svg-font-builder.ts` (which uses `ascender` for the SVG-font <font-face>
// element and for the Y-flip transform on glyph paths) read from here.

export interface IcomoonStyleMetrics {
  /** TrueType ascender — top of em box minus a small gap. */
  ascender: number;
  /** TrueType descender — negative; the strip below the baseline. */
  descender: number;
  /** OS/2 sTypoLineGap. */
  typoLineGap: number;
  /** OS/2 usWinAscent. */
  winAscent: number;
  /** OS/2 usWinDescent (positive). */
  winDescent: number;
}

export function icomoonStyleMetrics(unitsPerEm: number): IcomoonStyleMetrics {
  const ascender = Math.round((unitsPerEm * 15) / 16);
  const descender = -Math.round(unitsPerEm / 16);
  return {
    ascender,
    descender,
    typoLineGap: -descender,
    winAscent: ascender,
    winDescent: -descender,
  };
}
