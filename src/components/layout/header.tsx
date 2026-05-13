'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Type, FolderOpen, LayoutGrid, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectSwitcher } from '@/components/project/project-switcher';
import { OpenFontDialog } from '@/components/import/open-font-dialog';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useIconStore } from '@/stores/icon-store';
import { useProjectStore } from '@/stores/project-store';
import { downloadSelectedSvgs } from '@/lib/export/svg-export';
import styles from './header.module.css';

export function Header() {
  const [fontDialogOpen, setFontDialogOpen] = useState(false);
  const selectedIds = useWorkspaceStore(s => s.selectedIds);
  const icons = useIconStore(s => s.icons);
  const currentProject = useProjectStore(s => s.currentProject);
  const selectedCount = selectedIds.size;

  const handleDownloadSvgs = async () => {
    const selected = icons.filter(i => selectedIds.has(i.id));
    await downloadSelectedSvgs(selected, currentProject?.fontFamily);
  };

  return (
    <header className={styles.header}>
      <Link href="/projects" className={styles.brand}>
        <Type className={styles.brandIcon} />
        <h1 className={styles.brandTitle}>Icon Font Generator</h1>
      </Link>
      <Button asChild variant="ghost" size="sm" className={styles.button}>
        <Link href="/projects">
          <LayoutGrid />
          Projects
        </Link>
      </Button>
      <Button variant="outline" size="sm" className={styles.button} onClick={() => setFontDialogOpen(true)}>
        <FolderOpen />
        Open Font
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={styles.button}
        onClick={handleDownloadSvgs}
        disabled={selectedCount === 0}
      >
        <Download />
        Download SVGs{selectedCount > 0 ? ` (${selectedCount})` : ''}
      </Button>
      <div className={styles.spacer}>
        <ProjectSwitcher />
      </div>
      <OpenFontDialog open={fontDialogOpen} onOpenChange={setFontDialogOpen} />
    </header>
  );
}
