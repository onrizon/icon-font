'use client';

import { useMemo } from 'react';
import { useProjectStore } from '@/stores/project-store';

export function useIconCounts() {
  const projects = useProjectStore(s => s.projects);
  const counts = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p.iconCount])),
    [projects]
  );
  return { counts };
}
