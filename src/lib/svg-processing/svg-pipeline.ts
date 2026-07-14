import { optimizeSvg } from './svg-optimizer';
import { parseSvg } from './svg-parser';
import { normalizeSvg } from './svg-normalizer';
import { recolorToCurrentColor } from './svg-recolor';
import { stripMasking } from './svg-strip-masking';

/**
 * Sanity ceiling for imported SVG files. Docs are metadata-only (artwork lives
 * in R2), so this only blocks absurd inputs that would hang the pipeline or
 * the font writer. Must stay below /api/upload-svg's MAX_SVG_BYTES.
 */
export const MAX_IMPORT_SVG_BYTES = 2 * 1024 * 1024;

export interface ProcessedSvg {
  /**
   * Raw SVG with fixed width/height and mask/clip machinery stripped off, paints
   * recolored to currentColor; stored as the icon's svgContent.
   */
  displaySvg: string;
  /** SVGO output; used by the import path for the R2 upload. */
  optimized: string;
  pathData: string;
  viewBox: string;
  width: number;
  height: number;
}

/**
 * Normalize an SVG string into the app's display form while preserving its structure:
 * strip fixed width/height so it scales inside CSS-sized containers, drop mask/clip
 * machinery so the preview matches the font glyph (font extraction ignores masks; a
 * luminance mask whose content recolors to currentColor would render the icon
 * near-invisible), and recolor all paints to currentColor so the icon follows the
 * CSS `color` property. Returns the input unchanged when it has no <svg> root.
 *
 * Client-only: relies on the browser's DOMParser/XMLSerializer.
 * Runs at import/replace and behind the manual "Remove colors" action.
 */
export function normalizeDisplaySvg(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return svg;
  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');
  stripMasking(svgEl); // before recolor: don't recolor subtrees being removed
  recolorToCurrentColor(svgEl);
  return new XMLSerializer().serializeToString(doc.documentElement);
}

/**
 * Run the shared SVG import/replace pipeline on a raw SVG string.
 *
 * Client-only: relies on the browser's DOMParser/XMLSerializer.
 * Throws on malformed SVG (via parseSvg) or non-positive dimensions (via normalizeSvg).
 * `fileName` is used only for parseSvg's error messages.
 */
export function processSvg(raw: string, fileName: string): ProcessedSvg {
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_SVG_BYTES) {
    throw new Error(
      `${fileName} is too large (over ${MAX_IMPORT_SVG_BYTES / (1024 * 1024)} MB). Simplify the SVG before importing.`
    );
  }

  // displaySvg is never read by font generation (which uses pathData + viewBox).
  const displaySvg = normalizeDisplaySvg(raw);

  // <image> bitmaps can't become glyphs — extractPathData would silently
  // ignore them, yielding an icon that previews but exports empty. Checked
  // post-strip so images that were only mask/clip machinery don't reject.
  const displayDoc = new DOMParser().parseFromString(displaySvg, 'image/svg+xml');
  if (displayDoc.querySelector('image')) {
    throw new Error(
      `${fileName} contains an embedded bitmap (<image>), which cannot be converted to a font glyph. Vectorize it first.`
    );
  }

  // Full pipeline to extract pathData/viewBox for font generation.
  const optimized = optimizeSvg(raw);
  const parsed = parseSvg(optimized, fileName);
  const normalized = normalizeSvg(parsed);

  return {
    displaySvg,
    optimized,
    pathData: normalized.pathData,
    viewBox: normalized.viewBox,
    width: normalized.width,
    height: normalized.height,
  };
}
