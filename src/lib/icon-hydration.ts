'use client';

import { deleteField, doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { getIdToken } from '@/hooks/use-auth';
import { deriveArtworkFromBlob, type DerivedArtwork } from '@/lib/svg-processing/svg-derive';
import type { IconGlyph } from '@/types';

// Icon docs are metadata-only; the R2 blob `icons/{projectId}/{id}.svg` is the
// source of truth for artwork. This module fetches blobs (batched through
// /api/get-svgs), derives the in-memory `svgContent`/`pathData`, caches the
// derivation in IndexedDB keyed by updatedAt, and lazily migrates legacy docs
// that still carry inline artwork.

const GET_SVGS_CHUNK = 50; // must match MAX_IDS_PER_REQUEST in /api/get-svgs
const MIGRATE_CONCURRENCY = 4;
const UPLOAD_CONCURRENCY = 4;
const DERIVE_YIELD_EVERY = 15; // SVGO is synchronous; yield so big projects don't freeze the tab

export type { DerivedArtwork };

/**
 * In-memory values a write path already holds, so hydration can skip R2.
 * Entries carry the updatedAt they correspond to — a seed is only used when it
 * matches the refetched doc's updatedAt, otherwise a stale tab could cache old
 * artwork under another tab's newer timestamp.
 */
export type HydrationSeed = Map<string, DerivedArtwork & { updatedAt: number }>;

/**
 * Icons edited this session. Lazy migration skips them entirely: an edit means
 * the doc no longer carries inline artwork (updateIcon strips it), and racing
 * a migration upload against the edit's blob could silently revert the edit.
 */
const dirtyIconIds = new Set<string>();

export function markIconDirty(iconId: string): void {
  dirtyIconIds.add(iconId);
}

// ---------------------------------------------------------------------------
// IndexedDB derivation cache — best-effort: every failure degrades to a miss.
// ---------------------------------------------------------------------------

const DB_NAME = 'icon-font-derivations';
const STORE = 'derivations';

type CacheEntry = DerivedArtwork & { updatedAt: number };

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function cacheGet(iconId: string): Promise<CacheEntry | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(iconId);
      rq.onsuccess = () => resolve((rq.result as CacheEntry | undefined) ?? null);
      rq.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function cacheSet(iconId: string, entry: CacheEntry): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry, iconId);
  } catch {
    // cache write failures are harmless
  }
}

export async function evictDerivationCache(iconIds: string[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    for (const id of iconIds) store.delete(id);
  } catch {
    // harmless
  }
}

// ---------------------------------------------------------------------------
// Blob fetch + derivation
// ---------------------------------------------------------------------------

export async function fetchSvgsBatch(
  projectId: string,
  iconIds: string[]
): Promise<{ svgs: Record<string, string>; missing: string[] }> {
  const svgs: Record<string, string> = {};
  const missing: string[] = [];
  const token = await getIdToken();
  // The server bounds responses by bytes as well as count, returning overflow
  // ids as `pending` — requeue them. It always ships at least one blob per
  // request, so this loop is guaranteed to make progress.
  const queue = [...iconIds];
  while (queue.length > 0) {
    const chunk = queue.splice(0, GET_SVGS_CHUNK);
    const res = await fetch('/api/get-svgs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ projectId, iconIds: chunk }),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch SVGs: ${res.status}`);
    }
    const data = await res.json();
    Object.assign(svgs, data.svgs ?? {});
    missing.push(...(data.missing ?? []));
    if (Array.isArray(data.pending) && data.pending.length > 0) {
      queue.unshift(...data.pending);
    }
  }
  return { svgs, missing };
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

/**
 * Fill svgContent/pathData for metadata-only icons: seed -> IndexedDB cache ->
 * batched R2 fetch + derivation. Legacy icons (inline artwork present) pass
 * through verbatim. Never throws: failures leave icons with empty artwork so
 * one bad blob or a network error can't take down the grid.
 */
export async function hydrateIcons(icons: IconGlyph[], seed?: HydrationSeed): Promise<IconGlyph[]> {
  const needed = icons.filter(i => !i.svgContent);
  if (needed.length === 0) return icons;

  const resolved = new Map<string, DerivedArtwork>();
  const toFetch: IconGlyph[] = [];

  for (const icon of needed) {
    const seeded = seed?.get(icon.id);
    // updatedAt must match the refetched doc — a mismatch means another
    // tab/device wrote since, and using the seed would show (and cache) stale
    // artwork under the newer timestamp.
    if (seeded && seeded.svgContent && seeded.updatedAt === icon.updatedAt) {
      const { updatedAt: _ts, ...artwork } = seeded;
      resolved.set(icon.id, artwork);
      void cacheSet(icon.id, { ...artwork, updatedAt: icon.updatedAt });
      continue;
    }
    const cached = await cacheGet(icon.id);
    if (cached && cached.updatedAt === icon.updatedAt) {
      resolved.set(icon.id, cached);
      continue;
    }
    toFetch.push(icon);
  }

  if (toFetch.length > 0) {
    const byProject = new Map<string, IconGlyph[]>();
    for (const icon of toFetch) {
      const list = byProject.get(icon.projectId) ?? [];
      list.push(icon);
      byProject.set(icon.projectId, list);
    }

    for (const [projectId, group] of byProject) {
      let svgs: Record<string, string>;
      try {
        ({ svgs } = await fetchSvgsBatch(projectId, group.map(i => i.id)));
      } catch (err) {
        console.error(`Failed to fetch SVGs for project ${projectId}:`, err);
        continue;
      }
      let derivedCount = 0;
      for (const icon of group) {
        const blob = svgs[icon.id];
        if (!blob) {
          console.error(`Icon ${icon.id} (${icon.name}): R2 object missing`);
          continue;
        }
        try {
          const derived = deriveArtworkFromBlob(blob, icon.name);
          resolved.set(icon.id, derived);
          void cacheSet(icon.id, { ...derived, updatedAt: icon.updatedAt });
        } catch (err) {
          console.error(`Icon ${icon.id} (${icon.name}): failed to derive artwork`, err);
        }
        if (++derivedCount % DERIVE_YIELD_EVERY === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }
  }

  return icons.map(icon => {
    const artwork = resolved.get(icon.id);
    if (!artwork) return icon;
    // Blob-derived viewBox/width/height win in memory (self-healing if the doc
    // and blob ever diverge); the doc keeps its stored values as metadata.
    return { ...icon, ...artwork };
  });
}

/**
 * Hydration variant for JSON export: embeds the raw blob text verbatim as
 * svgContent (full fidelity, keeps colored originals) and derives pathData.
 * Throws when any artwork cannot be retrieved — an export is a backup, and a
 * silently incomplete backup is worse than a failed one.
 */
export async function hydrateIconsForExport(icons: IconGlyph[]): Promise<IconGlyph[]> {
  const needed = icons.filter(i => !i.svgContent);
  if (needed.length === 0) return icons;

  const byProject = new Map<string, IconGlyph[]>();
  for (const icon of needed) {
    const list = byProject.get(icon.projectId) ?? [];
    list.push(icon);
    byProject.set(icon.projectId, list);
  }

  const blobs = new Map<string, string>();
  for (const [projectId, group] of byProject) {
    const { svgs } = await fetchSvgsBatch(projectId, group.map(i => i.id));
    for (const [id, blob] of Object.entries(svgs)) blobs.set(id, blob);
  }

  const unavailable = needed.filter(i => !blobs.get(i.id));
  if (unavailable.length > 0) {
    const names = unavailable.slice(0, 5).map(i => i.name).join(', ');
    throw new Error(
      `Export aborted: artwork missing in storage for ${unavailable.length} icon(s) (${names}${unavailable.length > 5 ? ', …' : ''}).`
    );
  }

  return icons.map(icon => {
    const blob = blobs.get(icon.id);
    if (!blob) return icon;
    let pathData = icon.pathData;
    try {
      pathData = deriveArtworkFromBlob(blob, icon.name).pathData;
    } catch (err) {
      console.error(`Icon ${icon.id} (${icon.name}): failed to derive pathData for export`, err);
    }
    return { ...icon, svgContent: blob, pathData };
  });
}

// ---------------------------------------------------------------------------
// Uploads + lazy migration
// ---------------------------------------------------------------------------

export async function uploadSvgBlob(projectId: string, iconId: string, svgContent: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', new Blob([svgContent], { type: 'image/svg+xml' }), `${iconId}.svg`);
  formData.append('projectId', projectId);
  formData.append('iconId', iconId);
  const token = await getIdToken();
  const res = await fetch('/api/upload-svg', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
  const { url } = await res.json();
  return url as string;
}

/** Run `worker` over `items` with a small concurrency pool. */
export async function withConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await worker(item);
      }
    })
  );
}

/**
 * Lazy migration of legacy docs (inline svgContent/pathData) to metadata-only.
 * Loss-proof rules, in order:
 * - Icons edited this session (dirtyIconIds) are skipped entirely — the edit
 *   already stripped the doc, and racing its blob could revert the edit.
 * - A stored r2Url is only trusted after the blob's existence is verified via
 *   /api/get-svgs; a dangling reference gets the inline artwork re-uploaded.
 * - The doc is re-read right before acting: if it no longer carries inline
 *   artwork (another tab migrated or an edit landed), nothing is touched, and
 *   the read-back values — not the load-time snapshot — are what get uploaded.
 * - The R2 blob is confirmed BEFORE the inline artwork is deleted from the doc.
 * Failures are logged and retried on the next project open. updatedAt is not
 * bumped (not a user edit), so cache entries seeded here stay valid.
 */
export async function migrateLegacyIcons(legacyIcons: IconGlyph[]): Promise<void> {
  const candidates = legacyIcons.filter(i => !dirtyIconIds.has(i.id));
  if (candidates.length === 0) return;

  // Batch-verify claimed blobs per project. null = verification request
  // failed → treat that project's r2Urls as unknown and skip those icons
  // this round rather than risk overwriting a colored original blob.
  const verified = new Map<string, Set<string> | null>();
  const withUrl = candidates.filter(i => i.r2Url);
  const byProject = new Map<string, IconGlyph[]>();
  for (const icon of withUrl) {
    const list = byProject.get(icon.projectId) ?? [];
    list.push(icon);
    byProject.set(icon.projectId, list);
  }
  for (const [projectId, group] of byProject) {
    try {
      const { svgs } = await fetchSvgsBatch(projectId, group.map(i => i.id));
      verified.set(projectId, new Set(Object.keys(svgs)));
    } catch (err) {
      console.error(`Migration blob verification failed for project ${projectId}; skipping its icons this round:`, err);
      verified.set(projectId, null);
    }
  }

  await withConcurrency(candidates, MIGRATE_CONCURRENCY, async icon => {
    try {
      if (dirtyIconIds.has(icon.id)) return;
      const projectVerified = verified.get(icon.projectId);
      if (icon.r2Url && projectVerified === null) return; // verification unavailable

      // Re-read the doc: another tab may have migrated it, or an edit stripped
      // it, since this project loaded. The doc is the authority, not the
      // load-time snapshot.
      const snap = await getDoc(doc(firestore, 'icons', icon.id));
      const d = snap.data();
      if (!snap.exists() || typeof d?.svgContent !== 'string' || !d.svgContent) return;
      const inlineSvg = d.svgContent as string;

      let r2Url = typeof d.r2Url === 'string' ? d.r2Url : undefined;
      const blobConfirmed = !!r2Url && !!projectVerified?.has(icon.id);
      if (!blobConfirmed) {
        // No blob (font-imported legacy) or dangling reference — the inline
        // artwork is the source of truth; a 2xx here confirms the blob.
        if (dirtyIconIds.has(icon.id)) return;
        r2Url = await uploadSvgBlob(icon.projectId, icon.id, inlineSvg);
      }

      if (dirtyIconIds.has(icon.id)) return;
      const updates: Record<string, unknown> = {
        svgContent: deleteField(),
        pathData: deleteField(),
      };
      if (r2Url !== d.r2Url) updates.r2Url = r2Url;
      await updateDoc(doc(firestore, 'icons', icon.id), updates);

      // Seed the derivation cache from the read-back inline artwork so the
      // next load renders identically with zero fetching. Derived (not
      // verbatim) so pathData gets group transforms baked, matching what
      // blob hydration will produce.
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : icon.updatedAt;
      try {
        void cacheSet(icon.id, { ...deriveArtworkFromBlob(inlineSvg, icon.name), updatedAt });
      } catch {
        // cache seeding is best-effort; blob hydration covers the next load
      }
    } catch (err) {
      console.error(`Migration failed for icon ${icon.id} (${icon.name}); will retry next load:`, err);
    }
  });
}

export { UPLOAD_CONCURRENCY };
