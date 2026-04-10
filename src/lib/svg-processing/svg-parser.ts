export interface ParsedSvg {
  pathData: string;
  viewBox: string;
  width: number;
  height: number;
  svgContent: string;
}

export function parseSvg(svgString: string, fileName: string): ParsedSvg {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');

  if (!svg) {
    throw new Error(`Invalid SVG file: ${fileName}`);
  }

  let viewBox = svg.getAttribute('viewBox') || '';
  let width = parseFloat(svg.getAttribute('width') || '0');
  let height = parseFloat(svg.getAttribute('height') || '0');

  if (!viewBox && width && height) {
    viewBox = `0 0 ${width} ${height}`;
  } else if (viewBox && (!width || !height)) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    width = parts[2] || 1024;
    height = parts[3] || 1024;
  } else if (!viewBox) {
    viewBox = '0 0 1024 1024';
    width = 1024;
    height = 1024;
  }

  const pathData = extractPathData(svg);

  const serializer = new XMLSerializer();
  const svgContent = serializer.serializeToString(svg);

  return { pathData, viewBox, width, height, svgContent };
}

function extractPathData(svg: SVGElement): string {
  const paths: string[] = [];

  // Elements inside these containers are definitions or non-rendering contexts —
  // querySelectorAll finds them but they must not be included in the glyph path.
  // e.g. <clipPath><rect/></clipPath> gets convertShapeToPath'd to a <path> by
  // SVGO before this runs, and would otherwise appear as a filled square.
  const isInNonRenderingContext = (el: Element) =>
    !!el.closest('defs, mask, clipPath, symbol');

  // Get all path elements
  const pathElements = svg.querySelectorAll('path');
  pathElements.forEach(path => {
    if (isInNonRenderingContext(path)) return;
    const d = path.getAttribute('d');
    const fill = path.getAttribute('fill');
    if (d && fill !== 'none' && fill !== 'transparent') paths.push(d);
  });

  // Convert basic shapes to paths
  const rects = svg.querySelectorAll('rect');
  rects.forEach(rect => {
    if (isInNonRenderingContext(rect)) return;
    const fill = rect.getAttribute('fill');
    if (fill === 'none' || fill === 'transparent') return;
    const x = parseFloat(rect.getAttribute('x') || '0');
    const y = parseFloat(rect.getAttribute('y') || '0');
    const w = parseFloat(rect.getAttribute('width') || '0');
    const h = parseFloat(rect.getAttribute('height') || '0');
    const rx = parseFloat(rect.getAttribute('rx') || '0');
    const ry = parseFloat(rect.getAttribute('ry') || rx.toString());
    if (rx || ry) {
      const r = Math.min(rx || ry, w / 2, h / 2);
      paths.push(
        `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - 2 * r} a${r},${r} 0 0 1 -${r},-${r} v-${h - 2 * r} a${r},${r} 0 0 1 ${r},-${r}z`
      );
    } else {
      paths.push(`M${x},${y} h${w} v${h} h-${w}z`);
    }
  });

  const circles = svg.querySelectorAll('circle');
  circles.forEach(circle => {
    if (isInNonRenderingContext(circle)) return;
    const fill = circle.getAttribute('fill');
    if (fill === 'none' || fill === 'transparent') return;
    const cx = parseFloat(circle.getAttribute('cx') || '0');
    const cy = parseFloat(circle.getAttribute('cy') || '0');
    const r = parseFloat(circle.getAttribute('r') || '0');
    paths.push(
      `M${cx - r},${cy} a${r},${r} 0 1 0 ${r * 2},0 a${r},${r} 0 1 0 -${r * 2},0`
    );
  });

  const ellipses = svg.querySelectorAll('ellipse');
  ellipses.forEach(ellipse => {
    if (isInNonRenderingContext(ellipse)) return;
    const fill = ellipse.getAttribute('fill');
    if (fill === 'none' || fill === 'transparent') return;
    const cx = parseFloat(ellipse.getAttribute('cx') || '0');
    const cy = parseFloat(ellipse.getAttribute('cy') || '0');
    const rx = parseFloat(ellipse.getAttribute('rx') || '0');
    const ry = parseFloat(ellipse.getAttribute('ry') || '0');
    paths.push(
      `M${cx - rx},${cy} a${rx},${ry} 0 1 0 ${rx * 2},0 a${rx},${ry} 0 1 0 -${rx * 2},0`
    );
  });

  const polygons = svg.querySelectorAll('polygon');
  polygons.forEach(polygon => {
    if (isInNonRenderingContext(polygon)) return;
    const fill = polygon.getAttribute('fill');
    if (fill === 'none' || fill === 'transparent') return;
    const points = polygon.getAttribute('points')?.trim();
    if (points) {
      const coords = points.split(/[\s,]+/).map(Number);
      let d = `M${coords[0]},${coords[1]}`;
      for (let i = 2; i < coords.length; i += 2) {
        d += ` L${coords[i]},${coords[i + 1]}`;
      }
      d += 'z';
      paths.push(d);
    }
  });

  const polylines = svg.querySelectorAll('polyline');
  polylines.forEach(polyline => {
    if (isInNonRenderingContext(polyline)) return;
    const points = polyline.getAttribute('points')?.trim();
    if (points) {
      const coords = points.split(/[\s,]+/).map(Number);
      let d = `M${coords[0]},${coords[1]}`;
      for (let i = 2; i < coords.length; i += 2) {
        d += ` L${coords[i]},${coords[i + 1]}`;
      }
      paths.push(d);
    }
  });

  const lines = svg.querySelectorAll('line');
  lines.forEach(line => {
    if (isInNonRenderingContext(line)) return;
    const x1 = line.getAttribute('x1') || '0';
    const y1 = line.getAttribute('y1') || '0';
    const x2 = line.getAttribute('x2') || '0';
    const y2 = line.getAttribute('y2') || '0';
    paths.push(`M${x1},${y1} L${x2},${y2}`);
  });

  return paths.join(' ');
}

export function fileNameToIconName(fileName: string): string {
  return fileName
    .replace(/\.svg$/i, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
