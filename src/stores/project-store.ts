import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch,
} from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';
import { getIdToken } from '@/hooks/use-auth';
import { validateProject } from '@/lib/firestore-schema';
import type { Project, FontSettings } from '@/types';

interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;
  currentProject: Project | null;
  loading: boolean;

  loadProjects: () => Promise<void>;
  createProject: (name?: string) => Promise<Project>;
  switchProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  updateFontSettings: (settings: Partial<FontSettings>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  adjustIconCount: (projectId: string, delta: number) => void;
}

const DEFAULT_PROJECT: Omit<Project, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'> = {
  name: 'My Icon Font',
  fontName: 'my-icons',
  fontFamily: 'my-icons',
  prefix: 'icon',
  unitsPerEm: 1024,
  ascender: 1024,
  descender: 0,
  baselineOffset: 0,
  iconCount: 0,
};

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

async function fetchProjects(uid: string): Promise<Project[]> {
  const snap = await getDocs(query(collection(firestore, 'project'), where('ownerUid', '==', uid)));
  return snap.docs.map(d => validateProject(d.id, d.data()));
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  currentProject: null,
  loading: true,

  loadProjects: async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      set({ projects: [], currentProjectId: null, currentProject: null, loading: false });
      return;
    }
    const projects = await fetchProjects(uid);
    if (projects.length === 0) {
      set({ projects: [], currentProjectId: null, currentProject: null, loading: false });
      return;
    }
    const savedId = localStorage.getItem('currentProjectId');
    const currentId = savedId && projects.find(p => p.id === savedId) ? savedId : null;
    set({
      projects,
      currentProjectId: currentId,
      currentProject: currentId ? projects.find(p => p.id === currentId) || null : null,
      loading: false,
    });
  },

  createProject: async (name?: string) => {
    const uid = requireUid();
    const now = Date.now();
    const project: Project = {
      id: uuid(),
      ownerUid: uid,
      ...DEFAULT_PROJECT,
      ...(name ? { name, fontName: name.toLowerCase().replace(/\s+/g, '-'), fontFamily: name.toLowerCase().replace(/\s+/g, '-') } : {}),
      createdAt: now,
      updatedAt: now,
    };
    const { id, ...data } = project;
    await setDoc(doc(firestore, 'project', id), data);
    const projects = await fetchProjects(uid);
    set({ projects, currentProjectId: project.id, currentProject: project });
    localStorage.setItem('currentProjectId', project.id);
    return project;
  },

  switchProject: (id: string) => {
    const project = get().projects.find(p => p.id === id);
    if (project) {
      set({ currentProjectId: id, currentProject: project });
      localStorage.setItem('currentProjectId', id);
    }
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    const now = Date.now();
    await updateDoc(doc(firestore, 'project', id), { ...updates, updatedAt: now });
    const next = get().projects.map(p => (p.id === id ? { ...p, ...updates, updatedAt: now } : p));
    const currentProject = next.find(p => p.id === get().currentProjectId) || null;
    set({ projects: next, currentProject });
  },

  updateFontSettings: async (settings: Partial<FontSettings>) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;
    await get().updateProject(currentProjectId, settings);
  },

  adjustIconCount: (projectId: string, delta: number) => {
    const next = get().projects.map(p =>
      p.id === projectId ? { ...p, iconCount: Math.max(0, p.iconCount + delta) } : p
    );
    const currentProject = next.find(p => p.id === get().currentProjectId) || null;
    set({ projects: next, currentProject });
  },

  deleteProject: async (id: string) => {
    const uid = requireUid();
    const iconsSnap = await getDocs(query(collection(firestore, 'icons'), where('parent', '==', id)));
    if (!iconsSnap.empty) {
      const iconIds = iconsSnap.docs.map(d => d.id);
      const token = await getIdToken();
      const res = await fetch('/api/delete-r2-objects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId: id, iconIds }),
      });
      if (!res.ok) throw new Error(`Failed to delete R2 objects: ${res.status}`);
      const batch = writeBatch(firestore);
      iconsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(firestore, 'project', id));
    const projects = await fetchProjects(uid);
    if (get().currentProjectId === id) {
      localStorage.removeItem('currentProjectId');
      set({ projects, currentProjectId: null, currentProject: null });
    } else {
      set({ projects });
    }
  },
}));
