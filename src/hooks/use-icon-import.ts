'use client';

import { useCallback, useState } from 'react';
import { useIconStore } from '@/stores/icon-store';
import { getIdToken } from '@/hooks/use-auth';
import { optimizeSvg } from '@/lib/svg-processing/svg-optimizer';
import { parseSvg, fileNameToIconName } from '@/lib/svg-processing/svg-parser';
import { normalizeSvg } from '@/lib/svg-processing/svg-normalizer';
import { AUTO_IMPORT_START, PUA_END } from '@/lib/font-generation/constants';
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

      const used = new Set<number>(
        useIconStore
          .getState()
          .icons.map(i => i.unicode)
          .filter((u): u is number => typeof u === 'number')
      );
      let nextCp = AUTO_IMPORT_START;
      const allocateNextCodepoint = (): number => {
        while (used.has(nextCp)) nextCp++;
        if (nextCp > PUA_END) throw new Error(`Exceeded Private Use Area capacity (U+${AUTO_IMPORT_START.toString(16).toUpperCase()}–U+${PUA_END.toString(16).toUpperCase()})`);
        const cp = nextCp;
        used.add(cp);
        nextCp++;
        return cp;
      };

      for (const file of files) {
        try {
          const raw = await file.text();

          // Preserve original SVG structure for display — only strip fixed width/height
          // so it scales correctly inside the CSS-sized icon card container.
          // svgContent is never read by font generation (which uses pathData + viewBox).
          const rawDoc = new DOMParser().parseFromString(raw, 'image/svg+xml');
          const rawSvgEl = rawDoc.querySelector('svg');
          if (rawSvgEl) {
            rawSvgEl.removeAttribute('width');
            rawSvgEl.removeAttribute('height');
          }
          const displaySvg = new XMLSerializer().serializeToString(rawDoc.documentElement);

          // Still run the full pipeline to extract pathData/viewBox for font generation
          const optimized = optimizeSvg(raw);
          const parsed = parseSvg(optimized, file.name);
          const normalized = normalizeSvg(parsed);
          const name = fileNameToIconName(file.name);
          const iconId = crypto.randomUUID();

          const formData = new FormData();
          formData.append('file', new Blob([optimized], { type: 'image/svg+xml' }), file.name);
          formData.append('projectId', projectId);
          formData.append('iconId', iconId);
          const token = await getIdToken();
          const uploadRes = await fetch('/api/upload-svg', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (!uploadRes.ok) {
            throw new Error(`Upload failed: ${uploadRes.status}`);
          }
          const { url: r2Url } = await uploadRes.json();

          iconsToAdd.push({
            id: iconId,
            projectId,
            name,
            svgContent: displaySvg,
            pathData: normalized.pathData,
            viewBox: normalized.viewBox,
            width: normalized.width,
            height: normalized.height,
            tags: [],
            r2Url,
            unicode: allocateNextCodepoint(),
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
