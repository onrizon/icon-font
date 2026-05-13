import { SVGPathData, SVGPathDataTransformer, encodeSVGPath } from 'svg-pathdata';
import type { IconGlyph, Project } from '@/types';

// SVG-font glyph paths use the *font* coordinate system (Y-up), the same one
// TrueType / OpenType use internally. This is the same Y-flip + scale +
// translate transform applied by the previous opentype.js-based generator in
// svg-to-glyph.ts — kept here so the produced glyphs are geometrically
// identical to the prior CFF output.
function transformPathForFont(
  pathData: string,
  viewBox: string,
  unitsPerEm: number,
  ascender: number
): string {
  if (!pathData || !pathData.trim()) return '';
  const [, , vbWidth, vbHeight] = viewBox.split(/[\s,]+/).map(Number);
  const size = Math.max(vbWidth || 1024, vbHeight || 1024);
  const scale = unitsPerEm / size;

  try {
    const normalized = new SVGPathData(pathData)
      .toAbs()
      .transform(SVGPathDataTransformer.NORMALIZE_ST())
      .transform(SVGPathDataTransformer.NORMALIZE_HVZ())
      .transform(SVGPathDataTransformer.A_TO_C());

    const transformed = normalized
      .scale(scale, scale)
      .translate(0, -ascender)
      .scale(1, -1);

    return encodeSVGPath(transformed.commands);
  } catch (e) {
    console.warn('transformPathForFont failed:', e);
    return '';
  }
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build an SVG-font XML document from icons + project + codepoint allocation.
 * Designed to be parsed by fonteditor-core's `Font.create(svg, { type: 'svg' })`,
 * which translates each `<glyph d="...">` into a TrueType-compatible contour
 * (handling cubic-to-quadratic Bézier conversion internally).
 */
export function buildSvgFont(
  icons: IconGlyph[],
  project: Project,
  codepointMap: Map<string, number>
): string {
  const { fontFamily, unitsPerEm, ascender, descender } = project;

  const glyphElements = icons
    .map(icon => {
      const cp = codepointMap.get(icon.id);
      if (cp === undefined) return null;
      const d = transformPathForFont(icon.pathData, icon.viewBox, unitsPerEm, ascender);
      if (!d) return null;
      const hex = cp.toString(16).padStart(4, '0').toUpperCase();
      return `  <glyph glyph-name="${escapeAttr(icon.name)}" unicode="&#x${hex};" horiz-adv-x="${unitsPerEm}" d="${escapeAttr(d)}"/>`;
    })
    .filter((line): line is string => line !== null)
    .join('\n');

  // Note: SVG-font `descent` is conventionally the absolute value of the
  // descender, while our Project stores a non-negative `descender` already.
  // Re-checked: opentype's convention has `descender` <= 0; fonteditor-core
  // accepts both forms but SVG-font spec wants `descent` as a positive number.
  // Project.descender in this app is non-negative (default 0), so pass it
  // through unchanged.
  return `<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg">
<defs>
<font id="${escapeAttr(fontFamily)}" horiz-adv-x="${unitsPerEm}">
  <font-face font-family="${escapeAttr(fontFamily)}" units-per-em="${unitsPerEm}" ascent="${ascender}" descent="${descender}" />
  <missing-glyph horiz-adv-x="${Math.round(unitsPerEm / 2)}"/>
${glyphElements}
</font>
</defs>
</svg>`;
}
