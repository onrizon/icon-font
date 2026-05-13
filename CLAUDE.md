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

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui (new-york style). Single-page client-side app — all components are `'use client'`. State via Zustand, persistence via Dexie.js (IndexedDB). Font writing via `fonteditor-core` (real TrueType glyf/loca + gasp). Font reading via `opentype.js`. SVG path math via `svg-pathdata`. WOFF2 compression via `woff2-encoder`. Drag-and-drop reordering via @dnd-kit. Export via JSZip + file-saver.

## Architecture

### Data Flow

The app converts SVG icons into font files through this pipeline:

1. **Import**: SVG files → SVGO optimize → DOMParser parse → shape-to-path → normalize to square viewBox → store as `IconGlyph`
2. **Font Import**: TTF/WOFF/WOFF2/SVG font → opentype.parse or DOMParser (WOFF2 decompressed first) → reverse Y-flip transform → bounding-box-fitted SVG → store as `IconGlyph`
3. **Generate**: Icons → allocate PUA codepoints (0xE000–0xF8FF, max ~6,400 icons) → build SVG-font XML (Y-flip + scale) → `fonteditor-core` `Font.create(svg, { type: 'svg' })` (parser converts cubic→quadratic Béziers) → attach raw `gasp` table bytes → `font.write({ type: 'ttf', hinting: true })` → real TrueType (`glyf`/`loca` + `gasp`) ArrayBuffer → WOFF2 via `woff2-encoder`. opentype.js is *not* used on the write path.
4. **Export**: Font buffers + CSS (with @font-face + icon classes) + HTML demo → JSZip → download. Also supports JSON project export/import for full project serialization.

### Coordinate Transform (critical)

Font coordinates use Y-up; SVG uses Y-down. The transform in `svg-to-glyph.ts`:
```
scale(s, s) → translate(0, -ascender) → scale(1, -1)
```
where `s = unitsPerEm / max(viewBoxWidth, viewBoxHeight)`. The reverse in `font-file-parser.ts` undoes this, then fits content into a centered square viewBox via bounding-box computation.

### State Management (Zustand)

- **`useProjectStore`** — Projects CRUD, current project, font settings (unitsPerEm, ascender, descender). Persists current project ID to localStorage.
- **`useIconStore`** — Icons CRUD, search/filter, ordering. All icons belong to a `projectId`.
- **`useWorkspaceStore`** — UI-only: selection (Set of IDs with single/toggle/range/all), view mode, active tab, sidebar state.

Stores interact with Dexie directly. Switching projects triggers `loadIcons(projectId)` in `page.tsx` via useEffect.

### Storage (Dexie.js)

Database `IconFontGenDB` with two tables:
- `icons`: id (PK), projectId, name, unicode, order, [projectId+order]
- `projects`: id (PK), name, createdAt

### Page Structure

Single route (`page.tsx`). `Home` component loads projects/icons, renders Header + Sidebar + WorkspaceContent + BottomBar. WorkspaceContent switches on `activeTab`: icons (grid + dropzone with drag-and-drop reordering), editor (icon transforms: rotate/flip/scale/translate via `svg-transformer.ts`), generate, preview (project settings).

## Key Gotchas

- **SVGO**: Must `import from 'svgo/browser'` — the main entry pulls in `fs/promises`. Cast config `as any` due to different browser types.
- **opentype.js**: No `@types` package — custom declarations at `src/types/opentype.d.ts`. Used **only for reading** imported fonts (`font-file-parser.ts`). Extend the d.ts when using new opentype APIs.
- **fonteditor-core**: Used **only for writing** the generated TTF (real glyf/loca + gasp). Built-in TS types at `node_modules/fonteditor-core/index.d.ts` are partial; the gasp field isn't declared on `TTFObject` and gets attached via a typed-cast in `opentype-generator.ts`. The writer only emits the gasp table when called with `hinting: true`.
- **svg-pathdata**: Arc-to-curve is `A_TO_C()` not `ARC_TO_CUBIC_CURVES`. Transform methods (`scale`, `translate`, `toAbs`) return new instances. Use `encodeSVGPath(path.commands)` to serialize.
- **woff2-encoder**: Async compression/decompression — can fail silently, wrapped in try/catch. WOFF2 detected via magic bytes (`0x774F4632`).
- **Path alias**: `@/*` maps to `./src/*` (tsconfig).
- **All components are client**: This is a fully client-side app. Every component file needs `'use client'`.
- **SVG shape-to-path**: `svg-parser.ts` converts `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<polyline>`, `<line>` to `<path>` before processing.

## Core Types (`src/types/index.ts`)

- **`IconGlyph`** — Icon with SVG content, pathData, viewBox, unicode, tags, order
- **`Project`** — Font project: fontName, fontFamily, prefix, unitsPerEm, ascender, descender
- **`FontSettings`** — Subset of Project for font config updates
