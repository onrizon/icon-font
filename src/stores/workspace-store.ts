import { create } from 'zustand';
import type { ViewMode, EditorTab } from '@/types';

interface WorkspaceStore {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  viewMode: ViewMode;
  activeTab: EditorTab;
  editingIconId: string | null;
  sidebarOpen: boolean;
  showGrid: boolean;
  gridSize: number;

  select: (id: string) => void;
  toggleSelect: (id: string) => void;
  rangeSelect: (id: string, allIds: string[]) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setViewMode: (mode: ViewMode) => void;
  setActiveTab: (tab: EditorTab) => void;
  setEditingIconId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setGridSize: (size: number) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  selectedIds: new Set<string>(),
  lastSelectedId: null,
  viewMode: 'medium',
  activeTab: 'icons',
  editingIconId: null,
  sidebarOpen: true,
  showGrid: false,
  gridSize: 16,

  select: (id) => set({ selectedIds: new Set([id]), lastSelectedId: id }),

  toggleSelect: (id) => {
    const { selectedIds } = get();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ selectedIds: next, lastSelectedId: id });
  },

  rangeSelect: (id, allIds) => {
    const { lastSelectedId, selectedIds } = get();
    if (!lastSelectedId) {
      set({ selectedIds: new Set([id]), lastSelectedId: id });
      return;
    }
    const startIdx = allIds.indexOf(lastSelectedId);
    const endIdx = allIds.indexOf(id);
    if (startIdx === -1 || endIdx === -1) {
      set({ selectedIds: new Set([id]), lastSelectedId: id });
      return;
    }
    const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const rangeIds = allIds.slice(from, to + 1);
    const next = new Set(selectedIds);
    rangeIds.forEach(rid => next.add(rid));
    set({ selectedIds: next });
  },

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setEditingIconId: (id) => set({ editingIconId: id, activeTab: id ? 'editor' : 'icons' }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setShowGrid: (show) => set({ showGrid: show }),

  setGridSize: (size) => set({ gridSize: Math.max(2, Math.min(64, Math.round(size))) }),
}));
