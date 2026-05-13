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
import styles from './new-project-card.module.css';

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
          <button type="button" className={styles.card}>
            <Plus className={styles.cardIcon} />
            <span className={styles.cardLabel}>New Project</span>
          </button>
        ) : (
          <Button size="sm" className={styles.button}>
            <Plus className={styles.buttonIcon} />
            New Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className={styles.row}>
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
