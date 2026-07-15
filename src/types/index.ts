export interface IconGlyph {
  id: string;
  projectId: string;
  name: string;
  /**
   * Runtime-hydrated from the R2 blob (`icons/{projectId}/{id}.svg`) — not
   * persisted in Firestore. Empty string until hydration completes.
   */
  svgContent: string;
  /** Runtime-hydrated alongside svgContent — not persisted in Firestore. */
  pathData: string;
  viewBox: string;
  width: number;
  height: number;
  unicode?: number;
  ligature?: string;
  tags: string[];
  order: number;
  r2Url?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  ownerUid: string;
  /** Creator's display name; lazily backfilled on legacy docs by the owner's own session. */
  ownerName?: string;
  name: string;
  fontName: string;
  fontFamily: string;
  prefix: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  iconCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface FontSettings {
  fontName: string;
  fontFamily: string;
  prefix: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
}

export type ViewMode = 'small' | 'medium' | 'large';

export type EditorTab = 'icons' | 'editor' | 'preview' | 'generate';

export interface Transform {
  rotate: number;
  flipH: boolean;
  flipV: boolean;
  scale: number;
  translateX: number;
  translateY: number;
}
