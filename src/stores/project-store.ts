import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
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
}

const DEFAULT_PROJECT: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'My Icon Font',
  fontName: 'my-icons',
  fontFamily: 'my-icons',
  prefix: 'icon',
  unitsPerEm: 1024,
  ascender: 1024,
  descender: 0,
  baselineOffset: 0,
};

async function fetchProjects(): Promise<Project[]> {
  const snap = await getDocs(collection(firestore, 'project'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  currentProject: null,
  loading: true,

  loadProjects: async () => {
    const projects = await fetchProjects();
    if (projects.length === 0) {
      const project = await get().createProject();
      set({ projects: [project], currentProjectId: project.id, currentProject: project, loading: false });
    } else {
      const savedId = localStorage.getItem('currentProjectId');
      const currentId = savedId && projects.find(p => p.id === savedId) ? savedId : projects[0].id;
      set({
        projects,
        currentProjectId: currentId,
        currentProject: projects.find(p => p.id === currentId) || projects[0],
        loading: false,
      });
    }
  },

  createProject: async (name?: string) => {
    const now = Date.now();
    const project: Project = {
      id: uuid(),
      ...DEFAULT_PROJECT,
      ...(name ? { name, fontName: name.toLowerCase().replace(/\s+/g, '-'), fontFamily: name.toLowerCase().replace(/\s+/g, '-') } : {}),
      createdAt: now,
      updatedAt: now,
    };
    const { id, ...data } = project;
    await setDoc(doc(firestore, 'project', id), data);
    const projects = await fetchProjects();
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
    await updateDoc(doc(firestore, 'project', id), { ...updates, updatedAt: Date.now() });
    const projects = await fetchProjects();
    const currentProject = projects.find(p => p.id === get().currentProjectId) || null;
    set({ projects, currentProject });
  },

  updateFontSettings: async (settings: Partial<FontSettings>) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;
    await get().updateProject(currentProjectId, settings);
  },

  deleteProject: async (id: string) => {
    await deleteDoc(doc(firestore, 'project', id));
    const iconsSnap = await getDocs(query(collection(firestore, 'icons'), where('parent', '==', id)));
    if (!iconsSnap.empty) {
      const iconIds = iconsSnap.docs.map(d => d.id);
      await fetch('/api/delete-r2-objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: iconIds.map(iconId => `icons/${id}/${iconId}.svg`) }),
      });
      const batch = writeBatch(firestore);
      iconsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    const projects = await fetchProjects();
    if (projects.length === 0) {
      const project = await get().createProject();
      set({ projects: [project], currentProjectId: project.id, currentProject: project });
    } else if (get().currentProjectId === id) {
      set({ projects, currentProjectId: projects[0].id, currentProject: projects[0] });
      localStorage.setItem('currentProjectId', projects[0].id);
    } else {
      set({ projects });
    }
  },
}));
