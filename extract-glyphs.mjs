import { Font } from 'fonteditor-core';
import { readFileSync } from 'node:fs';

const ttfPath = './src/components/fonts/icomoon.ttf';
const buf = readFileSync(ttfPath);
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const font = Font.create(arrayBuffer, { type: 'ttf' });
const ttf = font.get();
const glyphs = ttf.glyf || [];
const unitsPerEm = ttf.head?.unitsPerEm || 1024;
const ascender = ttf.hhea?.ascender || 960;
const descender = ttf.hhea?.descender || -240;

console.log(`Font unitsPerEm: ${unitsPerEm}`);
console.log(`Ascender: ${ascender}, Descender: ${descender}`);
console.log(`\n=== All glyphs with codepoints ===\n`);

// Print all glyphs with their unicode and names
glyphs.forEach((glyph, idx) => {
  if (!glyph) return;
  
  const name = glyph.name || `glyph-${idx}`;
  const unicode = glyph.unicode ? (Array.isArray(glyph.unicode) ? glyph.unicode : [glyph.unicode])
    .map(u => `U+${u.toString(16).toUpperCase().padStart(4, '0')}`) : 'none';
  const xMin = glyph.xMin || 0;
  const yMin = glyph.yMin || 0;
  const xMax = glyph.xMax || 0;
  const yMax = glyph.yMax || 0;
  
  console.log(`[${idx}] ${name.padEnd(20)} ${String(unicode).padEnd(25)} bbox:[${String(xMin).padStart(4)},${String(yMin).padStart(4)},${String(xMax).padStart(4)},${String(yMax).padStart(4)}]`);
});

// Try to find names from post table (name list)
if (ttf.post && ttf.post.glyphOrder) {
  console.log('\n=== Glyph order from post table ===\n');
  ttf.post.glyphOrder.forEach((name, idx) => {
    if (name && name.toLowerCase().includes('youtube')) {
      console.log(`Found YouTube at index ${idx}: ${name}`);
    }
  });
}

// Try names table
if (ttf.name) {
  console.log('\n=== Searching name records ===');
  ttf.name.records?.forEach(record => {
    if (record.nameID === 256 || record.platformID === 3) {
      const text = record.text || '';
      if (text.toLowerCase().includes('youtube')) {
        console.log(`Found in names: ${text}`);
      }
    }
  });
}
