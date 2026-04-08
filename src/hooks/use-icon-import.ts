'use client';

import { useCallback, useState } from 'react';
import { useIconStore } from '@/stores/icon-store';
import { optimizeSvg } from '@/lib/svg-processing/svg-optimizer';
import { parseSvg, fileNameToIconName } from '@/lib/svg-processing/svg-parser';
import { normalizeSvg } from '@/lib/svg-processing/svg-normalizer';
import type { IconGlyph } from '@/types';

export function useIconImport(projectId: string | null) {
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const addIcons = useIconStore(s => s.addIcons);

  const importSvgFiles = useCallback(
    async (files: File[]) => {
      if (!projectId) return;
      setImporting(true);
      setErrors([]);

      const importErrors: string[] = [];
      const iconsToAdd: (Omit<IconGlyph, 'id' | 'order' | 'createdAt' | 'updatedAt'> & { id?: string })[] = [];

      for (const file of files) {
        try {
          const raw = await file.text();
          const optimized = optimizeSvg(raw);
          const parsed = parseSvg(optimized, file.name);
          const normalized = normalizeSvg(parsed);
          const name = fileNameToIconName(file.name);
          const iconId = crypto.randomUUID();

          const formData = new FormData();
          formData.append('file', new Blob([optimized], { type: 'image/svg+xml' }), file.name);
          formData.append('projectId', projectId);
          formData.append('iconId', iconId);
          const uploadRes = await fetch('/api/upload-svg', { method: 'POST', body: formData });
          const { url: r2Url } = await uploadRes.json();

          iconsToAdd.push({
            id: iconId,
            projectId,
            name,
            svgContent: normalized.svgContent,
            pathData: normalized.pathData,
            viewBox: normalized.viewBox,
            width: normalized.width,
            height: normalized.height,
            tags: [],
            r2Url,
          });
        } catch (err) {
          importErrors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      if (iconsToAdd.length > 0) {
        await addIcons(projectId, iconsToAdd);
      }

      setErrors(importErrors);
      setImporting(false);
    },
    [projectId, addIcons]
  );

  return { importSvgFiles, importing, errors };
}
