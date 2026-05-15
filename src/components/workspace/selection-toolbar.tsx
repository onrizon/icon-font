'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIconStore } from '@/stores/icon-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { CheckSquare, Edit, Trash2, XSquare } from 'lucide-react';
import { useState } from 'react';
import styles from '@/app/styles/selection-toolbar.module.css';

export function SelectionToolbar() {
  const { selectedIds, clearSelection, selectAll, setEditingIconId } = useWorkspaceStore();
  const icons = useIconStore(s => s.icons);
  const deleteIcons = useIconStore(s => s.deleteIcons);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const count = selectedIds.size;
  if (count === 0) return null;

  const handleDelete = async () => {
    await deleteIcons(Array.from(selectedIds));
    clearSelection();
    setConfirmOpen(false);
  };

  const handleEdit = () => {
    if (count === 1) {
      setEditingIconId(Array.from(selectedIds)[0]);
    }
  };

  const handleSelectAll = () => {
    selectAll(icons.map(i => i.id));
  };

  return (
    <div className={styles.toolbar}>
      <span className={styles.count}>{count} selected</span>
      <div className={styles.actions}>
        <Button variant="outline" size="sm" onClick={handleSelectAll}>
          <CheckSquare className={styles.actionIcon} />
          All
        </Button>
        <Button variant="outline" size="sm" onClick={clearSelection}>
          <XSquare className={styles.actionIcon} />
          None
        </Button>
        {count === 1 && (
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit className={styles.actionIcon} />
            Edit
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} className={styles.deleteButton}>
          <Trash2 className={styles.actionIcon} />
          Delete
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete icons?</DialogTitle>
            <DialogDescription>
              This will permanently delete {count} icon{count !== 1 ? 's' : ''}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
