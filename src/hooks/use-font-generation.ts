'use client';

import { generateCSS } from '@/lib/font-generation/css-generator';
import { generateHTMLDemo } from '@/lib/font-generation/html-demo-generator';
import { generateFont, type GeneratedFontData } from '@/lib/font-generation/opentype-generator';
import type { IconGlyph, Project } from '@/types';
import { useCallback, useState } from 'react';

export interface FontGenerationResult {
  fontData: GeneratedFontData;
  css: string;
  html: string;
}

export function useFontGeneration() {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<FontGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (icons: IconGlyph[], project: Project) => {
      if (icons.length === 0) {
        setError('No icons to generate font from');
        return null;
      }

      setGenerating(true);
      setError(null);

      try {
        const fontData = generateFont(icons, project);
        const css = generateCSS(icons, project, fontData.codepointMap);
        const html = generateHTMLDemo(icons, project, fontData.codepointMap, css);

        const res: FontGenerationResult = { fontData, css, html };
        setResult(res);
        setGenerating(false);
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Font generation failed';
        setError(msg);
        setGenerating(false);
        return null;
      }
    },
    []
  );

  return { generate, generating, result, error };
}