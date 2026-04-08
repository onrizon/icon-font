export interface IconGlyph {
  id: string;
  projectId: string;
  name: string;
  svgContent: string;
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
  name: string;
  fontName: string;
  fontFamily: string;
  prefix: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  baselineOffset: number;
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

export interface GeneratedFont {
  ttf: ArrayBuffer;
  woff: ArrayBuffer;
  woff2: ArrayBuffer;
  svg: string;
  css: string;
  html: string;
}

export interface ExportOptions {
  formats: ('ttf' | 'woff2')[];
  prefix: string;
  fontName: string;
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
