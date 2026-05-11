'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface NewProjectCardProps {
  variant?: 'card' | 'button';
}

export function NewProjectCard({ variant = 'card' }: NewProjectCardProps) {
  const createProject = useProjectStore(s => s.createProject);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const project = await createProject(name.trim());
      setName('');
      setOpen(false);
      router.push(`/workspace/${project.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'card' ? (
          <button
            type="button"
            className="group flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background p-8 min-h-[160px] text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">New Project</span>
          </button>
        ) : (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Project name"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            disabled={creating}
          />
          <Button onClick={handleCreate} disabled={!name.trim() || creating}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
