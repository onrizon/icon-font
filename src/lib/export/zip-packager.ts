import { generateFont } from '@/lib/font-generation/opentype-generator';
import { compressWoff2 } from '@/lib/font-generation/woff2';
import type { IconGlyph, Project } from '@/types';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export interface PackageOptions {
  includeTTF: boolean;
  includeWOFF2: boolean;
}

const DEFAULT_OPTIONS: PackageOptions = {
  includeTTF: true,
  includeWOFF2: true,
};

export async function downloadFontPackage(
  icons: IconGlyph[],
  project: Project,
  options: Partial<PackageOptions> = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { fontFamily } = project;

  const { ttfBuffer } = generateFont(icons, project);

  const zip = new JSZip();
  const folder = zip.folder(fontFamily)!;
  const fontsFolder = folder.folder('fonts')!;

  if (opts.includeTTF) {
    fontsFolder.file(`${fontFamily}.ttf`, ttfBuffer);
  }

  if (opts.includeWOFF2) {
    try {
      const woff2Buffer = await compressWoff2(ttfBuffer);
      fontsFolder.file(`${fontFamily}.woff2`, woff2Buffer);
    } catch (e) {
      console.warn('WOFF2 compression failed, skipping:', e);
    }
  }

  // Include SVG source files
  const svgFolder = folder.folder('svg')!;
  for (const icon of icons) {
    svgFolder.file(`${icon.name}.svg`, icon.svgContent);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${fontFamily}.zip`);
}

export async function downloadSingleFormat(
  icons: IconGlyph[],
  project: Project,
  format: 'ttf' | 'woff2'
): Promise<void> {
  const { fontFamily } = project;
  const { ttfBuffer } = generateFont(icons, project);

  switch (format) {
    case 'ttf': {
      const blob = new Blob([ttfBuffer], { type: 'font/ttf' });
      saveAs(blob, `${fontFamily}.ttf`);
      break;
    }
    case 'woff2': {
      const woff2Buffer = await compressWoff2(ttfBuffer);
      const blob = new Blob([woff2Buffer], { type: 'font/woff2' });
      saveAs(blob, `${fontFamily}.woff2`);
      break;
    }
  }
}
