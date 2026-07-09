// Paint values that mean "no paint" — left untouched so outline-only shapes and
// intentionally-transparent fills keep their appearance.
const NO_PAINT = new Set(['none', 'transparent', 'currentcolor']);

const PAINT_ATTRS = ['fill', 'stroke'] as const;

function isRecolorable(value: string | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v !== '' && !NO_PAINT.has(v);
}

// Rewrite `fill:`/`stroke:` declarations (in an inline style or a <style> block) to
// currentColor, leaving no-paint values and non-color longhands (fill-rule, stroke-width)
// alone. The negative lookahead on `-` keeps `fill-rule` / `stroke-*` from matching.
function rewriteStyleColors(css: string): string {
  return css.replace(/(fill|stroke)(?!-)\s*:\s*([^;}]+)/gi, (match, prop, value) => {
    const v = String(value).trim().toLowerCase();
    return NO_PAINT.has(v) ? match : `${prop}:currentColor`;
  });
}

/**
 * Rewrite every explicit fill/stroke paint in an SVG element tree to `currentColor` so
 * the icon inherits the CSS `color` property — the requirement for a monochrome icon font.
 * Covers presentation attributes, inline `style` declarations, and `<style>` blocks.
 * `none`/`transparent` paints are preserved so stroked/outline icons keep their shape.
 * Mutates the element in place.
 */
export function recolorToCurrentColor(svg: Element): void {
  // Give the root a currentColor fill so elements relying on the default (black) fill
  // follow `color` too — `fill` is an inherited SVG property.
  if (!svg.hasAttribute('fill')) {
    svg.setAttribute('fill', 'currentColor');
  }

  for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    for (const attr of PAINT_ATTRS) {
      if (isRecolorable(el.getAttribute(attr))) {
        el.setAttribute(attr, 'currentColor');
      }
    }

    const style = el.getAttribute('style');
    if (style) {
      const rewritten = rewriteStyleColors(style);
      if (rewritten !== style) el.setAttribute('style', rewritten);
    }

    if (el.tagName.toLowerCase() === 'style' && el.textContent) {
      const rewritten = rewriteStyleColors(el.textContent);
      if (rewritten !== el.textContent) el.textContent = rewritten;
    }
  }
}
