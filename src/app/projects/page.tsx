'use client';

import { NewProjectCard } from '@/components/project/new-project-card';
import { ProjectCard } from '@/components/project/project-card';
import { useAuth } from '@/hooks/use-auth';
import { useIconCounts } from '@/hooks/use-icon-counts';
import { useProjectStore } from '@/stores/project-store';
import { Loader2, Type } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import styles from './page.module.css';

export default function ProjectsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const projects = useProjectStore(s => s.projects);
  const loading = useProjectStore(s => s.loading);
  const loadProjects = useProjectStore(s => s.loadProjects);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user) {
      loadProjects();
    }
  }, [authLoading, user, loadProjects]);

  const { counts } = useIconCounts();

  if (authLoading || loading) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spinner} />
      </div>
    );
  }

  const sortedProjects = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Type className={styles.brandIcon} />
        <h1 className={styles.brandTitle}>Icon Font Generator</h1>
      </header>

      <main className={styles.main}>
        <div className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>Projects</h2>
            <p className={styles.subtitle}>
              {projects.length === 0
                ? 'No projects yet'
                : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
            </p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className={styles.empty}>
            <Type className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>Create your first project</h3>
            <p className={styles.emptyText}>
              A project holds a set of icons that compile together into a font file.
            </p>
            <NewProjectCard variant="button" />
          </div>
        ) : (
          <div className={styles.grid}>
            {sortedProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                iconCount={counts[project.id] || 0}
              />
            ))}
            <NewProjectCard variant="card" />
          </div>
        )}
      </main>
    </div>
  );
}
