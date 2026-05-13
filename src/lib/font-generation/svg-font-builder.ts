import { SVGPathData, SVGPathDataTransformer, encodeSVGPath, type SVGCommand } from 'svg-pathdata';
import type { IconGlyph, Project } from '@/types';
import { icomoonStyleMetrics } from './font-style';

interface PathBBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/**
 * Tight bbox of an SVG path's normalized absolute commands. Includes endpoints
 * and Bézier control points (slightly over-estimates the visual extent in some
 * cases, but never under-estimates, so glyphs never clip).
 */
function computePathBBox(commands: SVGCommand[]): PathBBox | null {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  const visit = (x: number | undefined, y: number | undefined) => {
    if (typeof x !== 'number' || !Number.isFinite(x)) return;
    if (typeof y !== 'number' || !Number.isFinite(y)) return;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  };
  for (const cmd of commands) {
    const c = cmd as Partial<{ x: number; y: number; x1: number; y1: number; x2: number; y2: number }>;
    if ('x' in c) visit(c.x, c.y);
    if ('x1' in c) visit(c.x1, c.y1);
    if ('x2' in c) visit(c.x2, c.y2);
  }
  if (!Number.isFinite(xMin)) return null;
  return { xMin, yMin, xMax, yMax };
}

interface TransformedPath {
  /** The serialized SVG path-data string, in font (Y-up) coords. */
  d: string;
  /** Advance width for the glyph, derived from the content's aspect ratio. */
  advanceWidth: number;
}

/**
 * Transform an SVG icon's path into font-coord (Y-up) space, matching icomoon's
 * height-lock scaling convention.
 *
 * Why height-lock and not viewBox-based: most icon sources have padding inside
 * a square viewBox (e.g. a 100×30 logo inside a 100×100 viewBox after our
 * upstream `normalizeSvg`). Scaling by viewBox dimensions makes such logos
 * appear visually small. icomoon ignores viewBox padding and scales so the
 * path's actual *content* bbox fills the typo em height (ascender − descender).
 * Width then grows beyond the em for wide icons (e.g. YouTube wordmark).
 *
 * The returned `advanceWidth` is `contentWidth × scale`, so a 100×30 logo lands
 * at advance ≈ 3413 in a 1024-em font — matching icomoon glyphs like U+E902.
 */
function transformPathForFont(
  pathData: string,
  unitsPerEm: number,
  ascender: number,
  descender: number
): TransformedPath {
  if (!pathData || !pathData.trim()) return { d: '', advanceWidth: unitsPerEm };

  try {
    const normalized = new SVGPathData(pathData)
      .toAbs()
      .transform(SVGPathDataTransformer.NORMALIZE_ST())
      .transform(SVGPathDataTransformer.NORMALIZE_HVZ())
      .transform(SVGPathDataTransformer.A_TO_C());

    const bbox = computePathBBox(normalized.commands);
    if (!bbox || bbox.yMax === bbox.yMin) {
      return { d: '', advanceWidth: unitsPerEm };
    }

    const contentHeight = bbox.yMax - bbox.yMin;
    const contentWidth = bbox.xMax - bbox.xMin;
    // Height-lock: fill the typo em (ascender − descender), which equals
    // unitsPerEm under the icomoon profile (ascender + |descender| = upm).
    const typoEm = ascender - descender;
    const scale = typoEm / contentHeight;
    const advanceWidth = Math.round(contentWidth * scale);

    const transformed = normalized
      // 1) Anchor bbox top-left at (0, 0) so we know where it lands after scale.
      .translate(-bbox.xMin, -bbox.yMin)
      // 2) Scale by the height-lock factor.
      .scale(scale, scale)
      // 3) Y-flip via translate(0, -ascender) then scale(1, -1):
      //    SVG point (0, 0)            → font (0, ascender)
      //    SVG point (0, contentHeight) → font (0, descender)
      .translate(0, -ascender)
      .scale(1, -1);

    return { d: encodeSVGPath(transformed.commands), advanceWidth };
  } catch (e) {
    console.warn('transformPathForFont failed:', e);
    return { d: '', advanceWidth: unitsPerEm };
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
  const { fontFamily, unitsPerEm } = project;
  // Force icomoon-style metrics regardless of Project.ascender/descender.
  // Glyph paths are scaled so their *content bbox* fills the typo em height
  // (ascender − descender), matching icomoon's behavior.
  const style = icomoonStyleMetrics(unitsPerEm);

  const glyphElements = icons
    .map(icon => {
      const cp = codepointMap.get(icon.id);
      if (cp === undefined) return null;
      const { d, advanceWidth } = transformPathForFont(
        icon.pathData,
        unitsPerEm,
        style.ascender,
        style.descender
      );
      if (!d) return null;
      const hex = cp.toString(16).padStart(4, '0').toUpperCase();
      return `  <glyph glyph-name="${escapeAttr(icon.name)}" unicode="&#x${hex};" horiz-adv-x="${advanceWidth}" d="${escapeAttr(d)}"/>`;
    })
    .filter((line): line is string => line !== null)
    .join('\n');

  // SVG-font spec wants `descent` as a positive number; convert from our
  // signed `descender`.
  return `<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg">
<defs>
<font id="${escapeAttr(fontFamily)}" horiz-adv-x="${unitsPerEm}">
  <font-face font-family="${escapeAttr(fontFamily)}" units-per-em="${unitsPerEm}" ascent="${style.ascender}" descent="${-style.descender}" />
  <missing-glyph horiz-adv-x="${Math.round(unitsPerEm / 2)}"/>
${glyphElements}
</font>
</defs>
</svg>`;
}
