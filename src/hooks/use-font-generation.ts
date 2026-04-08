'use client';

import { generateFont, type GeneratedFontData } from '@/lib/font-generation/opentype-generator';
import type { IconGlyph, Project } from '@/types';
import { useCallback, useState } from 'react';

export interface FontGenerationResult {
  fontData: GeneratedFontData;
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

        const res: FontGenerationResult = { fontData };
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
