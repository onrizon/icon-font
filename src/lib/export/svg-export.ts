import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { IconGlyph } from '@/types';

export async function downloadSelectedSvgs(
  icons: IconGlyph[],
  fontFamily?: string
): Promise<void> {
  if (icons.length === 0) return;

  if (icons.length === 1) {
    const icon = icons[0];
    const blob = new Blob([icon.svgContent], { type: 'image/svg+xml' });
    saveAs(blob, `${icon.name}.svg`);
    return;
  }

  const zip = new JSZip();
  for (const icon of icons) {
    zip.file(`${icon.name}.svg`, icon.svgContent);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${fontFamily ?? 'icons'}-svgs.zip`);
}
