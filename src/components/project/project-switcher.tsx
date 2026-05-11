'use client';

import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export function ProjectSwitcher() {
  const router = useRouter();
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const deleteProject = useProjectStore(s => s.deleteProject);

  const handleDelete = async () => {
    if (!currentProjectId) return;
    await deleteProject(currentProjectId);
    router.push('/projects');
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      title="Delete project"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
