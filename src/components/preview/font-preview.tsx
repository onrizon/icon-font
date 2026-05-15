'use client';

import { useFontPreview } from '@/hooks/use-font-preview';
import { formatCodepoint } from '@/lib/font-generation/codepoint-allocator';
import type { IconGlyph } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FontGenerationResult } from '@/hooks/use-font-generation';
import styles from '@/app/styles/font-preview.module.css';

interface FontPreviewProps {
  result: FontGenerationResult;
  icons: IconGlyph[];
  fontFamily: string;
}

export function FontPreview({ result, icons, fontFamily }: FontPreviewProps) {
  const fontLoaded = useFontPreview(result.fontData.ttfBuffer, fontFamily + '-preview');

  if (!fontLoaded) {
    return <div className={styles.loading}>Loading font preview...</div>;
  }

  return (
    <ScrollArea>
      <div className={styles.inner}>
        <h3 className={styles.heading}>Font Preview - {icons.length} glyphs</h3>
        <div className={styles.grid}>
          {icons.map(icon => {
            const codepoint = result.fontData.codepointMap.get(icon.id);
            if (!codepoint) return null;
            return (
              <div key={icon.id} className={styles.cell}>
                <span className={styles.glyph} style={{ fontFamily: fontFamily + '-preview' }}>
                  {String.fromCodePoint(codepoint)}
                </span>
                <span className={styles.name}>{icon.name}</span>
                <span className={styles.codepoint}>U+{formatCodepoint(codepoint)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
