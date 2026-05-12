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
    <header className="h-14 border-b bg-background flex items-center px-4 gap-4 shrink-0">
      <Link href="/projects" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <Type className="h-5 w-5 text-primary" />
        <h1 className="font-semibold text-lg">Icon Font Generator</h1>
      </Link>
      <Button asChild variant="ghost" size="sm" className="gap-1.5">
        <Link href="/projects">
          <LayoutGrid className="h-4 w-4" />
          Projects
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFontDialogOpen(true)}>
        <FolderOpen className="h-4 w-4" />
        Open Font
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleDownloadSvgs}
        disabled={selectedCount === 0}
      >
        <Download className="h-4 w-4" />
        Download SVGs{selectedCount > 0 ? ` (${selectedCount})` : ''}
      </Button>
      <div className="ml-auto">
        <ProjectSwitcher />
      </div>
      <OpenFontDialog open={fontDialogOpen} onOpenChange={setFontDialogOpen} />
    </header>
  );
}
