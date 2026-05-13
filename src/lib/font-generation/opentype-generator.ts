import { Font } from 'fonteditor-core';
import type { IconGlyph, Project } from '@/types';
import { allocateCodepoints } from './codepoint-allocator';
import { buildSvgFont } from './svg-font-builder';
import { encodeGaspTable } from './gasp';

export interface GeneratedFontData {
  ttfBuffer: ArrayBuffer;
  codepointMap: Map<string, number>;
}

/**
 * Generate a real TrueType font (glyf/loca outlines + gasp smoothing table)
 * from a list of icons. The font is produced by:
 *
 *  1. Allocating PUA codepoints for icons that don't already have one.
 *  2. Building an SVG-font XML document with each `<glyph>` carrying the
 *     Y-flipped, scaled path data.
 *  3. Parsing it through fonteditor-core, which converts SVG cubic Béziers
 *     into TrueType-compatible quadratic contours.
 *  4. Patching the TTFObject's `name` records and attaching a raw `gasp`
 *     table (visible to fonteditor-core's writer when `hinting: true`).
 *  5. Writing as `.ttf`, which goes through `glyf` / `loca` writers.
 *
 * Note: opentype.js is still used for *parsing* imported fonts in
 * src/lib/font-parsing/font-file-parser.ts. Do not uninstall it.
 */
export function generateFont(
  icons: IconGlyph[],
  project: Project
): GeneratedFontData {
  const codepointMap = allocateCodepoints(icons);

  const svgFont = buildSvgFont(icons, project, codepointMap);
  const font = Font.create(svgFont, { type: 'svg' });
  const ttf = font.get();

  // Name records. Cast through `unknown` because the TTFObject's `name`
  // declared type is structured; the SVG parser produces a partial map.
  type NameRecords = Record<string, string>;
  const existingName =
    (ttf as unknown as { name?: NameRecords }).name ?? {};
  (ttf as unknown as { name: NameRecords }).name = {
    ...existingName,
    fontFamily: project.fontFamily,
    fontSubFamily: 'Regular',
    fullName: project.fontFamily,
    postScriptName: project.fontFamily,
    version: 'Version 1.0',
  };

  // Attach raw gasp bytes. fonteditor-core's writer (ttfwriter.js prepareDump)
  // copies these verbatim when invoked with `hinting: true`.
  (ttf as unknown as { gasp: Uint8Array }).gasp = encodeGaspTable();

  font.set(ttf);

  const ttfBuffer = font.write({
    type: 'ttf',
    hinting: true,
    toBuffer: false,
  }) as ArrayBuffer;

  return { ttfBuffer, codepointMap };
}
