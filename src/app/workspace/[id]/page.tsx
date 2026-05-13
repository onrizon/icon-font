'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { useIconStore } from '@/stores/icon-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useIconImport } from '@/hooks/use-icon-import';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { BottomBar } from '@/components/layout/bottom-bar';
import { IconGrid } from '@/components/workspace/icon-grid';
import { SearchToolbar } from '@/components/workspace/search-toolbar';
import { SelectionToolbar } from '@/components/workspace/selection-toolbar';
import { SvgDropzone } from '@/components/import/svg-dropzone';
import { IconEditor } from '@/components/editor/icon-editor';
import { GeneratePanel } from '@/components/generate/generate-panel';
import { ProjectSettings } from '@/components/project/project-settings';
import { IconPreviewPanel } from '@/components/workspace/icon-preview-panel';
import { Loader2 } from 'lucide-react';
import styles from './page.module.css';

function WorkspaceContent() {
  const activeTab = useWorkspaceStore(s => s.activeTab);
  const icons = useIconStore(s => s.icons);
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const { importSvgFiles, importing } = useIconImport(currentProjectId);
  const selectedIds = useWorkspaceStore(s => s.selectedIds);
  const clearSelection = useWorkspaceStore(s => s.clearSelection);
  const deleteIcons = useIconStore(s => s.deleteIcons);
  const selectAll = useWorkspaceStore(s => s.selectAll);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && activeTab === 'icons') {
        e.preventDefault();
        selectAll(icons.map(i => i.id));
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && activeTab === 'icons') {
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        e.preventDefault();
        deleteIcons(Array.from(selectedIds));
        clearSelection();
      }
      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, icons, selectedIds, selectAll, deleteIcons, clearSelection]);

  switch (activeTab) {
    case 'editor':
      return <IconEditor />;
    case 'generate':
      return <GeneratePanel />;
    case 'preview':
      return <ProjectSettings />;
    default:
      return (
        <div className={styles.workspaceContent}>
          <div className={styles.contentColumn}>
            <SearchToolbar />
            <SelectionToolbar />
            <div className={styles.scrollArea}>
              {icons.length === 0 ? (
                <div className={styles.emptyState}>
                  <SvgDropzone onFilesAccepted={importSvgFiles} importing={importing} />
                </div>
              ) : (
                <>
                  <div className={styles.dropzoneWrap}>
                    <SvgDropzone onFilesAccepted={importSvgFiles} importing={importing} compact />
                  </div>
                  <IconGrid />
                </>
              )}
            </div>
          </div>
          <IconPreviewPanel />
        </div>
      );
  }
}

export default function WorkspacePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { user, loading: authLoading } = useAuth();
  const projects = useProjectStore(s => s.projects);
  const projectLoading = useProjectStore(s => s.loading);
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const loadProjects = useProjectStore(s => s.loadProjects);
  const switchProject = useProjectStore(s => s.switchProject);
  const loadIcons = useIconStore(s => s.loadIcons);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user && projects.length === 0) {
      loadProjects();
    }
  }, [authLoading, user, projects.length, loadProjects]);

  useEffect(() => {
    if (!id || projectLoading) return;
    const exists = projects.some(p => p.id === id);
    if (!exists) {
      router.replace('/projects');
      return;
    }
    if (currentProjectId !== id) {
      switchProject(id);
    }
  }, [id, projects, projectLoading, currentProjectId, switchProject, router]);

  useEffect(() => {
    if (currentProjectId) {
      loadIcons(currentProjectId);
    }
  }, [currentProjectId, loadIcons]);

  if (authLoading || projectLoading || !currentProjectId) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          <WorkspaceContent />
        </main>
      </div>
      <BottomBar />
    </div>
  );
}
