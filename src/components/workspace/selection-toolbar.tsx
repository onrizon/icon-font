'use client';

import { useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useIconStore } from '@/stores/icon-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Trash2, Edit, CheckSquare, XSquare } from 'lucide-react';

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
    <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="flex items-center gap-1 ml-2">
        <Button variant="ghost" size="sm" onClick={handleSelectAll}>
          <CheckSquare className="h-4 w-4 mr-1" />
          All
        </Button>
        <Button variant="ghost" size="sm" onClick={clearSelection}>
          <XSquare className="h-4 w-4 mr-1" />
          None
        </Button>
        {count === 1 && (
          <Button variant="ghost" size="sm" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-1" />
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
