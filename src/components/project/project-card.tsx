'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Trash2, Pencil, FolderOpen } from 'lucide-react';
import type { Project } from '@/types';
import { useProjectStore } from '@/stores/project-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import styles from '@/app/styles/project-card.module.css';

interface ProjectCardProps {
  project: Project;
  iconCount: number;
}

function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function ProjectCard({ project, iconCount }: ProjectCardProps) {
  const router = useRouter();
  const updateProject = useProjectStore(s => s.updateProject);
  const deleteProject = useProjectStore(s => s.deleteProject);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = () => router.push(`/workspace/${project.id}`);

  const handleRename = async () => {
    const name = renameValue.trim();
    if (!name || name === project.name || busy) return;
    setBusy(true);
    try {
      await updateProject(project.id, { name });
      setRenameOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteProject(project.id);
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        }}
        className={styles.card}
      >
        <div className={styles.headerRow}>
          <div className={styles.headerText}>
            <h3 className={styles.title}>{project.name}</h3>
            <div className={styles.meta}>
              <Badge variant="secondary" className={styles.fontBadge}>
                {project.fontName}
              </Badge>
              <span className={styles.iconCount}>
                {iconCount} {iconCount === 1 ? 'icon' : 'icons'}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className={styles.menuButton}>
                <MoreVertical className={styles.menuIcon} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
              <DropdownMenuItem onSelect={open}>
                <FolderOpen className={styles.itemIcon} />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setRenameValue(project.name);
                  setRenameOpen(true);
                }}
              >
                <Pencil className={styles.itemIcon} />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className={styles.destructiveItem}
              >
                <Trash2 className={styles.itemIcon} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className={styles.footer}>
          <span className={styles.owner} title={project.ownerName || undefined}>
            {project.ownerName || 'Unknown owner'}
          </span>
          <span className={styles.updated}>
            Updated {formatRelative(project.updatedAt)}
          </span>
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            disabled={busy}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameValue.trim() || renameValue.trim() === project.name || busy}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{project.name}&rdquo;?</DialogTitle>
          </DialogHeader>
          <p className={styles.deleteText}>
            This will permanently remove the project and its {iconCount}{' '}
            {iconCount === 1 ? 'icon' : 'icons'}. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
