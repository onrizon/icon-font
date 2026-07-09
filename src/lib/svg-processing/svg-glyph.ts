// Build the single-path display SVG for a merged glyph path.
//
// The merged `pathData` concatenates every subpath of an icon. If the source relied on
// the `evenodd` fill rule to punch holes (cut-outs / negative space), rendering the merged
// path with the default `nonzero` rule fills those holes solid. We detect an `evenodd`
// source and carry the rule through, so nested subpaths keep rendering as holes.
export function buildGlyphSvg(pathData: string, viewBox: string, sourceSvg?: string): string {
  const fillRule = sourceSvg && /evenodd/i.test(sourceSvg) ? ' fill-rule="evenodd"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <path d="${pathData}" fill="currentColor"${fillRule}/>
</svg>`;
}
