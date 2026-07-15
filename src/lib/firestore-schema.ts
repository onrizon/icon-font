import type { IconGlyph, Project } from '@/types';

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

/**
 * Validate a Firestore project doc payload. The `id` is supplied by the caller
 * (it lives on the document, not in the data). Missing `iconCount` is coerced
 * to 0 to tolerate docs created before Phase 3.
 */
export function validateProject(id: string, data: unknown): Project {
  if (!data || typeof data !== 'object') {
    throw new Error(`Project ${id}: not an object`);
  }
  const d = data as Record<string, unknown>;
  const required = {
    ownerUid: d.ownerUid,
    name: d.name,
    fontName: d.fontName,
    fontFamily: d.fontFamily,
    prefix: d.prefix,
  };
  for (const [k, v] of Object.entries(required)) {
    if (!isString(v)) throw new Error(`Project ${id}: missing or non-string ${k}`);
  }
  const numbers = {
    unitsPerEm: d.unitsPerEm,
    ascender: d.ascender,
    descender: d.descender,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
  for (const [k, v] of Object.entries(numbers)) {
    if (!isNumber(v)) throw new Error(`Project ${id}: missing or non-numeric ${k}`);
  }
  return {
    id,
    ownerUid: required.ownerUid as string,
    ownerName: isString(d.ownerName) ? d.ownerName : undefined,
    name: required.name as string,
    fontName: required.fontName as string,
    fontFamily: required.fontFamily as string,
    prefix: required.prefix as string,
    unitsPerEm: numbers.unitsPerEm as number,
    ascender: numbers.ascender as number,
    descender: numbers.descender as number,
    iconCount: isNumber(d.iconCount) ? d.iconCount : 0,
    createdAt: numbers.createdAt as number,
    updatedAt: numbers.updatedAt as number,
  };
}

/**
 * Validate a Firestore icon doc payload. Firestore stores the project FK as
 * `parent`; we expose it on `IconGlyph` as `projectId`.
 */
export function validateIcon(id: string, data: unknown): IconGlyph {
  if (!data || typeof data !== 'object') {
    throw new Error(`Icon ${id}: not an object`);
  }
  const d = data as Record<string, unknown>;
  const projectId = d.parent;
  if (!isString(projectId)) throw new Error(`Icon ${id}: missing or non-string parent`);

  const strings = { name: d.name, viewBox: d.viewBox };
  for (const [k, v] of Object.entries(strings)) {
    if (!isString(v)) throw new Error(`Icon ${id}: missing or non-string ${k}`);
  }
  const numbers = { width: d.width, height: d.height, order: d.order, createdAt: d.createdAt, updatedAt: d.updatedAt };
  for (const [k, v] of Object.entries(numbers)) {
    if (!isNumber(v)) throw new Error(`Icon ${id}: missing or non-numeric ${k}`);
  }
  if (!isStringArray(d.tags)) throw new Error(`Icon ${id}: missing or non-string-array tags`);

  return {
    id,
    projectId,
    name: strings.name as string,
    // Metadata-only docs omit svgContent/pathData (artwork lives in R2 and is
    // hydrated after load); legacy docs still carry them inline until migrated.
    svgContent: isString(d.svgContent) ? d.svgContent : '',
    pathData: isString(d.pathData) ? d.pathData : '',
    viewBox: strings.viewBox as string,
    width: numbers.width as number,
    height: numbers.height as number,
    unicode: isNumber(d.unicode) ? d.unicode : undefined,
    ligature: isString(d.ligature) ? d.ligature : undefined,
    tags: d.tags,
    order: numbers.order as number,
    r2Url: isString(d.r2Url) ? d.r2Url : undefined,
    createdAt: numbers.createdAt as number,
    updatedAt: numbers.updatedAt as number,
  };
}
