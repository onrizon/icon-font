import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  collection, doc, getDocs, updateDoc, deleteDoc, query, where, writeBatch,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
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
  getFilteredIcons: () => IconGlyph[];
  getNextOrder: () => number;
}

function omitUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function snapToIcons(snap: Awaited<ReturnType<typeof getDocs>>): IconGlyph[] {
  return snap.docs
    .map(d => {
      const data = d.data();
      return { ...data, id: d.id, projectId: data.parent } as IconGlyph;
    })
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
    await batch.commit();
    const icons = await fetchIcons(projectId);
    set({ icons });
  },

  updateIcon: async (id, updates) => {
    const icon = get().icons.find(i => i.id === id);
    const { projectId: _pid, ...rest } = updates as Partial<IconGlyph> & { projectId?: string };

    if (updates.svgContent && icon) {
      const formData = new FormData();
      formData.append('file', new Blob([updates.svgContent], { type: 'image/svg+xml' }), `${id}.svg`);
      formData.append('projectId', icon.projectId);
      formData.append('iconId', id);
      const res = await fetch('/api/upload-svg', { method: 'POST', body: formData });
      const { url: r2Url } = await res.json();
      rest.r2Url = r2Url;
    }

    await updateDoc(doc(firestore, 'icons', id), omitUndefined({ ...rest, updatedAt: Date.now() }));
    const projectId = icon?.projectId ?? get().icons[0]?.projectId;
    if (projectId) {
      const icons = await fetchIcons(projectId);
      set({ icons });
    }
  },

  deleteIcons: async (ids) => {
    const batch = writeBatch(firestore);
    ids.forEach(id => batch.delete(doc(firestore, 'icons', id)));
    await batch.commit();
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

  getFilteredIcons: () => {
    const { icons, searchQuery } = get();
    if (!searchQuery) return icons;
    const q = searchQuery.toLowerCase();
    return icons.filter(
      icon =>
        icon.name.toLowerCase().includes(q) ||
        icon.tags.some(t => t.toLowerCase().includes(q))
    );
  },

  getNextOrder: () => {
    const { icons } = get();
    return icons.length > 0 ? Math.max(...icons.map(i => i.order)) + 1 : 0;
  },
}));
