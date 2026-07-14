import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  collection, deleteField, doc, getDocs, updateDoc, query, where, writeBatch, increment,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { getIdToken } from '@/hooks/use-auth';
import { useProjectStore } from '@/stores/project-store';
import { validateIcon } from '@/lib/firestore-schema';
import {
  hydrateIcons, migrateLegacyIcons, uploadSvgBlob, evictDerivationCache,
  withConcurrency, markIconDirty, UPLOAD_CONCURRENCY, type HydrationSeed,
} from '@/lib/icon-hydration';
import { deriveArtworkFromBlob } from '@/lib/svg-processing/svg-derive';
import type { IconGlyph } from '@/types';

interface IconStore {
  icons: IconGlyph[];
  loading: boolean;
  /** Icons whose R2 artwork could not be fetched/derived on the last load. */
  hydrationFailures: number;
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

async function fetchIcons(projectId: string, seed?: HydrationSeed): Promise<IconGlyph[]> {
  const snap = await getDocs(query(collection(firestore, 'icons'), where('parent', '==', projectId)));
  return hydrateIcons(snapToIcons(snap), seed);
}

/** Seed hydration with the artwork already held in memory, so refetches after
 *  a write don't round-trip to R2 for icons we already have. Seeds carry the
 *  updatedAt they belong to and are ignored when the refetched doc is newer. */
function seedFromIcons(icons: IconGlyph[]): HydrationSeed {
  const seed: HydrationSeed = new Map();
  for (const i of icons) {
    if (!i.svgContent) continue;
    seed.set(i.id, {
      svgContent: i.svgContent,
      pathData: i.pathData,
      viewBox: i.viewBox,
      width: i.width,
      height: i.height,
      updatedAt: i.updatedAt,
    });
  }
  return seed;
}

// Bumped on every loadIcons; async work checks it before committing to the
// store so a slow load/refetch can't clobber a newer project's icons.
let loadEpoch = 0;

export const useIconStore = create<IconStore>((set, get) => ({
  icons: [],
  loading: false,
  hydrationFailures: 0,
  searchQuery: '',

  loadIcons: async (projectId: string) => {
    const epoch = ++loadEpoch;
    set({ loading: true, icons: [], hydrationFailures: 0 });
    try {
      const snap = await getDocs(query(collection(firestore, 'icons'), where('parent', '==', projectId)));
      const docs = snapToIcons(snap);
      // Docs still carrying inline artwork are legacy; they migrate to
      // metadata-only in the background. Their in-memory artwork is re-derived
      // (not used verbatim): pre-R2-era docs stored pathData untranslated next
      // to a <g translate> wrapper svgContent, and deriving bakes the
      // transform in — same output blob hydration will produce post-migration.
      const legacy = docs.filter(i => i.svgContent);
      let derived = 0;
      for (const icon of legacy) {
        try {
          Object.assign(icon, deriveArtworkFromBlob(icon.svgContent, icon.name));
        } catch {
          // keep the inline values; migration still handles the doc
        }
        if (++derived % 15 === 0) await new Promise(r => setTimeout(r, 0));
      }
      const icons = await hydrateIcons(docs);
      if (epoch !== loadEpoch) return; // a newer project load superseded this one
      const hydrationFailures = icons.filter(i => !i.svgContent && i.r2Url).length;
      set({ icons, loading: false, hydrationFailures });
      if (legacy.length > 0) {
        void migrateLegacyIcons(legacy);
      }
    } finally {
      if (epoch === loadEpoch) set({ loading: false });
    }
  },

  addIcons: async (projectId, newIcons) => {
    const epoch = loadEpoch;
    const currentMax = get().getNextOrder();
    const now = Date.now();
    const iconsToAdd: IconGlyph[] = newIcons.map((icon, i) => ({
      ...icon,
      id: icon.id ?? uuid(),
      order: currentMax + i,
      createdAt: now,
      updatedAt: now,
    }));
    try {
      // Every icon needs its blob in R2 before the metadata-only doc is
      // written (the SVG import hook pre-uploads; font/JSON paths don't).
      const needUpload = iconsToAdd.filter(i => !i.r2Url);
      await withConcurrency(needUpload, UPLOAD_CONCURRENCY, async icon => {
        icon.r2Url = await uploadSvgBlob(projectId, icon.id, icon.svgContent);
      });

      const batch = writeBatch(firestore);
      for (const icon of iconsToAdd) {
        const { id, projectId: _pid, svgContent: _svg, pathData: _path, ...rest } = icon;
        batch.set(doc(firestore, 'icons', id), omitUndefined({ ...rest, parent: projectId }));
      }
      batch.update(doc(firestore, 'project', projectId), {
        iconCount: increment(iconsToAdd.length),
        updatedAt: Date.now(),
      });
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
    const seed = seedFromIcons([...get().icons, ...iconsToAdd]);
    const icons = await fetchIcons(projectId, seed);
    if (epoch === loadEpoch) set({ icons });
  },

  updateIcon: async (id, updates) => {
    const epoch = loadEpoch;
    const icon = get().icons.find(i => i.id === id);
    // Artwork is never written to the doc — it lives in R2.
    const { projectId: _pid, svgContent: _svg, pathData: _path, ...rest } =
      updates as Partial<IconGlyph> & { projectId?: string };

    // A save whose merged artwork has no path is the signature of an icon
    // whose hydration failed (blank tile) being "edited": committing it would
    // overwrite the ONLY copy of the artwork in R2 with a blank glyph.
    const mergedPath = updates.pathData ?? icon?.pathData ?? '';
    if (updates.svgContent && !mergedPath.trim()) {
      throw new Error('Refusing to save empty artwork — the icon may have failed to load. Reload the page and try again.');
    }

    // Tell the lazy migration to leave this icon alone from now on: after this
    // write the doc no longer carries inline artwork, and a racing migration
    // upload could silently revert this edit's blob.
    markIconDirty(id);

    let uploadedNew = false;
    if (updates.svgContent && icon) {
      rest.r2Url = await uploadSvgBlob(icon.projectId, id, updates.svgContent);
      uploadedNew = true;
    }

    const now = Date.now();
    const docUpdates: Record<string, unknown> = omitUndefined({ ...rest, updatedAt: now });
    // Strip inline artwork from legacy docs only when this write itself
    // confirmed a blob (2xx upload). A stored r2Url alone is not proof the
    // object exists — dangling references would make a rename destructive.
    if (uploadedNew) {
      docUpdates.svgContent = deleteField();
      docUpdates.pathData = deleteField();
    }

    try {
      await updateDoc(doc(firestore, 'icons', id), docUpdates);
    } catch (err) {
      if (uploadedNew && icon) {
        try {
          await uploadSvgBlob(icon.projectId, id, icon.svgContent);
        } catch (rollbackErr) {
          console.error('Failed to restore R2 to previous state:', rollbackErr);
        }
      }
      throw err;
    }

    const projectId = icon?.projectId ?? get().icons[0]?.projectId;
    if (projectId) {
      const seed = seedFromIcons(get().icons);
      const finalSvg = updates.svgContent ?? icon?.svgContent ?? '';
      if (icon && finalSvg) {
        seed.set(id, {
          svgContent: finalSvg,
          pathData: updates.pathData ?? icon.pathData,
          viewBox: updates.viewBox ?? icon.viewBox,
          width: updates.width ?? icon.width,
          height: updates.height ?? icon.height,
          updatedAt: now,
        });
      } else {
        seed.delete(id);
      }
      const icons = await fetchIcons(projectId, seed);
      if (epoch === loadEpoch) set({ icons });
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

    // Docs first, blobs second: with metadata-only docs the doc has no artwork
    // fallback, so deleting the blob first could permanently destroy an icon
    // if the doc delete then failed. Orphan blobs are cheap and harmless.
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
    void evictDerivationCache(ids);

    try {
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
          console.error(`R2 cleanup failed (${res.status}); orphan blobs left for project ${projectId}`);
        }
      }
    } catch (err) {
      console.error('R2 cleanup failed; orphan blobs left:', err);
    }
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
