import { SVGPathData } from 'svg-pathdata';
import type { Transform } from '@/types';

export function applyTransform(pathData: string, transform: Transform, viewBoxSize: number): string {
  try {
    let svgPath = new SVGPathData(pathData);
    const center = viewBoxSize / 2;

    // Apply scale
    if (transform.scale !== 1) {
      svgPath = svgPath
        .translate(-center, -center)
        .scale(transform.scale, transform.scale)
        .translate(center, center);
    }

    // Apply rotation
    if (transform.rotate !== 0) {
      const rad = (transform.rotate * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      svgPath = svgPath
        .translate(-center, -center)
        .matrix(cos, sin, -sin, cos, 0, 0)
        .translate(center, center);
    }

    // Apply flip horizontal
    if (transform.flipH) {
      svgPath = svgPath
        .translate(-center, 0)
        .scale(-1, 1)
        .translate(center, 0);
    }

    // Apply flip vertical
    if (transform.flipV) {
      svgPath = svgPath
        .translate(0, -center)
        .scale(1, -1)
        .translate(0, center);
    }

    // Apply translation
    if (transform.translateX || transform.translateY) {
      svgPath = svgPath.translate(transform.translateX, transform.translateY);
    }

    return svgPath.encode();
  } catch {
    return pathData;
  }
}

export function getDefaultTransform(): Transform {
  return {
    rotate: 0,
    flipH: false,
    flipV: false,
    scale: 1,
    translateX: 0,
    translateY: 0,
  };
}

/**
 * Scale a path to fill the viewBox (largest dimension edge-to-edge) and center it.
 * Scale first, then re-center from the scaled bounds, so the final position is exact
 * regardless of the scale pivot. Returns the original path on empty/degenerate bounds
 * or parse error.
 */
export function fitPathToViewBox(pathData: string, vbW: number, vbH: number): string {
  try {
    const size = Math.max(vbW, vbH);
    const b = new SVGPathData(pathData).getBounds();
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    if (!(w > 0) || !(h > 0)) return pathData;

    const k = Math.min(vbW / w, vbH / h); // largest scale that still fits
    const scaled = applyTransform(pathData, { ...getDefaultTransform(), scale: k }, size);

    const s = new SVGPathData(scaled).getBounds();
    const dx = (vbW - (s.maxX - s.minX)) / 2 - s.minX; // center (mirrors handleCenter math)
    const dy = (vbH - (s.maxY - s.minY)) / 2 - s.minY;
    return applyTransform(scaled, { ...getDefaultTransform(), translateX: dx, translateY: dy }, size);
  } catch {
    return pathData;
  }
}
