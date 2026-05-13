'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { exportProject, importProject } from '@/lib/export/json-export';
import { useProjectStore } from '@/stores/project-store';
import { Download, Upload } from 'lucide-react';
import { useCallback, useRef } from 'react';
import styles from './project-settings.module.css';

export function ProjectSettings() {
  const { currentProject, currentProjectId, updateProject, updateFontSettings, loadProjects } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    if (!currentProjectId) return;
    await exportProject(currentProjectId);
  }, [currentProjectId]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importProject(file);
      await loadProjects();
    } catch (err) {
      console.error('Import failed:', err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [loadProjects]);

  if (!currentProject) return null;

  return (
    <ScrollArea className={styles.scrollArea}>
      <div className={styles.inner}>
        <h3 className={styles.heading}>Project</h3>

        <div className={styles.field}>
          <Label htmlFor="projectName" className={styles.label}>Project Name</Label>
          <Input
            id="projectName"
            value={currentProject.name}
            onChange={e => updateProject(currentProject.id, { name: e.target.value })}
            className={styles.input}
          />
        </div>

        <Separator />

        <h3 className={styles.heading}>Font Settings</h3>

        <div className={styles.fieldGroup}>
          <div className={styles.field}>
            <Label htmlFor="fontName" className={styles.label}>Font Name</Label>
            <Input
              id="fontName"
              value={currentProject.fontName}
              onChange={e => updateFontSettings({ fontName: e.target.value })}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <Label htmlFor="fontFamily" className={styles.label}>Font Family</Label>
            <Input
              id="fontFamily"
              value={currentProject.fontFamily}
              onChange={e => updateFontSettings({ fontFamily: e.target.value })}
              className={styles.input}
            />
          </div>
        </div>

        <Separator />

        <h3 className={styles.heading}>Font Metrics</h3>

        <div className={styles.fieldGroup}>
          <div className={styles.field}>
            <Label htmlFor="unitsPerEm" className={styles.label}>Units Per Em</Label>
            <Input
              id="unitsPerEm"
              type="number"
              value={currentProject.unitsPerEm}
              onChange={e => updateFontSettings({ unitsPerEm: parseInt(e.target.value) || 1024 })}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <Label htmlFor="ascender" className={styles.label}>Ascender</Label>
            <Input
              id="ascender"
              type="number"
              value={currentProject.ascender}
              onChange={e => updateFontSettings({ ascender: parseInt(e.target.value) || 1024 })}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <Label htmlFor="descender" className={styles.label}>Descender</Label>
            <Input
              id="descender"
              type="number"
              value={currentProject.descender}
              onChange={e => updateFontSettings({ descender: parseInt(e.target.value) || 0 })}
              className={styles.input}
            />
          </div>
        </div>

        <Separator />

        <h3 className={styles.heading}>Project Import/Export</h3>

        <div className={styles.buttonRow}>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className={styles.buttonIcon} />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className={styles.buttonIcon} />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className={styles.hidden}
          />
        </div>
      </div>
    </ScrollArea>
  );
}
