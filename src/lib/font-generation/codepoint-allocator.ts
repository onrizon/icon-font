import type { IconGlyph } from '@/types';
import { PUA_START, PUA_END } from './constants';

export function allocateCodepoints(icons: IconGlyph[]): Map<string, number> {
  const allocation = new Map<string, number>();
  const usedCodepoints = new Set<number>();

  // First pass: respect existing assignments
  for (const icon of icons) {
    if (icon.unicode && icon.unicode >= PUA_START && icon.unicode <= PUA_END) {
      allocation.set(icon.id, icon.unicode);
      usedCodepoints.add(icon.unicode);
    }
  }

  // Second pass: assign to unassigned icons
  let nextCodepoint = PUA_START;
  for (const icon of icons) {
    if (!allocation.has(icon.id)) {
      while (usedCodepoints.has(nextCodepoint) && nextCodepoint <= PUA_END) {
        nextCodepoint++;
      }
      if (nextCodepoint > PUA_END) {
        throw new Error('Exceeded Private Use Area capacity');
      }
      allocation.set(icon.id, nextCodepoint);
      usedCodepoints.add(nextCodepoint);
      nextCodepoint++;
    }
  }

  return allocation;
}

export function formatCodepoint(codepoint: number): string {
  return codepoint.toString(16).toUpperCase().padStart(4, '0');
}
