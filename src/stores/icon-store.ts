import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  collection, doc, getDocs, updateDoc, query, where, writeBatch, increment,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { getIdToken } from '@/hooks/use-auth';
import { useProjectStore } from '@/stores/project-store';
import { validateIcon } from '@/lib/firestore-schema';
import type { IconGlyph } from '@/types';

interface IconStore {
  icons: IconGlyph[];
  loading: boolean;
  searchQuery: string;

  loadIcons: (projectId: string) => Promise<void>;
  addIcons: (projectId: string, icons: (Omit<IconGlyph, 'id' | 'order' | 'createdAt' | 'updatedAt'> & { id?: string })[]) => Promise<void>;
  updateIcon: (id: string, updates: Partial<IconGlyph>) => Promise<void>;
  deleteIcons: (ids: string[]) => Promise<void>;
  reorderIcons: (orderedIds: string[]) => Promise<void>;
  setSearchQuery: (query: string) => void;
  getNextOrder: () => number;
}

function omitUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function snapToIcons(snap: Awaited<ReturnType<typeof getDocs>>): IconGlyph[] {
  return snap.docs
    .map(d => validateIcon(d.id, d.data()))
    .sort((a, b) => a.order - b.order);
}

async function fetchIcons(projectId: string): Promise<IconGlyph[]> {
  const snap = await getDocs(query(collection(firestore, 'icons'), where('parent', '==', projectId)));
  return snapToIcons(snap);
}

export const useIconStore = create<IconStore>((set, get) => ({
  icons: [],
  loading: false,
  searchQuery: '',

  loadIcons: async (projectId: string) => {
    set({ loading: true, icons: [] });
    const icons = await fetchIcons(projectId);
    set({ icons, loading: false });
  },

  addIcons: async (projectId, newIcons) => {
    const currentMax = get().getNextOrder();
    const now = Date.now();
    const iconsToAdd: IconGlyph[] = newIcons.map((icon, i) => ({
      ...icon,
      id: icon.id ?? uuid(),
      order: currentMax + i,
      createdAt: now,
      updatedAt: now,
    }));
    const batch = writeBatch(firestore);
    for (const icon of iconsToAdd) {
      const { id, projectId: _pid, ...rest } = icon;
      batch.set(doc(firestore, 'icons', id), omitUndefined({ ...rest, parent: projectId }));
    }
    batch.update(doc(firestore, 'project', projectId), {
      iconCount: increment(iconsToAdd.length),
      updatedAt: Date.now(),
    });
    try {
      await batch.commit();
    } catch (err) {
      const uploadedIds = iconsToAdd.filter(i => i.r2Url).map(i => i.id);
      if (uploadedIds.length > 0) {
        try {
          const token = await getIdToken();
          await fetch('/api/delete-r2-objects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ projectId, iconIds: uploadedIds }),
          });
        } catch (rollbackErr) {
          console.error('Rollback failed; orphaned R2 objects:', uploadedIds, rollbackErr);
        }
      }
      throw err;
    }
    useProjectStore.getState().adjustIconCount(projectId, iconsToAdd.length);
    const icons = await fetchIcons(projectId);
    set({ icons });
  },

  updateIcon: async (id, updates) => {
    const icon = get().icons.find(i => i.id === id);
    const { projectId: _pid, ...rest } = updates as Partial<IconGlyph> & { projectId?: string };

    let uploadedNew = false;
    if (updates.svgContent && icon) {
      const formData = new FormData();
      formData.append('file', new Blob([updates.svgContent], { type: 'image/svg+xml' }), `${id}.svg`);
      formData.append('projectId', icon.projectId);
      formData.append('iconId', id);
      const token = await getIdToken();
      const res = await fetch('/api/upload-svg', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }
      const { url: r2Url } = await res.json();
      rest.r2Url = r2Url;
      uploadedNew = true;
    }

    try {
      await updateDoc(doc(firestore, 'icons', id), omitUndefined({ ...rest, updatedAt: Date.now() }));
    } catch (err) {
      if (uploadedNew && icon) {
        try {
          const formData = new FormData();
          formData.append('file', new Blob([icon.svgContent], { type: 'image/svg+xml' }), `${id}.svg`);
          formData.append('projectId', icon.projectId);
          formData.append('iconId', id);
          const token = await getIdToken();
          await fetch('/api/upload-svg', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
        } catch (rollbackErr) {
          console.error('Failed to restore R2 to previous state:', rollbackErr);
        }
      }
      throw err;
    }

    const projectId = icon?.projectId ?? get().icons[0]?.projectId;
    if (projectId) {
      const icons = await fetchIcons(projectId);
      set({ icons });
    }
  },

  deleteIcons: async (ids) => {
    const iconsToDelete = get().icons.filter(i => ids.includes(i.id));
    if (iconsToDelete.length === 0) return;

    const byProject = new Map<string, string[]>();
    for (const i of iconsToDelete) {
      const list = byProject.get(i.projectId) ?? [];
      list.push(i.id);
      byProject.set(i.projectId, list);
    }

    const token = await getIdToken();
    for (const [projectId, iconIds] of byProject) {
      const res = await fetch('/api/delete-r2-objects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, iconIds }),
      });
      if (!res.ok) {
        throw new Error(`Failed to delete R2 objects: ${res.status}`);
      }
    }

    const batch = writeBatch(firestore);
    ids.forEach(id => batch.delete(doc(firestore, 'icons', id)));
    const now = Date.now();
    for (const [projectId, iconIds] of byProject) {
      batch.update(doc(firestore, 'project', projectId), {
        iconCount: increment(-iconIds.length),
        updatedAt: now,
      });
    }
    await batch.commit();
    for (const [projectId, iconIds] of byProject) {
      useProjectStore.getState().adjustIconCount(projectId, -iconIds.length);
    }
    set({ icons: get().icons.filter(i => !ids.includes(i.id)) });
  },

  reorderIcons: async (orderedIds) => {
    const batch = writeBatch(firestore);
    orderedIds.forEach((id, index) => {
      batch.update(doc(firestore, 'icons', id), { order: index });
    });
    await batch.commit();
    const icons = get().icons.slice().sort((a, b) => {
      const aIdx = orderedIds.indexOf(a.id);
      const bIdx = orderedIds.indexOf(b.id);
      return aIdx - bIdx;
    });
    icons.forEach((icon, i) => { icon.order = i; });
    set({ icons });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  getNextOrder: () => {
    const { icons } = get();
    return icons.length > 0 ? Math.max(...icons.map(i => i.order)) + 1 : 0;
  },
}));
