'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Type } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { useIconCounts } from '@/hooks/use-icon-counts';
import { useAuth } from '@/hooks/use-auth';
import { ProjectCard } from '@/components/project/project-card';
import { NewProjectCard } from '@/components/project/new-project-card';

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
    loadProjects();
  }, [loadProjects]);

  const { counts } = useIconCounts(projects.length);

  if (authLoading || loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sortedProjects = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b bg-background flex items-center px-6 gap-3 shrink-0">
        <Type className="h-5 w-5 text-primary" />
        <h1 className="font-semibold text-lg">Icon Font Generator</h1>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {projects.length === 0
                ? 'No projects yet'
                : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
            </p>
          </div>
          {projects.length > 0 && <NewProjectCard variant="button" />}
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 border border-dashed rounded-lg">
            <Type className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Create your first project</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm">
              A project holds a set of icons that compile together into a font file.
            </p>
            <NewProjectCard variant="button" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
