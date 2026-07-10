// CSS-form masking (`mask:` / `mask-image:` / `clip-path:` in an inline style or a
// <style> block) would keep pointing at the <mask>/<clipPath> elements we remove,
// leaving dangling references with browser-dependent rendering. The `(?!-)` negative
// lookahead spares longhands like `mask-type`, which are inert once the mask is gone.
function stripMaskDeclarations(css: string): string {
  return css.replace(/(?:-webkit-)?(?:mask(?:-image)?|clip-path)(?!-)\s*:\s*[^;}]*/gi, '');
}

/**
 * Remove masking/clipping machinery — <mask>/<clipPath> elements and the `mask` /
 * `clip-path` references to them — so the display SVG shows what the font glyph will
 * actually contain: font extraction (svg-parser) excludes mask/clipPath content and
 * ignores mask/clip effects on rendered elements. Also keeps luminance masks from
 * going near-black once paints are recolored to currentColor, and avoids document-wide
 * id collisions (Figma exports all emit `id="a"`) when many icons render inline on
 * one page. Mutates the element in place.
 */
export function stripMasking(svg: Element): void {
  // Exact case required: the document is XML ('image/svg+xml'), where type selectors
  // are case-sensitive — 'clippath' would match nothing. querySelectorAll is a static
  // list, so removing while iterating is safe.
  for (const el of Array.from(svg.querySelectorAll('mask, clipPath'))) {
    el.remove();
  }

  for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    el.removeAttribute('mask');
    el.removeAttribute('clip-path');

    const style = el.getAttribute('style');
    if (style) {
      const rewritten = stripMaskDeclarations(style);
      if (/^[\s;]*$/.test(rewritten)) el.removeAttribute('style');
      else if (rewritten !== style) el.setAttribute('style', rewritten);
    }

    if (el.tagName.toLowerCase() === 'style' && el.textContent) {
      const rewritten = stripMaskDeclarations(el.textContent);
      if (rewritten !== el.textContent) el.textContent = rewritten;
    }
  }
}
