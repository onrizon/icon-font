import { optimizeSvg } from './svg-optimizer';
import { parseSvg } from './svg-parser';
import { normalizeSvg } from './svg-normalizer';

export interface ProcessedSvg {
  /** Raw SVG with fixed width/height stripped off <svg>; stored as the icon's svgContent. */
  displaySvg: string;
  /** SVGO output; used by the import path for the R2 upload. */
  optimized: string;
  pathData: string;
  viewBox: string;
  width: number;
  height: number;
}

/**
 * Run the shared SVG import/replace pipeline on a raw SVG string.
 *
 * Client-only: relies on the browser's DOMParser/XMLSerializer.
 * Throws on malformed SVG (via parseSvg) or non-positive dimensions (via normalizeSvg).
 * `fileName` is used only for parseSvg's error messages.
 */
export function processSvg(raw: string, fileName: string): ProcessedSvg {
  // Preserve original SVG structure for display — only strip fixed width/height
  // so it scales correctly inside the CSS-sized container.
  // displaySvg is never read by font generation (which uses pathData + viewBox).
  const rawDoc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const rawSvgEl = rawDoc.querySelector('svg');
  if (rawSvgEl) {
    rawSvgEl.removeAttribute('width');
    rawSvgEl.removeAttribute('height');
  }
  const displaySvg = new XMLSerializer().serializeToString(rawDoc.documentElement);

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
