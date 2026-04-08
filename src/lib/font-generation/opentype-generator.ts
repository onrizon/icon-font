import opentype, { type Font, type Glyph } from 'opentype.js';
import type { IconGlyph, Project } from '@/types';
import { svgPathToGlyphPath } from './svg-to-glyph';
import { allocateCodepoints } from './codepoint-allocator';

export interface GeneratedFontData {
  font: Font;
  ttfBuffer: ArrayBuffer;
  codepointMap: Map<string, number>;
}

export function generateFont(
  icons: IconGlyph[],
  project: Project
): GeneratedFontData {
  const codepointMap = allocateCodepoints(icons);
  const { unitsPerEm, ascender, descender, fontFamily } = project;

  // Create the .notdef glyph (required)
  const notdefPath = new opentype.Path();
  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: unitsPerEm,
    path: notdefPath,
  });

  // Create glyphs from icons
  const glyphs: Glyph[] = [notdefGlyph];

  for (const icon of icons) {
    const unicode = codepointMap.get(icon.id);
    if (unicode === undefined) continue;

    const glyphPath = svgPathToGlyphPath(
      icon.pathData,
      icon.viewBox,
      unitsPerEm,
      ascender
    );

    const glyph = new opentype.Glyph({
      name: icon.name,
      unicode,
      advanceWidth: unitsPerEm,
      path: glyphPath,
    });

    glyphs.push(glyph);
  }

  const font = new opentype.Font({
    familyName: fontFamily,
    styleName: 'Regular',
    unitsPerEm,
    ascender,
    descender,
    glyphs,
  });

  const ttfBuffer = font.toArrayBuffer();

  return {
    font,
    ttfBuffer,
    codepointMap,
  };
}
