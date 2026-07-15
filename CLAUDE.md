# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Dev server (Turbopack, http://localhost:3000)
npm run build    # Production build (Turbopack)
npm run lint     # ESLint 9 (flat config)
```

No test framework is configured.

## Tech Stack

Next.js 16 (App Router) + React 19 + TypeScript + shadcn-style UI components (radix-ui) styled with **per-component CSS modules** under `src/app/styles/*` — no Tailwind at runtime. Client-heavy app: workspace components are `'use client'`; API routes under `src/app/api/*` are server-side. State via Zustand. Persistence: **Firestore** (icon/project docs, client SDK) + **Cloudflare R2** (raw SVG blobs via `/api/upload-svg`, `@aws-sdk/client-s3` + `firebase-admin` server-side). Auth via Firebase Google sign-in, restricted to the @onrizon.com.br domain (`src/lib/auth-domain.ts`; domain duplicated in `firestore.rules`). Font writing via `fonteditor-core` (real TrueType glyf/loca + gasp). Font reading via `opentype.js`. SVG path math via `svg-pathdata`. WOFF2 compression via `woff2-encoder`. Drag-and-drop reordering via @dnd-kit. Export via JSZip + file-saver.

## Architecture

### Data Flow

The app converts SVG icons into font files through this pipeline:

1. **Import**: SVG files → SVGO optimize → DOMParser parse → shape-to-path → normalize to square viewBox → store as `IconGlyph`
2. **Font Import**: TTF/WOFF/WOFF2/SVG font → opentype.parse or DOMParser (WOFF2 decompressed first) → reverse Y-flip transform → bounding-box-fitted SVG → store as `IconGlyph`
3. **Generate**: Icons → allocate PUA codepoints (0xE000–0xF8FF, max ~6,400 icons) → build SVG-font XML (Y-flip + scale using icomoon-style ascender) → `fonteditor-core` `Font.create(svg, { type: 'svg' })` (parser converts cubic→quadratic Béziers) → override `hhea` / `OS/2` v3 / `post` v3.0 / `name` / `.notdef` (glyf[0]) to match `src/components/fonts/icomoon.ttf` style → attach single-range `gasp` table bytes → `font.write({ type: 'ttf', hinting: true })` → real TrueType (`glyf`/`loca` + `gasp`) ArrayBuffer → WOFF2 via `woff2-encoder`. opentype.js is *not* used on the write path. `Project.ascender` / `Project.descender` are ignored at export; vertical metrics come from `icomoonStyleMetrics(unitsPerEm)` in `font-style.ts`.
4. **Export**: Font buffers + CSS (with @font-face + icon classes) + HTML demo → JSZip → download. Also supports JSON project export/import for full project serialization.

### Coordinate Transform (critical)

Font coordinates use Y-up; SVG uses Y-down. The forward transform lives in the SVG-font XML built by `svg-font-builder.ts`:
```
scale(s, s) → translate(0, -ascender) → scale(1, -1)
```
where `s = unitsPerEm / max(viewBoxWidth, viewBoxHeight)`. The reverse in `font-file-parser.ts` undoes this, then fits content into a centered square viewBox via bounding-box computation.

### State Management (Zustand)

- **`useProjectStore`** — Projects CRUD, current project, font settings (unitsPerEm, ascender, descender). Persists current project ID to localStorage.
- **`useIconStore`** — Icons CRUD, search/filter, ordering. All icons belong to a `projectId`.
- **`useWorkspaceStore`** — UI-only: selection (Set of IDs with single/toggle/range/all), view mode, active tab, sidebar state.

Stores call Firestore directly (client SDK) and upload SVG blobs to R2 through the API routes. Switching projects triggers `loadIcons(projectId)` in `src/app/workspace/[id]/page.tsx` via useEffect.

### Storage (Firestore + R2)

- Firestore collection `project` (singular): project docs keyed by id. **Shared team workspace**: every @onrizon.com.br user reads/writes every project (enforced by `firestore.rules`, deployed manually via Firebase console). `ownerUid`/`ownerName` are creation attribution only — `ownerUid` is immutable per rules; `ownerName` is lazily backfilled on the owner's own legacy projects at `loadProjects` (without bumping `updatedAt`) and shown on project cards.
- Firestore collection `icons`: **metadata-only** docs (`parent`, name, width/height/viewBox, unicode, ligature, tags, order, `r2Url`, timestamps — ~0.4 KB each, immune to the 1 MiB doc limit). The project FK is stored as `parent` and mapped to `projectId` by `validateIcon` in `src/lib/firestore-schema.ts`. **`svgContent`/`pathData` are NOT persisted** — they are runtime-hydrated from R2 by `hydrateIcons` in `src/lib/icon-hydration.ts` (batched via `POST /api/get-svgs`, ≤50 ids/request; fast-path parse for single-path blobs, else SVGO pipeline; IndexedDB cache keyed by `iconId`+`updatedAt`). Docs that still carry inline artwork are legacy and are lazily migrated on project open (`migrateLegacyIcons`: R2 blob confirmed first, then `deleteField` the inline artwork; `updatedAt` not bumped).
- R2 bucket: raw SVGs at `icons/{projectId}/{id}.svg` — the **single source of truth for artwork** — written on import/edit via `/api/upload-svg` (Bearer-token authenticated with a domain check, plus a project-existence check, in `src/lib/firebase-admin.ts`; 4 MB cap). `addIcons` uploads for any icon lacking `r2Url` (covers font import). Deletion order matters: Firestore docs first, then best-effort R2 cleanup (`deleteProject` must clean R2 before removing the project doc — the delete API's existence check reads it).
- Import guard: `processSvg` rejects files over 2 MB (`MAX_IMPORT_SVG_BYTES`) and SVGs containing `<image>` bitmaps. Per-file import errors surface via `useIconImport().errors`, rendered by `SvgDropzone`.

### Routes

- `/login` — Google sign-in page (@onrizon.com.br accounts only; non-domain sessions are auto-signed-out by `useAuth`).
- `/projects` — project cards grid (create/rename/delete).
- `/workspace/[id]` — the main workspace: Header + Sidebar + content switching on `activeTab`: icons (grid + dropzone with drag-and-drop reordering), editor (icon transforms: rotate/flip/scale/translate/align via `svg-transformer.ts` + `transform-panel.tsx`), generate, preview (project settings).

## Key Gotchas

- **SVGO**: Must `import from 'svgo/browser'` — the main entry pulls in `fs/promises`. Cast config `as any` due to different browser types.
- **opentype.js**: No `@types` package — custom declarations at `src/types/opentype.d.ts`. Used **only for reading** imported fonts (`font-file-parser.ts`). Extend the d.ts when using new opentype APIs.
- **fonteditor-core**: Used **only for writing** the generated TTF (real glyf/loca + gasp). Built-in TS types at `node_modules/fonteditor-core/index.d.ts` are partial; the gasp field isn't declared on `TTFObject` and gets attached via a typed-cast in `opentype-generator.ts`. The writer only emits the gasp table when called with `hinting: true`.
- **svg-pathdata**: Arc-to-curve is `A_TO_C()` not `ARC_TO_CUBIC_CURVES`. Transform methods (`scale`, `translate`, `toAbs`) return new instances. Use `encodeSVGPath(path.commands)` to serialize.
- **woff2-encoder**: Async compression/decompression — can fail silently, wrapped in try/catch. WOFF2 detected via magic bytes (`0x774F4632`).
- **Path alias**: `@/*` maps to `./src/*` (tsconfig).
- **Workspace components are client**: every component file under `src/components` needs `'use client'`. API routes and `src/lib/firebase-admin.ts`/`r2.ts` are server-only.
- **No Tailwind**: utility classes like `animate-spin` do nothing. Styling is CSS modules per component (`src/app/styles/*.module.css`).
- **SVG shape-to-path**: `svg-parser.ts` converts `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<polyline>`, `<line>` to `<path>` before processing.

## Core Types (`src/types/index.ts`)

- **`IconGlyph`** — Icon with SVG content, pathData, viewBox, unicode, tags, order
- **`Project`** — Font project: fontName, fontFamily, prefix, unitsPerEm, ascender, descender
- **`FontSettings`** — Subset of Project for font config updates
