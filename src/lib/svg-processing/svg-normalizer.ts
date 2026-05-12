import type { ParsedSvg } from './svg-parser';

export function normalizeSvg(parsed: ParsedSvg): ParsedSvg {
  const [vbXRaw, vbYRaw, vbWidthRaw, vbHeightRaw] = parsed.viewBox.split(/[\s,]+/).map(Number);
  const vbX = Number.isFinite(vbXRaw) ? vbXRaw : 0;
  const vbY = Number.isFinite(vbYRaw) ? vbYRaw : 0;
  const w = Number.isFinite(vbWidthRaw) && vbWidthRaw > 0 ? vbWidthRaw : parsed.width;
  const h = Number.isFinite(vbHeightRaw) && vbHeightRaw > 0 ? vbHeightRaw : parsed.height;

  if (!(w > 0) || !(h > 0)) {
    throw new Error(`Invalid viewBox dimensions: width=${w}, height=${h}`);
  }

  // Normalize to a square viewBox centered around the content.
  // offsetX/offsetY include -vbX/-vbY so non-zero-origin viewBoxes translate correctly.
  const size = Math.max(w, h);
  const offsetX = (size - w) / 2 - vbX;
  const offsetY = (size - h) / 2 - vbY;

  const normalizedViewBox = `0 0 ${size} ${size}`;

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${normalizedViewBox}">
  <g transform="translate(${offsetX}, ${offsetY})">
    <path d="${parsed.pathData}" fill="currentColor"/>
  </g>
</svg>`;

  return {
    ...parsed,
    viewBox: normalizedViewBox,
    width: size,
    height: size,
    svgContent,
  };
}
