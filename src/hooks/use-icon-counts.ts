'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

export function useIconCounts(refreshKey?: unknown) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    getDocs(collection(firestore, 'icons')).then(snap => {
      if (cancelled) return;
      const grouped: Record<string, number> = {};
      snap.docs.forEach(d => {
        const parent = (d.data() as { parent?: string }).parent;
        if (parent) grouped[parent] = (grouped[parent] || 0) + 1;
      });
      setCounts(grouped);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { counts };
}
