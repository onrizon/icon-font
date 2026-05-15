'use client';

import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import styles from '@/app/styles/project-switcher.module.css';

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
      className={styles.deleteButton}
      onClick={handleDelete}
      title="Delete project"
    >
      <Trash2 className={styles.icon} />
    </Button>
  );
}
