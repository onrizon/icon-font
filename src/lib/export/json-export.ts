'use client';

import { saveAs } from 'file-saver';
import { collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';
import { getIdToken } from '@/hooks/use-auth';
import { validateProject, validateIcon } from '@/lib/firestore-schema';
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
  const project = validateProject(projectSnap.id, projectSnap.data());

  const iconsSnap = await getDocs(query(collection(firestore, 'icons'), where('parent', '==', projectId)));
  const icons: IconGlyph[] = iconsSnap.docs
    .map(d => validateIcon(d.id, d.data()))
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
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

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
    ownerUid: uid,
    name: `${data.project.name} (imported)`,
    iconCount: data.icons.length,
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

  // Write the project doc first so the upload API's ownership check succeeds.
  const { id, ...projectData } = project;
  await writeBatch(firestore).set(doc(firestore, 'project', id), projectData).commit();

  const uploadedIconIds: string[] = [];
  try {
    const token = await getIdToken();
    for (const icon of icons) {
      const formData = new FormData();
      formData.append('file', new Blob([icon.svgContent], { type: 'image/svg+xml' }), `${icon.id}.svg`);
      formData.append('projectId', newProjectId);
      formData.append('iconId', icon.id);
      const res = await fetch('/api/upload-svg', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Failed to upload "${icon.name}": ${res.status}`);
      }
      const { url } = await res.json();
      icon.r2Url = url;
      uploadedIconIds.push(icon.id);
    }

    const batch = writeBatch(firestore);
    for (const icon of icons) {
      const { id: iconId, projectId: _pid, ...iconData } = icon;
      batch.set(doc(firestore, 'icons', iconId), { ...iconData, parent: newProjectId });
    }
    await batch.commit();
  } catch (err) {
    if (uploadedIconIds.length > 0) {
      try {
        const token = await getIdToken();
        await fetch('/api/delete-r2-objects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ projectId: newProjectId, iconIds: uploadedIconIds }),
        });
      } catch (rollbackErr) {
        console.error('Rollback failed during importProject:', rollbackErr);
      }
    }
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(firestore, 'project', newProjectId));
    } catch (cleanupErr) {
      console.error('Failed to clean up project doc:', cleanupErr);
    }
    throw err;
  }

  return newProjectId;
}
