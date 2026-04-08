'use client';

import { saveAs } from 'file-saver';
import { collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import type { IconGlyph, Project } from '@/types';

interface ProjectExport {
  version: 1;
  project: Project;
  icons: IconGlyph[];
  exportedAt: string;
}

export async function exportProject(projectId: string): Promise<void> {
  const projectSnap = await getDoc(doc(firestore, 'project', projectId));
  if (!projectSnap.exists()) throw new Error('Project not found');
  const project: Project = { id: projectSnap.id, ...projectSnap.data() } as Project;

  const iconsSnap = await getDocs(query(collection(firestore, 'icons'), where('parent', '==', projectId)));
  const icons: IconGlyph[] = iconsSnap.docs
    .map(d => {
      const data = d.data();
      return { ...data, id: d.id, projectId: data.parent } as IconGlyph;
    })
    .sort((a, b) => a.order - b.order);

  const data: ProjectExport = {
    version: 1,
    project,
    icons,
    exportedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  saveAs(blob, `${project.fontName}-project.json`);
}

export async function importProject(file: File): Promise<string> {
  const text = await file.text();
  const data: ProjectExport = JSON.parse(text);

  if (data.version !== 1) {
    throw new Error('Unsupported project file version');
  }

  const { v4: uuid } = await import('uuid');
  const newProjectId = uuid();
  const now = Date.now();

  const project: Project = {
    ...data.project,
    id: newProjectId,
    name: `${data.project.name} (imported)`,
    createdAt: now,
    updatedAt: now,
  };

  const icons: IconGlyph[] = data.icons.map(icon => ({
    ...icon,
    id: uuid(),
    projectId: newProjectId,
    createdAt: now,
    updatedAt: now,
  }));

  const { id, ...projectData } = project;
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, 'project', id), projectData);
  for (const icon of icons) {
    const { id: iconId, projectId: _pid, ...iconData } = icon;
    batch.set(doc(firestore, 'icons', iconId), { ...iconData, parent: newProjectId });
  }
  await batch.commit();

  return newProjectId;
}
