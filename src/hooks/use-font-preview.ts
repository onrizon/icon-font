'use client';

import { useEffect, useRef, useState } from 'react';

export function useFontPreview(fontBuffer: ArrayBuffer | null, fontFamily: string) {
  const [loadedFor, setLoadedFor] = useState<ArrayBuffer | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!fontBuffer) return;

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    const blob = new Blob([fontBuffer], { type: 'font/ttf' });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;

    const fontFace = new FontFace(fontFamily, `url(${url})`);
    let cancelled = false;

    fontFace.load().then(loadedFace => {
      if (cancelled) return;
      document.fonts.add(loadedFace);
      setLoadedFor(fontBuffer);
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [fontBuffer, fontFamily]);

  return fontBuffer !== null && loadedFor === fontBuffer;
}
