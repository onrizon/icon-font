import opentype, { type BoundingBox } from 'opentype.js';
import { SVGPathData, encodeSVGPath } from 'svg-pathdata';
import { isWoff2, decompressWoff2 } from '@/lib/font-generation/woff2';

export interface ParsedGlyph {
  name: string;
  unicode: number;
  svgContent: string;
  pathData: string;
  viewBox: string;
  width: number;
  height: number;
}

export interface ParsedFontFile {
  fontName: string;
  fontFamily: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  glyphs: ParsedGlyph[];
}

function glyphNameToIconName(glyph: { name: string; unicode: number }): string {
  const name = glyph.name;

  // Skip generic names — derive from unicode instead
  if (!name || name === '.notdef' || name === '.null' || /^uni[0-9A-F]{4,}$/i.test(name) || /^glyph\d+$/.test(name)) {
    if (glyph.unicode) {
      return `u${glyph.unicode.toString(16).padStart(4, '0').toUpperCase()}`;
    }
    return `glyph-${Math.random().toString(36).slice(2, 8)}`;
  }

  // Clean the name: lowercase, replace non-alphanumeric with hyphens
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computePathBounds(commands: Array<Record<string, unknown>>): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let curX = 0, curY = 0;

  for (const cmd of commands) {
    // Include control points in bounds
    if (typeof cmd.x1 === 'number' && typeof cmd.y1 === 'number') {
      minX = Math.min(minX, cmd.x1); maxX = Math.max(maxX, cmd.x1);
      minY = Math.min(minY, cmd.y1); maxY = Math.max(maxY, cmd.y1);
    }
    if (typeof cmd.x2 === 'number' && typeof cmd.y2 === 'number') {
      minX = Math.min(minX, cmd.x2); maxX = Math.max(maxX, cmd.x2);
      minY = Math.min(minY, cmd.y2); maxY = Math.max(maxY, cmd.y2);
    }
    // Track current position (handles H/V line commands that only set one axis)
    if (typeof cmd.x === 'number') curX = cmd.x;
    if (typeof cmd.y === 'number') curY = cmd.y;
    // Update bounds with endpoint
    if (typeof cmd.x === 'number' || typeof cmd.y === 'number') {
      minX = Math.min(minX, curX); maxX = Math.max(maxX, curX);
      minY = Math.min(minY, curY); maxY = Math.max(maxY, curY);
    }
  }

  return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/**
 * Reverse the font coordinate transform and fit the path into a centered square viewBox.
 * Font coords use Y-up; SVG uses Y-down. This undoes:
 *   Forward: scale(s,s) → translate(0,-ascender) → scale(1,-1)
 */
function reverseTransformAndFit(
  rawPathData: string,
  ascender: number,
  scale: number,
  glyphBBox?: BoundingBox,
): { pathData: string; viewBox: string; width: number; height: number; svgContent: string } | null {
  try {
    const reversed = new SVGPathData(rawPathData)
      .toAbs()
      .scale(1, -1)
      .translate(0, ascender)
      .scale(1 / scale, 1 / scale);

    // Prefer the glyph's own bounding box (exact bezier extremes) over the
    // control-point approximation. Control points can extend outside the actual
    // curve, so computePathBounds over-estimates bounds for complex glyphs
    // (e.g. Discord), making the icon appear smaller after regeneration.
    let bounds: Bounds | null;
    if (glyphBBox) {
      // Transform font-space bbox (Y-up) to SVG space (Y-down) with scale applied
      bounds = {
        minX: glyphBBox.x1 / scale,
        maxX: glyphBBox.x2 / scale,
        minY: ascender - glyphBBox.y2 / scale,
        maxY: ascender - glyphBBox.y1 / scale,
      };
    } else {
      bounds = computePathBounds(reversed.commands as Array<Record<string, unknown>>);
    }
    if (!bounds) return null;

    const contentW = bounds.maxX - bounds.minX;
    const contentH = bounds.maxY - bounds.minY;
    const contentSize = Math.max(contentW, contentH, 1);
    const vbSize = Math.round(contentSize);

    // Translate so content is centered in a 0-origin square viewBox
    const offsetX = (vbSize - contentW) / 2 - bounds.minX;
    const offsetY = (vbSize - contentH) / 2 - bounds.minY;

    const centered = reversed.translate(offsetX, offsetY);
    const pathData = encodeSVGPath(centered.commands);
    if (!pathData?.trim()) return null;

    const viewBox = `0 0 ${vbSize} ${vbSize}`;
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${pathData}"/></svg>`;

    return { pathData, viewBox, width: vbSize, height: vbSize, svgContent };
  } catch (e) {
    console.warn('[font-import] reverseTransformAndFit threw:', e);
    return null;
  }
}

function parseBinaryFont(buffer: ArrayBuffer): ParsedFontFile {
  const font = opentype.parse(buffer);

  const fontFamily = font.familyName || 'imported-font';
  const { unitsPerEm, ascender, descender } = font;
  // Use scale=1: treat font units directly. The forward transform in svg-to-glyph.ts
  // uses unitsPerEm/viewBoxSize, but for externally-created fonts that scale is unknown.
  // scale=1 means reverseTransformAndFit only applies the Y-flip (scale(1,-1) + translate(0,ascender)),
  // which is correct for any font regardless of origin.
  const scale = 1;
  const glyphs: ParsedGlyph[] = [];

  for (let i = 0; i < font.glyphs.length; i++) {
    const glyph = font.glyphs.get(i);
    if (!glyph || glyph.name === '.notdef') continue;

    const unicode = glyph.unicodes?.[0] ?? glyph.unicode;
    if (!unicode || unicode === 0) continue;

    const rawPathData = glyph.path.toPathData(2);
    if (!rawPathData?.trim()) {
      console.warn(`[font-import] Skipping U+${unicode.toString(16).toUpperCase()} "${glyph.name}" — no path data`);
      continue;
    }

    const result = reverseTransformAndFit(rawPathData, ascender, scale, glyph.path.getBoundingBox());
    if (!result) {
      console.warn(`[font-import] Skipping U+${unicode.toString(16).toUpperCase()} "${glyph.name}" — transform failed`);
      continue;
    }

    const name = glyphNameToIconName({ name: glyph.name, unicode });
    glyphs.push({ name, unicode, ...result });
  }

  return {
    fontName: fontFamily.toLowerCase().replace(/\s+/g, '-'),
    fontFamily,
    unitsPerEm,
    ascender,
    descender,
    glyphs,
  };
}

function parseSvgFont(text: string): ParsedFontFile {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'image/svg+xml');

  const fontFace = doc.querySelector('font-face');
  if (!fontFace) {
    throw new Error('Not an SVG font file (no <font-face> element). To import individual SVG icons, use the SVG dropzone instead.');
  }

  const fontEl = doc.querySelector('font');
  const fontFamily = fontFace.getAttribute('font-family') || fontEl?.getAttribute('id') || 'svg-font';
  const unitsPerEm = parseInt(fontFace.getAttribute('units-per-em') || '1000', 10);
  const ascender = parseInt(fontFace.getAttribute('ascent') || String(unitsPerEm), 10);
  const descender = parseInt(fontFace.getAttribute('descent') || '0', 10);
  const scale = 1;

  const glyphEls = doc.querySelectorAll('glyph');
  const glyphs: ParsedGlyph[] = [];

  for (const glyphEl of glyphEls) {
    const d = glyphEl.getAttribute('d');
    if (!d?.trim()) continue;

    const unicodeAttr = glyphEl.getAttribute('unicode');
    if (!unicodeAttr) continue;

    // Get first codepoint; skip ligatures (multi-character entries)
    const codePoint = unicodeAttr.codePointAt(0);
    if (!codePoint) continue;
    const charLen = codePoint > 0xFFFF ? 2 : 1;
    if (unicodeAttr.length > charLen) continue;

    const glyphName = glyphEl.getAttribute('glyph-name') || '';

    // SVG fonts use Y-up coordinate system, same reverse transform as TTF
    const result = reverseTransformAndFit(d, ascender, scale);
    if (!result) {
      console.warn(`[font-import] Skipping U+${codePoint.toString(16).toUpperCase()} "${glyphName}" — transform failed`);
      continue;
    }

    const name = glyphNameToIconName({ name: glyphName, unicode: codePoint });
    glyphs.push({ name, unicode: codePoint, ...result });
  }

  return {
    fontName: fontFamily.toLowerCase().replace(/\s+/g, '-'),
    fontFamily,
    unitsPerEm,
    ascender,
    descender,
    glyphs,
  };
}

export async function parseFontFile(buffer: ArrayBuffer): Promise<ParsedFontFile> {
  // Detect WOFF2 by magic bytes (wOF2) and decompress to TTF first
  if (isWoff2(buffer)) {
    buffer = await decompressWoff2(buffer);
  }

  // Detect SVG font by checking for '<' after any leading whitespace/BOM
  const header = new TextDecoder().decode(buffer.slice(0, 200));
  if (header.trimStart().startsWith('<')) {
    const text = new TextDecoder().decode(buffer);
    return parseSvgFont(text);
  }
  return parseBinaryFont(buffer);
}
