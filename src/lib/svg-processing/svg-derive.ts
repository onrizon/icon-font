import { normalizeDisplaySvg } from './svg-pipeline';
import { optimizeSvg } from './svg-optimizer';
import { parseSvg } from './svg-parser';
import { normalizeSvg } from './svg-normalizer';

// Derives the in-memory artwork fields from an R2 SVG blob. Icon docs are
// metadata-only, so this runs at hydration time (see src/lib/icon-hydration.ts).
// Client-only: relies on the browser's DOMParser.

export interface DerivedArtwork {
  svgContent: string;
  pathData: string;
  viewBox: string;
  width: number;
  height: number;
}

/**
 * Blobs written by the editor/font-import/JSON-import are a bare
 * `<svg viewBox><path d/></svg>` — for those, path extraction can skip SVGO.
 */
export function isSimpleGlyphSvg(svg: string): boolean {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = parsed.documentElement;
  if (!root || root.tagName !== 'svg') return false;
  if (!root.getAttribute('viewBox')) return false;
  if (root.hasAttribute('transform')) return false;
  const children = Array.from(root.children);
  if (children.length !== 1) return false;
  const child = children[0];
  if (child.tagName !== 'path') return false;
  if (!child.getAttribute('d')) return false;
  if (child.hasAttribute('transform')) return false;
  const fill = child.getAttribute('fill');
  if (fill === 'none' || fill === 'transparent') return false;
  return true;
}

/**
 * Derive the in-memory artwork from an R2 blob. Import-path blobs are the
 * SVGO-optimized original (original colors, fixed size), so the display form
 * must be re-normalized; already-normalized blobs pass through unchanged
 * (normalizeDisplaySvg is idempotent).
 */
export function deriveArtworkFromBlob(blob: string, label: string): DerivedArtwork {
  const displaySvg = normalizeDisplaySvg(blob);
  const source = isSimpleGlyphSvg(blob) ? blob : optimizeSvg(blob);
  const normalized = normalizeSvg(parseSvg(source, label));
  return {
    svgContent: displaySvg,
    pathData: normalized.pathData,
    viewBox: normalized.viewBox,
    width: normalized.width,
    height: normalized.height,
  };
}
