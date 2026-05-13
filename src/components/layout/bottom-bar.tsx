'use client';

import { useIconStore } from '@/stores/icon-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useProjectStore } from '@/stores/project-store';
import styles from './bottom-bar.module.css';

export function BottomBar() {
  const iconCount = useIconStore(s => s.icons.length);
  const selectedCount = useWorkspaceStore(s => s.selectedIds.size);
  const project = useProjectStore(s => s.currentProject);

  return (
    <footer className={styles.footer}>
      <span>{iconCount} icons</span>
      {selectedCount > 0 && <span>{selectedCount} selected</span>}
      {project && (
        <>
          <span className={styles.pushRight}>Font: {project.fontFamily}</span>
          <span>Prefix: {project.prefix}</span>
          <span>UPM: {project.unitsPerEm}</span>
        </>
      )}
    </footer>
  );
}
